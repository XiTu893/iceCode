import * as vscode from 'vscode';

export interface HistoryEntry {
    id: string;
    timestamp: number;
    role: 'user' | 'assistant' | 'system';
    content: string;
    sessionId: string;
}

export class HistoryManager {
    private _context: vscode.ExtensionContext;
    private _history: HistoryEntry[] = [];

    constructor(context: vscode.ExtensionContext) {
        this._context = context;
        this._load();
    }

    private _load(): void {
        const config = vscode.workspace.getConfiguration('icecode-ai');
        if (!config.get<boolean>('saveHistory', true)) {
            return;
        }
        this._history = this._context.globalState.get<HistoryEntry[]>('icecode-ai.history', []);
    }

    private async _save(): Promise<void> {
        const config = vscode.workspace.getConfiguration('icecode-ai');
        if (!config.get<boolean>('saveHistory', true)) {
            return;
        }
        const maxItems = config.get<number>('maxHistoryItems', 100);
        if (this._history.length > maxItems) {
            this._history = this._history.slice(-maxItems);
        }
        await this._context.globalState.update('icecode-ai.history', this._history);
    }

    async addEntry(entry: Omit<HistoryEntry, 'id' | 'timestamp'>): Promise<void> {
        const fullEntry: HistoryEntry = {
            ...entry,
            id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: Date.now()
        };
        this._history.push(fullEntry);
        await this._save();
    }

    getSessionHistory(sessionId: string): HistoryEntry[] {
        return this._history.filter(e => e.sessionId === sessionId);
    }

    getRecentSessions(limit: number = 10): string[] {
        const sessionIds = [...new Set(this._history.map(e => e.sessionId))];
        return sessionIds.slice(-limit).reverse();
    }

    async clearHistory(): Promise<void> {
        this._history = [];
        await this._context.globalState.update('icecode-ai.history', []);
    }

    async clearSession(sessionId: string): Promise<void> {
        this._history = this._history.filter(e => e.sessionId !== sessionId);
        await this._save();
    }

    get history(): HistoryEntry[] {
        return [...this._history];
    }
}
