# OpenClaude 飞书 Channel 双向交互集成方案

## 一、项目现状分析

### 1.1 OpenClaude 现有架构

OpenClaude 是一个开源 AI 编码代理 CLI 工具，已具备以下关键能力：

- **Bridge 系统**：远程控制基础设施，通过 WebSocket/SSE 与 claude.ai 双向通信
- **Channel 系统**：基于 MCP 协议的外部消息通道，支持 Discord/Slack/Telegram/iMessage/SMS 等平台
  - 入站消息协议：`notifications/claude/channel`，消息包装为 `<channel source="..." meta="...">content</channel>` XML
  - 权限审批中继：`notifications/claude/channel/permission_request` + `notifications/claude/channel/permission`
  - 7 层安全门控：capability → 全局开关 → OAuth 认证 → 组织策略 → 会话 opt-in → marketplace 验证 → 白名单
- **插件系统**：支持 Commands/Agents/Skills/Hooks/MCP Servers/LSP Servers 6 种扩展组件
- **MCP 服务**：8 种传输类型（stdio/sse/http/ws/sdk/claudeai-proxy 等）
- **SDK 入口**：`query()` API 支持进程内工具定义（`type: 'sdk'`）
- **gRPC 网关**：双向流式通信，支持跨语言集成

### 1.2 OpenClaw Channel 参考架构

OpenClaw 是一个自托管网关，核心特性：
- **Gateway 架构**：单一进程维护所有聊天平台连接，作为消息路由中枢
- **多 Channel 支持**：WhatsApp/Telegram/Discord/iMessage 同时运行
- **会话隔离**：每个 sender 拥有独立会话和记忆
- **WebSocket 插件**：`@taichi-labs/openclaw-websocket` 提供标准化的双向通信协议
- **Agent 间通信**：Hub-Spoke/Pipeline/Mesh 三种架构模式
- **Canvas 支持**：iOS/Android 节点配对后支持 Canvas 渲染

### 1.3 飞书集成能力

飞书开放平台提供：
- **机器人 API**：发送/接收消息、事件订阅（WebSocket 长连接或 Webhook）
- **消息卡片**：交互式 UI 组件（按钮、输入框、选择器、图表、表单容器）
- **卡片回调**：`card.action.trigger` 回调协议，用户交互实时回传
- **云文档小组件**：Block 级别的嵌入式 UI，支持数据持久化（Record + Interaction）
- **多维表格插件**：结构化数据管理能力
- **长连接 SDK**：飞书 SDK 内置 WebSocket 全双工通道

---

## 二、目标架构

### 2.1 总体目标

为 OpenClaude 添加飞书 Channel，实现：
1. **类 OpenClaw 的 Channel 网关**：统一的 Channel 管理层，支持飞书及其他平台
2. **飞书双向交互**：通过飞书消息卡片（Canvas2UI）实现富交互
3. **会话隔离**：每个飞书用户/群组拥有独立会话
4. **权限审批中继**：飞书端远程审批工具权限
5. **流式响应**：AI 响应实时流式推送到飞书

### 2.2 架构全景图

```
┌─────────────────────────────────────────────────────────────────────┐
│                        OpenClaude CLI                               │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                   Channel Gateway (新增)                       │  │
│  │                                                               │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌──────────────────────┐  │  │
│  │  │  Feishu     │  │  WebSocket  │  │  Future Channels     │  │  │
│  │  │  Channel    │  │  Channel    │  │  (DingTalk/WeCom/..) │  │  │
│  │  │  Adapter    │  │  Adapter    │  │                      │  │  │
│  │  └──────┬──────┘  └──────┬──────┘  └──────────┬───────────┘  │  │
│  │         │                │                     │              │  │
│  │  ┌──────▼────────────────▼─────────────────────▼───────────┐  │  │
│  │  │              Channel Core (统一抽象层)                    │  │  │
│  │  │  - SessionManager: 会话路由与隔离                         │  │  │
│  │  │  - MessageRouter: 消息分发与去重                          │  │  │
│  │  │  - PermissionRelay: 权限审批中继                          │  │  │
│  │  │  - CardRenderer: 飞书卡片/Canvas 渲染                     │  │  │
│  │  └────────────────────────┬────────────────────────────────┘  │  │
│  └────────────────────────────┼──────────────────────────────────┘  │
│                               │                                     │
│  ┌────────────────────────────▼──────────────────────────────────┐  │
│  │              现有 MCP Channel 系统                             │  │
│  │  notifications/claude/channel                                 │  │
│  │  notifications/claude/channel/permission                      │  │
│  │  notifications/claude/channel/permission_request              │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │              现有 Bridge / REPL / SDK 层                       │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
          │                                    │
          ▼                                    ▼
┌──────────────────┐              ┌──────────────────────────┐
│  飞书开放平台      │              │  OpenClaw WebSocket      │
│  - Bot API       │              │  Gateway (兼容)          │
│  - 消息卡片       │              │                          │
│  - 事件订阅       │              └──────────────────────────┘
│  - 云文档小组件    │
└──────────────────┘
```

