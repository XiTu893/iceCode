/**
 * ChannelGateway — central coordinator for all Channel adapters.
 *
 * Owns the SessionRouter, MessageQueue, and HealthMonitor. Adapters
 * register with the Gateway; inbound messages flow through the queue
 * and are dispatched to the MCP Channel notification handler.
 * Outbound messages (AI responses, permission requests) are routed
 * back to the owning adapter.
 */

import type { ChannelAdapter, ChannelAdapterFactory } from './channelAdapter.js'
import type { ChannelConfig, ChannelEvent, ChannelMessage, ChannelStatus, InboundMessage, PermissionRequest, PermissionResponse, SessionMode } from './types.js'
import { createHealthMonitor, type HealthMonitor } from './healthMonitor.js'
import { createMessageQueue, type MessageQueue } from './messageQueue.js'
import { createSessionRouter, type SessionRouter } from './sessionRouter.js'

export type GatewayCallbacks = {
  onInboundMessage?: (message: InboundMessage, sessionId: string) => void
  onPermissionResponse?: (response: PermissionResponse) => void
  onStateChange?: (adapterName: string, state: string) => void
  onError?: (adapterName: string, error: Error) => void
}

export type ChannelGateway = {
  registerFactory(factory: ChannelAdapterFactory): void
  registerAdapter(adapter: ChannelAdapter): void
  startAdapter(name: string): Promise<void>
  stopAdapter(name: string): Promise<void>
  startAll(): Promise<void>
  stopAll(): Promise<void>

  routeOutbound(sessionId: string, message: ChannelMessage): Promise<void>
  routePermissionRequest(sessionId: string, request: PermissionRequest): Promise<void>

  sessionRouter: SessionRouter
  messageQueue: MessageQueue
  healthMonitor: HealthMonitor

  getAdapter(name: string): ChannelAdapter | undefined
  listAdapters(): string[]
  getStatus(): ChannelStatus[]
  getCallbacks(): GatewayCallbacks
}

export function createChannelGateway(callbacks: GatewayCallbacks = {}): ChannelGateway {
  const adapters = new Map<string, ChannelAdapter>()
  const factories = new Map<string, ChannelAdapterFactory>()
  const sessionRouter = createSessionRouter()
  const messageQueue = createMessageQueue()
  const healthMonitor = createHealthMonitor()
  let processing = false

  function registerFactory(factory: ChannelAdapterFactory): void {
    factories.set(factory.kind, factory)
  }

  function registerAdapter(adapter: ChannelAdapter): void {
    adapters.set(adapter.name, adapter)
    healthMonitor.register(adapter)

    adapter.onMessage((message: InboundMessage) => {
      adapter.resolveSession(message.context).then(sessionId => {
        const meta = sessionRouter.get(sessionId)
        if (!meta) {
          sessionRouter.register({
            sessionId,
            channelId: message.context.channelId,
            channelKind: message.context.channelKind,
            chatId: message.context.chatId,
            chatType: message.context.chatType,
            senderId: message.context.senderId,
            threadId: message.context.threadId,
            createdAt: Date.now(),
            lastActivityAt: Date.now(),
          })
        } else {
          sessionRouter.touch(sessionId)
        }

        messageQueue.enqueue({ type: 'message', message })
        callbacks.onInboundMessage?.(message, sessionId)
      }).catch(err => {
        callbacks.onError?.(adapter.name, err instanceof Error ? err : new Error(String(err)))
      })
    })

    adapter.onPermissionResponse((response: PermissionResponse) => {
      messageQueue.enqueue({ type: 'permission_response', response })
      callbacks.onPermissionResponse?.(response)
    })

    adapter.onStateChange((state) => {
      messageQueue.enqueue({ type: 'state_change', state, adapter: adapter.name })
      callbacks.onStateChange?.(adapter.name, state)
    })

    adapter.onError((error) => {
      messageQueue.enqueue({ type: 'error', error, adapter: adapter.name })
      callbacks.onError?.(adapter.name, error)
    })
  }

  async function startAdapter(name: string): Promise<void> {
    const adapter = adapters.get(name)
    if (!adapter) throw new Error(`Channel adapter "${name}" not found`)
    await adapter.start()
  }

  async function stopAdapter(name: string): Promise<void> {
    const adapter = adapters.get(name)
    if (!adapter) return
    await adapter.stop()
    healthMonitor.unregister(name)
  }

  async function startAll(): Promise<void> {
    const promises: Promise<void>[] = []
    for (const adapter of Array.from(adapters.values())) {
      promises.push(adapter.start().catch(err => {
        callbacks.onError?.(adapter.name, err instanceof Error ? err : new Error(String(err)))
      }))
    }
    await Promise.allSettled(promises)
    healthMonitor.start()
    startProcessing()
  }

  async function stopAll(): Promise<void> {
    healthMonitor.stop()
    stopProcessing()
    const promises: Promise<void>[] = []
    for (const adapter of Array.from(adapters.values())) {
      promises.push(adapter.stop())
    }
    await Promise.allSettled(promises)
    messageQueue.close()
  }

  async function routeOutbound(sessionId: string, message: ChannelMessage): Promise<void> {
    const meta = sessionRouter.get(sessionId)
    if (!meta) {
      throw new Error(`No session found for ID: ${sessionId}`)
    }
    const adapter = adapters.get(meta.channelId)
    if (!adapter) {
      throw new Error(`No adapter found for channel: ${meta.channelId}`)
    }
    await adapter.sendMessage(sessionId, message)
  }

  async function routePermissionRequest(sessionId: string, request: PermissionRequest): Promise<void> {
    const meta = sessionRouter.get(sessionId)
    if (!meta) {
      throw new Error(`No session found for ID: ${sessionId}`)
    }
    const adapter = adapters.get(meta.channelId)
    if (!adapter) {
      throw new Error(`No adapter found for channel: ${meta.channelId}`)
    }
    if (!adapter.capabilities.permissionRelay) {
      throw new Error(`Adapter "${meta.channelId}" does not support permission relay`)
    }
    await adapter.sendPermissionRequest(sessionId, request)
  }

  function startProcessing(): void {
    if (processing) return
    processing = true
    processQueue()
  }

  function stopProcessing(): void {
    processing = false
  }

  async function processQueue(): Promise<void> {
    while (processing && !messageQueue.isClosed()) {
      try {
        const event = await messageQueue.dequeue()
        handleEvent(event)
      } catch {
        break
      }
    }
  }

  function handleEvent(event: ChannelEvent): void {
    switch (event.type) {
      case 'message':
        break
      case 'permission_response':
        break
      case 'state_change':
        break
      case 'error':
        break
      case 'session_created':
        break
      case 'session_archived':
        break
    }
  }

  function getAdapter(name: string): ChannelAdapter | undefined {
    return adapters.get(name)
  }

  function listAdapters(): string[] {
    return Array.from(adapters.keys())
  }

  function getStatus(): ChannelStatus[] {
    return Array.from(adapters.values()).map(a => a.getStatus())
  }

  function getCallbacks(): GatewayCallbacks {
    return callbacks
  }

  return {
    registerFactory,
    registerAdapter,
    startAdapter,
    stopAdapter,
    startAll,
    stopAll,
    routeOutbound,
    routePermissionRequest,
    sessionRouter,
    messageQueue,
    healthMonitor,
    getAdapter,
    listAdapters,
    getStatus,
    getCallbacks,
  }
}
