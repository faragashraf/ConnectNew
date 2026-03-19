import { Component, EventEmitter, Input, Output } from '@angular/core';
import { DocsLanguage, DocsPage } from '../../models/docs.models';

@Component({
  selector: 'app-docs-sidebar',
  templateUrl: './docs-sidebar.component.html',
  styleUrls: ['./docs-sidebar.component.scss']
})
export class DocsSidebarComponent {
  @Input() languages: DocsLanguage[] = [];
  @Input() pages: DocsPage[] = [];
  @Input() currentLang = 'en';
  @Input() currentPageId = '';

  @Output() langChange = new EventEmitter<string>();
  @Output() pageSelect = new EventEmitter<string>();

  onLangClick(code: string) {
    this.langChange.emit(code);
  }

  onPageClick(id: string) {
    this.pageSelect.emit(id);
  }

  getPageLabel(page: DocsPage): string {
    return page.label?.[this.currentLang] || page.label?.['en'] || page.id;
  }
}
