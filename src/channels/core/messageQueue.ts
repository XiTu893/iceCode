/**
 * MessageQueue — bounded async queue for cross-Channel message routing.
 *
 * Provides back-pressure so a slow consumer (e.g. the MCP notification
 * handler) does not cause unbounded memory growth when many Channel
 * adapters push inbound messages simultaneously.
 */

import type { ChannelEvent } from './types.js'

export type MessageQueue = {
  enqueue(event: ChannelEvent): void
  dequeue(): Promise<ChannelEvent>
  size(): number
  close(): void
  isClosed(): boolean
}

export function createMessageQueue(maxSize: number = 4096): MessageQueue {
  const buffer: ChannelEvent[] = []
  let waiters: Array<(event: ChannelEvent) => void> = []
  let closed = false

  function enqueue(event: ChannelEvent): void {
    if (closed) return
    if (waiters.length > 0) {
      const resolve = waiters.shift()!
      resolve(event)
      return
    }
    if (buffer.length >= maxSize) {
      buffer.shift()
    }
    buffer.push(event)
  }

  async function dequeue(): Promise<ChannelEvent> {
    if (buffer.length > 0) {
      return buffer.shift()!
    }
    if (closed) {
      throw new Error('MessageQueue closed')
    }
    return new Promise<ChannelEvent>(resolve => {
      waiters.push(resolve)
    })
  }

  function size(): number {
    return buffer.length
  }

  function close(): void {
    closed = true
    for (const waiter of waiters) {
      waiter({ type: 'error', error: new Error('Queue closed'), adapter: 'system' })
    }
    waiters = []
    buffer.length = 0
  }

  function isClosed(): boolean {
    return closed
  }

  return { enqueue, dequeue, size, close, isClosed }
}
