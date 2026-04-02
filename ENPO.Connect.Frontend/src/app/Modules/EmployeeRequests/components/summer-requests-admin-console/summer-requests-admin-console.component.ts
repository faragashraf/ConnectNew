import { Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subscription, firstValueFrom } from 'rxjs';
import { DynamicFormController } from 'src/app/shared/services/BackendServices/DynamicForm/DynamicForm.service';
import { MessageDto } from 'src/app/shared/services/BackendServices/DynamicForm/DynamicForm.dto';
import { AttachmentsController } from 'src/app/shared/services/BackendServices/Attachments/Attachments.service';
import { FileParameter } from 'src/app/shared/services/BackendServices/dto-shared';
import {
  SummerAdminDashboardDto,
  SummerDashboardBucketDto,
  SummerPricingCatalogDto,
  SummerPricingCatalogRecordDto,
  SummerPricingCatalogUpsertRequest,
  SummerRequestsPageChange,
  SummerRequestsPageData,
  SummerRequestSummaryDto,
  SummerWaveBookingsPrintReportDto,
  SummerWaveBookingsPrintRowDto,
  SummerWaveBookingsPrintSectionDto,
  SummerWaveCapacityDto
} from 'src/app/shared/services/BackendServices/SummerWorkflow/SummerWorkflow.dto';
import { SummerWorkflowController } from 'src/app/shared/services/BackendServices/SummerWorkflow/SummerWorkflow.service';
import { AttchedObjectService } from 'src/app/shared/services/helper/attched-object.service';
import { DynamicMetadataService } from 'src/app/shared/services/helper/dynamic-metadata.service';
import { MsgsService } from 'src/app/shared/services/helper/msgs.service';
import { SpinnerService } from 'src/app/shared/services/helper/spinner.service';
import { AuthObjectsService } from 'src/app/shared/services/helper/auth-objects.service';
import {
  SUMMER_DESTINATION_CATALOG_KEY,
  SUMMER_DYNAMIC_APPLICATION_ID
} from '../summer-shared/core/summer-feature.config';
import {
  normalizeSummerAdminActionCode,
  SUMMER_ADMIN_ACTION,
  SummerAdminActionCode
} from '../summer-shared/core/summer-action-codes';
import {
  resolveAdminActionDecisionForCurrentStatus
} from '../summer-shared/core/summer-admin-action-state-guard';
import { SUMMER_UI_TEXTS_AR } from '../summer-shared/core/summer-ui-texts.ar';
import { SummerRequestsRealtimeService } from '../summer-shared/core/summer-requests-realtime.service';
import {
  SummerCapacityRealtimeEvent,
  SummerRequestRealtimeEvent
} from '../summer-shared/core/summer-realtime-event.models';
import { SummerAdminRealtimePatchService } from '../summer-shared/core/summer-admin-realtime-patch.service';
import {
  parseSummerDestinationCatalog,
  SUMMER_SEASON_YEAR,
  SummerDestinationConfig,
  SummerWaveDefinition
} from '../summer-requests-workspace/summer-requests-workspace.config';
import {
  buildSummerRequestCompanions,
  buildSummerRequestDetailFields,
  getStatusClass as resolveSummerStatusClass,
  getStatusLabel as resolveSummerStatusLabel,
  SummerRequestFieldGridRow
} from '../summer-requests-workspace/summer-requests-workspace.utils';

type SummerPricingGroupEntry = {
  index: number;
  record: SummerPricingCatalogRecordDto;
};

type SummerPricingRecordGroup = {
  key: string;
  categoryId: number;
  destinationName: string;
  rows: SummerPricingGroupEntry[];
  activeCount: number;
  inactiveCount: number;
};

type WaveBookingsPrintFooterMarker = {
  pageNumber: number;
  topPx: number;
};

type SummerResortBookingsWaveGroupVm = {
  waveCode: string;
  waveStartAtUtc?: string | null;
  waveEndAtUtc?: string | null;
  totalBookings: number;
  totalBookingAmount: number;
  totalInsuranceAmount: number;
  totalFinalAmount: number;
  sections: SummerWaveBookingsPrintSectionDto[];
};

type SummerResortBookingsPrintReportVm = {
  categoryId: number;
  categoryName: string;
  generatedAtUtc: string;
  generatedByUserId: string;
  includeFinancials: boolean;
  totalConfiguredWaves: number;
  totalWavesWithBookings: number;
  totalBookings: number;
  totalPersons: number;
  totalBookingAmount: number;
  totalInsuranceAmount: number;
  totalFinalAmount: number;
  waveGroups: SummerResortBookingsWaveGroupVm[];
};

type SummerAllResortsSummaryWaveVm = {
  waveCode: string;
  totalBookings: number;
  totalPersons: number;
  totalBookingAmount: number;
  totalInsuranceAmount: number;
  totalFinalAmount: number;
};

type SummerAllResortsSummaryResortVm = {
  categoryId: number;
  categoryName: string;
  totalConfiguredWaves: number;
  totalWavesWithBookings: number;
  totalBookings: number;
  totalPersons: number;
  totalBookingAmount: number;
  totalInsuranceAmount: number;
  totalFinalAmount: number;
  waves: SummerAllResortsSummaryWaveVm[];
};

type SummerAllResortsSummaryPrintReportVm = {
  generatedAtUtc: string;
  generatedByUserId: string;
  includeFinancials: boolean;
  totalResorts: number;
  totalConfiguredWaves: number;
  totalWavesWithBookings: number;
  totalBookings: number;
  totalPersons: number;
  totalBookingAmount: number;
  totalInsuranceAmount: number;
  totalFinalAmount: number;
  resorts: SummerAllResortsSummaryResortVm[];
};

@Component({
  selector: 'app-summer-requests-admin-console',
  templateUrl: './summer-requests-admin-console.component.html',
  styleUrls: ['./summer-requests-admin-console.component.scss']
})
export class SummerRequestsAdminConsoleComponent implements OnInit, OnDestroy {
  @ViewChild('waveBookingsPrintDocument')
  private waveBookingsPrintDocumentRef?: ElementRef<HTMLElement>;
  @ViewChild('resortBookingsPrintDocument')
  private resortBookingsPrintDocumentRef?: ElementRef<HTMLElement>;
  @ViewChild('allResortsSummaryPrintDocument')
  private allResortsSummaryPrintDocumentRef?: ElementRef<HTMLElement>;
  @ViewChild('requestAdminPrintDocument')
  private requestAdminPrintDocumentRef?: ElementRef<HTMLElement>;

  readonly seasonYear = SUMMER_SEASON_YEAR;
  readonly dynamicSummerApplicationId = SUMMER_DYNAMIC_APPLICATION_ID;
  destinations: SummerDestinationConfig[] = [];
  loadingDestinations = false;
  destinationsError = '';

  readonly statusOptions = [
    { value: '', label: 'الكل' },
    { value: 'جديد', label: 'جديد' },
    { value: 'جاري التنفيذ', label: 'جاري التنفيذ' },
    { value: 'رد إداري', label: 'رد إداري' },
    { value: 'اعتماد نهائي', label: 'اعتماد نهائي' },
    { value: 'TRANSFER_REVIEW_REQUIRED', label: 'يتطلب مراجعة بعد التحويل' },
    { value: 'تم الرد', label: 'تم الرد (عام)' },
    { value: 'مرفوض', label: 'مرفوض/ملغي' }
  ];

  readonly paymentStateOptions = [
    { value: '', label: 'الكل' },
    { value: 'Paid', label: 'مسدد' },
    { value: 'Unpaid', label: 'غير مسدد' },
    { value: 'OverdueUnpaid', label: 'متأخر وغير مسدد' }
  ];

  readonly actionOptions: Array<{ value: SummerAdminActionCode; label: string }> = [
    { value: SUMMER_ADMIN_ACTION.COMMENT, label: 'تعليق / رد إداري' },
    { value: SUMMER_ADMIN_ACTION.FINAL_APPROVE, label: 'اعتماد نهائي' },
    { value: SUMMER_ADMIN_ACTION.MANUAL_CANCEL, label: 'إلغاء يدوي' },
    { value: SUMMER_ADMIN_ACTION.APPROVE_TRANSFER, label: 'اعتماد تحويل' }
  ];

  filtersForm: FormGroup;
  actionForm: FormGroup;

  dashboard: SummerAdminDashboardDto | null = null;
  requests: SummerRequestSummaryDto[] = [];
  selectedRequestId: number | null = null;
  selectedRequestDetails: MessageDto | null = null;

  loadingDashboard = false;
  loadingRequests = false;
  loadingDetails = false;
  submittingAction = false;

  activeDashboardStatus = '';
  activeDashboardPaymentState = '';
  requestsTotalCount = 0;
  requestsPageNumber = 1;
  requestsPageSize = 5;
  requestsTotalPages = 1;

  readonly pageSizeOptions = [5, 10, 25, 50];
  private readonly allowedAdminActionCodes = new Set<SummerAdminActionCode>([
    SUMMER_ADMIN_ACTION.FINAL_APPROVE,
    SUMMER_ADMIN_ACTION.MANUAL_CANCEL,
    SUMMER_ADMIN_ACTION.COMMENT,
    SUMMER_ADMIN_ACTION.APPROVE_TRANSFER
  ]);

  capacityDialogVisible = false;
  loadingWaveCapacity = false;
  capacityLastUpdatedAt: string | null = null;
  capacityErrorText = '';
  capacityRows: SummerWaveCapacityDto[] = [];
  capacityScopeCategoryId: number | null = null;
  capacityScopeWaveCode = '';
  bookingsPrintDialogVisible = false;
  loadingWaveBookingsPrint = false;
  waveBookingsPrintErrorText = '';
  waveBookingsPrintData: SummerWaveBookingsPrintReportDto | null = null;
  resortBookingsPrintDialogVisible = false;
  loadingResortBookingsPrint = false;
  resortBookingsPrintErrorText = '';
  resortBookingsPrintData: SummerResortBookingsPrintReportVm | null = null;
  allResortsSummaryDialogVisible = false;
  loadingAllResortsSummaryPrint = false;
  allResortsSummaryErrorText = '';
  allResortsSummaryData: SummerAllResortsSummaryPrintReportVm | null = null;
  requestAdminPrintDialogVisible = false;
  requestAdminPrintGeneratedAt = '';
  requestAdminPrintFooterMarkers: WaveBookingsPrintFooterMarker[] = [];
  requestAdminPrintTotalPages = 0;

  readonly pricingModeOptions: Array<{ value: string; label: string }> = [
    { value: 'AccommodationOnlyAllowed', label: 'إقامة فقط' },
    { value: 'AccommodationAndTransportationOptional', label: 'إقامة وانتقالات (اختياري)' },
    { value: 'TransportationMandatoryIncluded', label: 'انتقالات إلزامية ومضمنة' }
  ];
  pricingCatalogLoading = false;
  pricingCatalogSaving = false;
  pricingCatalogError = '';
  pricingSeasonYear = this.seasonYear;
  pricingRecords: SummerPricingCatalogRecordDto[] = [];
  canManageSummerPricing = false;
  defaultPricingGroupsExpanded = false;
  private pricingGroupExpandedState: Record<string, boolean> = {};

