/**
 * FeishuChannelAdapter — implements the ChannelAdapter interface for Feishu.
 *
 * Bridges the Feishu Bot API (events, cards, messages) with the Channel
 * Gateway's unified routing layer. Owns the transport, session manager,
 * event handler, permission relay, and message formatter.
 */

import type { ChannelAdapter } from '../core/channelAdapter.js'
import type { ChannelCapabilities, ChannelConfig, ChannelConnectionState, ChannelMessage, ChannelStatus, InboundMessage, MessageContext, PermissionRequest, PermissionResponse } from '../core/types.js'
import type { FeishuConfig, FeishuCardActionEvent, FeishuMessageEvent } from './types.js'
import { createFeishuEventHandler } from './eventHandler.js'
import { createFeishuSessionManager, type FeishuSessionManager } from './sessionManager.js'
import { createFeishuPermissionRelay, type FeishuPermissionRelay } from './permissionRelay.js'
import { createMessageFormatter, type MessageFormatter } from './messageFormatter.js'
import { createFeishuTransport, fetchTenantAccessToken, type FeishuTransport } from './transport.js'
import { resolveFeishuConfig, validateFeishuConfig } from './config.js'

const FEISHU_CAPABILITIES: ChannelCapabilities = {
  inbound: true,
  outbound: true,
  permissionRelay: true,
  streaming: true,
  richContent: true,
  mediaAttachment: true,
  groupChat: true,
}

type AdapterCallbacks = {
  onMessage: Array<(message: InboundMessage) => void>
  onPermissionResponse: Array<(response: PermissionResponse) => void>
  onStateChange: Array<(state: ChannelConnectionState) => void>
  onError: Array<(error: Error) => void>
}

