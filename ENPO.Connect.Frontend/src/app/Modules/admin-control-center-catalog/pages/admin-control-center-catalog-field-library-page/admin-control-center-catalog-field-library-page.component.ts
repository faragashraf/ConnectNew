import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { forkJoin, Subscription } from 'rxjs';
import { CommonResponse } from 'src/app/shared/services/BackendServices/DynamicSubjects/DynamicSubjects.dto';
import { DynamicSubjectsAdminCatalogController } from 'src/app/shared/services/BackendServices/DynamicSubjectsAdminCatalog/DynamicSubjectsAdminCatalog.service';
import {
  AdminCatalogApplicationDto,
  AdminCatalogFieldCreateRequestDto,
  AdminCatalogFieldDeleteDiagnosticsDto,
  AdminCatalogFieldDto,
  AdminCatalogFieldListItemDto,
  AdminCatalogFieldLookupsDto,
  AdminCatalogFieldStatusFilter,
  AdminCatalogFieldUpdateRequestDto,
  AdminCatalogDeleteResultDto
} from 'src/app/shared/services/BackendServices/DynamicSubjectsAdminCatalog/DynamicSubjectsAdminCatalog.dto';

type MessageSeverity = 'success' | 'warn' | 'error';

type SelectOption = { label: string; value: string };

@Component({
  selector: 'app-admin-control-center-catalog-field-library-page',
  templateUrl: './admin-control-center-catalog-field-library-page.component.html',
  styleUrls: ['./admin-control-center-catalog-field-library-page.component.scss']
})
export class AdminControlCenterCatalogFieldLibraryPageComponent implements OnInit, OnDestroy {
  readonly fieldForm: FormGroup = this.fb.group({
    applicationId: ['', [Validators.required, Validators.maxLength(10)]],
    fieldKey: ['', [Validators.required, Validators.maxLength(50)]],
    fieldLabel: ['', [Validators.required, Validators.maxLength(50)]],
    fieldType: ['', [Validators.required, Validators.maxLength(50)]],
    dataType: ['', [Validators.maxLength(50)]],
    isActive: [true],
    placeholder: ['', [Validators.maxLength(150)]],
    defaultValue: ['', [Validators.maxLength(100)]],
    width: [0, [Validators.required, Validators.min(0)]],
    height: [0, [Validators.required, Validators.min(0)]],
    isDisabledInit: [false],
    isSearchable: [false],
    required: [false],
    requiredTrue: [false],
    email: [false],
    pattern: [false],
    minValue: ['', [Validators.maxLength(30)]],
    maxValue: ['', [Validators.maxLength(30)]],
    mask: ['', [Validators.maxLength(30)]],
    cdmendTbl: [''],
    cdmendSql: [null, [Validators.min(1)]]
  });

  applications: AdminCatalogApplicationDto[] = [];
  applicationFilterOptions: SelectOption[] = [{ label: 'كل التطبيقات', value: '' }];

  fieldTypeOptions: SelectOption[] = [];
  dataTypeOptions: SelectOption[] = [];

  readonly statusOptions: SelectOption[] = [
    { label: 'الكل', value: 'all' },
    { label: 'مفعل', value: 'active' },
    { label: 'غير مفعل', value: 'inactive' }
  ];

  selectedApplicationFilter = '';
  statusFilter: AdminCatalogFieldStatusFilter = 'all';
  searchTerm = '';

  fields: AdminCatalogFieldListItemDto[] = [];

  dialogVisible = false;
  editingIdentity: { applicationId: string; fieldKey: string } | null = null;
  selectedFieldIdentity: string | null = null;

  loadingBootstrap = false;
  loadingFields = false;
  loadingFieldDetails = false;
  savingField = false;
  deletingFieldIdentity: string | null = null;

  loadedApplications = false;
  loadedLookups = false;
  loadedFields = false;
  hasCrudMutation = false;
  persistenceVerified = false;

  message = '';
  messageSeverity: MessageSeverity = 'success';

  private pendingPersistenceRefresh = false;
  private readonly subscriptions = new Subscription();

