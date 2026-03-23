import { Component, OnDestroy, OnInit } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
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
  parseSummerDestinationCatalog,
  SUMMER_PDF_REFERENCE_TITLE,
  SUMMER_SEASON_YEAR,
  SummerDestinationConfig,
  SummerWaveDefinition
} from '../summer-requests-workspace.config';
import {
  SUMMER_ALLOWED_ATTACHMENT_EXTENSIONS,
  SUMMER_FIELD_LABEL_MAP,
  coalesceText,
  extractCapacityPayloadFromSignal,
  formatLocalDateHour,
  formatRequestFieldValue,
  formatUtcDateToCairoHour,
  getFieldValueByKeys,
  getStatusClass,
  getStatusLabel,
  isAllowedAttachmentFile,
  isRejectedStatus,
  parseDateToEpoch,
  parseWaveLabelDate,
  resolveAttachmentId,
  resolveFieldLabel,
  resolveReplyAuthorName,
  toDisplayOrDash
} from '../summer-requests-workspace.utils';

type FileBucket = 'cancel' | 'payment' | 'transfer';

@Component({
  selector: 'app-summer-requests-workspace',
  templateUrl: './summer-requests-workspace.component.html',
  styleUrls: ['./summer-requests-workspace.component.scss']
})
export class SummerRequestsWorkspaceComponent implements OnInit, OnDestroy {
  readonly seasonYear = SUMMER_SEASON_YEAR;
  readonly pdfReferenceTitle = SUMMER_PDF_REFERENCE_TITLE;
  readonly dynamicSummerApplicationId = 'SUM2026DYN';
  readonly dynamicSummerConfigRouteKey = 'admins/summer-requests/dynamic-booking';
  destinations: SummerDestinationConfig[] = [];
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
  editRequestId: number | null = null;

