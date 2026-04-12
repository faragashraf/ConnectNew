import { ChangeDetectionStrategy, Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { Subscription, combineLatest, firstValueFrom } from 'rxjs';
import { auditTime } from 'rxjs/operators';
import {
  CommonResponse,
  SubjectAdminFieldDto,
  SubjectAdminFieldUpsertRequestDto,
  SubjectAdminGroupDto,
  SubjectReferencePolicyComponentDto,
  SubjectCategoryFieldLinkAdminDto,
  SubjectCategoryFieldLinkUpsertItemDto,
  SubjectTypeAdminDto,
  SubjectTypeAdminUpsertRequestDto
} from 'src/app/shared/services/BackendServices/DynamicSubjects/DynamicSubjects.dto';
import { DynamicSubjectsController } from 'src/app/shared/services/BackendServices/DynamicSubjects/DynamicSubjects.service';
import { AdminCatalogGroupTreeNodeDto } from 'src/app/shared/services/BackendServices/DynamicSubjectsAdminCatalog/DynamicSubjectsAdminCatalog.dto';
import { DynamicSubjectsAdminCatalogController } from 'src/app/shared/services/BackendServices/DynamicSubjectsAdminCatalog/DynamicSubjectsAdminCatalog.service';
import { MsgsService } from 'src/app/shared/services/helper/msgs.service';
import {
  BoundFieldItem,
  FieldLibraryBindingValidationResult,
  ReusableFieldLibraryItem
} from '../../domain/models/field-library-binding.models';
import { FieldLibraryBindingEngine } from '../../domain/field-library-binding/field-library-binding.engine';
import {
  RequestRuntimeDynamicActionConfig,
  RequestRuntimeDynamicFieldBehaviorConfig,
  RequestRuntimeDynamicIntegrationAuthMode,
  RequestRuntimeDynamicIntegrationNameValueBinding,
  RequestRuntimeDynamicIntegrationRequestConfig,
  RequestRuntimeDynamicIntegrationSourceType,
  RequestRuntimeDynamicIntegrationValueBinding,
  RequestRuntimeDynamicRequestFormat,
  RequestRuntimeDynamicTrigger,
  parseRequestRuntimeDynamicFieldBehavior
} from '../../../request-runtime-catalog/models/request-runtime-catalog.models';

type SequenceResetScope = 'none' | 'yearly' | 'monthly';
type FormDisplayMode = 'Standard' | 'Tabbed';
type ReferenceMode = 'default' | 'custom';
type ReferenceSeparator = '-' | '/' | '_' | '';
type ReferenceComponentType = 'static_text' | 'field' | 'year' | 'month' | 'day' | 'sequence';

interface ReferenceComponentVm {
  id: string;
  type: ReferenceComponentType;
  value?: string;
  fieldKey?: string;
}

type FieldBindingContextVm = {
  context: {
    categoryId: number | null;
    applicationId: string | null;
  };
};

type FieldBindingStepVm = {
  requiredCompleted: number;
  requiredTotal: number;
  isCompleted: boolean;
};

type DynamicRuntimeBehaviorType = 'optionLoader' | 'asyncValidation' | 'autofill';

interface DynamicRuntimeBuilderBindingVm {
  name: string;
  source: 'static' | 'field' | 'claim';
  staticValue: string;
  fieldKey: string;
  claimKey: string;
  fallbackValue: string;
}

interface DynamicRuntimeBuilderPatchVm {
  targetFieldKey: string;
  valuePath: string;
  valueTemplate: string;
  clearWhenMissing: boolean;
}

interface DynamicRuntimeBuilderVm {
  behaviorType: DynamicRuntimeBehaviorType;
  trigger: RequestRuntimeDynamicTrigger;
  sourceFieldKey: string;
  sourceType: RequestRuntimeDynamicIntegrationSourceType;
  requestFormat: RequestRuntimeDynamicRequestFormat;
  authMode: RequestRuntimeDynamicIntegrationAuthMode;
  statementId: number | null;
  fullUrl: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH';
  parameters: DynamicRuntimeBuilderBindingVm[];
  query: DynamicRuntimeBuilderBindingVm[];
  body: DynamicRuntimeBuilderBindingVm[];
  headers: DynamicRuntimeBuilderBindingVm[];
  customHeaders: DynamicRuntimeBuilderBindingVm[];
  responseListPath: string;
  responseValuePath: string;
  responseLabelPath: string;
  clearWhenSourceEmpty: boolean;
  minQueryLength: number | null;
  responseValidPath: string;
  responseMessagePath: string;
  defaultErrorMessage: string;
  debounceMs: number | null;
  minValueLength: number | null;
  whenEquals: string;
  clearTargetsWhenEmpty: boolean;
  patches: DynamicRuntimeBuilderPatchVm[];
}

interface ParsedBindingOptionsResult {
  state: 'missing' | 'valid' | 'empty' | 'invalid';
  options: Array<{ value: string; label: string }>;
  values: Set<string>;
  invalidSourceCount: number;
  emptySourceCount: number;
  rawSourceCount: number;
  rawSources: Array<{ source: string; payload: string }>;
  invalidReason?: string;
}

interface BindingOptionSourceDecision {
  source: 'Static' | 'Internal' | 'External' | 'None';
  reason: string;
  hasStaticSourcePayload: boolean;
  staticOptionsValid: boolean;
  staticOptionsCount: number;
  rawStaticSourceCount: number;
  rawStaticSources: Array<{ source: string; payload: string }>;
  hasDynamicRuntimeConfig: boolean;
  hasBehavioralRuntimeConfig: boolean;
  hasDynamicOptionSource: boolean;
  dynamicOptionSourceKind?: 'Internal' | 'External';
  dynamicOptionSourceReason?: string;
  staticExcludedReason?: string;
  staticOptionValues: Set<string>;
}

@Component({
  selector: 'app-field-library-binding-page',
  templateUrl: './field-library-binding-page.component.html',
  styleUrls: ['./field-library-binding-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FieldLibraryBindingPageComponent implements OnInit, OnChanges, OnDestroy {
  private static readonly CATALOG_CONTEXT_STORAGE_KEY = 'connect:control-center-catalog:context:v1';
  private static readonly SAVE_DIAGNOSTIC_MODE_STORAGE_KEY = 'connect:field-library-binding:diagnostic-mode';

  @Input() requestTypeId: number | null = null;
  @Input() applicationId: string | null = null;

  readonly stepKey = 'field-library-binding';

  readonly fieldTypeOptions = [
    { label: 'نص قصير', value: 'InputText' },
    { label: 'نص طويل', value: 'Textarea' },
    { label: 'قائمة اختيار', value: 'Dropdown' },
    { label: 'رقم', value: 'Number' },
    { label: 'تاريخ', value: 'Date' },
    { label: 'اختيار نعم/لا', value: 'Checkbox' }
  ];

  readonly sequenceResetScopeOptions: Array<{ label: string; value: SequenceResetScope }> = [
    { label: 'بدون إعادة ضبط', value: 'none' },
    { label: 'سنوي', value: 'yearly' },
    { label: 'شهري', value: 'monthly' }
  ];

  readonly referenceModeOptions: Array<{ label: string; value: ReferenceMode }> = [
    { label: 'ترقيم افتراضي', value: 'default' },
    { label: 'ترقيم مخصص', value: 'custom' }
  ];

  readonly referenceSeparatorOptions: Array<{ label: string; value: ReferenceSeparator }> = [
    { label: '-', value: '-' },
    { label: '/', value: '/' },
    { label: '_', value: '_' },
    { label: 'بدون', value: '' }
  ];

  readonly referenceComponentTypeOptions: Array<{ label: string; value: ReferenceComponentType }> = [
    { label: 'نص ثابت', value: 'static_text' },
    { label: 'قيمة حقل', value: 'field' },
    { label: 'السنة', value: 'year' },
    { label: 'الشهر', value: 'month' },
    { label: 'اليوم', value: 'day' },
    { label: 'المسلسل', value: 'sequence' }
  ];

  readonly displayModeOptions: Array<{ label: string; value: FormDisplayMode }> = [
    { label: 'عرض قياسي', value: 'Standard' },
    { label: 'عرض بعلامات تبويب', value: 'Tabbed' }
  ];
  readonly dynamicRuntimeBehaviorOptions: Array<{ label: string; value: DynamicRuntimeBehaviorType }> = [
    { label: 'تحميل خيارات', value: 'optionLoader' },
    { label: 'تحقق غير متزامن', value: 'asyncValidation' },
    { label: 'تعبئة تلقائية', value: 'autofill' }
  ];
  readonly dynamicRuntimeTriggerOptions: Array<{ label: string; value: RequestRuntimeDynamicTrigger }> = [
    { label: 'عند التهيئة', value: 'init' },
    { label: 'عند التغيير', value: 'change' },
    { label: 'عند فقدان التركيز', value: 'blur' }
  ];
  readonly dynamicRuntimeSourceTypeOptions: Array<{ label: string; value: RequestRuntimeDynamicIntegrationSourceType }> = [
    { label: 'Power BI داخلي', value: 'powerbi' },
    { label: 'مصدر خارجي', value: 'external' }
  ];
  readonly dynamicRuntimeRequestFormatOptions: Array<{ label: string; value: RequestRuntimeDynamicRequestFormat }> = [
    { label: 'JSON', value: 'json' },
    { label: 'XML (لاحقًا)', value: 'xml' }
  ];
  readonly dynamicRuntimeAuthModeOptions: Array<{ label: string; value: RequestRuntimeDynamicIntegrationAuthMode }> = [
    { label: 'Bearer الحالي', value: 'bearerCurrent' },
    { label: 'بدون مصادقة', value: 'none' },
    { label: 'رؤوس مخصصة', value: 'custom' }
  ];
  readonly dynamicRuntimeHttpMethodOptions: Array<{ label: string; value: 'GET' | 'POST' | 'PUT' | 'PATCH' }> = [
    { label: 'GET', value: 'GET' },
    { label: 'POST', value: 'POST' },
    { label: 'PUT', value: 'PUT' },
    { label: 'PATCH', value: 'PATCH' }
  ];
  readonly dynamicRuntimeValueSourceOptions: Array<{ label: string; value: DynamicRuntimeBuilderBindingVm['source'] }> = [
    { label: 'قيمة ثابتة', value: 'static' },
    { label: 'من حقل', value: 'field' },
    { label: 'من مطالبة المستخدم', value: 'claim' }
  ];
  readonly dynamicRuntimeSampleJson = `{
  "optionLoader": {
    "trigger": "init",
    "integration": {
      "sourceType": "powerbi",
      "requestFormat": "json",
      "auth": { "mode": "bearerCurrent" },
      "statementId": 65,
      "parameters": [
        { "name": "code", "value": { "source": "field", "fieldKey": "field_code" } }
      ]
    },
    "responseListPath": "data",
    "responseValuePath": "id",
    "responseLabelPath": "name"
  }
}`;

  readonly referencePolicyForm: FormGroup = this.fb.group({
    referencePolicyEnabled: [true],
    referenceMode: ['default', [Validators.required]],
    referencePrefix: ['', [Validators.maxLength(40)]],
    referenceSeparator: ['-', [Validators.required]],
    serialId: [null],
    serialName: ['', [Validators.maxLength(80)]],
    referenceStartingValue: [1, [Validators.required, Validators.min(1), Validators.max(2147483647)]],
    referenceSequencePaddingLength: [6, [Validators.required, Validators.min(1), Validators.max(12)]],
    referenceSequenceResetScope: ['none']
  });

  readonly presentationForm: FormGroup = this.fb.group({
    defaultDisplayMode: ['Standard', [Validators.required]],
    allowUserToChangeDisplayMode: [false]
  });

  readonly newFieldForm: FormGroup = this.fb.group({
    fieldKey: ['', [Validators.required, Validators.maxLength(50), Validators.pattern(/^[A-Za-z_][A-Za-z0-9_]*$/)]],
    label: ['', [Validators.required, Validators.maxLength(50)]],
    type: ['InputText', [Validators.required]],
    groupId: [null, [Validators.required]],
    required: [false],
    readonly: [false],
    visible: [true],
    defaultValue: ['']
  });
  private readonly referencePolicyControlLabels: Readonly<Record<string, string>> = {
    referenceMode: 'وضع الترقيم',
    referenceSeparator: 'فاصل الرقم المرجعي',
    serialName: 'اسم المسلسل',
    referenceStartingValue: 'قيمة البداية',
    referenceSequencePaddingLength: 'طول المسلسل'
  };
  private readonly presentationControlLabels: Readonly<Record<string, string>> = {
    defaultDisplayMode: 'وضع العرض الافتراضي'
  };

  vm: FieldBindingContextVm | null = null;
  step: FieldBindingStepVm | null = null;

  reusableFields: ReadonlyArray<ReusableFieldLibraryItem> = [];
  bindings: BoundFieldItem[] = [];
  validation: FieldLibraryBindingValidationResult = { isValid: false, blockingIssues: [], warnings: [] };
  readonly referenceComponentsForm: FormArray = this.fb.array([]);
  referencePolicyBlockingIssues: string[] = [];

  groups: SubjectAdminGroupDto[] = [];
  groupOptions: Array<{ label: string; value: number }> = [];
  serialOptions: Array<{ label: string; value: number }> = [];

  stepMessage = '';
  stepMessageSeverity: 'success' | 'warn' = 'warn';
  librarySearchTerm = '';

  loadingLibrary = false;
  savingToBackend = false;
  backendWorkspaceLoaded = false;
  libraryLoadedFromDb = false;
  hasPendingBackendChanges = false;
  dynamicRuntimeBuilderVisible = false;
  dynamicRuntimeBuilderTargetBindingId: string | null = null;
  dynamicRuntimeBuilderModel: DynamicRuntimeBuilderVm = this.createDefaultDynamicRuntimeBuilder();
  readonly dynamicRuntimeAdvancedOpenBindingIds = new Set<string>();
  private readonly dynamicRuntimeAdvancedDraftByBindingId = new Map<string, string>();
  private readonly dynamicRuntimeAdvancedErrorByBindingId = new Map<string, string>();

  private readonly subscriptions = new Subscription();
  private syncingFromStore = false;
  private saveDiagnosticsMode = false;
  private activeLoadToken = 0;
  private currentCategoryId: number | null = null;
  private currentApplicationId: string | null = null;
  private routeCategoryId: number | null = null;
  private routeApplicationId: string | null = null;
  private subjectTypeAdmin: SubjectTypeAdminDto | null = null;
  private fieldCatalogByKey = new Map<string, SubjectAdminFieldDto>();

  constructor(
    private readonly fb: FormBuilder,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly bindingEngine: FieldLibraryBindingEngine,
    private readonly dynamicSubjectsController: DynamicSubjectsController,
    private readonly adminCatalogController: DynamicSubjectsAdminCatalogController,
    private readonly msgsService?: MsgsService
  ) {}

  ngOnInit(): void {
    this.saveDiagnosticsMode = this.resolveSaveDiagnosticsMode();
    this.setReferenceComponents([this.createReferenceComponent('sequence')], false);
    this.vm = { context: { categoryId: null, applicationId: null } };
    this.step = { requiredCompleted: 0, requiredTotal: 1, isCompleted: false };

    this.subscriptions.add(
      combineLatest([this.route.paramMap, this.route.queryParamMap]).subscribe(([pathParams, queryParams]) => {
        this.saveDiagnosticsMode = this.resolveSaveDiagnosticsMode();
        this.routeCategoryId = this.readRouteCategoryId(queryParams) ?? this.readRouteCategoryId(pathParams);
        this.routeApplicationId = this.readRouteApplicationId(queryParams) ?? this.readRouteApplicationId(pathParams);
        this.syncContextFromInputsOrRoute();
      })
    );

    this.subscriptions.add(
      this.referencePolicyForm.valueChanges
        .pipe(auditTime(80))
        .subscribe(() => {
          if (this.syncingFromStore) {
            return;
          }

          this.evaluateBindings(true, true);
        })
    );

    this.subscriptions.add(
      this.presentationForm.valueChanges
        .pipe(auditTime(80))
        .subscribe(() => {
          if (this.syncingFromStore) {
            return;
          }

          this.evaluateBindings(true, true);
        })
    );

    this.subscriptions.add(
      this.referenceComponentsForm.valueChanges
        .pipe(auditTime(80))
        .subscribe(() => {
          if (this.syncingFromStore) {
            return;
          }

          this.evaluateBindings(true, true);
        })
    );

    this.syncContextFromInputsOrRoute();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['requestTypeId'] || changes['applicationId']) {
      this.syncContextFromInputsOrRoute();
    }
  }

  get requiredProgressText(): string {
    if (!this.step) {
      return '0 / 0';
    }

    return `${this.step.requiredCompleted} / ${this.step.requiredTotal}`;
  }

  get saveToBackendActionHint(): string {
    if (this.loadingLibrary) {
      return 'جاري تحميل بيانات الربط من قاعدة البيانات؛ زر الحفظ سيعمل تلقائيًا بعد اكتمال التحميل.';
    }

    const preSaveBlockingReasons = this.collectPreSaveBlockingReasons();
    if (preSaveBlockingReasons.length > 0) {
      return `الحفظ محجوب حاليًا بسبب: ${preSaveBlockingReasons[0]}`;
    }

    if (!this.currentCategoryId) {
      return 'الحفظ محجوب لأن التصنيف الحالي غير صالح أو غير محدد.';
    }

    if (!this.currentApplicationId) {
      return 'الحفظ محجوب لأن التطبيق الحالي غير صالح أو غير محدد.';
    }

    if (!this.backendWorkspaceLoaded) {
      return 'الحفظ محجوب لأن بيانات الربط الفعلية لم تُحمّل من قاعدة البيانات بعد.';
    }

    if (this.hasPendingBackendChanges) {
      return 'مهم: زر "تطبيق على الحقل" يحدّث الحالة محليًا فقط. استخدم زر "حفظ في قاعدة البيانات" لتثبيت التعديلات فعليًا.';
    }

    return 'لا توجد تعديلات جديدة للحفظ في قاعدة البيانات.';
  }

  get fieldLibraryNavigationQueryParams(): { categoryId: number | null; applicationId: string | null } {
    return {
      categoryId: this.currentCategoryId,
      applicationId: this.currentApplicationId
    };
  }

  get filteredReusableFields(): ReusableFieldLibraryItem[] {
    const term = this.librarySearchTerm.trim().toLowerCase();
    if (!term) {
      return [...this.reusableFields];
    }

    return this.reusableFields.filter(item =>
      item.label.toLowerCase().includes(term)
      || item.fieldKey.toLowerCase().includes(term)
      || item.type.toLowerCase().includes(term)
    );
  }

  get referenceComponentRows(): FormGroup[] {
    return this.referenceComponentsForm.controls as FormGroup[];
  }

  get referencePreview(): string {
    const raw = this.referencePolicyForm.getRawValue();
    const enabled = raw['referencePolicyEnabled'] === true;
    if (!enabled) {
      return 'السياسة غير مفعّلة';
    }

    const mode = this.normalizeReferenceMode(raw['referenceMode']);
    const separator = this.normalizeReferenceSeparator(raw['referenceSeparator']);
    const sequenceLength = this.toSafeSequenceLength(raw['referenceSequencePaddingLength']);
    const sampleSequence = '1'.padStart(sequenceLength, '0');

    if (mode === 'default') {
      const prefix = this.normalizeNullable(raw['referencePrefix']) ?? '';
      const parts = prefix ? [prefix, sampleSequence] : [sampleSequence];
      return parts.join(separator);
    }

    const today = new Date();
    const components = this.getNormalizedReferenceComponents();
    const parts = components.map(component => {
      switch (component.type) {
        case 'static_text':
          return this.normalizeNullable(component.value) ?? '...';
        case 'field':
          return this.resolveFieldPreviewValue(component.fieldKey);
        case 'year':
          return today.getUTCFullYear().toString();
        case 'month':
          return String(today.getUTCMonth() + 1).padStart(2, '0');
        case 'day':
          return String(today.getUTCDate()).padStart(2, '0');
        case 'sequence':
          return sampleSequence;
        default:
          return '...';
      }
    });

    return parts.join(separator);
  }

  get isCustomReferenceMode(): boolean {
    return this.normalizeReferenceMode(this.referencePolicyForm.getRawValue()['referenceMode']) === 'custom';
  }

  get requiredReferenceFieldOptions(): Array<{ label: string; value: string }> {
    const options: Array<{ label: string; value: string }> = [];
    const seen = new Set<string>();

    for (const binding of this.bindings ?? []) {
      const fieldKey = this.normalizeNullable(binding.fieldKey);
      if (!fieldKey) {
        continue;
      }

      const normalizedFieldKey = this.normalizeFieldKey(fieldKey);
      if (seen.has(normalizedFieldKey)) {
        continue;
      }

      if (binding.required !== true) {
        continue;
      }

      if (binding.visible === false) {
        continue;
      }

      seen.add(normalizedFieldKey);
      options.push({
        label: `${this.normalizeNullable(binding.label) ?? fieldKey} (${fieldKey})`,
        value: fieldKey
      });
    }

    return options;
  }

  onAddFromLibrary(item: ReusableFieldLibraryItem): void {
    const newBinding = this.bindingEngine.createBindingFromLibrary(item, this.bindings);
    const normalizedFieldKey = this.normalizeFieldKey(item.fieldKey);
    const existingField = this.fieldCatalogByKey.get(normalizedFieldKey);
    const defaultGroupId = this.resolveDefaultGroupId();

    const enriched: BoundFieldItem = {
      ...newBinding,
      fieldKey: item.fieldKey,
      label: item.label,
      type: item.type,
      cdmendSql: existingField?.cdmendSql,
      groupId: defaultGroupId ?? undefined,
      groupName: this.resolveGroupName(defaultGroupId),
      defaultValue: existingField?.defaultValue ?? newBinding.defaultValue,
      required: existingField?.required === true ? true : newBinding.required,
      readonly: existingField?.isDisabledInit === true ? true : newBinding.readonly,
      sourceFieldId: existingField?.cdmendSql ? `fld-${existingField.cdmendSql}` : newBinding.sourceFieldId,
      dynamicRuntimeJson: ''
    };

    this.bindings = this.bindingEngine.normalizeDisplayOrder([...this.bindings, enriched]);
    this.evaluateBindings(true, true);
  }

  async onCreateField(): Promise<void> {
    this.stepMessageSeverity = 'warn';
    this.stepMessage = 'إنشاء الحقول تم نقله إلى شاشة مكتبة الحقول فقط. يمكنك إنشاء الحقل من هناك ثم العودة لربطه هنا.';
  }

  onDeleteBinding(binding: BoundFieldItem): void {
    this.clearDynamicRuntimeAdvancedStateForBinding(binding.bindingId);
    this.bindings = this.bindingEngine.normalizeDisplayOrder(
      this.bindings.filter(item => item.bindingId !== binding.bindingId)
    );
    this.pruneDynamicRuntimeAdvancedState();
    this.evaluateBindings(true, true);
  }

  onMoveBindingUp(binding: BoundFieldItem): void {
    this.moveBinding(binding, -1);
  }

  onMoveBindingDown(binding: BoundFieldItem): void {
    this.moveBinding(binding, 1);
  }

  onBindingChanged(): void {
    const defaultGroupId = this.resolveDefaultGroupId();
    this.bindings = this.bindingEngine.normalizeDisplayOrder(
      this.bindings.map(item => {
        const normalizedFieldKey = this.normalizeNullable(item.fieldKey) ?? '';
        const normalizedLabel = this.normalizeNullable(item.label) ?? normalizedFieldKey;
        const displayOrder = this.toPositiveInt(item.displayOrder) ?? 1;
        const groupId = this.toPositiveInt(item.groupId) ?? defaultGroupId ?? 0;
        const resolvedRuntimeJson = this.resolveBindingRuntimeJson(item);

        return {
          ...item,
          fieldKey: normalizedFieldKey,
          label: normalizedLabel,
          type: this.normalizeBindingType(item.type),
          defaultValue: String(item.defaultValue ?? '').trim(),
          dynamicRuntimeJson: resolvedRuntimeJson,
          displayOrder,
          groupId,
          groupName: this.resolveGroupName(groupId)
        };
      })
    );
    this.pruneDynamicRuntimeAdvancedState();
    this.evaluateBindings(true, true);
  }

  isDynamicRuntimeAdvancedModeOpen(binding: Pick<BoundFieldItem, 'bindingId'>): boolean {
    return this.dynamicRuntimeAdvancedOpenBindingIds.has(binding.bindingId);
  }

  toggleDynamicRuntimeAdvancedMode(binding: BoundFieldItem): void {
    const bindingId = binding.bindingId;
    if (this.dynamicRuntimeAdvancedOpenBindingIds.has(bindingId)) {
      this.clearDynamicRuntimeAdvancedStateForBinding(bindingId);
      return;
    }

    this.dynamicRuntimeAdvancedOpenBindingIds.add(bindingId);
    this.dynamicRuntimeAdvancedDraftByBindingId.set(bindingId, this.resolveBindingRuntimeJson(binding));
    this.dynamicRuntimeAdvancedErrorByBindingId.delete(bindingId);
  }

  getDynamicRuntimeReadonlyMirror(binding: BoundFieldItem): string {
    return this.resolveBindingRuntimeJson(binding);
  }

  getBindingOptionSourceSummary(binding: BoundFieldItem): string {
    const existingField = this.fieldCatalogByKey.get(this.normalizeFieldKey(binding.fieldKey)) ?? null;
    const decision = this.resolveBindingOptionSourceDecision(binding, existingField);
    const staticCount = decision.staticOptionsCount;
    const sourceLabel = decision.source === 'Static'
      ? 'ثابت'
      : decision.source === 'Internal'
        ? 'داخلي'
        : decision.source === 'External'
          ? 'خارجي'
          : 'غير محدد';

    if (decision.source === 'Static') {
      const countLabel = staticCount > 0 ? ` (${staticCount} خيار)` : '';
      if (existingField?.isActive === false) {
        return `مصدر الخيارات الفعلي: ${sourceLabel}${countLabel} من تعريف الحقل (تعريف الحقل غير مفعّل ويعمل عبر التوافق القديم).`;
      }

      return `مصدر الخيارات الفعلي: ${sourceLabel}${countLabel} من تعريف الحقل.`;
    }

    if (decision.source === 'Internal' || decision.source === 'External') {
      return `مصدر الخيارات الفعلي: ${sourceLabel} عبر السلوك الديناميكي.`;
    }

    return 'مصدر الخيارات الفعلي: غير محدد. هذا الحقل لن يعرض خيارات صالحة وقت التنفيذ.';
  }

  getDynamicRuntimeMirrorSummary(binding: BoundFieldItem): string {
    const runtimeJson = this.normalizeNullable(this.getDynamicRuntimeReadonlyMirror(binding));
    return runtimeJson ?? 'لا يوجد إعداد ديناميكي.';
  }

  getDynamicRuntimeAdvancedDraft(binding: BoundFieldItem): string {
    const bindingId = binding.bindingId;
    const existing = this.dynamicRuntimeAdvancedDraftByBindingId.get(bindingId);
    if (existing != null) {
      return existing;
    }

    const resolved = this.resolveBindingRuntimeJson(binding);
    this.dynamicRuntimeAdvancedDraftByBindingId.set(bindingId, resolved);
    return resolved;
  }

  onDynamicRuntimeAdvancedDraftChange(binding: BoundFieldItem, value: string): void {
    this.dynamicRuntimeAdvancedDraftByBindingId.set(binding.bindingId, String(value ?? ''));
    this.dynamicRuntimeAdvancedErrorByBindingId.delete(binding.bindingId);
  }

  onApplyDynamicRuntimeAdvancedDraft(binding: BoundFieldItem): void {
    const bindingId = binding.bindingId;
    const draft = this.normalizeNullable(this.dynamicRuntimeAdvancedDraftByBindingId.get(bindingId));
    if (!draft) {
      this.updateBindingDynamicRuntimeState(bindingId, '');
      this.dynamicRuntimeAdvancedDraftByBindingId.set(bindingId, '');
      this.dynamicRuntimeAdvancedErrorByBindingId.delete(bindingId);
      this.onBindingChanged();
      return;
    }

    const normalizedRuntime = this.parseSupportedDynamicRuntimeJson(draft);
    if (!normalizedRuntime) {
      const errorMessage = 'الـ JSON المتقدم غير صالح أو لا يطابق عقد dynamicRuntime المدعوم.';
      this.dynamicRuntimeAdvancedErrorByBindingId.set(bindingId, errorMessage);
      this.stepMessageSeverity = 'warn';
      this.stepMessage = errorMessage;
      return;
    }

    const runtimeJson = JSON.stringify(normalizedRuntime, null, 2);
    this.updateBindingDynamicRuntimeState(bindingId, runtimeJson);
    this.dynamicRuntimeAdvancedDraftByBindingId.set(bindingId, runtimeJson);
    this.dynamicRuntimeAdvancedErrorByBindingId.delete(bindingId);
    this.onBindingChanged();
  }

  onResetDynamicRuntimeAdvancedDraft(binding: BoundFieldItem): void {
    const resolved = this.resolveBindingRuntimeJson(binding);
    this.dynamicRuntimeAdvancedDraftByBindingId.set(binding.bindingId, resolved);
    this.dynamicRuntimeAdvancedErrorByBindingId.delete(binding.bindingId);
  }

  getDynamicRuntimeAdvancedError(binding: Pick<BoundFieldItem, 'bindingId'>): string | null {
    return this.dynamicRuntimeAdvancedErrorByBindingId.get(binding.bindingId) ?? null;
  }

  onOpenDynamicRuntimeBuilder(binding: BoundFieldItem): void {
    this.dynamicRuntimeBuilderTargetBindingId = binding.bindingId;
    this.dynamicRuntimeBuilderModel = this.createBuilderModelFromRuntimeJson(this.resolveBuilderRuntimeJson(binding));
    this.dynamicRuntimeBuilderVisible = true;
  }

  onCancelDynamicRuntimeBuilder(): void {
    this.dynamicRuntimeBuilderVisible = false;
    this.dynamicRuntimeBuilderTargetBindingId = null;
  }

  onDynamicRuntimeBuilderDialogHide(): void {
    this.dynamicRuntimeBuilderVisible = false;
    this.dynamicRuntimeBuilderTargetBindingId = null;
  }

  onSaveDynamicRuntimeBuilder(): void {
    if (!this.dynamicRuntimeBuilderTargetBindingId) {
      this.onCancelDynamicRuntimeBuilder();
      return;
    }

    const targetBindingId = this.dynamicRuntimeBuilderTargetBindingId;
    const builderIssues = this.dynamicRuntimeBuilderInlineValidationIssues;
    if (builderIssues.length > 0) {
      this.stepMessageSeverity = 'warn';
      this.stepMessage = builderIssues[0];
      return;
    }

    const runtimeConfig = this.buildRuntimeConfigFromBuilder(this.dynamicRuntimeBuilderModel);
    if (!runtimeConfig) {
      this.stepMessageSeverity = 'warn';
      this.stepMessage = 'تعذر تطبيق إعدادات السلوك الديناميكي بسبب نقص أو تعارض في بيانات المنشئ.';
      return;
    }

    const runtimeJson = JSON.stringify(runtimeConfig, null, 2);
    this.bindings = this.bindings.map(binding => {
      if (binding.bindingId !== targetBindingId) {
        return binding;
      }

      const nextBinding: BoundFieldItem = {
        ...binding,
        dynamicRuntimeJson: runtimeJson
      };

      return {
        ...nextBinding,
        displaySettingsJson: this.buildDisplaySettingsJson(binding.displaySettingsJson, nextBinding)
      };
    });

    this.syncDynamicRuntimeAdvancedDraftForBinding(targetBindingId, runtimeJson);
    this.onCancelDynamicRuntimeBuilder();
    this.onBindingChanged();
    this.stepMessageSeverity = 'warn';
    this.stepMessage = 'تم تطبيق إعدادات السلوك الديناميكي على الحقل محليًا فقط. اضغط "حفظ في قاعدة البيانات" لتثبيت التعديل فعليًا.';
  }

  onAddDynamicRuntimeBinding(
    listName: 'parameters' | 'query' | 'body' | 'headers' | 'customHeaders'
  ): void {
    this.dynamicRuntimeBuilderModel[listName].push(this.createDefaultBuilderBinding());
  }

  onRemoveDynamicRuntimeBinding(
    listName: 'parameters' | 'query' | 'body' | 'headers' | 'customHeaders',
    index: number
  ): void {
    this.dynamicRuntimeBuilderModel[listName].splice(index, 1);
  }

  onAddDynamicRuntimePatch(): void {
    this.dynamicRuntimeBuilderModel.patches.push(this.createDefaultBuilderPatch());
  }

  onRemoveDynamicRuntimePatch(index: number): void {
    this.dynamicRuntimeBuilderModel.patches.splice(index, 1);
  }

  onApplyDynamicRuntimePowerBiOptionLoaderPreset(): void {
    this.dynamicRuntimeBuilderModel.behaviorType = 'optionLoader';
    this.dynamicRuntimeBuilderModel.trigger = 'init';
    this.dynamicRuntimeBuilderModel.sourceType = 'powerbi';
    this.dynamicRuntimeBuilderModel.requestFormat = 'json';
    this.dynamicRuntimeBuilderModel.authMode = 'bearerCurrent';
    this.dynamicRuntimeBuilderModel.sourceFieldKey = '';
    this.dynamicRuntimeBuilderModel.fullUrl = '';
    this.dynamicRuntimeBuilderModel.method = 'GET';
    this.dynamicRuntimeBuilderModel.query = [];
    this.dynamicRuntimeBuilderModel.body = [];
    this.dynamicRuntimeBuilderModel.headers = [];
    this.dynamicRuntimeBuilderModel.customHeaders = [];
    this.dynamicRuntimeBuilderModel.debounceMs = null;
    this.dynamicRuntimeBuilderModel.minValueLength = null;
    this.dynamicRuntimeBuilderModel.responseValidPath = '';
    this.dynamicRuntimeBuilderModel.responseMessagePath = '';
    this.dynamicRuntimeBuilderModel.defaultErrorMessage = '';
    this.dynamicRuntimeBuilderModel.whenEquals = '';
    this.dynamicRuntimeBuilderModel.clearTargetsWhenEmpty = false;
    this.dynamicRuntimeBuilderModel.patches = [this.createDefaultBuilderPatch()];

    if (!Array.isArray(this.dynamicRuntimeBuilderModel.parameters) || this.dynamicRuntimeBuilderModel.parameters.length === 0) {
      this.dynamicRuntimeBuilderModel.parameters = [this.createDefaultBuilderBinding()];
    }
  }

  onApplyDynamicRuntimeExternalAsyncValidationPreset(): void {
    this.dynamicRuntimeBuilderModel.behaviorType = 'asyncValidation';
    this.dynamicRuntimeBuilderModel.trigger = 'blur';
    this.dynamicRuntimeBuilderModel.sourceType = 'external';
    this.dynamicRuntimeBuilderModel.requestFormat = 'json';
    this.dynamicRuntimeBuilderModel.authMode = 'bearerCurrent';
    this.dynamicRuntimeBuilderModel.sourceFieldKey = '';
    this.dynamicRuntimeBuilderModel.statementId = null;
    this.dynamicRuntimeBuilderModel.parameters = [];
    this.dynamicRuntimeBuilderModel.fullUrl = '';
    this.dynamicRuntimeBuilderModel.method = 'GET';
    this.dynamicRuntimeBuilderModel.query = [this.createDefaultBuilderBinding()];
    this.dynamicRuntimeBuilderModel.body = [];
    this.dynamicRuntimeBuilderModel.headers = [];
    this.dynamicRuntimeBuilderModel.customHeaders = [];
    this.dynamicRuntimeBuilderModel.minQueryLength = null;
    this.dynamicRuntimeBuilderModel.responseListPath = '';
    this.dynamicRuntimeBuilderModel.responseValuePath = '';
    this.dynamicRuntimeBuilderModel.responseLabelPath = '';
    this.dynamicRuntimeBuilderModel.clearWhenSourceEmpty = false;
    this.dynamicRuntimeBuilderModel.responseValidPath = 'isValid';
    this.dynamicRuntimeBuilderModel.responseMessagePath = 'message';
    this.dynamicRuntimeBuilderModel.defaultErrorMessage = '';
    this.dynamicRuntimeBuilderModel.debounceMs = 300;
    this.dynamicRuntimeBuilderModel.minValueLength = null;
    this.dynamicRuntimeBuilderModel.whenEquals = '';
    this.dynamicRuntimeBuilderModel.clearTargetsWhenEmpty = false;
    this.dynamicRuntimeBuilderModel.patches = [this.createDefaultBuilderPatch()];
  }

  get isDynamicRuntimePowerBiSource(): boolean {
    return this.dynamicRuntimeBuilderModel.sourceType === 'powerbi';
  }

  get isDynamicRuntimeExternalSource(): boolean {
    return this.dynamicRuntimeBuilderModel.sourceType === 'external';
  }

  get isDynamicRuntimeCustomAuth(): boolean {
    return this.dynamicRuntimeBuilderModel.authMode === 'custom';
  }

  get isDynamicRuntimeOptionLoaderBehavior(): boolean {
    return this.dynamicRuntimeBuilderModel.behaviorType === 'optionLoader';
  }

  get isDynamicRuntimeAsyncValidationBehavior(): boolean {
    return this.dynamicRuntimeBuilderModel.behaviorType === 'asyncValidation';
  }

  get isDynamicRuntimeAutofillBehavior(): boolean {
    return this.dynamicRuntimeBuilderModel.behaviorType === 'autofill';
  }

  get dynamicRuntimeBuilderInlineValidationIssues(): string[] {
    return this.collectDynamicRuntimeBuilderInlineValidationIssues(this.dynamicRuntimeBuilderModel);
  }

  get isDynamicRuntimeBuilderReadyToApply(): boolean {
    return this.dynamicRuntimeBuilderInlineValidationIssues.length === 0;
  }

  get isDynamicRuntimeBuilderStatementIdMissing(): boolean {
    return this.isDynamicRuntimePowerBiSource && !this.toPositiveInt(this.dynamicRuntimeBuilderModel.statementId);
  }

  get isDynamicRuntimeBuilderExternalUrlMissing(): boolean {
    return this.isDynamicRuntimeExternalSource && !this.normalizeNullable(this.dynamicRuntimeBuilderModel.fullUrl);
  }

  onAddReferenceComponent(): void {
    const components = this.getNormalizedReferenceComponents();
    const sequenceIndex = components.findIndex(component => component.type === 'sequence');
    const insertIndex = sequenceIndex >= 0 ? sequenceIndex : components.length;
    components.splice(insertIndex, 0, this.createReferenceComponent('static_text'));
    this.setReferenceComponents(components);
    this.evaluateBindings(true, true);
  }

  onDeleteReferenceComponent(index: number): void {
    const components = this.getNormalizedReferenceComponents();
    const target = components[index];
    if (!target) {
      return;
    }

    if (target.type === 'sequence') {
      this.stepMessageSeverity = 'warn';
      this.stepMessage = 'لا يمكن حذف مكوّن المسلسل لأنه إلزامي.';
      return;
    }

    components.splice(index, 1);
    this.setReferenceComponents(components);
    this.evaluateBindings(true, true);
  }

  onMoveReferenceComponentUp(index: number): void {
    const components = this.getNormalizedReferenceComponents();
    const target = components[index];
    if (!target || index <= 0 || target.type === 'sequence') {
      return;
    }

    const reordered = [...components];
    [reordered[index - 1], reordered[index]] = [reordered[index], reordered[index - 1]];
    this.setReferenceComponents(reordered);
    this.evaluateBindings(true, true);
  }

  onMoveReferenceComponentDown(index: number): void {
    const components = this.getNormalizedReferenceComponents();
    const target = components[index];
    if (!target || index < 0 || index >= components.length - 1 || target.type === 'sequence') {
      return;
    }

    const reordered = [...components];
    [reordered[index + 1], reordered[index]] = [reordered[index], reordered[index + 1]];
    this.setReferenceComponents(reordered);
    this.evaluateBindings(true, true);
  }

  onReferenceComponentTypeChanged(index: number, nextTypeRaw: unknown): void {
    const components = this.getRawReferenceComponentsFromForm();
    if (index < 0 || index >= components.length) {
      return;
    }

    const nextType = this.normalizeReferenceComponentType(nextTypeRaw);
    const target = components[index];
    target.type = nextType;
    if (nextType !== 'static_text') {
      target.value = undefined;
    }

    if (nextType !== 'field') {
      target.fieldKey = undefined;
    }

    this.setReferenceComponents(components);
    this.evaluateBindings(true, true);
  }

  onReferenceComponentValueChanged(): void {
    this.evaluateBindings(true, true);
  }

  onSerialIdSelected(): void {
    if (this.syncingFromStore) {
      return;
    }

    const selectedSerialId = this.toPositiveInt(this.referencePolicyForm.getRawValue()['serialId']);
    if (!selectedSerialId) {
      return;
    }

    this.referencePolicyForm.patchValue({
      serialName: ''
    }, { emitEvent: false });
  }

  onSerialNameEdited(): void {
    if (this.syncingFromStore) {
      return;
    }

    const raw = this.referencePolicyForm.getRawValue();
    const serialName = this.normalizeSerialName(raw['serialName']);
    if (!serialName) {
      return;
    }

    this.referencePolicyForm.patchValue({
      serialId: null
    }, { emitEvent: false });
  }

  async onSaveToBackend(): Promise<void> {
    this.evaluateBindings(true, false);

    const preSaveBlockingReasons = this.collectPreSaveBlockingReasons();
    if (preSaveBlockingReasons.length > 0) {
      this.setSaveGuardBlockedMessage(
        'collectPreSaveBlockingReasons()',
        preSaveBlockingReasons
      );
      return;
    }

    if (!this.currentCategoryId) {
      this.setSaveGuardBlockedMessage('!currentCategoryId', ['التصنيف الحالي غير صالح أو غير محدد.']);
      return;
    }

    if (!this.currentApplicationId) {
      this.setSaveGuardBlockedMessage('!currentApplicationId', ['التطبيق الحالي غير صالح أو غير محدد.']);
      return;
    }

    if (!this.backendWorkspaceLoaded) {
      this.setSaveGuardBlockedMessage('!backendWorkspaceLoaded', ['لم يتم تحميل بيانات الربط الفعلية من قاعدة البيانات بعد.']);
      return;
    }

    this.savingToBackend = true;
    this.stepMessage = '';

    try {
      await this.persistBindingsToBackend(this.currentCategoryId, this.currentApplicationId);
      this.hasPendingBackendChanges = false;
      this.clearDraftFromLocalStorage();
      this.stepMessageSeverity = 'success';
      this.stepMessage = 'تم حفظ ربط الحقول وترتيبها في قاعدة البيانات بنجاح.';
      this.msgsService?.msgSuccess('تم حفظ ربط الحقول وترتيبها في قاعدة البيانات بنجاح.', 3000, true);
    } catch (error) {
      this.stepMessageSeverity = 'warn';
      this.stepMessage = this.toErrorMessage(error, 'تعذر حفظ التعديلات في قاعدة البيانات.');
      this.msgsService?.msgError('فشل الحفظ', this.stepMessage, true);
    } finally {
      this.savingToBackend = false;
    }
  }

  private setSaveGuardBlockedMessage(
    guardName: 'collectPreSaveBlockingReasons()' | '!currentCategoryId' | '!currentApplicationId' | '!backendWorkspaceLoaded',
    reasons: ReadonlyArray<string>
  ): void {
    const compactReasons = reasons
      .map(reason => String(reason ?? '').trim())
      .filter(reason => reason.length > 0);
    const diagnostics = this.buildSaveGuardSnapshot();

    this.stepMessageSeverity = 'warn';
    if (compactReasons.length === 0) {
      this.stepMessage = `تعذر تنفيذ "حفظ في قاعدة البيانات" عند ${guardName}. ${diagnostics}`;
      return;
    }

    this.stepMessage = `تعذر تنفيذ "حفظ في قاعدة البيانات" عند ${guardName}. الأسباب: ${compactReasons.join(' | ')}. ${diagnostics}`;
  }

  private collectPreSaveBlockingReasons(): string[] {
    const reasons: string[] = [];

    if (!this.validation.isValid) {
      const blockingIssuesPreview = this.validation.blockingIssues
        .map(issue => String(issue ?? '').trim())
        .filter(issue => issue.length > 0)
        .slice(0, 3);
      reasons.push(
        blockingIssuesPreview.length > 0
          ? `يوجد مانع ربط: ${blockingIssuesPreview.join(' | ')}`
          : 'يوجد مانع في ربط الحقول يمنع الحفظ.'
      );
    }

    return reasons;
  }

  private collectLocalRuntimeDraftBlockingReasons(): string[] {
    const reasons: string[] = [];

    if (this.dynamicRuntimeBuilderVisible || this.dynamicRuntimeBuilderTargetBindingId) {
      reasons.push('يوجد تعديل محلي داخل "منشئ التكامل" لم يُطبّق على الحقل بعد.');
    }

    const unappliedAdvancedDrafts = this.collectUnappliedAdvancedRuntimeDrafts();
    if (unappliedAdvancedDrafts.length > 0) {
      reasons.push(`يوجد JSON متقدم غير مطبّق: ${unappliedAdvancedDrafts.join(' | ')}`);
    }

    return reasons;
  }

  private collectUnappliedAdvancedRuntimeDrafts(): string[] {
    const details: string[] = [];

    for (const bindingId of Array.from(this.dynamicRuntimeAdvancedOpenBindingIds)) {
      const draft = this.dynamicRuntimeAdvancedDraftByBindingId.get(bindingId);
      if (draft == null) {
        continue;
      }

      const binding = this.bindings.find(item => item.bindingId === bindingId);
      if (!binding) {
        continue;
      }

      const hasPendingDraft = this.hasUnappliedAdvancedRuntimeDraft(binding, draft);
      if (!hasPendingDraft) {
        continue;
      }

      details.push(binding.label || binding.fieldKey);
    }

    return details;
  }

  private hasUnappliedAdvancedRuntimeDraft(binding: BoundFieldItem, draftRaw: string): boolean {
    const draft = this.normalizeNullable(draftRaw);
    const currentRuntime = this.normalizeNullable(this.resolveBindingRuntimeJson(binding));

    if (!draft) {
      return currentRuntime != null;
    }

    const draftRuntime = this.parseSupportedDynamicRuntimeJson(draft);
    if (!draftRuntime) {
      return true;
    }

    if (!currentRuntime) {
      return true;
    }

    const currentParsed = this.parseSupportedDynamicRuntimeJson(currentRuntime);
    if (!currentParsed) {
      return true;
    }

    return JSON.stringify(draftRuntime) !== JSON.stringify(currentParsed);
  }

  private collectInvalidControlDetails(form: FormGroup, labelByControlName: Readonly<Record<string, string>>): string[] {
    const details: string[] = [];

    for (const [controlName, control] of Object.entries(form.controls)) {
      if (!control || control.valid) {
        continue;
      }

      const label = labelByControlName[controlName] ?? controlName;
      const errorKeys = Object.keys(control.errors ?? {}).filter(key => key.trim().length > 0);
      if (errorKeys.length === 0) {
        details.push(label);
        continue;
      }

      details.push(`${label} (${errorKeys.join(', ')})`);
    }

    return details;
  }

  private buildSaveGuardSnapshot(): string {
    const category = this.currentCategoryId ?? 'null';
    const application = this.currentApplicationId ?? 'null';
    const advancedDraftCount = Array.from(this.dynamicRuntimeAdvancedOpenBindingIds).length;

    return `الحالة الحالية => referencePolicyForm.invalid=${this.referencePolicyForm.invalid}, presentationForm.invalid=${this.presentationForm.invalid}, validation.isValid=${this.validation.isValid}, backendWorkspaceLoaded=${this.backendWorkspaceLoaded}, dynamicRuntimeBuilderVisible=${this.dynamicRuntimeBuilderVisible}, dynamicRuntimeBuilderTargetBindingId=${this.dynamicRuntimeBuilderTargetBindingId ?? 'null'}, openedAdvancedRuntimeDrafts=${advancedDraftCount}, currentCategoryId=${category}, currentApplicationId=${application}`;
  }

  onSaveDraft(): void {
    this.evaluateBindings(true, false);
    if (!this.persistDraftToLocalStorage()) {
      this.stepMessageSeverity = 'warn';
      this.stepMessage = 'تعذر حفظ المسودة محليًا بسبب عدم توفر سياق التصنيف/التطبيق.';
      return;
    }

    this.stepMessageSeverity = 'success';
    this.stepMessage = 'تم حفظ المسودة محليًا بنجاح.';
  }

  onBackToCatalogDashboard(): void {
    this.stepMessage = '';
    this.router.navigate(['/Admin/ControlCenterCatalog'], {
      queryParams: {
        categoryId: this.currentCategoryId ?? undefined,
        applicationId: this.currentApplicationId ?? undefined
      }
    });
  }

  isFieldAlreadyBound(item: ReusableFieldLibraryItem): boolean {
    const normalizedKey = this.normalizeFieldKey(item.fieldKey);
    return this.bindings.some(binding => this.normalizeFieldKey(binding.fieldKey) === normalizedKey);
  }

  private evaluateBindings(syncToStore: boolean, markBackendDirty = false): void {
    const baseValidation = this.bindingEngine.validateBindings(this.bindings);
    const groupIssues = this.collectGroupValidationIssues(this.bindings);
    this.referencePolicyBlockingIssues = [];

    this.validation = {
      isValid: baseValidation.isValid
        && groupIssues.length === 0,
      blockingIssues: [...baseValidation.blockingIssues, ...groupIssues],
      warnings: baseValidation.warnings
    };

    if (!syncToStore) {
      this.refreshStepState(this.validation.isValid ? 'valid' : 'draft');
      return;
    }

    const syncToken = this.validation.isValid ? 'valid' : 'draft';
    this.syncStepValues(syncToken, markBackendDirty);
  }

  private syncStepValues(syncToken: 'valid' | 'draft', markBackendDirty: boolean): void {
    if (markBackendDirty) {
      this.hasPendingBackendChanges = true;
    }

    this.refreshStepState(syncToken);
  }

  private async loadBackendWorkspace(categoryId: number, applicationId: string | null): Promise<void> {
    const loadToken = ++this.activeLoadToken;
    this.loadingLibrary = true;
    this.stepMessage = '';

    try {
      const [fieldsResponse, groupsResponse, linksResponse] = await Promise.all([
        firstValueFrom(this.dynamicSubjectsController.getAdminFields(applicationId ?? undefined)),
        firstValueFrom(this.adminCatalogController.getGroupsByCategory(categoryId)),
        firstValueFrom(this.dynamicSubjectsController.getAdminCategoryFieldLinks(categoryId))
      ]);

      if (loadToken !== this.activeLoadToken) {
        return;
      }

      const fields = this.readArrayResponse(fieldsResponse, 'تعذر تحميل مكتبة الحقول من قاعدة البيانات.');
      const groupTree = this.readArrayResponse(groupsResponse, 'تعذر تحميل شجرة الجروبات من قاعدة البيانات.');
      const groups = this.flattenAdminCatalogGroups(groupTree);
      const links = this.readArrayResponse(linksResponse, 'تعذر تحميل روابط الحقول من قاعدة البيانات.');
      const {
        subjectTypes,
        resolvedSubjectType,
        loadWarning: subjectTypesLoadWarning
      } = await this.loadSubjectTypesForWorkspace(categoryId, applicationId);
      if (loadToken !== this.activeLoadToken) {
        return;
      }

      this.groups = [...groups].sort((left, right) => left.groupId - right.groupId);
      this.groupOptions = this.groups.map(group => ({
        label: `${group.groupName ?? `مجموعة ${group.groupId}`} (${group.groupId})`,
        value: group.groupId
      }));

      for (const link of links) {
        const linkGroupId = this.toPositiveInt(link.groupId);
        if (!linkGroupId) {
          continue;
        }

        const alreadyExists = this.groupOptions.some(option => option.value === linkGroupId);
        if (alreadyExists) {
          continue;
        }

        const label = this.normalizeNullable(link.groupName) ?? `مجموعة ${linkGroupId}`;
        this.groupOptions.push({
          label: `${label} (${linkGroupId})`,
          value: linkGroupId
        });
      }

      const currentNewFieldRaw = this.newFieldForm.getRawValue();
      const currentNewFieldGroupId = this.toPositiveInt(currentNewFieldRaw['groupId']);
      const fallbackGroupId = currentNewFieldGroupId ?? this.resolveDefaultGroupId();
      if (fallbackGroupId) {
        this.newFieldForm.patchValue({ groupId: fallbackGroupId }, { emitEvent: false });
      }

      this.fieldCatalogByKey = new Map<string, SubjectAdminFieldDto>(
        fields.map(field => [this.normalizeFieldKey(field.fieldKey), field] as const)
      );

      this.reusableFields = fields
        .filter(field => field.isActive !== false)
        .sort((left, right) => left.fieldKey.localeCompare(right.fieldKey, 'en', { sensitivity: 'base' }))
        .map(field => this.mapFieldToReusableItem(field));

      const activeLinks = links
        .filter(link => link.isActive !== false)
        .sort((left, right) => left.displayOrder - right.displayOrder);

      this.bindings = this.bindingEngine.normalizeDisplayOrder(
        activeLinks.map(link => this.mapLinkToBinding(link))
      );
      this.pruneDynamicRuntimeAdvancedState();

      this.serialOptions = this.buildSerialOptions(subjectTypes);
      this.subjectTypeAdmin = resolvedSubjectType;
      this.patchReferencePolicyFormFromAdminType(this.subjectTypeAdmin);
      this.patchPresentationFormFromAdminType(this.subjectTypeAdmin);
      this.patchPresentationFormDefaultsIfMissing();

      this.backendWorkspaceLoaded = true;
      this.libraryLoadedFromDb = true;
      this.hasPendingBackendChanges = false;
      this.evaluateBindings(true, false);

      this.stepMessageSeverity = subjectTypesLoadWarning ? 'warn' : 'success';
      this.stepMessage = subjectTypesLoadWarning
        ? `تم تحميل مكتبة الحقول والروابط الفعلية من قاعدة البيانات، لكن تعذر تحميل إعدادات النوع: ${subjectTypesLoadWarning}`
        : 'تم تحميل مكتبة الحقول والروابط الفعلية من قاعدة البيانات.';
    } catch (error) {
      if (loadToken !== this.activeLoadToken) {
        return;
      }

      this.backendWorkspaceLoaded = false;
      this.libraryLoadedFromDb = false;
      this.reusableFields = [];
      this.serialOptions = [];
      this.fieldCatalogByKey.clear();
      this.pruneDynamicRuntimeAdvancedState();
      this.evaluateBindings(true, false);

      this.stepMessageSeverity = 'warn';
      this.stepMessage = this.toErrorMessage(error, 'تعذر تحميل بيانات الحقول من قاعدة البيانات. يرجى إعادة التحميل بعد التحقق من الاتصال.');
    } finally {
      if (loadToken === this.activeLoadToken) {
        this.loadingLibrary = false;
      }
    }
  }

  private async loadSubjectTypesForWorkspace(
    categoryId: number,
    applicationId: string | null
  ): Promise<{ subjectTypes: SubjectTypeAdminDto[]; resolvedSubjectType: SubjectTypeAdminDto | null; loadWarning: string | null }> {
    let scopedSubjectTypes: SubjectTypeAdminDto[] = [];

    try {
      const scopedResponse = await firstValueFrom(
        this.dynamicSubjectsController.getSubjectTypesAdminConfig(applicationId ?? undefined)
      );
      scopedSubjectTypes = this.readArrayResponse(scopedResponse, 'تعذر تحميل إعدادات النوع من قاعدة البيانات.');
    } catch (error) {
      return {
        subjectTypes: [],
        resolvedSubjectType: null,
        loadWarning: this.toErrorMessage(error, 'تعذر تحميل إعدادات النوع من قاعدة البيانات.')
      };
    }

    let subjectTypes = scopedSubjectTypes;
    let resolvedSubjectType = scopedSubjectTypes.find(item => Number(item.categoryId ?? 0) === categoryId) ?? null;
    if (resolvedSubjectType) {
      return {
        subjectTypes,
        resolvedSubjectType,
        loadWarning: null
      };
    }

    try {
      const fallbackResponse = await firstValueFrom(
        this.dynamicSubjectsController.getSubjectTypesAdminConfig(undefined)
      );
      const fallbackSubjectTypes = this.readArrayResponse(
        fallbackResponse,
        'تعذر تحميل إعدادات النوع من قاعدة البيانات.'
      );
      const fallbackMatch = fallbackSubjectTypes.find(item => Number(item.categoryId ?? 0) === categoryId) ?? null;
      if (fallbackMatch) {
        subjectTypes = fallbackSubjectTypes;
        resolvedSubjectType = fallbackMatch;
      }

      return {
        subjectTypes,
        resolvedSubjectType,
        loadWarning: null
      };
    } catch (error) {
      return {
        subjectTypes,
        resolvedSubjectType,
        loadWarning: this.toErrorMessage(error, 'تعذر تحميل إعدادات النوع من قاعدة البيانات.')
      };
    }
  }

  private mapFieldToReusableItem(field: SubjectAdminFieldDto): ReusableFieldLibraryItem {
    return {
      id: field.cdmendSql > 0 ? `fld-${field.cdmendSql}` : `fld-${field.fieldKey}`,
      fieldKey: field.fieldKey,
      label: this.normalizeNullable(field.fieldLabel) ?? field.fieldKey,
      type: this.mapBackendFieldTypeToBindingType(field.fieldType, field.dataType),
      defaultValue: field.defaultValue ?? '',
      requiredByDefault: field.required === true,
      readonlyByDefault: field.isDisabledInit === true
    };
  }

  private mapLinkToBinding(link: SubjectCategoryFieldLinkAdminDto): BoundFieldItem {
    const normalizedFieldKey = this.normalizeFieldKey(link.fieldKey);
    const fieldMetadata = this.fieldCatalogByKey.get(normalizedFieldKey);
    const readonlyFromDisplaySettings = this.readReadonlyFromDisplaySettings(link.displaySettingsJson);
    const groupId = this.toPositiveInt(link.groupId) ?? this.resolveDefaultGroupId() ?? 0;

    return {
      bindingId: `bind-${link.mendSql}-${normalizedFieldKey || Date.now()}`,
      sourceFieldId: fieldMetadata?.cdmendSql ? `fld-${fieldMetadata.cdmendSql}` : `link-${link.mendSql}`,
      fieldKey: link.fieldKey,
      label: this.normalizeNullable(fieldMetadata?.fieldLabel)
        ?? this.normalizeNullable(link.fieldLabel)
        ?? link.fieldKey,
      type: this.mapBackendFieldTypeToBindingType(fieldMetadata?.fieldType ?? link.fieldType, fieldMetadata?.dataType),
      displayOrder: this.toPositiveInt(link.displayOrder) ?? 1,
      visible: link.isVisible !== false,
      required: fieldMetadata?.required === true,
      readonly: readonlyFromDisplaySettings ?? fieldMetadata?.isDisabledInit === true,
      defaultValue: fieldMetadata?.defaultValue ?? '',
      mendSql: this.toPositiveInt(link.mendSql) ?? undefined,
      cdmendSql: this.toPositiveInt(fieldMetadata?.cdmendSql) ?? undefined,
      groupId,
      groupName: this.resolveGroupName(groupId),
      displaySettingsJson: link.displaySettingsJson ?? undefined,
      dynamicRuntimeJson: this.extractDynamicRuntimeJson(link.displaySettingsJson)
    };
  }

  private async persistBindingsToBackend(categoryId: number, applicationId: string | null): Promise<void> {
    if (this.bindings.length === 0) {
      throw new Error('يجب ربط حقل واحد على الأقل قبل الحفظ.');
    }

    if (this.validation.blockingIssues.length > 0) {
      throw new Error(this.validation.blockingIssues[0]);
    }

    const saveTraceContext: { stage: string; fieldKey: string | null } = {
      stage: 'تهيئة الحفظ',
      fieldKey: null
    };

    try {
      await this.ensureAtLeastOneGroupExists();

      const normalizedBindings = this.buildNormalizedBindingsForPersistence();
      this.bindings = normalizedBindings;
      this.pruneDynamicRuntimeAdvancedState();

      const latestLinksResponse = await firstValueFrom(
        this.dynamicSubjectsController.getAdminCategoryFieldLinks(categoryId)
      );
      const latestLinks = this.readArrayResponse(latestLinksResponse, 'تعذر تحميل روابط الحقول قبل الحفظ.');

      const latestLinksByKey = new Map<string, SubjectCategoryFieldLinkAdminDto>(
        latestLinks.map(item => [this.normalizeFieldKey(item.fieldKey), item] as const)
      );

      this.traceSaveDiagnostics('save.payload.before-field-upsert', normalizedBindings.map(binding => {
        const existing = this.fieldCatalogByKey.get(this.normalizeFieldKey(binding.fieldKey)) ?? null;
        return this.buildBindingSaveTraceRecord(binding, existing, null);
      }));

      for (const binding of normalizedBindings) {
        const normalizedFieldKey = this.normalizeFieldKey(binding.fieldKey);
        if (!normalizedFieldKey) {
          throw new Error('يوجد حقل بدون مفتاح صالح.');
        }

        const groupId = this.toPositiveInt(binding.groupId);
        if (!groupId) {
          throw new Error(`يرجى اختيار مجموعة صالحة للحقل ${binding.fieldKey}.`);
        }
      }

      const linkPayload: SubjectCategoryFieldLinkUpsertItemDto[] = normalizedBindings.map(binding => {
        const normalizedFieldKey = this.normalizeFieldKey(binding.fieldKey);
        const existingLink = latestLinksByKey.get(normalizedFieldKey) ?? null;

        return {
          mendSql: this.toPositiveInt(existingLink?.mendSql) ?? this.toPositiveInt(binding.mendSql) ?? undefined,
          fieldKey: binding.fieldKey,
          groupId: this.toPositiveInt(binding.groupId) ?? this.resolveDefaultGroupId() ?? 0,
          isActive: true,
          displayOrder: binding.displayOrder,
          isVisible: existingLink?.isVisible ?? true,
          displaySettingsJson: existingLink?.displaySettingsJson ?? undefined
        };
      });

      saveTraceContext.stage = 'حفظ روابط الحقول';
      saveTraceContext.fieldKey = null;
      this.traceSaveDiagnostics('save.payload.field-links-upsert', linkPayload.map(item => {
        const binding = normalizedBindings.find(candidate => this.normalizeFieldKey(candidate.fieldKey) === this.normalizeFieldKey(item.fieldKey));
        const existingField = this.fieldCatalogByKey.get(this.normalizeFieldKey(item.fieldKey)) ?? null;
        return this.buildBindingSaveTraceRecord(binding ?? null, existingField, item);
      }));
      this.readArrayResponse(
        await firstValueFrom(this.dynamicSubjectsController.upsertAdminCategoryFieldLinks(categoryId, { links: linkPayload })),
        'تعذر حفظ روابط الحقول في قاعدة البيانات.'
      );

      saveTraceContext.stage = 'إعادة تحميل مساحة العمل';
      await this.loadBackendWorkspace(categoryId, applicationId);
    } catch (error) {
      const baseMessage = this.toErrorMessage(error, 'تعذر حفظ التعديلات في قاعدة البيانات.');
      const contextLabels: string[] = [];
      const stageHint = this.normalizeNullable(saveTraceContext.stage);
      const fieldHint = this.normalizeNullable(saveTraceContext.fieldKey);
      if (stageHint) {
        contextLabels.push(`المرحلة: ${stageHint}`);
      }
      if (fieldHint) {
        contextLabels.push(`الحقل: ${fieldHint}`);
      }

      const contextualMessage = contextLabels.length > 0
        ? `${baseMessage} (${contextLabels.join(' | ')})`
        : baseMessage;

      this.traceSaveDiagnostics('save.failure', {
        message: baseMessage,
        contextualMessage,
        stage: saveTraceContext.stage,
        fieldKey: saveTraceContext.fieldKey
      });

      throw new Error(contextualMessage);
    }
  }

  private buildNormalizedBindingsForPersistence(): BoundFieldItem[] {
    const fallbackGroupId = this.resolveDefaultGroupId() ?? 0;

    return this.bindingEngine.normalizeDisplayOrder(
      this.bindings.map((binding, index) => {
        const groupId = this.toPositiveInt(binding.groupId) ?? fallbackGroupId;
        const runtimeJsonForPersistence = this.resolveBindingRuntimeJson(binding);

        const normalizedBinding: BoundFieldItem = {
          ...binding,
          fieldKey: this.normalizeNullable(binding.fieldKey) ?? '',
          label: this.normalizeNullable(binding.label) ?? '',
          displayOrder: index + 1,
          groupId,
          groupName: this.resolveGroupName(groupId),
          type: this.normalizeBindingType(binding.type),
          defaultValue: String(binding.defaultValue ?? '').trim(),
          dynamicRuntimeJson: runtimeJsonForPersistence
        };

        return {
          ...normalizedBinding,
          displaySettingsJson: this.buildDisplaySettingsJson(normalizedBinding.displaySettingsJson, normalizedBinding)
        };
      })
    );
  }

  private buildBindingSaveTraceRecord(
    binding: BoundFieldItem | null,
    existingField: SubjectAdminFieldDto | null,
    linkPayload: SubjectCategoryFieldLinkUpsertItemDto | null
  ): Record<string, unknown> {
    const fieldKey = this.normalizeNullable(linkPayload?.fieldKey)
      ?? this.normalizeNullable(binding?.fieldKey)
      ?? this.normalizeNullable(existingField?.fieldKey)
      ?? '';
    const runtimePayload = binding
      ? this.normalizeNullable(this.resolveBindingRuntimeJson(binding))
      : null;
    const optionSourceDecision = this.resolveBindingOptionSourceDecision(binding, existingField);

    return {
      bindingId: binding?.bindingId ?? null,
      mendSql: this.toPositiveInt(linkPayload?.mendSql) ?? this.toPositiveInt(binding?.mendSql) ?? null,
      cdmendSql: this.toPositiveInt(existingField?.cdmendSql) ?? this.toPositiveInt(binding?.cdmendSql) ?? null,
      fieldKey,
      fieldLabel: this.normalizeNullable(binding?.label)
        ?? this.normalizeNullable(existingField?.fieldLabel)
        ?? fieldKey,
      fieldType: this.normalizeNullable(this.mapBindingTypeToBackendFieldType(binding?.type ?? 'InputText'))
        ?? this.normalizeNullable(existingField?.fieldType),
      dataType: this.normalizeNullable(this.mapBindingTypeToBackendDataType(binding?.type ?? 'InputText'))
        ?? this.normalizeNullable(existingField?.dataType),
      defaultValue: this.normalizeNullable(binding?.defaultValue)
        ?? this.normalizeNullable(existingField?.defaultValue),
      optionsPayload: this.normalizeNullable(existingField?.optionsPayload),
      finalOptionSource: optionSourceDecision.source,
      finalOptionSourceReason: optionSourceDecision.reason,
      hasDynamicRuntimeConfig: optionSourceDecision.hasDynamicRuntimeConfig,
      hasBehavioralRuntimeConfig: optionSourceDecision.hasBehavioralRuntimeConfig,
      hasDynamicOptionSource: optionSourceDecision.hasDynamicOptionSource,
      dynamicOptionSourceKind: optionSourceDecision.dynamicOptionSourceKind ?? null,
      staticOptionsPayloadValid: optionSourceDecision.staticOptionsValid,
      staticOptionsCount: optionSourceDecision.staticOptionsCount,
      rawOptionsSource: optionSourceDecision.rawStaticSources.map(item => ({
        source: item.source,
        payload: item.payload
      })),
      normalizedOptionsCount: optionSourceDecision.staticOptionsCount,
      staticExcludedReason: optionSourceDecision.staticExcludedReason ?? null,
      displaySettingsJson: this.normalizeNullable(linkPayload?.displaySettingsJson)
        ?? this.normalizeNullable(binding?.displaySettingsJson),
      dynamicRuntimeJson: runtimePayload,
      groupId: this.toPositiveInt(linkPayload?.groupId) ?? this.toPositiveInt(binding?.groupId) ?? null,
      displayOrder: linkPayload?.displayOrder ?? binding?.displayOrder ?? null,
      isVisible: linkPayload?.isVisible ?? binding?.visible ?? true,
      required: binding?.required ?? existingField?.required ?? false,
      readonly: binding?.readonly ?? existingField?.isDisabledInit ?? false
    };
  }

  private traceSaveDiagnostics(scope: string, payload: unknown): void {
    if (!this.saveDiagnosticsMode) {
      return;
    }

    try {
      const timestamp = new Date().toISOString();
      console.groupCollapsed(`[FieldBinding][${scope}] ${timestamp}`);
      console.log(payload);
      if (Array.isArray(payload) && payload.length > 0) {
        console.table(payload);
      }
      console.groupEnd();
    } catch {
      // Ignore diagnostics failures to avoid blocking save flow.
    }
  }

  private resolveSaveDiagnosticsMode(): boolean {
    const queryFlag = String(this.route.snapshot.queryParamMap.get('diagnosticMode') ?? '')
      .trim()
      .toLowerCase();
    if (queryFlag === '1' || queryFlag === 'true' || queryFlag === 'on') {
      return true;
    }

    const traceFlag = String(this.route.snapshot.queryParamMap.get('traceSave') ?? '')
      .trim()
      .toLowerCase();
    if (traceFlag === '1' || traceFlag === 'true' || traceFlag === 'on') {
      return true;
    }

    return localStorage.getItem(FieldLibraryBindingPageComponent.SAVE_DIAGNOSTIC_MODE_STORAGE_KEY) === 'true';
  }

  private buildFieldUpsertRequest(
    binding: BoundFieldItem,
    existing: SubjectAdminFieldDto | null,
    applicationId: string | null
  ): SubjectAdminFieldUpsertRequestDto {
    const fieldType = this.mapBindingTypeToBackendFieldType(binding.type);
    const dataType = this.mapBindingTypeToBackendDataType(binding.type);

    return {
      cdmendSql: this.toPositiveInt(existing?.cdmendSql) ?? this.toPositiveInt(binding.cdmendSql) ?? undefined,
      fieldKey: binding.fieldKey,
      fieldType,
      fieldLabel: this.normalizeNullable(binding.label) ?? binding.fieldKey,
      placeholder: existing?.placeholder ?? undefined,
      defaultValue: this.normalizeNullable(binding.defaultValue) ?? undefined,
      optionsPayload: existing?.optionsPayload ?? undefined,
      dataType,
      required: binding.required === true,
      requiredTrue: binding.type === 'Checkbox' ? binding.required === true : false,
      email: existing?.email === true,
      pattern: existing?.pattern === true,
      minValue: existing?.minValue ?? undefined,
      maxValue: existing?.maxValue ?? undefined,
      mask: existing?.mask ?? undefined,
      isActive: true,
      width: this.toPositiveInt(existing?.width) ?? 0,
      height: this.toPositiveInt(existing?.height) ?? 0,
      isDisabledInit: binding.readonly === true,
      isSearchable: existing?.isSearchable === true,
      applicationId: applicationId ?? existing?.applicationId ?? undefined
    };
  }

  private buildSubjectTypeUpsertRequest(
    targetType: SubjectTypeAdminDto | null,
    normalizedBindings: ReadonlyArray<BoundFieldItem>
  ): SubjectTypeAdminUpsertRequestDto {
    const referenceValue = this.referencePolicyForm.getRawValue();
    const presentationValue = this.presentationForm.getRawValue();
    const referenceMode = this.normalizeReferenceMode(referenceValue['referenceMode']);
    const selectedSerialId = this.toPositiveInt(referenceValue['serialId']);
    const typedSerialName = this.normalizeSerialName(referenceValue['serialName']);
    const selectedSerialName = selectedSerialId
      ? this.resolveSerialLabelById(selectedSerialId)
      : null;
    const fallbackSerialName = this.normalizeSerialName(targetType?.serialName ?? targetType?.sequenceName);
    const resolvedSequenceName = selectedSerialName ?? typedSerialName ?? fallbackSerialName ?? null;
    const normalizedReferenceComponents = this.getNormalizedReferenceComponents();
    const referenceComponents = referenceMode === 'custom'
      ? this.serializeReferenceComponents(normalizedReferenceComponents)
      : [];

    return {
      isActive: targetType?.isActive !== false,
      referencePolicyEnabled: referenceValue['referencePolicyEnabled'] === true,
      referenceMode,
      referencePrefix: this.normalizeNullable(referenceValue['referencePrefix'])
        ?? targetType?.referencePrefix
        ?? '',
      referenceSeparator: this.normalizeReferenceSeparator(referenceValue['referenceSeparator']),
      referenceStartingValue: this.toSafeStartingValue(referenceValue['referenceStartingValue']),
      referenceComponents,
      sourceFieldKeys: referenceMode === 'custom'
        ? undefined
        : (this.normalizeNullable(targetType?.sourceFieldKeys)
          ?? this.buildDefaultSourceFieldKeys(normalizedBindings)),
      includeYear: false,
      useSequence: true,
      serialId: selectedSerialId ?? undefined,
      serialName: typedSerialName ?? undefined,
      sequenceName: resolvedSequenceName ?? undefined,
      sequencePaddingLength: this.toSafeSequenceLength(referenceValue['referenceSequencePaddingLength']),
      sequenceResetScope: this.normalizeSequenceResetScope(referenceValue['referenceSequenceResetScope']),
      requestPolicy: targetType?.requestPolicy,
      defaultDisplayMode: this.normalizeDisplayMode(presentationValue['defaultDisplayMode']),
      allowUserToChangeDisplayMode: presentationValue['allowUserToChangeDisplayMode'] === true
    };
  }

  private buildDefaultSourceFieldKeys(bindings: ReadonlyArray<BoundFieldItem>): string | undefined {
    const selected = bindings
      .filter(item => item.visible !== false)
      .map(item => this.normalizeNullable(item.fieldKey))
      .filter((item): item is string => !!item)
      .slice(0, 3);

    return selected.length > 0 ? selected.join(',') : undefined;
  }

  private buildSerialOptions(subjectTypes: ReadonlyArray<SubjectTypeAdminDto>): Array<{ label: string; value: number }> {
    const options: Array<{ label: string; value: number }> = [];
    const seen = new Set<string>();

    for (const item of subjectTypes ?? []) {
      const serialName = this.normalizeSerialName(item.serialName ?? item.sequenceName);
      const serialId = this.toPositiveInt(item.serialId) ?? this.toPositiveInt(item.referencePolicyId);
      if (!serialName || !serialId) {
        continue;
      }

      const key = this.normalizeSerialNameKey(serialName);
      if (key.length === 0 || seen.has(key)) {
        continue;
      }

      seen.add(key);
      options.push({
        label: serialName,
        value: serialId
      });
    }

    return options.sort((left, right) =>
      left.label.localeCompare(right.label, 'ar', { sensitivity: 'base' }));
  }

  private resolveSerialLabelById(serialId: number): string | null {
    return this.serialOptions.find(option => option.value === serialId)?.label ?? null;
  }

  private buildDisplaySettingsJson(existingRaw: string | undefined, binding: BoundFieldItem): string | undefined {
    const parsed = this.parseDisplaySettings(binding.displaySettingsJson ?? existingRaw) ?? {};
    parsed['readonly'] = binding.readonly === true;
    parsed['isReadonly'] = binding.readonly === true;

    const dynamicRuntime = this.parseDynamicRuntimeJson(binding.dynamicRuntimeJson);
    if (dynamicRuntime) {
      parsed['dynamicRuntime'] = dynamicRuntime;
    } else if (Object.prototype.hasOwnProperty.call(parsed, 'dynamicRuntime')) {
      delete parsed['dynamicRuntime'];
    }

    try {
      return JSON.stringify(parsed);
    } catch {
      return JSON.stringify({ readonly: binding.readonly === true, isReadonly: binding.readonly === true });
    }
  }

  private extractDynamicRuntimeJson(raw: string | undefined): string {
    const parsed = this.parseDisplaySettings(raw);
    if (!parsed) {
      return '';
    }

    let normalizedRuntime: Record<string, unknown> | null = null;
    if (Object.prototype.hasOwnProperty.call(parsed, 'dynamicRuntime')) {
      normalizedRuntime = this.parseDynamicRuntimeJson(parsed['dynamicRuntime']);
    }

    normalizedRuntime = normalizedRuntime ?? this.tryNormalizeRuntimeConfig(parsed);
    if (!normalizedRuntime) {
      return '';
    }

    try {
      return JSON.stringify(normalizedRuntime, null, 2);
    } catch {
      return '';
    }
  }

  private parseDynamicRuntimeJson(raw: unknown): Record<string, unknown> | null {
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      const candidate = raw as Record<string, unknown>;
      return this.tryNormalizeRuntimeConfig(candidate)
        ?? { ...candidate };
    }

    const payload = this.normalizeNullable(raw);
    if (!payload) {
      return null;
    }

    try {
      const parsed = JSON.parse(payload);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return null;
      }

      return this.tryNormalizeRuntimeConfig(parsed)
        ?? parsed as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  private tryNormalizeRuntimeConfig(source: unknown): Record<string, unknown> | null {
    if (source == null) {
      return null;
    }

    if (typeof source === 'string') {
      const payload = this.normalizeNullable(source);
      if (!payload) {
        return null;
      }

      try {
        return this.tryNormalizeRuntimeConfig(JSON.parse(payload));
      } catch {
        return null;
      }
    }

    if (typeof source !== 'object' || Array.isArray(source)) {
      return null;
    }

    const candidate = source as Record<string, unknown>;
    if (this.isRuntimeBehaviorPayload(candidate)) {
      return candidate;
    }

    if (!Object.prototype.hasOwnProperty.call(candidate, 'dynamicRuntime')) {
      return null;
    }

    return this.tryNormalizeRuntimeConfig(candidate['dynamicRuntime']);
  }

  private isRuntimeBehaviorPayload(payload: Record<string, unknown>): boolean {
    const optionLoader = payload['optionLoader'];
    if (optionLoader && typeof optionLoader === 'object' && !Array.isArray(optionLoader)) {
      return true;
    }

    const asyncValidation = payload['asyncValidation'];
    if (asyncValidation && typeof asyncValidation === 'object' && !Array.isArray(asyncValidation)) {
      return true;
    }

    const actions = payload['actions'];
    if (Array.isArray(actions)) {
      return true;
    }

    return false;
  }

  private resolveBuilderRuntimeJson(
    binding: Pick<BoundFieldItem, 'dynamicRuntimeJson' | 'displaySettingsJson'>
  ): string {
    const direct = this.normalizeNullable(binding.dynamicRuntimeJson);
    if (direct) {
      const normalizedDirect = this.parseSupportedDynamicRuntimeJson(direct);
      if (normalizedDirect) {
        try {
          return JSON.stringify(normalizedDirect, null, 2);
        } catch {
          return direct;
        }
      }
    }

    const fallback = this.extractDynamicRuntimeJson(binding.displaySettingsJson);
    if (!fallback) {
      return '';
    }

    const normalizedFallback = this.parseSupportedDynamicRuntimeJson(fallback);
    if (!normalizedFallback) {
      return '';
    }

    try {
      return JSON.stringify(normalizedFallback, null, 2);
    } catch {
      return fallback;
    }
  }

  private resolveBindingRuntimeJson(binding: Pick<BoundFieldItem, 'dynamicRuntimeJson' | 'displaySettingsJson'>): string {
    const direct = this.normalizeNullable(binding.dynamicRuntimeJson);
    if (direct != null) {
      const normalizedDirect = this.parseDynamicRuntimeJson(direct);
      if (normalizedDirect) {
        try {
          return JSON.stringify(normalizedDirect, null, 2);
        } catch {
          return direct;
        }
      }
    }

    const fallback = this.extractDynamicRuntimeJson(binding.displaySettingsJson);
    if (fallback) {
      const normalizedFallback = this.parseDynamicRuntimeJson(fallback);
      if (normalizedFallback) {
        try {
          return JSON.stringify(normalizedFallback, null, 2);
        } catch {
          return fallback;
        }
      }
    }

    return '';
  }

  private parseSupportedDynamicRuntimeJson(raw: unknown): Record<string, unknown> | null {
    const parsedRuntime = this.parseDynamicRuntimeJson(raw);
    if (!parsedRuntime) {
      return null;
    }

    const parsedBehavior = parseRequestRuntimeDynamicFieldBehavior(
      JSON.stringify({ dynamicRuntime: parsedRuntime })
    );
    return parsedBehavior ? parsedRuntime : null;
  }

  private updateBindingDynamicRuntimeState(bindingId: string, runtimeJson: string): void {
    this.bindings = this.bindings.map(binding => {
      if (binding.bindingId !== bindingId) {
        return binding;
      }

      const nextBinding: BoundFieldItem = {
        ...binding,
        dynamicRuntimeJson: runtimeJson
      };

      return {
        ...nextBinding,
        displaySettingsJson: this.buildDisplaySettingsJson(binding.displaySettingsJson, nextBinding)
      };
    });
  }

  private syncDynamicRuntimeAdvancedDraftForBinding(bindingId: string, runtimeJson: string): void {
    if (!this.dynamicRuntimeAdvancedOpenBindingIds.has(bindingId)) {
      return;
    }

    this.dynamicRuntimeAdvancedDraftByBindingId.set(bindingId, runtimeJson);
    this.dynamicRuntimeAdvancedErrorByBindingId.delete(bindingId);
  }

  private clearDynamicRuntimeAdvancedStateForBinding(bindingId: string): void {
    this.dynamicRuntimeAdvancedOpenBindingIds.delete(bindingId);
    this.dynamicRuntimeAdvancedDraftByBindingId.delete(bindingId);
    this.dynamicRuntimeAdvancedErrorByBindingId.delete(bindingId);
  }

  private pruneDynamicRuntimeAdvancedState(): void {
    const validBindingIds = new Set(this.bindings.map(binding => binding.bindingId));

    for (const bindingId of Array.from(this.dynamicRuntimeAdvancedOpenBindingIds)) {
      if (!validBindingIds.has(bindingId)) {
        this.dynamicRuntimeAdvancedOpenBindingIds.delete(bindingId);
      }
    }

    for (const bindingId of Array.from(this.dynamicRuntimeAdvancedDraftByBindingId.keys())) {
      if (!validBindingIds.has(bindingId)) {
        this.dynamicRuntimeAdvancedDraftByBindingId.delete(bindingId);
      }
    }

    for (const bindingId of Array.from(this.dynamicRuntimeAdvancedErrorByBindingId.keys())) {
      if (!validBindingIds.has(bindingId)) {
        this.dynamicRuntimeAdvancedErrorByBindingId.delete(bindingId);
      }
    }
  }

  private createDefaultBuilderBinding(): DynamicRuntimeBuilderBindingVm {
    return {
      name: '',
      source: 'static',
      staticValue: '',
      fieldKey: '',
      claimKey: '',
      fallbackValue: ''
    };
  }

  private createDefaultBuilderPatch(): DynamicRuntimeBuilderPatchVm {
    return {
      targetFieldKey: '',
      valuePath: '',
      valueTemplate: '',
      clearWhenMissing: false
    };
  }

  private createDefaultDynamicRuntimeBuilder(): DynamicRuntimeBuilderVm {
    return {
      behaviorType: 'optionLoader',
      trigger: 'change',
      sourceFieldKey: '',
      sourceType: 'external',
      requestFormat: 'json',
      authMode: 'bearerCurrent',
      statementId: null,
      fullUrl: '',
      method: 'GET',
      parameters: [this.createDefaultBuilderBinding()],
      query: [this.createDefaultBuilderBinding()],
      body: [],
      headers: [],
      customHeaders: [],
      responseListPath: '',
      responseValuePath: '',
      responseLabelPath: '',
      clearWhenSourceEmpty: false,
      minQueryLength: null,
      responseValidPath: '',
      responseMessagePath: '',
      defaultErrorMessage: '',
      debounceMs: null,
      minValueLength: null,
      whenEquals: '',
      clearTargetsWhenEmpty: false,
      patches: [this.createDefaultBuilderPatch()]
    };
  }

  private createBuilderModelFromRuntimeJson(raw: unknown): DynamicRuntimeBuilderVm {
    const model = this.createDefaultDynamicRuntimeBuilder();
    const runtimeConfig = this.parseDynamicRuntimeJson(raw);
    if (!runtimeConfig) {
      return model;
    }

    const behavior = parseRequestRuntimeDynamicFieldBehavior(JSON.stringify({ dynamicRuntime: runtimeConfig }));
    if (!behavior) {
      return model;
    }

    if (behavior.optionLoader) {
      model.behaviorType = 'optionLoader';
      model.trigger = behavior.optionLoader.trigger ?? 'change';
      model.sourceFieldKey = behavior.optionLoader.sourceFieldKey ?? '';
      model.minQueryLength = this.toNonNegativeInt(behavior.optionLoader.minQueryLength) ?? null;
      model.responseListPath = behavior.optionLoader.responseListPath ?? '';
      model.responseValuePath = behavior.optionLoader.responseValuePath ?? '';
      model.responseLabelPath = behavior.optionLoader.responseLabelPath ?? '';
      model.clearWhenSourceEmpty = behavior.optionLoader.clearWhenSourceEmpty === true;
      this.applyRequestConfigurationToBuilder(model, behavior.optionLoader.integration, behavior.optionLoader.request);
      return model;
    }

    if (behavior.asyncValidation) {
      model.behaviorType = 'asyncValidation';
      model.trigger = behavior.asyncValidation.trigger ?? 'blur';
      model.debounceMs = this.toPositiveInt(behavior.asyncValidation.debounceMs) ?? null;
      model.minValueLength = this.toNonNegativeInt(behavior.asyncValidation.minValueLength) ?? null;
      model.responseValidPath = behavior.asyncValidation.responseValidPath ?? '';
      model.responseMessagePath = behavior.asyncValidation.responseMessagePath ?? '';
      model.defaultErrorMessage = behavior.asyncValidation.defaultErrorMessage ?? '';
      this.applyRequestConfigurationToBuilder(model, behavior.asyncValidation.integration, behavior.asyncValidation.request);
      return model;
    }

    const firstAction = behavior.actions?.[0];
    if (firstAction) {
      model.behaviorType = 'autofill';
      model.trigger = firstAction.trigger ?? 'change';
      model.whenEquals = firstAction.whenEquals ?? '';
      model.clearTargetsWhenEmpty = firstAction.clearTargetsWhenEmpty === true;
      model.patches = (firstAction.patches ?? []).map(patch => ({
        targetFieldKey: patch.targetFieldKey ?? '',
        valuePath: patch.valuePath ?? '',
        valueTemplate: patch.valueTemplate ?? '',
        clearWhenMissing: patch.clearWhenMissing === true
      }));
      if (model.patches.length === 0) {
        model.patches = [this.createDefaultBuilderPatch()];
      }
      this.applyRequestConfigurationToBuilder(model, firstAction.integration, firstAction.request);
    }

    return model;
  }

  private applyRequestConfigurationToBuilder(
    model: DynamicRuntimeBuilderVm,
    integration: RequestRuntimeDynamicIntegrationRequestConfig | undefined,
    legacyRequest: {
      url: string;
      method?: 'GET' | 'POST' | 'PUT' | 'PATCH';
      query?: Record<string, string>;
      headers?: Record<string, string>;
      body?: unknown;
    } | undefined
  ): void {
    if (integration) {
      model.sourceType = integration.sourceType;
      model.requestFormat = integration.requestFormat ?? 'json';
      model.authMode = integration.auth?.mode ?? 'bearerCurrent';
      model.customHeaders = this.mapContractBindingsToBuilder(integration.auth?.customHeaders);
      if (integration.sourceType === 'powerbi') {
        model.statementId = this.toPositiveInt(integration.statementId) ?? null;
        model.parameters = this.mapContractBindingsToBuilder(integration.parameters);
      } else {
        model.fullUrl = integration.fullUrl ?? '';
        model.method = integration.method ?? 'GET';
        model.query = this.mapContractBindingsToBuilder(integration.query);
        model.body = this.mapContractBindingsToBuilder(integration.body);
        model.headers = this.mapContractBindingsToBuilder(integration.headers);
      }

      return;
    }

    if (!legacyRequest) {
      return;
    }

    model.sourceType = 'external';
    model.requestFormat = 'json';
    model.authMode = 'bearerCurrent';
    model.fullUrl = legacyRequest.url ?? '';
    model.method = legacyRequest.method ?? 'GET';
    model.query = this.mapRecordToBuilderBindings(legacyRequest.query);
    model.headers = this.mapRecordToBuilderBindings(legacyRequest.headers);
    model.body = this.mapLegacyBodyToBuilderBindings(legacyRequest.body);
  }

  private mapContractBindingsToBuilder(
    bindings: RequestRuntimeDynamicIntegrationNameValueBinding[] | undefined
  ): DynamicRuntimeBuilderBindingVm[] {
    const mapped = (bindings ?? [])
      .map(binding => this.mapContractBindingToBuilder(binding))
      .filter((binding): binding is DynamicRuntimeBuilderBindingVm => binding != null);
    return mapped.length > 0 ? mapped : [this.createDefaultBuilderBinding()];
  }

  private mapContractBindingToBuilder(
    binding: RequestRuntimeDynamicIntegrationNameValueBinding | undefined
  ): DynamicRuntimeBuilderBindingVm | null {
    const name = this.normalizeNullable(binding?.name);
    if (!name) {
      return null;
    }

    const valueBinding = binding?.value;
    const source = this.normalizeDynamicRuntimeValueSource(valueBinding?.source);
    if (!source) {
      return null;
    }

    return {
      name,
      source,
      staticValue: valueBinding?.staticValue ?? '',
      fieldKey: valueBinding?.fieldKey ?? '',
      claimKey: valueBinding?.claimKey ?? '',
      fallbackValue: valueBinding?.fallbackValue ?? ''
    };
  }

  private mapRecordToBuilderBindings(record: Record<string, string> | undefined): DynamicRuntimeBuilderBindingVm[] {
    const entries = Object.entries(record ?? {});
    if (entries.length === 0) {
      return [this.createDefaultBuilderBinding()];
    }

    return entries.map(([name, value]) => ({
      name,
      source: 'static',
      staticValue: String(value ?? ''),
      fieldKey: '',
      claimKey: '',
      fallbackValue: ''
    }));
  }

  private mapLegacyBodyToBuilderBindings(body: unknown): DynamicRuntimeBuilderBindingVm[] {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return [];
    }

    const source = body as Record<string, unknown>;
    const entries = Object.entries(source).map(([key, value]) => ({
      name: key,
      source: 'static' as const,
      staticValue: typeof value === 'string' ? value : JSON.stringify(value),
      fieldKey: '',
      claimKey: '',
      fallbackValue: ''
    }));

    return entries.length > 0 ? entries : [];
  }

  private buildRuntimeConfigFromBuilder(model: DynamicRuntimeBuilderVm): RequestRuntimeDynamicFieldBehaviorConfig | null {
    const integration = this.buildIntegrationConfigFromBuilder(model);
    if (!integration) {
      return null;
    }

    if (model.behaviorType === 'optionLoader') {
      return {
        optionLoader: {
          trigger: model.trigger === 'blur' ? 'blur' : model.trigger,
          sourceFieldKey: this.normalizeNullable(model.sourceFieldKey) ?? undefined,
          integration,
          minQueryLength: this.toNonNegativeInt(model.minQueryLength) ?? undefined,
          responseListPath: this.normalizeNullable(model.responseListPath) ?? undefined,
          responseValuePath: this.normalizeNullable(model.responseValuePath) ?? undefined,
          responseLabelPath: this.normalizeNullable(model.responseLabelPath) ?? undefined,
          clearWhenSourceEmpty: model.clearWhenSourceEmpty === true
        }
      };
    }

    if (model.behaviorType === 'asyncValidation') {
      const trigger = model.trigger === 'init' ? 'blur' : model.trigger;
      return {
        asyncValidation: {
          trigger,
          integration,
          debounceMs: this.toPositiveInt(model.debounceMs) ?? undefined,
          minValueLength: this.toNonNegativeInt(model.minValueLength) ?? undefined,
          responseValidPath: this.normalizeNullable(model.responseValidPath) ?? undefined,
          responseMessagePath: this.normalizeNullable(model.responseMessagePath) ?? undefined,
          defaultErrorMessage: this.normalizeNullable(model.defaultErrorMessage) ?? undefined
        }
      };
    }

    const patches = (model.patches ?? [])
      .map(patch => ({
        targetFieldKey: this.normalizeNullable(patch.targetFieldKey) ?? '',
        valuePath: this.normalizeNullable(patch.valuePath) ?? undefined,
        valueTemplate: this.normalizeNullable(patch.valueTemplate) ?? undefined,
        clearWhenMissing: patch.clearWhenMissing === true
      }))
      .filter(patch => patch.targetFieldKey.length > 0);

    if (patches.length === 0) {
      this.stepMessageSeverity = 'warn';
      this.stepMessage = 'يجب إضافة Patch واحدة على الأقل في وضع التعبئة التلقائية.';
      return null;
    }

    const trigger = model.trigger === 'init' ? 'change' : model.trigger;
    const action: RequestRuntimeDynamicActionConfig = {
      trigger,
      whenEquals: this.normalizeNullable(model.whenEquals) ?? undefined,
      integration,
      patches,
      clearTargetsWhenEmpty: model.clearTargetsWhenEmpty === true
    };

    return {
      actions: [action]
    };
  }

  private buildIntegrationConfigFromBuilder(
    model: DynamicRuntimeBuilderVm
  ): RequestRuntimeDynamicIntegrationRequestConfig | null {
    const auth = {
      mode: model.authMode,
      customHeaders: model.authMode === 'custom'
        ? this.mapBuilderBindingsToContract(model.customHeaders)
        : undefined
    };

    if (model.sourceType === 'powerbi') {
      const statementId = this.toPositiveInt(model.statementId);
      if (!statementId) {
        this.stepMessageSeverity = 'warn';
        this.stepMessage = 'مصدر Power BI يتطلب إدخال معرّف عبارة صالح.';
        return null;
      }

      return {
        sourceType: 'powerbi',
        requestFormat: model.requestFormat,
        auth,
        statementId,
        parameters: this.mapBuilderBindingsToContract(model.parameters)
      };
    }

    const fullUrl = this.normalizeNullable(model.fullUrl);
    if (!fullUrl) {
      this.stepMessageSeverity = 'warn';
      this.stepMessage = 'المصدر الخارجي يتطلب إدخال الرابط الكامل.';
      return null;
    }

    return {
      sourceType: 'external',
      requestFormat: model.requestFormat,
      auth,
      fullUrl,
      method: model.method,
      query: this.mapBuilderBindingsToContract(model.query),
      body: this.mapBuilderBindingsToContract(model.body),
      headers: this.mapBuilderBindingsToContract(model.headers)
    };
  }

  private collectDynamicRuntimeBuilderInlineValidationIssues(model: DynamicRuntimeBuilderVm): string[] {
    const issues: string[] = [];

    if (model.sourceType === 'powerbi') {
      if (!this.toPositiveInt(model.statementId)) {
        issues.push('مصدر Power BI يتطلب إدخال "معرّف العبارة" كرقم موجب.');
      }

      this.collectDynamicRuntimeBuilderBindingIssues('المعاملات', model.parameters, issues);
    } else {
      if (!this.normalizeNullable(model.fullUrl)) {
        issues.push('المصدر الخارجي يتطلب إدخال الرابط الكامل.');
      }

      this.collectDynamicRuntimeBuilderBindingIssues('معاملات الاستعلام', model.query, issues);
      this.collectDynamicRuntimeBuilderBindingIssues('معاملات جسم الطلب', model.body, issues);
      this.collectDynamicRuntimeBuilderBindingIssues('رؤوس الطلب', model.headers, issues);
    }

    if (model.authMode === 'custom') {
      this.collectDynamicRuntimeBuilderBindingIssues('رؤوس المصادقة المخصصة', model.customHeaders, issues);
    }

    if (model.behaviorType === 'autofill') {
      const hasAnyValidPatch = (model.patches ?? [])
        .some(patch => this.normalizeNullable(patch.targetFieldKey) != null);
      if (!hasAnyValidPatch) {
        issues.push('وضع التعبئة التلقائية يتطلب Patch واحدة على الأقل مع مفتاح حقل مستهدف.');
      }

      (model.patches ?? []).forEach((patch, index) => {
        if (!this.hasDynamicRuntimeBuilderPatchInput(patch)) {
          return;
        }

        if (!this.normalizeNullable(patch.targetFieldKey)) {
          issues.push(`Patch رقم ${index + 1}: مفتاح الحقل المستهدف مطلوب.`);
        }
      });
    }

    return issues;
  }

  private collectDynamicRuntimeBuilderBindingIssues(
    sectionLabel: string,
    bindings: DynamicRuntimeBuilderBindingVm[] | undefined,
    issues: string[]
  ): void {
    for (const [index, binding] of (bindings ?? []).entries()) {
      if (!this.hasDynamicRuntimeBuilderBindingInput(binding)) {
        continue;
      }

      const name = this.normalizeNullable(binding.name);
      if (!name) {
        issues.push(`${sectionLabel} - السطر ${index + 1}: اسم العنصر مطلوب.`);
        continue;
      }

      if (binding.source === 'field') {
        if (!this.normalizeNullable(binding.fieldKey)) {
          issues.push(`${sectionLabel} - السطر ${index + 1}: مفتاح الحقل مطلوب عند اختيار "من حقل".`);
        }
        continue;
      }

      if (binding.source === 'claim') {
        if (!this.normalizeNullable(binding.claimKey)) {
          issues.push(`${sectionLabel} - السطر ${index + 1}: مفتاح المطالبة مطلوب عند اختيار "من مطالبة المستخدم".`);
        }
        continue;
      }

      if (!this.normalizeNullable(binding.staticValue)) {
        issues.push(`${sectionLabel} - السطر ${index + 1}: القيمة الثابتة مطلوبة عند اختيار "قيمة ثابتة".`);
      }
    }
  }

  private hasDynamicRuntimeBuilderBindingInput(binding: DynamicRuntimeBuilderBindingVm | undefined): boolean {
    if (!binding) {
      return false;
    }

    return this.normalizeNullable(binding.name) != null
      || this.normalizeNullable(binding.staticValue) != null
      || this.normalizeNullable(binding.fieldKey) != null
      || this.normalizeNullable(binding.claimKey) != null
      || this.normalizeNullable(binding.fallbackValue) != null;
  }

  private hasDynamicRuntimeBuilderPatchInput(patch: DynamicRuntimeBuilderPatchVm | undefined): boolean {
    if (!patch) {
      return false;
    }

    return this.normalizeNullable(patch.targetFieldKey) != null
      || this.normalizeNullable(patch.valuePath) != null
      || this.normalizeNullable(patch.valueTemplate) != null
      || patch.clearWhenMissing === true;
  }

  private mapBuilderBindingsToContract(
    bindings: DynamicRuntimeBuilderBindingVm[] | undefined
  ): RequestRuntimeDynamicIntegrationNameValueBinding[] | undefined {
    const mapped = (bindings ?? [])
      .map(binding => this.mapBuilderBindingToContract(binding))
      .filter((binding): binding is RequestRuntimeDynamicIntegrationNameValueBinding => binding != null);
    return mapped.length > 0 ? mapped : undefined;
  }

  private mapBuilderBindingToContract(
    binding: DynamicRuntimeBuilderBindingVm | undefined
  ): RequestRuntimeDynamicIntegrationNameValueBinding | null {
    const name = this.normalizeNullable(binding?.name);
    if (!name) {
      return null;
    }

    const value = this.mapBuilderValueToContract(binding);
    if (!value) {
      return null;
    }

    return {
      name,
      value
    };
  }

  private mapBuilderValueToContract(
    binding: DynamicRuntimeBuilderBindingVm | undefined
  ): RequestRuntimeDynamicIntegrationValueBinding | null {
    if (!binding) {
      return null;
    }

    if (binding.source === 'field') {
      const fieldKey = this.normalizeNullable(binding.fieldKey);
      if (!fieldKey) {
        return null;
      }

      return {
        source: 'field',
        fieldKey,
        fallbackValue: this.normalizeNullable(binding.fallbackValue) ?? undefined
      };
    }

    if (binding.source === 'claim') {
      const claimKey = this.normalizeNullable(binding.claimKey);
      if (!claimKey) {
        return null;
      }

      return {
        source: 'claim',
        claimKey,
        fallbackValue: this.normalizeNullable(binding.fallbackValue) ?? undefined
      };
    }

    const staticValue = this.normalizeNullable(binding.staticValue);
    if (staticValue == null) {
      return null;
    }

    return {
      source: 'static',
      staticValue,
      fallbackValue: this.normalizeNullable(binding.fallbackValue) ?? undefined
    };
  }

  private normalizeDynamicRuntimeValueSource(value: unknown): DynamicRuntimeBuilderBindingVm['source'] | null {
    const normalized = String(value ?? '').trim().toLowerCase();
    if (normalized === 'static' || normalized === 'field' || normalized === 'claim') {
      return normalized;
    }

    return null;
  }

  private flattenAdminCatalogGroups(nodes: ReadonlyArray<AdminCatalogGroupTreeNodeDto>): SubjectAdminGroupDto[] {
    const flattened: SubjectAdminGroupDto[] = [];

    const visit = (node: AdminCatalogGroupTreeNodeDto): void => {
      flattened.push({
        groupId: Number(node.groupId ?? 0),
        groupName: this.normalizeNullable(node.groupName) ?? `مجموعة ${node.groupId}`,
        groupDescription: this.normalizeNullable(node.groupDescription) ?? undefined,
        isExtendable: false,
        groupWithInRow: 12,
        linkedFieldsCount: 0
      });

      for (const child of node.children ?? []) {
        visit(child);
      }
    };

    for (const node of nodes ?? []) {
      visit(node);
    }

    return flattened.filter(group => this.toPositiveInt(group.groupId) !== null);
  }

  private parseDisplaySettings(raw: string | undefined): Record<string, unknown> | null {
    const payload = this.normalizeNullable(raw);
    if (!payload) {
      return null;
    }

    try {
      const parsed = JSON.parse(payload);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return null;
      }

      return { ...(parsed as Record<string, unknown>) };
    } catch {
      return null;
    }
  }

  private readReadonlyFromDisplaySettings(raw: string | undefined): boolean | null {
    const parsed = this.parseDisplaySettings(raw);
    if (!parsed) {
      return null;
    }

    const candidateKeys = ['readonly', 'isReadonly', 'readOnly', 'disabled', 'isDisabled'];
    for (const key of candidateKeys) {
      if (!Object.prototype.hasOwnProperty.call(parsed, key)) {
        continue;
      }

      return parsed[key] === true;
    }

    return null;
  }

  private async ensureAtLeastOneGroupExists(): Promise<void> {
    if (this.groupOptions.length > 0) {
      return;
    }

    const categoryId = this.toPositiveInt(this.currentCategoryId);
    const applicationId = this.normalizeNullable(this.currentApplicationId);
    if (!categoryId || !applicationId) {
      throw new Error('لا يمكن إنشاء مجموعة افتراضية بدون تصنيف وتطبيق صالحين.');
    }

    const created = this.readSingleResponse(
      await firstValueFrom(this.adminCatalogController.createGroup({
        categoryId,
        applicationId,
        groupName: 'مجموعة افتراضية للوحة التحكم',
        groupDescription: 'تم إنشاؤها تلقائيًا من صفحة ربط مكتبة الحقول.',
        displayOrder: 0,
        isActive: true
      })),
      'تعذر إنشاء مجموعة افتراضية لربط الحقول.'
    );
    const createdGroup: SubjectAdminGroupDto = {
      groupId: created.groupId,
      groupName: created.groupName,
      groupDescription: created.groupDescription,
      isExtendable: false,
      groupWithInRow: 12,
      linkedFieldsCount: 0
    };

    this.groups = [createdGroup];
    this.groupOptions = [{
      label: `${createdGroup.groupName ?? `مجموعة ${createdGroup.groupId}`} (${createdGroup.groupId})`,
      value: createdGroup.groupId
    }];

    this.bindings = this.bindings.map(binding => ({
      ...binding,
      groupId: this.toPositiveInt(binding.groupId) ?? createdGroup.groupId,
      groupName: this.resolveGroupName(this.toPositiveInt(binding.groupId) ?? createdGroup.groupId)
    }));
  }

  private patchReferencePolicyFormFromStep(values: Record<string, unknown>): void {
    const serialName = this.normalizeSerialName(values['serialName'] ?? values['sequenceName']);
    const serialId = this.resolveSerialOptionValue(values['serialId'], serialName);
    const nextValue = {
      referencePolicyEnabled: values['referencePolicyEnabled'] !== false,
      referenceMode: this.normalizeReferenceMode(values['referenceMode']),
      referencePrefix: this.normalizeNullable(values['referencePrefix']) ?? '',
      referenceSeparator: this.normalizeReferenceSeparator(values['referenceSeparator']),
      serialId,
      serialName: serialId ? '' : (serialName ?? ''),
      referenceStartingValue: this.toSafeStartingValue(values['referenceStartingValue']),
      referenceSequencePaddingLength: this.toSafeSequenceLength(values['referenceSequencePaddingLength']),
      referenceSequenceResetScope: this.normalizeSequenceResetScope(values['referenceSequenceResetScope'])
    };

    this.syncingFromStore = true;
    this.referencePolicyForm.patchValue(nextValue, { emitEvent: false });
    this.setReferenceComponents(
      this.parseReferenceComponents(values['referenceComponents']),
      false
    );
    this.syncingFromStore = false;
  }

  private patchReferencePolicyFormFromAdminType(subjectType: SubjectTypeAdminDto | null): void {
    const resolvedMode = this.normalizeReferenceMode(subjectType?.referenceMode);
    const serialName = this.normalizeSerialName(subjectType?.serialName ?? subjectType?.sequenceName);
    const serialId = this.resolveSerialOptionValue(subjectType?.serialId ?? subjectType?.referencePolicyId, serialName);
    const nextValue = {
      referencePolicyEnabled: subjectType?.referencePolicyEnabled !== false,
      referenceMode: resolvedMode,
      referencePrefix: this.normalizeNullable(subjectType?.referencePrefix) ?? '',
      referenceSeparator: this.normalizeReferenceSeparator(subjectType?.referenceSeparator),
      serialId,
      serialName: serialId ? '' : (serialName ?? ''),
      referenceStartingValue: this.toSafeStartingValue(subjectType?.referenceStartingValue),
      referenceSequencePaddingLength: this.toSafeSequenceLength(subjectType?.sequencePaddingLength),
      referenceSequenceResetScope: this.normalizeSequenceResetScope(subjectType?.sequenceResetScope)
    };

    this.syncingFromStore = true;
    this.referencePolicyForm.patchValue(nextValue, { emitEvent: false });
    this.setReferenceComponents(
      this.parseReferenceComponents(subjectType?.referenceComponents),
      false
    );
    this.syncingFromStore = false;
  }

  private patchPresentationFormFromStep(values: Record<string, unknown>): void {
    const nextValue = {
      defaultDisplayMode: this.normalizeDisplayMode(values['defaultDisplayMode']),
      allowUserToChangeDisplayMode: values['allowUserToChangeDisplayMode'] === true
    };

    this.syncingFromStore = true;
    this.presentationForm.patchValue(nextValue, { emitEvent: false });
    this.syncingFromStore = false;
  }

  private patchPresentationFormFromAdminType(subjectType: SubjectTypeAdminDto | null): void {
    const nextValue = {
      defaultDisplayMode: this.normalizeDisplayMode(subjectType?.defaultDisplayMode),
      allowUserToChangeDisplayMode: subjectType?.allowUserToChangeDisplayMode === true
    };

    this.syncingFromStore = true;
    this.presentationForm.patchValue(nextValue, { emitEvent: false });
    this.syncingFromStore = false;
  }

  private patchPresentationFormDefaultsIfMissing(): void {
    const current = this.presentationForm.getRawValue();
    const patch = {
      defaultDisplayMode: this.normalizeDisplayMode(current['defaultDisplayMode']),
      allowUserToChangeDisplayMode: current['allowUserToChangeDisplayMode'] === true
    };

    this.syncingFromStore = true;
    this.presentationForm.patchValue(patch, { emitEvent: false });
    this.syncingFromStore = false;
  }

  private patchBindingsFromStep(values: Record<string, unknown>): void {
    const parsed = this.bindingEngine.parseBindingsPayload(values['bindingPayload']);
    const currentSerialized = this.bindingEngine.serializeBindingsPayload(this.bindings);
    const incomingSerialized = this.bindingEngine.serializeBindingsPayload(parsed);
    if (currentSerialized === incomingSerialized) {
      return;
    }

    this.bindings = parsed.map(item => ({
      ...item,
      dynamicRuntimeJson: this.resolveBindingRuntimeJson(item)
    }));
  }

  private moveBinding(binding: BoundFieldItem, direction: -1 | 1): void {
    const ordered = [...this.bindings].sort((left, right) => left.displayOrder - right.displayOrder);
    const currentIndex = ordered.findIndex(item => item.bindingId === binding.bindingId);
    if (currentIndex < 0) {
      return;
    }

    const targetIndex = currentIndex + direction;
    if (targetIndex < 0 || targetIndex >= ordered.length) {
      return;
    }

    const reordered = [...ordered];
    const [moved] = reordered.splice(currentIndex, 1);
    reordered.splice(targetIndex, 0, moved);
    this.bindings = this.bindingEngine.normalizeDisplayOrder(reordered);
    this.evaluateBindings(true, true);
  }

  private collectGroupValidationIssues(bindings: ReadonlyArray<BoundFieldItem>): string[] {
    const issues: string[] = [];

    for (const item of bindings) {
      const groupId = this.toPositiveInt(item.groupId);
      if (!groupId) {
        issues.push(`الحقل "${item.label || item.fieldKey}" غير مرتبط بأي مجموعة.`);
        continue;
      }

      const knownGroup = this.groups.some(group => group.groupId === groupId);
      if (!knownGroup && this.groupOptions.length > 0) {
        issues.push(`المجموعة رقم ${groupId} غير موجودة ضمن المجموعات المتاحة للحقل "${item.label || item.fieldKey}".`);
      }
    }

    return issues;
  }

  private collectDynamicRuntimeValidationIssues(bindings: ReadonlyArray<BoundFieldItem>): string[] {
    const issues: string[] = [];

    for (const item of bindings ?? []) {
      const payload = this.normalizeNullable(this.resolveBindingRuntimeJson(item));
      if (!payload) {
        continue;
      }

      const parsedRuntime = this.parseSupportedDynamicRuntimeJson(payload);
      if (!parsedRuntime) {
        issues.push(`تهيئة السلوك الديناميكي للحقل "${item.label || item.fieldKey}" تحتوي JSON غير صالح.`);
        continue;
      }

      // The contract is already verified by parseSupportedDynamicRuntimeJson.
    }

    return issues;
  }

  private collectOptionSourceValidationIssues(bindings: ReadonlyArray<BoundFieldItem>): string[] {
    const issues: string[] = [];

    for (const item of bindings ?? []) {
      const existingField = this.fieldCatalogByKey.get(this.normalizeFieldKey(item.fieldKey)) ?? null;
      const optionSourceDecision = this.resolveBindingOptionSourceDecision(item, existingField);
      const fieldLabel = item.label || item.fieldKey;
      const isDropdown = this.normalizeBindingType(item.type) === 'Dropdown';

      if (!isDropdown && optionSourceDecision.hasDynamicOptionSource) {
        issues.push(`الحقل "${fieldLabel}" يحتوي مصدر خيارات ديناميكي رغم أن نوعه ليس قائمة اختيار.`);
        continue;
      }

      if (!isDropdown) {
        continue;
      }

      if (optionSourceDecision.source === 'None') {
        issues.push(`فشل تجهيز الحقل "${fieldLabel}" لأنه لا يحتوي خيارات ثابتة صالحة ولا مصدر خيارات داخلي/خارجي صالح.`);
        continue;
      }

      const defaultValue = this.normalizeNullable(item.defaultValue);
      if (!defaultValue || optionSourceDecision.source !== 'Static') {
        continue;
      }

      if (!optionSourceDecision.staticOptionValues.has(defaultValue)) {
        issues.push(`فشل تجهيز الحقل "${fieldLabel}" لأن القيمة الافتراضية "${defaultValue}" غير موجودة ضمن الخيارات الثابتة.`);
      }
    }

    return Array.from(new Set(issues));
  }

  private resolveBindingOptionSourceDecision(
    binding: Pick<BoundFieldItem, 'fieldKey' | 'dynamicRuntimeJson' | 'displaySettingsJson'> | null,
    existingField: SubjectAdminFieldDto | null
  ): BindingOptionSourceDecision {
    const rawStaticSources = this.collectRawStaticOptionSources(binding, existingField);
    const parsedStaticOptions = this.parseBindingOptionsPayload(rawStaticSources);
    const dynamicOptionSource = this.resolveDynamicOptionSource(binding);
    const hasValidStaticOptions = parsedStaticOptions.state === 'valid' && parsedStaticOptions.values.size > 0;
    const staticExcludedReason = this.buildStaticExcludedReason(parsedStaticOptions);

    if (hasValidStaticOptions) {
      const dynamicFallbackNote = dynamicOptionSource.kind != null
        ? `تم تفضيل الخيارات الثابتة، بينما مصدر ${dynamicOptionSource.kind === 'Internal' ? 'داخلي' : 'خارجي'} متاح كمسار بديل.`
        : '';
      return {
        source: 'Static',
        reason: dynamicFallbackNote.length > 0
          ? `تم اعتماد الخيارات الثابتة بعد التطبيع. ${dynamicFallbackNote}`
          : 'تم اعتماد الخيارات الثابتة بعد التطبيع.',
        hasStaticSourcePayload: parsedStaticOptions.rawSourceCount > 0,
        staticOptionsValid: true,
        staticOptionsCount: parsedStaticOptions.values.size,
        rawStaticSourceCount: parsedStaticOptions.rawSourceCount,
        rawStaticSources: parsedStaticOptions.rawSources,
        hasDynamicRuntimeConfig: dynamicOptionSource.hasRuntimePayload,
        hasBehavioralRuntimeConfig: dynamicOptionSource.hasBehavioralRuntimeConfig,
        hasDynamicOptionSource: dynamicOptionSource.hasDynamicOptionSource,
        dynamicOptionSourceKind: dynamicOptionSource.kind ?? undefined,
        dynamicOptionSourceReason: dynamicOptionSource.reason ?? undefined,
        staticExcludedReason: undefined,
        staticOptionValues: parsedStaticOptions.values
      };
    }

    if (dynamicOptionSource.kind != null) {
      return {
        source: dynamicOptionSource.kind,
        reason: dynamicOptionSource.reason
          ?? (dynamicOptionSource.kind === 'Internal'
            ? 'تم اعتماد مصدر خيارات ديناميكي داخلي.'
            : 'تم اعتماد مصدر خيارات ديناميكي خارجي.'),
        hasStaticSourcePayload: parsedStaticOptions.rawSourceCount > 0,
        staticOptionsValid: false,
        staticOptionsCount: parsedStaticOptions.values.size,
        rawStaticSourceCount: parsedStaticOptions.rawSourceCount,
        rawStaticSources: parsedStaticOptions.rawSources,
        hasDynamicRuntimeConfig: dynamicOptionSource.hasRuntimePayload,
        hasBehavioralRuntimeConfig: dynamicOptionSource.hasBehavioralRuntimeConfig,
        hasDynamicOptionSource: true,
        dynamicOptionSourceKind: dynamicOptionSource.kind,
        dynamicOptionSourceReason: dynamicOptionSource.reason ?? undefined,
        staticExcludedReason,
        staticOptionValues: parsedStaticOptions.values
      };
    }

    return {
      source: 'None',
      reason: this.buildNoOptionSourceReason(parsedStaticOptions, dynamicOptionSource.reason),
      hasStaticSourcePayload: parsedStaticOptions.rawSourceCount > 0,
      staticOptionsValid: false,
      staticOptionsCount: parsedStaticOptions.values.size,
      rawStaticSourceCount: parsedStaticOptions.rawSourceCount,
      rawStaticSources: parsedStaticOptions.rawSources,
      hasDynamicRuntimeConfig: dynamicOptionSource.hasRuntimePayload,
      hasBehavioralRuntimeConfig: dynamicOptionSource.hasBehavioralRuntimeConfig,
      hasDynamicOptionSource: dynamicOptionSource.hasDynamicOptionSource,
      dynamicOptionSourceKind: undefined,
      dynamicOptionSourceReason: dynamicOptionSource.reason ?? undefined,
      staticExcludedReason,
      staticOptionValues: parsedStaticOptions.values
    };
  }

  private resolveRuntimePayloadForOptionSource(
    binding: Pick<BoundFieldItem, 'dynamicRuntimeJson' | 'displaySettingsJson'> | null
  ): Record<string, unknown> | null {
    if (!binding) {
      return null;
    }

    const directRuntimePayload = this.parseDynamicRuntimeJson(binding.dynamicRuntimeJson);
    if (directRuntimePayload) {
      return directRuntimePayload;
    }

    const displaySettings = this.parseDisplaySettings(binding.displaySettingsJson);
    if (!displaySettings) {
      return null;
    }

    if (Object.prototype.hasOwnProperty.call(displaySettings, 'dynamicRuntime')) {
      const embeddedRuntime = this.parseDynamicRuntimeJson(displaySettings['dynamicRuntime']);
      if (embeddedRuntime) {
        return embeddedRuntime;
      }
    }

    if (this.isRuntimeBehaviorPayload(displaySettings)) {
      return displaySettings;
    }

    return null;
  }

  private resolveDynamicOptionSource(
    binding: Pick<BoundFieldItem, 'dynamicRuntimeJson' | 'displaySettingsJson'> | null
  ): {
    kind: 'Internal' | 'External' | null;
    reason: string | null;
    hasRuntimePayload: boolean;
    hasBehavioralRuntimeConfig: boolean;
    hasDynamicOptionSource: boolean;
  } {
    const runtimePayload = this.resolveRuntimePayloadForOptionSource(binding);
    if (!runtimePayload) {
      return {
        kind: null,
        reason: null,
        hasRuntimePayload: false,
        hasBehavioralRuntimeConfig: false,
        hasDynamicOptionSource: false
      };
    }

    const readObject = (value: unknown): Record<string, unknown> | null => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
      }

      return value as Record<string, unknown>;
    };
    const runtimeBehavior = parseRequestRuntimeDynamicFieldBehavior(JSON.stringify({ dynamicRuntime: runtimePayload }));
    const rawOptionLoader = readObject(runtimePayload['optionLoader']);
    const rawAsyncValidation = readObject(runtimePayload['asyncValidation']);
    const rawActions = Array.isArray(runtimePayload['actions']) ? runtimePayload['actions'] : null;
    const hasBehavioralRuntimeConfig = runtimeBehavior != null
      || rawOptionLoader != null
      || rawAsyncValidation != null
      || rawActions != null
      || Object.keys(runtimePayload).length > 0;

    if (!rawOptionLoader) {
      return {
        kind: null,
        reason: 'dynamicRuntime يحتوي سلوكًا فقط بدون مصدر خيارات.',
        hasRuntimePayload: true,
        hasBehavioralRuntimeConfig,
        hasDynamicOptionSource: false
      };
    }

    const integration = readObject(rawOptionLoader['integration']);
    const sourceType = this.normalizeNullable(integration?.['sourceType'])?.toLowerCase();
    const statementId = this.toPositiveInt(integration?.['statementId']);
    const fullUrl = this.normalizeNullable(integration?.['fullUrl']);
    if ((sourceType === 'powerbi' && statementId != null)
      || (sourceType == null && statementId != null)) {
      return {
        kind: 'Internal',
        reason: 'تم تحديد مصدر خيارات ديناميكي داخلي عبر integration.statementId.',
        hasRuntimePayload: true,
        hasBehavioralRuntimeConfig: true,
        hasDynamicOptionSource: true
      };
    }

    if ((sourceType === 'external' && !!fullUrl)
      || (sourceType == null && !!fullUrl)) {
      return {
        kind: 'External',
        reason: 'تم تحديد مصدر خيارات ديناميكي خارجي عبر integration.fullUrl.',
        hasRuntimePayload: true,
        hasBehavioralRuntimeConfig: true,
        hasDynamicOptionSource: true
      };
    }

    const requestPayload = readObject(rawOptionLoader['request']);
    if (this.normalizeNullable(requestPayload?.['url'])) {
      return {
        kind: 'External',
        reason: 'تم تحديد مصدر خيارات ديناميكي خارجي عبر request.url.',
        hasRuntimePayload: true,
        hasBehavioralRuntimeConfig: true,
        hasDynamicOptionSource: true
      };
    }

    return {
      kind: null,
      reason: 'تم العثور على optionLoader لكن بدون مصدر داخلي/خارجي صالح.',
      hasRuntimePayload: true,
      hasBehavioralRuntimeConfig,
      hasDynamicOptionSource: true
    };
  }

  private buildStaticExcludedReason(parsed: ParsedBindingOptionsResult): string | undefined {
    switch (parsed.state) {
      case 'missing':
        return 'لا يوجد مصدر خيارات ثابت (optionsPayload/legacy).';
      case 'empty':
        return 'مصدر الخيارات الثابت موجود لكنه أصبح فارغًا بعد التطبيع.';
      case 'invalid':
        return parsed.invalidReason ?? 'فشل parse/normalize لمصدر الخيارات الثابت.';
      default:
        return undefined;
    }
  }

  private buildNoOptionSourceReason(
    parsedStaticOptions: ParsedBindingOptionsResult,
    dynamicResolutionReason: string | null
  ): string {
    if (parsedStaticOptions.state === 'invalid') {
      return parsedStaticOptions.invalidReason
        ?? 'مصدر الخيارات الثابت غير صالح، ولم يتم العثور على مصدر ديناميكي صالح.';
    }

    if (parsedStaticOptions.state === 'empty') {
      return 'مصدر الخيارات الثابت موجود لكنه فارغ بعد التطبيع، ولا يوجد مصدر ديناميكي صالح.';
    }

    if (dynamicResolutionReason) {
      return `لا يوجد مصدر خيارات صالح. ${dynamicResolutionReason}`;
    }

    return 'لا توجد خيارات ثابتة صالحة ولا مصدر خيارات داخلي/خارجي صالح.';
  }

  private collectRawStaticOptionSources(
    binding: Pick<BoundFieldItem, 'displaySettingsJson'> | null,
    existingField: SubjectAdminFieldDto | null
  ): Array<{ source: string; payload: string }> {
    const sources: Array<{ source: string; payload: string }> = [];

    this.pushRawStaticOptionSource(sources, 'optionsPayload', existingField?.optionsPayload);

    const displaySettings = this.parseDisplaySettings(binding?.displaySettingsJson);
    if (displaySettings) {
      const legacyKeys = [
        'optionsPayload',
        'options',
        'items',
        'values',
        'lookupOptions',
        'dropdownOptions',
        'sourceOptions',
        'cdmendTbl'
      ];

      for (const key of legacyKeys) {
        if (!Object.prototype.hasOwnProperty.call(displaySettings, key)) {
          continue;
        }

        const serializedPayload = this.serializeRawStaticOptionSource(displaySettings[key]);
        this.pushRawStaticOptionSource(sources, `displaySettings.${key}`, serializedPayload);
      }
    }

    const deduped = new Map<string, { source: string; payload: string }>();
    for (const item of sources) {
      const dedupeKey = `${item.source}::${item.payload}`;
      if (!deduped.has(dedupeKey)) {
        deduped.set(dedupeKey, item);
      }
    }

    return Array.from(deduped.values());
  }

  private pushRawStaticOptionSource(
    target: Array<{ source: string; payload: string }>,
    source: string,
    payload: unknown
  ): void {
    const normalizedPayload = this.normalizeNullable(payload);
    if (!normalizedPayload) {
      return;
    }

    target.push({ source, payload: normalizedPayload });
  }

  private serializeRawStaticOptionSource(value: unknown): string | null {
    const direct = this.normalizeNullable(value);
    if (direct) {
      return direct;
    }

    if (value == null) {
      return null;
    }

    if (typeof value === 'object') {
      try {
        return JSON.stringify(value);
      } catch {
        return null;
      }
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    return null;
  }

  private parseBindingOptionsPayload(
    rawSources: Array<{ source: string; payload: string }>
  ): ParsedBindingOptionsResult {
    const values = new Set<string>();
    const options: Array<{ value: string; label: string }> = [];
    const optionKeys = new Set<string>();
    const normalizedRawSources = rawSources
      .map(item => ({
        source: this.normalizeNullable(item.source) ?? 'unknown',
        payload: this.normalizeNullable(item.payload) ?? ''
      }))
      .filter(item => item.payload.length > 0);

    if (normalizedRawSources.length === 0) {
      return {
        state: 'missing',
        options,
        values,
        invalidSourceCount: 0,
        emptySourceCount: 0,
        rawSourceCount: 0,
        rawSources: []
      };
    }

    let invalidSourceCount = 0;
    let emptySourceCount = 0;
    let firstInvalidReason: string | undefined;

    for (const rawSource of normalizedRawSources) {
      const normalized = this.normalizeSingleOptionPayload(rawSource.payload);
      if (normalized.state === 'invalid') {
        invalidSourceCount++;
        if (!firstInvalidReason) {
          firstInvalidReason = `${rawSource.source}: ${normalized.invalidReason ?? 'تنسيق غير صالح.'}`;
        }
        continue;
      }

      if (normalized.state === 'empty') {
        emptySourceCount++;
        continue;
      }

      for (const option of normalized.options) {
        const dedupeKey = `${option.value.toLowerCase()}::${option.label.toLowerCase()}`;
        if (optionKeys.has(dedupeKey)) {
          continue;
        }

        optionKeys.add(dedupeKey);
        options.push(option);
        values.add(option.value);
      }
    }

    if (values.size > 0) {
      return {
        state: 'valid',
        options,
        values,
        invalidSourceCount,
        emptySourceCount,
        rawSourceCount: normalizedRawSources.length,
        rawSources: normalizedRawSources
      };
    }

    if (invalidSourceCount > 0) {
      return {
        state: 'invalid',
        options,
        values,
        invalidSourceCount,
        emptySourceCount,
        rawSourceCount: normalizedRawSources.length,
        rawSources: normalizedRawSources,
        invalidReason: firstInvalidReason ?? 'فشل parse/normalize لمصدر الخيارات الثابت.'
      };
    }

    return {
      state: 'empty',
      options,
      values,
      invalidSourceCount,
      emptySourceCount,
      rawSourceCount: normalizedRawSources.length,
      rawSources: normalizedRawSources
    };
  }

  private normalizeSingleOptionPayload(payloadRaw: string): ParsedBindingOptionsResult {
    const payload = this.normalizeNullable(payloadRaw);
    const values = new Set<string>();
    const options: Array<{ value: string; label: string }> = [];
    if (!payload) {
      return {
        state: 'empty',
        options,
        values,
        invalidSourceCount: 0,
        emptySourceCount: 1,
        rawSourceCount: 1,
        rawSources: []
      };
    }

    const looksLikeJson = payload.startsWith('{') || payload.startsWith('[') || payload.startsWith('"');
    const jsonCandidate = this.tryParseLegacyJson(payload);
    if (jsonCandidate.parsed) {
      this.extractNormalizedOptions(jsonCandidate.value, options);
      for (const option of options) {
        values.add(option.value);
      }

      return {
        state: values.size > 0 ? 'valid' : 'empty',
        options,
        values,
        invalidSourceCount: 0,
        emptySourceCount: values.size > 0 ? 0 : 1,
        rawSourceCount: 1,
        rawSources: []
      };
    }

    const delimitedOptions = this.parseDelimitedOptions(payload);
    for (const option of delimitedOptions) {
      options.push(option);
      values.add(option.value);
    }

    if (values.size > 0) {
      return {
        state: 'valid',
        options,
        values,
        invalidSourceCount: 0,
        emptySourceCount: 0,
        rawSourceCount: 1,
        rawSources: []
      };
    }

    return {
      state: looksLikeJson ? 'invalid' : 'empty',
      options,
      values,
      invalidSourceCount: looksLikeJson ? 1 : 0,
      emptySourceCount: looksLikeJson ? 0 : 1,
      rawSourceCount: 1,
      rawSources: [],
      invalidReason: looksLikeJson ? 'JSON غير صالح أو غير قابل للتطبيع.' : undefined
    };
  }

  private tryParseLegacyJson(payload: string): { parsed: boolean; value: unknown | null } {
    const normalized = this.normalizeNullable(payload);
    if (!normalized) {
      return { parsed: false, value: null };
    }

    const tryParse = (candidate: string): unknown | null => {
      try {
        return JSON.parse(candidate);
      } catch {
        return null;
      }
    };

    const parsedDirect = tryParse(normalized);
    if (parsedDirect != null) {
      return this.resolveNestedSerializedJson(parsedDirect);
    }

    const singleQuoteNormalized = normalized.replace(/'/g, '"');
    const parsedSingleQuote = tryParse(singleQuoteNormalized);
    if (parsedSingleQuote != null) {
      return this.resolveNestedSerializedJson(parsedSingleQuote);
    }

    return { parsed: false, value: null };
  }

  private resolveNestedSerializedJson(parsed: unknown): { parsed: boolean; value: unknown | null } {
    if (typeof parsed !== 'string') {
      return { parsed: true, value: parsed };
    }

    const nestedPayload = this.normalizeNullable(parsed);
    if (!nestedPayload || !(nestedPayload.startsWith('{') || nestedPayload.startsWith('['))) {
      return { parsed: true, value: parsed };
    }

    return this.tryParseLegacyJson(nestedPayload);
  }

  private parseDelimitedOptions(payload: string): Array<{ value: string; label: string }> {
    const options: Array<{ value: string; label: string }> = [];
    let rawTokens = payload
      .split(/[\r\n|;]/g)
      .map(token => token.trim())
      .filter(token => token.length > 0);
    if (rawTokens.length === 1 && rawTokens[0].includes(',')) {
      rawTokens = rawTokens[0]
        .split(',')
        .map(token => token.trim())
        .filter(token => token.length > 0);
    }

    for (const token of rawTokens) {
      const separatorIndex = token.search(/[:=]/);
      if (separatorIndex > 0) {
        const left = this.normalizeNullable(token.substring(0, separatorIndex));
        const right = this.normalizeNullable(token.substring(separatorIndex + 1));
        if (left) {
          options.push({
            value: left,
            label: right ?? left
          });
        }
        continue;
      }

      const normalizedToken = this.normalizeNullable(token);
      if (!normalizedToken) {
        continue;
      }

      options.push({
        value: normalizedToken,
        label: normalizedToken
      });
    }

    return options;
  }

  private extractNormalizedOptions(source: unknown, collector: Array<{ value: string; label: string }>): void {
    if (source == null) {
      return;
    }

    if (Array.isArray(source)) {
      for (const item of source) {
        this.extractNormalizedOptions(item, collector);
      }
      return;
    }

    if (typeof source === 'object') {
      const record = source as Record<string, unknown>;
      const mappedOption = this.mapLegacyOptionRecord(record);
      if (mappedOption) {
        collector.push(mappedOption);
        return;
      }

      const containerKeys = ['options', 'items', 'data', 'values', 'lookupOptions', 'dropdownOptions', 'list'];
      let hasContainer = false;
      for (const key of containerKeys) {
        if (!Object.prototype.hasOwnProperty.call(record, key)) {
          continue;
        }

        hasContainer = true;
        this.extractNormalizedOptions(record[key], collector);
      }

      if (hasContainer) {
        return;
      }

      for (const [key, value] of Object.entries(record)) {
        if (value == null || typeof value === 'object') {
          continue;
        }

        const normalizedKey = this.normalizeNullable(key);
        const normalizedLabel = this.normalizeNullable(String(value));
        if (!normalizedKey || !normalizedLabel) {
          continue;
        }

        collector.push({
          value: normalizedKey,
          label: normalizedLabel
        });
      }

      return;
    }

    if (typeof source === 'string' || typeof source === 'number' || typeof source === 'boolean') {
      const normalized = this.normalizeNullable(String(source));
      if (!normalized) {
        return;
      }

      collector.push({
        value: normalized,
        label: normalized
      });
    }
  }

  private mapLegacyOptionRecord(record: Record<string, unknown>): { value: string; label: string } | null {
    const value = this.readFirstPrimitiveValue(record, ['value', 'key', 'id', 'code']);
    const label = this.readFirstPrimitiveValue(record, ['label', 'name', 'text', 'title']);
    if (!value) {
      return null;
    }

    return {
      value,
      label: label ?? value
    };
  }

  private readFirstPrimitiveValue(record: Record<string, unknown>, keys: string[]): string | null {
    for (const key of keys) {
      if (!Object.prototype.hasOwnProperty.call(record, key)) {
        continue;
      }

      const candidate = record[key];
      if (candidate == null || typeof candidate === 'object') {
        continue;
      }

      const normalized = this.normalizeNullable(String(candidate));
      if (normalized) {
        return normalized;
      }
    }

    return null;
  }

  private mapBackendFieldTypeToBindingType(fieldType: string | undefined, dataType: string | undefined): BoundFieldItem['type'] {
    const normalizedType = (fieldType ?? '').trim().toLowerCase();
    const normalizedDataType = (dataType ?? '').trim().toLowerCase();

    if (normalizedType.includes('text') && normalizedType.includes('area')) {
      return 'Textarea';
    }

    if (normalizedType.includes('drop')
      || normalizedType.includes('select')
      || normalizedType.includes('combo')
      || normalizedType.includes('radio')
      || normalizedType.includes('tree')) {
      return 'Dropdown';
    }

    if (normalizedType.includes('date') || normalizedDataType.includes('date') || normalizedDataType.includes('time')) {
      return 'Date';
    }

    if (normalizedType.includes('check')
      || normalizedType.includes('bool')
      || normalizedType.includes('switch')
      || normalizedDataType.includes('bool')) {
      return 'Checkbox';
    }

    if (normalizedType.includes('number')
      || normalizedType.includes('decimal')
      || normalizedType.includes('int')
      || normalizedDataType.includes('number')
      || normalizedDataType.includes('int')
      || normalizedDataType.includes('decimal')) {
      return 'Number';
    }

    return 'InputText';
  }

  private mapBindingTypeToBackendFieldType(type: BoundFieldItem['type']): string {
    switch (type) {
      case 'Textarea':
        return 'TextArea';
      case 'Dropdown':
        return 'Dropdown';
      case 'Number':
        return 'InputNumber';
      case 'Date':
        return 'Date';
      case 'Checkbox':
        return 'Checkbox';
      case 'InputText':
      default:
        return 'InputText';
    }
  }

  private mapBindingTypeToBackendDataType(type: BoundFieldItem['type']): string {
    switch (type) {
      case 'Number':
        return 'number';
      case 'Date':
        return 'date';
      case 'Checkbox':
        return 'bool';
      case 'Textarea':
      case 'Dropdown':
      case 'InputText':
      default:
        return 'string';
    }
  }

  private normalizeBindingType(value: unknown): BoundFieldItem['type'] {
    if (value === 'InputText'
      || value === 'Textarea'
      || value === 'Dropdown'
      || value === 'Number'
      || value === 'Date'
      || value === 'Checkbox') {
      return value;
    }

    return 'InputText';
  }

  getFieldTypeLabel(type: string | undefined): string {
    switch (this.normalizeBindingType(type)) {
      case 'Textarea':
        return 'نص طويل';
      case 'Dropdown':
        return 'قائمة اختيار';
      case 'Number':
        return 'رقم';
      case 'Date':
        return 'تاريخ';
      case 'Checkbox':
        return 'اختيار نعم/لا';
      case 'InputText':
      default:
        return 'نص قصير';
    }
  }

  private resolveDefaultGroupId(): number | null {
    if (this.groupOptions.length === 0) {
      return null;
    }

    return this.groupOptions[0].value;
  }

  private resolveGroupName(groupId: number | null): string | undefined {
    if (!groupId) {
      return undefined;
    }

    const match = this.groups.find(group => group.groupId === groupId);
    return this.normalizeNullable(match?.groupName) ?? `مجموعة ${groupId}`;
  }

  private readArrayResponse<T>(response: CommonResponse<T[]>, fallbackMessage: string): T[] {
    if (!response) {
      throw new Error(fallbackMessage);
    }

    if (response.isSuccess === false) {
      throw new Error(this.resolveCommonResponseErrorMessage(response, fallbackMessage));
    }

    if (Array.isArray(response.errors) && response.errors.length > 0) {
      throw new Error(response.errors[0]?.message ?? fallbackMessage);
    }

    return Array.isArray(response.data) ? response.data : [];
  }

  private readSingleResponse<T>(response: CommonResponse<T>, fallbackMessage: string): T {
    if (!response) {
      throw new Error(fallbackMessage);
    }

    if (response.isSuccess === false) {
      throw new Error(this.resolveCommonResponseErrorMessage(response, fallbackMessage));
    }

    if (Array.isArray(response.errors) && response.errors.length > 0) {
      throw new Error(response.errors[0]?.message ?? fallbackMessage);
    }

    if (response.data == null) {
      throw new Error(fallbackMessage);
    }

    return response.data;
  }

  private resolveCommonResponseErrorMessage(response: CommonResponse<unknown>, fallbackMessage: string): string {
    const firstError = (response.errors ?? [])
      .map(item => String(item?.message ?? '').trim())
      .find(message => message.length > 0);
    if (firstError) {
      return firstError;
    }

    const directMessage = this.normalizeNullable((response as unknown as { message?: string }).message);
    if (directMessage) {
      return directMessage;
    }

    return fallbackMessage;
  }

  private toSafeSequenceLength(value: unknown): number {
    const normalized = Number(value ?? 6);
    if (!Number.isFinite(normalized)) {
      return 6;
    }

    const rounded = Math.trunc(normalized);
    if (rounded < 1) {
      return 1;
    }

    if (rounded > 12) {
      return 12;
    }

    return rounded;
  }

  private toSafeStartingValue(value: unknown): number {
    const normalized = Number(value ?? 1);
    if (!Number.isFinite(normalized)) {
      return 1;
    }

    const rounded = Math.trunc(normalized);
    if (rounded < 1) {
      return 1;
    }

    if (rounded > 2147483647) {
      return 2147483647;
    }

    return rounded;
  }

  private normalizeReferenceMode(value: unknown): ReferenceMode {
    const normalized = this.readReferenceModeToken(value);
    return normalized === 'custom' ? 'custom' : 'default';
  }

  private readReferenceModeToken(value: unknown): string {
    if (value && typeof value === 'object') {
      const record = value as Record<string, unknown>;
      const nestedCandidate = record['value']
        ?? record['referenceMode']
        ?? record['mode']
        ?? record['code']
        ?? record['id'];
      if (nestedCandidate != null && nestedCandidate !== value) {
        return this.readReferenceModeToken(nestedCandidate);
      }
    }

    const normalized = String(value ?? '').trim().toLowerCase();
    if (normalized === 'custom'
      || normalized === 'مخصص'
      || normalized === 'ترقيم مخصص') {
      return 'custom';
    }

    if (normalized === 'default'
      || normalized === 'افتراضي'
      || normalized === 'ترقيم افتراضي') {
      return 'default';
    }

    return normalized;
  }

  private normalizeReferenceSeparator(value: unknown): ReferenceSeparator {
    if (value == null) {
      return '-';
    }

    const normalized = String(value ?? '').trim();
    if (normalized === '/' || normalized === '_' || normalized === '-') {
      return normalized;
    }

    return normalized.length === 0 ? '' : '-';
  }

  private validateReferencePolicy(): string[] {
    const issues: string[] = [];
    const raw = this.referencePolicyForm.getRawValue();
    if (raw['referencePolicyEnabled'] !== true) {
      return issues;
    }

    const mode = this.normalizeReferenceMode(raw['referenceMode']);
    const separator = this.normalizeReferenceSeparator(raw['referenceSeparator']);
    if (!['-', '/', '_', ''].includes(separator)) {
      issues.push('فاصل الرقم المرجعي غير صالح.');
    }

    const sequenceLength = this.toSafeSequenceLength(raw['referenceSequencePaddingLength']);
    if (sequenceLength < 1 || sequenceLength > 12) {
      issues.push('طول المسلسل يجب أن يكون بين 1 و 12.');
    }

    const startingValue = this.toSafeStartingValue(raw['referenceStartingValue']);
    if (startingValue < 1) {
      issues.push('قيمة بداية المسلسل يجب أن تكون رقمًا موجبًا.');
    }

    if (mode === 'custom') {
      const components = this.getNormalizedReferenceComponents();
      const sequenceComponents = components.filter(component => component.type === 'sequence');
      if (sequenceComponents.length === 0) {
        issues.push('لا يمكن حفظ سياسة مخصصة بدون مسلسل.');
      }

      if (sequenceComponents.length > 1) {
        issues.push('لا يمكن تكرار المسلسل أكثر من مرة.');
      }

      if (components.length === 0 || components[components.length - 1]?.type !== 'sequence') {
        issues.push('يجب أن يكون المسلسل هو الجزء الأخير دائمًا.');
      }

      for (const component of components) {
        if (component.type === 'static_text' && !this.normalizeNullable(component.value)) {
          issues.push('يوجد جزء نص ثابت فارغ. يرجى إدخال نص صالح.');
        }

        if (component.type === 'field') {
          const fieldKey = this.normalizeNullable(component.fieldKey);
          if (!fieldKey) {
            issues.push('يوجد جزء من نوع حقل بدون اختيار حقل.');
            continue;
          }

          if (!this.isRequiredReferenceField(fieldKey)) {
            issues.push(`الحقل ${fieldKey} غير إلزامي عند الإنشاء ولا يمكن استخدامه في الرقم المرجعي.`);
          }
        }
      }

      const hasMissingPreviewPart = this.referencePreview.includes('...');
      if (hasMissingPreviewPart) {
        issues.push('لا يمكن حفظ سياسة تنتج قيمة ناقصة أو فارغة.');
      }
    }

    if (!this.normalizeNullable(this.referencePreview)) {
      issues.push('لا يمكن حفظ سياسة تنتج رقمًا مرجعيًا فارغًا.');
    }

    return Array.from(new Set(issues));
  }

  private createReferenceComponent(type: ReferenceComponentType): ReferenceComponentVm {
    return {
      id: `ref-comp-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      type
    };
  }

  private createReferenceComponentFormGroup(component: ReferenceComponentVm): FormGroup {
    return this.fb.group({
      id: [component.id],
      type: [component.type],
      value: [component.value ?? ''],
      fieldKey: [component.fieldKey ?? '']
    });
  }

  private getRawReferenceComponentsFromForm(): ReferenceComponentVm[] {
    const raw = this.referenceComponentsForm.getRawValue() as Array<Record<string, unknown>>;
    return (raw ?? []).map((item, index) => ({
      id: this.normalizeNullable(item['id']) ?? `ref-comp-${Date.now()}-${index}`,
      type: this.normalizeReferenceComponentType(item['type']),
      value: this.normalizeNullable(item['value']) ?? undefined,
      fieldKey: this.normalizeNullable(item['fieldKey']) ?? undefined
    }));
  }

  private getNormalizedReferenceComponents(): ReferenceComponentVm[] {
    return this.normalizeReferenceComponentsStructure(this.getRawReferenceComponentsFromForm());
  }

  private setReferenceComponents(
    components: ReadonlyArray<ReferenceComponentVm> | null | undefined,
    emitEvent: boolean = false
  ): void {
    const normalized = this.normalizeReferenceComponentsStructure(components ?? []);
    while (this.referenceComponentsForm.length > 0) {
      this.referenceComponentsForm.removeAt(this.referenceComponentsForm.length - 1, { emitEvent: false });
    }

    for (const component of normalized) {
      this.referenceComponentsForm.push(this.createReferenceComponentFormGroup(component));
    }

    this.referenceComponentsForm.updateValueAndValidity({ emitEvent });
  }

  private normalizeReferenceComponentsStructure(
    components: ReadonlyArray<ReferenceComponentVm> | null | undefined
  ): ReferenceComponentVm[] {
    const source = [...(components ?? [])];
    const normalized: ReferenceComponentVm[] = [];
    let sequenceComponent: ReferenceComponentVm | null = null;

    for (const item of source) {
      const normalizedType = this.normalizeReferenceComponentType(item?.type);
      const normalizedItem: ReferenceComponentVm = {
        id: item?.id ?? this.createReferenceComponent(normalizedType).id,
        type: normalizedType,
        value: this.normalizeNullable(item?.value) ?? undefined,
        fieldKey: this.normalizeNullable(item?.fieldKey) ?? undefined
      };

      if (normalizedType === 'sequence') {
        if (!sequenceComponent) {
          sequenceComponent = normalizedItem;
        }
        continue;
      }

      normalized.push(normalizedItem);
    }

    normalized.push(sequenceComponent ?? this.createReferenceComponent('sequence'));
    return normalized;
  }

  private normalizeReferenceComponentType(value: unknown): ReferenceComponentType {
    const normalized = String(value ?? '').trim().toLowerCase();
    if (normalized === 'field'
      || normalized === 'year'
      || normalized === 'month'
      || normalized === 'day'
      || normalized === 'sequence') {
      return normalized;
    }

    return 'static_text';
  }

  private parseReferenceComponents(value: unknown): ReferenceComponentVm[] {
    let source: unknown[] = [];
    if (Array.isArray(value)) {
      source = value;
    } else {
      const asString = this.normalizeNullable(value);
      if (asString) {
        try {
          const parsedJson = JSON.parse(asString);
          source = Array.isArray(parsedJson) ? parsedJson : [];
        } catch {
          source = [];
        }
      }
    }

    if (source.length === 0) {
      return [this.createReferenceComponent('sequence')];
    }

    const parsed = source.map((item, index) => {
      const candidate = item as SubjectReferencePolicyComponentDto;
      return {
        id: `ref-component-loaded-${index}-${Date.now()}`,
        type: this.normalizeReferenceComponentType(candidate?.type),
        value: this.normalizeNullable(candidate?.value) ?? undefined,
        fieldKey: this.normalizeNullable(candidate?.fieldKey) ?? undefined
      } as ReferenceComponentVm;
    });

    return this.normalizeReferenceComponentsStructure(parsed);
  }

  private serializeReferenceComponents(
    components: ReadonlyArray<ReferenceComponentVm>
  ): SubjectReferencePolicyComponentDto[] {
    return this.normalizeReferenceComponentsStructure(components)
      .map(component => ({
        type: component.type,
        value: component.type === 'static_text' ? this.normalizeNullable(component.value) ?? undefined : undefined,
        fieldKey: component.type === 'field' ? this.normalizeNullable(component.fieldKey) ?? undefined : undefined
      }));
  }

  private resolveFieldPreviewValue(fieldKey: string | undefined): string {
    const normalizedKey = this.normalizeNullable(fieldKey);
    if (!normalizedKey) {
      return '...';
    }

    const option = this.requiredReferenceFieldOptions.find(item =>
      this.normalizeFieldKey(item.value) === this.normalizeFieldKey(normalizedKey));
    if (!option) {
      return '...';
    }

    return `{${normalizedKey}}`;
  }

  private isRequiredReferenceField(fieldKey: string): boolean {
    const normalized = this.normalizeFieldKey(fieldKey);
    return this.requiredReferenceFieldOptions.some(option =>
      this.normalizeFieldKey(option.value) === normalized);
  }

  private normalizeSequenceResetScope(value: unknown): SequenceResetScope {
    const normalized = String(value ?? '').trim().toLowerCase();
    if (normalized === 'yearly' || normalized === 'annual' || normalized === 'year') {
      return 'yearly';
    }

    if (normalized === 'monthly' || normalized === 'month') {
      return 'monthly';
    }

    return 'none';
  }

  private normalizeDisplayMode(value: unknown): FormDisplayMode {
    const normalized = String(value ?? '').trim().toLowerCase();
    if (normalized === 'tabbed') {
      return 'Tabbed';
    }

    return 'Standard';
  }

  private syncContextFromInputsOrRoute(): void {
    const inputCategoryId = this.toPositiveInt(this.requestTypeId);
    const inputApplicationId = this.normalizeNullable(this.applicationId);
    const cachedContext = this.readCatalogContextCache();

    const nextCategoryId = inputCategoryId ?? this.routeCategoryId ?? cachedContext.categoryId;
    const nextApplicationId = inputApplicationId ?? this.routeApplicationId ?? cachedContext.applicationId;
    const contextChanged = nextCategoryId !== this.currentCategoryId || nextApplicationId !== this.currentApplicationId;

    this.vm = {
      context: {
        categoryId: nextCategoryId,
        applicationId: nextApplicationId
      }
    };

    if (!contextChanged) {
      this.refreshStepState();
      return;
    }

    this.currentCategoryId = nextCategoryId;
    this.currentApplicationId = nextApplicationId;
    this.persistCatalogContextCache(nextCategoryId, nextApplicationId);
    this.syncRouteContext(nextCategoryId, nextApplicationId);

    this.resetWorkspaceForNewContext();
    const draftValues = this.readDraftFromLocalStorage();
    if (draftValues) {
      this.patchReferencePolicyFormFromStep(draftValues);
      this.patchPresentationFormFromStep(draftValues);
      this.patchBindingsFromStep(draftValues);
      this.hasPendingBackendChanges = true;
      this.stepMessageSeverity = 'warn';
      this.stepMessage = 'تم تحميل مسودة محلية غير محفوظة في قاعدة البيانات.';
      this.evaluateBindings(true, false);
    } else {
      this.patchPresentationFormDefaultsIfMissing();
      this.evaluateBindings(false);
    }

    if (nextCategoryId) {
      void this.loadBackendWorkspace(nextCategoryId, nextApplicationId);
      return;
    }

    this.stepMessageSeverity = 'warn';
    this.stepMessage = 'اختر نوع الطلب أولًا من لوحة الكتالوج لبدء الربط.';
  }

  private syncRouteContext(categoryId: number | null, applicationId: string | null): void {
    const routeQueryCategoryId = this.readRouteCategoryId(this.route.snapshot.queryParamMap);
    const routeQueryApplicationId = this.readRouteApplicationId(this.route.snapshot.queryParamMap);

    if (routeQueryCategoryId === categoryId && routeQueryApplicationId === applicationId) {
      return;
    }

    this.router.navigate([], {
      relativeTo: this.route,
      replaceUrl: true,
      queryParamsHandling: 'merge',
      queryParams: {
        categoryId: categoryId ?? null,
        applicationId: applicationId ?? null
      }
    });
  }

  private refreshStepState(syncToken: 'valid' | 'draft' = this.validation.isValid ? 'valid' : 'draft'): void {
    const requiredCompleted = syncToken === 'valid' ? 1 : 0;

    this.step = {
      requiredCompleted,
      requiredTotal: 1,
      isCompleted: requiredCompleted === 1
    };
  }

  private buildDraftStepValues(syncToken: 'valid' | 'draft'): Record<string, unknown> {
    const referenceValue = this.referencePolicyForm.getRawValue();
    const presentationValue = this.presentationForm.getRawValue();

    return {
      bindingPayload: this.bindingEngine.serializeBindingsPayload(this.bindings),
      bindingValidationToken: syncToken === 'valid' ? 'valid' : null,
      referencePolicyEnabled: referenceValue['referencePolicyEnabled'] === true,
      referenceMode: this.normalizeReferenceMode(referenceValue['referenceMode']),
      referencePrefix: this.normalizeNullable(referenceValue['referencePrefix']),
      referenceSeparator: this.normalizeReferenceSeparator(referenceValue['referenceSeparator']),
      serialId: this.toPositiveInt(referenceValue['serialId']),
      serialName: this.normalizeSerialName(referenceValue['serialName']),
      referenceStartingValue: this.toSafeStartingValue(referenceValue['referenceStartingValue']),
      referenceSequencePaddingLength: this.toSafeSequenceLength(referenceValue['referenceSequencePaddingLength']),
      referenceSequenceResetScope: this.normalizeSequenceResetScope(referenceValue['referenceSequenceResetScope']),
      referenceComponents: this.serializeReferenceComponents(this.getNormalizedReferenceComponents()),
      defaultDisplayMode: this.normalizeDisplayMode(presentationValue['defaultDisplayMode']),
      allowUserToChangeDisplayMode: presentationValue['allowUserToChangeDisplayMode'] === true
    };
  }

  private buildDraftStorageKey(): string | null {
    if (!this.currentCategoryId || !this.currentApplicationId) {
      return null;
    }

    return `connect:${this.stepKey}:${this.currentApplicationId}:${this.currentCategoryId}`;
  }

  private persistDraftToLocalStorage(): boolean {
    const key = this.buildDraftStorageKey();
    if (!key) {
      return false;
    }

    const syncToken: 'valid' | 'draft' = this.validation.isValid ? 'valid' : 'draft';
    localStorage.setItem(key, JSON.stringify(this.buildDraftStepValues(syncToken)));
    return true;
  }

  private clearDraftFromLocalStorage(): void {
    const key = this.buildDraftStorageKey();
    if (!key) {
      return;
    }

    localStorage.removeItem(key);
  }

  private readDraftFromLocalStorage(): Record<string, unknown> | null {
    const key = this.buildDraftStorageKey();
    if (!key) {
      return null;
    }

    const raw = localStorage.getItem(key);
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return null;
      }

      return parsed as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  private resetWorkspaceForNewContext(): void {
    this.backendWorkspaceLoaded = false;
    this.libraryLoadedFromDb = false;
    this.hasPendingBackendChanges = false;
    this.librarySearchTerm = '';
    this.bindings = [];
    this.groups = [];
    this.groupOptions = [];
    this.serialOptions = [];
    this.fieldCatalogByKey.clear();
    this.subjectTypeAdmin = null;
    this.reusableFields = [];
    this.dynamicRuntimeAdvancedOpenBindingIds.clear();
    this.dynamicRuntimeAdvancedDraftByBindingId.clear();
    this.dynamicRuntimeAdvancedErrorByBindingId.clear();

    this.syncingFromStore = true;
    this.referencePolicyForm.patchValue({
      referencePolicyEnabled: true,
      referenceMode: 'default',
      referencePrefix: '',
      referenceSeparator: '-',
      serialId: null,
      serialName: '',
      referenceStartingValue: 1,
      referenceSequencePaddingLength: 6,
      referenceSequenceResetScope: 'none'
    }, { emitEvent: false });
    this.presentationForm.patchValue({
      defaultDisplayMode: 'Standard',
      allowUserToChangeDisplayMode: false
    }, { emitEvent: false });
    this.newFieldForm.patchValue({
      fieldKey: '',
      label: '',
      type: 'InputText',
      groupId: null,
      required: false,
      readonly: false,
      visible: true,
      defaultValue: ''
    }, { emitEvent: false });
    this.setReferenceComponents([this.createReferenceComponent('sequence')], false);
    this.syncingFromStore = false;
    this.refreshStepState('draft');
  }

  private toPositiveInt(value: unknown): number | null {
    const normalized = Number(value ?? 0);
    if (!Number.isFinite(normalized) || normalized <= 0) {
      return null;
    }

    return Math.trunc(normalized);
  }

  private toNonNegativeInt(value: unknown): number | null {
    const normalized = Number(value ?? 0);
    if (!Number.isFinite(normalized) || normalized < 0) {
      return null;
    }

    return Math.trunc(normalized);
  }

  private normalizeNullable(value: unknown): string | null {
    const normalized = String(value ?? '').trim();
    return normalized.length > 0 ? normalized : null;
  }

  private normalizeSerialName(value: unknown): string | null {
    const normalized = this.normalizeNullable(value);
    if (!normalized) {
      return null;
    }

    const collapsed = normalized.replace(/\s+/g, ' ').trim();
    return collapsed.length > 0 ? collapsed : null;
  }

  private normalizeSerialNameKey(value: unknown): string {
    return this.normalizeSerialName(value)?.toLowerCase() ?? '';
  }

  private resolveSerialOptionValue(serialIdRaw: unknown, serialName: string | null): number | null {
    const serialId = this.toPositiveInt(serialIdRaw);
    if (serialId && this.serialOptions.some(option => option.value === serialId)) {
      return serialId;
    }

    if (!serialName) {
      return null;
    }

    const serialKey = this.normalizeSerialNameKey(serialName);
    const match = this.serialOptions.find(option => this.normalizeSerialNameKey(option.label) === serialKey);
    return match?.value ?? null;
  }

  private readRouteCategoryId(params: ParamMap): number | null {
    return this.readPositiveIntParam(params, ['categoryId', 'requestTypeId', 'subjectTypeId']);
  }

  private readRouteApplicationId(params: ParamMap): string | null {
    return this.readTextParam(params, ['applicationId', 'appId', 'scopeApplicationId']);
  }

  private readPositiveIntParam(params: ParamMap, keys: ReadonlyArray<string>): number | null {
    for (const key of keys) {
      const value = this.toPositiveInt(params.get(key));
      if (value != null) {
        return value;
      }
    }

    return null;
  }

  private readTextParam(params: ParamMap, keys: ReadonlyArray<string>): string | null {
    for (const key of keys) {
      const value = this.normalizeNullable(params.get(key));
      if (value != null) {
        return value;
      }
    }

    return null;
  }

  private normalizeFieldKey(value: unknown): string {
    return (String(value ?? '').trim()).toLowerCase();
  }

  private readCatalogContextCache(): { categoryId: number | null; applicationId: string | null } {
    const raw = localStorage.getItem(FieldLibraryBindingPageComponent.CATALOG_CONTEXT_STORAGE_KEY);
    if (!raw) {
      return { categoryId: null, applicationId: null };
    }

    try {
      const parsed = JSON.parse(raw) as { categoryId?: unknown; applicationId?: unknown };
      return {
        categoryId: this.toPositiveInt(parsed?.categoryId),
        applicationId: this.normalizeNullable(parsed?.applicationId)
      };
    } catch {
      return { categoryId: null, applicationId: null };
    }
  }

  private persistCatalogContextCache(categoryId: number | null, applicationId: string | null): void {
    const normalizedCategoryId = this.toPositiveInt(categoryId);
    const normalizedApplicationId = this.normalizeNullable(applicationId);
    if (!normalizedCategoryId && !normalizedApplicationId) {
      return;
    }

    const payload = {
      categoryId: normalizedCategoryId,
      applicationId: normalizedApplicationId
    };

    localStorage.setItem(FieldLibraryBindingPageComponent.CATALOG_CONTEXT_STORAGE_KEY, JSON.stringify(payload));
  }

  private toErrorMessage(error: unknown, fallbackMessage: string): string {
    if (error instanceof Error && error.message.trim().length > 0) {
      return error.message;
    }

    const message = String(error ?? '').trim();
    return message.length > 0 ? message : fallbackMessage;
  }
}
