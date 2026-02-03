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
        <div class="date-nav">
          <button (click)="changeDate(-1)">&lt;</button>
          <span class="current-date">{{ currentDate() }}</span>
          <button (click)="changeDate(1)">&gt;</button>
          <button (click)="goToToday()" *ngIf="currentDate() !== today">Today</button>
        </div>
        <div class="search-box">
          <input 
            type="text" 
            [(ngModel)]="searchQuery" 
            placeholder="Search entries..."
            (input)="performSearch()"
          >
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
          <div class="result-date" (click)="goToDate(result.date)">{{ result.date }}</div>
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

    .date-nav {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .current-date {
      font-weight: bold;
      font-size: 1.2rem;
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

  today = this.logService.getToday();
  currentDate = signal<string>(this.today);
  editorContent = signal<string>('');
  searchQuery = signal<string>('');
  searchResults = signal<LogEntry[]>([]);

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
      const symbols = ['.', '-', '>', 'x', 'o', '→', '='];

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
        }

        const symbolIdx = line.indexOf(firstChar);
        const prefix = escape(line.substring(0, symbolIdx));
        const rest = escape(line.substring(symbolIdx + 1));
        chipHTML = `${prefix}<span class="chip ${chipClass}">${firstChar}</span>${rest}`;
      } else {
        chipHTML = escape(line);
      }

      return `<div class="bujo-line ${lineClass}">${chipHTML}</div>`;
    }).join('');
  });

  constructor() {
    // Load initial content
    effect(() => {
      const content = this.logService.getLogByDate(this.currentDate());
      this.editorContent.set(content);
    }, { allowSignalWrites: true });
  }

  onContentChange(newContent: string) {
    this.editorContent.set(newContent);
    this.logService.saveLog(this.currentDate(), newContent);
  }

  changeDate(delta: number) {
    const date = new Date(this.currentDate());
    date.setDate(date.getDate() + delta);
    this.currentDate.set(date.toISOString().split('T')[0]);
  }

  goToToday() {
    this.currentDate.set(this.today);
  }

  goToDate(date: string) {
    this.currentDate.set(date);
    this.searchQuery.set('');
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
