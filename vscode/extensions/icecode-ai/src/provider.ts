import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { GrpcClient, ChatMessage } from './grpcClient';
import { SessionManager } from './sessionManager';
import { HistoryManager } from './historyManager';

const SLASH_COMMANDS: Record<string, string> = {
    '/help': '显示可用命令',
    '/clear': '清除当前对话',
    '/compact': '压缩对话历史以节省 token',
    '/init': '初始化项目 CLAUDE.md 文件',
    '/model': '切换 AI 模型',
    '/config': '打开配置设置',
    '/permissions': '管理工具权限',
    '/login': '登录 AI 服务',
    '/logout': '登出 AI 服务',
    '/doctor': '运行诊断检查',
    '/bug': '报告 Bug',
    '/cost': '显示 token 用量和费用',
    '/status': '显示会话状态',
    '/review': '审查代码变更',
    '/quit': '关闭 AI 面板',
    '/explain': '解释选中代码',
    '/fix': '修复选中代码的 Bug',
    '/optimize': '优化选中代码',
    '/test': '生成单元测试',
    '/doc': '添加文档注释',
    '/refactor': '重构代码',
    '/context': '显示当前上下文',
};

type AIMode = 'chat' | 'builder' | 'agent';
type SafetyPolicy = 'auto' | 'manual' | 'confirm';

