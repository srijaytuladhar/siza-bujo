import { Injectable } from '@angular/core';

export interface LogEntry {
    date: string; // ISO format (YYYY-MM-DD)
    content: string;
}

@Injectable({
    providedIn: 'root'
})
export class LogService {
    private readonly STORAGE_KEY = 'bujo_master_log';
    private readonly LEGACY_KEY = 'bujo_logs';

    constructor() {
        this.migrateLegacyLogs();
    }

    private migrateLegacyLogs(): void {
        const legacyData = localStorage.getItem(this.LEGACY_KEY);
        if (legacyData) {
            try {
                const legacyLogs: LogEntry[] = JSON.parse(legacyData);
                if (legacyLogs.length > 0) {
                    // Sort by date to keep order
                    legacyLogs.sort((a, b) => a.date.localeCompare(b.date));

                    let masterContent = legacyLogs
                        .map(log => `--- ${log.date} ---\n${log.content}`)
                        .join('\n\n');

                    // Prepend to existing master log if it exists, or just save
                    const existingMaster = localStorage.getItem(this.STORAGE_KEY);
                    if (existingMaster) {
                        masterContent = masterContent + '\n\n' + existingMaster;
                    }

                    localStorage.setItem(this.STORAGE_KEY, masterContent);
                    // Clear legacy data once migrated
                    localStorage.removeItem(this.LEGACY_KEY);
                }
            } catch (e) {
                console.error('Migration failed', e);
            }
        }
    }

    getMasterLog(): string {
        return localStorage.getItem(this.STORAGE_KEY) || '';
    }

    saveMasterLog(content: string): void {
        localStorage.setItem(this.STORAGE_KEY, content);
    }

    searchLogs(query: string): { date?: string, content: string }[] {
        if (!query.trim()) return [];
        const content = this.getMasterLog();
        // Since it's one big block, we'll just check if the query exists
        if (content.toLowerCase().includes(query.toLowerCase())) {
            return [{ content }];
        }
        return [];
    }

    getToday(): string {
        return new Date().toISOString().split('T')[0];
    }
}
