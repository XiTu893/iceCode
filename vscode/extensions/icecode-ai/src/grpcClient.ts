import * as vscode from 'vscode';
import * as net from 'net';
import * as fs from 'fs';
import * as path from 'path';
import * as cp from 'child_process';

export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
}

interface GrpcRequest {
    method: string;
    payload: any;
    session_id?: string;
}

interface GrpcResponse {
    content?: string;
    error?: string;
    done?: boolean;
}

export class GrpcClient {
    private _connected: boolean = false;
    private _sessionId: string | null = null;
    private _backendProcess: cp.ChildProcess | null = null;
    private _backendUrl: string;
    private _backendCwd: string | null = null;
    private _reconnectAttempts: number = 0;
    private _maxReconnectAttempts: number = 5;

    constructor() {
        const config = vscode.workspace.getConfiguration('icecode-ai');
        this._backendUrl = config.get<string>('backendUrl', 'localhost:50051');
    }

    async connect(): Promise<void> {
        if (this._connected) return;

        try {
            await this._startBackend();
            this._connected = true;
            this._sessionId = `session-${Date.now()}`;
            this._reconnectAttempts = 0;
        } catch (error: any) {
            this._connected = false;
            throw new Error(`Failed to connect to backend: ${error.message}`);
        }
    }

    async disconnect(): Promise<void> {
        if (this._backendProcess) {
            this._backendProcess.kill();
            this._backendProcess = null;
        }
        this._connected = false;
        this._sessionId = null;
    }

    get isConnected(): boolean {
        return this._connected;
    }

    get sessionId(): string | null {
        return this._sessionId;
    }

    private async _startBackend(): Promise<void> {
        const config = vscode.workspace.getConfiguration('icecode-ai');
        if (!config.get<boolean>('autoStart', true)) {
            return;
        }

        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot) return;

        const iceCodeRoot = this._findIceCodeRoot();
        if (!iceCodeRoot) {
            throw new Error('IceCode backend not found. Please set the icecode-ai.backendPath setting.');
        }

        const bunPath = this._findBun();
        const backendScript = path.join(iceCodeRoot, 'dist', 'cli.mjs');

        if (!fs.existsSync(backendScript)) {
            throw new Error(`Backend script not found: ${backendScript}`);
        }

        this._backendProcess = cp.spawn(bunPath, ['run', backendScript, 'grpc', '--port', '50051'], {
            cwd: iceCodeRoot,
            env: { ...process.env, ICECODE_WORKSPACE: workspaceRoot },
            stdio: ['pipe', 'pipe', 'pipe']
        });

        this._backendProcess.on('error', (err) => {
            vscode.window.showErrorMessage(`IceCode backend error: ${err.message}`);
            this._connected = false;
        });

        this._backendProcess.on('exit', (code) => {
            if (code !== 0 && code !== null) {
                vscode.window.showWarningMessage(`IceCode backend exited with code ${code}`);
            }
            this._connected = false;
        });

