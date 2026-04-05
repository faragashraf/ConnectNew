import { Component, OnDestroy, OnInit } from '@angular/core';
import { AbstractControl, FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, forkJoin } from 'rxjs';
import { ComponentConfigService } from 'src/app/Modules/admins/services/component-config.service';
import { CentralAdminPreviewFoundationService } from 'src/app/Modules/admins/services/central-admin-preview-foundation.service';
import { GenericFormsService } from 'src/app/Modules/GenericComponents/GenericForms.service';
import { DynamicFormController, PowerBiController } from 'src/app/shared/services/BackendServices';
import { CdCategoryMandDto, CdmendDto } from 'src/app/shared/services/BackendServices/DynamicForm/DynamicForm.dto';
import { FileParameter } from 'src/app/shared/services/BackendServices/dto-shared';
import { DynamicSubjectsController } from 'src/app/shared/services/BackendServices/DynamicSubjects/DynamicSubjects.service';
import {
  EnvelopeSummaryDto,
  SubjectCategoryTreeNodeDto,
  SubjectDetailDto,
  SubjectFieldDefinitionDto,
  SubjectFieldValueDto,
  SubjectFormDefinitionDto,
  SubjectGroupDefinitionDto,
  SubjectUpsertRequest
} from 'src/app/shared/services/BackendServices/DynamicSubjects/DynamicSubjects.dto';
import { ComponentConfig, getConfigByRoute, processRequestsAndPopulate, RequestArrayItem, routeKey } from 'src/app/shared/models/Component.Config.model';
import { AppNotificationService } from 'src/app/shared/services/notifications/app-notification.service';
import { DynamicGroupRenderItem } from '../shared/models/dynamic-group-render-item.model';
import { DynamicSubjectsRealtimeService } from '../../services/dynamic-subjects-realtime.service';
import { DynamicSubjectAccessService } from '../../services/dynamic-subject-access.service';

@Component({
  selector: 'app-dynamic-subject-editor',
  templateUrl: './dynamic-subject-editor.component.html',
  styleUrls: ['./dynamic-subject-editor.component.scss']
})
export class DynamicSubjectEditorComponent implements OnInit, OnDestroy {
  private static readonly EDITOR_ROUTE_KEY = 'DynamicSubjects/SubjectEditor';

  editorForm: FormGroup;
  dynamicControls: FormGroup;
  stakeholdersArray: FormArray;
  tasksArray: FormArray;

  loading = false;
  saving = false;
  isEditMode = false;
  messageId = 0;
  formDefinition: SubjectFormDefinitionDto | null = null;
  renderGroups: DynamicGroupRenderItem[] = [];
  categoryOptions: Array<{ id: number; name: string }> = [];
  pendingFiles: FileParameter[] = [];
  existingAttachments: Array<{ attachmentId: number; fileName: string }> = [];
  availableEnvelopes: EnvelopeSummaryDto[] = [];
  liveEventNotice = '';
  submitAttempted = false;
  config: ComponentConfig | null = null;
  resolvedConfigRouteKey = DynamicSubjectEditorComponent.EDITOR_ROUTE_KEY;
  unitTree: any[] = [];
  private allowedCategoryIds = new Set<number>();
  private allConfigs: ComponentConfig[] = [];
  private treeCapableFieldKeys = new Set<string>();

  private controlMap = new Map<string, { fieldKey: string; instanceGroupId: number }>();
  private readonly subscriptions: Subscription[] = [];

  constructor(
    private readonly fb: FormBuilder,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly dynamicSubjectsController: DynamicSubjectsController,
    private readonly dynamicFormController: DynamicFormController,
    private readonly powerBiController: PowerBiController,
    private readonly dynamicSubjectAccess: DynamicSubjectAccessService,
    private readonly realtimeService: DynamicSubjectsRealtimeService,
    private readonly componentConfigService: ComponentConfigService,
    private readonly previewFoundation: CentralAdminPreviewFoundationService,
    private readonly genericFormService: GenericFormsService,
    private readonly appNotification: AppNotificationService
  ) {
    this.editorForm = this.fb.group({
      categoryId: [0, Validators.required],
      subject: [''],
      description: [''],
      envelopeId: [null]
    });

    this.dynamicControls = this.fb.group({});
    this.stakeholdersArray = this.fb.array([]);
    this.tasksArray = this.fb.array([]);
  }

