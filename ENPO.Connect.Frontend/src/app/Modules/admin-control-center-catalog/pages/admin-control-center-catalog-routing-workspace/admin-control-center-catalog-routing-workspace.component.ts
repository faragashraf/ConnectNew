import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { TreeNode } from 'primeng/api';
import { CommonResponse } from 'src/app/shared/services/BackendServices/DynamicSubjects/DynamicSubjects.dto';
import { DynamicSubjectsAdminRoutingController } from 'src/app/shared/services/BackendServices/DynamicSubjectsAdminRouting/DynamicSubjectsAdminRouting.service';
import {
  RequestAvailabilityMode,
  RoutingAudienceResolutionMode,
  RoutingDirectionMode,
  RoutingSelectedNodeType,
  RoutingStepType,
  RoutingTargetMode,
  RoutingWorkDistributionMode,
  SubjectRoutingPreviewEdgeDto,
  SubjectRoutingPreviewNodeDto,
  SubjectRoutingOrgPositionLookupDto,
  SubjectRoutingOrgTreeNodeDto,
  SubjectRoutingOrgUnitLookupDto,
  SubjectRoutingOrgUnitTypeLookupDto,
  SubjectRoutingOrgUserLookupDto,
  SubjectRoutingPreviewDto,
  SubjectRoutingProfileDto,
  SubjectRoutingProfileUpsertRequestDto,
  SubjectRoutingProfileWorkspaceDto,
  SubjectRoutingStepDto,
  SubjectRoutingStepUpsertRequestDto,
  SubjectRoutingTargetDto,
  SubjectRoutingTargetUpsertRequestDto,
  SubjectRoutingTransitionDto,
  SubjectRoutingTransitionUpsertRequestDto,
  SubjectRoutingValidationResultDto,
  SubjectAvailabilityNodeValidationRequestDto,
  SubjectAvailabilityNodeValidationResultDto,
  SubjectTypeRequestAvailabilityDto,
  SubjectTypeRequestAvailabilityUpsertRequestDto,
  SubjectTypeRoutingBindingDto,
  SubjectTypeRoutingBindingUpsertRequestDto
} from 'src/app/shared/services/BackendServices/DynamicSubjectsAdminRouting/DynamicSubjectsAdminRouting.dto';

type MessageSeverity = 'success' | 'warn' | 'error';
type RoutingSectionKey = 'availability' | 'basic' | 'steps' | 'targets' | 'transitions' | 'visual' | 'validation';
type SelectOption<T = string | number | null> = { label: string; value: T };
type PreviewPanelModel = {
  profileSummary: string;
  totalSteps: number;
  totalTransitions: number;
  targetCoveragePercent: number;
  validationErrors: number;
  validationWarnings: number;
  startStepName: string;
  firstTargetSummary: string;
  firstActions: string[];
  endSteps: string[];
  rejectSteps: string[];
  returnSteps: string[];
  escalationSteps: string[];
};
type PreviewGraphNode = {
  stepId: number;
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  subtitle: string;
  stepType: string;
  isStart: boolean;
  isEnd: boolean;
  isRejectStep: boolean;
  isReturnStep: boolean;
  isEscalationStep: boolean;
  badges: Array<{ label: string; cssClass: string }>;
  cssClass: string;
};
type PreviewGraphEdge = {
  transitionId: number;
  fromStepId: number;
  toStepId: number;
  actionNameAr: string;
  path: string;
  labelX: number;
  labelY: number;
  cssClass: string;
  flagLabel: string;
};
type TargetNodeResolution = {
  selectedNodeType: RoutingSelectedNodeType;
  selectedNodeNumericId: number | null;
  selectedNodeUserId: string | null;
  audienceResolutionMode: RoutingAudienceResolutionMode;
  workDistributionMode: RoutingWorkDistributionMode;
};
type TargetTreeNodeData = {
  nodeType: RoutingSelectedNodeType | string;
  nodeNumericId: number | null;
  nodeUserId: string | null;
  labelAr: string;
  secondaryLabelAr: string | null;
  parentNodeType: RoutingSelectedNodeType | string | null;
  parentNodeNumericId: number | null;
  parentNodeUserId: string | null;
  isSelectable: boolean;
  hasChildren: boolean;
  isActive: boolean;
  childrenLoaded: boolean;
};
type AvailabilityTreeNodeData = {
  nodeType: RoutingSelectedNodeType | string;
  nodeNumericId: number | null;
  nodeUserId: string | null;
  labelAr: string;
  secondaryLabelAr: string | null;
  parentNodeType: RoutingSelectedNodeType | string | null;
  parentNodeNumericId: number | null;
  parentNodeUserId: string | null;
  isSelectable: boolean;
  hasChildren: boolean;
  isActive: boolean;
  childrenLoaded: boolean;
};

@Component({
  selector: 'app-admin-control-center-catalog-routing-workspace',
  templateUrl: './admin-control-center-catalog-routing-workspace.component.html',
  styleUrls: ['./admin-control-center-catalog-routing-workspace.component.scss']
})
export class AdminControlCenterCatalogRoutingWorkspaceComponent implements OnInit, OnChanges {
  @Input() requestTypeId: number | null = null;
  @Input() requestTypeLabel = '';
  @Output() completionPercentChange = new EventEmitter<number>();

  readonly directionModeOptions: SelectOption<RoutingDirectionMode>[] = [
    { label: 'بدون اتجاه', value: 'None' },
    { label: 'وارد فقط', value: 'InboundOnly' },
    { label: 'صادر فقط', value: 'OutboundOnly' },
    { label: 'وارد وصادر', value: 'Both' }
  ];

  readonly stepTypeOptions: SelectOption<RoutingStepType>[] = [
    { label: 'Start - بداية', value: 'Start' },
    { label: 'Review - مراجعة', value: 'Review' },
    { label: 'Approval - اعتماد', value: 'Approval' },
    { label: 'Assignment - إحالة', value: 'Assignment' },
    { label: 'Completion - إنهاء', value: 'Completion' },
    { label: 'Return - إعادة', value: 'Return' },
    { label: 'Rejection - رفض', value: 'Rejection' },
    { label: 'Escalation - تصعيد', value: 'Escalation' }
  ];

  readonly targetModeOptions: SelectOption<RoutingTargetMode>[] = [
    { label: 'UnitType - نوع وحدة', value: 'UnitType' },
    { label: 'SpecificUnit - وحدة محددة', value: 'SpecificUnit' },
    { label: 'UnitLeader - قائد الوحدة', value: 'UnitLeader' },
    { label: 'Position - منصب', value: 'Position' },
    { label: 'CommitteeMembers - أعضاء لجنة', value: 'CommitteeMembers' },
    { label: 'ParentUnitLeader - قائد الوحدة الأب', value: 'ParentUnitLeader' },
    { label: 'ChildUnitByType - وحدة فرعية حسب النوع', value: 'ChildUnitByType' }
  ];

  readonly orgUnitAudienceOptions: SelectOption<RoutingAudienceResolutionMode>[] = [
    { label: 'جميع أعضاء الوحدة', value: 'OrgUnitAllMembers' },
    { label: 'قائد الوحدة فقط', value: 'OrgUnitLeaderOnly' }
  ];

  readonly workDistributionOptions: SelectOption<RoutingWorkDistributionMode>[] = [
    { label: 'عرض مشترك للجميع', value: 'SharedInbox' },
    { label: 'توزيع تلقائي على عضو نشط', value: 'AutoDistributeActive' },
    { label: 'تحويل يدوي لأعضاء الفريق', value: 'ManualAssignment' }
  ];

  readonly availabilityModeOptions: SelectOption<RequestAvailabilityMode>[] = [
    { label: 'عام', value: 'Public' },
    { label: 'محدد', value: 'Restricted' }
  ];

  readonly sectionMenu: Array<{ key: RoutingSectionKey; label: string; mandatory: boolean }> = [
    { key: 'availability', label: '1) إتاحة الطلب', mandatory: true },
    { key: 'basic', label: '2) البيانات الأساسية', mandatory: true },
    { key: 'steps', label: '3) الخطوات', mandatory: true },
    { key: 'targets', label: '4) الجهات المستهدفة', mandatory: true },
    { key: 'transitions', label: '5) الانتقالات والإجراءات', mandatory: true },
    { key: 'visual', label: '6) المخطط المرئي', mandatory: true },
    { key: 'validation', label: '7) المعاينة والتحقق', mandatory: true }
  ];

  readonly availabilityForm: FormGroup = this.fb.group({
    availabilityMode: ['Public', [Validators.required]],
    selectedNodeType: [null],
    selectedNodeNumericId: [null],
    selectedNodeUserId: ['', [Validators.maxLength(20)]]
  });

  readonly basicForm: FormGroup = this.fb.group({
    nameAr: ['', [Validators.required, Validators.maxLength(200)]],
    descriptionAr: ['', [Validators.maxLength(2000)]],
    directionMode: ['Both', [Validators.required]],
    versionNo: [1, [Validators.required, Validators.min(1)]],
    startStepId: [null],
    profileIsActive: [true],
    routingEnabled: [false],
    isDefault: [true],
    appliesToInbound: [true],
    appliesToOutbound: [true]
  });

  readonly stepForm: FormGroup = this.fb.group({
    stepCode: ['', [Validators.required, Validators.maxLength(50)]],
    stepNameAr: ['', [Validators.required, Validators.maxLength(200)]],
    stepType: ['Review', [Validators.required]],
    stepOrder: [1, [Validators.required, Validators.min(0)]],
    isStart: [false],
    isEnd: [false],
    slaHours: [null],
    isActive: [true],
    notesAr: ['', [Validators.maxLength(1000)]]
  });

  readonly targetForm: FormGroup = this.fb.group({
    routingStepId: [null, [Validators.required]],
    targetMode: ['SpecificUnit', [Validators.required]],
    oracleUnitTypeId: [null],
    oracleOrgUnitId: [null],
    positionId: [null],
    positionCode: ['', [Validators.maxLength(64)]],
    selectedNodeType: [null],
    selectedNodeNumericId: [null],
    selectedNodeUserId: ['', [Validators.maxLength(20)]],
    audienceResolutionMode: [null],
    workDistributionMode: ['SharedInbox', [Validators.required]],
    allowMultipleReceivers: [false],
    sendToLeaderOnly: [false],
    isActive: [true],
    notesAr: ['', [Validators.maxLength(1000)]]
  });

  readonly transitionForm: FormGroup = this.fb.group({
    fromStepId: [null, [Validators.required]],
    toStepId: [null, [Validators.required]],
    actionCode: ['', [Validators.required, Validators.maxLength(50)]],
    actionNameAr: ['', [Validators.required, Validators.maxLength(200)]],
    displayOrder: [1, [Validators.required, Validators.min(0)]],
    requiresComment: [false],
    requiresMandatoryFieldsCompletion: [false],
    isRejectPath: [false],
    isReturnPath: [false],
    isEscalationPath: [false],
    conditionExpression: ['', [Validators.maxLength(2000)]],
    isActive: [true]
  });

  activeSection: RoutingSectionKey = 'availability';

  availability: SubjectTypeRequestAvailabilityDto | null = null;
  loadingAvailability = false;
  savingAvailability = false;
  validatingAvailabilityNode = false;

  availabilityTreeDialogVisible = false;
  availabilityTreeNodes: TreeNode[] = [];
  availabilityTreeSelection: TreeNode | null = null;
  availabilityTreeSearchTerm = '';
  availabilityTreeIncludeUsers = true;
  availabilityTreeLoading = false;
  availabilityTreeLoadError = '';
  availabilityTreeLoadedOnce = false;

  selectedAvailabilityNodeLabelAr = '';
  selectedAvailabilityNodeSecondaryLabelAr = '';
  selectedAvailabilityNodePathAr = '';
  availabilitySummaryAr = 'متاح لجميع المستخدمين المسجلين.';
  availabilityNodeValidationError = '';

  profiles: SubjectRoutingProfileDto[] = [];
  selectedProfileId: number | null = null;
  profileWorkspace: SubjectRoutingProfileWorkspaceDto | null = null;
  binding: SubjectTypeRoutingBindingDto | null = null;

  steps: SubjectRoutingStepDto[] = [];
  targets: SubjectRoutingTargetDto[] = [];
  transitions: SubjectRoutingTransitionDto[] = [];

  unitTypes: SubjectRoutingOrgUnitTypeLookupDto[] = [];
  units: SubjectRoutingOrgUnitLookupDto[] = [];
  positions: SubjectRoutingOrgPositionLookupDto[] = [];
  users: SubjectRoutingOrgUserLookupDto[] = [];

  filteredTargetStepId: number | null = null;

  editingStepId: number | null = null;
  editingTargetId: number | null = null;
  editingTransitionId: number | null = null;

  loadingContext = false;
  loadingLookups = false;
  loadingUnits = false;
  loadingPositions = false;
  loadingPreview = false;
  loadingValidation = false;

  savingBasic = false;
  savingStep = false;
  savingTarget = false;
  savingTransition = false;

  deletingStepId: number | null = null;
  deletingTargetId: number | null = null;
  deletingTransitionId: number | null = null;

  preview: SubjectRoutingPreviewDto | null = null;
  validationResult: SubjectRoutingValidationResultDto | null = null;
  previewPanel: PreviewPanelModel | null = null;
  previewGraphNodes: PreviewGraphNode[] = [];
  previewGraphEdges: PreviewGraphEdge[] = [];
  previewGraphWidth = 980;
  previewGraphHeight = 380;
  selectedPreviewStepId: number | null = null;
  selectedPreviewTransitionId: number | null = null;

  message = '';
  messageSeverity: MessageSeverity = 'success';

  targetTreeDialogVisible = false;
  targetTreeNodes: TreeNode[] = [];
  targetTreeSelection: TreeNode | null = null;
  targetTreeSearchTerm = '';
  targetTreeIncludeUsers = true;
  targetTreeLoading = false;
  targetTreeLoadError = '';
  targetTreeLoadedOnce = false;
  selectedTargetNodeLabelAr = '';
  selectedTargetNodeSecondaryLabelAr = '';