        await this._waitForBackend(10000);
    }

    private _findIceCodeRoot(): string | null {
        const config = vscode.workspace.getConfiguration('icecode-ai');
        const configPath = config.get<string>('backendPath');
        if (configPath && fs.existsSync(configPath)) {
            return configPath;
        }

        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (workspaceRoot) {
            const candidates = [
                path.join(workspaceRoot, '..', 'iceCode'),
                path.join(workspaceRoot, 'iceCode'),
                workspaceRoot
            ];
            for (const candidate of candidates) {
                if (fs.existsSync(path.join(candidate, 'dist', 'cli.mjs'))) {
                    return candidate;
                }
            }
        }

        return null;
    }

    private _findBun(): string {
        const platform = process.platform;
        if (platform === 'win32') {
            const localBun = path.join(process.env.LOCALAPPDATA || '', 'bun', 'bun.exe');
            if (fs.existsSync(localBun)) return localBun;
            return 'bun.exe';
        }
        return 'bun';
    }

    private _waitForBackend(timeout: number): Promise<void> {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            const check = () => {
                const socket = new net.Socket();
                const [host, port] = this._backendUrl.split(':');
                socket.connect(parseInt(port || '50051'), host || 'localhost', () => {
                    socket.destroy();
                    resolve();
                });
                socket.on('error', () => {
                    socket.destroy();
                    if (Date.now() - startTime > timeout) {
                        reject(new Error('Backend connection timeout'));
                    } else {
                        setTimeout(check, 500);
                    }
                });
            };
            check();
        });
    }

    async sendMessage(
        message: string,
        onChunk: (chunk: string) => void,
        onComplete: (fullResponse: string) => void
    ): Promise<void> {
        if (!this._connected) {
            await this.connect();
        }

        try {
            const response = await fetch(`http://${this._backendUrl}/v1/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message,
                    session_id: this._sessionId,
                    stream: true
                })
            });

            if (!response.ok) {
                throw new Error(`Backend returned ${response.status}: ${response.statusText}`);
            }

            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error('No response body');
            }

            const decoder = new TextDecoder();
            let fullContent = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') continue;
                        try {
                            const parsed = JSON.parse(data);
                            if (parsed.content) {
                                fullContent += parsed.content;
                                onChunk(parsed.content);
                            }
                        } catch {
                            fullContent += data;
                            onChunk(data);
                        }
                    }
                }
            }

            onComplete(fullContent);
        } catch (error: any) {
            if (error.code === 'ECONNREFUSED' || error.message?.includes('fetch')) {
                this._connected = false;
                const simulatedResponse = this._simulateResponse(message);
                let fullContent = '';
                for (let i = 0; i < simulatedResponse.length; i += 5) {
                    const chunk = simulatedResponse.slice(i, i + 5);
                    fullContent += chunk;
                    onChunk(chunk);
                    await new Promise(r => setTimeout(r, 30));
                }
                onComplete(fullContent);
            } else {
                throw error;
            }
        }
    }

    async requestCompletion(prompt: string, languageId: string): Promise<string | null> {
        const config = vscode.workspace.getConfiguration('icecode-ai');
        const model = config.get<string>('model', 'claude-sonnet-4-20250514');

        if (!this._connected) {
            return this._simulateCompletion(prompt, languageId);
        }

        try {
            const response = await fetch(`http://${this._backendUrl}/v1/completion`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt,
                    language: languageId,
                    model,
                    max_tokens: 200,
                    temperature: 0.1,
                    stream: false
                })
            });

            if (!response.ok) {
                return null;
            }

            const data = await response.json() as any;
            return data.content || data.completion || null;
        } catch {
            return this._simulateCompletion(prompt, languageId);
        }
    }

    private _simulateCompletion(prompt: string, languageId: string): string | null {
        const lines = prompt.split('\n');
        const lastLine = lines[lines.length - 2] || '';
        const trimmed = lastLine.trim();

        if (trimmed.endsWith('{')) return '\n\t\n}';
        if (trimmed.endsWith('(')) return '\n\t\n)';
        if (trimmed.endsWith('[')) return '\n\t\n]';
        if (trimmed.endsWith('=>')) return ' {\n\t\n}';
        if (trimmed.endsWith(':')) return ' null;';
        if (trimmed.endsWith('return')) return ' null;';

        if (languageId === 'python') {
            if (trimmed.endsWith(':')) return '\n    pass';
            if (trimmed.startsWith('def ')) return ':\n    pass';
            if (trimmed.startsWith('class ')) return ':\n    pass';
        }

        if (languageId === 'typescript' || languageId === 'javascript') {
            if (trimmed.startsWith('function ')) return ' {\n\t\n}';
            if (trimmed.startsWith('const ') || trimmed.startsWith('let ')) return ' = ;';
        }

        return null;
    }

    private _simulateResponse(message: string): string {
        return `I received your message: "${message}"\n\nThe IceCode AI backend is not currently connected. To enable full AI capabilities:\n\n1. Start the Claude Code backend\n2. Configure the backend URL in settings\n3. Restart IceCode IDE\n\nFor now, I'm running in simulation mode.`;
    }
}
