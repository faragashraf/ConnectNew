import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ValidatorFn, Validators } from '@angular/forms';
import { AppNotificationService } from 'src/app/shared/services/notifications/app-notification.service';
import {
  REQUEST_RUNTIME_ALL_APPLICATIONS_VALUE,
  RequestRuntimeApplicationOption,
  RequestRuntimeCatalogDto,
  RequestRuntimeEnvelopeSummaryDto,
  RequestRuntimeEnvelopeTerminology,
  RequestRuntimeFieldDefinitionDto,
  RequestRuntimeFormDefinitionDto,
  RequestRuntimeSubjectFieldValueDto,
  RequestRuntimeTreeNode,
  buildEnvelopeTerminology,
  createEmptyRuntimeCatalog
} from '../../models/request-runtime-catalog.models';
import { RequestRuntimeCatalogFacadeService } from '../../services/request-runtime-catalog-facade.service';

type RuntimeDirectionMode = 'none' | 'selectable' | 'fixed';
type RuntimeFieldInputType = 'text' | 'textarea' | 'dropdown' | 'date' | 'datetime' | 'toggle' | 'number';

interface RuntimeFieldOption {
  label: string;
  value: string;
}

interface RuntimeFieldViewModel {
  controlName: string;
  label: string;
  placeholder: string;
  required: boolean;
  inputType: RuntimeFieldInputType;
  options: RuntimeFieldOption[];
  displayOrder: number;
  groupId: number;
  groupName: string;
  source: RequestRuntimeFieldDefinitionDto;
}

interface RuntimeFieldGroupViewModel {
  groupId: number;
  groupName: string;
  fields: RuntimeFieldViewModel[];
}

interface RuntimeWorkspaceSnapshot {
  subject: string;
  description: string;
  documentDirection: string;
  envelopeId: number | null;
  dynamicValues: Record<string, unknown>;
}

@Component({
  selector: 'app-request-runtime-catalog-page',
  templateUrl: './request-runtime-catalog-page.component.html',
  styleUrls: ['./request-runtime-catalog-page.component.scss']
})
export class RequestRuntimeCatalogPageComponent implements OnInit {
  readonly allApplicationsValue = REQUEST_RUNTIME_ALL_APPLICATIONS_VALUE;

  readonly directionOptions: Array<{ label: string; value: string }> = [
    { label: 'وارد', value: 'incoming' },
    { label: 'صادر', value: 'outgoing' }
  ];

  readonly requestForm: FormGroup = this.fb.group({
    subject: [''],
    description: [''],
    documentDirection: [''],
    envelopeId: [null],
    dynamicFields: this.fb.group({})
  });

  readonly newEnvelopeForm: FormGroup = this.fb.group({
    envelopeRef: ['', [Validators.required, Validators.maxLength(80)]],
    incomingDate: [new Date(), Validators.required],
    sourceEntity: ['', Validators.maxLength(120)],
    deliveryDelegate: ['', Validators.maxLength(120)],
    notes: ['', Validators.maxLength(300)]
  });

  loading = false;
  runtimeLoading = false;
  envelopeLoading = false;
  submittingRequest = false;
  creatingEnvelope = false;

  catalog: RequestRuntimeCatalogDto = createEmptyRuntimeCatalog();
  applicationOptions: RequestRuntimeApplicationOption[] = [
    { label: 'كل التطبيقات', value: REQUEST_RUNTIME_ALL_APPLICATIONS_VALUE }
  ];

  selectedApplicationId = REQUEST_RUNTIME_ALL_APPLICATIONS_VALUE;
  searchText = '';

  treeNodes: RequestRuntimeTreeNode[] = [];
  selectedNode: RequestRuntimeTreeNode | null = null;
  selectedRequestNode: RequestRuntimeTreeNode | null = null;

  totalStartableCount = 0;
  visibleStartableCount = 0;

  envelopeTerminology: RequestRuntimeEnvelopeTerminology = buildEnvelopeTerminology(null);
  availableEnvelopes: RequestRuntimeEnvelopeSummaryDto[] = [];
  showNewEnvelopeDialog = false;

  activeDefinition: RequestRuntimeFormDefinitionDto | null = null;
  runtimeFieldGroups: RuntimeFieldGroupViewModel[] = [];
  runtimeFields: RuntimeFieldViewModel[] = [];

  directionMode: RuntimeDirectionMode = 'none';
  fixedDirection: string | null = null;

