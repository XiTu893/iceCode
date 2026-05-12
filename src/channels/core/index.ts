/**
 * Channel Gateway core — public API.
 *
 * Re-exports the building blocks needed to create and manage Channel
 * adapters. The typical consumer only needs `createChannelGateway`;
 * adapters import the types and `ChannelAdapter` interface directly.
 */

export { createChannelGateway, type ChannelGateway, type GatewayCallbacks } from './gateway.js'
export { type ChannelAdapter, type ChannelAdapterFactory } from './channelAdapter.js'
export { createSessionRouter, type SessionRouter, type SessionMeta } from './sessionRouter.js'
export { createMessageQueue, type MessageQueue } from './messageQueue.js'
export { createHealthMonitor, type HealthMonitor, type HealthCheckResult } from './healthMonitor.js'
export type {
  ChannelKind,
  SessionMode,
  ChatType,
  ChannelMessageRole,
  PermissionBehavior,
  ChannelConnectionState,
  ChannelCapabilities,
  MessageContext,
  ChannelMessage,
  InboundMessage,
  PermissionRequest,
  PermissionResponse,
  ChannelConfig,
  ChannelStatus,
  ChannelEvent,
} from './types.js'
