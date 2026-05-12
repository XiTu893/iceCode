/**
 * /channel command implementation.
 */

import type { LocalCommandCall } from '../../types/command.js'
import { getGateway } from './gatewayInstance.js'

export const call: LocalCommandCall = async (args, _context) => {
  const parts = args.trim().split(/\s+/)
  const subcommand = parts[0] ?? ''
  const name = parts[1]

  switch (subcommand) {
    case 'list': {
      const gateway = getGateway()
      if (!gateway) {
        return { type: 'text', value: 'Channel gateway not initialized. Start a channel first.' }
      }
      const adapters = gateway.listAdapters()
      if (adapters.length === 0) {
        return { type: 'text', value: 'No channel adapters registered.' }
      }
      const lines = adapters.map(a => {
        const status = gateway.getAdapter(a)?.getStatus()
        const state = status?.state ?? 'unknown'
        const sessions = status?.activeSessions ?? 0
        return `  ${a}: ${state} (${sessions} active sessions)`
      })
      return { type: 'text', value: `Channel adapters:\n${lines.join('\n')}` }
    }

    case 'status': {
      const gateway = getGateway()
      if (!gateway) {
        return { type: 'text', value: 'Channel gateway not initialized.' }
      }
      const statuses = gateway.getStatus()
      if (statuses.length === 0) {
        return { type: 'text', value: 'No channel adapters running.' }
      }
      const lines = statuses.map(s => {
        const caps = Object.entries(s.capabilities)
          .filter(([, v]) => v)
          .map(([k]) => k)
          .join(', ')
        return [
          `  ${s.name} (${s.kind}):`,
          `    State: ${s.state}`,
          `    Sessions: ${s.activeSessions}`,
          `    Capabilities: ${caps}`,
          s.lastError ? `    Last error: ${s.lastError}` : null,
          s.connectedAt ? `    Connected: ${new Date(s.connectedAt).toISOString()}` : null,
        ].filter(Boolean).join('\n')
      })
      return { type: 'text', value: `Channel status:\n${lines.join('\n')}` }
    }

    case 'start': {
      if (!name) {
        return { type: 'text', value: 'Usage: /channel start <adapter-name>' }
      }
      const gateway = getGateway()
      if (!gateway) {
        return { type: 'text', value: 'Channel gateway not initialized.' }
      }
      try {
        await gateway.startAdapter(name)
        return { type: 'text', value: `Channel adapter "${name}" started.` }
      } catch (err) {
        return { type: 'text', value: `Failed to start adapter "${name}": ${err instanceof Error ? err.message : String(err)}` }
      }
    }

    case 'stop': {
      if (!name) {
        return { type: 'text', value: 'Usage: /channel stop <adapter-name>' }
      }
      const gateway = getGateway()
      if (!gateway) {
        return { type: 'text', value: 'Channel gateway not initialized.' }
      }
      try {
        await gateway.stopAdapter(name)
        return { type: 'text', value: `Channel adapter "${name}" stopped.` }
      } catch (err) {
        return { type: 'text', value: `Failed to stop adapter "${name}": ${err instanceof Error ? err.message : String(err)}` }
      }
    }

    default:
      return {
        type: 'text',
        value: [
          'Channel commands:',
          '  /channel list              List registered adapters',
          '  /channel status            Show adapter status',
          '  /channel start <name>      Start an adapter',
          '  /channel stop <name>       Stop an adapter',
        ].join('\n'),
      }
  }
}