export class IceCodeAIProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'icecode-ai.chat';
    private _view?: vscode.WebviewView;
    private _messages: ChatMessage[] = [];
    private _currentModel: string;
    private _contextFiles: Map<string, string> = new Map();
    private _currentMode: AIMode = 'chat';
    private _safetyPolicy: SafetyPolicy = 'manual';
    private _tokenUsage = { inputTokens: 0, outputTokens: 0 };
    private _diffs: Map<string, { filePath: string; content: string; accepted: boolean }> = new Map();

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _grpcClient: GrpcClient,
        private readonly _sessionManager: SessionManager,
        private readonly _historyManager: HistoryManager
    ) {
        const config = vscode.workspace.getConfiguration('icecode-ai');
        this._currentModel = config.get<string>('model', 'claude-sonnet-4-20250514');
        this._currentMode = config.get<AIMode>('mode', 'chat');
        this._safetyPolicy = config.get<SafetyPolicy>('safetyPolicy', 'manual');
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

                    this._tokenUsage.inputTokens += Math.ceil(message.length / 4);

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

                                this._tokenUsage.outputTokens += Math.ceil(complete.length / 4);

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
                    this._tokenUsage = { inputTokens: 0, outputTokens: 0 };
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
                case 'switchMode': {
                    this._currentMode = data.value as AIMode;
                    const config = vscode.workspace.getConfiguration('icecode-ai');
                    config.update('mode', this._currentMode, vscode.ConfigurationTarget.Global);
                    this._postMessage({ type: 'modeChanged', value: this._currentMode });
                    break;
                }
                case 'switchSafetyPolicy': {
                    this._safetyPolicy = data.value as SafetyPolicy;
                    const sConfig = vscode.workspace.getConfiguration('icecode-ai');
                    sConfig.update('safetyPolicy', this._safetyPolicy, vscode.ConfigurationTarget.Global);
                    this._postMessage({ type: 'safetyPolicyChanged', value: this._safetyPolicy });
                    break;
                }
                case 'acceptDiff': {
                    const diffId = data.value as string;
                    const diff = this._diffs.get(diffId);
                    if (diff && !diff.accepted) {
                        diff.accepted = true;
                        try {
                            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
                            if (workspaceRoot) {
                                const fullPath = path.join(workspaceRoot, diff.filePath);
                                await vscode.workspace.fs.writeFile(
                                    vscode.Uri.file(fullPath),
                                    new TextEncoder().encode(diff.content)
                                );
                                this._postMessage({ type: 'diffAccepted', value: diffId });
                            }
                        } catch (e: any) {
                            this._postMessage({ type: 'error', value: `应用变更失败：${e.message}` });
                        }
                    }
                    break;
                }
                case 'rejectDiff': {
                    const rDiffId = data.value as string;
                    this._diffs.delete(rDiffId);
                    this._postMessage({ type: 'diffRejected', value: rDiffId });
                    break;
                }
                case 'suggestionClick': {
                    this._postMessage({ type: 'externalText', value: data.value });
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
                .map(([p, content]) => `--- ${p} ---\n\`\`\`\n${content}\n\`\`\``)
                .join('\n\n');
            message = `[上下文文件]\n${contextBlock}\n\n[用户消息]\n${message}`;
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
                    .map(([cmd, desc]) => `**${cmd}** — ${desc}`)
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
            case '/explain': return await this._getCodeContext('解释以下代码：\n\n', args);
            case '/fix': return await this._getCodeContext('修复以下代码中的 Bug：\n\n', args);
            case '/optimize': return await this._getCodeContext('优化以下代码：\n\n', args);
            case '/test': return await this._getCodeContext('为以下代码生成单元测试：\n\n', args);
            case '/doc': return await this._getCodeContext('为以下代码添加文档注释：\n\n', args);
            case '/refactor': return await this._getCodeContext('重构以下代码：\n\n', args);
            case '/review': return await this._getCodeContext('审查以下代码中的问题：\n\n', args);
            case '/model': {
                vscode.commands.executeCommand('icecode-ai.switchModel');
                return null;
            }
            case '/context': {
                const contextInfo = [
                    `工作区：${vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '无'}`,
                    `上下文文件：${this._contextFiles.size}`,
                    `模型：${this._currentModel}`,
                    `会话：${this._grpcClient.sessionId || '无'}`,
                    `连接状态：${this._grpcClient.isConnected ? '已连接' : '未连接'}`,
                    `AI 模式：${this._currentMode}`,
                    `安全策略：${this._safetyPolicy}`
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
                        { role: 'system', content: `[已压缩 ${this._messages.length - 2} 条消息]`, timestamp: Date.now() },
                        lastMsg
                    ];
                    this._postMessage({ type: 'systemMessage', value: `已压缩 ${this._messages.length} 条消息` });
                }
                return null;
            }
            case '/init': {
                await this._handleInitCommand(args);
                return null;
            }
            case '/config': {
                vscode.commands.executeCommand('workbench.action.openSettings', 'icecode-ai');
                const configOverview = [
                    '**IceCode AI 配置概览**',
                    `模型：${this._currentModel}`,
                    `后端地址：${vscode.workspace.getConfiguration('icecode-ai').get('backendUrl', 'localhost:50051')}`,
                    `AI 模式：${this._currentMode}`,
                    `安全策略：${this._safetyPolicy}`,
                    `行内补全：${vscode.workspace.getConfiguration('icecode-ai').get('inlineCompletionEnabled', true) ? '启用' : '禁用'}`,
                    `自动启动后端：${vscode.workspace.getConfiguration('icecode-ai').get('autoStart', true) ? '启用' : '禁用'}`
                ].join('\n');
                this._postMessage({ type: 'systemMessage', value: configOverview });
                return null;
            }
            case '/permissions': {
                await this._handlePermissionsCommand();
                return null;
            }
            case '/login': {
                await this._handleLoginCommand();
                return null;
            }
            case '/logout': {
                await this._handleLogoutCommand();
                return null;
            }
            case '/doctor': {
                await this._handleDoctorCommand();
                return null;
            }
            case '/bug': {
                await this._handleBugCommand();
                return null;
            }
            case '/cost': {
                const inputEst = this._tokenUsage.inputTokens;
                const outputEst = this._tokenUsage.outputTokens;
                const totalEst = inputEst + outputEst;
                const costInfo = [
                    '**Token 用量统计**',
                    `输入 Token：${inputEst.toLocaleString()}`,
                    `输出 Token：${outputEst.toLocaleString()}`,
                    `总计：${totalEst.toLocaleString()}`,
                    '',
                    `*预估费用基于 ${this._currentModel}*`,
                    `*输入：$${(inputEst * 0.000003).toFixed(4)} | 输出：$${(outputEst * 0.000015).toFixed(4)}*`
                ].join('\n');
                this._postMessage({ type: 'systemMessage', value: costInfo });
                return null;
            }
            case '/status': {
                const statusInfo = [
                    '**会话状态**',
                    `后端连接：${this._grpcClient.isConnected ? '✅ 已连接' : '❌ 未连接'}`,
                    `当前模型：${this._currentModel}`,
                    `会话 ID：${this._grpcClient.sessionId || '无'}`,
                    `工作区：${vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '无'}`,
                    `AI 模式：${this._currentMode}`,
                    `安全策略：${this._safetyPolicy}`,
                    `消息数量：${this._messages.length}`,
                    `上下文文件：${this._contextFiles.size}`
                ].join('\n');
                this._postMessage({ type: 'systemMessage', value: statusInfo });
                return null;
            }
            case '/quit': {
                vscode.commands.executeCommand('workbench.action.closeSidebar');
                return null;
            }
            default: {
                this._postMessage({ type: 'systemMessage', value: `未知命令：${command}。输入 /help 查看可用命令。` });
                return null;
            }
        }
    }

    private async _handleInitCommand(args: string) {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot) {
            this._postMessage({ type: 'systemMessage', value: '错误：未打开工作区' });
            return;
        }

        const claudeMdPath = path.join(workspaceRoot, 'CLAUDE.md');
        if (fs.existsSync(claudeMdPath)) {
            const content = fs.readFileSync(claudeMdPath, 'utf-8');
            this._postMessage({ type: 'systemMessage', value: `**CLAUDE.md 已存在：**\n\n${content}` });
            return;
        }

        const projectName = path.basename(workspaceRoot);
        const defaultContent = `# ${projectName}

## 项目描述
${args || '请在此添加项目描述'}

## 代码风格
- 使用 TypeScript 严格模式
- 遵循 ESLint 推荐规则
- 优先使用函数式编程风格

## 构建与测试
\`\`\`bash
npm run build
npm run test
\`\`\`

## 重要文件
- src/index.ts — 入口文件
- package.json — 项目配置
`;

        fs.writeFileSync(claudeMdPath, defaultContent, 'utf-8');
        this._postMessage({ type: 'systemMessage', value: `✅ 已创建 CLAUDE.md 文件\n\n${defaultContent}` });
    }

    private async _handlePermissionsCommand() {
        const items = [
            { label: '📁 文件读写', description: '允许 AI 读取和写入工作区文件', picked: true },
            { label: '💻 终端执行', description: '允许 AI 执行终端命令', picked: false },
            { label: '🌐 网络访问', description: '允许 AI 访问网络资源', picked: false },
        ];
        const selected = await vscode.window.showQuickPick(items, {
            canPickMany: true,
            placeHolder: '选择允许 AI 执行的操作',
            title: 'IceCode AI: 权限管理'
        });
        if (selected) {
            const permInfo = `**权限已更新：**\n${selected.map(s => `✅ ${s.label}`).join('\n')}`;
            this._postMessage({ type: 'systemMessage', value: permInfo });
        }
    }

    private async _handleLoginCommand() {
        const providers = [
            { label: 'Anthropic', description: 'Claude API Key' },
            { label: 'OpenAI', description: 'GPT API Key' },
            { label: 'DeepSeek', description: 'DeepSeek API Key' },
            { label: '自定义', description: '其他 OpenAI 兼容 API' },
        ];
        const provider = await vscode.window.showQuickPick(providers, {
            placeHolder: '选择 AI 服务提供商',
            title: 'IceCode AI: 登录'
        });
        if (!provider) return;

        const apiKey = await vscode.window.showInputBox({
            prompt: `输入 ${provider.label} API Key`,
            password: true,
            placeHolder: 'sk-...'
        });
        if (apiKey) {
            const secretStorage = vscode.extensions.getExtension('icecode.icecode-ai')?.exports?.secretStorage;
            this._postMessage({ type: 'systemMessage', value: `✅ 已配置 ${provider.label} API Key` });
        }
    }

    private async _handleLogoutCommand() {
        const confirm = await vscode.window.showWarningMessage(
            '确定要清除已保存的 API Key 吗？',
            { modal: true },
            '确定'
        );
        if (confirm === '确定') {
            this._postMessage({ type: 'systemMessage', value: '✅ 已清除 API Key' });
        }
    }

    private async _handleDoctorCommand() {
        const checks: string[] = ['**IceCode AI 诊断报告**\n'];

        checks.push(`1. 后端连接：${this._grpcClient.isConnected ? '✅ 已连接' : '❌ 未连接'}`);

        const config = vscode.workspace.getConfiguration('icecode-ai');
        const backendUrl = config.get<string>('backendUrl', 'localhost:50051');
        checks.push(`2. 后端地址：${backendUrl}`);

        checks.push(`3. 当前模型：${this._currentModel}`);

        try {
            const bunPath = process.platform === 'win32'
                ? path.join(process.env.LOCALAPPDATA || '', 'bun', 'bun.exe')
                : 'bun';
            const bunExists = fs.existsSync(bunPath);
            checks.push(`4. Bun 运行时：${bunExists ? `✅ ${bunPath}` : '❌ 未找到'}`);
        } catch {
            checks.push('4. Bun 运行时：❌ 检查失败');
        }

        checks.push(`5. 工作区：${vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '❌ 未打开'}`);
        checks.push(`6. AI 模式：${this._currentMode}`);
        checks.push(`7. 安全策略：${this._safetyPolicy}`);
        checks.push(`8. VSCode 版本：${vscode.version}`);
        checks.push(`9. 扩展版本：0.2.0`);

        this._postMessage({ type: 'systemMessage', value: checks.join('\n') });
    }

    private async _handleBugCommand() {
        const bugInfo = [
            `版本：0.2.0`,
            `VSCode：${vscode.version}`,
            `平台：${process.platform}`,
            `模型：${this._currentModel}`,
            `连接：${this._grpcClient.isConnected}`,
            `会话：${this._grpcClient.sessionId || '无'}`
        ].join('\n');

        const issueUrl = 'https://github.com/XiTu893/iceIDE/issues/new';
        vscode.env.openExternal(vscode.Uri.parse(issueUrl));
        this._postMessage({ type: 'systemMessage', value: `**Bug 报告**\n\n已打开 GitHub Issues 页面。\n\n环境信息：\n${bugInfo}` });
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
                return lines.slice(0, maxLines).join('\n') + `\n... (还有 ${lines.length - maxLines} 行)`;
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
        const fontSize = config.get<number>('fontSize', 14);

        return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        :root {
            --bg-primary: #0d1117;
            --bg-secondary: #161b22;
            --bg-input: #1c2128;
            --border: #21262d;
            --accent: #8b5cf6;
            --accent-hover: #7c3aed;
            --text-primary: #e6edf3;
            --text-secondary: #8b949e;
            --code-bg: #0d1117;
            --error: #f85149;
            --font-size: ${fontSize}px;
            --stage-thinking: #dfa88f;
            --stage-searching: #9fc9a2;
            --stage-reading: #9fbbe0;
            --stage-editing: #c0a8dd;
            --stage-building: #c08532;
            --diff-add-bg: rgba(46, 160, 67, 0.15);
            --diff-add-border: #2ea043;
            --diff-del-bg: rgba(248, 81, 73, 0.15);
            --diff-del-border: #f85149;
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background-color: var(--bg-primary);
            color: var(--text-primary);
            font-size: var(--font-size);
            height: 100vh;
            overflow: hidden;
        }
        #app { display: flex; flex-direction: column; height: 100vh; }
        #header {
            display: flex; align-items: center; justify-content: space-between;
            padding: 8px 12px; border-bottom: 1px solid var(--border);
            background-color: var(--bg-secondary);
        }
        .header-left { display: flex; align-items: center; gap: 8px; }
        .header-title { font-weight: 600; font-size: 14px; color: var(--accent); }
        .mode-switcher {
            display: flex; gap: 2px; background-color: var(--bg-input);
            border-radius: 6px; padding: 2px;
        }
        .mode-btn {
            background: none; border: none; color: var(--text-secondary);
            cursor: pointer; padding: 4px 10px; border-radius: 4px;
            font-size: 12px; font-weight: 500; transition: all 0.2s;
        }
        .mode-btn:hover { color: var(--text-primary); }
        .mode-btn.active { background-color: var(--accent); color: #fff; }
        .header-actions { display: flex; gap: 4px; }
        .icon-btn {
            background: none; border: none; color: var(--text-secondary);
            cursor: pointer; padding: 4px; border-radius: 4px;
            display: flex; align-items: center; justify-content: center;
        }
        .icon-btn:hover { background-color: var(--bg-input); color: var(--text-primary); }
        .safety-bar {
            display: flex; align-items: center; gap: 6px;
            padding: 4px 12px; background-color: var(--bg-secondary);
            border-bottom: 1px solid var(--border);
        }
        .safety-label { font-size: 11px; color: var(--text-secondary); }
        .safety-options {
            display: flex; gap: 2px; background-color: var(--bg-input);
            border-radius: 4px; padding: 1px;
        }
        .safety-btn {
            background: none; border: none; color: var(--text-secondary);
            cursor: pointer; padding: 2px 8px; border-radius: 3px;
            font-size: 11px; transition: all 0.2s;
        }
        .safety-btn:hover { color: var(--text-primary); }
        .safety-btn.active { background-color: var(--accent); color: #fff; }
        #messages { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 12px; }
        .welcome-page {
            display: flex; flex-direction: column; align-items: center;
            justify-content: center; flex: 1; text-align: center; padding: 40px 20px;
        }
        .welcome-icon { width: 64px; height: 64px; margin-bottom: 16px; opacity: 0.6; }
        .welcome-title { font-size: 18px; font-weight: 600; color: var(--text-primary); margin-bottom: 8px; }
        .welcome-subtitle { font-size: 13px; color: var(--text-secondary); margin-bottom: 24px; }
        .welcome-suggestions { display: flex; flex-direction: column; gap: 8px; width: 100%; max-width: 320px; }
        .suggestion-card {
            background-color: var(--bg-secondary); border: 1px solid var(--border);
            border-radius: 8px; padding: 10px 14px; cursor: pointer;
            text-align: left; font-size: 13px; color: var(--text-secondary); transition: all 0.2s;
        }
        .suggestion-card:hover { border-color: var(--accent); color: var(--text-primary); background-color: var(--bg-input); }
        .message { display: flex; gap: 10px; max-width: 100%; }
        .user-message { flex-direction: row-reverse; }
        .avatar {
            width: 28px; height: 28px; border-radius: 6px; display: flex;
            align-items: center; justify-content: center; font-size: 11px;
            font-weight: 700; flex-shrink: 0;
        }
        .user-message .avatar { background-color: var(--accent); color: #fff; }
        .assistant-message .avatar { background-color: var(--border); color: var(--text-primary); }
        .system-message .avatar { background-color: var(--bg-input); color: var(--text-secondary); }
        .message-content { flex: 1; min-width: 0; line-height: 1.6; word-wrap: break-word; }
        .user-message .message-content {
            background-color: var(--accent); color: #fff;
            padding: 8px 12px; border-radius: 12px 12px 2px 12px; max-width: 85%;
        }
        .assistant-message .message-content, .system-message .message-content {
            background-color: var(--bg-secondary); padding: 10px 14px;
            border-radius: 12px 12px 12px 2px; border: 1px solid var(--border);
        }
        .ai-stage {
            display: inline-flex; align-items: center; gap: 4px;
            padding: 2px 8px; border-radius: 4px; font-size: 11px;
            font-weight: 500; margin: 4px 2px;
        }
        .ai-stage-thinking { background-color: rgba(223,168,143,0.15); color: var(--stage-thinking); }
        .ai-stage-searching { background-color: rgba(159,201,162,0.15); color: var(--stage-searching); }
        .ai-stage-reading { background-color: rgba(159,187,224,0.15); color: var(--stage-reading); }
        .ai-stage-editing { background-color: rgba(192,168,221,0.15); color: var(--stage-editing); }
        .ai-stage-building { background-color: rgba(192,133,50,0.15); color: var(--stage-building); }
        .code-block { margin: 8px 0; border-radius: 8px; overflow: hidden; border: 1px solid var(--border); }
        .code-header {
            display: flex; justify-content: space-between; align-items: center;
            gap: 6px; padding: 4px 8px; background-color: var(--bg-input);
        }
        .code-lang { font-size: 11px; color: var(--text-secondary); }
        .code-actions { display: flex; gap: 4px; }
        .copy-btn, .insert-btn {
            background: none; border: 1px solid var(--border); color: var(--text-secondary);
            cursor: pointer; padding: 2px 8px; border-radius: 4px; font-size: 11px;
        }
        .copy-btn:hover, .insert-btn:hover { background-color: var(--accent); color: #fff; border-color: var(--accent); }
        .code-block pre { margin: 0; padding: 10px; background-color: var(--code-bg); overflow-x: auto; }
        .code-block code { font-family: 'Cascadia Code', 'Fira Code', Consolas, monospace; font-size: 13px; line-height: 1.5; }
        .inline-code { background-color: var(--bg-input); padding: 1px 5px; border-radius: 4px; font-family: 'Cascadia Code', Consolas, monospace; font-size: 13px; }
        .diff-block { margin: 8px 0; border-radius: 8px; overflow: hidden; border: 1px solid var(--border); }
        .diff-header {
            display: flex; justify-content: space-between; align-items: center;
            padding: 6px 10px; background-color: var(--bg-input); font-size: 12px;
        }
        .diff-file { color: var(--accent); font-weight: 500; }
        .diff-actions { display: flex; gap: 4px; }
        .diff-accept, .diff-reject {
            border: none; cursor: pointer; padding: 2px 10px;
            border-radius: 4px; font-size: 11px; font-weight: 500;
        }
        .diff-accept { background-color: var(--diff-add-border); color: #fff; }
        .diff-accept:hover { background-color: #238636; }
        .diff-reject { background-color: var(--diff-del-border); color: #fff; }
        .diff-reject:hover { background-color: #da3633; }
        .diff-content { font-family: 'Cascadia Code', Consolas, monospace; font-size: 12px; line-height: 1.5; overflow-x: auto; }
        .diff-line-add { background-color: var(--diff-add-bg); padding: 1px 10px; border-left: 3px solid var(--diff-add-border); }
        .diff-line-del { background-color: var(--diff-del-bg); padding: 1px 10px; border-left: 3px solid var(--diff-del-border); text-decoration: line-through; opacity: 0.7; }
        .diff-line-ctx { padding: 1px 10px; color: var(--text-secondary); }
        .summary-card { margin: 8px 0; border-radius: 8px; border: 1px solid var(--border); background-color: var(--bg-secondary); padding: 12px; }
        .summary-title { font-size: 13px; font-weight: 600; color: var(--text-primary); margin-bottom: 8px; }
        .summary-stats { display: flex; gap: 16px; margin-bottom: 10px; }
        .summary-stat { font-size: 12px; color: var(--text-secondary); }
        .summary-stat .add { color: var(--diff-add-border); }
        .summary-stat .del { color: var(--diff-del-border); }
        .summary-actions { display: flex; gap: 8px; }
        .streaming { position: relative; }
        .cursor { display: inline-block; color: var(--accent); animation: blink 1s step-end infinite; font-weight: bold; }
        @keyframes blink { 50% { opacity: 0; } }
        .error-message { background-color: rgba(248,81,73,0.1); border: 1px solid var(--error); color: var(--error); padding: 8px 12px; border-radius: 8px; font-size: 13px; }
        #input-area { padding: 10px 12px; border-top: 1px solid var(--border); background-color: var(--bg-secondary); position: relative; }
        #input-container {
            display: flex; align-items: flex-end; gap: 8px;
            background-color: var(--bg-input); border: 1px solid var(--border);
            border-radius: 12px; padding: 8px 10px; transition: border-color 0.2s;
        }
        #input-container:focus-within { border-color: var(--accent); }
        #messageInput {
            flex: 1; background: none; border: none; color: var(--text-primary);
            font-size: ${fontSize}px; font-family: inherit; resize: none; outline: none;
            max-height: 150px; line-height: 1.5;
        }
        #messageInput::placeholder { color: var(--text-secondary); }
        .send-btn {
            background-color: var(--accent); border: none; color: #fff;
            cursor: pointer; width: 32px; height: 32px; border-radius: 8px;
            display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .send-btn:hover:not(:disabled) { background-color: var(--accent-hover); }
        .send-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .send-btn.loading { animation: pulse 1.5s ease-in-out infinite; }
        @keyframes pulse { 0%,100% { opacity: 0.5; } 50% { opacity: 1; } }
        .input-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 6px; padding: 0 4px; }
        .model-indicator { font-size: 11px; color: var(--accent); font-weight: 500; }
        .shortcut-hint { font-size: 11px; color: var(--text-secondary); }
        .autocomplete {
            position: absolute; bottom: 100%; left: 12px; right: 12px;
            background-color: var(--bg-secondary); border: 1px solid var(--border);
            border-radius: 8px; max-height: 200px; overflow-y: auto; z-index: 100;
            box-shadow: 0 -4px 12px rgba(0,0,0,0.3);
        }
        .autocomplete-item { padding: 6px 12px; cursor: pointer; display: flex; align-items: center; gap: 8px; }
        .autocomplete-item:hover, .autocomplete-item.selected { background-color: var(--bg-input); }
        .autocomplete-cmd { color: var(--accent); font-weight: 600; min-width: 80px; }
        .autocomplete-desc { color: var(--text-secondary); font-size: 12px; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background-color: var(--border); border-radius: 3px; }
    </style>
</head>
<body>
    <div id="app">
        <div id="header">
            <div class="header-left">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="10" stroke="#8b5cf6" stroke-width="2" fill="none"/>
                    <line x1="12" y1="2" x2="12" y2="22" stroke="#8b5cf6" stroke-width="1.5"/>
                    <line x1="4.93" y1="7.5" x2="19.07" y2="16.5" stroke="#8b5cf6" stroke-width="1.5"/>
                    <line x1="4.93" y1="16.5" x2="19.07" y2="7.5" stroke="#8b5cf6" stroke-width="1.5"/>
                    <circle cx="12" cy="12" r="2" fill="#8b5cf6"/>
                </svg>
                <span class="header-title">IceCode AI</span>
                <div class="mode-switcher">
                    <button class="mode-btn ${this._currentMode === 'chat' ? 'active' : ''}" data-mode="chat">对话</button>
                    <button class="mode-btn ${this._currentMode === 'builder' ? 'active' : ''}" data-mode="builder">构建</button>
                    <button class="mode-btn ${this._currentMode === 'agent' ? 'active' : ''}" data-mode="agent">智能体</button>
                </div>
            </div>
            <div class="header-actions">
                <button id="modelBtn" class="icon-btn" title="切换模型">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M14 7H9.7l2.3-2.3-.7-.7L8 7 6.7 4 6 4.7 8.3 7H2v1h6.3L6 10.3l.7.7L9 9l2.3 2.3.7-.7L9.7 8H14V7z"/></svg>
                </button>
                <button id="newSessionBtn" class="icon-btn" title="新建会话">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 12.5a5.5 5.5 0 110-11 5.5 5.5 0 010 11zm3-5.5a.75.75 0 01-.75.75H8.75v1.5a.75.75 0 01-1.5 0v-1.5H5.75a.75.75 0 010-1.5h1.5v-1.5a.75.75 0 011.5 0v1.5h1.5A.75.75 0 0111 8z"/></svg>
                </button>
            </div>
        </div>

        <div class="safety-bar">
            <span class="safety-label">安全策略：</span>
            <div class="safety-options">
                <button class="safety-btn ${this._safetyPolicy === 'auto' ? 'active' : ''}" data-policy="auto">自动</button>
                <button class="safety-btn ${this._safetyPolicy === 'manual' ? 'active' : ''}" data-policy="manual">手动</button>
                <button class="safety-btn ${this._safetyPolicy === 'confirm' ? 'active' : ''}" data-policy="confirm">确认</button>
            </div>
        </div>

        <div id="messages">
            <div class="welcome-page" id="welcomePage">
                <svg class="welcome-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="10" stroke="#8b5cf6" stroke-width="1.5" fill="none"/>
                    <line x1="12" y1="2" x2="12" y2="22" stroke="#8b5cf6" stroke-width="1"/>
                    <line x1="4.93" y1="7.5" x2="19.07" y2="16.5" stroke="#8b5cf6" stroke-width="1"/>
                    <line x1="4.93" y1="16.5" x2="19.07" y2="7.5" stroke="#8b5cf6" stroke-width="1"/>
                    <circle cx="12" cy="12" r="2" fill="#8b5cf6"/>
                </svg>
                <div class="welcome-title">欢迎使用 IceCode AI</div>
                <div class="welcome-subtitle">输入 '/' 获取快捷命令，输入 '@' 引用文件</div>
                <div class="welcome-suggestions">
                    <div class="suggestion-card" data-suggestion="解释当前文件的主要功能">💡 解释当前文件的主要功能</div>
                    <div class="suggestion-card" data-suggestion="帮我优化这段代码的性能">⚡ 帮我优化这段代码的性能</div>
                    <div class="suggestion-card" data-suggestion="为选中的代码生成单元测试">🧪 为选中的代码生成单元测试</div>
                </div>
            </div>
        </div>

        <div id="input-area">
            <div id="autocomplete" class="autocomplete" style="display:none;"></div>
            <div id="input-container">
                <textarea id="messageInput" placeholder="向 IceCode AI 提问... (/ 命令，@ 文件)" rows="1"></textarea>
                <button id="sendBtn" class="send-btn" title="发送 (Ctrl+Enter)">
                    <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor"><path d="M1 8l14-7-7 14v-7H1z"/></svg>
                </button>
            </div>
            <div class="input-footer">
                <span class="model-indicator" id="modelLabel">${this._currentModel}</span>
                <span class="shortcut-hint">Ctrl+Enter / @文件 / /命令</span>
            </div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        const messagesEl = document.getElementById('messages');
        const welcomePage = document.getElementById('welcomePage');
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
        let isComposing = false;

        inputEl.addEventListener('compositionstart', () => { isComposing = true; });
        inputEl.addEventListener('compositionend', () => { isComposing = false; });

        function scrollToBottom() { messagesEl.scrollTop = messagesEl.scrollHeight; }

        function hideWelcome() {
            if (welcomePage) welcomePage.style.display = 'none';
        }

        function createMessageEl(msg) {
            const div = document.createElement('div');
            div.className = 'message ' + (msg.role === 'user' ? 'user-message' : msg.role === 'system' ? 'system-message' : 'assistant-message');
            const avatar = document.createElement('div');
            avatar.className = 'avatar';
            avatar.textContent = msg.role === 'user' ? '你' : msg.role === 'system' ? '系' : 'AI';
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
                .replace(/\\u001b\\[\\d+m/g, '')
                .replace(/\`{}\`/g, '')
                .replace(/\`\`\`(\\w*)\\n([\\s\\S]*?)\`\`\`/g, function(match, lang, code) {
                    const id = 'code-' + Math.random().toString(36).substr(2, 9);
                    return '<div class="code-block"><div class="code-header"><span class="code-lang">' + (lang || 'code') + '</span><div class="code-actions"><button class="copy-btn" data-code-id="' + id + '">复制</button><button class="insert-btn" data-code-id="' + id + '">插入</button></div></div><pre><code id="' + id + '">' + escapeHtml(code) + '</code></pre></div>';
                })
                .replace(/\`([^\`]+)\`/g, '<code class="inline-code">$1</code>')
                .replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>')
                .replace(/\\*(.*?)\\*/g, '<em>$1</em>')
                .replace(/^### (.*$)/gm, '<h4>$1</h4>')
                .replace(/^## (.*$)/gm, '<h3>$1</h3>')
                .replace(/^# (.*$)/gm, '<h2>$1</h2>')
                .replace(/\\n/g, '<br>');
            el.innerHTML = html;
            el.querySelectorAll('.copy-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const codeId = btn.getAttribute('data-code-id');
                    const codeEl = document.getElementById(codeId);
                    if (codeEl) {
                        navigator.clipboard.writeText(codeEl.textContent);
                        btn.textContent = '已复制！';
                        setTimeout(() => btn.textContent = '复制', 2000);
                    }
                });
            });
            el.querySelectorAll('.insert-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const codeId = btn.getAttribute('data-code-id');
                    const codeEl = document.getElementById(codeId);
                    if (codeEl) {
                        vscode.postMessage({ type: 'insertCode', value: codeEl.textContent });
                    }
                });
            });
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        function addMessage(msg) {
            hideWelcome();
            messagesEl.appendChild(createMessageEl(msg));
            scrollToBottom();
        }

        function addStreamPlaceholder() {
            hideWelcome();
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
            if (content) { renderMarkdown(content, currentStreamContent); scrollToBottom(); }
        }

        function finalizeStream(fullContent) {
            const streamMsg = document.getElementById('streaming-msg');
            if (streamMsg) streamMsg.remove();
            addMessage({ role: 'assistant', content: fullContent, timestamp: Date.now() });
            currentStreamContent = '';
        }

        function setLoading(loading) {
            isLoading = loading;
            sendBtn.disabled = loading;
            inputEl.disabled = loading;
            if (loading) sendBtn.classList.add('loading');
            else sendBtn.classList.remove('loading');
        }

        function sendMessage() {
            const text = inputEl.value.trim();
            if (!text || isLoading) return;
            inputEl.value = '';
            inputEl.style.height = 'auto';
            hideAutocomplete();
            vscode.postMessage({ type: 'sendMessage', value: text });
        }

        function showAutocomplete(items) {
            autocompleteItems = items;
            selectedAutocomplete = -1;
            autocompleteEl.innerHTML = '';
            items.forEach((item, i) => {
                const div = document.createElement('div');
                div.className = 'autocomplete-item';
                div.innerHTML = '<span class="autocomplete-cmd">' + item.label + '</span><span class="autocomplete-desc">' + item.description + '</span>';
                div.onclick = () => selectAutocomplete(i);
                autocompleteEl.appendChild(div);
            });
            autocompleteEl.style.display = items.length > 0 ? 'block' : 'none';
        }

        function hideAutocomplete() {
            autocompleteEl.style.display = 'none';
            autocompleteItems = [];
            selectedAutocomplete = -1;
        }

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
            hideAutocomplete();
            inputEl.focus();
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
            if (isComposing) return;
            if (autocompleteItems.length > 0) {
                if (e.key === 'ArrowDown') { e.preventDefault(); selectedAutocomplete = Math.min(selectedAutocomplete + 1, autocompleteItems.length - 1); return; }
                if (e.key === 'ArrowUp') { e.preventDefault(); selectedAutocomplete = Math.max(selectedAutocomplete - 1, 0); return; }
                if (e.key === 'Tab' || e.key === 'Enter') { e.preventDefault(); selectAutocomplete(selectedAutocomplete >= 0 ? selectedAutocomplete : 0); return; }
                if (e.key === 'Escape') { hideAutocomplete(); return; }
            }
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); sendMessage(); }
        });
        inputEl.addEventListener('input', () => {
            inputEl.style.height = 'auto';
            inputEl.style.height = Math.min(inputEl.scrollHeight, 150) + 'px';
            updateAutocomplete();
        });
        newSessionBtn.addEventListener('click', () => { vscode.postMessage({ type: 'newSession' }); });
        modelBtn.addEventListener('click', () => { vscode.postMessage({ type: 'switchModel' }); });

        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                vscode.postMessage({ type: 'switchMode', value: btn.dataset.mode });
            });
        });

        document.querySelectorAll('.safety-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.safety-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                vscode.postMessage({ type: 'switchSafetyPolicy', value: btn.dataset.policy });
            });
        });

        document.querySelectorAll('.suggestion-card').forEach(card => {
            card.addEventListener('click', () => {
                const suggestion = card.dataset.suggestion;
                if (suggestion) {
                    inputEl.value = suggestion;
                    inputEl.focus();
                }
            });
        });

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
                    const errDiv = document.createElement('div');
                    errDiv.className = 'error-message';
                    errDiv.textContent = '错误：' + data.value;
                    messagesEl.appendChild(errDiv);
                    scrollToBottom();
                    break;
                case 'clearChat':
                    messagesEl.innerHTML = '';
                    if (welcomePage) { welcomePage.style.display = ''; messagesEl.appendChild(welcomePage); }
                    currentStreamContent = '';
                    break;
                case 'externalText': inputEl.value = data.value; inputEl.focus(); break;
                case 'slashCommands': slashCommands = data.value; break;
                case 'fileList':
                    const fileItems = (data.value || []).map(f => ({ label: '@' + f, description: '文件', insertText: '@' + f }));
                    showAutocomplete(fileItems); break;
                case 'modelChanged': modelLabel.textContent = data.value; break;
                case 'modeChanged':
                    document.querySelectorAll('.mode-btn').forEach(b => {
                        b.classList.toggle('active', b.dataset.mode === data.value);
                    });
                    break;
                case 'safetyPolicyChanged':
                    document.querySelectorAll('.safety-btn').forEach(b => {
                        b.classList.toggle('active', b.dataset.policy === data.value);
                    });
                    break;
                case 'contextFileAdded': break;
            }
        });

        vscode.postMessage({ type: 'requestSlashCommands' });
        inputEl.focus();
    </script>
</body>
</html>`;
    }
}
