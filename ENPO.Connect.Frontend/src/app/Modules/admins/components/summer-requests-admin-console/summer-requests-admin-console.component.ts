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
  SummerRequestSummaryDto,
  SummerWaveCapacityDto
} from 'src/app/shared/services/BackendServices/SummerWorkflow/SummerWorkflow.dto';
import { SummerWorkflowController } from 'src/app/shared/services/BackendServices/SummerWorkflow/SummerWorkflow.service';
import { AttchedObjectService } from 'src/app/shared/services/helper/attched-object.service';
import { MsgsService } from 'src/app/shared/services/helper/msgs.service';
import { SpinnerService } from 'src/app/shared/services/helper/spinner.service';
import { SignalRService } from 'src/app/shared/services/SignalRServices/SignalR.service';
import {
  SUMMER_DESTINATIONS_2026,
  SUMMER_SEASON_YEAR,
  SummerDestinationConfig,
  SummerWaveDefinition
} from '../summer-requests-workspace/summer-requests-workspace.config';

@Component({
  selector: 'app-summer-requests-admin-console',
  templateUrl: './summer-requests-admin-console.component.html',
  styleUrls: ['./summer-requests-admin-console.component.scss']
})
export class SummerRequestsAdminConsoleComponent implements OnInit, OnDestroy {
  readonly seasonYear = SUMMER_SEASON_YEAR;
  readonly destinations = SUMMER_DESTINATIONS_2026;

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

  readonly actionOptions = [
    { value: 'COMMENT', label: 'تعليق / رد إداري' },
    { value: 'FINAL_APPROVE', label: 'اعتماد نهائي' },
    { value: 'MANUAL_CANCEL', label: 'إلغاء يدوي' },
    { value: 'APPROVE_TRANSFER', label: 'اعتماد تحويل' }
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
  requestsPageSize = 50;
  requestsTotalPages = 1;

  readonly pageSizeOptions = [25, 50, 100, 250, 500];

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

  constructor(
    private readonly fb: FormBuilder,
    private readonly summerWorkflowController: SummerWorkflowController,
    private readonly dynamicFormController: DynamicFormController,
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
      pageSize: [50]
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
    this.loadDashboard();
    this.loadRequests();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
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

  get selectedRequestFields(): Array<{ key: string; value: string; groupId: number }> {
    const fields = this.selectedRequestDetails?.fields ?? [];
    return fields
      .filter(field => String(field.fildTxt ?? '').trim().length > 0)
      .map(field => ({
        key: String(field.fildKind ?? '').trim(),
        value: String(field.fildTxt ?? '').trim(),
        groupId: Number(field.instanceGroupId ?? 1) || 1
      }))
      .sort((a, b) => a.groupId - b.groupId || a.key.localeCompare(b.key));
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
          id: Number(item.attchId ?? 0) || Number((item as unknown as { id?: number }).id ?? 0) || 0,
          name: String(item.attchNm ?? '-').trim() || '-'
        }))
      }))
      .sort((a, b) => this.toEpoch(b.created) - this.toEpoch(a.created) || b.id - a.id);
  }

  get selectedRequestAttachments(): Array<{ id: number; name: string }> {
    const attachments = this.selectedRequestDetails?.attachments ?? [];
    return attachments.map(item => ({
      id: Number(item.attchId ?? 0) || Number((item as unknown as { id?: number }).id ?? 0) || 0,
      name: String(item.attchNm ?? '-').trim() || '-'
    }));
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
      pageSize: 50
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

  onPageSizeChanged(value: string | number): void {
    const pageSize = Number(value);
    if (!Number.isFinite(pageSize) || pageSize <= 0) {
      return;
    }

    this.requestsPageSize = pageSize;
    this.filtersForm.patchValue({
      pageSize,
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
    this.loadingRequests = true;
    const raw = this.filtersForm.getRawValue();
    const requestedPageNumber = Number(raw.pageNumber ?? 1) || 1;
    const requestedPageSize = Number(raw.pageSize ?? this.requestsPageSize) || this.requestsPageSize;
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
        const isSuccess = Boolean(response?.isSuccess);
        this.requests = isSuccess && Array.isArray(response?.data) ? response.data : [];

        const totalCount = Number(response?.totalCount ?? this.requests.length) || 0;
        const pageSize = Number(response?.pageSize ?? requestedPageSize) || requestedPageSize;
        const pageNumber = Number(response?.pageNumber ?? requestedPageNumber) || requestedPageNumber;
        const computedTotalPages = Math.max(1, Math.ceil(totalCount / Math.max(1, pageSize)));
        const responseTotalPages = Number(response?.totalPages ?? computedTotalPages) || computedTotalPages;

        this.requestsTotalCount = Math.max(0, totalCount);
        this.requestsPageSize = Math.max(1, pageSize);
        this.requestsTotalPages = Math.max(1, responseTotalPages);
        this.requestsPageNumber = Math.max(1, Math.min(pageNumber, this.requestsTotalPages));

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
        this.requests = [];
        this.requestsTotalCount = 0;
        this.requestsPageNumber = 1;
        this.requestsTotalPages = 1;
      },
      complete: () => {
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
    const actionCode = String(raw.actionCode ?? '').trim();

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
    return `${day}/${month}/${year} ${hour}:00`;
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

  private bindActionRules(): void {
    const actionCodeSub = this.actionForm.get('actionCode')?.valueChanges.subscribe(value => {
      const normalized = String(value ?? '').trim().toUpperCase();
      const toCategoryControl = this.actionForm.get('toCategoryId');
      const toWaveControl = this.actionForm.get('toWaveCode');
      const familyControl = this.actionForm.get('newFamilyCount');
      const extraControl = this.actionForm.get('newExtraCount');

      if (!toCategoryControl || !toWaveControl || !familyControl || !extraControl) {
        return;
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

  private syncQuickFiltersFromForm(): void {
    const raw = this.filtersForm.getRawValue();
    this.activeDashboardStatus = String(raw.status ?? '').trim();
    this.activeDashboardPaymentState = String(raw.paymentState ?? '').trim();
  }
}