  constructor(
    private readonly facade: RequestRuntimeCatalogFacadeService,
    private readonly appNotification: AppNotificationService,
    private readonly fb: FormBuilder
  ) {}

  ngOnInit(): void {
    this.loadCatalog();
  }

  get hasSelectedRequest(): boolean {
    return this.selectedRequestNode?.data?.canStart === true;
  }

  get selectedRequestLabel(): string {
    return String(this.selectedRequestNode?.label ?? '').trim() || 'لم يتم اختيار طلب';
  }

  get canSubmitRequest(): boolean {
    return this.hasSelectedRequest && !this.runtimeLoading && !this.submittingRequest;
  }

  get showDirectionSelector(): boolean {
    return this.directionMode === 'selectable';
  }

  get showDirectionReadonly(): boolean {
    return this.directionMode === 'fixed' && this.fixedDirection != null;
  }

  get directionReadonlyLabel(): string {
    return this.resolveDirectionLabel(this.fixedDirection);
  }

  get dynamicFieldsGroup(): FormGroup {
    return this.requestForm.get('dynamicFields') as FormGroup;
  }

  loadCatalog(): void {
    this.loading = true;
    this.facade.loadCatalog().subscribe({
      next: response => {
        this.catalog = response.data ?? createEmptyRuntimeCatalog();

        if ((response.errors ?? []).length > 0) {
          this.appNotification.showApiErrors(response.errors, 'تعذر تحميل شجرة الطلبات المتاحة للتسجيل.');
        }

        this.applicationOptions = this.facade.buildApplicationOptions(this.catalog);
        const hasSelected = this.applicationOptions.some(option => option.value === this.selectedApplicationId);
        if (!hasSelected) {
          this.selectedApplicationId = REQUEST_RUNTIME_ALL_APPLICATIONS_VALUE;
        }

        this.refreshTree();
      },
      error: () => {
        this.catalog = createEmptyRuntimeCatalog();
        this.treeNodes = [];
        this.totalStartableCount = 0;
        this.visibleStartableCount = 0;
        this.clearRuntimeWorkspace();
        this.appNotification.error('تعذر تحميل شجرة الطلبات المتاحة للتسجيل.');
      },
      complete: () => {
        this.loading = false;
      }
    });
  }

  onApplicationChange(): void {
    this.refreshTree();
  }

  onSearchChange(): void {
    this.refreshTree();
  }

  clearSearch(): void {
    this.searchText = '';
    this.refreshTree();
  }

  expandAll(): void {
    this.setExpandedState(this.treeNodes, true);
  }

  collapseAll(): void {
    this.setExpandedState(this.treeNodes, false);
  }

  onNodeSelect(event: { node?: RequestRuntimeTreeNode }): void {
    this.selectedNode = event?.node ?? null;

    if (this.selectedNode?.data?.canStart) {
      this.activateRequestNode(this.selectedNode);
    }
  }

  startSelectedRequest(): void {
    if (!this.selectedNode?.data?.canStart) {
      this.appNotification.warning('اختر طلبًا متاحًا من الشجرة لعرض نموذج التسجيل.');
      return;
    }

    this.activateRequestNode(this.selectedNode);
  }

  onStartRequestFromNode(node: RequestRuntimeTreeNode, event: MouseEvent): void {
    event.stopPropagation();

    if (!node?.data?.canStart) {
      return;
    }

    this.selectedNode = node;
    this.activateRequestNode(node);
  }

  onDirectionChange(): void {
    if (!this.hasSelectedRequest || this.runtimeLoading || this.directionMode !== 'selectable') {
      return;
    }

    this.loadRuntimeWorkspace(true);
  }

  openNewEnvelopeDialog(): void {
    this.newEnvelopeForm.reset(
      {
        envelopeRef: '',
        incomingDate: new Date(),
        sourceEntity: '',
        deliveryDelegate: '',
        notes: ''
      },
      { emitEvent: false }
    );
    this.showNewEnvelopeDialog = true;
  }

