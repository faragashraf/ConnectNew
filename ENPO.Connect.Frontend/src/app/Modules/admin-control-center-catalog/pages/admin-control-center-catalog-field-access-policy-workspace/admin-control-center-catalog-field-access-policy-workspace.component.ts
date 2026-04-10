import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import {
  FieldAccessNotesContext,
  FieldAccessPolicyNotesGenerator,
  LockNotesInput,
  RuleNotesInput
} from './field-access-policy-notes-generator.helper';
import { CommonResponse } from 'src/app/shared/services/BackendServices/DynamicSubjects/DynamicSubjects.dto';
import { DynamicSubjectsAdminAccessPolicyController } from 'src/app/shared/services/BackendServices/DynamicSubjectsAdminAccessPolicy/DynamicSubjectsAdminAccessPolicy.service';
import {
  FieldAccessActionLookupDto,
  FieldAccessLockDto,
  FieldAccessPolicyRuleDto,
  FieldAccessPolicyWorkspaceDto,
  FieldAccessPolicyWorkspaceUpsertRequestDto,
  FieldAccessPreviewAppliedPolicyDto,
  FieldAccessPreviewRequestDto,
  FieldAccessPreviewResponseDto,
  FieldAccessPreviewResolutionItemDto,
  FieldAccessSubjectType,
  FieldAccessTargetLevel
} from 'src/app/shared/services/BackendServices/DynamicSubjectsAdminAccessPolicy/DynamicSubjectsAdminAccessPolicy.dto';

type MessageSeverity = 'success' | 'warn' | 'error';
type AccessTabKey = 'overview' | 'defaultPolicy' | 'rules' | 'locks' | 'preview';

type SelectOption<T = string | number | null> = {
  label: string;
  value: T;
};

@Component({
  selector: 'app-admin-control-center-catalog-field-access-policy-workspace',
  templateUrl: './admin-control-center-catalog-field-access-policy-workspace.component.html',
  styleUrls: ['./admin-control-center-catalog-field-access-policy-workspace.component.scss']
})
export class AdminControlCenterCatalogFieldAccessPolicyWorkspaceComponent implements OnChanges, OnDestroy {
  @Input() requestTypeId: number | null = null;
  @Input() requestTypeLabel = '';
  @Output() completionPercentChange = new EventEmitter<number>();

  readonly tabMenu: Array<{ key: AccessTabKey; label: string; mandatory: boolean }> = [
    { key: 'overview', label: 'نظرة عامة', mandatory: true },
    { key: 'defaultPolicy', label: 'السياسة الافتراضية', mandatory: true },
    { key: 'rules', label: 'قواعد المرحلة/الإجراء', mandatory: true },
    { key: 'locks', label: 'الأقفال', mandatory: true },
    { key: 'preview', label: 'المعاينة', mandatory: true }
  ];

  readonly targetLevelOptions: SelectOption<FieldAccessTargetLevel>[] = [
    { label: 'مجموعة', value: 'Group' },
    { label: 'حقل', value: 'Field' }
  ];

  readonly permissionTypeOptions: SelectOption<string>[] = [
    { label: 'قابل للتعديل', value: 'Editable' },
    { label: 'قراءة فقط', value: 'ReadOnly' },
    { label: 'مخفي', value: 'Hidden' },
    { label: 'إدخال إلزامي', value: 'RequiredInput' }
  ];

  readonly subjectTypeOptions: SelectOption<FieldAccessSubjectType>[] = [
    { label: 'وحدة تنظيمية', value: 'OrgUnit' },
    { label: 'منصب', value: 'Position' },
    { label: 'مستخدم', value: 'User' },
    { label: 'منشئ الطلب', value: 'RequestOwner' },
    { label: 'الحاضن الحالي', value: 'CurrentCustodian' }
  ];

  readonly effectOptions: SelectOption<string>[] = [
    { label: 'سماح', value: 'Allow' },
    { label: 'منع', value: 'Deny' }
  ];

  readonly lockModeOptions: SelectOption<string>[] = [
    { label: 'منع تعديل', value: 'NoEdit' },
    { label: 'منع إدخال', value: 'NoInput' },
    { label: 'قفل كامل', value: 'FullLock' }
  ];

  readonly policyForm: FormGroup = this.fb.group({
    policyName: ['', [Validators.required, Validators.maxLength(200)]],
    isPolicyActive: [true],
    defaultAccessMode: ['Editable', [Validators.required]]
  });

  readonly ruleForm: FormGroup = this.fb.group({
    targetLevel: ['Field', [Validators.required]],
    targetId: [null, [Validators.required, Validators.min(1)]],
    stageId: [null],
    actionId: [null],
    permissionType: ['Editable', [Validators.required]],
    subjectType: ['OrgUnit', [Validators.required]],
    subjectId: [''],
    effect: ['Allow', [Validators.required]],
    priority: [100, [Validators.required, Validators.min(0), Validators.max(100000)]],
    isActive: [true],
    notes: ['']
  });

  readonly lockForm: FormGroup = this.fb.group({
    targetLevel: ['Field', [Validators.required]],
    targetId: [null, [Validators.required, Validators.min(1)]],
    stageId: [null],
    actionId: [null],
    lockMode: ['NoEdit', [Validators.required]],
    allowedOverrideSubjectType: [null],
    allowedOverrideSubjectId: [''],
    isActive: [true],
    notes: ['']
  });

  readonly previewForm: FormGroup = this.fb.group({
    stageId: [null],
    actionId: [null],
    requestId: [null],
    subjectType: [null],
    subjectId: [''],
    requestOwnerUserId: [''],
    currentCustodianUnitId: ['']
  });

  activeTab: AccessTabKey = 'overview';
  workspace: FieldAccessPolicyWorkspaceDto | null = null;
  preview: FieldAccessPreviewResponseDto | null = null;

  rules: FieldAccessPolicyRuleDto[] = [];
  locks: FieldAccessLockDto[] = [];

  loadingWorkspace = false;
  savingWorkspace = false;
  savingLockUpdate = false;
  loadingPreview = false;

  hasUnsavedChanges = false;
  editingRuleIndex: number | null = null;
  editingLockIndex: number | null = null;

  message = '';
  messageSeverity: MessageSeverity = 'success';
  ruleNotesManuallyEdited = false;
  lockNotesManuallyEdited = false;
  ruleSuggestedNotes = '';
  lockSuggestedNotes = '';

  private readonly subscriptions: Subscription[] = [];
  private readonly notesGenerator = new FieldAccessPolicyNotesGenerator();
  private persistedSnapshot = '';
  private suppressDirtyTracking = false;
  private previousLockTargetLevel = 'Field';
  private previousLockOverrideSubjectType: string | undefined;
  private applyingRuleSuggestedNotes = false;
  private applyingLockSuggestedNotes = false;