---

## 三、模块设计

### 3.1 模块一：飞书 Channel MCP 服务器（核心）

**路径**：`src/channels/feishu/`

作为 MCP 服务器实现，遵循现有 Channel 协议，声明 `claude/channel` 和 `claude/channel/permission` 能力。

#### 文件结构

```
src/channels/feishu/
├── index.ts                    # MCP 服务器入口
├── server.ts                   # MCP 服务器定义（工具、能力声明）
├── transport.ts                # 飞书事件接收与消息发送
├── cardBuilder.ts              # 飞书消息卡片构建器（Canvas2UI 核心）
├── cardTemplates.ts            # 预定义卡片模板
├── sessionManager.ts           # 飞书用户/群组会话管理
├── permissionRelay.ts          # 权限审批中继
├── eventHandler.ts             # 飞书事件处理器
├── messageFormatter.ts         # AI 响应 → 飞书消息格式转换
├── types.ts                    # 类型定义
└── config.ts                   # 配置管理
```

#### 3.1.1 MCP 服务器定义（server.ts）

```typescript
// 声明能力
capabilities: {
  experimental: {
    'claude/channel': {},
    'claude/channel/permission': {},
  },
}

// 暴露工具
tools: [
  {
    name: 'send_feishu_message',
    description: '向飞书用户或群组发送消息',
    inputSchema: {
      type: 'object',
      properties: {
        chat_id: { type: 'string', description: '飞书会话 ID' },
        content: { type: 'string', description: '消息内容' },
        card_type: { type: 'string', enum: ['text', 'interactive', 'code', 'status'] },
      },
    },
  },
  {
    name: 'send_feishu_card',
    description: '发送交互式飞书卡片（Canvas2UI）',
    inputSchema: {
      type: 'object',
      properties: {
        chat_id: { type: 'string' },
        card_template: { type: 'string', enum: ['approval', 'code_review', 'task_status', 'custom'] },
        card_data: { type: 'object' },
      },
    },
  },
  {
    name: 'update_feishu_card',
    description: '更新已发送的飞书卡片内容',
    inputSchema: {
      type: 'object',
      properties: {
        message_id: { type: 'string' },
        card_data: { type: 'object' },
      },
    },
  },
]
```

#### 3.1.2 飞书事件接收（transport.ts）

**两种传输模式**：

1. **WebSocket 长连接模式**（推荐）：使用飞书 SDK 内置的 WebSocket 全双工通道
2. **Webhook 模式**：HTTP 回调服务器，接收飞书事件推送

```typescript
// WebSocket 长连接
class FeishuWebSocketTransport {
  // 使用飞书长连接 SDK
  // 事件：im.message.receive_v1, card.action.trigger
  // 优势：无需公网 IP，适合本地开发
}

// Webhook 回调
class FeishuWebhookTransport {
  // HTTP 服务器接收飞书事件
  // 需要公网可访问的 URL
  // 优势：适合生产部署
}
```

#### 3.1.3 Canvas2UI 卡片构建器（cardBuilder.ts）

这是飞书双向交互的核心，将 AI 的结构化输出转换为飞书交互式卡片：

```typescript
class FeishuCardBuilder {
  // AI 响应 → 飞书消息卡片
  buildTextCard(content: string): FeishuCard
  buildCodeCard(code: string, language: string): FeishuCard
  buildApprovalCard(request: PermissionRequest): FeishuCard
  buildStatusCard(status: TaskStatus): FeishuCard
  buildStreamCard(partialContent: string): FeishuCard  // 流式更新

  // Canvas2UI：将 AI 工具输出渲染为交互式卡片
  buildFileEditCard(filePath: string, diff: string): FeishuCard
  buildSearchResultCard(results: SearchResult[]): FeishuCard
  buildCommandResultCard(command: string, output: string): FeishuCard
}
```

