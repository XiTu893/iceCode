/**
 * FeishuCardBuilder — converts AI responses into Feishu interactive cards.
 *
 * This is the Canvas2UI engine: structured AI output (text, code, diffs,
 * permission requests) is rendered as Feishu message cards with interactive
 * components (buttons, inputs, selectors). Cards can be updated in-place
 * for streaming responses via PATCH /messages/{id}.
 */

import type {
  FeishuCard,
  FeishuCardAction,
  FeishuCardElement,
  FeishuCardHeader,
  FeishuPermissionPending,
} from './types.js'

const MAX_TEXT_LENGTH = 4000
const MAX_CODE_LENGTH = 6000
const MAX_INPUT_PREVIEW = 200

export type TextCardOptions = {
  title?: string
  headerTemplate?: string
  streaming?: boolean
}

export type CodeCardOptions = {
  language?: string
  fileName?: string
  copyable?: boolean
}

export type FileEditCardOptions = {
  filePath: string
  description?: string
}

export type ApprovalCardOptions = {
  requestId: string
  toolName: string
  description: string
  inputPreview: string
}

export type TaskProgressCardOptions = {
  taskName: string
  status: 'running' | 'completed' | 'failed' | 'cancelled'
  progress?: number
  output?: string
}

export type SearchResultCardOptions = {
  query: string
  results: Array<{ title: string; path: string; line?: number; snippet?: string }>
}

export type CommandOutputCardOptions = {
  command: string
  exitCode: number
  output: string
  truncated?: boolean
}

export type ErrorCardOptions = {
  title: string
  message: string
  retryable?: boolean
}

export type FeishuCardBuilder = {
  buildTextCard(content: string, options?: TextCardOptions): FeishuCard
  buildCodeCard(code: string, options?: CodeCardOptions): FeishuCard
  buildStreamingCard(partialContent: string, thinking?: boolean): FeishuCard
  buildApprovalCard(options: ApprovalCardOptions): FeishuCard
  buildFileEditCard(diff: string, options: FileEditCardOptions): FeishuCard
  buildTaskProgressCard(options: TaskProgressCardOptions): FeishuCard
  buildSearchResultCard(options: SearchResultCardOptions): FeishuCard
  buildCommandOutputCard(options: CommandOutputCardOptions): FeishuCard
  buildErrorCard(options: ErrorCardOptions): FeishuCard
  buildSessionInfoCard(sessionId: string, model: string, cwd: string): FeishuCard
}

