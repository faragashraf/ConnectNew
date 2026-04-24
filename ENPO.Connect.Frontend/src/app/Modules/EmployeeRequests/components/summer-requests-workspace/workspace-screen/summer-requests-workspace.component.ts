import { Component, OnDestroy, OnInit } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ElementRef, ViewChild } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { DynamicFormController } from 'src/app/shared/services/BackendServices/DynamicForm/DynamicForm.service';
import { ListRequestModel, MessageDto, RequestedData, SearchKind, TkmendField } from 'src/app/shared/services/BackendServices/DynamicForm/DynamicForm.dto';
import { FileParameter } from 'src/app/shared/services/BackendServices/dto-shared';
import { SummerWorkflowController } from 'src/app/shared/services/BackendServices/SummerWorkflow/SummerWorkflow.service';
import { AttachmentsController } from 'src/app/shared/services/BackendServices/Attachments/Attachments.service';
import {
  SummerRequestsPageChange,
  SummerRequestsPageData,
  SummerRequestSummaryDto,
  SummerWaveCapacityDto,
  SummerWorkflowCommonResponse
} from 'src/app/shared/services/BackendServices/SummerWorkflow/SummerWorkflow.dto';
import { AttchedObjectService } from 'src/app/shared/services/helper/attched-object.service';
import { DynamicMetadataService } from 'src/app/shared/services/helper/dynamic-metadata.service';
import { MsgsService } from 'src/app/shared/services/helper/msgs.service';
import { SpinnerService } from 'src/app/shared/services/helper/spinner.service';
import { SignalRService } from 'src/app/shared/services/SignalRServices/SignalR.service';
import {
  SUMMER_DESTINATION_CATALOG_KEY,
  SUMMER_DYNAMIC_APPLICATION_ID
} from '../../summer-shared/core/summer-feature.config';
import { SUMMER_UI_TEXTS_AR } from '../../summer-shared/core/summer-ui-texts.ar';
import { SummerRequestRowRefreshService } from '../../summer-shared/core/summer-request-row-refresh.service';
import { SummerRequestsListPatchService } from '../../summer-shared/core/summer-requests-list-patch.service';
import { SummerRequestsRealtimeService } from '../../summer-shared/core/summer-requests-realtime.service';
import { SummerCapacityRealtimeEvent } from '../../summer-shared/core/summer-realtime-event.models';
import { AuthObjectsService } from 'src/app/shared/services/helper/auth-objects.service';
import {
  buildSummerCancelDeductionMessage,
  resolveSummerCancelDeductionAmount
} from '../../summer-shared/core/summer-cancel-deduction.policy';
import {
  filterSummerDestinationsForBooking,
  SUMMER_DESTINATION_ACCESS_DENIED_MESSAGE
} from '../../summer-shared/core/summer-destination-access.policy';
import {
  parseSummerDestinationCatalog,
  SUMMER_PDF_REFERENCE_TITLE,
  SUMMER_SEASON_YEAR,
  SummerDestinationConfig,
  SummerWaveDefinition
} from '../summer-requests-workspace.config';
import {
  SUMMER_ALLOWED_ATTACHMENT_EXTENSIONS,
  buildSummerRequestCompanions,
  buildSummerRequestDetailFields,
  coalesceText,
  formatLocalDateHour,
  formatUtcDateToCairoHour,
  getFieldValueByKeys,
  getStatusClass,
  getStatusLabel,
  isAllowedAttachmentFile,
  isRejectedStatus,
  parseDateToEpoch,
  parseWaveLabelDate,
  resolveAttachmentId,
  resolveReplyAuthorName,
  SummerRequestFieldGridRow,
  toDisplayOrDash
} from '../summer-requests-workspace.utils';

type FileBucket = 'cancel' | 'payment' | 'transfer';
type SummerPaymentStatusCode = 'PAID' | 'UNPAID';
const SUMMER_INSTALLMENTS_MAX_COUNT = 7;

interface SummerPaymentSnapshot {
  paymentModeCode: 'INSTALLMENT' | 'CASH';
  paymentModeLabel: string;
  installmentLabel: string;
  amountText: string;
  paidAtDisplay: string;
  paidAtLocal: string;
  statusCode: SummerPaymentStatusCode;
  statusLabel: string;
}

@Component({
  selector: 'app-summer-requests-workspace',
  templateUrl: './summer-requests-workspace.component.html',
  styleUrls: ['./summer-requests-workspace.component.scss']
})
export class SummerRequestsWorkspaceComponent implements OnInit, OnDestroy {
  readonly seasonYear = SUMMER_SEASON_YEAR;
  readonly pdfReferenceTitle = SUMMER_PDF_REFERENCE_TITLE;
  readonly dynamicSummerApplicationId = SUMMER_DYNAMIC_APPLICATION_ID;
  readonly dynamicSummerConfigRouteKey = 'admins/summer-requests/dynamic-booking';
  readonly summerGuideVideoPath = 'assets/videos/Summer.mp4';
  // Temporary UI toggle requested by business: keep payment visible and hide transfer/cancel for now.
  readonly showTransferWorkflowCard = false;
  readonly showCancelWorkflowCard = false;
  readonly paymentInFutureMessage = SUMMER_UI_TEXTS_AR.errors.paymentInFuture;
  readonly destinationAccessDeniedMessage = SUMMER_DESTINATION_ACCESS_DENIED_MESSAGE;
  destinations: SummerDestinationConfig[] = [];
  hasSummerAdminPermission = false;
  loadingDestinations = false;
  destinationsError = '';

  cancelForm: FormGroup;
  paymentForm: FormGroup;
  transferForm: FormGroup;

  cancelAttachments: File[] = [];
  paymentAttachments: File[] = [];
  transferAttachments: File[] = [];

  myRequests: SummerRequestSummaryDto[] = [];
  selectedRequestId: number | null = null;
  selectedRequestDetails: MessageDto | null = null;
  paymentSnapshot: SummerPaymentSnapshot | null = null;

  loadingRequests = false;
  loadingSelectedRequestDetails = false;
  selectedRequestDetailsError = '';
  transferCapacityLoading = false;

  requestsFirst = 0;
  requestsRows = 5;
  readonly requestRowsPerPageOptions = [5, 10, 25, 50];

  submittingCancel = false;
  submittingPayment = false;
  submittingTransfer = false;

  seasonTransferAlreadyUsed = false;
  transferWaveCapacities: SummerWaveCapacityDto[] = [];
  activeTabIndex = 0;
  editRouteToken: string | null = null;
  editRequestId: number | null = null;
  creatingEditLink = false;
  resolvingEditToken = false;
  isAdminEditHost = false;
  showGuideVideoDialog = true;

  @ViewChild('summerGuideVideoPlayer')
  private summerGuideVideoPlayer?: ElementRef<HTMLVideoElement>;

  private readonly paymentInFutureErrorKey = 'paymentInFuture';
  private readonly subscriptions = new Subscription();
  private readonly paymentDateNotInFutureValidator = (control: AbstractControl) => {
    const paidAtLocal = String(control?.value ?? '').trim();
    if (!paidAtLocal) {
      return null;
    }

    const paidAt = this.parseDateTimeLocalInput(paidAtLocal);
    if (!paidAt) {
      return null;
    }

    return this.toComparableUnixSecond(paidAt) > this.toComparableUnixSecond(new Date())
      ? { [this.paymentInFutureErrorKey]: true }
      : null;
  };

  constructor(
    private readonly fb: FormBuilder,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly dynamicFormController: DynamicFormController,
    private readonly summerWorkflowController: SummerWorkflowController,
    private readonly dynamicMetadataService: DynamicMetadataService,
    private readonly attachmentsController: AttachmentsController,
    private readonly attchedObjectService: AttchedObjectService,
    private readonly msg: MsgsService,
    private readonly spinner: SpinnerService,
    private readonly signalRService: SignalRService,
    private readonly summerRealtimeService: SummerRequestsRealtimeService,
    private readonly authObjectsService: AuthObjectsService,
    private readonly rowRefreshService: SummerRequestRowRefreshService,
    private readonly listPatchService: SummerRequestsListPatchService
  ) {
    this.cancelForm = this.fb.group({
      reason: ['', Validators.maxLength(1000)]
    });

    this.paymentForm = this.fb.group({
      paymentStatus: ['PAID'],
      paidAtLocal: [''],
      notes: ['', Validators.maxLength(1000)]
    });
    this.updatePaymentDateValidators();
    this.applyPaymentStatusEditAccess();

    this.transferForm = this.fb.group({
      toCategoryId: [null, Validators.required],
      toWaveCode: ['', Validators.required],
      newFamilyCount: [null, Validators.required],
      newExtraCount: [{ value: 0, disabled: true }, [Validators.min(0)]],
      notes: ['', Validators.maxLength(1000)]
    });
  }

