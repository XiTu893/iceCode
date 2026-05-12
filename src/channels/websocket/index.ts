/**
 * OpenClaw WebSocket Channel — public API.
 */

export { createWebSocketChannelAdapter } from './adapter.js'
export type {
  OpenClawChatSend,
  OpenClawChatTyping,
  OpenClawChatStream,
  OpenClawChatComplete,
  OpenClawChatError,
  OpenClawInboundMessage,
  OpenClawOutboundMessage,
  OpenClawWebSocketConfig,
} from './types.js'
