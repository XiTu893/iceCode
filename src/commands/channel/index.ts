/**
 * /channel command — manage Channel adapters.
 *
 * Subcommands:
 *   list          List registered Channel adapters
 *   status        Show connection status of all adapters
 *   start <name>  Start a specific adapter
 *   stop <name>   Stop a specific adapter
 */

import type { Command } from '../../commands.js'

const channel = {
  type: 'local',
  name: 'channel',
  description: 'Manage channel adapters (Feishu, WebSocket, etc.)',
  argumentHint: '[list|status|start|stop <name>]',
  supportsNonInteractive: true,
  load: () => import('./channel.js'),
} satisfies Command

export default channel
