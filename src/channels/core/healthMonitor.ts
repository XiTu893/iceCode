/**
 * HealthMonitor — tracks Channel adapter health and emits alerts.
 *
 * Periodically polls each adapter's `isHealthy()` and `getState()`. When
 * an adapter transitions to a failed state the monitor can trigger
 * reconnect attempts or notify the Gateway.
 */

import type { ChannelAdapter } from './channelAdapter.js'
import type { ChannelConnectionState, ChannelStatus } from './types.js'

export type HealthCheckResult = {
  name: string
  healthy: boolean
  state: ChannelConnectionState
  status: ChannelStatus
  checkedAt: number
}

export type HealthMonitor = {
  register(adapter: ChannelAdapter): void
  unregister(name: string): void
  check(name: string): HealthCheckResult | undefined
  checkAll(): HealthCheckResult[]
  start(intervalMs?: number): void
  stop(): void
  onUnhealthy(callback: (result: HealthCheckResult) => void): void
  onRecovery(callback: (result: HealthCheckResult) => void): void
}

export function createHealthMonitor(): HealthMonitor {
  const adapters = new Map<string, ChannelAdapter>()
  const previousStates = new Map<string, ChannelConnectionState>()
  const unhealthyCallbacks: Array<(result: HealthCheckResult) => void> = []
  const recoveryCallbacks: Array<(result: HealthCheckResult) => void> = []
  let timer: ReturnType<typeof setInterval> | null = null

  function register(adapter: ChannelAdapter): void {
    adapters.set(adapter.name, adapter)
    previousStates.set(adapter.name, adapter.getState())
  }

  function unregister(name: string): void {
    adapters.delete(name)
    previousStates.delete(name)
  }

  function check(name: string): HealthCheckResult | undefined {
    const adapter = adapters.get(name)
    if (!adapter) return undefined
    const status = adapter.getStatus()
    const state = adapter.getState()
    const previous = previousStates.get(name)
    previousStates.set(name, state)

    const result: HealthCheckResult = {
      name,
      healthy: adapter.isHealthy(),
      state,
      status,
      checkedAt: Date.now(),
    }

    if (previous === 'connected' && state === 'failed') {
      for (const cb of unhealthyCallbacks) cb(result)
    } else if (previous === 'failed' && state === 'connected') {
      for (const cb of recoveryCallbacks) cb(result)
    }

    return result
  }

  function checkAll(): HealthCheckResult[] {
    const results: HealthCheckResult[] = []
    for (const name of Array.from(adapters.keys())) {
      const result = check(name)
      if (result) results.push(result)
    }
    return results
  }

  function start(intervalMs: number = 30_000): void {
    if (timer) return
    timer = setInterval(() => checkAll(), intervalMs)
  }

  function stop(): void {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  function onUnhealthy(callback: (result: HealthCheckResult) => void): void {
    unhealthyCallbacks.push(callback)
  }

  function onRecovery(callback: (result: HealthCheckResult) => void): void {
    recoveryCallbacks.push(callback)
  }

  return {
    register,
    unregister,
    check,
    checkAll,
    start,
    stop,
    onUnhealthy,
    onRecovery,
  }
}