  createEnvelope(): void {
    if (this.creatingEnvelope) {
      return;
    }

    if (this.newEnvelopeForm.invalid) {
      this.newEnvelopeForm.markAllAsTouched();
      this.appNotification.warning(`أدخل ${this.envelopeTerminology.nameLabel} بشكل صحيح قبل الحفظ.`);
      return;
    }

    const envelopeRef = this.normalizeNullable(this.newEnvelopeForm.get('envelopeRef')?.value);
    if (envelopeRef == null) {
      this.appNotification.warning(`أدخل ${this.envelopeTerminology.nameLabel}.`);
      return;
    }

    this.creatingEnvelope = true;

    this.facade.createEnvelope({
      envelopeRef,
      incomingDate: this.formatDateOnly(this.newEnvelopeForm.get('incomingDate')?.value),
      sourceEntity: this.normalizeNullable(this.newEnvelopeForm.get('sourceEntity')?.value) ?? undefined,
      deliveryDelegate: this.normalizeNullable(this.newEnvelopeForm.get('deliveryDelegate')?.value) ?? undefined,
      notes: this.normalizeNullable(this.newEnvelopeForm.get('notes')?.value) ?? undefined,
      linkedSubjectIds: []
    }).subscribe({
      next: response => {
        if ((response.errors ?? []).length > 0 || !response.data) {
          this.appNotification.showApiErrors(
            response.errors ?? [],
            `تعذر ${this.envelopeTerminology.addButtonLabel}.`
          );
          return;
        }

        const createdEnvelopeId = Number(response.data.envelopeId ?? 0);
        this.showNewEnvelopeDialog = false;
        this.appNotification.success(this.envelopeTerminology.createSuccessMessage);
        this.loadEnvelopes(createdEnvelopeId > 0 ? createdEnvelopeId : null);
      },
      error: () => {
        this.appNotification.error(`حدث خطأ أثناء ${this.envelopeTerminology.addButtonLabel}.`);
      },
      complete: () => {
        this.creatingEnvelope = false;
      }
    });
  }

  submitRequest(): void {
    if (!this.hasSelectedRequest || this.submittingRequest) {
      return;
    }

    this.requestForm.markAllAsTouched();
    Object.values(this.dynamicFieldsGroup.controls).forEach(control => control.markAsTouched());

    if (this.requestForm.invalid || this.dynamicFieldsGroup.invalid) {
      this.appNotification.warning('يرجى استكمال الحقول الإلزامية قبل تسجيل الطلب.');
      return;
    }

    const categoryId = Number(this.selectedRequestNode?.data?.categoryId ?? 0);
    if (categoryId <= 0) {
      this.appNotification.warning('تعذر تحديد نوع الطلب المختار.');
      return;
    }

    const stageId = Number(this.selectedRequestNode?.data?.startStageId ?? 0);
    const envelopeId = Number(this.requestForm.get('envelopeId')?.value ?? 0);

    const payload = {
      categoryId,
      stageId: stageId > 0 ? stageId : undefined,
      documentDirection: this.normalizeDirectionValue(this.requestForm.get('documentDirection')?.value) ?? undefined,
      subject: this.normalizeNullable(this.requestForm.get('subject')?.value) ?? undefined,
      description: this.normalizeNullable(this.requestForm.get('description')?.value) ?? undefined,
      saveAsDraft: false,
      submit: true,
      envelopeId: envelopeId > 0 ? envelopeId : undefined,
      dynamicFields: this.buildDynamicFieldsPayload(),
      stakeholders: [],
      tasks: []
    };

    this.submittingRequest = true;

    this.facade.createSubject(payload).subscribe({
      next: response => {
        if ((response.errors ?? []).length > 0 || !response.data) {
          this.appNotification.showApiErrors(response.errors ?? [], 'تعذر تسجيل الطلب من الشاشة الحالية.');
          return;
        }

        const reference = this.normalizeNullable(response.data.requestRef);
        const subjectId = Number(response.data.messageId ?? 0);
        const successMessage = reference
          ? `تم تسجيل الطلب بنجاح. الرقم المرجعي: ${reference}`
          : (subjectId > 0
            ? `تم تسجيل الطلب بنجاح. رقم الطلب: ${subjectId}`
            : 'تم تسجيل الطلب بنجاح.');

        this.appNotification.success(successMessage);
        this.loadRuntimeWorkspace(false);
      },
      error: () => {
        this.appNotification.error('حدث خطأ أثناء تسجيل الطلب.');
      },
      complete: () => {
        this.submittingRequest = false;
      }
    });
  }

