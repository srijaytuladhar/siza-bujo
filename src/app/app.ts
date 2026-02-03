import { Component, signal, effect, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LogService, LogEntry } from './services/log.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="container">
      <header>
        <div class="logo">BuJo</div>
        <div class="header-actions">
          <div class="storage-nav">
            <button class="btn-storage" (click)="selectStorageFolder()">
              {{ isFileStorage() ? '📁 ' + folderName() : '☁️ Local' }}
            </button>
          </div>
          <div class="search-box">
            <input 
              type="text" 
              [(ngModel)]="searchQuery" 
              placeholder="Search entries..."
              (input)="performSearch()"
            >
          </div>
        </div>
      </header>

      <main *ngIf="!searchQuery()">
        <div class="editor-container">
          <div class="editor-backdrop" [innerHTML]="highlightedContent()"></div>
          <textarea
            #editor
            class="bujo-editor"
            [ngModel]="editorContent()"
            (ngModelChange)="onContentChange($event)"
            (scroll)="syncScroll($event)"
            placeholder="Start typing...
. task
- note
o event
= feeling
> migrate
x done"
            spellcheck="false"
          ></textarea>
        </div>
      </main>

      <section class="search-results" *ngIf="searchQuery()">
        <div *ngIf="searchResults().length === 0" class="no-results">
          No matches found for "{{ searchQuery() }}"
        </div>
        <div class="result-item" *ngFor="let result of searchResults()">
          <div class="result-date">Match found in Log</div>
          <pre class="result-content">{{ result.content }}</pre>
        </div>
      </section>

      <footer>
        <span class="status">Local Storage • Mono-spaced • Plain</span>
      </footer>
    </div>
  `,
  styles: [`
    .container {
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
      display: flex;
      flex-direction: column;
      height: 100vh;
    }

    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 1rem;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 1.5rem;
    }

    .btn-storage {
      font-size: 0.85rem;
      color: var(--secondary-text);
      border-color: var(--border-color);
      padding: 0.4rem 0.8rem;
      border-radius: 4px;
      transition: all 0.2s;
      white-space: nowrap;
      max-width: 200px;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .btn-storage:hover {
      color: var(--text-color);
      border-color: var(--secondary-text);
    }

    .logo {
      font-weight: bold;
      font-size: 1.5rem;
      letter-spacing: 2px;
      color: var(--chip-task);
    }

    button {
      background: none;
      border: 1px solid var(--border-color);
      padding: 0.2rem 0.5rem;
      cursor: pointer;
      font-family: inherit;
      color: inherit;
    }

    button:hover {
      background: var(--hover-color);
    }

    .search-box input {
      padding: 0.4rem;
      border: 1px solid var(--border-color);
      background: transparent;
      color: inherit;
      font-family: inherit;
      width: 200px;
    }

    .editor-container {
      height: calc(100vh - 200px);
    }

    .search-results {
      flex: 1;
      overflow-y: auto;
    }

    .result-item {
      margin-bottom: 1.5rem;
      border-left: 2px solid var(--border-color);
      padding-left: 1rem;
    }

    .result-date {
      font-weight: bold;
      cursor: pointer;
      font-size: 0.9rem;
      color: var(--secondary-text);
      margin-bottom: 0.5rem;
    }

    .result-date:hover {
      text-decoration: underline;
    }

    .result-content {
      margin: 0;
      white-space: pre-wrap;
      font-family: var(--font-mono);
    }

    footer {
      margin-top: auto;
      padding-top: 1rem;
      border-top: 1px solid var(--border-color);
      font-size: 0.8rem;
      color: var(--secondary-text);
      text-align: center;
    }

    .no-results {
      text-align: center;
      padding: 2rem;
      color: var(--secondary-text);
    }
  `],
})
export class App {
  private logService = inject(LogService);

  editorContent = signal<string>('');
  searchQuery = signal<string>('');
  searchResults = signal<any[]>([]);
  folderName = signal<string>('');
  isFileStorage = signal<boolean>(false);

  highlightedContent = computed(() => {
    let content = this.editorContent();
    if (!content) return '';

    // Basic HTML escape
    const escape = (text: string) => text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    return content.split('\n').map(line => {
      const trimmed = line.trimStart();
      if (!trimmed) return '<div class="bujo-line">&nbsp;</div>';

      const firstChar = trimmed[0];
      const symbols = ['.', '-', '>', 'x', 'o', '→', '=', '#'];

      let chipHTML = '';
      let lineClass = '';

      if (symbols.includes(firstChar)) {
        let chipClass = '';
        switch (firstChar) {
          case '.': chipClass = 'chip-task'; lineClass = 'line-task'; break;
          case 'x': chipClass = 'chip-done'; lineClass = 'line-done'; break;
          case '-': chipClass = 'chip-note'; lineClass = 'line-note'; break;
          case '→': chipClass = 'chip-note'; lineClass = 'line-note'; break;
          case '>': chipClass = 'chip-migrate'; lineClass = 'line-migrate'; break;
          case 'o': chipClass = 'chip-event'; lineClass = 'line-event'; break;
          case '=': chipClass = 'chip-feeling'; lineClass = 'line-feeling'; break;
          case '#': chipClass = 'chip-header'; lineClass = 'line-header'; break;
        }

        const symbolIdx = line.indexOf(firstChar);
        const prefix = escape(line.substring(0, symbolIdx));
        const rest = escape(line.substring(symbolIdx + 1));

        if (firstChar === '#') {
          chipHTML = `${prefix}<span class="chip ${chipClass}">${firstChar}</span><span class="header-text">${rest}</span>`;
        } else {
          chipHTML = `${prefix}<span class="chip ${chipClass}">${firstChar}</span>${rest}`;
        }
      } else {
        chipHTML = escape(line);
      }

      return `<div class="bujo-line ${lineClass}">${chipHTML}</div>`;
    }).join('');
  });

  constructor() {
    // Load initial content from master log
    this.editorContent.set(this.logService.getMasterLog());
    this.refreshStorageStatus();
  }

  async refreshStorageStatus() {
    const handle = await this.logService.getFolderHandle();
    if (handle) {
      this.folderName.set(handle.name);
      this.isFileStorage.set(true);
      // If we have a folder, load content from it (it might be newer)
      const content = await this.logService.loadFromFolder();
      if (content !== null) {
        this.editorContent.set(content);
      }
    } else {
      this.isFileStorage.set(false);
    }
  }

  async selectStorageFolder() {
    try {
      await this.logService.selectFolder();
      await this.refreshStorageStatus();
    } catch (e) {
      console.error('Folder selection failed', e);
    }
  }

  onContentChange(newContent: string) {
    this.editorContent.set(newContent);
    this.logService.saveMasterLog(newContent);
  }

  performSearch() {
    if (this.searchQuery()) {
      this.searchResults.set(this.logService.searchLogs(this.searchQuery()));
    } else {
      this.searchResults.set([]);
    }
  }

  syncScroll(event: any) {
    const textarea = event.target;
    const container = textarea.parentElement;
    const backdrop = container.querySelector('.editor-backdrop');
    if (backdrop) {
      backdrop.scrollTop = textarea.scrollTop;
      backdrop.scrollLeft = textarea.scrollLeft;
    }
  }
}