  actionAttachments: File[] = [];
  private readonly allowedAttachmentExtensions = new Set(['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp']);
  private readonly subscriptions = new Subscription();
  private requestsLoadVersion = 0;
  private dashboardRefreshTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly integerNumberFormatter = new Intl.NumberFormat('ar-EG', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
  waveBookingsPrintFooterMarkers: WaveBookingsPrintFooterMarker[] = [];
  waveBookingsPrintTotalPages = 0;
  resortBookingsPrintFooterMarkers: WaveBookingsPrintFooterMarker[] = [];
  resortBookingsPrintTotalPages = 0;
  allResortsSummaryPrintFooterMarkers: WaveBookingsPrintFooterMarker[] = [];
  allResortsSummaryPrintTotalPages = 0;
  private readonly waveBookingsPrintPageContentHeightPx = (277 * 96) / 25.4;
  private readonly waveBookingsPrintFooterInsetPx = (4 * 96) / 25.4;
  private isWaveBookingsPrintModeEnabled = false;
  private waveBookingsPrintMediaQueryList: MediaQueryList | null = null;
  private readonly onWaveBookingsAfterPrint = () => {
    this.disableWaveBookingsPrintMode();
  };
  private readonly onWaveBookingsPrintMediaChange = (event: MediaQueryListEvent): void => {
    if (!event.matches) {
      this.disableWaveBookingsPrintMode();
    }
  };

  constructor(
    private readonly fb: FormBuilder,
    private readonly summerWorkflowController: SummerWorkflowController,
    private readonly dynamicFormController: DynamicFormController,
    private readonly dynamicMetadataService: DynamicMetadataService,
    private readonly attachmentsController: AttachmentsController,
    private readonly attchedObjectService: AttchedObjectService,
    private readonly authObjectsService: AuthObjectsService,
    private readonly msg: MsgsService,
    private readonly spinner: SpinnerService,
    private readonly summerRealtimeService: SummerRequestsRealtimeService,
    private readonly adminRealtimePatchService: SummerAdminRealtimePatchService
  ) {
    this.filtersForm = this.fb.group({
      categoryId: [null],
      waveCode: [''],
      includeFinancialsInPrint: [false],
      status: [''],
      paymentState: [''],
      employeeId: [''],
      search: [''],
      pageNumber: [1],
      pageSize: [5]
    });

    this.actionForm = this.fb.group({
      actionCode: [SUMMER_ADMIN_ACTION.COMMENT, Validators.required],
      comment: ['', Validators.maxLength(2000)],
      force: [false],
      toCategoryId: [null],
      toWaveCode: [''],
      newFamilyCount: [null],
      newExtraCount: [0]
    });
  }

  ngOnInit(): void {
    this.defaultPricingGroupsExpanded = this.resolveDefaultPricingGroupExpandState();
    this.refreshSummerPricingAccess();
    this.bindActionRules();
    this.bindFilterDependencies();
    this.bindSignalRefresh();
    const authSub = this.authObjectsService.authObject$.subscribe(() => {
      this.refreshSummerPricingAccess();
    });
    this.subscriptions.add(authSub);
    this.loadDestinationCatalog();
  }

  ngOnDestroy(): void {
    this.disableWaveBookingsPrintMode();
    if (this.dashboardRefreshTimer) {
      clearTimeout(this.dashboardRefreshTimer);
      this.dashboardRefreshTimer = null;
    }
    this.subscriptions.unsubscribe();
  }

  loadDestinationCatalog(): void {
    this.loadingDestinations = true;
    this.destinationsError = '';
    this.dynamicMetadataService.getMendJson<unknown>(this.dynamicSummerApplicationId, SUMMER_DESTINATION_CATALOG_KEY).subscribe({
      next: response => {
        if (response?.isSuccess) {
          this.destinations = parseSummerDestinationCatalog(response.data, this.seasonYear);
          if (this.destinations.length > 0) {
            this.initializeAdminConsoleData();
            return;
          }
        }

        this.destinations = [];
        const errors = Array.isArray(response?.errors) ? response.errors : [];
        this.destinationsError = errors.length > 0
          ? errors.join('<br/>')
          : SUMMER_UI_TEXTS_AR.errors.destinationCatalogInvalid;
        this.initializeAdminConsoleData();
      },
      error: () => {
        this.destinations = [];
        this.destinationsError = SUMMER_UI_TEXTS_AR.errors.destinationCatalogLoadFailed;
        this.initializeAdminConsoleData();
      },
      complete: () => {
        this.loadingDestinations = false;
      }
    });
  }

  private initializeAdminConsoleData(): void {
    this.loadDashboard();
    this.loadRequests();
    if (this.canManageSummerPricing) {
      this.loadPricingCatalog();
      return;
    }

    this.resetPricingStateForUnauthorizedUser();
  }

  get selectedRequest(): SummerRequestSummaryDto | undefined {
    if (!this.selectedRequestId) {
      return undefined;
    }
    return this.requests.find(item => item.messageId === this.selectedRequestId);
  }

  get transferDestination(): SummerDestinationConfig | undefined {
    const categoryId = Number(this.actionForm.get('toCategoryId')?.value ?? 0);
    return this.destinations.find(item => item.categoryId === categoryId);
  }

  get transferWaves(): SummerWaveDefinition[] {
    return this.transferDestination?.waves ?? [];
  }

  get transferFamilyOptions(): number[] {
    return this.transferDestination?.familyOptions ?? [];
  }

  get dashboardScopeCategoryId(): number | null {
    const categoryId = Number(this.dashboard?.scopeCategoryId ?? 0);
    return categoryId > 0 ? categoryId : null;
  }

  get dashboardScopeWaveCode(): string {
    return String(this.dashboard?.scopeWaveCode ?? '').trim();
  }

  get dashboardScopeLabel(): string {
    const label = String(this.dashboard?.scopeLabel ?? '').trim();
    return label || 'رؤية عامة';
  }

  get requestRangeStart(): number {
    if (this.requestsTotalCount <= 0) {
      return 0;
    }
    return ((this.requestsPageNumber - 1) * this.requestsPageSize) + 1;
  }

  get requestRangeEnd(): number {
    if (this.requestsTotalCount <= 0) {
      return 0;
    }
    return Math.min(this.requestsPageNumber * this.requestsPageSize, this.requestsTotalCount);
  }

  get requestsPageData(): SummerRequestsPageData {
    const totalCount = Math.max(0, Number(this.requestsTotalCount) || 0);
    const pageSize = Math.max(1, Number(this.requestsPageSize) || 1);
    const totalPages = Math.max(1, Number(this.requestsTotalPages) || Math.ceil(totalCount / pageSize));
    const pageNumber = Math.max(1, Math.min(Number(this.requestsPageNumber) || 1, totalPages));

    return {
      pageNumber,
      pageSize,
      totalCount,
      totalPages,
      rangeStart: this.requestRangeStart,
      rangeEnd: this.requestRangeEnd,
      first: (pageNumber - 1) * pageSize,
      rows: pageSize,
      rowsPerPageOptions: this.pageSizeOptions
    };
  }

  get selectedFilterCategoryId(): number {
    return Number(this.filtersForm.get('categoryId')?.value ?? 0) || 0;
  }

  get selectedFilterWaveCode(): string {
    return String(this.filtersForm.get('waveCode')?.value ?? '').trim();
  }

  get canOpenWaveCapacityDialog(): boolean {
    return this.selectedFilterCategoryId > 0 && this.selectedFilterWaveCode.length > 0;
  }

  get selectedFilterDestinationName(): string {
    const destination = this.destinations.find(item => item.categoryId === this.selectedFilterCategoryId);
    return destination?.name ?? '-';
  }

  get capacityDialogTitle(): string {
    if (!this.capacityScopeCategoryId || !this.capacityScopeWaveCode) {
      return 'بيان الإتاحة';
    }

    const destination = this.destinations.find(item => item.categoryId === this.capacityScopeCategoryId);
    const destinationName = destination?.name ?? `مصيف ${this.capacityScopeCategoryId}`;
    return `${destinationName} - الفوج ${this.capacityScopeWaveCode}`;
  }

  get capacityTotalUnits(): number {
    return this.capacityRows.reduce((sum, row) => sum + (Number(row.totalUnits ?? 0) || 0), 0);
  }

  get capacityUsedUnits(): number {
    return this.capacityRows.reduce((sum, row) => sum + (Number(row.usedUnits ?? 0) || 0), 0);
  }

  get capacityAvailableUnits(): number {
    return this.capacityRows.reduce((sum, row) => sum + (Number(row.availableUnits ?? 0) || 0), 0);
  }

  get capacityFrozenAvailableUnits(): number {
    return this.capacityRows.reduce((sum, row) => sum + (Number(row.frozenAvailableUnits ?? 0) || 0), 0);
  }

  get capacityFrozenAssignedUnits(): number {
    return this.capacityRows.reduce((sum, row) => sum + (Number(row.frozenAssignedUnits ?? 0) || 0), 0);
  }

  get waveBookingsPrintSections(): SummerWaveBookingsPrintSectionDto[] {
    return this.waveBookingsPrintData?.sections ?? [];
  }

  get includeFinancialsInWaveBookingsPrint(): boolean {
    return Boolean(this.filtersForm.get('includeFinancialsInPrint')?.value);
  }

  get hasWaveBookingsPrintRows(): boolean {
    return (this.waveBookingsPrintData?.totalBookings ?? 0) > 0;
  }

  get showWaveBookingsFinancialColumns(): boolean {
    return this.includeFinancialsInWaveBookingsPrint;
  }

  get showWaveBookingsFinancialSummary(): boolean {
    return this.showWaveBookingsFinancialColumns && this.hasWaveBookingsPrintRows;
  }

  get waveBookingsDialogWidth(): string {
    return this.showWaveBookingsFinancialColumns ? '1360px' : '1220px';
  }

  get waveBookingsPrintTotalBookingAmount(): number {
    const total = Number(this.waveBookingsPrintData?.totalBookingAmount ?? 0);
    return Number.isFinite(total) ? total : 0;
  }

  get waveBookingsPrintTotalInsuranceAmount(): number {
    const total = Number(this.waveBookingsPrintData?.totalInsuranceAmount ?? 0);
    return Number.isFinite(total) ? total : 0;
  }

  get waveBookingsPrintTotalFinalAmount(): number {
    const total = Number(this.waveBookingsPrintData?.totalFinalAmount ?? 0);
    return Number.isFinite(total) ? total : 0;
  }

  get canOpenResortBookingsPrintDialog(): boolean {
    return this.selectedFilterCategoryId > 0;
  }

  get hasResortBookingsPrintRows(): boolean {
    return (this.resortBookingsPrintData?.totalBookings ?? 0) > 0;
  }

  get resortBookingsWaveGroups(): SummerResortBookingsWaveGroupVm[] {
    return this.resortBookingsPrintData?.waveGroups ?? [];
  }

  get resortBookingsPrintSectionsFlat(): SummerWaveBookingsPrintSectionDto[] {
    return this.resortBookingsWaveGroups.flatMap(group => group.sections ?? []);
  }

  get showResortBookingsPrintRequestRefColumn(): boolean {
    return this.hasAnyResortBookingsPrintText(row => row.requestRef);
  }

  get showResortBookingsPrintUnitNumberColumn(): boolean {
    return this.hasAnyResortBookingsPrintText(row => row.unitNumber);
  }

  get showResortBookingsPrintPersonsCountColumn(): boolean {
    return this.hasAnyResortBookingsPrintNumeric(row => row.personsCount);
  }

  get showResortBookingsPrintStatusColumn(): boolean {
    return this.hasAnyResortBookingsPrintText(row => row.statusLabel);
  }

  get showResortBookingsPrintNotesColumn(): boolean {
    return this.hasAnyResortBookingsPrintText(row => row.notes);
  }

  get hasAllResortsSummaryRows(): boolean {
    return (this.allResortsSummaryData?.resorts?.length ?? 0) > 0;
  }

  get allResortsSummaryResorts(): SummerAllResortsSummaryResortVm[] {
    return this.allResortsSummaryData?.resorts ?? [];
  }

  get waveBookingsPrintUserName(): string {
    const candidates = [
      localStorage.getItem('firstName'),
      localStorage.getItem('UserId'),
      this.waveBookingsPrintData?.generatedByUserId
    ];

    for (const candidate of candidates) {
      const text = String(candidate ?? '').trim();
      if (text.length > 0) {
        return text;
      }
    }

    return '-';
  }

  get showWaveBookingsPrintRequestRefColumn(): boolean {
    return this.hasAnyWaveBookingsPrintText(row => row.requestRef);
  }

  get showWaveBookingsPrintUnitNumberColumn(): boolean {
    return this.hasAnyWaveBookingsPrintText(row => row.unitNumber);
  }

  get showWaveBookingsPrintPersonsCountColumn(): boolean {
    return this.hasAnyWaveBookingsPrintNumeric(row => row.personsCount);
  }

  get showWaveBookingsPrintStatusColumn(): boolean {
    return this.hasAnyWaveBookingsPrintText(row => row.statusLabel);
  }

  get showWaveBookingsPrintNotesColumn(): boolean {
    return this.hasAnyWaveBookingsPrintText(row => row.notes);
  }

  get selectedDashboardDestination(): SummerDestinationConfig | undefined {
    if (!this.dashboardScopeCategoryId) {
      return undefined;
    }
    return this.destinations.find(item => item.categoryId === this.dashboardScopeCategoryId);
  }

  get dashboardDestinationChips(): Array<{ categoryId: number; name: string; count: number }> {
    return this.destinations.map(destination => ({
      categoryId: destination.categoryId,
      name: destination.name,
      count: this.getDestinationCount(destination.categoryId)
    }));
  }

  get dashboardWaveChips(): Array<{ waveCode: string; label: string; count: number }> {
    const selectedDestination = this.selectedDashboardDestination;
    if (selectedDestination) {
      return selectedDestination.waves.map(wave => ({
        waveCode: wave.code,
        label: `${wave.code} - ${wave.startsAtLabel}`,
        count: this.getWaveCount(wave.code)
      }));
    }

    return [...(this.dashboard?.byWave ?? [])]
      .sort((a, b) => this.getWaveOrder(a.key) - this.getWaveOrder(b.key))
      .slice(0, 20)
      .map(wave => ({
        waveCode: wave.key,
        label: wave.key,
        count: wave.count
      }));
  }

  get dashboardWaveBreakdownSorted(): SummerDashboardBucketDto[] {
    return [...(this.dashboard?.byWave ?? [])]
      .sort((a, b) => {
        const orderDiff = this.getWaveOrder(a.key) - this.getWaveOrder(b.key);
        if (orderDiff !== 0) {
          return orderDiff;
        }

        return String(a.key ?? '').localeCompare(String(b.key ?? ''), 'ar');
      });
  }

  get filterWaveOptions(): SummerWaveDefinition[] {
    const selectedCategoryId = Number(this.filtersForm.get('categoryId')?.value ?? 0);
    if (selectedCategoryId > 0) {
      const destination = this.destinations.find(item => item.categoryId === selectedCategoryId);
      return destination?.waves ?? [];
    }

    const uniqueWaves = new Map<string, SummerWaveDefinition>();
    this.destinations.forEach(destination => {
      destination.waves.forEach(wave => {
        const code = String(wave.code ?? '').trim();
        if (!code || uniqueWaves.has(code)) {
          return;
        }
        uniqueWaves.set(code, wave);
      });
    });

    return Array.from(uniqueWaves.values())
      .sort((a, b) => this.getWaveOrder(a.code) - this.getWaveOrder(b.code));
  }

  get selectedRequestFields(): SummerRequestFieldGridRow[] {
    const currentRequest = this.selectedRequest;
    return buildSummerRequestDetailFields({
      fields: this.selectedRequestDetails?.fields,
      summary: currentRequest ?? null,
      summaryStatusLabel: currentRequest ? this.getRequestStatusLabel(currentRequest) : '',
      summaryDateFormatter: this.formatDate.bind(this),
      resolveWaveLabel: (categoryId, waveCode) => this.getWaveLabelByCategoryAndCode(categoryId, waveCode),
      resolveDestinationNameById: (categoryId) => this.getDestinationNameByCategoryId(categoryId)
    });
  }

  get selectedRequestCompanions(): Array<{ index: number; name: string; relation: string; nationalId: string; age: string }> {
    return buildSummerRequestCompanions(this.selectedRequestDetails?.fields);
  }

  get isTransferActionSelected(): boolean {
    const normalized = this.normalizeActionCode(this.actionForm.get('actionCode')?.value);
    return normalized === SUMMER_ADMIN_ACTION.APPROVE_TRANSFER;
  }

  get isSelectedActionBlockedByCurrentState(): boolean {
    const normalized = this.normalizeActionCode(this.actionForm.get('actionCode')?.value);
    if (!normalized) {
      return false;
    }
    return this.isActionBlockedByCurrentState(normalized);
  }

  get selectedActionBlockedMessage(): string {
    const normalized = this.normalizeActionCode(this.actionForm.get('actionCode')?.value);
    if (!normalized) {
      return '';
    }

    const decision = this.resolveActionDecision(normalized);
    return decision.isAllowed
      ? ''
      : (decision.errorMessage || SUMMER_UI_TEXTS_AR.errors.invalidAdminActionForCurrentState);
  }

  isActionBlockedByCurrentState(actionCode: SummerAdminActionCode): boolean {
    return !this.resolveActionDecision(actionCode).isAllowed;
  }

  get selectedRequestReplies(): Array<{ id: number; author: string; isAdminAction: boolean; message: string; created?: string; attachments: Array<{ id: number; name: string }> }> {
    const replies = this.selectedRequestDetails?.replies ?? [];
    return replies
      .map(reply => ({
        id: Number(reply.replyId ?? 0) || 0,
        author: String(reply.authorName ?? reply.authorId ?? 'غير محدد').trim() || 'غير محدد',
        isAdminAction: this.parseReplyAdminFlag((reply as { isAdminAction?: unknown; IsAdminAction?: unknown }).isAdminAction
          ?? (reply as { isAdminAction?: unknown; IsAdminAction?: unknown }).IsAdminAction),
        message: String(reply.message ?? '').trim(),
        created: reply.createdDate as unknown as string,
        attachments: (reply.attchShipmentDtos ?? []).map(item => ({
          id: this.resolveAttachmentId(item),
          name: String(item.attchNm ?? '-').trim() || '-'
        }))
      }))
      .sort((a, b) => this.toEpoch(b.created) - this.toEpoch(a.created) || b.id - a.id);
  }

  get selectedRequestAttachments(): Array<{ id: number; name: string }> {
    const attachments = this.selectedRequestDetails?.attachments ?? [];
    return attachments.map(item => ({
      id: this.resolveAttachmentId(item),
      name: String(item.attchNm ?? '-').trim() || '-'
    }));
  }

  get selectedRequestOwnerInfo(): { name: string; fileNumber: string; nationalId: string; phone: string; extraPhone: string } | null {
    const request = this.selectedRequest;
    if (!request) {
      return null;
    }

    const normalize = (value: unknown): string => {
      const text = String(value ?? '').trim();
      return text.length > 0 ? text : '-';
    };

    return {
      name: normalize(request.employeeName),
      fileNumber: normalize(request.employeeId),
      nationalId: normalize(request.employeeNationalId),
      phone: normalize(request.employeePhone),
      extraPhone: normalize(request.employeeExtraPhone)
    };
  }

  formatRequestPrintFieldValue(value: unknown): string {
    const text = String(value ?? '').trim();
    if (!text || text === '-') {
      return '-';
    }

    const normalized = text.toLowerCase();
    if (normalized === 'true') {
      return 'نعم';
    }
    if (normalized === 'false') {
      return 'لا';
    }

    if (this.looksLikeIsoDate(text)) {
      return this.formatDate(text);
    }

    return text;
  }

  isRequestPrintFieldWide(row: SummerRequestFieldGridRow): boolean {
    const label = String(row?.label ?? '').trim();
    const value = String(row?.value ?? '').trim();
    if (!label && !value) {
      return false;
    }

    if (/نص\s*رسالة|ملاحظ|تعليق|description|message/i.test(label)) {
      return true;
    }

    return value.length >= 90 || value.includes('\n');
  }

  onSearch(): void {
    this.filtersForm.patchValue({ pageNumber: 1 });
    this.syncQuickFiltersFromForm();
    this.loadRequests();
    this.loadDashboard();
  }

  clearFilters(): void {
    this.filtersForm.patchValue({
      categoryId: null,
      waveCode: '',
      includeFinancialsInPrint: false,
      status: '',
      paymentState: '',
      employeeId: '',
      search: '',
      pageNumber: 1,
      pageSize: 5
    });
    this.activeDashboardStatus = '';
    this.activeDashboardPaymentState = '';
    this.capacityDialogVisible = false;
    this.bookingsPrintDialogVisible = false;
    this.resortBookingsPrintDialogVisible = false;
    this.allResortsSummaryDialogVisible = false;
    this.requestAdminPrintDialogVisible = false;
    this.loadRequests();
    this.loadDashboard();
  }

  applyGeneralScope(): void {
    this.filtersForm.patchValue({
      categoryId: null,
      waveCode: '',
      pageNumber: 1
    });
    this.loadDashboard();
    this.loadRequests();
  }

  applyDestinationScope(categoryId: number): void {
    const destination = this.destinations.find(item => item.categoryId === categoryId);
    if (!destination) {
      return;
    }

    this.filtersForm.patchValue({
      categoryId,
      waveCode: '',
      pageNumber: 1
    });

    this.loadDashboard();
    this.loadRequests();
  }

  applyWaveScope(waveCode: string): void {
    const normalizedWave = String(waveCode ?? '').trim();
    if (!normalizedWave) {
      return;
    }

    this.filtersForm.patchValue({
      waveCode: normalizedWave,
      pageNumber: 1
    });

    this.loadDashboard();
    this.loadRequests();
  }

  clearWaveScope(): void {
    if (this.dashboardScopeCategoryId) {
      this.applyDestinationScope(this.dashboardScopeCategoryId);
      return;
    }

    this.applyGeneralScope();
  }

  applyStatusQuickFilter(status: string): void {
    const normalized = String(status ?? '').trim();
    const toggled = this.activeDashboardStatus === normalized ? '' : normalized;
    this.activeDashboardStatus = toggled;

    this.filtersForm.patchValue({
      status: toggled,
      pageNumber: 1
    });

    this.loadRequests();
  }

  applyPaymentQuickFilter(paymentState: string): void {
    const normalized = String(paymentState ?? '').trim();
    const toggled = this.activeDashboardPaymentState === normalized ? '' : normalized;
    this.activeDashboardPaymentState = toggled;

    this.filtersForm.patchValue({
      paymentState: toggled,
      pageNumber: 1
    });

    this.loadRequests();
  }

  isStatusQuickFilterActive(status: string): boolean {
    return this.activeDashboardStatus === String(status ?? '').trim();
  }

  isPaymentQuickFilterActive(paymentState: string): boolean {
    return this.activeDashboardPaymentState === String(paymentState ?? '').trim();
  }

  selectDestinationFromDashboardBucket(item: SummerDashboardBucketDto): void {
    const categoryId = Number(item?.id ?? 0);
    if (categoryId > 0) {
      this.applyDestinationScope(categoryId);
    }
  }

  selectWaveFromDashboardBucket(item: SummerDashboardBucketDto): void {
    const waveCode = String(item?.key ?? '').trim();
    if (waveCode.length > 0 && waveCode !== '-') {
      this.applyWaveScope(waveCode);
    }
  }

  onRequestsPageChange(event: SummerRequestsPageChange): void {
    const pageSize = Number(event?.pageSize ?? event?.rows ?? this.requestsPageSize);
    if (!Number.isFinite(pageSize) || pageSize <= 0) {
      return;
    }

    const normalizedPageSize = Math.max(1, Math.floor(pageSize));
    if (normalizedPageSize !== this.requestsPageSize) {
      this.onPageSizeChanged(normalizedPageSize);
      return;
    }

    const explicitPageNumber = Number(event?.pageNumber);
    const first = Number(event?.first);
    const inferredPage = Number.isFinite(first) && first >= 0
      ? Math.floor(first / normalizedPageSize) + 1
      : this.requestsPageNumber;
    const targetPage = Number.isFinite(explicitPageNumber) && explicitPageNumber > 0
      ? Math.floor(explicitPageNumber)
      : inferredPage;

    this.goToPage(targetPage);
  }

  onPageSizeChanged(value: string | number): void {
    const pageSize = Number(value);
    if (!Number.isFinite(pageSize) || pageSize <= 0) {
      return;
    }

    const normalizedPageSize = Math.max(1, Math.floor(pageSize));
    this.requestsPageSize = normalizedPageSize;
    this.filtersForm.patchValue({
      pageSize: normalizedPageSize,
      pageNumber: 1
    }, { emitEvent: false });
    this.loadRequests();
  }

  goToPage(page: number): void {
    const targetPage = Math.max(1, Math.min(page, this.requestsTotalPages));
    if (targetPage === this.requestsPageNumber) {
      return;
    }

    this.filtersForm.patchValue({ pageNumber: targetPage }, { emitEvent: false });
    this.loadRequests();
  }

  goToNextPage(): void {
    this.goToPage(this.requestsPageNumber + 1);
  }

  goToPreviousPage(): void {
    this.goToPage(this.requestsPageNumber - 1);
  }

  openWaveCapacityDialog(): void {
    if (!this.canOpenWaveCapacityDialog) {
      this.msg.msgError('خطأ', `<h5>${SUMMER_UI_TEXTS_AR.errors.invalidWaveCapacityScope}</h5>`, true);
      return;
    }

    this.capacityScopeCategoryId = this.selectedFilterCategoryId;
    this.capacityScopeWaveCode = this.selectedFilterWaveCode;
    this.capacityDialogVisible = true;
    this.refreshWaveCapacity();
  }

  openWaveBookingsPrintPreview(): void {
    if (!this.canOpenWaveCapacityDialog) {
      this.msg.msgError('خطأ', `<h5>${SUMMER_UI_TEXTS_AR.errors.invalidWaveCapacityScope}</h5>`, true);
      return;
    }

    this.resortBookingsPrintDialogVisible = false;
    this.allResortsSummaryDialogVisible = false;
    this.requestAdminPrintDialogVisible = false;
    this.bookingsPrintDialogVisible = true;
    this.refreshWaveBookingsPrintReport();
  }

  onCapacityDialogHide(): void {
    this.capacityDialogVisible = false;
  }

  onWaveBookingsPrintDialogHide(): void {
    this.bookingsPrintDialogVisible = false;
    this.waveBookingsPrintFooterMarkers = [];
    this.waveBookingsPrintTotalPages = 0;
    this.disableWaveBookingsPrintMode();
  }

  closeWaveBookingsPrintDialog(): void {
    this.bookingsPrintDialogVisible = false;
    this.waveBookingsPrintFooterMarkers = [];
    this.waveBookingsPrintTotalPages = 0;
    this.disableWaveBookingsPrintMode();
  }

  refreshWaveBookingsPrintReport(silent = false): void {
    if (!this.selectedFilterCategoryId || !this.selectedFilterWaveCode) {
      return;
    }

    this.loadingWaveBookingsPrint = true;
    this.waveBookingsPrintErrorText = '';
    if (!silent) {
      this.waveBookingsPrintData = null;
    }

    this.summerWorkflowController
      .getWaveBookingsPrintReport(
        this.selectedFilterCategoryId,
        this.selectedFilterWaveCode,
        this.seasonYear,
        this.includeFinancialsInWaveBookingsPrint
      )
      .subscribe({
        next: response => {
          if (response?.isSuccess && response.data) {
            this.waveBookingsPrintData = response.data;
            this.scheduleWaveBookingsPrintPaginationRefresh();
            return;
          }

          this.waveBookingsPrintData = null;
          this.waveBookingsPrintFooterMarkers = [];
          this.waveBookingsPrintTotalPages = 0;
          this.waveBookingsPrintErrorText = this.collectErrors(response);
          if (!silent) {
            this.msg.msgError('خطأ', `<h5>${this.waveBookingsPrintErrorText}</h5>`, true);
          }
        },
        error: () => {
          this.waveBookingsPrintData = null;
          this.waveBookingsPrintFooterMarkers = [];
          this.waveBookingsPrintTotalPages = 0;
          this.waveBookingsPrintErrorText = 'تعذر تحميل كشف الحاجزين حالياً.';
          if (!silent) {
            this.msg.msgError('خطأ', `<h5>${this.waveBookingsPrintErrorText}</h5>`, true);
          }
        },
        complete: () => {
          this.loadingWaveBookingsPrint = false;
        }
      });
  }

  printWaveBookingsReport(): void {
    if (this.loadingWaveBookingsPrint || this.waveBookingsPrintErrorText.length > 0 || !this.waveBookingsPrintData) {
      return;
    }

    this.enableWaveBookingsPrintMode();
    this.prepareWaveBookingsPrintPagination();
    setTimeout(() => {
      window.print();
    }, 0);
  }

  openResortBookingsPrintPreview(): void {
    if (!this.canOpenResortBookingsPrintDialog) {
      this.msg.msgError('خطأ', '<h5>يرجى اختيار المصيف أولًا لتشغيل تقرير المصيف.</h5>', true);
      return;
    }

    this.bookingsPrintDialogVisible = false;
    this.allResortsSummaryDialogVisible = false;
    this.requestAdminPrintDialogVisible = false;
    this.resortBookingsPrintDialogVisible = true;
    this.refreshResortBookingsPrintReport();
  }

  closeResortBookingsPrintDialog(): void {
    this.resortBookingsPrintDialogVisible = false;
    this.resortBookingsPrintFooterMarkers = [];
    this.resortBookingsPrintTotalPages = 0;
    this.disableWaveBookingsPrintMode();
  }

  onResortBookingsPrintDialogHide(): void {
    this.closeResortBookingsPrintDialog();
  }

  async refreshResortBookingsPrintReport(silent = false): Promise<void> {
    if (!this.selectedFilterCategoryId) {
      return;
    }

    const destination = this.destinations.find(item => item.categoryId === this.selectedFilterCategoryId);
    const waves = [...(destination?.waves ?? [])];
    this.loadingResortBookingsPrint = true;
    this.resortBookingsPrintErrorText = '';
    if (!silent) {
      this.resortBookingsPrintData = null;
    }

    try {
      const includeFinancials = this.includeFinancialsInWaveBookingsPrint;
      const waveGroups: SummerResortBookingsWaveGroupVm[] = [];
      for (const wave of waves) {
        const waveCode = String(wave?.code ?? '').trim();
        if (!waveCode) {
          continue;
        }

        const response = await firstValueFrom(this.summerWorkflowController.getWaveBookingsPrintReport(
          this.selectedFilterCategoryId,
          waveCode,
          this.seasonYear,
          includeFinancials
        ));

        if (!response?.isSuccess || !response.data) {
          this.resortBookingsPrintErrorText = this.collectErrors(response);
          this.resortBookingsPrintData = null;
          this.resortBookingsPrintFooterMarkers = [];
          this.resortBookingsPrintTotalPages = 0;
          if (!silent) {
            this.msg.msgError('خطأ', `<h5>${this.resortBookingsPrintErrorText}</h5>`, true);
          }
          return;
        }

        const waveData = response.data;
        if ((waveData.totalBookings ?? 0) <= 0) {
          continue;
        }

        waveGroups.push({
          waveCode,
          waveStartAtUtc: waveData.waveStartAtUtc,
          waveEndAtUtc: waveData.waveEndAtUtc,
          totalBookings: Number(waveData.totalBookings ?? 0) || 0,
          totalBookingAmount: includeFinancials ? Number(waveData.totalBookingAmount ?? 0) || 0 : 0,
          totalInsuranceAmount: includeFinancials ? Number(waveData.totalInsuranceAmount ?? 0) || 0 : 0,
          totalFinalAmount: includeFinancials ? Number(waveData.totalFinalAmount ?? 0) || 0 : 0,
          sections: [...(waveData.sections ?? [])]
        });
      }

      const totalPersons = waveGroups.reduce((sum, waveGroup) => {
        return sum + waveGroup.sections.reduce((sectionSum, section) => {
          return sectionSum + (section.rows ?? []).reduce((rowsSum, row) => rowsSum + Math.max(0, Number(row.personsCount ?? 0) || 0), 0);
        }, 0);
      }, 0);

      this.resortBookingsPrintData = {
        categoryId: this.selectedFilterCategoryId,
        categoryName: destination?.name ?? this.selectedFilterDestinationName,
        generatedAtUtc: new Date().toISOString(),
        generatedByUserId: this.waveBookingsPrintUserName,
        includeFinancials,
        totalConfiguredWaves: waves.length,
        totalWavesWithBookings: waveGroups.length,
        totalBookings: waveGroups.reduce((sum, group) => sum + group.totalBookings, 0),
        totalPersons,
        totalBookingAmount: includeFinancials ? waveGroups.reduce((sum, group) => sum + group.totalBookingAmount, 0) : 0,
        totalInsuranceAmount: includeFinancials ? waveGroups.reduce((sum, group) => sum + group.totalInsuranceAmount, 0) : 0,
        totalFinalAmount: includeFinancials ? waveGroups.reduce((sum, group) => sum + group.totalFinalAmount, 0) : 0,
        waveGroups
      };

      this.scheduleResortBookingsPrintPaginationRefresh();
    } catch {
      this.resortBookingsPrintData = null;
      this.resortBookingsPrintFooterMarkers = [];
      this.resortBookingsPrintTotalPages = 0;
      this.resortBookingsPrintErrorText = 'تعذر تحميل كشف الحاجزين للمصيف حالياً.';
      if (!silent) {
        this.msg.msgError('خطأ', `<h5>${this.resortBookingsPrintErrorText}</h5>`, true);
      }
    } finally {
      this.loadingResortBookingsPrint = false;
    }
  }

  printResortBookingsReport(): void {
    if (this.loadingResortBookingsPrint || this.resortBookingsPrintErrorText.length > 0 || !this.resortBookingsPrintData) {
      return;
    }

    this.enableWaveBookingsPrintMode();
    this.prepareResortBookingsPrintPagination();
    setTimeout(() => {
      window.print();
    }, 0);
  }

  openAllResortsSummaryPrintPreview(): void {
    if (this.destinations.length === 0) {
      this.msg.msgError('خطأ', '<h5>لا توجد مصايف متاحة لتوليد التقرير.</h5>', true);
      return;
    }

    this.bookingsPrintDialogVisible = false;
    this.resortBookingsPrintDialogVisible = false;
    this.requestAdminPrintDialogVisible = false;
    this.allResortsSummaryDialogVisible = true;
    this.refreshAllResortsSummaryPrintReport();
  }

  closeAllResortsSummaryPrintDialog(): void {
    this.allResortsSummaryDialogVisible = false;
    this.allResortsSummaryPrintFooterMarkers = [];
    this.allResortsSummaryPrintTotalPages = 0;
    this.disableWaveBookingsPrintMode();
  }

  onAllResortsSummaryPrintDialogHide(): void {
    this.closeAllResortsSummaryPrintDialog();
  }

  async refreshAllResortsSummaryPrintReport(silent = false): Promise<void> {
    this.loadingAllResortsSummaryPrint = true;
    this.allResortsSummaryErrorText = '';
    if (!silent) {
      this.allResortsSummaryData = null;
    }

    try {
      const includeFinancials = this.includeFinancialsInWaveBookingsPrint;
      const resorts: SummerAllResortsSummaryResortVm[] = [];
      for (const destination of this.destinations) {
        const categoryId = Number(destination?.categoryId ?? 0);
        if (categoryId <= 0) {
          continue;
        }

        const waves = [...(destination.waves ?? [])];
        const waveSummaries: SummerAllResortsSummaryWaveVm[] = [];
        for (const wave of waves) {
          const waveCode = String(wave?.code ?? '').trim();
          if (!waveCode) {
            continue;
          }

          const response = await firstValueFrom(this.summerWorkflowController.getWaveBookingsPrintReport(
            categoryId,
            waveCode,
            this.seasonYear,
            includeFinancials
          ));

          if (!response?.isSuccess || !response.data) {
            this.allResortsSummaryErrorText = this.collectErrors(response);
            this.allResortsSummaryData = null;
            this.allResortsSummaryPrintFooterMarkers = [];
            this.allResortsSummaryPrintTotalPages = 0;
            if (!silent) {
              this.msg.msgError('خطأ', `<h5>${this.allResortsSummaryErrorText}</h5>`, true);
            }
            return;
          }

          const waveData = response.data;
          const totalBookings = Number(waveData.totalBookings ?? 0) || 0;
          if (totalBookings <= 0) {
            continue;
          }

          const totalPersons = (waveData.sections ?? []).reduce((sum, section) => {
            return sum + (section.rows ?? []).reduce((rowsSum, row) => rowsSum + Math.max(0, Number(row.personsCount ?? 0) || 0), 0);
          }, 0);

          waveSummaries.push({
            waveCode,
            totalBookings,
            totalPersons,
            totalBookingAmount: includeFinancials ? Number(waveData.totalBookingAmount ?? 0) || 0 : 0,
            totalInsuranceAmount: includeFinancials ? Number(waveData.totalInsuranceAmount ?? 0) || 0 : 0,
            totalFinalAmount: includeFinancials ? Number(waveData.totalFinalAmount ?? 0) || 0 : 0
          });
        }

        resorts.push({
          categoryId,
          categoryName: destination.name ?? `مصيف ${categoryId}`,
          totalConfiguredWaves: waves.length,
          totalWavesWithBookings: waveSummaries.length,
          totalBookings: waveSummaries.reduce((sum, item) => sum + item.totalBookings, 0),
          totalPersons: waveSummaries.reduce((sum, item) => sum + item.totalPersons, 0),
          totalBookingAmount: includeFinancials ? waveSummaries.reduce((sum, item) => sum + item.totalBookingAmount, 0) : 0,
          totalInsuranceAmount: includeFinancials ? waveSummaries.reduce((sum, item) => sum + item.totalInsuranceAmount, 0) : 0,
          totalFinalAmount: includeFinancials ? waveSummaries.reduce((sum, item) => sum + item.totalFinalAmount, 0) : 0,
          waves: waveSummaries
        });
      }

      this.allResortsSummaryData = {
        generatedAtUtc: new Date().toISOString(),
        generatedByUserId: this.waveBookingsPrintUserName,
        includeFinancials,
        totalResorts: resorts.length,
        totalConfiguredWaves: resorts.reduce((sum, resort) => sum + resort.totalConfiguredWaves, 0),
        totalWavesWithBookings: resorts.reduce((sum, resort) => sum + resort.totalWavesWithBookings, 0),
        totalBookings: resorts.reduce((sum, resort) => sum + resort.totalBookings, 0),
        totalPersons: resorts.reduce((sum, resort) => sum + resort.totalPersons, 0),
        totalBookingAmount: includeFinancials ? resorts.reduce((sum, resort) => sum + resort.totalBookingAmount, 0) : 0,
        totalInsuranceAmount: includeFinancials ? resorts.reduce((sum, resort) => sum + resort.totalInsuranceAmount, 0) : 0,
        totalFinalAmount: includeFinancials ? resorts.reduce((sum, resort) => sum + resort.totalFinalAmount, 0) : 0,
        resorts
      };

      this.scheduleAllResortsSummaryPrintPaginationRefresh();
    } catch {
      this.allResortsSummaryData = null;
      this.allResortsSummaryPrintFooterMarkers = [];
      this.allResortsSummaryPrintTotalPages = 0;
      this.allResortsSummaryErrorText = 'تعذر تحميل تقرير جميع المصايف حالياً.';
      if (!silent) {
        this.msg.msgError('خطأ', `<h5>${this.allResortsSummaryErrorText}</h5>`, true);
      }
    } finally {
      this.loadingAllResortsSummaryPrint = false;
    }
  }

  printAllResortsSummaryReport(): void {
    if (this.loadingAllResortsSummaryPrint || this.allResortsSummaryErrorText.length > 0 || !this.allResortsSummaryData) {
      return;
    }

    this.enableWaveBookingsPrintMode();
    this.prepareAllResortsSummaryPrintPagination();
    setTimeout(() => {
      window.print();
    }, 0);
  }

  openSelectedRequestPrintPreview(): void {
    if (!this.selectedRequest) {
      this.msg.msgError('خطأ', '<h5>يرجى اختيار طلب أولًا.</h5>', true);
      return;
    }

    this.bookingsPrintDialogVisible = false;
    this.resortBookingsPrintDialogVisible = false;
    this.allResortsSummaryDialogVisible = false;
    this.requestAdminPrintDialogVisible = true;
    this.requestAdminPrintGeneratedAt = new Date().toISOString();
    if (!this.selectedRequestDetails || Number(this.selectedRequestDetails.messageId ?? 0) !== Number(this.selectedRequest.messageId ?? 0)) {
      this.loadSelectedRequestDetails(this.selectedRequest.messageId);
    }
    this.scheduleRequestAdminPrintPaginationRefresh();
  }

  closeSelectedRequestPrintDialog(): void {
    this.requestAdminPrintDialogVisible = false;
    this.requestAdminPrintGeneratedAt = '';
    this.requestAdminPrintFooterMarkers = [];
    this.requestAdminPrintTotalPages = 0;
    this.disableWaveBookingsPrintMode();
  }

  onRequestAdminPrintDialogHide(): void {
    this.closeSelectedRequestPrintDialog();
  }

  printSelectedRequestReport(): void {
    if (!this.selectedRequest) {
      return;
    }

    this.enableWaveBookingsPrintMode();
    this.prepareRequestAdminPrintPagination();
    setTimeout(() => {
      window.print();
    }, 0);
  }

  @HostListener('window:beforeprint')
  onBeforeWindowPrint(): void {
    if (this.bookingsPrintDialogVisible && !this.loadingWaveBookingsPrint && this.waveBookingsPrintErrorText.length === 0 && this.waveBookingsPrintData) {
      this.enableWaveBookingsPrintMode();
      this.prepareWaveBookingsPrintPagination();
      return;
    }

    if (this.resortBookingsPrintDialogVisible && !this.loadingResortBookingsPrint && this.resortBookingsPrintErrorText.length === 0 && this.resortBookingsPrintData) {
      this.enableWaveBookingsPrintMode();
      this.prepareResortBookingsPrintPagination();
      return;
    }

    if (this.allResortsSummaryDialogVisible && !this.loadingAllResortsSummaryPrint && this.allResortsSummaryErrorText.length === 0 && this.allResortsSummaryData) {
      this.enableWaveBookingsPrintMode();
      this.prepareAllResortsSummaryPrintPagination();
      return;
    }

    if (this.requestAdminPrintDialogVisible && this.selectedRequest) {
      this.enableWaveBookingsPrintMode();
      this.prepareRequestAdminPrintPagination();
    }
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    if (this.bookingsPrintDialogVisible && !this.loadingWaveBookingsPrint && this.waveBookingsPrintData) {
      this.scheduleWaveBookingsPrintPaginationRefresh();
    }

    if (this.resortBookingsPrintDialogVisible && !this.loadingResortBookingsPrint && this.resortBookingsPrintData) {
      this.scheduleResortBookingsPrintPaginationRefresh();
    }

    if (this.allResortsSummaryDialogVisible && !this.loadingAllResortsSummaryPrint && this.allResortsSummaryData) {
      this.scheduleAllResortsSummaryPrintPaginationRefresh();
    }

    if (this.requestAdminPrintDialogVisible && this.selectedRequest) {
      this.scheduleRequestAdminPrintPaginationRefresh();
    }
  }

  refreshWaveCapacity(silent = false): void {
    if (!this.capacityScopeCategoryId || !this.capacityScopeWaveCode) {
      return;
    }

    this.loadingWaveCapacity = true;
    this.capacityErrorText = '';
    this.summerWorkflowController.getWaveCapacity(this.capacityScopeCategoryId, this.capacityScopeWaveCode, true).subscribe({
      next: response => {
        if (response?.isSuccess && Array.isArray(response.data)) {
          this.capacityRows = [...response.data]
            .sort((a, b) => (Number(a.familyCount ?? 0) || 0) - (Number(b.familyCount ?? 0) || 0));
          this.capacityLastUpdatedAt = new Date().toISOString();
          return;
        }

        this.capacityRows = [];
        this.capacityErrorText = this.collectErrors(response);
        if (!silent) {
          this.msg.msgError('خطأ', `<h5>${this.capacityErrorText}</h5>`, true);
        }
      },
      error: () => {
        this.capacityRows = [];
        this.capacityErrorText = 'تعذر تحميل بيان الإتاحة حالياً.';
        if (!silent) {
          this.msg.msgError('خطأ', `<h5>${this.capacityErrorText}</h5>`, true);
        }
      },
      complete: () => {
        this.loadingWaveCapacity = false;
      }
    });
  }

  loadPricingCatalog(silent = true): void {
    if (!this.canManageSummerPricing) {
      this.resetPricingStateForUnauthorizedUser();
      return;
    }

    this.pricingCatalogLoading = true;
    if (!silent) {
      this.pricingCatalogError = '';
    }

    this.summerWorkflowController.getPricingCatalog(this.seasonYear).subscribe({
      next: response => {
        if (response?.isSuccess && response.data) {
          const catalog = response.data as SummerPricingCatalogDto;
          this.pricingSeasonYear = Number(catalog.seasonYear ?? this.seasonYear) || this.seasonYear;
          this.pricingRecords = Array.isArray(catalog.records)
            ? catalog.records.map(record => this.normalizePricingRecord(record))
            : [];

          if (this.pricingRecords.length === 0) {
            this.pricingRecords = [this.createEmptyPricingRecord()];
          }
          this.resetPricingGroupExpansionState();
          this.syncPricingGroupExpansionState();
          this.pricingCatalogError = '';
          return;
        }

        const errorText = this.collectErrors(response) || 'تعذر تحميل إعدادات التسعير.';
        this.pricingCatalogError = errorText;
        if (!silent) {
          this.msg.msgError('خطأ', `<h5>${errorText}</h5>`, true);
        }
      },
      error: () => {
        this.pricingCatalogError = 'تعذر تحميل إعدادات التسعير حالياً.';
        if (!silent) {
          this.msg.msgError('خطأ', `<h5>${this.pricingCatalogError}</h5>`, true);
        }
      },
      complete: () => {
        this.pricingCatalogLoading = false;
      }
    });
  }

  addPricingRecord(categoryId?: number): void {
    if (!this.canManageSummerPricing) {
      return;
    }

    this.pricingRecords = [...this.pricingRecords, this.createEmptyPricingRecord(categoryId)];
    this.syncPricingGroupExpansionState();
  }

  duplicatePricingRecord(index: number): void {
    if (!this.canManageSummerPricing) {
      return;
    }

    if (index < 0 || index >= this.pricingRecords.length) {
      return;
    }

    const sourceRecord = this.normalizePricingRecord(this.pricingRecords[index]);
    const duplicatedRecord = this.normalizePricingRecord({
      ...sourceRecord,
      pricingConfigId: this.buildDuplicatedPricingConfigId(sourceRecord)
    });

    this.pricingRecords = [
      ...this.pricingRecords.slice(0, index + 1),
      duplicatedRecord,
      ...this.pricingRecords.slice(index + 1)
    ];
    this.syncPricingGroupExpansionState();

    this.msg.msgSuccess('تم نسخ السجل بنجاح، يرجى مراجعة البيانات ثم الحفظ.');
  }

  removePricingRecord(index: number): void {
    if (!this.canManageSummerPricing) {
      return;
    }

    if (index < 0 || index >= this.pricingRecords.length) {
      return;
    }

    this.pricingRecords = this.pricingRecords.filter((_, i) => i !== index);
    if (this.pricingRecords.length === 0) {
      this.pricingRecords = [this.createEmptyPricingRecord()];
    }
    this.syncPricingGroupExpansionState();
  }

  onPricingModeChanged(record: SummerPricingCatalogRecordDto): void {
    if (!this.canManageSummerPricing) {
      return;
    }

    const normalizedMode = String(record?.pricingMode ?? '').trim();
    if (normalizedMode === 'TransportationMandatoryIncluded') {
      record.transportationMandatory = true;
      return;
    }

    if (normalizedMode === 'AccommodationOnlyAllowed') {
      record.transportationMandatory = false;
      record.transportationPricePerPerson = 0;
    }
  }

  savePricingCatalog(): void {
    if (!this.canManageSummerPricing) {
      return;
    }

    const payload: SummerPricingCatalogUpsertRequest = {
      seasonYear: Number(this.pricingSeasonYear) || this.seasonYear,
      records: this.pricingRecords.map((record, index) => this.normalizePricingRecordForSave(record, index))
    };

    this.pricingCatalogSaving = true;
    this.spinner.show('جاري حفظ إعدادات التسعير...');
    this.summerWorkflowController.savePricingCatalog(payload).subscribe({
      next: response => {
        if (response?.isSuccess && response.data) {
          const catalog = response.data as SummerPricingCatalogDto;
          this.pricingSeasonYear = Number(catalog.seasonYear ?? payload.seasonYear) || payload.seasonYear;
          this.pricingRecords = Array.isArray(catalog.records)
            ? catalog.records.map(record => this.normalizePricingRecord(record))
            : [];
          if (this.pricingRecords.length === 0) {
            this.pricingRecords = [this.createEmptyPricingRecord()];
          }
          this.resetPricingGroupExpansionState();
          this.syncPricingGroupExpansionState();
          this.pricingCatalogError = '';
          this.msg.msgSuccess('تم حفظ إعدادات التسعير بنجاح.');
          return;
        }

        this.msg.msgError('خطأ', `<h5>${this.collectErrors(response)}</h5>`, true);
      },
      error: () => {
        this.msg.msgError('خطأ', '<h5>تعذر حفظ إعدادات التسعير حالياً.</h5>', true);
      },
      complete: () => {
        this.pricingCatalogSaving = false;
        this.spinner.hide();
      }
    });
  }

  loadDashboard(): void {
    this.loadingDashboard = true;
    const raw = this.filtersForm.getRawValue();
    const categoryId = Number(raw.categoryId ?? 0) || null;
    const waveCode = String(raw.waveCode ?? '').trim();

    this.summerWorkflowController.getAdminDashboard(this.seasonYear, categoryId, waveCode).subscribe({
      next: response => {
        this.dashboard = response?.isSuccess ? response.data : null;
      },
      error: () => {
        this.dashboard = null;
      },
      complete: () => {
        this.loadingDashboard = false;
      }
    });
  }

  loadRequests(): void {
    const loadVersion = ++this.requestsLoadVersion;
    this.loadingRequests = true;
    const raw = this.filtersForm.getRawValue();
    const requestedPageNumber = Number(raw.pageNumber ?? 1) || 1;
    const requestedPageSizeRaw = Number(raw.pageSize ?? this.requestsPageSize) || this.requestsPageSize;
    const requestedPageSize = Math.max(1, Math.floor(requestedPageSizeRaw));
    this.summerWorkflowController.getAdminRequests({
      seasonYear: this.seasonYear,
      categoryId: raw.categoryId,
      waveCode: String(raw.waveCode ?? '').trim(),
      status: String(raw.status ?? '').trim(),
      paymentState: String(raw.paymentState ?? '').trim(),
      employeeId: String(raw.employeeId ?? '').trim(),
      search: String(raw.search ?? '').trim(),
      pageNumber: requestedPageNumber,
      pageSize: requestedPageSize
    }).subscribe({
      next: response => {
        if (loadVersion !== this.requestsLoadVersion) {
          return;
        }

        const isSuccess = Boolean(response?.isSuccess);
        this.requests = isSuccess && Array.isArray(response?.data) ? response.data : [];

        const totalCount = Number(response?.totalCount ?? this.requests.length) || 0;
        const responsePageSize = Number(response?.pageSize ?? requestedPageSize) || requestedPageSize;
        const pageSize = Math.max(1, Math.floor(responsePageSize));
        const pageNumber = Number(response?.pageNumber ?? requestedPageNumber) || requestedPageNumber;
        const computedTotalPages = Math.max(1, Math.ceil(totalCount / Math.max(1, pageSize)));
        const responseTotalPages = Math.max(1, Number(response?.totalPages ?? computedTotalPages) || computedTotalPages);

        this.requestsTotalCount = Math.max(0, totalCount);
        this.requestsPageSize = pageSize;
        this.requestsTotalPages = Math.max(computedTotalPages, responseTotalPages);
        this.requestsPageNumber = Math.max(1, Math.min(pageNumber, this.requestsTotalPages));
        this.filtersForm.patchValue({ pageSize: this.requestsPageSize }, { emitEvent: false });

        if (this.requestsTotalCount > 0 && pageNumber > this.requestsTotalPages) {
          this.filtersForm.patchValue({ pageNumber: this.requestsTotalPages }, { emitEvent: false });
          this.loadRequests();
          return;
        }

        if (this.selectedRequestId && !this.requests.some(item => item.messageId === this.selectedRequestId)) {
          this.selectedRequestId = null;
          this.selectedRequestDetails = null;
        }
      },
      error: () => {
        if (loadVersion !== this.requestsLoadVersion) {
          return;
        }

        this.requests = [];
        this.requestsTotalCount = 0;
        this.requestsPageNumber = 1;
        this.requestsTotalPages = 1;
      },
      complete: () => {
        if (loadVersion !== this.requestsLoadVersion) {
          return;
        }

        this.loadingRequests = false;
      }
    });
  }

  selectRequest(messageId: number): void {
    this.selectedRequestId = messageId;
    this.selectedRequestDetails = null;
    this.patchActionDefaultsForSelectedRequest();
    this.loadSelectedRequestDetails(messageId);
  }

  submitAdminAction(): void {
    this.actionForm.markAllAsTouched();
    if (this.actionForm.invalid) {
      this.msg.msgError('خطأ', `<h5>${SUMMER_UI_TEXTS_AR.errors.invalidAdminActionData}</h5>`, true);
      return;
    }

    if (!this.selectedRequestId) {
      this.msg.msgError('خطأ', `<h5>${SUMMER_UI_TEXTS_AR.errors.requestSelectionRequired}</h5>`, true);
      return;
    }

    const raw = this.actionForm.getRawValue();
    const actionCode = this.normalizeActionCode(raw.actionCode);

    if (!actionCode) {
      this.msg.msgError('خطأ', `<h5>${SUMMER_UI_TEXTS_AR.errors.unsupportedAdminAction}</h5>`, true);
      return;
    }

    const actionDecision = this.resolveActionDecision(actionCode);
    if (!actionDecision.isAllowed) {
      const blockedMessage = actionDecision.errorMessage || SUMMER_UI_TEXTS_AR.errors.invalidAdminActionForCurrentState;
      this.msg.msgError('خطأ', `<h5>${blockedMessage}</h5>`, true);
      return;
    }

    if (actionCode === SUMMER_ADMIN_ACTION.APPROVE_TRANSFER && (!raw.toCategoryId || !String(raw.toWaveCode ?? '').trim())) {
      this.msg.msgError('خطأ', `<h5>${SUMMER_UI_TEXTS_AR.errors.invalidTransferData}</h5>`, true);
      return;
    }

    this.submittingAction = true;
    this.spinner.show(SUMMER_UI_TEXTS_AR.loading.adminAction);
    this.summerWorkflowController.executeAdminAction({
      messageId: this.selectedRequestId,
      actionCode,
      comment: String(raw.comment ?? '').trim(),
      force: Boolean(raw.force),
      toCategoryId: raw.toCategoryId,
      toWaveCode: String(raw.toWaveCode ?? '').trim(),
      newFamilyCount: raw.newFamilyCount,
      newExtraCount: raw.newExtraCount,
      files: this.toFileParameters(this.actionAttachments)
    }).subscribe({
      next: response => {
        if (response?.isSuccess) {
          this.msg.msgSuccess(SUMMER_UI_TEXTS_AR.success.adminActionCompleted);
          this.actionAttachments = [];
          this.actionForm.patchValue({ comment: '', force: false });
          if (this.selectedRequestId) {
            this.applyRealtimeRequestUpdate(this.createLocalRequestUpdateEvent(this.selectedRequestId, 'UPDATE'));
          }
          this.scheduleDashboardRefresh();
        } else {
          this.msg.msgError('خطأ', `<h5>${this.collectErrors(response)}</h5>`, true);
        }
      },
      error: () => {
        this.msg.msgError('خطأ', '<h5>تعذر تنفيذ الإجراء الإداري حالياً.</h5>', true);
      },
      complete: () => {
        this.submittingAction = false;
        this.spinner.hide();
      }
    });
  }

  addActionFiles(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const files = Array.from(input?.files ?? []);
    if (!files.length) {
      return;
    }

    const validFiles = files.filter(file => this.isAllowedAttachmentFile(file));
    const invalidFiles = files.filter(file => !this.isAllowedAttachmentFile(file));

    if (invalidFiles.length > 0) {
      this.msg.msgError(
        'نوع ملف غير مسموح',
        `<h5>يسمح فقط بملفات PDF والصور. الملفات المرفوضة: ${invalidFiles.map(file => file.name).join(' ، ')}</h5>`,
        true
      );
    }

    this.actionAttachments = [...this.actionAttachments, ...validFiles];
    if (input) {
      input.value = '';
    }
  }

  removeActionFile(index: number): void {
    this.actionAttachments = this.actionAttachments.filter((_, i) => i !== index);
  }

  downloadAttachment(attachmentId: number, fileName: string): void {
    if (!attachmentId || attachmentId <= 0) {
      this.msg.msgError('خطأ', `<h5>${SUMMER_UI_TEXTS_AR.errors.attachmentDownloadMissingId}</h5>`, true);
      return;
    }

    this.spinner.show(SUMMER_UI_TEXTS_AR.loading.attachmentDownload);
    this.attachmentsController.downloadDocument(attachmentId).subscribe({
      next: response => {
        const fileContent = String(response?.data ?? '').trim();
        if (response?.isSuccess && fileContent.length > 0) {
          this.attchedObjectService.createObjectURL(fileContent, fileName || `attachment-${attachmentId}`);
          return;
        }

        this.msg.msgError('خطأ', `<h5>${this.collectErrors(response) || 'تعذر تنزيل المرفق.'}</h5>`, true);
      },
      error: () => {
        this.msg.msgError('خطأ', `<h5>${SUMMER_UI_TEXTS_AR.errors.attachmentDownloadFailed}</h5>`, true);
      },
      complete: () => {
        this.spinner.hide();
      }
    });
  }

  formatDate(value?: string): string {
    if (!value) {
      return '-';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hour}:${minute}`;
  }

  formatDateOnly(value?: string): string {
    if (!value) {
      return '-';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  formatMoney(value: number | string | null | undefined): string {
    return this.formatWholeNumber(value);
  }

  formatWholeNumber(value: number | string | null | undefined): string {
    return this.integerNumberFormatter.format(this.normalizeDisplayInteger(value));
  }

  resolveWaveBookingsPrintText(value: string | null | undefined): string {
    const text = String(value ?? '').trim();
    return text.length > 0 ? text : '-';
  }

  isPaymentOverdue(request: SummerRequestSummaryDto): boolean {
    if (!request?.paymentDueAtUtc || request?.paidAtUtc) {
      return false;
    }

    const due = new Date(request.paymentDueAtUtc);
    if (Number.isNaN(due.getTime())) {
      return false;
    }

    return Date.now() > due.getTime();
  }

  getTransferStateLabel(request: SummerRequestSummaryDto): string {
    if (request?.transferUsed) {
      return 'تم استخدام التحويل';
    }

    if (this.isRejectedStatus(request?.status)) {
      return 'غير متاح (الطلب ملغي/مرفوض)';
    }

    return 'متاح التحويل';
  }

  getTransferStateClass(request: SummerRequestSummaryDto): string {
    if (request?.transferUsed || this.isRejectedStatus(request?.status)) {
      return 'warn';
    }

    return 'ok';
  }

  getStatusClass(item: SummerRequestSummaryDto): string {
    const workflowStateCode = String(item?.workflowStateCode ?? '').trim().toUpperCase();
    if (item?.needsTransferReview || workflowStateCode === 'TRANSFER_REVIEW_REQUIRED') {
      return 'status-mid';
    }

    return resolveSummerStatusClass(String(item?.statusLabel ?? item?.status ?? '').trim());
  }

  getRequestStatusLabel(item: SummerRequestSummaryDto): string {
    const statusLabel = String(item?.statusLabel ?? '').trim();
    if (statusLabel.length > 0) {
      return statusLabel;
    }

    return resolveSummerStatusLabel(String(item?.status ?? '').trim());
  }

  getDashboardStatusCount(...statusTokens: string[]): number {
    const normalizedTokens = new Set(
      statusTokens
        .map(token => this.normalizeSearchToken(token))
        .filter(token => token.length > 0)
    );

    if (!this.dashboard || normalizedTokens.size === 0) {
      return 0;
    }

    return (this.dashboard.byStatus ?? [])
      .filter(item => {
        const labelToken = this.normalizeSearchToken(item?.statusLabel);
        const codeToken = this.normalizeSearchToken(item?.statusCode);
        return normalizedTokens.has(labelToken) || normalizedTokens.has(codeToken);
      })
      .reduce((total, item) => total + (Number(item?.count ?? 0) || 0), 0);
  }

  getDestinationCount(categoryId: number): number {
    const category = Number(categoryId || 0);
    if (category <= 0) {
      return 0;
    }

    const byId = (this.dashboard?.byDestination ?? []).find(item => Number(item.id ?? 0) === category);
    if (byId) {
      return Number(byId.count ?? 0) || 0;
    }

    const destination = this.destinations.find(item => item.categoryId === category);
    if (!destination) {
      return 0;
    }

    const byName = (this.dashboard?.byDestination ?? []).find(item => String(item.key ?? '').trim() === destination.name);
    return Number(byName?.count ?? 0) || 0;
  }

  getWaveCount(waveCode: string): number {
    const key = String(waveCode ?? '').trim();
    if (!key) {
      return 0;
    }

    const item = (this.dashboard?.byWave ?? []).find(x => String(x.key ?? '').trim() === key);
    return Number(item?.count ?? 0) || 0;
  }

  isArabicText(value: string | null | undefined): boolean {
    const text = String(value ?? '').trim();
    if (!text) {
      return false;
    }

    return /[؀-ۿ]/.test(text);
  }

  trackByDestinationChip(_index: number, item: { categoryId: number }): number {
    return Number(item?.categoryId ?? 0);
  }

  trackByWaveChip(_index: number, item: { waveCode: string }): string {
    return String(item?.waveCode ?? '');
  }

  trackByDashboardBucket(_index: number, item: SummerDashboardBucketDto): string {
    const id = Number((item as any)?.id ?? 0);
    if (id > 0) {
      return `id:${id}`;
    }

    return `key:${String(item?.key ?? '')}`;
  }

  trackByPricingRecord(index: number, record: SummerPricingCatalogRecordDto): string {
    const configId = String(record?.pricingConfigId ?? '').trim();
    if (configId.length > 0) {
      return configId;
    }
    return `row:${index}`;
  }

  getDestinationLabelByCategoryId(categoryId: number): string {
    const destination = this.destinations.find(item => item.categoryId === Number(categoryId));
    if (destination) {
      return destination.name;
    }
    return Number(categoryId) > 0 ? `مصيف ${categoryId}` : 'اختر المصيف';
  }

  get pricingRecordGroups(): SummerPricingRecordGroup[] {
    const grouped = new Map<string, SummerPricingRecordGroup>();
    this.pricingRecords.forEach((record, index) => {
      const categoryId = Number(record?.categoryId ?? 0) || 0;
      const key = this.buildPricingGroupKey(categoryId);
      const destinationName = this.getDestinationLabelByCategoryId(categoryId);
      if (!grouped.has(key)) {
        grouped.set(key, {
          key,
          categoryId,
          destinationName,
          rows: [],
          activeCount: 0,
          inactiveCount: 0
        });
      }

      const group = grouped.get(key)!;
      group.rows.push({ index, record });
      if (record?.isActive !== false) {
        group.activeCount += 1;
      } else {
        group.inactiveCount += 1;
      }
    });

    return Array.from(grouped.values()).sort((a, b) => this.comparePricingGroups(a, b));
  }

  trackByPricingGroup(_index: number, group: SummerPricingRecordGroup): string {
    return group.key;
  }

  trackByPricingGroupEntry(_index: number, entry: SummerPricingGroupEntry): string {
    const configId = String(entry?.record?.pricingConfigId ?? '').trim();
    if (configId.length > 0) {
      return configId;
    }
    return `row:${entry?.index ?? _index}`;
  }

  trackByWaveBookingsPrintFooter(_index: number, marker: WaveBookingsPrintFooterMarker): number {
    return marker.pageNumber;
  }

  trackByResortBookingsWaveGroup(_index: number, group: SummerResortBookingsWaveGroupVm): string {
    return String(group.waveCode ?? '');
  }

  trackByAllResortsSummaryResort(_index: number, resort: SummerAllResortsSummaryResortVm): number {
    return Number(resort.categoryId ?? 0);
  }

  trackByAllResortsSummaryWave(_index: number, wave: SummerAllResortsSummaryWaveVm): string {
    return String(wave.waveCode ?? '');
  }

  formatReplyAttachmentNames(attachments: Array<{ id: number; name: string }>): string {
    const names = attachments
      .map(item => String(item?.name ?? '').trim())
      .filter(name => name.length > 0 && name !== '-');

    return names.length > 0 ? names.join(' - ') : '-';
  }

  isPricingGroupExpanded(groupKey: string): boolean {
    if (Object.prototype.hasOwnProperty.call(this.pricingGroupExpandedState, groupKey)) {
      return this.pricingGroupExpandedState[groupKey] === true;
    }

    return this.defaultPricingGroupsExpanded;
  }

  togglePricingGroup(groupKey: string): void {
    this.pricingGroupExpandedState[groupKey] = !this.isPricingGroupExpanded(groupKey);
  }

  expandAllPricingGroups(): void {
    this.pricingRecordGroups.forEach(group => {
      this.pricingGroupExpandedState[group.key] = true;
    });
  }

  collapseAllPricingGroups(): void {
    this.pricingRecordGroups.forEach(group => {
      this.pricingGroupExpandedState[group.key] = false;
    });
  }

  onPricingCategoryChanged(): void {
    this.syncPricingGroupExpansionState();
  }

  isPricingModeMandatory(record: SummerPricingCatalogRecordDto): boolean {
    const mode = String(record?.pricingMode ?? '').trim();
    return mode === 'TransportationMandatoryIncluded';
  }

  isAccommodationOnlyMode(record: SummerPricingCatalogRecordDto): boolean {
    const mode = String(record?.pricingMode ?? '').trim();
    return mode === 'AccommodationOnlyAllowed';
  }

  private resolveDefaultPricingGroupExpandState(): boolean {
    return false;
  }

  private buildPricingGroupKey(categoryId: number): string {
    return `cat:${Number(categoryId || 0)}`;
  }

  private comparePricingGroups(a: SummerPricingRecordGroup, b: SummerPricingRecordGroup): number {
    const aDestinationIndex = this.destinations.findIndex(item => item.categoryId === a.categoryId);
    const bDestinationIndex = this.destinations.findIndex(item => item.categoryId === b.categoryId);
    const normalizedAIndex = aDestinationIndex >= 0 ? aDestinationIndex : Number.MAX_SAFE_INTEGER;
    const normalizedBIndex = bDestinationIndex >= 0 ? bDestinationIndex : Number.MAX_SAFE_INTEGER;
    if (normalizedAIndex !== normalizedBIndex) {
      return normalizedAIndex - normalizedBIndex;
    }

    return String(a.destinationName ?? '').localeCompare(String(b.destinationName ?? ''), 'ar');
  }

  private syncPricingGroupExpansionState(): void {
    const validKeys = new Set(this.pricingRecordGroups.map(group => group.key));
    Object.keys(this.pricingGroupExpandedState).forEach(key => {
      if (!validKeys.has(key)) {
        delete this.pricingGroupExpandedState[key];
      }
    });
  }

  private resetPricingGroupExpansionState(): void {
    this.pricingGroupExpandedState = {};
  }

  private createEmptyPricingRecord(preferredCategoryId?: number): SummerPricingCatalogRecordDto {
    const normalizedPreferredCategoryId = Number(preferredCategoryId ?? 0) || 0;
    return {
      pricingConfigId: '',
      categoryId: normalizedPreferredCategoryId > 0
        ? normalizedPreferredCategoryId
        : (this.destinations.length > 0 ? this.destinations[0].categoryId : 0),
      seasonYear: this.pricingSeasonYear || this.seasonYear,
      waveCode: '',
      periodKey: '',
      dateFrom: '',
      dateTo: '',
      accommodationPricePerPerson: 0,
      transportationPricePerPerson: 0,
      insuranceAmount: 0,
      proxyInsuranceAmount: null,
      pricingMode: 'AccommodationAndTransportationOptional',
      transportationMandatory: false,
      isActive: true,
      displayLabel: '',
      notes: 'سعر استرشادي قابل للتعديل بعد اعتماد اللجنة'
    };
  }

  private toNullableNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }

  private normalizePricingRecord(record: SummerPricingCatalogRecordDto): SummerPricingCatalogRecordDto {
    const normalized: SummerPricingCatalogRecordDto = {
      pricingConfigId: String(record?.pricingConfigId ?? '').trim(),
      categoryId: Number(record?.categoryId ?? 0) || 0,
      seasonYear: Number(record?.seasonYear ?? this.pricingSeasonYear ?? this.seasonYear) || this.seasonYear,
      waveCode: String(record?.waveCode ?? '').trim(),
      periodKey: String(record?.periodKey ?? '').trim(),
      dateFrom: String(record?.dateFrom ?? '').trim(),
      dateTo: String(record?.dateTo ?? '').trim(),
      accommodationPricePerPerson: Number(record?.accommodationPricePerPerson ?? 0) || 0,
      transportationPricePerPerson: Number(record?.transportationPricePerPerson ?? 0) || 0,
      insuranceAmount: Number(record?.insuranceAmount ?? 0) || 0,
      proxyInsuranceAmount: this.toNullableNumber(record?.proxyInsuranceAmount),
      pricingMode: String(record?.pricingMode ?? 'AccommodationAndTransportationOptional').trim() || 'AccommodationAndTransportationOptional',
      transportationMandatory: Boolean(record?.transportationMandatory),
      isActive: record?.isActive !== false,
      displayLabel: String(record?.displayLabel ?? '').trim(),
      notes: String(record?.notes ?? '').trim()
    };

    this.syncPricingPeriodKeyWithDateRange(normalized);
    this.onPricingModeChanged(normalized);
    return normalized;
  }

  private syncPricingPeriodKeyWithDateRange(record: SummerPricingCatalogRecordDto): void {
    const normalizedWaveCode = String(record?.waveCode ?? '').trim();
    if (normalizedWaveCode.length > 0) {
      return;
    }

    const derivedPeriodKey = this.derivePricingPeriodKeyFromDateRange(record?.dateFrom, record?.dateTo);
    if (derivedPeriodKey.length > 0) {
      record.periodKey = derivedPeriodKey;
    }
  }

  private derivePricingPeriodKeyFromDateRange(
    rawDateFrom: string | null | undefined,
    rawDateTo: string | null | undefined
  ): string {
    const fromMonth = this.parsePricingMonth(rawDateFrom);
    const toMonth = this.parsePricingMonth(rawDateTo);

    if (fromMonth === null && toMonth === null) {
      return '';
    }

    if (fromMonth !== null && toMonth !== null) {
      const months: number[] = [];
      let cursor = fromMonth;
      let guard = 0;
      while (cursor <= toMonth && guard < 24) {
        months.push(cursor);
        cursor += 1;
        guard += 1;
      }

      if (months.length === 0) {
        return '';
      }

      const normalizedMonths = months.map(value => ((value - 1) % 12) + 1);
      if (normalizedMonths.every(month => month === 6 || month === 9)) {
        return 'JUN_SEP';
      }

      if (normalizedMonths.every(month => month === 7 || month === 8)) {
        return 'JUL_AUG';
      }

      const uniqueMonths = Array.from(new Set(normalizedMonths));
      if (uniqueMonths.length === 1) {
        return `M${String(uniqueMonths[0]).padStart(2, '0')}`;
      }

      return '';
    }

    const singleMonth = fromMonth ?? toMonth;
    if (singleMonth === null) {
      return '';
    }

    const normalizedMonth = ((singleMonth - 1) % 12) + 1;
    if (normalizedMonth === 6 || normalizedMonth === 9) {
      return 'JUN_SEP';
    }

    if (normalizedMonth === 7 || normalizedMonth === 8) {
      return 'JUL_AUG';
    }

    return `M${String(normalizedMonth).padStart(2, '0')}`;
  }

  private parsePricingMonth(value: string | null | undefined): number | null {
    const text = String(value ?? '').trim();
    if (!text) {
      return null;
    }

    const isoMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);
    if (isoMatch) {
      const year = Number(isoMatch[1]);
      const month = Number(isoMatch[2]);
      if (Number.isFinite(year) && Number.isFinite(month) && month >= 1 && month <= 12) {
        return (year * 12) + month;
      }
    }

    const slashMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
    if (slashMatch) {
      const day = Number(slashMatch[1]);
      const month = Number(slashMatch[2]);
      const year = Number(slashMatch[3]);
      if (Number.isFinite(day) && Number.isFinite(month) && Number.isFinite(year) && month >= 1 && month <= 12) {
        return (year * 12) + month;
      }
    }

    return null;
  }

  private normalizePricingRecordForSave(record: SummerPricingCatalogRecordDto, index: number): SummerPricingCatalogRecordDto {
    const normalized = this.normalizePricingRecord(record);
    if (!normalized.pricingConfigId) {
      const periodOrWave = normalized.periodKey || normalized.waveCode || `ROW${index + 1}`;
      normalized.pricingConfigId = `SUM${normalized.seasonYear}-CAT${normalized.categoryId}-${periodOrWave}`;
    }
    return normalized;
  }

  private buildDuplicatedPricingConfigId(sourceRecord: SummerPricingCatalogRecordDto): string {
    const periodOrWave = sourceRecord.periodKey || sourceRecord.waveCode || `ROW${this.pricingRecords.length + 1}`;
    const fallbackBase = `SUM${sourceRecord.seasonYear}-CAT${sourceRecord.categoryId}-${periodOrWave}`;
    const rawBase = String(sourceRecord.pricingConfigId ?? '').trim() || fallbackBase;
    const base = rawBase
      .replace(/[^A-Za-z0-9_-]/g, '')
      .toUpperCase() || fallbackBase;

    const existing = new Set(
      this.pricingRecords
        .map(item => String(item?.pricingConfigId ?? '').trim().toUpperCase())
        .filter(item => item.length > 0)
    );

    const stamp = Date.now().toString(36).toUpperCase();
    let candidate = `${base}-COPY-${stamp}`;
    let counter = 1;
    while (existing.has(candidate.toUpperCase())) {
      counter += 1;
      candidate = `${base}-COPY-${stamp}-${counter}`;
    }

    return candidate;
  }

  private bindActionRules(): void {
    const actionCodeSub = this.actionForm.get('actionCode')?.valueChanges.subscribe(value => {
      const normalized = this.normalizeActionCode(value);
      const toCategoryControl = this.actionForm.get('toCategoryId');
      const toWaveControl = this.actionForm.get('toWaveCode');
      const familyControl = this.actionForm.get('newFamilyCount');
      const extraControl = this.actionForm.get('newExtraCount');

      if (!toCategoryControl || !toWaveControl || !familyControl || !extraControl) {
        return;
      }

      const currentValue = String(value ?? '').trim();
      if (normalized && currentValue !== normalized) {
        this.actionForm.patchValue({ actionCode: normalized }, { emitEvent: false });
      }

      if (normalized === SUMMER_ADMIN_ACTION.APPROVE_TRANSFER) {
        toCategoryControl.setValidators([Validators.required]);
        toWaveControl.setValidators([Validators.required]);
        familyControl.setValidators([Validators.required, Validators.min(1)]);
        extraControl.setValidators([Validators.min(0)]);
      } else {
        toCategoryControl.clearValidators();
        toWaveControl.clearValidators();
        familyControl.clearValidators();
        extraControl.clearValidators();
        this.actionForm.patchValue({
          toCategoryId: null,
          toWaveCode: '',
          newFamilyCount: null,
          newExtraCount: 0
        }, { emitEvent: false });
      }

      toCategoryControl.updateValueAndValidity({ emitEvent: false });
      toWaveControl.updateValueAndValidity({ emitEvent: false });
      familyControl.updateValueAndValidity({ emitEvent: false });
      extraControl.updateValueAndValidity({ emitEvent: false });
    });

    if (actionCodeSub) {
      this.subscriptions.add(actionCodeSub);
    }

    const transferDestinationSub = this.actionForm.get('toCategoryId')?.valueChanges.subscribe(value => {
      const destination = this.destinations.find(item => item.categoryId === Number(value));
      if (!destination) {
        this.actionForm.patchValue({ toWaveCode: '', newFamilyCount: null }, { emitEvent: false });
        return;
      }

      const selectedWave = String(this.actionForm.get('toWaveCode')?.value ?? '').trim();
      if (!destination.waves.some(wave => wave.code === selectedWave)) {
        this.actionForm.patchValue({ toWaveCode: '' }, { emitEvent: false });
      }

      const selectedFamily = Number(this.actionForm.get('newFamilyCount')?.value ?? 0);
      if (!destination.familyOptions.includes(selectedFamily)) {
        this.actionForm.patchValue({ newFamilyCount: null }, { emitEvent: false });
      }
    });

    if (transferDestinationSub) {
      this.subscriptions.add(transferDestinationSub);
    }
  }

  /**
   * Mirrors backend NormalizeActionCode:
   * FINAL_APPROVE | MANUAL_CANCEL | COMMENT | APPROVE_TRANSFER
   */
  private normalizeActionCode(actionCode: unknown): SummerAdminActionCode | '' {
    const normalized = normalizeSummerAdminActionCode(actionCode);
    if (normalized) {
      return normalized;
    }

    const direct = String(actionCode ?? '').trim() as SummerAdminActionCode;
    if (this.allowedAdminActionCodes.has(direct)) {
      return direct;
    }

    return '';
  }

  private resolveActionDecision(actionCode: SummerAdminActionCode) {
    const currentRequest = this.selectedRequest;
    if (!currentRequest) {
      return {
        isAllowed: true,
        errorMessage: ''
      };
    }

    const currentState = String(currentRequest.statusLabel ?? currentRequest.status ?? '').trim();
    const decision = resolveAdminActionDecisionForCurrentStatus(actionCode, currentState);
    return decision;
  }

  private normalizeSearchToken(value: unknown): string {
    return String(value ?? '')
      .trim()
      .toLowerCase()
      .replace(/[أإآ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/[\s\-]+/g, '')
      .replace(/[^a-z0-9_؀-ۿ]/g, '');
  }

  private bindFilterDependencies(): void {
    const categorySub = this.filtersForm.get('categoryId')?.valueChanges.subscribe(value => {
      const selectedCategoryId = Number(value ?? 0) || 0;
      const allowedCodes = new Set(
        this.filterWaveOptions.map(wave => String(wave.code ?? '').trim()).filter(code => code.length > 0)
      );

      const currentWaveCode = String(this.filtersForm.get('waveCode')?.value ?? '').trim();
      if (currentWaveCode.length > 0 && !allowedCodes.has(currentWaveCode)) {
        this.filtersForm.patchValue({ waveCode: '' }, { emitEvent: false });
      }

      if (this.capacityDialogVisible) {
        if (selectedCategoryId > 0 && currentWaveCode.length > 0 && allowedCodes.has(currentWaveCode)) {
          this.capacityScopeCategoryId = selectedCategoryId;
          this.capacityScopeWaveCode = currentWaveCode;
          this.refreshWaveCapacity(true);
        } else {
          this.capacityDialogVisible = false;
        }
      }

      if (this.bookingsPrintDialogVisible) {
        if (selectedCategoryId > 0 && currentWaveCode.length > 0 && allowedCodes.has(currentWaveCode)) {
          this.refreshWaveBookingsPrintReport(true);
        } else {
          this.bookingsPrintDialogVisible = false;
        }
      }

      if (this.resortBookingsPrintDialogVisible) {
        if (selectedCategoryId > 0) {
          this.refreshResortBookingsPrintReport(true);
        } else {
          this.resortBookingsPrintDialogVisible = false;
        }
      }
    });

    if (categorySub) {
      this.subscriptions.add(categorySub);
    }

    const waveSub = this.filtersForm.get('waveCode')?.valueChanges.subscribe(value => {
      const selectedWaveCode = String(value ?? '').trim();
      if (this.capacityDialogVisible) {
        if (this.selectedFilterCategoryId > 0 && selectedWaveCode.length > 0) {
          this.capacityScopeCategoryId = this.selectedFilterCategoryId;
          this.capacityScopeWaveCode = selectedWaveCode;
          this.refreshWaveCapacity(true);
        } else {
          this.capacityDialogVisible = false;
        }
      }

      if (this.bookingsPrintDialogVisible) {
        if (this.selectedFilterCategoryId > 0 && selectedWaveCode.length > 0) {
          this.refreshWaveBookingsPrintReport(true);
        } else {
          this.bookingsPrintDialogVisible = false;
        }
      }

      if (this.resortBookingsPrintDialogVisible && this.selectedFilterCategoryId > 0) {
        this.refreshResortBookingsPrintReport(true);
      }
    });

    if (waveSub) {
      this.subscriptions.add(waveSub);
    }

    const financialViewSub = this.filtersForm.get('includeFinancialsInPrint')?.valueChanges.subscribe(() => {
      if (this.bookingsPrintDialogVisible && this.canOpenWaveCapacityDialog) {
        this.refreshWaveBookingsPrintReport(true);
      }

      if (this.resortBookingsPrintDialogVisible && this.canOpenResortBookingsPrintDialog) {
        this.refreshResortBookingsPrintReport(true);
      }

      if (this.allResortsSummaryDialogVisible) {
        this.refreshAllResortsSummaryPrintReport(true);
      }
    });

    if (financialViewSub) {
      this.subscriptions.add(financialViewSub);
    }
  }

  private bindSignalRefresh(): void {
    const requestSub = this.summerRealtimeService.requestUpdates$.subscribe(update => {
      this.applyRealtimeRequestUpdate(update);
      this.scheduleDashboardRefresh();
    });

    const capacitySub = this.summerRealtimeService.capacityUpdates$.subscribe(update => {
      this.refreshWaveCapacityFromSignal(update);
    });

    this.subscriptions.add(requestSub);
    this.subscriptions.add(capacitySub);
  }

  private refreshWaveCapacityFromSignal(update: SummerCapacityRealtimeEvent): void {
    if (!this.capacityDialogVisible || !this.capacityScopeCategoryId || !this.capacityScopeWaveCode) {
      return;
    }

    const categoryId = Number(update?.categoryId ?? 0);
    const waveCode = String(update?.waveCode ?? '').trim();
    if (!Number.isFinite(categoryId) || categoryId <= 0 || waveCode.length === 0) {
      return;
    }

    if (categoryId === this.capacityScopeCategoryId && waveCode === this.capacityScopeWaveCode) {
      this.refreshWaveCapacity(true);
    }
  }

  private applyRealtimeRequestUpdate(update: SummerRequestRealtimeEvent): void {
    const targetMessageId = Number(update?.messageId ?? 0);
    if (!Number.isFinite(targetMessageId) || targetMessageId <= 0) {
      return;
    }

    const raw = this.filtersForm.getRawValue();
    this.adminRealtimePatchService.applyRequestUpdate(this.seasonYear, update, {
      requests: this.requests,
      totalCount: this.requestsTotalCount,
      pageNumber: this.requestsPageNumber,
      pageSize: this.requestsPageSize,
      selectedRequestId: this.selectedRequestId
    }, {
      categoryId: raw.categoryId,
      waveCode: String(raw.waveCode ?? '').trim(),
      status: String(raw.status ?? '').trim(),
      paymentState: String(raw.paymentState ?? '').trim(),
      employeeId: String(raw.employeeId ?? '').trim(),
      search: String(raw.search ?? '').trim()
    }).subscribe({
      next: patched => {
        this.requests = patched.requests;
        this.requestsTotalCount = patched.totalCount;
        this.requestsTotalPages = Math.max(1, Math.ceil(this.requestsTotalCount / Math.max(1, this.requestsPageSize)));
        if (this.requestsPageNumber > this.requestsTotalPages) {
          this.requestsPageNumber = this.requestsTotalPages;
          this.filtersForm.patchValue({ pageNumber: this.requestsPageNumber }, { emitEvent: false });
        }
        this.selectedRequestId = patched.selectedRequestId;

        if (patched.selectedWasRemoved) {
          this.selectedRequestDetails = null;
        }

        if (patched.selectedWasUpdated && this.selectedRequestId) {
          this.loadSelectedRequestDetails(this.selectedRequestId);
        }
      }
    });
  }

  private createLocalRequestUpdateEvent(messageId: number, action = 'UPDATE'): SummerRequestRealtimeEvent {
    const safeMessageId = Number(messageId ?? 0);
    const normalizedAction = String(action ?? '').trim().toUpperCase() || 'UPDATE';
    return {
      kind: 'request',
      messageId: Number.isFinite(safeMessageId) && safeMessageId > 0 ? Math.floor(safeMessageId) : 0,
      action: normalizedAction,
      raw: `LOCAL_SUMMER_REQUEST_UPDATED|${safeMessageId}|${normalizedAction}|${Date.now()}`,
      signature: `local-request|${safeMessageId}|${normalizedAction}`,
      emittedAtEpochMs: Date.now()
    };
  }

  private scheduleDashboardRefresh(): void {
    if (this.dashboardRefreshTimer) {
      clearTimeout(this.dashboardRefreshTimer);
    }

    this.dashboardRefreshTimer = setTimeout(() => {
      this.dashboardRefreshTimer = null;
      this.loadDashboard();
    }, 250);
  }

  private patchActionDefaultsForSelectedRequest(): void {
    const request = this.selectedRequest;
    if (!request) {
      return;
    }

    this.actionForm.patchValue({
      actionCode: SUMMER_ADMIN_ACTION.COMMENT,
      comment: '',
      force: false,
      toCategoryId: request.categoryId,
      toWaveCode: request.waveCode,
      newFamilyCount: null,
      newExtraCount: 0
    }, { emitEvent: false });
  }

  private enableWaveBookingsPrintMode(): void {
    this.disableWaveBookingsPrintMode();
    document.body.classList.add('wave-bookings-print-mode');
    this.isWaveBookingsPrintModeEnabled = true;
    window.addEventListener('afterprint', this.onWaveBookingsAfterPrint);

    if (typeof window.matchMedia !== 'function') {
      return;
    }

    const mediaQueryList = window.matchMedia('print');
    this.waveBookingsPrintMediaQueryList = mediaQueryList;
    if (typeof mediaQueryList.addEventListener === 'function') {
      mediaQueryList.addEventListener('change', this.onWaveBookingsPrintMediaChange);
      return;
    }

    if (typeof mediaQueryList.addListener === 'function') {
      mediaQueryList.addListener(this.onWaveBookingsPrintMediaChange);
    }
  }

  private disableWaveBookingsPrintMode(): void {
    if (!this.isWaveBookingsPrintModeEnabled && !document.body.classList.contains('wave-bookings-print-mode')) {
      return;
    }

    document.body.classList.remove('wave-bookings-print-mode');
    this.isWaveBookingsPrintModeEnabled = false;
    window.removeEventListener('afterprint', this.onWaveBookingsAfterPrint);

    if (!this.waveBookingsPrintMediaQueryList) {
      return;
    }

    const mediaQueryList = this.waveBookingsPrintMediaQueryList;
    if (typeof mediaQueryList.removeEventListener === 'function') {
      mediaQueryList.removeEventListener('change', this.onWaveBookingsPrintMediaChange);
    } else if (typeof mediaQueryList.removeListener === 'function') {
      mediaQueryList.removeListener(this.onWaveBookingsPrintMediaChange);
    }

    this.waveBookingsPrintMediaQueryList = null;
  }

  private scheduleWaveBookingsPrintPaginationRefresh(): void {
    setTimeout(() => {
      this.prepareWaveBookingsPrintPagination();
    }, 0);
  }

  private prepareWaveBookingsPrintPagination(): void {
    if (!this.bookingsPrintDialogVisible || this.loadingWaveBookingsPrint || !this.waveBookingsPrintData) {
      this.waveBookingsPrintFooterMarkers = [];
      this.waveBookingsPrintTotalPages = 0;
      return;
    }

    const result = this.buildPrintFooterPagination(this.waveBookingsPrintDocumentRef);
    this.waveBookingsPrintFooterMarkers = result.markers;
    this.waveBookingsPrintTotalPages = result.totalPages;
  }

  private scheduleResortBookingsPrintPaginationRefresh(): void {
    setTimeout(() => {
      this.prepareResortBookingsPrintPagination();
    }, 0);
  }

  private prepareResortBookingsPrintPagination(): void {
    if (!this.resortBookingsPrintDialogVisible || this.loadingResortBookingsPrint || !this.resortBookingsPrintData) {
      this.resortBookingsPrintFooterMarkers = [];
      this.resortBookingsPrintTotalPages = 0;
      return;
    }

    const result = this.buildPrintFooterPagination(this.resortBookingsPrintDocumentRef);
    this.resortBookingsPrintFooterMarkers = result.markers;
    this.resortBookingsPrintTotalPages = result.totalPages;
  }

  private scheduleAllResortsSummaryPrintPaginationRefresh(): void {
    setTimeout(() => {
      this.prepareAllResortsSummaryPrintPagination();
    }, 0);
  }

  private prepareAllResortsSummaryPrintPagination(): void {
    if (!this.allResortsSummaryDialogVisible || this.loadingAllResortsSummaryPrint || !this.allResortsSummaryData) {
      this.allResortsSummaryPrintFooterMarkers = [];
      this.allResortsSummaryPrintTotalPages = 0;
      return;
    }

    const result = this.buildPrintFooterPagination(this.allResortsSummaryPrintDocumentRef);
    this.allResortsSummaryPrintFooterMarkers = result.markers;
    this.allResortsSummaryPrintTotalPages = result.totalPages;
  }

  private scheduleRequestAdminPrintPaginationRefresh(): void {
    setTimeout(() => {
      this.prepareRequestAdminPrintPagination();
    }, 0);
  }

  private prepareRequestAdminPrintPagination(): void {
    if (!this.requestAdminPrintDialogVisible || !this.selectedRequest) {
      this.requestAdminPrintFooterMarkers = [];
      this.requestAdminPrintTotalPages = 0;
      return;
    }

    const result = this.buildPrintFooterPagination(this.requestAdminPrintDocumentRef);
    this.requestAdminPrintFooterMarkers = result.markers;
    this.requestAdminPrintTotalPages = result.totalPages;
  }

  private buildPrintFooterPagination(
    documentRef?: ElementRef<HTMLElement>
  ): { markers: WaveBookingsPrintFooterMarker[]; totalPages: number } {
    const documentElement = documentRef?.nativeElement;
    if (!documentElement) {
      return { markers: [], totalPages: 0 };
    }

    const totalContentHeight = Math.max(documentElement.scrollHeight, documentElement.offsetHeight);
    const pageContentHeight = Math.max(1, this.waveBookingsPrintPageContentHeightPx);
    const totalPages = Math.max(1, Math.ceil(totalContentHeight / pageContentHeight));
    const markers = Array.from({ length: totalPages }, (_item, index) => {
      const pageNumber = index + 1;
      const topPx = Math.max(
        this.waveBookingsPrintFooterInsetPx,
        Math.round((pageNumber * pageContentHeight) - this.waveBookingsPrintFooterInsetPx)
      );

      return {
        pageNumber,
        topPx
      };
    });

    return {
      markers,
      totalPages
    };
  }

  private normalizeDisplayInteger(value: number | string | null | undefined): number {
    const numericValue = Number(value ?? 0);
    if (!Number.isFinite(numericValue)) {
      return 0;
    }

    return Math.round(numericValue);
  }

  private refreshSummerPricingAccess(): void {
    try {
      this.canManageSummerPricing = this.authObjectsService.checkAuthFun('SummerPricingFunc');
    } catch {
      this.canManageSummerPricing = false;
    }

    if (!this.canManageSummerPricing) {
      this.resetPricingStateForUnauthorizedUser();
    }
  }

  private resetPricingStateForUnauthorizedUser(): void {
    this.pricingCatalogLoading = false;
    this.pricingCatalogSaving = false;
    this.pricingCatalogError = '';
    this.pricingSeasonYear = this.seasonYear;
    this.pricingRecords = [];
    this.resetPricingGroupExpansionState();
  }

  private loadSelectedRequestDetails(messageId: number): void {
    this.loadingDetails = true;
    this.dynamicFormController.getRequestById(messageId).subscribe({
      next: response => {
        this.selectedRequestDetails = response?.isSuccess ? response.data : null;
      },
      error: () => {
        this.selectedRequestDetails = null;
      },
      complete: () => {
        this.loadingDetails = false;
        if (this.requestAdminPrintDialogVisible && this.selectedRequest) {
          this.scheduleRequestAdminPrintPaginationRefresh();
        }
      }
    });
  }

  private hasAnyWaveBookingsPrintText(
    selector: (row: SummerWaveBookingsPrintRowDto) => string | null | undefined
  ): boolean {
    return this.waveBookingsPrintSections.some(section =>
      section.rows.some(row => {
        const text = String(selector(row) ?? '').trim();
        return text.length > 0 && text !== '-';
      })
    );
  }

  private hasAnyWaveBookingsPrintNumeric(
    selector: (row: SummerWaveBookingsPrintRowDto) => number | null | undefined
  ): boolean {
    return this.waveBookingsPrintSections.some(section =>
      section.rows.some(row => {
        const value = Number(selector(row) ?? 0);
        return Number.isFinite(value) && value > 0;
      })
    );
  }

  private hasAnyResortBookingsPrintText(
    selector: (row: SummerWaveBookingsPrintRowDto) => string | null | undefined
  ): boolean {
    return this.resortBookingsPrintSectionsFlat.some(section =>
      section.rows.some(row => {
        const text = String(selector(row) ?? '').trim();
        return text.length > 0 && text !== '-';
      })
    );
  }

  private hasAnyResortBookingsPrintNumeric(
    selector: (row: SummerWaveBookingsPrintRowDto) => number | null | undefined
  ): boolean {
    return this.resortBookingsPrintSectionsFlat.some(section =>
      section.rows.some(row => {
        const value = Number(selector(row) ?? 0);
        return Number.isFinite(value) && value > 0;
      })
    );
  }

  private collectErrors(response: { errors?: Array<{ message?: string }> } | null | undefined): string {
    const errors = (response?.errors ?? [])
      .map(item => String(item?.message ?? '').trim())
      .filter(item => item.length > 0);

    return errors.length ? errors.join('<br/>') : SUMMER_UI_TEXTS_AR.errors.generic;
  }

  private toFileParameters(files: File[]): FileParameter[] {
    return files.map(file => ({
      data: file,
      fileName: file.name,
      originalSize: file.size
    }));
  }

  private isAllowedAttachmentFile(file: File): boolean {
    const name = String(file?.name ?? '').toLowerCase();
    const dot = name.lastIndexOf('.');
    if (dot < 0) {
      return false;
    }
    return this.allowedAttachmentExtensions.has(name.substring(dot));
  }

  private resolveAttachmentId(item: { id?: unknown; attchId?: unknown } | undefined): number {
    const id = Number(item?.id);
    if (Number.isFinite(id) && id > 0) {
      return id;
    }

    const attchId = Number(item?.attchId);
    if (Number.isFinite(attchId) && attchId > 0) {
      return attchId;
    }

    return 0;
  }

  private toEpoch(value?: string): number {
    if (!value) {
      return 0;
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  }

  private parseReplyAdminFlag(value: unknown): boolean {
    if (typeof value === 'boolean') {
      return value;
    }

    const normalized = String(value ?? '').trim().toLowerCase();
    return normalized === 'true' || normalized === '1';
  }

  private looksLikeIsoDate(value: string): boolean {
    const text = String(value ?? '').trim();
    if (text.length < 10 || !text.includes('T')) {
      return false;
    }

    const parsed = Date.parse(text);
    return Number.isFinite(parsed);
  }

  private getWaveOrder(code: string): number {
    const normalized = String(code ?? '').trim().toUpperCase();
    const numeric = Number(normalized.replace(/[^0-9]/g, ''));
    return Number.isFinite(numeric) && numeric > 0 ? numeric : Number.MAX_SAFE_INTEGER;
  }

  private getWaveLabelByCategoryAndCode(categoryId: number, waveCode: string): string {
    const destination = this.destinations.find(item => item.categoryId === categoryId);
    const wave = destination?.waves.find(item => item.code === String(waveCode ?? '').trim());
    return String(wave?.startsAtLabel ?? '').trim();
  }

  private getDestinationNameByCategoryId(categoryId: number): string {
    const destination = this.destinations.find(item => item.categoryId === categoryId);
    return String(destination?.name ?? '').trim();
  }

  private isRejectedStatus(status: string | undefined): boolean {
    return String(status ?? '').trim().toLowerCase().includes('rejected');
  }

  private syncQuickFiltersFromForm(): void {
    const raw = this.filtersForm.getRawValue();
    this.activeDashboardStatus = String(raw.status ?? '').trim();
    this.activeDashboardPaymentState = String(raw.paymentState ?? '').trim();
  }
}