  getFieldError(field: RuntimeFieldViewModel): string | null {
    const control = this.dynamicFieldsGroup.get(field.controlName);
    if (!control || !(control.touched || control.dirty)) {
      return null;
    }

    if (control.hasError('required') || control.hasError('requiredTrue')) {
      return `${field.label} حقل إلزامي.`;
    }

    if (control.hasError('email')) {
      return 'صيغة البريد الإلكتروني غير صحيحة.';
    }

    if (control.hasError('pattern')) {
      return 'القيمة لا تطابق النمط المطلوب.';
    }

    if (control.hasError('min') || control.hasError('max')) {
      return 'القيمة خارج النطاق المسموح.';
    }

    return 'قيمة غير صالحة.';
  }

  private refreshTree(): void {
    this.treeNodes = this.facade.buildTreeNodes(
      this.catalog,
      this.selectedApplicationId,
      this.searchText
    );

    this.totalStartableCount = this.facade.countTotalStartableRequests(
      this.catalog,
      this.selectedApplicationId
    );

    this.visibleStartableCount = this.facade.countVisibleStartableRequests(this.treeNodes);

    this.selectedNode = null;
    this.clearRuntimeWorkspace();
  }

  private activateRequestNode(node: RequestRuntimeTreeNode): void {
    this.selectedRequestNode = node;
    this.envelopeTerminology = buildEnvelopeTerminology(node.data?.envelopeDisplayName);
    this.loadRuntimeWorkspace(false);
  }

  private loadRuntimeWorkspace(preserveValues: boolean): void {
    const node = this.selectedRequestNode;
    if (!node?.data?.canStart) {
      this.clearRuntimeWorkspace();
      return;
    }

    const categoryId = Number(node.data.categoryId ?? 0);
    if (categoryId <= 0) {
      this.clearRuntimeWorkspace();
      return;
    }

    const snapshot = preserveValues
      ? this.captureWorkspaceSnapshot()
      : this.createEmptySnapshot();

    this.runtimeLoading = true;

    this.facade.loadFormDefinition(categoryId, {
      stageId: Number(node.data.startStageId ?? 0) > 0 ? Number(node.data.startStageId ?? 0) : undefined,
      documentDirection: this.normalizeDirectionValue(snapshot.documentDirection)
    }).subscribe({
      next: response => {
        if ((response.errors ?? []).length > 0 || !response.data) {
          this.activeDefinition = null;
          this.runtimeFieldGroups = [];
          this.runtimeFields = [];
          this.requestForm.setControl('dynamicFields', this.fb.group({}));
          this.appNotification.showApiErrors(response.errors ?? [], 'تعذر تحميل نموذج الطلب المختار.');
          return;
        }

        this.activeDefinition = response.data;
        this.rebuildDynamicFields(response.data, snapshot.dynamicValues);
        this.configureDirectionState(response.data, snapshot.documentDirection);

        this.requestForm.patchValue(
          {
            subject: this.normalizeNullable(snapshot.subject) ?? this.normalizeNullable(response.data.categoryName) ?? '',
            description: snapshot.description,
            envelopeId: snapshot.envelopeId
          },
          { emitEvent: false }
        );
      },
      error: () => {
        this.activeDefinition = null;
        this.runtimeFieldGroups = [];
        this.runtimeFields = [];
        this.requestForm.setControl('dynamicFields', this.fb.group({}));
        this.appNotification.error('حدث خطأ أثناء تحميل نموذج الطلب.');
      },
      complete: () => {
        this.runtimeLoading = false;
      }
    });

    this.loadEnvelopes(snapshot.envelopeId);
  }

  private loadEnvelopes(preferredEnvelopeId?: number | null): void {
    this.envelopeLoading = true;

    this.facade.loadEnvelopes().subscribe({
      next: response => {
        this.availableEnvelopes = response.data?.items ?? [];

        if ((response.errors ?? []).length > 0) {
          this.appNotification.showApiErrors(
            response.errors ?? [],
            `تعذر تحميل قائمة ${this.envelopeTerminology.displayName}.`
          );
        }

        const currentValue = Number(preferredEnvelopeId ?? this.requestForm.get('envelopeId')?.value ?? 0);
        const matched = this.availableEnvelopes.some(item => Number(item.envelopeId) === currentValue)
          ? currentValue
          : null;

        this.requestForm.patchValue({ envelopeId: matched }, { emitEvent: false });
      },
      error: () => {
        this.availableEnvelopes = [];
        this.requestForm.patchValue({ envelopeId: null }, { emitEvent: false });
        this.appNotification.error(`حدث خطأ أثناء تحميل قائمة ${this.envelopeTerminology.displayName}.`);
      },
      complete: () => {
        this.envelopeLoading = false;
      }
    });
  }

