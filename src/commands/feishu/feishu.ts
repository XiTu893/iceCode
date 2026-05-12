/**
 * /feishu command implementation.
 */

import type { LocalCommandCall } from '../../types/command.js'
import { createFeishuChannelAdapter } from '../../channels/feishu/adapter.js'
import { resolveFeishuConfig, validateFeishuConfig } from '../../channels/feishu/config.js'
import { getOrCreateGateway, getGateway } from '../channel/gatewayInstance.js'

export const call: LocalCommandCall = async (args, _context) => {
  const subcommand = args.trim().split(/\s+/)[0] ?? ''

  switch (subcommand) {
    case 'connect': {
      const config = resolveFeishuConfig()
      if (!config) {
        return {
          type: 'text',
          value: 'Feishu configuration not found. Set FEISHU_APP_ID and FEISHU_APP_SECRET environment variables.',
        }
      }

      const validationError = validateFeishuConfig(config)
      if (validationError) {
        return { type: 'text', value: `Invalid Feishu config: ${validationError}` }
      }

      try {
        const gateway = getOrCreateGateway()
        const adapter = createFeishuChannelAdapter()
        gateway.registerAdapter(adapter)
        await gateway.startAdapter('feishu')
        return { type: 'text', value: `Feishu channel connected (transport: ${config.transport}, session: ${config.sessionMode})` }
      } catch (err) {
        return { type: 'text', value: `Failed to connect Feishu: ${err instanceof Error ? err.message : String(err)}` }
      }
    }

    case 'disconnect': {
      const gateway = getGateway()
      if (!gateway) {
        return { type: 'text', value: 'Channel gateway not initialized.' }
      }
      try {
        await gateway.stopAdapter('feishu')
        return { type: 'text', value: 'Feishu channel disconnected.' }
      } catch (err) {
        return { type: 'text', value: `Failed to disconnect: ${err instanceof Error ? err.message : String(err)}` }
      }
    }

    case 'status': {
      const gateway = getGateway()
      if (!gateway) {
        return { type: 'text', value: 'Channel gateway not initialized. Use /feishu connect to start.' }
      }
      const adapter = gateway.getAdapter('feishu')
      if (!adapter) {
        return { type: 'text', value: 'Feishu adapter not registered. Use /feishu connect to start.' }
      }
      const status = adapter.getStatus()
      return {
        type: 'text',
        value: [
          `Feishu Channel Status:`,
          `  State: ${status.state}`,
          `  Active sessions: ${status.activeSessions}`,
          `  Capabilities: ${Object.entries(status.capabilities).filter(([, v]) => v).map(([k]) => k).join(', ')}`,
          status.connectedAt ? `  Connected at: ${new Date(status.connectedAt).toISOString()}` : '',
          status.lastError ? `  Last error: ${status.lastError}` : '',
        ].filter(Boolean).join('\n'),
      }
    }

    case 'config': {
      const config = resolveFeishuConfig()
      if (!config) {
        return { type: 'text', value: 'Feishu configuration not found.' }
      }
      return {
        type: 'text',
        value: [
          'Feishu Configuration:',
          `  App ID: ${config.appId.slice(0, 8)}…`,
          `  Transport: ${config.transport}`,
          `  Session mode: ${config.sessionMode}`,
          `  Group trigger: ${config.groupTrigger}`,
          config.webhookPort ? `  Webhook port: ${config.webhookPort}` : '',
          config.allowedUsers?.length ? `  Allowed users: ${config.allowedUsers.length} configured` : '',
          config.allowedGroups?.length ? `  Allowed groups: ${config.allowedGroups.length} configured` : '',
        ].filter(Boolean).join('\n'),
      }
    }

    default:
      return {
        type: 'text',
        value: [
          'Feishu commands:',
          '  /feishu connect       Connect to Feishu',
          '  /feishu disconnect    Disconnect from Feishu',
          '  /feishu status        Show connection status',
          '  /feishu config        Show configuration',
          '',
          'Environment variables:',
          '  FEISHU_APP_ID          Feishu app ID (required)',
          '  FEISHU_APP_SECRET      Feishu app secret (required)',
          '  FEISHU_TRANSPORT       websocket | webhook (default: websocket)',
          '  FEISHU_SESSION_MODE    per_user | per_chat | per_thread',
          '  FEISHU_GROUP_TRIGGER   mention | all | keyword',
        ].join('\n'),
      }
  }
}
