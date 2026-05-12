/**
 * OpenClaw WebSocket protocol types.
 *
 * Compatible with @taichi-labs/openclaw-websocket v0.1.x.
 * Messages follow the { type, ...fields } JSON convention.
 */

export type OpenClawMessageType =
  | 'chat.send'
  | 'chat.typing'
  | 'chat.stream'
  | 'chat.complete'
  | 'chat.error'
  | 'session.list'
  | 'session.info'

export type OpenClawChatSend = {
  type: 'chat.send'
  content: string
  messageId?: string
  senderId?: string
  senderName?: string
  chatType?: 'direct' | 'group'
  groupId?: string
  groupSubject?: string
  replyToMessageId?: string
  replyToBody?: string
  mediaPath?: string
  mediaType?: string
  mediaPaths?: string[]
  mediaTypes?: string[]
  customData?: Record<string, unknown>
}

export type OpenClawChatTyping = {
  type: 'chat.typing'
}

export type OpenClawChatStream = {
  type: 'chat.stream'
  messageId: string
  content: string
  sequence: number
  done: boolean
}

export type OpenClawChatComplete = {
  type: 'chat.complete'
  messageId: string
  content: string
  usage?: {
    inputTokens: number
    outputTokens: number
  }
}

export type OpenClawChatError = {
  type: 'chat.error'
  messageId?: string
  error: string
  code?: string
}

export type OpenClawInboundMessage = OpenClawChatSend
export type OpenClawOutboundMessage =
  | OpenClawChatTyping
  | OpenClawChatStream
  | OpenClawChatComplete
  | OpenClawChatError

export type OpenClawWebSocketConfig = {
  port: number
  host: string
  path: string
}
