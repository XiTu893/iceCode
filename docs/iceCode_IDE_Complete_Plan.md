# OpenClaude IDE 完整建设方案

## 📋 目录
1. [项目概述](#项目概述)
2. [核心架构决策](#核心架构决策)
3. [技术栈选型](#技术栈选型)
4. [系统架构设计](#系统架构设计)
5. [组件复用策略](#组件复用策略)
6. [实施路线图](#实施路线图)
7. [关键技术实现](#关键技术实现)
8. [风险与应对](#风险与应对)
9. [预期成果](#预期成果)

---

## 项目概述

### 目标
基于claude code系统，创建一个对标Trae界面的桌面IDE应用，实现：
- **左侧面板**：AI对话交互区域（聊天、上下文管理、模型选择）
- **中间面板**：代码编辑器和内容跟随区域（Monaco Editor）
- **右侧面板**：文件浏览器和项目结构（文件树、Git状态）
- **设置中心**：API配置、Skill管理、MCP服务器、Rules规则等

### 核心价值
1. **本地优先**：完全离线可用，数据隐私保护
2. **高性能**：gRPC长连接，低延迟实时响应
3. **可扩展**：预留云端同步接口（Bridge可选集成）
4. **生态兼容**：复用OpenClaude现有工具和模型支持

---

## 核心架构决策

### ✅ 决策1：Electron桌面应用（非Web模式）

**理由**：
- 参考VSCode成熟架构
- 原生文件系统访问能力
- 更好的性能和用户体验
- 支持系统级集成（菜单、快捷键、通知）

**架构**：
```
┌─────────────────────────────────────┐
│     Electron Application            │
│                                     │
│  ┌──────────┐      ┌─────────────┐ │
│  │ Renderer │ IPC  │ Main Process│ │
│  │  (UI)    │◄────►│             │ │
│  └──────────┘      └──────┬──────┘ │
│                           │         │
│                    ┌──────▼──────┐  │
│                    │ gRPC Server │  │
│                    │ (localhost) │  │
│                    └─────────────┘  │
└─────────────────────────────────────┘
```

### ✅ 决策2：使用gRPC而非CLI集成后端

**对比分析**：

| 维度 | CLI | gRPC |
|------|-----|------|
| 通信效率 | ❌ 每次启动新进程 | ✅ 长连接，低延迟 |
| 实时流式 | ❌ 需解析ANSI输出 | ✅ 原生双向流 |
| 会话管理 | ❌ 无状态 | ✅ 支持session_id持久化 |
| 权限交互 | ❌ TTY复杂处理 | ✅ ActionRequired消息 |
| 工具监控 | ❌ 不可靠 | ✅ 结构化事件 |
| 中断控制 | ❌ SIGINT信号 | ✅ CancelSignal优雅中断 |
| 多会话 | ❌ 困难 | ✅ 内置支持（1000会话） |
| 现有实现 | - | ✅ 已有完整服务器 |

**结论**：gRPC是唯一合理选择，已有成熟实现（`src/grpc/server.ts`）

### ✅ 决策3：Ink组件不直接复用，但业务逻辑高度复用

**可复用部分（80%+）**：
- ✅ Hooks（useApiKeyVerification, useHistorySearch等）
- ✅ Utils工具函数（messages.ts, format.ts等）
- ✅ TypeScript类型定义（message.ts, ids.ts等）
- ✅ State管理逻辑（AppState.ts）
- ✅ API调用逻辑

**需要适配部分（50%）**：
- ⚠️ 组件业务逻辑层（提取纯逻辑）
- ⚠️ 主题配置（改写渲染方式）

**需要重写部分（0%）**：
- ❌ Ink UI组件（Box, Text等终端专用）
- ❌ ANSI渲染逻辑
- ❌ ScrollBox等终端组件

**策略**：创建DOM版本的轻量级UI组件库，保持API一致性

### ✅ 决策4：Bridge作为可选增强，初期不使用

**分阶段策略**：

**阶段1（MVP）**：
- 仅使用gRPC
- 完全本地运行
- 无需网络依赖
- 快速上线

**阶段2（增强）**：
- 可选集成Bridge
- 云同步功能
- 跨设备协作
- 类似VSCode Settings Sync

**架构设计**：
```typescript
interface SessionBackend {
  chat(message: string): AsyncIterable<Response>;
  saveSession(): void;
}

class LocalGrpcBackend implements SessionBackend { ... }
class CloudBridgeBackend implements SessionBackend { ... }

// 用户可切换
const backend = config.useCloud 
  ? new CloudBridgeBackend() 
  : new LocalGrpcBackend();
```

---

## 技术栈选型

### 核心框架
- **桌面框架**：Electron 28+（参考VSCode版本）
- **前端框架**：React 19 + TypeScript 5.9
- **构建工具**：Vite 5 + Electron Builder
- **包管理器**：Bun（与主项目一致）

### UI和编辑器
- **代码编辑器**：@monaco-editor/react（VSCode同款）
- **UI组件库**：自研轻量级DOM组件（类Ink API）
- **虚拟列表**：react-virtualized（性能优化）
- **图标**：@vscode/codicons（保持一致性）

### 通信和数据
- **IPC通信**：Electron contextBridge
- **后端通信**：gRPC (@grpc/grpc-js + @grpc/proto-loader)
- **状态管理**：Zustand（轻量级，扩展AppState）
- **数据持久化**：electron-store

### 其他关键依赖
- **终端**：xterm.js（内置终端功能）
- **文件监听**：chokidar（已有依赖）
- **Git集成**：simple-git
- **搜索**：@vscode/ripgrep（已有依赖）

---

## 系统架构设计

### 整体架构

```
openclaude-ide/
├── package.json
├── electron-builder.yml
├── main/                    # Electron主进程
│   ├── main.ts             # 入口文件
│   ├── window-manager.ts   # 窗口管理
│   ├── ipc-handlers.ts     # IPC处理器
│   ├── grpc-manager.ts     # gRPC服务器管理
│   ├── file-system.ts      # 文件系统操作
│   └── menu-template.ts    # 应用菜单
│
├── preload/                # 预加载脚本
│   └── preload.ts          # 安全的API桥接
│
├── renderer/               # 渲染进程（UI）
│   ├── index.html
│   ├── vite.config.ts
│   └── src/
│       ├── main.tsx        # React入口
│       ├── App.tsx         # 根组件
│       ├── components/
│       │   ├── layout/
│       │   │   ├── IDELayout.tsx      # 三栏布局
│       │   │   ├── PanelSplitter.tsx  # 面板分割器
│       │   │   └── TitleBar.tsx       # 自定义标题栏
│       │   │
│       │   ├── settings/              # 设置中心（对标Trae）
│       │   │   ├── SettingsPanel.tsx          # 设置主面板
│       │   │   ├── SettingsSidebar.tsx        # 设置导航侧边栏
│       │   │   ├── sections/
│       │   │   │   ├── ApiConfig.tsx          # API配置
│       │   │   │   ├── SkillManager.tsx       # Skill管理
│       │   │   │   ├── McpManager.tsx         # MCP服务器管理
│       │   │   │   ├── RulesManager.tsx       # Rules规则管理
│       │   │   │   ├── AgentsManager.tsx      # Agents代理管理
│       │   │   │   ├── GeneralSettings.tsx    # 通用设置
│       │   │   │   └── ConfigFiles.tsx        # 配置文件管理
│       │   │   ├── editors/
│       │   │   │   ├── MarkdownEditor.tsx     # Markdown编辑器
│       │   │   │   ├── JsonEditor.tsx         # JSON编辑器
│       │   │   │   └── CodeEditor.tsx         # 代码编辑器
│       │   │   ├── wizards/
│       │   │   │   ├── CreateSkillWizard.tsx  # 创建Skill向导
│       │   │   │   ├── CreateRuleWizard.tsx   # 创建Rule向导
│       │   │   │   ├── AddMcpWizard.tsx       # 添加MCP向导
│       │   │   │   └── CreateAgentWizard.tsx  # 创建Agent向导
│       │   │   └── utils/
│       │   │       ├── configValidator.ts     # 配置验证
│       │   │       ├── fileWatcher.ts         # 文件监听
│       │   │       └── traedir.ts             # .trae目录操作
│       │   │
│       │   ├── chat/
│       │   │   ├── ChatPanel.tsx      # 左侧对话面板
│       │   │   ├── MessageList.tsx    # 消息列表
│       │   │   ├── PromptInput.tsx    # 输入框
│       │   │   └── ModelSelector.tsx  # 模型选择
│       │   │
│       │   ├── editor/
│       │   │   ├── EditorPanel.tsx    # 中间编辑面板
│       │   │   ├── MonacoWrapper.tsx  # Monaco封装
│       │   │   ├── TabBar.tsx         # 标签栏
│       │   │   └── Breadcrumb.tsx     # 面包屑导航
│       │   │
│       │   ├── explorer/
│       │   │   ├── ExplorerPanel.tsx  # 右侧文件浏览器
│       │   │   ├── FileTree.tsx       # 文件树
│       │   │   ├── GitStatus.tsx      # Git状态
│       │   │   └── SearchBox.tsx      # 搜索框
│       │   │
│       │   └── ui/         # 通用UI组件
│       │       ├── Box.tsx             # 布局组件
│       │       ├── Text.tsx            # 文本组件
│       │       ├── Button.tsx          # 按钮
│       │       └── Spinner.tsx         # 加载动画
│       │
│       ├── hooks/
│       │   ├── useGrpcClient.ts        # gRPC客户端Hook
│       │   ├── useFileSystem.ts        # 文件系统Hook
│       │   ├── useChatSession.ts       # 对话会话Hook
│       │   └── useEditorState.ts       # 编辑器状态Hook
│       │
│       ├── services/
│       │   ├── grpc-client.ts          # gRPC客户端封装
│       │   ├── file-service.ts         # 文件服务
│       │   └── session-service.ts      # 会话服务
│       │
│       ├── store/
│       │   ├── ideStore.ts             # IDE状态管理
│       │   └── slices/
│       │       ├── chatSlice.ts
│       │       ├── editorSlice.ts
│       │       └── explorerSlice.ts
│       │
│       ├── utils/
│       │   ├── ipc-bridge.ts           # IPC通信封装
│       │   └── theme-manager.ts        # 主题管理
│       │
│       └── styles/
│           ├── global.css
│           ├── themes/
│           │   ├── dark.css
│           │   └── light.css
│           └── components/
│
└── shared/                 # 共享类型和工具
    ├── types/
    │   └── ide-types.ts
    └── constants/
        └── ipc-channels.ts
```

### 进程通信架构

```
┌──────────────────────────────────────────────┐
│              Renderer Process                 │
│                                               │
│  React Components                             │
│       ↓                                       │
│  Custom Hooks (useGrpcClient, etc.)          │
│       ↓                                       │
│  IPC Bridge (window.api.xxx)                 │
└──────────────────┬───────────────────────────┘
                   │ contextBridge
┌──────────────────▼───────────────────────────┐
│              Preload Script                   │
│  - exposeInMainWorld('api', {...})           │
│  - 安全的API暴露                              │
└──────────────────┬───────────────────────────┘
                   │ IPC (invoke/handle)
┌──────────────────▼───────────────────────────┐
│              Main Process                     │
│                                               │
│  IPC Handlers                                 │
│  ├─ file operations (read, write, watch)     │
│  ├─ system APIs (dialog, shell)              │
│  └─ gRPC Manager                              │
│       └─ gRPC Server (localhost:50051)       │
│            └─ QueryEngine + Tools            │
└──────────────────────────────────────────────┘
```

### gRPC通信流程

```typescript
// 1. 主进程启动gRPC服务器
// main/grpc-manager.ts
const grpcServer = new GrpcServer();
grpcServer.start(50051, '127.0.0.1');

// 2. 渲染进程创建gRPC客户端
// renderer/services/grpc-client.ts
const client = new AgentServiceClient(
  '127.0.0.1:50051',
  grpc.credentials.createInsecure()
);

// 3. 发起对话请求
const stream = client.Chat();
stream.write({
  request: {
    message: "帮我创建一个React组件",
    working_directory: "/path/to/project",
    session_id: "unique-session-id",
    model: "claude-3.5-sonnet"
  }
});

// 4. 接收流式响应
stream.on('data', (message: ServerMessage) => {
  if (message.text_chunk) {
    // 实时更新UI显示AI回复
    updateChatUI(message.text_chunk.text);
  }
  else if (message.tool_start) {
    // 显示工具调用开始
    showToolCall(message.tool_start);
  }
  else if (message.action_required) {
    // 弹出权限请求对话框
    showPermissionDialog(message.action_required);
  }
});
```

---

## 组件复用策略

### 复用清单

#### ✅ 完全复用（无需修改）

**Hooks（约30+个）**：
```typescript
src/hooks/useApiKeyVerification.ts
src/hooks/useHistorySearch.ts
src/hooks/usePromptSuggestion.ts
src/hooks/useTerminalSize.ts → 改为useWindowSize
src/hooks/useInputBuffer.ts
// ... 等等
```

**Utils（约50+个）**：
```typescript
src/utils/messages.ts          // 消息处理逻辑
src/utils/format.ts            // 格式化函数
src/utils/fileStateCache.ts    // 文件缓存
src/utils/groupToolUses.ts     // 工具调用分组
src/utils/transcriptSearch.ts  // 搜索逻辑
// ... 等等
```

**TypeScript类型**：
```typescript
src/types/message.ts           // 消息类型定义
src/types/ids.ts               // ID类型
src/Tool.ts                    // 工具接口
src/state/AppState.ts          // 状态类型
```

**Services**：
```typescript
src/services/api/*.ts          // API调用
src/services/mcp/*.ts          // MCP客户端
src/services/analytics/*.ts    // 分析（可选）
```

#### ⚠️ 适配复用（需要改造）

**主题系统**：
```typescript
// 原Ink版本
src/components/design-system/color.ts
src/components/design-system/ThemeProvider.tsx

// 改造为DOM版本
renderer/src/styles/theme-manager.ts
renderer/src/styles/themes/dark.css
renderer/src/styles/themes/light.css
```

**组件逻辑层**：
```typescript
// 从Messages.tsx提取纯逻辑
src/utils/messageRenderer.ts    // 消息渲染逻辑
src/utils/promptProcessor.ts    // 提示词处理

// 在IDE中重新实现UI
renderer/src/components/chat/MessageList.tsx
renderer/src/components/chat/PromptInput.tsx
```

#### ❌ 不复用（重新实现）

**Ink UI组件**：
```typescript
src/ink/components/Box.tsx      → 使用HTML div + CSS Flexbox
src/ink/components/Text.tsx     → 使用HTML span + CSS
src/ink/components/ScrollBox.tsx→ 使用react-virtualized
```

**终端特定功能**：
```typescript
src/ink/root.ts                 // 自定义reconciler
src/ink/render-node-to-output.ts// ANSI渲染
```

### 新建DOM组件库

创建轻量级UI组件，保持与Ink相似的API：

```typescript
// renderer/src/components/ui/Box.tsx
interface BoxProps {
  flexDirection?: 'row' | 'column';
  flexGrow?: number;
  flexShrink?: number;
  padding?: number | string;
  margin?: number | string;
  width?: string | number;
  height?: string | number;
  onClick?: () => void;
  children: React.ReactNode;
}

export function Box({ 
  flexDirection = 'row',
  flexGrow = 0,
  // ... 其他props
  children 
}: BoxProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection,
      flexGrow,
      // ... 其他样式
    }}>
      {children}
    </div>
  );
}

// 使用方式与Ink类似
<Box flexDirection="column" padding={2}>
  <Text color="blue">Hello</Text>
</Box>
```

---

## 实施路线图

### 阶段1：基础架构搭建（2周）

**Week 1：项目初始化**
- [ ] 创建`ide/`目录结构
- [ ] 配置Electron + Vite + TypeScript
- [ ] 设置package.json和依赖
- [ ] 配置Electron Builder
- [ ] 实现主进程骨架（main.ts）
- [ ] 实现预加载脚本（preload.ts）
- [ ] 创建渲染进程入口（index.html + main.tsx）

**Week 2：核心基础设施**
- [ ] 实现IPC通信框架
- [ ] 集成gRPC服务器到主进程
- [ ] 创建gRPC客户端封装
- [ ] 实现窗口管理器
- [ ] 配置安全策略（contextIsolation）
- [ ] 实现基础状态管理（Zustand store）
- [ ] 设置主题系统骨架

**交付物**：
- 可运行的Electron空壳应用
- gRPC通信链路打通
- 基础项目结构

### 阶段2：核心功能开发（4周）

**Week 3-4：左侧对话面板**
- [ ] 创建ChatPanel组件
- [ ] 实现MessageList组件
  - [ ] 复用消息处理逻辑
  - [ ] 实现DOM版本的消息渲染
  - [ ] 支持流式更新
- [ ] 实现PromptInput组件
  - [ ] 输入框UI
  - [ ] 快捷键支持
  - [ ] 历史记录导航
  - [ ] @提及功能
- [ ] 实现ModelSelector组件
  - [ ] 模型列表展示
  - [ ] 快速切换模型
  - [ ] 显示模型能力和限制
- [ ] 集成gRPC聊天流
  - [ ] 发送消息
  - [ ] 接收文本块
  - [ ] 处理工具调用事件
  - [ ] 处理权限请求
- [ ] 实现会话管理
  - [ ] 创建/加载会话
  - [ ] 会话历史列表
  - [ ] 会话持久化
- [ ] 实现Settings入口
  - [ ] 设置按钮和菜单
  - [ ] 快速访问常用设置

**Week 5-6：中间编辑面板**
- [ ] 集成Monaco Editor
  - [ ] 安装@monaco-editor/react
  - [ ] 创建MonacoWrapper组件
  - [ ] 配置语言支持
  - [ ] 配置主题
- [ ] 实现TabBar组件
  - [ ] 多标签页管理
  - [ ] 标签页切换
  - [ ] 标签页关闭
- [ ] 实现文件加载和保存
  - [ ] 通过IPC读取文件
  - [ ] 文件修改跟踪
  - [ ] 自动保存
  - [ ] 保存确认对话框
- [ ] 实现Breadcrumb导航
- [ ] AI跟随功能
  - [ ] 解析AI提到的文件路径
  - [ ] 自动打开相关文件
  - [ ] 高亮相关代码行
- [ ] 代码补全集成（可选）
  - [ ] 接入OpenClaude建议
  - [ ] 自定义completion provider

**交付物**：
- 完整的对话功能
- 功能完备的代码编辑器
- AI与编辑器联动

### 阶段3：文件系统和增强功能（3周）

**Week 7-8：右侧文件浏览器**
- [ ] 创建ExplorerPanel组件
- [ ] 实现FileTree组件
  - [ ] 递归渲染文件树
  - [ ] 展开/折叠文件夹
  - [ ] 文件图标显示
  - [ ] 虚拟滚动（大目录优化）
- [ ] 实现文件操作
  - [ ] 新建文件/文件夹
  - [ ] 删除文件/文件夹
  - [ ] 重命名
  - [ ] 拖拽移动
- [ ] 集成Git状态显示
  - [ ] 使用simple-git
  - [ ] 显示文件状态徽章
  - [ ] Git diff查看（可选）
- [ ] 实现SearchBox
  - [ ] 文件名搜索
  - [ ] 使用ripgrep全文搜索
  - [ ] 搜索结果展示

**Week 9-10：设置中心（对标Trae）**
- [ ] 创建设置面板框架
  - [ ] SettingsPanel主组件
  - [ ] 侧边栏导航菜单
  - [ ] 设置项通用组件
  - [ ] 配置保存和验证
- [ ] API配置管理
  - [ ] Provider配置界面（OpenAI、Anthropic、Ollama等）
  - [ ] API Key安全存储（使用electron-safe-storage）
  - [ ] 模型选择和测试连接
  - [ ] 默认模型设置
  - [ ] 多Provider切换
- [ ] Skill管理系统
  - [ ] Skill列表展示（项目级+用户级）
  - [ ] Skill创建向导（UI方式）
  - [ ] Skill编辑器（SKILL.md）
  - [ ] Skill启用/禁用开关
  - [ ] Skill导入（从社区/skills.sh）
  - [ ] Skill测试和调试
- [ ] MCP服务器管理
  - [ ] MCP服务器列表
  - [ ] 添加MCP服务器（STDIO/HTTP/SSE）
  - [ ] MCP配置编辑器（JSON格式）
  - [ ] 服务器状态监控（运行/停止/错误）
  - [ ] 查看MCP日志
  - [ ] 启动/停止/重启服务器
  - [ ] 工具列表展示（每个MCP提供的tools）
- [ ] Rules规则管理
  - [ ] Rules列表（user_rules + project_rules）
  - [ ] Rule创建向导
  - [ ] Rule编辑器（Markdown）
  - [ ] 按路径生效的规则配置
  - [ ] Rule启用/禁用
  - [ ] Rule优先级调整
- [ ] Agents代理管理
  - [ ] Agents列表展示
  - [ ] Agent创建向导
  - [ ] Agent配置（name、description、tools、model）
  - [ ] Agent系统提示词编辑
  - [ ] Agent测试运行
- [ ] 通用设置
  - [ ] 主题设置（深色/浅色/自动）
  - [ ] 字体大小和家族
  - [ ] 语言设置（中文/英文）
  - [ ] 快捷键自定义
  - [ ] 自动保存配置
  - [ ] 工作区设置（.trae/settings.json）
  - [ ] 本地覆盖设置（settings.local.json）
- [ ] 配置文件管理
  - [ ] .trae目录结构展示
  - [ ] 配置文件版本控制提示
  - [ ] Git忽略文件管理
  - [ ] 配置导入/导出
  - [ ] 配置备份和恢复

**Week 11：面板交互和优化**
- [ ] 实现PanelSplitter组件
  - [ ] 可拖动调整宽度
  - [ ] 最小/最大宽度限制
  - [ ] 双击重置
  - [ ] 状态持久化
- [ ] 实现TitleBar
  - [ ] 自定义窗口控制
  - [ ] 显示当前项目路径
  - [ ] 窗口最大化/最小化/关闭
- [ ] 添加键盘快捷键
  - [ ] Ctrl/Cmd + P：快速打开文件
  - [ ] Ctrl/Cmd + Shift + F：全局搜索
  - [ ] Ctrl/Cmd + B：切换侧边栏
  - [ ] 与VSCode兼容
- [ ] 实现Command Palette（可选）
  - [ ] 命令搜索和执行
  - [ ] 类似VSCode的命令面板

**交付物**：
- 完整的文件浏览器
- 可调节的三栏布局
- 完善的快捷键系统

### 阶段4：高级功能和优化（3周）

**Week 10：内置终端（可选）**
- [ ] 集成xterm.js
- [ ] 创建TerminalPanel组件
- [ ] 实现PTY后端（node-pty）
- [ ] 终端与AI集成
  - [ ] AI执行命令显示
  - [ ] 终端输出反馈给AI

**Week 11：性能优化**
- [ ] 虚拟列表优化（大消息列表）
- [ ] Monaco懒加载
- [ ] 文件树懒加载
- [ ] 内存泄漏检测
- [ ] 渲染性能分析
- [ ] IPC通信优化

**Week 12：测试和打磨**
- [ ] 编写单元测试
  - [ ] 组件测试
  - [ ] Hook测试
  - [ ] Service测试
- [ ] 集成测试
  - [ ] gRPC通信测试
  - [ ] 文件操作测试
  - [ ] 会话管理测试
- [ ] 用户体验优化
  - [ ] 加载状态优化
  - [ ] 错误处理完善
  - [ ] 动画和过渡效果
- [ ] 跨平台测试
  - [ ] Windows测试
  - [ ] macOS测试
  - [ ] Linux测试（可选）

**交付物**：
- 稳定可用的IDE应用
- 完善的测试覆盖
- 良好的性能表现

### 阶段5：打包和发布（1周）

**Week 13：打包部署**
- [ ] 配置Electron Builder
  - [ ] Windows安装包（.exe）
  - [ ] macOS安装包（.dmg）
  - [ ] Linux安装包（.AppImage）
- [ ] 实现自动更新机制
  - [ ] 使用electron-updater
  - [ ] 更新检查
  - [ ] 下载和安装
- [ ] 编写文档
  - [ ] 安装指南
  - [ ] 使用手册
  - [ ] 常见问题
- [ ] 更新主项目
  - [ ] 添加IDE启动脚本
  - [ ] 更新README
- [ ] 发布首个版本

**交付物**：
- 各平台安装包
- 完整文档
- 正式发布v0.1.0

---

## 关键技术实现

### 1. gRPC客户端封装

```typescript
// renderer/src/services/grpc-client.ts
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { EventEmitter } from 'events';

class GrpcChatClient extends EventEmitter {
  private client: any;
  private stream: any = null;
  private sessionId: string;

  constructor(port: number) {
    super();
    const packageDefinition = protoLoader.loadSync(
      path.join(__dirname, '../../proto/openclaude.proto'),
      { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true }
    );
    const protoDescriptor = grpc.loadPackageDefinition(packageDefinition) as any;
    
    this.client = new protoDescriptor.openclaude.v1.AgentService(
      `127.0.0.1:${port}`,
      grpc.credentials.createInsecure()
    );
    this.sessionId = randomUUID();
  }

  async chat(message: string, workingDir: string, model?: string) {
    if (this.stream) {
      this.stream.cancel();
    }

    this.stream = this.client.Chat();
    
    // 监听响应
    this.stream.on('data', (serverMessage: any) => {
      if (serverMessage.text_chunk) {
        this.emit('textChunk', serverMessage.text_chunk.text);
      }
      else if (serverMessage.tool_start) {
        this.emit('toolStart', serverMessage.tool_start);
      }
      else if (serverMessage.tool_result) {
        this.emit('toolResult', serverMessage.tool_result);
      }
      else if (serverMessage.action_required) {
        this.emit('actionRequired', serverMessage.action_required);
      }
      else if (serverMessage.done) {
        this.emit('done', serverMessage.done);
        this.stream = null;
      }
      else if (serverMessage.error) {
        this.emit('error', serverMessage.error);
        this.stream = null;
      }
    });

    this.stream.on('error', (err: Error) => {
      this.emit('error', err);
      this.stream = null;
    });

    // 发送请求
    this.stream.write({
      request: {
        message,
        working_directory: workingDir,
        session_id: this.sessionId,
        model
      }
    });
  }

  respondToAction(promptId: string, reply: string) {
    if (this.stream) {
      this.stream.write({
        input: {
          prompt_id: promptId,
          reply
        }
      });
    }
  }

  cancel() {
    if (this.stream) {
      this.stream.write({ cancel: { reason: 'user_cancelled' } });
      this.stream.cancel();
      this.stream = null;
    }
  }
}

export default GrpcChatClient;
```

### 2. 文件系统IPC通信

```typescript
// main/ipc-handlers.ts
import { ipcMain, dialog } from 'electron';
import { promises as fs } from 'fs';
import chokidar from 'chokidar';

export function registerFileHandlers() {
  // 读取文件
  ipcMain.handle('file:read', async (_, filePath: string) => {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return { success: true, content };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // 写入文件
  ipcMain.handle('file:write', async (_, filePath: string, content: string) => {
    try {
      await fs.writeFile(filePath, content, 'utf-8');
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // 监听文件变化
  let watcher: chokidar.FSWatcher | null = null;
  
  ipcMain.handle('file:watch', (_, dirPath: string) => {
    if (watcher) {
      watcher.close();
    }
    
    watcher = chokidar.watch(dirPath, {
      ignored: /node_modules|\.git/,
      persistent: true
    });

    watcher.on('change', (path) => {
      mainWindow.webContents.send('file:changed', path);
    });

    watcher.on('unlink', (path) => {
      mainWindow.webContents.send('file:deleted', path);
    });

    return { success: true };
  });

  // 获取目录结构
  ipcMain.handle('file:listDir', async (_, dirPath: string) => {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      const result = await Promise.all(
        entries.map(async (entry) => {
          const fullPath = path.join(dirPath, entry.name);
          return {
            name: entry.name,
            path: fullPath,
            isDirectory: entry.isDirectory(),
            size: entry.isFile() ? (await fs.stat(fullPath)).size : 0
          };
        })
      );
      return { success: true, entries: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
}
```

### 3. 三栏布局实现

```tsx
// renderer/src/components/layout/IDELayout.tsx
import { useState, useCallback } from 'react';
import { Box } from '../ui/Box';
import { ChatPanel } from '../chat/ChatPanel';
import { EditorPanel } from '../editor/EditorPanel';
import { ExplorerPanel } from '../explorer/ExplorerPanel';
import { PanelSplitter } from './PanelSplitter';

export function IDELayout() {
  const [leftWidth, setLeftWidth] = useState(350);
  const [rightWidth, setRightWidth] = useState(280);

  const handleLeftResize = useCallback((newWidth: number) => {
    setLeftWidth(Math.min(Math.max(newWidth, 250), 600));
  }, []);

  const handleRightResize = useCallback((newWidth: number) => {
    setRightWidth(Math.min(Math.max(newWidth, 200), 500));
  }, []);

  return (
    <Box flexDirection="row" width="100vw" height="100vh" overflow="hidden">
      {/* 左侧对话面板 */}
      <Box width={leftWidth} height="100%" flexShrink={0}>
        <ChatPanel />
      </Box>

      {/* 左侧分割器 */}
      <PanelSplitter 
        onResize={handleLeftResize} 
        initialWidth={leftWidth}
      />

      {/* 中间编辑面板 */}
      <Box flexGrow={1} height="100%" overflow="hidden">
        <EditorPanel />
      </Box>

      {/* 右侧分割器 */}
      <PanelSplitter 
        onResize={handleRightResize} 
        initialWidth={rightWidth}
        reverse
      />

      {/* 右侧文件浏览器 */}
      <Box width={rightWidth} height="100%" flexShrink={0}>
        <ExplorerPanel />
      </Box>
    </Box>
  );
}
```

### 4. 面板分割器实现

```tsx
// renderer/src/components/layout/PanelSplitter.tsx
import { useState, useCallback, useEffect } from 'react';

interface PanelSplitterProps {
  onResize: (width: number) => void;
  initialWidth: number;
  reverse?: boolean;
}

export function PanelSplitter({ onResize, initialWidth, reverse = false }: PanelSplitterProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = reverse 
        ? window.innerWidth - e.clientX 
        : e.clientX;
      onResize(newWidth);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, onResize, reverse]);

  return (
    <div
      onMouseDown={handleMouseDown}
      onDoubleClick={() => onResize(reverse ? 280 : 350)}
      style={{
        width: '4px',
        cursor: 'col-resize',
        backgroundColor: isDragging ? '#007acc' : 'transparent',
        transition: 'background-color 0.2s',
        zIndex: 100
      }}
      className="panel-splitter"
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(128, 128, 128, 0.3)',
          opacity: isDragging ? 1 : 0
        }}
      />
    </div>
  );
}
```

### 5. Monaco Editor集成

```tsx
// renderer/src/components/editor/MonacoWrapper.tsx
import { useEffect, useRef } from 'react';
import * as monaco from 'monaco-editor';
import { useTheme } from '../../hooks/useTheme';

interface MonacoWrapperProps {
  filePath: string;
  content: string;
  onChange: (content: string) => void;
  language?: string;
}

export function MonacoWrapper({ 
  filePath, 
  content, 
  onChange, 
  language = 'plaintext' 
}: MonacoWrapperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const theme = useTheme();

  useEffect(() => {
    if (!containerRef.current) return;

    // 创建编辑器
    const editor = monaco.editor.create(containerRef.current, {
      value: content,
      language,
      theme: theme === 'dark' ? 'vs-dark' : 'vs',
      automaticLayout: true,
      minimap: { enabled: true },
      scrollBeyondLastLine: false,
      fontSize: 14,
      fontFamily: 'Consolas, "Courier New", monospace',
      lineNumbers: 'on',
      renderWhitespace: 'selection',
      bracketPairColorization: { enabled: true },
      guides: { bracketPairs: true }
    });

    editorRef.current = editor;

    // 监听内容变化
    editor.onDidChangeModelContent(() => {
      onChange(editor.getValue());
    });

    return () => {
      editor.dispose();
    };
  }, []);

  // 当文件或语言变化时，更新编辑器
  useEffect(() => {
    if (!editorRef.current) return;
    
    const model = editorRef.current.getModel();
    if (model) {
      monaco.editor.setModelLanguage(model, language);
    }
  }, [language]);

  // 当主题变化时，更新主题
  useEffect(() => {
    if (!editorRef.current) return;
    monaco.editor.setTheme(theme === 'dark' ? 'vs-dark' : 'vs');
  }, [theme]);

  return (
    <div 
      ref={containerRef} 
      style={{ width: '100%', height: '100%' }}
    />
  );
}
```

### 6. 设置中心 - MCP服务器管理

```typescript
// renderer/src/components/settings/sections/McpManager.tsx
import { useState, useEffect } from 'react';
import { Box } from '../../ui/Box';
import { Button } from '../../ui/Button';
import { JsonEditor } from '../editors/JsonEditor';
import { useSettingsStore } from '../../../store/settingsStore';

interface McpServer {
  name: string;
  command?: string;
  args?: string[];
  url?: string;
  type: 'stdio' | 'http' | 'sse';
  status: 'running' | 'stopped' | 'error';
  tools?: Array<{ name: string; description: string }>;
}

export function McpManager() {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [selectedServer, setSelectedServer] = useState<string | null>(null);
  const { loadMcpConfig, saveMcpConfig, getMcpLogs } = useSettingsStore();

  useEffect(() => {
    // 加载 .trae/mcp.json
    loadMcpConfig().then(setServers);
  }, []);

  const handleAddServer = async (config: McpServer) => {
    const updated = [...servers, config];
    await saveMcpConfig(updated);
    setServers(updated);
  };

  const handleStartServer = async (name: string) => {
    // 通过IPC调用主进程启动MCP服务器
    const result = await window.api.mcp.start(name);
    if (result.success) {
      setServers(servers.map(s => 
        s.name === name ? { ...s, status: 'running' } : s
      ));
    }
  };

  const handleViewLogs = async (name: string) => {
    const logs = await getMcpLogs(name);
    // 显示日志对话框
  };

  return (
    <Box flexDirection="row" height="100%">
      {/* 左侧服务器列表 */}
      <Box width="300px" borderRight="1px solid #ccc">
        <Box padding={2} borderBottom="1px solid #ccc">
          <Button onClick={() => showAddDialog()}>+ 添加MCP服务器</Button>
        </Box>
        <Box flexDirection="column">
          {servers.map(server => (
            <Box
              key={server.name}
              padding={2}
              onClick={() => setSelectedServer(server.name)}
              backgroundColor={selectedServer === server.name ? '#e0e0e0' : 'transparent'}
            >
              <Box flexDirection="row" justifyContent="space-between">
                <span>{server.name}</span>
                <StatusBadge status={server.status} />
              </Box>
              <Box flexDirection="row" gap={1} marginTop={1}>
                <Button size="small" onClick={() => handleStartServer(server.name)}>
                  {server.status === 'running' ? '重启' : '启动'}
                </Button>
                <Button size="small" onClick={() => handleViewLogs(server.name)}>
                  查看日志
                </Button>
              </Box>
            </Box>
          ))}
        </Box>
      </Box>

      {/* 右侧配置编辑器 */}
      <Box flexGrow={1} flexDirection="column">
        {selectedServer ? (
          <>
            <Box padding={2} borderBottom="1px solid #ccc">
              <h3>{selectedServer} 配置</h3>
            </Box>
            <Box flexGrow={1}>
              <JsonEditor
                value={servers.find(s => s.name === selectedServer)}
                onChange={(newConfig) => {
                  const updated = servers.map(s =>
                    s.name === selectedServer ? newConfig : s
                  );
                  setServers(updated);
                  saveMcpConfig(updated);
                }}
              />
            </Box>
          </>
        ) : (
          <Box justifyContent="center" alignItems="center" flexGrow={1}>
            <p>选择一个MCP服务器以编辑配置</p>
          </Box>
        )}
      </Box>
    </Box>
  );
}
```

### 7. 设置中心 - Skill管理

```typescript
// renderer/src/components/settings/sections/SkillManager.tsx
import { useState, useEffect } from 'react';
import { Box } from '../../ui/Box';
import { Button } from '../../ui/Button';
import { MarkdownEditor } from '../editors/MarkdownEditor';
import { useSettingsStore } from '../../../store/settingsStore';

interface Skill {
  name: string;
  description: string;
  path: string;
  scope: 'project' | 'user';
  enabled: boolean;
  content: string; // SKILL.md 内容
}

export function SkillManager() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const { loadSkills, saveSkill, deleteSkill, importFromCommunity } = useSettingsStore();

  useEffect(() => {
    // 加载项目级和用户级 Skills
    loadSkills().then(setSkills);
  }, []);

  const handleCreateSkill = async () => {
    // 显示创建向导
    const newSkill = await showCreateWizard();
    if (newSkill) {
      await saveSkill(newSkill);
      setSkills([...skills, newSkill]);
    }
  };

  const handleImportSkill = async () => {
    // 从 skills.sh 导入
    const skillName = await promptForSkillName();
    const imported = await importFromCommunity(skillName);
    if (imported) {
      setSkills([...skills, imported]);
    }
  };

  const handleSaveSkill = async (name: string, content: string) => {
    await saveSkill({ ...skills.find(s => s.name === name)!, content });
  };

  return (
    <Box flexDirection="row" height="100%">
      {/* 左侧Skill列表 */}
      <Box width="300px" borderRight="1px solid #ccc">
        <Box padding={2} borderBottom="1px solid #ccc" flexDirection="row" gap={1}>
          <Button onClick={handleCreateSkill}>+ 创建Skill</Button>
          <Button onClick={handleImportSkill}>导入</Button>
        </Box>
        <Box flexDirection="column">
          {skills.map(skill => (
            <Box
              key={skill.name}
              padding={2}
              onClick={() => setSelectedSkill(skill.name)}
              backgroundColor={selectedSkill === skill.name ? '#e0e0e0' : 'transparent'}
            >
              <Box flexDirection="row" justifyContent="space-between">
                <span>{skill.name}</span>
                <ToggleSwitch
                  checked={skill.enabled}
                  onChange={(checked) => {
                    const updated = skills.map(s =>
                      s.name === skill.name ? { ...s, enabled: checked } : s
                    );
                    setSkills(updated);
                    saveSkill(updated.find(s => s.name === skill.name)!);
                  }}
                />
              </Box>
              <p style={{ fontSize: '12px', color: '#666' }}>
                {skill.description}
              </p>
              <span style={{ fontSize: '10px', color: '#999' }}>
                {skill.scope === 'project' ? '项目级' : '用户级'}
              </span>
            </Box>
          ))}
        </Box>
      </Box>

      {/* 右侧Skill编辑器 */}
      <Box flexGrow={1} flexDirection="column">
        {selectedSkill ? (
          <>
            <Box padding={2} borderBottom="1px solid #ccc">
              <h3>{selectedSkill}</h3>
            </Box>
            <Box flexGrow={1}>
              <MarkdownEditor
                value={skills.find(s => s.name === selectedSkill)?.content || ''}
                onChange={(content) => handleSaveSkill(selectedSkill, content)}
              />
            </Box>
          </>
        ) : (
          <Box justifyContent="center" alignItems="center" flexGrow={1}>
            <p>选择一个Skill以编辑</p>
          </Box>
        )}
      </Box>
    </Box>
  );
}
```

### 8. 设置中心 - API配置管理

```typescript
// renderer/src/components/settings/sections/ApiConfig.tsx
import { useState, useEffect } from 'react';
import { Box } from '../../ui/Box';
import { Button } from '../../ui/Button';
import { Select } from '../../ui/Select';
import { Input } from '../../ui/Input';
import { useSettingsStore } from '../../../store/settingsStore';

interface Provider {
  id: string;
  name: string;
  apiKey: string;
  baseUrl?: string;
  models: string[];
  defaultModel: string;
  enabled: boolean;
}

export function ApiConfig() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const { loadProviders, saveProvider, testConnection } = useSettingsStore();

  useEffect(() => {
    loadProviders().then(setProviders);
  }, []);

  const handleSaveApiKey = async (providerId: string, apiKey: string) => {
    // 使用 electron-safe-storage 安全存储
    await window.api.secureStorage.set(`api_key_${providerId}`, apiKey);
    const updated = providers.map(p =>
      p.id === providerId ? { ...p, apiKey: '****' } : p
    );
    setProviders(updated);
  };

  const handleTestConnection = async (providerId: string) => {
    const result = await testConnection(providerId);
    if (result.success) {
      showNotification('连接成功', 'success');
    } else {
      showNotification(`连接失败: ${result.error}`, 'error');
    }
  };

  return (
    <Box flexDirection="column" padding={3}>
      <h2>API配置</h2>
      
      {providers.map(provider => (
        <Box
          key={provider.id}
          padding={2}
          marginBottom={2}
          border="1px solid #ddd"
          borderRadius={4}
        >
          <Box flexDirection="row" justifyContent="space-between" marginBottom={2}>
            <h3>{provider.name}</h3>
            <ToggleSwitch
              checked={provider.enabled}
              onChange={(checked) => {
                const updated = providers.map(p =>
                  p.id === provider.id ? { ...p, enabled: checked } : p
                );
                setProviders(updated);
                saveProvider(updated.find(p => p.id === provider.id)!);
              }}
            />
          </Box>

          <Box flexDirection="column" gap={2}>
            {/* API Key输入 */}
            <Box>
              <label>API Key</label>
              <Input
                type="password"
                placeholder="输入API Key"
                onBlur={(e) => handleSaveApiKey(provider.id, e.target.value)}
              />
            </Box>

            {/* Base URL（可选） */}
            {provider.baseUrl !== undefined && (
              <Box>
                <label>Base URL</label>
                <Input
                  value={provider.baseUrl}
                  onChange={(e) => {
                    const updated = providers.map(p =>
                      p.id === provider.id ? { ...p, baseUrl: e.target.value } : p
                    );
                    setProviders(updated);
                  }}
                />
              </Box>
            )}

            {/* 模型选择 */}
            <Box>
              <label>默认模型</label>
              <Select
                value={provider.defaultModel}
                options={provider.models.map(m => ({ label: m, value: m }))}
                onChange={(value) => {
                  const updated = providers.map(p =>
                    p.id === provider.id ? { ...p, defaultModel: value } : p
                  );
                  setProviders(updated);
                  saveProvider(updated.find(p => p.id === provider.id)!);
                }}
              />
            </Box>

            {/* 测试连接按钮 */}
            <Box>
              <Button onClick={() => handleTestConnection(provider.id)}>
                测试连接
              </Button>
            </Box>
          </Box>
        </Box>
      ))}

      <Button onClick={addNewProvider}>+ 添加Provider</Button>
    </Box>
  );
}
```

---

## 风险与应对

### 技术风险

| 风险 | 影响 | 概率 | 应对措施 |
|------|------|------|---------|
| gRPC通信不稳定 | 高 | 中 | 实现重试机制、错误边界、降级方案 |
| Monaco性能问题 | 中 | 低 | 懒加载、虚拟滚动、大文件警告 |
| 内存泄漏 | 高 | 中 | 定期profiling、严格cleanup、weak references |
| 跨平台兼容性 | 中 | 中 | 早期多平台测试、条件编译 |
| Electron安全漏洞 | 高 | 低 | 遵循最佳实践、定期更新、安全审计 |

### 项目风险

| 风险 | 影响 | 概率 | 应对措施 |
|------|------|------|---------|
| 范围蔓延 | 高 | 高 | 严格MVP定义、分阶段交付 |
| 时间估算偏差 | 中 | 高 | 缓冲时间、优先级排序 |
| 依赖冲突 | 中 | 中 | 锁定版本、定期更新测试 |
| 用户需求变化 | 高 | 中 | 灵活架构、可配置功能 |

### 缓解策略

1. **渐进式开发**：严格按阶段推进，每阶段有明确交付物
2. **持续测试**：单元测试 + 集成测试 + 手动测试
3. **性能监控**：集成性能分析工具，及早发现问题
4. **文档同步**：代码和文档同步更新，降低维护成本
5. **社区反馈**：早期发布beta版本，收集用户反馈

---

## 预期成果

### 功能清单

#### MVP版本（v0.1.0）

**核心功能**：
- ✅ 三栏布局（可调节宽度）
- ✅ AI对话（流式响应、上下文管理、模型选择）
- ✅ 代码编辑（Monaco Editor、多标签页）
- ✅ 文件浏览（文件树、基本操作）
- ✅ 会话管理（创建、保存、加载）
- ✅ 主题切换（深色/浅色）
- ✅ 快捷键支持

**设置中心（对标Trae）**：
- ✅ API配置管理（Provider、API Key、模型选择）
- ✅ Skill管理系统（创建、编辑、导入、启用/禁用）
- ✅ MCP服务器管理（添加、启动/停止、日志查看、工具列表）
- ✅ Rules规则管理（user_rules、project_rules、按路径生效）
- ✅ Agents代理管理（创建、配置、测试运行）
- ✅ 通用设置（主题、字体、语言、快捷键）
- ✅ 配置文件管理（.trae目录、导入/导出、备份恢复）

**技术特性**：
- ✅ 完全本地运行
- ✅ gRPC高效通信
- ✅ 跨平台支持（Win/macOS/Linux）
- ✅ 离线可用
- ✅ 安全存储（API Key使用electron-safe-storage）

#### 未来版本规划

**v0.2.0（增强版）**：
- 内置终端（xterm.js）
- Git集成（状态显示、diff查看）
- 全局搜索（ripgrep）
- Command Palette
- 扩展系统基础框架

**v0.3.0（协作版）**：
- Bridge集成（可选）
- 云端会话同步
- 跨设备继续工作
- 团队共享会话

**v1.0.0（正式版）**：
- 完整的扩展生态系统
- 插件市场
- 企业级功能
- 完善的文档和社区

### 成功指标

**技术指标**：
- 启动时间 < 3秒
- 消息响应延迟 < 100ms
- 内存占用 < 500MB（典型场景）
- CPU占用 < 30%（空闲时）

**用户体验指标**：
- 用户满意度 > 4.5/5
- 日活跃用户增长率 > 10%/月
- 崩溃率 < 0.1%
- 平均会话时长 > 30分钟

**业务指标**：
- GitHub Stars > 1000（3个月内）
- 月下载量 > 5000
- 社区贡献者 > 20
-  Issue响应时间 < 24小时

---

## 总结

本方案提供了一个完整的OpenClaude IDE建设蓝图，核心要点：

1. **架构清晰**：Electron + gRPC，参考VSCode成熟模式
2. **技术可行**：充分利用现有OpenClaude能力，避免重复造轮子
3. **渐进实施**：分5个阶段14周完成，风险可控
4. **高度复用**：80%+业务逻辑可直接复用，专注UI适配
5. **可扩展性**：预留Bridge接口，支持未来云端功能
6. **对标Trae**：完整的设置中心（API、Skill、MCP、Rules、Agents）

### 关键特性对比

| 功能模块 | Trae | OpenClaude IDE |
|---------|------|----------------|
| 三栏布局 | ✅ | ✅ |
| AI对话 | ✅ | ✅ (gRPC流式) |
| 代码编辑 | ✅ | ✅ (Monaco) |
| 文件浏览 | ✅ | ✅ |
| API配置 | ✅ | ✅ (多Provider) |
| Skill管理 | ✅ | ✅ (项目/用户级) |
| MCP服务器 | ✅ | ✅ (STDIO/HTTP/SSE) |
| Rules规则 | ✅ | ✅ (按路径生效) |
| Agents代理 | ✅ | ✅ (独立上下文) |
| 离线可用 | ❌ | ✅ |
| 本地优先 | ❌ | ✅ |
| 开源免费 | ❌ | ✅ |

**下一步行动**：
1. 确认方案并获得批准
2. 组建开发团队（2-3人）
3. 开始阶段1：基础架构搭建
4. 每周进度review和调整

预计**14周**后可发布v0.1.0版本，为用户提供对标Trae且完全本地化的优质AI编程体验。
