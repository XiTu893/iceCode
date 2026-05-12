/**
 * MessageFormatter — converts AI responses and tool outputs into
 * Feishu message payloads suitable for the Bot API.
 *
 * Handles text, code blocks, file edits, command output, and
 * streaming partial responses. Each format method returns a
 * { msg_type, content } pair ready for the send-message API.
 */

import type { FeishuCard, FeishuMessageBody } from './types.js'
import { createFeishuCardBuilder, type FeishuCardBuilder } from './cardBuilder.js'

export type FormattedMessage = {
  msg_type: 'text' | 'interactive' | 'post'
  content: string
}

export type MessageFormatter = {
  formatText(content: string, title?: string): FormattedMessage
  formatCode(code: string, language?: string, fileName?: string): FormattedMessage
  formatStreaming(partialContent: string, thinking?: boolean): FormattedMessage
  formatApproval(requestId: string, toolName: string, description: string, inputPreview: string): FormattedMessage
  formatFileEdit(filePath: string, diff: string, description?: string): FormattedMessage
  formatCommandOutput(command: string, exitCode: number, output: string): FormattedMessage
  formatError(title: string, message: string, retryable?: boolean): FormattedMessage
  formatCard(card: FeishuCard): FormattedMessage
  cardBuilder: FeishuCardBuilder
}

export function createMessageFormatter(): MessageFormatter {
  const cardBuilder = createFeishuCardBuilder()

  function formatText(content: string, title?: string): FormattedMessage {
    const card = cardBuilder.buildTextCard(content, { title })
    return formatCard(card)
  }

  function formatCode(code: string, language?: string, fileName?: string): FormattedMessage {
    const card = cardBuilder.buildCodeCard(code, { language, fileName, copyable: true })
    return formatCard(card)
  }

  function formatStreaming(partialContent: string, thinking?: boolean): FormattedMessage {
    const card = cardBuilder.buildStreamingCard(partialContent, thinking)
    return formatCard(card)
  }

  function formatApproval(requestId: string, toolName: string, description: string, inputPreview: string): FormattedMessage {
    const card = cardBuilder.buildApprovalCard({
      requestId,
      toolName,
      description,
      inputPreview,
    })
    return formatCard(card)
  }

  function formatFileEdit(filePath: string, diff: string, description?: string): FormattedMessage {
    const card = cardBuilder.buildFileEditCard(diff, { filePath, description })
    return formatCard(card)
  }

  function formatCommandOutput(command: string, exitCode: number, output: string): FormattedMessage {
    const card = cardBuilder.buildCommandOutputCard({ command, exitCode, output })
    return formatCard(card)
  }

  function formatError(title: string, message: string, retryable?: boolean): FormattedMessage {
    const card = cardBuilder.buildErrorCard({ title, message, retryable })
    return formatCard(card)
  }

  function formatCard(card: FeishuCard): FormattedMessage {
    return {
      msg_type: 'interactive',
      content: JSON.stringify(card),
    }
  }

  return {
    formatText,
    formatCode,
    formatStreaming,
    formatApproval,
    formatFileEdit,
    formatCommandOutput,
    formatError,
    formatCard,
    cardBuilder,
  }
}
