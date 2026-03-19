import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, shareReplay } from 'rxjs/operators';
import { DocsManifest, DocsPage } from '../models/docs.models';

@Injectable({ providedIn: 'root' })
export class DocsService {
  private manifest$?: Observable<DocsManifest>;
  private readonly manifestPath = 'assets/docs/manifest.json';

  constructor(private http: HttpClient) {}

  getManifest(): Observable<DocsManifest> {
    if (!this.manifest$) {
      this.manifest$ = this.http.get<DocsManifest>(this.manifestPath).pipe(
        map((m) => ({
          ...m,
          defaultLang: m.defaultLang || 'en',
          languages: Array.isArray(m.languages) ? m.languages : [],
          pages: Array.isArray(m.pages) ? m.pages : []
        })),
        shareReplay(1)
      );
    }
    return this.manifest$;
  }

  getPage(pages: DocsPage[], id: string | null | undefined): DocsPage | undefined {
    if (!pages || !id) return undefined;
    return pages.find((p) => p.id === id);
  }

  getPageFile(pages: DocsPage[], lang: string, id: string, fallbackLang: string): string | undefined {
    const page = this.getPage(pages, id);
    if (!page) return undefined;
    return page.file?.[lang] || page.file?.[fallbackLang] || undefined;
  }

  loadContent(filePath: string | undefined): Observable<string> {
    if (!filePath) {
      return of('<div class=\"section\">Document not found.</div>');
    }
    const fullPath = `assets/docs/${filePath}`;
    return this.http.get(fullPath, { responseType: 'text' }).pipe(
      map((raw) => this.prepareContent(raw, filePath)),
      catchError(() => of('<div class=\"section\">Document not found.</div>'))
    );
  }

  private prepareContent(raw: string, filePath: string): string {
    const cleaned = this.stripLinkTags(raw);
    const isHtml = filePath.toLowerCase().endsWith('.html');
    return isHtml ? cleaned : this.markdownToHtml(cleaned);
  }

  private stripLinkTags(content: string): string {
    return content.replace(/<link[^>]*>/gi, '').trim();
  }

  private markdownToHtml(md: string): string {
    const lines = md.replace(/\r\n/g, '\n').split('\n');
    let html = '';
    let inCode = false;
    let listType: 'ul' | 'ol' | null = null;

    const closeList = () => {
      if (listType) {
        html += `</${listType}>\n`;
        listType = null;
      }
    };

    const escapeHtml = (text: string) =>
      text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const inline = (text: string) => {
      let t = text;
      t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
      t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      t = t.replace(/\*([^*]+)\*/g, '<em>$1</em>');
      t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href=\"$2\" target=\"_blank\" rel=\"noopener\">$1</a>');
      return t;
    };

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith('```')) {
        closeList();
        if (!inCode) {
          inCode = true;
          html += '<pre><code>';
        } else {
          inCode = false;
          html += '</code></pre>\n';
        }
        continue;
      }

      if (inCode) {
        html += `${escapeHtml(line)}\n`;
        continue;
      }

      if (!trimmed) {
        closeList();
        continue;
      }

      if (trimmed.startsWith('<')) {
        closeList();
        html += `${line}\n`;
        continue;
      }

      const heading = trimmed.match(/^(#{1,6})\s+(.*)$/);
      if (heading) {
        closeList();
        const level = heading[1].length;
        html += `<h${level}>${inline(heading[2])}</h${level}>\n`;
        continue;
      }

      const ol = trimmed.match(/^\d+\.\s+(.*)$/);
      if (ol) {
        if (listType !== 'ol') {
          closeList();
          listType = 'ol';
          html += '<ol>\n';
        }
        html += `<li>${inline(ol[1])}</li>\n`;
        continue;
      }

      const ul = trimmed.match(/^[-*]\s+(.*)$/);
      if (ul) {
        if (listType !== 'ul') {
          closeList();
          listType = 'ul';
          html += '<ul>\n';
        }
        html += `<li>${inline(ul[1])}</li>\n`;
        continue;
      }

      closeList();
      html += `<p>${inline(trimmed)}</p>\n`;
    }

    closeList();
    if (inCode) html += '</code></pre>\n';
    return html;
  }
}
