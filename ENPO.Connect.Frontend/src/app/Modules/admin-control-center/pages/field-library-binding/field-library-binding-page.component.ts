import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription, firstValueFrom } from 'rxjs';
import { auditTime } from 'rxjs/operators';
import {
  CommonResponse,
  SubjectAdminFieldDto,
  SubjectAdminFieldUpsertRequestDto,
  SubjectAdminGroupDto,
  SubjectCategoryFieldLinkAdminDto,
  SubjectCategoryFieldLinkUpsertItemDto,
  SubjectTypeAdminDto,
  SubjectTypeAdminUpsertRequestDto
} from 'src/app/shared/services/BackendServices/DynamicSubjects/DynamicSubjects.dto';
import { DynamicSubjectsController } from 'src/app/shared/services/BackendServices/DynamicSubjects/DynamicSubjects.service';
import {
  BoundFieldItem,
  FieldLibraryBindingValidationResult,
  ReusableFieldLibraryItem
} from '../../domain/models/field-library-binding.models';
import {
  ControlCenterStepViewModel,
  ControlCenterViewModel
} from '../../domain/models/admin-control-center.view-models';
import { FieldLibraryBindingEngine } from '../../domain/field-library-binding/field-library-binding.engine';
import { AdminControlCenterFacade } from '../../facades/admin-control-center.facade';

type SequenceResetScope = 'none' | 'yearly' | 'monthly';

