import * as vscode from 'vscode';
import { GrpcClient, ChatMessage } from './grpcClient';
import { SessionManager } from './sessionManager';

export class IceCodeAIProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'icecode-ai.chat';
    private _view?: vscode.WebviewView;
    private _messages: ChatMessage[] = [];

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _grpcClient: GrpcClient,
        private readonly _sessionManager: SessionManager
    ) {}

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
                    const userMessage: ChatMessage = {
                        role: 'user',
                        content: data.value,
                        timestamp: Date.now()
                    };
                    this._messages.push(userMessage);
                    this._postMessage({ type: 'userMessage', value: userMessage });
                    this._postMessage({ type: 'setLoading', value: true });

                    try {
                        await this._grpcClient.sendMessage(
                            data.value,
                            (chunk: string) => {
                                this._postMessage({ type: 'streamChunk', value: chunk });
                            },
                            (complete: string) => {
                                const assistantMessage: ChatMessage = {
                                    role: 'assistant',
                                    content: complete,
                                    timestamp: Date.now()
                                };
                                this._messages.push(assistantMessage);
                                this._postMessage({ type: 'assistantMessage', value: assistantMessage });
                                this._postMessage({ type: 'setLoading', value: false });
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
            }
        });
    }

    public sendToChat(text: string) {
        this._postMessage({ type: 'externalText', value: text });
    }

    public refresh() {
        if (this._view) {
            this._view.webview.html = this._getHtmlForWebview(this._view.webview);
        }
    }

    private _postMessage(message: object) {
        this._view?.webview.postMessage(message);
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'extensions', 'icecode-ai', 'media', 'style.css')
        );

        const config = vscode.workspace.getConfiguration('icecode-ai');
        const theme = config.get<string>('theme', 'dark');
        const fontSize = config.get<number>('fontSize', 14);

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="${styleUri}">
    <style>
        :root {
            --font-size: ${fontSize}px;
            --bg-primary: ${theme === 'dark' ? '#0B1A2E' : '#F0F4F8'};
            --bg-secondary: ${theme === 'dark' ? '#112240' : '#FFFFFF'};
            --bg-input: ${theme === 'dark' ? '#1A2F4E' : '#E2E8F0'};
            --text-primary: ${theme === 'dark' ? '#E2E8F0' : '#1A202C'};
            --text-secondary: ${theme === 'dark' ? '#8892B0' : '#718096'};
            --accent: ${theme === 'dark' ? '#00D4FF' : '#0099FF'};
            --accent-hover: ${theme === 'dark' ? '#00B8D9' : '#0077CC'};
            --border: ${theme === 'dark' ? '#1E3A5F' : '#CBD5E0'};
            --code-bg: ${theme === 'dark' ? '#0D2137' : '#EDF2F7'};
            --error: #FF6B6B;
            --success: #00D68F;
        }
    </style>