  ngOnInit(): void {
    this.refreshDestinationAccess();
    this.bindRouteMode();
    this.bindPaymentRules();
    this.bindTransferRules();
    this.bindSignalRRefresh();
    this.loadDestinationCatalog();
    this.loadMyRequests();

    const authSub = this.authObjectsService.authObject$.subscribe(() => {
      this.refreshDestinationAccess();
    });
    this.subscriptions.add(authSub);
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  openGuideVideoDialog(): void {
    this.showGuideVideoDialog = true;
  }

  onGuideVideoDialogHide(): void {
    const player = this.summerGuideVideoPlayer?.nativeElement;
    if (!player) {
      return;
    }

    player.pause();
    player.currentTime = 0;
  }

  get selectedRequest(): SummerRequestSummaryDto | undefined {
    if (!this.selectedRequestId) {
      return undefined;
    }
    return this.myRequests.find(item => item.messageId === this.selectedRequestId);
  }

  get bookingDestinations(): SummerDestinationConfig[] {
    return filterSummerDestinationsForBooking(this.destinations, this.hasSummerAdminPermission);
  }

  get canShowCreateBuilder(): boolean {
    return this.isEditMode
      ? this.destinations.length > 0
      : this.bookingDestinations.length > 0;
  }

  get destinationCatalogEmptyStateMessage(): string {
    if (this.destinationsError.length > 0) {
      return this.destinationsError;
    }

    if (!this.loadingDestinations && this.destinations.length > 0 && this.bookingDestinations.length === 0) {
      return this.destinationAccessDeniedMessage;
    }

    return '';
  }

  get canEditPaymentStatus(): boolean {
    return this.hasSummerAdminPermission;
  }

  get paymentWorkflowTabHeader(): string {
    if (this.showTransferWorkflowCard || this.showCancelWorkflowCard) {
      return 'السداد / التحويل / الاعتذار';
    }

    return 'السداد';
  }

  get isPaymentOnlyWorkflowMode(): boolean {
    return !this.showTransferWorkflowCard && !this.showCancelWorkflowCard;
  }

  get isEditMode(): boolean {
    return String(this.editRouteToken ?? '').trim().length > 0;
  }

  get editModeExitLabel(): string {
    return this.isAdminEditHost ? 'العودة للوحة الإدارة' : 'العودة لإنشاء طلب جديد';
  }

  get transferDestination(): SummerDestinationConfig | undefined {
    const categoryId = this.getNumberValue(this.transferForm.get('toCategoryId'));
    return this.transferDestinationOptions.find(item => item.categoryId === categoryId);
  }

  get transferDestinationOptions(): SummerDestinationConfig[] {
    const request = this.selectedRequest;
    if (!request) {
      return [];
    }

    if (this.hasSummerAdminPermission) {
      return this.destinations;
    }

    return this.destinations.filter(item => item.categoryId === request.categoryId);
  }

  get transferWaves(): SummerWaveDefinition[] {
    return this.transferDestination?.waves ?? [];
  }

  get transferFamilyOptions(): number[] {
    return this.transferDestination?.familyOptions ?? [];
  }

  get transferCapacitySummary(): SummerWaveCapacityDto[] {
    return [...this.transferWaveCapacities].sort((a, b) => a.familyCount - b.familyCount);
  }

  get pagedRequests(): SummerRequestSummaryDto[] {
    const start = Math.max(0, this.requestsFirst);
    const rows = Math.max(5, this.requestsRows || 5);
    return this.myRequests.slice(start, start + rows);
  }

  get requestsPageData(): SummerRequestsPageData {
    const pageSize = Math.max(5, this.requestsRows || 5);
    const first = Math.max(0, this.requestsFirst);
    const totalCount = Math.max(0, this.myRequests.length);
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const pageNumber = Math.max(1, Math.floor(first / pageSize) + 1);

    return {
      pageNumber,
      pageSize,
      totalCount,
      totalPages,
      rangeStart: totalCount > 0 ? first + 1 : 0,
      rangeEnd: totalCount > 0 ? Math.min(first + pageSize, totalCount) : 0,
      first,
      rows: pageSize,
      rowsPerPageOptions: this.requestRowsPerPageOptions
    };
  }

  get isSignalRConnected(): boolean {
    const state = String(this.signalRService.hubConnectionState ?? '').trim().toLowerCase();
    return state === 'online' || state === 'connection started';
  }

  get signalRStatusLabel(): string {
    return this.isSignalRConnected
      ? 'متصل بالخدمة اللحظية (SignalR)'
      : 'الخدمة اللحظية غير متصلة (SignalR)';
  }

  get selectedRequestDetailFields(): SummerRequestFieldGridRow[] {
    const currentRequest = this.selectedRequest;
    return buildSummerRequestDetailFields({
      fields: this.selectedRequestDetails?.fields,
      summary: currentRequest ?? null,
      summaryStatusLabel: currentRequest ? this.getRequestStatusLabel(currentRequest) : '',
      summaryDateFormatter: this.formatUtcDate.bind(this),
      resolveWaveLabel: (categoryId, waveCode) => this.getWaveLabelByCategoryAndCode(categoryId, waveCode),
      resolveDestinationNameById: (categoryId) => this.getDestinationNameByCategoryId(categoryId)
    });
  }

  get selectedRequestCompanions(): Array<{ index: number; name: string; relation: string; nationalId: string; age: string }> {
    return buildSummerRequestCompanions(this.selectedRequestDetails?.fields);
  }

  get selectedRequestAttachments(): Array<{ id: number; name: string; size: number }> {
    const attachments = this.selectedRequestDetails?.attachments ?? [];
    return attachments
      .map(item => ({
        id: resolveAttachmentId(item),
        name: String(item.attchNm ?? '-').trim() || '-',
        size: Number(item.attchSize ?? 0) || 0
      }))
      .filter(item => item.name.length > 0);
  }

  get selectedRequestOwnerInfo(): { name: string; fileNumber: string; nationalId: string; phone: string; extraPhone: string } | null {
    if (!this.selectedRequestDetails && !this.selectedRequest) {
      return null;
    }

    const fields = this.selectedRequestDetails?.fields ?? [];
    const summary = this.selectedRequest;

    const ownerFields = fields.filter(field => (Number(field.instanceGroupId ?? 1) || 1) === 1);
    const sourceFields = ownerFields.length > 0 ? ownerFields : fields;

    const ownerName = coalesceText(
      getFieldValueByKeys(sourceFields, ['Emp_Name', 'EmployeeName', 'EmpName', 'Name', 'ArabicName', 'UserDisplayName', 'DisplayName']),
      summary?.employeeName,
      String(this.selectedRequestDetails?.createdBy ?? '').trim()
    );

    const fileNumber = coalesceText(
      getFieldValueByKeys(sourceFields, ['Emp_Id', 'EmployeeFileNumber', 'FileNumber', 'EmpId', 'EmployeeId', 'UserId']),
      summary?.employeeId
    );

    const nationalId = coalesceText(
      getFieldValueByKeys(sourceFields, [
        'NationalId',
        'NATIONAL_ID',
        'national_id',
        'NationalID',
        'NID',
        'Emp_NationalId',
        'IdNumber',
        'NationalNo',
        'IdentityNumber',
        'الرقم القومي',
        'UserNationalId'
      ]),
      summary?.employeeNationalId
    );

    const phone = coalesceText(
      getFieldValueByKeys(sourceFields, [
        'PhoneNumber',
        'PhoneNo',
        'Phone_No',
        'MobileNumber',
        'mobilePhone',
        'MobilePhone',
        'PhoneWhats',
        'Emp_Phone',
        'Telephone',
        'Tel',
        'رقم الهاتف',
        'هاتف',
        'UserPhone',
        'Mobile'
      ]),
      summary?.employeePhone
    );

    const extraPhone = coalesceText(
      getFieldValueByKeys(sourceFields, ['ExtraPhoneNumber', 'SecondaryPhone', 'AlternatePhone', 'PhoneSecondary', 'هاتف إضافي']),
      summary?.employeeExtraPhone
    );

    if (!ownerName && !fileNumber && !nationalId && !phone && !extraPhone) {
      return null;
    }

    return {
      name: toDisplayOrDash(ownerName),
      fileNumber: toDisplayOrDash(fileNumber),
      nationalId: toDisplayOrDash(nationalId),
      phone: toDisplayOrDash(phone),
      extraPhone: toDisplayOrDash(extraPhone)
    };
  }

  get selectedRequestReplies(): Array<{
    replyId: number;
    message: string;
    authorName: string;
    isAdminAction: boolean;
    createdDate?: string;
    attachments: Array<{ id: number; name: string; size: number }>;
  }> {
    const replies = this.selectedRequestDetails?.replies ?? [];
    return replies
      .map(reply => {
        const replyAny = reply as unknown as {
          replyId?: unknown;
          message?: unknown;
          authorName?: unknown;
          authorId?: unknown;
          isAdminAction?: unknown;
          IsAdminAction?: unknown;
          createdDate?: unknown;
          attchShipmentDtos?: Array<{ attchId?: unknown; id?: unknown; attchNm?: unknown; attchSize?: unknown }>;
        };

        return {
          replyId: Number(replyAny.replyId ?? 0) || 0,
          message: String(replyAny.message ?? '').trim(),
          authorName: resolveReplyAuthorName(
            String(replyAny.authorName ?? '').trim(),
            String(replyAny.authorId ?? '').trim()
          ),
          isAdminAction: this.parseReplyAdminFlag(replyAny.isAdminAction ?? replyAny.IsAdminAction),
          createdDate: replyAny.createdDate ? String(replyAny.createdDate) : undefined,
          attachments: (replyAny.attchShipmentDtos ?? [])
            .map(item => ({
              id: resolveAttachmentId(item),
              name: String(item.attchNm ?? '-').trim() || '-',
              size: Number(item.attchSize ?? 0) || 0
            }))
            .filter(item => item.name.length > 0)
        };
      })
      .sort((a, b) => parseDateToEpoch(b.createdDate) - parseDateToEpoch(a.createdDate) || b.replyId - a.replyId);
  }

  destinationTrackBy(_index: number, destination: SummerDestinationConfig): number {
    return destination.categoryId;
  }

  requestTrackBy(_index: number, request: SummerRequestSummaryDto): number {
    return request.messageId;
  }

  onRequestsPageChange(event: SummerRequestsPageChange): void {
    const nextRows = Number(event?.pageSize ?? event?.rows ?? this.requestsRows);
    this.requestsRows = Number.isFinite(nextRows) ? Math.max(5, Math.floor(nextRows)) : 5;

    const nextFirstCandidate = Number(event?.first);
    if (Number.isFinite(nextFirstCandidate) && nextFirstCandidate >= 0) {
      this.requestsFirst = Math.max(0, Math.floor(nextFirstCandidate));
      return;
    }

    const nextPageNumber = Number(event?.pageNumber ?? 1);
    const normalizedPage = Number.isFinite(nextPageNumber) ? Math.max(1, Math.floor(nextPageNumber)) : 1;
    this.requestsFirst = (normalizedPage - 1) * this.requestsRows;
  }

  onTabChange(event: { index?: number }): void {
    const index = Number(event?.index ?? 0);
    this.activeTabIndex = Number.isFinite(index) && index >= 0 ? Math.floor(index) : 0;
  }

  onDynamicBookingCreated(savedMessageId?: number): void {
    const messageId = Number(savedMessageId ?? 0);
    if (Number.isFinite(messageId) && messageId > 0) {
      this.selectedRequestId = Math.floor(messageId);
      this.loadSelectedRequestDetails(this.selectedRequestId);
    }

    if (this.isEditMode) {
      this.exitEditMode(true);
    } else {
      this.activeTabIndex = 1;
    }
    this.loadMyRequests();
  }

  canEditRequest(request: SummerRequestSummaryDto | undefined | null): boolean {
    if (!request) {
      return false;
    }

    if (this.hasSummerAdminPermission) {
      return true;
    }

    if (this.isRejectedStatus(request.status)) {
      return false;
    }

    if (String(request.paidAtUtc ?? '').trim().length > 0) {
      return false;
    }

    return true;
  }

  getEditBlockedReason(request: SummerRequestSummaryDto | undefined | null): string {
    if (!request) {
      return 'لا يمكن تعديل الطلب.';
    }

    if (this.hasSummerAdminPermission) {
      return '';
    }

    if (this.isRejectedStatus(request.status)) {
      return 'لا يمكن تعديل طلب ملغي/مرفوض.';
    }

    if (String(request.paidAtUtc ?? '').trim().length > 0) {
      return 'لا يمكن تعديل الطلب بعد تسجيل السداد.';
    }

    return '';
  }

  openEditRequest(request: SummerRequestSummaryDto | undefined | null): void {
    if (!request) {
      return;
    }

    if (!this.canEditRequest(request)) {
      const reason = this.getEditBlockedReason(request) || 'لا يمكن تعديل هذا الطلب.';
      this.msg.msgError('غير متاح', `<h5>${reason}</h5>`, true);
      return;
    }

    if (this.creatingEditLink) {
      return;
    }

    this.creatingEditLink = true;
    this.activeTabIndex = 0;
    this.summerWorkflowController.createEditToken({
      messageId: request.messageId,
      oneTimeUse: false
    }).subscribe({
      next: response => {
        const token = String(response?.data ?? '').trim();
        if (response?.isSuccess && token.length > 0) {
          this.router.navigate([this.getEditRoutePrefix(), token]);
          return;
        }

        const errors = (response?.errors ?? [])
          .map(item => String(item?.message ?? '').trim())
          .filter(item => item.length > 0)
          .join('<br/>');
        this.msg.msgError('تعذر إنشاء رابط التعديل', `<h5>${errors || 'تعذر إنشاء رابط تعديل آمن للطلب.'}</h5>`, true);
      },
      error: () => {
        this.msg.msgError('تعذر إنشاء رابط التعديل', '<h5>حدث خطأ أثناء إنشاء رابط تعديل آمن للطلب.</h5>', true);
      },
      complete: () => {
        this.creatingEditLink = false;
      }
    });
  }

  exitEditMode(openMyRequestsTab = false): void {
    this.editRouteToken = null;
    this.editRequestId = null;
    this.resolvingEditToken = false;
    if (openMyRequestsTab) {
      this.activeTabIndex = 1;
    }
    this.router.navigate([this.getEditExitRoute()]);
  }

  addFiles(event: Event, bucket: FileBucket): void {
    const input = event.target as HTMLInputElement | null;
    const files = Array.from(input?.files ?? []);
    if (!files.length) {
      return;
    }

    const validFiles = files.filter(file => isAllowedAttachmentFile(file, SUMMER_ALLOWED_ATTACHMENT_EXTENSIONS));
    const invalidFiles = files.filter(file => !isAllowedAttachmentFile(file, SUMMER_ALLOWED_ATTACHMENT_EXTENSIONS));

    if (invalidFiles.length > 0) {
      this.msg.msgError(
        'نوع ملف غير مسموح',
        `<h5>يسمح فقط بملفات PDF أو صور. الملفات غير المسموح بها: ${invalidFiles.map(file => file.name).join(' - ')}</h5>`,
        true
      );
    }

    if (validFiles.length === 0) {
      if (input) {
        input.value = '';
      }
      return;
    }

    if (bucket === 'cancel') {
      this.cancelAttachments = [...this.cancelAttachments, ...validFiles];
    } else if (bucket === 'payment') {
      this.paymentAttachments = [...this.paymentAttachments, ...validFiles];
    } else {
      this.transferAttachments = [...this.transferAttachments, ...validFiles];
    }

    if (input) {
      input.value = '';
    }
  }

  removeFile(bucket: FileBucket, index: number): void {
    if (bucket === 'cancel') {
      this.cancelAttachments = this.cancelAttachments.filter((_, current) => current !== index);
    } else if (bucket === 'payment') {
      this.paymentAttachments = this.paymentAttachments.filter((_, current) => current !== index);
    } else {
      this.transferAttachments = this.transferAttachments.filter((_, current) => current !== index);
    }
  }

  submitCancel(): void {
    this.cancelForm.markAllAsTouched();
    if (!this.selectedRequestId) {
      this.msg.msgError('خطأ', `<h5>${SUMMER_UI_TEXTS_AR.errors.requestSelectionRequiredShort}</h5>`, true);
      return;
    }

    this.submittingCancel = true;
    this.summerWorkflowController.cancel({
      messageId: this.selectedRequestId,
      reason: String(this.cancelForm.get('reason')?.value ?? '').trim(),
      files: this.toFileParameters(this.cancelAttachments)
    }).subscribe({
      next: response => {
        if (response?.isSuccess) {
          this.msg.msgSuccess(SUMMER_UI_TEXTS_AR.success.cancelCompleted);
          this.cancelForm.reset({ reason: '' });
          this.cancelAttachments = [];
          if (response.data) {
            this.upsertMyRequestSummary(response.data);
          } else if (this.selectedRequestId) {
            this.refreshMyRequestRowFromSignal(this.selectedRequestId);
          }
          if (this.selectedRequestId) {
            this.loadSelectedRequestDetails(this.selectedRequestId);
          }
          this.loadTransferCapacity();
          return;
        }

        this.msg.msgError('خطأ', `<h5>${this.collectErrors(response)}</h5>`, true);
      },
      error: () => {
        this.msg.msgError('خطأ', '<h5>تعذر تنفيذ الاعتذار حاليًا.</h5>', true);
      },
      complete: () => {
        this.submittingCancel = false;
      }
    });
  }

  submitPayment(): void {
    this.paymentForm.markAllAsTouched();
    if (this.paymentForm.invalid) {
      if (this.paymentForm.get('paidAtLocal')?.hasError(this.paymentInFutureErrorKey)) {
        this.msg.msgError('خطأ', `<h5>${this.paymentInFutureMessage}</h5>`, true);
        return;
      }
      this.msg.msgError('خطأ', '<h5>يرجى استكمال بيانات السداد.</h5>', true);
      return;
    }

    if (!this.selectedRequestId) {
      this.msg.msgError('خطأ', `<h5>${SUMMER_UI_TEXTS_AR.errors.requestSelectionRequiredShort}</h5>`, true);
      return;
    }

    const currentRequest = this.selectedRequest;
    if (currentRequest && this.isPaymentOverdue(currentRequest)) {
      const dueAtText = this.formatUtcDate(currentRequest.paymentDueAtUtc);
      const overdueMessage = dueAtText
        ? `انتهت مهلة السداد لهذا الطلب. آخر موعد كان ${dueAtText}.`
        : 'انتهت مهلة السداد لهذا الطلب.';
      this.msg.msgError('خطأ', `<h5>${overdueMessage}</h5>`, true);
      return;
    }

    if (currentRequest && isRejectedStatus(String(currentRequest.statusLabel ?? currentRequest.status ?? ''))) {
      this.msg.msgError('خطأ', '<h5>لا يمكن تسجيل السداد لطلب تم إلغاؤه أو الاعتذار عنه.</h5>', true);
      return;
    }

    if (this.paymentAttachments.length === 0) {
      this.msg.msgError('خطأ', '<h5>يجب إرفاق ملف واحد على الأقل قبل تسجيل السداد.</h5>', true);
      return;
    }

    const paymentFormValue = this.paymentForm.getRawValue();
    const paymentStatus: SummerPaymentStatusCode = this.hasSummerAdminPermission
      ? this.normalizePaymentStatusSelection(paymentFormValue.paymentStatus)
      : 'PAID';
    const isPaidStatus = paymentStatus === 'PAID';
    const paidAtLocal = isPaidStatus
      ? String(paymentFormValue.paidAtLocal ?? '').trim()
      : '';
    const paidAtParsed = this.parseDateTimeLocalInput(paidAtLocal);
    if (isPaidStatus && !paidAtParsed) {
      this.msg.msgError('خطأ', '<h5>يرجى تحديد تاريخ ووقت سداد صالح.</h5>', true);
      return;
    }
    const paidAtUtcIso = isPaidStatus && paidAtParsed ? paidAtParsed.toISOString() : '';

    this.submittingPayment = true;
    this.summerWorkflowController.pay({
      messageId: this.selectedRequestId,
      paidAtUtc: paidAtUtcIso,
      paymentStatus,
      forceOverride: false,
      notes: String(this.paymentForm.get('notes')?.value ?? '').trim(),
      files: this.toFileParameters(this.paymentAttachments)
    }).subscribe({
      next: response => {
        if (response?.isSuccess) {
          this.msg.msgSuccess(SUMMER_UI_TEXTS_AR.success.payCompleted);
          this.paymentForm.reset({
            paymentStatus: 'PAID',
            paidAtLocal: '',
            notes: ''
          });
          this.updatePaymentDateValidators();
          this.applyPaymentStatusEditAccess();
          this.paymentAttachments = [];
          if (response.data) {
            this.upsertMyRequestSummary(response.data);
          } else if (this.selectedRequestId) {
            this.refreshMyRequestRowFromSignal(this.selectedRequestId);
          }
          if (this.selectedRequestId) {
            this.loadSelectedRequestDetails(this.selectedRequestId);
          }
          return;
        }

        this.msg.msgError('خطأ', `<h5>${this.collectErrors(response)}</h5>`, true);
      },
      error: (error: unknown) => {
        const errorMessage = this.collectHttpErrors(error, 'تعذر تسجيل السداد حاليًا.');
        this.msg.msgError('خطأ', `<h5>${errorMessage}</h5>`, true);
      },
      complete: () => {
        this.submittingPayment = false;
      }
    });
  }

  submitTransfer(): void {
    this.transferForm.markAllAsTouched();
    if (this.transferForm.invalid) {
      this.msg.msgError('خطأ', '<h5>يرجى استكمال بيانات التحويل.</h5>', true);
      return;
    }

    if (!this.selectedRequestId) {
      this.msg.msgError('خطأ', `<h5>${SUMMER_UI_TEXTS_AR.errors.requestSelectionRequiredShort}</h5>`, true);
      return;
    }

    if (this.seasonTransferAlreadyUsed) {
      this.msg.msgError('خطأ', '<h5>تم استخدام التحويل بالفعل في الموسم الحالي.</h5>', true);
      return;
    }

    const destination = this.transferDestination;
    if (!destination) {
      this.msg.msgError('خطأ', '<h5>الوجهة المستهدفة غير صالحة.</h5>', true);
      return;
    }

    const currentRequest = this.selectedRequest;
    if (!this.hasSummerAdminPermission
      && currentRequest
      && destination.categoryId !== currentRequest.categoryId) {
      this.msg.msgError('خطأ', '<h5>التحويل للمستخدم متاح بين الأفواج داخل نفس المصيف فقط.</h5>', true);
      return;
    }

    const newFamilyCount = this.getNumberValue(this.transferForm.get('newFamilyCount'));
    const maxFamilyOption = destination.familyOptions.length > 0 ? Math.max(...destination.familyOptions) : 0;
    const newExtraCount = this.getNumberValue(this.transferForm.get('newExtraCount'));

    if (maxFamilyOption > 0 && newFamilyCount !== maxFamilyOption && newExtraCount > 0) {
      this.msg.msgError('خطأ', '<h5>الأفراد الإضافيون متاحون فقط عند اختيار السعة القصوى.</h5>', true);
      return;
    }

    const transferCapacity = this.getTransferCapacityByFamily(newFamilyCount);
    if (transferCapacity && transferCapacity.availableUnits <= 0) {
      this.msg.msgError('خطأ', '<h5>لا توجد سعة متاحة لعدد الأفراد المختار في الفوج المحدد.</h5>', true);
      return;
    }

    this.submittingTransfer = true;
    this.summerWorkflowController.transfer({
      messageId: this.selectedRequestId,
      toCategoryId: destination.categoryId,
      toWaveCode: String(this.transferForm.get('toWaveCode')?.value ?? '').trim(),
      newFamilyCount,
      newExtraCount,
      notes: String(this.transferForm.get('notes')?.value ?? '').trim(),
      files: this.toFileParameters(this.transferAttachments)
    }).subscribe({
      next: response => {
        if (response?.isSuccess) {
          this.msg.msgSuccess(SUMMER_UI_TEXTS_AR.success.transferCompleted);
          this.transferAttachments = [];
          this.transferForm.patchValue({ notes: '' });
          if (response.data) {
            this.upsertMyRequestSummary(response.data);
          } else if (this.selectedRequestId) {
            this.refreshMyRequestRowFromSignal(this.selectedRequestId);
          }
          if (this.selectedRequestId) {
            this.loadSelectedRequestDetails(this.selectedRequestId);
          }
          this.loadTransferCapacity();
          return;
        }

        this.msg.msgError('خطأ', `<h5>${this.collectErrors(response)}</h5>`, true);
      },
      error: () => {
        this.msg.msgError('خطأ', '<h5>تعذر تنفيذ التحويل حاليًا.</h5>', true);
      },
      complete: () => {
        this.submittingTransfer = false;
      }
    });
  }

  selectRequest(messageId: number): void {
    this.selectedRequestId = messageId;
    this.selectedRequestDetailsError = '';
    this.paymentSnapshot = null;
    this.paymentAttachments = [];
    this.paymentForm.reset(
      {
        paymentStatus: 'PAID',
        paidAtLocal: '',
        notes: ''
      },
      { emitEvent: false }
    );
    this.updatePaymentDateValidators();
    this.applyPaymentStatusEditAccess();
    const current = this.selectedRequest;
    if (!current) {
      this.selectedRequestDetails = null;
      return;
    }

    this.transferForm.patchValue(
      {
        toCategoryId: this.hasSummerAdminPermission ? null : (current.categoryId ?? null),
        toWaveCode: '',
        newFamilyCount: null,
        newExtraCount: 0,
        notes: ''
      },
      { emitEvent: false }
    );
    this.transferWaveCapacities = [];
    this.applyTransferRules(this.getNumberValue(this.transferForm.get('toCategoryId')));
    this.applyTransferExtraRules();
    this.loadSelectedRequestDetails(messageId);
  }

  loadDestinationCatalog(): void {
    this.loadingDestinations = true;
    this.destinationsError = '';
    this.dynamicMetadataService.getMendJson<unknown>(this.dynamicSummerApplicationId, SUMMER_DESTINATION_CATALOG_KEY).subscribe({
      next: response => {
        if (response?.isSuccess) {
          this.destinations = parseSummerDestinationCatalog(response.data, this.seasonYear);
          if (this.destinations.length > 0) {
            return;
          }
        }

        this.destinations = [];
        const errors = Array.isArray(response?.errors) ? response.errors : [];
        this.destinationsError = errors.length > 0
          ? errors.join('<br/>')
          : SUMMER_UI_TEXTS_AR.errors.destinationCatalogInvalid;
      },
      error: () => {
        this.destinations = [];
        this.destinationsError = SUMMER_UI_TEXTS_AR.errors.destinationCatalogLoadFailed;
      },
      complete: () => {
        this.loadingDestinations = false;
      }
    });
  }

  loadMyRequests(): void {
    this.loadingRequests = true;
    this.summerWorkflowController.getMyRequests(this.seasonYear).subscribe({
      next: response => {
        if (response?.isSuccess && Array.isArray(response.data)) {
          this.myRequests = response.data;
          this.seasonTransferAlreadyUsed = this.myRequests.some(item => item.transferUsed);
          if (this.requestsFirst >= this.myRequests.length) {
            this.requestsFirst = 0;
          }

          if (this.isEditMode && this.editRequestId) {
            const editRequest = this.myRequests.find(item => item.messageId === this.editRequestId);
            if (!editRequest) {
              if (this.isAdminEditHost) {
                return;
              }

              this.msg.msgError('خطأ', '<h5>تعذر العثور على الطلب المطلوب للتعديل ضمن طلباتك الحالية.</h5>', true);
              this.exitEditMode(true);
              return;
            }

            if (!this.canEditRequest(editRequest)) {
              const reason = this.getEditBlockedReason(editRequest) || 'لا يمكن تعديل هذا الطلب.';
              this.msg.msgError('غير متاح', `<h5>${reason}</h5>`, true);
              this.exitEditMode(true);
              return;
            }

            if (this.selectedRequestId !== editRequest.messageId) {
              this.selectedRequestId = editRequest.messageId;
            }
            this.loadSelectedRequestDetails(editRequest.messageId);
          }

          if (this.selectedRequestId && !this.myRequests.some(item => item.messageId === this.selectedRequestId)) {
            this.selectedRequestId = null;
            this.selectedRequestDetails = null;
            this.paymentSnapshot = null;
          } else if (this.selectedRequestId) {
            this.loadSelectedRequestDetails(this.selectedRequestId);
          }
          return;
        }

        this.myRequests = [];
        this.requestsFirst = 0;
        this.selectedRequestId = null;
        this.selectedRequestDetails = null;
        this.paymentSnapshot = null;
        this.seasonTransferAlreadyUsed = false;
      },
      error: () => {
        this.myRequests = [];
        this.requestsFirst = 0;
        this.selectedRequestId = null;
        this.selectedRequestDetails = null;
        this.paymentSnapshot = null;
        this.seasonTransferAlreadyUsed = false;
      },
      complete: () => {
        this.loadingRequests = false;
      }
    });
  }

  formatUtcDate(value?: string): string {
    return formatUtcDateToCairoHour(value);
  }

  isPaymentOverdue(request: SummerRequestSummaryDto): boolean {
    if (!request.paymentDueAtUtc || request.paidAtUtc) {
      return false;
    }

    const due = new Date(request.paymentDueAtUtc);
    if (Number.isNaN(due.getTime())) {
      return false;
    }

    return Date.now() > due.getTime();
  }

  getPaymentMaxDateTimeLocal(): string {
    return this.toDateTimeLocalInputValue(new Date());
  }

  hasPaymentInFutureError(): boolean {
    const control = this.paymentForm.get('paidAtLocal');
    return Boolean(
      control?.hasError(this.paymentInFutureErrorKey)
      && (control.touched || control.dirty)
    );
  }

  getCancelDeductionMessage(request: SummerRequestSummaryDto | undefined | null): string {
    if (!request) {
      return '';
    }

    const destination = this.destinations.find(item => item.categoryId === request.categoryId);
    const deductionAmount = resolveSummerCancelDeductionAmount({
      categoryId: request.categoryId,
      destinationSlug: destination?.slug,
      destinationName: destination?.name || request.categoryName
    });

    if (!deductionAmount || deductionAmount <= 0) {
      return '';
    }

    return buildSummerCancelDeductionMessage(deductionAmount);
  }

  getStatusClass(request: SummerRequestSummaryDto): string {
    return getStatusClass(String(request?.statusLabel ?? request?.status ?? '').trim());
  }

  getStatusLabel(status: string | undefined): string {
    return getStatusLabel(status);
  }

  getRequestStatusLabel(request: SummerRequestSummaryDto): string {
    const explicitLabel = String(request?.statusLabel ?? '').trim();
    if (explicitLabel.length > 0) {
      return explicitLabel;
    }
    return this.getStatusLabel(request?.status);
  }

  isCancelBlockedByWindow(): boolean {
    const info = this.getCancelWindowInfo();
    return Boolean(info?.blocked);
  }

  getCancelWindowNote(): string {
    const info = this.getCancelWindowInfo();
    if (!info) {
      return 'قاعدة الاعتذار: لا يمكن الاعتذار قبل موعد الفوج بأقل من 14 يوم.';
    }

    const lockDateText = formatLocalDateHour(info.lastAllowedDate);
    if (info.blocked) {
      return `انتهت مهلة الاعتذار لهذا الطلب. آخر موعد كان ${lockDateText}.`;
    }

    return `يمكن تقديم الاعتذار حتى ${lockDateText}.`;
  }

  isRejectedStatus(status: string | undefined): boolean {
    return isRejectedStatus(status);
  }

  isCancelActionClosed(request: SummerRequestSummaryDto): boolean {
    return this.getCancelClosedMessage(request).length > 0;
  }

  getCancelClosedMessage(request: SummerRequestSummaryDto): string {
    if (!this.isRejectedStatus(request?.status)) {
      return '';
    }

    const actionType = this.getSelectedActionType();
    if (actionType === 'CANCEL') {
      return 'تم تسجيل الاعتذار مسبقًا عن هذا الطلب.';
    }

    if (actionType === 'AUTO_CANCEL_PAYMENT_TIMEOUT') {
      return 'تم إلغاء الطلب تلقائيًا لعدم السداد خلال مهلة يوم العمل.';
    }

    if (actionType === 'MANUAL_CANCEL') {
      return 'تم إلغاء الطلب يدويًا من إدارة المصايف.';
    }

    const reason = this.getSelectedCancelReason().toLowerCase();
    if (reason.includes('تلقائي') || reason.includes('مهلة') || reason.includes('auto')) {
      return 'تم إلغاء الطلب تلقائيًا لعدم السداد خلال مهلة يوم العمل.';
    }

    if (reason.length > 0) {
      return `الطلب ملغي/مرفوض. السبب: ${reason}`;
    }

    return 'الطلب ملغي/مرفوض ولا يمكن تسجيل اعتذار جديد.';
  }

  isTransferAvailable(request: SummerRequestSummaryDto): boolean {
    if (!request) {
      return false;
    }

    if (request.transferUsed) {
      return false;
    }

    if (this.seasonTransferAlreadyUsed) {
      return false;
    }

    if (this.isRejectedStatus(request.status)) {
      return false;
    }

    return true;
  }

  getTransferStateLabel(request: SummerRequestSummaryDto): string {
    if (request.transferUsed) {
      return 'تم استخدام التحويل';
    }

    if (this.isRejectedStatus(request.status)) {
      return 'غير متاح (الطلب ملغي/مرفوض)';
    }

    if (this.seasonTransferAlreadyUsed) {
      return 'غير متاح (تم استخدام التحويل في طلب آخر)';
    }

    return 'متاح التحويل';
  }

  getTransferStateClass(request: SummerRequestSummaryDto): string {
    return this.isTransferAvailable(request) ? 'ok' : 'warn';
  }

  getSelectedTransferBlockNote(request: SummerRequestSummaryDto): string {
    if (request.transferUsed) {
      return 'تم استخدام التحويل بالفعل لهذا الطلب.';
    }

    if (this.isRejectedStatus(request.status)) {
      return 'لا يمكن تحويل طلب ملغي أو مرفوض.';
    }

    if (this.seasonTransferAlreadyUsed) {
      return 'تم استخدام التحويل بالفعل في هذا الموسم، ولا يمكن تنفيذ تحويل جديد.';
    }

    return '';
  }

  getTransferFamilyOptionLabel(familyCount: number): string {
    const capacity = this.getTransferCapacityByFamily(familyCount);
    if (!capacity) {
      return `${familyCount}`;
    }

    return `${familyCount} (متاح ${Math.max(0, capacity.availableUnits)} من ${capacity.totalUnits})`;
  }

  isTransferFamilyOptionDisabled(familyCount: number): boolean {
    const selected = this.getNumberValue(this.transferForm.get('newFamilyCount'));
    const capacity = this.getTransferCapacityByFamily(familyCount);
    if (!capacity) {
      return false;
    }

    return familyCount !== selected && capacity.availableUnits <= 0;
  }

  downloadAttachment(attachmentId: number, fileName: string): void {
    if (!attachmentId || attachmentId <= 0) {
      this.msg.msgError('خطأ', '<h5>لا يمكن تنزيل المرفق لأن معرف المرفق غير صالح.</h5>', true);
      return;
    }

    this.spinner.show('جاري تحميل المرفق ...');
    this.attachmentsController.downloadDocument(attachmentId).subscribe({
      next: response => {
        const fileContent = String(response?.data ?? '').trim();
        if (response?.isSuccess && fileContent.length > 0) {
          this.attchedObjectService.createObjectURL(fileContent, fileName || `attachment-${attachmentId}`);
          return;
        }

        const errors = (response?.errors ?? [])
          .map(item => String(item?.message ?? '').trim())
          .filter(item => item.length > 0)
          .join('<br/>');
        this.msg.msgError('خطأ', `<h5>${errors || 'تعذر تحميل المرفق.'}</h5>`, true);
      },
      error: () => {
        this.msg.msgError('خطأ', '<h5>تعذر تحميل بيانات المرفق.</h5>', true);
      },
      complete: () => {
        this.spinner.hide();
      }
    });
  }

  private getEditRoutePrefix(): string {
    return this.isAdminEditHost
      ? '/EmployeeRequests/SummerRequestsManagement/edit'
      : '/EmployeeRequests/SummerRequests/edit';
  }

  private getEditExitRoute(): string {
    return this.isAdminEditHost
      ? '/EmployeeRequests/SummerRequestsManagement'
      : '/EmployeeRequests/SummerRequests';
  }

  private bindRouteMode(): void {
    const routeDataSub = this.route.data.subscribe(data => {
      const host = String(data?.['summerEditHost'] ?? '').trim().toLowerCase();
      if (host === 'admin') {
        this.isAdminEditHost = true;
        return;
      }

      if (host === 'employee') {
        this.isAdminEditHost = false;
        return;
      }

      const currentUrl = String(this.router.url ?? '').trim().toLowerCase();
      this.isAdminEditHost = currentUrl.includes('/employeeRequests/summerrequestsmanagement/edit'.toLowerCase());
    });
    this.subscriptions.add(routeDataSub);

    const routeSub = this.route.paramMap.subscribe(params => {
      const routeToken = String(params.get('token') ?? params.get('id') ?? '').trim();
      if (routeToken.length === 0) {
        this.editRouteToken = null;
        this.editRequestId = null;
        this.resolvingEditToken = false;
        return;
      }

      if (this.editRouteToken === routeToken && (this.resolvingEditToken || Number(this.editRequestId ?? 0) > 0)) {
        return;
      }

      this.editRouteToken = routeToken;
      this.editRequestId = null;
      this.resolvingEditToken = true;
      this.activeTabIndex = 0;

      this.summerWorkflowController.resolveEditToken(routeToken).subscribe({
        next: response => {
          if (this.editRouteToken !== routeToken) {
            return;
          }

          const resolvedMessageId = Number(response?.data?.messageId ?? 0);
          if (response?.isSuccess && Number.isFinite(resolvedMessageId) && resolvedMessageId > 0) {
            this.editRequestId = Math.floor(resolvedMessageId);
            const matched = this.myRequests.find(item => item.messageId === this.editRequestId);
            if (matched) {
              this.selectedRequestId = matched.messageId;
              this.loadSelectedRequestDetails(matched.messageId);
            }
            return;
          }

          this.handleEditTokenResolutionFailure(response?.errors);
        },
        error: () => {
          this.handleEditTokenResolutionFailure();
        },
        complete: () => {
          this.resolvingEditToken = false;
        }
      });
    });

    this.subscriptions.add(routeSub);
  }

  private handleEditTokenResolutionFailure(errors?: Array<{ message?: string }>): void {
    const message = (errors ?? [])
      .map(item => String(item?.message ?? '').trim())
      .filter(item => item.length > 0)
      .join('<br/>');
    this.msg.msgError('رابط تعديل غير صالح', `<h5>${message || 'رابط التعديل غير صالح أو منتهي الصلاحية.'}</h5>`, true);
    this.editRouteToken = null;
    this.editRequestId = null;
    this.resolvingEditToken = false;
    this.router.navigate([this.getEditExitRoute()]);
  }

  private loadSelectedRequestDetails(messageId: number): void {
    this.loadingSelectedRequestDetails = true;
    this.selectedRequestDetailsError = '';
    let fallbackTriggered = false;
    this.dynamicFormController.getRequestById(messageId).subscribe({
      next: response => {
        if (response?.isSuccess && response.data) {
          this.selectedRequestDetails = this.normalizeLoadedRequestDetails(response.data, messageId);
          this.refreshPaymentSnapshot();
          this.selectedRequestDetailsError = '';
          return;
        }

        fallbackTriggered = true;
        this.tryLoadSelectedRequestDetailsFromMyRequestsFeed(messageId, response?.errors);
      },
      error: () => {
        fallbackTriggered = true;
        this.tryLoadSelectedRequestDetailsFromMyRequestsFeed(messageId);
      },
      complete: () => {
        if (!fallbackTriggered) {
          this.loadingSelectedRequestDetails = false;
        }
      }
    });
  }

  private tryLoadSelectedRequestDetailsFromMyRequestsFeed(
    messageId: number,
    primaryErrors?: Array<{ message?: string }>
  ): void {
    this.loadingSelectedRequestDetails = true;
    const collectedErrors: Array<{ message?: string }> = [...(primaryErrors ?? [])];
    const queries = this.buildDynamicMyRequestsQueries(messageId);
    let resolved = false;

    const runAttempt = (index: number): void => {
      if (resolved) {
        return;
      }

      if (index >= queries.length) {
        this.selectedRequestDetails = null;
        this.paymentSnapshot = null;
        this.selectedRequestDetailsError = this.resolveRequestDetailsErrorMessage(
          collectedErrors,
          'تعذر تحميل تفاصيل الطلب من الخدمة حالياً.'
        );
        this.loadingSelectedRequestDetails = false;
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
            .map(item => this.normalizeLoadedRequestDetails(item, messageId))
            .filter((item): item is MessageDto => !!item);

          const matched = normalizedMessages.find(item => Number(item.messageId ?? 0) === messageId);
          if (matched) {
            resolved = true;
            this.selectedRequestDetails = matched;
            this.refreshPaymentSnapshot();
            this.selectedRequestDetailsError = '';
          }
        },
        error: () => {
          collectedErrors.push({ message: 'تعذر الوصول لخدمة الطلبات أثناء محاولة التحميل البديلة.' });
        },
        complete: () => {
          if (resolved) {
            this.loadingSelectedRequestDetails = false;
            return;
          }
          runAttempt(index + 1);
        }
      });
    };