**关键设计**：流式响应使用飞书卡片的**更新**能力：
1. 首次发送一个"思考中"卡片
2. 随着 AI 流式输出，通过 `PATCH /open-apis/im/v1/messages/{message_id}` 更新卡片内容
3. 最终更新为完整响应卡片

#### 3.1.4 会话管理（sessionManager.ts）

```typescript
class FeishuSessionManager {
  // 飞书 chat_id → OpenClaude session_id 映射
  private sessions: Map<string, FeishuSession>

  // 会话隔离策略
  // - 单聊：每个用户独立会话
  // - 群聊：每个群独立会话（可选 @机器人 触发）
  // - 话题：每个话题独立会话

  getOrCreateSession(chatId: string, senderId: string): FeishuSession
  archiveSession(chatId: string): void
  getSessionHistory(chatId: string): Message[]
}
```

#### 3.1.5 权限审批中继（permissionRelay.ts）

```typescript
class FeishuPermissionRelay {
  // 接收 CC 的 permission_request 通知
  // → 构建飞书审批卡片（含 Allow/Deny 按钮）
  // → 发送到飞书
  // → 用户点击按钮
  // → 飞书 card.action.trigger 回调
  // → 解析为 permission 通知
  // → 发送回 CC
}
```

审批卡片示例：
```json
{
  "header": { "title": "权限请求", "template": "orange" },
  "elements": [
    { "tag": "div", "text": { "tag": "lark_md", "content": "**工具**: Bash\n**命令**: `rm -rf /tmp/test`" } },
    {
      "tag": "action",
      "actions": [
        { "tag": "button", "text": { "tag": "plain_text", "content": "✅ 允许" }, "type": "primary", "value": "{\"action\":\"allow\",\"request_id\":\"tbxkq\"}" },
        { "tag": "button", "text": { "tag": "plain_text", "content": "❌ 拒绝" }, "type": "danger", "value": "{\"action\":\"deny\",\"request_id\":\"tbxkq\"}" }
      ]
    }
  ]
}
```

### 3.2 模块二：Channel Gateway 管理层（新增）

**路径**：`src/channels/core/`

统一的 Channel 管理抽象层，为所有 Channel（飞书、WebSocket、未来扩展）提供公共基础设施。

#### 文件结构

```
src/channels/core/
├── gateway.ts                  # Channel Gateway 主控
├── channelAdapter.ts           # Channel 适配器接口
├── sessionRouter.ts            # 会话路由
├── messageQueue.ts             # 跨 Channel 消息队列
├── healthMonitor.ts            # Channel 健康监控
└── types.ts                    # 公共类型
```

#### 3.2.1 Channel 适配器接口（channelAdapter.ts）

```typescript
interface ChannelAdapter {
  readonly name: string
  readonly capabilities: ChannelCapabilities

  // 生命周期
  start(): Promise<void>
  stop(): Promise<void>
  isHealthy(): boolean

  // 消息收发
  sendMessage(sessionId: string, message: ChannelMessage): Promise<void>
  onMessage(callback: (message: InboundMessage) => void): void

  // 权限中继
  sendPermissionRequest(sessionId: string, request: PermissionRequest): Promise<void>
  onPermissionResponse(callback: (response: PermissionResponse) => void): void

  // 会话管理
  resolveSession(context: MessageContext): Promise<string>
}

interface ChannelCapabilities {
  inbound: boolean           // 能接收消息
  outbound: boolean          // 能发送消息
  permissionRelay: boolean   // 支持权限中继
  streaming: boolean         // 支持流式响应
  richContent: boolean       // 支持富文本/卡片
  mediaAttachment: boolean   // 支持媒体附件
  groupChat: boolean         // 支持群聊
}
```

#### 3.2.2 Gateway 主控（gateway.ts）

```typescript
class ChannelGateway {
  private adapters: Map<string, ChannelAdapter>
  private sessionRouter: SessionRouter

  // 注册 Channel
  registerAdapter(adapter: ChannelAdapter): void

  // 启动所有 Channel
  async start(): Promise<void>

  // 消息路由：Channel → OpenClaude
  // 入站消息 → sessionRouter 解析会话 → 注入 MCP channel 通知
  routeInbound(message: InboundMessage): void

  // 消息路由：OpenClaude → Channel
  // 出站消息 → 根据 session 元数据找到目标 Channel → adapter.sendMessage
  routeOutbound(sessionId: string, message: ChannelMessage): void
}
```

