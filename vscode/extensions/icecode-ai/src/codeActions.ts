import * as vscode from 'vscode';

export class CodeActionProvider implements vscode.CodeActionProvider {
    static readonly providedCodeActionKinds: vscode.CodeActionKind[] = [
        vscode.CodeActionKind.QuickFix,
        vscode.CodeActionKind.Refactor
    ];

    provideCodeActions(
        document: vscode.TextDocument,
        range: vscode.Range | vscode.Selection,
        _context: vscode.CodeActionContext,
        _token: vscode.CancellationToken
    ): vscode.CodeAction[] {
        const actions: vscode.CodeAction[] = [];

        const selectedText = document.getText(range);
        if (!selectedText) {
            return actions;
        }

        const createAction = (title: string, command: string, kind: vscode.CodeActionKind): vscode.CodeAction => {
            const action = new vscode.CodeAction(title, kind);
            action.command = {
                command,
                title,
                arguments: []
            };
            action.isPreferred = false;
            return action;
        };

        actions.push(createAction(
            'IceCode AI: Explain Code',
            'icecode-ai.explainCode',
            vscode.CodeActionKind.QuickFix
        ));

        actions.push(createAction(
            'IceCode AI: Fix Code',
            'icecode-ai.fixCode',
            vscode.CodeActionKind.QuickFix
        ));

        actions.push(createAction(
            'IceCode AI: Optimize Code',
            'icecode-ai.optimizeCode',
            vscode.CodeActionKind.Refactor
        ));

        actions.push(createAction(
            'IceCode AI: Generate Tests',
            'icecode-ai.addTests',
            vscode.CodeActionKind.QuickFix
        ));

        actions.push(createAction(
            'IceCode AI: Add Documentation',
            'icecode-ai.addDocs',
            vscode.CodeActionKind.Refactor
        ));

        actions.push(createAction(
            'IceCode AI: Refactor Code',
            'icecode-ai.refactorCode',
            vscode.CodeActionKind.Refactor
        ));

        return actions;
    }
}
