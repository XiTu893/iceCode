import * as vscode from 'vscode';
import { IceCodeAIProvider } from './provider';
import { GrpcClient } from './grpcClient';
import { SessionManager } from './sessionManager';
import { InlineCompletionProvider } from './inlineCompletion';
import { CodeActionProvider } from './codeActions';
import { HistoryManager } from './historyManager';

let grpcClient: GrpcClient;
let sessionManager: SessionManager;
let aiProvider: IceCodeAIProvider;
let historyManager: HistoryManager;
let inlineCompletionProvider: InlineCompletionProvider;
let statusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
    grpcClient = new GrpcClient();
    historyManager = new HistoryManager(context);
    sessionManager = new SessionManager(grpcClient);
    aiProvider = new IceCodeAIProvider(context.extensionUri, grpcClient, sessionManager, historyManager);
    inlineCompletionProvider = new InlineCompletionProvider(grpcClient);

    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.text = '$(hubot) IceCode AI';
    statusBarItem.tooltip = '打开 IceCode AI 面板';
    statusBarItem.command = 'icecode-ai.openChat';
    statusBarItem.backgroundColor = undefined;
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    const connectionStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    connectionStatusBar.text = '$(circle-slash) 未连接';
    connectionStatusBar.tooltip = 'IceCode AI 后端连接状态';
    connectionStatusBar.show();
    context.subscriptions.push(connectionStatusBar);

    const updateConnectionStatus = () => {
        if (grpcClient.isConnected) {
            connectionStatusBar.text = '$(circle-check) AI 已连接';
            connectionStatusBar.tooltip = 'IceCode AI 后端已连接';
        } else {
            connectionStatusBar.text = '$(circle-slash) 未连接';
            connectionStatusBar.tooltip = 'IceCode AI 后端未连接';
        }
    };

    setInterval(updateConnectionStatus, 5000);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('icecode-ai.chat', aiProvider, {
            webviewOptions: { retainContextWhenHidden: true }
        })
    );

    context.subscriptions.push(
        vscode.window.registerTreeDataProvider('icecode-ai.sessions', sessionManager)
    );

    const completionProvider = vscode.languages.registerInlineCompletionItemProvider(
        { pattern: '**' },
        inlineCompletionProvider,
        { triggerCharacters: ['.', ' ', '(', '{', '[', '<', '/', '\n'] }
    );
    context.subscriptions.push(completionProvider);

    const codeActionProvider = vscode.languages.registerCodeActionsProvider(
        { pattern: '**' },
        new CodeActionProvider(),
        { providedCodeActionKinds: CodeActionProvider.providedCodeActionKinds }
    );
    context.subscriptions.push(codeActionProvider);

    context.subscriptions.push(
        vscode.commands.registerCommand('icecode-ai.openChat', () => {
            vscode.commands.executeCommand('workbench.view.extension.icecode-ai');
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('icecode-ai.newSession', async () => {
            await sessionManager.createNewSession();
            aiProvider.refresh();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('icecode-ai.sendToChat', (text?: string) => {
            const editor = vscode.window.activeTextEditor;
            const selectedText = text || (editor?.selection ? editor?.document.getText(editor.selection) : undefined);
            if (selectedText) {
                vscode.commands.executeCommand('workbench.view.extension.icecode-ai');
                aiProvider.sendToChat(selectedText);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('icecode-ai.toggleSidePanel', () => {
            vscode.commands.executeCommand('workbench.action.toggleSidebarVisibility');
        })
    );

    const codeActionCommands: [string, string][] = [
        ['icecode-ai.explainCode', '解释以下代码：\n\n'],
        ['icecode-ai.fixCode', '修复以下代码中的 Bug：\n\n'],
        ['icecode-ai.optimizeCode', '优化以下代码的性能：\n\n'],
        ['icecode-ai.addTests', '为以下代码生成单元测试：\n\n'],
        ['icecode-ai.addDocs', '为以下代码添加文档注释：\n\n'],
        ['icecode-ai.refactorCode', '重构以下代码以提高可读性和可维护性：\n\n'],
    ];

    for (const [command, prefix] of codeActionCommands) {
        context.subscriptions.push(
            vscode.commands.registerCommand(command, () => {
                const editor = vscode.window.activeTextEditor;
                if (!editor) return;
                const selection = editor.selection;
                const code = selection.isEmpty
                    ? editor.document.getText()
                    : editor.document.getText(selection);
                const fileName = editor.document.fileName;
                const languageId = editor.document.languageId;
                const prompt = `${prefix}\`\`\`${languageId} ${fileName}\n${code}\n\`\`\``;
                vscode.commands.executeCommand('workbench.view.extension.icecode-ai');
                aiProvider.sendToChat(prompt);
            })
        );
    }

    context.subscriptions.push(
        vscode.commands.registerCommand('icecode-ai.switchModel', async () => {
            const config = vscode.workspace.getConfiguration('icecode-ai');
            const models = config.inspect<string>('model')?.enum || ['claude-sonnet-4-20250514'];
            const currentModel = config.get<string>('model');
            const items = models.map(m => ({
                label: m,
                description: m === currentModel ? '当前' : undefined,
                picked: m === currentModel
            }));
            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: '选择 AI 模型',
                title: 'IceCode AI: 切换模型'
            });
            if (selected) {
                await config.update('model', selected.label, vscode.ConfigurationTarget.Global);
                vscode.window.showInformationMessage(`IceCode AI: 已切换模型为 ${selected.label}`);
                aiProvider.updateModel(selected.label);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('icecode-ai.toggleInlineCompletion', () => {
            const config = vscode.workspace.getConfiguration('icecode-ai');
            const current = config.get<boolean>('inlineCompletionEnabled', true);
            config.update('inlineCompletionEnabled', !current, vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage(
                `IceCode AI: 行内补全已${!current ? '启用' : '禁用'}`
            );
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('icecode-ai.initProject', () => {
            vscode.commands.executeCommand('workbench.view.extension.icecode-ai');
            aiProvider.sendToChat('/init');
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('icecode-ai.openConfig', () => {
            vscode.commands.executeCommand('workbench.action.openSettings', 'icecode-ai');
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('icecode-ai.managePermissions', () => {
            vscode.commands.executeCommand('workbench.view.extension.icecode-ai');
            aiProvider.sendToChat('/permissions');
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('icecode-ai.login', () => {
            vscode.commands.executeCommand('workbench.view.extension.icecode-ai');
            aiProvider.sendToChat('/login');
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('icecode-ai.logout', () => {
            vscode.commands.executeCommand('workbench.view.extension.icecode-ai');
            aiProvider.sendToChat('/logout');
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('icecode-ai.doctor', () => {
            vscode.commands.executeCommand('workbench.view.extension.icecode-ai');
            aiProvider.sendToChat('/doctor');
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('icecode-ai.reportBug', () => {
            vscode.commands.executeCommand('workbench.view.extension.icecode-ai');
            aiProvider.sendToChat('/bug');
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('icecode-ai.showCost', () => {
            vscode.commands.executeCommand('workbench.view.extension.icecode-ai');
            aiProvider.sendToChat('/cost');
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('icecode-ai.showStatus', () => {
            vscode.commands.executeCommand('workbench.view.extension.icecode-ai');
            aiProvider.sendToChat('/status');
        })
    );

    if (vscode.workspace.getConfiguration('icecode-ai').get<boolean>('autoStart')) {
        grpcClient.connect().then(() => {
            updateConnectionStatus();
        }).catch(err => {
            vscode.window.showWarningMessage(`IceCode AI 后端连接失败：${err.message}`);
        });
    }

    vscode.window.showInformationMessage('IceCode AI 已就绪');
}

export function deactivate() {
    grpcClient?.disconnect();
    statusBarItem?.dispose();
}
