import * as vscode from 'vscode';
import { IceCodeAIProvider } from './provider';
import { GrpcClient } from './grpcClient';
import { SessionManager } from './sessionManager';

let grpcClient: GrpcClient;
let sessionManager: SessionManager;
let aiProvider: IceCodeAIProvider;

export function activate(context: vscode.ExtensionContext) {
    grpcClient = new GrpcClient();
    sessionManager = new SessionManager(grpcClient);
    aiProvider = new IceCodeAIProvider(context.extensionUri, grpcClient, sessionManager);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('icecode-ai.chat', aiProvider, {
            webviewOptions: { retainContextWhenHidden: true }
        })
    );

    context.subscriptions.push(
        vscode.window.registerTreeDataProvider('icecode-ai.sessions', sessionManager)
    );

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
            const selectedText = text || editor?.selection ? editor?.document.getText(editor.selection) : undefined;
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
