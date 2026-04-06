import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { Subscription, auditTime, filter } from 'rxjs';
import { CentralAdminContextService, CentralAdminContextState } from '../../services/central-admin-context.service';

type ShellSectionId = 'subject-types' | 'fields-library' | 'application-configuration' | 'preview-workspace';

interface ShellSection {
  id: ShellSectionId;
  label: string;
  description: string;
  childPath: string;
  standalonePath?: string;
  requiresCategorySelection?: boolean;
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
      description: 'إدارة الشجرة + Policy Authoring Studio + العلاقات والمعاينة.',
      childPath: 'subject-types',
      standalonePath: 'DynamicSubjectTypes'
    },
    {
      id: 'fields-library',
      label: 'مكتبة الحقول الديناميكية',
      description: 'إضافة/تعديل الحقول العامة القابلة لإعادة الاستخدام.',
      childPath: 'fields-library',
      standalonePath: 'DynamicFiledsManager',
      requiresCategorySelection: true
    },
    {
      id: 'application-configuration',
      label: 'إعدادات المكونات',
      description: 'إدارة component-configs ومسارات الشاشات والطلبات.',
      childPath: 'application-configuration',
      standalonePath: 'ApplicationConfiguration',
      requiresCategorySelection: true
    },
    {
      id: 'preview-workspace',
      label: 'Preview Workspace',
      description: 'معاينة حقيقية للنموذج النهائي + readiness checks + config summary.',
      childPath: 'preview-workspace',
      requiresCategorySelection: true
    }
  ];

  contextForm: FormGroup;
  activeSection: ShellSectionId = 'subject-types';
  workflowNotice = '';
  private readonly subscriptions = new Subscription();

  constructor(
    private readonly fb: FormBuilder,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly centralAdminContext: CentralAdminContextService
  ) {
    this.contextForm = this.fb.group({
      applicationId: [''],
      categoryId: [''],
      routeKeyPrefix: [''],
      documentDirection: [''],
      requestMode: [''],
      creatorUnitId: [''],
      targetUnitId: [''],
      runtimeContextJson: ['']
    });
  }

  ngOnInit(): void {
    this.subscriptions.add(
      this.route.queryParamMap.subscribe(params => {
        this.centralAdminContext.updateFromDeepLink({
          applicationId: params.get('applicationId'),
          categoryId: params.get('categoryId'),
          routeKeyPrefix: params.get('routeKeyPrefix'),
          documentDirection: params.get('documentDirection'),
          requestMode: params.get('requestMode'),
          creatorUnitId: params.get('creatorUnitId'),
          targetUnitId: params.get('targetUnitId'),
          runtimeContextJson: params.get('runtimeContextJson')
        });
      })
    );

    this.subscriptions.add(
      this.centralAdminContext.state$.subscribe(state => {
        this.contextForm.patchValue({
          applicationId: state.selectedApplicationId ?? '',
          categoryId: state.selectedCategoryId != null ? String(state.selectedCategoryId) : '',
          routeKeyPrefix: state.routeKeyPrefix ?? '',
          documentDirection: state.documentDirection ?? '',
          requestMode: state.requestMode ?? '',
          creatorUnitId: state.creatorUnitId ?? '',
          targetUnitId: state.targetUnitId ?? '',
          runtimeContextJson: state.runtimeContextJson ?? ''
        }, { emitEvent: false });
      })
    );

    this.subscriptions.add(
      this.contextForm.valueChanges
        .pipe(auditTime(180))
        .subscribe(() => this.syncFormToContext(false))
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
    if (!this.canOpenSection(section)) {
      this.workflowNotice = 'يرجى اختيار نوع الموضوع أولًا من قسم "أنواع الموضوعات".';
      return;
    }

    this.workflowNotice = '';
    this.router.navigate([section.childPath], {
      relativeTo: this.route,
      queryParams: this.centralAdminContext.toQueryParams()
    });
  }

  openStandalone(section: ShellSection): void {
    if (!section.standalonePath) {
      return;
    }

    this.router.navigate(['/Admin', section.standalonePath], {
      queryParams: this.centralAdminContext.toQueryParams()
    });
  }

  applyContext(): void {
    this.syncFormToContext(true);
  }

  previousSection(): void {
    const previous = this.sections[this.currentSectionIndex - 1];
    if (!previous) {
      return;
    }

    this.navigateTo(previous);
  }

  nextSection(): void {
    const next = this.sections[this.currentSectionIndex + 1];
    if (!next) {
      return;
    }

    this.navigateTo(next);
  }

  isSectionDisabled(section: ShellSection): boolean {
    return !this.canOpenSection(section);
  }

  get currentSectionIndex(): number {
    const idx = this.sections.findIndex(section => section.id === this.activeSection);
    return idx >= 0 ? idx : 0;
  }

  get canGoNext(): boolean {
    return this.currentSectionIndex < this.sections.length - 1;
  }

  get canGoPrevious(): boolean {
    return this.currentSectionIndex > 0;
  }

  get contextState(): CentralAdminContextState {
    return this.centralAdminContext.snapshot;
  }

  get workflowSummaryRouteKey(): string {
    return this.contextState.selectedConfigRouteKey
      ?? this.contextState.routeKeyPrefix
      ?? '-';
  }

  get workflowSummaryFieldsCount(): string {
    return this.contextState.selectedFieldsCount != null
      ? String(this.contextState.selectedFieldsCount)
      : '-';
  }

  get workflowSummaryConfigsCount(): string {
    return this.contextState.filteredConfigsCount != null
      ? String(this.contextState.filteredConfigsCount)
      : '-';
  }

  private syncFormToContext(syncQueryParams: boolean): void {
    const raw = this.contextForm.value ?? {};
    this.centralAdminContext.patchContext({
      selectedApplicationId: raw.applicationId,
      selectedCategoryId: raw.categoryId,
      routeKeyPrefix: raw.routeKeyPrefix,
      documentDirection: raw.documentDirection,
      requestMode: raw.requestMode,
      creatorUnitId: raw.creatorUnitId,
      targetUnitId: raw.targetUnitId,
      runtimeContextJson: raw.runtimeContextJson
    });

    if (syncQueryParams) {
      this.syncQueryParamsWithContext();
    }
  }

  private syncQueryParamsWithContext(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: this.centralAdminContext.toQueryParams(),
      replaceUrl: true
    });
  }

  clearContext(): void {
    this.workflowNotice = '';
    this.centralAdminContext.clearContext();
    this.contextForm.reset({
      applicationId: '',
      categoryId: '',
      routeKeyPrefix: '',
      documentDirection: '',
      requestMode: '',
      creatorUnitId: '',
      targetUnitId: '',
      runtimeContextJson: ''
    });
    this.syncQueryParamsWithContext();
  }

  isSectionActive(section: ShellSection): boolean {
    return this.activeSection === section.id;
  }

  private syncActiveSectionFromUrl(): void {
    const firstChildPath = String(this.route.firstChild?.snapshot.routeConfig?.path ?? '').trim().toLowerCase();
    const found = this.sections.find(section => section.childPath.toLowerCase() === firstChildPath);
    const section = found ?? this.sections[0];

    if (section && !this.canOpenSection(section)) {
      this.activeSection = 'subject-types';
      this.workflowNotice = 'يرجى اختيار نوع الموضوع أولًا قبل الانتقال إلى الأقسام الأخرى.';
      this.router.navigate(['subject-types'], {
        relativeTo: this.route,
        queryParams: this.centralAdminContext.toQueryParams(),
        replaceUrl: true
      });
      return;
    }

    this.workflowNotice = '';
    this.activeSection = section?.id ?? 'subject-types';
  }

  private canOpenSection(section: ShellSection): boolean {
    if (!section.requiresCategorySelection) {
      return true;
    }

    return this.contextState.selectedCategoryId != null;
  }
}