  constructor(
    private readonly fb: FormBuilder,
    private readonly accessPolicyController: DynamicSubjectsAdminAccessPolicyController
  ) {
    this.subscriptions.push(
      this.policyForm.valueChanges.subscribe(() => this.evaluateDirtyState()),
      this.ruleForm.get('subjectType')!.valueChanges.subscribe(() => this.applyRuleSubjectValidators()),
      this.previewForm.get('subjectType')!.valueChanges.subscribe(() => this.applyPreviewSubjectValidators()),
      this.lockForm.get('allowedOverrideSubjectType')!.valueChanges.subscribe(value => this.onLockOverrideSubjectTypeChange(value)),
      this.ruleForm.get('stageId')!.valueChanges.subscribe(() => this.syncRuleActionToStage()),
      this.lockForm.get('stageId')!.valueChanges.subscribe(() => this.syncLockActionToStage()),
      this.previewForm.get('stageId')!.valueChanges.subscribe(() => this.syncPreviewActionToStage()),
      this.ruleForm.get('targetLevel')!.valueChanges.subscribe(() => this.syncRuleTargetToLevel()),
      this.lockForm.get('targetLevel')!.valueChanges.subscribe(value => this.onLockTargetLevelChange(value)),
      this.ruleForm.valueChanges.subscribe(() => this.refreshRuleSuggestedNotes()),
      this.lockForm.valueChanges.subscribe(() => this.refreshLockSuggestedNotes()),
      this.ruleForm.get('notes')!.valueChanges.subscribe(value => this.onRuleNotesControlChanged(value)),
      this.lockForm.get('notes')!.valueChanges.subscribe(value => this.onLockNotesControlChanged(value))
    );

    this.applyRuleSubjectValidators();
    this.applyPreviewSubjectValidators();
    this.applyLockOverrideSubjectValidators();
    this.previousLockTargetLevel = String(this.lockForm.get('targetLevel')?.value ?? 'Field');
    this.previousLockOverrideSubjectType = this.normalizeString(this.lockForm.get('allowedOverrideSubjectType')?.value);
    this.syncRuleSuggestedNotesAfterFormPatch();
    this.syncLockSuggestedNotesAfterFormPatch();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['requestTypeId']) {
      this.preview = null;
      this.rules = [];
      this.locks = [];
      this.workspace = null;
      this.message = '';
      this.activeTab = 'overview';
      this.hasUnsavedChanges = false;
      this.editingRuleIndex = null;
      this.editingLockIndex = null;
      this.persistedSnapshot = '';
      this.emitCompletion();

      if (this.requestTypeId && this.requestTypeId > 0) {
        this.loadWorkspace();
      }
    }
  }

  get requestContextLabel(): string {
    if (this.requestTypeLabel.trim().length > 0) {
      return this.requestTypeLabel;
    }

    return this.requestTypeId ? `نوع الطلب #${this.requestTypeId}` : 'لم يتم اختيار نوع طلب';
  }

  get canManageWorkspace(): boolean {
    return !!this.requestTypeId && this.requestTypeId > 0;
  }

  get defaultPolicyReady(): boolean {
    return this.policyForm.valid;
  }

  get mandatoryCompletionPercent(): number {
    const checkpoints = [
      this.defaultPolicyReady,
      this.rules.length > 0,
      this.locks.length > 0,
      this.preview != null
    ];

    const passed = checkpoints.filter(Boolean).length;
    return Math.round((passed / checkpoints.length) * 100);
  }

  get optionalCompletionPercent(): number {
    const checkpoints = [
      this.rules.some(item => item.stageId != null && item.actionId != null),
      this.locks.some(item => item.allowedOverrideSubjectType != null),
      (this.preview?.lockedFieldsCount ?? 0) > 0 || (this.preview?.hiddenFieldsCount ?? 0) > 0
    ];

    const passed = checkpoints.filter(Boolean).length;
    return Math.round((passed / checkpoints.length) * 100);
  }

  get overallCompletionPercent(): number {
    return Math.round((this.mandatoryCompletionPercent + this.optionalCompletionPercent) / 2);
  }

  get ruleTargetOptions(): SelectOption<number>[] {
    const targetLevel = String(this.ruleForm.get('targetLevel')?.value ?? 'Field');
    const source = targetLevel === 'Group' ? this.workspace?.groups ?? [] : this.workspace?.fields ?? [];

    return source
      .map(item => ({ label: `${item.label} (#${item.id})`, value: item.id }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  get lockTargetOptions(): SelectOption<number>[] {
    const targetLevel = String(this.lockForm.get('targetLevel')?.value ?? 'Field');
    const source = targetLevel === 'Group' ? this.workspace?.groups ?? [] : this.workspace?.fields ?? [];

    return source
      .map(item => ({ label: `${item.label} (#${item.id})`, value: item.id }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  get stageOptions(): SelectOption<number>[] {
    return (this.workspace?.stages ?? [])
      .map(item => ({ label: `${item.label} (#${item.id})`, value: item.id }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  get previewStageOptions(): SelectOption<number>[] {
    return this.stageOptions;
  }

  get ruleActionOptions(): SelectOption<number>[] {
    const stageId = this.normalizeNumber(this.ruleForm.get('stageId')?.value);
    return this.buildActionOptions(stageId);
  }

  get lockActionOptions(): SelectOption<number>[] {
    const stageId = this.normalizeNumber(this.lockForm.get('stageId')?.value);
    return this.buildActionOptions(stageId);
  }

  get previewActionOptions(): SelectOption<number>[] {
    const stageId = this.normalizeNumber(this.previewForm.get('stageId')?.value);
    return this.buildActionOptions(stageId);
  }

  get isRuleEditMode(): boolean {
    return this.editingRuleIndex != null;
  }

  get isLockEditMode(): boolean {
    return this.editingLockIndex != null;
  }

  get ruleEditorTitle(): string {
    if (this.isRuleEditMode && this.editingRuleIndex != null) {
      return `تعديل القاعدة #${this.editingRuleIndex + 1}`;
    }

    return 'إضافة قاعدة جديدة';
  }

  get lockEditorTitle(): string {
    if (this.isLockEditMode && this.editingLockIndex != null) {
      return `تعديل القفل #${this.editingLockIndex + 1}`;
    }

    return 'إضافة قفل جديد';
  }

  get ruleSubjectIdRequired(): boolean {
    return this.requiresSubjectId(this.ruleForm.get('subjectType')?.value);
  }

  get previewSubjectIdRequired(): boolean {
    return this.requiresSubjectId(this.previewForm.get('subjectType')?.value);
  }

  get lockOverrideSubjectIdRequired(): boolean {
    return this.requiresSubjectId(this.lockForm.get('allowedOverrideSubjectType')?.value);
  }

  get isRuleActionDisabled(): boolean {
    return !this.normalizeNumber(this.ruleForm.get('stageId')?.value);
  }

  get isLockActionDisabled(): boolean {
    return !this.normalizeNumber(this.lockForm.get('stageId')?.value);
  }

  get isPreviewActionDisabled(): boolean {
    return !this.normalizeNumber(this.previewForm.get('stageId')?.value);
  }

  get ruleValidationMessages(): string[] {
    return this.collectRuleValidationMessages();
  }

  get lockValidationMessages(): string[] {
    return this.collectLockValidationMessages();
  }

  get previewValidationMessages(): string[] {
    return this.collectPreviewValidationMessages();
  }

  get canSubmitRule(): boolean {
    return this.ruleValidationMessages.length === 0;
  }

  get canSubmitLock(): boolean {
    return this.lockValidationMessages.length === 0 && !this.savingLockUpdate && !this.savingWorkspace;
  }

  get canAddLock(): boolean {
    return this.canSubmitLock;
  }

  get canRunPreview(): boolean {
    return this.canManageWorkspace && this.previewValidationMessages.length === 0 && !this.loadingPreview;
  }

  get workspaceValidationMessages(): string[] {
    return this.collectWorkspaceValidationMessages();
  }

  get canSaveWorkspace(): boolean {
    return this.canManageWorkspace
      && this.hasUnsavedChanges
      && this.workspaceValidationMessages.length === 0
      && !this.savingWorkspace
      && !this.savingLockUpdate;
  }

  get saveDisabledReason(): string {
    if (this.savingWorkspace) {
      return 'جاري الحفظ الآن...';
    }

    if (this.savingLockUpdate) {
      return 'جاري تحديث القفل الآن...';
    }

    if (!this.canManageWorkspace) {
      return 'اختر نوع الطلب أولًا.';
    }

    if (!this.hasUnsavedChanges) {
      return 'لا توجد تغييرات محلية غير محفوظة.';
    }

    return this.workspaceValidationMessages[0] ?? '';
  }

  get lastModifiedLabel(): string {
    const value = this.workspace?.policy?.lastModifiedDateUtc;
    if (!value) {
      return 'غير متاح';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return `${date.toLocaleDateString('ar-EG')} ${date.toLocaleTimeString('ar-EG')}`;
  }

  onSwitchTab(tab: AccessTabKey): void {
    if (tab !== 'overview' && !this.defaultPolicyReady) {
      this.showMessage('warn', 'لا يمكن الانتقال للخطوات التالية قبل اكتمال السياسة الافتراضية.');
      this.activeTab = 'defaultPolicy';
      return;
    }

    this.activeTab = tab;
  }

  onRulePrimaryAction(): void {
    this.ruleForm.markAllAsTouched();
    if (!this.canSubmitRule) {
      this.showMessage('warn', this.ruleValidationMessages[0] ?? 'يرجى استكمال بيانات القاعدة.');
      return;
    }

    if (this.isRuleEditMode) {
      this.onUpdateRule();
      return;
    }

    const newRule = this.buildRuleFromForm();
    this.rules = [...this.rules, newRule];
    this.resetRuleEditor();
    this.evaluateDirtyState();
    this.emitCompletion();
    this.showMessage('success', 'تمت إضافة القاعدة محليًا. احفظ مساحة العمل لتطبيقها نهائيًا.');
  }

  onStartEditRule(index: number): void {
    if (index < 0 || index >= this.rules.length) {
      return;
    }

    const item = this.rules[index];
    this.editingRuleIndex = index;
    this.ruleForm.patchValue(
      {
        targetLevel: item.targetLevel,
        targetId: item.targetId,
        stageId: item.stageId ?? null,
        actionId: item.actionId ?? null,
        permissionType: item.permissionType,
        subjectType: item.subjectType,
        subjectId: item.subjectId ?? '',
        effect: item.effect,
        priority: item.priority,
        isActive: item.isActive,
        notes: item.notes ?? ''
      },
      { emitEvent: false }
    );

    this.applyRuleSubjectValidators();
    this.syncRuleActionToStage();
    this.syncRuleSuggestedNotesAfterFormPatch();
    this.showMessage('warn', 'أنت الآن في وضع تعديل قاعدة.');
  }

  onCancelRuleEdit(): void {
    if (!this.isRuleEditMode) {
      return;
    }

    this.resetRuleEditor();
    this.showMessage('warn', 'تم إلغاء التعديل والعودة إلى وضع الإضافة.');
  }

  onRegenerateRuleNotes(): void {
    this.ruleNotesManuallyEdited = false;
    this.refreshRuleSuggestedNotes();
    this.showMessage('success', 'تمت إعادة توليد وصف القاعدة حسب الاختيارات الحالية.');
  }

  onRemoveRule(index: number): void {
    if (index < 0 || index >= this.rules.length) {
      return;
    }

    this.rules = this.rules.filter((_, idx) => idx !== index);

    if (this.editingRuleIndex != null) {
      if (this.editingRuleIndex === index) {
        this.resetRuleEditor();
      } else if (this.editingRuleIndex > index) {
        this.editingRuleIndex = this.editingRuleIndex - 1;
      }
    }

    this.evaluateDirtyState();
    this.emitCompletion();
    this.showMessage('success', 'تم حذف القاعدة محليًا.');
  }

  onLockPrimaryAction(): void {
    this.lockForm.markAllAsTouched();
    if (!this.canSubmitLock) {
      this.showMessage('warn', this.lockValidationMessages[0] ?? 'يرجى استكمال بيانات القفل.');
      return;
    }

    if (this.isLockEditMode) {
      this.onUpdateLock();
      return;
    }

    this.onAddLock();
  }

  onStartEditLock(index: number): void {
    if (index < 0 || index >= this.locks.length) {
      return;
    }

    const item = this.locks[index];
    this.editingLockIndex = index;
    this.lockForm.patchValue(
      {
        targetLevel: item.targetLevel,
        targetId: item.targetId,
        stageId: item.stageId ?? null,
        actionId: item.actionId ?? null,
        lockMode: item.lockMode,
        allowedOverrideSubjectType: item.allowedOverrideSubjectType ?? null,
        allowedOverrideSubjectId: item.allowedOverrideSubjectId ?? '',
        isActive: item.isActive,
        notes: item.notes ?? ''
      },
      { emitEvent: false }
    );

    this.previousLockTargetLevel = String(item.targetLevel ?? 'Field');
    this.previousLockOverrideSubjectType = this.normalizeString(item.allowedOverrideSubjectType);
    this.applyLockOverrideSubjectValidators();
    this.syncLockActionToStage();
    this.syncLockSuggestedNotesAfterFormPatch();
    this.showMessage('warn', 'أنت الآن في وضع تعديل القفل.');
  }

  onCancelLockEdit(): void {
    if (!this.isLockEditMode) {
      return;
    }

    this.resetLockEditor();
    this.showMessage('warn', 'تم إلغاء التعديل والعودة إلى وضع الإضافة.');
  }

  onRegenerateLockNotes(): void {
    this.lockNotesManuallyEdited = false;
    this.refreshLockSuggestedNotes();
    this.showMessage('success', 'تمت إعادة توليد وصف القفل حسب الاختيارات الحالية.');
  }

  onAddLock(): void {
    if (!this.canSubmitLock) {
      this.showMessage('warn', this.lockValidationMessages[0] ?? 'يرجى استكمال بيانات القفل.');
      return;
    }

    const item = this.buildLockFromForm();
    this.locks = [...this.locks, item];
    this.resetLockEditor();
    this.evaluateDirtyState();
    this.emitCompletion();
    this.showMessage('success', 'تمت إضافة القفل محليًا. احفظ مساحة العمل لتطبيقه نهائيًا.');
  }

  onRemoveLock(index: number): void {
    if (index < 0 || index >= this.locks.length) {
      return;
    }

    this.locks = this.locks.filter((_, idx) => idx !== index);

    if (this.editingLockIndex != null) {
      if (this.editingLockIndex === index) {
        this.resetLockEditor();
      } else if (this.editingLockIndex > index) {
        this.editingLockIndex = this.editingLockIndex - 1;
      }
    }

    this.evaluateDirtyState();
    this.emitCompletion();
    this.showMessage('success', 'تم حذف القفل محليًا.');
  }

  onSaveWorkspace(): void {
    if (!this.canSaveWorkspace || !this.requestTypeId) {
      this.showMessage('warn', this.saveDisabledReason || 'تعذر الحفظ.');
      return;
    }

    const payload = this.buildWorkspaceUpsertPayload();

    this.savingWorkspace = true;
    this.accessPolicyController.upsertWorkspace(this.requestTypeId, payload).subscribe({
      next: response => {
        if (!this.ensureSuccess(response, 'تعذر حفظ سياسة الوصول.')) {
          return;
        }

        this.workspace = response.data ?? null;
        this.rules = [...(this.workspace?.rules ?? [])];
        this.locks = [...(this.workspace?.locks ?? [])];
        this.patchFormsFromWorkspace();
        this.preview = null;
        this.showMessage('success', 'تم حفظ سياسة الوصول بنجاح.');
        this.emitCompletion();
      },
      error: () => this.showMessage('error', 'حدث خطأ أثناء حفظ سياسة الوصول.'),
      complete: () => {
        this.savingWorkspace = false;
      }
    });
  }

  onRunPreview(): void {
    if (!this.canManageWorkspace || !this.requestTypeId) {
      this.showMessage('warn', 'اختر نوع طلب أولًا قبل المعاينة.');
      return;
    }

    this.previewForm.markAllAsTouched();
    if (!this.canRunPreview) {
      this.showMessage('warn', this.previewValidationMessages[0] ?? 'يرجى استكمال بيانات المعاينة.');
      return;
    }

    const request: FieldAccessPreviewRequestDto = {
      stageId: this.normalizeNumber(this.previewForm.get('stageId')?.value),
      actionId: this.normalizeNumber(this.previewForm.get('actionId')?.value),
      requestId: this.normalizeNumber(this.previewForm.get('requestId')?.value),
      subjectType: this.normalizeString(this.previewForm.get('subjectType')?.value),
      subjectId: this.normalizeString(this.previewForm.get('subjectId')?.value),
      requestOwnerUserId: this.normalizeString(this.previewForm.get('requestOwnerUserId')?.value),
      currentCustodianUnitId: this.normalizeString(this.previewForm.get('currentCustodianUnitId')?.value)
    };

    if (this.hasUnsavedChanges) {
      this.showMessage('warn', 'المعاينة تعتمد على آخر نسخة محفوظة فقط. احفظ مساحة العمل أولًا لرؤية آخر التعديلات.');
    }

    this.loadingPreview = true;
    this.accessPolicyController.preview(this.requestTypeId, request).subscribe({
      next: response => {
        if (!this.ensureSuccess(response, 'تعذر تشغيل المعاينة.')) {
          return;
        }

        this.preview = response.data ?? null;
        if (this.preview) {
          this.showMessage('success', 'تم تحديث المعاينة بنجاح حسب السياق المحدد.');
        }
        this.emitCompletion();
      },
      error: () => this.showMessage('error', 'حدث خطأ أثناء تشغيل المعاينة.'),
      complete: () => {
        this.loadingPreview = false;
      }
    });
  }

  onApplyOverviewDemoPack(): void {
    const defaultApplied = this.onApplyDefaultPolicyDemo(true);
    const addedRules = this.seedRuleExamples(true);
    const addedLocks = this.seedLockExamples(true);
    this.onApplyPreviewScenario('RequestOwner', true);

    const summary = `تم تطبيق حزمة الأمثلة: السياسة الافتراضية=${defaultApplied ? 'نعم' : 'لا'}، قواعد مضافة=${addedRules}، أقفال مضافة=${addedLocks}.`;
    this.showMessage('success', summary);
  }

  onApplyDefaultPolicyDemo(silent = false): boolean {
    this.policyForm.patchValue(
      {
        policyName: 'سياسة الوصول - التظلمات',
        isPolicyActive: true,
        defaultAccessMode: 'Editable'
      },
      { emitEvent: true }
    );

    this.evaluateDirtyState();
    if (!silent) {
      this.showMessage('success', 'تمت تعبئة مثال عملي في تبويب السياسة الافتراضية.');
    }

    return true;
  }

  onSeedRuleExamples(): void {
    const added = this.seedRuleExamples(false);
    if (added === 0) {
      this.showMessage('warn', 'لم يتم إضافة قواعد جديدة من الأمثلة (قد تكون موجودة مسبقًا أو لا توجد أهداف كافية).');
      return;
    }

    this.showMessage('success', `تمت إضافة ${added} قواعد تجريبية محليًا.`);
  }

  onSeedLockExamples(): void {
    const added = this.seedLockExamples(false);
    if (added === 0) {
      this.showMessage('warn', 'لم يتم إضافة أقفال جديدة من الأمثلة (قد تكون موجودة مسبقًا أو لا توجد أهداف كافية).');
      return;
    }

    this.showMessage('success', `تمت إضافة ${added} أقفال تجريبية محليًا.`);
  }

  onApplyPreviewScenario(subjectType: FieldAccessSubjectType, silent = false): void {
    const stageId = this.workspace?.stages?.[0]?.id ?? null;
    const actionId = stageId
      ? this.workspace?.actions?.find(item => item.stageId === stageId)?.id ?? null
      : null;

    const sampleOrgUnitId = '120';
    const samplePositionId = '2001';
    const sampleUserId = 'USR-100';

    this.previewForm.patchValue({
      stageId,
      actionId,
      subjectType,
      subjectId: subjectType === 'OrgUnit'
        ? sampleOrgUnitId
        : subjectType === 'Position'
          ? samplePositionId
          : subjectType === 'User'
            ? sampleUserId
            : '',
      requestOwnerUserId: subjectType === 'RequestOwner' ? 'USR-OWNER-01' : '',
      currentCustodianUnitId: subjectType === 'CurrentCustodian' ? sampleOrgUnitId : ''
    });

    this.applyPreviewSubjectValidators();
    this.syncPreviewActionToStage();

    if (!silent) {
      this.showMessage('success', `تم تحميل سيناريو معاينة (${this.resolveSubjectTypeLabel(subjectType)}).`);
    }
  }

  onRefreshWorkspace(): void {
    this.loadWorkspace();
  }

  statusLabel(value: boolean | null | undefined, trueLabel: string, falseLabel: string): string {
    return value ? trueLabel : falseLabel;
  }

  statusClass(value: boolean | null | undefined): string {
    return value ? 'ok' : 'no';
  }

  formatPreviewTrace(trace: FieldAccessPreviewAppliedPolicyDto): string {
    const stagePart = trace.stageId ? ` - مرحلة #${trace.stageId}` : '';
    const actionPart = trace.actionId ? ` - إجراء #${trace.actionId}` : '';
    return `${trace.sourceTypeAr}: ${trace.descriptionAr}${stagePart}${actionPart}`;
  }

  getPolicyControlError(controlName: string): string | null {
    const control = this.policyForm.get(controlName);
    if (!control || !control.invalid) {
      return null;
    }

    if (control.hasError('required')) {
      return 'هذا الحقل إلزامي.';
    }

    if (control.hasError('maxlength')) {
      return 'تجاوزت الحد الأقصى المسموح.';
    }

    return 'القيمة المدخلة غير صحيحة.';
  }

  getRuleControlError(controlName: string): string | null {
    const control = this.ruleForm.get(controlName);
    if (!control || !control.invalid) {
      return null;
    }

    if (control.hasError('required')) {
      if (controlName === 'subjectId' && this.ruleSubjectIdRequired) {
        return 'معرف الجهة إلزامي لنوع الجهة المحدد.';
      }

      return 'هذا الحقل إلزامي.';
    }

    if (control.hasError('min') || control.hasError('max')) {
      if (controlName === 'priority') {
        return 'الأولوية يجب أن تكون بين 0 و 100000.';
      }

      return 'القيمة المدخلة خارج النطاق.';
    }

    if (control.hasError('maxlength')) {
      return 'تجاوزت الحد الأقصى المسموح.';
    }

    return 'القيمة المدخلة غير صحيحة.';
  }

  getRuleActionError(): string | null {
    const stageId = this.normalizeNumber(this.ruleForm.get('stageId')?.value);
    const actionId = this.normalizeNumber(this.ruleForm.get('actionId')?.value);
    if (actionId && !stageId) {
      return 'لا يمكن اختيار إجراء بدون مرحلة.';
    }

    if (actionId && stageId && !this.isActionBelongsToStage(actionId, stageId)) {
      return 'الإجراء المختار لا يتبع المرحلة المحددة.';
    }

    return null;
  }

  getLockControlError(controlName: string): string | null {
    const control = this.lockForm.get(controlName);
    if (!control || !control.invalid) {
      return null;
    }

    if (control.hasError('required')) {
      if (controlName === 'allowedOverrideSubjectId' && this.lockOverrideSubjectIdRequired) {
        return 'معرف جهة الاستثناء إلزامي لنوع الجهة المحدد.';
      }

      return 'هذا الحقل إلزامي.';
    }

    if (control.hasError('min') || control.hasError('max')) {
      return 'القيمة المدخلة خارج النطاق.';
    }

    if (control.hasError('maxlength')) {
      return 'تجاوزت الحد الأقصى المسموح.';
    }

    return 'القيمة المدخلة غير صحيحة.';
  }

  getLockActionError(): string | null {
    const stageId = this.normalizeNumber(this.lockForm.get('stageId')?.value);
    const actionId = this.normalizeNumber(this.lockForm.get('actionId')?.value);
    if (actionId && !stageId) {
      return 'لا يمكن اختيار إجراء بدون مرحلة.';
    }

    if (actionId && stageId && !this.isActionBelongsToStage(actionId, stageId)) {
      return 'الإجراء المختار لا يتبع المرحلة المحددة.';
    }

    return null;
  }

  getPreviewControlError(controlName: string): string | null {
    const control = this.previewForm.get(controlName);
    if (!control || !control.invalid) {
      return null;
    }

    if (control.hasError('required')) {
      if (controlName === 'subjectId' && this.previewSubjectIdRequired) {
        return 'معرف الجهة مطلوب لهذا النوع من الجهة.';
      }

      return 'هذا الحقل إلزامي.';
    }

    if (control.hasError('maxlength')) {
      return 'تجاوزت الحد الأقصى المسموح.';
    }

    return 'القيمة المدخلة غير صحيحة.';
  }

  getPreviewActionError(): string | null {
    const stageId = this.normalizeNumber(this.previewForm.get('stageId')?.value);
    const actionId = this.normalizeNumber(this.previewForm.get('actionId')?.value);
    if (actionId && !stageId) {
      return 'عند اختيار إجراء يجب اختيار مرحلة أولًا.';
    }

    if (actionId && stageId && !this.isActionBelongsToStage(actionId, stageId)) {
      return 'الإجراء المختار لا يتبع المرحلة المحددة.';
    }

    return null;
  }

  trackByIndex(index: number): number {
    return index;
  }

  private onUpdateRule(): void {
    if (this.editingRuleIndex == null || this.editingRuleIndex < 0 || this.editingRuleIndex >= this.rules.length) {
      this.resetRuleEditor();
      return;
    }

    const existing = this.rules[this.editingRuleIndex];
    const updatedRule = this.buildRuleFromForm(existing.id);
    this.rules = this.rules.map((item, index) => (index === this.editingRuleIndex ? updatedRule : item));
    this.resetRuleEditor();
    this.evaluateDirtyState();
    this.emitCompletion();
    this.showMessage('success', 'تم تحديث القاعدة محليًا.');
  }

  private onUpdateLock(): void {
    if (this.editingLockIndex == null || this.editingLockIndex < 0 || this.editingLockIndex >= this.locks.length) {
      this.resetLockEditor();
      return;
    }

    if (!this.requestTypeId || this.requestTypeId <= 0) {
      this.showMessage('warn', 'اختر نوع الطلب أولًا قبل تحديث القفل.');
      return;
    }

    const existing = this.locks[this.editingLockIndex];
    const updatedLock = this.buildLockFromForm(existing.id);
    const updatedLocks = this.locks.map((item, index) => (index === this.editingLockIndex ? updatedLock : item));
    const payload = this.buildWorkspaceUpsertPayload(updatedLocks);

    this.savingLockUpdate = true;
    this.accessPolicyController.upsertWorkspace(this.requestTypeId, payload).subscribe({
      next: response => {
        if (!this.ensureSuccess(response, 'تعذر تحديث القفل.')) {
          return;
        }

        this.workspace = response.data ?? null;
        this.rules = [...(this.workspace?.rules ?? [])];
        this.locks = [...(this.workspace?.locks ?? [])];
        this.preview = null;
        this.policyForm.patchValue(
          {
            policyName: this.workspace?.policy?.name ?? this.policyForm.get('policyName')?.value,
            isPolicyActive: this.workspace?.policy?.isActive ?? this.policyForm.get('isPolicyActive')?.value,
            defaultAccessMode: this.workspace?.policy?.defaultAccessMode ?? this.policyForm.get('defaultAccessMode')?.value
          },
          { emitEvent: false }
        );

        this.resetLockEditor();
        this.persistedSnapshot = this.buildWorkspaceSnapshot();
        this.hasUnsavedChanges = false;
        this.emitCompletion();
        this.showMessage('success', 'تم تحديث القفل بنجاح.');
      },
      error: () => this.showMessage('error', 'حدث خطأ أثناء تحديث القفل.'),
      complete: () => {
        this.savingLockUpdate = false;
      }
    });
  }

  private buildRuleFromForm(existingId?: number): FieldAccessPolicyRuleDto {
    return {
      id: existingId,
      targetLevel: String(this.ruleForm.get('targetLevel')?.value ?? 'Field'),
      targetId: this.normalizeNumber(this.ruleForm.get('targetId')?.value) ?? 0,
      stageId: this.normalizeNumber(this.ruleForm.get('stageId')?.value),
      actionId: this.normalizeNumber(this.ruleForm.get('actionId')?.value),
      permissionType: String(this.ruleForm.get('permissionType')?.value ?? 'Editable'),
      subjectType: String(this.ruleForm.get('subjectType')?.value ?? 'OrgUnit'),
      subjectId: this.normalizeString(this.ruleForm.get('subjectId')?.value),
      effect: String(this.ruleForm.get('effect')?.value ?? 'Allow'),
      priority: Number(this.ruleForm.get('priority')?.value ?? 100),
      isActive: this.ruleForm.get('isActive')?.value === true,
      notes: this.normalizeString(this.ruleForm.get('notes')?.value)
    };
  }

  private buildLockFromForm(existingId?: number): FieldAccessLockDto {
    return {
      id: existingId,
      targetLevel: String(this.lockForm.get('targetLevel')?.value ?? 'Field'),
      targetId: this.normalizeNumber(this.lockForm.get('targetId')?.value) ?? 0,
      stageId: this.normalizeNumber(this.lockForm.get('stageId')?.value),
      actionId: this.normalizeNumber(this.lockForm.get('actionId')?.value),
      lockMode: String(this.lockForm.get('lockMode')?.value ?? 'NoEdit'),
      allowedOverrideSubjectType: this.normalizeString(this.lockForm.get('allowedOverrideSubjectType')?.value),
      allowedOverrideSubjectId: this.normalizeString(this.lockForm.get('allowedOverrideSubjectId')?.value),
      isActive: this.lockForm.get('isActive')?.value === true,
      notes: this.normalizeString(this.lockForm.get('notes')?.value)
    };
  }

  private buildWorkspaceUpsertPayload(locksOverride?: FieldAccessLockDto[]): FieldAccessPolicyWorkspaceUpsertRequestDto {
    return {
      policyName: this.normalizeString(this.policyForm.get('policyName')?.value),
      isPolicyActive: this.policyForm.get('isPolicyActive')?.value === true,
      defaultAccessMode: String(this.policyForm.get('defaultAccessMode')?.value ?? 'Editable'),
      rules: [...this.rules],
      locks: [...(locksOverride ?? this.locks)]
    };
  }

  private loadWorkspace(): void {
    if (!this.requestTypeId || this.requestTypeId <= 0) {
      return;
    }

    this.loadingWorkspace = true;
    this.accessPolicyController.getWorkspace(this.requestTypeId).subscribe({
      next: response => {
        if (!this.ensureSuccess(response, 'تعذر تحميل إعدادات سياسة الوصول للحقول.')) {
          return;
        }

        this.workspace = response.data ?? null;
        this.rules = [...(this.workspace?.rules ?? [])];
        this.locks = [...(this.workspace?.locks ?? [])];
        this.preview = null;
        this.patchFormsFromWorkspace();
        this.emitCompletion();
      },
      error: () => this.showMessage('error', 'حدث خطأ أثناء تحميل سياسة الوصول للحقول.'),
      complete: () => {
        this.loadingWorkspace = false;
      }
    });
  }

  private patchFormsFromWorkspace(): void {
    const policy = this.workspace?.policy;

    this.suppressDirtyTracking = true;
    this.policyForm.patchValue(
      {
        policyName: policy?.name ?? `سياسة الوصول - ${this.requestTypeId ?? ''}`,
        isPolicyActive: policy?.isActive ?? true,
        defaultAccessMode: policy?.defaultAccessMode ?? 'Editable'
      },
      { emitEvent: false }
    );

    this.resetRuleEditor(false);
    this.resetLockEditor(false);
    this.previewForm.reset(
      {
        stageId: null,
        actionId: null,
        requestId: null,
        subjectType: null,
        subjectId: '',
        requestOwnerUserId: '',
        currentCustodianUnitId: ''
      },
      { emitEvent: false }
    );
    this.applyRuleSubjectValidators();
    this.applyPreviewSubjectValidators();
    this.applyLockOverrideSubjectValidators();
    this.syncRuleActionToStage();
    this.syncLockActionToStage();
    this.syncPreviewActionToStage();

    this.persistedSnapshot = this.buildWorkspaceSnapshot();
    this.hasUnsavedChanges = false;
    this.suppressDirtyTracking = false;
  }

  private resetRuleEditor(showModeMessage = false): void {
    this.editingRuleIndex = null;
    this.ruleForm.reset(
      {
        targetLevel: 'Field',
        targetId: null,
        stageId: null,
        actionId: null,
        permissionType: 'Editable',
        subjectType: 'OrgUnit',
        subjectId: '',
        effect: 'Allow',
        priority: 100,
        isActive: true,
        notes: ''
      },
      { emitEvent: false }
    );

    this.applyRuleSubjectValidators();
    this.syncRuleActionToStage();
    this.syncRuleSuggestedNotesAfterFormPatch();

    if (showModeMessage) {
      this.showMessage('warn', 'تمت العودة إلى وضع إضافة قاعدة جديدة.');
    }
  }

  private resetLockEditor(emitMessage = false): void {
    this.editingLockIndex = null;
    this.lockForm.reset(
      {
        targetLevel: 'Field',
        targetId: null,
        stageId: null,
        actionId: null,
        lockMode: 'NoEdit',
        allowedOverrideSubjectType: null,
        allowedOverrideSubjectId: '',
        isActive: true,
        notes: ''
      },
      { emitEvent: false }
    );

    this.previousLockTargetLevel = 'Field';
    this.previousLockOverrideSubjectType = undefined;
    this.applyLockOverrideSubjectValidators();
    this.syncLockActionToStage();
    this.syncLockSuggestedNotesAfterFormPatch();

    if (emitMessage) {
      this.showMessage('warn', 'تمت إعادة تعيين نموذج القفل.');
    }
  }

  private applyRuleSubjectValidators(): void {
    const subjectType = String(this.ruleForm.get('subjectType')?.value ?? '');
    const subjectIdControl = this.ruleForm.get('subjectId');
    if (!subjectIdControl) {
      return;
    }

    if (this.requiresSubjectId(subjectType)) {
      subjectIdControl.setValidators([Validators.required, Validators.maxLength(64)]);
    } else {
      subjectIdControl.setValidators([Validators.maxLength(64)]);
    }

    subjectIdControl.updateValueAndValidity({ emitEvent: false });
  }

  private applyPreviewSubjectValidators(): void {
    const subjectType = String(this.previewForm.get('subjectType')?.value ?? '');
    const subjectIdControl = this.previewForm.get('subjectId');
    if (!subjectIdControl) {
      return;
    }

    if (this.requiresSubjectId(subjectType)) {
      subjectIdControl.setValidators([Validators.required, Validators.maxLength(64)]);
    } else {
      subjectIdControl.setValidators([Validators.maxLength(64)]);
    }

    subjectIdControl.updateValueAndValidity({ emitEvent: false });
  }

  private applyLockOverrideSubjectValidators(): void {
    const subjectType = String(this.lockForm.get('allowedOverrideSubjectType')?.value ?? '');
    const subjectIdControl = this.lockForm.get('allowedOverrideSubjectId');
    if (!subjectIdControl) {
      return;
    }

    if (this.requiresSubjectId(subjectType)) {
      subjectIdControl.setValidators([Validators.required, Validators.maxLength(64)]);
    } else {
      subjectIdControl.setValidators([Validators.maxLength(64)]);
    }

    subjectIdControl.updateValueAndValidity({ emitEvent: false });
  }

  private onLockTargetLevelChange(nextValue: unknown): void {
    const normalizedLevel = String(nextValue ?? 'Field');
    const didChange = normalizedLevel !== this.previousLockTargetLevel;
    this.previousLockTargetLevel = normalizedLevel;

    if (!didChange) {
      return;
    }

    this.lockForm.get('targetId')?.patchValue(null, { emitEvent: false });
  }

  private onLockOverrideSubjectTypeChange(nextValue: unknown): void {
    const normalizedType = this.normalizeString(nextValue);
    const didChange = (normalizedType ?? '') !== (this.previousLockOverrideSubjectType ?? '');
    this.previousLockOverrideSubjectType = normalizedType;

    this.applyLockOverrideSubjectValidators();

    if (!didChange) {
      return;
    }

    this.lockForm.get('allowedOverrideSubjectId')?.patchValue('', { emitEvent: false });
  }

  private syncRuleActionToStage(): void {
    const stageId = this.normalizeNumber(this.ruleForm.get('stageId')?.value);
    const actionControl = this.ruleForm.get('actionId');
    if (!actionControl) {
      return;
    }

    const actionId = this.normalizeNumber(actionControl.value);
    if (!stageId && actionId) {
      actionControl.patchValue(null, { emitEvent: false });
      return;
    }

    if (stageId && actionId && !this.isActionBelongsToStage(actionId, stageId)) {
      actionControl.patchValue(null, { emitEvent: false });
    }
  }

  private syncLockActionToStage(): void {
    const stageId = this.normalizeNumber(this.lockForm.get('stageId')?.value);
    const actionControl = this.lockForm.get('actionId');
    if (!actionControl) {
      return;
    }

    const actionId = this.normalizeNumber(actionControl.value);
    if (!stageId && actionId) {
      actionControl.patchValue(null, { emitEvent: false });
      return;
    }

    if (stageId && actionId && !this.isActionBelongsToStage(actionId, stageId)) {
      actionControl.patchValue(null, { emitEvent: false });
    }
  }

  private syncPreviewActionToStage(): void {
    const stageId = this.normalizeNumber(this.previewForm.get('stageId')?.value);
    const actionControl = this.previewForm.get('actionId');
    if (!actionControl) {
      return;
    }

    const actionId = this.normalizeNumber(actionControl.value);
    if (!stageId && actionId) {
      actionControl.patchValue(null, { emitEvent: false });
      return;
    }

    if (stageId && actionId && !this.isActionBelongsToStage(actionId, stageId)) {
      actionControl.patchValue(null, { emitEvent: false });
    }
  }

  private syncRuleTargetToLevel(): void {
    const targetLevel = String(this.ruleForm.get('targetLevel')?.value ?? 'Field');
    const targetId = this.normalizeNumber(this.ruleForm.get('targetId')?.value);
    if (!targetId) {
      return;
    }

    if (!this.isTargetBelongsToLevel(targetLevel, targetId)) {
      this.ruleForm.get('targetId')?.patchValue(null, { emitEvent: false });
    }
  }

  private collectRuleValidationMessages(): string[] {
    const messages: string[] = [];

    if (!this.workspace) {
      messages.push('لا يمكن إضافة قاعدة قبل تحميل بيانات نوع الطلب.');
      return messages;
    }

    const targetLevel = String(this.ruleForm.get('targetLevel')?.value ?? '');
    const targetId = this.normalizeNumber(this.ruleForm.get('targetId')?.value);
    const stageId = this.normalizeNumber(this.ruleForm.get('stageId')?.value);
    const actionId = this.normalizeNumber(this.ruleForm.get('actionId')?.value);
    const subjectType = this.normalizeString(this.ruleForm.get('subjectType')?.value);
    const subjectId = this.normalizeString(this.ruleForm.get('subjectId')?.value);
    const priority = Number(this.ruleForm.get('priority')?.value ?? NaN);

    if (targetLevel !== 'Field' && targetLevel !== 'Group') {
      messages.push('اختر مستوى هدف صالحًا (حقل أو مجموعة).');
    }

    if (!targetId) {
      messages.push('اختيار الهدف إلزامي.');
    } else if (!this.isTargetBelongsToLevel(targetLevel, targetId)) {
      messages.push('الهدف المختار غير صالح لمستوى الهدف الحالي.');
    }

    if (!subjectType) {
      messages.push('اختيار نوع الجهة إلزامي.');
    } else if (this.requiresSubjectId(subjectType) && !subjectId) {
      messages.push('معرف الجهة إلزامي لنوع الجهة المختار.');
    }

    if (actionId && !stageId) {
      messages.push('لا يمكن تحديد إجراء بدون مرحلة.');
    }

    if (actionId && stageId && !this.isActionBelongsToStage(actionId, stageId)) {
      messages.push('الإجراء المختار لا يتبع المرحلة المحددة.');
    }

    if (!Number.isFinite(priority) || priority < 0 || priority > 100000) {
      messages.push('الأولوية يجب أن تكون بين 0 و 100000.');
    }

    return messages;
  }

  private collectLockValidationMessages(): string[] {
    const messages: string[] = [];

    if (!this.workspace) {
      messages.push('لا يمكن إضافة قفل قبل تحميل بيانات نوع الطلب.');
      return messages;
    }

    const targetLevel = String(this.lockForm.get('targetLevel')?.value ?? '');
    const targetId = this.normalizeNumber(this.lockForm.get('targetId')?.value);
    const stageId = this.normalizeNumber(this.lockForm.get('stageId')?.value);
    const actionId = this.normalizeNumber(this.lockForm.get('actionId')?.value);
    const overrideSubjectType = this.normalizeString(this.lockForm.get('allowedOverrideSubjectType')?.value);
    const overrideSubjectId = this.normalizeString(this.lockForm.get('allowedOverrideSubjectId')?.value);

    if (targetLevel !== 'Field' && targetLevel !== 'Group') {
      messages.push('اختر مستوى هدف صالحًا (حقل أو مجموعة).');
    }

    if (!targetId) {
      messages.push('اختيار الهدف إلزامي.');
    } else if (!this.isTargetBelongsToLevel(targetLevel, targetId)) {
      messages.push('الهدف المختار غير صالح لمستوى الهدف الحالي.');
    }

    if (actionId && !stageId) {
      messages.push('لا يمكن تحديد إجراء بدون مرحلة.');
    }

    if (actionId && stageId && !this.isActionBelongsToStage(actionId, stageId)) {
      messages.push('الإجراء المختار لا يتبع المرحلة المحددة.');
    }

    if (!overrideSubjectType && overrideSubjectId) {
      messages.push('لا يمكن إدخال معرف جهة الاستثناء بدون اختيار نوع جهة الاستثناء.');
    }

    if (overrideSubjectType && this.requiresSubjectId(overrideSubjectType) && !overrideSubjectId) {
      messages.push('معرف جهة الاستثناء إلزامي لنوع الجهة المختار.');
    }

    return messages;
  }

  private collectPreviewValidationMessages(): string[] {
    const messages: string[] = [];

    if (!this.workspace) {
      messages.push('لا يمكن تشغيل المعاينة قبل تحميل بيانات نوع الطلب.');
      return messages;
    }

    const stageId = this.normalizeNumber(this.previewForm.get('stageId')?.value);
    const actionId = this.normalizeNumber(this.previewForm.get('actionId')?.value);
    const subjectType = this.normalizeString(this.previewForm.get('subjectType')?.value);
    const subjectId = this.normalizeString(this.previewForm.get('subjectId')?.value);

    if (actionId && !stageId) {
      messages.push('عند اختيار إجراء في المعاينة يجب اختيار مرحلة أولًا.');
    }

    if (actionId && stageId && !this.isActionBelongsToStage(actionId, stageId)) {
      messages.push('الإجراء المختار لا يتبع المرحلة المحددة.');
    }

    if (!subjectType && subjectId) {
      messages.push('لا يمكن إدخال معرف الجهة بدون اختيار نوع الجهة.');
    }

    if (subjectType && this.requiresSubjectId(subjectType) && !subjectId) {
      messages.push('معرف الجهة مطلوب لهذا النوع من الجهة في المعاينة.');
    }

    return messages;
  }

  private collectWorkspaceValidationMessages(): string[] {
    const messages: string[] = [];

    if (!this.defaultPolicyReady) {
      messages.push('أكمل بيانات السياسة الافتراضية أولًا.');
    }

    if (this.isRuleEditMode) {
      messages.push('يوجد تعديل قاعدة مفتوح. احفظ التعديل أو ألغِه قبل حفظ مساحة العمل.');
    }

    if (this.isLockEditMode) {
      messages.push('يوجد تعديل قفل مفتوح. حدّث القفل أو ألغِ التعديل قبل حفظ مساحة العمل.');
    }

    if (this.rules.length === 0) {
      messages.push('يجب إضافة قاعدة واحدة على الأقل قبل حفظ مساحة العمل.');
    }

    if (this.locks.length === 0) {
      messages.push('يجب إضافة قفل واحد على الأقل قبل حفظ مساحة العمل.');
    }

    const ruleIssues = this.rules
      .map((item, index) => this.validateRuleItem(item, index + 1))
      .filter(item => item.length > 0)
      .flat();

    const lockIssues = this.locks
      .map((item, index) => this.validateLockItem(item, index + 1))
      .filter(item => item.length > 0)
      .flat();

    messages.push(...ruleIssues, ...lockIssues);
    return messages;
  }

  private validateRuleItem(item: FieldAccessPolicyRuleDto, rowNumber: number): string[] {
    const messages: string[] = [];
    const prefix = `القاعدة #${rowNumber}`;

    if (item.targetLevel !== 'Field' && item.targetLevel !== 'Group') {
      messages.push(`${prefix}: مستوى الهدف غير صالح.`);
    }

    if (!item.targetId || item.targetId <= 0) {
      messages.push(`${prefix}: معرف الهدف مطلوب.`);
    } else if (!this.isTargetBelongsToLevel(item.targetLevel, item.targetId)) {
      messages.push(`${prefix}: الهدف غير متوافق مع المستوى.`);
    }

    const stageId = this.normalizeNumber(item.stageId);
    const actionId = this.normalizeNumber(item.actionId);
    if (actionId && !stageId) {
      messages.push(`${prefix}: لا يمكن تحديد إجراء بدون مرحلة.`);
    }

    if (actionId && stageId && !this.isActionBelongsToStage(actionId, stageId)) {
      messages.push(`${prefix}: الإجراء لا يتبع المرحلة.`);
    }

    const subjectType = this.normalizeString(item.subjectType);
    const subjectId = this.normalizeString(item.subjectId);
    if (!subjectType) {
      messages.push(`${prefix}: نوع الجهة مطلوب.`);
    } else if (this.requiresSubjectId(subjectType) && !subjectId) {
      messages.push(`${prefix}: معرف الجهة مطلوب لهذا النوع.`);
    }

    if (item.priority < 0 || item.priority > 100000) {
      messages.push(`${prefix}: الأولوية خارج النطاق.`);
    }

    return messages;
  }

  private validateLockItem(item: FieldAccessLockDto, rowNumber: number): string[] {
    const messages: string[] = [];
    const prefix = `القفل #${rowNumber}`;

    if (item.targetLevel !== 'Field' && item.targetLevel !== 'Group') {
      messages.push(`${prefix}: مستوى الهدف غير صالح.`);
    }

    if (!item.targetId || item.targetId <= 0) {
      messages.push(`${prefix}: معرف الهدف مطلوب.`);
    } else if (!this.isTargetBelongsToLevel(item.targetLevel, item.targetId)) {
      messages.push(`${prefix}: الهدف غير متوافق مع المستوى.`);
    }

    const stageId = this.normalizeNumber(item.stageId);
    const actionId = this.normalizeNumber(item.actionId);
    if (actionId && !stageId) {
      messages.push(`${prefix}: لا يمكن تحديد إجراء بدون مرحلة.`);
    }

    if (actionId && stageId && !this.isActionBelongsToStage(actionId, stageId)) {
      messages.push(`${prefix}: الإجراء لا يتبع المرحلة.`);
    }

    const overrideSubjectType = this.normalizeString(item.allowedOverrideSubjectType);
    const overrideSubjectId = this.normalizeString(item.allowedOverrideSubjectId);
    if (!overrideSubjectType && overrideSubjectId) {
      messages.push(`${prefix}: لا يمكن استخدام معرف جهة الاستثناء بدون نوع جهة الاستثناء.`);
    }

    if (overrideSubjectType && this.requiresSubjectId(overrideSubjectType) && !overrideSubjectId) {
      messages.push(`${prefix}: معرف جهة الاستثناء مطلوب.`);
    }

    return messages;
  }

  private seedRuleExamples(silent: boolean): number {
    const examples = this.buildRuleExamples();
    if (examples.length === 0) {
      return 0;
    }

    const existingSignatures = new Set(this.rules.map(item => this.ruleSignature(item)));
    const newItems = examples.filter(item => !existingSignatures.has(this.ruleSignature(item)));
    if (newItems.length === 0) {
      return 0;
    }

    this.rules = [...this.rules, ...newItems];
    this.emitCompletion();
    this.evaluateDirtyState();

    if (!silent) {
      this.showMessage('success', `تمت إضافة ${newItems.length} قاعدة من الأمثلة.`);
    }

    return newItems.length;
  }

  private seedLockExamples(silent: boolean): number {
    const examples = this.buildLockExamples();
    if (examples.length === 0) {
      return 0;
    }

    const existingSignatures = new Set(this.locks.map(item => this.lockSignature(item)));
    const newItems = examples.filter(item => !existingSignatures.has(this.lockSignature(item)));
    if (newItems.length === 0) {
      return 0;
    }

    this.locks = [...this.locks, ...newItems];
    this.emitCompletion();
    this.evaluateDirtyState();

    if (!silent) {
      this.showMessage('success', `تمت إضافة ${newItems.length} قفل من الأمثلة.`);
    }

    return newItems.length;
  }

  private buildRuleExamples(): FieldAccessPolicyRuleDto[] {
    const fields = this.workspace?.fields ?? [];
    const groups = this.workspace?.groups ?? [];
    const stages = this.workspace?.stages ?? [];

    const firstField = fields[0]?.id;
    const secondField = fields[1]?.id ?? fields[0]?.id;
    const thirdField = fields[2]?.id ?? fields[0]?.id;
    const firstGroup = groups[0]?.id;
    const secondGroup = groups[1]?.id ?? groups[0]?.id;

    const approvalStageId = stages[0]?.id;
    const reviewStageId = stages[1]?.id ?? approvalStageId;
    const approvalActionId = approvalStageId
      ? this.workspace?.actions?.find(item => item.stageId === approvalStageId)?.id
      : undefined;
    const reviewActionId = reviewStageId
      ? this.workspace?.actions?.find(item => item.stageId === reviewStageId)?.id
      : undefined;

    const examples: FieldAccessPolicyRuleDto[] = [];

    if (firstField) {
      examples.push({
        targetLevel: 'Field',
        targetId: firstField,
        stageId: approvalStageId,
        actionId: undefined,
        permissionType: 'ReadOnly',
        subjectType: 'Position',
        subjectId: '2001',
        effect: 'Allow',
        priority: 900,
        isActive: true,
        notes: 'مثال: الحقل للقراءة فقط أثناء مرحلة الاعتماد لمنصب محدد.'
      });
    }

    if (firstGroup) {
      examples.push({
        targetLevel: 'Group',
        targetId: firstGroup,
        stageId: undefined,
        actionId: undefined,
        permissionType: 'Hidden',
        subjectType: 'RequestOwner',
        effect: 'Allow',
        priority: 850,
        isActive: true,
        notes: 'مثال: إخفاء مجموعة كاملة عن منشئ الطلب.'
      });
    }

    if (secondField && reviewStageId && reviewActionId) {
      examples.push({
        targetLevel: 'Field',
        targetId: secondField,
        stageId: reviewStageId,
        actionId: reviewActionId,
        permissionType: 'RequiredInput',
        subjectType: 'CurrentCustodian',
        effect: 'Allow',
        priority: 950,
        isActive: true,
        notes: 'مثال: الحقل يصبح إلزامي عند إجراء استيفاء للحاضن الحالي.'
      });
    }

    if (thirdField) {
      examples.push({
        targetLevel: 'Field',
        targetId: thirdField,
        stageId: approvalStageId,
        actionId: approvalActionId,
        permissionType: 'Editable',
        subjectType: 'OrgUnit',
        subjectId: '120',
        effect: 'Allow',
        priority: 700,
        isActive: true,
        notes: 'مثال: السماح بالتحرير لوحدة تنظيمية محددة.'
      });
    }

    if (secondGroup) {
      examples.push({
        targetLevel: 'Group',
        targetId: secondGroup,
        stageId: undefined,
        actionId: undefined,
        permissionType: 'ReadOnly',
        subjectType: 'User',
        subjectId: 'USR-100',
        effect: 'Allow',
        priority: 500,
        isActive: true,
        notes: 'مثال: قراءة فقط لمستخدم محدد.'
      });
    }

    if (secondField) {
      examples.push({
        targetLevel: 'Field',
        targetId: secondField,
        stageId: undefined,
        actionId: undefined,
        permissionType: 'Editable',
        subjectType: 'Position',
        subjectId: '3001',
        effect: 'Deny',
        priority: 450,
        isActive: true,
        notes: 'مثال: منع على قابل للتعديل لتخفيض الصلاحية وفق الأولوية.'
      });
    }

    return examples;
  }

  private buildLockExamples(): FieldAccessLockDto[] {
    const fields = this.workspace?.fields ?? [];
    const groups = this.workspace?.groups ?? [];
    const stages = this.workspace?.stages ?? [];

    const firstField = fields[0]?.id;
    const secondField = fields[1]?.id ?? fields[0]?.id;
    const firstGroup = groups[0]?.id;

    const firstStageId = stages[0]?.id;
    const firstActionId = firstStageId
      ? this.workspace?.actions?.find(item => item.stageId === firstStageId)?.id
      : undefined;

    const examples: FieldAccessLockDto[] = [];

    if (firstGroup) {
      examples.push({
        targetLevel: 'Group',
        targetId: firstGroup,
        stageId: firstStageId,
        actionId: undefined,
        lockMode: 'FullLock',
        isActive: true,
        notes: 'مثال: قفل كامل للمجموعة في مرحلة محددة.'
      });
    }

    if (firstField) {
      examples.push({
        targetLevel: 'Field',
        targetId: firstField,
        stageId: firstStageId,
        actionId: firstActionId,
        lockMode: 'NoEdit',
        isActive: true,
        notes: 'مثال: منع تعديل الحقل عند إجراء محدد.'
      });
    }

    if (secondField) {
      examples.push({
        targetLevel: 'Field',
        targetId: secondField,
        stageId: undefined,
        actionId: undefined,
        lockMode: 'NoInput',
        allowedOverrideSubjectType: 'Position',
        allowedOverrideSubjectId: '2001',
        isActive: true,
        notes: 'مثال: القفل يسمح بالكسر فقط لمنصب معيّن.'
      });
    }

    return examples;
  }

  private ruleSignature(item: FieldAccessPolicyRuleDto): string {
    return [
      item.targetLevel,
      item.targetId,
      item.stageId ?? '',
      item.actionId ?? '',
      item.permissionType,
      item.subjectType,
      item.subjectId ?? '',
      item.effect,
      item.priority,
      item.isActive ? '1' : '0'
    ].join('|');
  }

  private lockSignature(item: FieldAccessLockDto): string {
    return [
      item.targetLevel,
      item.targetId,
      item.stageId ?? '',
      item.actionId ?? '',
      item.lockMode,
      item.allowedOverrideSubjectType ?? '',
      item.allowedOverrideSubjectId ?? '',
      item.isActive ? '1' : '0'
    ].join('|');
  }

  private isTargetBelongsToLevel(targetLevel: string, targetId: number): boolean {
    if (!this.workspace) {
      return false;
    }

    if (targetLevel === 'Group') {
      return this.workspace.groups.some(item => item.id === targetId);
    }

    if (targetLevel === 'Field') {
      return this.workspace.fields.some(item => item.id === targetId);
    }

    return false;
  }

  private isActionBelongsToStage(actionId: number, stageId: number): boolean {
    const action = (this.workspace?.actions ?? []).find(item => item.id === actionId);
    return !!action && action.stageId === stageId;
  }

  private buildActionOptions(stageId: number | undefined): SelectOption<number>[] {
    let source: FieldAccessActionLookupDto[] = this.workspace?.actions ?? [];
    if (stageId) {
      source = source.filter(item => item.stageId === stageId);
    }

    return source
      .map(item => ({ label: `${item.label} (#${item.id})`, value: item.id }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  private requiresSubjectId(subjectTypeRaw: unknown): boolean {
    const subjectType = String(subjectTypeRaw ?? '').trim();
    return subjectType === 'OrgUnit' || subjectType === 'Position' || subjectType === 'User';
  }

  resolveTargetLevelLabel(targetLevelRaw: unknown): string {
    const targetLevel = String(targetLevelRaw ?? '').trim();
    if (targetLevel === 'Group') {
      return 'مجموعة';
    }
    if (targetLevel === 'Field') {
      return 'حقل';
    }

    return 'غير محدد';
  }

  resolveLockModeLabel(lockModeRaw: unknown): string {
    const lockMode = String(lockModeRaw ?? '').trim();
    if (lockMode === 'NoEdit') {
      return 'منع تعديل';
    }
    if (lockMode === 'NoInput') {
      return 'منع إدخال';
    }
    if (lockMode === 'FullLock') {
      return 'قفل كامل';
    }

    return 'غير محدد';
  }

  resolveSubjectTypeLabel(subjectTypeRaw: unknown): string {
    const subjectType = String(subjectTypeRaw ?? '').trim();
    if (subjectType === 'OrgUnit') {
      return 'وحدة تنظيمية';
    }
    if (subjectType === 'Position') {
      return 'منصب';
    }
    if (subjectType === 'User') {
      return 'مستخدم';
    }
    if (subjectType === 'RequestOwner') {
      return 'منشئ الطلب';
    }
    if (subjectType === 'CurrentCustodian') {
      return 'الحاضن الحالي';
    }

    return 'غير محدد';
  }

  private onRuleNotesControlChanged(value: unknown): void {
    if (this.applyingRuleSuggestedNotes) {
      return;
    }

    this.ruleNotesManuallyEdited = this.normalizeNotesValue(value) !== this.normalizeNotesValue(this.ruleSuggestedNotes);
  }

  private onLockNotesControlChanged(value: unknown): void {
    if (this.applyingLockSuggestedNotes) {
      return;
    }

    this.lockNotesManuallyEdited = this.normalizeNotesValue(value) !== this.normalizeNotesValue(this.lockSuggestedNotes);
  }

  private syncRuleSuggestedNotesAfterFormPatch(): void {
    const notesControl = this.ruleForm.get('notes');
    if (!notesControl) {
      return;
    }

    this.ruleSuggestedNotes = this.notesGenerator.buildRuleNotes(this.buildRuleNotesInput(), this.buildNotesContext());
    const currentNotes = this.normalizeNotesValue(notesControl.value);
    const suggestedNotes = this.normalizeNotesValue(this.ruleSuggestedNotes);

    if (currentNotes.length === 0) {
      this.applyRuleSuggestedNotes(this.ruleSuggestedNotes);
      this.ruleNotesManuallyEdited = false;
      return;
    }

    this.ruleNotesManuallyEdited = currentNotes !== suggestedNotes;
  }

  private syncLockSuggestedNotesAfterFormPatch(): void {
    const notesControl = this.lockForm.get('notes');
    if (!notesControl) {
      return;
    }

    this.lockSuggestedNotes = this.notesGenerator.buildLockNotes(this.buildLockNotesInput(), this.buildNotesContext());
    const currentNotes = this.normalizeNotesValue(notesControl.value);
    const suggestedNotes = this.normalizeNotesValue(this.lockSuggestedNotes);

    if (currentNotes.length === 0) {
      this.applyLockSuggestedNotes(this.lockSuggestedNotes);
      this.lockNotesManuallyEdited = false;
      return;
    }

    this.lockNotesManuallyEdited = currentNotes !== suggestedNotes;
  }

  private refreshRuleSuggestedNotes(): void {
    this.ruleSuggestedNotes = this.notesGenerator.buildRuleNotes(this.buildRuleNotesInput(), this.buildNotesContext());
    if (!this.ruleNotesManuallyEdited) {
      this.applyRuleSuggestedNotes(this.ruleSuggestedNotes);
    }
  }

  private refreshLockSuggestedNotes(): void {
    this.lockSuggestedNotes = this.notesGenerator.buildLockNotes(this.buildLockNotesInput(), this.buildNotesContext());
    if (!this.lockNotesManuallyEdited) {
      this.applyLockSuggestedNotes(this.lockSuggestedNotes);
    }
  }

  private applyRuleSuggestedNotes(value: string): void {
    const notesControl = this.ruleForm.get('notes');
    if (!notesControl) {
      return;
    }

    if (this.normalizeNotesValue(notesControl.value) === this.normalizeNotesValue(value)) {
      return;
    }

    this.applyingRuleSuggestedNotes = true;
    notesControl.patchValue(value, { emitEvent: false });
    this.applyingRuleSuggestedNotes = false;
  }

  private applyLockSuggestedNotes(value: string): void {
    const notesControl = this.lockForm.get('notes');
    if (!notesControl) {
      return;
    }

    if (this.normalizeNotesValue(notesControl.value) === this.normalizeNotesValue(value)) {
      return;
    }

    this.applyingLockSuggestedNotes = true;
    notesControl.patchValue(value, { emitEvent: false });
    this.applyingLockSuggestedNotes = false;
  }

  private buildRuleNotesInput(): RuleNotesInput {
    const priorityRaw = Number(this.ruleForm.get('priority')?.value ?? NaN);
    return {
      targetLevel: this.normalizeString(this.ruleForm.get('targetLevel')?.value),
      targetId: this.normalizeNumber(this.ruleForm.get('targetId')?.value),
      stageId: this.normalizeNumber(this.ruleForm.get('stageId')?.value),
      actionId: this.normalizeNumber(this.ruleForm.get('actionId')?.value),
      permissionType: this.normalizeString(this.ruleForm.get('permissionType')?.value),
      subjectType: this.normalizeString(this.ruleForm.get('subjectType')?.value),
      subjectId: this.normalizeString(this.ruleForm.get('subjectId')?.value),
      effect: this.normalizeString(this.ruleForm.get('effect')?.value),
      priority: Number.isFinite(priorityRaw) ? priorityRaw : undefined,
      isActive: this.ruleForm.get('isActive')?.value === true
    };
  }

  private buildLockNotesInput(): LockNotesInput {
    return {
      targetLevel: this.normalizeString(this.lockForm.get('targetLevel')?.value),
      targetId: this.normalizeNumber(this.lockForm.get('targetId')?.value),
      stageId: this.normalizeNumber(this.lockForm.get('stageId')?.value),
      actionId: this.normalizeNumber(this.lockForm.get('actionId')?.value),
      lockMode: this.normalizeString(this.lockForm.get('lockMode')?.value),
      allowedOverrideSubjectType: this.normalizeString(this.lockForm.get('allowedOverrideSubjectType')?.value),
      allowedOverrideSubjectId: this.normalizeString(this.lockForm.get('allowedOverrideSubjectId')?.value),
      isActive: this.lockForm.get('isActive')?.value === true
    };
  }

  private buildNotesContext(): FieldAccessNotesContext {
    const groups = this.workspace?.groups ?? [];
    const fields = this.workspace?.fields ?? [];
    const stages = this.workspace?.stages ?? [];
    const actions = this.workspace?.actions ?? [];

    return {
      targetLevelOptions: this.targetLevelOptions.map(item => ({ label: item.label, value: item.value })),
      permissionTypeOptions: this.permissionTypeOptions.map(item => ({ label: item.label, value: item.value })),
      subjectTypeOptions: this.subjectTypeOptions.map(item => ({ label: item.label, value: item.value })),
      effectOptions: this.effectOptions.map(item => ({ label: item.label, value: item.value })),
      lockModeOptions: this.lockModeOptions.map(item => ({ label: item.label, value: item.value })),
      targets: [
        ...groups.map(item => ({ id: item.id, label: item.label, targetLevel: 'Group' })),
        ...fields.map(item => ({ id: item.id, label: item.label, targetLevel: 'Field' }))
      ],
      stages: stages.map(item => ({ id: item.id, label: item.label })),
      actions: actions.map(item => ({ id: item.id, stageId: item.stageId, label: item.label }))
    };
  }

  private ensureSuccess<T>(response: CommonResponse<T>, fallbackMessage: string): boolean {
    if (response?.isSuccess) {
      return true;
    }

    const message = response?.errors?.find(item => item?.message)?.message ?? fallbackMessage;
    this.showMessage('error', message);
    return false;
  }

  private evaluateDirtyState(): void {
    if (this.suppressDirtyTracking || !this.workspace) {
      return;
    }

    const currentSnapshot = this.buildWorkspaceSnapshot();
    this.hasUnsavedChanges = this.persistedSnapshot.length > 0 && currentSnapshot !== this.persistedSnapshot;
  }

  private buildWorkspaceSnapshot(): string {
    return JSON.stringify({
      policyName: this.normalizeString(this.policyForm.get('policyName')?.value) ?? '',
      isPolicyActive: this.policyForm.get('isPolicyActive')?.value === true,
      defaultAccessMode: String(this.policyForm.get('defaultAccessMode')?.value ?? 'Editable'),
      rules: this.rules.map(item => ({
        id: item.id ?? null,
        targetLevel: item.targetLevel,
        targetId: item.targetId,
        stageId: item.stageId ?? null,
        actionId: item.actionId ?? null,
        permissionType: item.permissionType,
        subjectType: item.subjectType,
        subjectId: item.subjectId ?? null,
        effect: item.effect,
        priority: item.priority,
        isActive: item.isActive,
        notes: item.notes ?? null
      })),
      locks: this.locks.map(item => ({
        id: item.id ?? null,
        targetLevel: item.targetLevel,
        targetId: item.targetId,
        stageId: item.stageId ?? null,
        actionId: item.actionId ?? null,
        lockMode: item.lockMode,
        allowedOverrideSubjectType: item.allowedOverrideSubjectType ?? null,
        allowedOverrideSubjectId: item.allowedOverrideSubjectId ?? null,
        isActive: item.isActive,
        notes: item.notes ?? null
      }))
    });
  }

  private emitCompletion(): void {
    this.completionPercentChange.emit(this.mandatoryCompletionPercent);
  }

  private showMessage(severity: MessageSeverity, message: string): void {
    this.messageSeverity = severity;
    this.message = message;
  }

  private normalizeString(value: unknown): string | undefined {
    const normalized = String(value ?? '').trim();
    return normalized.length > 0 ? normalized : undefined;
  }

  private normalizeNotesValue(value: unknown): string {
    return String(value ?? '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private normalizeNumber(value: unknown): number | undefined {
    const parsed = Number(value ?? 0);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return undefined;
    }

    return Math.floor(parsed);
  }

  get previewGroupResolutions(): FieldAccessPreviewResolutionItemDto[] {
    return this.preview?.groupResolutions ?? [];
  }

  get previewFieldResolutions(): FieldAccessPreviewResolutionItemDto[] {
    return this.preview?.fieldResolutions ?? [];
  }
}