  private readonly subscriptions = new Subscription();

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
    private readonly signalRService: SignalRService
  ) {
    this.cancelForm = this.fb.group({
      reason: ['', Validators.maxLength(1000)]
    });

    this.paymentForm = this.fb.group({
      paidAtLocal: ['', Validators.required],
      notes: ['', Validators.maxLength(1000)]
    });

    this.transferForm = this.fb.group({
      toCategoryId: [null, Validators.required],
      toWaveCode: ['', Validators.required],
      newFamilyCount: [null, Validators.required],
      newExtraCount: [{ value: 0, disabled: true }, [Validators.min(0)]],
      notes: ['', Validators.maxLength(1000)]
    });
  }

  ngOnInit(): void {
    this.bindRouteMode();
    this.bindTransferRules();
    this.bindSignalRRefresh();
    this.loadDestinationCatalog();
    this.loadMyRequests();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  get selectedRequest(): SummerRequestSummaryDto | undefined {
    if (!this.selectedRequestId) {
      return undefined;
    }
    return this.myRequests.find(item => item.messageId === this.selectedRequestId);
  }

  get isEditMode(): boolean {
    return Number(this.editRequestId ?? 0) > 0;
  }

  get transferDestination(): SummerDestinationConfig | undefined {
    const categoryId = this.getNumberValue(this.transferForm.get('toCategoryId'));
    return this.destinations.find(item => item.categoryId === categoryId);
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

  get selectedRequestDetailFields(): Array<{ label: string; value: string; instanceGroupId: number }> {
    const fields = this.selectedRequestDetails?.fields ?? [];
    const currentRequest = this.selectedRequest;
    const detailedRows = fields
      .filter(field => String(field.fildTxt ?? '').trim().length > 0)
      .filter(field => !this.isCompanionFieldKey(String(field.fildKind ?? '').trim()))
      .map(field => {
        const fieldKey = String(field.fildKind ?? '').trim();
        const normalizedFieldKey = this.normalizeDynamicFieldKey(fieldKey);
        let value = formatRequestFieldValue(fieldKey, String(field.fildTxt ?? '').trim());

        if (currentRequest && normalizedFieldKey === 'summercamplabel') {
          const expectedWaveLabel = this.getWaveLabelByCategoryAndCode(currentRequest.categoryId, currentRequest.waveCode);
          if (expectedWaveLabel) {
            value = expectedWaveLabel;
          }
        }

        return {
          label: resolveFieldLabel(fieldKey, SUMMER_FIELD_LABEL_MAP),
          value,
          instanceGroupId: Number(field.instanceGroupId ?? 1) || 1
        };
      })
      .sort((a, b) => a.instanceGroupId - b.instanceGroupId || a.label.localeCompare(b.label));

    if (detailedRows.length > 0) {
      return detailedRows;
    }

    return this.buildSummaryFallbackDetailFields(currentRequest);
  }

  get selectedRequestCompanions(): Array<{ index: number; name: string; relation: string; nationalId: string; age: string }> {
    const fields = this.selectedRequestDetails?.fields ?? [];
    const grouped = new Map<number, { groupId: number; name: string; relation: string; nationalId: string; age: string }>();

    fields.forEach((field, rowIndex) => {
      const fieldKey = String(field.fildKind ?? '').trim();
      if (!this.isCompanionFieldKey(fieldKey)) {
        return;
      }

      const normalizedFieldKey = this.normalizeDynamicFieldKey(fieldKey);
      const formattedValue = formatRequestFieldValue(fieldKey, String(field.fildTxt ?? '').trim());
      const rawGroupId = Number(field.instanceGroupId ?? 0);
      const groupId = Number.isFinite(rawGroupId) && rawGroupId > 0 ? rawGroupId : (10000 + rowIndex);

      if (!grouped.has(groupId)) {
        grouped.set(groupId, {
          groupId,
          name: '',
          relation: '',
          nationalId: '',
          age: ''
        });
      }

      const row = grouped.get(groupId);
      if (!row) {
        return;
      }

      if (normalizedFieldKey.includes('familymembername') || normalizedFieldKey.includes('companionname')) {
        row.name = formattedValue;
        return;
      }

      if (normalizedFieldKey === 'familyrelation' || normalizedFieldKey === 'companionrelation') {
        row.relation = formattedValue;
        return;
      }

      if (normalizedFieldKey.includes('familymembernationalid') || normalizedFieldKey.includes('companionnationalid')) {
        row.nationalId = formattedValue;
        return;
      }

      if (normalizedFieldKey.includes('familymemberage') || normalizedFieldKey.includes('companionage')) {
        row.age = formattedValue;
      }
    });

    return [...grouped.values()]
      .sort((a, b) => a.groupId - b.groupId)
      .map((row, index) => ({
        index: index + 1,
        name: toDisplayOrDash(row.name),
        relation: toDisplayOrDash(row.relation),
        nationalId: toDisplayOrDash(row.nationalId),
        age: toDisplayOrDash(row.age)
      }))
      .filter(row => row.name !== '-' || row.relation !== '-' || row.nationalId !== '-' || row.age !== '-');
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

    this.activeTabIndex = 0;
    this.router.navigate(['/EmployeeRequests/SummerRequests/edit', request.messageId]);
  }

  exitEditMode(openMyRequestsTab = false): void {
    this.editRequestId = null;
    if (openMyRequestsTab) {
      this.activeTabIndex = 1;
    }
    this.router.navigate(['/EmployeeRequests/SummerRequests']);
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
      this.msg.msgError('خطأ', '<h5>يرجى اختيار طلب.</h5>', true);
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
          this.msg.msgSuccess('تم تنفيذ الاعتذار بنجاح');
          this.cancelForm.reset({ reason: '' });
          this.cancelAttachments = [];
          this.loadMyRequests();
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
      this.msg.msgError('خطأ', '<h5>يرجى استكمال بيانات السداد.</h5>', true);
      return;
    }

    if (!this.selectedRequestId) {
      this.msg.msgError('خطأ', '<h5>يرجى اختيار طلب.</h5>', true);
      return;
    }

    if (this.paymentAttachments.length === 0) {
      this.msg.msgError('خطأ', '<h5>يجب إرفاق ملف واحد على الأقل قبل تسجيل السداد.</h5>', true);
      return;
    }

    const paidAtLocal = String(this.paymentForm.get('paidAtLocal')?.value ?? '').trim();
    const paidAtUtcIso = paidAtLocal ? new Date(paidAtLocal).toISOString() : '';

    this.submittingPayment = true;
    this.summerWorkflowController.pay({
      messageId: this.selectedRequestId,
      paidAtUtc: paidAtUtcIso,
      forceOverride: false,
      notes: String(this.paymentForm.get('notes')?.value ?? '').trim(),
      files: this.toFileParameters(this.paymentAttachments)
    }).subscribe({
      next: response => {
        if (response?.isSuccess) {
          this.msg.msgSuccess('تم تسجيل السداد بنجاح');
          this.paymentForm.reset({ paidAtLocal: '', notes: '' });
          this.paymentAttachments = [];
          this.loadMyRequests();
          return;
        }

        this.msg.msgError('خطأ', `<h5>${this.collectErrors(response)}</h5>`, true);
      },
      error: () => {
        this.msg.msgError('خطأ', '<h5>تعذر تسجيل السداد حاليًا.</h5>', true);
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
      this.msg.msgError('خطأ', '<h5>يرجى اختيار طلب.</h5>', true);
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
          this.msg.msgSuccess('تم تنفيذ التحويل بنجاح');
          this.transferAttachments = [];
          this.transferForm.patchValue({ notes: '' });
          this.loadMyRequests();
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
    const current = this.selectedRequest;
    if (!current) {
      this.selectedRequestDetails = null;
      return;
    }

    this.transferForm.patchValue(
      {
        toCategoryId: null,
        toWaveCode: '',
        newFamilyCount: null,
        newExtraCount: 0,
        notes: ''
      },
      { emitEvent: false }
    );
    this.transferWaveCapacities = [];
    this.applyTransferExtraRules();
    this.loadSelectedRequestDetails(messageId);
  }

  loadDestinationCatalog(): void {
    this.loadingDestinations = true;
    this.destinationsError = '';
    this.dynamicMetadataService.getMendJson<unknown>(this.dynamicSummerApplicationId, 'SUM2026_DestinationCatalog').subscribe({
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
          : 'تعذر تحميل إعدادات المصايف الديناميكية من CDMendTbl.';
      },
      error: () => {
        this.destinations = [];
        this.destinationsError = 'تعذر تحميل إعدادات المصايف الديناميكية من الخدمة العامة.';
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
          } else if (this.selectedRequestId) {
            this.loadSelectedRequestDetails(this.selectedRequestId);
          }
          return;
        }

        this.myRequests = [];
        this.requestsFirst = 0;
        this.selectedRequestId = null;
        this.selectedRequestDetails = null;
        this.seasonTransferAlreadyUsed = false;
      },
      error: () => {
        this.myRequests = [];
        this.requestsFirst = 0;
        this.selectedRequestId = null;
        this.selectedRequestDetails = null;
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

  getStatusClass(request: SummerRequestSummaryDto): string {
    return getStatusClass(request.status);
  }

  getStatusLabel(status: string | undefined): string {
    return getStatusLabel(status);
  }

  getRequestStatusLabel(request: SummerRequestSummaryDto): string {
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

  private bindRouteMode(): void {
    const routeSub = this.route.paramMap.subscribe(params => {
      const parsedId = this.parsePositiveInt(params.get('id'));
      this.editRequestId = parsedId;

      if (parsedId) {
        this.activeTabIndex = 0;
        const matched = this.myRequests.find(item => item.messageId === parsedId);
        if (matched) {
          this.selectedRequestId = matched.messageId;
          this.loadSelectedRequestDetails(matched.messageId);
        }
        return;
      }
    });

    this.subscriptions.add(routeSub);
  }

  private loadSelectedRequestDetails(messageId: number): void {
    this.loadingSelectedRequestDetails = true;
    this.selectedRequestDetailsError = '';
    let fallbackTriggered = false;
    this.dynamicFormController.getRequestById(messageId).subscribe({
      next: response => {
        if (response?.isSuccess && response.data) {
          this.selectedRequestDetails = this.normalizeLoadedRequestDetails(response.data, messageId);
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
    const destination = this.destinations.find(item => item.categoryId === categoryId);
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
    const signalSub = this.signalRService.Notification$.subscribe(notification => {
      const title = String((notification as unknown as { title?: string; Title?: string })?.title
        ?? (notification as unknown as { title?: string; Title?: string })?.Title
        ?? '');
      const body = String((notification as unknown as { notification?: string; Notification?: string })?.notification
        ?? (notification as unknown as { notification?: string; Notification?: string })?.Notification
        ?? '');
      const text = `${title} ${body}`.toLowerCase();

      const capacityPayload = extractCapacityPayloadFromSignal([body, title]);
      if (capacityPayload) {
        this.refreshCapacityFromSignal(capacityPayload);
      }

      if (text.includes('summer') || text.includes('booking') || text.includes('capacity') || text.includes('مصيف') || text.includes('حجز') || text.includes('إتاحة')) {
        this.loadMyRequests();
        this.loadTransferCapacity();
      }
    });

    this.subscriptions.add(signalSub);
  }

  private refreshCapacityFromSignal(payload: string): void {
    const parts = payload.split('|');
    if (parts.length < 3) {
      this.loadTransferCapacity();
      return;
    }

    const categoryId = Number(parts[1]);
    const waveCode = String(parts[2] ?? '').trim();
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

  private normalizeDynamicFieldKey(fieldKey: string): string {
    return String(fieldKey ?? '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }

  private isCompanionFieldKey(fieldKey: string): boolean {
    const normalized = this.normalizeDynamicFieldKey(fieldKey);
    return normalized.includes('familymembername')
      || normalized === 'familyrelation'
      || normalized.includes('familymembernationalid')
      || normalized.includes('familymemberage')
      || normalized.includes('companionname')
      || normalized === 'companionrelation'
      || normalized.includes('companionnationalid')
      || normalized.includes('companionage');
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

  private getNumberValue(control: AbstractControl | null): number {
    const raw = control?.value;
    const numeric = Number(raw);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  private buildSummaryFallbackDetailFields(
    request: SummerRequestSummaryDto | undefined
  ): Array<{ label: string; value: string; instanceGroupId: number }> {
    if (!request) {
      return [];
    }

    const rows: Array<{ label: string; value: string; instanceGroupId: number }> = [
      { label: 'رقم الطلب', value: toDisplayOrDash(request.requestRef), instanceGroupId: 1 },
      { label: 'المصيف', value: toDisplayOrDash(request.categoryName), instanceGroupId: 1 },
      { label: 'الفوج', value: toDisplayOrDash(request.waveCode), instanceGroupId: 1 },
      { label: 'الحالة', value: this.getRequestStatusLabel(request), instanceGroupId: 1 },
      { label: 'استحقاق السداد', value: this.formatUtcDate(request.paymentDueAtUtc), instanceGroupId: 1 },
      { label: 'تاريخ السداد', value: this.formatUtcDate(request.paidAtUtc), instanceGroupId: 1 }
    ];

    return rows.filter(row => String(row.value ?? '').trim().length > 0);
  }

  private parsePositiveInt(value: unknown): number | null {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return null;
    }
    return Math.floor(parsed);
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


