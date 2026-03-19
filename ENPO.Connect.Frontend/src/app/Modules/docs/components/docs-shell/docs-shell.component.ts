import { Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { Subject, combineLatest } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';
import { DocsService } from '../../services/docs.service';
import { DocsManifest, DocsLanguage, DocsPage } from '../../models/docs.models';

@Component({
  selector: 'app-docs-shell',
  templateUrl: './docs-shell.component.html',
  styleUrls: ['./docs-shell.component.scss']
})
export class DocsShellComponent implements OnInit, OnDestroy {
  private destroyed$ = new Subject<void>();

  manifest?: DocsManifest;
  languages: DocsLanguage[] = [];
  pages: DocsPage[] = [];
  currentLang = 'en';
  currentPageId = 'readme';
  mobileSidebarOpen = false;

  constructor(
    private docsService: DocsService,
    private route: ActivatedRoute,
    private router: Router,
    @Inject(DOCUMENT) private document: Document
  ) {}

  ngOnInit(): void {
    this.document.body.classList.add('docs-route');
    this.docsService.getManifest().pipe(takeUntil(this.destroyed$)).subscribe((manifest) => {
      this.manifest = manifest;
      this.languages = manifest.languages || [];
      this.pages = manifest.pages || [];

      const savedLang = localStorage.getItem('docs-lang');
      this.currentLang = this.resolveLang(savedLang || manifest.defaultLang || 'en');
      this.ensureRoute();
    });

    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntil(this.destroyed$)
      )
      .subscribe(() => this.syncFromRoute());

    combineLatest([this.route.url, this.route.params])
      .pipe(takeUntil(this.destroyed$))
      .subscribe(() => this.syncFromRoute());
  }

  ngOnDestroy(): void {
    this.destroyed$.next();
    this.destroyed$.complete();
    this.document.body.classList.remove('docs-route');
  }

  toggleSidebar(): void {
    this.mobileSidebarOpen = !this.mobileSidebarOpen;
  }

  onSelectPage(pageId: string): void {
    const lang = this.currentLang;
    this.mobileSidebarOpen = false;
    this.router.navigate([lang, pageId], { relativeTo: this.route });
  }

  onChangeLang(lang: string): void {
    this.currentLang = this.resolveLang(lang);
    localStorage.setItem('docs-lang', this.currentLang);
    const targetPage = this.resolvePage(this.currentPageId);
    this.router.navigate([this.currentLang, targetPage], { relativeTo: this.route });
  }

  getPageLabel(page: DocsPage): string {
    if (!page) return '';
    return page.label?.[this.currentLang] || page.label?.[this.manifest?.defaultLang || 'en'] || page.id;
  }

  get languageDir(): 'ltr' | 'rtl' {
    const lang = this.languages.find((l) => l.code === this.currentLang);
    return (lang?.dir as 'ltr' | 'rtl') || 'ltr';
  }

  private syncFromRoute(): void {
    const child = this.route.firstChild;
    const lang = child?.snapshot.paramMap.get('lang');
    const page = child?.snapshot.paramMap.get('page');

    if (lang) this.currentLang = this.resolveLang(lang);
    if (page) this.currentPageId = page;

    this.ensureRoute();
  }

  private ensureRoute(): void {
    if (!this.manifest || !this.pages.length) return;

    const pageId = this.resolvePage(this.currentPageId);
    const lang = this.resolveLang(this.currentLang || this.manifest.defaultLang || 'en');

    const child = this.route.firstChild;
    const routeLang = child?.snapshot.paramMap.get('lang');
    const routePage = child?.snapshot.paramMap.get('page');

    if (routeLang === lang && routePage === pageId) return;

    this.router.navigate([lang, pageId], { relativeTo: this.route });
  }

  private resolveLang(lang: string | null | undefined): string {
    if (!lang) return this.manifest?.defaultLang || 'en';
    const exists = this.languages.some((l) => l.code === lang);
    return exists ? lang : this.manifest?.defaultLang || 'en';
  }

  private resolvePage(pageId: string | null | undefined): string {
    if (!pageId) return this.pages[0]?.id || 'readme';
    const exists = this.pages.some((p) => p.id === pageId);
    return exists ? pageId : this.pages[0]?.id || 'readme';
  }
}
