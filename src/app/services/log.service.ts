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
    private readonly DB_NAME = 'bujo_db';
    private readonly STORE_NAME = 'handles';
    private readonly HANDLE_KEY = 'root_dir';
    private readonly FILE_NAME = 'bujo_master_log.txt';

    private directoryHandle: any = null;

    constructor() {
        this.migrateLegacyLogs();
        this.initPersistence();
    }

    private async initPersistence() {
        try {
            this.directoryHandle = await this.getHandle();
            if (this.directoryHandle) {
                // Check permissions
                if (await this.directoryHandle.queryPermission({ mode: 'readwrite' }) !== 'granted') {
                    // We can't auto-request on init, user must click button to re-authorize
                    this.directoryHandle = null;
                }
            }
        } catch (e) {
            console.error('Failed to restore file handle', e);
        }
    }

    async selectFolder(): Promise<void> {
        try {
            const handle = await (window as any).showDirectoryPicker();
            this.directoryHandle = handle;
            await this.saveHandle(handle);
            // On first select, write current content if file doesn't exist
            const content = this.getMasterLog();
            await this.saveToFolder(content);
        } catch (e) {
            console.error('Folder selection cancelled or failed', e);
            throw e;
        }
    }

    async getFolderHandle(): Promise<any> {
        return this.directoryHandle;
    }

    private async saveToFolder(content: string): Promise<void> {
        if (!this.directoryHandle) return;
        try {
            const fileHandle = await this.directoryHandle.getFileHandle(this.FILE_NAME, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(content);
            await writable.close();
        } catch (e) {
            console.error('Failed to save to folder', e);
        }
    }

    async loadFromFolder(): Promise<string | null> {
        if (!this.directoryHandle) return null;
        try {
            const fileHandle = await this.directoryHandle.getFileHandle(this.FILE_NAME);
            const file = await fileHandle.getFile();
            const content = await file.text();
            // Sync to LocalStorage as well for backup/instant load
            localStorage.setItem(this.STORAGE_KEY, content);
            return content;
        } catch (e) {
            console.error('Failed to load from folder', e);
            return null;
        }
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

    async saveMasterLog(content: string): Promise<void> {
        localStorage.setItem(this.STORAGE_KEY, content);
        if (this.directoryHandle) {
            await this.saveToFolder(content);
        }
    }

    private async saveHandle(handle: any) {
        const db = await this.getDB();
        const tx = db.transaction(this.STORE_NAME, 'readwrite');
        tx.objectStore(this.STORE_NAME).put(handle, this.HANDLE_KEY);
        return new Promise((resolve) => tx.oncomplete = resolve);
    }

    private async getHandle(): Promise<any> {
        const db = await this.getDB();
        const tx = db.transaction(this.STORE_NAME, 'readonly');
        const request = tx.objectStore(this.STORE_NAME).get(this.HANDLE_KEY);
        return new Promise((resolve) => request.onsuccess = () => resolve(request.result));
    }

    private getDB(): Promise<IDBDatabase> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.DB_NAME, 1);
            request.onupgradeneeded = () => request.result.createObjectStore(this.STORE_NAME);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
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
