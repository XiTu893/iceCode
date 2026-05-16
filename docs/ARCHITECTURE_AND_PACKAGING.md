# IceCode IDE - 完整架构与打包设计文档

## 📋 目录

1. [项目概述](#项目概述)
2. [系统架构](#系统架构)
3. [gRPC通信模式](#grpc通信模式)
4. [便携打包方案](#便携打包方案)
5. [构建流程](#构建流程)
6. [部署与使用](#部署与使用)
7. [技术细节](#技术细节)
8. [故障排查](#故障排查)

---

## 项目概述

### 什么是IceCode IDE？

IceCode IDE是一个基于Electron的桌面AI编程助手，提供类似Trae/VSCode的用户体验，集成了完整的AI推理能力。

### 核心特性

✅ **零依赖便携运行** - 无需安装Node.js、Bun或任何环境  
✅ **完整AI能力** - 支持多模型提供商（OpenAI、Anthropic等）  
✅ **工具执行** - 文件操作、Git命令、终端执行  
✅ **实时流式响应** - gRPC双向流通信  
✅ **会话管理** - 持久化聊天历史  
✅ **现代化UI** - React 19 + TailwindCSS + Monaco Editor  

### 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| **前端框架** | Electron 42 + React 19 | 桌面应用容器和UI框架 |
| **构建工具** | Vite 8 + TypeScript | 前端打包和类型检查 |
| **编辑器** | Monaco Editor 0.55 | VSCode同款代码编辑器 |
| **样式系统** | TailwindCSS 4.3 | 原子化CSS框架 |
| **后端运行时** | Bun 1.3.13 (便携) | JavaScript/TypeScript运行时 |
| **通信协议** | gRPC (@grpc/grpc-js) | 前后端双向流通信 |
| **AI引擎** | QueryEngine | 核心AI推理引擎 |
| **打包工具** | electron-builder 26.8 | 应用打包和分发 |

---

## 系统架构

### 整体架构图

```
┌─────────────────────────────────────────────────────────────┐
│                    IceCode IDE Application                   │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────┐         IPC          ┌──────────────┐  │
│  │  Renderer Process │ ◄─────────────────► │ Main Process │  │
│  │  (React UI)       │                     │ (Electron)   │  │
│  │                   │                     │              │  │
│  │ • AppLayout       │                     │ • Window Mgmt│  │
│  │ • Monaco Editor   │                     │ • IPC Router │  │
│  │ • Chat Interface  │                     │ • gRPC Client│  │
│  │ • Settings Panel  │                     │ • Backend    │  │
│  │ • Activity Bar    │                     │   Spawner    │  │
│  └──────────────────┘                     └──────┬───────┘  │
│                                                  │           │
│                                                  │ Spawn     │
│                                                  ▼           │
│                                         ┌──────────────────┐ │
│                                         │  Backend Process  │ │
│                                         │  (Bun Runtime)    │ │
│                                         │                   │ │
│                                         │ • gRPC Server    │ │
│                                         │ • QueryEngine    │ │
│                                         │ • Tool Executor  │ │
│                                         │ • Session Mgr    │ │
│                                         └────────┬─────────┘ │
│                                                  │            │
└──────────────────────────────────────────────────┼────────────┘
                                                   │ gRPC Stream
                                                   │ localhost:50051
                                                   ▼
                                          ┌──────────────────┐
                                          │  AI Provider API  │
                                          │  (Cloud Service)  │
                                          └──────────────────┘
```

### 进程模型

#### 1. Renderer Process (渲染进程)
- **职责**: 用户界面渲染和用户交互
- **技术**: React 19 + TypeScript
- **入口**: `ide/electron/renderer.tsx`
- **关键组件**:
  - `AppLayout.tsx` - 四区域布局（ActivityBar、Sidebar、EditorArea、BottomPanel）
  - `ChatPanel.tsx` - AI对话界面
  - `MonacoWrapper.tsx` - 代码编辑器
  - `SettingsCenter.tsx` - 设置中心

#### 2. Main Process (主进程)
- **职责**: 窗口管理、IPC路由、后端进程管理、gRPC客户端
- **技术**: Electron + Node.js
- **入口**: `ide/electron/main.ts`
- **关键服务**:
  - `GrpcClientMain.ts` - gRPC客户端（主进程中运行）
  - `fileOperations.ts` - 文件操作IPC处理器
  - Backend spawner - 启动和管理后端进程

#### 3. Backend Process (后端进程)
- **职责**: AI推理、工具执行、会话管理
- **技术**: Bun + TypeScript
- **入口**: `scripts/start-grpc.ts` → `src/grpc/server.ts`
- **核心模块**:
  - `QueryEngine` - AI推理引擎（与CLI共享）
  - `GrpcServer` - gRPC服务器实现
  - Tool Executors - 各种工具执行器

---

## gRPC通信模式

### 为什么选择gRPC？

相比其他通信方式，gRPC具有以下优势：

| 对比维度 | gRPC | WebSocket | HTTP REST | Electron IPC |
|---------|------|-----------|-----------|--------------|
| **双向流** | ✅ 原生支持 | ✅ 支持 | ❌ 需轮询 | ⚠️ 单向 |
| **类型安全** | ✅ Proto定义 | ❌ 手动约定 | ⚠️ Swagger | ❌ 无 |
| **性能** | ✅ 二进制Protobuf | ⚠️ 文本JSON | ⚠️ 文本JSON | ✅ 高效 |
| **跨语言** | ✅ 多语言支持 | ✅ 通用 | ✅ 通用 | ❌ 仅JS |
| **复杂度** | 中等 | 低 | 低 | 低 |

### gRPC服务定义

**Proto文件**: `src/proto/IceCode.proto`

```protobuf
service AgentService {
  // 双向流式聊天
  rpc Chat(stream ClientMessage) returns (stream ServerMessage);
}

message ClientMessage {
  oneof message {
    ChatRequest request = 1;      // 初始请求
    UserInput input = 2;          // 用户输入（权限确认等）
    CancelRequest cancel = 3;     // 取消请求
  }
}

message ServerMessage {
  oneof message {
    TextChunk text_chunk = 1;           // 文本片段（流式）
    ToolStart tool_start = 2;           // 工具调用开始
    ToolResult tool_result = 3;         // 工具调用结果
    ActionRequired action_required = 4; // 需要用户操作
    Done done = 5;                      // 完成
    Error error = 6;                    // 错误
  }
}
```

### 通信流程

```
Renderer        Main Process      Backend (gRPC)      AI Provider
   │                  │                  │                  │
   │  grpc:chat       │                  │                  │
   ├─────────────────►│                  │                  │
   │                  │  Chat Request    │                  │
   │                  ├─────────────────►│                  │
   │                  │                  │  Query Submit    │
   │                  │                  ├─────────────────►│
   │                  │                  │                  │
   │                  │  text_chunk      │                  │
   │                  │◄─────────────────│                  │
   │ grpc:textChunk   │                  │                  │
   │◄─────────────────│                  │                  │
   │                  │                  │                  │
   │                  │  tool_start      │                  │
   │                  │◄─────────────────│                  │
   │ grpc:toolStart   │                  │                  │
   │◄─────────────────│                  │                  │
   │                  │                  │                  │
   │  respondAction   │                  │                  │
   ├─────────────────►│                  │                  │
   │                  │  UserInput       │                  │
   │                  ├─────────────────►│                  │
   │                  │                  │  Continue...     │
   │                  │                  ├─────────────────►│
   │                  │                  │                  │
   │                  │  done            │                  │
   │                  │◄─────────────────│                  │
   │ grpc:done        │                  │                  │
   │◄─────────────────│                  │                  │
```

### gRPC vs Bridge模式对比

| 特性 | gRPC模式 | Bridge模式 |
|------|---------|-----------|
| **AI推理位置** | 本地QueryEngine | 云端Claude.ai |
| **工具执行** | 本地执行所有工具 | 子进程代理执行 |
| **网络依赖** | 仅需AI API连接 | 需要持续网络连接 |
| **延迟** | 低（本地处理） | 高（云端往返） |
| **隐私性** | 高（代码不离本地） | 中（代码上传云端） |
| **离线能力** | 部分（UI可用） | 无 |
| **适用场景** | IDE集成、桌面应用 | 远程协作、多会话 |

**结论**: gRPC模式更适合IDE场景，提供更低延迟和更高隐私性。

---

## 便携打包方案

### 设计目标

1. **零依赖** - 用户无需安装任何运行时环境
2. **即插即用** - 解压即可运行
3. **完整功能** - 包含所有必要组件
4. **合理体积** - 控制在200-250MB以内

### 方案选择

我们选择了**便携Bun运行时方案**（方案A），原因如下：

| 方案 | 优点 | 缺点 | 选择 |
|------|------|------|------|
| **便携Bun** | • 无需编译<br>• TypeScript直接运行<br>• 动态导入正常工作 | • 增加~50MB体积 | ✅ **采用** |
| pkg/nexe编译 | • 单文件分发<br>• 体积小 | • 复杂依赖难处理<br>• 动态导入失败<br>• 调试困难 | ❌ 放弃 |
| 便携Node.js | • 生态成熟 | • 需要预编译TS<br>• 体积更大(~80MB) | ❌ 备选 |

### 包结构

```
IceCode IDE-win.zip
├── IceCode IDE.exe              # Electron可执行文件 (~150MB)
├── resources/
│   ├── app.asar                 # 前端打包文件 (~10MB)
│   └── app/
│       ├── electron/            # Electron主进程代码
│       │   ├── main.js
│       │   ├── preload.js
│       │   └── services/
│       │       └── GrpcClientMain.js
│       └── backend/             # 后端运行时 (~80MB)
│           ├── bun.exe          # 便携Bun运行时 (~50MB)
│           ├── src/             # 后端源代码
│           │   ├── grpc/
│           │   ├── QueryEngine.ts
│           │   └── ...
│           ├── scripts/         # 启动脚本
│           │   └── start-grpc.ts
│           ├── node_modules/    # 后端依赖 (~30MB)
│           ├── package.json
│           ├── tsconfig.json
│           └── bun.lock
└── locales/                     # 国际化文件
```

### 关键文件说明

#### 1. `ide/electron/main.ts` - 主进程入口

**核心功能**:
- 创建Electron窗口
- 启动后端进程（使用便携Bun）
- 设置IPC通信桥接
- 管理gRPC客户端

**关键代码片段**:

```typescript
// 检测并使用便携Bun
const portableBunPath = path.join(projectRoot, 'build', 'backend', 'bun.exe')

if (fs.existsSync(portableBunPath)) {
  bunPath = portableBunPath  // 使用便携版本
  console.log('[IceCode] Using portable Bun:', bunPath)
} else {
  bunPath = 'bun'  // 回退到系统Bun
  console.log('[IceCode] Using system Bun')
}

// 启动后端
openClaudeProcess = spawn(bunPath, ['run', backendScript], {
  cwd: projectRoot,
  env: {
    ...process.env,
    NODE_ENV: 'production',
    GRPC_PORT: '50051',
    GRPC_HOST: 'localhost'
  }
})
```

#### 2. `ide/electron/services/GrpcClientMain.ts` - gRPC客户端

**核心功能**:
- 建立gRPC连接到后端
- 处理双向流消息
- 转发事件到渲染进程

**关键方法**:
- `chat(request)` - 发起聊天请求
- `respondToAction(promptId, reply)` - 响应用户操作
- `cancel()` - 取消当前流
- `getSessionId()` - 获取会话ID

#### 3. `scripts/setup-portable-bun.ts` - 便携Bun设置脚本

**执行步骤**:
1. 下载Bun Windows x64 ZIP (~50MB)
2. 解压到 `ide/build/backend/`
3. 复制后端源代码 (`src/`, `scripts/`)
4. 复制依赖 (`node_modules/`)
5. 复制配置文件 (`package.json`, `tsconfig.json`)

#### 4. `ide/electron-builder.yml` - 打包配置

**关键配置**:

```yaml
win:
  target:
    - zip  # 生成便携ZIP包

extraResources:
  # 包含便携Bun和后端
  - from: build/backend
    to: backend
  # 包含源代码
  - from: ../src
    to: backend/src
  - from: ../scripts
    to: backend/scripts
```

---

## 构建流程

### 自动化构建脚本

**文件**: `scripts/build-portable-package.ts`

```bash
bun run scripts/build-portable-package.ts
```

**执行步骤**:

```
Step 1: 设置便携Bun运行时
  ├─ 下载 bun-windows-x64.zip
  ├─ 解压到 ide/build/backend/
  ├─ 复制 src/ 和 scripts/
  └─ 复制 node_modules/

Step 2: 安装IDE依赖
  └─ cd ide && bun install

Step 3: 构建前端
  ├─ Vite编译React应用
  └─ 输出到 ide/dist/

Step 4: 编译Electron主进程
  ├─ TypeScript编译
  └─ 输出到 ide/dist/electron/

Step 5: 打包
  ├─ electron-builder --win
  └─ 输出到 ide/release/IceCode IDE-win.zip

Step 6: 验证
  └─ 显示构建产物大小
```

### 手动构建步骤

如果需要分步执行：

```bash
# 1. 设置便携Bun
cd f:\project\AI\iceCode
bun run scripts/setup-portable-bun.ts

# 2. 进入IDE目录
cd ide

# 3. 安装依赖
bun install

# 4. 构建前端
bun run build

# 5. 编译Electron
bun run build:electron

# 6. 打包
bunx electron-builder --win --publish never
```

### 构建时间估算

| 步骤 | 时间 | 说明 |
|------|------|------|
| 下载Bun | 2-5分钟 | 取决于网速（~50MB） |
| 复制文件 | 1-2分钟 | robocopy大量文件 |
| 安装依赖 | 30秒-2分钟 | bun install |
| 构建前端 | 30秒-1分钟 | Vite编译 |
| 编译Electron | 10-30秒 | TypeScript编译 |
| 打包 | 1-3分钟 | electron-builder |
| **总计** | **5-12分钟** | 首次构建较慢 |

---

## 部署与使用

### 用户端使用

#### Windows用户

1. **下载** `IceCode IDE-win.zip`
2. **解压**到任意目录（如 `D:\Apps\IceCode`）
3. **运行** `IceCode IDE.exe`
4. **配置**API密钥（首次启动时）
5. **开始编码**！

#### 目录要求

- **不要**放在中文路径下（避免编码问题）
- **不要**放在系统保护目录（如 `C:\Program Files`）
- **推荐**放在非系统盘（如 `D:\` 或 `E:\`）

### 开发者端使用

#### 开发模式

```bash
# 启动前端开发服务器
cd ide
bun run dev

# 在另一个终端启动Electron
bun run electron:dev
```

#### 生产模式测试

```bash
# 完整构建
bun run scripts/build-portable-package.ts

# 测试生成的ZIP
cd ide/release
# 解压并运行 IceCode IDE.exe
```

### 更新策略

目前采用**手动更新**：

1. 下载新版本ZIP
2. 关闭旧版本
3. 替换文件夹
4. 重新启动

**注意**: 用户数据（设置、会话历史）保存在 `%APPDATA%\icecode-ide\`，不会被覆盖。

---

## 技术细节

### gRPC消息类型

#### 服务端 → 客户端

| 消息类型 | 字段 | 用途 |
|---------|------|------|
| `text_chunk` | `text: string` | AI响应文本片段（流式） |
| `tool_start` | `tool_name`, `arguments_json`, `tool_use_id` | 工具调用开始 |
| `tool_result` | `tool_name`, `output`, `is_error` | 工具执行结果 |
| `action_required` | `prompt_id`, `question`, `type` | 需要用户确认 |
| `done` | `full_text`, `prompt_tokens`, `completion_tokens` | 对话完成 |
| `error` | `message`, `code` | 错误信息 |

#### 客户端 → 服务端

| 消息类型 | 字段 | 用途 |
|---------|------|------|
| `request` | `message`, `working_directory`, `session_id` | 发起聊天 |
| `input` | `prompt_id`, `reply` | 响应用户操作 |
| `cancel` | `{}` | 取消当前流 |

### 会话管理

**会话ID生成**:
```typescript
sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
```

**会话持久化**:
- 存储在 `%APPDATA%\icecode-ide\sessions\`
- 格式: JSON文件
- 保留最近50个会话

### 工具权限控制

**流程**:
1. Backend检测到需要执行工具
2. 发送 `action_required` 消息到前端
3. 前端显示确认对话框
4. 用户点击"允许"或"拒绝"
5. 前端发送 `input` 消息回复
6. Backend根据回复执行或跳过工具

**示例**:
```typescript
// Backend (server.ts)
canUseTool: async (tool, input, context) => {
  // 通知前端
  call.write({
    action_required: {
      prompt_id: randomUUID(),
      question: `Approve ${tool.name}?`,
      type: 'CONFIRM_COMMAND'
    }
  })

  // 等待用户响应
  return new Promise((resolve) => {
    pendingRequests.set(promptId, (reply) => {
      if (reply.toLowerCase() === 'yes') {
        resolve({ behavior: 'allow' })
      } else {
        resolve({ behavior: 'deny', reason: 'User denied' })
      }
    })
  })
}
```

### 环境变量

**必需变量**:
- `ANTHROPIC_API_KEY` - Anthropic API密钥
- 或其他提供商的API密钥

**可选变量**:
- `GRPC_PORT` - gRPC端口（默认50051）
- `GRPC_HOST` - gRPC主机（默认localhost）
- `NODE_ENV` - 运行环境（development/production）

---

## 故障排查

### 常见问题

#### 1. 后端无法启动

**症状**: 启动后AI不响应

**排查步骤**:
```powershell
# 检查端口占用
netstat -ano | findstr :50051

# 如果有进程占用，杀死它
taskkill /F /PID <PID>

# 检查日志
# 查看Electron控制台输出
```

**可能原因**:
- 端口50051被占用
- Bun.exe损坏或缺失
- 后端依赖不完整

#### 2. gRPC连接失败

**症状**: 控制台显示 "Failed to connect to backend"

**解决方案**:
1. 确认后端已启动（查看日志）
2. 检查防火墙是否阻止localhost:50051
3. 重启应用

#### 3. 应用体积过大

**当前体积**: ~200MB

**组成**:
- Electron框架: ~150MB
- Bun运行时: ~50MB
- 后端依赖: ~30MB
- 前端资源: ~10MB

**优化建议**:
- 移除未使用的node_modules包
- 压缩ASAR文件
- 使用UPX压缩exe（可能影响启动速度）

#### 4. TypeScript编译错误

**常见错误**:
```
Property 'inline' does not exist on type '...'
```

**解决**: 添加类型注解 `: any` 或使用类型断言

#### 5. 打包失败

**错误**: `app-builder.exe process failed`

**可能原因**:
- 缺少图标文件
- 路径包含特殊字符
- 权限不足

**解决**:
```bash
# 清理并重新构建
rm -rf ide/dist ide/release
bun run scripts/build-portable-package.ts
```

### 日志位置

**Electron日志**:
- 开发模式: 控制台输出
- 生产模式: `%APPDATA%\icecode-ide\logs\`

**Backend日志**:
- 通过Electron主进程转发
- 查看Electron控制台 `[IceCode]` 前缀的日志

### 调试技巧

#### 启用详细日志

在 `ide/electron/main.ts` 中添加:
```typescript
process.env.DEBUG = '*'
```

#### 检查gRPC连接

在浏览器DevTools Console中:
```javascript
// 检查后端状态
window.electronAPI.invoke('grpc:getSessionId')
```

#### 测试后端独立运行

```bash
cd f:\project\AI\iceCode
bun run scripts/start-grpc.ts

# 应该看到:
# Starting OpenClaude gRPC Server...
# gRPC server started on localhost:50051
```

---

## 附录

### A. 文件清单

#### 核心源文件

| 文件路径 | 说明 | 行数 |
|---------|------|------|
| `ide/electron/main.ts` | Electron主进程 | ~450 |
| `ide/electron/services/GrpcClientMain.ts` | gRPC客户端 | ~250 |
| `ide/electron/preload.ts` | Preload脚本 | ~50 |
| `ide/electron/renderer.tsx` | React入口 | ~100 |
| `src/grpc/server.ts` | gRPC服务器 | ~250 |
| `src/QueryEngine.ts` | AI推理引擎 | ~800 |
| `scripts/start-grpc.ts` | 后端启动脚本 | ~50 |
| `scripts/setup-portable-bun.ts` | 便携Bun设置 | ~220 |
| `scripts/build-portable-package.ts` | 自动化构建 | ~100 |

#### 配置文件

| 文件路径 | 说明 |
|---------|------|
| `ide/package.json` | IDE依赖配置 |
| `ide/electron-builder.yml` | 打包配置 |
| `ide/tsconfig.electron.json` | Electron TS配置 |
| `ide/vite.config.ts` | Vite配置 |
| `ide/tailwind.config.js` | Tailwind配置 |
| `src/proto/IceCode.proto` | gRPC接口定义 |

### B. 依赖清单

#### IDE依赖 (ide/package.json)

```json
{
  "dependencies": {
    "@monaco-editor/react": "^4.7.0",
    "@vscode/codicons": "^0.0.45",
    "@grpc/grpc-js": "^1.14.3",
    "@grpc/proto-loader": "^0.8.1",
    "highlight.js": "^11.11.1",
    "monaco-editor": "^0.55.1",
    "react": "^19.2.6",
    "react-dom": "^19.2.6",
    "react-markdown": "^10.1.0",
    "remark-gfm": "^4.0.1"
  },
  "devDependencies": {
    "electron": "^42.0.1",
    "electron-builder": "^26.8.1",
    "typescript": "5.9.3",
    "vite": "^8.0.12",
    "tailwindcss": "^4.3.0"
  }
}
```

#### 后端依赖 (根目录package.json)

主要依赖包括:
- `@grpc/grpc-js` - gRPC实现
- `@anthropic-ai/sdk` - Anthropic API
- `openai` - OpenAI API
- 各种工具执行器依赖

### C. 版本历史

| 版本 | 日期 | 主要变更 |
|------|------|---------|
| 1.0.0 | 2026-05 | • 完成8周UI重构<br>• 实现gRPC通信<br>• 便携打包方案 |

### D. 参考资料

- [Electron文档](https://www.electronjs.org/docs)
- [gRPC Node.js](https://grpc.io/docs/languages/node/)
- [Bun官方](https://bun.sh/)
- [electron-builder](https://www.electron.build/)
- [Monaco Editor](https://microsoft.github.io/monaco-editor/)

---

## 总结

IceCode IDE通过以下创新实现了零依赖便携运行：

1. **便携Bun运行时** - 捆绑~50MB的bun.exe，避免系统依赖
2. **gRPC双向流** - 高效的前后端通信，支持实时AI响应
3. **智能进程管理** - Electron主进程自动检测和启动后端
4. **完整功能打包** - 包含所有源代码和依赖，开箱即用

**最终效果**: 用户只需下载ZIP、解压、运行，即可享受完整的AI编程助手体验，无需任何环境配置！

---

**文档版本**: 1.0  
**最后更新**: 2026-05-13  
**维护者**: IceCode Team
