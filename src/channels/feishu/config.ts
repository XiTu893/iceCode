/**
 * Feishu Channel configuration management.
 *
 * Reads Feishu app credentials from environment variables or settings
 * and produces a validated FeishuConfig. Also provides helpers for
 * the MCP server registration.
 */

import type { FeishuConfig, FeishuSessionMode, FeishuTransportMode, FeishuGroupTrigger } from './types.js'

const ENV_PREFIX = 'FEISHU_'

export function resolveFeishuConfig(overrides?: Partial<FeishuConfig>): FeishuConfig | null {
  const appId = overrides?.appId ?? process.env[`${ENV_PREFIX}APP_ID`]
  const appSecret = overrides?.appSecret ?? process.env[`${ENV_PREFIX}APP_SECRET`]

  if (!appId || !appSecret) {
    return null
  }

  return {
    appId,
    appSecret,
    verificationToken: overrides?.verificationToken ?? process.env[`${ENV_PREFIX}VERIFICATION_TOKEN`],
    encryptKey: overrides?.encryptKey ?? process.env[`${ENV_PREFIX}ENCRYPT_KEY`],
    transport: overrides?.transport ?? (process.env[`${ENV_PREFIX}TRANSPORT`] as FeishuTransportMode) ?? 'websocket',
    sessionMode: overrides?.sessionMode ?? (process.env[`${ENV_PREFIX}SESSION_MODE`] as FeishuSessionMode) ?? 'per_user',
    groupTrigger: overrides?.groupTrigger ?? (process.env[`${ENV_PREFIX}GROUP_TRIGGER`] as FeishuGroupTrigger) ?? 'mention',
    webhookPort: overrides?.webhookPort ?? (process.env[`${ENV_PREFIX}WEBHOOK_PORT`] ? parseInt(process.env[`${ENV_PREFIX}WEBHOOK_PORT`], 10) : 3000),
    webhookPath: overrides?.webhookPath ?? process.env[`${ENV_PREFIX}WEBHOOK_PATH`] ?? '/feishu/events',
    allowedUsers: overrides?.allowedUsers ?? parseListEnv(`${ENV_PREFIX}ALLOWED_USERS`),
    allowedGroups: overrides?.allowedGroups ?? parseListEnv(`${ENV_PREFIX}ALLOWED_GROUPS`),
    botName: overrides?.botName ?? process.env[`${ENV_PREFIX}BOT_NAME`] ?? 'IceCode',
  }
}

export function validateFeishuConfig(config: FeishuConfig): string | null {
  if (!config.appId) return 'FEISHU_APP_ID is required'
  if (!config.appSecret) return 'FEISHU_APP_SECRET is required'
  if (config.transport === 'webhook' && !config.webhookPort) return 'webhook port is required for webhook transport'
  if (!['websocket', 'webhook'].includes(config.transport)) return `invalid transport: ${config.transport}`
  if (!['per_user', 'per_chat', 'per_thread'].includes(config.sessionMode)) return `invalid sessionMode: ${config.sessionMode}`
  if (!['mention', 'all', 'keyword'].includes(config.groupTrigger)) return `invalid groupTrigger: ${config.groupTrigger}`
  return null
}

export function feishuConfigToMcpServerConfig(config: FeishuConfig): Record<string, unknown> {
  return {
    type: 'stdio',
    command: process.execPath,
    args: ['--import', 'tsx', 'src/channels/feishu/index.ts'],
    env: {
      FEISHU_APP_ID: config.appId,
      FEISHU_APP_SECRET: config.appSecret,
      FEISHU_TRANSPORT: config.transport,
      FEISHU_SESSION_MODE: config.sessionMode,
      FEISHU_GROUP_TRIGGER: config.groupTrigger,
      ...(config.verificationToken ? { FEISHU_VERIFICATION_TOKEN: config.verificationToken } : {}),
      ...(config.encryptKey ? { FEISHU_ENCRYPT_KEY: config.encryptKey } : {}),
      ...(config.webhookPort ? { FEISHU_WEBHOOK_PORT: String(config.webhookPort) } : {}),
    },
  }
}

function parseListEnv(key: string): string[] | undefined {
  const value = process.env[key]
  if (!value) return undefined
  return value.split(',').map(s => s.trim()).filter(Boolean)
}
