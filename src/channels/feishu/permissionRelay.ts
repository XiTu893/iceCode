/**
 * FeishuPermissionRelay — bridges CC permission requests to Feishu cards.
 *
 * When CC emits a `notifications/claude/channel/permission_request`, this
 * module builds an interactive approval card and sends it to the Feishu
 * chat. When the user taps Allow/Deny, the card callback is parsed and
 * the result is emitted back as a `notifications/claude/channel/permission`
 * structured event.
 */

import type { FeishuPermissionPending } from './types.js'
import { createFeishuCardBuilder } from './cardBuilder.js'
import type { MessageFormatter } from './messageFormatter.js'

export type PermissionRelayCallbacks = {
  sendCard: (chatId: string, card: unknown) => Promise<string>
  updateCard: (messageId: string, card: unknown) => Promise<void>
  onPermissionResponse: (requestId: string, behavior: 'allow' | 'deny') => void
}

export type FeishuPermissionRelay = {
  sendPermissionRequest(
    chatId: string,
    requestId: string,
    toolName: string,
    description: string,
    inputPreview: string,
  ): Promise<string>
  handleCardAction(action: { value: Record<string, string> }, chatId: string, messageId: string): void
  getPendingRequests(): FeishuPermissionPending[]
  cleanup(requestId: string): void
}

export function createFeishuPermissionRelay(
  callbacks: PermissionRelayCallbacks,
  formatter: MessageFormatter,
): FeishuPermissionRelay {
  const pending = new Map<string, FeishuPermissionPending>()
  const cardBuilder = createFeishuCardBuilder()
  const REQUEST_TIMEOUT_MS = 5 * 60 * 1000

  async function sendPermissionRequest(
    chatId: string,
    requestId: string,
    toolName: string,
    description: string,
    inputPreview: string,
  ): Promise<string> {
    const card = cardBuilder.buildApprovalCard({
      requestId,
      toolName,
      description,
      inputPreview,
    })

    const messageId = await callbacks.sendCard(chatId, card)

    pending.set(requestId, {
      requestId,
      chatId,
      messageId,
      createdAt: Date.now(),
    })

    setTimeout(() => {
      const entry = pending.get(requestId)
      if (entry) {
        expireRequest(requestId)
      }
    }, REQUEST_TIMEOUT_MS).unref?.()

    return messageId
  }

  function handleCardAction(
    action: { value: Record<string, string> },
    chatId: string,
    messageId: string,
  ): void {
    const { action: actionType, request_id } = action.value

    if (!request_id || !actionType) return
    if (actionType !== 'allow' && actionType !== 'deny') return

    const entry = pending.get(request_id)
    if (!entry) return

    const behavior = actionType as 'allow' | 'deny'

    callbacks.onPermissionResponse(request_id, behavior)

    const updatedCard = cardBuilder.buildTextCard(
      behavior === 'allow' ? '✅ Permission granted' : '❌ Permission denied',
      { title: `Permission Request — ${behavior === 'allow' ? 'Approved' : 'Denied'}` },
    )

    callbacks.updateCard(messageId, updatedCard).catch(() => {})

    pending.delete(request_id)
  }

  function expireRequest(requestId: string): void {
    const entry = pending.get(requestId)
    if (!entry) return

    const updatedCard = cardBuilder.buildTextCard(
      '⏰ Permission request expired',
      { title: 'Permission Request — Expired' },
    )

    callbacks.updateCard(entry.messageId, updatedCard).catch(() => {})
    pending.delete(requestId)
  }

  function getPendingRequests(): FeishuPermissionPending[] {
    return Array.from(pending.values())
  }

  function cleanup(requestId: string): void {
    pending.delete(requestId)
  }

  return {
    sendPermissionRequest,
    handleCardAction,
    getPendingRequests,
    cleanup,
  }
}