  private rebuildDynamicFields(definition: RequestRuntimeFormDefinitionDto, previousValues: Record<string, unknown>): void {
    const dynamicGroup = this.fb.group({});
    const fieldViewModels = (definition.fields ?? [])
      .filter(field => field.isVisible !== false)
      .map(field => this.mapFieldViewModel(field))
      .filter((field): field is RuntimeFieldViewModel => field != null)
      .sort((left, right) => {
        if (left.groupId !== right.groupId) {
          return left.groupId - right.groupId;
        }

        if (left.displayOrder !== right.displayOrder) {
          return left.displayOrder - right.displayOrder;
        }

        return left.label.localeCompare(right.label, 'ar');
      });

    fieldViewModels.forEach(field => {
      const previousValue = previousValues[field.controlName];
      const initialValue = previousValue !== undefined
        ? previousValue
        : this.resolveInitialFieldValue(field.source, field.inputType);

      dynamicGroup.addControl(
        field.controlName,
        new FormControl(initialValue, this.buildFieldValidators(field.source, field.inputType))
      );
    });

    this.requestForm.setControl('dynamicFields', dynamicGroup);
    this.runtimeFields = fieldViewModels;
    this.runtimeFieldGroups = this.groupRuntimeFields(fieldViewModels);
  }

  private mapFieldViewModel(field: RequestRuntimeFieldDefinitionDto): RuntimeFieldViewModel | null {
    const controlName = String(field.fieldKey ?? '').trim();
    if (controlName.length === 0) {
      return null;
    }

    const label = String(field.fieldLabel ?? '').trim() || controlName;
    const inputType = this.resolveInputType(field);
    const options = inputType === 'dropdown' ? this.parseFieldOptions(field.optionsPayload) : [];

    return {
      controlName,
      label,
      placeholder: String(field.placeholder ?? '').trim(),
      required: field.required === true || field.requiredTrue === true,
      inputType,
      options,
      displayOrder: Number(field.displayOrder ?? 0),
      groupId: Number(field.group?.groupId ?? 0),
      groupName: String(field.group?.groupName ?? '').trim() || 'البيانات الأساسية',
      source: field
    };
  }

  private resolveInputType(field: RequestRuntimeFieldDefinitionDto): RuntimeFieldInputType {
    const normalized = String(field.fieldType ?? '').trim().toLowerCase();
    const dataType = String(field.dataType ?? '').trim().toLowerCase();

    if (normalized.includes('textarea')) {
      return 'textarea';
    }

    if (normalized.includes('radio') || normalized.includes('select') || normalized.includes('drop') || normalized.includes('combo')) {
      return 'dropdown';
    }

    if (normalized.includes('toggle') || normalized.includes('bool') || normalized.includes('check') || normalized.includes('switch')) {
      return 'toggle';
    }

    if (normalized.includes('datetime') || (normalized.includes('date') && normalized.includes('time'))) {
      return 'datetime';
    }

    if (normalized.includes('date') || normalized.includes('calendar')) {
      return 'date';
    }

    if (normalized.includes('number')
      || normalized.includes('int')
      || normalized.includes('decimal')
      || dataType.includes('number')
      || dataType.includes('int')
      || dataType.includes('decimal')) {
      return 'number';
    }

    return 'text';
  }