  constructor(
    private readonly fb: FormBuilder,
    private readonly adminCatalogController: DynamicSubjectsAdminCatalogController
  ) {}

  ngOnInit(): void {
    const fieldTypeControl = this.fieldForm.get('fieldType');
    if (fieldTypeControl) {
      this.subscriptions.add(
        fieldTypeControl.valueChanges.subscribe(() => {
          this.applyFieldTypeRules();
        })
      );
    }

    const minValueControl = this.fieldForm.get('minValue');
    const maxValueControl = this.fieldForm.get('maxValue');
    if (minValueControl && maxValueControl) {
      this.subscriptions.add(minValueControl.valueChanges.subscribe(() => this.validateRange()));
      this.subscriptions.add(maxValueControl.valueChanges.subscribe(() => this.validateRange()));
    }

    this.applyFieldTypeRules();
    this.loadBootstrapData();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  get isEditMode(): boolean {
    return this.editingIdentity != null;
  }

  get canSaveField(): boolean {
    return !this.savingField
      && this.fieldForm.valid
      && this.areMandatoryFieldsCompleted
      && !this.fieldForm.hasError('rangeError');
  }

  get applicationSelectOptions(): SelectOption[] {
    return this.applications
      .map(app => ({
        label: `${app.applicationName} (${app.applicationId})`,
        value: app.applicationId
      }))
      .sort((left, right) => left.label.localeCompare(right.label, 'ar'));
  }

  get phaseCompletionPercent(): number {
    const mandatoryCheckpoint = this.dialogVisible ? this.areMandatoryFieldsCompleted : true;
    const checkpoints = [
      this.loadedApplications,
      this.loadedLookups,
      this.loadedFields,
      this.fields.length > 0 || this.hasCrudMutation,
      mandatoryCheckpoint
    ];

    const passed = checkpoints.filter(Boolean).length;
    return Math.round((passed / checkpoints.length) * 100);
  }

  get overallCompletionPercent(): number {
    const checkpoints = [
      this.phaseCompletionPercent === 100,
      this.hasCrudMutation,
      this.persistenceVerified
    ];

    const passed = checkpoints.filter(Boolean).length;
    return Math.round((passed / checkpoints.length) * 100);
  }

  get areMandatoryFieldsCompleted(): boolean {
    const raw = this.fieldForm.getRawValue();
    return this.normalizeText(raw.applicationId) != null
      && this.normalizeText(raw.fieldKey) != null
      && this.normalizeText(raw.fieldLabel) != null
      && this.normalizeText(raw.fieldType) != null;
  }

  get normalizedFieldType(): string {
    return (this.normalizeText(this.fieldForm.get('fieldType')?.value) ?? '').toLowerCase();
  }

  get showEmailPatternControls(): boolean {
    const fieldType = this.normalizedFieldType;
    return fieldType.includes('inputtext')
      || fieldType.includes('textarea')
      || fieldType.includes('text');
  }

  get showMaskControl(): boolean {
    const fieldType = this.normalizedFieldType;
    return fieldType.includes('inputtext')
      || fieldType.includes('text')
      || fieldType.includes('number')
      || fieldType.includes('integer');
  }

  get showRangeControls(): boolean {
    const fieldType = this.normalizedFieldType;
    const dataType = (this.normalizeText(this.fieldForm.get('dataType')?.value) ?? '').toLowerCase();
    return fieldType.includes('number')
      || fieldType.includes('integer')
      || dataType === 'number';
  }

  get requiresOptionsPayload(): boolean {
    const fieldType = this.normalizedFieldType;
    return fieldType.includes('drop')
      || fieldType.includes('radio')
      || fieldType.includes('select')
      || fieldType.includes('combo');
  }

  onSearch(): void {
    this.loadFields();
  }

  onRefresh(): void {
    this.loadFields();
  }

  onApplicationFilterChange(): void {
    this.loadFields();
  }

  onStatusFilterChange(): void {
    this.loadFields();
  }

  onResetFilters(): void {
    this.searchTerm = '';
    this.statusFilter = 'all';
    this.selectedApplicationFilter = '';
    this.loadFields();
  }

  onSelectField(row: AdminCatalogFieldListItemDto): void {
    this.selectedFieldIdentity = this.composeFieldIdentity(row.applicationId, row.fieldKey);
  }

  onCreateField(): void {
    const preferredApplicationId = this.normalizeText(this.selectedApplicationFilter)
      ?? this.normalizeText(this.applications[0]?.applicationId)
      ?? '';

    this.editingIdentity = null;
    this.dialogVisible = true;
    this.fieldForm.reset({
      applicationId: preferredApplicationId,
      fieldKey: '',
      fieldLabel: '',
      fieldType: this.fieldTypeOptions[0]?.value ?? 'InputText',
      dataType: this.dataTypeOptions[0]?.value ?? 'string',
      isActive: true,
      placeholder: '',
      defaultValue: '',
      width: 0,
      height: 0,
      isDisabledInit: false,
      isSearchable: false,
      required: false,
      requiredTrue: false,
      email: false,
      pattern: false,
      minValue: '',
      maxValue: '',
      mask: '',
      cdmendTbl: '',
      cdmendSql: null
    }, { emitEvent: false });

    this.setIdentityControlsDisabled(false);
    this.applyFieldTypeRules();
    this.validateRange();
  }

  onEditField(row: AdminCatalogFieldListItemDto, event?: Event): void {
    event?.stopPropagation();

    const applicationId = this.normalizeText(row.applicationId);
    const fieldKey = this.normalizeText(row.fieldKey);
    if (!applicationId || !fieldKey || this.loadingFieldDetails) {
      return;
    }

    this.loadingFieldDetails = true;
    this.adminCatalogController.getField(applicationId, fieldKey).subscribe({
      next: response => {
        if (!this.ensureSuccess(response, 'تعذر تحميل تفاصيل الحقل.')) {
          return;
        }

        const details = response.data;
        if (!details) {
          this.showMessage('error', 'لم يتم العثور على تفاصيل الحقل المطلوب.');
          return;
        }

        this.editingIdentity = { applicationId, fieldKey };
        this.dialogVisible = true;
        this.fieldForm.reset({
          applicationId: details.applicationId,
          fieldKey: details.fieldKey,
          fieldLabel: details.fieldLabel,
          fieldType: details.fieldType,
          dataType: details.dataType ?? '',
          isActive: details.isActive,
          placeholder: details.placeholder ?? '',
          defaultValue: details.defaultValue ?? '',
          width: this.toNonNegativeInt(details.width),
          height: this.toNonNegativeInt(details.height),
          isDisabledInit: details.isDisabledInit,
          isSearchable: details.isSearchable,
          required: details.required,
          requiredTrue: details.requiredTrue,
          email: details.email,
          pattern: details.pattern,
          minValue: details.minValue ?? '',
          maxValue: details.maxValue ?? '',
          mask: details.mask ?? '',
          cdmendTbl: details.cdmendTbl ?? '',
          cdmendSql: details.cdmendSql
        }, { emitEvent: false });

        this.setIdentityControlsDisabled(true);
        this.applyFieldTypeRules();
        this.validateRange();
      },
      error: () => {
        this.showMessage('error', 'حدث خطأ أثناء تحميل تفاصيل الحقل.');
      },
      complete: () => {
        this.loadingFieldDetails = false;
      }
    });
  }

  onDeleteField(row: AdminCatalogFieldListItemDto, event: Event): void {
    event.stopPropagation();

    const applicationId = this.normalizeText(row.applicationId);
    const fieldKey = this.normalizeText(row.fieldKey);
    if (!applicationId || !fieldKey) {
      return;
    }

    const identity = this.composeFieldIdentity(applicationId, fieldKey);
    if (this.deletingFieldIdentity === identity) {
      return;
    }

    this.deletingFieldIdentity = identity;
    this.adminCatalogController.diagnoseFieldDelete(applicationId, fieldKey).subscribe({
      next: response => {
        if (!this.ensureSuccess(response, 'تعذر تشخيص حذف الحقل.')) {
          this.deletingFieldIdentity = null;
          return;
        }

        const diagnostics = response.data;
        if (!diagnostics) {
          this.showMessage('error', 'تعذر قراءة نتيجة تشخيص الحذف.');
          this.deletingFieldIdentity = null;
          return;
        }

        const confirmationMessage = this.buildFieldDeleteConfirmationMessage(diagnostics);
        if (!window.confirm(confirmationMessage)) {
          this.deletingFieldIdentity = null;
          return;
        }

        this.adminCatalogController.deleteField(applicationId, fieldKey).subscribe({
          next: deleteResponse => {
            if (!this.ensureSuccess(deleteResponse, 'تعذر حذف الحقل.')) {
              return;
            }

            this.handleDeleteResult(deleteResponse.data);
            this.hasCrudMutation = true;
            this.pendingPersistenceRefresh = true;
            this.loadFields();
          },
          error: () => {
            this.showMessage('error', 'حدث خطأ أثناء حذف الحقل.');
          },
          complete: () => {
            this.deletingFieldIdentity = null;
          }
        });
      },
      error: () => {
        this.showMessage('error', 'حدث خطأ أثناء تشخيص حذف الحقل.');
        this.deletingFieldIdentity = null;
      }
    });
  }

  onSaveField(): void {
    this.fieldForm.markAllAsTouched();
    this.applyFieldTypeRules();
    this.validateRange();

    if (!this.canSaveField) {
      return;
    }

    const raw = this.fieldForm.getRawValue();
    const applicationId = this.normalizeText(raw.applicationId)!;
    const fieldKey = this.normalizeText(raw.fieldKey)!;

    this.savingField = true;

    if (this.isEditMode) {
      const updateRequest = this.toUpdateRequest();
      this.adminCatalogController.updateField(applicationId, fieldKey, updateRequest).subscribe({
        next: response => {
          if (!this.ensureSuccess(response, 'تعذر حفظ تعديل الحقل.')) {
            return;
          }

          const savedField = response.data;
          this.dialogVisible = false;
          this.showMessage('success', 'تم تعديل الحقل بنجاح.');
          this.hasCrudMutation = true;
          this.pendingPersistenceRefresh = true;

          if (savedField) {
            this.selectedFieldIdentity = this.composeFieldIdentity(savedField.applicationId, savedField.fieldKey);
          }

          this.loadFields();
        },
        error: () => {
          this.showMessage('error', 'حدث خطأ أثناء تعديل الحقل.');
        },
        complete: () => {
          this.savingField = false;
        }
      });

      return;
    }

    const createRequest = this.toCreateRequest();
    this.adminCatalogController.createField(createRequest).subscribe({
      next: response => {
        if (!this.ensureSuccess(response, 'تعذر إنشاء الحقل.')) {
          return;
        }

        const savedField = response.data;
        this.dialogVisible = false;
        this.showMessage('success', 'تم إنشاء الحقل بنجاح.');
        this.hasCrudMutation = true;
        this.pendingPersistenceRefresh = true;

        if (savedField) {
          this.selectedFieldIdentity = this.composeFieldIdentity(savedField.applicationId, savedField.fieldKey);
        }

        this.loadFields();
      },
      error: () => {
        this.showMessage('error', 'حدث خطأ أثناء إنشاء الحقل.');
      },
      complete: () => {
        this.savingField = false;
      }
    });
  }

  isInvalid(controlName: string): boolean {
    const control = this.fieldForm.get(controlName);
    return !!control && control.invalid && (control.touched || control.dirty);
  }

  validationMessage(controlName: string, label: string): string {
    const control = this.fieldForm.get(controlName);
    if (!control?.errors) {
      return '';
    }

    if (control.errors['required']) {
      return `${label} مطلوب.`;
    }

    if (control.errors['maxlength']) {
      return `${label} يجب ألا يزيد عن ${control.errors['maxlength'].requiredLength} حرفًا.`;
    }

    if (control.errors['min']) {
      return `${label} يجب أن يكون ${control.errors['min'].min} أو أكبر.`;
    }

    if (control.errors['max']) {
      return `${label} يجب أن يكون ${control.errors['max'].max} أو أقل.`;
    }

    return `${label} غير صالح.`;
  }

  trackByField(_index: number, item: AdminCatalogFieldListItemDto): string {
    return this.composeFieldIdentity(item.applicationId, item.fieldKey);
  }

  composeFieldIdentity(applicationId: string, fieldKey: string): string {
    return `${applicationId}::${fieldKey}`;
  }

  private loadBootstrapData(): void {
    this.loadingBootstrap = true;

    forkJoin({
      applications: this.adminCatalogController.getApplications(),
      lookups: this.adminCatalogController.getFieldLookups()
    }).subscribe({
      next: result => {
        if (!this.ensureSuccess(result.applications, 'تعذر تحميل التطبيقات.')) {
          this.applications = [];
          this.applicationFilterOptions = [{ label: 'كل التطبيقات', value: '' }];
        } else {
          this.applications = [...(result.applications.data ?? [])];
          this.loadedApplications = true;
          this.buildApplicationFilterOptions();
        }

        if (!this.ensureSuccess(result.lookups, 'تعذر تحميل القيم المرجعية للحقول.')) {
          this.fieldTypeOptions = this.fallbackFieldTypeOptions();
          this.dataTypeOptions = this.fallbackDataTypeOptions();
        } else {
          this.loadedLookups = true;
          this.applyLookups(result.lookups.data);
        }

        this.loadFields();
      },
      error: () => {
        this.showMessage('error', 'حدث خطأ أثناء تحميل البيانات الأساسية لمرحلة مكتبة الحقول.');
      },
      complete: () => {
        this.loadingBootstrap = false;
      }
    });
  }

  private loadFields(): void {
    this.loadingFields = true;

    const appId = this.normalizeText(this.selectedApplicationFilter) ?? undefined;
    const search = this.normalizeText(this.searchTerm) ?? undefined;

    this.adminCatalogController.getFieldLibrary(appId, search, this.statusFilter).subscribe({
      next: response => {
        if (!this.ensureSuccess(response, 'تعذر تحميل مكتبة الحقول من جدول CDMend.')) {
          this.fields = [];
          return;
        }

        this.fields = [...(response.data ?? [])];
        this.loadedFields = true;

        if (this.pendingPersistenceRefresh) {
          this.persistenceVerified = true;
          this.pendingPersistenceRefresh = false;
        }
      },
      error: () => {
        this.fields = [];
        this.showMessage('error', 'حدث خطأ أثناء تحميل مكتبة الحقول.');
      },
      complete: () => {
        this.loadingFields = false;
      }
    });
  }

  private applyLookups(lookups: AdminCatalogFieldLookupsDto | undefined): void {
    const fieldTypes = [...(lookups?.fieldTypes ?? [])]
      .map(item => this.normalizeText(item))
      .filter((item): item is string => item != null);

    const dataTypes = [...(lookups?.dataTypes ?? [])]
      .map(item => this.normalizeText(item))
      .filter((item): item is string => item != null);

    this.fieldTypeOptions = (fieldTypes.length > 0 ? fieldTypes : this.fallbackFieldTypeOptions().map(item => item.value))
      .map(item => ({ label: item, value: item }));

    this.dataTypeOptions = (dataTypes.length > 0 ? dataTypes : this.fallbackDataTypeOptions().map(item => item.value))
      .map(item => ({ label: item, value: item }));
  }

  private fallbackFieldTypeOptions(): SelectOption[] {
    return [
      { label: 'InputText', value: 'InputText' },
      { label: 'Textarea', value: 'Textarea' },
      { label: 'Dropdown', value: 'Dropdown' },
      { label: 'DropdownTree', value: 'DropdownTree' },
      { label: 'RadioButton', value: 'RadioButton' },
      { label: 'Date', value: 'Date' },
      { label: 'DateTime', value: 'DateTime' },
      { label: 'ToggleSwitch', value: 'ToggleSwitch' },
      { label: 'FileUpload', value: 'FileUpload' },
      { label: 'DomainUser', value: 'DomainUser' },
      { label: 'JsonData', value: 'JsonData' }
    ];
  }

  private fallbackDataTypeOptions(): SelectOption[] {
    return [
      { label: 'string', value: 'string' },
      { label: 'number', value: 'number' },
      { label: 'date', value: 'date' },
      { label: 'boolean', value: 'boolean' },
      { label: 'json', value: 'json' },
      { label: 'nvarchar', value: 'nvarchar' }
    ];
  }

  private buildApplicationFilterOptions(): void {
    const items = this.applications
      .map(app => ({
        label: `${app.applicationName} (${app.applicationId})`,
        value: app.applicationId
      }))
      .sort((left, right) => left.label.localeCompare(right.label, 'ar'));

    this.applicationFilterOptions = [{ label: 'كل التطبيقات', value: '' }, ...items];
  }

  private validateRange(): void {
    const raw = this.fieldForm.getRawValue();
    const minValue = this.normalizeText(raw.minValue);
    const maxValue = this.normalizeText(raw.maxValue);

    let hasRangeError = false;
    if (minValue != null && maxValue != null) {
      const parsedMin = Number(minValue);
      const parsedMax = Number(maxValue);
      if (Number.isFinite(parsedMin) && Number.isFinite(parsedMax) && parsedMin > parsedMax) {
        hasRangeError = true;
      }
    }

    const currentErrors = { ...(this.fieldForm.errors ?? {}) };
    if (hasRangeError) {
      currentErrors['rangeError'] = true;
    } else {
      delete currentErrors['rangeError'];
    }

    this.fieldForm.setErrors(Object.keys(currentErrors).length > 0 ? currentErrors : null);
  }

  private applyFieldTypeRules(): void {
    const optionsPayloadControl = this.fieldForm.get('cdmendTbl');
    if (!optionsPayloadControl) {
      return;
    }

    if (this.requiresOptionsPayload) {
      optionsPayloadControl.setValidators([Validators.required]);
    } else {
      optionsPayloadControl.clearValidators();
    }

    optionsPayloadControl.updateValueAndValidity({ emitEvent: false });
  }

  private toCreateRequest(): AdminCatalogFieldCreateRequestDto {
    const raw = this.fieldForm.getRawValue();
    return {
      applicationId: this.normalizeText(raw.applicationId)!,
      fieldKey: this.normalizeText(raw.fieldKey)!,
      cdmendSql: this.toPositiveInt(raw.cdmendSql) ?? undefined,
      fieldType: this.normalizeText(raw.fieldType)!,
      fieldLabel: this.normalizeText(raw.fieldLabel) ?? undefined,
      placeholder: this.normalizeText(raw.placeholder) ?? undefined,
      defaultValue: this.normalizeText(raw.defaultValue) ?? undefined,
      cdmendTbl: this.normalizeText(raw.cdmendTbl) ?? undefined,
      dataType: this.normalizeText(raw.dataType) ?? undefined,
      required: raw.required === true,
      requiredTrue: raw.requiredTrue === true,
      email: raw.email === true,
      pattern: raw.pattern === true,
      minValue: this.normalizeText(raw.minValue) ?? undefined,
      maxValue: this.normalizeText(raw.maxValue) ?? undefined,
      mask: this.normalizeText(raw.mask) ?? undefined,
      isActive: raw.isActive === true,
      width: this.toNonNegativeInt(raw.width),
      height: this.toNonNegativeInt(raw.height),
      isDisabledInit: raw.isDisabledInit === true,
      isSearchable: raw.isSearchable === true
    };
  }

  private toUpdateRequest(): AdminCatalogFieldUpdateRequestDto {
    const raw = this.fieldForm.getRawValue();
    return {
      cdmendSql: this.toPositiveInt(raw.cdmendSql) ?? undefined,
      fieldType: this.normalizeText(raw.fieldType)!,
      fieldLabel: this.normalizeText(raw.fieldLabel) ?? undefined,
      placeholder: this.normalizeText(raw.placeholder) ?? undefined,
      defaultValue: this.normalizeText(raw.defaultValue) ?? undefined,
      cdmendTbl: this.normalizeText(raw.cdmendTbl) ?? undefined,
      dataType: this.normalizeText(raw.dataType) ?? undefined,
      required: raw.required === true,
      requiredTrue: raw.requiredTrue === true,
      email: raw.email === true,
      pattern: raw.pattern === true,
      minValue: this.normalizeText(raw.minValue) ?? undefined,
      maxValue: this.normalizeText(raw.maxValue) ?? undefined,
      mask: this.normalizeText(raw.mask) ?? undefined,
      isActive: raw.isActive === true,
      width: this.toNonNegativeInt(raw.width),
      height: this.toNonNegativeInt(raw.height),
      isDisabledInit: raw.isDisabledInit === true,
      isSearchable: raw.isSearchable === true
    };
  }

  private buildFieldDeleteConfirmationMessage(diagnostics: AdminCatalogFieldDeleteDiagnosticsDto): string {
    const mode = diagnostics.canHardDelete ? 'حذف نهائي (Hard Delete)' : 'حذف منطقي (Soft Delete)';
    return [
      `سيتم تنفيذ: ${mode}`,
      `الحقل: ${diagnostics.fieldKey}`,
      `التطبيق: ${diagnostics.applicationId}`,
      `روابط CdCategoryMand (إجمالي): ${diagnostics.linkedCategoriesCount}`,
      `روابط CdCategoryMand (فعالة): ${diagnostics.linkedActiveCategoriesCount}`,
      `روابط SubjectCategoryFieldSettings: ${diagnostics.linkedSettingsCount}`,
      `استخدامات تاريخية (FildKind): ${diagnostics.linkedHistoryByKeyCount}`,
      `استخدامات تاريخية (FildSql): ${diagnostics.linkedHistoryBySqlCount}`,
      diagnostics.decisionReason ?? '',
      'هل تريد المتابعة؟'
    ].filter(line => line.trim().length > 0).join('\n');
  }

  private handleDeleteResult(result: AdminCatalogDeleteResultDto | undefined): void {
    const message = this.normalizeText(result?.message)
      ?? (result?.mode === 'soft' ? 'تم الحذف المنطقي للحقل بنجاح.' : 'تم حذف الحقل نهائيًا بنجاح.');

    this.showMessage('success', message);
  }

  private setIdentityControlsDisabled(disabled: boolean): void {
    const applicationControl = this.fieldForm.get('applicationId');
    const fieldKeyControl = this.fieldForm.get('fieldKey');

    if (disabled) {
      applicationControl?.disable({ emitEvent: false });
      fieldKeyControl?.disable({ emitEvent: false });
      return;
    }

    applicationControl?.enable({ emitEvent: false });
    fieldKeyControl?.enable({ emitEvent: false });
  }

  private ensureSuccess<T>(response: CommonResponse<T>, fallbackMessage: string): boolean {
    if (response?.isSuccess) {
      return true;
    }

    this.showMessage('error', this.readResponseError(response, fallbackMessage));
    return false;
  }

  private readResponseError<T>(response: CommonResponse<T> | null | undefined, fallbackMessage: string): string {
    const errorMessage = response?.errors?.find(item => this.normalizeText(item?.message) != null)?.message;
    return this.normalizeText(errorMessage) ?? fallbackMessage;
  }

  private showMessage(severity: MessageSeverity, message: string): void {
    this.messageSeverity = severity;
    this.message = message;
  }

  private normalizeText(value: unknown): string | null {
    const normalized = String(value ?? '').trim();
    return normalized.length > 0 ? normalized : null;
  }

  private toNonNegativeInt(value: unknown): number {
    const candidate = Number(value ?? 0);
    if (!Number.isFinite(candidate) || candidate < 0) {
      return 0;
    }

    return Math.trunc(candidate);
  }

  private toPositiveInt(value: unknown): number | null {
    const candidate = Number(value ?? 0);
    if (!Number.isFinite(candidate) || candidate <= 0) {
      return null;
    }

    return Math.trunc(candidate);
  }
}
