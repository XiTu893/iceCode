/**
 * Feishu Channel — public API.
 *
 * Re-exports the adapter factory, configuration helpers, and
 * the card builder for consumers that need fine-grained control.
 */

export { createFeishuChannelAdapter } from './adapter.js'
export { resolveFeishuConfig, validateFeishuConfig, feishuConfigToMcpServerConfig } from './config.js'
export { createFeishuCardBuilder } from './cardBuilder.js'
export { createMessageFormatter } from './messageFormatter.js'
export { createFeishuSessionManager } from './sessionManager.js'
export { createFeishuPermissionRelay } from './permissionRelay.js'
export { createFeishuEventHandler } from './eventHandler.js'
export { createFeishuTransport, fetchTenantAccessToken } from './transport.js'

export type {
  FeishuConfig,
  FeishuTransportMode,
  FeishuSessionMode,
  FeishuGroupTrigger,
  FeishuCard,
  FeishuCardElement,
  FeishuCardHeader,
  FeishuCardAction,
  FeishuMessageEvent,
  FeishuCardActionEvent,
  FeishuSession,
} from './types.js'
