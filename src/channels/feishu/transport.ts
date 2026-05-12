/**
 * Feishu transport — WebSocket long-connection and Webhook modes.
 *
 * WebSocket mode (recommended): uses the Feishu SDK's built-in WS client
 * to receive events without a public IP. Ideal for local development.
 *
 * Webhook mode: starts an HTTP server to receive Feishu event callbacks.
 * Requires a publicly accessible URL. Better for production deployments.
 */

import type {
  FeishuCardActionEvent,
  FeishuConfig,
  FeishuEventPayload,
  FeishuMessageEvent,
  FeishuTenantAccessToken,
} from './types.js'
import { WebSocket, type WebSocket as WS_TYPE } from 'ws'

export type TransportCallbacks = {
  onMessage: (event: FeishuMessageEvent) => void
  onCardAction: (event: FeishuCardActionEvent) => void
  onBotAdded?: (chatId: string) => void
  onBotRemoved?: (chatId: string) => void
  onError?: (error: Error) => void
  onStateChange?: (state: 'connected' | 'disconnected' | 'reconnecting') => void
}

export type FeishuTransport = {
  start(): Promise<void>
  stop(): Promise<void>
  getState(): 'connected' | 'disconnected' | 'reconnecting'
}

export function createFeishuTransport(
  config: FeishuConfig,
  callbacks: TransportCallbacks,
): FeishuTransport {
  if (config.transport === 'websocket') {
    return createWebSocketTransport(config, callbacks)
  }
  return createWebhookTransport(config, callbacks)
}

function createWebSocketTransport(
  config: FeishuConfig,
  callbacks: TransportCallbacks,
): FeishuTransport {
  let state: 'connected' | 'disconnected' | 'reconnecting' = 'disconnected'
  let wsClient: WS_TYPE | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let accessToken: string | null = null
  let tokenExpiry = 0

  async function start(): Promise<void> {
    state = 'reconnecting'
    callbacks.onStateChange?.('reconnecting')
    await connectWithRetry()
  }

  async function stop(): Promise<void> {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    if (wsClient) {
      wsClient.close()
      wsClient = null
    }
    state = 'disconnected'
    callbacks.onStateChange?.('disconnected')
  }

  function getState(): 'connected' | 'disconnected' | 'reconnecting' {
    return state
  }

  async function connectWithRetry(): Promise<void> {
    const maxRetries = 10
    let attempt = 0

    while (attempt < maxRetries) {
      try {
        await connect()
        return
      } catch (err) {
        attempt++
        const delay = Math.min(1000 * Math.pow(2, attempt), 30000)
        callbacks.onError?.(err instanceof Error ? err : new Error(String(err)))

        if (attempt >= maxRetries) {
          state = 'disconnected'
          callbacks.onStateChange?.('disconnected')
          throw new Error(`Failed to connect after ${maxRetries} attempts`)
        }

        state = 'reconnecting'
        callbacks.onStateChange?.('reconnecting')
        await new Promise(r => { reconnectTimer = setTimeout(r, delay) })
      }
    }
  }

  async function connect(): Promise<void> {
    accessToken = await fetchTenantAccessToken(config)
    tokenExpiry = Date.now() + 7200 * 1000 - 60000

    const wsUrl = `wss://open.feishu.cn/open-apis/event/ws/v1/connect`
    wsClient = new WebSocket(wsUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    })

    wsClient.on('open', () => {
      state = 'connected'
      callbacks.onStateChange?.('connected')
    })

    wsClient.on('message', (data: Buffer) => {
      try {
        const payload = JSON.parse(data.toString()) as FeishuEventPayload
        handleEvent(payload)
      } catch (err) {
        callbacks.onError?.(err instanceof Error ? err : new Error('Failed to parse WS message'))
      }
    })

    wsClient.on('close', () => {
      if (state !== 'disconnected') {
        state = 'reconnecting'
        callbacks.onStateChange?.('reconnecting')
        reconnectTimer = setTimeout(() => connectWithRetry(), 5000)
      }
    })

    wsClient.on('error', (err: Error) => {
      callbacks.onError?.(err)
    })

    await new Promise<void>((resolve, reject) => {
      wsClient!.once('open', () => {
        state = 'connected'
        callbacks.onStateChange?.('connected')
        resolve()
      })
      wsClient!.once('error', (err: Error) => {
        reject(new Error(`WebSocket connect failed: ${err.message}`))
      })
    })
  }

  function handleEvent(payload: FeishuEventPayload): void {
    const eventType = payload.header.event_type

    switch (eventType) {
      case 'im.message.receive_v1':
        callbacks.onMessage(payload.event as FeishuMessageEvent)
        break
      case 'card.action.trigger':
        callbacks.onCardAction(payload.event as FeishuCardActionEvent)
        break
      case 'im.chat.member.bot.added_v1':
        callbacks.onBotAdded?.('')
        break
      case 'im.chat.member.bot.deleted_v1':
        callbacks.onBotRemoved?.('')
        break
    }
  }

  return { start, stop, getState }
}

