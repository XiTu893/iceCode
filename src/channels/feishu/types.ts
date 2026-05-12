/**
 * Feishu Channel types.
 *
 * Defines the type system for the Feishu (Lark) Channel adapter.
 * Covers configuration, API payloads, card structures, and
 * event schemas needed to communicate with the Feishu Open Platform.
 */

export type FeishuTransportMode = 'websocket' | 'webhook'

export type FeishuSessionMode = 'per_user' | 'per_chat' | 'per_thread'

export type FeishuGroupTrigger = 'mention' | 'all' | 'keyword'

export type FeishuConfig = {
  appId: string
  appSecret: string
  verificationToken?: string
  encryptKey?: string
  transport: FeishuTransportMode
  sessionMode: FeishuSessionMode
  groupTrigger: FeishuGroupTrigger
  webhookPort?: number
  webhookPath?: string
  allowedUsers?: string[]
  allowedGroups?: string[]
  botName?: string
}

export type FeishuEventType =
  | 'im.message.receive_v1'
  | 'card.action.trigger'
  | 'im.chat.member.bot.added_v1'
  | 'im.chat.member.bot.deleted_v1'

export type FeishuEventHeader = {
  event_id: string
  event_type: FeishuEventType
  create_time: string
  token: string
  app_id: string
  tenant_key: string
}

export type FeishuMessageEvent = {
  message: {
    message_id: string
    root_id?: string
    parent_id?: string
    chat_id: string
    chat_type: 'p2p' | 'group'
    message_type: string
    content: string
    create_time: string
  }
  sender: {
    sender_id: {
      open_id: string
      user_id?: string
      union_id?: string
    }
    sender_type: string
    tenant_key: string
  }
}

export type FeishuCardActionEvent = {
  open_id: string
  token: string
  action: {
    value: Record<string, string>
    tag: string
  }
  open_message_id: string
  open_chat_id: string
}

export type FeishuEventPayload = {
  header: FeishuEventHeader
  event: FeishuMessageEvent | FeishuCardActionEvent
}

export type FeishuTextContent = {
  text: string
}

export type FeishuRichTextContent = {
  zh_cn?: unknown
  en_us?: unknown
}

export type FeishuImageContent = {
  image_key: string
}

export type FeishuFileContent = {
  file_key: string
  file_name: string
}

export type FeishuCardHeader = {
  title: {
    tag: 'plain_text' | 'lark_md'
    content: string
  }
  template?: string
  subtitle?: {
    tag: 'plain_text'
    content: string
  }
}

export type FeishuCardElement =
  | { tag: 'div'; text: { tag: 'lark_md'; content: string } }
  | { tag: 'div'; text: { tag: 'plain_text'; content: string } }
  | {
      tag: 'action'
      actions: FeishuCardAction[]
    }
  | { tag: 'img'; img_key: string; alt?: { tag: 'plain_text'; content: string } }
  | { tag: 'hr' }
  | { tag: 'note'; elements: FeishuCardNoteElement[] }
  | { tag: 'markdown'; content: string }

export type FeishuCardAction = {
  tag: 'button'
  text: { tag: 'plain_text'; content: string }
  type: 'primary' | 'default' | 'danger'
  value: Record<string, string>
  disabled?: boolean
}

export type FeishuCardNoteElement =
  | { tag: 'plain_text'; content: string }
  | { tag: 'img'; img_key: string }

export type FeishuCard = {
  schema?: string
  header?: FeishuCardHeader
  elements: FeishuCardElement[]
  config?: {
    wide_screen_mode?: boolean
    enable_forward?: boolean
    update_multi?: boolean
  }
}

export type FeishuMessageBody =
  | { type: 'text'; content: string }
  | { type: 'interactive'; card: FeishuCard }
  | { type: 'post'; content: string }
  | { type: 'image'; content: string }
  | { type: 'file'; content: string }

export type FeishuSendMessageParams = {
  receive_id: string
  msg_type: 'text' | 'interactive' | 'post' | 'image' | 'file'
  content: string
}

export type FeishuUpdateCardParams = {
  message_id: string
  content: string
}

export type FeishuTenantAccessToken = {
  tenant_access_token: string
  expire: number
}

export type FeishuSession = {
  sessionId: string
  chatId: string
  chatType: 'p2p' | 'group'
  senderId: string
  senderName?: string
  threadId?: string
  createdAt: number
  lastActivityAt: number
  lastMessageId?: string
}

export type FeishuPermissionPending = {
  requestId: string
  chatId: string
  messageId: string
  createdAt: number
}
