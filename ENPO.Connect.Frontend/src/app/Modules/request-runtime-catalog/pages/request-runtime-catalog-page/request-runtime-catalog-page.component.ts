import { Component, OnInit } from '@angular/core';
import { AbstractControl, FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { GenericFormsService } from 'src/app/Modules/GenericComponents/GenericForms.service';
import {
  CdCategoryMandDto,
  CdmendDto
} from 'src/app/shared/services/BackendServices/DynamicForm/DynamicForm.dto';
import {
  normalizeRequestViewMode,
  RequestViewMode,
  REQUEST_VIEW_MODE_OPTIONS_AR,
  REQUEST_VIEW_MODE_STANDARD
} from 'src/app/shared/models/request-view-mode';
import { AppNotificationService } from 'src/app/shared/services/notifications/app-notification.service';
import {
  REQUEST_RUNTIME_ALL_APPLICATIONS_VALUE,
  RequestRuntimeAdminGroupTreeNodeDto,
  RequestRuntimeApplicationOption,
  RequestRuntimeCatalogDto,
  RequestRuntimeEnvelopeSummaryDto,
  RequestRuntimeEnvelopeTerminology,
  RequestRuntimeFieldDefinitionDto,
  RequestRuntimeFormDefinitionDto,
  RequestRuntimeFormGroupDefinitionDto,
  RequestRuntimeSubjectFieldValueDto,
  RequestRuntimeTreeNode,
  buildEnvelopeTerminology,
  createEmptyRuntimeCatalog
} from '../../models/request-runtime-catalog.models';
import { RequestRuntimeCatalogFacadeService } from '../../services/request-runtime-catalog-facade.service';

type RuntimeDirectionMode = 'none' | 'selectable' | 'fixed';

interface RuntimeGroupHierarchyMeta {
  parentGroupId: number | null;
  displayOrder: number;
  hierarchyOrder?: number;
}

interface RuntimeCanonicalGroupMeta extends RuntimeGroupHierarchyMeta {
  groupName: string;
  groupDescription?: string;
}

interface RuntimeGroupRenderNode {
  groupId: number;
  groupName: string;
  groupDescription?: string;
  formArrayName: string | null;
  fields: CdCategoryMandDto[];
  totalVisibleFieldsCount: number;
  children: RuntimeGroupRenderNode[];
}

interface RuntimeWorkspaceSnapshot {
  subject: string;
  description: string;
  documentDirection: string;
  envelopeId: number | null;
  dynamicValues: RequestRuntimeSubjectFieldValueDto[];
}

@Component({
  selector: 'app-request-runtime-catalog-page',
  templateUrl: './request-runtime-catalog-page.component.html',
  styleUrls: ['./request-runtime-catalog-page.component.scss']
})
export class RequestRuntimeCatalogPageComponent implements OnInit {
  private static readonly DIRECTION_FIELD_KEY = 'TOPICDIRECTION';

  readonly allApplicationsValue = REQUEST_RUNTIME_ALL_APPLICATIONS_VALUE;
  readonly directionOptions: Array<{ label: string; value: string }> = [
    { label: 'وارد', value: 'incoming' },
    { label: 'صادر', value: 'outgoing' }
  ];
  readonly formDisplayModeOptions: Array<{ label: string; value: RequestViewMode }> = [...REQUEST_VIEW_MODE_OPTIONS_AR];

  readonly requestForm: FormGroup = this.fb.group({
    subject: [''],
    description: [''],
    documentDirection: [''],
    envelopeId: [null]
  });

  readonly newEnvelopeForm: FormGroup = this.fb.group({
    envelopeRef: ['', [Validators.required, Validators.maxLength(80)]],
    incomingDate: [new Date(), Validators.required],
    sourceEntity: ['', Validators.maxLength(120)],
    deliveryDelegate: ['', Validators.maxLength(120)],
    notes: ['', Validators.maxLength(300)]
  });

  dynamicControls: FormGroup = this.fb.group({});

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

  rawFormDefinition: RequestRuntimeFormDefinitionDto | null = null;
  formDefinition: RequestRuntimeFormDefinitionDto | null = null;
  renderGroupTree: RuntimeGroupRenderNode[] = [];

  allowRequesterOverride = false;
  currentDisplayMode: RequestViewMode = REQUEST_VIEW_MODE_STANDARD;
  rootGroupTabIndex = 0;

  private directionSelectionMode: RuntimeDirectionMode = 'none';
  private fixedDocumentDirection: string | null = null;
  private suppressDirectionRebuild = false;
  private lastResolvedDirectionKey: string | null = null;

  private readonly controlMap = new Map<string, { fieldKey: string; instanceGroupId: number }>();

  private canonicalGroupHierarchyCategoryId: number | null = null;
  private canonicalGroupHierarchyRequestToken = 0;
  private canonicalGroupHierarchyByGroupId = new Map<number, RuntimeCanonicalGroupMeta>();
  private readonly canonicalGroupHierarchyCache = new Map<number, Map<number, RuntimeCanonicalGroupMeta>>();

  constructor(
    private readonly facade: RequestRuntimeCatalogFacadeService,
    private readonly appNotification: AppNotificationService,
    private readonly genericFormService: GenericFormsService,
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

  get shouldShowDisplayModeSelector(): boolean {
    return this.allowRequesterOverride;
  }

  get isTabbedDisplayModeActive(): boolean {
    return this.currentDisplayMode === 'tabbed' && this.renderGroupTree.length > 0;
  }

  get hasDirectionCapability(): boolean {
    const hasDirectionField = (this.rawFormDefinition?.fields ?? []).some(field =>
      String(field.fieldKey ?? '').trim().toUpperCase() === RequestRuntimeCatalogPageComponent.DIRECTION_FIELD_KEY);
    return hasDirectionField || this.fixedDocumentDirection != null;
  }

  get showDirectionSelector(): boolean {
    return this.hasDirectionCapability && this.directionSelectionMode === 'selectable';
  }

  get showDirectionReadonly(): boolean {
    return this.hasDirectionCapability && this.directionSelectionMode === 'fixed';
  }

  get directionReadonlyLabel(): string {
    return this.resolveDirectionLabel(this.resolveDocumentDirectionForForm());
  }

  trackByGroupNode = (_index: number, groupNode: RuntimeGroupRenderNode): number => groupNode.groupId;

  getFormArrayControls(formArrayName: string): AbstractControl[] {
    return this.getFormArrayInstance(formArrayName)?.controls ?? [];
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
    // reserved for future cross-field runtime interactions
  }

  onDisplayModeChanged(mode: RequestViewMode | null | undefined): void {
    this.currentDisplayMode = normalizeRequestViewMode(mode);
    this.rootGroupTabIndex = 0;
  }

  onRootGroupTabChange(nextIndex: number | null | undefined): void {
    const normalized = Number(nextIndex ?? 0);
    this.rootGroupTabIndex = Number.isFinite(normalized) && normalized >= 0
      ? Math.trunc(normalized)
      : 0;
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
    if (!this.hasSelectedRequest || this.runtimeLoading || this.directionSelectionMode !== 'selectable' || this.suppressDirectionRebuild) {
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
    this.dynamicControls.markAllAsTouched();

    if (this.dynamicControls.invalid) {
      this.focusFirstInvalidDynamicControl();
      this.appNotification.warning('يرجى استكمال الحقول الديناميكية المطلوبة قبل تسجيل الطلب.');
      return;
    }

    const categoryId = Number(this.selectedRequestNode?.data?.categoryId ?? 0);
    if (categoryId <= 0) {
      this.appNotification.warning('تعذر تحديد نوع الطلب المختار.');
      return;
    }

    const dynamicFields = this.buildDynamicFieldValues();
    const documentDirection = this.resolveDocumentDirectionForSave(dynamicFields);
    if (this.hasDirectionCapability && !documentDirection) {
      this.requestForm.get('documentDirection')?.markAsTouched();
      this.appNotification.warning('يرجى تحديد اتجاه الطلب (وارد/صادر).');
      return;
    }

    const stageId = Number(this.selectedRequestNode?.data?.startStageId ?? 0);
    const envelopeId = Number(this.requestForm.get('envelopeId')?.value ?? 0);

    const payload = {
      categoryId,
      stageId: stageId > 0 ? stageId : undefined,
      documentDirection: documentDirection ?? undefined,
      subject: this.normalizeNullable(this.requestForm.get('subject')?.value) ?? undefined,
      description: this.normalizeNullable(this.requestForm.get('description')?.value) ?? undefined,
      saveAsDraft: false,
      submit: true,
      envelopeId: envelopeId > 0 ? envelopeId : undefined,
      dynamicFields,
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

    this.loadCanonicalGroupHierarchy(categoryId);
    this.runtimeLoading = true;

    this.facade.loadFormDefinition(categoryId, {
      stageId: Number(node.data.startStageId ?? 0) > 0 ? Number(node.data.startStageId ?? 0) : undefined,
      documentDirection: this.normalizeDirectionValue(snapshot.documentDirection),
      appId: this.normalizeNullable(node.data.applicationId)
    }).subscribe({
      next: response => {
        if ((response.errors ?? []).length > 0 || !response.data || Number(response.data.fields?.length ?? 0) === 0) {
          this.clearLoadedDefinitionState();
          this.appNotification.showApiErrors(response.errors ?? [], 'تعذر تحميل نموذج الطلب المختار.');
          return;
        }

        this.rawFormDefinition = response.data;
        this.applyPresentationSettingsFromDefinition(this.rawFormDefinition);
        this.applyDirectionPolicyFromDefinition(this.resolveInitialDirectionCandidate(snapshot.documentDirection));
        this.formDefinition = this.resolveDefinitionByPolicy(
          this.rawFormDefinition,
          this.resolveDocumentDirectionForForm()
        );

        this.rebuildDynamicControls(this.formDefinition, snapshot.dynamicValues);

        this.requestForm.patchValue(
          {
            subject: this.normalizeNullable(snapshot.subject)
              ?? this.normalizeNullable(response.data.categoryName)
              ?? '',
            description: snapshot.description,
            envelopeId: snapshot.envelopeId
          },
          { emitEvent: false }
        );
      },
      error: () => {
        this.clearLoadedDefinitionState();
        this.appNotification.error('حدث خطأ أثناء تحميل نموذج الطلب.');
      },
      complete: () => {
        this.runtimeLoading = false;
      }
    });

    this.loadEnvelopes(snapshot.envelopeId);
  }

  private applyPresentationSettingsFromDefinition(definition: RequestRuntimeFormDefinitionDto | null): void {
    this.allowRequesterOverride = (definition?.allowRequesterOverride ?? definition?.allowUserToChangeDisplayMode) === true;
    this.currentDisplayMode = normalizeRequestViewMode(
      definition?.defaultViewMode ?? definition?.defaultDisplayMode
    );
    this.rootGroupTabIndex = 0;
  }

  private resolveDefinitionByPolicy(
    source: RequestRuntimeFormDefinitionDto,
    _documentDirection: string | null
  ): RequestRuntimeFormDefinitionDto {
    return {
      ...source,
      groups: (source.groups ?? []).map(group => ({ ...group })),
      fields: (source.fields ?? []).map(field => ({
        ...field,
        group: field.group ? { ...field.group } : undefined
      }))
    };
  }

  private resolveInitialDirectionCandidate(preferredDirection?: string): string | null {
    const preferred = this.normalizeDirectionValue(preferredDirection);
    if (preferred) {
      return preferred;
    }

    return this.normalizeDirectionValue(this.requestForm.get('documentDirection')?.value);
  }

  private applyDirectionPolicyFromDefinition(initialDirection: string | null): void {
    const workflow = this.rawFormDefinition?.requestPolicy?.workflowPolicy;
    const modeFromPolicy = String(workflow?.directionMode ?? '').trim().toLowerCase();
    const fixedDirection = modeFromPolicy === 'fixed'
      ? this.normalizeDirectionValue(workflow?.fixedDirection)
      : null;

    this.fixedDocumentDirection = fixedDirection;

    if (fixedDirection) {
      this.directionSelectionMode = 'fixed';
    } else if (this.hasDirectionCapability) {
      this.directionSelectionMode = 'selectable';
    } else {
      this.directionSelectionMode = 'none';
    }

    const directionControl = this.requestForm.get('documentDirection');
    if (!directionControl) {
      return;
    }

    const preferredDirection = this.fixedDocumentDirection
      ?? initialDirection
      ?? this.normalizeDirectionValue(directionControl.value)
      ?? null;

    this.suppressDirectionRebuild = true;
    directionControl.patchValue(preferredDirection ?? '', { emitEvent: false });

    if (this.directionSelectionMode === 'fixed') {
      directionControl.disable({ emitEvent: false });
    } else {
      directionControl.enable({ emitEvent: false });
    }

    const requiresDirectionSelection = this.hasDirectionCapability && this.directionSelectionMode === 'selectable';
    directionControl.setValidators(requiresDirectionSelection ? [Validators.required] : []);
    directionControl.updateValueAndValidity({ emitEvent: false });
    this.suppressDirectionRebuild = false;
    this.lastResolvedDirectionKey = preferredDirection;
  }

  private resolveDocumentDirectionForForm(): string | null {
    if (this.directionSelectionMode === 'fixed' && this.fixedDocumentDirection) {
      return this.fixedDocumentDirection;
    }

    return this.normalizeDirectionValue(this.requestForm.get('documentDirection')?.value);
  }

  private resolveDocumentDirectionForSave(dynamicFields: RequestRuntimeSubjectFieldValueDto[]): string | null {
    const fixedDirection = this.directionSelectionMode === 'fixed'
      ? this.normalizeDirectionValue(this.fixedDocumentDirection)
      : null;
    if (fixedDirection) {
      return fixedDirection;
    }

    const explicitDirection = this.resolveDocumentDirectionForForm();
    if (explicitDirection) {
      return explicitDirection;
    }

    const directionFieldValue = (dynamicFields ?? [])
      .find(field => String(field.fieldKey ?? '').trim().toUpperCase() === RequestRuntimeCatalogPageComponent.DIRECTION_FIELD_KEY)
      ?.value;

    return this.normalizeDirectionValue(directionFieldValue);
  }

  private loadCanonicalGroupHierarchy(categoryId: number): void {
    const normalizedCategoryId = this.normalizePositiveInt(categoryId);
    if (!normalizedCategoryId) {
      this.canonicalGroupHierarchyCategoryId = null;
      this.canonicalGroupHierarchyByGroupId = new Map<number, RuntimeCanonicalGroupMeta>();
      return;
    }

    this.canonicalGroupHierarchyCategoryId = normalizedCategoryId;
    const cached = this.canonicalGroupHierarchyCache.get(normalizedCategoryId);
    if (cached) {
      this.canonicalGroupHierarchyByGroupId = this.cloneCanonicalGroupHierarchyMap(cached);
      return;
    }

    this.canonicalGroupHierarchyByGroupId = new Map<number, RuntimeCanonicalGroupMeta>();
    const requestToken = ++this.canonicalGroupHierarchyRequestToken;
    this.facade.loadCategoryGroups(normalizedCategoryId).subscribe({
      next: response => {
        if (requestToken !== this.canonicalGroupHierarchyRequestToken
          || this.canonicalGroupHierarchyCategoryId !== normalizedCategoryId) {
          return;
        }

        const hierarchyMap = this.buildCanonicalGroupHierarchyMap(response?.data ?? []);
        this.canonicalGroupHierarchyByGroupId = hierarchyMap;
        this.canonicalGroupHierarchyCache.set(normalizedCategoryId, this.cloneCanonicalGroupHierarchyMap(hierarchyMap));

        if (Number(this.formDefinition?.categoryId ?? 0) === normalizedCategoryId) {
          this.rebuildDynamicControls(
            this.formDefinition,
            this.buildDynamicFieldValues()
          );
        }
      },
      error: () => {
        if (requestToken !== this.canonicalGroupHierarchyRequestToken
          || this.canonicalGroupHierarchyCategoryId !== normalizedCategoryId) {
          return;
        }

        this.canonicalGroupHierarchyByGroupId = new Map<number, RuntimeCanonicalGroupMeta>();
      }
    });
  }

  private buildCanonicalGroupHierarchyMap(nodes: ReadonlyArray<RequestRuntimeAdminGroupTreeNodeDto>): Map<number, RuntimeCanonicalGroupMeta> {
    const result = new Map<number, RuntimeCanonicalGroupMeta>();
    let sequence = 0;

    const walk = (items: ReadonlyArray<RequestRuntimeAdminGroupTreeNodeDto>, parentGroupId: number | null): void => {
      const sorted = [...(items ?? [])]
        .sort((left, right) => {
          const orderDiff = Number(left.displayOrder ?? 0) - Number(right.displayOrder ?? 0);
          if (orderDiff !== 0) {
            return orderDiff;
          }

          return Number(left.groupId ?? 0) - Number(right.groupId ?? 0);
        });

      sorted.forEach(item => {
        const groupId = Number(item.groupId ?? 0);
        if (!Number.isFinite(groupId) || groupId <= 0) {
          return;
        }

        sequence++;
        const parentCandidate = this.normalizePositiveInt(item.parentGroupId) ?? parentGroupId ?? null;
        result.set(groupId, {
          parentGroupId: parentCandidate && parentCandidate !== groupId ? parentCandidate : null,
          displayOrder: Number(item.displayOrder ?? sequence) || sequence,
          hierarchyOrder: sequence,
          groupName: String(item.groupName ?? '').trim(),
          groupDescription: String(item.groupDescription ?? '').trim() || undefined
        });

        walk(item.children ?? [], groupId);
      });
    };

    walk(nodes ?? [], null);
    return result;
  }

  private cloneCanonicalGroupHierarchyMap(source: Map<number, RuntimeCanonicalGroupMeta>): Map<number, RuntimeCanonicalGroupMeta> {
    const cloned = new Map<number, RuntimeCanonicalGroupMeta>();
    source.forEach((value, key) => {
      cloned.set(key, { ...value });
    });

    return cloned;
  }

  private getActiveCanonicalGroupHierarchyMap(categoryId: number): Map<number, RuntimeCanonicalGroupMeta> {
    if (!categoryId || this.canonicalGroupHierarchyCategoryId !== categoryId) {
      return new Map<number, RuntimeCanonicalGroupMeta>();
    }

    return this.canonicalGroupHierarchyByGroupId;
  }

  private rebuildDynamicControls(definition: RequestRuntimeFormDefinitionDto | null, values: RequestRuntimeSubjectFieldValueDto[]): void {
    this.resetDynamicFormState();

    const allFields = [...(definition?.fields ?? [])]
      .sort((left, right) => this.compareFieldsByDisplayOrder(left, right));
    const fieldsToRender = allFields.filter(field =>
      field.isVisible !== false
      && field.canView !== false
      && field.isHidden !== true);

    if (!definition || fieldsToRender.length === 0) {
      return;
    }

    const canonicalHierarchyMap = this.getActiveCanonicalGroupHierarchyMap(Number(definition.categoryId ?? 0));
    const definitionGroups = (definition.groups ?? []).filter(group => this.isGroupVisible(group));
    const definitionGroupById = new Map<number, RequestRuntimeFormGroupDefinitionDto>();

    definitionGroups.forEach(group => {
      const groupId = Number(group.groupId ?? 0);
      if (groupId <= 0) {
        return;
      }

      definitionGroupById.set(groupId, group);
    });

    canonicalHierarchyMap.forEach((groupMeta, groupId) => {
      const current = definitionGroupById.get(groupId);
      if (!current) {
        definitionGroupById.set(groupId, {
          groupId,
          groupName: groupMeta.groupName,
          groupDescription: groupMeta.groupDescription,
          isExtendable: false,
          groupWithInRow: 12
        });
        return;
      }

      if (!String(current.groupName ?? '').trim() && String(groupMeta.groupName ?? '').trim()) {
        current.groupName = groupMeta.groupName;
      }
      if (!String(current.groupDescription ?? '').trim() && String(groupMeta.groupDescription ?? '').trim()) {
        current.groupDescription = groupMeta.groupDescription;
      }
    });

    fieldsToRender.forEach(field => {
      const groupId = Number(field.mendGroup ?? 0);
      if (groupId <= 0 || definitionGroupById.has(groupId)) {
        return;
      }

      definitionGroupById.set(groupId, {
        groupId,
        groupName: String(field.group?.groupName ?? '').trim(),
        groupDescription: String(field.group?.groupDescription ?? '').trim(),
        isExtendable: Boolean(field.group?.isExtendable),
        groupWithInRow: Number(field.group?.groupWithInRow ?? 12)
      });
    });

    const fieldsByGroup = new Map<number, RequestRuntimeFieldDefinitionDto[]>();
    fieldsToRender.forEach(field => {
      const groupId = Number(field.mendGroup ?? 0);
      if (groupId <= 0) {
        return;
      }

      if (!fieldsByGroup.has(groupId)) {
        fieldsByGroup.set(groupId, []);
      }

      fieldsByGroup.get(groupId)?.push(field);
    });

    const groupHierarchyMap = this.buildRuntimeGroupHierarchy(
      Array.from(definitionGroupById.values()),
      fieldsToRender
    );

    const groupIdsToRender = new Set<number>(Array.from(fieldsByGroup.keys()));
    Array.from(fieldsByGroup.keys()).forEach(groupId => {
      const visited = new Set<number>([groupId]);
      let parentGroupId = groupHierarchyMap.get(groupId)?.parentGroupId ?? null;
      while (parentGroupId && !visited.has(parentGroupId)) {
        if (!groupHierarchyMap.has(parentGroupId)) {
          break;
        }

        const parentMeta = definitionGroupById.get(parentGroupId);
        if (parentMeta && !this.isGroupVisible(parentMeta)) {
          break;
        }

        groupIdsToRender.add(parentGroupId);
        visited.add(parentGroupId);
        parentGroupId = groupHierarchyMap.get(parentGroupId)?.parentGroupId ?? null;
      }
    });

    const safeParentByGroupId = this.buildSanitizedParentGroupMap(groupIdsToRender, groupHierarchyMap);
    const orderedGroupIds = Array.from(groupIdsToRender.values())
      .sort((left, right) => this.compareGroupsByDisplayOrder(left, right, groupHierarchyMap));

    const mappedMendDefinitions: CdmendDto[] = [];
    const mappedCategoryMandDefinitions: CdCategoryMandDto[] = [];
    const renderNodesByGroupId = new Map<number, RuntimeGroupRenderNode>();
    let nextControlIndex = 0;

    orderedGroupIds.forEach(groupId => {
      const groupFields = [...(fieldsByGroup.get(groupId) ?? [])]
        .sort((left, right) => this.compareFieldsByDisplayOrder(left, right));
      const groupDefinition = definitionGroupById.get(groupId) ?? groupFields[0]?.group;
      const groupName = this.resolveRuntimeGroupDisplayName(groupId, groupDefinition, groupFields[0]);
      const canonicalDescription = canonicalHierarchyMap.get(groupId)?.groupDescription;
      const groupDescription = String(canonicalDescription ?? groupDefinition?.groupDescription ?? groupFields[0]?.group?.groupDescription ?? '').trim() || undefined;
      const formArrayName = groupFields.length > 0 ? `dynamic_subject_group_${groupId}` : null;
      const mappedGroupFields: CdCategoryMandDto[] = [];

      if (formArrayName) {
        const formArray = this.fb.array([]);

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
            required: Boolean(field.required || field.requiredTrue || field.isRequired),
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
          this.genericFormService.cdmendDto = mappedMendDefinitions;

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

          this.genericFormService.addFormArrayWithValidators(
            controlName,
            formArray,
            this.shouldTreatFieldAsNotRequired(field)
          );

          const matchedValue = values.find(valueItem =>
            String(valueItem.fieldKey ?? '').trim().toLowerCase() === String(field.fieldKey ?? '').trim().toLowerCase()
            && Number(valueItem.instanceGroupId ?? 1) === 1);

          const initialValue = this.normalizeInitialDynamicValue(
            field,
            cdmendType,
            matchedValue?.value ?? field.defaultValue
          );
          const control = this.genericFormService.GetControl(formArray, controlName);
          control?.patchValue(initialValue, { emitEvent: false });

          const shouldDisable = Boolean(
            field.isDisabledInit
            || field.isReadOnly
            || field.isLocked
            || field.canEdit === false
          );
          if (shouldDisable) {
            control?.disable({ emitEvent: false });
          }

          this.controlMap.set(controlName, {
            fieldKey: field.fieldKey,
            instanceGroupId: 1
          });
        });

        this.dynamicControls.addControl(formArrayName, formArray);
      }

      renderNodesByGroupId.set(groupId, {
        groupId,
        groupName,
        formArrayName,
        groupDescription,
        fields: mappedGroupFields,
        totalVisibleFieldsCount: mappedGroupFields.length,
        children: []
      });
    });

    const rootNodes: RuntimeGroupRenderNode[] = [];
    orderedGroupIds.forEach(groupId => {
      const currentNode = renderNodesByGroupId.get(groupId);
      if (!currentNode) {
        return;
      }

      const parentGroupId = safeParentByGroupId.get(groupId) ?? null;
      const parentNode = parentGroupId ? renderNodesByGroupId.get(parentGroupId) : null;
      if (parentNode) {
        parentNode.children.push(currentNode);
        return;
      }

      rootNodes.push(currentNode);
    });

    rootNodes.forEach(node => this.recomputeGroupTreeFieldCounts(node));
    this.renderGroupTree = rootNodes;
    if (this.rootGroupTabIndex >= this.renderGroupTree.length) {
      this.rootGroupTabIndex = 0;
    }

    this.genericFormService.cdmendDto = mappedMendDefinitions;
    this.genericFormService.cdCategoryMandDto = mappedCategoryMandDefinitions;
    this.lastResolvedDirectionKey = this.resolveDocumentDirectionForForm();
  }

  private shouldTreatFieldAsNotRequired(field: RequestRuntimeFieldDefinitionDto): boolean {
    return Boolean(field.isReadOnly || field.isLocked || field.canEdit === false);
  }

  private isGroupVisible(group?: RequestRuntimeFormGroupDefinitionDto | null): boolean {
    if (!group) {
      return true;
    }

    return group.canView !== false && group.isHidden !== true;
  }

  private compareFieldsByDisplayOrder(left: RequestRuntimeFieldDefinitionDto, right: RequestRuntimeFieldDefinitionDto): number {
    const leftOrder = Number(left.displayOrder ?? 0);
    const rightOrder = Number(right.displayOrder ?? 0);
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return Number(left.mendSql ?? 0) - Number(right.mendSql ?? 0);
  }

  private compareGroupsByDisplayOrder(
    leftGroupId: number,
    rightGroupId: number,
    hierarchy: Map<number, RuntimeGroupHierarchyMeta>
  ): number {
    const leftOrder = Number(hierarchy.get(leftGroupId)?.displayOrder ?? leftGroupId);
    const rightOrder = Number(hierarchy.get(rightGroupId)?.displayOrder ?? rightGroupId);
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    const leftHierarchyOrder = Number(hierarchy.get(leftGroupId)?.hierarchyOrder ?? Number.MAX_SAFE_INTEGER);
    const rightHierarchyOrder = Number(hierarchy.get(rightGroupId)?.hierarchyOrder ?? Number.MAX_SAFE_INTEGER);
    if (leftHierarchyOrder !== rightHierarchyOrder) {
      return leftHierarchyOrder - rightHierarchyOrder;
    }

    return leftGroupId - rightGroupId;
  }

  private buildRuntimeGroupHierarchy(
    definitionGroups: RequestRuntimeFormGroupDefinitionDto[],
    fields: RequestRuntimeFieldDefinitionDto[]
  ): Map<number, RuntimeGroupHierarchyMeta> {
    const hierarchy = new Map<number, RuntimeGroupHierarchyMeta>();
    const categoryId = Number(this.rawFormDefinition?.categoryId ?? 0);
    const canonicalHierarchy = this.getActiveCanonicalGroupHierarchyMap(categoryId);

    canonicalHierarchy.forEach((canonicalItem, groupId) => {
      hierarchy.set(groupId, {
        parentGroupId: canonicalItem.parentGroupId,
        displayOrder: canonicalItem.displayOrder,
        hierarchyOrder: canonicalItem.hierarchyOrder
      });
    });

    definitionGroups.forEach((group, index) => {
      const groupId = Number(group.groupId ?? 0);
      if (groupId <= 0) {
        return;
      }

      const current = hierarchy.get(groupId);
      const parentFromMetadata = this.readParentGroupIdFromGroupMetadata(group);
      hierarchy.set(groupId, {
        parentGroupId: current?.parentGroupId ?? parentFromMetadata,
        displayOrder: current?.displayOrder ?? this.resolveRuntimeGroupDisplayOrder(group, index + 1),
        hierarchyOrder: current?.hierarchyOrder
      });
    });

    fields.forEach((field, index) => {
      const groupId = Number(field.mendGroup ?? 0);
      if (groupId <= 0) {
        return;
      }

      const current = hierarchy.get(groupId) ?? {
        parentGroupId: null,
        displayOrder: Number(field.displayOrder ?? 0) || (index + 1)
      };

      const parentFromField = this.readParentGroupIdFromGroupMetadata(field.group)
        ?? this.readParentGroupIdFromDisplaySettings(field.displaySettingsJson);
      if (!current.parentGroupId && parentFromField && parentFromField !== groupId) {
        current.parentGroupId = parentFromField;
      }

      const fieldDisplayOrder = Number(field.displayOrder ?? 0);
      if (Number.isFinite(fieldDisplayOrder) && fieldDisplayOrder > 0) {
        current.displayOrder = Math.min(current.displayOrder, fieldDisplayOrder);
      }

      hierarchy.set(groupId, current);
    });

    this.enrichHierarchyFromGroupNamePath(hierarchy, definitionGroups, fields);

    hierarchy.forEach((meta, groupId) => {
      if (!Number.isFinite(meta.displayOrder) || meta.displayOrder <= 0) {
        meta.displayOrder = groupId;
      }

      if (!meta.parentGroupId || meta.parentGroupId === groupId || !hierarchy.has(meta.parentGroupId)) {
        meta.parentGroupId = null;
      }
    });

    return hierarchy;
  }

  private enrichHierarchyFromGroupNamePath(
    hierarchy: Map<number, RuntimeGroupHierarchyMeta>,
    definitionGroups: RequestRuntimeFormGroupDefinitionDto[],
    fields: RequestRuntimeFieldDefinitionDto[]
  ): void {
    const knownNameByGroupId = new Map<number, string>();

    definitionGroups.forEach(group => {
      const groupId = Number(group.groupId ?? 0);
      if (groupId <= 0) {
        return;
      }

      const groupName = String(group.groupName ?? '').trim();
      if (groupName.length > 0) {
        knownNameByGroupId.set(groupId, groupName);
      }
    });

    fields.forEach(field => {
      const groupId = Number(field.mendGroup ?? 0);
      if (groupId <= 0 || knownNameByGroupId.has(groupId)) {
        return;
      }

      const groupName = String(field.group?.groupName ?? '').trim();
      if (groupName.length > 0) {
        knownNameByGroupId.set(groupId, groupName);
      }
    });

    const fullNameLookup = new Map<string, number>();
    const segmentLookup = new Map<string, number[]>();

    knownNameByGroupId.forEach((groupName, groupId) => {
      const segments = this.splitGroupPathSegments(groupName);
      const normalizedFullName = this.normalizeGroupPathKey(segments.length > 0 ? segments.join(' / ') : groupName);
      if (normalizedFullName.length > 0 && !fullNameLookup.has(normalizedFullName)) {
        fullNameLookup.set(normalizedFullName, groupId);
      }

      const leafSegment = this.normalizeGroupPathKey(segments.length > 0 ? segments[segments.length - 1] : groupName);
      if (leafSegment.length > 0) {
        const existing = segmentLookup.get(leafSegment) ?? [];
        existing.push(groupId);
        segmentLookup.set(leafSegment, existing);
      }
    });

    hierarchy.forEach((meta, groupId) => {
      if (meta.parentGroupId) {
        return;
      }

      const groupName = knownNameByGroupId.get(groupId);
      if (!groupName) {
        return;
      }

      const segments = this.splitGroupPathSegments(groupName);
      if (segments.length < 2) {
        return;
      }

      const parentPath = this.normalizeGroupPathKey(segments.slice(0, -1).join(' / '));
      const parentLeaf = this.normalizeGroupPathKey(segments[segments.length - 2]);

      const parentFromPath = fullNameLookup.get(parentPath);
      if (parentFromPath && parentFromPath !== groupId) {
        meta.parentGroupId = parentFromPath;
        return;
      }

      const sameLeafCandidates = segmentLookup.get(parentLeaf) ?? [];
      const parentFromLeaf = sameLeafCandidates.find(candidate => candidate !== groupId);
      if (parentFromLeaf && parentFromLeaf !== groupId) {
        meta.parentGroupId = parentFromLeaf;
      }
    });
  }

  private buildSanitizedParentGroupMap(
    groupIds: Set<number>,
    hierarchy: Map<number, RuntimeGroupHierarchyMeta>
  ): Map<number, number | null> {
    const safeParentByGroupId = new Map<number, number | null>();

    groupIds.forEach(groupId => {
      const candidateParent = hierarchy.get(groupId)?.parentGroupId ?? null;
      if (!candidateParent || !groupIds.has(candidateParent) || candidateParent === groupId) {
        safeParentByGroupId.set(groupId, null);
        return;
      }

      const visited = new Set<number>([groupId]);
      let hasCycle = false;
      let cursor: number | null = candidateParent;
      while (cursor && groupIds.has(cursor)) {
        if (visited.has(cursor)) {
          hasCycle = true;
          break;
        }

        visited.add(cursor);
        cursor = hierarchy.get(cursor)?.parentGroupId ?? null;
      }

      safeParentByGroupId.set(groupId, hasCycle ? null : candidateParent);
    });

    return safeParentByGroupId;
  }

  private resolveRuntimeGroupDisplayName(
    groupId: number,
    groupDefinition?: RequestRuntimeFormGroupDefinitionDto,
    fallbackField?: RequestRuntimeFieldDefinitionDto
  ): string {
    const categoryId = Number(this.rawFormDefinition?.categoryId ?? 0);
    const canonicalName = this.getActiveCanonicalGroupHierarchyMap(categoryId).get(groupId)?.groupName;
    const resolvedName = String(canonicalName ?? groupDefinition?.groupName ?? fallbackField?.group?.groupName ?? '').trim();
    if (!resolvedName) {
      return `مجموعة ${groupId}`;
    }

    const segments = this.splitGroupPathSegments(resolvedName);
    return segments.length > 0 ? segments[segments.length - 1] : resolvedName;
  }

  private recomputeGroupTreeFieldCounts(node: RuntimeGroupRenderNode): number {
    const childrenFieldsCount = node.children
      .map(child => this.recomputeGroupTreeFieldCounts(child))
      .reduce((sum, value) => sum + value, 0);

    node.totalVisibleFieldsCount = node.fields.length + childrenFieldsCount;
    return node.totalVisibleFieldsCount;
  }

  private resolveRuntimeGroupDisplayOrder(group: RequestRuntimeFormGroupDefinitionDto | undefined, fallback: number): number {
    const candidate = Number((group as Record<string, unknown> | undefined)?.['displayOrder'] ?? fallback);
    if (!Number.isFinite(candidate) || candidate <= 0) {
      return fallback;
    }

    return Math.trunc(candidate);
  }

  private readParentGroupIdFromGroupMetadata(group: unknown): number | null {
    if (!group || typeof group !== 'object') {
      return null;
    }

    const payload = group as Record<string, unknown>;
    return this.normalizePositiveInt(payload['parentGroupId'])
      ?? this.normalizePositiveInt(payload['parentId'])
      ?? this.normalizePositiveInt(payload['groupParentId'])
      ?? this.normalizePositiveInt(payload['parent_group_id'])
      ?? this.normalizePositiveInt(payload['parentGroupID']);
  }

  private readParentGroupIdFromDisplaySettings(displaySettingsJson?: string): number | null {
    const parsed = this.parseJsonObject(displaySettingsJson);
    if (!parsed) {
      return null;
    }

    const directCandidate = this.normalizePositiveInt(parsed['parentGroupId'])
      ?? this.normalizePositiveInt(parsed['groupParentId'])
      ?? this.normalizePositiveInt(parsed['parentId'])
      ?? this.normalizePositiveInt(parsed['parent_group_id']);
    if (directCandidate) {
      return directCandidate;
    }

    const adminControlCenter = parsed['adminControlCenter'];
    if (adminControlCenter && typeof adminControlCenter === 'object' && !Array.isArray(adminControlCenter)) {
      const adminPayload = adminControlCenter as Record<string, unknown>;
      const nestedCandidate = this.normalizePositiveInt(adminPayload['parentGroupId'])
        ?? this.normalizePositiveInt(adminPayload['groupParentId'])
        ?? this.normalizePositiveInt(adminPayload['parentId']);
      if (nestedCandidate) {
        return nestedCandidate;
      }
    }

    const pathCandidateKeys = ['groupPathIds', 'groupPath', 'hierarchyPath', 'parents'];
    for (const key of pathCandidateKeys) {
      const parentFromPath = this.readParentGroupIdFromPathCandidate(parsed[key]);
      if (parentFromPath) {
        return parentFromPath;
      }
    }

    return null;
  }

  private readParentGroupIdFromPathCandidate(candidate: unknown): number | null {
    if (!Array.isArray(candidate)) {
      return null;
    }

    const resolvedIds = candidate
      .map(item => this.normalizePositiveInt(item))
      .filter((item): item is number => item !== null);
    if (resolvedIds.length < 2) {
      return null;
    }

    return resolvedIds[resolvedIds.length - 2];
  }

  private parseJsonObject(raw: unknown): Record<string, unknown> | null {
    const payload = String(raw ?? '').trim();
    if (!payload) {
      return null;
    }

    try {
      const parsed = JSON.parse(payload);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return null;
      }

      return parsed as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  private splitGroupPathSegments(groupName: string): string[] {
    const normalizedName = String(groupName ?? '').trim();
    if (!normalizedName) {
      return [];
    }

    const unified = normalizedName
      .replace(/\s*::\s*/g, '/')
      .replace(/[>›»\\|]+/g, '/')
      .replace(/\s*\/\s*/g, '/');

    return unified
      .split('/')
      .map(segment => segment.trim())
      .filter(segment => segment.length > 0);
  }

  private normalizeGroupPathKey(value: string): string {
    return String(value ?? '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/\s*\/\s*/g, '/');
  }

  private normalizePositiveInt(value: unknown): number | null {
    const normalized = Number(value ?? 0);
    if (!Number.isFinite(normalized) || normalized <= 0) {
      return null;
    }

    return Math.trunc(normalized);
  }

  private mapFieldTypeToGenericType(fieldType?: string, fieldKey?: string): string {
    const normalized = String(fieldType ?? '').trim().toLowerCase();

    if (String(normalized ?? '').includes('tree')) {
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
    if (normalized.includes('int') || normalized.includes('number')) {
      return 'InputText-integeronly';
    }

    if (String(fieldKey ?? '').trim().toUpperCase() === RequestRuntimeCatalogPageComponent.DIRECTION_FIELD_KEY) {
      return 'Dropdown';
    }

    return 'InputText';
  }

  private mapFieldDataType(field: RequestRuntimeFieldDefinitionDto, cdmendType: string): string {
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

  private normalizeInitialDynamicValue(field: RequestRuntimeFieldDefinitionDto, cdmendType: string, value: unknown): unknown {
    if (value === null || value === undefined || value === '') {
      if (cdmendType === 'ToggleSwitch') {
        return false;
      }

      if (cdmendType === 'Date' || cdmendType === 'DateTime') {
        return null;
      }

      return '';
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
      // fallback to delimited payload parsing
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

  private buildDynamicFieldValues(): RequestRuntimeSubjectFieldValueDto[] {
    return Array.from(this.controlMap.entries()).map(([controlName, key]) => ({
      fieldKey: key.fieldKey,
      value: this.normalizeOutgoingDynamicValue(this.genericFormService.GetControl(this.dynamicControls, controlName)?.value),
      instanceGroupId: key.instanceGroupId
    }));
  }

  private normalizeOutgoingDynamicValue(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }

    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? '' : value.toISOString();
    }

    if (typeof value === 'object' && !Array.isArray(value)) {
      const payload = value as Record<string, unknown>;
      if (payload['key'] != null) {
        return String(payload['key']);
      }
      if (payload['value'] != null) {
        return String(payload['value']);
      }
    }

    return String(value);
  }

  private clearRuntimeWorkspace(): void {
    this.selectedRequestNode = null;
    this.clearLoadedDefinitionState();
    this.availableEnvelopes = [];
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
  }

  private clearLoadedDefinitionState(): void {
    this.rawFormDefinition = null;
    this.formDefinition = null;
    this.allowRequesterOverride = false;
    this.currentDisplayMode = REQUEST_VIEW_MODE_STANDARD;
    this.rootGroupTabIndex = 0;
    this.directionSelectionMode = 'none';
    this.fixedDocumentDirection = null;
    this.lastResolvedDirectionKey = null;

    const directionControl = this.requestForm.get('documentDirection');
    this.suppressDirectionRebuild = true;
    directionControl?.enable({ emitEvent: false });
    directionControl?.setValidators([]);
    directionControl?.updateValueAndValidity({ emitEvent: false });
    directionControl?.patchValue('', { emitEvent: false });
    this.suppressDirectionRebuild = false;

    this.resetDynamicFormState();
  }

  private resetDynamicFormState(): void {
    this.dynamicControls = this.fb.group({});
    this.renderGroupTree = [];
    this.controlMap.clear();

    this.genericFormService.resetDynamicRuntimeState();
    this.genericFormService.cdmendDto = [];
    this.genericFormService.cdCategoryMandDto = [];
  }

  private focusFirstInvalidDynamicControl(): void {
    const host = this.findFirstInvalidDynamicControlElement();
    if (!host) {
      return;
    }

    host.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    host.focus?.();
  }

  private findFirstInvalidDynamicControlElement(): HTMLElement | null {
    const candidates = [
      '.groups-wrap [formcontrolname].ng-invalid',
      '.groups-wrap .ng-invalid [formcontrolname]',
      '.groups-wrap .ng-invalid'
    ];

    for (const selector of candidates) {
      const element = document.querySelector(selector) as HTMLElement | null;
      if (element) {
        return element;
      }
    }

    return null;
  }

  private captureWorkspaceSnapshot(): RuntimeWorkspaceSnapshot {
    return {
      subject: String(this.requestForm.get('subject')?.value ?? ''),
      description: String(this.requestForm.get('description')?.value ?? ''),
      documentDirection: String(this.requestForm.get('documentDirection')?.value ?? ''),
      envelopeId: Number(this.requestForm.get('envelopeId')?.value ?? 0) > 0
        ? Number(this.requestForm.get('envelopeId')?.value)
        : null,
      dynamicValues: this.buildDynamicFieldValues()
    };
  }

  private createEmptySnapshot(): RuntimeWorkspaceSnapshot {
    return {
      subject: '',
      description: '',
      documentDirection: '',
      envelopeId: null,
      dynamicValues: []
    };
  }

  private setExpandedState(nodes: RequestRuntimeTreeNode[], expanded: boolean): void {
    (nodes ?? []).forEach(node => {
      node.expanded = expanded;
      this.setExpandedState((node.children ?? []) as RequestRuntimeTreeNode[], expanded);
    });
  }

  private normalizeDirectionValue(value: unknown): string | null {
    const normalized = String(value ?? '').trim().toLowerCase();
    if (normalized === 'incoming' || normalized === 'وارد' || normalized === '2') {
      return 'incoming';
    }

    if (normalized === 'outgoing' || normalized === 'صادر' || normalized === '1') {
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