  private resolveInitialFieldValue(field: RequestRuntimeFieldDefinitionDto, inputType: RuntimeFieldInputType): unknown {
    const fallbackValue = String(field.defaultValue ?? '').trim();

    if (inputType === 'toggle') {
      if (fallbackValue.length === 0) {
        return false;
      }

      const normalized = fallbackValue.toLowerCase();
      return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on';
    }

    if (inputType === 'date' || inputType === 'datetime') {
      if (fallbackValue.length === 0) {
        return null;
      }

      const parsed = new Date(fallbackValue);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    if (inputType === 'number') {
      if (fallbackValue.length === 0) {
        return null;
      }

      const parsed = Number(fallbackValue);
      return Number.isFinite(parsed) ? parsed : null;
    }

    if (inputType === 'dropdown') {
      return fallbackValue.length > 0 ? fallbackValue : null;
    }

    return fallbackValue;
  }

  private buildFieldValidators(field: RequestRuntimeFieldDefinitionDto, inputType: RuntimeFieldInputType): ValidatorFn[] {
    const validators: any[] = [];

    if (field.requiredTrue === true && inputType === 'toggle') {
      validators.push(Validators.requiredTrue);
    } else if (field.required === true || field.requiredTrue === true) {
      validators.push(Validators.required);
    }

    if (field.email === true) {
      validators.push(Validators.email);
    }

    if (field.pattern === true) {
      const patternExpression = this.resolvePatternExpression(field.optionsPayload);
      if (patternExpression.length > 0) {
        try {
          validators.push(Validators.pattern(patternExpression));
        } catch {
          // Ignore invalid regex payload and rely on backend validation.
        }
      }
    }

    if (inputType === 'number') {
      const minValue = Number(field.minValue ?? Number.NaN);
      const maxValue = Number(field.maxValue ?? Number.NaN);

      if (Number.isFinite(minValue)) {
        validators.push(Validators.min(minValue));
      }

      if (Number.isFinite(maxValue)) {
        validators.push(Validators.max(maxValue));
      }
    }

    return validators;
  }

  private groupRuntimeFields(fields: RuntimeFieldViewModel[]): RuntimeFieldGroupViewModel[] {
    const groups = new Map<number, RuntimeFieldGroupViewModel>();

    fields.forEach(field => {
      if (!groups.has(field.groupId)) {
        groups.set(field.groupId, {
          groupId: field.groupId,
          groupName: field.groupName,
          fields: []
        });
      }

      groups.get(field.groupId)!.fields.push(field);
    });

    return Array.from(groups.values())
      .map(group => ({
        ...group,
        fields: [...group.fields].sort((left, right) => {
          if (left.displayOrder !== right.displayOrder) {
            return left.displayOrder - right.displayOrder;
          }

          return left.label.localeCompare(right.label, 'ar');
        })
      }))
      .sort((left, right) => left.groupId - right.groupId);
  }

  private configureDirectionState(definition: RequestRuntimeFormDefinitionDto, requestedDirection: string): void {
    const workflow = definition.requestPolicy?.workflowPolicy;
    const directionMode = this.normalizeDirectionMode(workflow?.directionMode);
    const fixedDirection = this.normalizeDirectionValue(workflow?.fixedDirection);

    this.fixedDirection = fixedDirection;

    if (directionMode === 'fixed' && fixedDirection != null) {
      this.directionMode = 'fixed';
      this.requestForm.patchValue({ documentDirection: fixedDirection }, { emitEvent: false });
      return;
    }

    const hasDirectionField = this.runtimeFields.some(field =>
      field.controlName.toLowerCase().includes('direction'));

    if (directionMode === 'selectable' || hasDirectionField) {
      this.directionMode = 'selectable';
      const normalizedDirection = this.normalizeDirectionValue(requestedDirection) ?? '';
      this.requestForm.patchValue({ documentDirection: normalizedDirection }, { emitEvent: false });
      return;
    }

    this.directionMode = 'none';
    this.requestForm.patchValue({ documentDirection: '' }, { emitEvent: false });
  }

  private buildDynamicFieldsPayload(): RequestRuntimeSubjectFieldValueDto[] {
    return this.runtimeFields.map(field => ({
      fieldKey: field.controlName,
      value: this.normalizeOutgoingDynamicValue(
        this.dynamicFieldsGroup.get(field.controlName)?.value,
        field.inputType
      )
    }));
  }

  private normalizeOutgoingDynamicValue(value: unknown, inputType: RuntimeFieldInputType): string {
    if (value === null || value === undefined) {
      return '';
    }

    if ((inputType === 'date' || inputType === 'datetime') && value instanceof Date) {
      return Number.isNaN(value.getTime()) ? '' : value.toISOString();
    }

    if (inputType === 'toggle') {
      return value === true ? 'true' : 'false';
    }

    return String(value);
  }

  private parseFieldOptions(optionsPayload?: string): RuntimeFieldOption[] {
    const payload = String(optionsPayload ?? '').trim();
    if (payload.length === 0) {
      return [];
    }

    try {
      const parsed = JSON.parse(payload);
      if (Array.isArray(parsed)) {
        return parsed
          .map(item => this.mapOptionItem(item))
          .filter((item): item is RuntimeFieldOption => item != null);
      }
    } catch {
      // fallback to delimited parsing
    }

    return payload
      .split(/[|,;\n]+/g)
      .map(item => item.trim())
      .filter(item => item.length > 0)
      .map(item => ({ label: item, value: item }));
  }

  private mapOptionItem(item: unknown): RuntimeFieldOption | null {
    if (item == null) {
      return null;
    }

    if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') {
      const text = String(item);
      return { label: text, value: text };
    }

    const asObject = item as Record<string, unknown>;
    const value = String(asObject['value'] ?? asObject['id'] ?? asObject['key'] ?? asObject['label'] ?? asObject['name'] ?? '');
    const label = String(asObject['label'] ?? asObject['name'] ?? asObject['text'] ?? value);

    if (value.trim().length === 0 && label.trim().length === 0) {
      return null;
    }

    return {
      label: label.trim().length > 0 ? label : value,
      value: value.trim().length > 0 ? value : label
    };
  }

