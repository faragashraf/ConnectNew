import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { forkJoin, Subscription } from 'rxjs';
import {
  CommonResponse,
  SubjectCategoryFieldLinkAdminDto,
  SubjectCategoryFieldLinkUpsertItemDto
} from 'src/app/shared/services/BackendServices/DynamicSubjects/DynamicSubjects.dto';
import { DynamicSubjectsController } from 'src/app/shared/services/BackendServices/DynamicSubjects/DynamicSubjects.service';
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

type AdvancedDataRow = {
  rowId: number;
  key: string;
  value: string;
};

type ApiDynamicAuthMode = 'none' | 'bearerCurrent' | 'token' | 'basic';
type ApiDynamicSourceType = 'powerbi' | 'external';
type ApiDynamicTrigger = 'init' | 'change' | 'blur';
type ApiDynamicHttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH';
type FieldEditorOpenOptions = {
  showFieldDialog?: boolean;
  openApiSettingsDialog?: boolean;
};

@Component({
  selector: 'app-admin-control-center-catalog-field-library-page',
  templateUrl: './admin-control-center-catalog-field-library-page.component.html',
  styleUrls: ['./admin-control-center-catalog-field-library-page.component.scss']
})
export class AdminControlCenterCatalogFieldLibraryPageComponent implements OnInit, OnDestroy {
  private static readonly CATALOG_CONTEXT_STORAGE_KEY = 'connect:control-center-catalog:context:v1';

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
  readonly apiSettingsForm: FormGroup = this.fb.group({
    sourceType: ['powerbi', [Validators.required]],
    trigger: ['change', [Validators.required]],
    requestFormat: ['json', [Validators.required, Validators.maxLength(20)]],
    statementId: [null],
    fullUrl: ['', [Validators.maxLength(500)]],
    method: ['GET', [Validators.required]],
    responseListPath: ['data', [Validators.required, Validators.maxLength(200)]],
    responseValuePath: ['id', [Validators.required, Validators.maxLength(200)]],
    responseLabelPath: ['name', [Validators.required, Validators.maxLength(200)]],
    authMode: ['none', [Validators.required]],
    tokenValue: ['', [Validators.maxLength(4000)]],
    username: ['', [Validators.maxLength(200)]],
    password: ['', [Validators.maxLength(200)]]
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

  private readonly fieldTypeLabelLookup: Readonly<Record<string, string>> = {
    inputtext: 'نص قصير',
    textarea: 'نص طويل',
    dropdown: 'قائمة اختيار',
    dropdowntree: 'شجرة اختيار',
    radiobutton: 'اختيار منفرد',
    date: 'تاريخ',
    datetime: 'تاريخ ووقت',
    toggleswitch: 'مفتاح تبديل',
    fileupload: 'رفع ملف',
    domainuser: 'مستخدم نطاق',
    jsondata: 'بيانات JSON'
  };

  private readonly dataTypeLabelLookup: Readonly<Record<string, string>> = {
    string: 'نص',
    number: 'رقم',
    date: 'تاريخ',
    boolean: 'منطقي',
    json: 'بيانات JSON',
    nvarchar: 'نص ممتد'
  };

  selectedApplicationFilter = '';
  statusFilter: AdminCatalogFieldStatusFilter = 'all';
  searchTerm = '';
  contextCategoryId: number | null = null;
  contextApplicationId: string | null = null;

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

  advancedDataRows: AdvancedDataRow[] = [];
  advancedDataRowsTouched = false;
  advancedDataParseMessage = '';
  advancedDataRawJsonDraft = '';
  apiSettingsDialogVisible = false;
  apiSettingsLoading = false;
  apiSettingsSaving = false;
  apiSettingsTouched = false;
  apiSettingsRuntimeJsonDraft = '';
  apiSettingsMessage = '';
  readonly apiSettingsSourceTypeOptions: Array<{ label: string; value: ApiDynamicSourceType }> = [
    { label: 'داخلي (Power BI)', value: 'powerbi' },
    { label: 'خارجي (External API)', value: 'external' }
  ];
  readonly apiSettingsTriggerOptions: Array<{ label: string; value: ApiDynamicTrigger }> = [
    { label: 'عند التغيير', value: 'change' },
    { label: 'عند التهيئة', value: 'init' },
    { label: 'عند فقدان التركيز', value: 'blur' }
  ];
  readonly apiSettingsHttpMethodOptions: Array<{ label: string; value: ApiDynamicHttpMethod }> = [
    { label: 'GET', value: 'GET' },
    { label: 'POST', value: 'POST' },
    { label: 'PUT', value: 'PUT' },
    { label: 'PATCH', value: 'PATCH' }
  ];
  readonly apiSettingsAuthModeOptions: Array<{ label: string; value: ApiDynamicAuthMode }> = [
    { label: 'بدون مصادقة', value: 'none' },
    { label: 'Bearer الحالي', value: 'bearerCurrent' },
    { label: 'Token ثابت', value: 'token' },
    { label: 'Basic Authentication', value: 'basic' }
  ];

  private advancedDataRowSeed = 0;
  private readonly apiSettingsUrlPattern = /^https?:\/\/.+/i;
  private apiSettingsRuntimeExtraSections: Record<string, unknown> = {};
  private apiSettingsOptionLoaderBase: Record<string, unknown> = {};
  private apiSettingsIntegrationBase: Record<string, unknown> = {};
  private apiSettingsAuthBase: Record<string, unknown> = {};
  private apiSettingsLastEditedSource: 'form' | 'json' | null = null;
  private pendingPersistenceRefresh = false;
  private pendingRouteEditFieldKey: string | null = null;
  private pendingRouteEditApplicationId: string | null = null;
  private pendingRouteOpenFieldEditor = false;
  private pendingRouteOpenApiSettings = false;
  private readonly subscriptions = new Subscription();

  constructor(
    private readonly fb: FormBuilder,
    private readonly route: ActivatedRoute,
    private readonly adminCatalogController: DynamicSubjectsAdminCatalogController,
    private readonly dynamicSubjectsController: DynamicSubjectsController
  ) {}

  ngOnInit(): void {
    this.subscriptions.add(
      this.route.queryParamMap.subscribe(params => {
        const routeCategoryId = this.readCategoryIdFromParams(params);
        const routeApplicationId = this.readApplicationIdFromParams(params);
        const routeEditFieldKey = this.readEditFieldKeyFromParams(params);
        const routeEditApplicationId = this.readEditApplicationIdFromParams(params);
        const routeOpenFieldEditor = this.readOpenFieldEditorFromParams(params);
        const routeOpenApiSettings = this.readOpenApiSettingsFromParams(params);
        const cachedContext = this.readCatalogContextCache();

        this.contextCategoryId = routeCategoryId ?? cachedContext.categoryId;
        this.contextApplicationId = routeApplicationId ?? cachedContext.applicationId;
        this.persistCatalogContextCache(this.contextCategoryId, this.contextApplicationId);
        this.pendingRouteEditFieldKey = routeEditFieldKey;
        this.pendingRouteEditApplicationId = routeEditApplicationId
          ?? routeApplicationId
          ?? cachedContext.applicationId;
        this.pendingRouteOpenFieldEditor = routeOpenFieldEditor;
        this.pendingRouteOpenApiSettings = routeOpenApiSettings;

        if (!this.normalizeText(this.selectedApplicationFilter) && this.contextApplicationId) {
          this.selectedApplicationFilter = this.contextApplicationId;
        }

        this.tryOpenPendingRouteFieldEditor();
      })
    );

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

    this.subscriptions.add(
      this.apiSettingsForm.valueChanges.subscribe(() => {
        this.applyApiSettingsFormRules();
        if (!this.apiSettingsLoading && !this.apiSettingsSaving) {
          this.apiSettingsTouched = true;
          this.apiSettingsLastEditedSource = 'form';
        }
      })
    );
    this.applyApiSettingsFormRules();
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
      && !this.fieldForm.hasError('rangeError')
      && !this.hasAdvancedDataValidationError;
  }

  get apiSettingsSourceType(): ApiDynamicSourceType {
    const value = this.normalizeText(this.apiSettingsForm.get('sourceType')?.value)?.toLowerCase();
    return value === 'external' ? 'external' : 'powerbi';
  }

  get apiSettingsAuthModeValue(): ApiDynamicAuthMode {
    const mode = this.normalizeText(this.apiSettingsForm.get('authMode')?.value) ?? 'none';
    return this.normalizeApiAuthMode(mode);
  }

  get canSaveApiSettings(): boolean {
    return !this.apiSettingsSaving
      && !this.apiSettingsLoading
      && this.apiSettingsForm.valid
      && (this.apiSettingsLastEditedSource !== 'json' || this.parseApiRuntimeJsonDraft(this.apiSettingsRuntimeJsonDraft) !== undefined);
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

  get fieldBindingNavigationQueryParams(): Record<string, string | number | null> {
    const selectedAppId = this.normalizeText(this.selectedApplicationFilter);
    const applicationId = selectedAppId ?? this.contextApplicationId;

    return {
      categoryId: this.contextCategoryId ?? null,
      applicationId: applicationId ?? null
    };
  }

  get canNavigateToFieldBinding(): boolean {
    return this.contextCategoryId != null && this.contextCategoryId > 0;
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

  get hasAdvancedDataValidationError(): boolean {
    return this.advancedDataValidationMessage.length > 0;
  }

  get advancedDataValidationMessage(): string {
    const normalizedRows = this.normalizeAdvancedDataRows(this.advancedDataRows);
    const hasAnyContent = normalizedRows.some(row => row.key.length > 0 || row.value.length > 0);

    if (!this.requiresOptionsPayload && !hasAnyContent) {
      return '';
    }

    if (!hasAnyContent) {
      return 'يجب إدخال صف واحد على الأقل في بيانات CDMendTbl.';
    }

    const invalidRowIndex = normalizedRows.findIndex(row => row.key.length === 0 || row.value.length === 0);
    if (invalidRowIndex >= 0) {
      return `الصف رقم ${invalidRowIndex + 1} يجب أن يحتوي على مفتاح وقيمة.`;
    }

    const seenKeys = new Set<string>();
    for (const row of normalizedRows) {
      const normalizedKey = row.key.toLowerCase();
      if (seenKeys.has(normalizedKey)) {
        return `لا يمكن تكرار المفتاح '${row.key}'.`;
      }

      seenKeys.add(normalizedKey);
    }

    return '';
  }

  get advancedDataPreviewValue(): string {
    return this.serializeAdvancedDataRows(this.advancedDataRows) ?? '';
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

    this.hydrateAdvancedDataEditor('');
    this.setIdentityControlsDisabled(false);
    this.applyFieldTypeRules();
    this.validateRange();
    this.resetApiSettingsEditorState();
  }

  onEditField(row: AdminCatalogFieldListItemDto, event?: Event): void {
    event?.stopPropagation();

    const applicationId = this.normalizeText(row.applicationId);
    const fieldKey = this.normalizeText(row.fieldKey);
    if (!applicationId || !fieldKey) {
      return;
    }

    this.openFieldEditor(applicationId, fieldKey, { showFieldDialog: true, openApiSettingsDialog: false });
  }

  onEditFieldApiSettings(row: AdminCatalogFieldListItemDto, event?: Event): void {
    event?.stopPropagation();

    if (!this.canOpenApiSettingsForFieldType(row?.fieldType)) {
      this.showMessage('warn', 'إعدادات API متاحة فقط لحقول Dropdown و RadioButton و DropdownTree.');
      return;
    }

    const applicationId = this.normalizeText(row.applicationId);
    const fieldKey = this.normalizeText(row.fieldKey);
    if (!applicationId || !fieldKey) {
      return;
    }

    this.openFieldEditor(applicationId, fieldKey, { showFieldDialog: false, openApiSettingsDialog: true });
  }

  private openFieldEditor(applicationId: string, fieldKey: string, options?: FieldEditorOpenOptions): void {
    if (this.loadingFieldDetails) {
      return;
    }

    const showFieldDialog = options?.showFieldDialog !== false;
    const openApiSettingsDialog = options?.openApiSettingsDialog === true;

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
        this.dialogVisible = showFieldDialog;
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

        this.hydrateAdvancedDataEditor(details.cdmendTbl ?? '');
        this.setIdentityControlsDisabled(true);
        this.applyFieldTypeRules();
        this.validateRange();

        if (openApiSettingsDialog) {
          this.onOpenApiSettingsDialog();
        }
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
    this.syncAdvancedDataControl();
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
          this.resetApiSettingsEditorState();

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
        this.resetApiSettingsEditorState();

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

  isApiSettingsInvalid(controlName: string): boolean {
    const control = this.apiSettingsForm.get(controlName);
    return !!control && control.invalid && (control.touched || control.dirty);
  }

  apiSettingsValidationMessage(controlName: string, label: string): string {
    const control = this.apiSettingsForm.get(controlName);
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

    if (control.errors['pattern']) {
      return `${label} غير صالح.`;
    }

    return `${label} غير صالح.`;
  }

  trackByField(_index: number, item: AdminCatalogFieldListItemDto): string {
    return this.composeFieldIdentity(item.applicationId, item.fieldKey);
  }

  trackByAdvancedDataRow(_index: number, row: AdvancedDataRow): number {
    return row.rowId;
  }

  onAddAdvancedDataRow(): void {
    this.advancedDataRows = [...this.advancedDataRows, this.createAdvancedDataRow('', '')];
    this.advancedDataRowsTouched = true;
    this.advancedDataParseMessage = '';
    this.syncAdvancedDataControl();
    this.syncAdvancedDataRawJsonDraftFromRows();
    this.applyFieldTypeRules();
  }

  onRemoveAdvancedDataRow(index: number): void {
    if (index < 0 || index >= this.advancedDataRows.length) {
      return;
    }

    this.advancedDataRows = this.advancedDataRows.filter((_item, currentIndex) => currentIndex !== index);
    this.ensureAtLeastOneAdvancedDataRow();
    this.advancedDataRowsTouched = true;
    this.advancedDataParseMessage = '';
    this.syncAdvancedDataControl();
    this.syncAdvancedDataRawJsonDraftFromRows();
    this.applyFieldTypeRules();
  }

  onAdvancedDataRowsChanged(): void {
    this.advancedDataRowsTouched = true;
    this.advancedDataParseMessage = '';
    this.syncAdvancedDataControl();
    this.syncAdvancedDataRawJsonDraftFromRows();
    this.applyFieldTypeRules();
  }

  onAdvancedDataRawJsonChanged(value: string): void {
    this.advancedDataRawJsonDraft = String(value ?? '');
  }

  onApplyAdvancedDataRawJson(): void {
    this.hydrateAdvancedDataEditor(this.advancedDataRawJsonDraft);
    this.advancedDataRowsTouched = true;
    this.syncAdvancedDataControl();
    this.syncAdvancedDataRawJsonDraftFromRows();
    this.applyFieldTypeRules();
  }

  onResetAdvancedDataRawJsonFromRows(): void {
    this.syncAdvancedDataRawJsonDraftFromRows();
  }

  onOpenApiSettingsDialog(): void {
    if (!this.isEditMode || !this.editingIdentity) {
      this.showMessage('warn', 'افتح الحقل في وضع التعديل أولًا ثم ادخل على إعدادات API.');
      return;
    }

    if (!this.canOpenApiSettingsForFieldType(this.fieldForm.get('fieldType')?.value)) {
      this.showMessage('warn', 'إعدادات API متاحة فقط لحقول Dropdown و RadioButton و DropdownTree.');
      return;
    }

    this.apiSettingsDialogVisible = true;
    this.loadApiSettingsForEditingField();
  }

  onApiSettingsDialogHide(): void {
    this.apiSettingsLoading = false;
    this.apiSettingsSaving = false;
  }

  onApiSettingsRuntimeJsonDraftChanged(value: string): void {
    this.apiSettingsRuntimeJsonDraft = String(value ?? '');
    this.apiSettingsTouched = true;
    this.apiSettingsLastEditedSource = 'json';
  }

  onApplyApiInternalPreset(): void {
    this.applyApiSettingsPreset('powerbi');
    this.apiSettingsMessage = 'تم تجهيز إعدادات API الداخلي. راجع القيم ثم احفظ.';
  }

  onApplyApiExternalPreset(): void {
    this.applyApiSettingsPreset('external');
    this.apiSettingsMessage = 'تم تجهيز إعدادات API الخارجي. راجع القيم ثم احفظ.';
  }

  onGenerateApiRuntimeJsonFromForm(): void {
    this.applyApiSettingsFormRules();
    this.apiSettingsForm.markAllAsTouched();
    if (this.apiSettingsForm.invalid) {
      this.apiSettingsMessage = this.resolveApiSettingsFormValidationMessage()
        ?? 'أكمل الحقول المطلوبة في إعدادات API أولًا.';
      return;
    }

    const runtimePayload = this.buildApiRuntimePayloadFromForm();
    this.apiSettingsRuntimeJsonDraft = JSON.stringify(runtimePayload, null, 2);
    this.apiSettingsTouched = true;
    this.apiSettingsLastEditedSource = 'form';
    this.apiSettingsMessage = 'تم توليد JSON من إعدادات الشاشة بنجاح.';
  }

  onApplyApiRuntimeJsonToForm(): void {
    const parsedPayload = this.parseApiRuntimeJsonDraft(this.apiSettingsRuntimeJsonDraft);
    if (parsedPayload === undefined) {
      this.apiSettingsMessage = 'تعذر تطبيق JSON لأن الصيغة غير صحيحة.';
      return;
    }

    if (parsedPayload == null) {
      this.resetApiSettingsFormDefaults();
      this.apiSettingsMessage = 'تم مسح JSON وإعادة الإعدادات الافتراضية.';
      this.apiSettingsTouched = true;
      this.apiSettingsLastEditedSource = 'json';
      return;
    }

    const runtimePayload = this.resolveRuntimePayloadForEditor(parsedPayload);
    if (!runtimePayload) {
      this.apiSettingsMessage = 'JSON الحالي لا يحتوي إعدادات optionLoader قابلة للتحويل إلى شاشة الإعدادات.';
      return;
    }

    this.applyApiRuntimePayloadToForm(runtimePayload);
    this.apiSettingsTouched = true;
    this.apiSettingsLastEditedSource = 'json';
    this.apiSettingsMessage = 'تم تحليل JSON وتحديث حقول الإعدادات بنجاح.';
  }

  onSaveApiSettingsToCategoryLink(): void {
    if (!this.isEditMode || !this.editingIdentity) {
      this.apiSettingsMessage = 'لا يمكن حفظ إعدادات API إلا بعد فتح الحقل في وضع التعديل.';
      return;
    }

    const categoryId = this.toPositiveInt(this.contextCategoryId);
    if (!categoryId) {
      this.apiSettingsMessage = 'تعذر الحفظ: يجب فتح الشاشة بسياق تصنيف صالح (categoryId).';
      return;
    }

    if (this.apiSettingsLastEditedSource === 'json') {
      const parsedPayload = this.parseApiRuntimeJsonDraft(this.apiSettingsRuntimeJsonDraft);
      if (parsedPayload === undefined) {
        this.apiSettingsMessage = 'تعذر حفظ إعدادات API لأن JSON غير صالح. راجع الصيغة ثم حاول مرة أخرى.';
        return;
      }

      if (parsedPayload != null) {
        const runtimePayloadForForm = this.resolveRuntimePayloadForEditor(parsedPayload);
        if (!runtimePayloadForForm) {
          this.apiSettingsMessage = 'JSON الحالي لا يحتوي إعدادات optionLoader صالحة للحفظ.';
          return;
        }

        this.applyApiRuntimePayloadToForm(runtimePayloadForForm);
      }
    }

    this.applyApiSettingsFormRules();
    this.apiSettingsForm.markAllAsTouched();
    if (this.apiSettingsForm.invalid) {
      this.apiSettingsMessage = this.resolveApiSettingsFormValidationMessage()
        ?? 'أكمل الحقول المطلوبة في إعدادات API أولًا.';
      return;
    }

    const runtimePayload = this.buildApiRuntimePayloadFromForm();
    this.apiSettingsRuntimeJsonDraft = JSON.stringify(runtimePayload, null, 2);
    this.apiSettingsLastEditedSource = 'form';
    this.apiSettingsSaving = true;
    this.dynamicSubjectsController.getAdminCategoryFieldLinks(categoryId).subscribe({
      next: response => {
        if (!response?.isSuccess) {
          this.apiSettingsMessage = this.readResponseError(response, 'تعذر تحميل روابط الحقول لحفظ إعدادات API.');
          this.apiSettingsSaving = false;
          return;
        }

        const links = [...(response.data ?? [])];
        const targetLink = this.findEditingFieldLink(links);
        if (!targetLink) {
          this.apiSettingsMessage = 'الحقل غير مربوط حاليًا بهذا التصنيف، لذلك لا يمكن حفظ إعدادات API له.';
          this.apiSettingsSaving = false;
          return;
        }

        const payloadLinks: SubjectCategoryFieldLinkUpsertItemDto[] = links
          .map(link => this.toCategoryLinkUpsertItem(link, targetLink, runtimePayload))
          .filter((item): item is SubjectCategoryFieldLinkUpsertItemDto => item != null);
        if (payloadLinks.length === 0) {
          this.apiSettingsMessage = 'تعذر حفظ إعدادات API لأن روابط الحقول الحالية غير صالحة.';
          this.apiSettingsSaving = false;
          return;
        }

        const normalizedPayloadLinks = this.normalizeCategoryLinkDisplayOrders(payloadLinks);

        this.dynamicSubjectsController.upsertAdminCategoryFieldLinks(categoryId, { links: normalizedPayloadLinks }).subscribe({
          next: saveResponse => {
            if (!saveResponse?.isSuccess) {
              this.apiSettingsMessage = this.readResponseError(saveResponse, 'تعذر حفظ إعدادات API للحقل.');
              return;
            }

            this.apiSettingsTouched = false;
            this.apiSettingsLastEditedSource = null;
            this.apiSettingsMessage = 'تم حفظ إعدادات API للحقل بنجاح.';
            this.showMessage('success', 'تم حفظ إعدادات API للحقل المرتبط بالتصنيف بنجاح.');
          },
          error: () => {
            this.apiSettingsMessage = 'حدث خطأ أثناء حفظ إعدادات API للحقل.';
          },
          complete: () => {
            this.apiSettingsSaving = false;
          }
        });
      },
      error: () => {
        this.apiSettingsMessage = 'حدث خطأ أثناء تحميل روابط التصنيف لحفظ إعدادات API.';
        this.apiSettingsSaving = false;
      }
    });
  }

  private loadApiSettingsForEditingField(): void {
    this.apiSettingsMessage = '';
    this.apiSettingsTouched = false;
    this.apiSettingsLastEditedSource = null;
    this.resetApiSettingsFormDefaults();

    if (!this.isEditMode || !this.editingIdentity) {
      this.apiSettingsRuntimeJsonDraft = '';
      return;
    }

    const categoryId = this.toPositiveInt(this.contextCategoryId);
    if (!categoryId) {
      this.apiSettingsRuntimeJsonDraft = '';
      this.apiSettingsMessage = 'لا يوجد categoryId صالح. يمكن تجهيز JSON لكن الحفظ على التصنيف لن يعمل.';
      return;
    }

    this.apiSettingsLoading = true;
    this.dynamicSubjectsController.getAdminCategoryFieldLinks(categoryId).subscribe({
      next: response => {
        if (!response?.isSuccess) {
          this.apiSettingsRuntimeJsonDraft = '';
          this.apiSettingsMessage = this.readResponseError(response, 'تعذر تحميل إعدادات API الحالية لهذا الحقل.');
          return;
        }

        const links = response.data ?? [];
        const targetLink = this.findEditingFieldLink(links);
        if (!targetLink) {
          this.apiSettingsRuntimeJsonDraft = '';
          this.apiSettingsMessage = 'الحقل غير مربوط بهذا التصنيف حاليًا. يمكنك تجهيز JSON الآن وربطه بعد إضافة الحقل في شاشة الربط.';
          return;
        }

        const runtimePayload = this.extractDynamicRuntimePayloadFromDisplaySettings(targetLink.displaySettingsJson);
        if (!runtimePayload) {
          this.apiSettingsRuntimeJsonDraft = '';
          this.apiSettingsMessage = 'لا توجد إعدادات API محفوظة لهذا الحقل حاليًا.';
          return;
        }

        const resolvedRuntimePayload = this.resolveRuntimePayloadForEditor(runtimePayload);
        if (!resolvedRuntimePayload) {
          this.apiSettingsRuntimeJsonDraft = JSON.stringify(runtimePayload, null, 2);
          this.apiSettingsMessage = 'تم تحميل JSON محفوظ لكنه لا يطابق شاشة الإعدادات بالكامل. يمكن تعديله من JSON مباشرة.';
          return;
        }

        this.applyApiRuntimePayloadToForm(resolvedRuntimePayload);
        this.apiSettingsRuntimeJsonDraft = JSON.stringify(resolvedRuntimePayload, null, 2);
        this.apiSettingsLastEditedSource = null;
      },
      error: () => {
        this.apiSettingsRuntimeJsonDraft = '';
        this.apiSettingsMessage = 'حدث خطأ أثناء تحميل إعدادات API الحالية.';
      },
      complete: () => {
        this.apiSettingsLoading = false;
      }
    });
  }

  private toCategoryLinkUpsertItem(
    link: SubjectCategoryFieldLinkAdminDto,
    targetLink: SubjectCategoryFieldLinkAdminDto,
    runtimePayload: Record<string, unknown> | null
  ): SubjectCategoryFieldLinkUpsertItemDto | null {
    const fieldKey = this.normalizeText(link.fieldKey);
    const groupId = this.toPositiveInt(link.groupId);
    if (!fieldKey || !groupId) {
      return null;
    }

    const mendSql = this.toPositiveInt(link.mendSql) ?? undefined;
    const displayOrder = this.toPositiveInt(link.displayOrder) ?? 1;
    const isTarget = Number(link.mendSql ?? 0) === Number(targetLink.mendSql ?? 0)
      || this.isSameText(link.fieldKey, targetLink.fieldKey);
    const displaySettingsJson = isTarget
      ? this.mergeDynamicRuntimeIntoDisplaySettings(link.displaySettingsJson, runtimePayload)
      : (this.normalizeText(link.displaySettingsJson) ?? undefined);

    return {
      mendSql,
      fieldKey,
      groupId,
      isActive: link.isActive === true,
      displayOrder,
      isVisible: link.isVisible === true,
      displaySettingsJson
    };
  }

  private normalizeCategoryLinkDisplayOrders(
    links: SubjectCategoryFieldLinkUpsertItemDto[]
  ): SubjectCategoryFieldLinkUpsertItemDto[] {
    const resolvedDisplayOrders = links.map(item => this.toPositiveInt(item.displayOrder));
    const hasInvalidDisplayOrder = resolvedDisplayOrders.some(value => !value);
    const distinctDisplayOrderCount = new Set(
      resolvedDisplayOrders.filter((value): value is number => !!value)
    ).size;
    const hasDuplicatedDisplayOrder = distinctDisplayOrderCount !== links.length;

    if (!hasInvalidDisplayOrder && !hasDuplicatedDisplayOrder) {
      const stableDisplayOrders = resolvedDisplayOrders as number[];
      return links.map((item, index) => ({
        ...item,
        displayOrder: stableDisplayOrders[index]
      }));
    }

    return [...links]
      .sort((left, right) => {
        const leftDisplayOrder = this.toPositiveInt(left.displayOrder) ?? 1;
        const rightDisplayOrder = this.toPositiveInt(right.displayOrder) ?? 1;
        if (leftDisplayOrder !== rightDisplayOrder) {
          return leftDisplayOrder - rightDisplayOrder;
        }

        const leftMendSql = this.toPositiveInt(left.mendSql) ?? Number.MAX_SAFE_INTEGER;
        const rightMendSql = this.toPositiveInt(right.mendSql) ?? Number.MAX_SAFE_INTEGER;
        if (leftMendSql !== rightMendSql) {
          return leftMendSql - rightMendSql;
        }

        const leftFieldKey = this.normalizeText(left.fieldKey) ?? '';
        const rightFieldKey = this.normalizeText(right.fieldKey) ?? '';
        return leftFieldKey.localeCompare(rightFieldKey, 'en', { sensitivity: 'base' });
      })
      .map((item, index) => ({
        ...item,
        displayOrder: index + 1
      }));
  }

  private findEditingFieldLink(links: SubjectCategoryFieldLinkAdminDto[]): SubjectCategoryFieldLinkAdminDto | null {
    const editing = this.editingIdentity;
    if (!editing) {
      return null;
    }

    const normalizedFieldKey = this.normalizeText(editing.fieldKey);
    if (!normalizedFieldKey) {
      return null;
    }

    const normalizedApplicationId = this.normalizeText(editing.applicationId);
    const directMatch = links.find(item =>
      this.isSameText(item.fieldKey, normalizedFieldKey)
      && (normalizedApplicationId == null
        || this.normalizeText(item.applicationId) == null
        || this.isSameText(item.applicationId, normalizedApplicationId)));

    return directMatch ?? null;
  }

  private parseApiRuntimeJsonDraft(raw: string): Record<string, unknown> | null | undefined {
    const normalized = this.normalizeText(raw);
    if (!normalized) {
      return null;
    }

    try {
      const parsed = JSON.parse(normalized);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return undefined;
      }

      return parsed as Record<string, unknown>;
    } catch {
      return undefined;
    }
  }

  private extractDynamicRuntimePayloadFromDisplaySettings(displaySettingsJson: string | null | undefined): Record<string, unknown> | null {
    const displaySettings = this.parseJsonObject(displaySettingsJson);
    if (!displaySettings) {
      return null;
    }

    if (Object.prototype.hasOwnProperty.call(displaySettings, 'dynamicRuntime')) {
      return this.parseRuntimePayload(displaySettings['dynamicRuntime']);
    }

    if (this.looksLikeRuntimePayload(displaySettings)) {
      return displaySettings;
    }

    return null;
  }

  private parseRuntimePayload(value: unknown): Record<string, unknown> | null {
    if (!value) {
      return null;
    }

    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed as Record<string, unknown>;
        }
      } catch {
        return null;
      }

      return null;
    }

    if (typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }

    return null;
  }

  private looksLikeRuntimePayload(payload: Record<string, unknown>): boolean {
    const optionLoader = payload['optionLoader'];
    const asyncValidation = payload['asyncValidation'];
    const actions = payload['actions'];

    return (optionLoader != null && typeof optionLoader === 'object' && !Array.isArray(optionLoader))
      || (asyncValidation != null && typeof asyncValidation === 'object' && !Array.isArray(asyncValidation))
      || Array.isArray(actions);
  }

  private mergeDynamicRuntimeIntoDisplaySettings(
    currentDisplaySettingsJson: string | null | undefined,
    runtimePayload: Record<string, unknown> | null
  ): string | undefined {
    const displaySettings = this.parseJsonObject(currentDisplaySettingsJson) ?? {};
    if (runtimePayload && Object.keys(runtimePayload).length > 0) {
      displaySettings['dynamicRuntime'] = runtimePayload;
    } else if (Object.prototype.hasOwnProperty.call(displaySettings, 'dynamicRuntime')) {
      delete displaySettings['dynamicRuntime'];
    }

    if (Object.keys(displaySettings).length === 0) {
      return undefined;
    }

    return JSON.stringify(displaySettings);
  }

  private parseJsonObject(payload: string | null | undefined): Record<string, unknown> | null {
    const normalized = this.normalizeText(payload);
    if (!normalized) {
      return null;
    }

    try {
      const parsed = JSON.parse(normalized);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return null;
      }

      return parsed as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  private inferApiAuthMode(runtimePayload: Record<string, unknown>): ApiDynamicAuthMode {
    const optionLoader = this.readObject(runtimePayload['optionLoader']);
    const integration = this.readObject(optionLoader?.['integration']);
    const auth = this.readObject(integration?.['auth']);
    const normalizedMode = String(auth?.['mode'] ?? '');
    return this.normalizeApiAuthMode(normalizedMode);
  }

  private normalizeApiAuthMode(mode: string): ApiDynamicAuthMode {
    const normalizedMode = mode.trim().toLowerCase();
    if (normalizedMode === 'bearercurrent' || normalizedMode === 'bearer_current' || normalizedMode === 'bearer-current') {
      return 'bearerCurrent';
    }

    if (normalizedMode === 'token' || normalizedMode === 'bearertoken' || normalizedMode === 'bearer_token' || normalizedMode === 'bearer-token') {
      return 'token';
    }

    if (normalizedMode === 'basic' || normalizedMode === 'basicauth' || normalizedMode === 'basic_auth' || normalizedMode === 'basic-auth') {
      return 'basic';
    }

    return 'none';
  }

  private applyApiSettingsFormRules(): void {
    const sourceType = this.apiSettingsSourceType;
    const authMode = this.apiSettingsAuthModeValue;

    const statementIdControl = this.apiSettingsForm.get('statementId');
    const fullUrlControl = this.apiSettingsForm.get('fullUrl');
    const tokenValueControl = this.apiSettingsForm.get('tokenValue');
    const usernameControl = this.apiSettingsForm.get('username');
    const passwordControl = this.apiSettingsForm.get('password');

    if (sourceType === 'powerbi') {
      statementIdControl?.setValidators([Validators.required, Validators.min(1)]);
      fullUrlControl?.setValidators([Validators.maxLength(500)]);
    } else {
      statementIdControl?.clearValidators();
      fullUrlControl?.setValidators([Validators.required, Validators.maxLength(500), Validators.pattern(this.apiSettingsUrlPattern)]);
    }

    if (authMode === 'token') {
      tokenValueControl?.setValidators([Validators.required, Validators.maxLength(4000)]);
      usernameControl?.setValidators([Validators.maxLength(200)]);
      passwordControl?.setValidators([Validators.maxLength(200)]);
    } else if (authMode === 'basic') {
      tokenValueControl?.setValidators([Validators.maxLength(4000)]);
      usernameControl?.setValidators([Validators.required, Validators.maxLength(200)]);
      passwordControl?.setValidators([Validators.required, Validators.maxLength(200)]);
    } else {
      tokenValueControl?.setValidators([Validators.maxLength(4000)]);
      usernameControl?.setValidators([Validators.maxLength(200)]);
      passwordControl?.setValidators([Validators.maxLength(200)]);
    }

    statementIdControl?.updateValueAndValidity({ emitEvent: false });
    fullUrlControl?.updateValueAndValidity({ emitEvent: false });
    tokenValueControl?.updateValueAndValidity({ emitEvent: false });
    usernameControl?.updateValueAndValidity({ emitEvent: false });
    passwordControl?.updateValueAndValidity({ emitEvent: false });
  }

  private applyApiSettingsPreset(sourceType: ApiDynamicSourceType): void {
    const currentAuthMode = this.apiSettingsAuthModeValue;
    const currentStatementId = this.toPositiveInt(this.apiSettingsForm.get('statementId')?.value) ?? 65;
    const currentMethod = this.normalizeText(this.apiSettingsForm.get('method')?.value)?.toUpperCase() ?? 'GET';
    const safeMethod: ApiDynamicHttpMethod = ['GET', 'POST', 'PUT', 'PATCH'].includes(currentMethod)
      ? currentMethod as ApiDynamicHttpMethod
      : 'GET';

    this.apiSettingsForm.patchValue({
      sourceType,
      trigger: 'change',
      requestFormat: 'json',
      statementId: sourceType === 'powerbi' ? currentStatementId : null,
      fullUrl: sourceType === 'external'
        ? (this.normalizeText(this.apiSettingsForm.get('fullUrl')?.value) ?? 'https://example.com/api/options')
        : '',
      method: safeMethod,
      responseListPath: 'data',
      responseValuePath: 'id',
      responseLabelPath: 'name',
      authMode: currentAuthMode
    }, { emitEvent: false });
    this.applyApiSettingsFormRules();

    const runtimePayload = this.buildApiRuntimePayloadFromForm();
    this.apiSettingsRuntimeJsonDraft = JSON.stringify(runtimePayload, null, 2);
    this.apiSettingsTouched = true;
    this.apiSettingsLastEditedSource = 'form';
  }

  private resolveApiSettingsFormValidationMessage(): string | null {
    const validationLabels: Array<{ control: string; label: string }> = [
      { control: 'sourceType', label: 'نوع المصدر' },
      { control: 'trigger', label: 'متى يتم التحميل' },
      { control: 'requestFormat', label: 'تنسيق الطلب' },
      { control: 'statementId', label: 'رقم العبارة الداخلية' },
      { control: 'fullUrl', label: 'عنوان API الخارجي' },
      { control: 'method', label: 'طريقة الاستدعاء' },
      { control: 'responseListPath', label: 'مسار قائمة النتائج' },
      { control: 'responseValuePath', label: 'مسار قيمة العنصر' },
      { control: 'responseLabelPath', label: 'مسار اسم العنصر' },
      { control: 'authMode', label: 'نمط المصادقة' },
      { control: 'tokenValue', label: 'Token الثابت' },
      { control: 'username', label: 'اسم المستخدم' },
      { control: 'password', label: 'كلمة المرور' }
    ];

    for (const item of validationLabels) {
      if (this.apiSettingsForm.get(item.control)?.invalid) {
        return this.apiSettingsValidationMessage(item.control, item.label);
      }
    }

    return null;
  }

  canOpenApiSettingsForFieldType(fieldType: unknown): boolean {
    const normalized = (this.normalizeText(fieldType) ?? '')
      .replace(/[\s_-]/g, '')
      .toLowerCase();

    return normalized === 'dropdown'
      || normalized === 'radiobutton'
      || normalized === 'radiobuttons'
      || normalized === 'dropdowntree'
      || normalized === 'treedropdown';
  }

  private buildApiRuntimePayloadFromForm(): Record<string, unknown> {
    const raw = this.apiSettingsForm.getRawValue();
    const sourceType = this.apiSettingsSourceType;
    const authMode = this.apiSettingsAuthModeValue;
    const requestFormat = this.normalizeText(raw.requestFormat) ?? 'json';
    const triggerRaw = (this.normalizeText(raw.trigger) ?? 'change').toLowerCase();
    const trigger: ApiDynamicTrigger = triggerRaw === 'init' || triggerRaw === 'blur' ? triggerRaw : 'change';
    const responseListPath = this.normalizeText(raw.responseListPath) ?? 'data';
    const responseValuePath = this.normalizeText(raw.responseValuePath) ?? 'id';
    const responseLabelPath = this.normalizeText(raw.responseLabelPath) ?? 'name';

    const authBase = { ...this.apiSettingsAuthBase };
    delete authBase['mode'];
    delete authBase['token'];
    delete authBase['username'];
    delete authBase['password'];

    const integration = {
      ...this.apiSettingsIntegrationBase,
      sourceType,
      requestFormat,
      auth: {
        ...authBase,
        ...this.buildApiAuthConfigForMode(
          authMode,
          this.normalizeText(raw.tokenValue),
          this.normalizeText(raw.username),
          this.normalizeText(raw.password))
      }
    } as Record<string, unknown>;

    if (sourceType === 'powerbi') {
      delete integration['fullUrl'];
      delete integration['method'];
      integration['statementId'] = this.toPositiveInt(raw.statementId) ?? 1;
    } else {
      const methodRaw = this.normalizeText(raw.method)?.toUpperCase() ?? 'GET';
      const method: ApiDynamicHttpMethod = ['GET', 'POST', 'PUT', 'PATCH'].includes(methodRaw)
        ? methodRaw as ApiDynamicHttpMethod
        : 'GET';
      delete integration['statementId'];
      integration['fullUrl'] = this.normalizeText(raw.fullUrl) ?? 'https://example.com/api/options';
      integration['method'] = method;
    }

    const optionLoader = {
      ...this.apiSettingsOptionLoaderBase,
      trigger,
      integration,
      responseListPath,
      responseValuePath,
      responseLabelPath
    } as Record<string, unknown>;

    return {
      ...this.apiSettingsRuntimeExtraSections,
      optionLoader
    };
  }

  private applyApiRuntimePayloadToForm(runtimePayload: Record<string, unknown>): void {
    const optionLoader = this.readObject(runtimePayload['optionLoader']) ?? {};
    const integration = this.readObject(optionLoader['integration']) ?? {};
    const auth = this.readObject(integration['auth']) ?? {};

    const sourceTypeCandidate = this.normalizeText(integration['sourceType'])?.toLowerCase();
    const resolvedSourceType: ApiDynamicSourceType = sourceTypeCandidate === 'external'
      || (sourceTypeCandidate == null && this.normalizeText(integration['fullUrl']) != null)
      ? 'external'
      : 'powerbi';
    const triggerRaw = this.normalizeText(optionLoader['trigger'])?.toLowerCase();
    const trigger: ApiDynamicTrigger = triggerRaw === 'init' || triggerRaw === 'blur' ? triggerRaw : 'change';
    const methodRaw = this.normalizeText(integration['method'])?.toUpperCase() ?? 'GET';
    const method: ApiDynamicHttpMethod = ['GET', 'POST', 'PUT', 'PATCH'].includes(methodRaw)
      ? methodRaw as ApiDynamicHttpMethod
      : 'GET';
    const authMode = this.inferApiAuthMode(runtimePayload);
    const tokenValue = this.readApiBindingValue(auth['token']);
    const username = this.readApiBindingValue(auth['username']);
    const password = this.readApiBindingValue(auth['password']);
    const requestFormat = this.normalizeText(integration['requestFormat']) ?? 'json';
    const statementId = this.toPositiveInt(integration['statementId']);
    const fullUrl = this.normalizeText(integration['fullUrl']) ?? '';
    const responseListPath = this.normalizeText(optionLoader['responseListPath']) ?? 'data';
    const responseValuePath = this.normalizeText(optionLoader['responseValuePath']) ?? 'id';
    const responseLabelPath = this.normalizeText(optionLoader['responseLabelPath']) ?? 'name';

    this.apiSettingsRuntimeExtraSections = this.copyObjectExcludingKeys(runtimePayload, ['optionLoader']);
    this.apiSettingsOptionLoaderBase = this.copyObjectExcludingKeys(optionLoader, [
      'trigger',
      'integration',
      'responseListPath',
      'responseValuePath',
      'responseLabelPath'
    ]);
    this.apiSettingsIntegrationBase = this.copyObjectExcludingKeys(integration, [
      'sourceType',
      'requestFormat',
      'auth',
      'statementId',
      'fullUrl',
      'method'
    ]);
    this.apiSettingsAuthBase = this.copyObjectExcludingKeys(auth, ['mode', 'token', 'username', 'password']);

    this.apiSettingsForm.patchValue({
      sourceType: resolvedSourceType,
      trigger,
      requestFormat,
      statementId,
      fullUrl,
      method,
      responseListPath,
      responseValuePath,
      responseLabelPath,
      authMode,
      tokenValue,
      username,
      password
    }, { emitEvent: false });
    this.applyApiSettingsFormRules();
    this.apiSettingsLastEditedSource = null;
  }

  private resolveRuntimePayloadForEditor(payload: Record<string, unknown>): Record<string, unknown> | null {
    if (this.looksLikeRuntimePayload(payload)) {
      return payload;
    }

    if (Object.prototype.hasOwnProperty.call(payload, 'dynamicRuntime')) {
      const runtimePayload = this.parseRuntimePayload(payload['dynamicRuntime']);
      if (runtimePayload && this.looksLikeRuntimePayload(runtimePayload)) {
        return runtimePayload;
      }
    }

    return null;
  }

  private readApiBindingValue(value: unknown): string {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return this.normalizeText(value) ?? '';
    }

    const payload = this.readObject(value);
    return this.normalizeText(payload?.['staticValue'] ?? payload?.['value']) ?? '';
  }

  private copyObjectExcludingKeys(source: Record<string, unknown>, excludedKeys: string[]): Record<string, unknown> {
    return Object.entries(source)
      .filter(([key]) => !excludedKeys.includes(key))
      .reduce((accumulator, [key, value]) => {
        accumulator[key] = value;
        return accumulator;
      }, {} as Record<string, unknown>);
  }

  private buildApiAuthConfigForMode(
    mode: ApiDynamicAuthMode,
    tokenValue?: string | null,
    username?: string | null,
    password?: string | null
  ): Record<string, unknown> {
    if (mode === 'bearerCurrent') {
      return { mode: 'bearerCurrent' };
    }

    if (mode === 'token') {
      return {
        mode: 'token',
        token: {
          source: 'static',
          staticValue: tokenValue ?? 'ضع_التوكن_هنا'
        }
      };
    }

    if (mode === 'basic') {
      return {
        mode: 'basic',
        username: {
          source: 'static',
          staticValue: username ?? 'api_user'
        },
        password: {
          source: 'static',
          staticValue: password ?? 'api_password'
        }
      };
    }

    return { mode: 'none' };
  }

  private readObject(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    return value as Record<string, unknown>;
  }

  private resetApiSettingsEditorState(): void {
    this.apiSettingsDialogVisible = false;
    this.apiSettingsLoading = false;
    this.apiSettingsSaving = false;
    this.apiSettingsTouched = false;
    this.apiSettingsLastEditedSource = null;
    this.apiSettingsRuntimeJsonDraft = '';
    this.apiSettingsMessage = '';
    this.resetApiSettingsFormDefaults();
  }

  private resetApiSettingsFormDefaults(): void {
    this.apiSettingsRuntimeExtraSections = {};
    this.apiSettingsOptionLoaderBase = {};
    this.apiSettingsIntegrationBase = {};
    this.apiSettingsAuthBase = {};
    this.apiSettingsForm.reset({
      sourceType: 'powerbi',
      trigger: 'change',
      requestFormat: 'json',
      statementId: null,
      fullUrl: '',
      method: 'GET',
      responseListPath: 'data',
      responseValuePath: 'id',
      responseLabelPath: 'name',
      authMode: 'none',
      tokenValue: '',
      username: '',
      password: ''
    }, { emitEvent: false });
    this.applyApiSettingsFormRules();
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
        this.tryOpenPendingRouteFieldEditor();

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

  private tryOpenPendingRouteFieldEditor(): void {
    const pendingFieldKey = this.normalizeText(this.pendingRouteEditFieldKey);
    const shouldOpenFieldEditor = this.pendingRouteOpenFieldEditor;
    const shouldOpenApiSettings = this.pendingRouteOpenApiSettings;

    if (!pendingFieldKey) {
      return;
    }

    if (!shouldOpenFieldEditor && !shouldOpenApiSettings) {
      this.pendingRouteEditFieldKey = null;
      this.pendingRouteEditApplicationId = null;
      return;
    }

    if (this.loadingFieldDetails || this.dialogVisible || this.apiSettingsDialogVisible) {
      return;
    }

    let targetApplicationId = this.normalizeText(this.pendingRouteEditApplicationId)
      ?? this.normalizeText(this.selectedApplicationFilter)
      ?? this.contextApplicationId;

    if (!targetApplicationId) {
      const matchedField = this.fields.find(item => this.isSameText(item.fieldKey, pendingFieldKey));
      targetApplicationId = this.normalizeText(matchedField?.applicationId);
    }

    if (!targetApplicationId) {
      return;
    }

    this.pendingRouteEditFieldKey = null;
    this.pendingRouteEditApplicationId = null;
    this.pendingRouteOpenFieldEditor = false;
    this.pendingRouteOpenApiSettings = false;
    this.selectedFieldIdentity = this.composeFieldIdentity(targetApplicationId, pendingFieldKey);
    if (!this.isSameText(this.selectedApplicationFilter, targetApplicationId)) {
      this.selectedApplicationFilter = targetApplicationId;
    }

    this.openFieldEditor(targetApplicationId, pendingFieldKey, {
      showFieldDialog: shouldOpenFieldEditor,
      openApiSettingsDialog: shouldOpenApiSettings
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
      .map(item => ({ label: this.resolveFieldTypeLabel(item), value: item }));

    this.dataTypeOptions = (dataTypes.length > 0 ? dataTypes : this.fallbackDataTypeOptions().map(item => item.value))
      .map(item => ({ label: this.resolveDataTypeLabel(item), value: item }));
  }

  private fallbackFieldTypeOptions(): SelectOption[] {
    return [
      { label: 'نص قصير', value: 'InputText' },
      { label: 'نص طويل', value: 'Textarea' },
      { label: 'قائمة اختيار', value: 'Dropdown' },
      { label: 'شجرة اختيار', value: 'DropdownTree' },
      { label: 'اختيار منفرد', value: 'RadioButton' },
      { label: 'تاريخ', value: 'Date' },
      { label: 'تاريخ ووقت', value: 'DateTime' },
      { label: 'مفتاح تبديل', value: 'ToggleSwitch' },
      { label: 'رفع ملف', value: 'FileUpload' },
      { label: 'مستخدم نطاق', value: 'DomainUser' },
      { label: 'بيانات JSON', value: 'JsonData' }
    ];
  }

  private fallbackDataTypeOptions(): SelectOption[] {
    return [
      { label: 'نص', value: 'string' },
      { label: 'رقم', value: 'number' },
      { label: 'تاريخ', value: 'date' },
      { label: 'منطقي', value: 'boolean' },
      { label: 'بيانات JSON', value: 'json' },
      { label: 'نص ممتد', value: 'nvarchar' }
    ];
  }

  resolveFieldTypeLabel(fieldType: string | undefined): string {
    const normalized = this.normalizeText(fieldType)?.toLowerCase();
    if (!normalized) {
      return 'غير محدد';
    }

    return this.fieldTypeLabelLookup[normalized] ?? 'نوع مخصص';
  }

  resolveDataTypeLabel(dataType: string | undefined): string {
    const normalized = this.normalizeText(dataType)?.toLowerCase();
    if (!normalized) {
      return 'غير محدد';
    }

    return this.dataTypeLabelLookup[normalized] ?? 'نوع بيانات مخصص';
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
      this.ensureAtLeastOneAdvancedDataRow();
      this.syncAdvancedDataControl();
    } else {
      optionsPayloadControl.clearValidators();
      if (this.advancedDataRowsTouched) {
        this.syncAdvancedDataControl();
      }
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
      cdmendTbl: this.resolveCdmendTblForSubmit(raw.cdmendTbl),
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
      cdmendTbl: this.resolveCdmendTblForSubmit(raw.cdmendTbl),
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

  private hydrateAdvancedDataEditor(payload: string | null | undefined): void {
    const parsed = this.parseAdvancedDataRows(payload);
    this.advancedDataRows = parsed.rows.length > 0
      ? parsed.rows
      : [this.createAdvancedDataRow('', '')];
    this.advancedDataRowsTouched = false;
    this.advancedDataParseMessage = parsed.parseMessage;
    this.advancedDataRawJsonDraft = this.resolveAdvancedDataRawJsonDraft(payload, parsed.rows);
    this.syncAdvancedDataControl();
  }

  private resolveAdvancedDataRawJsonDraft(
    payload: string | null | undefined,
    parsedRows: AdvancedDataRow[]
  ): string {
    const raw = String(payload ?? '').trim();
    if (raw.length > 0) {
      const parsedJson = this.parseLooseJson(raw);
      if (parsedJson !== null) {
        try {
          return JSON.stringify(parsedJson, null, 2);
        } catch {
          return raw;
        }
      }

      return raw;
    }

    const serializedRows = this.serializeAdvancedDataRows(parsedRows);
    return serializedRows ? this.prettyPrintJson(serializedRows) : '';
  }

  private parseAdvancedDataRows(payload: string | null | undefined): { rows: AdvancedDataRow[]; parseMessage: string } {
    const raw = String(payload ?? '').trim();
    if (raw.length === 0) {
      return { rows: [], parseMessage: '' };
    }

    const parsedJson = this.parseLooseJson(raw);
    if (parsedJson !== null) {
      const mappedRows = this.mapParsedAdvancedDataToRows(parsedJson);
      if (mappedRows.length > 0) {
        return { rows: mappedRows, parseMessage: '' };
      }

      if (Array.isArray(parsedJson) || typeof parsedJson === 'object') {
        return {
          rows: [],
          parseMessage: 'تم تحميل JSON قديم لكنه لا يحتوي عناصر مفتاح/قيمة قابلة للعرض.'
        };
      }
    }

    const fallbackRows = this.parseDelimitedAdvancedDataRows(raw);
    if (fallbackRows.length > 0) {
      return {
        rows: fallbackRows,
        parseMessage: 'تعذر تحليل JSON القديم مباشرةً؛ تم تحويل النص إلى صفوف. يرجى مراجعة القيم قبل الحفظ.'
      };
    }

    return {
      rows: [],
      parseMessage: 'تعذر تحليل قيمة CDMendTbl القديمة. يمكنك إدخال القيم يدويًا في الجدول.'
    };
  }

  private parseLooseJson(raw: string): unknown | null {
    try {
      return JSON.parse(raw);
    } catch {
      try {
        const fixed = raw.replace(/\'/g, '"');
        return JSON.parse(fixed);
      } catch {
        return null;
      }
    }
  }

  private mapParsedAdvancedDataToRows(parsed: unknown): AdvancedDataRow[] {
    if (Array.isArray(parsed)) {
      return parsed
        .map(item => this.mapAdvancedDataArrayItem(item))
        .filter((item): item is AdvancedDataRow => item !== null);
    }

    if (parsed && typeof parsed === 'object') {
      return Object.entries(parsed as Record<string, unknown>)
        .map(([key, value]) => {
          const normalizedKey = this.normalizeText(key) ?? '';
          const normalizedValue = this.stringifyAdvancedValue(value);
          if (normalizedKey.length === 0 && normalizedValue.length === 0) {
            return null;
          }

          return this.createAdvancedDataRow(
            normalizedKey || normalizedValue,
            normalizedValue || normalizedKey
          );
        })
        .filter((item): item is AdvancedDataRow => item !== null);
    }

    return [];
  }

  private mapAdvancedDataArrayItem(item: unknown): AdvancedDataRow | null {
    if (item == null) {
      return null;
    }

    if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') {
      const text = String(item).trim();
      return text.length > 0 ? this.createAdvancedDataRow(text, text) : null;
    }

    if (typeof item !== 'object') {
      return null;
    }

    const payload = item as Record<string, unknown>;
    const key = this.normalizeText(
      payload['key']
      ?? payload['value']
      ?? payload['id']
      ?? payload['code']
      ?? payload['name']
      ?? payload['label']
      ?? payload['text']
    ) ?? '';
    const value = this.normalizeText(
      payload['name']
      ?? payload['value']
      ?? payload['label']
      ?? payload['text']
      ?? payload['key']
      ?? payload['id']
      ?? payload['code']
    ) ?? '';

    if (key.length === 0 && value.length === 0) {
      return null;
    }

    return this.createAdvancedDataRow(
      key || value,
      value || key
    );
  }

  private parseDelimitedAdvancedDataRows(raw: string): AdvancedDataRow[] {
    return raw
      .split(/[|,;\n]+/g)
      .map(token => token.trim())
      .filter(token => token.length > 0)
      .map(token => this.createAdvancedDataRow(token, token));
  }

  private stringifyAdvancedValue(value: unknown): string {
    if (value == null) {
      return '';
    }

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return String(value).trim();
    }

    try {
      return JSON.stringify(value).trim();
    } catch {
      return String(value).trim();
    }
  }

  private createAdvancedDataRow(key: string, value: string): AdvancedDataRow {
    this.advancedDataRowSeed += 1;
    return {
      rowId: this.advancedDataRowSeed,
      key,
      value
    };
  }

  private ensureAtLeastOneAdvancedDataRow(): void {
    if (this.advancedDataRows.length > 0) {
      return;
    }

    this.advancedDataRows = [this.createAdvancedDataRow('', '')];
  }

  private normalizeAdvancedDataRows(rows: AdvancedDataRow[]): Array<{ key: string; value: string }> {
    return rows.map(row => ({
      key: String(row.key ?? '').trim(),
      value: String(row.value ?? '').trim()
    }));
  }

  private serializeAdvancedDataRows(rows: AdvancedDataRow[]): string | undefined {
    const normalizedRows = this.normalizeAdvancedDataRows(rows)
      .filter(row => row.key.length > 0 || row.value.length > 0)
      .map(row => ({
        key: row.key || row.value,
        name: row.value || row.key
      }));

    if (normalizedRows.length === 0) {
      return undefined;
    }

    return JSON.stringify(normalizedRows);
  }

  private syncAdvancedDataControl(): void {
    const control = this.fieldForm.get('cdmendTbl');
    if (!control) {
      return;
    }

    if (this.requiresOptionsPayload || this.advancedDataRowsTouched) {
      control.setValue(this.serializeAdvancedDataRows(this.advancedDataRows) ?? '', { emitEvent: false });
      return;
    }

    control.updateValueAndValidity({ emitEvent: false });
  }

  private syncAdvancedDataRawJsonDraftFromRows(): void {
    const serialized = this.serializeAdvancedDataRows(this.advancedDataRows);
    this.advancedDataRawJsonDraft = serialized ? this.prettyPrintJson(serialized) : '';
  }

  private prettyPrintJson(payload: string): string {
    const normalizedPayload = String(payload ?? '').trim();
    if (normalizedPayload.length === 0) {
      return '';
    }

    try {
      return JSON.stringify(JSON.parse(normalizedPayload), null, 2);
    } catch {
      return normalizedPayload;
    }
  }

  private resolveCdmendTblForSubmit(rawValue: unknown): string | undefined {
    if (this.requiresOptionsPayload || this.advancedDataRowsTouched) {
      return this.serializeAdvancedDataRows(this.advancedDataRows);
    }

    return this.normalizeText(rawValue) ?? undefined;
  }

  private normalizeText(value: unknown): string | null {
    const normalized = String(value ?? '').trim();
    return normalized.length > 0 ? normalized : null;
  }

  private readCategoryIdFromParams(params: ParamMap): number | null {
    for (const key of ['categoryId', 'requestTypeId', 'subjectTypeId']) {
      const value = this.toPositiveInt(params.get(key));
      if (value != null) {
        return value;
      }
    }

    return null;
  }

  private readApplicationIdFromParams(params: ParamMap): string | null {
    for (const key of ['applicationId', 'appId', 'scopeApplicationId']) {
      const value = this.normalizeText(params.get(key));
      if (value != null) {
        return value;
      }
    }

    return null;
  }

  private readEditFieldKeyFromParams(params: ParamMap): string | null {
    for (const key of ['editFieldKey', 'fieldKey']) {
      const value = this.normalizeText(params.get(key));
      if (value != null) {
        return value;
      }
    }

    return null;
  }

  private readEditApplicationIdFromParams(params: ParamMap): string | null {
    for (const key of ['editApplicationId', 'targetApplicationId']) {
      const value = this.normalizeText(params.get(key));
      if (value != null) {
        return value;
      }
    }

    return null;
  }

  private readOpenFieldEditorFromParams(params: ParamMap): boolean {
    return this.readBooleanFlagFromParams(params, ['openFieldEditor', 'openEditDialog']);
  }

  private readOpenApiSettingsFromParams(params: ParamMap): boolean {
    return this.readBooleanFlagFromParams(params, ['openApiSettings', 'openJsonSettings']);
  }

  private readBooleanFlagFromParams(params: ParamMap, keys: string[]): boolean {
    for (const key of keys) {
      const rawValue = this.normalizeText(params.get(key));
      if (rawValue == null) {
        continue;
      }

      const normalized = rawValue.toLowerCase();
      if (normalized === '1' || normalized === 'true' || normalized === 'yes') {
        return true;
      }
    }

    return false;
  }

  private isSameText(left: string | null | undefined, right: string | null | undefined): boolean {
    const normalizedLeft = this.normalizeText(left)?.toLowerCase();
    const normalizedRight = this.normalizeText(right)?.toLowerCase();
    return normalizedLeft != null && normalizedRight != null && normalizedLeft === normalizedRight;
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

  private readCatalogContextCache(): { categoryId: number | null; applicationId: string | null } {
    const raw = localStorage.getItem(AdminControlCenterCatalogFieldLibraryPageComponent.CATALOG_CONTEXT_STORAGE_KEY);
    if (!raw) {
      return { categoryId: null, applicationId: null };
    }

    try {
      const parsed = JSON.parse(raw) as { categoryId?: unknown; applicationId?: unknown };
      return {
        categoryId: this.toPositiveInt(parsed?.categoryId),
        applicationId: this.normalizeText(parsed?.applicationId)
      };
    } catch {
      return { categoryId: null, applicationId: null };
    }
  }

  private persistCatalogContextCache(categoryId: number | null, applicationId: string | null): void {
    const normalizedCategoryId = this.toPositiveInt(categoryId);
    const normalizedApplicationId = this.normalizeText(applicationId);
    if (!normalizedCategoryId && !normalizedApplicationId) {
      return;
    }

    const payload = {
      categoryId: normalizedCategoryId,
      applicationId: normalizedApplicationId
    };

    localStorage.setItem(AdminControlCenterCatalogFieldLibraryPageComponent.CATALOG_CONTEXT_STORAGE_KEY, JSON.stringify(payload));
  }
}