export function createFeishuCardBuilder(): FeishuCardBuilder {
  function buildTextCard(content: string, options?: TextCardOptions): FeishuCard {
    const truncated = content.length > MAX_TEXT_LENGTH
      ? content.slice(0, MAX_TEXT_LENGTH) + '…'
      : content

    const elements: FeishuCardElement[] = [
      { tag: 'markdown', content: truncated },
    ]

    if (truncated) {
      elements.push({
        tag: 'note',
        elements: [{ tag: 'plain_text', content: 'Response truncated' }],
      })
    }

    return {
      schema: '2.0',
      header: options?.title
        ? {
            title: { tag: 'lark_md', content: options.title },
            template: options.headerTemplate ?? 'blue',
          }
        : undefined,
      elements,
      config: { wide_screen_mode: true, enable_forward: true },
    }
  }

  function buildCodeCard(code: string, options?: CodeCardOptions): FeishuCard {
    const truncated = code.length > MAX_CODE_LENGTH
      ? code.slice(0, MAX_CODE_LENGTH) + '\n… (truncated)'
      : code

    const escapedCode = escapeMd(truncated)
    const langLabel = options?.language ? `**${options.language}**` : ''
    const fileLabel = options?.fileName ? ` — ${options.fileName}` : ''

    const elements: FeishuCardElement[] = [
      { tag: 'markdown', content: `${langLabel}${fileLabel}\n\`\`\`${options?.language ?? ''}\n${escapedCode}\n\`\`\`` },
    ]

    const actions: FeishuCardAction[] = []
    if (options?.copyable) {
      actions.push({
        tag: 'button',
        text: { tag: 'plain_text', content: '📋 Copy' },
        type: 'default',
        value: { action: 'copy', code: truncated },
      })
    }

    if (actions.length > 0) {
      elements.push({ tag: 'action', actions })
    }

    return {
      schema: '2.0',
      header: {
        title: { tag: 'lark_md', content: `💻 Code${fileLabel}` },
        template: 'indigo',
      },
      elements,
      config: { wide_screen_mode: true },
    }
  }

  function buildStreamingCard(partialContent: string, thinking?: boolean): FeishuCard {
    const statusIcon = thinking ? '🤔' : '✍️'
    const statusText = thinking ? 'Thinking…' : 'Writing…'

    const truncated = partialContent.length > MAX_TEXT_LENGTH
      ? partialContent.slice(0, MAX_TEXT_LENGTH) + '…'
      : partialContent

    const elements: FeishuCardElement[] = []

    if (!partialContent && thinking) {
      elements.push({ tag: 'markdown', content: `${statusIcon} ${statusText}` })
    } else {
      elements.push({ tag: 'markdown', content: truncated })
    }

    return {
      schema: '2.0',
      header: {
        title: { tag: 'lark_md', content: `${statusIcon} IceCode` },
        template: 'blue',
      },
      elements,
      config: { wide_screen_mode: true, update_multi: true },
    }
  }

  function buildApprovalCard(options: ApprovalCardOptions): FeishuCard {
    const preview = options.inputPreview.length > MAX_INPUT_PREVIEW
      ? options.inputPreview.slice(0, MAX_INPUT_PREVIEW) + '…'
      : options.inputPreview

    return {
      schema: '2.0',
      header: {
        title: { tag: 'lark_md', content: '⚠️ Permission Request' },
        template: 'orange',
      },
      elements: [
        { tag: 'markdown', content: `**Tool**: \`${options.toolName}\`` },
        { tag: 'markdown', content: options.description },
        {
          tag: 'markdown',
          content: `\`\`\`\n${escapeMd(preview)}\n\`\`\``,
        },
        {
          tag: 'action',
          actions: [
            {
              tag: 'button',
              text: { tag: 'plain_text', content: '✅ Allow' },
              type: 'primary',
              value: { action: 'allow', request_id: options.requestId },
            },
            {
              tag: 'button',
              text: { tag: 'plain_text', content: '❌ Deny' },
              type: 'danger',
              value: { action: 'deny', request_id: options.requestId },
            },
          ],
        },
      ],
      config: { wide_screen_mode: true },
    }
  }

  function buildFileEditCard(diff: string, options: FileEditCardOptions): FeishuCard {
    const truncated = diff.length > MAX_CODE_LENGTH
      ? diff.slice(0, MAX_CODE_LENGTH) + '\n… (truncated)'
      : diff

    return {
      schema: '2.0',
      header: {
        title: { tag: 'lark_md', content: `📝 File Edit: ${options.filePath}` },
        template: 'turquoise',
      },
      elements: [
        ...(options.description
          ? [{ tag: 'markdown', content: options.description } as FeishuCardElement]
          : []),
        { tag: 'markdown', content: `\`\`\`diff\n${escapeMd(truncated)}\n\`\`\`` },
        {
          tag: 'action',
          actions: [
            {
              tag: 'button',
              text: { tag: 'plain_text', content: '✅ Apply' },
              type: 'primary',
              value: { action: 'apply', file_path: options.filePath },
            },
            {
              tag: 'button',
              text: { tag: 'plain_text', content: '❌ Reject' },
              type: 'danger',
              value: { action: 'reject', file_path: options.filePath },
            },
          ],
        },
      ],
      config: { wide_screen_mode: true },
    }
  }

  function buildTaskProgressCard(options: TaskProgressCardOptions): FeishuCard {
    const statusIcons: Record<string, string> = {
      running: '🔄',
      completed: '✅',
      failed: '❌',
      cancelled: '🚫',
    }
    const icon = statusIcons[options.status] ?? '📋'

    const elements: FeishuCardElement[] = [
      { tag: 'markdown', content: `**${icon} ${options.taskName}** — ${options.status}` },
    ]

    if (options.progress !== undefined) {
      const filled = Math.round(options.progress / 10)
      const bar = '█'.repeat(filled) + '░'.repeat(10 - filled)
      elements.push({ tag: 'markdown', content: `${bar} ${options.progress}%` })
    }

    if (options.output) {
      const truncated = options.output.length > 1000
        ? options.output.slice(0, 1000) + '…'
        : options.output
      elements.push({ tag: 'markdown', content: `\`\`\`\n${escapeMd(truncated)}\n\`\`\`` })
    }

    const actions: FeishuCardAction[] = []
    if (options.status === 'running') {
      actions.push({
        tag: 'button',
        text: { tag: 'plain_text', content: '🛑 Cancel' },
        type: 'danger',
        value: { action: 'cancel', task: options.taskName },
      })
    } else if (options.status === 'failed' || options.status === 'cancelled') {
      actions.push({
        tag: 'button',
        text: { tag: 'plain_text', content: '🔄 Retry' },
        type: 'primary',
        value: { action: 'retry', task: options.taskName },
      })
    }

    if (actions.length > 0) {
      elements.push({ tag: 'action', actions })
    }

    return {
      schema: '2.0',
      header: {
        title: { tag: 'lark_md', content: `${icon} Task Progress` },
        template: options.status === 'failed' ? 'red' : options.status === 'completed' ? 'green' : 'blue',
      },
      elements,
      config: { wide_screen_mode: true, update_multi: true },
    }
  }

  function buildSearchResultCard(options: SearchResultCardOptions): FeishuCard {
    const elements: FeishuCardElement[] = [
      { tag: 'markdown', content: `**Search**: \`${options.query}\`` },
    ]

    for (const result of options.results.slice(0, 5)) {
      const lineInfo = result.line ? `:${result.line}` : ''
      const snippet = result.snippet ? `\n> ${escapeMd(result.snippet.slice(0, 200))}` : ''
      elements.push({
        tag: 'markdown',
        content: `📄 **${result.title}** \`${result.path}${lineInfo}\`${snippet}`,
      })
    }

    if (options.results.length > 5) {
      elements.push({
        tag: 'note',
        elements: [{ tag: 'plain_text', content: `+ ${options.results.length - 5} more results` }],
      })
    }

    return {
      schema: '2.0',
      header: {
        title: { tag: 'lark_md', content: '🔍 Search Results' },
        template: 'purple',
      },
      elements,
      config: { wide_screen_mode: true },
    }
  }

  function buildCommandOutputCard(options: CommandOutputCardOptions): FeishuCard {
    const truncated = options.output.length > MAX_CODE_LENGTH
      ? options.output.slice(0, MAX_CODE_LENGTH) + '…'
      : options.output

    const exitIcon = options.exitCode === 0 ? '✅' : '❌'

    return {
      schema: '2.0',
      header: {
        title: { tag: 'lark_md', content: `${exitIcon} Command: \`${options.command}\`` },
        template: options.exitCode === 0 ? 'green' : 'red',
      },
      elements: [
        { tag: 'markdown', content: `Exit code: ${options.exitCode}` },
        { tag: 'markdown', content: `\`\`\`\n${escapeMd(truncated)}\n\`\`\`` },
        ...(options.truncated
          ? [{ tag: 'note', elements: [{ tag: 'plain_text', content: 'Output truncated' } as const] } as FeishuCardElement]
          : []),
        {
          tag: 'action',
          actions: [
            {
              tag: 'button',
              text: { tag: 'plain_text', content: '🔄 Re-run' },
              type: 'default',
              value: { action: 'rerun', command: options.command },
            },
          ],
        },
      ],
      config: { wide_screen_mode: true },
    }
  }

  function buildErrorCard(options: ErrorCardOptions): FeishuCard {
    const elements: FeishuCardElement[] = [
      { tag: 'markdown', content: `**${escapeMd(options.title)}**` },
      { tag: 'markdown', content: escapeMd(options.message) },
    ]

    if (options.retryable) {
      elements.push({
        tag: 'action',
        actions: [
          {
            tag: 'button',
            text: { tag: 'plain_text', content: '🔄 Retry' },
            type: 'primary',
            value: { action: 'retry' },
          },
          {
            tag: 'button',
            text: { tag: 'plain_text', content: '🚫 Ignore' },
            type: 'default',
            value: { action: 'ignore' },
          },
        ],
      })
    }

    return {
      schema: '2.0',
      header: {
        title: { tag: 'lark_md', content: '❌ Error' },
        template: 'red',
      },
      elements,
      config: { wide_screen_mode: true },
    }
  }

  function buildSessionInfoCard(sessionId: string, model: string, cwd: string): FeishuCard {
    return {
      schema: '2.0',
      header: {
        title: { tag: 'lark_md', content: '🤖 IceCode Session' },
        template: 'blue',
      },
      elements: [
        { tag: 'markdown', content: `**Session**: \`${sessionId.slice(0, 16)}…\`` },
        { tag: 'markdown', content: `**Model**: ${model}` },
        { tag: 'markdown', content: `**CWD**: \`${cwd}\`` },
      ],
      config: { wide_screen_mode: true },
    }
  }

  return {
    buildTextCard,
    buildCodeCard,
    buildStreamingCard,
    buildApprovalCard,
    buildFileEditCard,
    buildTaskProgressCard,
    buildSearchResultCard,
    buildCommandOutputCard,
    buildErrorCard,
    buildSessionInfoCard,
  }
}

function escapeMd(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\*/g, '\\*')
    .replace(/_/g, '\\_')
    .replace(/`/g, '\\`')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
}
