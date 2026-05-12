/**
 * SessionRouter — maps external chat contexts to IceCode session IDs.
 *
 * Each Channel adapter resolves its own sessions, but the router provides
 * a central registry so the Gateway can look up session metadata (which
 * adapter owns it, what context it belongs to) when routing outbound
 * messages back to the correct platform.
 */

import type { ChannelKind, ChatType, MessageContext, SessionMode } from './types.js'

export type SessionMeta = {
  sessionId: string
  channelId: string
  channelKind: ChannelKind
  chatId: string
  chatType: ChatType
  senderId: string
  threadId?: string
  createdAt: number
  lastActivityAt: number
}

export type SessionRouter = {
  resolve(context: MessageContext, mode: SessionMode): string
  get(sessionId: string): SessionMeta | undefined
  getByContext(context: MessageContext): SessionMeta | undefined
  register(meta: SessionMeta): void
  archive(sessionId: string): void
  touch(sessionId: string): void
  activeSessions(): SessionMeta[]
  activeSessionsForChannel(channelId: string): SessionMeta[]
}

export function createSessionRouter(): SessionRouter {
  const bySessionId = new Map<string, SessionMeta>()
  const byContextKey = new Map<string, SessionMeta>()

  function contextKey(context: MessageContext): string {
    return `${context.channelId}:${context.chatId}:${context.threadId ?? ''}:${context.senderId}`
  }

  function resolve(context: MessageContext, mode: SessionMode): string {
    const existing = byContextKey.get(contextKey(context))
    if (existing) {
      touch(existing.sessionId)
      return existing.sessionId
    }

    const sessionId = `ch_${context.channelKind}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const meta: SessionMeta = {
      sessionId,
      channelId: context.channelId,
      channelKind: context.channelKind,
      chatId: context.chatId,
      chatType: context.chatType,
      senderId: context.senderId,
      threadId: context.threadId,
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
    }

    bySessionId.set(sessionId, meta)
    byContextKey.set(contextKey(context), meta)
    return sessionId
  }

  function get(sessionId: string): SessionMeta | undefined {
    return bySessionId.get(sessionId)
  }

  function getByContext(context: MessageContext): SessionMeta | undefined {
    return byContextKey.get(contextKey(context))
  }

  function register(meta: SessionMeta): void {
    bySessionId.set(meta.sessionId, meta)
    byContextKey.set(contextKey({
      channelId: meta.channelId,
      channelKind: meta.channelKind,
      chatId: meta.chatId,
      chatType: meta.chatType,
      senderId: meta.senderId,
      threadId: meta.threadId,
    } as MessageContext), meta)
  }

  function archive(sessionId: string): void {
    const meta = bySessionId.get(sessionId)
    if (meta) {
      byContextKey.delete(contextKey({
        channelId: meta.channelId,
        channelKind: meta.channelKind,
        chatId: meta.chatId,
        chatType: meta.chatType,
        senderId: meta.senderId,
        threadId: meta.threadId,
      } as MessageContext))
      bySessionId.delete(sessionId)
    }
  }

  function touch(sessionId: string): void {
    const meta = bySessionId.get(sessionId)
    if (meta) {
      meta.lastActivityAt = Date.now()
    }
  }

  function activeSessions(): SessionMeta[] {
    return Array.from(bySessionId.values())
  }

  function activeSessionsForChannel(channelId: string): SessionMeta[] {
    return Array.from(bySessionId.values()).filter(m => m.channelId === channelId)
  }

  return {
    resolve,
    get,
    getByContext,
    register,
    archive,
    touch,
    activeSessions,
    activeSessionsForChannel,
  }
}
