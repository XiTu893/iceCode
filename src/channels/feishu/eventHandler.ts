/**
 * FeishuEventHandler — processes inbound Feishu events and routes them
 * through the Channel system.
 *
 * Converts Feishu message events into `notifications/claude/channel`
 * notifications and card action callbacks into permission responses.
 * Handles message type parsing (text, rich text, image, file) and
 * group-chat mention detection.
 */

import type {
  FeishuCardActionEvent,
  FeishuConfig,
  FeishuMessageEvent,
} from './types.js'
import type { FeishuPermissionRelay } from './permissionRelay.js'
import type { FeishuSessionManager } from './sessionManager.js'

export type EventHandlerCallbacks = {
  onInboundMessage: (params: {
    content: string
    meta: Record<string, string>
    sessionId: string
    chatId: string
    chatType: 'p2p' | 'group'
    senderId: string
    senderName?: string
  }) => void
  onCardAction: (params: {
    action: Record<string, string>
    chatId: string
    messageId: string
    senderId: string
  }) => void
}

export type FeishuEventHandler = {
  handleMessage(event: FeishuMessageEvent): void
  handleCardAction(event: FeishuCardActionEvent): void
}

export function createFeishuEventHandler(
  config: FeishuConfig,
  sessionManager: FeishuSessionManager,
  permissionRelay: FeishuPermissionRelay,
  callbacks: EventHandlerCallbacks,
): FeishuEventHandler {
  function handleMessage(event: FeishuMessageEvent): void {
    const { message, sender } = event
    const chatId = message.chat_id
    const chatType = message.chat_type
    const senderId = sender.sender_id.open_id
    const senderName = sender.sender_id.user_id
    const threadId = message.root_id ?? message.parent_id

    if (config.allowedUsers?.length && !config.allowedUsers.includes(senderId)) {
      return
    }

    if (chatType === 'group' && config.allowedGroups?.length && !config.allowedGroups.includes(chatId)) {
      return
    }

    if (chatType === 'group' && config.groupTrigger === 'mention') {
      const content = parseMessageContent(message.content, message.message_type)
      if (!isBotMentioned(content, config.botName ?? 'OpenClaude')) {
        return
      }
    }

    const session = sessionManager.getOrCreateSession(
      chatId,
      chatType,
      senderId,
      senderName,
      threadId,
    )

    const content = parseMessageContent(message.content, message.message_type)
    const cleanContent = chatType === 'group' ? stripMention(content, config.botName ?? 'OpenClaude') : content

    const meta: Record<string, string> = {
      chat_id: chatId,
      chat_type: chatType,
      user: senderId,
      message_id: message.message_id,
    }

    if (senderName) meta.user_name = senderName
    if (threadId) meta.thread_id = threadId

    callbacks.onInboundMessage({
      content: cleanContent.trim(),
      meta,
      sessionId: session.sessionId,
      chatId,
      chatType,
      senderId,
      senderName,
    })
  }

  function handleCardAction(event: FeishuCardActionEvent): void {
    const actionValue = event.action.value
    const chatId = event.open_chat_id
    const messageId = event.open_message_id
    const senderId = event.open_id

    permissionRelay.handleCardAction(
      { value: actionValue },
      chatId,
      messageId,
    )

    callbacks.onCardAction({
      action: actionValue,
      chatId,
      messageId,
      senderId,
    })
  }

  return {
    handleMessage,
    handleCardAction,
  }
}

function parseMessageContent(rawContent: string, messageType: string): string {
  try {
    switch (messageType) {
      case 'text': {
        const parsed = JSON.parse(rawContent) as { text: string }
        return parsed.text ?? ''
      }
      case 'post': {
        const parsed = JSON.parse(rawContent) as {
          zh_cn?: { content: Array<Array<{ tag: string; text?: string }>> }
          en_us?: { content: Array<Array<{ tag: string; text?: string }>> }
        }
        const lang = parsed.zh_cn ?? parsed.en_us
        if (!lang?.content) return ''
        return lang.content
          .flat()
          .map(el => el.text ?? '')
          .join('')
      }
      case 'image': {
        return '[图片]'
      }
      case 'file': {
        const parsed = JSON.parse(rawContent) as { file_name?: string }
        return `[文件: ${parsed.file_name ?? 'unknown'}]`
      }
      default:
        return rawContent
    }
  } catch {
    return rawContent
  }
}

function isBotMentioned(content: string, botName: string): boolean {
  const mentionPattern = new RegExp(`@${escapeRegExp(botName)}`, 'i')
  return mentionPattern.test(content)
}

function stripMention(content: string, botName: string): string {
  const mentionPattern = new RegExp(`@${escapeRegExp(botName)}\\s*`, 'gi')
  return content.replace(mentionPattern, '')
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