### 3.3 模块三：飞书卡片模板库（Canvas2UI 核心）

**路径**：`src/channels/feishu/templates/`

预定义的飞书卡片模板，实现 Canvas2UI 的各种交互场景：

```
src/channels/feishu/templates/
├── textResponse.ts             # 文本响应（流式更新）
├── codeBlock.ts                # 代码块（语法高亮）
├── fileEdit.ts                 # 文件编辑预览（diff 视图）
├── approvalRequest.ts          # 权限审批请求
├── taskProgress.ts             # 任务进度追踪
├── searchResults.ts            # 搜索结果列表
├── commandOutput.ts            # 命令执行输出
├── errorReport.ts              # 错误报告
├── sessionInfo.ts              # 会话信息卡片
└── streamingCard.ts            # 流式响应容器（动态更新）
```

**Canvas2UI 交互场景**：

| 场景 | 卡片类型 | 交互能力 |
|------|----------|----------|
| AI 文本回复 | 流式文本卡片 | 实时更新内容 |
| 代码生成 | 代码块卡片 | 复制代码、应用文件 |
| 文件编辑 | Diff 预览卡片 | 确认/拒绝修改 |
| 权限审批 | 审批卡片 | 允许/拒绝按钮 |
| 任务进度 | 进度卡片 | 取消/暂停按钮 |
| 搜索结果 | 列表卡片 | 点击查看详情 |
| 命令执行 | 终端输出卡片 | 重新执行按钮 |
| 错误报告 | 错误卡片 | 重试/忽略按钮 |

### 3.4 模块四：CLI 命令与配置

**路径**：修改现有文件

#### 3.4.1 新增 CLI 命令

```
/feishu              # 启动飞书 Channel 连接
/feishu status       # 查看飞书连接状态
/feishu config       # 配置飞书应用凭证
/channel list        # 列出所有活跃 Channel
/channel start <name># 启动指定 Channel
/channel stop <name> # 停止指定 Channel
```

#### 3.4.2 配置文件扩展

在 `settings.json` 或 `.claude/config.json` 中添加：

```json
{
  "channels": {
    "feishu": {
      "enabled": true,
      "appId": "${FEISHU_APP_ID}",
      "appSecret": "${FEISHU_APP_SECRET}",
      "verificationToken": "${FEISHU_VERIFICATION_TOKEN}",
      "encryptKey": "${FEISHU_ENCRYPT_KEY}",
      "transport": "websocket",
      "sessionMode": "per_user",
      "groupTrigger": "mention",
      "allowedUsers": [],
      "allowedGroups": []
    }
  }
}
```

#### 3.4.3 命令行参数

```
--channels feishu                              # 启用飞书 Channel
--feishu-app-id <id>                           # 飞书应用 ID
--feishu-app-secret <secret>                   # 飞书应用 Secret
--feishu-transport websocket|webhook           # 传输模式
--feishu-session-mode per_user|per_chat|per_thread  # 会话模式
```

### 3.5 模块五：OpenClaw WebSocket 兼容层

**路径**：`src/channels/websocket/`

实现与 OpenClaw WebSocket 协议兼容的 Channel 适配器，使 OpenClaude 也能作为 OpenClaw Gateway 的后端。

```
src/channels/websocket/
├── index.ts                    # WebSocket Channel 入口
├── server.ts                   # WebSocket 服务器
├── protocol.ts                 # OpenClaw 消息协议实现
├── sessionManager.ts           # WebSocket 会话管理
└── types.ts                    # 类型定义
```

协议兼容 `@taichi-labs/openclaw-websocket`：
- `chat.send` → 入站消息
- `chat.typing` / `chat.stream` / `chat.complete` → 出站流式响应
- `chat.error` → 错误通知

---

## 四、实施步骤

### Phase 1：基础设施搭建（优先级：高）

#### Step 1.1：创建 Channel 核心抽象层
- 创建 `src/channels/core/` 目录
- 实现 `ChannelAdapter` 接口
- 实现 `ChannelGateway` 主控
- 实现 `SessionRouter` 会话路由
- 实现 `MessageQueue` 跨 Channel 消息队列

