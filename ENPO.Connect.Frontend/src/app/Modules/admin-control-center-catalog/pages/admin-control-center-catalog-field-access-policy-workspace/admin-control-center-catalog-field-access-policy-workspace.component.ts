import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CommonResponse } from 'src/app/shared/services/BackendServices/DynamicSubjects/DynamicSubjects.dto';
import { DynamicSubjectsAdminAccessPolicyController } from 'src/app/shared/services/BackendServices/DynamicSubjectsAdminAccessPolicy/DynamicSubjectsAdminAccessPolicy.service';
import {
  FieldAccessActionLookupDto,
  FieldAccessLockDto,
  FieldAccessPolicyRuleDto,
  FieldAccessPolicyWorkspaceDto,
  FieldAccessPolicyWorkspaceUpsertRequestDto,
  FieldAccessPreviewRequestDto,
  FieldAccessPreviewResponseDto,
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
export class AdminControlCenterCatalogFieldAccessPolicyWorkspaceComponent implements OnChanges {
  @Input() requestTypeId: number | null = null;
  @Input() requestTypeLabel = '';
  @Output() completionPercentChange = new EventEmitter<number>();

  readonly tabMenu: Array<{ key: AccessTabKey; label: string; mandatory: boolean }> = [
    { key: 'overview', label: 'Overview', mandatory: true },
    { key: 'defaultPolicy', label: 'Default Policy', mandatory: true },
    { key: 'rules', label: 'Stage/Action Rules', mandatory: true },
    { key: 'locks', label: 'Locks', mandatory: true },
    { key: 'preview', label: 'Preview', mandatory: true }
  ];

  readonly targetLevelOptions: SelectOption<FieldAccessTargetLevel>[] = [
    { label: 'Group', value: 'Group' },
    { label: 'Field', value: 'Field' }
  ];

  readonly permissionTypeOptions: SelectOption<string>[] = [
    { label: 'Editable - قابل للتعديل', value: 'Editable' },
    { label: 'ReadOnly - قراءة فقط', value: 'ReadOnly' },
    { label: 'Hidden - مخفي', value: 'Hidden' },
    { label: 'RequiredInput - إدخال إلزامي', value: 'RequiredInput' }
  ];

  readonly subjectTypeOptions: SelectOption<FieldAccessSubjectType>[] = [
    { label: 'OrgUnit - وحدة تنظيمية', value: 'OrgUnit' },
    { label: 'Position - منصب', value: 'Position' },
    { label: 'User - مستخدم', value: 'User' },
    { label: 'RequestOwner - منشئ الطلب', value: 'RequestOwner' },
    { label: 'CurrentCustodian - الحاضن الحالي', value: 'CurrentCustodian' }
  ];

  readonly effectOptions: SelectOption<string>[] = [
    { label: 'Allow', value: 'Allow' },
    { label: 'Deny', value: 'Deny' }
  ];

  readonly lockModeOptions: SelectOption<string>[] = [
    { label: 'NoEdit - منع تعديل', value: 'NoEdit' },
    { label: 'NoInput - منع إدخال', value: 'NoInput' },
    { label: 'FullLock - قفل كامل', value: 'FullLock' }
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
  loadingPreview = false;

  message = '';
  messageSeverity: MessageSeverity = 'success';

  constructor(
    private readonly fb: FormBuilder,
    private readonly accessPolicyController: DynamicSubjectsAdminAccessPolicyController
  ) {
    this.ruleForm.get('subjectType')?.valueChanges.subscribe(() => this.applyRuleSubjectValidators());
    this.previewForm.get('subjectType')?.valueChanges.subscribe(() => this.applyPreviewSubjectValidators());
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['requestTypeId']) {
      this.preview = null;
      this.rules = [];
      this.locks = [];
      this.workspace = null;
      this.message = '';
      this.activeTab = 'overview';
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

    return this.requestTypeId ? `Request Type #${this.requestTypeId}` : 'لم يتم اختيار نوع طلب';
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
    const stageId = Number(this.ruleForm.get('stageId')?.value ?? 0) || null;
    return this.buildActionOptions(stageId);
  }

  get lockActionOptions(): SelectOption<number>[] {
    const stageId = Number(this.lockForm.get('stageId')?.value ?? 0) || null;
    return this.buildActionOptions(stageId);
  }

  get previewActionOptions(): SelectOption<number>[] {
    const stageId = Number(this.previewForm.get('stageId')?.value ?? 0) || null;
    return this.buildActionOptions(stageId);
  }

  onSwitchTab(tab: AccessTabKey): void {
    if (tab !== 'overview' && !this.defaultPolicyReady) {
      this.showMessage('warn', 'لا يمكن الانتقال للخطوات التالية قبل اكتمال Default Policy.');
      this.activeTab = 'defaultPolicy';
      return;
    }

    this.activeTab = tab;
  }

  onAddRule(): void {
    this.applyRuleSubjectValidators();
    this.ruleForm.markAllAsTouched();
    if (!this.ruleForm.valid) {
      this.showMessage('warn', 'يرجى استكمال البيانات الإلزامية لإضافة القاعدة.');
      return;
    }

    const stageId = this.normalizeNumber(this.ruleForm.get('stageId')?.value);
    const actionId = this.normalizeNumber(this.ruleForm.get('actionId')?.value);
    if (actionId && !stageId) {
      this.showMessage('warn', 'لا يمكن تحديد Action بدون Stage.');
      return;
    }

    const item: FieldAccessPolicyRuleDto = {
      targetLevel: String(this.ruleForm.get('targetLevel')?.value ?? 'Field'),
      targetId: Number(this.ruleForm.get('targetId')?.value ?? 0),
      stageId,
      actionId,
      permissionType: String(this.ruleForm.get('permissionType')?.value ?? 'Editable'),
      subjectType: String(this.ruleForm.get('subjectType')?.value ?? 'OrgUnit'),
      subjectId: this.normalizeString(this.ruleForm.get('subjectId')?.value),
      effect: String(this.ruleForm.get('effect')?.value ?? 'Allow'),
      priority: Number(this.ruleForm.get('priority')?.value ?? 100),
      isActive: this.ruleForm.get('isActive')?.value === true,
      notes: this.normalizeString(this.ruleForm.get('notes')?.value)
    };

    this.rules = [...this.rules, item];
    this.ruleForm.patchValue({
      targetId: null,
      stageId: null,
      actionId: null,
      subjectId: '',
      notes: ''
    });
    this.emitCompletion();
  }

  onRemoveRule(index: number): void {
    if (index < 0 || index >= this.rules.length) {
      return;
    }

    this.rules = this.rules.filter((_, idx) => idx !== index);
    this.emitCompletion();
  }

  onAddLock(): void {
    this.lockForm.markAllAsTouched();
    if (!this.lockForm.valid) {
      this.showMessage('warn', 'يرجى استكمال البيانات الإلزامية لإضافة القفل.');
      return;
    }

    const stageId = this.normalizeNumber(this.lockForm.get('stageId')?.value);
    const actionId = this.normalizeNumber(this.lockForm.get('actionId')?.value);
    if (actionId && !stageId) {
      this.showMessage('warn', 'لا يمكن تحديد Action بدون Stage.');
      return;
    }

    const item: FieldAccessLockDto = {
      targetLevel: String(this.lockForm.get('targetLevel')?.value ?? 'Field'),
      targetId: Number(this.lockForm.get('targetId')?.value ?? 0),
      stageId,
      actionId,
      lockMode: String(this.lockForm.get('lockMode')?.value ?? 'NoEdit'),
      allowedOverrideSubjectType: this.normalizeString(this.lockForm.get('allowedOverrideSubjectType')?.value) ?? undefined,
      allowedOverrideSubjectId: this.normalizeString(this.lockForm.get('allowedOverrideSubjectId')?.value),
      isActive: this.lockForm.get('isActive')?.value === true,
      notes: this.normalizeString(this.lockForm.get('notes')?.value)
    };

    this.locks = [...this.locks, item];
    this.lockForm.patchValue({
      targetId: null,
      stageId: null,
      actionId: null,
      allowedOverrideSubjectType: null,
      allowedOverrideSubjectId: '',
      notes: ''
    });
    this.emitCompletion();
  }

  onRemoveLock(index: number): void {
    if (index < 0 || index >= this.locks.length) {
      return;
    }

    this.locks = this.locks.filter((_, idx) => idx !== index);
    this.emitCompletion();
  }

  onSaveWorkspace(): void {
    if (!this.canManageWorkspace || !this.requestTypeId) {
      this.showMessage('warn', 'اختر نوع طلب أولًا قبل الحفظ.');
      return;
    }

    this.policyForm.markAllAsTouched();
    if (!this.defaultPolicyReady) {
      this.showMessage('warn', 'يرجى استكمال Default Policy قبل الحفظ.');
      this.activeTab = 'defaultPolicy';
      return;
    }

    const payload: FieldAccessPolicyWorkspaceUpsertRequestDto = {
      policyName: this.normalizeString(this.policyForm.get('policyName')?.value),
      isPolicyActive: this.policyForm.get('isPolicyActive')?.value === true,
      defaultAccessMode: String(this.policyForm.get('defaultAccessMode')?.value ?? 'Editable'),
      rules: this.rules,
      locks: this.locks
    };

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

    this.applyPreviewSubjectValidators();
    this.previewForm.markAllAsTouched();
    if (!this.previewForm.valid) {
      this.showMessage('warn', 'يرجى استكمال بيانات المعاينة الإلزامية.');
      return;
    }

    const stageId = this.normalizeNumber(this.previewForm.get('stageId')?.value);
    const actionId = this.normalizeNumber(this.previewForm.get('actionId')?.value);
    if (actionId && !stageId) {
      this.showMessage('warn', 'عند تحديد Action يجب تحديد Stage.');
      return;
    }

    const request: FieldAccessPreviewRequestDto = {
      stageId,
      actionId,
      requestId: this.normalizeNumber(this.previewForm.get('requestId')?.value),
      subjectType: this.normalizeString(this.previewForm.get('subjectType')?.value) ?? undefined,
      subjectId: this.normalizeString(this.previewForm.get('subjectId')?.value),
      requestOwnerUserId: this.normalizeString(this.previewForm.get('requestOwnerUserId')?.value),
      currentCustodianUnitId: this.normalizeString(this.previewForm.get('currentCustodianUnitId')?.value)
    };

    this.loadingPreview = true;
    this.accessPolicyController.preview(this.requestTypeId, request).subscribe({
      next: response => {
        if (!this.ensureSuccess(response, 'تعذر تشغيل المعاينة.')) {
          return;
        }

        this.preview = response.data ?? null;
        if (this.preview) {
          this.showMessage('success', 'تم تحديث المعاينة حسب المرحلة والإجراء المحددين.');
        }
        this.emitCompletion();
      },
      error: () => this.showMessage('error', 'حدث خطأ أثناء تشغيل المعاينة.'),
      complete: () => {
        this.loadingPreview = false;
      }
    });
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

  private loadWorkspace(): void {
    if (!this.requestTypeId || this.requestTypeId <= 0) {
      return;
    }

    this.loadingWorkspace = true;
    this.accessPolicyController.getWorkspace(this.requestTypeId).subscribe({
      next: response => {
        if (!this.ensureSuccess(response, 'تعذر تحميل إعدادات Field Access Policy.')) {
          return;
        }

        this.workspace = response.data ?? null;
        this.rules = [...(this.workspace?.rules ?? [])];
        this.locks = [...(this.workspace?.locks ?? [])];
        this.patchFormsFromWorkspace();
        this.emitCompletion();
      },
      error: () => this.showMessage('error', 'حدث خطأ أثناء تحميل Field Access Policy.'),
      complete: () => {
        this.loadingWorkspace = false;
      }
    });
  }

  private patchFormsFromWorkspace(): void {
    const policy = this.workspace?.policy;
    this.policyForm.patchValue(
      {
        policyName: policy?.name ?? `سياسة الوصول - ${this.requestTypeId ?? ''}`,
        isPolicyActive: policy?.isActive ?? true,
        defaultAccessMode: policy?.defaultAccessMode ?? 'Editable'
      },
      { emitEvent: false }
    );

    this.ruleForm.patchValue({
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
    });

    this.lockForm.patchValue({
      targetLevel: 'Field',
      targetId: null,
      stageId: null,
      actionId: null,
      lockMode: 'NoEdit',
      allowedOverrideSubjectType: null,
      allowedOverrideSubjectId: '',
      isActive: true,
      notes: ''
    });

    this.applyRuleSubjectValidators();
    this.applyPreviewSubjectValidators();
  }

  private applyRuleSubjectValidators(): void {
    const subjectType = String(this.ruleForm.get('subjectType')?.value ?? '');
    const subjectIdControl = this.ruleForm.get('subjectId');
    if (!subjectIdControl) {
      return;
    }

    if (subjectType === 'OrgUnit' || subjectType === 'Position' || subjectType === 'User') {
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

    if (subjectType === 'OrgUnit' || subjectType === 'Position' || subjectType === 'User') {
      subjectIdControl.setValidators([Validators.required, Validators.maxLength(64)]);
    } else {
      subjectIdControl.setValidators([Validators.maxLength(64)]);
    }
    subjectIdControl.updateValueAndValidity({ emitEvent: false });
  }

  private buildActionOptions(stageId: number | null): SelectOption<number>[] {
    let source: FieldAccessActionLookupDto[] = this.workspace?.actions ?? [];
    if (stageId) {
      source = source.filter(item => item.stageId === stageId);
    }

    return source
      .map(item => ({ label: `${item.label} (#${item.id})`, value: item.id }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  private ensureSuccess<T>(response: CommonResponse<T>, fallbackMessage: string): boolean {
    if (response?.isSuccess) {
      return true;
    }

    const message = response?.errors?.find(item => item?.message)?.message ?? fallbackMessage;
    this.showMessage('error', message);
    return false;
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

  private normalizeNumber(value: unknown): number | undefined {
    const parsed = Number(value ?? 0);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return undefined;
    }

    return Math.floor(parsed);
  }
}