function createWebhookTransport(
  config: FeishuConfig,
  callbacks: TransportCallbacks,
): FeishuTransport {
  let state: 'connected' | 'disconnected' | 'reconnecting' = 'disconnected'
  let server: ReturnType<typeof import('http').createServer> | null = null

  async function start(): Promise<void> {
    const http = await import('http')

    server = http.createServer((req, res) => {
      if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200)
        res.end('ok')
        return
      }

      if (req.method !== 'POST') {
        res.writeHead(405)
        res.end()
        return
      }

      let body = ''
      req.on('data', chunk => { body += chunk })
      req.on('end', () => {
        try {
          const payload = JSON.parse(body) as FeishuEventPayload

          if (config.verificationToken && payload.header.token !== config.verificationToken) {
            res.writeHead(403)
            res.end('invalid token')
            return
          }

          res.writeHead(200)
          res.end('ok')

          handleWebhookEvent(payload)
        } catch {
          res.writeHead(400)
          res.end('invalid json')
        }
      })
    })

    const port = config.webhookPort ?? 3000
    await new Promise<void>((resolve, reject) => {
      server!.listen(port, () => {
        state = 'connected'
        callbacks.onStateChange?.('connected')
        resolve()
      })
      server!.on('error', reject)
    })
  }

  async function stop(): Promise<void> {
    if (server) {
      await new Promise<void>(resolve => server!.close(() => resolve()))
      server = null
    }
    state = 'disconnected'
    callbacks.onStateChange?.('disconnected')
  }

  function getState(): 'connected' | 'disconnected' | 'reconnecting' {
    return state
  }

  function handleWebhookEvent(payload: FeishuEventPayload): void {
    const eventType = payload.header.event_type

    switch (eventType) {
      case 'im.message.receive_v1':
        callbacks.onMessage(payload.event as FeishuMessageEvent)
        break
      case 'card.action.trigger':
        callbacks.onCardAction(payload.event as FeishuCardActionEvent)
        break
      case 'im.chat.member.bot.added_v1':
        callbacks.onBotAdded?.('')
        break
      case 'im.chat.member.bot.deleted_v1':
        callbacks.onBotRemoved?.('')
        break
    }
  }

  return { start, stop, getState }
}

export async function fetchTenantAccessToken(config: FeishuConfig): Promise<string> {
  const url = 'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal'

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      app_id: config.appId,
      app_secret: config.appSecret,
    }),
  })

  if (!response.ok) {
    throw new Error(`Failed to get tenant access token: ${response.status}`)
  }

  const data = await response.json() as FeishuTenantAccessToken & { code?: number; msg?: string }
  if (data.code && data.code !== 0) {
    throw new Error(`Feishu auth error: ${data.code} ${data.msg}`)
  }

  return data.tenant_access_token
}