  private lookupsLoaded = false;

  constructor(
    private readonly fb: FormBuilder,
    private readonly routingController: DynamicSubjectsAdminRoutingController
  ) {}

  ngOnInit(): void {
    this.availabilityForm.get('availabilityMode')?.valueChanges.subscribe(() => this.onAvailabilityModeChanged());
    this.basicForm.get('appliesToInbound')?.valueChanges.subscribe(() => this.emitCompletionProgress());
    this.basicForm.get('appliesToOutbound')?.valueChanges.subscribe(() => this.emitCompletionProgress());
    this.targetForm.get('selectedNodeType')?.valueChanges.subscribe(() => this.onSelectedNodeTypeChanged());
    this.targetForm.get('audienceResolutionMode')?.valueChanges.subscribe(() => this.ensureWorkDistributionCompatibility());
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['requestTypeId']) {
      this.reloadRequestTypeContext();
    }
  }

  get requestTypeContextLabel(): string {
    const normalizedLabel = this.normalizeText(this.requestTypeLabel);
    if (normalizedLabel) {
      return normalizedLabel;
    }

    return this.requestTypeId ? `#${this.requestTypeId}` : 'غير محدد';
  }

  get profileOptions(): SelectOption<number | null>[] {
    const options: SelectOption<number | null>[] = [
      { label: 'مسار جديد', value: null }
    ];

    for (const profile of this.profiles) {
      options.push({
        label: `${profile.nameAr} (v${profile.versionNo})${profile.isActive ? '' : ' - غير مفعل'}`,
        value: profile.id
      });
    }

    return options;
  }

  get startStepOptions(): SelectOption<number | null>[] {
    return [
      { label: 'تحديد تلقائي', value: null },
      ...this.steps.map(step => ({
        label: `${step.stepNameAr} (${step.stepCode})`,
        value: step.id
      }))
    ];
  }

  get stepOptions(): SelectOption<number>[] {
    return this.steps.map(step => ({
      label: `${step.stepNameAr} (${step.stepCode})`,
      value: step.id
    }));
  }

  get unitTypeOptions(): SelectOption<number | null>[] {
    return [
      { label: 'اختر نوع الوحدة', value: null },
      ...this.unitTypes.map(item => ({
        label: item.typeName,
        value: item.unitTypeId
      }))
    ];
  }

  get unitOptions(): SelectOption<number | null>[] {
    return [
      { label: 'اختر الوحدة', value: null },
      ...this.units.map(item => ({
        label: `${item.unitName} (#${item.unitId})`,
        value: item.unitId
      }))
    ];
  }

  get positionOptions(): SelectOption<number | null>[] {
    return [
      { label: 'اختر المنصب', value: null },
      ...this.positions.map(item => ({
        label: `${item.userId} - ${item.unitName} (#${item.positionId})`,
        value: item.positionId
      }))
    ];
  }

  get committeeUserOptions(): SelectOption<string | null>[] {
    return [
      { label: 'اختر المستخدم', value: null },
      ...this.users.map(item => ({
        label: `${item.userId} (${item.activePositionsCount} منصب نشط)`,
        value: item.userId
      }))
    ];
  }

  get targetStepFilterOptions(): SelectOption<number | null>[] {
    return [
      { label: 'كل الخطوات', value: null },
      ...this.stepOptions
    ];
  }

  get canManageWorkspace(): boolean {
    return this.requestTypeId != null && this.requestTypeId > 0;
  }

  get normalizedAvailabilityMode(): RequestAvailabilityMode {
    return this.normalizeAvailabilityMode(this.availabilityForm.get('availabilityMode')?.value);
  }

  get isAvailabilityPublic(): boolean {
    return this.normalizedAvailabilityMode === 'Public';
  }

  get isAvailabilityRestricted(): boolean {
    return this.normalizedAvailabilityMode === 'Restricted';
  }

  get selectedAvailabilityNodeType(): RoutingSelectedNodeType | null {
    return this.normalizeSelectedNodeType(this.availabilityForm.get('selectedNodeType')?.value);
  }

  get hasSelectedAvailabilityNode(): boolean {
    if (!this.isAvailabilityRestricted) {
      return false;
    }

    const nodeType = this.selectedAvailabilityNodeType;
    if (nodeType == null) {
      return false;
    }

    if (nodeType === 'SpecificUser') {
      return this.normalizeText(this.availabilityForm.get('selectedNodeUserId')?.value) != null;
    }

    return this.toNullableNumber(this.availabilityForm.get('selectedNodeNumericId')?.value) != null;
  }

  get selectedAvailabilityNodeTypeLabelAr(): string {
    const nodeType = this.selectedAvailabilityNodeType;
    if (nodeType === 'OrgUnit') {
      return 'وحدة تنظيمية';
    }

    if (nodeType === 'Position') {
      return 'وظيفة / منصب';
    }

    if (nodeType === 'SpecificUser') {
      return 'مستخدم محدد';
    }

    return 'غير محدد';
  }

  get resolvedAvailabilityDescriptionAr(): string {
    if (this.isAvailabilityPublic) {
      return 'متاح لجميع المستخدمين المسجلين';
    }

    const nodeType = this.selectedAvailabilityNodeType;
    if (nodeType === 'OrgUnit') {
      return 'متاح لأعضاء الوحدة المحددة';
    }

    if (nodeType === 'Position') {
      return 'متاح لحاملي الوظيفة المحددة';
    }

    if (nodeType === 'SpecificUser') {
      return 'متاح للمستخدم المحدد';
    }

    return 'متاح لفئة محددة وفق العقدة التنظيمية المختارة';
  }

  get canSaveAvailability(): boolean {
    if (!this.canManageWorkspace || this.loadingContext || this.loadingAvailability || this.savingAvailability || this.validatingAvailabilityNode) {
      return false;
    }

    if (this.normalizedAvailabilityMode === 'Public') {
      return true;
    }

    if (!this.hasSelectedAvailabilityNode) {
      return false;
    }

    return this.availabilityNodeValidationError.length === 0;
  }

  get canSaveBasic(): boolean {
    if (!this.canManageWorkspace || this.savingBasic || this.loadingContext) {
      return false;
    }

    const inbound = this.basicForm.get('appliesToInbound')?.value === true;
    const outbound = this.basicForm.get('appliesToOutbound')?.value === true;
    return this.basicForm.valid && (inbound || outbound);
  }

  get canSaveStep(): boolean {
    return this.selectedProfileId != null
      && this.stepForm.valid
      && !this.savingStep
      && !this.hasConflictingStartStep;
  }

  get canSaveTarget(): boolean {
    if (this.selectedProfileId == null || this.savingTarget || !this.targetForm.valid) {
      return false;
    }

    const selectedNodeType = this.normalizeSelectedNodeType(this.targetForm.get('selectedNodeType')?.value);
    if (selectedNodeType == null) {
      return false;
    }

    const selectedNodeNumericId = this.toNullableNumber(this.targetForm.get('selectedNodeNumericId')?.value);
    const selectedNodeUserId = this.normalizeText(this.targetForm.get('selectedNodeUserId')?.value);
    if ((selectedNodeType === 'OrgUnit' || selectedNodeType === 'Position') && selectedNodeNumericId == null) {
      return false;
    }

    if (selectedNodeType === 'SpecificUser' && selectedNodeUserId == null) {
      return false;
    }

    const audienceMode = this.normalizeAudienceResolutionMode(this.targetForm.get('audienceResolutionMode')?.value);
    if (selectedNodeType === 'OrgUnit') {
      if (audienceMode !== 'OrgUnitAllMembers' && audienceMode !== 'OrgUnitLeaderOnly') {
        return false;
      }
    } else if (selectedNodeType === 'Position') {
      if (audienceMode !== 'PositionOccupants') {
        return false;
      }
    } else if (audienceMode !== 'SpecificUserOnly') {
      return false;
    }

    const workDistributionMode = this.normalizeWorkDistributionMode(this.targetForm.get('workDistributionMode')?.value);
    if (workDistributionMode == null) {
      return false;
    }

    if (this.isSingleRecipientAudience(audienceMode) && workDistributionMode !== 'SharedInbox') {
      return false;
    }

    return true;
  }

  get selectedTargetNodeType(): RoutingSelectedNodeType | null {
    return this.normalizeSelectedNodeType(this.targetForm.get('selectedNodeType')?.value);
  }

  get hasSelectedTargetNode(): boolean {
    const selectedNodeType = this.selectedTargetNodeType;
    if (selectedNodeType == null) {
      return false;
    }

    if (selectedNodeType === 'SpecificUser') {
      return this.normalizeText(this.targetForm.get('selectedNodeUserId')?.value) != null;
    }

    return this.toNullableNumber(this.targetForm.get('selectedNodeNumericId')?.value) != null;
  }

  get selectedTargetNodeTypeLabelAr(): string {
    const selectedNodeType = this.selectedTargetNodeType;
    if (selectedNodeType === 'OrgUnit') {
      return 'وحدة تنظيمية';
    }

    if (selectedNodeType === 'Position') {
      return 'منصب / وظيفة';
    }

    if (selectedNodeType === 'SpecificUser') {
      return 'مستخدم محدد';
    }

    return 'غير محدد';
  }

  get selectedTargetAudienceLabelAr(): string {
    return this.getAudienceLabel(this.normalizeAudienceResolutionMode(this.targetForm.get('audienceResolutionMode')?.value));
  }

  get selectedTargetDistributionLabelAr(): string {
    return this.getWorkDistributionLabel(this.normalizeWorkDistributionMode(this.targetForm.get('workDistributionMode')?.value));
  }

  get canSaveTransition(): boolean {
    if (this.selectedProfileId == null || this.savingTransition || !this.transitionForm.valid) {
      return false;
    }

    const fromStepId = this.toNullableNumber(this.transitionForm.get('fromStepId')?.value);
    const toStepId = this.toNullableNumber(this.transitionForm.get('toStepId')?.value);
    return fromStepId != null && toStepId != null && fromStepId !== toStepId;
  }

  get normalizedTargetMode(): RoutingTargetMode | string {
    const value = this.normalizeText(this.targetForm.get('targetMode')?.value);
    return value ?? 'UnitType';
  }

  get filteredTargets(): SubjectRoutingTargetDto[] {
    if (!this.filteredTargetStepId) {
      return this.targets;
    }

    return this.targets.filter(item => item.routingStepId === this.filteredTargetStepId);
  }

  get mandatoryCompletionPercent(): number {
    const checkpoints = [
      this.normalizedAvailabilityMode === 'Public' || (this.hasSelectedAvailabilityNode && this.availabilityNodeValidationError.length === 0),
      this.selectedProfileId != null && this.binding != null,
      this.steps.length > 0,
      this.targets.length > 0 && this.steps.every(step => this.targets.some(target => target.routingStepId === step.id)),
      this.transitions.length > 0,
      this.preview != null && this.previewGraphNodes.length > 0,
      this.validationResult != null
    ];

    const passed = checkpoints.filter(Boolean).length;
    return Math.round((passed / checkpoints.length) * 100);
  }

  get optionalCompletionPercent(): number {
    const checkpoints = [
      this.previewGraphEdges.length > 0,
      this.previewPanel != null
    ];

    const passed = checkpoints.filter(Boolean).length;
    return Math.round((passed / checkpoints.length) * 100);
  }

  get overallCompletionPercent(): number {
    return Math.round((this.mandatoryCompletionPercent * 0.85) + (this.optionalCompletionPercent * 0.15));
  }

  get hasConflictingStartStep(): boolean {
    const wantsStart = this.stepForm.get('isStart')?.value === true;
    if (!wantsStart) {
      return false;
    }

    const existingStart = this.steps.find(item => item.isStart);
    if (!existingStart) {
      return false;
    }

    return this.editingStepId == null || existingStart.id !== this.editingStepId;
  }

  get hasPreviewGraph(): boolean {
    return this.previewGraphNodes.length > 0;
  }

  get previewIncompleteMessages(): string[] {
    if (!this.preview) {
      return [];
    }

    const messages: string[] = [];
    if (this.preview.nodes.length === 0) {
      messages.push('لا توجد خطوات بعد، أضف الخطوات أولًا لبناء المخطط.');
    }

    const hasStart = this.preview.nodes.some(item => item.isStart) || this.preview.startStepId != null;
    if (!hasStart) {
      messages.push('المسار لا يحتوي على خطوة بداية واضحة.');
    }

    if (!this.preview.nodes.some(item => item.isEnd)) {
      messages.push('المسار لا يحتوي على خطوة نهاية.');
    }

    if (this.preview.edges.length === 0) {
      messages.push('لا توجد انتقالات معرفة بين الخطوات.');
    }

    return messages;
  }

  onSwitchSection(sectionKey: RoutingSectionKey): void {
    this.activeSection = sectionKey;
    if (sectionKey === 'visual' && this.preview == null && this.selectedProfileId) {
      this.onRefreshPreview();
    }

    if (sectionKey === 'validation' && this.validationResult == null && this.selectedProfileId) {
      this.onValidateProfile();
    }
  }

  onOpenAvailabilityTreeDialog(): void {
    if (!this.requestTypeId) {
      this.showMessage('warn', 'اختر نوع الطلب أولًا قبل فتح الشجرة التنظيمية.');
      return;
    }

    this.availabilityTreeDialogVisible = true;
    if (!this.availabilityTreeLoadedOnce) {
      this.loadAvailabilityTreeRoots();
    }
  }

  onSearchAvailabilityTree(): void {
    this.loadAvailabilityTreeRoots(this.normalizeText(this.availabilityTreeSearchTerm) ?? undefined);
  }

  onResetAvailabilityTreeSearch(): void {
    this.availabilityTreeSearchTerm = '';
    this.loadAvailabilityTreeRoots();
  }

  onToggleAvailabilityTreeIncludeUsers(): void {
    this.loadAvailabilityTreeRoots(this.normalizeText(this.availabilityTreeSearchTerm) ?? undefined);
  }

  onAvailabilityTreeNodeExpand(event: { node?: TreeNode }): void {
    const node = event?.node ?? null;
    if (!node) {
      return;
    }

    const nodeData = this.extractAvailabilityTreeNodeData(node);
    if (!nodeData || !nodeData.hasChildren || nodeData.childrenLoaded) {
      return;
    }

    this.loadAvailabilityTreeChildren(node);
  }

  onAvailabilityTreeNodeSelect(event: { node?: TreeNode }): void {
    const node = event?.node ?? null;
    if (!node) {
      return;
    }

    const nodeData = this.extractAvailabilityTreeNodeData(node);
    if (!nodeData || !nodeData.isSelectable) {
      this.showMessage('warn', 'العقدة المختارة غير قابلة للاستخدام في إتاحة الطلب.');
      return;
    }

    this.applyAvailabilityTreeSelection(nodeData);
    this.availabilityTreeDialogVisible = false;
  }

  onClearAvailabilityNodeSelection(): void {
    this.availabilityForm.patchValue(
      {
        selectedNodeType: null,
        selectedNodeNumericId: null,
        selectedNodeUserId: ''
      },
      { emitEvent: false }
    );

    this.selectedAvailabilityNodeLabelAr = '';
    this.selectedAvailabilityNodeSecondaryLabelAr = '';
    this.selectedAvailabilityNodePathAr = '';
    this.availabilitySummaryAr = this.resolveAvailabilitySummaryAr(this.normalizedAvailabilityMode, null);
    this.availabilityNodeValidationError = '';
    this.availabilityTreeSelection = null;
    this.emitCompletionProgress();
  }

  onSaveAvailability(): void {
    if (!this.requestTypeId) {
      this.showMessage('warn', 'نوع الطلب غير محدد.');
      return;
    }

    if (!this.canSaveAvailability) {
      this.showMessage('warn', 'أكمل إعدادات إتاحة الطلب قبل الحفظ.');
      return;
    }

    const availabilityMode = this.normalizedAvailabilityMode;
    const selectedNodeType = availabilityMode === 'Restricted'
      ? this.selectedAvailabilityNodeType
      : null;
    const selectedNodeNumericId = availabilityMode === 'Restricted' && selectedNodeType !== 'SpecificUser'
      ? this.toNullableNumber(this.availabilityForm.get('selectedNodeNumericId')?.value)
      : null;
    const selectedNodeUserId = availabilityMode === 'Restricted' && selectedNodeType === 'SpecificUser'
      ? this.normalizeText(this.availabilityForm.get('selectedNodeUserId')?.value)
      : null;

    if (availabilityMode === 'Restricted' && selectedNodeType == null) {
      this.showMessage('warn', 'عند اختيار الإتاحة المحددة يجب تحديد عقدة من الشجرة التنظيمية.');
      return;
    }

    if (availabilityMode === 'Restricted' && !this.hasSelectedAvailabilityNode) {
      this.showMessage('warn', 'أكمل اختيار العقدة المحددة قبل الحفظ.');
      return;
    }

    const request: SubjectTypeRequestAvailabilityUpsertRequestDto = {
      availabilityMode,
      selectedNodeType: availabilityMode === 'Restricted' ? selectedNodeType ?? undefined : undefined,
      selectedNodeNumericId: availabilityMode === 'Restricted' && selectedNodeType !== 'SpecificUser'
        ? (selectedNodeNumericId ?? undefined)
        : undefined,
      selectedNodeUserId: availabilityMode === 'Restricted' && selectedNodeType === 'SpecificUser'
        ? (selectedNodeUserId ?? undefined)
        : undefined
    };

    this.savingAvailability = true;
    this.routingController.upsertRequestAvailability(this.requestTypeId, request).subscribe({
      next: response => {
        if (!this.ensureSuccess(response, 'تعذر حفظ إعدادات إتاحة الطلب.')) {
          return;
        }

        const dto = response.data;
        this.applyAvailabilityDto(dto ?? this.buildDefaultAvailability(this.requestTypeId!));
        this.showMessage('success', 'تم حفظ إعدادات إتاحة الطلب بنجاح.');
      },
      error: () => this.showMessage('error', 'حدث خطأ أثناء حفظ إعدادات إتاحة الطلب.'),
      complete: () => { this.savingAvailability = false; }
    });
  }

  onSelectProfile(profileId: number | null): void {
    if (profileId == null) {
      this.selectedProfileId = null;
      this.profileWorkspace = null;
      this.binding = null;
      this.steps = [];
      this.targets = [];
      this.transitions = [];
      this.resetPreviewState();
      this.editingStepId = null;
      this.editingTargetId = null;
      this.editingTransitionId = null;
      this.prepareBasicForNewProfile();
      this.prepareStepForCreate();
      this.prepareTargetForCreate();
      this.prepareTransitionForCreate();
      this.emitCompletionProgress();
      return;
    }

    this.loadProfileWorkspace(profileId);
  }

  onStartCreateProfile(): void {
    this.onSelectProfile(null);
    this.showMessage('success', 'يمكنك الآن إنشاء RoutingProfile جديد لنوع الطلب المحدد.');
  }

  onSaveBasic(): void {
    this.basicForm.markAllAsTouched();
    if (!this.canSaveBasic || !this.requestTypeId) {
      if (!this.canSaveBasic) {
        this.showMessage('warn', 'أكمل الحقول الإلزامية في البيانات الأساسية قبل الحفظ.');
      }
      return;
    }

    const request: SubjectRoutingProfileUpsertRequestDto = {
      subjectTypeId: this.requestTypeId,
      nameAr: this.normalizeText(this.basicForm.get('nameAr')?.value) ?? '',
      descriptionAr: this.normalizeText(this.basicForm.get('descriptionAr')?.value) ?? undefined,
      isActive: this.basicForm.get('profileIsActive')?.value === true,
      directionMode: this.normalizeDirectionMode(this.basicForm.get('directionMode')?.value),
      startStepId: this.toNullableNumber(this.basicForm.get('startStepId')?.value) ?? undefined,
      versionNo: Math.max(1, this.toNullableNumber(this.basicForm.get('versionNo')?.value) ?? 1)
    };

    this.savingBasic = true;
    const saveProfile$ = this.selectedProfileId
      ? this.routingController.updateProfile(this.selectedProfileId, request)
      : this.routingController.createProfile(request);

    saveProfile$.subscribe({
      next: response => {
        if (!this.ensureSuccess(response, 'تعذر حفظ البيانات الأساسية للمسار.')) {
          return;
        }

        const profile = response.data;
        if (!profile) {
          this.showMessage('error', 'تعذر قراءة ملف المسار بعد الحفظ.');
          this.savingBasic = false;
          return;
        }

        this.bindProfileWithValidationGuard(profile);
      },
      error: () => {
        this.showMessage('error', 'حدث خطأ أثناء حفظ البيانات الأساسية للمسار.');
        this.savingBasic = false;
      }
    });
  }

  onStartCreateStep(): void {
    this.prepareStepForCreate();
  }

  onEditStep(step: SubjectRoutingStepDto): void {
    this.editingStepId = step.id;
    this.stepForm.reset(
      {
        stepCode: step.stepCode,
        stepNameAr: step.stepNameAr,
        stepType: step.stepType,
        stepOrder: step.stepOrder,
        isStart: step.isStart,
        isEnd: step.isEnd,
        slaHours: step.slaHours ?? null,
        isActive: step.isActive,
        notesAr: step.notesAr ?? ''
      },
      { emitEvent: false }
    );
  }

  onDeleteStep(step: SubjectRoutingStepDto): void {
    if (this.deletingStepId || !window.confirm(`سيتم حذف الخطوة '${step.stepNameAr}'. هل تريد المتابعة؟`)) {
      return;
    }

    this.deletingStepId = step.id;
    this.routingController.deleteStep(step.id).subscribe({
      next: response => {
        if (!this.ensureSuccess(response, 'تعذر حذف الخطوة.')) {
          return;
        }

        this.showMessage('success', 'تم حذف الخطوة بنجاح.');
        this.prepareStepForCreate();
        this.reloadCurrentWorkspace();
      },
      error: () => this.showMessage('error', 'حدث خطأ أثناء حذف الخطوة.'),
      complete: () => { this.deletingStepId = null; }
    });
  }

  onSaveStep(): void {
    this.stepForm.markAllAsTouched();
    if (this.hasConflictingStartStep) {
      this.showMessage('warn', 'لا يمكن تعيين خطوة بداية جديدة لأن هناك خطوة بداية أخرى مفعلة بالفعل.');
      return;
    }

    if (!this.canSaveStep || !this.selectedProfileId) {
      if (!this.canSaveStep) {
        this.showMessage('warn', 'أكمل الحقول الإلزامية في قسم الخطوات قبل الحفظ.');
      }
      return;
    }

    const request: SubjectRoutingStepUpsertRequestDto = {
      routingProfileId: this.selectedProfileId,
      stepCode: this.normalizeText(this.stepForm.get('stepCode')?.value) ?? '',
      stepNameAr: this.normalizeText(this.stepForm.get('stepNameAr')?.value) ?? '',
      stepType: this.normalizeText(this.stepForm.get('stepType')?.value) ?? 'Review',
      stepOrder: Math.max(0, this.toNullableNumber(this.stepForm.get('stepOrder')?.value) ?? 0),
      isStart: this.stepForm.get('isStart')?.value === true,
      isEnd: this.stepForm.get('isEnd')?.value === true,
      slaHours: this.toNullableNumber(this.stepForm.get('slaHours')?.value) ?? undefined,
      isActive: this.stepForm.get('isActive')?.value === true,
      notesAr: this.normalizeText(this.stepForm.get('notesAr')?.value) ?? undefined
    };

    this.savingStep = true;
    const save$ = this.editingStepId
      ? this.routingController.updateStep(this.editingStepId, request)
      : this.routingController.addStep(request);

    save$.subscribe({
      next: response => {
        if (!this.ensureSuccess(response, 'تعذر حفظ الخطوة.')) {
          return;
        }

        this.showMessage('success', this.editingStepId ? 'تم تعديل الخطوة بنجاح.' : 'تمت إضافة الخطوة بنجاح.');
        this.prepareStepForCreate();
        this.reloadCurrentWorkspace();
      },
      error: () => this.showMessage('error', 'حدث خطأ أثناء حفظ الخطوة.'),
      complete: () => { this.savingStep = false; }
    });
  }

  onTargetStepFilterChanged(stepId: number | null): void {
    this.filteredTargetStepId = stepId;
  }

  onStartCreateTarget(): void {
    this.prepareTargetForCreate();
  }

  onEditTarget(target: SubjectRoutingTargetDto): void {
    const resolvedTargetNode = this.resolveTargetNode(target);

    this.editingTargetId = target.id;
    this.targetForm.reset(
      {
        routingStepId: target.routingStepId,
        targetMode: this.resolveLegacyTargetMode(resolvedTargetNode.selectedNodeType),
        oracleUnitTypeId: target.oracleUnitTypeId ?? null,
        oracleOrgUnitId: resolvedTargetNode.selectedNodeType === 'OrgUnit' ? resolvedTargetNode.selectedNodeNumericId : null,
        positionId: resolvedTargetNode.selectedNodeType === 'Position' ? resolvedTargetNode.selectedNodeNumericId : null,
        positionCode: resolvedTargetNode.selectedNodeType === 'SpecificUser' ? resolvedTargetNode.selectedNodeUserId ?? '' : '',
        selectedNodeType: resolvedTargetNode.selectedNodeType,
        selectedNodeNumericId: resolvedTargetNode.selectedNodeNumericId,
        selectedNodeUserId: resolvedTargetNode.selectedNodeUserId ?? '',
        audienceResolutionMode: resolvedTargetNode.audienceResolutionMode,
        workDistributionMode: resolvedTargetNode.workDistributionMode,
        allowMultipleReceivers: this.deriveAllowMultipleFromDistribution(
          resolvedTargetNode.audienceResolutionMode,
          resolvedTargetNode.workDistributionMode),
        sendToLeaderOnly: resolvedTargetNode.audienceResolutionMode === 'OrgUnitLeaderOnly',
        isActive: target.isActive,
        notesAr: target.notesAr ?? ''
      },
      { emitEvent: false }
    );

    this.selectedTargetNodeLabelAr = this.resolveTargetNodeLabel(target, resolvedTargetNode);
    this.selectedTargetNodeSecondaryLabelAr = '';
    this.ensureWorkDistributionCompatibility();
  }

  onDeleteTarget(target: SubjectRoutingTargetDto): void {
    if (this.deletingTargetId || !window.confirm('سيتم حذف الجهة المستهدفة المحددة. هل تريد المتابعة؟')) {
      return;
    }

    this.deletingTargetId = target.id;
    this.routingController.deleteTarget(target.id).subscribe({
      next: response => {
        if (!this.ensureSuccess(response, 'تعذر حذف الجهة المستهدفة.')) {
          return;
        }

        this.showMessage('success', 'تم حذف الجهة المستهدفة بنجاح.');
        this.prepareTargetForCreate();
        this.reloadCurrentWorkspace();
      },
      error: () => this.showMessage('error', 'حدث خطأ أثناء حذف الجهة المستهدفة.'),
      complete: () => { this.deletingTargetId = null; }
    });
  }

  onSaveTarget(): void {
    this.targetForm.markAllAsTouched();
    if (!this.canSaveTarget) {
      this.showMessage('warn', 'أكمل الحقول الإلزامية في قسم الجهات المستهدفة قبل الحفظ.');
      return;
    }

    const selectedNodeType = this.normalizeSelectedNodeType(this.targetForm.get('selectedNodeType')?.value);
    const selectedNodeNumericId = this.toNullableNumber(this.targetForm.get('selectedNodeNumericId')?.value);
    const selectedNodeUserId = this.normalizeText(this.targetForm.get('selectedNodeUserId')?.value);
    const audienceResolutionMode = this.normalizeAudienceResolutionMode(this.targetForm.get('audienceResolutionMode')?.value);
    const workDistributionMode = this.normalizeWorkDistributionMode(this.targetForm.get('workDistributionMode')?.value);
    if (selectedNodeType == null || audienceResolutionMode == null || workDistributionMode == null) {
      this.showMessage('warn', 'اختيار الجهة المستهدفة وإعدادات المؤهلين/التوزيع إلزامي قبل الحفظ.');
      return;
    }

    const legacyMode = this.resolveLegacyTargetMode(selectedNodeType);
    const isOrgUnit = selectedNodeType === 'OrgUnit';
    const isPosition = selectedNodeType === 'Position';
    const isSpecificUser = selectedNodeType === 'SpecificUser';

    const request: SubjectRoutingTargetUpsertRequestDto = {
      routingStepId: this.toNullableNumber(this.targetForm.get('routingStepId')?.value) ?? 0,
      targetMode: legacyMode,
      oracleUnitTypeId: this.toNullableNumber(this.targetForm.get('oracleUnitTypeId')?.value) ?? undefined,
      oracleOrgUnitId: isOrgUnit ? (selectedNodeNumericId ?? undefined) : undefined,
      positionId: isPosition ? (selectedNodeNumericId ?? undefined) : undefined,
      positionCode: isSpecificUser ? (selectedNodeUserId ?? undefined) : undefined,
      selectedNodeType,
      selectedNodeNumericId: isOrgUnit || isPosition ? (selectedNodeNumericId ?? undefined) : undefined,
      selectedNodeUserId: isSpecificUser ? (selectedNodeUserId ?? undefined) : undefined,
      audienceResolutionMode,
      workDistributionMode,
      allowMultipleReceivers: this.deriveAllowMultipleFromDistribution(audienceResolutionMode, workDistributionMode),
      sendToLeaderOnly: audienceResolutionMode === 'OrgUnitLeaderOnly',
      isActive: this.targetForm.get('isActive')?.value === true,
      notesAr: this.normalizeText(this.targetForm.get('notesAr')?.value) ?? undefined
    };

    this.savingTarget = true;
    const save$ = this.editingTargetId
      ? this.routingController.updateTarget(this.editingTargetId, request)
      : this.routingController.addTarget(request);

    save$.subscribe({
      next: response => {
        if (!this.ensureSuccess(response, 'تعذر حفظ الجهة المستهدفة.')) {
          return;
        }

        this.showMessage('success', this.editingTargetId ? 'تم تعديل الجهة المستهدفة بنجاح.' : 'تمت إضافة الجهة المستهدفة بنجاح.');
        this.prepareTargetForCreate();
        this.reloadCurrentWorkspace();
      },
      error: () => this.showMessage('error', 'حدث خطأ أثناء حفظ الجهة المستهدفة.'),
      complete: () => { this.savingTarget = false; }
    });
  }

  onOpenTargetTreeDialog(): void {
    this.targetTreeDialogVisible = true;
    if (!this.targetTreeLoadedOnce) {
      this.loadTargetTreeRoots();
    }
  }

  onSearchTargetTree(): void {
    this.loadTargetTreeRoots(this.normalizeText(this.targetTreeSearchTerm) ?? undefined);
  }

  onResetTargetTreeSearch(): void {
    this.targetTreeSearchTerm = '';
    this.loadTargetTreeRoots();
  }

  onTargetTreeNodeExpand(event: { node?: TreeNode }): void {
    const node = event?.node ?? null;
    if (!node) {
      return;
    }

    const nodeData = this.extractTargetTreeNodeData(node);
    if (!nodeData || !nodeData.hasChildren || nodeData.childrenLoaded) {
      return;
    }

    this.loadTargetTreeChildren(node);
  }

  onTargetTreeNodeSelect(event: { node?: TreeNode }): void {
    const node = event?.node ?? null;
    if (!node) {
      return;
    }

    const nodeData = this.extractTargetTreeNodeData(node);
    if (!nodeData || nodeData.isSelectable !== true) {
      this.showMessage('warn', 'العقدة المختارة غير قابلة للاستهداف في هذه المرحلة.');
      return;
    }

    this.applyTargetTreeSelection(nodeData);
    this.targetTreeDialogVisible = false;
  }

  onToggleTargetTreeIncludeUsers(): void {
    this.loadTargetTreeRoots(this.normalizeText(this.targetTreeSearchTerm) ?? undefined);
  }

  onClearTargetNodeSelection(): void {
    this.targetForm.patchValue(
      {
        selectedNodeType: null,
        selectedNodeNumericId: null,
        selectedNodeUserId: '',
        audienceResolutionMode: null,
        workDistributionMode: 'SharedInbox',
        targetMode: 'SpecificUnit',
        oracleOrgUnitId: null,
        positionId: null,
        positionCode: '',
        allowMultipleReceivers: false,
        sendToLeaderOnly: false
      },
      { emitEvent: false }
    );

    this.selectedTargetNodeLabelAr = '';
    this.selectedTargetNodeSecondaryLabelAr = '';
    this.targetTreeSelection = null;
  }

  getTargetNodeDisplayLabel(target: SubjectRoutingTargetDto): string {
    const resolvedNode = this.resolveTargetNode(target);
    if (resolvedNode.selectedNodeType === 'OrgUnit') {
      return `وحدة تنظيمية #${resolvedNode.selectedNodeNumericId ?? '-'}`;
    }

    if (resolvedNode.selectedNodeType === 'Position') {
      return `منصب #${resolvedNode.selectedNodeNumericId ?? '-'}`;
    }

    return `مستخدم: ${resolvedNode.selectedNodeUserId ?? '-'}`;
  }

  getTargetAudienceDisplayLabel(target: SubjectRoutingTargetDto): string {
    return this.getAudienceLabel(this.resolveTargetNode(target).audienceResolutionMode);
  }

  getTargetWorkDistributionDisplayLabel(target: SubjectRoutingTargetDto): string {
    return this.getWorkDistributionLabel(this.resolveTargetNode(target).workDistributionMode);
  }

  getTreeNodeTypeTagLabel(nodeType: string | null | undefined): string {
    const normalizedNodeType = this.normalizeSelectedNodeType(nodeType);
    if (normalizedNodeType === 'OrgUnit') {
      return 'وحدة';
    }

    if (normalizedNodeType === 'Position') {
      return 'منصب';
    }

    if (normalizedNodeType === 'SpecificUser') {
      return 'مستخدم';
    }

    return 'عقدة';
  }

  getTreeNodeTypeTagSeverity(nodeType: string | null | undefined): 'success' | 'info' | 'warning' {
    const normalizedNodeType = this.normalizeSelectedNodeType(nodeType);
    if (normalizedNodeType === 'OrgUnit') {
      return 'success';
    }

    if (normalizedNodeType === 'Position') {
      return 'info';
    }

    return 'warning';
  }

  private onAvailabilityModeChanged(): void {
    const mode = this.normalizedAvailabilityMode;
    if (mode === 'Public') {
      this.availabilityForm.patchValue(
        {
          selectedNodeType: null,
          selectedNodeNumericId: null,
          selectedNodeUserId: ''
        },
        { emitEvent: false }
      );

      this.selectedAvailabilityNodeLabelAr = '';
      this.selectedAvailabilityNodeSecondaryLabelAr = '';
      this.selectedAvailabilityNodePathAr = '';
      this.availabilitySummaryAr = this.resolveAvailabilitySummaryAr('Public', null);
      this.availabilityNodeValidationError = '';
      this.availabilityTreeSelection = null;
      this.emitCompletionProgress();
      return;
    }

    this.availabilitySummaryAr = this.resolveAvailabilitySummaryAr('Restricted', this.selectedAvailabilityNodeType);
    this.emitCompletionProgress();
  }

  private onSelectedNodeTypeChanged(): void {
    const selectedNodeType = this.normalizeSelectedNodeType(this.targetForm.get('selectedNodeType')?.value);
    if (selectedNodeType === 'OrgUnit') {
      if (!this.normalizeAudienceResolutionMode(this.targetForm.get('audienceResolutionMode')?.value)) {
        this.targetForm.patchValue({ audienceResolutionMode: 'OrgUnitAllMembers' }, { emitEvent: false });
      }
      return;
    }

    if (selectedNodeType === 'Position') {
      this.targetForm.patchValue({ audienceResolutionMode: 'PositionOccupants' }, { emitEvent: false });
      this.ensureWorkDistributionCompatibility();
      return;
    }

    if (selectedNodeType === 'SpecificUser') {
      this.targetForm.patchValue({ audienceResolutionMode: 'SpecificUserOnly' }, { emitEvent: false });
      this.ensureWorkDistributionCompatibility();
    }
  }

  private ensureWorkDistributionCompatibility(): void {
    const audienceResolutionMode = this.normalizeAudienceResolutionMode(this.targetForm.get('audienceResolutionMode')?.value);
    const workDistributionMode = this.normalizeWorkDistributionMode(this.targetForm.get('workDistributionMode')?.value) ?? 'SharedInbox';
    if (!this.isSingleRecipientAudience(audienceResolutionMode)) {
      this.targetForm.patchValue(
        { allowMultipleReceivers: workDistributionMode === 'SharedInbox' },
        { emitEvent: false }
      );
      return;
    }

    this.targetForm.patchValue(
      {
        workDistributionMode: 'SharedInbox',
        allowMultipleReceivers: false
      },
      { emitEvent: false }
    );
  }

  private loadTargetTreeRoots(search?: string): void {
    this.targetTreeLoading = true;
    this.targetTreeLoadError = '';
    this.targetTreeSelection = null;
    this.routingController.getOracleTreeNodes({
      search,
      activeOnly: true,
      includeUsers: this.targetTreeIncludeUsers
    }).subscribe({
      next: response => {
        if (!response?.isSuccess) {
          this.targetTreeNodes = [];
          this.targetTreeLoadError = this.readResponseError(response, 'تعذر تحميل الشجرة التنظيمية.');
          return;
        }

        const rows = response.data ?? [];
        this.targetTreeNodes = rows.map(item => this.mapTargetTreeNode(item));
        this.targetTreeLoadedOnce = true;
      },
      error: () => {
        this.targetTreeNodes = [];
        this.targetTreeLoadError = 'حدث خطأ أثناء تحميل الشجرة التنظيمية.';
      },
      complete: () => { this.targetTreeLoading = false; }
    });
  }

  private loadTargetTreeChildren(parentNode: TreeNode): void {
    const parentData = this.extractTargetTreeNodeData(parentNode);
    if (!parentData) {
      return;
    }

    (parentNode as any).loading = true;
    this.routingController.getOracleTreeNodes({
      parentNodeType: parentData.nodeType,
      parentNodeNumericId: parentData.nodeNumericId ?? undefined,
      parentNodeUserId: parentData.nodeUserId ?? undefined,
      activeOnly: true,
      includeUsers: this.targetTreeIncludeUsers
    }).subscribe({
      next: response => {
        if (!response?.isSuccess) {
          return;
        }

        const rows = response.data ?? [];
        parentNode.children = rows.map(item => this.mapTargetTreeNode(item));
        const mutableData = (parentNode.data ?? {}) as TargetTreeNodeData;
        mutableData.childrenLoaded = true;
        parentNode.data = mutableData;
      },
      complete: () => { (parentNode as any).loading = false; }
    });
  }

  private mapTargetTreeNode(item: SubjectRoutingOrgTreeNodeDto): TreeNode {
    const data: TargetTreeNodeData = {
      nodeType: item.nodeType,
      nodeNumericId: item.nodeNumericId ?? null,
      nodeUserId: this.normalizeText(item.nodeUserId) ?? null,
      labelAr: this.normalizeText(item.labelAr) ?? '-',
      secondaryLabelAr: this.normalizeText(item.secondaryLabelAr) ?? null,
      parentNodeType: this.normalizeText(item.parentNodeType) ?? null,
      parentNodeNumericId: item.parentNodeNumericId ?? null,
      parentNodeUserId: this.normalizeText(item.parentNodeUserId) ?? null,
      isSelectable: item.isSelectable === true,
      hasChildren: item.hasChildren === true,
      isActive: item.isActive === true,
      childrenLoaded: false
    };

    return {
      key: this.buildTargetTreeNodeKey(data.nodeType, data.nodeNumericId, data.nodeUserId),
      label: data.labelAr,
      data,
      selectable: data.isSelectable,
      leaf: data.hasChildren !== true,
      children: data.hasChildren ? [] : undefined,
      icon: this.getTreeNodeIcon(data.nodeType)
    };
  }

  private buildTargetTreeNodeKey(
    nodeType: string | null | undefined,
    nodeNumericId: number | null,
    nodeUserId: string | null): string {
    const type = this.normalizeText(nodeType) ?? 'Unknown';
    const numeric = nodeNumericId ?? '';
    const user = nodeUserId ?? '';
    return `${type}|${numeric}|${user}`;
  }

  private extractTargetTreeNodeData(node: TreeNode | null | undefined): TargetTreeNodeData | null {
    if (!node?.data) {
      return null;
    }

    return node.data as TargetTreeNodeData;
  }

  private applyTargetTreeSelection(nodeData: TargetTreeNodeData): void {
    const selectedNodeType = this.normalizeSelectedNodeType(nodeData.nodeType);
    if (selectedNodeType == null) {
      this.showMessage('warn', 'نوع العقدة المحددة غير مدعوم.');
      return;
    }

    let audienceResolutionMode: RoutingAudienceResolutionMode = 'OrgUnitAllMembers';
    if (selectedNodeType === 'Position') {
      audienceResolutionMode = 'PositionOccupants';
    } else if (selectedNodeType === 'SpecificUser') {
      audienceResolutionMode = 'SpecificUserOnly';
    }

    this.targetForm.patchValue(
      {
        selectedNodeType,
        selectedNodeNumericId: selectedNodeType === 'SpecificUser' ? null : nodeData.nodeNumericId,
        selectedNodeUserId: selectedNodeType === 'SpecificUser' ? (nodeData.nodeUserId ?? '') : '',
        audienceResolutionMode,
        workDistributionMode: this.isSingleRecipientAudience(audienceResolutionMode)
          ? 'SharedInbox'
          : (this.normalizeWorkDistributionMode(this.targetForm.get('workDistributionMode')?.value) ?? 'SharedInbox'),
        targetMode: this.resolveLegacyTargetMode(selectedNodeType),
        oracleOrgUnitId: selectedNodeType === 'OrgUnit' ? (nodeData.nodeNumericId ?? null) : null,
        positionId: selectedNodeType === 'Position' ? (nodeData.nodeNumericId ?? null) : null,
        positionCode: selectedNodeType === 'SpecificUser' ? (nodeData.nodeUserId ?? '') : '',
        sendToLeaderOnly: false
      },
      { emitEvent: false }
    );

    this.ensureWorkDistributionCompatibility();
    this.selectedTargetNodeLabelAr = nodeData.labelAr;
    this.selectedTargetNodeSecondaryLabelAr = nodeData.secondaryLabelAr ?? '';
  }

  private loadAvailabilityTreeRoots(search?: string): void {
    if (!this.requestTypeId) {
      this.availabilityTreeNodes = [];
      this.availabilityTreeLoadError = 'نوع الطلب غير محدد.';
      return;
    }

    this.availabilityTreeLoading = true;
    this.availabilityTreeLoadError = '';
    this.availabilityTreeSelection = null;
    this.routingController.getAvailabilityTreeNodes(this.requestTypeId, {
      search,
      activeOnly: true,
      includeUsers: this.availabilityTreeIncludeUsers
    }).subscribe({
      next: response => {
        if (!response?.isSuccess) {
          this.availabilityTreeNodes = [];
          this.availabilityTreeLoadError = this.readResponseError(response, 'تعذر تحميل الشجرة التنظيمية الخاصة بالإتاحة.');
          return;
        }

        const rows = response.data ?? [];
        this.availabilityTreeNodes = rows.map(item => this.mapAvailabilityTreeNode(item));
        this.availabilityTreeLoadedOnce = true;
      },
      error: () => {
        this.availabilityTreeNodes = [];
        this.availabilityTreeLoadError = 'حدث خطأ أثناء تحميل الشجرة التنظيمية الخاصة بالإتاحة.';
      },
      complete: () => { this.availabilityTreeLoading = false; }
    });
  }

  private loadAvailabilityTreeChildren(parentNode: TreeNode): void {
    const parentData = this.extractAvailabilityTreeNodeData(parentNode);
    if (!parentData || !this.requestTypeId) {
      return;
    }

    (parentNode as any).loading = true;
    this.routingController.getAvailabilityTreeNodes(this.requestTypeId, {
      parentNodeType: parentData.nodeType,
      parentNodeNumericId: parentData.nodeNumericId ?? undefined,
      parentNodeUserId: parentData.nodeUserId ?? undefined,
      activeOnly: true,
      includeUsers: this.availabilityTreeIncludeUsers
    }).subscribe({
      next: response => {
        if (!response?.isSuccess) {
          return;
        }

        const rows = response.data ?? [];
        parentNode.children = rows.map(item => this.mapAvailabilityTreeNode(item));
        const mutableData = (parentNode.data ?? {}) as AvailabilityTreeNodeData;
        mutableData.childrenLoaded = true;
        parentNode.data = mutableData;
      },
      complete: () => { (parentNode as any).loading = false; }
    });
  }

  private mapAvailabilityTreeNode(item: SubjectRoutingOrgTreeNodeDto): TreeNode {
    const data: AvailabilityTreeNodeData = {
      nodeType: item.nodeType,
      nodeNumericId: item.nodeNumericId ?? null,
      nodeUserId: this.normalizeText(item.nodeUserId) ?? null,
      labelAr: this.normalizeText(item.labelAr) ?? '-',
      secondaryLabelAr: this.normalizeText(item.secondaryLabelAr) ?? null,
      parentNodeType: this.normalizeText(item.parentNodeType) ?? null,
      parentNodeNumericId: item.parentNodeNumericId ?? null,
      parentNodeUserId: this.normalizeText(item.parentNodeUserId) ?? null,
      isSelectable: item.isSelectable === true,
      hasChildren: item.hasChildren === true,
      isActive: item.isActive === true,
      childrenLoaded: false
    };

    return {
      key: this.buildTargetTreeNodeKey(data.nodeType, data.nodeNumericId, data.nodeUserId),
      label: data.labelAr,
      data,
      selectable: data.isSelectable,
      leaf: data.hasChildren !== true,
      children: data.hasChildren ? [] : undefined,
      icon: this.getTreeNodeIcon(data.nodeType)
    };
  }

  private extractAvailabilityTreeNodeData(node: TreeNode | null | undefined): AvailabilityTreeNodeData | null {
    if (!node?.data) {
      return null;
    }

    return node.data as AvailabilityTreeNodeData;
  }

  private applyAvailabilityTreeSelection(nodeData: AvailabilityTreeNodeData): void {
    const selectedNodeType = this.normalizeSelectedNodeType(nodeData.nodeType);
    if (selectedNodeType == null) {
      this.showMessage('warn', 'نوع العقدة المحددة غير مدعوم في إتاحة الطلب.');
      return;
    }

    this.availabilityNodeValidationError = '';
    this.availabilityForm.patchValue(
      {
        availabilityMode: 'Restricted',
        selectedNodeType,
        selectedNodeNumericId: selectedNodeType === 'SpecificUser' ? null : nodeData.nodeNumericId,
        selectedNodeUserId: selectedNodeType === 'SpecificUser' ? (nodeData.nodeUserId ?? '') : ''
      },
      { emitEvent: false }
    );

    this.selectedAvailabilityNodeLabelAr = nodeData.labelAr;
    this.selectedAvailabilityNodeSecondaryLabelAr = nodeData.secondaryLabelAr ?? '';
    this.selectedAvailabilityNodePathAr = '';
    this.availabilitySummaryAr = this.resolveAvailabilitySummaryAr('Restricted', selectedNodeType);
    this.validateAvailabilityNodeSelection({
      selectedNodeType,
      selectedNodeNumericId: selectedNodeType === 'SpecificUser' ? undefined : (nodeData.nodeNumericId ?? undefined),
      selectedNodeUserId: selectedNodeType === 'SpecificUser' ? (nodeData.nodeUserId ?? undefined) : undefined
    });
  }

  private validateAvailabilityNodeSelection(request: SubjectAvailabilityNodeValidationRequestDto): void {
    if (!this.requestTypeId) {
      return;
    }

    this.validatingAvailabilityNode = true;
    this.routingController.validateRequestAvailabilityNode(this.requestTypeId, request).subscribe({
      next: response => {
        if (!response?.isSuccess || !response.data?.isValid) {
          this.availabilityNodeValidationError = this.readResponseError(
            response,
            'العقدة المختارة غير صالحة وفق قواعد إتاحة الطلب.');
          this.availabilitySummaryAr = this.resolveAvailabilitySummaryAr('Restricted', this.selectedAvailabilityNodeType);
          this.emitCompletionProgress();
          return;
        }

        this.applyAvailabilityValidationResult(response.data);
        this.availabilityNodeValidationError = '';
        this.emitCompletionProgress();
      },
      error: () => {
        this.availabilityNodeValidationError = 'حدث خطأ أثناء التحقق من العقدة المختارة.';
        this.emitCompletionProgress();
      },
      complete: () => { this.validatingAvailabilityNode = false; }
    });
  }

  private applyAvailabilityValidationResult(validation: SubjectAvailabilityNodeValidationResultDto): void {
    const nodeType = this.normalizeSelectedNodeType(validation.selectedNodeType);
    this.availabilityForm.patchValue(
      {
        selectedNodeType: nodeType,
        selectedNodeNumericId: nodeType === 'SpecificUser' ? null : (validation.selectedNodeNumericId ?? null),
        selectedNodeUserId: nodeType === 'SpecificUser' ? (this.normalizeText(validation.selectedNodeUserId) ?? '') : ''
      },
      { emitEvent: false }
    );

    this.selectedAvailabilityNodeLabelAr = this.normalizeText(validation.selectedNodeLabelAr) ?? this.selectedAvailabilityNodeLabelAr;
    this.selectedAvailabilityNodeSecondaryLabelAr = this.normalizeText(validation.selectedNodeSecondaryLabelAr) ?? '';
    this.selectedAvailabilityNodePathAr = this.normalizeText(validation.selectedNodePathAr) ?? '';
    this.availabilitySummaryAr = this.normalizeText(validation.availabilitySummaryAr)
      ?? this.resolveAvailabilitySummaryAr('Restricted', nodeType);
  }

  private applyAvailabilityDto(dto: SubjectTypeRequestAvailabilityDto): void {
    const mode = this.normalizeAvailabilityMode(dto.availabilityMode);
    const nodeType = mode === 'Restricted'
      ? this.normalizeSelectedNodeType(dto.selectedNodeType)
      : null;

    this.availability = dto;
    this.loadingAvailability = false;
    this.availabilityNodeValidationError = '';
    this.availabilitySummaryAr = this.normalizeText(dto.availabilitySummaryAr)
      ?? this.resolveAvailabilitySummaryAr(mode, nodeType);

    this.availabilityForm.reset(
      {
        availabilityMode: mode,
        selectedNodeType: nodeType,
        selectedNodeNumericId: nodeType === 'SpecificUser' ? null : (dto.selectedNodeNumericId ?? null),
        selectedNodeUserId: nodeType === 'SpecificUser' ? (this.normalizeText(dto.selectedNodeUserId) ?? '') : ''
      },
      { emitEvent: false }
    );

    this.selectedAvailabilityNodeLabelAr = this.normalizeText(dto.selectedNodeLabelAr) ?? '';
    this.selectedAvailabilityNodeSecondaryLabelAr = this.normalizeText(dto.selectedNodeSecondaryLabelAr) ?? '';
    this.selectedAvailabilityNodePathAr = this.normalizeText(dto.selectedNodePathAr) ?? '';

    if (mode === 'Public') {
      this.selectedAvailabilityNodeLabelAr = '';
      this.selectedAvailabilityNodeSecondaryLabelAr = '';
      this.selectedAvailabilityNodePathAr = '';
      this.availabilityTreeSelection = null;
    }

    this.emitCompletionProgress();
  }

  private buildDefaultAvailability(subjectTypeId: number): SubjectTypeRequestAvailabilityDto {
    return {
      subjectTypeId,
      availabilityMode: 'Public',
      availabilitySummaryAr: 'متاح لجميع المستخدمين المسجلين.'
    };
  }

  private normalizeAvailabilityMode(value: unknown): RequestAvailabilityMode {
    const normalized = this.normalizeText(value)?.toLowerCase() ?? '';
    return normalized === 'restricted'
      ? 'Restricted'
      : 'Public';
  }

  private resolveAvailabilitySummaryAr(
    mode: RequestAvailabilityMode,
    nodeType: RoutingSelectedNodeType | null): string {
    if (mode === 'Public') {
      return 'متاح لجميع المستخدمين المسجلين.';
    }

    if (nodeType === 'OrgUnit') {
      return 'متاح لأعضاء الوحدة المحددة.';
    }

    if (nodeType === 'Position') {
      return 'متاح لحاملي الوظيفة المحددة.';
    }

    if (nodeType === 'SpecificUser') {
      return 'متاح للمستخدم المحدد.';
    }

    return 'متاح لفئة محددة وفق العقدة التنظيمية المختارة.';
  }

  private normalizeSelectedNodeType(value: unknown): RoutingSelectedNodeType | null {
    const normalized = this.normalizeText(value)?.toLowerCase() ?? '';
    if (normalized === 'orgunit' || normalized === 'unit') {
      return 'OrgUnit';
    }

    if (normalized === 'position') {
      return 'Position';
    }

    if (normalized === 'specificuser' || normalized === 'user') {
      return 'SpecificUser';
    }

    return null;
  }

  private normalizeAudienceResolutionMode(value: unknown): RoutingAudienceResolutionMode | null {
    const normalized = this.normalizeText(value)?.toLowerCase() ?? '';
    if (normalized === 'orgunitallmembers' || normalized === 'allmembers') {
      return 'OrgUnitAllMembers';
    }

    if (normalized === 'orgunitleaderonly' || normalized === 'leaderonly') {
      return 'OrgUnitLeaderOnly';
    }

    if (normalized === 'positionoccupants' || normalized === 'occupants') {
      return 'PositionOccupants';
    }

    if (normalized === 'specificuseronly') {
      return 'SpecificUserOnly';
    }

    return null;
  }

  private normalizeWorkDistributionMode(value: unknown): RoutingWorkDistributionMode | null {
    const normalized = this.normalizeText(value)?.toLowerCase() ?? '';
    if (normalized === 'sharedinbox') {
      return 'SharedInbox';
    }

    if (normalized === 'autodistributeactive' || normalized === 'auto') {
      return 'AutoDistributeActive';
    }

    if (normalized === 'manualassignment' || normalized === 'manual') {
      return 'ManualAssignment';
    }

    return null;
  }

  private isSingleRecipientAudience(audienceMode: RoutingAudienceResolutionMode | null): boolean {
    return audienceMode === 'OrgUnitLeaderOnly' || audienceMode === 'SpecificUserOnly';
  }

  private getAudienceLabel(audienceMode: RoutingAudienceResolutionMode | null): string {
    if (audienceMode === 'OrgUnitAllMembers') {
      return 'جميع أعضاء الوحدة';
    }

    if (audienceMode === 'OrgUnitLeaderOnly') {
      return 'قائد الوحدة فقط';
    }

    if (audienceMode === 'PositionOccupants') {
      return 'جميع شاغلي المنصب';
    }

    if (audienceMode === 'SpecificUserOnly') {
      return 'مستخدم محدد فقط';
    }

    return 'غير محدد';
  }

  private getWorkDistributionLabel(workDistributionMode: RoutingWorkDistributionMode | null): string {
    if (workDistributionMode === 'SharedInbox') {
      return 'عرض مشترك للجميع';
    }

    if (workDistributionMode === 'AutoDistributeActive') {
      return 'توزيع تلقائي على عضو نشط';
    }

    if (workDistributionMode === 'ManualAssignment') {
      return 'تحويل يدوي لأعضاء الفريق';
    }

    return 'غير محدد';
  }

  private resolveTargetNode(target: SubjectRoutingTargetDto): TargetNodeResolution {
    const selectedNodeType = this.normalizeSelectedNodeType(target.selectedNodeType)
      ?? this.resolveNodeTypeFromLegacyTargetMode(target.targetMode)
      ?? 'OrgUnit';

    let selectedNodeNumericId: number | null = this.toNullableNumber(target.selectedNodeNumericId);
    let selectedNodeUserId: string | null = this.normalizeText(target.selectedNodeUserId);

    if (selectedNodeType === 'OrgUnit' && selectedNodeNumericId == null) {
      selectedNodeNumericId = this.toNullableNumber(target.oracleOrgUnitId);
    }

    if (selectedNodeType === 'Position' && selectedNodeNumericId == null) {
      selectedNodeNumericId = this.toNullableNumber(target.positionId);
    }

    if (selectedNodeType === 'SpecificUser' && selectedNodeUserId == null) {
      selectedNodeUserId = this.normalizeText(target.positionCode);
    }

    let audienceResolutionMode = this.normalizeAudienceResolutionMode(target.audienceResolutionMode);
    if (audienceResolutionMode == null) {
      if (selectedNodeType === 'OrgUnit') {
        audienceResolutionMode = target.sendToLeaderOnly ? 'OrgUnitLeaderOnly' : 'OrgUnitAllMembers';
      } else if (selectedNodeType === 'Position') {
        audienceResolutionMode = 'PositionOccupants';
      } else {
        audienceResolutionMode = 'SpecificUserOnly';
      }
    }

    let workDistributionMode = this.normalizeWorkDistributionMode(target.workDistributionMode);
    if (workDistributionMode == null) {
      if (this.isSingleRecipientAudience(audienceResolutionMode)) {
        workDistributionMode = 'SharedInbox';
      } else {
        workDistributionMode = target.allowMultipleReceivers ? 'SharedInbox' : 'ManualAssignment';
      }
    }

    return {
      selectedNodeType,
      selectedNodeNumericId,
      selectedNodeUserId,
      audienceResolutionMode,
      workDistributionMode
    };
  }

  private resolveNodeTypeFromLegacyTargetMode(targetMode: string | null | undefined): RoutingSelectedNodeType | null {
    const normalized = this.normalizeText(targetMode)?.toLowerCase() ?? '';
    if (normalized === 'specificunit') {
      return 'OrgUnit';
    }

    if (normalized === 'position') {
      return 'Position';
    }

    if (normalized === 'committeemembers') {
      return 'SpecificUser';
    }

    return null;
  }

  private resolveLegacyTargetMode(selectedNodeType: RoutingSelectedNodeType): RoutingTargetMode {
    if (selectedNodeType === 'OrgUnit') {
      return 'SpecificUnit';
    }

    if (selectedNodeType === 'Position') {
      return 'Position';
    }

    return 'CommitteeMembers';
  }

  private deriveAllowMultipleFromDistribution(
    audienceMode: RoutingAudienceResolutionMode,
    workDistributionMode: RoutingWorkDistributionMode): boolean {
    if (this.isSingleRecipientAudience(audienceMode)) {
      return false;
    }

    return workDistributionMode === 'SharedInbox';
  }

  private resolveTargetNodeLabel(target: SubjectRoutingTargetDto, resolvedNode: TargetNodeResolution): string {
    if (resolvedNode.selectedNodeType === 'OrgUnit') {
      return `وحدة تنظيمية #${resolvedNode.selectedNodeNumericId ?? target.oracleOrgUnitId ?? '-'}`;
    }

    if (resolvedNode.selectedNodeType === 'Position') {
      return `منصب #${resolvedNode.selectedNodeNumericId ?? target.positionId ?? '-'}`;
    }

    return `مستخدم: ${resolvedNode.selectedNodeUserId ?? target.positionCode ?? '-'}`;
  }

  private getTreeNodeIcon(nodeType: string | null | undefined): string {
    const normalized = this.normalizeSelectedNodeType(nodeType);
    if (normalized === 'OrgUnit') {
      return 'pi pi-sitemap';
    }

    if (normalized === 'Position') {
      return 'pi pi-briefcase';
    }

    if (normalized === 'SpecificUser') {
      return 'pi pi-user';
    }

    return 'pi pi-circle';
  }

  onStartCreateTransition(): void {
    this.prepareTransitionForCreate();
  }

  onEditTransition(transition: SubjectRoutingTransitionDto): void {
    this.editingTransitionId = transition.id;
    this.transitionForm.reset(
      {
        fromStepId: transition.fromStepId,
        toStepId: transition.toStepId,
        actionCode: transition.actionCode,
        actionNameAr: transition.actionNameAr,
        displayOrder: transition.displayOrder,
        requiresComment: transition.requiresComment,
        requiresMandatoryFieldsCompletion: transition.requiresMandatoryFieldsCompletion,
        isRejectPath: transition.isRejectPath,
        isReturnPath: transition.isReturnPath,
        isEscalationPath: transition.isEscalationPath,
        conditionExpression: transition.conditionExpression ?? '',
        isActive: transition.isActive
      },
      { emitEvent: false }
    );
  }

  onDeleteTransition(transition: SubjectRoutingTransitionDto): void {
    if (this.deletingTransitionId || !window.confirm(`سيتم حذف الإجراء '${transition.actionNameAr}'. هل تريد المتابعة؟`)) {
      return;
    }

    this.deletingTransitionId = transition.id;
    this.routingController.deleteTransition(transition.id).subscribe({
      next: response => {
        if (!this.ensureSuccess(response, 'تعذر حذف الانتقال.')) {
          return;
        }

        this.showMessage('success', 'تم حذف الانتقال بنجاح.');
        this.prepareTransitionForCreate();
        this.reloadCurrentWorkspace();
      },
      error: () => this.showMessage('error', 'حدث خطأ أثناء حذف الانتقال.'),
      complete: () => { this.deletingTransitionId = null; }
    });
  }

  onSaveTransition(): void {
    this.transitionForm.markAllAsTouched();
    if (!this.canSaveTransition || !this.selectedProfileId) {
      this.showMessage('warn', 'أكمل الحقول الإلزامية في قسم الانتقالات قبل الحفظ.');
      return;
    }

    const request: SubjectRoutingTransitionUpsertRequestDto = {
      routingProfileId: this.selectedProfileId,
      fromStepId: this.toNullableNumber(this.transitionForm.get('fromStepId')?.value) ?? 0,
      toStepId: this.toNullableNumber(this.transitionForm.get('toStepId')?.value) ?? 0,
      actionCode: this.normalizeText(this.transitionForm.get('actionCode')?.value) ?? '',
      actionNameAr: this.normalizeText(this.transitionForm.get('actionNameAr')?.value) ?? '',
      displayOrder: Math.max(0, this.toNullableNumber(this.transitionForm.get('displayOrder')?.value) ?? 0),
      requiresComment: this.transitionForm.get('requiresComment')?.value === true,
      requiresMandatoryFieldsCompletion: this.transitionForm.get('requiresMandatoryFieldsCompletion')?.value === true,
      isRejectPath: this.transitionForm.get('isRejectPath')?.value === true,
      isReturnPath: this.transitionForm.get('isReturnPath')?.value === true,
      isEscalationPath: this.transitionForm.get('isEscalationPath')?.value === true,
      conditionExpression: this.normalizeText(this.transitionForm.get('conditionExpression')?.value) ?? undefined,
      isActive: this.transitionForm.get('isActive')?.value === true
    };

    if (request.fromStepId === request.toStepId) {
      this.showMessage('warn', 'لا يمكن إنشاء انتقال من الخطوة إلى نفسها.');
      return;
    }

    this.savingTransition = true;
    const save$ = this.editingTransitionId
      ? this.routingController.updateTransition(this.editingTransitionId, request)
      : this.routingController.addTransition(request);

    save$.subscribe({
      next: response => {
        if (!this.ensureSuccess(response, 'تعذر حفظ الانتقال.')) {
          return;
        }

        this.showMessage('success', this.editingTransitionId ? 'تم تعديل الانتقال بنجاح.' : 'تمت إضافة الانتقال بنجاح.');
        this.prepareTransitionForCreate();
        this.reloadCurrentWorkspace();
      },
      error: () => this.showMessage('error', 'حدث خطأ أثناء حفظ الانتقال.'),
      complete: () => { this.savingTransition = false; }
    });
  }

  onOpenStepFromPreview(stepId: number): void {
    const step = this.steps.find(item => item.id === stepId);
    if (!step) {
      return;
    }

    this.selectedPreviewStepId = stepId;
    this.selectedPreviewTransitionId = null;
    this.onEditStep(step);
    this.activeSection = 'steps';
  }

  onOpenTransitionFromPreview(transitionId: number): void {
    const transition = this.transitions.find(item => item.id === transitionId);
    if (!transition) {
      return;
    }

    this.selectedPreviewTransitionId = transitionId;
    this.selectedPreviewStepId = null;
    this.onEditTransition(transition);
    this.activeSection = 'transitions';
  }

  getPreviewStepTargetSummary(stepId: number): string {
    const node = this.preview?.nodes?.find(item => item.stepId === stepId);
    const summary = this.normalizeText(node?.targetsSummaryAr);
    return summary ?? 'لا توجد جهة مستهدفة واضحة لهذه الخطوة';
  }

  onRefreshPreview(silent = false): void {
    if (!this.selectedProfileId) {
      if (!silent) {
        this.showMessage('warn', 'أنشئ أو اختر RoutingProfile أولًا.');
      }
      return;
    }

    this.loadingPreview = true;
    this.routingController.getRoutingPreview(this.selectedProfileId).subscribe({
      next: response => {
        if (!this.ensureSuccess(response, 'تعذر تحميل المعاينة المرئية.')) {
          return;
        }

        this.preview = response.data ?? null;
        this.rebuildPreviewVisualization();
        this.emitCompletionProgress();
      },
      error: () => {
        if (!silent) {
          this.showMessage('error', 'حدث خطأ أثناء تحميل المعاينة المرئية.');
        }
      },
      complete: () => { this.loadingPreview = false; }
    });
  }

  onValidateProfile(silent = false): void {
    if (!this.selectedProfileId) {
      if (!silent) {
        this.showMessage('warn', 'أنشئ أو اختر RoutingProfile أولًا.');
      }
      return;
    }

    this.loadingValidation = true;
    this.routingController.validateRoutingProfile(this.selectedProfileId).subscribe({
      next: response => {
        if (!this.ensureSuccess(response, 'تعذر تنفيذ التحقق من المسار.')) {
          return;
        }

        this.validationResult = response.data ?? null;
        this.emitCompletionProgress();
      },
      error: () => {
        if (!silent) {
          this.showMessage('error', 'حدث خطأ أثناء التحقق من المسار.');
        }
      },
      complete: () => { this.loadingValidation = false; }
    });
  }

  getStepName(stepId: number): string {
    const step = this.steps.find(item => item.id === stepId);
    return step?.stepNameAr ?? `#${stepId}`;
  }

  getTargetModeLabel(mode: string): string {
    const option = this.targetModeOptions.find(item => item.value === mode);
    return option?.label ?? mode;
  }

  truncateText(value: string | null | undefined, maxLength = 36): string {
    const normalized = this.normalizeText(value);
    if (normalized == null) {
      return '';
    }

    if (normalized.length <= maxLength) {
      return normalized;
    }

    return `${normalized.substring(0, maxLength - 1)}…`;
  }

  private reloadRequestTypeContext(preferredProfileId?: number | null): void {
    this.clearMessage();
    if (!this.canManageWorkspace || !this.requestTypeId) {
      this.resetAllState();
      return;
    }

    this.loadingContext = true;
    this.loadingAvailability = true;
    this.availabilityTreeDialogVisible = false;
    this.availabilityTreeNodes = [];
    this.availabilityTreeSelection = null;
    this.availabilityTreeLoadError = '';
    this.availabilityTreeLoadedOnce = false;
    this.availabilityNodeValidationError = '';
    this.ensureReferenceLookupsLoaded();

    forkJoin({
      profiles: this.routingController.getProfilesByRequestType(this.requestTypeId),
      preferredWorkspace: this.routingController.getProfileByRequestType(this.requestTypeId),
      availability: this.routingController.getRequestAvailability(this.requestTypeId)
    }).subscribe({
      next: payload => {
        const availabilityResponse = payload.availability;
        if (availabilityResponse?.isSuccess) {
          this.applyAvailabilityDto(availabilityResponse.data ?? this.buildDefaultAvailability(this.requestTypeId!));
        } else {
          this.applyAvailabilityDto(this.buildDefaultAvailability(this.requestTypeId!));
          this.showMessage('warn', this.readResponseError(availabilityResponse, 'تعذر تحميل إعدادات إتاحة الطلب. تم تطبيق الوضع العام افتراضيًا.'));
        }

        const profilesResponse = payload.profiles;
        if (profilesResponse?.isSuccess) {
          this.profiles = [...(profilesResponse.data ?? [])];
        } else {
          this.profiles = [];
          this.showMessage('warn', this.readResponseError(profilesResponse, 'تعذر تحميل قائمة المسارات.'));
        }

        const preferredWorkspace = payload.preferredWorkspace?.isSuccess
          ? payload.preferredWorkspace.data
          : null;
        let selectedProfileId = preferredProfileId ?? null;
        if (selectedProfileId == null) {
          selectedProfileId = preferredWorkspace?.profile?.id ?? null;
        }

        if (selectedProfileId == null && this.profiles.length > 0) {
          selectedProfileId = this.profiles[0].id;
        }

        if (selectedProfileId == null) {
          this.selectedProfileId = null;
          this.profileWorkspace = preferredWorkspace ?? null;
          this.binding = preferredWorkspace?.binding ?? null;
          this.steps = preferredWorkspace?.steps ?? [];
          this.targets = preferredWorkspace?.targets ?? [];
          this.transitions = preferredWorkspace?.transitions ?? [];
          this.resetPreviewState();
          this.prepareBasicForNewProfile();
          this.prepareStepForCreate();
          this.prepareTargetForCreate();
          this.prepareTransitionForCreate();
          this.emitCompletionProgress();
          return;
        }

        this.loadProfileWorkspace(selectedProfileId);
      },
      error: () => {
        this.showMessage('error', 'حدث خطأ أثناء تحميل سياق Routing لنوع الطلب الحالي.');
        this.resetAllState();
        this.loadingContext = false;
      },
      complete: () => {
        if (this.selectedProfileId == null) {
          this.loadingContext = false;
        }
      }
    });
  }

  private bindProfileWithValidationGuard(profile: SubjectRoutingProfileDto): void {
    const requestedActivation = this.basicForm.get('routingEnabled')?.value === true;
    const executeBinding = (isActive: boolean): void => {
      const bindRequest: SubjectTypeRoutingBindingUpsertRequestDto = {
        subjectTypeId: this.requestTypeId!,
        routingProfileId: profile.id,
        isDefault: this.basicForm.get('isDefault')?.value === true,
        appliesToInbound: this.basicForm.get('appliesToInbound')?.value === true,
        appliesToOutbound: this.basicForm.get('appliesToOutbound')?.value === true,
        isActive
      };

      this.routingController.bindProfileToRequestType(bindRequest).subscribe({
        next: bindingResponse => {
          if (!this.ensureSuccess(bindingResponse, 'تم حفظ ملف المسار لكن تعذر حفظ الربط بنوع الطلب.')) {
            return;
          }

          this.showMessage(
            'success',
            isActive
              ? 'تم حفظ البيانات الأساسية وتفعيل المسار بنجاح.'
              : 'تم حفظ البيانات الأساسية وربط المسار كغير مفعل حتى اكتمال التحقق.');
          this.reloadRequestTypeContext(profile.id);
        },
        error: () => this.showMessage('error', 'حدث خطأ أثناء ربط المسار بنوع الطلب.'),
        complete: () => { this.savingBasic = false; }
      });
    };

    if (!requestedActivation) {
      executeBinding(false);
      return;
    }

    this.routingController.validateRoutingProfile(profile.id).subscribe({
      next: validationResponse => {
        if (!validationResponse?.isSuccess) {
          this.showMessage('warn', 'تعذر تنفيذ التحقق قبل التفعيل. سيتم حفظ الربط كغير مفعل.');
          this.basicForm.patchValue({ routingEnabled: false }, { emitEvent: false });
          executeBinding(false);
          return;
        }

        this.validationResult = validationResponse.data ?? null;
        this.emitCompletionProgress();
        const hasBlockingErrors = (this.validationResult?.errors?.length ?? 0) > 0;
        if (hasBlockingErrors) {
          this.showMessage('warn', 'لا يمكن تفعيل المسار حاليًا لوجود أخطاء مانعة. تم حفظ الربط كغير مفعل.');
          this.basicForm.patchValue({ routingEnabled: false }, { emitEvent: false });
          executeBinding(false);
          return;
        }

        executeBinding(true);
      },
      error: () => {
        this.showMessage('warn', 'تعذر تنفيذ التحقق قبل التفعيل. تم حفظ الربط كغير مفعل.');
        this.basicForm.patchValue({ routingEnabled: false }, { emitEvent: false });
        executeBinding(false);
      }
    });
  }

  private loadProfileWorkspace(profileId: number): void {
    if (!profileId) {
      return;
    }

    this.loadingContext = true;
    this.routingController.getProfileWorkspace(profileId).subscribe({
      next: response => {
        if (!this.ensureSuccess(response, 'تعذر تحميل بيانات RoutingProfile المحدد.')) {
          return;
        }

        const workspace = response.data;
        if (!workspace || !workspace.profile) {
          this.showMessage('warn', 'المسار المحدد لا يحتوي بيانات صالحة.');
          this.resetWorkspaceOnly();
          return;
        }

        this.selectedProfileId = workspace.profile.id;
        this.applyWorkspace(workspace);
      },
      error: () => this.showMessage('error', 'حدث خطأ أثناء تحميل ملف المسار.'),
      complete: () => { this.loadingContext = false; }
    });
  }

  private applyWorkspace(workspace: SubjectRoutingProfileWorkspaceDto): void {
    this.profileWorkspace = workspace;
    this.binding = workspace.binding ?? null;
    this.steps = [...(workspace.steps ?? [])].sort((a, b) => (a.stepOrder - b.stepOrder) || (a.id - b.id));
    this.targets = [...(workspace.targets ?? [])];
    this.transitions = [...(workspace.transitions ?? [])].sort((a, b) => (a.displayOrder - b.displayOrder) || (a.id - b.id));

    const profile = workspace.profile;
    this.basicForm.reset(
      {
        nameAr: profile?.nameAr ?? '',
        descriptionAr: profile?.descriptionAr ?? '',
        directionMode: this.normalizeDirectionMode(profile?.directionMode),
        versionNo: profile?.versionNo ?? 1,
        startStepId: profile?.startStepId ?? null,
        profileIsActive: profile?.isActive ?? true,
        routingEnabled: workspace.binding?.isActive ?? profile?.isActive ?? true,
        isDefault: workspace.binding?.isDefault ?? false,
        appliesToInbound: workspace.binding?.appliesToInbound ?? true,
        appliesToOutbound: workspace.binding?.appliesToOutbound ?? true
      },
      { emitEvent: false }
    );

    this.resetPreviewState();
    this.prepareStepForCreate();
    this.prepareTargetForCreate();
    this.prepareTransitionForCreate();
    this.emitCompletionProgress();
    this.refreshDerivedViews();
  }

  private reloadCurrentWorkspace(): void {
    if (!this.selectedProfileId) {
      return;
    }

    this.loadProfileWorkspace(this.selectedProfileId);
  }

  private ensureReferenceLookupsLoaded(): void {
    if (this.lookupsLoaded || this.loadingLookups) {
      return;
    }

    this.loadingLookups = true;
    forkJoin({
      unitTypes: this.routingController.getOracleUnitTypes(),
      users: this.routingController.getOracleUsers(true)
    }).subscribe({
      next: payload => {
        if (payload.unitTypes?.isSuccess) {
          this.unitTypes = [...(payload.unitTypes.data ?? [])];
        }

        if (payload.users?.isSuccess) {
          this.users = [...(payload.users.data ?? [])];
        }

        this.lookupsLoaded = true;
      },
      error: () => {
        this.showMessage('warn', 'تعذر تحميل بعض بيانات Oracle المرجعية. يمكن المتابعة وإعادة المحاولة لاحقًا.');
      },
      complete: () => { this.loadingLookups = false; }
    });
  }

  private handleTargetModeChange(): void {
    const mode = this.normalizedTargetMode;
    if (mode === 'UnitType' || mode === 'ChildUnitByType' || mode === 'SpecificUnit') {
      this.loadUnitsForCurrentTarget();
    }

    if (mode === 'Position') {
      this.loadPositionsForCurrentTarget();
    }

    if (mode === 'CommitteeMembers') {
      this.targetForm.patchValue({ allowMultipleReceivers: true });
      if (!this.users.length) {
        this.routingController.getOracleUsers(true).subscribe({
          next: response => {
            if (response?.isSuccess) {
              this.users = [...(response.data ?? [])];
            }
          }
        });
      }
    }
  }

  private handleUnitTypeChange(): void {
    const mode = this.normalizedTargetMode;
    if (mode === 'UnitType' || mode === 'ChildUnitByType' || mode === 'SpecificUnit') {
      this.loadUnitsForCurrentTarget();
    }
  }

  private handleOrgUnitChange(): void {
    if (this.normalizedTargetMode === 'Position') {
      this.loadPositionsForCurrentTarget();
    }
  }

  private loadUnitsForCurrentTarget(): void {
    const unitTypeId = this.toNullableNumber(this.targetForm.get('oracleUnitTypeId')?.value) ?? undefined;
    this.loadingUnits = true;
    this.routingController.getOracleUnits({ unitTypeId, activeOnly: true }).subscribe({
      next: response => {
        if (!response?.isSuccess) {
          this.units = [];
          return;
        }

        this.units = [...(response.data ?? [])];
      },
      error: () => {
        this.units = [];
      },
      complete: () => { this.loadingUnits = false; }
    });
  }

  private loadPositionsForCurrentTarget(): void {
    const unitId = this.toNullableNumber(this.targetForm.get('oracleOrgUnitId')?.value) ?? undefined;
    this.loadingPositions = true;
    this.routingController.getOraclePositions({ unitId, activeOnly: true }).subscribe({
      next: response => {
        if (!response?.isSuccess) {
          this.positions = [];
          return;
        }

        this.positions = [...(response.data ?? [])];
      },
      error: () => {
        this.positions = [];
      },
      complete: () => { this.loadingPositions = false; }
    });
  }

  private prepareBasicForNewProfile(): void {
    this.basicForm.reset(
      {
        nameAr: '',
        descriptionAr: '',
        directionMode: 'Both',
        versionNo: 1,
        startStepId: null,
        profileIsActive: true,
        routingEnabled: false,
        isDefault: true,
        appliesToInbound: true,
        appliesToOutbound: true
      },
      { emitEvent: false }
    );
  }

  private prepareStepForCreate(): void {
    const maxOrder = this.steps.reduce((max, step) => Math.max(max, step.stepOrder), 0);
    this.editingStepId = null;
    this.stepForm.reset(
      {
        stepCode: '',
        stepNameAr: '',
        stepType: 'Review',
        stepOrder: maxOrder + 1,
        isStart: this.steps.length === 0,
        isEnd: false,
        slaHours: null,
        isActive: true,
        notesAr: ''
      },
      { emitEvent: false }
    );
  }

  private prepareTargetForCreate(): void {
    const defaultStepId = this.steps[0]?.id ?? null;
    this.editingTargetId = null;
    this.selectedTargetNodeLabelAr = '';
    this.selectedTargetNodeSecondaryLabelAr = '';
    this.targetTreeSelection = null;
    this.targetForm.reset(
      {
        routingStepId: defaultStepId,
        targetMode: 'SpecificUnit',
        oracleUnitTypeId: null,
        oracleOrgUnitId: null,
        positionId: null,
        positionCode: '',
        selectedNodeType: null,
        selectedNodeNumericId: null,
        selectedNodeUserId: '',
        audienceResolutionMode: null,
        workDistributionMode: 'SharedInbox',
        allowMultipleReceivers: false,
        sendToLeaderOnly: false,
        isActive: true,
        notesAr: ''
      },
      { emitEvent: false }
    );
  }

  private prepareTransitionForCreate(): void {
    const maxOrder = this.transitions.reduce((max, item) => Math.max(max, item.displayOrder), 0);
    const firstStepId = this.steps[0]?.id ?? null;
    const secondStepId = this.steps.length > 1 ? this.steps[1].id : null;
    this.editingTransitionId = null;
    this.transitionForm.reset(
      {
        fromStepId: firstStepId,
        toStepId: secondStepId,
        actionCode: '',
        actionNameAr: '',
        displayOrder: maxOrder + 1,
        requiresComment: false,
        requiresMandatoryFieldsCompletion: false,
        isRejectPath: false,
        isReturnPath: false,
        isEscalationPath: false,
        conditionExpression: '',
        isActive: true
      },
      { emitEvent: false }
    );
  }

  private refreshDerivedViews(): void {
    if (!this.selectedProfileId) {
      this.resetPreviewState();
      return;
    }

    this.onRefreshPreview(true);
    this.onValidateProfile(true);
  }

  private rebuildPreviewVisualization(): void {
    if (!this.preview) {
      this.resetPreviewState();
      return;
    }

    this.previewPanel = this.buildPreviewPanel(this.preview);
    this.rebuildPreviewGraph(this.preview);
  }

  private buildPreviewPanel(preview: SubjectRoutingPreviewDto): PreviewPanelModel {
    const nodes = [...(preview.nodes ?? [])];
    const edges = [...(preview.edges ?? [])];
    const nodesById = new Map(nodes.map(item => [item.stepId, item]));
    const startNode = (preview.startStepId != null ? nodesById.get(preview.startStepId) : null)
      ?? nodes.find(item => item.isStart)
      ?? nodes.sort((a, b) => (a.stepOrder - b.stepOrder) || (a.stepId - b.stepId))[0]
      ?? null;

    const firstActions = startNode == null
      ? []
      : edges
        .filter(item => item.fromStepId === startNode.stepId)
        .sort((a, b) => (a.displayOrder - b.displayOrder) || (a.transitionId - b.transitionId))
        .map(item => this.normalizeText(item.actionNameAr))
        .filter((value): value is string => value != null);

    const resolveNames = (stepIds: number[]): string[] => {
      return stepIds
        .map(stepId => this.normalizeText(nodesById.get(stepId)?.stepNameAr))
        .filter((value): value is string => value != null)
        .filter((value, index, source) => source.indexOf(value) === index);
    };

    const endSteps = nodes
      .filter(item => item.isEnd)
      .map(item => this.normalizeText(item.stepNameAr))
      .filter((value): value is string => value != null);
    const rejectSteps = resolveNames(edges.filter(item => item.isRejectPath).map(item => item.toStepId));
    const returnSteps = resolveNames(edges.filter(item => item.isReturnPath).map(item => item.toStepId));
    const escalationSteps = resolveNames(edges.filter(item => item.isEscalationPath).map(item => item.toStepId));
    const stepsWithTargets = nodes.filter(item => {
      const summary = this.normalizeText(item.targetsSummaryAr) ?? '';
      return !summary.includes('لا توجد جهة مستهدفة');
    }).length;
    const targetCoveragePercent = nodes.length > 0
      ? Math.round((stepsWithTargets / nodes.length) * 100)
      : 0;

    return {
      profileSummary: this.normalizeText(preview.summaryAr) ?? 'لا يوجد ملخص نصي للمسار بعد.',
      totalSteps: nodes.length,
      totalTransitions: edges.length,
      targetCoveragePercent,
      validationErrors: this.validationResult?.errors?.length ?? 0,
      validationWarnings: this.validationResult?.warnings?.length ?? 0,
      startStepName: this.normalizeText(startNode?.stepNameAr) ?? 'غير محددة',
      firstTargetSummary: this.normalizeText(startNode?.targetsSummaryAr) ?? 'لا توجد جهة بداية واضحة',
      firstActions,
      endSteps,
      rejectSteps,
      returnSteps,
      escalationSteps
    };
  }

  private rebuildPreviewGraph(preview: SubjectRoutingPreviewDto): void {
    const nodes = [...(preview.nodes ?? [])].sort((a, b) => (a.stepOrder - b.stepOrder) || (a.stepId - b.stepId));
    const edges = [...(preview.edges ?? [])].sort((a, b) => (a.displayOrder - b.displayOrder) || (a.transitionId - b.transitionId));
    if (nodes.length === 0) {
      this.previewGraphNodes = [];
      this.previewGraphEdges = [];
      this.previewGraphWidth = 980;
      this.previewGraphHeight = 380;
      return;
    }

    const levels = this.computeStepLevels(nodes, edges, preview.startStepId);
    const levelValues = Array.from(levels.values());
    const maxLevel = levelValues.length > 0 ? Math.max(...levelValues) : 0;

    const rowsByLevel = new Map<number, SubjectRoutingPreviewNodeDto[]>();
    for (const node of nodes) {
      const level = levels.get(node.stepId) ?? 0;
      const bucket = rowsByLevel.get(level) ?? [];
      bucket.push(node);
      rowsByLevel.set(level, bucket);
    }

    for (const bucket of rowsByLevel.values()) {
      bucket.sort((a, b) => (a.stepOrder - b.stepOrder) || (a.stepId - b.stepId));
    }

    const nodeWidth = 286;
    const nodeHeight = 118;
    const horizontalGap = 108;
    const verticalGap = 30;
    const padding = 36;
    const maxRows = Math.max(...Array.from(rowsByLevel.values()).map(items => items.length), 1);
    const contentHeight = (maxRows * nodeHeight) + ((maxRows - 1) * verticalGap);

    this.previewGraphWidth = Math.max(980, (padding * 2) + ((maxLevel + 1) * nodeWidth) + (maxLevel * horizontalGap));
    this.previewGraphHeight = Math.max(380, (padding * 2) + contentHeight);

    const positions = new Map<number, { x: number; y: number; width: number; height: number }>();
    const graphNodes: PreviewGraphNode[] = [];

    for (const [level, bucket] of rowsByLevel.entries()) {
      const columnIndex = maxLevel - level;
      const x = padding + (columnIndex * (nodeWidth + horizontalGap));
      const columnHeight = (bucket.length * nodeHeight) + ((Math.max(bucket.length - 1, 0)) * verticalGap);
      const verticalOffset = Math.max(0, (contentHeight - columnHeight) / 2);
      bucket.forEach((node, rowIndex) => {
        const y = padding + verticalOffset + (rowIndex * (nodeHeight + verticalGap));
        positions.set(node.stepId, { x, y, width: nodeWidth, height: nodeHeight });

        const cssClass = [
          'preview-node',
          node.isStart ? 'is-start' : '',
          node.isEnd ? 'is-end' : '',
          node.isRejectStep ? 'is-reject' : '',
          node.isReturnStep ? 'is-return' : '',
          node.isEscalationStep ? 'is-escalation' : '',
          this.selectedPreviewStepId === node.stepId ? 'is-selected' : ''
        ].filter(Boolean).join(' ');
        const badges: Array<{ label: string; cssClass: string }> = [];
        if (node.isStart) {
          badges.push({ label: 'بداية', cssClass: 'is-start' });
        }

        if (node.isEnd) {
          badges.push({ label: 'نهاية', cssClass: 'is-end' });
        }

        if (node.isRejectStep) {
          badges.push({ label: 'رفض', cssClass: 'is-reject' });
        }

        if (node.isReturnStep) {
          badges.push({ label: 'إعادة', cssClass: 'is-return' });
        }

        if (node.isEscalationStep) {
          badges.push({ label: 'تصعيد', cssClass: 'is-escalation' });
        }

        graphNodes.push({
          stepId: node.stepId,
          x,
          y,
          width: nodeWidth,
          height: nodeHeight,
          title: node.stepNameAr,
          subtitle: this.normalizeText(node.targetsSummaryAr) ?? 'لا توجد جهة مستهدفة',
          stepType: node.stepType,
          isStart: node.isStart,
          isEnd: node.isEnd,
          isRejectStep: node.isRejectStep,
          isReturnStep: node.isReturnStep,
          isEscalationStep: node.isEscalationStep,
          badges,
          cssClass
        });
      });
    }

    const graphEdges: PreviewGraphEdge[] = [];
    for (const edge of edges) {
      const from = positions.get(edge.fromStepId);
      const to = positions.get(edge.toStepId);
      if (!from || !to) {
        continue;
      }

      const pathInfo = this.buildEdgePath(from, to);
      const cssClass = [
        'preview-edge',
        edge.isRejectPath ? 'is-reject' : '',
        edge.isReturnPath ? 'is-return' : '',
        edge.isEscalationPath ? 'is-escalation' : '',
        this.selectedPreviewTransitionId === edge.transitionId ? 'is-selected' : ''
      ].filter(Boolean).join(' ');

      let flagLabel = '';
      if (edge.isRejectPath) {
        flagLabel = 'رفض';
      } else if (edge.isReturnPath) {
        flagLabel = 'إعادة';
      } else if (edge.isEscalationPath) {
        flagLabel = 'تصعيد';
      }

      graphEdges.push({
        transitionId: edge.transitionId,
        fromStepId: edge.fromStepId,
        toStepId: edge.toStepId,
        actionNameAr: edge.actionNameAr,
        path: pathInfo.path,
        labelX: pathInfo.labelX,
        labelY: pathInfo.labelY,
        cssClass,
        flagLabel
      });
    }

    this.previewGraphNodes = graphNodes;
    this.previewGraphEdges = graphEdges;
  }

  private computeStepLevels(
    nodes: SubjectRoutingPreviewNodeDto[],
    edges: SubjectRoutingPreviewEdgeDto[],
    startStepId?: number): Map<number, number> {
    const levels = new Map<number, number>();
    const nodesById = new Map(nodes.map(node => [node.stepId, node]));
    const outgoing = new Map<number, number[]>();

    for (const edge of edges) {
      const bucket = outgoing.get(edge.fromStepId) ?? [];
      bucket.push(edge.toStepId);
      outgoing.set(edge.fromStepId, bucket);
    }

    const resolvedStartStep = (startStepId != null && nodesById.has(startStepId))
      ? startStepId
      : (nodes.find(item => item.isStart)?.stepId ?? nodes[0]?.stepId ?? null);

    if (resolvedStartStep != null) {
      levels.set(resolvedStartStep, 0);
      const queue: number[] = [resolvedStartStep];
      while (queue.length > 0) {
        const current = queue.shift()!;
        const currentLevel = levels.get(current) ?? 0;
        const neighbors = outgoing.get(current) ?? [];
        for (const next of neighbors) {
          if (!nodesById.has(next)) {
            continue;
          }

          const nextLevel = currentLevel + 1;
          const assigned = levels.get(next);
          if (assigned == null || nextLevel < assigned) {
            levels.set(next, nextLevel);
            queue.push(next);
          }
        }
      }
    }

    let fallbackLevel = Math.max(...Array.from(levels.values(), value => value), 0);
    for (const node of nodes) {
      if (levels.has(node.stepId)) {
        continue;
      }

      fallbackLevel += 1;
      levels.set(node.stepId, fallbackLevel);
    }

    return levels;
  }

  private buildEdgePath(
    from: { x: number; y: number; width: number; height: number },
    to: { x: number; y: number; width: number; height: number }): { path: string; labelX: number; labelY: number } {
    const fromMidY = from.y + (from.height / 2);
    const toMidY = to.y + (to.height / 2);
    const goesLeft = to.x < from.x;
    const startX = goesLeft ? from.x : from.x + from.width;
    const endX = goesLeft ? to.x + to.width : to.x;

    if (from.x === to.x && from.y === to.y) {
      const loopPath = `M ${startX} ${fromMidY} C ${startX - 70} ${fromMidY - 60}, ${startX + 70} ${fromMidY - 60}, ${startX} ${fromMidY}`;
      return {
        path: loopPath,
        labelX: startX,
        labelY: fromMidY - 68
      };
    }

    const direction = endX >= startX ? 1 : -1;
    const curvature = Math.max(60, Math.abs(endX - startX) * 0.42);
    const control1X = startX + (curvature * direction);
    const control2X = endX - (curvature * direction);
    const path = `M ${startX} ${fromMidY} C ${control1X} ${fromMidY}, ${control2X} ${toMidY}, ${endX} ${toMidY}`;

    return {
      path,
      labelX: (startX + endX) / 2,
      labelY: ((fromMidY + toMidY) / 2) - 8
    };
  }

  private resetPreviewState(): void {
    this.preview = null;
    this.validationResult = null;
    this.previewPanel = null;
    this.previewGraphNodes = [];
    this.previewGraphEdges = [];
    this.previewGraphWidth = 980;
    this.previewGraphHeight = 380;
    this.selectedPreviewStepId = null;
    this.selectedPreviewTransitionId = null;
  }

  private resetAvailabilityState(): void {
    this.availability = null;
    this.loadingAvailability = false;
    this.savingAvailability = false;
    this.validatingAvailabilityNode = false;

    this.availabilityForm.reset(
      {
        availabilityMode: 'Public',
        selectedNodeType: null,
        selectedNodeNumericId: null,
        selectedNodeUserId: ''
      },
      { emitEvent: false }
    );

    this.selectedAvailabilityNodeLabelAr = '';
    this.selectedAvailabilityNodeSecondaryLabelAr = '';
    this.selectedAvailabilityNodePathAr = '';
    this.availabilitySummaryAr = 'متاح لجميع المستخدمين المسجلين.';
    this.availabilityNodeValidationError = '';

    this.availabilityTreeDialogVisible = false;
    this.availabilityTreeNodes = [];
    this.availabilityTreeSelection = null;
    this.availabilityTreeSearchTerm = '';
    this.availabilityTreeIncludeUsers = true;
    this.availabilityTreeLoading = false;
    this.availabilityTreeLoadError = '';
    this.availabilityTreeLoadedOnce = false;
  }

  private emitCompletionProgress(): void {
    this.completionPercentChange.emit(this.mandatoryCompletionPercent);
  }

  private resetWorkspaceOnly(): void {
    this.selectedProfileId = null;
    this.profileWorkspace = null;
    this.binding = null;
    this.steps = [];
    this.targets = [];
    this.transitions = [];
    this.resetPreviewState();
    this.prepareBasicForNewProfile();
    this.prepareStepForCreate();
    this.prepareTargetForCreate();
    this.prepareTransitionForCreate();
    this.emitCompletionProgress();
  }

  private resetAllState(): void {
    this.profiles = [];
    this.unitTypes = [];
    this.units = [];
    this.positions = [];
    this.users = [];
    this.lookupsLoaded = false;
    this.filteredTargetStepId = null;
    this.resetAvailabilityState();
    this.resetWorkspaceOnly();
  }

  private ensureSuccess<T>(response: CommonResponse<T>, fallbackMessage: string): boolean {
    if (response?.isSuccess) {
      return true;
    }

    this.showMessage('error', this.readResponseError(response, fallbackMessage));
    return false;
  }

  private readResponseError<T>(response: CommonResponse<T> | null | undefined, fallbackMessage: string): string {
    const candidate = response?.errors?.find(item => this.normalizeText(item?.message) != null)?.message;
    return this.normalizeText(candidate) ?? fallbackMessage;
  }

  private normalizeText(value: unknown): string | null {
    const normalized = String(value ?? '').trim();
    return normalized.length > 0 ? normalized : null;
  }

  private toNullableNumber(value: unknown): number | null {
    const normalized = Number(value ?? NaN);
    if (!Number.isFinite(normalized)) {
      return null;
    }

    return normalized;
  }

  private normalizeDirectionMode(value: unknown): RoutingDirectionMode {
    const normalized = this.normalizeText(value)?.toLowerCase() ?? '';
    if (normalized === 'none') {
      return 'None';
    }

    if (normalized === 'inboundonly' || normalized === 'inbound') {
      return 'InboundOnly';
    }

    if (normalized === 'outboundonly' || normalized === 'outbound') {
      return 'OutboundOnly';
    }

    return 'Both';
  }

  private showMessage(severity: MessageSeverity, message: string): void {
    this.messageSeverity = severity;
    this.message = message;
  }

  private clearMessage(): void {
    this.message = '';
  }
}