  ngOnInit(): void {
    this.initializeScreenConfig();
    this.loadCategoryOptions();
    this.loadEnvelopeOptions();

    const routeId = Number(this.route.snapshot.paramMap.get('id') ?? 0);
    this.isEditMode = routeId > 0;
    this.messageId = routeId;

    if (this.isEditMode) {
      this.realtimeService.joinSubjectGroup(routeId);
      this.loadSubject(routeId);
    } else {
      this.subscriptions.push(
        this.route.queryParamMap.subscribe(params => {
          const categoryId = Number(params.get('categoryId') ?? 0);
          if (categoryId > 0) {
            this.editorForm.patchValue({ categoryId });
            this.loadFormDefinition(categoryId);
            this.executeConfigRequests('onCategoryChanged', { categoryId });
          }
        })
      );
    }

    this.subscriptions.push(
      this.realtimeService.events$().subscribe(eventItem => {
        if (Number(eventItem.messageId ?? 0) !== this.messageId || !this.messageId) {
          return;
        }

        const formattedTime = new Date(eventItem.timestampUtc).toLocaleTimeString('ar-EG');
        this.liveEventNotice = `تم استلام تحديث مباشر: ${this.toArabicEventType(eventItem.eventType)} - ${formattedTime}`;
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  get stakeholdersControls(): FormGroup[] {
    return this.stakeholdersArray.controls as FormGroup[];
  }

  get tasksControls(): FormGroup[] {
    return this.tasksArray.controls as FormGroup[];
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

  private initializeScreenConfig(): void {
    this.resolvedConfigRouteKey = this.resolveConfigRouteKey();
    this.componentConfigService.getAll().subscribe({
      next: items => {
        this.allConfigs = items || [];
        const cfg = getConfigByRoute(this.resolvedConfigRouteKey, items || []);
        if (!cfg) {
          this.config = null;
          this.treeCapableFieldKeys.clear();
          return;
        }

        this.config = cfg;
        const currentCategoryId = Number(this.editorForm.get('categoryId')?.value ?? 0);
        this.refreshTreeRuntimeMetadata(currentCategoryId);
        this.executeConfigRequests('onInit', {
          categoryId: currentCategoryId
        });
      },
      error: () => {
        this.config = null;
        this.treeCapableFieldKeys.clear();
      }
    });
  }

  private resolveConfigRouteKey(): string {
    const routeDataKey = String(this.route.snapshot.data?.['configRouteKey'] ?? '').trim();
    if (routeDataKey.length > 0) {
      return routeDataKey;
    }

    const routePath = String(this.route.snapshot.routeConfig?.path ?? '').trim().toLowerCase();
    if (routePath === 'subjects/new' || routePath === 'subjects/:id/edit') {
      return DynamicSubjectEditorComponent.EDITOR_ROUTE_KEY;
    }

    const derivedKey = String(routeKey(this.router.url) ?? '').trim();
    if (derivedKey.length === 0) {
      return DynamicSubjectEditorComponent.EDITOR_ROUTE_KEY;
    }

    const normalized = derivedKey
      .replace(/^dynamicsubjects\//i, 'DynamicSubjects/')
      .replace(/^dynamic-subjects\//i, 'DynamicSubjects/');
    return normalized || DynamicSubjectEditorComponent.EDITOR_ROUTE_KEY;
  }

  private executeConfigRequests(trigger: 'onInit' | 'onCategoryChanged', runtime: Record<string, any>): void {
    if (!this.config) {
      return;
    }

    const categoryId = Number(runtime?.['categoryId'] ?? this.editorForm.get('categoryId')?.value ?? 0);
    this.refreshTreeRuntimeMetadata(categoryId);

    const runtimeConfig = this.buildRuntimeConfigWithSupplementalTreeRequests(categoryId);
    if (!runtimeConfig) {
      return;
    }

    this.config = runtimeConfig;
    if (trigger === 'onCategoryChanged') {
      this.unitTree = [];
    }

    processRequestsAndPopulate(this, this.genericFormService, undefined, {
      trigger,
      runtime: {
        ...runtime,
        categoryId
      },
      preserveDynamicMetadata: true,
      trace: Boolean(runtimeConfig.dynamicFormSettings?.traceRequests)
    }).subscribe({
      next: () => {
        this.applyPendingDynamicFieldValueBindings();
      },
      error: () => {
        // defensive fallback: request pipeline issues should not block editor rendering.
      }
    });
  }

  onCategoryChanged(): void {
    const categoryId = Number(this.editorForm.get('categoryId')?.value ?? 0);
    if (categoryId > 0) {
      this.loadFormDefinition(categoryId);
      this.realtimeService.joinCategoryGroup(categoryId);
      this.executeConfigRequests('onCategoryChanged', { categoryId });
    }
  }

  addStakeholder(): void {
    this.stakeholdersArray.push(this.fb.group({
      stockholderId: [0, Validators.required],
      partyType: ['Viewer'],
      requiredResponse: [false],
      status: [null],
      dueDate: [null],
      notes: ['']
    }));
  }

  removeStakeholder(index: number): void {
    this.stakeholdersArray.removeAt(index);
  }

  addTask(): void {
    this.tasksArray.push(this.fb.group({
      actionTitle: ['', Validators.required],
      actionDescription: [''],
      assignedToUserId: [''],
      assignedUnitId: [''],
      dueDateUtc: [null],
      status: [0]
    }));
  }

  removeTask(index: number): void {
    this.tasksArray.removeAt(index);
  }

  onFilesChanged(event: Event): void {
    const input = event.target as HTMLInputElement;
    const selected = Array.from(input.files ?? []);
    this.pendingFiles = selected.map(file => ({ data: file, fileName: file.name }));
  }

  removeExistingAttachment(attachmentId: number): void {
    if (!this.messageId || attachmentId <= 0) {
      return;
    }

    this.dynamicSubjectsController.removeAttachment(this.messageId, attachmentId).subscribe({
      next: response => {
        if (response?.errors?.length) {
          this.appNotification.showApiErrors(response.errors, 'تعذر حذف المرفق.');
          return;
        }

        this.existingAttachments = this.existingAttachments.filter(item => item.attachmentId !== attachmentId);
        this.appNotification.success('تم حذف المرفق بنجاح.');
      },
      error: () => {
        this.appNotification.error('حدث خطأ أثناء حذف المرفق.');
      }
    });
  }

  saveDraft(): void {
    this.save(false);
  }

  submitSubject(): void {
    this.save(true);
  }

  private save(submit: boolean): void {
    this.submitAttempted = true;
    const categoryId = Number(this.editorForm.get('categoryId')?.value ?? 0);
    if (categoryId <= 0) {
      this.editorForm.get('categoryId')?.markAsTouched();
      this.appNotification.warning('يرجى اختيار نوع الموضوع/الطلب.');
      return;
    }

    if (this.dynamicControls.invalid) {
      this.dynamicControls.markAllAsTouched();
      this.appNotification.warning('يرجى استكمال الحقول الديناميكية المطلوبة.');
      return;
    }

    const request: SubjectUpsertRequest = {
      categoryId,
      subject: this.editorForm.get('subject')?.value ?? '',
      description: this.editorForm.get('description')?.value ?? '',
      envelopeId: Number(this.editorForm.get('envelopeId')?.value ?? 0) || undefined,
      saveAsDraft: !submit,
      submit,
      dynamicFields: this.buildDynamicFieldValues(),
      stakeholders: this.buildStakeholdersPayload(),
      tasks: this.buildTasksPayload()
    };

    this.saving = true;
    const request$ = this.isEditMode
      ? this.dynamicSubjectsController.updateSubject(this.messageId, request, this.pendingFiles)
      : this.dynamicSubjectsController.createSubject(request, this.pendingFiles);

    request$.subscribe({
      next: response => {
        if (response?.errors?.length) {
          this.appNotification.showApiErrors(response.errors, 'تعذر حفظ الموضوع/الطلب.');
          return;
        }

        const createdId = Number(response?.data?.messageId ?? this.messageId ?? 0);
        if (createdId > 0) {
          this.appNotification.success(submit ? 'تم إرسال الموضوع/الطلب بنجاح.' : 'تم حفظ الموضوع/الطلب كمسودة.');
          this.router.navigate(['/DynamicSubjects/subjects', createdId]);
        }
      },
      error: () => {
        this.appNotification.error('حدث خطأ أثناء حفظ الموضوع/الطلب.');
      },
      complete: () => {
        this.saving = false;
      }
    });
  }

  private loadSubject(messageId: number): void {
    this.loading = true;
    this.dynamicSubjectsController.getSubject(messageId).subscribe({
      next: response => {
        if (response?.errors?.length) {
          this.appNotification.showApiErrors(response.errors, 'تعذر تحميل بيانات الموضوع/الطلب.');
          return;
        }

        const detail = response?.data;
        if (!detail) {
          return;
        }

        this.editorForm.patchValue({
          categoryId: detail.categoryId,
          subject: detail.subject ?? '',
          description: detail.description ?? '',
          envelopeId: detail.linkedEnvelopes?.[0]?.envelopeId ?? null
        });
        this.existingAttachments = (detail.attachments ?? []).map(item => ({
          attachmentId: item.attachmentId,
          fileName: item.fileName
        }));

        this.loadFormDefinition(detail.categoryId, detail);
        this.executeConfigRequests('onCategoryChanged', { categoryId: Number(detail.categoryId ?? 0) });
      },
      error: () => {
        this.appNotification.error('حدث خطأ أثناء تحميل بيانات الموضوع/الطلب.');
      },
      complete: () => {
        this.loading = false;
      }
    });
  }

  private loadFormDefinition(categoryId: number, detail?: SubjectDetailDto): void {
    this.refreshTreeRuntimeMetadata(categoryId);

    if (!this.isEditMode && this.allowedCategoryIds.size > 0 && !this.allowedCategoryIds.has(categoryId)) {
      this.appNotification.error('غير مسموح بعرض هذا النوع.');
      this.formDefinition = null;
      this.resetDynamicFormState();
      return;
    }

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
                this.loadLegacyFormDefinition(categoryId, detail);
                return;
              }

              const fallbackDefinition = fallbackResponse?.data ?? null;
              if (!this.hasRenderableDefinition(fallbackDefinition)) {
                this.loadLegacyFormDefinition(categoryId, detail);
                return;
              }

              this.applyLoadedDefinition(fallbackDefinition, detail);
            },
            error: () => {
              this.loadLegacyFormDefinition(categoryId, detail);
            }
          });
          return;
        }

        const definition = response?.data ?? null;
        if (!this.hasRenderableDefinition(definition)) {
          this.loadLegacyFormDefinition(categoryId, detail);
          return;
        }

        this.applyLoadedDefinition(definition, detail);
      },
      error: () => {
        this.loadLegacyFormDefinition(categoryId, detail);
      }
    });
  }

  private hasRenderableDefinition(definition: SubjectFormDefinitionDto | null | undefined): boolean {
    return Boolean(definition && Array.isArray(definition.fields) && definition.fields.length > 0);
  }

  private applyLoadedDefinition(definition: SubjectFormDefinitionDto | null, detail?: SubjectDetailDto): void {
    this.formDefinition = definition ?? null;
    this.rebuildDynamicControls(this.formDefinition, detail?.dynamicFields ?? []);
    this.applyPendingDynamicFieldValueBindings();
    this.populateStakeholders(detail);
    this.populateTasks(detail);
  }

  private loadLegacyFormDefinition(categoryId: number, detail?: SubjectDetailDto): void {
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

            if (this.tryApplyDetailBasedFallbackDefinition(categoryId, detail)) {
              return;
            }

            this.formDefinition = null;
            this.resetDynamicFormState();
            this.populateStakeholders(detail);
            this.populateTasks(detail);
            this.appNotification.warning('لا توجد حقول ديناميكية مهيأة لهذا النوع.');
            return;
          }

          this.applyLoadedDefinition(definition, detail);
        },
        error: () => {
          if (!hasRetried) {
            tryLoad(undefined, true);
            return;
          }

          if (this.tryApplyDetailBasedFallbackDefinition(categoryId, detail)) {
            return;
          }

          this.formDefinition = null;
          this.resetDynamicFormState();
          this.populateStakeholders(detail);
          this.populateTasks(detail);
          this.appNotification.error('تعذر تحميل إعدادات الحقول الديناميكية.');
        }
      });
    };

    tryLoad(this.dynamicSubjectAccess.getApplicationId());
  }

  private tryApplyDetailBasedFallbackDefinition(categoryId: number, detail?: SubjectDetailDto): boolean {
    if (!this.isEditMode) {
      return false;
    }

    const fallbackDefinition = this.buildDefinitionFromSavedValues(categoryId, detail);
    if (!this.hasRenderableDefinition(fallbackDefinition)) {
      return false;
    }

    this.applyLoadedDefinition(fallbackDefinition, detail);
    this.appNotification.info('تم تحميل الحقول المحفوظة للطلب في وضع التعديل.');
    return true;
  }

  private buildDefinitionFromSavedValues(categoryId: number, detail?: SubjectDetailDto): SubjectFormDefinitionDto | null {
    const savedFields = (detail?.dynamicFields ?? [])
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
      groupName: 'الحقول المحفوظة',
      groupDescription: 'تم توليد هذا العرض من القيم المحفوظة للطلب.',
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
      isDisabledInit: false,
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
      categoryName: this.categoryOptions.find(option => Number(option.id) === categoryId)?.name ?? '',
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

    const categoryOption = this.categoryOptions.find(option => Number(option.id) === categoryId);
    return {
      categoryId,
      categoryName: categoryOption?.name ?? '',
      parentCategoryId: 0,
      applicationId: this.dynamicSubjectAccess.getApplicationId(),
      groups: Array.from(groupsMap.values()).sort((left, right) => left.groupId - right.groupId),
      fields
    };
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

  private rebuildDynamicControls(definition: SubjectFormDefinitionDto | null, values: SubjectFieldValueDto[]): void {
    this.resetDynamicFormState();

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
      const formArrayName = `dynamic_subject_group_${groupId}`;
      const formArray = this.fb.array([]);
      const mappedGroupFields: CdCategoryMandDto[] = [];

      groupFields.forEach(field => {
        const controlIndex = nextControlIndex++;
        const controlName = `${field.fieldKey}|${controlIndex}`;
        const cdmendType = this.mapFieldTypeToGenericType(field.fieldType, field.fieldKey);
        const cdmendDatatype = this.mapFieldDataType(field, cdmendType);
        const usesSelectionTable = cdmendType === 'Dropdown' || cdmendType === 'DropdownTree' || cdmendType === 'RadioButton';
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

        if (field.isDisabledInit) {
          control?.disable({ emitEvent: false });
        }

        this.controlMap.set(controlName, { fieldKey: field.fieldKey, instanceGroupId: 1 });
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

  private applyPendingDynamicFieldValueBindings(): void {
    const pendingMap = (this as any).__configDynamicValueBindings as Record<string, any> | undefined;
    if (!pendingMap || typeof pendingMap !== 'object') {
      return;
    }

    Object.keys(pendingMap).forEach(fieldKey => {
      const value = pendingMap[fieldKey];
      this.controlMap.forEach((meta, controlName) => {
        if (String(meta?.fieldKey ?? '').trim().toLowerCase() !== String(fieldKey).trim().toLowerCase()) {
          return;
        }

        const control = this.genericFormService.GetControl(this.dynamicControls, controlName);
        if (control) {
          control.patchValue(value, { emitEvent: false });
        }
      });
    });
  }

  private populateStakeholders(detail?: SubjectDetailDto): void {
    this.stakeholdersArray.clear();
    (detail?.stakeholders ?? []).forEach(item => {
      this.stakeholdersArray.push(this.fb.group({
        stockholderId: [item.stockholderId, Validators.required],
        partyType: [item.partyType || 'Viewer'],
        requiredResponse: [Boolean(item.requiredResponse)],
        status: [item.status ?? null],
        dueDate: [item.dueDate ?? null],
        notes: [item.notes ?? '']
      }));
    });

    if (this.stakeholdersArray.length === 0) {
      this.addStakeholder();
    }
  }

  private populateTasks(detail?: SubjectDetailDto): void {
    this.tasksArray.clear();
    (detail?.tasks ?? []).forEach(item => {
      this.tasksArray.push(this.fb.group({
        actionTitle: [item.actionTitle, Validators.required],
        actionDescription: [item.actionDescription ?? ''],
        assignedToUserId: [item.assignedToUserId ?? ''],
        assignedUnitId: [item.assignedUnitId ?? ''],
        dueDateUtc: [item.dueDateUtc ?? null],
        status: [item.status ?? 0]
      }));
    });

    if (this.tasksArray.length === 0) {
      this.addTask();
    }
  }

  private buildDynamicFieldValues(): SubjectFieldValueDto[] {
    return Array.from(this.controlMap.entries()).map(([controlName, key]) => ({
      fieldKey: key.fieldKey,
      value: this.normalizeOutgoingDynamicValue(this.genericFormService.GetControl(this.dynamicControls, controlName)?.value),
      instanceGroupId: key.instanceGroupId
    }));
  }

  private loadEnvelopeOptions(): void {
    this.dynamicSubjectsController.listEnvelopes({ pageNumber: 1, pageSize: 200 }).subscribe({
      next: response => {
        if (response?.errors?.length) {
          this.availableEnvelopes = [];
          return;
        }

        this.availableEnvelopes = response?.data?.items ?? [];
      },
      error: () => {
        this.availableEnvelopes = [];
      }
    });
  }

  private loadCategoryOptions(): void {
    this.dynamicSubjectsController.getCategoryTree(this.dynamicSubjectAccess.getApplicationId()).subscribe({
      next: response => {
        if (response?.errors?.length) {
          this.categoryOptions = [];
          this.appNotification.showApiErrors(response.errors, 'تعذر تحميل أنواع الموضوعات والطلبات.');
          return;
        }

        const scopedTree = this.dynamicSubjectAccess.filterByTopParent(response?.data ?? []);
        this.allowedCategoryIds = this.dynamicSubjectAccess.collectCategoryIds(scopedTree);
        this.categoryOptions = this.flattenCategoryTree(scopedTree);
      },
      error: () => {
        this.categoryOptions = [];
        this.appNotification.error('حدث خطأ أثناء تحميل أنواع الموضوعات والطلبات.');
      }
    });
  }

  private flattenCategoryTree(tree: SubjectCategoryTreeNodeDto[], prefix = ''): Array<{ id: number; name: string }> {
    const result: Array<{ id: number; name: string }> = [];
    (tree ?? []).forEach(node => {
      const name = prefix ? `${prefix} / ${node.categoryName}` : node.categoryName;
      if (node.canCreate) {
        result.push({ id: node.categoryId, name });
      }

      result.push(...this.flattenCategoryTree(node.children ?? [], name));
    });

    return result;
  }

  shouldShowEditorError(controlName: string): boolean {
    const control = this.editorForm.get(controlName);
    if (!control) {
      return false;
    }

    return control.invalid && (control.touched || this.submitAttempted);
  }

  getEditorErrorMessage(controlName: string): string {
    const control = this.editorForm.get(controlName);
    if (!control || !control.errors) {
      return '';
    }

    if (control.errors['required']) {
      return 'هذا الحقل مطلوب.';
    }

    return 'القيمة المدخلة غير صحيحة.';
  }

  private resetDynamicFormState(): void {
    this.dynamicControls = this.fb.group({});
    this.renderGroups = [];
    this.controlMap.clear();
    this.genericFormService.resetDynamicRuntimeState();
    this.genericFormService.cdmendDto = [];
    this.genericFormService.cdCategoryMandDto = [];
  }

  private mapFieldTypeToGenericType(fieldType?: string, fieldKey?: string): string {
    const normalized = String(fieldType ?? '').trim().toLowerCase();

    if (this.isTreeCapableField(fieldKey, normalized)) {
      return 'DropdownTree';
    }
    if (normalized.includes('label')) {
      return 'LABLE';
    }
    if (normalized.includes('textarea')) {
      return 'Textarea';
    }
    if (normalized.includes('radio')) {
      return 'RadioButton';
    }
    if (normalized.includes('tree')) {
      return 'DropdownTree';
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

    if (cdmendType === 'Dropdown' || cdmendType === 'DropdownTree' || cdmendType === 'RadioButton') {
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

  private isTreeCapableField(fieldKey: string | undefined, normalizedFieldType: string): boolean {
    if (String(normalizedFieldType ?? '').includes('tree')) {
      return true;
    }

    const normalizedKey = this.normalizeDynamicFieldKey(fieldKey);
    if (!normalizedKey) {
      return false;
    }

    return this.treeCapableFieldKeys.has(normalizedKey);
  }

  private refreshTreeRuntimeMetadata(categoryId: number): void {
    const normalizedCategoryId = Number(categoryId ?? 0);
    if (!this.config || normalizedCategoryId <= 0 || this.allConfigs.length === 0) {
      this.treeCapableFieldKeys.clear();
      return;
    }

    const matchedConfigs = this.previewFoundation.filterConfigs(this.allConfigs, {
      routeKeyPrefix: 'DynamicSubjects',
      applicationId: this.dynamicSubjectAccess.getApplicationId(),
      categoryId: normalizedCategoryId
    });
    const treeBindings = this.previewFoundation.resolveTreeBindingsFromConfigs(matchedConfigs, normalizedCategoryId);
    this.treeCapableFieldKeys = new Set<string>(
      Array.from(treeBindings.keys()).map(fieldKey => this.normalizeDynamicFieldKey(fieldKey)).filter(Boolean)
    );
  }

  private buildRuntimeConfigWithSupplementalTreeRequests(categoryId: number): ComponentConfig | null {
    if (!this.config) {
      return null;
    }

    const normalizedCategoryId = Number(categoryId ?? 0);
    if (normalizedCategoryId <= 0 || this.allConfigs.length === 0) {
      return this.config;
    }

    const matchedConfigs = this.previewFoundation.filterConfigs(this.allConfigs, {
      routeKeyPrefix: 'DynamicSubjects',
      applicationId: this.dynamicSubjectAccess.getApplicationId(),
      categoryId: normalizedCategoryId
    });
    const treeRequests = this.previewFoundation.extractTreePopulateRequests(matchedConfigs, normalizedCategoryId);
    const baseRequests = Array.isArray(this.config.requestsarray) ? this.config.requestsarray : [];
    const mergedRequests = this.mergeRequestArrays(baseRequests, treeRequests);
    if (mergedRequests.length === baseRequests.length) {
      return this.config;
    }

    return new ComponentConfig({
      ...this.config,
      requestsarray: mergedRequests
    });
  }

  private mergeRequestArrays(primary: RequestArrayItem[], secondary: RequestArrayItem[]): RequestArrayItem[] {
    const merged: RequestArrayItem[] = [];
    const seen = new Set<string>();

    const pushUnique = (items: RequestArrayItem[]) => {
      (items ?? []).forEach(item => {
        const signature = this.buildRequestSignature(item);
        if (seen.has(signature)) {
          return;
        }

        seen.add(signature);
        merged.push({
          ...item,
          args: Array.isArray(item?.args) ? [...item.args] : [],
          requestsSelectionFields: Array.isArray(item?.requestsSelectionFields) ? [...item.requestsSelectionFields] : [],
          populateArgs: Array.isArray(item?.populateArgs) ? [...item.populateArgs] : []
        });
      });
    };

    pushUnique(primary ?? []);
    pushUnique(secondary ?? []);
    return merged;
  }

  private buildRequestSignature(request: RequestArrayItem | undefined): string {
    return [
      String(request?.method ?? '').trim().toLowerCase(),
      JSON.stringify(request?.args ?? []),
      String(request?.populateMethod ?? '').trim().toLowerCase(),
      JSON.stringify(request?.populateArgs ?? []),
      JSON.stringify(request?.conditions ?? {}),
      JSON.stringify(request?.requestsSelectionFields ?? []),
      JSON.stringify(request?.bindings ?? [])
    ].join('|');
  }

  private normalizeDynamicFieldKey(value: unknown): string {
    const raw = String(value ?? '').trim().toLowerCase();
    if (!raw) {
      return '';
    }

    return raw.split('|')[0].split('__')[0].trim();
  }

  private normalizeOutgoingDynamicValue(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? '' : value.toISOString();
    }

    return String(value);
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

  private buildStakeholdersPayload(): Array<{ stockholderId: number; partyType: string; requiredResponse: boolean; status?: number; dueDate?: string; notes?: string }> {
    return (this.stakeholdersArray.value ?? [])
      .map((item: any) => ({
        stockholderId: Number(item?.stockholderId ?? 0),
        partyType: String(item?.partyType ?? 'Viewer') || 'Viewer',
        requiredResponse: Boolean(item?.requiredResponse),
        status: item?.status ?? undefined,
        dueDate: item?.dueDate ?? undefined,
        notes: String(item?.notes ?? '').trim() || undefined
      }))
      .filter((item: any) => item.stockholderId > 0);
  }

  private buildTasksPayload(): Array<{ actionTitle: string; actionDescription?: string; assignedToUserId?: string; assignedUnitId?: string; dueDateUtc?: string; status: number }> {
    return (this.tasksArray.value ?? [])
      .map((item: any) => ({
        actionTitle: String(item?.actionTitle ?? '').trim(),
        actionDescription: String(item?.actionDescription ?? '').trim() || undefined,
        assignedToUserId: String(item?.assignedToUserId ?? '').trim() || undefined,
        assignedUnitId: String(item?.assignedUnitId ?? '').trim() || undefined,
        dueDateUtc: item?.dueDateUtc ?? undefined,
        status: Number(item?.status ?? 0)
      }))
      .filter((item: any) => item.actionTitle.length > 0);
  }

  private toArabicEventType(eventType?: string): string {
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
}
