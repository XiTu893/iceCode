/**
 * OpenClaw WebSocket Channel Adapter.
 *
 * Implements the ChannelAdapter interface with the OpenClaw WebSocket
 * protocol, allowing any WebSocket client that speaks the OpenClaw
 * message format to connect and interact with the AI agent.
 */

import type { ChannelAdapter, ChannelCapabilities } from '../core/channelAdapter.js'
import type { ChannelConnectionState, ChannelMessage, ChannelStatus, InboundMessage, MessageContext, PermissionRequest, PermissionResponse } from '../core/types.js'
import type { OpenClawChatSend, OpenClawInboundMessage, OpenClawOutboundMessage, OpenClawWebSocketConfig } from './types.js'
import { WebSocketServer, type WebSocket } from 'ws'

const WS_CAPABILITIES: ChannelCapabilities = {
  inbound: true,
  outbound: true,
  permissionRelay: false,
  streaming: true,
  richContent: false,
  mediaAttachment: false,
  groupChat: true,
}

type ClientConnection = {
  ws: WebSocket
  senderId: string
  senderName?: string
  connectedAt: number
}

type AdapterCallbacks = {
  onMessage: Array<(message: InboundMessage) => void>
  onPermissionResponse: Array<(response: PermissionResponse) => void>
  onStateChange: Array<(state: ChannelConnectionState) => void>
  onError: Array<(error: Error) => void>
}

export function createWebSocketChannelAdapter(
  config?: Partial<OpenClawWebSocketConfig>,
): ChannelAdapter {
  const wsConfig: OpenClawWebSocketConfig = {
    port: config?.port ?? 18800,
    host: config?.host ?? '0.0.0.0',
    path: config?.path ?? '/ws',
  }

  let state: ChannelConnectionState = 'disconnected'
  let wss: WebSocketServer | null = null
  let connectedAt: number | undefined
  const clients = new Map<string, ClientConnection>()
  const sessionMap = new Map<string, string>()

  const callbacks: AdapterCallbacks = {
    onMessage: [],
    onPermissionResponse: [],
    onStateChange: [],
    onError: [],
  }

  async function start(): Promise<void> {
    state = 'connecting'
    for (const cb of callbacks.onStateChange) cb('connecting')

    wss = new WebSocketServer({
      port: wsConfig.port,
      host: wsConfig.host,
      path: wsConfig.path,
    })

    wss.on('connection', (ws, req) => {
      const url = new URL(req.url ?? '/', `http://${req.headers.host}`)
      const senderId = url.searchParams.get('senderId') ?? `ws_${Date.now()}`
      const senderName = url.searchParams.get('senderName') ?? undefined

      const clientId = `${senderId}_${Date.now()}`
      clients.set(clientId, {
        ws,
        senderId,
        senderName,
        connectedAt: Date.now(),
      })

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString()) as OpenClawInboundMessage
          handleInboundMessage(clientId, msg)
        } catch (err) {
          sendToClient(ws, {
            type: 'chat.error',
            error: 'Invalid message format',
            code: 'PARSE_ERROR',
          })
        }
      })

      ws.on('close', () => {
        clients.delete(clientId)
      })

      ws.on('error', (err) => {
        for (const cb of callbacks.onError) cb(err)
        clients.delete(clientId)
      })
    })

    wss.on('listening', () => {
      state = 'connected'
      connectedAt = Date.now()
      for (const cb of callbacks.onStateChange) cb('connected')
    })

    wss.on('error', (err) => {
      state = 'failed'
      for (const cb of callbacks.onError) cb(err)
      for (const cb of callbacks.onStateChange) cb('failed')
    })

    await new Promise<void>((resolve, reject) => {
      wss!.on('listening', resolve)
      wss!.on('error', reject)
    })
  }

  async function stop(): Promise<void> {
    if (wss) {
      for (const client of clients.values()) {
        client.ws.close()
      }
      clients.clear()
      wss.close()
      wss = null
    }
    state = 'disconnected'
    connectedAt = undefined
    for (const cb of callbacks.onStateChange) cb('disconnected')
  }

  function getState(): ChannelConnectionState {
    return state
  }

  function isHealthy(): boolean {
    return state === 'connected'
  }

  function getStatus(): ChannelStatus {
    return {
      name: 'websocket',
      kind: 'websocket',
      state,
      capabilities: WS_CAPABILITIES,
      activeSessions: clients.size,
      connectedAt,
    }
  }

  async function sendMessage(sessionId: string, message: ChannelMessage): Promise<void> {
    const clientId = sessionMap.get(sessionId)
    if (!clientId) {
      throw new Error(`No WebSocket client found for session: ${sessionId}`)
    }

    const client = clients.get(clientId)
    if (!client || client.ws.readyState !== WebSocket.OPEN) {
      throw new Error(`WebSocket client not connected: ${clientId}`)
    }

    const metadata = message.metadata ?? {}

    if (metadata.streaming) {
      sendToClient(client.ws, {
        type: 'chat.stream',
        messageId: metadata.messageId as string ?? `msg_${Date.now()}`,
        content: message.content,
        sequence: (metadata.sequence as number) ?? 0,
        done: metadata.done as boolean ?? false,
      })
    } else {
      sendToClient(client.ws, {
        type: 'chat.complete',
        messageId: metadata.messageId as string ?? `msg_${Date.now()}`,
        content: message.content,
      })
    }
  }

  async function sendPermissionRequest(_sessionId: string, _request: PermissionRequest): Promise<void> {
    throw new Error('WebSocket adapter does not support permission relay')
  }

  function onMessage(callback: (message: InboundMessage) => void): void {
    callbacks.onMessage.push(callback)
  }

  function onPermissionResponse(callback: (response: PermissionResponse) => void): void {
    callbacks.onPermissionResponse.push(callback)
  }

  function onStateChange(callback: (state: ChannelConnectionState) => void): void {
    callbacks.onStateChange.push(callback)
  }

  function onError(callback: (error: Error) => void): void {
    callbacks.onError.push(callback)
  }

  async function resolveSession(context: MessageContext): Promise<string> {
    const key = `${context.channelId}:${context.senderId}`
    if (sessionMap.has(key)) {
      return sessionMap.get(key)!
    }
    const sessionId = `ws_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    sessionMap.set(key, sessionId)
    return sessionId
  }

  function updateConfig(): void {}

  function handleInboundMessage(clientId: string, msg: OpenClawChatSend): void {
    const client = clients.get(clientId)
    if (!client) return

    if (msg.type !== 'chat.send') return

    const chatId = msg.chatType === 'group' && msg.groupId
      ? `group:${msg.groupId}`
      : `dm:${client.senderId}`

    const message: InboundMessage = {
      content: msg.content,
      context: {
        channelId: 'websocket',
        channelKind: 'websocket',
        chatId,
        chatType: msg.chatType === 'group' ? 'group' : 'direct',
        senderId: client.senderId,
        senderName: msg.senderName ?? client.senderName,
        replyToMessageId: msg.replyToMessageId,
        replyToBody: msg.replyToBody,
        customData: msg.customData,
      },
      timestamp: Date.now(),
    }

    for (const cb of callbacks.onMessage) cb(message)
  }

  function sendToClient(ws: WebSocket, msg: OpenClawOutboundMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg))
    }
  }

  return {
    name: 'websocket',
    kind: 'websocket',
    capabilities: WS_CAPABILITIES,
    start,
    stop,
    getState,
    isHealthy,
    getStatus,
    sendMessage,
    sendPermissionRequest,
    onMessage,
    onPermissionResponse,
    onStateChange,
    onError,
    resolveSession,
    updateConfig,
  }
}
