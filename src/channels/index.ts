/**
 * Channels — unified entry point for all Channel adapters.
 *
 * The Channel Gateway provides a single abstraction over multiple
 * messaging platforms (Feishu, OpenClaw WebSocket, etc.). Import
 * `createChannelGateway` to create a gateway, then register adapters.
 */

export {
  createChannelGateway,
  type ChannelGateway,
  type GatewayCallbacks,
  type ChannelAdapter,
  type ChannelAdapterFactory,
  createSessionRouter,
  type SessionRouter,
  type SessionMeta,
  createMessageQueue,
  type MessageQueue,
  createHealthMonitor,
  type HealthMonitor,
  type HealthCheckResult,
  type ChannelKind,
  type SessionMode,
  type ChatType,
  type ChannelMessageRole,
  type PermissionBehavior,
  type ChannelConnectionState,
  type ChannelCapabilities,
  type MessageContext,
  type ChannelMessage,
  type InboundMessage,
  type PermissionRequest,
  type PermissionResponse,
  type ChannelConfig,
  type ChannelStatus,
  type ChannelEvent,
} from './core/index.js'

export {
  createFeishuChannelAdapter,
  resolveFeishuConfig,
  validateFeishuConfig,
  createFeishuCardBuilder,
  createMessageFormatter,
  type FeishuConfig,
  type FeishuCard,
  type FeishuCardElement,
  type FeishuSession,
} from './feishu/index.js'

export {
  createWebSocketChannelAdapter,
  type OpenClawChatSend,
  type OpenClawWebSocketConfig,
} from './websocket/index.js'
