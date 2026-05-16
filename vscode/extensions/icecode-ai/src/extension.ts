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

export function activate(context: vscode.ExtensionContext) {
    grpcClient = new GrpcClient();
    historyManager = new HistoryManager(context);
    sessionManager = new SessionManager(grpcClient);
    aiProvider = new IceCodeAIProvider(context.extensionUri, grpcClient, sessionManager, historyManager);
    inlineCompletionProvider = new InlineCompletionProvider(grpcClient);

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
        ['icecode-ai.explainCode', 'Explain the following code:\n\n'],
        ['icecode-ai.fixCode', 'Fix the bugs in the following code:\n\n'],
        ['icecode-ai.optimizeCode', 'Optimize the following code for performance:\n\n'],
        ['icecode-ai.addTests', 'Generate unit tests for the following code:\n\n'],
        ['icecode-ai.addDocs', 'Add documentation comments to the following code:\n\n'],
        ['icecode-ai.refactorCode', 'Refactor the following code to improve readability and maintainability:\n\n'],
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
                description: m === currentModel ? 'Current' : undefined,
                picked: m === currentModel
            }));
            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: 'Select AI Model',
                title: 'IceCode AI: Switch Model'
            });
            if (selected) {
                await config.update('model', selected.label, vscode.ConfigurationTarget.Global);
                vscode.window.showInformationMessage(`IceCode AI: Model switched to ${selected.label}`);
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
                `IceCode AI: Inline completion ${!current ? 'enabled' : 'disabled'}`
            );
        })
    );

    if (vscode.workspace.getConfiguration('icecode-ai').get<boolean>('autoStart')) {
        grpcClient.connect().catch(err => {
            vscode.window.showWarningMessage(`IceCode AI backend connection failed: ${err.message}`);
        });
    }

    vscode.window.showInformationMessage('IceCode AI is ready');
}

export function deactivate() {
    grpcClient?.disconnect();
}
