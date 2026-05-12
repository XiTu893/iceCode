/**
 * Channel Gateway core types.
 *
 * Defines the shared type system for all Channel adapters (Feishu, WebSocket,
 * future platforms). Every adapter operates on these types so the Gateway can
 * route messages uniformly regardless of the underlying transport.
 */

export type ChannelKind = 'feishu' | 'websocket' | 'dingtalk' | 'wecom' | string

export type SessionMode = 'per_user' | 'per_chat' | 'per_thread'

export type ChatType = 'direct' | 'group'

export type ChannelMessageRole = 'user' | 'assistant' | 'system'

export type PermissionBehavior = 'allow' | 'deny'

export type ChannelConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'failed'

export type ChannelCapabilities = {
  inbound: boolean
  outbound: boolean
  permissionRelay: boolean
  streaming: boolean
  richContent: boolean
  mediaAttachment: boolean
  groupChat: boolean
}

export type MessageContext = {
  channelId: string
  channelKind: ChannelKind
  chatId: string
  chatType: ChatType
  senderId: string
  senderName?: string
  threadId?: string
  messageId?: string
  replyToMessageId?: string
  replyToBody?: string
  mediaUrls?: Array<{ url: string; type: string }>
  customData?: Record<string, unknown>
}

export type ChannelMessage = {
  role: ChannelMessageRole
  content: string
  sessionId: string
  context: MessageContext
  metadata?: Record<string, unknown>
}

export type InboundMessage = {
  content: string
  context: MessageContext
  timestamp: number
}

export type PermissionRequest = {
  requestId: string
  sessionId: string
  context: MessageContext
  toolName: string
  description: string
  inputPreview: string
}

export type PermissionResponse = {
  requestId: string
  behavior: PermissionBehavior
  context: MessageContext
}

export type ChannelConfig = {
  kind: ChannelKind
  enabled: boolean
  sessionMode: SessionMode
  transport: 'websocket' | 'webhook'
  allowedUsers?: string[]
  allowedGroups?: string[]
  [key: string]: unknown
}

export type ChannelStatus = {
  name: string
  kind: ChannelKind
  state: ChannelConnectionState
  capabilities: ChannelCapabilities
  activeSessions: number
  lastError?: string
  connectedAt?: number
}

export type ChannelEvent =
  | { type: 'message'; message: InboundMessage }
  | { type: 'permission_response'; response: PermissionResponse }
  | { type: 'state_change'; state: ChannelConnectionState; adapter: string }
  | { type: 'error'; error: Error; adapter: string }
  | { type: 'session_created'; sessionId: string; context: MessageContext }
  | { type: 'session_archived'; sessionId: string }