</head>
<body>
    <div id="app">
        <div id="header">
            <div class="header-left">
                <svg width="20" height="20" viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="128" cy="128" r="60" stroke="var(--accent)" stroke-width="8" fill="none"/>
                    <line x1="128" y1="68" x2="128" y2="188" stroke="var(--accent)" stroke-width="4"/>
                    <line x1="76" y1="98" x2="180" y2="158" stroke="var(--accent)" stroke-width="4"/>
                    <line x1="76" y1="158" x2="180" y2="98" stroke="var(--accent)" stroke-width="4"/>
                    <circle cx="128" cy="128" r="8" fill="var(--accent)"/>
                </svg>
                <span class="header-title">IceCode AI</span>
            </div>
            <button id="newSessionBtn" class="icon-btn" title="New Session">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 12.5a5.5 5.5 0 110-11 5.5 5.5 0 010 11zm3-5.5a.75.75 0 01-.75.75H8.75v1.5a.75.75 0 01-1.5 0v-1.5H5.75a.75.75 0 010-1.5h1.5v-1.5a.75.75 0 011.5 0v1.5h1.5A.75.75 0 0111 8z"/>
                </svg>
            </button>
        </div>

        <div id="messages"></div>

        <div id="input-area">
            <div id="input-container">
                <textarea id="messageInput" placeholder="Ask IceCode AI..." rows="1"></textarea>
                <button id="sendBtn" class="send-btn" title="Send">
                    <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M1 8l14-7-7 14v-7H1z"/>
                    </svg>
                </button>
            </div>
            <div class="input-footer">
                <span class="model-indicator">Claude Code</span>
                <span class="shortcut-hint">Ctrl+Enter to send</span>
            </div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        const messagesEl = document.getElementById('messages');
        const inputEl = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendBtn');
        const newSessionBtn = document.getElementById('newSessionBtn');
        let isLoading = false;
        let currentStreamContent = '';

        function scrollToBottom() {
            messagesEl.scrollTop = messagesEl.scrollHeight;
        }

        function createMessageEl(msg) {
            const div = document.createElement('div');
            div.className = 'message ' + (msg.role === 'user' ? 'user-message' : 'assistant-message');

            const avatar = document.createElement('div');
            avatar.className = 'avatar';
            avatar.textContent = msg.role === 'user' ? 'U' : 'AI';

            const content = document.createElement('div');
            content.className = 'message-content';

            if (msg.role === 'assistant') {
                renderMarkdown(content, msg.content);
            } else {
                content.textContent = msg.content;
            }

            div.appendChild(avatar);
            div.appendChild(content);
            return div;
        }

        function renderMarkdown(el, text) {
            let html = text
                .replace(/\\\`\\\`\\\`([\\s\\S]*?)\\\`\\\`\\\`/g, '<pre><code>$1</code></pre>')
                .replace(/\`([^\`]+)\`/g, '<code class="inline-code">$1</code>')
                .replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>')
                .replace(/\\*(.*?)\\*/g, '<em>$1</em>')
                .replace(/^### (.*$)/gm, '<h4>$1</h4>')
                .replace(/^## (.*$)/gm, '<h3>$1</h3>')
                .replace(/^# (.*$)/gm, '<h2>$1</h2>')
                .replace(/\\n/g, '<br>');
            el.innerHTML = html;

            el.querySelectorAll('pre code').forEach(block => {
                const wrapper = document.createElement('div');
                wrapper.className = 'code-block';
                const header = document.createElement('div');
                header.className = 'code-header';
                const copyBtn = document.createElement('button');
                copyBtn.className = 'copy-btn';
                copyBtn.textContent = 'Copy';
                copyBtn.onclick = () => {
                    navigator.clipboard.writeText(block.textContent);
                    copyBtn.textContent = 'Copied!';
                    setTimeout(() => copyBtn.textContent = 'Copy', 2000);
                };
                const insertBtn = document.createElement('button');
                insertBtn.className = 'insert-btn';
                insertBtn.textContent = 'Insert';
                insertBtn.onclick = () => {
                    vscode.postMessage({ type: 'insertCode', value: block.textContent });
                };
                header.appendChild(copyBtn);
                header.appendChild(insertBtn);
                block.parentNode.insertBefore(wrapper, block);
                wrapper.appendChild(header);
                wrapper.appendChild(block);
            });
        }

        function addMessage(msg) {
            const el = createMessageEl(msg);
            messagesEl.appendChild(el);
            scrollToBottom();
        }

        function addStreamPlaceholder() {
            const div = document.createElement('div');
            div.className = 'message assistant-message streaming';
            div.id = 'streaming-msg';

            const avatar = document.createElement('div');
            avatar.className = 'avatar';
            avatar.textContent = 'AI';

            const content = document.createElement('div');
            content.className = 'message-content';
            content.id = 'streaming-content';

            const cursor = document.createElement('span');
            cursor.className = 'cursor';
            cursor.textContent = '|';

            div.appendChild(avatar);
            div.appendChild(content);
            div.appendChild(cursor);
            messagesEl.appendChild(div);
            scrollToBottom();
        }

        function updateStreamContent(chunk) {
            currentStreamContent += chunk;
            const content = document.getElementById('streaming-content');
            if (content) {
                renderMarkdown(content, currentStreamContent);
                scrollToBottom();
            }
        }

        function finalizeStream(fullContent) {
            const streamMsg = document.getElementById('streaming-msg');
            if (streamMsg) {
                streamMsg.remove();
            }
            addMessage({ role: 'assistant', content: fullContent, timestamp: Date.now() });
            currentStreamContent = '';
        }

        function setLoading(loading) {
            isLoading = loading;
            sendBtn.disabled = loading;
            inputEl.disabled = loading;
            if (loading) {
                sendBtn.classList.add('loading');
            } else {
                sendBtn.classList.remove('loading');
            }
        }

        function sendMessage() {
            const text = inputEl.value.trim();
            if (!text || isLoading) return;
            inputEl.value = '';
            inputEl.style.height = 'auto';
            vscode.postMessage({ type: 'sendMessage', value: text });
        }

        sendBtn.addEventListener('click', sendMessage);

        inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                sendMessage();
            }
        });

        inputEl.addEventListener('input', () => {
            inputEl.style.height = 'auto';
            inputEl.style.height = Math.min(inputEl.scrollHeight, 150) + 'px';
        });

        newSessionBtn.addEventListener('click', () => {
            vscode.postMessage({ type: 'newSession' });
        });

        window.addEventListener('message', (event) => {
            const data = event.data;
            switch (data.type) {
                case 'userMessage':
                    addMessage(data.value);
                    break;
                case 'assistantMessage':
                    finalizeStream(data.value.content);
                    break;
                case 'streamChunk':
                    if (!document.getElementById('streaming-msg')) {
                        addStreamPlaceholder();
                    }
                    updateStreamContent(data.value);
                    break;
                case 'setLoading':
                    setLoading(data.value);
                    break;
                case 'error':
                    const errDiv = document.createElement('div');
                    errDiv.className = 'error-message';
                    errDiv.textContent = 'Error: ' + data.value;
                    messagesEl.appendChild(errDiv);
                    scrollToBottom();
                    break;
                case 'clearChat':
                    messagesEl.innerHTML = '';
                    currentStreamContent = '';
                    break;
                case 'externalText':
                    inputEl.value = data.value;
                    inputEl.focus();
                    break;
            }
        });

        inputEl.focus();
    </script>
</body>
</html>`;
    }
}
