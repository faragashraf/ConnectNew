import { ChangeDetectionStrategy, Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
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
import {
  BoundFieldItem,
  FieldLibraryBindingValidationResult,
  ReusableFieldLibraryItem
} from '../../domain/models/field-library-binding.models';
import { FieldLibraryBindingEngine } from '../../domain/field-library-binding/field-library-binding.engine';

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

@Component({
  selector: 'app-field-library-binding-page',
  templateUrl: './field-library-binding-page.component.html',
  styleUrls: ['./field-library-binding-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FieldLibraryBindingPageComponent implements OnInit, OnChanges, OnDestroy {
  private static readonly CATALOG_CONTEXT_STORAGE_KEY = 'connect:control-center-catalog:context:v1';

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

  readonly referencePolicyForm: FormGroup = this.fb.group({
    referencePolicyEnabled: [true],
    referenceMode: ['default', [Validators.required]],
    referencePrefix: ['', [Validators.maxLength(40)]],
    referenceSeparator: ['-', [Validators.required]],
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

  vm: FieldBindingContextVm | null = null;
  step: FieldBindingStepVm | null = null;

  reusableFields: ReadonlyArray<ReusableFieldLibraryItem> = [];
  bindings: BoundFieldItem[] = [];
  validation: FieldLibraryBindingValidationResult = { isValid: false, blockingIssues: [], warnings: [] };
  referenceComponents: ReferenceComponentVm[] = [];
  referencePolicyBlockingIssues: string[] = [];

  groups: SubjectAdminGroupDto[] = [];
  groupOptions: Array<{ label: string; value: number }> = [];

  stepMessage = '';
  stepMessageSeverity: 'success' | 'warn' = 'warn';
  librarySearchTerm = '';

  loadingLibrary = false;
  savingToBackend = false;
  backendWorkspaceLoaded = false;
  libraryLoadedFromDb = false;
  hasPendingBackendChanges = false;

  private readonly subscriptions = new Subscription();
  private syncingFromStore = false;
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
    private readonly adminCatalogController: DynamicSubjectsAdminCatalogController
  ) {}

  ngOnInit(): void {
    this.referenceComponents = [this.createReferenceComponent('sequence')];
    this.vm = { context: { categoryId: null, applicationId: null } };
    this.step = { requiredCompleted: 0, requiredTotal: 1, isCompleted: false };

    this.subscriptions.add(
      combineLatest([this.route.paramMap, this.route.queryParamMap]).subscribe(([pathParams, queryParams]) => {
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
    const parts = this.referenceComponents.map(component => {
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
      sourceFieldId: existingField?.cdmendSql ? `fld-${existingField.cdmendSql}` : newBinding.sourceFieldId
    };

    this.bindings = this.bindingEngine.normalizeDisplayOrder([...this.bindings, enriched]);
    this.evaluateBindings(true, true);
  }

  async onCreateField(): Promise<void> {
    if (this.groupOptions.length === 0) {
      try {
        await this.ensureAtLeastOneGroupExists();
        const defaultGroupId = this.resolveDefaultGroupId();
        if (defaultGroupId) {
          this.newFieldForm.patchValue({ groupId: defaultGroupId }, { emitEvent: false });
        }
      } catch (error) {
        this.stepMessageSeverity = 'warn';
        this.stepMessage = this.toErrorMessage(error, 'تعذر تجهيز مجموعة افتراضية لإضافة الحقل.');
        return;
      }
    }

    this.newFieldForm.markAllAsTouched();
    if (this.newFieldForm.invalid) {
      this.stepMessageSeverity = 'warn';
      this.stepMessage = 'يرجى استكمال بيانات الحقل الجديد بشكل صحيح.';
      return;
    }

    const raw = this.newFieldForm.getRawValue();
    const fieldKey = this.normalizeNullable(raw['fieldKey']);
    const label = this.normalizeNullable(raw['label']);
    const groupId = this.toPositiveInt(raw['groupId']);

    if (!fieldKey || !label || !groupId) {
      this.stepMessageSeverity = 'warn';
      this.stepMessage = 'يرجى إدخال مفتاح حقل واسم حقل ومجموعة صالحين.';
      return;
    }

    const normalizedFieldKey = this.normalizeFieldKey(fieldKey);
    const duplicated = this.bindings.some(item => this.normalizeFieldKey(item.fieldKey) === normalizedFieldKey);
    if (duplicated) {
      this.stepMessageSeverity = 'warn';
      this.stepMessage = `الحقل ${fieldKey} مرتبط بالفعل بالنوع الحالي.`;
      return;
    }

    const nextDisplayOrder = (this.bindings.reduce((max, item) => Math.max(max, item.displayOrder), 0) || 0) + 1;
    const type = this.normalizeBindingType(raw['type']);

    const createdBinding: BoundFieldItem = {
      bindingId: `bind-local-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      sourceFieldId: `local-${fieldKey}`,
      fieldKey,
      label,
      type,
      displayOrder: nextDisplayOrder,
      visible: raw['visible'] !== false,
      required: raw['required'] === true,
      readonly: raw['readonly'] === true,
      defaultValue: String(raw['defaultValue'] ?? '').trim(),
      groupId,
      groupName: this.resolveGroupName(groupId)
    };

    this.bindings = this.bindingEngine.normalizeDisplayOrder([...this.bindings, createdBinding]);
    this.newFieldForm.reset({
      fieldKey: '',
      label: '',
      type: 'InputText',
      groupId,
      required: false,
      readonly: false,
      visible: true,
      defaultValue: ''
    });

    this.evaluateBindings(true, true);
  }

  onDeleteBinding(binding: BoundFieldItem): void {
    this.bindings = this.bindingEngine.normalizeDisplayOrder(
      this.bindings.filter(item => item.bindingId !== binding.bindingId)
    );
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

        return {
          ...item,
          fieldKey: normalizedFieldKey,
          label: normalizedLabel,
          type: this.normalizeBindingType(item.type),
          defaultValue: String(item.defaultValue ?? '').trim(),
          displayOrder,
          groupId,
          groupName: this.resolveGroupName(groupId)
        };
      })
    );
    this.evaluateBindings(true, true);
  }

  onAddReferenceComponent(): void {
    const sequenceIndex = this.referenceComponents.findIndex(component => component.type === 'sequence');
    const insertIndex = sequenceIndex >= 0 ? sequenceIndex : this.referenceComponents.length;
    this.referenceComponents.splice(insertIndex, 0, this.createReferenceComponent('static_text'));
    this.referenceComponents = this.normalizeReferenceComponentsStructure(this.referenceComponents);
    this.evaluateBindings(true, true);
  }

  onDeleteReferenceComponent(component: ReferenceComponentVm): void {
    if (component.type === 'sequence') {
      this.stepMessageSeverity = 'warn';
      this.stepMessage = 'لا يمكن حذف مكوّن المسلسل لأنه إلزامي.';
      return;
    }

    this.referenceComponents = this.referenceComponents.filter(item => item.id !== component.id);
    this.referenceComponents = this.normalizeReferenceComponentsStructure(this.referenceComponents);
    this.evaluateBindings(true, true);
  }

  onMoveReferenceComponentUp(component: ReferenceComponentVm): void {
    const index = this.referenceComponents.findIndex(item => item.id === component.id);
    if (index <= 0 || component.type === 'sequence') {
      return;
    }

    const reordered = [...this.referenceComponents];
    [reordered[index - 1], reordered[index]] = [reordered[index], reordered[index - 1]];
    this.referenceComponents = this.normalizeReferenceComponentsStructure(reordered);
    this.evaluateBindings(true, true);
  }

  onMoveReferenceComponentDown(component: ReferenceComponentVm): void {
    const index = this.referenceComponents.findIndex(item => item.id === component.id);
    if (index < 0 || index >= this.referenceComponents.length - 1 || component.type === 'sequence') {
      return;
    }

    const reordered = [...this.referenceComponents];
    [reordered[index + 1], reordered[index]] = [reordered[index], reordered[index + 1]];
    this.referenceComponents = this.normalizeReferenceComponentsStructure(reordered);
    this.evaluateBindings(true, true);
  }

  onReferenceComponentTypeChanged(component: ReferenceComponentVm): void {
    if (component.type !== 'static_text') {
      component.value = undefined;
    }

    if (component.type !== 'field') {
      component.fieldKey = undefined;
    }

    this.referenceComponents = this.normalizeReferenceComponentsStructure(this.referenceComponents);
    this.evaluateBindings(true, true);
  }

  onReferenceComponentValueChanged(): void {
    this.referenceComponents = this.normalizeReferenceComponentsStructure(this.referenceComponents);
    this.evaluateBindings(true, true);
  }

  async onSaveToBackend(): Promise<void> {
    this.referencePolicyForm.markAllAsTouched();
    this.presentationForm.markAllAsTouched();
    this.evaluateBindings(true, false);

    if (this.referencePolicyForm.invalid || this.presentationForm.invalid || !this.validation.isValid) {
      this.stepMessageSeverity = 'warn';
      this.stepMessage = 'لا يمكن الحفظ قبل استكمال المدخلات الإلزامية ومعالجة المشكلات المانعة.';
      return;
    }

    if (!this.currentCategoryId) {
      this.stepMessageSeverity = 'warn';
      this.stepMessage = 'يجب تحديد تصنيف صالح أولًا قبل الحفظ.';
      return;
    }

    if (!this.currentApplicationId) {
      this.stepMessageSeverity = 'warn';
      this.stepMessage = 'يجب تحديد تطبيق صالح أولًا قبل الحفظ.';
      return;
    }

    if (!this.backendWorkspaceLoaded) {
      this.stepMessageSeverity = 'warn';
      this.stepMessage = 'لا يمكن الحفظ قبل تحميل بيانات الربط الفعلية من قاعدة البيانات.';
      return;
    }

    this.savingToBackend = true;
    this.stepMessage = '';

    try {
      await this.persistBindingsToBackend(this.currentCategoryId, this.currentApplicationId);
      this.hasPendingBackendChanges = false;
      this.stepMessageSeverity = 'success';
      this.stepMessage = 'تم حفظ الحقول وسياسة الرقم المرجعي في قاعدة البيانات بنجاح.';
    } catch (error) {
      this.stepMessageSeverity = 'warn';
      this.stepMessage = this.toErrorMessage(error, 'تعذر حفظ التعديلات في قاعدة البيانات.');
    } finally {
      this.savingToBackend = false;
    }
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
    const referenceIssues = this.validateReferencePolicy();
    this.referencePolicyBlockingIssues = referenceIssues;

    this.validation = {
      isValid: baseValidation.isValid && groupIssues.length === 0 && referenceIssues.length === 0,
      blockingIssues: [...baseValidation.blockingIssues, ...groupIssues, ...referenceIssues],
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
      const [fieldsResponse, groupsResponse, linksResponse, subjectTypesResponse] = await Promise.all([
        firstValueFrom(this.dynamicSubjectsController.getAdminFields(applicationId ?? undefined)),
        firstValueFrom(this.adminCatalogController.getGroupsByCategory(categoryId)),
        firstValueFrom(this.dynamicSubjectsController.getAdminCategoryFieldLinks(categoryId)),
        firstValueFrom(this.dynamicSubjectsController.getSubjectTypesAdminConfig(applicationId ?? undefined))
      ]);

      if (loadToken !== this.activeLoadToken) {
        return;
      }

      const fields = this.readArrayResponse(fieldsResponse, 'تعذر تحميل مكتبة الحقول من قاعدة البيانات.');
      const groupTree = this.readArrayResponse(groupsResponse, 'تعذر تحميل شجرة الجروبات من قاعدة البيانات.');
      const groups = this.flattenAdminCatalogGroups(groupTree);
      const links = this.readArrayResponse(linksResponse, 'تعذر تحميل روابط الحقول من قاعدة البيانات.');
      const subjectTypes = this.readArrayResponse(subjectTypesResponse, 'تعذر تحميل إعدادات النوع من قاعدة البيانات.');

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

      this.subjectTypeAdmin = subjectTypes.find(item => Number(item.categoryId ?? 0) === categoryId) ?? null;
      this.patchReferencePolicyFormFromAdminType(this.subjectTypeAdmin);
      this.patchPresentationFormFromAdminType(this.subjectTypeAdmin);
      this.patchPresentationFormDefaultsIfMissing();

      this.backendWorkspaceLoaded = true;
      this.libraryLoadedFromDb = true;
      this.hasPendingBackendChanges = false;
      this.evaluateBindings(true, false);

      this.stepMessageSeverity = 'success';
      this.stepMessage = 'تم تحميل مكتبة الحقول والروابط الفعلية من قاعدة البيانات.';
    } catch (error) {
      if (loadToken !== this.activeLoadToken) {
        return;
      }

      this.backendWorkspaceLoaded = false;
      this.libraryLoadedFromDb = false;
      this.reusableFields = [];
      this.fieldCatalogByKey.clear();
      this.evaluateBindings(true, false);

      this.stepMessageSeverity = 'warn';
      this.stepMessage = this.toErrorMessage(error, 'تعذر تحميل بيانات الحقول من قاعدة البيانات. يرجى إعادة التحميل بعد التحقق من الاتصال.');
    } finally {
      if (loadToken === this.activeLoadToken) {
        this.loadingLibrary = false;
      }
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
      displaySettingsJson: link.displaySettingsJson ?? undefined
    };
  }

  private async persistBindingsToBackend(categoryId: number, applicationId: string | null): Promise<void> {
    if (this.bindings.length === 0) {
      throw new Error('يجب ربط حقل واحد على الأقل قبل الحفظ.');
    }

    if (this.validation.blockingIssues.length > 0) {
      throw new Error(this.validation.blockingIssues[0]);
    }

    await this.ensureAtLeastOneGroupExists();

    const normalizedBindings = this.bindingEngine.normalizeDisplayOrder(
      this.bindings.map((binding, index) => ({
        ...binding,
        fieldKey: this.normalizeNullable(binding.fieldKey) ?? '',
        label: this.normalizeNullable(binding.label) ?? '',
        displayOrder: index + 1,
        groupId: this.toPositiveInt(binding.groupId) ?? this.resolveDefaultGroupId() ?? 0,
        groupName: this.resolveGroupName(this.toPositiveInt(binding.groupId) ?? this.resolveDefaultGroupId() ?? 0),
        type: this.normalizeBindingType(binding.type),
        defaultValue: String(binding.defaultValue ?? '').trim()
      }))
    );

    const [latestFieldsResponse, latestLinksResponse, latestSubjectTypesResponse] = await Promise.all([
      firstValueFrom(this.dynamicSubjectsController.getAdminFields(applicationId ?? undefined)),
      firstValueFrom(this.dynamicSubjectsController.getAdminCategoryFieldLinks(categoryId)),
      firstValueFrom(this.dynamicSubjectsController.getSubjectTypesAdminConfig(applicationId ?? undefined))
    ]);

    const latestFields = this.readArrayResponse(latestFieldsResponse, 'تعذر تحميل الحقول قبل الحفظ.');
    const latestLinks = this.readArrayResponse(latestLinksResponse, 'تعذر تحميل روابط الحقول قبل الحفظ.');
    const latestSubjectTypes = this.readArrayResponse(latestSubjectTypesResponse, 'تعذر تحميل إعدادات النوع قبل الحفظ.');

    const latestFieldsByKey = new Map<string, SubjectAdminFieldDto>(
      latestFields.map(item => [this.normalizeFieldKey(item.fieldKey), item] as const)
    );
    const latestLinksByKey = new Map<string, SubjectCategoryFieldLinkAdminDto>(
      latestLinks.map(item => [this.normalizeFieldKey(item.fieldKey), item] as const)
    );

    for (const binding of normalizedBindings) {
      const normalizedFieldKey = this.normalizeFieldKey(binding.fieldKey);
      if (!normalizedFieldKey) {
        throw new Error('يوجد حقل بدون مفتاح صالح.');
      }

      const groupId = this.toPositiveInt(binding.groupId);
      if (!groupId) {
        throw new Error(`يرجى اختيار مجموعة صالحة للحقل ${binding.fieldKey}.`);
      }

      const existing = latestFieldsByKey.get(normalizedFieldKey) ?? null;
      const request = this.buildFieldUpsertRequest(binding, existing, applicationId);

      const savedField = existing
        ? this.readSingleResponse(
            await firstValueFrom(this.dynamicSubjectsController.updateAdminField(existing.fieldKey, request)),
            `تعذر تحديث الحقل ${existing.fieldKey}.`
          )
        : this.readSingleResponse(
            await firstValueFrom(this.dynamicSubjectsController.createAdminField(request)),
            `تعذر إنشاء الحقل ${binding.fieldKey}.`
          );

      latestFieldsByKey.set(normalizedFieldKey, savedField);
    }

    const linkPayload: SubjectCategoryFieldLinkUpsertItemDto[] = normalizedBindings.map(binding => {
      const normalizedFieldKey = this.normalizeFieldKey(binding.fieldKey);
      const existingLink = latestLinksByKey.get(normalizedFieldKey) ?? null;
      const displaySettingsJson = this.buildDisplaySettingsJson(existingLink?.displaySettingsJson, binding);

      return {
        mendSql: this.toPositiveInt(existingLink?.mendSql) ?? this.toPositiveInt(binding.mendSql) ?? undefined,
        fieldKey: binding.fieldKey,
        groupId: this.toPositiveInt(binding.groupId) ?? this.resolveDefaultGroupId() ?? 0,
        isActive: true,
        displayOrder: binding.displayOrder,
        isVisible: binding.visible !== false,
        displaySettingsJson
      };
    });

    this.readArrayResponse(
      await firstValueFrom(this.dynamicSubjectsController.upsertAdminCategoryFieldLinks(categoryId, { links: linkPayload })),
      'تعذر حفظ روابط الحقول في قاعدة البيانات.'
    );

    const targetType = latestSubjectTypes.find(item => Number(item.categoryId ?? 0) === categoryId)
      ?? this.subjectTypeAdmin
      ?? null;

    const typeRequest = this.buildSubjectTypeUpsertRequest(targetType, normalizedBindings);
    const persistedType = this.readSingleResponse(
      await firstValueFrom(this.dynamicSubjectsController.upsertSubjectTypeAdminConfig(categoryId, typeRequest)),
      'تعذر حفظ سياسة الرقم المرجعي في قاعدة البيانات.'
    );

    this.subjectTypeAdmin = persistedType;

    await this.loadBackendWorkspace(categoryId, applicationId);
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
    const referenceComponents = referenceMode === 'custom'
      ? this.serializeReferenceComponents(this.referenceComponents)
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
      sequenceName: undefined,
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

  private buildDisplaySettingsJson(existingRaw: string | undefined, binding: BoundFieldItem): string | undefined {
    const parsed = this.parseDisplaySettings(existingRaw) ?? {};
    parsed['readonly'] = binding.readonly === true;
    parsed['isReadonly'] = binding.readonly === true;

    try {
      return JSON.stringify(parsed);
    } catch {
      return JSON.stringify({ readonly: binding.readonly === true, isReadonly: binding.readonly === true });
    }
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
    const nextValue = {
      referencePolicyEnabled: values['referencePolicyEnabled'] !== false,
      referenceMode: this.normalizeReferenceMode(values['referenceMode']),
      referencePrefix: this.normalizeNullable(values['referencePrefix']) ?? '',
      referenceSeparator: this.normalizeReferenceSeparator(values['referenceSeparator']),
      referenceStartingValue: this.toSafeStartingValue(values['referenceStartingValue']),
      referenceSequencePaddingLength: this.toSafeSequenceLength(values['referenceSequencePaddingLength']),
      referenceSequenceResetScope: this.normalizeSequenceResetScope(values['referenceSequenceResetScope'])
    };

    this.syncingFromStore = true;
    this.referencePolicyForm.patchValue(nextValue, { emitEvent: false });
    this.referenceComponents = this.normalizeReferenceComponentsStructure(
      this.parseReferenceComponents(values['referenceComponents'])
    );
    this.syncingFromStore = false;
  }

  private patchReferencePolicyFormFromAdminType(subjectType: SubjectTypeAdminDto | null): void {
    const resolvedMode = this.normalizeReferenceMode(subjectType?.referenceMode);
    const nextValue = {
      referencePolicyEnabled: subjectType?.referencePolicyEnabled !== false,
      referenceMode: resolvedMode,
      referencePrefix: this.normalizeNullable(subjectType?.referencePrefix) ?? '',
      referenceSeparator: this.normalizeReferenceSeparator(subjectType?.referenceSeparator),
      referenceStartingValue: this.toSafeStartingValue(subjectType?.referenceStartingValue),
      referenceSequencePaddingLength: this.toSafeSequenceLength(subjectType?.sequencePaddingLength),
      referenceSequenceResetScope: this.normalizeSequenceResetScope(subjectType?.sequenceResetScope)
    };

    this.syncingFromStore = true;
    this.referencePolicyForm.patchValue(nextValue, { emitEvent: false });
    this.referenceComponents = this.normalizeReferenceComponentsStructure(
      this.parseReferenceComponents(subjectType?.referenceComponents)
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

    this.bindings = parsed;
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

    if (Array.isArray(response.errors) && response.errors.length > 0) {
      throw new Error(response.errors[0]?.message ?? fallbackMessage);
    }

    return Array.isArray(response.data) ? response.data : [];
  }

  private readSingleResponse<T>(response: CommonResponse<T>, fallbackMessage: string): T {
    if (!response) {
      throw new Error(fallbackMessage);
    }

    if (Array.isArray(response.errors) && response.errors.length > 0) {
      throw new Error(response.errors[0]?.message ?? fallbackMessage);
    }

    if (response.data == null) {
      throw new Error(fallbackMessage);
    }

    return response.data;
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
    const normalized = String(value ?? '').trim().toLowerCase();
    return normalized === 'custom' ? 'custom' : 'default';
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
      const components = this.normalizeReferenceComponentsStructure(this.referenceComponents);
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
      referenceStartingValue: this.toSafeStartingValue(referenceValue['referenceStartingValue']),
      referenceSequencePaddingLength: this.toSafeSequenceLength(referenceValue['referenceSequencePaddingLength']),
      referenceSequenceResetScope: this.normalizeSequenceResetScope(referenceValue['referenceSequenceResetScope']),
      referenceComponents: this.serializeReferenceComponents(this.referenceComponents),
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
    this.fieldCatalogByKey.clear();
    this.subjectTypeAdmin = null;
    this.reusableFields = [];

    this.syncingFromStore = true;
    this.referencePolicyForm.patchValue({
      referencePolicyEnabled: true,
      referenceMode: 'default',
      referencePrefix: '',
      referenceSeparator: '-',
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
    this.referenceComponents = [this.createReferenceComponent('sequence')];
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

  private normalizeNullable(value: unknown): string | null {
    const normalized = String(value ?? '').trim();
    return normalized.length > 0 ? normalized : null;
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