export function createFeishuChannelAdapter(config?: Partial<FeishuConfig>): ChannelAdapter {
  const feishuConfig = resolveFeishuConfig(config)
  if (!feishuConfig) {
    throw new Error('Feishu configuration not found. Set FEISHU_APP_ID and FEISHU_APP_SECRET environment variables.')
  }

  const validationError = validateFeishuConfig(feishuConfig)
  if (validationError) {
    throw new Error(`Invalid Feishu config: ${validationError}`)
  }

  let state: ChannelConnectionState = 'disconnected'
  let accessToken: string | null = null
  let tokenExpiry = 0
  let connectedAt: number | undefined

  const sessionManager: FeishuSessionManager = createFeishuSessionManager(feishuConfig.sessionMode)
  const formatter: MessageFormatter = createMessageFormatter()

  const callbacks: AdapterCallbacks = {
    onMessage: [],
    onPermissionResponse: [],
    onStateChange: [],
    onError: [],
  }

  const permissionRelay: FeishuPermissionRelay = createFeishuPermissionRelay(
    {
      sendCard: async (chatId: string, card: unknown) => {
        return sendMessageToChat(chatId, {
          msg_type: 'interactive',
          content: JSON.stringify(card),
        })
      },
      updateCard: async (messageId: string, card: unknown) => {
        await updateCardMessage(messageId, card)
      },
      onPermissionResponse: (requestId: string, behavior: 'allow' | 'deny') => {
        const response: PermissionResponse = {
          requestId,
          behavior,
          context: {
            channelId: 'feishu',
            channelKind: 'feishu',
            chatId: '',
            chatType: 'direct',
            senderId: '',
          },
        }
        for (const cb of callbacks.onPermissionResponse) cb(response)
      },
    },
    formatter,
  )

  const eventHandler = createFeishuEventHandler(
    feishuConfig,
    sessionManager,
    permissionRelay,
    {
      onInboundMessage: (params) => {
        const message: InboundMessage = {
          content: params.content,
          context: {
            channelId: 'feishu',
            channelKind: 'feishu',
            chatId: params.chatId,
            chatType: params.chatType === 'p2p' ? 'direct' : 'group',
            senderId: params.senderId,
            senderName: params.senderName,
            threadId: params.meta.thread_id,
            messageId: params.meta.message_id,
          },
          timestamp: Date.now(),
        }
        for (const cb of callbacks.onMessage) cb(message)
      },
      onCardAction: () => {},
    },
  )

  let transport: FeishuTransport | null = null

  async function start(): Promise<void> {
    state = 'connecting'
    for (const cb of callbacks.onStateChange) cb('connecting')

    transport = createFeishuTransport(feishuConfig, {
      onMessage: (event: FeishuMessageEvent) => eventHandler.handleMessage(event),
      onCardAction: (event: FeishuCardActionEvent) => eventHandler.handleCardAction(event),
      onError: (error: Error) => {
        for (const cb of callbacks.onError) cb(error)
      },
      onStateChange: (wsState) => {
        const mapped: ChannelConnectionState = wsState === 'connected' ? 'connected' : wsState === 'reconnecting' ? 'reconnecting' : 'disconnected'
        state = mapped
        if (mapped === 'connected') connectedAt = Date.now()
        for (const cb of callbacks.onStateChange) cb(mapped)
      },
    })

    await transport.start()
  }

  async function stop(): Promise<void> {
    if (transport) {
      await transport.stop()
      transport = null
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
      name: 'feishu',
      kind: 'feishu',
      state,
      capabilities: FEISHU_CAPABILITIES,
      activeSessions: sessionManager.activeSessions().length,
      lastError: undefined,
      connectedAt,
    }
  }

  async function sendMessage(sessionId: string, message: ChannelMessage): Promise<void> {
    const session = sessionManager.getSession(sessionId)
    if (!session) {
      throw new Error(`No Feishu session found: ${sessionId}`)
    }

    const formatted = formatOutboundMessage(message)
    const messageId = await sendMessageToChat(session.chatId, formatted)
    sessionManager.touchSession(sessionId, messageId)
  }

  async function sendPermissionRequest(sessionId: string, request: PermissionRequest): Promise<void> {
    const session = sessionManager.getSession(sessionId)
    if (!session) {
      throw new Error(`No Feishu session found: ${sessionId}`)
    }

    await permissionRelay.sendPermissionRequest(
      session.chatId,
      request.requestId,
      request.toolName,
      request.description,
      request.inputPreview,
    )
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
    const session = sessionManager.getSessionByChat(
      context.chatId,
      context.senderId,
      context.threadId,
    )
    if (session) {
      sessionManager.touchSession(session.sessionId)
      return session.sessionId
    }

    const newSession = sessionManager.getOrCreateSession(
      context.chatId,
      context.chatType === 'direct' ? 'p2p' : 'group',
      context.senderId,
      context.senderName,
      context.threadId,
    )
    return newSession.sessionId
  }

  function updateConfig(configUpdate: Partial<ChannelConfig>): void {
    // Config updates are not supported at runtime for Feishu
  }

  function formatOutboundMessage(message: ChannelMessage): { msg_type: string; content: string } {
    const metadata = message.metadata ?? {}

    if (metadata.cardType === 'code') {
      return formatter.formatCode(
        message.content,
        metadata.language as string | undefined,
        metadata.fileName as string | undefined,
      )
    }

    if (metadata.cardType === 'approval') {
      return formatter.formatApproval(
        metadata.requestId as string,
        metadata.toolName as string,
        metadata.description as string,
        metadata.inputPreview as string,
      )
    }

    if (metadata.cardType === 'file_edit') {
      return formatter.formatFileEdit(
        metadata.filePath as string,
        message.content,
        metadata.description as string | undefined,
      )
    }

    if (metadata.cardType === 'command_output') {
      return formatter.formatCommandOutput(
        metadata.command as string,
        (metadata.exitCode as number) ?? 0,
        message.content,
      )
    }

    if (metadata.cardType === 'error') {
      return formatter.formatError(
        metadata.title as string ?? 'Error',
        message.content,
        metadata.retryable as boolean | undefined,
      )
    }

    if (metadata.streaming) {
      return formatter.formatStreaming(message.content, metadata.thinking as boolean | undefined)
    }

    return formatter.formatText(message.content, metadata.title as string | undefined)
  }

  async function ensureAccessToken(): Promise<string> {
    if (accessToken && Date.now() < tokenExpiry) {
      return accessToken
    }
    accessToken = await fetchTenantAccessToken(feishuConfig)
    tokenExpiry = Date.now() + 7200 * 1000 - 60000
    return accessToken
  }

  async function sendMessageToChat(
    chatId: string,
    body: { msg_type: string; content: string },
  ): Promise<string> {
    const token = await ensureAccessToken()
    const url = 'https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id'

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        receive_id: chatId,
        msg_type: body.msg_type,
        content: body.content,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Feishu send message failed: ${response.status} ${errorText}`)
    }

    const data = await response.json() as { data?: { message_id?: string } }
    return data.data?.message_id ?? ''
  }

  async function updateCardMessage(messageId: string, card: unknown): Promise<void> {
    const token = await ensureAccessToken()
    const url = `https://open.feishu.cn/open-apis/interactive/v1/card/update`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        open_id: '',
        token: feishuConfig.verificationToken ?? '',
        card: JSON.stringify(card),
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Feishu update card failed: ${response.status} ${errorText}`)
    }
  }

  return {
    name: 'feishu',
    kind: 'feishu',
    capabilities: FEISHU_CAPABILITIES,
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
