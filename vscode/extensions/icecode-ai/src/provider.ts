import * as vscode from 'vscode';
import * as path from 'path';
import { GrpcClient, ChatMessage } from './grpcClient';
import { SessionManager } from './sessionManager';
import { HistoryManager } from './historyManager';

const SLASH_COMMANDS: Record<string, string> = {
    '/help': 'Show available commands and usage',
    '/clear': 'Clear current chat session',
    '/explain': 'Explain the selected or current code',
    '/fix': 'Fix bugs in the selected code',
    '/optimize': 'Optimize the selected code',
    '/test': 'Generate unit tests for the selected code',
    '/doc': 'Add documentation to the selected code',
    '/refactor': 'Refactor the selected code',
    '/review': 'Review the selected code for issues',
    '/model': 'Switch AI model',
    '/context': 'Show current context (workspace, files)',
    '/compact': 'Compact conversation history to save tokens',
};

export class IceCodeAIProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'icecode-ai.chat';
    private _view?: vscode.WebviewView;
    private _messages: ChatMessage[] = [];
    private _currentModel: string;
    private _contextFiles: Map<string, string> = new Map();

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _grpcClient: GrpcClient,
        private readonly _sessionManager: SessionManager,
        private readonly _historyManager: HistoryManager
    ) {
        const config = vscode.workspace.getConfiguration('icecode-ai');
        this._currentModel = config.get<string>('model', 'claude-sonnet-4-20250514');
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'sendMessage': {
                    let message = data.value;
                    message = await this._processAtReferences(message);
                    message = await this._processSlashCommand(message);

                    if (message === null) return;

                    const userMessage: ChatMessage = {
                        role: 'user',
                        content: message,
                        timestamp: Date.now()
                    };
                    this._messages.push(userMessage);
                    this._postMessage({ type: 'userMessage', value: userMessage });
                    this._postMessage({ type: 'setLoading', value: true });

                    await this._historyManager.addEntry({
                        role: 'user',
                        content: message,
                        sessionId: this._grpcClient.sessionId || 'default'
                    });

                    try {
                        await this._grpcClient.sendMessage(
                            message,
                            (chunk: string) => {
                                this._postMessage({ type: 'streamChunk', value: chunk });
                            },
                            async (complete: string) => {
                                const assistantMessage: ChatMessage = {
                                    role: 'assistant',
                                    content: complete,
                                    timestamp: Date.now()
                                };
                                this._messages.push(assistantMessage);
                                this._postMessage({ type: 'assistantMessage', value: assistantMessage });
                                this._postMessage({ type: 'setLoading', value: false });

                                await this._historyManager.addEntry({
                                    role: 'assistant',
                                    content: complete,
                                    sessionId: this._grpcClient.sessionId || 'default'
                                });
                            }
                        );
                    } catch (error: any) {
                        this._postMessage({ type: 'error', value: error.message });
                        this._postMessage({ type: 'setLoading', value: false });
                    }
                    break;
                }
                case 'newSession': {
                    this._messages = [];
                    this._contextFiles.clear();
                    await this._sessionManager.createNewSession();
                    this._postMessage({ type: 'clearChat' });
                    break;
                }
                case 'insertCode': {
                    const editor = vscode.window.activeTextEditor;
                    if (editor) {
                        editor.edit(editBuilder => {
                            editBuilder.insert(editor.selection.active, data.value);
                        });
                    }
                    break;
                }
                case 'openFile': {
                    const doc = await vscode.workspace.openTextDocument(data.value);
                    await vscode.window.showTextDocument(doc);
                    break;
                }
                case 'requestSlashCommands': {
                    this._postMessage({ type: 'slashCommands', value: SLASH_COMMANDS });
                    break;
                }
                case 'requestFileList': {
                    const files = await this._getWorkspaceFiles(data.query || '');
                    this._postMessage({ type: 'fileList', value: files });
                    break;
                }
                case 'addContextFile': {
                    const filePath = data.value;
                    const content = await this._readFileContent(filePath);
                    if (content !== null) {
                        this._contextFiles.set(filePath, content);
                        this._postMessage({ type: 'contextFileAdded', value: { path: filePath, lines: content.split('\n').length } });
                    }
                    break;
                }
                case 'removeContextFile': {
                    this._contextFiles.delete(data.value);
                    break;
                }
                case 'switchModel': {
                    vscode.commands.executeCommand('icecode-ai.switchModel');
                    break;
                }
            }
        });
    }

    public sendToChat(text: string) {
        this._postMessage({ type: 'externalText', value: text });
    }

    public updateModel(model: string) {
        this._currentModel = model;
        this._postMessage({ type: 'modelChanged', value: model });
    }

    public refresh() {
        if (this._view) {
            this._view.webview.html = this._getHtmlForWebview(this._view.webview);
        }
    }

    private _postMessage(message: object) {
        this._view?.webview.postMessage(message);
    }

    private async _processAtReferences(message: string): Promise<string> {
        const atFileRegex = /@([^\s]+)/g;
        let match;
        const processedFiles = new Set<string>();

        while ((match = atFileRegex.exec(message)) !== null) {
            const filePath = match[1];
            if (processedFiles.has(filePath)) continue;
            processedFiles.add(filePath);

            const content = await this._readFileContent(filePath);
            if (content !== null) {
                message = message.replace(
                    match[0],
                    `@${filePath}\n\`\`\`\n${content}\n\`\`\``
                );
            }
        }

        if (this._contextFiles.size > 0) {
            const contextBlock = Array.from(this._contextFiles.entries())
                .map(([path, content]) => `--- ${path} ---\n\`\`\`\n${content}\n\`\`\``)
                .join('\n\n');
            message = `[Context Files]\n${contextBlock}\n\n[User Message]\n${message}`;
        }

        return message;
    }

    private async _processSlashCommand(message: string): Promise<string | null> {
        const trimmed = message.trim();
        if (!trimmed.startsWith('/')) return message;

        const parts = trimmed.split(/\s+/);
        const command = parts[0].toLowerCase();
        const args = parts.slice(1).join(' ');

        switch (command) {
            case '/help': {
                const helpText = Object.entries(SLASH_COMMANDS)
                    .map(([cmd, desc]) => `**${cmd}** - ${desc}`)
                    .join('\n');
                this._postMessage({ type: 'systemMessage', value: helpText });
                return null;
            }
            case '/clear': {
                this._messages = [];
                this._contextFiles.clear();
                this._postMessage({ type: 'clearChat' });
                return null;
            }
            case '/explain': return await this._getCodeContext('Explain the following code:\n\n', args);
            case '/fix': return await this._getCodeContext('Fix the bugs in the following code:\n\n', args);
            case '/optimize': return await this._getCodeContext('Optimize the following code:\n\n', args);
            case '/test': return await this._getCodeContext('Generate unit tests for the following code:\n\n', args);
            case '/doc': return await this._getCodeContext('Add documentation to the following code:\n\n', args);
            case '/refactor': return await this._getCodeContext('Refactor the following code:\n\n', args);
            case '/review': return await this._getCodeContext('Review the following code for issues:\n\n', args);
            case '/model': {
                vscode.commands.executeCommand('icecode-ai.switchModel');
                return null;
            }
            case '/context': {
                const contextInfo = [
                    `Workspace: ${vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || 'None'}`,
                    `Context files: ${this._contextFiles.size}`,
                    `Model: ${this._currentModel}`,
                    `Session: ${this._grpcClient.sessionId || 'None'}`,
                    `Connected: ${this._grpcClient.isConnected}`
                ].join('\n');
                this._postMessage({ type: 'systemMessage', value: contextInfo });
                return null;
            }
            case '/compact': {
                if (this._messages.length > 2) {
                    const firstMsg = this._messages[0];
                    const lastMsg = this._messages[this._messages.length - 1];
                    this._messages = [
                        firstMsg,
                        { role: 'system', content: `[${this._messages.length - 2} messages compacted]`, timestamp: Date.now() },
                        lastMsg
                    ];
                    this._postMessage({ type: 'systemMessage', value: `Compacted ${this._messages.length} messages` });
                }
                return null;
            }
            default: {
                this._postMessage({ type: 'systemMessage', value: `Unknown command: ${command}. Type /help for available commands.` });
                return null;
            }
        }
    }

    private async _getCodeContext(prefix: string, args: string): Promise<string> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return `${prefix}${args}`;

        const selection = editor.selection;
        const code = selection.isEmpty
            ? editor.document.getText()
            : editor.document.getText(selection);
        const languageId = editor.document.languageId;
        const fileName = editor.document.fileName;

        return `${prefix}\`\`\`${languageId} ${fileName}\n${code}\n\`\`\``;
    }

    private async _readFileContent(filePath: string): Promise<string | null> {
        try {
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (!workspaceRoot) return null;

            let fullPath: string;
            if (path.isAbsolute(filePath)) {
                fullPath = filePath;
            } else {
                fullPath = path.join(workspaceRoot, filePath);
            }

            const uri = vscode.Uri.file(fullPath);
            const doc = await vscode.workspace.openTextDocument(uri);
            const maxLines = 200;
            const text = doc.getText();
            const lines = text.split('\n');
            if (lines.length > maxLines) {
                return lines.slice(0, maxLines).join('\n') + `\n... (${lines.length - maxLines} more lines)`;
            }
            return text;
        } catch {
            return null;
        }
    }

    private async _getWorkspaceFiles(query: string): Promise<string[]> {
        const files = await vscode.workspace.findFiles(
            query ? `**/*${query}*` : '**/*',
            '**/node_modules/**',
            50
        );
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
        return files.map(f => {
            const relative = f.fsPath.replace(workspaceRoot + path.sep, '');
            return relative;
        });
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        const config = vscode.workspace.getConfiguration('icecode-ai');
        const theme = config.get<string>('theme', 'dark');
        const fontSize = config.get<number>('fontSize', 14);

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background-color: ${theme === 'dark' ? '#0B1A2E' : '#F0F4F8'};
            color: ${theme === 'dark' ? '#E2E8F0' : '#1A202C'};
            font-size: ${fontSize}px;
            height: 100vh;
            overflow: hidden;
        }
        #app { display: flex; flex-direction: column; height: 100vh; }
        #header {
            display: flex; align-items: center; justify-content: space-between;
            padding: 10px 12px; border-bottom: 1px solid ${theme === 'dark' ? '#1E3A5F' : '#CBD5E0'};
            background-color: ${theme === 'dark' ? '#112240' : '#FFFFFF'};
        }
        .header-left { display: flex; align-items: center; gap: 8px; }
        .header-title { font-weight: 600; font-size: 14px; color: ${theme === 'dark' ? '#00D4FF' : '#0099FF'}; }
        .header-actions { display: flex; gap: 4px; }
        .icon-btn {
            background: none; border: none; color: ${theme === 'dark' ? '#8892B0' : '#718096'};
            cursor: pointer; padding: 4px; border-radius: 4px; display: flex; align-items: center;
        }
        .icon-btn:hover { background-color: ${theme === 'dark' ? '#1A2F4E' : '#E2E8F0'}; color: ${theme === 'dark' ? '#E2E8F0' : '#1A202C'}; }
        #messages { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 12px; }
        .message { display: flex; gap: 10px; max-width: 100%; }
        .user-message { flex-direction: row-reverse; }
        .avatar {
            width: 28px; height: 28px; border-radius: 6px; display: flex; align-items: center;
            justify-content: center; font-size: 11px; font-weight: 700; flex-shrink: 0;
        }
        .user-message .avatar { background-color: ${theme === 'dark' ? '#00D4FF' : '#0099FF'}; color: ${theme === 'dark' ? '#0B1A2E' : '#FFFFFF'}; }
        .assistant-message .avatar { background-color: ${theme === 'dark' ? '#1E3A5F' : '#CBD5E0'}; color: ${theme === 'dark' ? '#E2E8F0' : '#1A202C'}; }
        .system-message .avatar { background-color: ${theme === 'dark' ? '#2A4A6F' : '#A0AEC0'}; color: white; }
        .message-content { flex: 1; min-width: 0; line-height: 1.6; word-wrap: break-word; }
        .user-message .message-content {
            background-color: ${theme === 'dark' ? '#00D4FF' : '#0099FF'}; color: ${theme === 'dark' ? '#0B1A2E' : '#FFFFFF'};
            padding: 8px 12px; border-radius: 12px 12px 2px 12px; max-width: 85%;
        }
        .assistant-message .message-content, .system-message .message-content {
            background-color: ${theme === 'dark' ? '#112240' : '#FFFFFF'};
            padding: 10px 14px; border-radius: 12px 12px 12px 2px;
            border: 1px solid ${theme === 'dark' ? '#1E3A5F' : '#CBD5E0'};
        }
        .code-block { margin: 8px 0; border-radius: 8px; overflow: hidden; border: 1px solid ${theme === 'dark' ? '#1E3A5F' : '#CBD5E0'}; }
        .code-header { display: flex; justify-content: flex-end; gap: 6px; padding: 4px 8px; background-color: ${theme === 'dark' ? '#1A2F4E' : '#E2E8F0'}; }
        .copy-btn, .insert-btn {
            background: none; border: 1px solid ${theme === 'dark' ? '#1E3A5F' : '#CBD5E0'};
            color: ${theme === 'dark' ? '#8892B0' : '#718096'}; cursor: pointer; padding: 2px 8px;
            border-radius: 4px; font-size: 11px;
        }
        .copy-btn:hover, .insert-btn:hover { background-color: ${theme === 'dark' ? '#00D4FF' : '#0099FF'}; color: ${theme === 'dark' ? '#0B1A2E' : '#FFFFFF'}; border-color: ${theme === 'dark' ? '#00D4FF' : '#0099FF'}; }
        .code-block pre { margin: 0; padding: 10px; background-color: ${theme === 'dark' ? '#0D2137' : '#EDF2F7'}; overflow-x: auto; }
        .code-block code { font-family: 'Cascadia Code', 'Fira Code', Consolas, monospace; font-size: 13px; line-height: 1.5; }
        .inline-code { background-color: ${theme === 'dark' ? '#0D2137' : '#EDF2F7'}; padding: 1px 5px; border-radius: 4px; font-family: 'Cascadia Code', Consolas, monospace; font-size: 13px; }
        .streaming { position: relative; }
        .cursor { display: inline-block; color: ${theme === 'dark' ? '#00D4FF' : '#0099FF'}; animation: blink 1s step-end infinite; font-weight: bold; }
        @keyframes blink { 50% { opacity: 0; } }
        .error-message { background-color: rgba(255,107,107,0.1); border: 1px solid #FF6B6B; color: #FF6B6B; padding: 8px 12px; border-radius: 8px; font-size: 13px; }
        #input-area { padding: 10px 12px; border-top: 1px solid ${theme === 'dark' ? '#1E3A5F' : '#CBD5E0'}; background-color: ${theme === 'dark' ? '#112240' : '#FFFFFF'}; }
        #input-container {
            display: flex; align-items: flex-end; gap: 8px;
            background-color: ${theme === 'dark' ? '#1A2F4E' : '#E2E8F0'};
            border: 1px solid ${theme === 'dark' ? '#1E3A5F' : '#CBD5E0'};
            border-radius: 12px; padding: 8px 10px; transition: border-color 0.2s;
        }
        #input-container:focus-within { border-color: ${theme === 'dark' ? '#00D4FF' : '#0099FF'}; }
        #messageInput {
            flex: 1; background: none; border: none; color: ${theme === 'dark' ? '#E2E8F0' : '#1A202C'};
            font-size: ${fontSize}px; font-family: inherit; resize: none; outline: none;
            max-height: 150px; line-height: 1.5;
        }
        #messageInput::placeholder { color: ${theme === 'dark' ? '#4A5568' : '#A0AEC0'}; }
        .send-btn {
            background-color: ${theme === 'dark' ? '#00D4FF' : '#0099FF'}; border: none;
            color: ${theme === 'dark' ? '#0B1A2E' : '#FFFFFF'}; cursor: pointer; width: 32px; height: 32px;
            border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .send-btn:hover:not(:disabled) { background-color: ${theme === 'dark' ? '#00B8D9' : '#0077CC'}; }
        .send-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .send-btn.loading { animation: pulse 1.5s ease-in-out infinite; }
        @keyframes pulse { 0%,100% { opacity: 0.5; } 50% { opacity: 1; } }
        .input-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 6px; padding: 0 4px; }
        .model-indicator { font-size: 11px; color: ${theme === 'dark' ? '#00D4FF' : '#0099FF'}; font-weight: 500; }
        .shortcut-hint { font-size: 11px; color: ${theme === 'dark' ? '#4A5568' : '#A0AEC0'}; }
        .autocomplete {
            position: absolute; bottom: 100%; left: 0; right: 0;
            background-color: ${theme === 'dark' ? '#112240' : '#FFFFFF'};
            border: 1px solid ${theme === 'dark' ? '#1E3A5F' : '#CBD5E0'};
            border-radius: 8px; max-height: 200px; overflow-y: auto; z-index: 100;
            box-shadow: 0 -4px 12px rgba(0,0,0,0.2);
        }
        .autocomplete-item {
            padding: 6px 12px; cursor: pointer; display: flex; align-items: center; gap: 8px;
        }
        .autocomplete-item:hover, .autocomplete-item.selected {
            background-color: ${theme === 'dark' ? '#1A3A5C' : '#E2E8F0'};
        }
        .autocomplete-cmd { color: ${theme === 'dark' ? '#00D4FF' : '#0099FF'}; font-weight: 600; min-width: 80px; }
        .autocomplete-desc { color: ${theme === 'dark' ? '#8892B0' : '#718096'}; font-size: 12px; }
        .context-badge {
            display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px;
            background-color: ${theme === 'dark' ? '#1A3A5C' : '#E2E8F0'};
            border-radius: 12px; font-size: 11px; margin: 2px;
        }
        .context-badge .remove { cursor: pointer; opacity: 0.6; }
        .context-badge .remove:hover { opacity: 1; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background-color: ${theme === 'dark' ? '#1E3A5F' : '#CBD5E0'}; border-radius: 3px; }
    </style>
