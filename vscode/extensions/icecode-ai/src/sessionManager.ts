import * as vscode from 'vscode';
import { GrpcClient } from './grpcClient';

interface SessionItem {
    id: string;
    label: string;
    createdAt: number;
    messageCount: number;
}

export class SessionManager implements vscode.TreeDataProvider<SessionItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<SessionItem | undefined | null>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private _sessions: SessionItem[] = [];
    private _activeSessionId: string | null = null;

    constructor(private readonly _grpcClient: GrpcClient) {}

    async createNewSession(): Promise<void> {
        const id = `session-${Date.now()}`;
        const session: SessionItem = {
            id,
            label: `Session ${this._sessions.length + 1}`,
            createdAt: Date.now(),
            messageCount: 0
        };
        this._sessions.unshift(session);
        this._activeSessionId = id;
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(element: SessionItem): vscode.TreeItem {
        const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.None);
        item.description = `${element.messageCount} messages`;
        item.iconPath = new vscode.ThemeIcon(
            element.id === this._activeSessionId ? 'chat' : 'comment-discussion'
        );
        item.contextValue = element.id === this._activeSessionId ? 'activeSession' : 'session';
        item.command = {
            command: 'icecode-ai.openChat',
            title: 'Open Chat',
            arguments: []
        };
        return item;
    }

    getChildren(_element?: SessionItem): Thenable<SessionItem[]> {
        return Promise.resolve(this._sessions);
    }

    incrementMessageCount(sessionId?: string) {
        const id = sessionId || this._activeSessionId;
        const session = this._sessions.find(s => s.id === id);
        if (session) {
            session.messageCount++;
            this._onDidChangeTreeData.fire(undefined);
        }
    }
}
