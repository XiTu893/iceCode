# IceCode IDE 🚀

**Professional AI-Powered Development Environment**

IceCode is a feature-rich, open-source AI coding assistant with an integrated desktop IDE. Built to rival commercial solutions like Trae AI IDE, it combines powerful CLI capabilities with a modern Electron-based graphical interface.

[![PR Checks](https://github.com/XiTu893/iceIDE/actions/workflows/pr-checks.yml/badge.svg?branch=main)](https://github.com/XiTu893/iceIDE/actions/workflows/pr-checks.yml)
[![Release](https://img.shields.io/github/v/tag/XiTu893/iceIDE?label=release&color=0ea5e9)](https://github.com/XiTu893/iceIDE/tags)
[![Discussions](https://img.shields.io/badge/discussions-open-7c3aed)](https://github.com/XiTu893/iceIDE/discussions)
[![Security Policy](https://img.shields.io/badge/security-policy-0f766e)](SECURITY.md)
[![License](https://img.shields.io/badge/license-MIT-2563eb)](LICENSE)

Also mirrored to GitLawb: [gitlawb.com/node/repos/z6MkqDnb/icecode](https://gitlawb.com/node/repos/z6MkqDnb/icecode)

[Features](#-features) | [Quick Start](#-quick-start) | [Desktop IDE](#-desktop-ide) | [Providers](#-supported-providers) | [Documentation](#-documentation)

---

## ✨ Features

### 🎯 Core Capabilities

- **Multi-Provider Support**: OpenAI, Gemini, GitHub Models, Codex OAuth, Ollama, Atomic Chat, and more
- **Terminal-First Workflow**: Unified CLI for prompts, tools, agents, MCP, slash commands
- **Streaming Output**: Real-time token generation and tool execution progress
- **Tool-Driven Coding**: Bash, file operations, grep, glob, web search/fetch, MCP integration
- **Agent Routing**: Route different agents to different models for cost optimization

### 💻 Desktop IDE (Electron-Based)

#### Task & Status Management
- ✅ **Real-time Task Tracking**: Complete lifecycle management (pending → running → completed/failed)
- ✅ **Progress Visualization**: 0-100% progress bars with status indicators
- ✅ **Desktop Notifications**: Automatic alerts for task completion/failure
- ✅ **6 Task Types**: Code generation, file operations, tests, commands, gRPC requests, model inference

#### System Resource Monitoring
- ✅ **Live CPU Monitoring**: Real-time usage calculation with multi-core support
- ✅ **Memory Tracking**: Heap/RSS monitoring with percentage visualization
- ✅ **Network Status**: Connection state detection and monitoring
- ✅ **Color-Coded Alerts**: Green (<50%), Yellow (50-80%), Red (>80%) thresholds
- ✅ **1-Second Updates**: Configurable refresh intervals

#### AI Conversation Visualization
- ✅ **Thinking Process Display**: Step-by-step AI thought chain visualization
- ✅ **Tool Call Tracker**: Monitor Read/Write/Bash/Glob/Grep/WebFetch executions
- ✅ **Execution Time Estimation**: Predict task duration based on historical data
- ✅ **Expandable Details**: Click to view metadata and detailed information
- ✅ **Animated Status Indicators**: Visual feedback for pending/running/completed states

#### Enhanced User Experience
- ✅ **Keyboard Shortcuts**: 10+ predefined shortcuts (navigation, tasks, monitoring, editor)
- ✅ **Notification Center**: Centralized notification hub with filtering and actions
- ✅ **Skeleton Loading Screens**: Smooth loading animations for better UX
- ✅ **Cross-Platform Support**: Works on Windows, macOS, and Linux

#### Performance Optimization Suite
- ✅ **Performance Dashboard**: Real-time metrics visualization (render/memory/network/operation)
- ✅ **Smart Caching System**: LRU eviction, TTL expiration, size limits (file/model/search caches)
- ✅ **Optimization Utilities**: Debounce, throttle, batch processing, lazy loading
- ✅ **Memory Leak Detection**: Automatic detection with trend analysis
- ✅ **Virtual List Calculator**: Optimized rendering for long lists

### 🔧 Developer Tools

- **gRPC Server**: Headless service for CI/CD integration and custom UIs
- **Provider Profiles**: Saved configurations with guided setup (`/provider`)
- **GitHub Integration**: Interactive onboarding with `/onboard-github`
- **Web Search**: DuckDuckGo fallback + Firecrawl integration for reliable fetching
- **Image Support**: URL and base64 image inputs for vision-capable models

---

## 🚀 Quick Start

### Install CLI

```bash
npm install -g @xitu893/icecode
```

If you encounter `ripgrep not found`, install ripgrep system-wide:
```bash
# macOS
brew install ripgrep

# Ubuntu/Debian
sudo apt-get install ripgrep

# Windows (via Chocolatey)
choco install ripgrep
```

### Start CLI

```bash
icecode
```

Inside IceCode CLI:
- Run `/provider` for guided provider setup and saved profiles
- Run `/onboard-github` for GitHub Models onboarding

### Fastest OpenAI Setup

**macOS / Linux:**
```bash
export CLAUDE_CODE_USE_OPENAI=1
export OPENAI_API_KEY=sk-your-key-here
export OPENAI_MODEL=gpt-4o
icecode
```

**Windows PowerShell:**
```powershell
$env:CLAUDE_CODE_USE_OPENAI="1"
$env:OPENAI_API_KEY="sk-your-key-here"
$env:OPENAI_MODEL="gpt-4o"
icecode
```

### Local Ollama Setup

**macOS / Linux:**
```bash
export CLAUDE_CODE_USE_OPENAI=1
export OPENAI_BASE_URL=http://localhost:11434/v1
export OPENAI_MODEL=qwen2.5-coder:7b
icecode
```

**Using Ollama Launch Command:**
```bash
ollama launch openclaude --model qwen2.5-coder:7b
```

This automatically configures all settings for local Ollama inference.

---

## 💻 Desktop IDE

### Installation

The IceCode Desktop IDE is available as pre-built installers:

- **Windows**: `.exe` installer
- **macOS**: `.dmg` disk image
- **Linux**: `.AppImage` or `.deb` package

Download from [Releases](https://github.com/XiTu893/iceIDE/releases)

### Key Components

#### 1. Task Status Manager
Track all operations with complete lifecycle management:
```typescript
import { taskStatusManager } from './services/taskStatus/TaskStatusManager.js';

// Create and track a task
taskStatusManager.createTask('gen-001', 'code_generation', 'Generating API endpoints');
taskStatusManager.startTask('gen-001');
taskStatusManager.updateProgress('gen-001', 50, 'Writing route handlers');
taskStatusManager.completeTask('gen-001', 'API endpoints generated');
```

#### 2. Resource Monitor
Real-time system resource visualization:
```tsx
import { ResourceMonitor } from './components/ResourceMonitor.js';

<ResourceMonitor collapsed={false} />
```

Features:
- Live CPU/Memory/Network metrics
- Color-coded status indicators
- Collapsible panel design
- 1-second update interval

#### 3. Thinking Process Display
Visualize AI reasoning step-by-step:
```tsx
import { ThinkingProcess } from './components/ThinkingProcess.js';

<ThinkingProcess 
  steps={thinkingSteps} 
  maxVisibleSteps={10}
/>
```

Shows:
- Analysis steps
- File read/write operations
- Command executions
- Planning phases
- Completion status

#### 4. Performance Dashboard
Monitor application performance in real-time:
```tsx
import { PerformanceDashboard } from './components/PerformanceDashboard.js';

<PerformanceDashboard />
```

Metrics tracked:
- Render times
- Memory usage trends
- Network latency
- Operation durations
- Memory leak detection

#### 5. Smart Caching
Automatic caching for improved performance:
```typescript
import { fileContentCache, modelResponseCache } from './services/cache/SmartCache.js';

// File content caching (30s TTL)
const content = await fileContentCache.getOrSet(filePath, () => readFile(filePath));

// Model response caching (5min TTL)
const response = await modelResponseCache.getOrSet(prompt, () => callModel(prompt));
```

Benefits:
- Reduced API calls
- Faster file operations
- Lower latency
- Configurable TTL and size limits

---

## 📊 Supported Providers

| Provider | Setup Method | Notes |
|----------|-------------|-------|
| **OpenAI-compatible** | `/provider` or env vars | OpenAI, OpenRouter, DeepSeek, Groq, Mistral, LM Studio |
| **Hicap** | `/provider` | API key auth, auto model discovery, Responses mode support |
| **Gemini** | `/provider` or env vars | API key authentication |
| **GitHub Models** | `/onboard-github` | Interactive onboarding with saved credentials |
| **Codex OAuth** | `/provider` | Browser-based ChatGPT sign-in |
| **Codex** | `/provider` | Existing Codex CLI auth or env credentials |
| **Ollama** | `/provider`, env vars, or `ollama launch` | Local inference, no API key needed |
| **Atomic Chat** | `/provider` or `bun run dev:atomic-chat` | Local Model Provider with auto-detection |
| **Bedrock/Vertex/Foundry** | env vars | Enterprise cloud providers |

---

## 🛠️ What Works

### Tool-Driven Workflows
- **Bash Commands**: Execute shell commands with permission prompts
- **File Operations**: Read, write, edit files with safety checks
- **Search Tools**: Grep and glob for codebase navigation
- **Web Tools**: WebSearch (DuckDuckGo/Firecrawl) and WebFetch
- **MCP Integration**: Model Context Protocol support
- **Slash Commands**: Built-in and custom commands

### Streaming & Real-time Features
- **Token Streaming**: Real-time output as tokens are generated
- **Tool Progress**: Visual feedback during tool execution
- **Multi-step Loops**: Complex workflows with multiple tool calls
- **Image Support**: Vision models can process images (URL/base64)

### Advanced Features
- **Provider Profiles**: Save and switch between provider configurations
- **Agent Routing**: Route different agents to optimal models
- **Local & Cloud**: Support for both local servers and cloud APIs
- **Apple Silicon**: Native support for M1/M2/M3 Macs

---

## ⚙️ Configuration

### Agent Routing Example

Route different agents to different models in `~/.openclaude.json`:

```json
{
  "agentModels": {
    "deepseek-v4-flash": {
      "base_url": "https://api.deepseek.com/v1",
      "api_key": "sk-your-key"
    },
    "gpt-4o": {
      "base_url": "https://api.openai.com/v1",
      "api_key": "sk-your-key"
    }
  },
  "agentRouting": {
    "Explore": "deepseek-v4-flash",
    "Plan": "gpt-4o",
    "general-purpose": "gpt-4o",
    "frontend-dev": "deepseek-v4-flash",
    "default": "gpt-4o"
  }
}
```

> **Security Note**: API keys in `settings.json` are stored in plaintext. Keep this file private and never commit it to version control.

### Web Search Configuration

By default, `WebSearch` uses DuckDuckGo for non-Anthropic models. For enhanced reliability:

```bash
export FIRECRAWL_API_KEY=your-key-here
```

With Firecrawl enabled:
- `WebSearch` uses Firecrawl's search API
- `WebFetch` handles JavaScript-rendered pages correctly
- Free tier includes 500 credits at [firecrawl.dev](https://firecrawl.dev)

---

## 🔌 gRPC Server

Run IceCode as a headless gRPC service for integration into other applications:

### Start Server

```bash
npm run dev:grpc
```

Server runs on `localhost:50051` by default.

### Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `GRPC_PORT` | `50051` | Server port |
| `GRPC_HOST` | `localhost` | Bind address (use `0.0.0.0` for remote access) |

### Test Client

```bash
npm run dev:grpc:cli
```

The CLI client demonstrates full gRPC integration with streaming tokens and tool permission prompts.

Proto definitions: `src/proto/openclaude.proto`

---

## 📚 Documentation

### Getting Started
- [Non-Technical Setup](docs/non-technical-setup.md) - Beginner-friendly guide
- [Windows Quick Start](docs/quick-start-windows.md) - Windows-specific instructions
- [macOS/Linux Quick Start](docs/quick-start-mac-linux.md) - Unix-based systems
- [Advanced Setup](docs/advanced-setup.md) - Power user configuration
- [Android Install](ANDROID_INSTALL.md) - Mobile deployment

### IDE Features
- [Enhancement Plan](docs/IceCode_IDE_Enhancement_Plan.md) - Complete feature roadmap
- [Implementation Progress](docs/IMPLEMENTATION_PROGRESS.md) - Current development status
- [Task Status & Monitoring Guide](ide/docs/TASK_STATUS_AND_MONITORING_USAGE.md) - API reference
- [Performance Optimization Guide](ide/docs/PERFORMANCE_OPTIMIZATION_USAGE.md) - Caching and optimization
- [Project Completion Summary](docs/PROJECT_COMPLETION_SUMMARY.md) - Achievement overview

### Contributing
- [Contributing Guidelines](CONTRIBUTING.md) - How to contribute
- [Code of Conduct](CODE_OF_CONDUCT.md) - Community standards
- [Security Policy](SECURITY.md) - Reporting vulnerabilities

---

## 🏗️ Source Build & Development

### Prerequisites

- Node.js 18+ or Bun 1.0+
- Git

### Build from Source

```bash
git clone https://github.com/XiTu893/iceIDE.git
cd iceIDE
bun install
bun run build
node dist/cli.mjs
```

### Development Commands

```bash
bun run dev              # Development mode with hot reload
bun test                 # Run all unit tests
bun run test:coverage    # Generate coverage report
bun run smoke            # Smoke tests
bun run doctor:runtime   # Runtime diagnostics
bun run verify:privacy   # Privacy verification
bun run security:pr-scan -- --base origin/main  # Security scan
```

### Focused Testing

```bash
bun run test:provider           # Provider tests
bun run test:provider-recommendation  # Recommendation tests
bun test path/to/file.test.ts   # Specific file tests
```

### Coverage Reports

```bash
bun run test:coverage          # Generate coverage
open coverage/index.html       # View HTML report
bun run test:coverage:ui       # Rebuild UI from existing lcov.info
```

Coverage output: `coverage/lcov.info`  
Visual report: `coverage/index.html` (git-activity heatmap style)

---

## 📁 Repository Structure

```
iceIDE/
├── src/                    # Core CLI and runtime
│   ├── components/         # React components
│   ├── services/           # Business logic services
│   ├── hooks/             # Custom React hooks
│   ├── tools/             # Tool implementations
│   └── utils/             # Utility functions
├── ide/                   # Electron desktop IDE
│   ├── src/               # IDE source code
│   ├── electron/          # Electron main process
│   └── docs/              # IDE documentation
├── scripts/               # Build and maintenance scripts
├── docs/                  # Project documentation
├── .github/               # CI/CD and templates
├── bin/                   # CLI entrypoints
└── vscode-extension/      # VS Code extension
```

---

## 🤝 Community

- **[GitHub Discussions](https://github.com/Gitlawb/openclaude/discussions)** - Q&A, ideas, community conversation
- **[GitHub Issues](https://github.com/Gitlawb/openclaude/issues)** - Bug reports and feature requests
- **[Discord](https://discord.gg/your-invite)** - Real-time chat (coming soon)

---

## 🙋 Contributing

Contributions are welcome! For larger changes, please open an issue first to discuss scope.

### Pre-PR Checklist

```bash
bun run build              # Ensure builds successfully
bun run smoke              # Run smoke tests
bun run test:coverage      # Check test coverage
bun test path/to/changed   # Test your specific changes
```

### Contribution Areas

- 🐛 Bug fixes
- ✨ New features
- 📚 Documentation improvements
- 🧪 Test coverage
- 🎨 UI/UX enhancements
- 🔧 Performance optimizations

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

---

## 🌟 Sponsors

<p align="center">
  <a href="https://gitlawb.com">
    <img src="https://gitlawb.com/logo.png" alt="GitLawb logo" width="96">
  </a>
  &nbsp;&nbsp;&nbsp;&nbsp;
  <a href="https://bankr.bot">
    <img src="https://bankr.bot/favicon.svg" alt="Bankr.bot logo" width="96">
  </a>
  &nbsp;&nbsp;&nbsp;&nbsp;
  <a href="https://atomic.chat/">
    <img src="docs/assets/atomic-chat-logo.png" alt="Atomic Chat logo" width="96">
  </a>
</p>

<p align="center">
  <a href="https://gitlawb.com"><strong>GitLawb</strong></a>
  &nbsp;&nbsp;&nbsp;&nbsp;
  <a href="https://bankr.bot"><strong>Bankr.bot</strong></a>
  &nbsp;&nbsp;&nbsp;&nbsp;
  <a href="https://atomic.chat/"><strong>Atomic Chat</strong></a>
</p>

---

## 📈 Star History

[![Star History Chart](https://api.star-history.com/chart?repos=XiTu893/iceIDE&type=date&legend=top-left)](https://www.star-history.com/?repos=XiTu893%2FiceIDE&type=date&legend=top-left)

---

## ⚖️ Disclaimer

IceCode is an independent community project and is not affiliated with, endorsed by, or sponsored by Anthropic.

IceCode originated from the Claude Code codebase and has been substantially modified to support multiple providers, add a desktop IDE, and enable open use. "Claude" and "Claude Code" are trademarks of Anthropic PBC. See [LICENSE](LICENSE) for details.

---

## 📄 License

MIT License - See [LICENSE](LICENSE) for full text.

---

**Built with ❤️ by the IceCode Community**

*Version: 1.0.0 | Last Updated: May 12, 2026*