@Component({
  selector: 'app-field-library-binding-page',
  templateUrl: './field-library-binding-page.component.html',
  styleUrls: ['./field-library-binding-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FieldLibraryBindingPageComponent implements OnInit, OnDestroy {
  readonly stepKey = 'field-library-binding' as const;

  readonly fieldTypeOptions = [
    { label: 'InputText', value: 'InputText' },
    { label: 'Textarea', value: 'Textarea' },
    { label: 'Dropdown', value: 'Dropdown' },
    { label: 'Number', value: 'Number' },
    { label: 'Date', value: 'Date' },
    { label: 'Checkbox', value: 'Checkbox' }
  ];

  readonly sequenceResetScopeOptions: Array<{ label: string; value: SequenceResetScope }> = [
    { label: 'بدون Reset', value: 'none' },
    { label: 'سنوي', value: 'yearly' },
    { label: 'شهري', value: 'monthly' }
  ];

  readonly setupForm: FormGroup = this.fb.group({
    libraryVersion: [null, [Validators.required]],
    bindingStrategy: [null, [Validators.required]],
    includeLegacyFields: [true],
    bindingNotes: ['', [Validators.maxLength(1000)]]
  });

  readonly referencePolicyForm: FormGroup = this.fb.group({
    referencePolicyEnabled: [true],
    referencePrefix: ['', [Validators.maxLength(40)]],
    referenceSeparator: ['-', [Validators.maxLength(10)]],
    referenceIncludeYear: [true],
    referenceUseSequence: [true],
    referenceSequenceName: ['', [Validators.maxLength(80)]],
    referenceSequencePaddingLength: [0, [Validators.min(0), Validators.max(12)]],
    referenceSequenceResetScope: ['none']
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

  vm: ControlCenterViewModel | null = null;
  step: ControlCenterStepViewModel | null = null;

  reusableFields: ReadonlyArray<ReusableFieldLibraryItem> = [];
  bindings: BoundFieldItem[] = [];
  validation: FieldLibraryBindingValidationResult = { isValid: false, blockingIssues: [], warnings: [] };

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
  private subjectTypeAdmin: SubjectTypeAdminDto | null = null;
  private fieldCatalogByKey = new Map<string, SubjectAdminFieldDto>();

  constructor(
    private readonly fb: FormBuilder,
    private readonly facade: AdminControlCenterFacade,
    private readonly router: Router,
    private readonly bindingEngine: FieldLibraryBindingEngine,
    private readonly dynamicSubjectsController: DynamicSubjectsController
  ) {}

  ngOnInit(): void {
    this.facade.initialize(this.stepKey);

    this.subscriptions.add(
      this.facade.vm$.subscribe(vm => {
        this.vm = vm;
        const matchingStep = vm.steps.find(step => step.key === this.stepKey) ?? null;
        this.step = matchingStep;

        const nextCategoryId = this.toPositiveInt(vm.context.categoryId);
        const nextApplicationId = this.normalizeNullable(vm.context.applicationId);
        const contextChanged = nextCategoryId !== this.currentCategoryId || nextApplicationId !== this.currentApplicationId;

        if (contextChanged) {
          this.currentCategoryId = nextCategoryId;
          this.currentApplicationId = nextApplicationId;
          this.resetWorkspaceForNewContext();
          if (nextCategoryId) {
            void this.loadBackendWorkspace(nextCategoryId, nextApplicationId);
          }
        }

        if (!matchingStep) {
          return;
        }

        if (!this.backendWorkspaceLoaded) {
          this.patchSetupFormFromStep(matchingStep.values);
          this.patchReferencePolicyFormFromStep(matchingStep.values);
          this.patchBindingsFromStep(matchingStep.values);
        }

        this.evaluateBindings(false);
      })
    );

    this.subscriptions.add(
      this.setupForm.valueChanges
        .pipe(auditTime(80))
        .subscribe(() => {
          if (this.syncingFromStore) {
            return;
          }

          this.evaluateBindings(true, true);
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
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
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
      return 'Policy Disabled';
    }

    const separator = this.normalizeNullable(raw['referenceSeparator']) ?? '-';
    const prefix = this.normalizeNullable(raw['referencePrefix'])
      ?? (this.currentCategoryId ? `SUBJ${this.currentCategoryId}` : 'SUBJ');

    const components: string[] = [prefix];
    if (raw['referenceIncludeYear'] === true) {
      components.push(new Date().getUTCFullYear().toString());
    }

    if (raw['referenceUseSequence'] === true) {
      const padding = this.toSafePadding(raw['referenceSequencePaddingLength']);
      const sample = padding > 0 ? '1'.padStart(padding, '0') : '1';
      components.push(sample);
    }

    return components.join(separator);
  }

  getOptions(fieldKey: string): Array<{ label: string; value: string }> {
    const field = this.step?.fields.find(item => item.key === fieldKey);
    return [...(field?.options ?? [])];
  }

  controlHasError(controlName: string): boolean {
    const control = this.setupForm.get(controlName);
    if (!control) {
      return false;
    }

    return control.invalid && (control.dirty || control.touched);
  }

  controlErrorMessage(controlName: string): string {
    const control = this.setupForm.get(controlName);
    if (!control) {
      return 'قيمة غير صحيحة.';
    }

    if (control.hasError('required')) {
      return 'هذا الحقل إلزامي.';
    }

    if (control.hasError('maxlength')) {
      return 'القيمة أطول من الحد المسموح.';
    }

    return 'قيمة غير صحيحة.';
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
        this.stepMessage = this.toErrorMessage(error, 'تعذر تجهيز Group افتراضي لإضافة الحقل.');
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
      this.stepMessage = 'يرجى إدخال Field Key و Label و Group صالحين.';
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

  async onSaveToBackend(): Promise<void> {
    this.setupForm.markAllAsTouched();
    this.referencePolicyForm.markAllAsTouched();
    this.evaluateBindings(true, false);

    if (this.setupForm.invalid || this.referencePolicyForm.invalid || !this.validation.isValid) {
      this.stepMessageSeverity = 'warn';
      this.stepMessage = 'لا يمكن الحفظ قبل استكمال المدخلات الإلزامية ومعالجة المشكلات المانعة.';
      return;
    }

    if (!this.currentCategoryId) {
      this.stepMessageSeverity = 'warn';
      this.stepMessage = 'يجب تحديد Category صالح من خطوة Scope Definition قبل الحفظ.';
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

  async onReloadFromBackend(): Promise<void> {
    if (!this.currentCategoryId) {
      this.stepMessageSeverity = 'warn';
      this.stepMessage = 'يجب اختيار Category أولًا لإعادة التحميل.';
      return;
    }

    await this.loadBackendWorkspace(this.currentCategoryId, this.currentApplicationId);
  }

  onSaveDraft(): void {
    this.evaluateBindings(true, false);
    const draftResult = this.facade.saveDraft();
    this.stepMessageSeverity = draftResult.success ? 'success' : 'warn';
    this.stepMessage = draftResult.message;
  }

  onGoNext(): void {
    this.setupForm.markAllAsTouched();
    this.referencePolicyForm.markAllAsTouched();
    this.evaluateBindings(true, false);

    if (this.setupForm.invalid || this.referencePolicyForm.invalid || !this.validation.isValid || !this.step?.isCompleted) {
      this.stepMessageSeverity = 'warn';
      this.stepMessage = 'لا يمكن المتابعة قبل استكمال الإعدادات وحل التعارضات المانعة.';
      return;
    }

    if (this.hasPendingBackendChanges) {
      this.stepMessageSeverity = 'warn';
      this.stepMessage = 'توجد تعديلات غير محفوظة في قاعدة البيانات. يرجى الضغط على "حفظ في قاعدة البيانات" أولًا.';
      return;
    }

    const nextStep = this.facade.getNextStepKey(this.stepKey);
    if (!nextStep) {
      return;
    }

    this.stepMessage = '';
    this.router.navigate(['/Admin/ControlCenter', nextStep]);
  }

  isFieldAlreadyBound(item: ReusableFieldLibraryItem): boolean {
    const normalizedKey = this.normalizeFieldKey(item.fieldKey);
    return this.bindings.some(binding => this.normalizeFieldKey(binding.fieldKey) === normalizedKey);
  }

  private evaluateBindings(syncToStore: boolean, markBackendDirty = false): void {
    const baseValidation = this.bindingEngine.validateBindings(this.bindings);
    const groupIssues = this.collectGroupValidationIssues(this.bindings);

    this.validation = {
      isValid: baseValidation.isValid && groupIssues.length === 0,
      blockingIssues: [...baseValidation.blockingIssues, ...groupIssues],
      warnings: baseValidation.warnings
    };

    if (!syncToStore) {
      return;
    }

    const syncToken = this.validation.isValid ? 'valid' : 'draft';
    this.syncStepValues(syncToken, markBackendDirty);
  }

  private syncStepValues(syncToken: 'valid' | 'draft', markBackendDirty: boolean): void {
    const setupValue = this.setupForm.getRawValue();
    const referenceValue = this.referencePolicyForm.getRawValue();
    const payload = this.bindingEngine.serializeBindingsPayload(this.bindings);

    this.facade.updateFieldValue(this.stepKey, 'libraryVersion', setupValue['libraryVersion']);
    this.facade.updateFieldValue(this.stepKey, 'bindingStrategy', setupValue['bindingStrategy']);
    this.facade.updateFieldValue(this.stepKey, 'includeLegacyFields', setupValue['includeLegacyFields'] === true);
    this.facade.updateFieldValue(this.stepKey, 'bindingNotes', setupValue['bindingNotes']);
    this.facade.updateFieldValue(this.stepKey, 'bindingPayload', payload);
    this.facade.updateFieldValue(this.stepKey, 'bindingValidationToken', syncToken === 'valid' ? 'valid' : null);

    this.facade.updateFieldValue(this.stepKey, 'referencePolicyEnabled', referenceValue['referencePolicyEnabled'] === true);
    this.facade.updateFieldValue(this.stepKey, 'referencePrefix', this.normalizeNullable(referenceValue['referencePrefix']));
    this.facade.updateFieldValue(this.stepKey, 'referenceSeparator', this.normalizeNullable(referenceValue['referenceSeparator']) ?? '-');
    this.facade.updateFieldValue(this.stepKey, 'referenceIncludeYear', referenceValue['referenceIncludeYear'] === true);
    this.facade.updateFieldValue(this.stepKey, 'referenceUseSequence', referenceValue['referenceUseSequence'] === true);
    this.facade.updateFieldValue(this.stepKey, 'referenceSequenceName', this.normalizeNullable(referenceValue['referenceSequenceName']));
    this.facade.updateFieldValue(
      this.stepKey,
      'referenceSequencePaddingLength',
      this.toSafePadding(referenceValue['referenceSequencePaddingLength'])
    );
    this.facade.updateFieldValue(
      this.stepKey,
      'referenceSequenceResetScope',
      this.normalizeSequenceResetScope(referenceValue['referenceSequenceResetScope'])
    );

    if (markBackendDirty) {
      this.hasPendingBackendChanges = true;
    }
  }

  private async loadBackendWorkspace(categoryId: number, applicationId: string | null): Promise<void> {
    const loadToken = ++this.activeLoadToken;
    this.loadingLibrary = true;
    this.stepMessage = '';

    try {
      const [fieldsResponse, groupsResponse, linksResponse, subjectTypesResponse] = await Promise.all([
        firstValueFrom(this.dynamicSubjectsController.getAdminFields(applicationId ?? undefined)),
        firstValueFrom(this.dynamicSubjectsController.getAdminGroups()),
        firstValueFrom(this.dynamicSubjectsController.getAdminCategoryFieldLinks(categoryId)),
        firstValueFrom(this.dynamicSubjectsController.getSubjectTypesAdminConfig(applicationId ?? undefined))
      ]);

      if (loadToken !== this.activeLoadToken) {
        return;
      }

      const fields = this.readArrayResponse(fieldsResponse, 'تعذر تحميل مكتبة الحقول من قاعدة البيانات.');
      const groups = this.readArrayResponse(groupsResponse, 'تعذر تحميل الجروبات من قاعدة البيانات.');
      const links = this.readArrayResponse(linksResponse, 'تعذر تحميل روابط الحقول من قاعدة البيانات.');
      const subjectTypes = this.readArrayResponse(subjectTypesResponse, 'تعذر تحميل إعدادات النوع من قاعدة البيانات.');

      this.groups = [...groups].sort((left, right) => left.groupId - right.groupId);
      this.groupOptions = this.groups.map(group => ({
        label: `${group.groupName ?? `Group ${group.groupId}`} (${group.groupId})`,
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

        const label = this.normalizeNullable(link.groupName) ?? `Group ${linkGroupId}`;
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
      this.patchReferencePolicyFormFromAdminType(this.subjectTypeAdmin, categoryId);
      this.patchSetupFormDefaultsIfMissing();

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
      this.reusableFields = this.bindingEngine.reusableLibrary;
      this.fieldCatalogByKey.clear();

      this.stepMessageSeverity = 'warn';
      this.stepMessage = this.toErrorMessage(error, 'تعذر تحميل بيانات الحقول من قاعدة البيانات. سيتم استخدام fallback محلي مؤقتًا.');
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
        throw new Error('يوجد حقل بدون Field Key صالح.');
      }

      const groupId = this.toPositiveInt(binding.groupId);
      if (!groupId) {
        throw new Error(`يرجى اختيار Group صالح للحقل ${binding.fieldKey}.`);
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
    const sourceFieldKeys = this.normalizeNullable(targetType?.sourceFieldKeys)
      ?? this.buildDefaultSourceFieldKeys(normalizedBindings);

    const useSequence = referenceValue['referenceUseSequence'] === true;

    return {
      isActive: targetType?.isActive !== false,
      referencePolicyEnabled: referenceValue['referencePolicyEnabled'] === true,
      referencePrefix: this.normalizeNullable(referenceValue['referencePrefix'])
        ?? targetType?.referencePrefix
        ?? (this.currentCategoryId ? `SUBJ${this.currentCategoryId}` : 'SUBJ'),
      referenceSeparator: this.normalizeNullable(referenceValue['referenceSeparator'])
        ?? targetType?.referenceSeparator
        ?? '-',
      sourceFieldKeys,
      includeYear: referenceValue['referenceIncludeYear'] === true,
      useSequence,
      sequenceName: useSequence
        ? this.normalizeNullable(referenceValue['referenceSequenceName'])
          ?? targetType?.sequenceName
          ?? 'Seq_Tickets'
        : undefined,
      sequencePaddingLength: this.toSafePadding(referenceValue['referenceSequencePaddingLength']),
      sequenceResetScope: this.normalizeSequenceResetScope(referenceValue['referenceSequenceResetScope']),
      requestPolicy: targetType?.requestPolicy
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

    const createdGroup = this.readSingleResponse(
      await firstValueFrom(this.dynamicSubjectsController.createAdminGroup({
        groupName: 'Admin Control Center Group',
        groupDescription: 'Auto-created from Admin Control Center field binding page.',
        isExtendable: false,
        groupWithInRow: 12
      })),
      'تعذر إنشاء مجموعة افتراضية لربط الحقول.'
    );

    this.groups = [createdGroup];
    this.groupOptions = [{
      label: `${createdGroup.groupName ?? `Group ${createdGroup.groupId}`} (${createdGroup.groupId})`,
      value: createdGroup.groupId
    }];

    this.bindings = this.bindings.map(binding => ({
      ...binding,
      groupId: this.toPositiveInt(binding.groupId) ?? createdGroup.groupId,
      groupName: this.resolveGroupName(this.toPositiveInt(binding.groupId) ?? createdGroup.groupId)
    }));
  }

  private patchSetupFormFromStep(values: Record<string, unknown>): void {
    const nextValue = {
      libraryVersion: this.normalizeNullable(values['libraryVersion']),
      bindingStrategy: this.normalizeNullable(values['bindingStrategy']),
      includeLegacyFields: values['includeLegacyFields'] !== false,
      bindingNotes: String(values['bindingNotes'] ?? '').trim()
    };

    this.syncingFromStore = true;
    this.setupForm.patchValue(nextValue, { emitEvent: false });
    this.syncingFromStore = false;
  }

  private patchReferencePolicyFormFromStep(values: Record<string, unknown>): void {
    const nextValue = {
      referencePolicyEnabled: values['referencePolicyEnabled'] !== false,
      referencePrefix: this.normalizeNullable(values['referencePrefix']) ?? '',
      referenceSeparator: this.normalizeNullable(values['referenceSeparator']) ?? '-',
      referenceIncludeYear: values['referenceIncludeYear'] !== false,
      referenceUseSequence: values['referenceUseSequence'] !== false,
      referenceSequenceName: this.normalizeNullable(values['referenceSequenceName']) ?? '',
      referenceSequencePaddingLength: this.toSafePadding(values['referenceSequencePaddingLength']),
      referenceSequenceResetScope: this.normalizeSequenceResetScope(values['referenceSequenceResetScope'])
    };

    this.syncingFromStore = true;
    this.referencePolicyForm.patchValue(nextValue, { emitEvent: false });
    this.syncingFromStore = false;
  }

  private patchReferencePolicyFormFromAdminType(subjectType: SubjectTypeAdminDto | null, categoryId: number): void {
    const nextValue = {
      referencePolicyEnabled: subjectType?.referencePolicyEnabled !== false,
      referencePrefix: this.normalizeNullable(subjectType?.referencePrefix) ?? `SUBJ${categoryId}`,
      referenceSeparator: this.normalizeNullable(subjectType?.referenceSeparator) ?? '-',
      referenceIncludeYear: subjectType?.includeYear !== false,
      referenceUseSequence: subjectType?.useSequence !== false,
      referenceSequenceName: this.normalizeNullable(subjectType?.sequenceName) ?? 'Seq_Tickets',
      referenceSequencePaddingLength: this.toSafePadding(subjectType?.sequencePaddingLength),
      referenceSequenceResetScope: this.normalizeSequenceResetScope(subjectType?.sequenceResetScope)
    };

    this.syncingFromStore = true;
    this.referencePolicyForm.patchValue(nextValue, { emitEvent: false });
    this.syncingFromStore = false;
  }

  private patchSetupFormDefaultsIfMissing(): void {
    const current = this.setupForm.getRawValue();
    const patch = {
      libraryVersion: this.normalizeNullable(current['libraryVersion']) ?? 'default',
      bindingStrategy: this.normalizeNullable(current['bindingStrategy']) ?? 'strict',
      includeLegacyFields: current['includeLegacyFields'] !== false
    };

    this.syncingFromStore = true;
    this.setupForm.patchValue(patch, { emitEvent: false });
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
        issues.push(`الحقل "${item.label || item.fieldKey}" غير مرتبط بأي Group.`);
        continue;
      }

      const knownGroup = this.groups.some(group => group.groupId === groupId);
      if (!knownGroup && this.groupOptions.length > 0) {
        issues.push(`Group رقم ${groupId} غير موجود ضمن الجروبات المتاحة للحقل "${item.label || item.fieldKey}".`);
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
    return this.normalizeNullable(match?.groupName) ?? `Group ${groupId}`;
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

  private toSafePadding(value: unknown): number {
    const normalized = Number(value ?? 0);
    if (!Number.isFinite(normalized)) {
      return 0;
    }

    const rounded = Math.trunc(normalized);
    if (rounded < 0) {
      return 0;
    }

    if (rounded > 12) {
      return 12;
    }

    return rounded;
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

  private resetWorkspaceForNewContext(): void {
    this.backendWorkspaceLoaded = false;
    this.libraryLoadedFromDb = false;
    this.hasPendingBackendChanges = false;
    this.bindings = [];
    this.groups = [];
    this.groupOptions = [];
    this.fieldCatalogByKey.clear();
    this.subjectTypeAdmin = null;
    this.reusableFields = [];
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

  private normalizeFieldKey(value: unknown): string {
    return (String(value ?? '').trim()).toLowerCase();
  }

  private toErrorMessage(error: unknown, fallbackMessage: string): string {
    if (error instanceof Error && error.message.trim().length > 0) {
      return error.message;
    }

    const message = String(error ?? '').trim();
    return message.length > 0 ? message : fallbackMessage;
  }
}