  private resolvePatternExpression(optionsPayload?: string): string {
    const payload = String(optionsPayload ?? '').trim();
    if (payload.length === 0 || payload.startsWith('[') || payload.startsWith('{')) {
      return '';
    }

    return payload;
  }

  private setExpandedState(nodes: RequestRuntimeTreeNode[], expanded: boolean): void {
    (nodes ?? []).forEach(node => {
      node.expanded = expanded;
      this.setExpandedState((node.children ?? []) as RequestRuntimeTreeNode[], expanded);
    });
  }

  private clearRuntimeWorkspace(): void {
    this.selectedRequestNode = null;
    this.activeDefinition = null;
    this.runtimeFieldGroups = [];
    this.runtimeFields = [];
    this.availableEnvelopes = [];
    this.directionMode = 'none';
    this.fixedDirection = null;
    this.envelopeTerminology = buildEnvelopeTerminology(null);

    this.requestForm.reset(
      {
        subject: '',
        description: '',
        documentDirection: '',
        envelopeId: null
      },
      { emitEvent: false }
    );
    this.requestForm.setControl('dynamicFields', this.fb.group({}));
  }

  private captureWorkspaceSnapshot(): RuntimeWorkspaceSnapshot {
    const dynamicValues: Record<string, unknown> = {};
    Object.keys(this.dynamicFieldsGroup.controls).forEach(controlName => {
      dynamicValues[controlName] = this.dynamicFieldsGroup.get(controlName)?.value;
    });

    return {
      subject: String(this.requestForm.get('subject')?.value ?? ''),
      description: String(this.requestForm.get('description')?.value ?? ''),
      documentDirection: String(this.requestForm.get('documentDirection')?.value ?? ''),
      envelopeId: Number(this.requestForm.get('envelopeId')?.value ?? 0) > 0
        ? Number(this.requestForm.get('envelopeId')?.value)
        : null,
      dynamicValues
    };
  }

  private createEmptySnapshot(): RuntimeWorkspaceSnapshot {
    return {
      subject: '',
      description: '',
      documentDirection: '',
      envelopeId: null,
      dynamicValues: {}
    };
  }

  private normalizeDirectionMode(value: unknown): RuntimeDirectionMode {
    const normalized = String(value ?? '').trim().toLowerCase();
    if (normalized === 'fixed') {
      return 'fixed';
    }

    if (normalized === 'selectable') {
      return 'selectable';
    }

    return 'none';
  }

  private normalizeDirectionValue(value: unknown): string | null {
    const normalized = String(value ?? '').trim().toLowerCase();
    if (normalized === 'incoming' || normalized === 'وارد') {
      return 'incoming';
    }

    if (normalized === 'outgoing' || normalized === 'صادر') {
      return 'outgoing';
    }

    return null;
  }

  private resolveDirectionLabel(value: string | null): string {
    if (value === 'incoming') {
      return 'وارد';
    }

    if (value === 'outgoing') {
      return 'صادر';
    }

    return 'غير محدد';
  }

  private normalizeNullable(value: unknown): string | null {
    const normalized = String(value ?? '').trim();
    return normalized.length > 0 ? normalized : null;
  }

  private formatDateOnly(value: unknown): string {
    const parsed = value instanceof Date ? value : new Date(String(value ?? ''));
    const safeDate = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
    const year = safeDate.getFullYear();
    const month = String(safeDate.getMonth() + 1).padStart(2, '0');
    const day = String(safeDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
