import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { DynamicFormController } from 'src/app/shared/services/BackendServices/DynamicForm/DynamicForm.service';
import { MessageDto } from 'src/app/shared/services/BackendServices/DynamicForm/DynamicForm.dto';
import { AttachmentsController } from 'src/app/shared/services/BackendServices/Attachments/Attachments.service';
import { FileParameter } from 'src/app/shared/services/BackendServices/dto-shared';
import {
  SummerAdminDashboardDto,
  SummerDashboardBucketDto,
  SummerRequestsPageChange,
  SummerRequestsPageData,
  SummerRequestSummaryDto,
  SummerWaveCapacityDto
} from 'src/app/shared/services/BackendServices/SummerWorkflow/SummerWorkflow.dto';
import { SummerWorkflowController } from 'src/app/shared/services/BackendServices/SummerWorkflow/SummerWorkflow.service';
import { AttchedObjectService } from 'src/app/shared/services/helper/attched-object.service';
import { DynamicMetadataService } from 'src/app/shared/services/helper/dynamic-metadata.service';
import { MsgsService } from 'src/app/shared/services/helper/msgs.service';
import { SpinnerService } from 'src/app/shared/services/helper/spinner.service';
import { SignalRService } from 'src/app/shared/services/SignalRServices/SignalR.service';
import {
  parseSummerDestinationCatalog,
  SUMMER_SEASON_YEAR,
  SummerDestinationConfig,
  SummerWaveDefinition
} from '../summer-requests-workspace/summer-requests-workspace.config';
import {
  buildSummerRequestCompanions,
  buildSummerRequestDetailFields,
  SummerRequestFieldGridRow
} from '../summer-requests-workspace/summer-requests-workspace.utils';

type SummerAdminActionCode = 'FINAL_APPROVE' | 'MANUAL_CANCEL' | 'COMMENT' | 'APPROVE_TRANSFER';

@Component({
  selector: 'app-summer-requests-admin-console',
  templateUrl: './summer-requests-admin-console.component.html',
  styleUrls: ['./summer-requests-admin-console.component.scss']
})
export class SummerRequestsAdminConsoleComponent implements OnInit, OnDestroy {
  readonly seasonYear = SUMMER_SEASON_YEAR;
  readonly dynamicSummerApplicationId = 'SUM2026DYN';
  destinations: SummerDestinationConfig[] = [];
  loadingDestinations = false;
  destinationsError = '';

  readonly statusOptions = [
    { value: '', label: 'الكل' },
    { value: 'New', label: 'جديد' },
    { value: 'InProgress', label: 'جاري التنفيذ' },
    { value: 'Replied', label: 'تم الرد/اعتماد' },
    { value: 'Rejected', label: 'مرفوض/ملغي' }
  ];

  readonly paymentStateOptions = [
    { value: '', label: 'الكل' },
    { value: 'Paid', label: 'مسدد' },
    { value: 'Unpaid', label: 'غير مسدد' },
    { value: 'OverdueUnpaid', label: 'متأخر وغير مسدد' }
  ];

