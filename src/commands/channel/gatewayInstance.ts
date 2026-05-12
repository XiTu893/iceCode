/**
 * Gateway singleton — shared ChannelGateway instance for the CLI process.
 *
 * Lazily created on first access. The /channel and /feishu commands
 * both reference this singleton so they operate on the same gateway.
 */

import type { ChannelGateway } from '../../channels/core/gateway.js'
import { createChannelGateway } from '../../channels/core/gateway.js'

let _gateway: ChannelGateway | null = null

export function getGateway(): ChannelGateway | null {
  return _gateway
}

export function getOrCreateGateway(): ChannelGateway {
  if (!_gateway) {
    _gateway = createChannelGateway({
      onInboundMessage: (message, sessionId) => {
        // Inbound messages are handled by the MCP channel notification system
        // This hook is available for additional processing
      },
      onError: (adapterName, error) => {
        console.error(`[channel:${adapterName}] ${error.message}`)
      },
    })
  }
  return _gateway
}

export function destroyGateway(): void {
  if (_gateway) {
    _gateway.stopAll().catch(() => {})
    _gateway = null
  }
}