#### Step 1.2：扩展 MCP Channel 协议支持
- 在现有 `channelNotification.ts` 中添加对飞书 Channel 的识别
- 扩展 `ChannelEntry` 类型支持 `feishu` kind
- 添加飞书相关的 meta 属性规范（`chat_id`, `user_id`, `message_id`, `chat_type`）

#### Step 1.3：创建飞书 Channel 配置系统
- 在 `settings.json` schema 中添加 `channels.feishu` 配置
- 添加 CLI 参数 `--channels feishu`
- 实现飞书应用凭证的安全存储

### Phase 2：飞书 Channel MCP 服务器（优先级：高）

#### Step 2.1：实现飞书 MCP 服务器骨架
- 创建 `src/channels/feishu/server.ts`
- 声明 `claude/channel` 和 `claude/channel/permission` 能力
- 实现标准 MCP 工具（`send_feishu_message`, `send_feishu_card`, `update_feishu_card`）
- 注册为 `type: 'stdio'` MCP 服务器

#### Step 2.2：实现飞书传输层
- 实现 `FeishuWebSocketTransport`（长连接模式，推荐）
- 实现 `FeishuWebhookTransport`（Webhook 模式）
- 处理飞书事件：`im.message.receive_v1`（消息接收）
- 处理飞书回调：`card.action.trigger`（卡片交互）

#### Step 2.3：实现会话管理
- 实现 `FeishuSessionManager`
- 支持三种会话模式：`per_user` / `per_chat` / `per_thread`
- 飞书 `chat_id` → OpenClaude `session_id` 映射
- 会话超时与自动归档

#### Step 2.4：实现入站消息处理
- 飞书消息 → `notifications/claude/channel` 通知
- 消息格式转换（飞书富文本 → 纯文本 + meta）
- 媒体附件处理（图片、文件下载与转存）
- 群聊 @机器人 触发逻辑

### Phase 3：Canvas2UI 飞书卡片系统（优先级：高）

#### Step 3.1：实现卡片构建器
- 创建 `FeishuCardBuilder`
- 实现基础卡片模板：文本响应、代码块、错误报告
- 实现流式卡片：首次发送 → 动态更新 → 最终完成

#### Step 3.2：实现 AI 响应 → 飞书卡片转换
- 文本响应 → 流式文本卡片（实时更新）
- 代码生成 → 代码块卡片（语法高亮 + 复制按钮）
- 文件编辑 → Diff 预览卡片（确认/拒绝按钮）
- 工具调用 → 任务进度卡片

#### Step 3.3：实现权限审批卡片
- `permission_request` → 飞书审批卡片
- 卡片按钮回调 → `permission` 通知
- 支持批量审批（多个权限请求合并为一张卡片）

#### Step 3.4：实现高级交互卡片
- 搜索结果列表卡片（点击查看详情）
- 命令执行输出卡片（重新执行按钮）
- 会话信息卡片（模型切换、会话管理）
- 多步骤表单卡片（复杂参数输入）

### Phase 4：OpenClaw WebSocket 兼容（优先级：中）

#### Step 4.1：实现 WebSocket Channel 服务器
- 创建 `src/channels/websocket/server.ts`
- 兼容 `@taichi-labs/openclaw-websocket` 协议
- 支持 `chat.send` / `chat.stream` / `chat.complete` 消息类型

#### Step 4.2：实现 WebSocket 会话管理
- `senderId` → OpenClaude `session_id` 映射
- 支持直接消息和群聊
- 独立会话记忆

### Phase 5：CLI 集成与用户体验（优先级：中）

#### Step 5.1：添加 CLI 命令
- `/feishu` 命令族
- `/channel` 命令族
- Channel 状态显示（在 REPL 状态栏）

#### Step 5.2：添加 Channel 启动流程
- `useChannelGateway` React Hook
- Channel 连接状态管理
- Channel 启动提示（类似 `ChannelsNotice.tsx`）

#### Step 5.3：添加飞书应用配置向导
- 交互式配置流程
- 飞书应用创建指引
- 凭证验证与测试

### Phase 6：安全与生产化（优先级：中）

#### Step 6.1：安全加固
- 飞书 Channel 白名单机制
- 用户/群组访问控制
- 消息内容安全过滤
- 敏感信息脱敏

