import { Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges, ViewChild } from '@angular/core';
import { AbstractControl, FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { GenericFormsIsolationProvider, GenericFormsService, GroupInfo } from 'src/app/Modules/GenericComponents/GenericForms.service';
import { GenericDynamicFormDetailsComponent } from '../../generic-dynamic-form-details/generic-dynamic-form-details.component';
import { CdCategoryMandDto, ListRequestModel, MessageDto, RequestedData, SearchKind, TkmendField } from 'src/app/shared/services/BackendServices/DynamicForm/DynamicForm.dto';
import { DynamicFormController } from 'src/app/shared/services/BackendServices/DynamicForm/DynamicForm.service';
import { ApiException, FileParameter } from 'src/app/shared/services/BackendServices/dto-shared';
import {
  SummerPricingQuoteDto,
  SummerPricingQuoteRequest,
  SummerRequestSummaryDto,
  SummerWaveCapacityDto
} from 'src/app/shared/services/BackendServices/SummerWorkflow/SummerWorkflow.dto';
import { SummerWorkflowController } from 'src/app/shared/services/BackendServices/SummerWorkflow/SummerWorkflow.service';
import { AuthObjectsService } from 'src/app/shared/services/helper/auth-objects.service';
import { MsgsService } from 'src/app/shared/services/helper/msgs.service';
import { SpinnerService } from 'src/app/shared/services/helper/spinner.service';
import { SummerDestinationConfig } from '../summer-requests-workspace.config';
import { SummerDynamicFormEngineService } from '../summer-dynamic-form-engine.service';
import { ComponentConfig, getConfigByRoute } from 'src/app/shared/models/Component.Config.model';
import { ComponentConfigService } from 'src/app/Modules/admins/services/component-config.service';
import {
  SUMMER_DEFAULT_SEASON_YEAR,
  SUMMER_DYNAMIC_APPLICATION_ID
} from '../../summer-shared/core/summer-feature.config';
import { SUMMER_CANONICAL_FIELD_KEYS } from '../../summer-shared/core/summer-field-aliases';
import { SUMMER_UI_TEXTS_AR } from '../../summer-shared/core/summer-ui-texts.ar';
import {
  isValidSummerCompanionName,
  normalizeSummerCompanionName
} from '../../summer-shared/core/summer-companion-name.policy';
import { deriveStayModeControlPolicy } from '../../summer-shared/core/summer-pricing-ui-rules';
import { SummerRequestsRealtimeService } from '../../summer-shared/core/summer-requests-realtime.service';
import { SummerCapacityRealtimeEvent } from '../../summer-shared/core/summer-realtime-event.models';
import {
  canRegisterForSummerDestination,
  filterSummerDestinationsForBooking,
  SUMMER_DESTINATION_ACCESS_DENIED_MESSAGE
} from '../../summer-shared/core/summer-destination-access.policy';
import Swal from 'sweetalert2';

type OwnerDefaults = {
  name: string;
  fileNumber: string;
  nationalId: string;
  phone: string;
  extraPhone: string;
};

type SummerPaymentMode = 'CASH' | 'INSTALLMENT';

type SummerInstallmentPlanItem = {
  installmentNo: number;
  amount: number;
  isPaid: boolean;
  paidAtLocal: string;
};

const SUMMER_PAYMENT_MODE_CASH: SummerPaymentMode = 'CASH';
const SUMMER_PAYMENT_MODE_INSTALLMENT: SummerPaymentMode = 'INSTALLMENT';
const SUMMER_INSTALLMENTS_MIN_COUNT = 2;
const SUMMER_INSTALLMENTS_MAX_COUNT = 7;
const SUMMER_INSTALLMENTS_DEFAULT_COUNT = 7;
const SUMMER_INSTALLMENT_TAIL_COUNT = 6;
const SUMMER_PAYMENT_MODE_FIELD_KEYS = ['Summer_PaymentMode', 'SUM2026_PaymentMode', 'PaymentMode'] as const;
const SUMMER_INSTALLMENT_COUNT_FIELD_KEYS = ['Summer_PaymentInstallmentCount', 'SUM2026_PaymentInstallmentCount'] as const;
const SUMMER_INSTALLMENTS_TOTAL_FIELD_KEYS = ['Summer_PaymentInstallmentsTotal', 'SUM2026_PaymentInstallmentsTotal'] as const;

function resolveInstallmentAmountFieldKeys(installmentNo: number): string[] {
  return [
    `Summer_PaymentInstallment${installmentNo}Amount`,
    `SUM2026_PaymentInstallment${installmentNo}Amount`
  ];
}

function resolveInstallmentPaidFieldKeys(installmentNo: number): string[] {
  return [
    `Summer_PaymentInstallment${installmentNo}Paid`,
    `SUM2026_PaymentInstallment${installmentNo}Paid`
  ];
}

function resolveInstallmentPaidAtFieldKeys(installmentNo: number): string[] {
  return [
    `Summer_PaymentInstallment${installmentNo}PaidAtUtc`,
    `SUM2026_PaymentInstallment${installmentNo}PaidAtUtc`
  ];
}

@Component({
  selector: 'app-summer-dynamic-booking-builder',
  templateUrl: './summer-dynamic-booking-builder.component.html',
  styleUrls: ['./summer-dynamic-booking-builder.component.scss'],
  providers: [GenericFormsIsolationProvider, SummerDynamicFormEngineService]
})
export class SummerDynamicBookingBuilderComponent implements OnInit, OnChanges, OnDestroy {
  @Input() destinations: SummerDestinationConfig[] = [];
  @Input() seasonYear = SUMMER_DEFAULT_SEASON_YEAR;
  @Input() applicationId = SUMMER_DYNAMIC_APPLICATION_ID;
  @Input() configRouteKey = 'admins/summer-requests/dynamic-booking';
  @Input() editRequestId: number | null = null;
  @Output() bookingCreated = new EventEmitter<number>();

  @ViewChild(GenericDynamicFormDetailsComponent) formDetailsRef?: GenericDynamicFormDetailsComponent;

  formConfig: ComponentConfig;
  messageDto: MessageDto = {} as MessageDto;
  ticketForm: FormGroup;
  customFilteredCategoryMand: CdCategoryMandDto[] = [];
  fileParameters: FileParameter[] = [];
  bookingValidationAlerts: string[] = [];

  selectedDestinationId: number | null = null;
  resolvedApplicationId = SUMMER_DYNAMIC_APPLICATION_ID;
  loadingMetadata = false;
  metadataLoaded = false;
  metadataError = '';
  submitting = false;
  isEditMode = false;
  loadingEditRequest = false;
  editRequestError = '';
  hasEditChanges = false;
  canUseProxyRegistration = false;
  canSelectMembershipType = false;
  canUseFrozenUnitsInCurrentFlow = false;
  hasSummerGeneralManagerPermission = false;

  bookingCapacityLoading = false;
  bookingWaveCapacities: SummerWaveCapacityDto[] = [];
  includeFrozenUnitsInBooking = false;
  membershipTypeValue = 'WORKER_MEMBER';
  paymentModeValue: SummerPaymentMode = SUMMER_PAYMENT_MODE_CASH;
  installmentCountValue = SUMMER_INSTALLMENTS_DEFAULT_COUNT;
  installmentPlan: SummerInstallmentPlanItem[] = [];
  installmentPlanError = '';
  pricingQuoteLoading = false;
  pricingQuoteError = '';
  pricingQuote: SummerPricingQuoteDto | null = null;
  myRequests: SummerRequestSummaryDto[] = [];
  readonly destinationAccessDeniedMessage = SUMMER_DESTINATION_ACCESS_DENIED_MESSAGE;
  readonly membershipTypeOptions: Array<{ label: string; value: string }> = [
    { label: 'عضو عامل', value: 'WORKER_MEMBER' },
    { label: 'عضو غير عامل', value: 'NON_WORKER_MEMBER' }
  ];
  readonly paymentModeOptions: Array<{ label: string; value: SummerPaymentMode }> = [
    { label: 'كاش', value: SUMMER_PAYMENT_MODE_CASH },
    { label: 'تقسيط', value: SUMMER_PAYMENT_MODE_INSTALLMENT }
  ];

  private readonly subscriptions = new Subscription();
  private baseFormConfig: ComponentConfig;
  private pendingEditRequestId: number | null = null;
  private loadedEditRequestId: number | null = null;
  private initialEditSignature = '';
  private lastProxyEnabled = false;
  private lastPricingQuoteKey = '';
  private installmentPlanAutoGenerated = true;
  private activeCompanionRelationLimitAlerts = new Set<string>();

  constructor(
    private readonly fb: FormBuilder,
    public readonly genericFormService: GenericFormsService,
    private readonly dynamicFormController: DynamicFormController,
    private readonly summerWorkflowController: SummerWorkflowController,
    private readonly componentConfigService: ComponentConfigService,
    private readonly authObjectsService: AuthObjectsService,
    private readonly msg: MsgsService,
    private readonly spinner: SpinnerService,
    private readonly summerRealtimeService: SummerRequestsRealtimeService,
    private readonly engine: SummerDynamicFormEngineService
  ) {
    this.baseFormConfig = this.engine.createFormConfig();
    this.formConfig = new ComponentConfig({
      ...this.baseFormConfig
    });
    this.ticketForm = this.fb.group({});
    this.installmentPlan = this.createInstallmentPlanWithEqualDistribution(
      0,
      this.installmentCountValue
    );
  }

  ngOnInit(): void {
    this.refreshProxyModeAccess();
    this.syncMembershipTypeAccessAndDefaults();
    this.resolvedApplicationId = this.applicationId;
    this.resolveEditMode();
    this.applyFormModeConfig();
    this.bindSignalRefresh();
    this.initializeFromComponentConfig();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['applicationId']) {
      this.resolvedApplicationId = this.applicationId;
    }

    if (changes['editRequestId']) {
      this.resolveEditMode();
      this.applyFormModeConfig();
    }

    if (changes['destinations'] || changes['editRequestId']) {
      this.tryLoadEditRequest();
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  get selectedDestination(): SummerDestinationConfig | undefined {
    if (!this.selectedDestinationId) {
      return undefined;
    }
    return this.destinations.find(item => item.categoryId === this.selectedDestinationId);
  }

  get destinationSelectionOptions(): SummerDestinationConfig[] {
    if (this.isEditMode) {
      return this.destinations;
    }

    return filterSummerDestinationsForBooking(this.destinations, this.canUseProxyRegistration);
  }

  get bookingCapacitySummary(): SummerWaveCapacityDto[] {
    return [...this.bookingWaveCapacities].sort((a, b) => a.familyCount - b.familyCount);
  }

  get canUseFrozenUnitsToggle(): boolean {
    return this.canUseFrozenUnitsInCurrentFlow;
  }

  get includeFrozenUnitsForApi(): boolean {
    return this.canUseFrozenUnitsToggle && this.includeFrozenUnitsInBooking;
  }

  get selectedMembershipType(): string {
    return this.membershipTypeValue;
  }

  get selectedPaymentMode(): SummerPaymentMode {
    return this.paymentModeValue;
  }

  get isInstallmentMode(): boolean {
    return this.paymentModeValue === SUMMER_PAYMENT_MODE_INSTALLMENT;
  }

  get selectedInstallmentCount(): number {
    return this.normalizeInstallmentCount(this.installmentCountValue);
  }

  get canEditInstallmentPlanManually(): boolean {
    return this.hasSummerGeneralManagerPermission;
  }

  get canEditPaymentPlanSettings(): boolean {
    return !this.isEditMode || this.hasSummerGeneralManagerPermission;
  }

  get canManageInstallmentPaymentState(): boolean {
    return this.hasSummerGeneralManagerPermission;
  }

  get installmentPlanTotalAmount(): number {
    return this.roundToTwoDecimals(
      this.installmentPlan.reduce((sum, installment) => sum + this.normalizeInstallmentAmount(installment.amount), 0)
    );
  }

  get submitDisabled(): boolean {
    if (this.isEditMode && !this.hasEditChanges) {
      return true;
    }

    if (this.canSelectMembershipType && !this.hasValidMembershipSelection()) {
      return true;
    }

    return false;
  }

  private get isAdminEditOverrideActive(): boolean {
    return this.isEditMode && this.canUseProxyRegistration;
  }

  onMembershipTypeChanged(value: string | null | undefined): void {
    if (!this.canSelectMembershipType) {
      this.membershipTypeValue = 'WORKER_MEMBER';
      return;
    }

    const normalized = this.normalizeMembershipType(String(value ?? ''));
    this.membershipTypeValue = normalized;
    this.loadPricingQuote();
    this.updateEditChangeState();
  }

  onPaymentModeChanged(value: string | null | undefined): void {
    if (!this.canEditPaymentPlanSettings) {
      return;
    }

    const normalized = this.normalizePaymentMode(String(value ?? ''));
    if (normalized === this.paymentModeValue) {
      return;
    }

    this.paymentModeValue = normalized;
    this.installmentPlanError = '';

    if (this.paymentModeValue === SUMMER_PAYMENT_MODE_INSTALLMENT) {
      this.installmentCountValue = SUMMER_INSTALLMENTS_DEFAULT_COUNT;
      this.installmentPlan = this.createInstallmentPlanWithEqualDistribution(
        this.getPricingGrandTotal(),
        this.installmentCountValue
      );
      this.installmentPlanAutoGenerated = true;
      this.validateInstallmentPlan(false);
    } else {
      this.resetInstallmentPlanValues(false);
    }

    this.updateEditChangeState();
  }

  onInstallmentCountChanged(value: number | string | null | undefined): void {
    if (!this.canEditPaymentPlanSettings) {
      return;
    }

    const normalizedCount = this.normalizeInstallmentCount(value);
    if (normalizedCount === this.installmentCountValue) {
      return;
    }

    this.installmentCountValue = normalizedCount;
    if (this.isInstallmentMode) {
      this.installmentPlan = this.createInstallmentPlanWithEqualDistribution(
        this.getPricingGrandTotal(),
        normalizedCount
      );
      this.installmentPlanAutoGenerated = true;
      this.validateInstallmentPlan(false);
    }

    this.updateEditChangeState();
  }

  onInstallmentAmountChanged(installmentNo: number, rawValue: string | number | null | undefined): void {
    if (!this.canEditInstallmentPlanManually) {
      return;
    }

    const target = this.installmentPlan.find(item => item.installmentNo === installmentNo);
    if (!target) {
      return;
    }

    target.amount = this.normalizeInstallmentAmount(rawValue);
    this.installmentPlanAutoGenerated = false;
    this.validateInstallmentPlan();
    this.updateEditChangeState();
  }

  onInstallmentPaidChanged(installmentNo: number, value: boolean): void {
    if (!this.canManageInstallmentPaymentState) {
      return;
    }

    const target = this.installmentPlan.find(item => item.installmentNo === installmentNo);
    if (!target) {
      return;
    }

    target.isPaid = Boolean(value);
    if (!target.isPaid) {
      target.paidAtLocal = '';
    }
    this.updateEditChangeState();
  }

  onInstallmentPaidAtChanged(installmentNo: number, localDateTime: string | null | undefined): void {
    if (!this.canManageInstallmentPaymentState) {
      return;
    }

    const target = this.installmentPlan.find(item => item.installmentNo === installmentNo);
    if (!target) {
      return;
    }

    target.paidAtLocal = String(localDateTime ?? '').trim();
    this.updateEditChangeState();
  }

  onDestinationChanged(
    value: string | number | null,
    options?: { preserveMessageFields?: boolean; resetFiles?: boolean; preservePaymentPlan?: boolean }
  ): void {
    const categoryId = Number(value);
    this.selectedDestinationId = Number.isFinite(categoryId) && categoryId > 0 ? categoryId : null;
    this.bookingValidationAlerts = [];
    this.activeCompanionRelationLimitAlerts.clear();
    this.bookingWaveCapacities = [];
    this.pricingQuote = null;
    this.pricingQuoteError = '';
    this.pricingQuoteLoading = false;
    this.lastPricingQuoteKey = '';
    if (options?.resetFiles !== false) {
      this.fileParameters = [];
    }
    this.ticketForm = this.fb.group({});
    this.genericFormService.dynamicGroups = [];
    this.lastProxyEnabled = false;
    this.editRequestError = '';
    if (options?.preservePaymentPlan !== true) {
      this.resetPaymentPlanState();
    }
    if (!this.isEditMode) {
      this.hasEditChanges = false;
      this.initialEditSignature = '';
    }

    const destination = this.selectedDestination;
    if (!destination) {
      this.customFilteredCategoryMand = [];
      if (!this.isEditMode && this.selectedDestinationId) {
        this.resetUnavailableDestinationSelection();
        this.showDestinationAccessDeniedMessage();
      }
      return;
    }

    if (!this.isEditMode && !this.canRegisterForDestination(destination)) {
      this.resetUnavailableDestinationSelection();
      this.showDestinationAccessDeniedMessage();
      return;
    }

    this.engine.applyDestinationSelections(this.genericFormService, destination);

    const allMendFields = (this.genericFormService.cdmendDto ?? [])
      .map(item => ({
        name: String(item.cdmendTxt ?? '').trim(),
        appId: String(item.applicationId ?? '').trim().toLowerCase()
      }))
      .filter(item => item.name.length > 0);

    const targetAppId = String(this.resolvedApplicationId ?? '').trim().toLowerCase();
    const appScopedMendFields = allMendFields
      .filter(item => targetAppId.length > 0 && item.appId === targetAppId)
      .map(item => item.name);

    const allMendFieldNames = allMendFields.map(item => item.name);
    const primaryAvailableMendFields = appScopedMendFields.length > 0 ? appScopedMendFields : allMendFieldNames;

    let filtered = this.engine.filterCategoryFields(
      this.genericFormService.cdCategoryMandDto ?? [],
      destination.categoryId,
      this.resolvedApplicationId,
      primaryAvailableMendFields
    );

    if (!filtered.length && appScopedMendFields.length > 0) {
      filtered = this.engine.filterCategoryFields(
        this.genericFormService.cdCategoryMandDto ?? [],
        destination.categoryId,
        this.resolvedApplicationId,
        allMendFieldNames
      );
    }

    filtered = this.filterRestrictedFields(filtered);
    this.customFilteredCategoryMand = filtered;

    if (!this.customFilteredCategoryMand.length) {
      this.msg.msgError(
        'بيانات غير مكتملة',
        '<h5>لا توجد حقول مرتبطة بالمصيف المختار ضمن معرّف التطبيق الحالي (ApplicationID).</h5>',
        true
      );
      return;
    }

    const preserveMessageFields = options?.preserveMessageFields === true;
    if (!preserveMessageFields) {
      this.membershipTypeValue = 'WORKER_MEMBER';
    }
    this.messageDto = {
      ...(this.messageDto ?? {}),
      fields: preserveMessageFields ? [...(this.messageDto?.fields ?? [])] : [],
      categoryCd: destination.categoryId
    } as MessageDto;

    setTimeout(() => this.formDetailsRef?.populateForm(), 0);
  }

  onTicketFormChange(form: FormGroup): void {
    this.ticketForm = form;
    this.applyDestinationFieldDefaults();
    this.applyOwnerDefaultMode(this.isEditMode);
    this.syncMembershipTypeAccessAndDefaults();
    this.applySummerBusinessRules();
    this.refreshCompanionRelationLimitAlertsInUi();
    this.updateEditChangeState();
  }

  onGenericEvent(event: { controlFullName?: string }): void {
    const controlFullName = String(event?.controlFullName ?? '').trim();
    if (!controlFullName || !this.ticketForm || !this.selectedDestination) {
      return;
    }

    const baseName = this.engine.parseControlName(controlFullName).base.toLowerCase();

    if (this.matchesAlias(baseName, this.engine.aliases.familyCount) || this.matchesAlias(baseName, this.engine.aliases.extraCount)) {
      this.applySummerBusinessRules();
      this.syncCompanionInstances();
      this.refreshCompanionRelationLimitAlertsInUi();
      return;
    }

    if (this.matchesAlias(baseName, this.engine.aliases.companionRelation)) {
      this.engine.ensureAgeRule(this.ticketForm, this.genericFormService, controlFullName);
      this.engine.ensureRelationOtherRule(this.ticketForm, this.genericFormService, controlFullName);
      this.refreshCompanionRelationLimitAlertsInUi();
      const clearedInvalidRelation = this.clearCompanionRelationSelectionIfLimitExceeded(controlFullName);
      if (clearedInvalidRelation) {
        this.engine.ensureAgeRule(this.ticketForm, this.genericFormService, controlFullName);
        this.engine.ensureRelationOtherRule(this.ticketForm, this.genericFormService, controlFullName);
        this.refreshCompanionRelationLimitAlertsInUi();
      }
      return;
    }

    if (this.matchesAlias(baseName, this.engine.aliases.companionRelationOther)) {
      this.refreshCompanionRelationLimitAlertsInUi();
      return;
    }

    if (this.matchesAlias(baseName, this.engine.aliases.proxyMode)) {
      this.applyOwnerDefaultMode(false);
      return;
    }

    if (this.matchesAlias(baseName, this.engine.aliases.stayMode)) {
      this.loadPricingQuote(true);
      return;
    }

    if (this.matchesAlias(baseName, this.engine.aliases.membershipType)) {
      this.syncMembershipTypeAccessAndDefaults();
      this.loadPricingQuote();
      return;
    }

    if (this.matchesAlias(baseName, this.engine.aliases.waveCode)) {
      this.syncWaveLabel();
      this.loadBookingCapacity();
      this.loadPricingQuote();
    }
  }

  onFileUpload(files: FileParameter[]): void {
    this.fileParameters = [...(files ?? [])];
    this.updateEditChangeState();
  }

  onIncludeFrozenUnitsChanged(value: boolean): void {
    this.includeFrozenUnitsInBooking = this.canUseFrozenUnitsToggle ? Boolean(value) : false;
    this.loadBookingCapacity();
  }

  getCapacityDisplayedAvailableUnits(row: SummerWaveCapacityDto): number {
    const publicAvailableUnits = Number(row?.availableUnits ?? 0) || 0;
    const frozenAvailableUnits = Number(row?.frozenAvailableUnits ?? 0) || 0;
    return this.includeFrozenUnitsForApi
      ? Math.max(0, publicAvailableUnits + frozenAvailableUnits)
      : Math.max(0, publicAvailableUnits);
  }

  getCapacityPublicAvailableUnits(row: SummerWaveCapacityDto): number {
    const exposedAvailableUnits = Number(row?.availableUnits ?? 0) || 0;
    const frozenAvailableUnits = Number(row?.frozenAvailableUnits ?? 0) || 0;
    if (!this.includeFrozenUnitsForApi) {
      return Math.max(0, exposedAvailableUnits);
    }

    return Math.max(0, exposedAvailableUnits - frozenAvailableUnits);
  }

  getCapacityFrozenAvailableUnits(row: SummerWaveCapacityDto): number {
    if (!this.includeFrozenUnitsForApi || !this.canUseFrozenUnitsToggle) {
      return 0;
    }

    return Math.max(0, Number(row?.frozenAvailableUnits ?? 0) || 0);
  }

  getCapacityFrozenAssignedUnits(row: SummerWaveCapacityDto): number {
    if (!this.includeFrozenUnitsForApi || !this.canUseFrozenUnitsToggle) {
      return 0;
    }

    return Math.max(0, Number(row?.frozenAssignedUnits ?? 0) || 0);
  }

  getCapacityNote(row: SummerWaveCapacityDto): string {
    const totalUnits = Number(row?.totalUnits ?? 0) || 0;
    const usedUnits = Number(row?.usedUnits ?? 0) || 0;
    const frozenAvailableUnits = Number(row?.frozenAvailableUnits ?? 0) || 0;
    const frozenAssignedUnits = Number(row?.frozenAssignedUnits ?? 0) || 0;
    const publicAvailableUnits = Number(row?.availableUnits ?? 0) || 0;

    if (this.canUseFrozenUnitsToggle && this.includeFrozenUnitsForApi) {
      return `الإجمالي ${totalUnits} | المستخدم ${usedUnits} | المتاح العام ${publicAvailableUnits} | المجمد ${frozenAvailableUnits} | المجمد المستخدم ${frozenAssignedUnits}`;
    }

    return `المتاح ${publicAvailableUnits} من ${totalUnits} (غير المتاح ${Math.max(0, totalUnits - publicAvailableUnits)})`;
  }

  hasFrozenUnits(row: SummerWaveCapacityDto): boolean {
    if (!this.canUseFrozenUnitsToggle) {
      return false;
    }

    const frozenAvailableUnits = Number(row?.frozenAvailableUnits ?? 0) || 0;
    const frozenAssignedUnits = Number(row?.frozenAssignedUnits ?? 0) || 0;
    return frozenAvailableUnits > 0 || frozenAssignedUnits > 0;
  }

  submitDynamicBooking(form: FormGroup): void {
    this.ticketForm = form;
    this.bookingValidationAlerts = [];
    this.ticketForm.markAllAsTouched();

    const destination = this.selectedDestination;
    if (!destination) {
      this.bookingValidationAlerts = ['يرجى اختيار المصيف أولاً.'];
      this.msg.msgError('خطأ', '<h5>يرجى اختيار المصيف أولاً.</h5>', true);
      return;
    }

    if (!this.isEditMode && !this.canRegisterForDestination(destination)) {
      this.resetUnavailableDestinationSelection();
      this.showDestinationAccessDeniedMessage();
      return;
    }

    const currentMessageId = this.resolveCurrentMessageId();
    if (this.isEditMode && currentMessageId <= 0) {
      this.msg.msgError('خطأ', '<h5>تعذر تحديد رقم الطلب المراد تعديله.</h5>', true);
      return;
    }

    if (this.isEditMode && !this.hasEditChanges) {
      this.msg.msgError('تنبيه', '<h5>لا توجد أي تغييرات لحفظها.</h5>', true);
      return;
    }

    const summary = currentMessageId > 0
      ? this.myRequests.find(item => item.messageId === currentMessageId)
      : undefined;
    if (this.isEditMode && summary && !this.canEditRequest(summary)) {
      const blockedReason = this.getEditBlockedReason(summary);
      this.msg.msgError('غير متاح', `<h5>${blockedReason || 'لا يمكن تعديل هذا الطلب.'}</h5>`, true);
      return;
    }

    const validationAlerts = this.validateBookingRules(destination);
    if (this.ticketForm.invalid || validationAlerts.length > 0) {
      this.bookingValidationAlerts = validationAlerts.length > 0 ? validationAlerts : ['يرجى استكمال الحقول الإلزامية بشكل صحيح.'];
      this.msg.msgError('خطأ', '<h5>يرجى مراجعة قواعد التحقق اعلي الصفحة وإكمال البيانات</h5>', true);
      return;
    }

    const waveCode = this.getStringValue(this.engine.aliases.waveCode);
    const waveLabel = destination.waves.find(w => w.code === waveCode)?.startsAtLabel ?? waveCode;
    const notes = this.getStringValue(this.engine.aliases.notes);
    const employeeFileNumber = this.getStringValue(this.engine.aliases.ownerFileNumber) || 'EMP';
    const employeeName = this.getStringValue(this.engine.aliases.ownerName);
    const nationalId = this.getStringValue(this.engine.aliases.ownerNationalId);
    const phone = this.getStringValue(this.engine.aliases.ownerPhone);
    const extraPhone = this.getStringValue(this.engine.aliases.ownerExtraPhone);
    const familyCount = this.getStringValue(this.engine.aliases.familyCount);
    const extraCount = this.getStringValue(this.engine.aliases.extraCount) || '0';
    const stayMode = this.getStringValue(this.engine.aliases.stayMode);
    const proxyMode = this.canUseProxyRegistration
      ? this.getStringValue(this.engine.aliases.proxyMode)
      : 'false';
    const membershipType = this.resolveMembershipTypeForSubmission();
    const destinationSlug = String(destination.slug ?? '').trim() || `CAT${destination.categoryId}`;
    const generatedRequestRef = `SUMMER-${destinationSlug}-${employeeFileNumber}-${Date.now()}`;
    const requestRef = this.isEditMode
      ? (String(this.messageDto?.requestRef ?? '').trim() || generatedRequestRef)
      : generatedRequestRef;
    const generatedSubject = `طلب حجز ${destination.name} - ${waveCode}`;
    const subject = this.isEditMode
      ? (String(this.messageDto?.subject ?? '').trim() || generatedSubject)
      : generatedSubject;
    const createdBy = this.isEditMode
      ? (String(this.messageDto?.createdBy ?? '').trim() || this.authObjectsService.returnCurrentUser() || localStorage.getItem('UserId') || '')
      : (this.authObjectsService.returnCurrentUser() || localStorage.getItem('UserId') || '');
    const assignedSectorId = this.isEditMode
      ? String(this.messageDto?.assignedSectorId ?? '').trim()
      : '';
    const currentResponsibleSectorId = this.isEditMode
      ? String(this.messageDto?.currentResponsibleSectorId ?? '').trim()
      : '';
    const requestType = this.isEditMode
      ? (Number(this.messageDto?.type ?? 0) || 0)
      : 0;

    this.syncWaveLabel();

    const fields = this.engine.collectRequestFields(
      this.ticketForm,
      this.genericFormService,
      this.genericFormService.dynamicGroups,
      destination.categoryId,
      this.resolvedApplicationId
    );

    this.ensureKeyField(fields, 'RequestRef', requestRef, destination.categoryId);
    this.ensureKeyField(fields, 'Subject', subject, destination.categoryId);
    this.ensureKeyField(fields, 'SummerSeasonYear', String(this.seasonYear), destination.categoryId);
    this.ensureKeyField(fields, 'SummerDestinationId', String(destination.categoryId), destination.categoryId);
    this.ensureKeyField(fields, 'SummerDestinationName', destination.name, destination.categoryId);
    this.ensureKeyField(fields, 'SummerCamp', waveCode, destination.categoryId);
    this.ensureKeyField(fields, 'SummerCampLabel', waveLabel, destination.categoryId);
    this.ensureKeyField(fields, 'Emp_Name', employeeName, destination.categoryId);
    this.ensureKeyField(fields, 'Emp_Id', employeeFileNumber, destination.categoryId);
    this.ensureKeyField(fields, 'NationalId', nationalId, destination.categoryId);
    this.ensureKeyField(fields, 'PhoneNumber', phone, destination.categoryId);
    this.ensureKeyField(fields, 'ExtraPhoneNumber', extraPhone, destination.categoryId);
    this.ensureKeyField(fields, 'FamilyCount', familyCount, destination.categoryId);
    this.ensureKeyField(fields, 'Over_Count', extraCount, destination.categoryId);
    this.ensureKeyField(fields, 'SummerStayMode', stayMode, destination.categoryId);
    this.ensureKeyField(fields, 'SummerProxyMode', proxyMode, destination.categoryId);
    this.ensureKeyField(fields, 'SummerMembershipType', membershipType, destination.categoryId);
    this.ensureKeyField(fields, 'SUM2026_MembershipType', membershipType, destination.categoryId);
    this.ensureKeyField(fields, 'Summer_UseFrozenUnit', this.includeFrozenUnitsForApi ? 'true' : 'false', destination.categoryId);
    this.ensureKeyField(fields, 'SUM2026_UseFrozenUnit', this.includeFrozenUnitsForApi ? 'true' : 'false', destination.categoryId);
    this.ensureKeyField(fields, 'Description', notes, destination.categoryId);
    if (!this.applyPaymentPlanFields(fields, destination.categoryId)) {
      this.bookingValidationAlerts = [this.installmentPlanError || 'تعذر اعتماد خطة السداد الحالية.'];
      this.msg.msgError('خطأ', '<h5>يرجى مراجعة خطة السداد قبل الحفظ.</h5>', true);
      return;
    }

    const unitIds = this.resolveUnitIds();

    this.submitting = true;
    this.spinner.show(this.isEditMode
      ? 'جاري حفظ تعديلات طلب المصيف ...'
      : 'جاري تسجيل طلب المصيف ...');
    this.dynamicFormController.createRequest(
      this.isEditMode ? currentMessageId : 0,
      requestRef,
      subject,
      notes,
      createdBy,
      assignedSectorId,
      unitIds,
      currentResponsibleSectorId,
      requestType,
      destination.categoryId,
      fields as TkmendField[],
      this.fileParameters
    ).subscribe({
      next: response => {
        if (response?.isSuccess) {
          const savedMessageId = Number(response?.data?.messageId ?? currentMessageId);
          const pricingDisplayText = this.extractPricingDisplayText(response?.data?.fields);
          const successMessage = this.isEditMode
            ? (pricingDisplayText.length > 0
              ? `تم حفظ تعديلات الطلب بنجاح.\n${pricingDisplayText}`
              : 'تم حفظ تعديلات الطلب بنجاح')
            : (pricingDisplayText.length > 0
              ? `تم تسجيل الطلب بنجاح.\n${pricingDisplayText}`
              : 'تم تسجيل الطلب بنجاح');
          this.msg.msgSuccess(successMessage, 6500);
          this.bookingValidationAlerts = [];
          this.activeCompanionRelationLimitAlerts.clear();
          this.fileParameters = [];
          this.hasEditChanges = false;
          this.loadMyRequests();
          this.bookingCreated.emit(Number.isFinite(savedMessageId) && savedMessageId > 0 ? savedMessageId : 0);

          if (this.isEditMode) {
            this.loadedEditRequestId = null;
            this.tryLoadEditRequest();
          } else {
            const selected = this.selectedDestinationId;
            this.onDestinationChanged(selected);
          }
        } else {
          if (this.hasBlacklistErrorCode(response?.errors as Array<{ code?: string; message?: string }> | undefined)) {
            this.showBlacklistBlockedModal();
            return;
          }

          const errors = (response?.errors ?? [])
            .map(item => String(item?.message ?? '').trim())
            .filter(item => item.length > 0)
            .join('<br/>');
          this.msg.msgError('خطأ', `<h5>${errors || (this.isEditMode ? 'تعذر حفظ التعديلات.' : 'تعذر تسجيل الطلب.')}</h5>`, true);
        }
      },
      error: (error: unknown) => {
        if (this.resolveHttpStatus(error) === 403) {
          this.showBlacklistBlockedModal();
          return;
        }

        if (this.hasBlacklistErrorCode(this.extractErrorsFromException(error))) {
          this.showBlacklistBlockedModal();
          return;
        }

        this.msg.msgError('خطأ', `<h5>${this.isEditMode ? 'تعذر حفظ تعديلات الطلب حاليًا.' : 'تعذر تسجيل طلب المصيف حاليًا.'}</h5>`, true);
      },
      complete: () => {
        this.spinner.hide();
        this.submitting = false;
      }
    });
  }

  private loadMetadata(): void {
    this.loadingMetadata = true;
    this.metadataError = '';
    this.genericFormService.applicationName = this.resolvedApplicationId;
    this.genericFormService.GetDataMetadata(0).subscribe({
      next: success => {
        if (!success || !this.hasSummerMetadata()) {
          this.loadMetadataFallback();
          return;
        }
        this.metadataLoaded = true;
        this.tryLoadEditRequest();
      },
      error: () => {
        this.loadMetadataFallback();
      },
      complete: () => {
        this.loadingMetadata = false;
      }
    });
  }

  private loadMetadataFallback(): void {
    this.genericFormService.applicationName = '';
    this.genericFormService.GetDataMetadata(0).subscribe({
      next: success => {
        this.metadataLoaded = !!success && this.hasSummerMetadata();
        if (!this.metadataLoaded) {
          this.metadataError = 'تعذر تحميل حقول طلبات المصايف. راجع معرّف التطبيق (ApplicationID) وربط الحقول.';
        } else {
          this.tryLoadEditRequest();
        }
      },
      error: () => {
        this.metadataLoaded = false;
        this.metadataError = 'تعذر تحميل حقول طلبات المصايف. راجع معرّف التطبيق (ApplicationID) وربط الحقول.';
      }
    });
  }

  private hasSummerMetadata(): boolean {
    if (!this.destinations.length) {
      return false;
    }
    const allowedCategories = new Set(this.destinations.map(item => item.categoryId));
    return (this.genericFormService.cdCategoryMandDto ?? []).some(field =>
      allowedCategories.has(Number(field.mendCategory ?? 0))
    );
  }

  private loadMyRequests(): void {
    if (!this.seasonYear) {
      return;
    }
    this.summerWorkflowController.getMyRequests(this.seasonYear).subscribe({
      next: response => {
        this.myRequests = response?.isSuccess && Array.isArray(response.data) ? response.data : [];
        this.tryLoadEditRequest();
      },
      error: () => {
        this.myRequests = [];
        this.tryLoadEditRequest();
      }
    });
  }

  private applyDestinationFieldDefaults(): void {
    const destination = this.selectedDestination;
    if (!destination || !this.ticketForm) {
      return;
    }

    this.setControlValue(this.engine.aliases.destinationId, String(destination.categoryId));
    this.setControlValue(this.engine.aliases.destinationName, destination.name);
    this.setControlValue(this.engine.aliases.seasonYear, String(this.seasonYear));

    const stayModeCtrl = this.engine.resolveControl(this.ticketForm, this.genericFormService, this.engine.aliases.stayMode);
    if (!stayModeCtrl) {
      return;
    }

    if (destination.stayModes.length === 1) {
      stayModeCtrl.setValue(destination.stayModes[0].code, { emitEvent: false });
      stayModeCtrl.disable({ emitEvent: false });
      stayModeCtrl.updateValueAndValidity({ emitEvent: false });
      return;
    }

    stayModeCtrl.enable({ emitEvent: false });
    stayModeCtrl.updateValueAndValidity({ emitEvent: false });
  }

  private applyOwnerDefaultMode(preserveExistingValues = false): void {
    if (!this.ticketForm) {
      return;
    }

    const proxyCtrl = this.engine.resolveControl(this.ticketForm, this.genericFormService, this.engine.aliases.proxyMode);
    if (!this.canUseProxyRegistration && proxyCtrl) {
      proxyCtrl.setValue(false, { emitEvent: false });
      proxyCtrl.disable({ emitEvent: false });
      proxyCtrl.updateValueAndValidity({ emitEvent: false });
    }

    if (proxyCtrl && (proxyCtrl.value === null || proxyCtrl.value === undefined || proxyCtrl.value === '')) {
      proxyCtrl.setValue(false, { emitEvent: false });
    }

    const proxyEnabled = this.canUseProxyRegistration && this.toBoolean(proxyCtrl?.value);
    const proxyJustEnabled = !this.lastProxyEnabled && proxyEnabled;
    const defaults = this.extractOwnerDefaults();

    const ownerControls: Array<{ aliases: string[]; value: string; required: boolean; alwaysEnabled?: boolean }> = [
      { aliases: this.engine.aliases.ownerName, value: defaults.name, required: true },
      { aliases: this.engine.aliases.ownerFileNumber, value: defaults.fileNumber, required: true },
      { aliases: this.engine.aliases.ownerNationalId, value: defaults.nationalId, required: true },
      { aliases: this.engine.aliases.ownerPhone, value: defaults.phone, required: true },
      { aliases: this.engine.aliases.ownerExtraPhone, value: defaults.extraPhone, required: false, alwaysEnabled: true }
    ];

    ownerControls.forEach(item => {
      const control = this.engine.resolveControl(this.ticketForm, this.genericFormService, item.aliases);
      if (!control) {
        return;
      }

      const hasCurrentValue = String(control.value ?? '').trim().length > 0;
      const shouldPreserveCurrentValue = preserveExistingValues && hasCurrentValue;

      const alwaysEnabled = item.alwaysEnabled ?? false;
      if (proxyEnabled || alwaysEnabled) {
        control.enable({ emitEvent: false });
        if (item.required) {
          control.addValidators(Validators.required);
        }
        if (proxyEnabled && proxyJustEnabled && !preserveExistingValues) {
          control.setValue('', { emitEvent: false });
        }
        if (!proxyEnabled && alwaysEnabled && !shouldPreserveCurrentValue) {
          control.setValue(item.value, { emitEvent: false });
        }
      } else {
        if (!shouldPreserveCurrentValue) {
          control.setValue(item.value, { emitEvent: false });
        }
        control.disable({ emitEvent: false });
      }
      control.updateValueAndValidity({ emitEvent: false });
    });

    this.lastProxyEnabled = proxyEnabled;
  }

  private applySummerBusinessRules(): void {
    const destination = this.selectedDestination;
    if (!destination || !this.ticketForm) {
      return;
    }

    this.engine.ensureExtraCountRule(
      this.ticketForm,
      this.genericFormService,
      destination,
      this.canUseProxyRegistration,
      this.isAdminEditOverrideActive
    );
    this.applyAdminEditCapacityOverride();
    this.syncExtraCountValidationMessage(destination);
    this.syncCompanionInstances();
    this.applyCompanionAgeRules();
    this.syncWaveLabel();
    this.loadBookingCapacity();
    this.loadPricingQuote();
  }

  private applyAdminEditCapacityOverride(): void {
    if (!this.isAdminEditOverrideActive || !this.ticketForm) {
      return;
    }

    const familyControl = this.engine.resolveControl(this.ticketForm, this.genericFormService, this.engine.aliases.familyCount);
    if (familyControl) {
      familyControl.enable({ emitEvent: false });
      familyControl.updateValueAndValidity({ emitEvent: false });
    }

    const extraControl = this.engine.resolveControl(this.ticketForm, this.genericFormService, this.engine.aliases.extraCount);
    if (extraControl) {
      extraControl.enable({ emitEvent: false });
      extraControl.setValidators([Validators.min(0)]);
      extraControl.updateValueAndValidity({ emitEvent: false });
    }
  }

  private syncExtraCountValidationMessage(destination: SummerDestinationConfig): void {
    if (!this.ticketForm) {
      return;
    }

    const controlName = this.engine.resolveControlName(this.ticketForm, this.engine.aliases.extraCount);
    if (!controlName) {
      return;
    }

    const maxMessage = `أفراد إضافيون يجب ألا يزيد عن ${destination.maxExtraMembers}`;
    const targetKeys = new Set<string>([
      controlName,
      ...this.engine.aliases.extraCount
    ]);

    this.genericFormService.validationMessages.forEach(item => {
      if (!targetKeys.has(String(item?.key ?? ''))) {
        return;
      }

      const validators = Array.isArray(item.validators) ? item.validators : [];
      const withoutMax = validators.filter(v => String(v?.key ?? '') !== 'max');
      if (!this.canUseProxyRegistration) {
        withoutMax.push({ key: 'max', value: maxMessage });
      }
      item.validators = withoutMax as any;
    });

    const extraCtrl = this.engine.resolveControl(this.ticketForm, this.genericFormService, this.engine.aliases.extraCount);
    if (extraCtrl) {
      extraCtrl.updateValueAndValidity({ emitEvent: false });
    }
  }

  private syncCompanionInstances(): void {
    if (!this.formDetailsRef || !this.ticketForm) {
      return;
    }

    const group = this.engine.findCompanionGroup(this.genericFormService.dynamicGroups);
    if (!group) {
      return;
    }

    if (!group.instanceGroupId) {
      group.instanceGroupId = 1;
    }

    const desired = this.engine.getDesiredCompanionCount(this.ticketForm, this.genericFormService);
    const current = 1 + (group.instances?.length ?? 0);

    if (desired > current) {
      const missing = desired - current;
      for (let i = 0; i < missing; i += 1) {
        this.formDetailsRef.duplicateGroup(group.groupId, group.fields.length);
      }
      return;
    }

    if (desired >= 1 && desired < current) {
      const removeCount = current - desired;
      for (let i = 0; i < removeCount; i += 1) {
        const instances = group.instances ?? [];
        const last = instances[instances.length - 1];
        if (!last) {
          break;
        }
        this.formDetailsRef.deleteGroup(last.groupId);
      }
    }
  }

  private applyCompanionAgeRules(): void {
    if (!this.ticketForm) {
      return;
    }

    for (const control of Object.values(this.ticketForm.controls)) {
      if (!(control instanceof FormArray)) {
        continue;
      }

      for (const rowControl of control.controls) {
        const row = rowControl as FormGroup;
        const controlName = Object.keys(row.controls)[0];
        const base = this.engine.parseControlName(controlName).base.toLowerCase();
        if (this.matchesAlias(base, this.engine.aliases.companionRelation)) {
          this.engine.ensureAgeRule(this.ticketForm, this.genericFormService, controlName);
          this.engine.ensureRelationOtherRule(this.ticketForm, this.genericFormService, controlName);
        }
      }
    }
  }

  private syncWaveLabel(): void {
    const destination = this.selectedDestination;
    if (!destination || !this.ticketForm) {
      return;
    }

    const waveCode = this.getStringValue(this.engine.aliases.waveCode);
    if (!waveCode) {
      return;
    }

    const label = destination.waves.find(item => item.code === waveCode)?.startsAtLabel ?? waveCode;
    this.setControlValue(this.engine.aliases.waveLabel, label);
  }

  private loadBookingCapacity(): void {
    const destination = this.selectedDestination;
    if (!destination || !this.ticketForm) {
      this.bookingWaveCapacities = [];
      return;
    }

    const waveCode = this.getStringValue(this.engine.aliases.waveCode);
    if (!waveCode) {
      this.bookingWaveCapacities = [];
      return;
    }

    this.bookingCapacityLoading = true;
    this.summerWorkflowController.getWaveCapacity(destination.categoryId, waveCode, this.includeFrozenUnitsForApi).subscribe({
      next: response => {
        this.bookingWaveCapacities = response?.isSuccess && Array.isArray(response.data) ? response.data : [];
      },
      error: () => {
        this.bookingWaveCapacities = [];
      },
      complete: () => {
        this.bookingCapacityLoading = false;
      }
    });
  }

  private loadPricingQuote(forceRegenerateInstallmentPlan = false): void {
    const destination = this.selectedDestination;
    if (!destination || !this.ticketForm) {
      this.clearPricingQuote(true);
      return;
    }

    const waveCode = this.getStringValue(this.engine.aliases.waveCode);
    const familyCount = Number(this.getStringValue(this.engine.aliases.familyCount) || 0) || 0;
    const extraCount = Math.max(0, Number(this.getStringValue(this.engine.aliases.extraCount) || 0) || 0);
    const personsCount = familyCount + extraCount;

    if (!waveCode || familyCount <= 0 || personsCount <= 0) {
      this.clearPricingQuote(true);
      return;
    }

    const selectedWave = destination.waves.find(wave => wave.code === waveCode);
    const stayModeControl = this.engine.resolveControl(this.ticketForm, this.genericFormService, this.engine.aliases.stayMode);
    const stayModeValue = this.getStringValue(this.engine.aliases.stayMode);
    const fallbackStayMode = destination.stayModes.length > 0 ? destination.stayModes[0].code : '';
    const requestedStayMode = stayModeValue || fallbackStayMode;
    const isProxyBooking = this.toBoolean(this.getStringValue(this.engine.aliases.proxyMode));
    const membershipType = this.resolveMembershipTypeForSubmission();

    const quoteRequest: SummerPricingQuoteRequest = {
      categoryId: destination.categoryId,
      seasonYear: Number(this.seasonYear) || 0,
      waveCode,
      waveLabel: selectedWave?.startsAtLabel ?? '',
      waveStartsAtIso: selectedWave?.startsAtIso ?? '',
      personsCount,
      familyCount,
      extraCount,
      stayMode: requestedStayMode,
      isProxyBooking,
      membershipType,
      destinationName: destination.name
    };

    const quoteKey = [
      quoteRequest.categoryId,
      quoteRequest.seasonYear,
      quoteRequest.waveCode,
      quoteRequest.waveLabel,
      quoteRequest.personsCount,
      quoteRequest.stayMode,
      quoteRequest.isProxyBooking ? '1' : '0',
      quoteRequest.membershipType ?? ''
    ].join('|');

    if (quoteKey === this.lastPricingQuoteKey && (this.pricingQuoteLoading || !!this.pricingQuote)) {
      return;
    }

    this.lastPricingQuoteKey = quoteKey;
    this.pricingQuoteLoading = true;
    this.pricingQuoteError = '';

    this.summerWorkflowController.getPricingQuote(quoteRequest).subscribe({
      next: response => {
        if (response?.isSuccess && response.data) {
          this.pricingQuote = response.data;
          this.pricingQuoteError = '';
          this.applyPricingQuoteToStayModeControl(response.data, stayModeControl);
          this.syncInstallmentPlanWithPricingQuote(forceRegenerateInstallmentPlan);
          return;
        }

        const errors = (response?.errors ?? [])
          .map(item => String(item?.message ?? '').trim())
          .filter(item => item.length > 0)
          .join(' ');
        this.pricingQuote = null;
        this.pricingQuoteError = errors || 'تعذر حساب التسعير لهذا الاختيار.';
        this.syncInstallmentPlanWithPricingQuote(forceRegenerateInstallmentPlan);
      },
      error: () => {
        this.pricingQuote = null;
        this.pricingQuoteError = 'تعذر حساب التسعير حاليًا. حاول مرة أخرى.';
        this.syncInstallmentPlanWithPricingQuote(forceRegenerateInstallmentPlan);
      },
      complete: () => {
        this.pricingQuoteLoading = false;
      }
    });
  }

  private applyPricingQuoteToStayModeControl(
    quote: SummerPricingQuoteDto,
    stayModeControl: AbstractControl | null
  ): void {
    if (!stayModeControl || !quote) {
      return;
    }

    const stayModesCount = this.selectedDestination?.stayModes?.length ?? 0;
    const policy = deriveStayModeControlPolicy({
      pricingMode: quote.pricingMode,
      transportationMandatory: quote.transportationMandatory,
      normalizedStayMode: quote.normalizedStayMode
    }, stayModesCount);

    if (policy.normalizedStayMode.length > 0 && String(stayModeControl.value ?? '').trim() !== policy.normalizedStayMode) {
      stayModeControl.setValue(policy.normalizedStayMode, { emitEvent: false });
    }

    if (policy.disableControl) {
      stayModeControl.disable({ emitEvent: false });
    } else {
      stayModeControl.enable({ emitEvent: false });
    }

    stayModeControl.updateValueAndValidity({ emitEvent: false });
  }

  private clearPricingQuote(resetStayModeControl: boolean): void {
    this.pricingQuote = null;
    this.pricingQuoteError = '';
    this.pricingQuoteLoading = false;
    this.lastPricingQuoteKey = '';
    this.syncInstallmentPlanWithPricingQuote();

    if (!resetStayModeControl || !this.ticketForm) {
      return;
    }

    const destination = this.selectedDestination;
    const stayModeControl = this.engine.resolveControl(this.ticketForm, this.genericFormService, this.engine.aliases.stayMode);
    if (!stayModeControl || !destination) {
      return;
    }

    if (destination.stayModes.length === 1) {
      stayModeControl.setValue(destination.stayModes[0].code, { emitEvent: false });
      stayModeControl.disable({ emitEvent: false });
    } else {
      stayModeControl.enable({ emitEvent: false });
    }
    stayModeControl.updateValueAndValidity({ emitEvent: false });
  }

  private bindSignalRefresh(): void {
    const signalSub = this.summerRealtimeService.capacityUpdates$.subscribe(update => {
      this.refreshCapacityFromSignal(update);
    });

    this.subscriptions.add(signalSub);
  }

  private refreshCapacityFromSignal(update: SummerCapacityRealtimeEvent): void {
    const destination = this.selectedDestination;
    if (!destination || !this.ticketForm) {
      return;
    }

    const selectedWaveCode = this.getStringValue(this.engine.aliases.waveCode);
    if (!selectedWaveCode) {
      return;
    }

    const categoryId = Number(update?.categoryId ?? 0);
    const waveCode = String(update?.waveCode ?? '').trim();
    if (!Number.isFinite(categoryId) || categoryId <= 0 || waveCode.length === 0) {
      return;
    }

    if (categoryId === destination.categoryId && waveCode === selectedWaveCode) {
      this.loadBookingCapacity();
    }
  }

  private validateBookingRules(destination: SummerDestinationConfig): string[] {
    const alerts: string[] = [];
    const waveCode = this.getStringValue(this.engine.aliases.waveCode);
    const stayMode = this.getStringValue(this.engine.aliases.stayMode);
    const familyCount = Number(this.getStringValue(this.engine.aliases.familyCount) || 0) || 0;
    const extraCount = Number(this.getStringValue(this.engine.aliases.extraCount) || 0) || 0;
    const employeeId = this.getStringValue(this.engine.aliases.ownerFileNumber);
    const currentMessageId = this.resolveCurrentMessageId();

    if (!waveCode) {
      alerts.push('اختيار الفوج مطلوب.');
    }

    if (destination.stayModes.length > 1 && !stayMode) {
      alerts.push('يرجى اختيار نوع الحجز.');
    }

    if (this.canSelectMembershipType && !this.hasValidMembershipSelection()) {
      alerts.push('يرجى اختيار نوع العضوية.');
    }

    const maxFamily = destination.familyOptions.length > 0 ? Math.max(...destination.familyOptions) : 0;
    const bypassCapacityRulesForAdminEdit = this.isAdminEditOverrideActive;
    const isAdminExceedingDestinationLimit =
      this.canUseProxyRegistration && extraCount > Number(destination.maxExtraMembers ?? 0);

    if (maxFamily > 0 && familyCount !== maxFamily && extraCount > 0 && !isAdminExceedingDestinationLimit && !bypassCapacityRulesForAdminEdit) {
      alerts.push(`الأفراد الإضافيون متاحون فقط عند اختيار السعة القصوى (${maxFamily}).`);
    }

    if (!this.canUseProxyRegistration && extraCount > destination.maxExtraMembers) {
      alerts.push(`الحد الأقصى للأفراد الإضافيين في ${destination.name} هو ${destination.maxExtraMembers}.`);
    }

    if (this.isInstallmentMode) {
      if (!this.pricingQuote) {
        alerts.push('يجب حساب التسعير قبل استخدام خيار التقسيط.');
      } else {
        const installmentPlanValidation = this.validateInstallmentPlan(false);
        if (installmentPlanValidation.length > 0) {
          alerts.push(installmentPlanValidation);
        }
      }
    }

    const duplicateActive = this.myRequests.some(request =>
      request.messageId !== currentMessageId &&
      request.categoryId === destination.categoryId &&
      String(request.waveCode ?? '').trim() === waveCode &&
      String(request.employeeId ?? '').trim() === employeeId &&
      String(request.status ?? '').trim().toLowerCase() !== 'rejected'
    );
    if (duplicateActive) {
      alerts.push('لا يمكن تسجيل أكثر من حجز نشط لنفس الموظف في نفس الفوج والمصيف.');
    }

    const companionGroup = this.engine.findCompanionGroup(this.genericFormService.dynamicGroups);
    if (companionGroup && this.ticketForm) {
      const groupsToInspect: GroupInfo[] = [companionGroup, ...(companionGroup.instances ?? [])];
      groupsToInspect.forEach((group, index) => {
        const formArray = this.genericFormService.getFormArray(group.formArrayName, this.ticketForm);
        if (!formArray) {
          return;
        }

        let relation = '';
        let relationOther = '';
        let age = '';
        let companionName = '';
        formArray.controls.forEach(control => {
          const row = control as FormGroup;
          const name = Object.keys(row.controls)[0];
          const base = this.engine.parseControlName(name).base.toLowerCase();
          const controlRef = row.get(name);
          const rawValue = String(controlRef?.value ?? '');
          const value = String(rawValue ?? '').trim();
          if (this.matchesAlias(base, this.engine.aliases.companionName)) {
            const normalizedName = normalizeSummerCompanionName(rawValue);
            companionName = normalizedName;
            if (controlRef && rawValue !== normalizedName) {
              controlRef.setValue(normalizedName, { emitEvent: false });
            }
          }
          if (this.matchesAlias(base, this.engine.aliases.companionRelation)) {
            relation = value;
          }
          if (this.matchesAlias(base, this.engine.aliases.companionRelationOther)) {
            relationOther = value;
          }
          if (this.matchesAlias(base, this.engine.aliases.companionAge)) {
            age = value;
          }
        });

        if (this.engine.isOtherRelation(relation) && relationOther.length === 0) {
          alerts.push(`يرجى إدخال اسم القرابة للمرافق رقم ${index + 1} عند اختيار درجة القرابة "أخرى".`);
        }

        if (this.engine.isChildRelation(relation) && age.length === 0) {
          alerts.push(`سن المرافق رقم ${index + 1} مطلوب عند اختيار درجة القرابة ابن/ابنة.`);
        }

        if (companionName.length > 0 && !isValidSummerCompanionName(companionName)) {
          alerts.push(`${SUMMER_UI_TEXTS_AR.errors.companionNameMinimumThreeParts} (المرافق رقم ${index + 1}).`);
        }
      });
    }

    this.resolveCompanionRelationLimitAlerts()
      .forEach(message => this.pushUniqueValidationAlert(alerts, message));

    return alerts;
  }

  private refreshCompanionRelationLimitAlertsInUi(): void {
    const relationAlerts = this.resolveCompanionRelationLimitAlerts();
    this.notifyNewCompanionRelationLimitAlerts(relationAlerts);
    const relationAlertMessages = new Set(this.getCompanionRelationLimitMessagesList());
    const nonRelationAlerts = (this.bookingValidationAlerts ?? [])
      .filter(alert => !relationAlertMessages.has(String(alert ?? '').trim()));

    this.bookingValidationAlerts = [...nonRelationAlerts, ...relationAlerts];
  }

  private notifyNewCompanionRelationLimitAlerts(relationAlerts: string[]): void {
    const normalizedCurrentAlerts = relationAlerts
      .map(message => String(message ?? '').trim())
      .filter(message => message.length > 0);

    const nextAlertsSet = new Set(normalizedCurrentAlerts);
    normalizedCurrentAlerts.forEach(message => {
      if (!this.activeCompanionRelationLimitAlerts.has(message)) {
        this.msg.msgInfo(message, 'تنبيه', 'warning');
      }
    });

    this.activeCompanionRelationLimitAlerts = nextAlertsSet;
  }

  private clearCompanionRelationSelectionIfLimitExceeded(controlFullName: string): boolean {
    const relationControl = this.genericFormService.GetControl(this.ticketForm, controlFullName);
    if (!relationControl) {
      return false;
    }

    const relation = String(relationControl.value ?? '').trim();
    if (relation.length === 0) {
      return false;
    }

    const relationOther = this.resolveCompanionRelationOtherValueFromSameRow(controlFullName);
    const relationLimitKey = this.resolveCompanionRelationLimitKey(relation, relationOther);
    if (!relationLimitKey) {
      return false;
    }

    const counters = this.resolveCompanionRelationCounters();
    const maxAllowedByRelation: Record<'father' | 'mother' | 'wife', number> = {
      father: 1,
      mother: 1,
      wife: 4
    };

    if ((counters[relationLimitKey] ?? 0) <= maxAllowedByRelation[relationLimitKey]) {
      return false;
    }

    relationControl.setValue(null, { emitEvent: false });
    relationControl.markAsDirty();
    relationControl.markAsTouched();
    relationControl.updateValueAndValidity({ emitEvent: false });
    return true;
  }

  private resolveCompanionRelationOtherValueFromSameRow(controlFullName: string): string {
    if (!this.ticketForm) {
      return '';
    }

    for (const control of Object.values(this.ticketForm.controls)) {
      if (!(control instanceof FormArray)) {
        continue;
      }

      for (const rowControl of control.controls) {
        const row = rowControl as FormGroup;
        if (!row.contains(controlFullName)) {
          continue;
        }

        const relationOtherControlName = Object.keys(row.controls).find(name => {
          const base = this.engine.parseControlName(name).base.toLowerCase();
          return this.matchesAlias(base, this.engine.aliases.companionRelationOther);
        });

        if (!relationOtherControlName) {
          return '';
        }

        return String(row.get(relationOtherControlName)?.value ?? '').trim();
      }
    }

    return '';
  }

  private resolveCompanionRelationLimitAlerts(): string[] {
    const counters = this.resolveCompanionRelationCounters();
    const alerts: string[] = [];
    this.pushCompanionRelationLimitAlerts(alerts, counters);
    return alerts;
  }

  private resolveCompanionRelationCounters(): Record<'father' | 'mother' | 'wife', number> {
    const counters: Record<'father' | 'mother' | 'wife', number> = {
      father: 0,
      mother: 0,
      wife: 0
    };

    const companionGroup = this.engine.findCompanionGroup(this.genericFormService.dynamicGroups);
    if (!companionGroup || !this.ticketForm) {
      return counters;
    }

    const groupsToInspect: GroupInfo[] = [companionGroup, ...(companionGroup.instances ?? [])];
    groupsToInspect.forEach(group => {
      const formArray = this.genericFormService.getFormArray(group.formArrayName, this.ticketForm);
      if (!formArray) {
        return;
      }

      let relation = '';
      let relationOther = '';
      formArray.controls.forEach(control => {
        const row = control as FormGroup;
        const name = Object.keys(row.controls)[0];
        if (!name) {
          return;
        }

        const base = this.engine.parseControlName(name).base.toLowerCase();
        const value = String((row.get(name)?.value ?? '')).trim();
        if (this.matchesAlias(base, this.engine.aliases.companionRelation)) {
          relation = value;
        }
        if (this.matchesAlias(base, this.engine.aliases.companionRelationOther)) {
          relationOther = value;
        }
      });

      const relationLimitKey = this.resolveCompanionRelationLimitKey(relation, relationOther);
      if (relationLimitKey) {
        counters[relationLimitKey] += 1;
      }
    });

    return counters;
  }

  private getCompanionRelationLimitMessages(): Record<'father' | 'mother' | 'wife', string> {
    return {
      father: 'لا يمكن تكرار قرابة الأب أكثر من مرة واحدة.',
      mother: 'لا يمكن تكرار قرابة الأم أكثر من مرة واحدة.',
      wife: 'الحد الأقصى لقرابة الزوجة هو 4 مرافقين.'
    };
  }

  private getCompanionRelationLimitMessagesList(): string[] {
    const messages = this.getCompanionRelationLimitMessages();
    return [messages.father, messages.mother, messages.wife];
  }

  private pushCompanionRelationLimitAlerts(
    alerts: string[],
    counters: Record<'father' | 'mother' | 'wife', number>
  ): void {
    const messages = this.getCompanionRelationLimitMessages();

    if (counters.father > 1) {
      this.pushUniqueValidationAlert(alerts, messages.father);
    }

    if (counters.mother > 1) {
      this.pushUniqueValidationAlert(alerts, messages.mother);
    }

    if (counters.wife > 4) {
      this.pushUniqueValidationAlert(alerts, messages.wife);
    }
  }

  private resolveCompanionRelationLimitKey(
    relation: string,
    relationOther: string
  ): 'father' | 'mother' | 'wife' | '' {
    const effectiveRelation = this.engine.isOtherRelation(relation) ? relationOther : relation;
    const normalized = String(effectiveRelation ?? '')
      .trim()
      .toLowerCase()
      .replace(/[أإآ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/\s+/g, '')
      .replace(/[-_]/g, '');

    if (normalized.length === 0) {
      return '';
    }

    if (normalized === 'اب' || normalized === 'الاب' || normalized === 'father' || normalized === 'dad') {
      return 'father';
    }

    if (normalized === 'ام' || normalized === 'الام' || normalized === 'mother' || normalized === 'mom') {
      return 'mother';
    }

    if (normalized === 'زوجه' || normalized === 'الزوجه' || normalized === 'wife') {
      return 'wife';
    }

    return '';
  }

  private pushUniqueValidationAlert(alerts: string[], message: string): void {
    if (!alerts.includes(message)) {
      alerts.push(message);
    }
  }

  private extractOwnerDefaults(): OwnerDefaults {
    const profile = (this.authObjectsService.getUserProfile() ?? {}) as Record<string, unknown>;
    const fallbackUserId = localStorage.getItem('UserId') ?? '';
    const fallbackName = localStorage.getItem('firstName') ?? '';

    return {
      name: this.coalesceText(
        profile['ArabicName'],
        profile['userDisplayName'],
        profile['name'],
        fallbackName
      ),
      fileNumber: this.coalesceText(
        profile['userId'],
        profile['UserId'],
        fallbackUserId
      ),
      nationalId: this.coalesceText(
        profile['nationalId'],
        profile['NationalId'],
        localStorage.getItem('NationalId')
      ),
      phone: this.coalesceText(
        profile['MobileNumber'],
        profile['PhoneWhats'],
        profile['mobilePhone'],
        profile['phone'],
        localStorage.getItem('MobileNumber')
      ),
      extraPhone: ''
    };
  }

  private resolveUnitIds(): number[] {
    const profile = (this.authObjectsService.getUserProfile() ?? {}) as Record<string, unknown>;
    const units = profile['vwOrgUnitsWithCounts'];
    if (!Array.isArray(units) || units.length === 0) {
      return [0];
    }

    const ids = units
      .map(item => {
        if (item && typeof item === 'object' && 'unitId' in item) {
          const value = Number((item as { unitId?: unknown }).unitId);
          return Number.isFinite(value) ? value : null;
        }
        return null;
      })
      .filter((item): item is number => item !== null);

    return ids.length > 0 ? ids : [0];
  }

  private ensureKeyField(fields: TkmendField[], key: string, value: string, categoryId: number): void {
    const existing = fields.find(field => String(field.fildKind ?? '').trim() === key);
    if (existing) {
      existing.fildTxt = value;
      return;
    }

    fields.push({
      fildSql: fields.length + 1,
      fildRelted: 0,
      fildKind: key,
      fildTxt: value,
      instanceGroupId: 1,
      mendSql: 0,
      mendCategory: categoryId,
      mendStat: false,
      mendGroup: 0,
      applicationId: this.resolvedApplicationId,
      groupName: '',
      isExtendable: false,
      groupWithInRow: 0
    });
  }

  private ensureKeyFieldRange(fields: TkmendField[], keys: readonly string[], value: string, categoryId: number): void {
    keys.forEach(key => this.ensureKeyField(fields, key, value, categoryId));
  }

  private applyPaymentPlanFields(fields: TkmendField[], categoryId: number): boolean {
    const normalizedMode = this.normalizePaymentMode(this.paymentModeValue);
    this.ensureKeyFieldRange(fields, SUMMER_PAYMENT_MODE_FIELD_KEYS, normalizedMode, categoryId);

    if (normalizedMode !== SUMMER_PAYMENT_MODE_INSTALLMENT) {
      this.resetInstallmentPlanValues(false);
      this.ensureKeyFieldRange(fields, SUMMER_INSTALLMENT_COUNT_FIELD_KEYS, '0', categoryId);
      this.ensureKeyFieldRange(fields, SUMMER_INSTALLMENTS_TOTAL_FIELD_KEYS, '0', categoryId);
      for (let installmentNo = 1; installmentNo <= SUMMER_INSTALLMENTS_MAX_COUNT; installmentNo += 1) {
        this.ensureKeyFieldRange(fields, resolveInstallmentAmountFieldKeys(installmentNo), '0', categoryId);
        this.ensureKeyFieldRange(fields, resolveInstallmentPaidFieldKeys(installmentNo), 'false', categoryId);
        this.ensureKeyFieldRange(fields, resolveInstallmentPaidAtFieldKeys(installmentNo), '', categoryId);
      }
      return true;
    }

    const validationError = this.validateInstallmentPlan();
    if (validationError.length > 0) {
      return false;
    }

    const activeInstallmentCount = this.normalizeInstallmentCount(this.installmentCountValue);
    const normalizedPlan = this.installmentPlan
      .slice(0, activeInstallmentCount)
      .map(item => ({
        ...item,
        amount: this.normalizeInstallmentAmount(item.amount),
        isPaid: Boolean(item.isPaid),
        paidAtLocal: String(item.paidAtLocal ?? '').trim()
      }));

    while (normalizedPlan.length < activeInstallmentCount) {
      normalizedPlan.push({
        installmentNo: normalizedPlan.length + 1,
        amount: 0,
        isPaid: false,
        paidAtLocal: ''
      });
    }

    const totalAmount = this.roundToTwoDecimals(
      normalizedPlan.reduce((sum, installment) => sum + installment.amount, 0)
    );

    this.ensureKeyFieldRange(fields, SUMMER_INSTALLMENT_COUNT_FIELD_KEYS, String(activeInstallmentCount), categoryId);
    this.ensureKeyFieldRange(
      fields,
      SUMMER_INSTALLMENTS_TOTAL_FIELD_KEYS,
      this.formatInstallmentAmountForStorage(totalAmount),
      categoryId
    );

    normalizedPlan.forEach(item => {
      const amountValue = this.formatInstallmentAmountForStorage(item.amount);
      this.ensureKeyFieldRange(fields, resolveInstallmentAmountFieldKeys(item.installmentNo), amountValue, categoryId);
      this.ensureKeyFieldRange(fields, resolveInstallmentPaidFieldKeys(item.installmentNo), item.isPaid ? 'true' : 'false', categoryId);
      const paidAtIso = item.isPaid ? this.convertLocalDateTimeToIso(item.paidAtLocal) : '';
      this.ensureKeyFieldRange(fields, resolveInstallmentPaidAtFieldKeys(item.installmentNo), paidAtIso, categoryId);
    });

    for (let installmentNo = activeInstallmentCount + 1; installmentNo <= SUMMER_INSTALLMENTS_MAX_COUNT; installmentNo += 1) {
      this.ensureKeyFieldRange(fields, resolveInstallmentAmountFieldKeys(installmentNo), '0', categoryId);
      this.ensureKeyFieldRange(fields, resolveInstallmentPaidFieldKeys(installmentNo), 'false', categoryId);
      this.ensureKeyFieldRange(fields, resolveInstallmentPaidAtFieldKeys(installmentNo), '', categoryId);
    }

    return true;
  }

  private normalizePaymentMode(value: string | null | undefined): SummerPaymentMode {
    const normalized = String(value ?? '').trim().toUpperCase();
    return normalized === SUMMER_PAYMENT_MODE_INSTALLMENT
      ? SUMMER_PAYMENT_MODE_INSTALLMENT
      : SUMMER_PAYMENT_MODE_CASH;
  }

  private resetPaymentPlanState(): void {
    this.paymentModeValue = SUMMER_PAYMENT_MODE_CASH;
    this.installmentCountValue = SUMMER_INSTALLMENTS_DEFAULT_COUNT;
    this.resetInstallmentPlanValues();
  }

  private resetInstallmentPlanValues(resetError = true): void {
    const normalizedCount = this.normalizeInstallmentCount(this.installmentCountValue);
    this.installmentCountValue = normalizedCount;
    this.installmentPlan = this.createInstallmentPlanWithEqualDistribution(0, normalizedCount);
    this.installmentPlanAutoGenerated = true;
    if (resetError) {
      this.installmentPlanError = '';
    }
  }

  private createInstallmentPlanWithEqualDistribution(totalAmount: number, installmentsCount: number): SummerInstallmentPlanItem[] {
    const normalizedCount = this.normalizeInstallmentCount(installmentsCount);
    const equalAmounts = this.buildEqualInstallmentAmounts(totalAmount, normalizedCount);
    return equalAmounts.map((amount, index) => ({
      installmentNo: index + 1,
      amount,
      isPaid: false,
      paidAtLocal: ''
    }));
  }

  private buildEqualInstallmentAmounts(totalAmount: number, installmentsCount: number): number[] {
    const normalizedCount = this.normalizeInstallmentCount(installmentsCount);
    const normalizedTotal = this.roundToTwoDecimals(Math.max(0, Number(totalAmount ?? 0) || 0));
    if (normalizedCount === SUMMER_INSTALLMENTS_DEFAULT_COUNT && normalizedTotal > 0) {
      return this.buildSevenPartInstallments(normalizedTotal);
    }

    const totalCents = Math.round(normalizedTotal * 100);
    const baseCents = Math.floor(totalCents / normalizedCount);
    const remainder = totalCents % normalizedCount;

    return Array.from({ length: normalizedCount }, (_item, index) => {
      const cents = baseCents + (index < remainder ? 1 : 0);
      return cents / 100;
    });
  }

  private buildSevenPartInstallments(normalizedTotal: number): number[] {
    const targetDownPercent = 20;
    const steps = [50, 100];
    let bestPlan: { installment: number; downPayment: number; score: number; step: number } | null = null;

    for (const step of steps) {
      const targetDownPayment = normalizedTotal * (targetDownPercent / 100);
      const roundedTargetDownPayment = this.roundToNearestInstallmentBase(targetDownPayment, step);
      const installment = this.roundToNearestInstallmentBase(
        (normalizedTotal - roundedTargetDownPayment) / SUMMER_INSTALLMENT_TAIL_COUNT,
        step
      );
      const downPayment = this.roundToTwoDecimals(normalizedTotal - (installment * SUMMER_INSTALLMENT_TAIL_COUNT));

      if (downPayment <= 0) {
        continue;
      }

      const downPaymentPercent = (downPayment / normalizedTotal) * 100;
      const score = Math.abs(downPaymentPercent - targetDownPercent);
      if (!bestPlan || score < bestPlan.score || (score === bestPlan.score && step < bestPlan.step)) {
        bestPlan = {
          installment,
          downPayment,
          score,
          step
        };
      }
    }

    if (!bestPlan) {
      const fallback = this.buildEqualInstallmentAmounts(normalizedTotal, SUMMER_INSTALLMENTS_DEFAULT_COUNT - 1);
      const fallbackInstallment = this.roundToTwoDecimals(fallback[0] ?? 0);
      const downPayment = this.roundToTwoDecimals(normalizedTotal - (fallbackInstallment * SUMMER_INSTALLMENT_TAIL_COUNT));
      return [downPayment, ...Array.from({ length: SUMMER_INSTALLMENT_TAIL_COUNT }, () => fallbackInstallment)];
    }

    const selectedPlan = bestPlan;
    return [selectedPlan.downPayment, ...Array.from({ length: SUMMER_INSTALLMENT_TAIL_COUNT }, () => selectedPlan.installment)];
  }

  private syncInstallmentPlanWithPricingQuote(forceAutoGenerate = false): void {
    if (!this.isInstallmentMode) {
      this.installmentPlanError = '';
      return;
    }

    const shouldAutoGenerate = forceAutoGenerate
      || this.installmentPlanAutoGenerated
      || !this.installmentPlan.some(item => this.normalizeInstallmentAmount(item.amount) > 0);

    if (shouldAutoGenerate) {
      this.installmentCountValue = this.normalizeInstallmentCount(this.installmentCountValue);
      this.installmentPlan = this.createInstallmentPlanWithEqualDistribution(
        this.getPricingGrandTotal(),
        this.installmentCountValue
      );
      this.installmentPlanAutoGenerated = true;
    }

    this.validateInstallmentPlan();
    this.updateEditChangeState();
  }

  private hydratePaymentPlanFromFields(fields: TkmendField[]): void {
    const modeFromFields = this.getFieldTextByAliases(fields, [...SUMMER_PAYMENT_MODE_FIELD_KEYS]);
    const normalizedMode = this.normalizePaymentMode(modeFromFields);
    this.paymentModeValue = normalizedMode;

    if (normalizedMode !== SUMMER_PAYMENT_MODE_INSTALLMENT) {
      this.installmentCountValue = SUMMER_INSTALLMENTS_DEFAULT_COUNT;
      this.resetInstallmentPlanValues();
      return;
    }

    const requestedCount = this.normalizeInstallmentCount(
      this.getFieldTextByAliases(fields, [...SUMMER_INSTALLMENT_COUNT_FIELD_KEYS])
    );
    this.installmentCountValue = requestedCount;
    const restoredInstallments = Array.from({ length: requestedCount }, (_item, index) => {
      const installmentNo = index + 1;
      const amountText = this.getFieldTextByAliases(fields, resolveInstallmentAmountFieldKeys(installmentNo));
      const paidText = this.getFieldTextByAliases(fields, resolveInstallmentPaidFieldKeys(installmentNo));
      const paidAtText = this.getFieldTextByAliases(fields, resolveInstallmentPaidAtFieldKeys(installmentNo));
      const amount = this.normalizeInstallmentAmount(amountText);
      const isPaid = this.toBoolean(paidText);
      const paidAtLocal = isPaid ? this.convertIsoToLocalDateTimeInput(paidAtText) : '';

      return {
        installmentNo,
        amount,
        isPaid,
        paidAtLocal
      } as SummerInstallmentPlanItem;
    });

    const hasAnyAmount = restoredInstallments.some(item => item.amount > 0);
    if (hasAnyAmount) {
      this.installmentPlan = restoredInstallments;
      this.installmentPlanAutoGenerated = false;
    } else {
      this.installmentPlan = this.createInstallmentPlanWithEqualDistribution(
        this.getPricingGrandTotal(),
        requestedCount
      );
      this.installmentPlanAutoGenerated = true;
    }

    this.validateInstallmentPlan();
  }

  private validateInstallmentPlan(updateErrorState = true): string {
    if (!this.isInstallmentMode) {
      if (updateErrorState) {
        this.installmentPlanError = '';
      }
      return '';
    }

    const activeInstallmentCount = this.normalizeInstallmentCount(this.installmentCountValue);
    if (activeInstallmentCount < SUMMER_INSTALLMENTS_MIN_COUNT || activeInstallmentCount > SUMMER_INSTALLMENTS_MAX_COUNT) {
      const errorMessage = `عدد الأقساط يجب أن يكون من ${SUMMER_INSTALLMENTS_MIN_COUNT} إلى ${SUMMER_INSTALLMENTS_MAX_COUNT}.`;
      if (updateErrorState) {
        this.installmentPlanError = errorMessage;
      }
      return errorMessage;
    }

    if (this.installmentPlan.length !== activeInstallmentCount) {
      this.installmentPlan = this.createInstallmentPlanWithEqualDistribution(
        this.getPricingGrandTotal(),
        activeInstallmentCount
      );
      this.installmentPlanAutoGenerated = true;
    }

    const totalAmount = this.getPricingGrandTotal();
    if (totalAmount <= 0) {
      const errorMessage = 'لا يمكن اعتماد التقسيط قبل احتساب إجمالي الحجز.';
      if (updateErrorState) {
        this.installmentPlanError = errorMessage;
      }
      return errorMessage;
    }

    const hasNegativeValue = this.installmentPlan.some(item => Number(item.amount ?? 0) < 0);
    if (hasNegativeValue) {
      const errorMessage = 'لا يمكن أن تكون قيمة أي قسط سالبة.';
      if (updateErrorState) {
        this.installmentPlanError = errorMessage;
      }
      return errorMessage;
    }

    const totalInstallments = this.installmentPlanTotalAmount;
    if (totalInstallments > this.roundToTwoDecimals(totalAmount) + 0.0001) {
      const errorMessage = `إجمالي الأقساط (${this.formatPriceValue(totalInstallments)}) لا يجب أن يتجاوز إجمالي الحجز (${this.formatPriceValue(totalAmount)}).`;
      if (updateErrorState) {
        this.installmentPlanError = errorMessage;
      }
      return errorMessage;
    }

    if (updateErrorState) {
      this.installmentPlanError = '';
    }
    return '';
  }

  private normalizeInstallmentCount(value: number | string | null | undefined): number {
    const parsed = Number(value ?? SUMMER_INSTALLMENTS_DEFAULT_COUNT);
    if (!Number.isFinite(parsed)) {
      return SUMMER_INSTALLMENTS_DEFAULT_COUNT;
    }

    const rounded = Math.floor(parsed);
    if (rounded < SUMMER_INSTALLMENTS_MIN_COUNT) {
      return SUMMER_INSTALLMENTS_MIN_COUNT;
    }

    if (rounded > SUMMER_INSTALLMENTS_MAX_COUNT) {
      return SUMMER_INSTALLMENTS_MAX_COUNT;
    }

    return rounded;
  }

  private getPricingGrandTotal(): number {
    const parsed = Number(this.pricingQuote?.grandTotal ?? 0);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return 0;
    }
    return this.roundToTwoDecimals(parsed);
  }

  private normalizeInstallmentAmount(value: unknown): number {
    const parsed = Number(value ?? 0);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return 0;
    }
    return this.roundToTwoDecimals(parsed);
  }

  private roundToTwoDecimals(value: number): number {
    const parsed = Number(value ?? 0);
    if (!Number.isFinite(parsed)) {
      return 0;
    }
    return Math.round(parsed * 100) / 100;
  }

  private roundToNearestInstallmentBase(value: number, base: number): number {
    const normalizedValue = this.roundToTwoDecimals(value);
    if (!Number.isFinite(normalizedValue) || !Number.isFinite(base) || base <= 0) {
      return this.roundToTwoDecimals(normalizedValue);
    }

    return this.roundToTwoDecimals(Math.round(normalizedValue / base) * base);
  }

  resolveInstallmentTitle(installmentNo: number): string {
    const normalizedNo = Math.max(1, Math.floor(Number(installmentNo) || 1));
    return normalizedNo === 1 ? 'مقدم الحجز' : `القسط ${normalizedNo - 1}`;
  }

  resolveInstallmentAmountLabel(installmentNo: number): string {
    return installmentNo === 1 ? 'قيمة مقدم الحجز' : 'قيمة القسط';
  }

  private formatInstallmentAmountForStorage(value: number): string {
    const rounded = this.roundToTwoDecimals(value);
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
  }

  private convertIsoToLocalDateTimeInput(isoText: string | null | undefined): string {
    const normalized = String(isoText ?? '').trim();
    if (!normalized) {
      return '';
    }

    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime())) {
      return '';
    }

    const pad = (part: number): string => String(part).padStart(2, '0');
    const year = parsed.getFullYear();
    const month = pad(parsed.getMonth() + 1);
    const day = pad(parsed.getDate());
    const hour = pad(parsed.getHours());
    const minute = pad(parsed.getMinutes());
    return `${year}-${month}-${day}T${hour}:${minute}`;
  }

  private convertLocalDateTimeToIso(localText: string | null | undefined): string {
    const normalized = String(localText ?? '').trim();
    if (!normalized) {
      return '';
    }

    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime())) {
      return '';
    }

    return parsed.toISOString();
  }

  private setControlValue(aliases: readonly string[], value: string): void {
    const control = this.engine.resolveControl(this.ticketForm, this.genericFormService, aliases);
    if (!control) {
      return;
    }

    control.enable({ emitEvent: false });
    control.setValue(value, { emitEvent: false });
    control.updateValueAndValidity({ emitEvent: false });
  }

  private getStringValue(aliases: readonly string[]): string {
    const control = this.engine.resolveControl(this.ticketForm, this.genericFormService, aliases);
    return String(control?.value ?? '').trim();
  }

  formatPriceValue(value: number | string | null | undefined): string {
    const parsed = Number(value ?? 0);
    if (!Number.isFinite(parsed)) {
      return '0';
    }
    const fixed = Number.isInteger(parsed) ? parsed.toString() : parsed.toFixed(2);
    return `${fixed} جنيه`;
  }

  resolveStayModeLabel(mode: string | null | undefined): string {
    const normalized = String(mode ?? '').trim().toUpperCase();
    if (normalized === 'RESIDENCE_WITH_TRANSPORT') {
      return 'إقامة وانتقالات';
    }
    if (normalized === 'RESIDENCE_ONLY') {
      return 'إقامة فقط';
    }
    return normalized.length > 0 ? normalized : '-';
  }

  get isTransportIncludedMode(): boolean {
    const quote = this.pricingQuote;
    if (!quote) {
      return false;
    }

    return String(quote.pricingMode ?? '').trim() === 'TransportationMandatoryIncluded';
  }

  private matchesAlias(name: string, aliases: readonly string[]): boolean {
    const lowered = String(name ?? '').trim().toLowerCase();
    return aliases.some(alias => alias.toLowerCase() === lowered);
  }

  private canRegisterForDestination(destination: SummerDestinationConfig | undefined): boolean {
    return canRegisterForSummerDestination(destination, this.canUseProxyRegistration);
  }

  private resetUnavailableDestinationSelection(): void {
    this.selectedDestinationId = null;
    this.customFilteredCategoryMand = [];
    this.bookingWaveCapacities = [];
    this.fileParameters = [];
    this.activeCompanionRelationLimitAlerts.clear();
    this.ticketForm = this.fb.group({});
    this.genericFormService.dynamicGroups = [];
    this.clearPricingQuote(true);
    this.resetPaymentPlanState();
    this.bookingValidationAlerts = [this.destinationAccessDeniedMessage];
  }

  private showDestinationAccessDeniedMessage(): void {
    this.msg.msgError('غير متاح', `<h5>${this.destinationAccessDeniedMessage}</h5>`, true);
  }

  private syncMembershipTypeAccessAndDefaults(): void {
    const requested = this.normalizeMembershipType(this.membershipTypeValue);
    const enforced = this.canSelectMembershipType ? requested : 'WORKER_MEMBER';
    this.membershipTypeValue = enforced;

    const membershipControl = this.engine.resolveControl(
      this.ticketForm,
      this.genericFormService,
      this.engine.aliases.membershipType
    );
    if (!membershipControl) {
      return;
    }

    membershipControl.setValue(enforced, { emitEvent: false });
    if (this.canSelectMembershipType) {
      membershipControl.enable({ emitEvent: false });
      membershipControl.setValidators([Validators.required]);
    } else {
      membershipControl.clearValidators();
      membershipControl.disable({ emitEvent: false });
    }
    membershipControl.updateValueAndValidity({ emitEvent: false });
  }

  private resolveMembershipTypeForSubmission(): string {
    if (!this.canSelectMembershipType) {
      return 'WORKER_MEMBER';
    }

    return this.normalizeMembershipType(this.membershipTypeValue);
  }

  private hasValidMembershipSelection(): boolean {
    if (!this.canSelectMembershipType) {
      return true;
    }

    const normalized = this.normalizeMembershipType(this.membershipTypeValue);
    return this.membershipTypeOptions.some(item => item.value === normalized);
  }

  private normalizeMembershipType(value: string): string {
    const raw = String(value ?? '').trim();
    if (raw.length === 0) {
      return 'WORKER_MEMBER';
    }

    const token = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (token === 'NONWORKERMEMBER' || token === 'NONWORKER') {
      return 'NON_WORKER_MEMBER';
    }

    if (token === 'WORKERMEMBER' || token === 'WORKER') {
      return 'WORKER_MEMBER';
    }

    const normalizedArabic = raw
      .replace(/[أإآ]/g, 'ا')
      .replace(/\s+/g, '');
    if (normalizedArabic.includes('غيرعامل')) {
      return 'NON_WORKER_MEMBER';
    }

    return 'WORKER_MEMBER';
  }

  private toBoolean(value: unknown): boolean {
    if (typeof value === 'boolean') {
      return value;
    }
    const normalized = String(value ?? '').trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes';
  }

  private extractPricingDisplayText(fields: TkmendField[] | undefined): string {
    const pricingFieldKeys = [
      'Summer_PricingDisplayText',
      'SUM2026_PricingDisplayText',
      'Summer_PricingSmsText',
      'SUM2026_PricingSmsText'
    ];
    const messageFields = Array.isArray(fields) ? fields : [];

    for (const key of pricingFieldKeys) {
      const value = messageFields.find(field => String(field?.fildKind ?? '').trim().toLowerCase() === key.toLowerCase());
      const text = String(value?.fildTxt ?? '').trim();
      if (text.length > 0) {
        return text;
      }
    }

    return '';
  }

  private initializeFromComponentConfig(): void {
    this.componentConfigService.getAll().subscribe({
      next: configs => {
        const loaded = getConfigByRoute(this.configRouteKey, configs || []);
        if (loaded) {
          this.applyComponentConfig(loaded);
        }

        this.loadMetadata();
        this.loadMyRequests();
        const authSub = this.authObjectsService.authObject$.subscribe(() => {
          this.refreshProxyModeAccess();
          this.applyOwnerDefaultMode(this.isEditMode);
          this.syncMembershipTypeAccessAndDefaults();
          this.validateInstallmentPlan();
        });
        this.subscriptions.add(authSub);
      },
      error: () => {
        this.loadMetadata();
        this.loadMyRequests();
      }
    });
  }

  private applyComponentConfig(config: ComponentConfig): void {
    const merged = new ComponentConfig({
      ...this.baseFormConfig,
      ...config
    });

    merged.showViewToggle = false;
    merged.formDisplayOption = merged.formDisplayOption || 'fullscreen';
    merged.attachmentConfig = {
      ...this.baseFormConfig.attachmentConfig,
      ...(config.attachmentConfig || {})
    };
    this.baseFormConfig = merged;

    const dynamicSettings = merged.dynamicFormSettings || {};
    const appIdFromConfig = String(dynamicSettings.applicationId ?? merged.genericFormName ?? '').trim();
    if (appIdFromConfig.length > 0) {
      this.resolvedApplicationId = appIdFromConfig;
    }

    this.engine.applyAliasOverrides(dynamicSettings.aliases);
    this.applyFormModeConfig();
  }

  private refreshProxyModeAccess(): void {
    try {
      const hasSummerGeneralManagerPermission =
        this.authObjectsService.checkAuthFun('SummerGeneralManagerFunc')
        || this.authObjectsService.checkAuthRole('2021');
      const hasSummerAdminPermission =
        this.authObjectsService.checkAuthFun('SummerAdminFunc')
        || this.authObjectsService.checkAuthRole('2020');

      this.hasSummerGeneralManagerPermission = hasSummerGeneralManagerPermission;
      this.canUseProxyRegistration = hasSummerAdminPermission;
      this.canSelectMembershipType = hasSummerAdminPermission;
      this.canUseFrozenUnitsInCurrentFlow = hasSummerAdminPermission;
      if (!this.canUseFrozenUnitsInCurrentFlow) {
        this.includeFrozenUnitsInBooking = false;
      }
    } catch {
      this.hasSummerGeneralManagerPermission = false;
      this.canUseProxyRegistration = false;
      this.canSelectMembershipType = false;
      this.canUseFrozenUnitsInCurrentFlow = false;
      this.includeFrozenUnitsInBooking = false;
    }

    if (!this.isEditMode && this.selectedDestination && !this.canRegisterForDestination(this.selectedDestination)) {
      this.resetUnavailableDestinationSelection();
    }
  }

  private filterRestrictedFields(fields: CdCategoryMandDto[]): CdCategoryMandDto[] {
    return (fields ?? []).filter(field => {
      const key = String(field?.mendField ?? '').trim();
      if (this.matchesAlias(key, this.engine.aliases.membershipType)) {
        return false;
      }

      if (!this.canUseProxyRegistration && this.matchesAlias(key, this.engine.aliases.proxyMode)) {
        return false;
      }

      return true;
    });
  }

  private applyFormModeConfig(): void {
    const submitText = this.isEditMode
      ? 'حفظ التعديلات'
      : ((this.baseFormConfig.submitButtonText || '').trim() || 'تسجيل طلب المصيف');

    this.formConfig = new ComponentConfig({
      ...this.baseFormConfig,
      isNew: !this.isEditMode,
      showViewToggle: false,
      formDisplayOption: this.baseFormConfig.formDisplayOption || 'fullscreen',
      submitButtonText: submitText,
      attachmentConfig: {
        ...(this.baseFormConfig.attachmentConfig || {})
      }
    });
  }

  private resolveEditMode(): void {
    const parsed = Number(this.editRequestId ?? 0);
    const nextEditRequestId = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null;
    const wasEditMode = this.isEditMode;

    this.isEditMode = nextEditRequestId !== null;
    this.pendingEditRequestId = nextEditRequestId;
    this.editRequestError = '';
    this.hasEditChanges = false;

    if (!this.isEditMode) {
      this.loadedEditRequestId = null;
      this.initialEditSignature = '';
      this.resetPaymentPlanState();
      if (wasEditMode) {
        this.messageDto = {} as MessageDto;
        if (this.selectedDestinationId) {
          this.onDestinationChanged(this.selectedDestinationId);
        }
      }
      return;
    }

    if (this.loadedEditRequestId !== nextEditRequestId) {
      this.loadedEditRequestId = null;
      this.initialEditSignature = '';
    }
  }

  private tryLoadEditRequest(): void {
    if (!this.isEditMode) {
      return;
    }

    const requestId = Number(this.pendingEditRequestId ?? 0);
    if (!Number.isFinite(requestId) || requestId <= 0) {
      return;
    }

    if (this.loadingMetadata || !this.metadataLoaded) {
      return;
    }

    if (!Array.isArray(this.destinations) || this.destinations.length === 0) {
      return;
    }

    if (this.loadingEditRequest) {
      return;
    }

    if (this.loadedEditRequestId === requestId) {
      return;
    }

    this.loadRequestForEdit(requestId);
  }

  private loadRequestForEdit(requestId: number): void {
    this.loadingEditRequest = true;
    this.editRequestError = '';
    let fallbackTriggered = false;
    this.dynamicFormController.getRequestById(requestId).subscribe({
      next: response => {
        if (response?.isSuccess && response.data) {
          this.applyMessageToEditForm(response.data);
          return;
        }

        const errors = (response?.errors ?? [])
          .map(item => ({ message: String(item?.message ?? '').trim() }))
          .filter(item => item.message.length > 0);
        fallbackTriggered = true;
        this.tryLoadRequestForEditFromMyRequestsFeed(requestId, errors);
      },
      error: () => {
        fallbackTriggered = true;
        this.tryLoadRequestForEditFromMyRequestsFeed(requestId);
      },
      complete: () => {
        if (!fallbackTriggered) {
          this.loadingEditRequest = false;
        }
      }
    });
  }

  private tryLoadRequestForEditFromMyRequestsFeed(
    requestId: number,
    primaryErrors?: Array<{ message?: string }>
  ): void {
    this.loadingEditRequest = true;
    const collectedErrors: Array<{ message?: string }> = [...(primaryErrors ?? [])];
    const queries = this.buildDynamicMyRequestsQueries(requestId);
    let resolved = false;

    const runAttempt = (index: number): void => {
      if (resolved) {
        return;
      }

      if (index >= queries.length) {
        this.editRequestError = this.resolveRequestDetailsErrorMessage(
          collectedErrors,
          'تعذر تحميل بيانات الطلب المطلوب للتعديل.'
        );
        this.loadingEditRequest = false;
        return;
      }

      this.dynamicFormController.getCorrMyRequest(queries[index]).subscribe({
        next: response => {
          const responseErrors = (response?.errors ?? [])
            .map(item => ({ message: String(item?.message ?? '').trim() }))
            .filter(item => String(item?.message ?? '').length > 0);
          if (responseErrors.length > 0) {
            collectedErrors.push(...responseErrors);
          }

          const rawItems = Array.isArray(response?.data) ? response.data : [];
          const normalizedMessages = rawItems
            .map(item => this.normalizeLoadedRequestDetails(item))
            .filter((item): item is MessageDto => !!item);

          const matched = normalizedMessages.find(item => Number(item.messageId ?? 0) === requestId);
          if (matched) {
            resolved = true;
            this.editRequestError = '';
            this.applyMessageToEditForm(matched);
          }
        },
        error: () => {
          collectedErrors.push({ message: 'تعذر الوصول لخدمة الطلبات أثناء محاولة التحميل البديلة.' });
        },
        complete: () => {
          if (resolved) {
            this.loadingEditRequest = false;
            return;
          }
          runAttempt(index + 1);
        }
      });
    };

    runAttempt(0);
  }

  private applyMessageToEditForm(rawMessage: unknown): void {
    const message = this.normalizeLoadedRequestDetails(rawMessage);
    if (!message) {
      this.editRequestError = 'تعذر تحميل بيانات الطلب المطلوب للتعديل.';
      return;
    }

    const messageId = Number(message?.messageId ?? this.pendingEditRequestId ?? 0);
    if (!Number.isFinite(messageId) || messageId <= 0) {
      this.editRequestError = 'معرف الطلب المراد تعديله غير صالح.';
      return;
    }

    const summary = this.myRequests.find(item => item.messageId === messageId);
    if (summary && !this.canEditRequest(summary)) {
      this.editRequestError = this.getEditBlockedReason(summary);
      return;
    }

    const destinationId = this.resolveEditDestinationId(message, summary);
    const destination = this.destinations.find(item => item.categoryId === destinationId);
    if (!destination) {
      this.editRequestError = 'الطلب لا يرتبط بمصيف متاح داخل إعدادات الموسم الحالي.';
      return;
    }

    this.messageDto = {
      ...(message ?? ({} as MessageDto)),
      categoryCd: destinationId,
      fields: [...(message?.fields ?? [])]
    } as MessageDto;
    this.membershipTypeValue = this.normalizeMembershipType(
      this.getFieldTextByAliases(this.messageDto.fields ?? [], this.engine.aliases.membershipType)
    );
    this.hydratePaymentPlanFromFields(this.messageDto.fields ?? []);

    this.loadedEditRequestId = messageId;
    this.initialEditSignature = '';
    this.hasEditChanges = false;
    this.selectedDestinationId = destinationId;
    this.onDestinationChanged(destinationId, {
      preserveMessageFields: true,
      resetFiles: true,
      preservePaymentPlan: true
    });
    setTimeout(() => this.updateEditChangeState(), 0);
  }

  private updateEditChangeState(): void {
    if (!this.isEditMode) {
      this.hasEditChanges = false;
      return;
    }

    const hasForm = !!this.ticketForm && Object.keys(this.ticketForm.controls ?? {}).length > 0;
    if (!hasForm) {
      this.hasEditChanges = false;
      return;
    }

    const currentSignature = this.buildEditSignature();
    if (!this.initialEditSignature && this.loadedEditRequestId && !this.loadingEditRequest) {
      this.initialEditSignature = currentSignature;
      this.markFormPristine(this.ticketForm);
      this.hasEditChanges = false;
      return;
    }

    if (!this.initialEditSignature) {
      this.hasEditChanges = false;
      return;
    }

    this.hasEditChanges = currentSignature !== this.initialEditSignature;
  }

  private buildEditSignature(): string {
    const rawFormValue = this.ticketForm?.getRawValue?.() ?? {};
    const files = (this.fileParameters ?? []).map(item => ({
      fileName: String(item?.fileName ?? '').trim(),
      size: Number(item?.originalSize ?? (item?.data as File | undefined)?.size ?? 0) || 0
    }));

    try {
      return JSON.stringify({
        form: rawFormValue,
        membershipType: this.resolveMembershipTypeForSubmission(),
        paymentMode: this.selectedPaymentMode,
        installmentCount: this.selectedInstallmentCount,
        installments: this.installmentPlan.map(item => ({
          installmentNo: item.installmentNo,
          amount: this.normalizeInstallmentAmount(item.amount),
          isPaid: Boolean(item.isPaid),
          paidAtLocal: String(item.paidAtLocal ?? '').trim()
        })),
        files
      });
    } catch {
      return `${Date.now()}-${Math.random()}`;
    }
  }

  private markFormPristine(group: FormGroup): void {
    Object.keys(group.controls).forEach(key => {
      const control = group.controls[key];
      control.markAsPristine({ onlySelf: true });
      control.markAsUntouched({ onlySelf: true });

      if (control instanceof FormGroup) {
        this.markFormPristine(control);
        return;
      }

      if (control instanceof FormArray) {
        control.controls.forEach(item => {
          if (item instanceof FormGroup) {
            this.markFormPristine(item);
          } else {
            item.markAsPristine({ onlySelf: true });
            item.markAsUntouched({ onlySelf: true });
          }
        });
      }
    });

    group.markAsPristine();
    group.markAsUntouched();
  }

  private resolveCurrentMessageId(): number {
    const value = Number(this.messageDto?.messageId ?? this.pendingEditRequestId ?? this.editRequestId ?? 0);
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  }

  private canEditRequest(request: SummerRequestSummaryDto | undefined): boolean {
    if (!request) {
      return false;
    }

    if (this.isAdminEditOverrideActive) {
      return true;
    }

    if (String(request.paidAtUtc ?? '').trim().length > 0) {
      return false;
    }

    const normalizedStatus = String(request.status ?? '').trim().toLowerCase();
    if (normalizedStatus.includes('rejected') || normalizedStatus.includes('مرفوض') || normalizedStatus.includes('ملغي')) {
      return false;
    }

    return true;
  }

  private getEditBlockedReason(request: SummerRequestSummaryDto | undefined): string {
    if (!request) {
      return 'لا يمكن تعديل الطلب.';
    }

    if (this.isAdminEditOverrideActive) {
      return '';
    }

    if (String(request.paidAtUtc ?? '').trim().length > 0) {
      return 'لا يمكن تعديل الطلب بعد تسجيل السداد.';
    }

    const normalizedStatus = String(request.status ?? '').trim().toLowerCase();
    if (normalizedStatus.includes('rejected') || normalizedStatus.includes('مرفوض') || normalizedStatus.includes('ملغي')) {
      return 'لا يمكن تعديل طلب ملغي/مرفوض.';
    }

    return 'لا يمكن تعديل هذا الطلب.';
  }

  private resolveEditDestinationId(message: MessageDto, summary?: SummerRequestSummaryDto): number {
    const directCategoryId = this.parsePositiveInt(message?.categoryCd);
    if (directCategoryId) {
      return directCategoryId;
    }

    const destinationFromField = this.parsePositiveInt(
      this.getFieldTextByAliases(message?.fields ?? [], this.engine.aliases.destinationId)
    );
    if (destinationFromField) {
      return destinationFromField;
    }

    const summaryCategoryId = this.parsePositiveInt(summary?.categoryId);
    if (summaryCategoryId) {
      return summaryCategoryId;
    }

    return 0;
  }

  private getFieldTextByAliases(fields: TkmendField[], aliases: string[]): string {
    if (!Array.isArray(fields) || fields.length === 0 || !Array.isArray(aliases) || aliases.length === 0) {
      return '';
    }

    const normalizedAliases = aliases
      .map(alias => this.normalizeObjectLookupKey(alias))
      .filter(alias => alias.length > 0);

    for (const field of fields) {
      const key = this.normalizeObjectLookupKey(String(field?.fildKind ?? ''));
      if (!key || !normalizedAliases.includes(key)) {
        continue;
      }

      const value = String(field?.fildTxt ?? '').trim();
      if (value.length > 0) {
        return value;
      }
    }

    return '';
  }

  private parsePositiveInt(value: unknown): number | null {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return null;
    }
    return Math.floor(parsed);
  }

  private normalizeLoadedRequestDetails(raw: unknown): MessageDto | null {
    const source = this.extractMessagePayload(raw);
    if (!source) {
      return null;
    }

    const normalized: Record<string, unknown> = {
      ...(source as Record<string, unknown>)
    };

    const messageId = this.parsePositiveInt(this.readValue(source, [
      'messageId',
      'MessageId',
      'id',
      'Id',
      'requestId',
      'RequestId'
    ])) ?? this.parsePositiveInt(this.pendingEditRequestId);
    if (messageId) {
      normalized['messageId'] = messageId;
    }

    const fields = this.normalizeLoadedFields(this.readValue(source, [
      'fields',
      'Fields',
      'tkmendFields',
      'TkmendFields',
      'tkMendFields',
      'TkMendFields',
      'messageFields',
      'MessageFields',
      'mendFields',
      'MendFields'
    ]));
    this.harmonizeEditFieldAliases(fields);
    normalized['fields'] = fields;

    let categoryCd = this.parsePositiveInt(this.readValue(source, [
      'categoryCd',
      'CategoryCd',
      'categoryID',
      'CategoryID',
      'categoryId',
      'CategoryId',
      'catId',
      'CatId'
    ]));
    if (!categoryCd) {
      categoryCd = this.parsePositiveInt(this.getFieldTextByAliases(fields, this.engine.aliases.destinationId));
    }

    if (!categoryCd && messageId) {
      const summary = this.myRequests.find(item => item.messageId === messageId);
      categoryCd = this.parsePositiveInt(summary?.categoryId);
    }

    if (categoryCd) {
      normalized['categoryCd'] = categoryCd;
    }

    const attachments = this.extractArray(this.readValue(source, [
      'attachments',
      'Attachments',
      'attchShipments',
      'AttchShipments',
      'attchShipmentDtos',
      'AttchShipmentDtos'
    ]));
    normalized['attachments'] = attachments;

    const replies = this.extractArray(this.readValue(source, [
      'replies',
      'Replies',
      'replyDtos',
      'ReplyDtos'
    ]));
    normalized['replies'] = replies;

    return normalized as unknown as MessageDto;
  }

  private harmonizeEditFieldAliases(fields: TkmendField[]): void {
    if (!Array.isArray(fields) || fields.length === 0) {
      return;
    }

    // Keep edit-screen aliases in sync with canonical summer keys used by backend transfer actions.
    this.syncAliasFieldValues(fields, [...SUMMER_CANONICAL_FIELD_KEYS.waveCode], this.engine.aliases.waveCode);
    this.syncAliasFieldValues(fields, [...SUMMER_CANONICAL_FIELD_KEYS.waveLabel], this.engine.aliases.waveLabel);
    this.syncAliasFieldValues(fields, [...SUMMER_CANONICAL_FIELD_KEYS.familyCount], this.engine.aliases.familyCount);
    this.syncAliasFieldValues(fields, [...SUMMER_CANONICAL_FIELD_KEYS.extraCount], this.engine.aliases.extraCount);
    this.syncAliasFieldValues(fields, [...SUMMER_CANONICAL_FIELD_KEYS.destinationId], this.engine.aliases.destinationId);
    this.syncAliasFieldValues(fields, [...SUMMER_CANONICAL_FIELD_KEYS.destinationName], this.engine.aliases.destinationName);
  }

  private syncAliasFieldValues(fields: TkmendField[], sourceAliases: string[], targetAliases: string[]): void {
    const sourceField = this.findFirstFieldByAliases(fields, sourceAliases);
    const sourceValue = String(sourceField?.fildTxt ?? '').trim();
    if (sourceValue.length === 0) {
      return;
    }

    const uniqueTargets = Array.from(new Set(
      (targetAliases ?? [])
        .map(alias => String(alias ?? '').trim())
        .filter(alias => alias.length > 0)
    ));

    uniqueTargets.forEach(alias => {
      const targetField = this.findFirstFieldByAliases(fields, [alias]);
      if (targetField) {
        if (String(targetField.fildTxt ?? '').trim() !== sourceValue) {
          targetField.fildTxt = sourceValue;
        }
        return;
      }

      fields.push({
        ...(sourceField ?? ({} as TkmendField)),
        fildSql: fields.length + 1,
        fildKind: alias,
        fildTxt: sourceValue,
        fildRelted: Number(sourceField?.fildRelted ?? 0) || 0,
        instanceGroupId: Number(sourceField?.instanceGroupId ?? 1) || 1,
        mendSql: Number(sourceField?.mendSql ?? 0) || 0,
        mendCategory: Number(sourceField?.mendCategory ?? this.selectedDestinationId ?? 0) || 0,
        mendStat: sourceField?.mendStat ?? false,
        mendGroup: Number(sourceField?.mendGroup ?? 0) || 0,
        applicationId: String(sourceField?.applicationId ?? this.resolvedApplicationId ?? ''),
        groupName: String(sourceField?.groupName ?? ''),
        isExtendable: sourceField?.isExtendable ?? false,
        groupWithInRow: Number(sourceField?.groupWithInRow ?? 0) || 0
      } as TkmendField);
    });
  }

  private findFirstFieldByAliases(fields: TkmendField[], aliases: string[]): TkmendField | null {
    if (!Array.isArray(fields) || fields.length === 0 || !Array.isArray(aliases) || aliases.length === 0) {
      return null;
    }

    const normalizedAliases = aliases
      .map(alias => this.normalizeObjectLookupKey(alias))
      .filter(alias => alias.length > 0);

    if (normalizedAliases.length === 0) {
      return null;
    }

    for (const field of fields) {
      const key = this.normalizeObjectLookupKey(String(field?.fildKind ?? ''));
      if (key.length === 0) {
        continue;
      }

      if (normalizedAliases.includes(key)) {
        return field;
      }
    }

    return null;
  }

  private normalizeLoadedFields(rawFields: unknown): TkmendField[] {
    return this.extractArray(rawFields).map(item => {
      if (!item || typeof item !== 'object') {
        return {
          fildSql: 0,
          fildRelted: 0,
          fildKind: '',
          fildTxt: '',
          instanceGroupId: 1,
          mendSql: 0,
          mendCategory: 0,
          mendStat: false,
          mendGroup: 0,
          applicationId: '',
          groupName: '',
          isExtendable: false,
          groupWithInRow: 0
        } as TkmendField;
      }

      const row = item as Record<string, unknown>;
      const fildSql = Number(this.readValue(row, ['fildSql', 'FildSql', 'fieldSql', 'FieldSql', 'id', 'Id']) ?? 0);
      const fildRelted = Number(this.readValue(row, ['fildRelted', 'FildRelted', 'fieldRelated', 'FieldRelated']) ?? 0);
      const instanceGroupId = Number(
        this.readValue(row, ['instanceGroupId', 'InstanceGroupId', 'instance_group_id', 'Instance_Group_Id']) ?? 1
      );
      const mendSql = Number(this.readValue(row, ['mendSql', 'MendSql']) ?? 0);
      const mendCategory = Number(this.readValue(row, ['mendCategory', 'MendCategory']) ?? 0);
      const mendGroup = Number(this.readValue(row, ['mendGroup', 'MendGroup', 'groupId', 'GroupId', 'mend_group']) ?? 0);
      const groupWithInRow = Number(this.readValue(row, ['groupWithInRow', 'GroupWithInRow']) ?? 0);

      return {
        ...(row as unknown as TkmendField),
        fildSql: Number.isFinite(fildSql) ? Math.floor(fildSql) : 0,
        fildRelted: Number.isFinite(fildRelted) ? Math.floor(fildRelted) : 0,
        fildKind: String(this.readValue(row, [
          'fildKind',
          'FildKind',
          'fieldKind',
          'FieldKind',
          'mendField',
          'MendField',
          'field_name',
          'Field_Name'
        ]) ?? '').trim(),
        fildTxt: String(this.readValue(row, [
          'fildTxt',
          'FildTxt',
          'fieldTxt',
          'FieldTxt',
          'fieldValue',
          'FieldValue',
          'fildValue',
          'FildValue',
          'value',
          'Value',
          'txt',
          'Txt'
        ]) ?? '').trim(),
        instanceGroupId: Number.isFinite(instanceGroupId) && instanceGroupId > 0 ? Math.floor(instanceGroupId) : 1,
        mendSql: Number.isFinite(mendSql) ? Math.floor(mendSql) : 0,
        mendCategory: Number.isFinite(mendCategory) ? Math.floor(mendCategory) : 0,
        mendGroup: Number.isFinite(mendGroup) ? Math.floor(mendGroup) : 0,
        groupWithInRow: Number.isFinite(groupWithInRow) ? Math.floor(groupWithInRow) : 0
      } as TkmendField;
    });
  }

  private extractMessagePayload(raw: unknown): Record<string, unknown> | null {
    if (raw === null || raw === undefined) {
      return null;
    }

    if (typeof raw === 'string') {
      const text = raw.trim();
      if (!text) {
        return null;
      }

      try {
        return this.extractMessagePayload(JSON.parse(text));
      } catch {
        return null;
      }
    }

    if (Array.isArray(raw)) {
      for (const item of raw) {
        const nested = this.extractMessagePayload(item);
        if (nested) {
          return nested;
        }
      }
      return null;
    }

    if (typeof raw !== 'object') {
      return null;
    }

    const source = raw as Record<string, unknown>;
    const nested = this.readValue(source, [
      'message',
      'Message',
      'messageDto',
      'MessageDto',
      'request',
      'Request',
      'item',
      'Item'
    ]);
    const nestedRecord = this.extractMessagePayload(nested);
    if (nestedRecord) {
      return nestedRecord;
    }

    return source;
  }

  private extractArray(value: unknown): unknown[] {
    if (Array.isArray(value)) {
      return value;
    }

    if (!value || typeof value !== 'object') {
      return [];
    }

    const record = value as Record<string, unknown>;
    const nested = this.readValue(record, [
      '$values',
      'values',
      'Values',
      'items',
      'Items',
      'list',
      'List',
      'data',
      'Data',
      'rows',
      'Rows'
    ]);
    if (Array.isArray(nested)) {
      return nested;
    }

    const numericKeys = Object.keys(record)
      .filter(key => /^[0-9]+$/.test(key))
      .sort((a, b) => Number(a) - Number(b));

    if (numericKeys.length > 0) {
      return numericKeys.map(key => record[key]);
    }

    return [];
  }

  private readValue(source: Record<string, unknown>, keys: string[]): unknown {
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        return source[key];
      }
    }

    const normalizedLookup = new Map<string, unknown>();
    Object.keys(source).forEach(key => {
      normalizedLookup.set(this.normalizeObjectLookupKey(key), source[key]);
    });

    for (const key of keys) {
      const normalized = this.normalizeObjectLookupKey(key);
      if (normalizedLookup.has(normalized)) {
        return normalizedLookup.get(normalized);
      }
    }

    return undefined;
  }

  private normalizeObjectLookupKey(value: string): string {
    return String(value ?? '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }

  private buildDynamicMyRequestsQueries(requestId: number): ListRequestModel[] {
    const summary = this.myRequests.find(item => item.messageId === requestId);
    const summaryCategoryId = this.parsePositiveInt(summary?.categoryId) ?? 0;
    const categoryCandidates = summaryCategoryId > 0 ? [summaryCategoryId, 0] : [0];
    const typeCandidates = [0, 1, 2, 4];
    const seen = new Set<string>();
    const queries: ListRequestModel[] = [];

    categoryCandidates.forEach(categoryCd => {
      typeCandidates.forEach(type => {
        const key = `${type}|${categoryCd}`;
        if (seen.has(key)) {
          return;
        }
        seen.add(key);
        queries.push(this.buildDynamicMyRequestsQuery(type, categoryCd));
      });
    });

    return queries;
  }

  private buildDynamicMyRequestsQuery(type = 0, categoryCd = 0): ListRequestModel {
    return {
      pageNumber: 1,
      pageSize: 5000,
      status: 5,
      categoryCd,
      type,
      requestedData: RequestedData.MyRequest,
      search: {
        isSearch: false,
        searchKind: SearchKind.NoSearch,
        searchField: '',
        searchText: '',
        searchType: ''
      }
    };
  }

  private resolveRequestDetailsErrorMessage(
    errors: Array<{ message?: string }> | undefined,
    fallback: string
  ): string {
    const combined = (errors ?? [])
      .map(item => String(item?.message ?? '').trim())
      .filter(item => item.length > 0)
      .join(' | ');

    const normalized = combined.toLowerCase();
    if (normalized.includes('attch_shipment') && normalized.includes('invalid object name')) {
      return 'تعذر تحميل بيانات الطلب للتعديل بسبب مشكلة بجدول المرفقات في قاعدة البيانات (Attch_shipment). برجاء مراجعة الـ Backend.';
    }

    return combined || fallback;
  }

  private hasBlacklistErrorCode(errors: Array<{ code?: string; message?: string }> | undefined): boolean {
    const values = errors ?? [];
    return values.some(error => String(error?.code ?? '').trim().toUpperCase() === 'SUMMER_BLACKLIST_BLOCKED');
  }

  private resolveHttpStatus(error: unknown): number {
    const status = Number((error as { status?: unknown } | null)?.status ?? 0);
    return Number.isFinite(status) ? status : 0;
  }

  private extractErrorsFromException(error: unknown): Array<{ code?: string; message?: string }> {
    const apiException = error as ApiException | null;
    const responseText = String(apiException?.response ?? '').trim();
    if (!responseText) {
      return [];
    }

    try {
      const parsed = JSON.parse(responseText) as { errors?: Array<{ code?: string; message?: string }> };
      return Array.isArray(parsed?.errors) ? parsed.errors : [];
    } catch {
      return [];
    }
  }

  private showBlacklistBlockedModal(): void {
    Swal.fire({
      icon: 'error',
      title: 'غير مصرح بالحجز',
      html: '<div style="direction:rtl">هذا المستخدم غير مصرح له بالحجز على المصايف</div>'
    });
  }

  private coalesceText(...values: unknown[]): string {
    for (const value of values) {
      const normalized = String(value ?? '').trim();
      if (normalized.length > 0) {
        return normalized;
      }
    }
    return '';
  }
}
