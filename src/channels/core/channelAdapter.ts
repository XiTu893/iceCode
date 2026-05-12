/**
 * ChannelAdapter — the contract every Channel must implement.
 *
 * Adapters translate platform-specific protocols (Feishu Bot API, OpenClaw
 * WebSocket, etc.) into the unified Channel message format so the Gateway
 * can route them without knowing the transport details.
 *
 * Lifecycle: construct → start() → [sendMessage / onMessage]* → stop()
 */

import type {
  ChannelCapabilities,
  ChannelConfig,
  ChannelConnectionState,
  ChannelMessage,
  ChannelStatus,
  InboundMessage,
  MessageContext,
  PermissionRequest,
  PermissionResponse,
} from './types.js'

export type ChannelAdapter = {
  readonly name: string
  readonly kind: string
  readonly capabilities: ChannelCapabilities

  start(): Promise<void>
  stop(): Promise<void>
  getState(): ChannelConnectionState
  isHealthy(): boolean
  getStatus(): ChannelStatus

  sendMessage(sessionId: string, message: ChannelMessage): Promise<void>
  sendPermissionRequest(sessionId: string, request: PermissionRequest): Promise<void>

  onMessage(callback: (message: InboundMessage) => void): void
  onPermissionResponse(callback: (response: PermissionResponse) => void): void
  onStateChange(callback: (state: ChannelConnectionState) => void): void
  onError(callback: (error: Error) => void): void

  resolveSession(context: MessageContext): Promise<string>
  updateConfig(config: Partial<ChannelConfig>): void
}

export type ChannelAdapterFactory = {
  kind: string
  create(config: ChannelConfig): ChannelAdapter
}
