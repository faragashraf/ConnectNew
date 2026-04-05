import { Component, OnDestroy, OnInit } from '@angular/core';
import { AbstractControl, FormArray, FormBuilder, FormGroup } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, forkJoin } from 'rxjs';
import { DynamicFormController } from 'src/app/shared/services/BackendServices';
import { DynamicSubjectsController } from 'src/app/shared/services/BackendServices/DynamicSubjects/DynamicSubjects.service';
import { CdCategoryMandDto, CdmendDto } from 'src/app/shared/services/BackendServices/DynamicForm/DynamicForm.dto';
import {
  SubjectDetailDto,
  SubjectFieldDefinitionDto,
  SubjectFieldValueDto,
  SubjectFormDefinitionDto,
  SubjectGroupDefinitionDto
} from 'src/app/shared/services/BackendServices/DynamicSubjects/DynamicSubjects.dto';
import { AppNotificationService } from 'src/app/shared/services/notifications/app-notification.service';
import { GenericFormsService } from 'src/app/Modules/GenericComponents/GenericForms.service';
import { ComponentConfigService } from 'src/app/Modules/admins/services/component-config.service';
import { ComponentConfig, getConfigByRoute, routeKey } from 'src/app/shared/models/Component.Config.model';
import { DynamicGroupRenderItem } from '../shared/models/dynamic-group-render-item.model';
import { DynamicSubjectAccessService } from '../../services/dynamic-subject-access.service';
import { DynamicSubjectsRealtimeService } from '../../services/dynamic-subjects-realtime.service';

type DetailStatusOption = { label: string; value: number };
type DynamicSubjectDetailPreset = {
  title?: string;
  allowStatusChange?: boolean;
  statusOptions?: DetailStatusOption[];
  showAttachments?: boolean;
  showEnvelopes?: boolean;
  showStakeholders?: boolean;
  showTasks?: boolean;
  showTimeline?: boolean;
};

@Component({
  selector: 'app-dynamic-subject-detail',
  templateUrl: './dynamic-subject-detail.component.html',
  styleUrls: ['./dynamic-subject-detail.component.scss']
})
export class DynamicSubjectDetailComponent implements OnInit, OnDestroy {
  private static readonly DETAIL_ROUTE_KEY = 'DynamicSubjects/SubjectDetail';
  private static readonly DEFAULT_STATUS_OPTIONS: DetailStatusOption[] = [
    { label: 'مسودة', value: 10 },
    { label: 'مقدم', value: 11 },
    { label: 'قيد المراجعة', value: 12 },
    { label: 'بانتظار الاستكمال', value: 13 },
    { label: 'قيد التنفيذ', value: 14 },
    { label: 'مكتمل', value: 15 },
    { label: 'مرفوض', value: 16 },
    { label: 'مؤرشف', value: 17 }
  ];

  private readonly screenPresets: Record<string, DynamicSubjectDetailPreset> = {
    [DynamicSubjectDetailComponent.DETAIL_ROUTE_KEY]: {
      title: 'تفاصيل الموضوع/الطلب',
      allowStatusChange: true,
      statusOptions: DynamicSubjectDetailComponent.DEFAULT_STATUS_OPTIONS,
      showAttachments: true,
      showEnvelopes: true,
      showStakeholders: true,
      showTasks: true,
      showTimeline: true
    }
  };

  subject: SubjectDetailDto | null = null;
  formDefinition: SubjectFormDefinitionDto | null = null;
  messageId = 0;
  loading = false;
  statusToApply?: number;
  screenTitle = 'تفاصيل الموضوع/الطلب';
  resolvedConfigRouteKey = DynamicSubjectDetailComponent.DETAIL_ROUTE_KEY;
  allowStatusChange = true;
  statusOptions: DetailStatusOption[] = [...DynamicSubjectDetailComponent.DEFAULT_STATUS_OPTIONS];
  showAttachmentsSection = true;
  showEnvelopesSection = true;
  showStakeholdersSection = true;
  showTasksSection = true;
  showTimelineSection = true;
  readOnlyDynamicFields = true;
  dynamicControls: FormGroup;
  renderGroups: DynamicGroupRenderItem[] = [];

  private readonly subscriptions: Subscription[] = [];

  constructor(
    private readonly fb: FormBuilder,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly dynamicSubjectsController: DynamicSubjectsController,
    private readonly dynamicFormController: DynamicFormController,
    private readonly dynamicSubjectAccess: DynamicSubjectAccessService,
    private readonly realtimeService: DynamicSubjectsRealtimeService,
    private readonly appNotification: AppNotificationService,
    private readonly genericFormService: GenericFormsService,
    private readonly componentConfigService: ComponentConfigService
  ) {
    this.dynamicControls = this.fb.group({});
  }

