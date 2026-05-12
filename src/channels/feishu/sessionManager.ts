/**
 * FeishuSessionManager — maps Feishu chat contexts to OpenClaude sessions.
 *
 * Each Feishu user/group/thread gets an independent session so the AI
 * maintains separate context per conversation. Sessions expire after a
 * configurable idle timeout and are archived on explicit close.
 */

import type { FeishuSession, FeishuSessionMode } from './types.js'

const DEFAULT_IDLE_TIMEOUT_MS = 30 * 60 * 1000

export type FeishuSessionManager = {
  getOrCreateSession(
    chatId: string,
    chatType: 'p2p' | 'group',
    senderId: string,
    senderName?: string,
    threadId?: string,
  ): FeishuSession
  getSession(sessionId: string): FeishuSession | undefined
  getSessionByChat(chatId: string, senderId?: string, threadId?: string): FeishuSession | undefined
  archiveSession(sessionId: string): void
  touchSession(sessionId: string, messageId?: string): void
  activeSessions(): FeishuSession[]
  pruneIdleSessions(timeoutMs?: number): string[]
  setSessionMode(mode: FeishuSessionMode): void
}

export function createFeishuSessionManager(
  initialMode: FeishuSessionMode = 'per_user',
): FeishuSessionManager {
  const bySessionId = new Map<string, FeishuSession>()
  let sessionMode = initialMode
  let sessionCounter = 0

  function sessionKey(chatId: string, senderId?: string, threadId?: string): string {
    switch (sessionMode) {
      case 'per_user':
        return `${chatId}:${senderId ?? 'unknown'}`
      case 'per_chat':
        return chatId
      case 'per_thread':
        return `${chatId}:${threadId ?? 'default'}`
      default:
        return `${chatId}:${senderId ?? 'unknown'}`
    }
  }

  function getOrCreateSession(
    chatId: string,
    chatType: 'p2p' | 'group',
    senderId: string,
    senderName?: string,
    threadId?: string,
  ): FeishuSession {
    const key = sessionKey(chatId, senderId, threadId)
    const existing = findSessionByKey(key)
    if (existing) {
      touchSession(existing.sessionId)
      return existing
    }

    sessionCounter++
    const sessionId = `feishu_${Date.now()}_${sessionCounter}_${Math.random().toString(36).slice(2, 6)}`
    const session: FeishuSession = {
      sessionId,
      chatId,
      chatType,
      senderId,
      senderName,
      threadId,
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
    }

    bySessionId.set(sessionId, session)
    return session
  }

  function findSessionByKey(key: string): FeishuSession | undefined {
    for (const session of Array.from(bySessionId.values())) {
      const sKey = sessionKey(session.chatId, session.senderId, session.threadId)
      if (sKey === key) return session
    }
    return undefined
  }

  function getSession(sessionId: string): FeishuSession | undefined {
    return bySessionId.get(sessionId)
  }

  function getSessionByChat(chatId: string, senderId?: string, threadId?: string): FeishuSession | undefined {
    const key = sessionKey(chatId, senderId, threadId)
    return findSessionByKey(key)
  }

  function archiveSession(sessionId: string): void {
    bySessionId.delete(sessionId)
  }

  function touchSession(sessionId: string, messageId?: string): void {
    const session = bySessionId.get(sessionId)
    if (session) {
      session.lastActivityAt = Date.now()
      if (messageId) {
        session.lastMessageId = messageId
      }
    }
  }

  function activeSessions(): FeishuSession[] {
    return Array.from(bySessionId.values())
  }

  function pruneIdleSessions(timeoutMs: number = DEFAULT_IDLE_TIMEOUT_MS): string[] {
    const now = Date.now()
    const pruned: string[] = []
    for (const [id, session] of Array.from(bySessionId)) {
      if (now - session.lastActivityAt > timeoutMs) {
        pruned.push(id)
        bySessionId.delete(id)
      }
    }
    return pruned
  }

  function setSessionMode(mode: FeishuSessionMode): void {
    sessionMode = mode
  }

  return {
    getOrCreateSession,
    getSession,
    getSessionByChat,
    archiveSession,
    touchSession,
    activeSessions,
    pruneIdleSessions,
    setSessionMode,
  }
}
