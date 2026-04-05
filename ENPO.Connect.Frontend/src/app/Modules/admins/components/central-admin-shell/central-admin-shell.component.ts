import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { Subscription, filter } from 'rxjs';

type ShellSectionId = 'subject-types' | 'fields-library' | 'application-configuration';

interface ShellSection {
  id: ShellSectionId;
  label: string;
  description: string;
  childPath: string;
  standalonePath: string;
}

@Component({
  selector: 'app-central-admin-shell',
  templateUrl: './central-admin-shell.component.html',
  styleUrls: ['./central-admin-shell.component.scss']
})
export class CentralAdminShellComponent implements OnInit, OnDestroy {
  readonly sections: ShellSection[] = [
    {
      id: 'subject-types',
      label: 'أنواع الموضوعات',
      description: 'إدارة الشجرة وسياسات النوع والعلاقات والمعاينة.',
      childPath: 'subject-types',
      standalonePath: 'DynamicSubjectTypes'
    },
    {
      id: 'fields-library',
      label: 'مكتبة الحقول الديناميكية',
      description: 'إضافة/تعديل الحقول العامة القابلة لإعادة الاستخدام.',
      childPath: 'fields-library',
      standalonePath: 'DynamicFiledsManager'
    },
    {
      id: 'application-configuration',
      label: 'إعدادات المكونات',
      description: 'إدارة component-configs ومسارات الشاشات والطلبات.',
      childPath: 'application-configuration',
      standalonePath: 'ApplicationConfiguration'
    }
  ];

  contextForm: FormGroup;
  activeSection: ShellSectionId = 'subject-types';
  private readonly subscriptions = new Subscription();

  constructor(
    private readonly fb: FormBuilder,
    private readonly route: ActivatedRoute,
    private readonly router: Router
  ) {
    this.contextForm = this.fb.group({
      applicationId: [''],
      categoryId: [''],
      routeKeyPrefix: ['']
    });
  }

  ngOnInit(): void {
    this.subscriptions.add(
      this.route.queryParamMap.subscribe(params => {
        this.contextForm.patchValue({
          applicationId: params.get('applicationId') ?? '',
          categoryId: params.get('categoryId') ?? '',
          routeKeyPrefix: params.get('routeKeyPrefix') ?? ''
        }, { emitEvent: false });
      })
    );

    this.syncActiveSectionFromUrl();
    this.subscriptions.add(
      this.router.events
        .pipe(filter(event => event instanceof NavigationEnd))
        .subscribe(() => this.syncActiveSectionFromUrl())
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  navigateTo(section: ShellSection): void {
    this.router.navigate([section.childPath], {
      relativeTo: this.route,
      queryParams: this.getContextQueryParams()
    });
  }

  openStandalone(section: ShellSection): void {
    this.router.navigate(['/Admin', section.standalonePath], {
      queryParams: this.getContextQueryParams()
    });
  }

  applyContext(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: this.getContextQueryParams()
    });
  }

  clearContext(): void {
    this.contextForm.reset({
      applicationId: '',
      categoryId: '',
      routeKeyPrefix: ''
    });
    this.applyContext();
  }

  isSectionActive(section: ShellSection): boolean {
    return this.activeSection === section.id;
  }

  private syncActiveSectionFromUrl(): void {
    const firstChildPath = String(this.route.firstChild?.snapshot.routeConfig?.path ?? '').trim().toLowerCase();
    const found = this.sections.find(section => section.childPath.toLowerCase() === firstChildPath);
    this.activeSection = found?.id ?? 'subject-types';
  }

  private getContextQueryParams(): Record<string, any> {
    const raw = this.contextForm.value ?? {};
    const normalize = (value: unknown): string => String(value ?? '').trim();
    const applicationId = normalize(raw.applicationId);
    const categoryId = normalize(raw.categoryId);
    const routeKeyPrefix = normalize(raw.routeKeyPrefix);

    return {
      applicationId: applicationId.length > 0 ? applicationId : null,
      categoryId: categoryId.length > 0 ? categoryId : null,
      routeKeyPrefix: routeKeyPrefix.length > 0 ? routeKeyPrefix : null
    };
  }
}