  ngOnInit(): void {
    this.initializeScreenSettings();

    this.messageId = Number(this.route.snapshot.paramMap.get('id') ?? 0);
    if (this.messageId <= 0) {
      return;
    }

    this.realtimeService.joinSubjectGroup(this.messageId);
    this.loadSubject();

    this.subscriptions.push(
      this.realtimeService.subscribeByEntity('subject', this.messageId).subscribe(() => {
        this.loadSubject();
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
    this.resetDynamicReadOnlyState();
  }

  trackByGroup = (_index: number, group: DynamicGroupRenderItem): number => group.groupId;

  getGroupDisplayName(group: DynamicGroupRenderItem): string {
    const groupName = String(group.groupName ?? '').trim();
    return groupName.length > 0 ? groupName : `مجموعة ${group.groupId}`;
  }

  getFormArrayControls(formArrayName: string): AbstractControl[] {
    const formArray = this.getFormArrayInstance(formArrayName);
    return formArray?.controls ?? [];
  }

  getFormArrayInstance(formArrayName: string): FormArray | null {
    const control = this.dynamicControls?.get(formArrayName);
    return control instanceof FormArray ? control : null;
  }

  getControlNamesFromGroup(groupControl: AbstractControl): string[] {
    if (groupControl instanceof FormGroup) {
      return Object.keys(groupControl.controls);
    }

    return [];
  }

  onDynamicFieldGenericEvent(_event: unknown): void {
    // reserved for future cross-field interactions
  }

  private initializeScreenSettings(): void {
    this.resolvedConfigRouteKey = this.resolveConfigRouteKey();
    const preset = this.screenPresets[this.resolvedConfigRouteKey]
      ?? this.screenPresets[DynamicSubjectDetailComponent.DETAIL_ROUTE_KEY];
    this.applyScreenPreset(preset);

    this.componentConfigService.getAll().subscribe({
      next: items => {
        const cfg = getConfigByRoute(this.resolvedConfigRouteKey, items || []);
        debugger; 
        if (!cfg) {
          return;
        }

        this.applyComponentConfig(cfg);
      },
      error: () => {
        // Keep preset defaults on config loading issues.
      }
    });
  }

  private resolveConfigRouteKey(): string {
    const routeDataKey = String(this.route.snapshot.data?.['configRouteKey'] ?? '').trim();
    if (routeDataKey.length > 0) {
      return routeDataKey;
    }

    const routePath = String(this.route.snapshot.routeConfig?.path ?? '').trim().toLowerCase();
    if (routePath === 'subjects/:id') {
      return DynamicSubjectDetailComponent.DETAIL_ROUTE_KEY;
    }

    const derivedKey = String(routeKey(this.router.url) ?? '').trim();
    if (derivedKey.length === 0) {
      return DynamicSubjectDetailComponent.DETAIL_ROUTE_KEY;
    }

    const normalized = derivedKey
      .replace(/^dynamicsubjects\//i, 'DynamicSubjects/')
      .replace(/^dynamic-subjects\//i, 'DynamicSubjects/');
    return normalized || DynamicSubjectDetailComponent.DETAIL_ROUTE_KEY;
  }

  private applyScreenPreset(preset?: DynamicSubjectDetailPreset): void {
    if (!preset) {
      return;
    }

    this.screenTitle = String(preset.title ?? this.screenTitle).trim() || this.screenTitle;
    this.allowStatusChange = preset.allowStatusChange !== false;
    this.statusOptions = this.normalizeStatusOptions(preset.statusOptions, this.statusOptions);
    this.showAttachmentsSection = preset.showAttachments !== false;
    this.showEnvelopesSection = preset.showEnvelopes !== false;
    this.showStakeholdersSection = preset.showStakeholders !== false;
    this.showTasksSection = preset.showTasks !== false;
    this.showTimelineSection = preset.showTimeline !== false;
  }

  private applyComponentConfig(config: ComponentConfig): void {
    const title = String(config.componentTitle ?? '').trim();
    if (title.length > 0) {
      this.screenTitle = title;
    }

    this.allowStatusChange = config.allowStatusChange !== false;
    const configStatusOptions = Array.isArray((config as any).statusChangeOptions)
      ? ((config as any).statusChangeOptions as Array<{ label?: string; value?: number | string }>)
      : [];
    this.statusOptions = this.normalizeStatusOptions(configStatusOptions, this.statusOptions);

    const fieldsConfiguration = (config as any).fieldsConfiguration ?? {};
    if (typeof fieldsConfiguration.isDivDisabled === 'boolean') {
      this.readOnlyDynamicFields = fieldsConfiguration.isDivDisabled;
    }

    const detailSections = (config as any).detailSections ?? {};
    if (detailSections && typeof detailSections === 'object') {
      if (typeof detailSections.attachments === 'boolean') this.showAttachmentsSection = detailSections.attachments;
      if (typeof detailSections.envelopes === 'boolean') this.showEnvelopesSection = detailSections.envelopes;
      if (typeof detailSections.stakeholders === 'boolean') this.showStakeholdersSection = detailSections.stakeholders;
      if (typeof detailSections.tasks === 'boolean') this.showTasksSection = detailSections.tasks;
      if (typeof detailSections.timeline === 'boolean') this.showTimelineSection = detailSections.timeline;
    }
  }

  private normalizeStatusOptions(
    candidates: Array<{ label?: string; value?: number | string }> | undefined,
    fallback: DetailStatusOption[]
  ): DetailStatusOption[] {
    const normalized = (candidates ?? [])
      .map(item => ({
        label: String(item?.label ?? '').trim(),
        value: Number(item?.value ?? NaN)
      }))
      .filter(item => item.label.length > 0 && Number.isFinite(item.value));

    return normalized.length > 0 ? normalized : [...fallback];
  }

  loadSubject(): void {
    this.loading = true;
    this.dynamicSubjectsController.getSubject(this.messageId).subscribe({
      next: response => {
        if (response?.errors?.length) {
          this.subject = null;
          this.appNotification.showApiErrors(response.errors, 'تعذر تحميل تفاصيل الموضوع/الطلب.');
          return;
        }

        this.subject = response?.data ?? null;
        if (this.subject) {
          this.subject.statusLabel = this.toArabicStatusLabel(this.subject.status, this.subject.statusLabel);
          this.loadDynamicFormDefinition(this.subject);
        } else {
          this.resetDynamicReadOnlyState();
        }
        this.statusToApply = this.subject?.status;
        (this.subject?.linkedEnvelopes ?? []).forEach(envelope => {
          this.realtimeService.joinEnvelopeGroup(envelope.envelopeId);
        });
      },
      error: () => {
        this.appNotification.error('حدث خطأ أثناء تحميل تفاصيل الموضوع/الطلب.');
      },
      complete: () => {
        this.loading = false;
      }
    });
  }

  applyStatus(): void {
    if (!this.subject || !this.statusToApply || this.statusToApply === this.subject.status) {
      return;
    }

    this.dynamicSubjectsController.changeStatus(this.subject.messageId, {
      newStatus: this.statusToApply,
      notes: 'تم تغيير الحالة من شاشة التفاصيل.'
    }).subscribe({
      next: response => {
        if (response?.errors?.length) {
          this.appNotification.showApiErrors(response.errors, 'تعذر تحديث الحالة الحالية.');
          return;
        }

        const updatedStatus = Number(response?.data?.newStatus ?? this.statusToApply ?? this.subject?.status ?? 0);
        if (this.subject && Number.isFinite(updatedStatus)) {
          this.subject.status = updatedStatus;
          this.subject.statusLabel = this.toArabicStatusLabel(updatedStatus, this.subject.statusLabel);
          this.subject.lastModifiedDate = response?.data?.changedAtUtc || this.subject.lastModifiedDate;
          this.statusToApply = updatedStatus;
        }

        this.appNotification.success('تم تحديث الحالة بنجاح.');
      },
      error: () => {
        this.appNotification.error('حدث خطأ أثناء تحديث الحالة.');
      }
    });
  }

  toArabicStatusLabel(status?: number, label?: string): string {
    const byCode: Record<number, string> = {
      10: 'مسودة',
      11: 'مقدم',
      12: 'قيد المراجعة',
      13: 'بانتظار الاستكمال',
      14: 'قيد التنفيذ',
      15: 'مكتمل',
      16: 'مرفوض',
      17: 'مؤرشف'
    };

    if (status && byCode[status]) {
      return byCode[status];
    }

    const normalized = String(label ?? '').trim().toLowerCase();
    if (normalized === 'draft') return 'مسودة';
    if (normalized === 'submitted') return 'مقدم';
    if (normalized === 'under review') return 'قيد المراجعة';
    if (normalized === 'pending completion') return 'بانتظار الاستكمال';
    if (normalized === 'in progress') return 'قيد التنفيذ';
    if (normalized === 'completed') return 'مكتمل';
    if (normalized === 'rejected') return 'مرفوض';
    if (normalized === 'archived') return 'مؤرشف';

    return label || 'غير محدد';
  }

  toArabicEventType(eventType?: string): string {
    switch (String(eventType ?? '').trim()) {
      case 'SubjectCreated': return 'إنشاء موضوع/طلب';
      case 'SubjectUpdated': return 'تحديث موضوع/طلب';
      case 'SubjectStatusChanged': return 'تغيير حالة الموضوع/الطلب';
      case 'AttachmentAdded': return 'إضافة مرفق';
      case 'AttachmentRemoved': return 'حذف مرفق';
      case 'StakeholderAssigned': return 'إسناد جهة معنية';
      case 'TaskUpdated': return 'تحديث مهمة';
      case 'EnvelopeLinked': return 'ربط ظرف وارد';
      case 'EnvelopeUnlinked': return 'فك ارتباط الظرف';
      case 'EnvelopeCreated': return 'إنشاء ظرف وارد';
      case 'EnvelopeUpdated': return 'تحديث ظرف وارد';
      default: return 'تحديث';
    }
  }

  toArabicPartyType(partyType?: string): string {
    const normalized = String(partyType ?? '').trim().toLowerCase();
    if (normalized === 'viewer') {
      return 'مشاهد';
    }

    if (normalized === 'assignee') {
      return 'مكلف';
    }

    return partyType || 'غير محدد';
  }

  toArabicTimelineTitle(eventType?: string, eventTitle?: string): string {
    const raw = String(eventTitle ?? '').trim();
    if (!raw) {
      return this.toArabicEventType(eventType);
    }

    if (/[\u0600-\u06FF]/.test(raw)) {
      return raw;
    }

    const normalized = raw.toLowerCase();
    if (normalized.includes('subject created')) return 'تم إنشاء الموضوع/الطلب.';
    if (normalized.includes('subject updated')) return 'تم تحديث بيانات الموضوع/الطلب.';
    if (normalized.includes('status changed')) return 'تم تغيير الحالة.';
    if (normalized.includes('attachment')) return 'تم تحديث المرفقات.';
    if (normalized.includes('envelope linked')) return 'تم ربط الموضوع بظرف وارد.';
    if (normalized.includes('envelope')) return 'تم تحديث بيانات الظرف الوارد.';
    if (normalized.includes('task')) return 'تم تحديث المهام.';

    return this.toArabicEventType(eventType);
  }

  private loadDynamicFormDefinition(detail: SubjectDetailDto): void {
    const categoryId = Number(detail?.categoryId ?? 0);
    if (categoryId <= 0) {
      this.resetDynamicReadOnlyState();
      return;
    }

    const values = detail.dynamicFields ?? [];
    const appId = this.dynamicSubjectAccess.getApplicationId();
    this.dynamicSubjectsController.getFormDefinition(categoryId, appId).subscribe({
      next: response => {
        const hasErrors = Boolean(response?.errors?.length);
        const hasAnyField = Number(response?.data?.fields?.length ?? 0) > 0;
        const shouldRetryWithoutAppScope = hasErrors || !hasAnyField;

        if (shouldRetryWithoutAppScope) {
          this.dynamicSubjectsController.getFormDefinition(categoryId).subscribe({
            next: fallbackResponse => {
              if (fallbackResponse?.errors?.length) {
                this.loadLegacyFormDefinition(categoryId, values);
                return;
              }

              const fallbackDefinition = fallbackResponse?.data ?? null;
              if (!this.hasRenderableDefinition(fallbackDefinition)) {
                this.loadLegacyFormDefinition(categoryId, values);
                return;
              }

              this.applyLoadedDefinition(fallbackDefinition, values);
            },
            error: () => {
              this.loadLegacyFormDefinition(categoryId, values);
            }
          });
          return;
        }

        const definition = response?.data ?? null;
        if (!this.hasRenderableDefinition(definition)) {
          this.loadLegacyFormDefinition(categoryId, values);
          return;
        }

        this.applyLoadedDefinition(definition, values);
      },
      error: () => {
        this.loadLegacyFormDefinition(categoryId, values);
      }
    });
  }

  private hasRenderableDefinition(definition: SubjectFormDefinitionDto | null | undefined): boolean {
    return Boolean(definition && Array.isArray(definition.fields) && definition.fields.length > 0);
  }

  private applyLoadedDefinition(definition: SubjectFormDefinitionDto | null, values: SubjectFieldValueDto[]): void {
    this.formDefinition = definition ?? null;
    this.rebuildReadOnlyDynamicControls(this.formDefinition, values);
  }

  private loadLegacyFormDefinition(categoryId: number, values: SubjectFieldValueDto[]): void {
    const tryLoad = (appScope?: string, hasRetried = false) => {
      forkJoin({
        linksResponse: this.dynamicFormController.getMandatoryAll(appScope),
        mendsResponse: this.dynamicFormController.getMandatoryMetaDate(appScope)
      }).subscribe({
        next: ({ linksResponse, mendsResponse }) => {
          const links = linksResponse?.data ?? [];
          const mends = mendsResponse?.data ?? [];
          const definition = this.buildLegacyDefinition(categoryId, links, mends);

          if (!this.hasRenderableDefinition(definition)) {
            if (!hasRetried) {
              tryLoad(undefined, true);
              return;
            }

            const fallbackDefinition = this.buildDefinitionFromSavedValues(categoryId, values);
            if (this.hasRenderableDefinition(fallbackDefinition)) {
              this.applyLoadedDefinition(fallbackDefinition, values);
              return;
            }

            this.formDefinition = null;
            this.resetDynamicReadOnlyState();
            return;
          }

          this.applyLoadedDefinition(definition, values);
        },
        error: () => {
          if (!hasRetried) {
            tryLoad(undefined, true);
            return;
          }

          const fallbackDefinition = this.buildDefinitionFromSavedValues(categoryId, values);
          if (this.hasRenderableDefinition(fallbackDefinition)) {
            this.applyLoadedDefinition(fallbackDefinition, values);
            return;
          }

          this.formDefinition = null;
          this.resetDynamicReadOnlyState();
        }
      });
    };

    tryLoad(this.dynamicSubjectAccess.getApplicationId());
  }

  private buildLegacyDefinition(categoryId: number, links: CdCategoryMandDto[], mends: CdmendDto[]): SubjectFormDefinitionDto | null {
    const categoryLinks = (links ?? [])
      .filter(link => Number(link.mendCategory ?? 0) === categoryId && !Boolean(link.mendStat))
      .sort((left, right) => {
        const byGroup = Number(left.mendGroup ?? 0) - Number(right.mendGroup ?? 0);
        if (byGroup !== 0) {
          return byGroup;
        }

        return Number(left.mendSql ?? 0) - Number(right.mendSql ?? 0);
      });
    if (categoryLinks.length === 0) {
      return null;
    }

    const requestedAppId = this.normalizeLegacyAppId(this.dynamicSubjectAccess.getApplicationId());
    const categoryAppId = this.normalizeLegacyAppId(
      categoryLinks.find(link => String(link.applicationId ?? '').trim().length > 0)?.applicationId
    );
    const mendMap = new Map<string, CdmendDto[]>();
    (mends ?? []).forEach(mend => {
      const key = this.normalizeLegacyFieldKey(mend.cdmendTxt);
      if (!key) {
        return;
      }

      const existing = mendMap.get(key) ?? [];
      existing.push(mend);
      mendMap.set(key, existing);
    });

    const groupsMap = new Map<number, SubjectGroupDefinitionDto>();
    const fields: SubjectFieldDefinitionDto[] = [];

    categoryLinks.forEach((link, index) => {
      const fieldKey = String(link.mendField ?? '').trim();
      if (!fieldKey) {
        return;
      }

      const mend = this.selectLegacyMend(
        mendMap.get(this.normalizeLegacyFieldKey(fieldKey)) ?? [],
        requestedAppId,
        categoryAppId
      );
      if (!mend) {
        return;
      }

      const groupId = Number(link.mendGroup ?? 0);
      if (!groupsMap.has(groupId)) {
        groupsMap.set(groupId, {
          groupId,
          groupName: String(link.groupName ?? '').trim(),
          groupDescription: '',
          isExtendable: Boolean(link.isExtendable),
          groupWithInRow: Number(link.groupWithInRow ?? 12)
        });
      }

      const group = groupsMap.get(groupId)!;
      fields.push({
        mendSql: Number(link.mendSql ?? 0),
        categoryId,
        mendGroup: groupId,
        fieldKey,
        fieldType: String(mend.cdmendType ?? ''),
        fieldLabel: mend.cdMendLbl ?? fieldKey,
        placeholder: mend.placeholder ?? '',
        defaultValue: mend.defaultValue ?? '',
        optionsPayload: mend.cdmendTbl ?? '',
        dataType: mend.cdmendDatatype ?? '',
        required: Boolean(mend.required),
        requiredTrue: Boolean(mend.requiredTrue),
        email: Boolean(mend.email),
        pattern: Boolean(mend.pattern),
        minValue: mend.minValue ?? '',
        maxValue: mend.maxValue ?? '',
        mask: mend.cdmendmask ?? '',
        isDisabledInit: Boolean(mend.isDisabledInit),
        isSearchable: Boolean(mend.isSearchable),
        width: Number(mend.width ?? 0),
        height: Number(mend.height ?? 0),
        applicationId: mend.applicationId ?? undefined,
        displayOrder: index + 1,
        isVisible: true,
        displaySettingsJson: undefined,
        group
      });
    });

    if (fields.length === 0) {
      return null;
    }

    return {
      categoryId,
      categoryName: '',
      parentCategoryId: 0,
      applicationId: this.dynamicSubjectAccess.getApplicationId(),
      groups: Array.from(groupsMap.values()).sort((left, right) => left.groupId - right.groupId),
      fields
    };
  }

  private buildDefinitionFromSavedValues(categoryId: number, values: SubjectFieldValueDto[]): SubjectFormDefinitionDto | null {
    const savedFields = (values ?? [])
      .map(field => ({
        fieldKey: String(field.fieldKey ?? '').trim(),
        value: String(field.value ?? '')
      }))
      .filter(field => field.fieldKey.length > 0);
    if (savedFields.length === 0) {
      return null;
    }

    const group: SubjectGroupDefinitionDto = {
      groupId: 1,
      groupName: 'الحقول الديناميكية',
      groupDescription: 'قيم الحقول المحفوظة',
      isExtendable: false,
      groupWithInRow: 12
    };
    const fields: SubjectFieldDefinitionDto[] = savedFields.map((field, index) => ({
      mendSql: index + 1,
      categoryId,
      mendGroup: group.groupId,
      fieldKey: field.fieldKey,
      fieldType: this.inferFieldTypeFromSavedValue(field.value),
      fieldLabel: field.fieldKey,
      placeholder: '',
      defaultValue: field.value,
      optionsPayload: '',
      dataType: 'string',
      required: false,
      requiredTrue: false,
      email: false,
      pattern: false,
      minValue: '',
      maxValue: '',
      mask: '',
      isDisabledInit: true,
      isSearchable: false,
      width: 0,
      height: 0,
      applicationId: this.dynamicSubjectAccess.getApplicationId(),
      displayOrder: index + 1,
      isVisible: true,
      displaySettingsJson: undefined,
      group
    }));

    return {
      categoryId,
      categoryName: '',
      parentCategoryId: 0,
      applicationId: this.dynamicSubjectAccess.getApplicationId(),
      groups: [group],
      fields
    };
  }

  private inferFieldTypeFromSavedValue(value: string): string {
    const normalized = String(value ?? '').trim();
    if (!normalized) {
      return 'InputText';
    }

    if (/^\d{4}-\d{2}-\d{2}(?:[tT ].*)?$/.test(normalized)) {
      return 'Date';
    }

    if (['true', 'false', 'yes', 'no', 'on', 'off', '0', '1'].includes(normalized.toLowerCase())) {
      return 'ToggleSwitch';
    }

    return 'InputText';
  }

  private normalizeLegacyFieldKey(value: string | undefined): string {
    return String(value ?? '').trim().toLowerCase();
  }

  private normalizeLegacyAppId(value: string | undefined): string {
    return String(value ?? '').trim();
  }

  private getLegacyMendAppRank(mend: CdmendDto, requestedAppId: string, categoryAppId: string): number {
    const mendAppId = this.normalizeLegacyAppId(mend.applicationId);
    if (requestedAppId.length > 0 && mendAppId.toLowerCase() === requestedAppId.toLowerCase()) {
      return 0;
    }

    if (categoryAppId.length > 0 && mendAppId.toLowerCase() === categoryAppId.toLowerCase()) {
      return 1;
    }

    if (mendAppId.length === 0) {
      return 2;
    }

    return 3;
  }

  private selectLegacyMend(candidates: CdmendDto[], requestedAppId: string, categoryAppId: string): CdmendDto | null {
    if (!Array.isArray(candidates) || candidates.length === 0) {
      return null;
    }

    const ranked = [...candidates]
      .sort((left, right) => {
        const rankDiff = this.getLegacyMendAppRank(left, requestedAppId, categoryAppId)
          - this.getLegacyMendAppRank(right, requestedAppId, categoryAppId);
        if (rankDiff !== 0) {
          return rankDiff;
        }

        return Number(left.cdmendSql ?? 0) - Number(right.cdmendSql ?? 0);
      });
    const bestRank = this.getLegacyMendAppRank(ranked[0], requestedAppId, categoryAppId);
    const sameRank = ranked.filter(item => this.getLegacyMendAppRank(item, requestedAppId, categoryAppId) === bestRank);
    if (sameRank.length === 0) {
      return null;
    }

    const activeMends = sameRank
      .filter(item => !Boolean(item.cdmendStat))
      .sort((left, right) => Number(left.cdmendSql ?? 0) - Number(right.cdmendSql ?? 0));
    if (activeMends.length > 0) {
      return activeMends[0];
    }

    return sameRank
      .sort((left, right) => Number(left.cdmendSql ?? 0) - Number(right.cdmendSql ?? 0))[0] ?? null;
  }

  private rebuildReadOnlyDynamicControls(definition: SubjectFormDefinitionDto | null, values: SubjectFieldValueDto[]): void {
    this.resetDynamicReadOnlyState();

    const allFields = (definition?.fields ?? [])
      .sort((left, right) => Number(left.displayOrder ?? 0) - Number(right.displayOrder ?? 0));
    const visibleFields = allFields.filter(field => field.isVisible !== false);
    const fieldsToRender = visibleFields.length > 0 ? visibleFields : allFields;
    if (!definition || fieldsToRender.length === 0) {
      return;
    }

    const fieldsByGroup = new Map<number, SubjectFieldDefinitionDto[]>();
    fieldsToRender.forEach(field => {
      const groupId = Number(field.mendGroup ?? 0);
      if (!fieldsByGroup.has(groupId)) {
        fieldsByGroup.set(groupId, []);
      }

      fieldsByGroup.get(groupId)?.push(field);
    });

    const orderedGroupIds: number[] = [];
    const definitionGroups = definition.groups ?? [];
    definitionGroups.forEach(group => {
      if (fieldsByGroup.has(group.groupId)) {
        orderedGroupIds.push(group.groupId);
      }
    });

    Array.from(fieldsByGroup.keys())
      .filter(groupId => !orderedGroupIds.includes(groupId))
      .sort((left, right) => left - right)
      .forEach(groupId => orderedGroupIds.push(groupId));

    const mappedMendDefinitions: CdmendDto[] = [];
    const mappedCategoryMandDefinitions: CdCategoryMandDto[] = [];
    let nextControlIndex = 0;

    orderedGroupIds.forEach(groupId => {
      const groupFields = fieldsByGroup.get(groupId) ?? [];
      if (groupFields.length === 0) {
        return;
      }

      const groupDefinition = definitionGroups.find(group => Number(group.groupId) === groupId);
      const groupName = String(groupDefinition?.groupName ?? groupFields[0]?.group?.groupName ?? `مجموعة ${groupId}`);
      const formArrayName = `dynamic_subject_detail_group_${groupId}`;
      const formArray = this.fb.array([]);
      const mappedGroupFields: CdCategoryMandDto[] = [];

      groupFields.forEach(field => {
        const controlIndex = nextControlIndex++;
        const controlName = `${field.fieldKey}|${controlIndex}`;
        const cdmendType = this.mapFieldTypeToGenericType(field.fieldType);
        const cdmendDatatype = this.mapFieldDataType(field, cdmendType);
        const usesSelectionTable = cdmendType === 'Dropdown' || cdmendType === 'RadioButton';
        const cdmendTbl = usesSelectionTable
          ? this.parseFieldOptionsAsSelectionJson(field.optionsPayload)
          : this.resolvePatternExpression(field.optionsPayload);
        const hasPattern = Boolean(field.pattern) && cdmendTbl.length > 0;

        const mappedMendDefinition: CdmendDto = {
          cdmendSql: Number(field.mendSql ?? 0),
          cdmendType,
          cdmendTxt: field.fieldKey,
          cdMendLbl: field.fieldLabel ?? field.fieldKey,
          placeholder: field.placeholder ?? '',
          defaultValue: field.defaultValue ?? '',
          cdmendTbl,
          cdmendDatatype,
          required: Boolean(field.required),
          requiredTrue: Boolean(field.requiredTrue),
          email: Boolean(field.email),
          pattern: hasPattern,
          min: Number.isFinite(Number(field.minValue)) ? Number(field.minValue) : undefined,
          max: Number.isFinite(Number(field.maxValue)) ? Number(field.maxValue) : undefined,
          minxLenght: undefined,
          maxLenght: undefined,
          cdmendmask: field.mask ?? '',
          cdmendStat: true,
          maxValue: field.maxValue ?? '',
          minValue: field.minValue ?? '',
          width: Number(field.width ?? 0),
          height: Number(field.height ?? 0),
          isDisabledInit: Boolean(field.isDisabledInit),
          isSearchable: Boolean(field.isSearchable),
          applicationId: field.applicationId
        };
        mappedMendDefinitions.push(mappedMendDefinition);

        const mappedGroupField: CdCategoryMandDto = {
          mendSql: Number(field.mendSql ?? 0),
          mendCategory: Number(field.categoryId ?? definition.categoryId),
          mendField: field.fieldKey,
          mendStat: true,
          mendGroup: groupId,
          applicationId: field.applicationId ?? definition.applicationId,
          groupName,
          isExtendable: Boolean(groupDefinition?.isExtendable ?? field.group?.isExtendable),
          groupWithInRow: Number(groupDefinition?.groupWithInRow ?? field.group?.groupWithInRow ?? 12)
        };
        mappedGroupFields.push(mappedGroupField);
        mappedCategoryMandDefinitions.push(mappedGroupField);

        this.genericFormService.addFormArrayWithValidators(controlName, formArray);

        const matchedValue = values.find(valueItem =>
          String(valueItem.fieldKey ?? '').toLowerCase() === String(field.fieldKey ?? '').toLowerCase()
          && Number(valueItem.instanceGroupId ?? 1) === 1);
        const initialValue = this.normalizeInitialDynamicValue(field, cdmendType, matchedValue?.value ?? field.defaultValue);
        const control = this.genericFormService.GetControl(formArray, controlName);
        control?.patchValue(initialValue, { emitEvent: false });
        control?.disable({ emitEvent: false });
      });

      this.dynamicControls.addControl(formArrayName, formArray);
      this.renderGroups.push({
        groupId,
        groupName,
        formArrayName,
        fields: mappedGroupFields
      });
    });

    this.genericFormService.cdmendDto = mappedMendDefinitions;
    this.genericFormService.cdCategoryMandDto = mappedCategoryMandDefinitions;
  }

  private mapFieldTypeToGenericType(fieldType?: string): string {
    const normalized = String(fieldType ?? '').trim().toLowerCase();

    if (normalized.includes('label')) {
      return 'LABLE';
    }
    if (normalized.includes('textarea')) {
      return 'Textarea';
    }
    if (normalized.includes('radio')) {
      return 'RadioButton';
    }
    if (normalized.includes('select') || normalized.includes('drop') || normalized.includes('combo')) {
      return 'Dropdown';
    }
    if (normalized.includes('toggle') || normalized.includes('bool') || normalized.includes('check') || normalized.includes('switch')) {
      return 'ToggleSwitch';
    }
    if (normalized.includes('datetime') || (normalized.includes('date') && normalized.includes('time'))) {
      return 'DateTime';
    }
    if (normalized.includes('date') || normalized.includes('calendar')) {
      return 'Date';
    }
    if (normalized.includes('file')) {
      return 'FileUpload';
    }
    if (normalized.includes('int')) {
      return 'InputText-integeronly';
    }

    return 'InputText';
  }

  private mapFieldDataType(field: SubjectFieldDefinitionDto, cdmendType: string): string {
    const normalizedDataType = String(field.dataType ?? '').trim().toLowerCase();
    const normalizedFieldType = String(field.fieldType ?? '').trim().toLowerCase();
    if (normalizedDataType.includes('date') || normalizedDataType.includes('time')) {
      return 'date';
    }
    if (normalizedDataType.includes('number') || normalizedDataType.includes('int') || normalizedDataType.includes('decimal')) {
      return 'number';
    }
    if (normalizedDataType.includes('bool')) {
      return 'boolean';
    }

    if (cdmendType === 'Date' || cdmendType === 'DateTime') {
      return 'date';
    }
    if (cdmendType === 'ToggleSwitch') {
      return 'boolean';
    }
    if (cdmendType === 'InputText-integeronly') {
      return 'number';
    }
    if (normalizedFieldType.includes('number') || normalizedFieldType.includes('int') || normalizedFieldType.includes('decimal')) {
      return 'number';
    }

    return 'string';
  }

  private normalizeInitialDynamicValue(field: SubjectFieldDefinitionDto, cdmendType: string, value: unknown): unknown {
    if (value === null || value === undefined || value === '') {
      return cdmendType === 'ToggleSwitch' ? false : (cdmendType === 'Date' || cdmendType === 'DateTime' ? null : '');
    }

    if (cdmendType === 'ToggleSwitch') {
      if (typeof value === 'boolean') {
        return value;
      }

      const normalized = String(value).trim().toLowerCase();
      return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on';
    }

    if (cdmendType === 'Date' || cdmendType === 'DateTime') {
      const parsedDate = value instanceof Date ? value : new Date(String(value));
      return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
    }

    if (cdmendType === 'Dropdown' || cdmendType === 'RadioButton') {
      return String(value);
    }

    const looksNumeric = String(field.dataType ?? '').toLowerCase().includes('number')
      || String(field.dataType ?? '').toLowerCase().includes('int')
      || String(field.dataType ?? '').toLowerCase().includes('decimal');
    if (looksNumeric) {
      const numericValue = Number(value);
      if (Number.isFinite(numericValue)) {
        return numericValue;
      }
    }

    return value;
  }

  private parseFieldOptionsAsSelectionJson(optionsPayload?: string): string {
    const options = this.parseFieldOptions(optionsPayload);
    return JSON.stringify(options.map(option => ({
      key: option.value,
      name: option.label
    })));
  }

  private parseFieldOptions(optionsPayload?: string): Array<{ label: string; value: string }> {
    const payload = String(optionsPayload ?? '').trim();
    if (!payload) {
      return [];
    }

    try {
      const parsed = JSON.parse(payload);
      if (Array.isArray(parsed)) {
        return parsed
          .map(item => this.mapOptionItem(item))
          .filter((item): item is { label: string; value: string } => item !== null);
      }
    } catch {
      // no-op and fallback to delimited parsing
    }

    return payload
      .split(/[|,;\n]+/g)
      .map(item => item.trim())
      .filter(item => item.length > 0)
      .map(item => ({ label: item, value: item }));
  }

  private mapOptionItem(item: unknown): { label: string; value: string } | null {
    if (item === null || item === undefined) {
      return null;
    }
    if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') {
      const value = String(item);
      return { label: value, value };
    }

    const asObject = item as Record<string, unknown>;
    const value = String(asObject['value'] ?? asObject['id'] ?? asObject['key'] ?? asObject['label'] ?? asObject['name'] ?? '');
    const label = String(asObject['label'] ?? asObject['name'] ?? asObject['text'] ?? value);
    if (!value && !label) {
      return null;
    }

    return { label: label || value, value: value || label };
  }

  private resolvePatternExpression(optionsPayload?: string): string {
    const payload = String(optionsPayload ?? '').trim();
    if (!payload) {
      return '';
    }
    if (payload.startsWith('[') || payload.startsWith('{')) {
      return '';
    }

    return payload;
  }

  private resetDynamicReadOnlyState(): void {
    this.formDefinition = null;
    this.dynamicControls = this.fb.group({});
    this.renderGroups = [];
    this.genericFormService.resetDynamicRuntimeState();
    this.genericFormService.cdmendDto = [];
    this.genericFormService.cdCategoryMandDto = [];
  }
}