    runAttempt(0);
  }

  private bindPaymentRules(): void {
    const statusSub = this.paymentForm.get('paymentStatus')?.valueChanges.subscribe(() => {
      this.updatePaymentDateValidators();
    });
    if (statusSub) {
      this.subscriptions.add(statusSub);
    }
  }

  private refreshPaymentSnapshot(): void {
    this.paymentSnapshot = this.buildPaymentSnapshot();
    const notesValue = String(this.paymentForm.get('notes')?.value ?? '').trim();
    const paymentStatusControl = this.paymentForm.get('paymentStatus');
    const paidAtControl = this.paymentForm.get('paidAtLocal');
    if (!paymentStatusControl || !paidAtControl) {
      return;
    }

    const paymentStatus = this.hasSummerAdminPermission
      ? (this.paymentSnapshot?.statusCode ?? 'PAID')
      : 'PAID';
    paymentStatusControl.setValue(paymentStatus, { emitEvent: false });
    paidAtControl.setValue(this.paymentSnapshot?.paidAtLocal ?? '', { emitEvent: false });
    this.paymentForm.get('notes')?.setValue(notesValue, { emitEvent: false });

    this.updatePaymentDateValidators();
    this.applyPaymentStatusEditAccess();
  }

  private updatePaymentDateValidators(): void {
    const paidAtControl = this.paymentForm.get('paidAtLocal');
    if (!paidAtControl) {
      return;
    }

    if (this.isSelectedPaymentStatusPaid()) {
      paidAtControl.setValidators([Validators.required, this.paymentDateNotInFutureValidator]);
    } else {
      paidAtControl.setValidators([this.paymentDateNotInFutureValidator]);
    }

    paidAtControl.updateValueAndValidity({ emitEvent: false });
  }

  private applyPaymentStatusEditAccess(): void {
    const paymentStatusControl = this.paymentForm.get('paymentStatus');
    if (!paymentStatusControl) {
      return;
    }

    if (this.hasSummerAdminPermission) {
      paymentStatusControl.enable({ emitEvent: false });
    } else {
      paymentStatusControl.disable({ emitEvent: false });
    }
  }

  private isSelectedPaymentStatusPaid(): boolean {
    if (!this.hasSummerAdminPermission) {
      return true;
    }

    const paymentStatus = this.paymentForm.get('paymentStatus')?.value;
    return this.normalizePaymentStatusSelection(paymentStatus) === 'PAID';
  }

  private normalizePaymentStatusSelection(value: unknown): SummerPaymentStatusCode {
    if (typeof value === 'boolean') {
      return value ? 'PAID' : 'UNPAID';
    }

    const normalized = String(value ?? '').trim().toLowerCase();
    if (!normalized) {
      return 'PAID';
    }

    const compact = normalized
      .replace(/[\s_-]+/g, '')
      .replace('إ', 'ا')
      .replace('أ', 'ا')
      .replace('آ', 'ا');

    if (
      compact === 'paid'
      || compact === 'true'
      || compact === '1'
      || compact === 'yes'
      || compact === 'y'
      || compact === 'مسدد'
      || compact === 'تمالسداد'
    ) {
      return 'PAID';
    }

    if (
      compact === 'unpaid'
      || compact === 'notpaid'
      || compact === 'pendingpayment'
      || compact === 'pending'
      || compact === 'false'
      || compact === '0'
      || compact === 'no'
      || compact === 'n'
      || compact === 'غيرمسدد'
      || compact === 'غيرمدفوع'
      || compact === 'بانتظارالسداد'
      || compact === 'pedingpayment'
      || compact.includes('cancel')
      || compact.includes('ملغي')
    ) {
      return 'UNPAID';
    }

    return 'PAID';
  }

  private buildPaymentSnapshot(): SummerPaymentSnapshot | null {
    const fields = this.selectedRequestDetails?.fields ?? [];
    if (fields.length === 0 && !this.selectedRequest) {
      return null;
    }

    const paymentModeCode = this.resolvePaymentModeCode(fields);
    const paymentModeLabel = paymentModeCode === 'INSTALLMENT' ? 'تقسيط' : 'كاش';
    const installmentLabel = paymentModeCode === 'INSTALLMENT'
      ? 'مقدم الحجز'
      : 'قسط واحد (كاش)';

    const amount = paymentModeCode === 'INSTALLMENT'
      ? this.resolveInstallmentAmount(fields, 1)
      : this.resolveCashInstallmentAmount(fields);

    const installmentPaidRaw = this.getFieldTextByAliases(fields, [
      ...this.resolveInstallmentPaidFieldKeys(1),
      'Summer_PaymentInstallment1Paid',
      'SUM2026_PaymentInstallment1Paid'
    ]);
    const installmentPaidAtRaw = this.getFieldTextByAliases(fields, [
      ...this.resolveInstallmentPaidAtFieldKeys(1),
      'Summer_PaymentInstallment1PaidAtUtc',
      'SUM2026_PaymentInstallment1PaidAtUtc'
    ]);
    const paidAtRaw = installmentPaidAtRaw
      || this.getFieldTextByAliases(fields, ['Summer_PaidAtUtc', 'SUM2026_PaidAtUtc', 'PaidAtUtc']);
    const statusRaw = this.getFieldTextByAliases(fields, ['Summer_PaymentStatus', 'SUM2026_PaymentStatus', 'PaymentStatus']);

    const parsedInstallmentPaid = this.parseBooleanLike(installmentPaidRaw);
    let statusCode: SummerPaymentStatusCode;
    if (parsedInstallmentPaid !== null) {
      statusCode = parsedInstallmentPaid ? 'PAID' : 'UNPAID';
    } else if (statusRaw.length > 0) {
      statusCode = this.normalizePaymentStatusSelection(statusRaw);
    } else {
      statusCode = paidAtRaw.length > 0 ? 'PAID' : 'UNPAID';
    }

    const paidAtDisplay = statusCode === 'PAID' && paidAtRaw.length > 0
      ? this.formatUtcDate(paidAtRaw)
      : '-';
    const paidAtLocal = statusCode === 'PAID' ? this.toDateTimeLocalInputFromUtc(paidAtRaw) : '';

    return {
      paymentModeCode,
      paymentModeLabel,
      installmentLabel,
      amountText: this.formatMoney(amount),
      paidAtDisplay: toDisplayOrDash(paidAtDisplay),
      paidAtLocal,
      statusCode,
      statusLabel: statusCode === 'PAID' ? 'مسدد' : 'غير مسدد'
    };
  }

  private resolvePaymentModeCode(fields: TkmendField[]): 'INSTALLMENT' | 'CASH' {
    const paymentModeRaw = this.getFieldTextByAliases(fields, ['Summer_PaymentMode', 'SUM2026_PaymentMode', 'PaymentMode']);
    const paymentModeToken = String(paymentModeRaw ?? '')
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, '');

    if (paymentModeToken.includes('installment') || paymentModeToken.includes('تقسيط')) {
      return 'INSTALLMENT';
    }

    if (paymentModeToken.includes('cash') || paymentModeToken.includes('كاش') || paymentModeToken.includes('نقد')) {
      return 'CASH';
    }

    const installmentCount = this.parseInteger(this.getFieldTextByAliases(fields, ['Summer_PaymentInstallmentCount', 'SUM2026_PaymentInstallmentCount']));
    if (installmentCount > 1) {
      return 'INSTALLMENT';
    }

    const secondInstallmentAmount = this.resolveInstallmentAmount(fields, 2);
    return secondInstallmentAmount > 0 ? 'INSTALLMENT' : 'CASH';
  }

  private resolveInstallmentAmount(fields: TkmendField[], installmentNo: number): number {
    return this.parseDecimal(
      this.getFieldTextByAliases(fields, this.resolveInstallmentAmountFieldKeys(installmentNo))
    );
  }

  private resolveCashInstallmentAmount(fields: TkmendField[]): number {
    const grandTotal = this.parseDecimal(this.getFieldTextByAliases(fields, [
      'Summer_PricingGrandTotal',
      'SUM2026_PricingGrandTotal',
      'PricingGrandTotal',
      'Summer_GrandTotal',
      'SUM2026_GrandTotal'
    ]));
    if (grandTotal > 0) {
      return grandTotal;
    }

    const installmentTotal = this.parseDecimal(this.getFieldTextByAliases(fields, [
      'Summer_PaymentInstallmentsTotal',
      'SUM2026_PaymentInstallmentsTotal'
    ]));
    if (installmentTotal > 0) {
      return installmentTotal;
    }

    return this.resolveInstallmentAmount(fields, 1);
  }

  private resolveInstallmentAmountFieldKeys(installmentNo: number): string[] {
    const normalizedNo = Math.max(1, Math.min(SUMMER_INSTALLMENTS_MAX_COUNT, Math.floor(Number(installmentNo) || 1)));
    return [
      `Summer_PaymentInstallment${normalizedNo}Amount`,
      `SUM2026_PaymentInstallment${normalizedNo}Amount`
    ];
  }

  private resolveInstallmentPaidFieldKeys(installmentNo: number): string[] {
    const normalizedNo = Math.max(1, Math.min(SUMMER_INSTALLMENTS_MAX_COUNT, Math.floor(Number(installmentNo) || 1)));
    return [
      `Summer_PaymentInstallment${normalizedNo}Paid`,
      `SUM2026_PaymentInstallment${normalizedNo}Paid`
    ];
  }

  private resolveInstallmentPaidAtFieldKeys(installmentNo: number): string[] {
    const normalizedNo = Math.max(1, Math.min(SUMMER_INSTALLMENTS_MAX_COUNT, Math.floor(Number(installmentNo) || 1)));
    return [
      `Summer_PaymentInstallment${normalizedNo}PaidAtUtc`,
      `SUM2026_PaymentInstallment${normalizedNo}PaidAtUtc`
    ];
  }

  private parseBooleanLike(value: unknown): boolean | null {
    if (typeof value === 'boolean') {
      return value;
    }

    const normalized = String(value ?? '').trim().toLowerCase();
    if (!normalized) {
      return null;
    }

    const compact = normalized
      .replace(/[\s_-]+/g, '')
      .replace('إ', 'ا')
      .replace('أ', 'ا')
      .replace('آ', 'ا');

    if (compact === 'true' || compact === '1' || compact === 'yes' || compact === 'y' || compact === 'نعم') {
      return true;
    }

    if (compact === 'false' || compact === '0' || compact === 'no' || compact === 'n' || compact === 'لا') {
      return false;
    }

    return null;
  }

  private getFieldTextByAliases(fields: TkmendField[], aliases: string[]): string {
    const normalizedAliases = aliases
      .map(alias => String(alias ?? '').trim().toLowerCase())
      .filter(alias => alias.length > 0);

    if (normalizedAliases.length === 0) {
      return '';
    }

    for (const alias of normalizedAliases) {
      const matches = fields.filter(field =>
        String(field?.fildKind ?? '').trim().toLowerCase() === alias);
      if (matches.length === 0) {
        continue;
      }

      const persistedMatches = matches.filter(field => Number(field?.fildSql ?? 0) > 0);
      const latestField = (persistedMatches.length > 0 ? persistedMatches : matches)
        .reduce((latest, current) =>
          Number(current?.fildSql ?? 0) >= Number(latest?.fildSql ?? 0) ? current : latest
        );

      const text = String(latestField?.fildTxt ?? '').trim();
      if (text.length > 0) {
        return text;
      }
    }

    return '';
  }

  private parseDecimal(value: unknown): number {
    const raw = String(value ?? '').trim();
    if (!raw) {
      return 0;
    }

    const normalized = raw
      .replace(/,/g, '')
      .replace(/٫/g, '.')
      .replace(/[^\d.-]/g, '');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private parseInteger(value: unknown): number {
    const parsed = Math.floor(this.parseDecimal(value));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private formatMoney(value: number): string {
    const normalized = Number.isFinite(value) ? Math.max(0, value) : 0;
    if (normalized <= 0) {
      return '-';
    }

    const rounded = Math.round(normalized * 100) / 100;
    const hasFraction = Math.abs(rounded - Math.trunc(rounded)) > 0.0001;
    const display = rounded.toLocaleString('en-US', {
      minimumFractionDigits: hasFraction ? 2 : 0,
      maximumFractionDigits: 2
    });
    return `${display} جنيه`;
  }

  private toDateTimeLocalInputFromUtc(value: string): string {
    const normalized = String(value ?? '').trim();
    if (!normalized) {
      return '';
    }

    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime())) {
      return '';
    }

    return this.toDateTimeLocalInputValue(parsed);
  }

  private bindTransferRules(): void {
    const destinationSub = this.transferForm.get('toCategoryId')?.valueChanges.subscribe(value => {
      this.applyTransferRules(Number(value));
      this.loadTransferCapacity();
    });
    if (destinationSub) {
      this.subscriptions.add(destinationSub);
    }

    const waveSub = this.transferForm.get('toWaveCode')?.valueChanges.subscribe(() => {
      this.loadTransferCapacity();
    });
    if (waveSub) {
      this.subscriptions.add(waveSub);
    }

    const familySub = this.transferForm.get('newFamilyCount')?.valueChanges.subscribe(() => {
      this.applyTransferExtraRules();
    });
    if (familySub) {
      this.subscriptions.add(familySub);
    }
  }

  private applyTransferRules(categoryId: number): void {
    const destination = this.transferDestinationOptions.find(item => item.categoryId === categoryId);
    if (!destination) {
      this.transferWaveCapacities = [];
      this.transferForm.patchValue(
        {
          toWaveCode: '',
          newFamilyCount: null,
          newExtraCount: 0
        },
        { emitEvent: false }
      );
      this.applyTransferExtraRules();
      return;
    }

    const currentWaveCode = String(this.transferForm.get('toWaveCode')?.value ?? '').trim();
    if (!destination.waves.some(wave => wave.code === currentWaveCode)) {
      this.transferForm.patchValue({ toWaveCode: '' }, { emitEvent: false });
    }

    const currentFamily = this.getNumberValue(this.transferForm.get('newFamilyCount'));
    if (!destination.familyOptions.includes(currentFamily)) {
      this.transferForm.patchValue({ newFamilyCount: null }, { emitEvent: false });
    }

    this.applyTransferExtraRules();
    this.loadTransferCapacity();
  }

  private applyTransferExtraRules(): void {
    const destination = this.transferDestination;
    const extraControl = this.transferForm.get('newExtraCount');
    if (!extraControl) {
      return;
    }

    if (!destination) {
      extraControl.setValidators([Validators.min(0)]);
      extraControl.setValue(0, { emitEvent: false });
      extraControl.disable({ emitEvent: false });
      extraControl.updateValueAndValidity({ emitEvent: false });
      return;
    }

    const familyCount = this.getNumberValue(this.transferForm.get('newFamilyCount'));
    const maxFamilyOption = destination.familyOptions.length > 0 ? Math.max(...destination.familyOptions) : 0;
    const allowExtra = maxFamilyOption > 0 && familyCount === maxFamilyOption;

    extraControl.setValidators([Validators.min(0), Validators.max(destination.maxExtraMembers)]);

    if (allowExtra) {
      extraControl.enable({ emitEvent: false });
    } else {
      extraControl.setValue(0, { emitEvent: false });
      extraControl.disable({ emitEvent: false });
    }

    extraControl.updateValueAndValidity({ emitEvent: false });
  }

  private bindSignalRRefresh(): void {
    const requestSub = this.summerRealtimeService.requestUpdates$.subscribe(update => {
      this.refreshMyRequestRowFromSignal(update.messageId);
      if (this.selectedRequestId && update.messageId === this.selectedRequestId) {
        this.loadTransferCapacity();
        this.loadSelectedRequestDetails(this.selectedRequestId);
      }
    });

    const capacitySub = this.summerRealtimeService.capacityUpdates$.subscribe(update => {
      this.refreshCapacityFromSignal(update);
    });

    this.subscriptions.add(requestSub);
    this.subscriptions.add(capacitySub);
  }

  private refreshMyRequestRowFromSignal(messageId: number): void {
    const targetMessageId = Number(messageId ?? 0);
    if (!Number.isFinite(targetMessageId) || targetMessageId <= 0) {
      return;
    }

    this.rowRefreshService.refreshOwnerRow(this.seasonYear, targetMessageId).subscribe({
      next: matched => {
        if (matched) {
          this.upsertMyRequestSummary(matched);
        } else {
          this.removeMyRequestSummary(targetMessageId);
        }
      }
    });
  }

  private upsertMyRequestSummary(summary: SummerRequestSummaryDto): void {
    const messageId = Number(summary?.messageId ?? 0);
    if (!Number.isFinite(messageId) || messageId <= 0) {
      return;
    }

    const patched = this.listPatchService.upsertOwnerRequests(this.myRequests, summary);
    this.myRequests = patched.items;
    this.seasonTransferAlreadyUsed = this.myRequests.some(item => item.transferUsed);
  }

  private removeMyRequestSummary(messageId: number): void {
    const patched = this.listPatchService.removeByMessageId(this.myRequests, messageId);
    if (patched.change !== 'removed') {
      return;
    }

    this.myRequests = patched.items;
    this.seasonTransferAlreadyUsed = this.myRequests.some(item => item.transferUsed);
    if (this.requestsFirst >= this.myRequests.length) {
      this.requestsFirst = 0;
    }

    if (this.selectedRequestId === messageId) {
      this.selectedRequestId = null;
      this.selectedRequestDetails = null;
      this.selectedRequestDetailsError = '';
    }
  }

  private refreshCapacityFromSignal(update: SummerCapacityRealtimeEvent): void {
    const categoryId = Number(update?.categoryId ?? 0);
    const waveCode = String(update?.waveCode ?? '').trim();
    if (!Number.isFinite(categoryId) || categoryId <= 0 || waveCode.length === 0) {
      return;
    }

    const transferCategory = this.transferDestination?.categoryId ?? 0;
    const transferWave = String(this.transferForm.get('toWaveCode')?.value ?? '').trim();

    if (categoryId === transferCategory && waveCode === transferWave) {
      this.loadTransferCapacity();
    }
  }

  private loadTransferCapacity(): void {
    const destination = this.transferDestination;
    const waveCode = String(this.transferForm.get('toWaveCode')?.value ?? '').trim();
    if (!destination || !waveCode) {
      this.transferWaveCapacities = [];
      return;
    }

    this.transferCapacityLoading = true;
    this.summerWorkflowController.getWaveCapacity(destination.categoryId, waveCode).subscribe({
      next: response => {
        this.transferWaveCapacities = response?.isSuccess && Array.isArray(response.data) ? response.data : [];
      },
      error: () => {
        this.transferWaveCapacities = [];
      },
      complete: () => {
        this.transferCapacityLoading = false;
      }
    });
  }

  private getTransferCapacityByFamily(familyCount: number): SummerWaveCapacityDto | undefined {
    return this.transferWaveCapacities.find(item => item.familyCount === familyCount);
  }

  private getCancelWindowInfo(): { blocked: boolean; lastAllowedDate: Date } | null {
    const request = this.selectedRequest;
    if (!request) {
      return null;
    }

    const waveStartDate = this.resolveWaveStartDate(request.categoryId, request.waveCode);
    if (!waveStartDate) {
      return null;
    }

    const lastAllowedDate = new Date(waveStartDate.getTime() - (14 * 24 * 60 * 60 * 1000));
    return {
      blocked: Date.now() > lastAllowedDate.getTime(),
      lastAllowedDate
    };
  }

  private resolveWaveStartDate(categoryId: number, waveCode: string): Date | null {
    const destination = this.destinations.find(item => item.categoryId === categoryId);
    const wave = destination?.waves.find(item => item.code === String(waveCode ?? '').trim());
    const parsedFromCatalog = parseWaveLabelDate(wave?.startsAtLabel ?? '');
    if (parsedFromCatalog) {
      return parsedFromCatalog;
    }

    const detailsFields = this.selectedRequestDetails?.fields ?? [];
    const labelFromDetails = getFieldValueByKeys(detailsFields, ['SummerCampLabel']);
    const parsedFromDetails = parseWaveLabelDate(labelFromDetails);
    if (parsedFromDetails) {
      return parsedFromDetails;
    }

    return null;
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

  private getSelectedActionType(): string {
    const fields = this.selectedRequestDetails?.fields ?? [];
    const action = getFieldValueByKeys(fields, ['Summer_ActionType', 'Summer_AdminLastAction']);
    return String(action ?? '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '_');
  }

  private getSelectedCancelReason(): string {
    const fields = this.selectedRequestDetails?.fields ?? [];
    return String(getFieldValueByKeys(fields, ['Summer_CancelReason']) ?? '').trim();
  }

  private refreshDestinationAccess(): void {
    try {
      const hasSummerGeneralManagerPermission =
        this.authObjectsService.checkAuthFun('SummerGeneralManagerFunc')
        || this.authObjectsService.checkAuthRole('2021');
      this.hasSummerAdminPermission =
        this.authObjectsService.checkAuthFun('SummerAdminFunc')
        || this.authObjectsService.checkAuthRole('2020')
        || hasSummerGeneralManagerPermission;
    } catch {
      this.hasSummerAdminPermission = false;
    }

    this.applyPaymentStatusEditAccess();
  }

  private toFileParameters(files: File[]): FileParameter[] {
    return files.map(file => ({
      data: file,
      fileName: file.name,
      originalSize: file.size
    }));
  }

  private collectErrors<T>(response: SummerWorkflowCommonResponse<T> | null | undefined): string {
    const errors = (response?.errors ?? [])
      .map(error => String(error?.message ?? '').trim())
      .filter(message => message.length > 0);

    return errors.length ? errors.join('<br/>') : 'لا توجد رسائل خطأ.';
  }

  private collectHttpErrors(error: unknown, fallbackMessage: string): string {
    const messages: string[] = [];
    const appendMessage = (value: unknown): void => {
      const text = String(value ?? '').trim();
      if (!text || messages.includes(text)) {
        return;
      }
      messages.push(text);
    };

    const collectFromPayload = (payload: unknown): void => {
      if (!payload) {
        return;
      }

      if (typeof payload === 'string') {
        const trimmed = payload.trim();
        if (!trimmed) {
          return;
        }

        try {
          collectFromPayload(JSON.parse(trimmed));
        } catch {
          appendMessage(trimmed);
        }
        return;
      }

      if (typeof payload !== 'object') {
        return;
      }

      const record = payload as Record<string, unknown>;
      const responseErrors = Array.isArray(record['errors']) ? record['errors'] : [];
      responseErrors.forEach(item => {
        if (item && typeof item === 'object') {
          appendMessage((item as Record<string, unknown>)['message']);
        }
      });

      const validationErrors = record['errors'];
      if (validationErrors && !Array.isArray(validationErrors) && typeof validationErrors === 'object') {
        Object.values(validationErrors as Record<string, unknown>).forEach(group => {
          if (Array.isArray(group)) {
            group.forEach(entry => appendMessage(entry));
          }
        });
      }

      appendMessage(record['message']);
      appendMessage(record['detail']);
      appendMessage(record['title']);
    };

    if (error instanceof HttpErrorResponse) {
      collectFromPayload(error.error);
      appendMessage(error.message);
    } else {
      const record = (error ?? {}) as Record<string, unknown>;
      collectFromPayload(record['error']);
      collectFromPayload(record['response']);
      appendMessage(record['message']);
    }

    return messages.length > 0 ? messages.join('<br/>') : fallbackMessage;
  }

  private getNumberValue(control: AbstractControl | null): number {
    const raw = control?.value;
    const numeric = Number(raw);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  private parsePositiveInt(value: unknown): number | null {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return null;
    }
    return Math.floor(parsed);
  }

  private parseReplyAdminFlag(value: unknown): boolean {
    if (typeof value === 'boolean') {
      return value;
    }

    const normalized = String(value ?? '').trim().toLowerCase();
    return normalized === 'true' || normalized === '1';
  }

  private tryParseDate(value: unknown): Date | null {
    const normalized = String(value ?? '').trim();
    if (!normalized) {
      return null;
    }

    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private parseDateTimeLocalInput(value: string): Date | null {
    const normalized = String(value ?? '').trim();
    if (!normalized) {
      return null;
    }

    const withSeconds = normalized.length === 16 ? `${normalized}:00` : normalized;
    const parsed = new Date(withSeconds);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private toDateTimeLocalInputValue(value: Date): string {
    const year = String(value.getFullYear());
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    const hours = String(value.getHours()).padStart(2, '0');
    const minutes = String(value.getMinutes()).padStart(2, '0');
    const seconds = String(value.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
  }

  private toComparableUnixSecond(value: Date): number {
    return Math.floor(value.getTime() / 1000);
  }

  private normalizeLoadedRequestDetails(raw: unknown, fallbackMessageId?: number): MessageDto | null {
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
    ])) ?? this.parsePositiveInt(fallbackMessageId);
    if (messageId) {
      normalized['messageId'] = messageId;
    }

    const fieldsSource = this.readValue(source, [
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
    ]);
    const normalizedFields = this.normalizeLoadedFields(fieldsSource);
    normalized['fields'] = normalizedFields;

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
      categoryCd = this.parsePositiveInt(getFieldValueByKeys(normalizedFields, ['SummerDestinationId', 'DestinationId']));
    }

    if (!categoryCd && messageId) {
      const summary = this.myRequests.find(item => item.messageId === messageId);
      categoryCd = this.parsePositiveInt(summary?.categoryId);
    }

    if (categoryCd) {
      normalized['categoryCd'] = categoryCd;
    }

    const attachmentsSource = this.readValue(source, [
      'attachments',
      'Attachments',
      'attchShipments',
      'AttchShipments',
      'attchShipmentDtos',
      'AttchShipmentDtos'
    ]);
    normalized['attachments'] = this.extractArray(attachmentsSource);

    const repliesSource = this.readValue(source, [
      'replies',
      'Replies',
      'replyDtos',
      'ReplyDtos'
    ]);
    normalized['replies'] = this.extractArray(repliesSource);

    return normalized as unknown as MessageDto;
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
      const instanceGroupId = Number(
        this.readValue(row, [
          'instanceGroupId',
          'InstanceGroupId',
          'instance_group_id',
          'Instance_Group_Id'
        ])
        ?? 1
      );
      const mendGroup = Number(
        this.readValue(row, [
          'mendGroup',
          'MendGroup',
          'groupId',
          'GroupId',
          'mend_group'
        ])
        ?? 0
      );
      const mendCategory = Number(
        this.readValue(row, [
          'mendCategory',
          'MendCategory',
          'categoryCd',
          'CategoryCd',
          'categoryId',
          'CategoryId'
        ])
        ?? 0
      );
      const fildSql = Number(
        this.readValue(row, [
          'fildSql',
          'FildSql',
          'fieldSql',
          'FieldSql',
          'id',
          'Id'
        ])
        ?? 0
      );
      const fildRelted = Number(
        this.readValue(row, [
          'fildRelted',
          'FildRelted',
          'fieldRelated',
          'FieldRelated'
        ])
        ?? 0
      );

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
        mendGroup: Number.isFinite(mendGroup) ? Math.floor(mendGroup) : 0,
        mendCategory: Number.isFinite(mendCategory) ? Math.floor(mendCategory) : 0
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

  private buildDynamicMyRequestsQueries(messageId: number): ListRequestModel[] {
    const summary = this.myRequests.find(item => item.messageId === messageId);
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
      return 'تعذر تحميل تفاصيل الطلب بسبب مشكلة بجدول المرفقات في قاعدة البيانات (Attch_shipment). برجاء مراجعة الـ Backend.';
    }

    return combined || fallback;
  }
}
