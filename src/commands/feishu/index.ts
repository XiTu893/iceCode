/**
 * /feishu command — manage Feishu channel connection.
 *
 * Subcommands:
 *   connect       Start the Feishu channel adapter
 *   disconnect    Stop the Feishu channel adapter
 *   status        Show Feishu connection status
 *   config        Show current Feishu configuration
 */

import type { Command } from '../../commands.js'
import { resolveFeishuConfig } from '../../channels/feishu/config.js'

function isEnabled(): boolean {
  return resolveFeishuConfig() !== null
}

const feishu = {
  type: 'local',
  name: 'feishu',
  description: 'Manage Feishu channel connection',
  argumentHint: '[connect|disconnect|status|config]',
  isEnabled,
  get isHidden() {
    return !isEnabled()
  },
  supportsNonInteractive: true,
  load: () => import('./feishu.js'),
} satisfies Command

export default feishu