</head>
<body>
    <div id="app">
        <div id="header">
            <div class="header-left">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="10" stroke="${theme === 'dark' ? '#00D4FF' : '#0099FF'}" stroke-width="2" fill="none"/>
                    <line x1="12" y1="2" x2="12" y2="22" stroke="${theme === 'dark' ? '#00D4FF' : '#0099FF'}" stroke-width="1.5"/>
                    <line x1="4.93" y1="7.5" x2="19.07" y2="16.5" stroke="${theme === 'dark' ? '#00D4FF' : '#0099FF'}" stroke-width="1.5"/>
                    <line x1="4.93" y1="16.5" x2="19.07" y2="7.5" stroke="${theme === 'dark' ? '#00D4FF' : '#0099FF'}" stroke-width="1.5"/>
                    <circle cx="12" cy="12" r="2" fill="${theme === 'dark' ? '#00D4FF' : '#0099FF'}"/>
                </svg>
                <span class="header-title">IceCode AI</span>
            </div>
            <div class="header-actions">
                <button id="modelBtn" class="icon-btn" title="Switch Model">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M14 7H9.7l2.3-2.3-.7-.7L8 7 6.7 4 6 4.7 8.3 7H2v1h6.3L6 10.3l.7.7L9 9l2.3 2.3.7-.7L9.7 8H14V7z"/></svg>
                </button>
                <button id="newSessionBtn" class="icon-btn" title="New Session">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 12.5a5.5 5.5 0 110-11 5.5 5.5 0 010 11zm3-5.5a.75.75 0 01-.75.75H8.75v1.5a.75.75 0 01-1.5 0v-1.5H5.75a.75.75 0 010-1.5h1.5v-1.5a.75.75 0 011.5 0v1.5h1.5A.75.75 0 0111 8z"/></svg>
                </button>
            </div>
        </div>

        <div id="messages"></div>

        <div id="input-area">
            <div id="autocomplete" class="autocomplete" style="display:none;"></div>
            <div id="input-container">
                <textarea id="messageInput" placeholder="Ask IceCode AI... (/ for commands, @ for files)" rows="1"></textarea>
                <button id="sendBtn" class="send-btn" title="Send (Ctrl+Enter)">
                    <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor"><path d="M1 8l14-7-7 14v-7H1z"/></svg>
                </button>
            </div>
            <div class="input-footer">
                <span class="model-indicator" id="modelLabel">${this._currentModel}</span>
                <span class="shortcut-hint">Ctrl+Enter / @files / /cmds</span>
            </div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        const messagesEl = document.getElementById('messages');
        const inputEl = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendBtn');
        const newSessionBtn = document.getElementById('newSessionBtn');
        const modelBtn = document.getElementById('modelBtn');
        const modelLabel = document.getElementById('modelLabel');
        const autocompleteEl = document.getElementById('autocomplete');
        let isLoading = false;
        let currentStreamContent = '';
        let slashCommands = {};
        let autocompleteItems = [];
        let selectedAutocomplete = -1;

        function scrollToBottom() { messagesEl.scrollTop = messagesEl.scrollHeight; }

        function createMessageEl(msg) {
            const div = document.createElement('div');
            div.className = 'message ' + (msg.role === 'user' ? 'user-message' : msg.role === 'system' ? 'system-message' : 'assistant-message');
            const avatar = document.createElement('div');
            avatar.className = 'avatar';
            avatar.textContent = msg.role === 'user' ? 'U' : msg.role === 'system' ? 'S' : 'AI';
            const content = document.createElement('div');
            content.className = 'message-content';
            if (msg.role === 'assistant' || msg.role === 'system') { renderMarkdown(content, msg.content); }
            else { content.textContent = msg.content; }
            div.appendChild(avatar);
            div.appendChild(content);
            return div;
        }

        function renderMarkdown(el, text) {
            let html = text
                .replace(/\`\`\`([\\s\\S]*?)\`\`\`/g, '<pre><code>$1</code></pre>')
                .replace(/\`([^\`]+)\`/g, '<code class="inline-code">$1</code>')
                .replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>')
                .replace(/\\*(.*?)\\*/g, '<em>$1</em>')
                .replace(/^### (.*$)/gm, '<h4>$1</h4>')
                .replace(/^## (.*$)/gm, '<h3>$1</h3>')
                .replace(/^# (.*$)/gm, '<h2>$1</h2>')
                .replace(/\\n/g, '<br>');
            el.innerHTML = html;
            el.querySelectorAll('pre code').forEach(block => {
                const wrapper = document.createElement('div'); wrapper.className = 'code-block';
                const header = document.createElement('div'); header.className = 'code-header';
                const copyBtn = document.createElement('button'); copyBtn.className = 'copy-btn'; copyBtn.textContent = 'Copy';
                copyBtn.onclick = () => { navigator.clipboard.writeText(block.textContent); copyBtn.textContent = 'Copied!'; setTimeout(() => copyBtn.textContent = 'Copy', 2000); };
                const insertBtn = document.createElement('button'); insertBtn.className = 'insert-btn'; insertBtn.textContent = 'Insert';
                insertBtn.onclick = () => { vscode.postMessage({ type: 'insertCode', value: block.textContent }); };
                header.appendChild(copyBtn); header.appendChild(insertBtn);
                block.parentNode.insertBefore(wrapper, block); wrapper.appendChild(header); wrapper.appendChild(block);
            });
        }

        function addMessage(msg) { messagesEl.appendChild(createMessageEl(msg)); scrollToBottom(); }

        function addStreamPlaceholder() {
            const div = document.createElement('div'); div.className = 'message assistant-message streaming'; div.id = 'streaming-msg';
            const avatar = document.createElement('div'); avatar.className = 'avatar'; avatar.textContent = 'AI';
            const content = document.createElement('div'); content.className = 'message-content'; content.id = 'streaming-content';
            const cursor = document.createElement('span'); cursor.className = 'cursor'; cursor.textContent = '|';
            div.appendChild(avatar); div.appendChild(content); div.appendChild(cursor);
            messagesEl.appendChild(div); scrollToBottom();
        }

        function updateStreamContent(chunk) {
            currentStreamContent += chunk;
            const content = document.getElementById('streaming-content');
            if (content) { renderMarkdown(content, currentStreamContent); scrollToBottom(); }
        }

        function finalizeStream(fullContent) {
            const streamMsg = document.getElementById('streaming-msg');
            if (streamMsg) streamMsg.remove();
            addMessage({ role: 'assistant', content: fullContent, timestamp: Date.now() });
            currentStreamContent = '';
        }

        function setLoading(loading) {
            isLoading = loading; sendBtn.disabled = loading; inputEl.disabled = loading;
            if (loading) sendBtn.classList.add('loading'); else sendBtn.classList.remove('loading');
        }

        function sendMessage() {
            const text = inputEl.value.trim();
            if (!text || isLoading) return;
            inputEl.value = ''; inputEl.style.height = 'auto';
            hideAutocomplete();
            vscode.postMessage({ type: 'sendMessage', value: text });
        }

        function showAutocomplete(items) {
            autocompleteItems = items; selectedAutocomplete = -1;
            autocompleteEl.innerHTML = '';
            items.forEach((item, i) => {
                const div = document.createElement('div'); div.className = 'autocomplete-item';
                div.innerHTML = '<span class="autocomplete-cmd">' + item.label + '</span><span class="autocomplete-desc">' + item.description + '</span>';
                div.onclick = () => selectAutocomplete(i);
                autocompleteEl.appendChild(div);
            });
            autocompleteEl.style.display = items.length > 0 ? 'block' : 'none';
        }

        function hideAutocomplete() { autocompleteEl.style.display = 'none'; autocompleteItems = []; selectedAutocomplete = -1; }

        function selectAutocomplete(index) {
            if (index < 0 || index >= autocompleteItems.length) return;
            const item = autocompleteItems[index];
            const text = inputEl.value;
            const lastSlash = text.lastIndexOf('/');
            const lastAt = text.lastIndexOf('@');
            const pos = Math.max(lastSlash, lastAt);
            if (pos >= 0) {
                inputEl.value = text.substring(0, pos) + item.insertText + ' ';
            }
            hideAutocomplete(); inputEl.focus();
        }

        function updateAutocomplete() {
            const text = inputEl.value;
            const cursorPos = inputEl.selectionStart;
            const textBeforeCursor = text.substring(0, cursorPos);
            const lastWord = textBeforeCursor.split(/\\s/).pop() || '';

            if (lastWord.startsWith('/')) {
                const query = lastWord.substring(1).toLowerCase();
                const items = Object.entries(slashCommands)
                    .filter(([cmd]) => cmd.toLowerCase().includes(query))
                    .slice(0, 8)
                    .map(([cmd, desc]) => ({ label: cmd, description: desc, insertText: cmd }));
                showAutocomplete(items);
            } else if (lastWord.startsWith('@')) {
                const query = lastWord.substring(1).toLowerCase();
                vscode.postMessage({ type: 'requestFileList', query: query });
            } else {
                hideAutocomplete();
            }
        }

        sendBtn.addEventListener('click', sendMessage);
        inputEl.addEventListener('keydown', (e) => {
            if (autocompleteItems.length > 0) {
                if (e.key === 'ArrowDown') { e.preventDefault(); selectedAutocomplete = Math.min(selectedAutocomplete + 1, autocompleteItems.length - 1); return; }
                if (e.key === 'ArrowUp') { e.preventDefault(); selectedAutocomplete = Math.max(selectedAutocomplete - 1, 0); return; }
                if (e.key === 'Tab' || e.key === 'Enter') { e.preventDefault(); selectAutocomplete(selectedAutocomplete >= 0 ? selectedAutocomplete : 0); return; }
                if (e.key === 'Escape') { hideAutocomplete(); return; }
            }
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); sendMessage(); }
        });
        inputEl.addEventListener('input', () => {
            inputEl.style.height = 'auto'; inputEl.style.height = Math.min(inputEl.scrollHeight, 150) + 'px';
            updateAutocomplete();
        });
        newSessionBtn.addEventListener('click', () => { vscode.postMessage({ type: 'newSession' }); });
        modelBtn.addEventListener('click', () => { vscode.postMessage({ type: 'switchModel' }); });

        window.addEventListener('message', (event) => {
            const data = event.data;
            switch (data.type) {
                case 'userMessage': addMessage(data.value); break;
                case 'assistantMessage': finalizeStream(data.value.content); break;
                case 'systemMessage': addMessage({ role: 'system', content: data.value, timestamp: Date.now() }); break;
                case 'streamChunk':
                    if (!document.getElementById('streaming-msg')) addStreamPlaceholder();
                    updateStreamContent(data.value); break;
                case 'setLoading': setLoading(data.value); break;
                case 'error':
                    const errDiv = document.createElement('div'); errDiv.className = 'error-message';
                    errDiv.textContent = 'Error: ' + data.value; messagesEl.appendChild(errDiv); scrollToBottom(); break;
                case 'clearChat': messagesEl.innerHTML = ''; currentStreamContent = ''; break;
                case 'externalText': inputEl.value = data.value; inputEl.focus(); break;
                case 'slashCommands': slashCommands = data.value; break;
                case 'fileList':
                    const fileItems = (data.value || []).map(f => ({ label: '@' + f, description: 'file', insertText: '@' + f }));
                    showAutocomplete(fileItems); break;
                case 'modelChanged': modelLabel.textContent = data.value; break;
                case 'contextFileAdded':
                    break;
            }
        });

        vscode.postMessage({ type: 'requestSlashCommands' });
        inputEl.focus();
    </script>
</body>
</html>`;
    }
}
