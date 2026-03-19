import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subject, combineLatest } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { DocsService } from '../../services/docs.service';

@Component({
  selector: 'app-docs-page',
  templateUrl: './docs-page.component.html',
  styleUrls: ['./docs-page.component.scss']
})
export class DocsPageComponent implements OnInit, OnDestroy {
  private destroyed$ = new Subject<void>();

  contentHtml = '';
  loading = true;
  error = '';
  contentDir: 'ltr' | 'rtl' = 'ltr';

  constructor(private route: ActivatedRoute, private docsService: DocsService) {}

  ngOnInit(): void {
    combineLatest([this.docsService.getManifest(), this.route.paramMap])
      .pipe(takeUntil(this.destroyed$))
      .subscribe(([manifest, params]) => {
        const lang = params.get('lang') || manifest.defaultLang || 'en';
        const pageId = params.get('page') || manifest.pages[0]?.id || 'readme';
        const file = this.docsService.getPageFile(manifest.pages, lang, pageId, manifest.defaultLang || 'en');
        this.contentDir = this.isRtlFile(file) ? 'rtl' : 'ltr';

        this.loading = true;
        this.error = '';

        this.docsService
          .loadContent(file)
          .pipe(takeUntil(this.destroyed$))
          .subscribe((html) => {
            this.contentHtml = html;
            this.loading = false;
            if (html.includes('Document not found')) {
              this.error = 'Document not found.';
            }
          });
      });
  }

  ngOnDestroy(): void {
    this.destroyed$.next();
    this.destroyed$.complete();
  }

  private isRtlFile(filePath: string | undefined): boolean {
    if (!filePath) return false;
    const lower = filePath.toLowerCase();
    if (/(^|[\\/])ar[\\/]/.test(lower)) return true;
    if (lower.includes('-ar.')) return true;
    if (lower.includes('_ar.')) return true;
    return false;
  }
}
