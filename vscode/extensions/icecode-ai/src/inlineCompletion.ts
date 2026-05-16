import * as vscode from 'vscode';
import { GrpcClient } from './grpcClient';

export class InlineCompletionProvider implements vscode.InlineCompletionItemProvider {
    private _grpcClient: GrpcClient;
    private _debounceTimer: NodeJS.Timeout | null = null;

    constructor(grpcClient: GrpcClient) {
        this._grpcClient = grpcClient;
    }

    async provideInlineCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        context: vscode.InlineCompletionContext,
        token: vscode.CancellationToken
    ): Promise<vscode.InlineCompletionItem[] | undefined> {
        const config = vscode.workspace.getConfiguration('icecode-ai');
        if (!config.get<boolean>('inlineCompletionEnabled', true)) {
            return undefined;
        }

        const providerSetting = config.get<string>('inlineCompletionProvider', 'auto');
        if (providerSetting === 'disabled') {
            return undefined;
        }

        if (context.triggerKind === vscode.InlineCompletionTriggerKind.Automatic) {
            const line = document.lineAt(position.line).text;
            const textBeforeCursor = line.substring(0, position.character);
            if (textBeforeCursor.trim().length < 2) {
                return undefined;
            }
        }

        if (token.isCancellationRequested) {
            return undefined;
        }

        const contextLines = config.get<number>('contextLines', 50);
        const startLine = Math.max(0, position.line - contextLines);
        const endLine = Math.min(document.lineCount - 1, position.line + 10);

        const prefix = document.getText(new vscode.Range(startLine, 0, position.line, position.character));
        const suffix = document.getText(new vscode.Range(position.line, position.character, endLine, document.lineAt(endLine).text.length));

        const languageId = document.languageId;
        const fileName = document.fileName;

        const prompt = `You are an expert code completion AI. Complete the code at the cursor position (marked with <|CURSOR|>). Only output the completion, no explanations.

File: ${fileName}
Language: ${languageId}

${prefix}<|CURSOR|>${suffix}

Completion:`;

        try {
            const completion = await this._grpcClient.requestCompletion(prompt, languageId);
            if (!completion || token.isCancellationRequested) {
                return undefined;
            }

            const cleanCompletion = this._cleanCompletion(completion, prefix, suffix);

            if (!cleanCompletion) {
                return undefined;
            }

            const item = new vscode.InlineCompletionItem(
                cleanCompletion,
                new vscode.Range(position, position)
            );

            return [item];
        } catch {
            return undefined;
        }
    }

    private _cleanCompletion(completion: string, prefix: string, suffix: string): string {
        let cleaned = completion.trim();

        const codeBlockMatch = cleaned.match(/```[\w]*\n([\s\S]*?)```/);
        if (codeBlockMatch) {
            cleaned = codeBlockMatch[1].trim();
        }

        const prefixLines = prefix.split('\n');
        const lastPrefixLine = prefixLines[prefixLines.length - 1];
        const completionLines = cleaned.split('\n');
        if (completionLines.length > 0 && lastPrefixLine.trim() === completionLines[0].trim()) {
            cleaned = completionLines.slice(1).join('\n');
        }

        if (cleaned.includes(suffix.trim())) {
            const idx = cleaned.indexOf(suffix.trim());
            if (idx > 0) {
                cleaned = cleaned.substring(0, idx);
            }
        }

        return cleaned;
    }
}
