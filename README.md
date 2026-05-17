# IceCode IDE

**AI-First IDE** — Fork of VSCode 1.121.0, inspired by [Trae IDE](https://www.trae.ai/), powered by Claude Code kernel.

---

## Features

### Editor Core (from VSCode)

- Full-featured code editor based on VSCode 1.121.0
- Monaco Editor with multi-cursor, bracket matching, code folding
- IntelliSense, code navigation (Go to Definition, Find References)
- Built-in Git integration (status, stage, commit, push, diff)
- Integrated terminal with multi-tab support
- Debug adapter protocol support
- Task runner and problem matcher
- Extension host with full VSCode extension compatibility
- Open VSX extension marketplace (no Microsoft account required)

### AI Capabilities

#### AI Chat Panel (Trae-style)

- Left sidebar AI chat panel, always accessible
- Streaming response with real-time token display
- Code block rendering with **Copy** and **Insert** actions
- System messages for contextual information
- Keyboard shortcut: `Ctrl+Shift+I`

#### Inline Code Completion

- AI-powered code completion as you type
- Context-aware: sends surrounding 50 lines for accurate suggestions
- Trigger characters: `.`, `(`, `{`, `[`, `<`, `/`, newline
- Smart completion cleaning (removes duplicates, code block markers)
- Toggle with `Ctrl+Alt+Space`
- Simulated fallback when backend is offline

#### Code Actions (Right-click Menu)

- **Explain Code** — AI explains selected code (`Ctrl+Shift+E`)
- **Fix Code** — AI fixes bugs in selected code (`Ctrl+Shift+F`)
- **Optimize Code** — AI optimizes for performance
- **Generate Tests** — AI creates unit tests
- **Add Documentation** — AI adds doc comments
- **Refactor Code** — AI refactors for readability

#### Slash Commands

Type `/` in the chat input to see available commands:

| Command | Description |
|---------|-------------|
| `/help` | Show available commands |
| `/clear` | Clear current chat session |
| `/explain` | Explain selected or current code |
| `/fix` | Fix bugs in selected code |
| `/optimize` | Optimize selected code |
| `/test` | Generate unit tests |
| `/doc` | Add documentation |
| `/refactor` | Refactor code |
| `/review` | Review code for issues |
| `/model` | Switch AI model |
| `/context` | Show current context info |
| `/compact` | Compact conversation history |

#### @ File References

- Type `@` to search and reference workspace files
- File content is automatically inlined into the prompt
- Supports context file management (add/remove persistent context)
- Autocomplete dropdown with file search

#### Multi-Model Support

Switch models instantly via Quick Pick UI:

| Provider | Models |
|----------|--------|
| Anthropic | Claude Sonnet 4, Claude Opus 4, Claude Haiku 3.5 |
| OpenAI | GPT-4o, GPT-4o-mini |
| Google | Gemini 2.5 Pro |
| DeepSeek | DeepSeek Chat, DeepSeek Coder |
| Ollama | CodeLlama, DeepSeek Coder (local) |

#### Chat History Persistence

- Chat history saved between sessions via VSCode globalState
- Configurable: enable/disable, max history items
- Session-based organization

### Backend (Claude Code Kernel)

- gRPC-based communication between IDE and AI backend
- Auto-start backend on IDE launch (configurable)
- Bun runtime for high-performance execution
- Streaming responses via Server-Sent Events
- Multi-LLM provider routing
- Workspace-aware context management

### Theme

#### IceCode Dark (Default)

Deep navy blue + ice cyan accent theme, inspired by Trae IDE:

- Editor background: `#0B1A2E`
- Accent color: `#00D4FF`
- Syntax highlighting: Purple keywords, Green strings, Cyan functions, Orange parameters
- Full terminal ANSI 16-color palette
- Consistent UI: Activity bar, sidebar, title bar, status bar, panels

### Brand & Identity

- Custom IceCode branding across all platforms
- Ice crystal icon (SVG + ICO)
- Custom product name, data directories, URL protocol
- Windows Start Menu integration
- About dialog shows IceCode IDE

---

## Architecture

```
IceCode IDE
├── vscode/                          # VSCode 1.121.0 fork (editor core)
│   ├── src/vs/                      # VSCode source code (rebranded)
│   ├── extensions/
│   │   ├── icecode-ai/              # AI panel extension
│   │   │   ├── src/
│   │   │   │   ├── extension.ts     # Extension entry point
│   │   │   │   ├── provider.ts      # Webview chat panel provider
│   │   │   │   ├── grpcClient.ts    # gRPC/HTTP backend client
│   │   │   │   ├── inlineCompletion.ts  # Inline completion provider
│   │   │   │   ├── codeActions.ts   # Code action provider
│   │   │   │   ├── sessionManager.ts # Session tree data provider
│   │   │   │   └── historyManager.ts # Chat history persistence
│   │   │   └── media/
│   │   │       ├── style.css        # Chat panel styles
│   │   │       └── icon.svg         # AI panel icon
│   │   └── theme-icecode-dark/      # IceCode Dark theme
│   ├── product.json                 # Brand configuration
│   └── resources/
│       ├── icecode-icon.svg         # App icon (SVG)
│       └── win32/icecode.ico        # App icon (ICO)
├── src/                             # Claude Code backend
│   ├── proto/icecode.proto          # gRPC service definition
│   └── ...                          # AI agent source code
├── ide/                             # Legacy Electron IDE (v1)
├── .github/workflows/
│   ├── build-icecode-vscode.yml     # VSCode fork CI/CD
│   └── build-ide.yml                # Legacy IDE CI/CD
└── package.json                     # Root package (Claude Code CLI)
```

---

## Build & Development

### Prerequisites

- Node.js 22.x
- Python 3.12+ (for native module compilation)
- Bun (for backend runtime)

### Local Development

```bash
# Install dependencies
cd vscode
npm install
cd build && npm install && cd ..

# Compile VSCode core
npm run compile

# Compile extensions
npm run gulp compile-extensions

# Build IceCode AI extension
cd extensions/icecode-ai
npm install
npm run compile
cd ../../..

# Run development version
./scripts/code.sh
```

### Package for Distribution

```bash
# Windows x64
npm run gulp vscode-win32-x64

# Linux x64
npm run gulp vscode-linux-x64

# macOS
npm run gulp vscode-darwin-arm64
```

### GitHub Actions (CI/CD)

Push a tag to trigger automated build:

```bash
git tag icecode-v0.2.0
git push origin icecode-v0.2.0
```

This triggers the `build-icecode-vscode.yml` workflow which:
1. Sets up Node.js 22 + Python 3.12
2. Compiles VSCode + extensions
3. Packages for Windows x64 and Linux x64
4. Creates a GitHub Release with downloadable ZIP/TAR

---

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `icecode-ai.backendUrl` | `localhost:50051` | gRPC backend URL |
| `icecode-ai.model` | `claude-sonnet-4-20250514` | AI model to use |
| `icecode-ai.theme` | `dark` | Chat panel theme |
| `icecode-ai.fontSize` | `14` | Chat panel font size |
| `icecode-ai.autoStart` | `true` | Auto-start backend |
| `icecode-ai.inlineCompletionEnabled` | `true` | Enable inline completion |
| `icecode-ai.inlineCompletionDelay` | `300` | Completion trigger delay (ms) |
| `icecode-ai.inlineCompletionProvider` | `auto` | Completion provider mode |
| `icecode-ai.contextLines` | `50` | Context lines for code actions |
| `icecode-ai.saveHistory` | `true` | Save chat history |
| `icecode-ai.maxHistoryItems` | `100` | Max history entries |

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+I` | Open AI Chat |
| `Ctrl+Shift+Alt+N` | New Chat Session |
| `Ctrl+Shift+E` | Explain Code |
| `Ctrl+Shift+F` | Fix Code |
| `Ctrl+Alt+Space` | Toggle Inline Completion |
| `Ctrl+Enter` | Send Message (in chat) |

---

## Comparison with Trae IDE

| Feature | IceCode IDE | Trae IDE |
|---------|-------------|----------|
| Editor Core | VSCode 1.121.0 | VSCode fork |
| AI Chat Panel | Left sidebar | Left sidebar |
| Inline Completion | Multi-model | Claude only |
| Code Actions | 6 actions | Similar |
| Slash Commands | 12 commands | Limited |
| @ File References | Yes | Yes |
| Multi-Model | Claude/GPT/Gemini/DeepSeek/Ollama | Claude only |
| Extension Market | Open VSX | VSCode Market |
| Theme | IceCode Dark | Trae Dark |
| Backend | Claude Code (open) | Proprietary |
| License | MIT | Proprietary |

---

## License

MIT