  readonly actionOptions: Array<{ value: SummerAdminActionCode; label: string }> = [
    { value: 'COMMENT', label: 'تعليق / رد إداري' },
    { value: 'FINAL_APPROVE', label: 'اعتماد نهائي' },
    { value: 'MANUAL_CANCEL', label: 'إلغاء يدوي' },
    // { value: 'APPROVE_TRANSFER', label: 'اعتماد تحويل' }
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
    'FINAL_APPROVE',
    'MANUAL_CANCEL',
    'COMMENT',
    'APPROVE_TRANSFER'
  ]);

  capacityDialogVisible = false;
  loadingWaveCapacity = false;
  capacityLastUpdatedAt: string | null = null;
  capacityErrorText = '';
  capacityRows: SummerWaveCapacityDto[] = [];
  capacityScopeCategoryId: number | null = null;
  capacityScopeWaveCode = '';

  actionAttachments: File[] = [];
  private readonly allowedAttachmentExtensions = new Set(['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp']);
  private readonly subscriptions = new Subscription();
  private requestsLoadVersion = 0;

  constructor(
    private readonly fb: FormBuilder,
    private readonly summerWorkflowController: SummerWorkflowController,
    private readonly dynamicFormController: DynamicFormController,
    private readonly dynamicMetadataService: DynamicMetadataService,
    private readonly attachmentsController: AttachmentsController,
    private readonly attchedObjectService: AttchedObjectService,
    private readonly msg: MsgsService,
    private readonly spinner: SpinnerService,
    private readonly signalRService: SignalRService
  ) {
    this.filtersForm = this.fb.group({
      categoryId: [null],
      waveCode: [''],
      status: [''],
      paymentState: [''],
      employeeId: [''],
      search: [''],
      pageNumber: [1],
      pageSize: [5]
    });

    this.actionForm = this.fb.group({
      actionCode: ['COMMENT', Validators.required],
      comment: ['', Validators.maxLength(2000)],
      force: [false],
      toCategoryId: [null],
      toWaveCode: [''],
      newFamilyCount: [null],
      newExtraCount: [0]
    });
  }

  ngOnInit(): void {
    this.bindActionRules();
    this.bindFilterDependencies();
    this.bindSignalRefresh();
    this.loadDestinationCatalog();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  loadDestinationCatalog(): void {
    this.loadingDestinations = true;
    this.destinationsError = '';
    this.dynamicMetadataService.getMendJson<unknown>(this.dynamicSummerApplicationId, 'SUM2026_DestinationCatalog').subscribe({
      next: response => {
        if (response?.isSuccess) {
          this.destinations = parseSummerDestinationCatalog(response.data, this.seasonYear);
          if (this.destinations.length > 0) {
            this.loadDashboard();
            this.loadRequests();
            return;
          }
        }

        this.destinations = [];
        const errors = Array.isArray(response?.errors) ? response.errors : [];
        this.destinationsError = errors.length > 0
          ? errors.join('<br/>')
          : 'تعذر تحميل إعدادات المصايف من CDMendTbl.';
        this.loadDashboard();
        this.loadRequests();
      },
      error: () => {
        this.destinations = [];
        this.destinationsError = 'تعذر تحميل إعدادات المصايف من الخدمة العامة.';
        this.loadDashboard();
        this.loadRequests();
      },
      complete: () => {
        this.loadingDestinations = false;
      }
    });
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
    return normalized === 'APPROVE_TRANSFER';
  }

  get selectedRequestReplies(): Array<{ id: number; author: string; message: string; created?: string; attachments: Array<{ id: number; name: string }> }> {
    const replies = this.selectedRequestDetails?.replies ?? [];
    return replies
      .map(reply => ({
        id: Number(reply.replyId ?? 0) || 0,
        author: String(reply.authorName ?? reply.authorId ?? 'غير محدد').trim() || 'غير محدد',
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
      this.msg.msgError('خطأ', '<h5>يرجى اختيار المصيف والفوج أولاً.</h5>', true);
      return;
    }

    this.capacityScopeCategoryId = this.selectedFilterCategoryId;
    this.capacityScopeWaveCode = this.selectedFilterWaveCode;
    this.capacityDialogVisible = true;
    this.refreshWaveCapacity();
  }

  onCapacityDialogHide(): void {
    this.capacityDialogVisible = false;
  }

  refreshWaveCapacity(silent = false): void {
    if (!this.capacityScopeCategoryId || !this.capacityScopeWaveCode) {
      return;
    }

    this.loadingWaveCapacity = true;
    this.capacityErrorText = '';
    this.summerWorkflowController.getWaveCapacity(this.capacityScopeCategoryId, this.capacityScopeWaveCode).subscribe({
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
      this.msg.msgError('خطأ', '<h5>يرجى استكمال بيانات الإجراء الإداري.</h5>', true);
      return;
    }

    if (!this.selectedRequestId) {
      this.msg.msgError('خطأ', '<h5>يرجى اختيار طلب أولاً.</h5>', true);
      return;
    }

    const raw = this.actionForm.getRawValue();
    const actionCode = this.normalizeActionCode(raw.actionCode);

    if (!actionCode) {
      this.msg.msgError('خطأ', '<h5>نوع الإجراء الإداري غير مدعوم.</h5>', true);
      return;
    }

    if (actionCode === 'APPROVE_TRANSFER' && (!raw.toCategoryId || !String(raw.toWaveCode ?? '').trim())) {
      this.msg.msgError('خطأ', '<h5>بيانات التحويل غير مكتملة.</h5>', true);
      return;
    }

    this.submittingAction = true;
    this.spinner.show('جاري تنفيذ الإجراء الإداري ...');
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
          this.msg.msgSuccess('تم تنفيذ الإجراء الإداري بنجاح');
          this.actionAttachments = [];
          this.actionForm.patchValue({ comment: '', force: false });
          this.loadRequests();
          this.loadDashboard();
          if (this.selectedRequestId) {
            this.loadSelectedRequestDetails(this.selectedRequestId);
          }
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
      this.msg.msgError('خطأ', '<h5>لا يمكن تنزيل هذا المرفق لعدم توفر معرف صالح.</h5>', true);
      return;
    }

    this.spinner.show('جاري تنزيل المرفق ...');
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
        this.msg.msgError('خطأ', '<h5>تعذر تنزيل المرفق حالياً.</h5>', true);
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
    const status = String(item.status ?? '').toLowerCase();
    if (status.includes('rejected')) {
      return 'status-bad';
    }
    if (status.includes('replied')) {
      return 'status-good';
    }
    if (status.includes('inprogress')) {
      return 'status-mid';
    }
    return 'status-neutral';
  }

  getRequestStatusLabel(item: SummerRequestSummaryDto): string {
    const statusLabel = String(item?.statusLabel ?? '').trim();
    if (statusLabel.length > 0) {
      return statusLabel;
    }

    const status = String(item?.status ?? '').trim();
    return status.length > 0 ? status : '-';
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

      if (normalized === 'APPROVE_TRANSFER') {
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
    const token = this.normalizeSearchToken(actionCode);
    switch (token) {
      case 'finalapprove':
      case 'approve':
      case 'اعتمادنهائي':
      case 'اعتماد':
      case 'final_approve':
        return 'FINAL_APPROVE';
      case 'manualcancel':
      case 'cancel':
      case 'الغاءيدوي':
      case 'الغاء':
        return 'MANUAL_CANCEL';
      case 'comment':
      case 'reply':
      case 'تعليق':
      case 'رد':
        return 'COMMENT';
      case 'approvetransfer':
      case 'transferapprove':
      case 'اعتمادالتحويل':
        return 'APPROVE_TRANSFER';
      default:
        if (this.allowedAdminActionCodes.has(String(actionCode ?? '').trim() as SummerAdminActionCode)) {
          return String(actionCode ?? '').trim() as SummerAdminActionCode;
        }
        return '';
    }
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
    });

    if (categorySub) {
      this.subscriptions.add(categorySub);
    }

    const waveSub = this.filtersForm.get('waveCode')?.valueChanges.subscribe(value => {
      const selectedWaveCode = String(value ?? '').trim();
      if (!this.capacityDialogVisible) {
        return;
      }

      if (this.selectedFilterCategoryId > 0 && selectedWaveCode.length > 0) {
        this.capacityScopeCategoryId = this.selectedFilterCategoryId;
        this.capacityScopeWaveCode = selectedWaveCode;
        this.refreshWaveCapacity(true);
      } else {
        this.capacityDialogVisible = false;
      }
    });

    if (waveSub) {
      this.subscriptions.add(waveSub);
    }
  }

  private bindSignalRefresh(): void {
    const signalSub = this.signalRService.Notification$.subscribe(notification => {
      const title = String((notification as { title?: string; Title?: string })?.title
        ?? (notification as { title?: string; Title?: string })?.Title
        ?? '');
      const body = String((notification as { notification?: string; Notification?: string })?.notification
        ?? (notification as { notification?: string; Notification?: string })?.Notification
        ?? '');

      const text = `${title} ${body}`.toUpperCase();
      if (text.includes('SUMMER') || text.includes('مصيف')) {
        this.loadDashboard();
        this.loadRequests();
        if (this.capacityDialogVisible) {
          this.refreshWaveCapacity(true);
        }
      }
    });

    this.subscriptions.add(signalSub);
  }

  private patchActionDefaultsForSelectedRequest(): void {
    const request = this.selectedRequest;
    if (!request) {
      return;
    }

    this.actionForm.patchValue({
      actionCode: 'COMMENT',
      comment: '',
      force: false,
      toCategoryId: request.categoryId,
      toWaveCode: request.waveCode,
      newFamilyCount: null,
      newExtraCount: 0
    }, { emitEvent: false });
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
      }
    });
  }

  private collectErrors(response: { errors?: Array<{ message?: string }> } | null | undefined): string {
    const errors = (response?.errors ?? [])
      .map(item => String(item?.message ?? '').trim())
      .filter(item => item.length > 0);

    return errors.length ? errors.join('<br/>') : 'حدث خطأ غير متوقع.';
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
