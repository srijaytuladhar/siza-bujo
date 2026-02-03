import { Injectable } from '@angular/core';

export interface LogEntry {
    date: string; // ISO format (YYYY-MM-DD)
    content: string;
}

@Injectable({
    providedIn: 'root'
})
export class LogService {
    private readonly STORAGE_KEY = 'bujo_logs';

    constructor() { }

    getLogs(): LogEntry[] {
        const logs = localStorage.getItem(this.STORAGE_KEY);
        return logs ? JSON.parse(logs) : [];
    }

    getLogByDate(date: string): string {
        const logs = this.getLogs();
        const entry = logs.find(l => l.date === date);
        return entry ? entry.content : '';
    }

    saveLog(date: string, content: string): void {
        let logs = this.getLogs();
        const index = logs.findIndex(l => l.date === date);

        // Filter out migrated lines from being saved in the current day
        // NO - current line should stay as '>' in current day, but we'll copy it to next day.

        if (index !== -1) {
            logs[index].content = content;
        } else {
            logs.push({ date, content });
        }

        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(logs));
        this.handleMigration(date, content);
    }

    private handleMigration(date: string, content: string): void {
        const lines = content.split('\n');
        const migratedLines = lines
            .filter(line => line.startsWith('>'))
            .map(line => line.replace('>', '.'));

        if (migratedLines.length === 0) return;

        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);
        const nextDateStr = nextDate.toISOString().split('T')[0];

        const logs = this.getLogs();
        const nextDayEntry = logs.find(l => l.date === nextDateStr);
        let nextDayContent = nextDayEntry ? nextDayEntry.content : '';

        let changed = false;
        migratedLines.forEach(line => {
            if (!nextDayContent.includes(line)) {
                nextDayContent += (nextDayContent ? '\n' : '') + line;
                changed = true;
            }
        });

        if (changed) {
            this.saveLogSilently(nextDateStr, nextDayContent);
        }
    }

    private saveLogSilently(date: string, content: string): void {
        let logs = this.getLogs();
        const index = logs.findIndex(l => l.date === date);
        if (index !== -1) {
            logs[index].content = content;
        } else {
            logs.push({ date, content });
        }
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(logs));
    }

    searchLogs(query: string): LogEntry[] {
        if (!query.trim()) return [];
        const logs = this.getLogs();
        return logs.filter(l => l.content.toLowerCase().includes(query.toLowerCase()));
    }

    getToday(): string {
        return new Date().toISOString().split('T')[0];
    }
}