#### Step 6.2：错误处理与恢复
- 飞书 API 限流处理
- WebSocket 断线重连
- 消息去重与幂等
- 崩溃恢复

#### Step 6.3：监控与日志
- Channel 健康监控
- 消息投递追踪
- 性能指标收集
- 调试日志

---

## 五、关键技术决策

### 5.1 为什么选择 MCP 服务器方式实现？

**优势**：
- 完全复用现有 Channel 协议和门控体系
- 无需修改核心引擎代码
- 天然支持权限审批中继
- 与现有 MCP 生态系统兼容
- 可作为插件分发

**替代方案**：
- 直接修改 Bridge 系统 → 耦合度高，维护困难
- 独立网关进程 → 需要额外部署，用户体验差
- SDK 嵌入式 → 缺少 Channel 协议支持

### 5.2 为什么飞书卡片作为 Canvas2UI 载体？

**优势**：
- 飞书卡片原生支持交互组件（按钮、输入框、选择器）
- 支持回调协议（`card.action.trigger`），实现双向交互
- 支持动态更新（`PATCH /messages/{id}`），实现流式响应
- 无需额外开发客户端，飞书原生渲染
- 支持图表组件，实现数据可视化

**替代方案**：
- 云文档小组件 → 需要用户手动创建文档，交互流程复杂
- 小程序 → 开发成本高，需要审核
- H5 页面 → 需要额外前端开发

### 5.3 为什么 WebSocket 长连接优先于 Webhook？

**优势**：
- 无需公网 IP，适合本地开发
- 连接更稳定，减少网络延迟
- 飞书 SDK 内置支持
- 与 OpenClaude 的本地优先理念一致

**Webhook 适用场景**：
- 生产部署（有公网服务器）
- 需要高可用的场景
- 多实例部署

### 5.4 会话隔离策略

| 模式 | 适用场景 | 会话粒度 |
|------|----------|----------|
| `per_user` | 个人助手 | 每个飞书用户独立会话 |
| `per_chat` | 群组助手 | 每个飞书会话独立会话 |
| `per_thread` | 话题助手 | 每个话题独立会话（飞书话题功能） |

默认推荐 `per_user`（单聊）+ `per_chat`（群聊）混合模式。

---

## 六、依赖项

### 6.1 新增 npm 依赖

| 包名 | 用途 | 大小 |
|------|------|------|
| `@larksuiteoapi/node-sdk` | 飞书开放平台官方 SDK | ~500KB |
| `ws` | WebSocket 服务器（已有） | - |
| `express` | Webhook HTTP 服务器（已有） | - |

### 6.2 飞书开放平台要求

- 创建企业自建应用
- 开启机器人能力
- 申请权限：`im:message`、`im:message:send_as_bot`、`im:resource`
- 配置事件订阅：`im.message.receive_v1`
- 配置卡片回调：`card.action.trigger`

---

## 七、测试策略

### 7.1 单元测试
- `FeishuCardBuilder` 卡片构建测试
- `FeishuSessionManager` 会话管理测试
- `FeishuPermissionRelay` 权限中继测试
- 消息格式转换测试

### 7.2 集成测试
- 飞书 WebSocket 连接测试（使用飞书沙箱环境）
- 消息收发端到端测试
- 卡片交互回调测试
- 权限审批流程测试

### 7.3 手动测试场景
1. 单聊发送消息 → AI 回复 → 流式卡片更新
2. 群聊 @机器人 → AI 回复
3. 权限审批 → 飞书卡片按钮 → 审批结果
4. 代码生成 → 代码块卡片 → 复制代码
5. 文件编辑 → Diff 卡片 → 确认/拒绝
6. 断线重连 → 消息不丢失

---

## 八、风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 飞书 API 限流 | 消息发送失败 | 实现请求队列 + 指数退避 + 消息合并 |
| 飞书卡片更新延迟 | 流式体验差 | 使用多消息分段策略 + 缓冲更新 |
| MCP Channel 门控阻断 | 飞书 Channel 无法注册 | 提供 `--dangerously-load-development-channels` 开发模式 |
| 会话状态丢失 | 上下文断裂 | 持久化会话映射 + 崩溃恢复 |
| 飞书应用审核 | 无法使用 | 提供详细配置指南 + 企业自建应用无需审核 |
