import { Component, OnDestroy, OnInit } from '@angular/core';
import { AbstractControl, FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { DynamicFormController } from 'src/app/shared/services/BackendServices/DynamicForm/DynamicForm.service';
import { MessageDto, TkmendField } from 'src/app/shared/services/BackendServices/DynamicForm/DynamicForm.dto';
import { FileParameter } from 'src/app/shared/services/BackendServices/dto-shared';
import { SummerWorkflowController } from 'src/app/shared/services/BackendServices/SummerWorkflow/SummerWorkflow.service';
import { AttachmentsController } from 'src/app/shared/services/BackendServices/Attachments/Attachments.service';
import {
  SummerRequestSummaryDto,
  SummerWaveCapacityDto,
  SummerWorkflowCommonResponse
} from 'src/app/shared/services/BackendServices/SummerWorkflow/SummerWorkflow.dto';
import { AttchedObjectService } from 'src/app/shared/services/helper/attched-object.service';
import { MsgsService } from 'src/app/shared/services/helper/msgs.service';
import { SpinnerService } from 'src/app/shared/services/helper/spinner.service';
import { AuthObjectsService } from 'src/app/shared/services/helper/auth-objects.service';
import { SignalRService } from 'src/app/shared/services/SignalRServices/SignalR.service';
import {
  SUMMER_DESTINATIONS_2026,
  SUMMER_PDF_REFERENCE_TITLE,
  SUMMER_SEASON_YEAR,
  SummerDestinationConfig,
  SummerWaveDefinition
} from './summer-requests-workspace.config';

@Component({
  selector: 'app-summer-requests-workspace',
  templateUrl: './summer-requests-workspace.component.html',
  styleUrls: ['./summer-requests-workspace.component.scss']
})
export class SummerRequestsWorkspaceComponent implements OnInit, OnDestroy {
  readonly seasonYear = SUMMER_SEASON_YEAR;
  readonly pdfReferenceTitle = SUMMER_PDF_REFERENCE_TITLE;
  readonly destinations = SUMMER_DESTINATIONS_2026;
  readonly relationOptions = ['زوج/زوجة', 'ابن', 'ابنة', 'أب', 'أم', 'أخ', 'أخت', 'أخرى'];
  private readonly allowedAttachmentExtensions = new Set(['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp']);
  private readonly fieldLabelMap: Record<string, string> = {
    RequestRef: 'مرجع الطلب',
    Subject: 'موضوع الطلب',
    Emp_Name: 'اسم الموظف',
    Emp_Id: 'رقم الملف',
    NationalId: 'الرقم القومي',
    PhoneNumber: 'رقم الهاتف',
    ExtraPhoneNumber: 'هاتف إضافي',
    SummerCamp: 'الفوج',
    SummerCampLabel: 'وصف الفوج',
    SummerSeasonYear: 'موسم الحجز',
    FamilyCount: 'عدد الأفراد',
    Over_Count: 'عدد الأفراد الإضافيين',
    SummerStayMode: 'نوع الحجز',
    SummerDestinationId: 'كود المصيف',
    SummerDestinationName: 'اسم المصيف',
    SummerProxyMode: 'تم التسجيل بالنيابة',
    Description: 'ملاحظات',
    FamilyMember_Name: 'اسم المرافق',
    FamilyRelation: 'درجة القرابة',
    FamilyMember_NationalId: 'الرقم القومي للمرافق',
    FamilyMember_Age: 'سن المرافق',
    Summer_PaymentDueAtUtc: 'موعد استحقاق السداد',
    Summer_PaymentStatus: 'حالة السداد',
    Summer_PaidAtUtc: 'تاريخ السداد',
    Summer_TransferCount: 'عدد مرات التحويل',
    Summer_TransferredAtUtc: 'وقت التحويل',
    Summer_TransferFromCategory: 'المصيف السابق',
    Summer_TransferFromWave: 'الفوج السابق',
    Summer_TransferToCategory: 'المصيف الحالي',
    Summer_TransferToWave: 'الفوج الحالي',
    Summer_CancelReason: 'سبب الاعتذار'
  };

  bookingForm: FormGroup;
  cancelForm: FormGroup;
  paymentForm: FormGroup;
  transferForm: FormGroup;

  identityAttachments: File[] = [];
  cancelAttachments: File[] = [];
  paymentAttachments: File[] = [];
  transferAttachments: File[] = [];

  myRequests: SummerRequestSummaryDto[] = [];
  selectedRequestId: number | null = null;
  selectedRequestDetails: MessageDto | null = null;
  loadingSelectedRequestDetails = false;
  seasonTransferAlreadyUsed = false;
  bookingCapacityLoading = false;
  transferCapacityLoading = false;
  bookingWaveCapacities: SummerWaveCapacityDto[] = [];
  transferWaveCapacities: SummerWaveCapacityDto[] = [];
  bookingValidationAlerts: string[] = [];

  loadingRequests = false;
  submittingBooking = false;
  submittingCancel = false;
  submittingPayment = false;
  submittingTransfer = false;

  private readonly subscriptions = new Subscription();
  private ownerProfileDefaults = {
    employeeName: '',
    employeeFileNumber: '',
    nationalId: '',
    phone: '',
    extraPhone: ''
  };

  constructor(
    private readonly fb: FormBuilder,
    private readonly dynamicFormController: DynamicFormController,
    private readonly summerWorkflowController: SummerWorkflowController,
    private readonly attachmentsController: AttachmentsController,
    private readonly attchedObjectService: AttchedObjectService,
    private readonly msg: MsgsService,
    private readonly spinner: SpinnerService,
    private readonly authObjectsService: AuthObjectsService,
    private readonly signalRService: SignalRService
  ) {
    this.bookingForm = this.fb.group({
      destinationId: [null, Validators.required],
      waveCode: ['', Validators.required],
      stayMode: ['', Validators.required],
      proxyMode: [false],
      employeeName: ['', [Validators.required, Validators.maxLength(120)]],
      employeeFileNumber: ['', [Validators.required, Validators.maxLength(50)]],
      nationalId: ['', [Validators.required, Validators.pattern(/^[0-9]{14}$/)]],
      phone: ['', [Validators.required, Validators.maxLength(30)]],
      extraPhone: ['', Validators.maxLength(30)],
      familyCount: [null, Validators.required],
      extraCount: [{ value: 0, disabled: true }, [Validators.min(0)]],
      notes: ['', Validators.maxLength(2000)],
      companions: this.fb.array([])
    });

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
    this.patchEmployeeFromProfile();
    const authSyncSubscription = this.authObjectsService.authObject$.subscribe(() => {
      const isProxyMode = Boolean(this.bookingForm.get('proxyMode')?.value);
      if (isProxyMode) {
        return;
      }

      const current = this.bookingForm.getRawValue();
      const hasNationalId = String(current.nationalId ?? '').trim().length > 0;
      const hasPhone = String(current.phone ?? '').trim().length > 0;
      if (hasNationalId && hasPhone) {
        return;
      }

      this.patchEmployeeFromProfile();
    });
    this.subscriptions.add(authSyncSubscription);
    this.bindBookingRules();
    this.bindTransferRules();
    this.bindSignalRRefresh();

    this.applyDestinationRules(this.getNumberValue(this.bookingForm.get('destinationId')));
    this.loadMyRequests();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  get companions(): FormArray {
    return this.bookingForm.get('companions') as FormArray;
  }

  get selectedDestination(): SummerDestinationConfig | undefined {
    const categoryId = this.getNumberValue(this.bookingForm.get('destinationId'));
    return this.destinations.find(item => item.categoryId === categoryId);
  }

  get selectedDestinationWaves(): SummerWaveDefinition[] {
    return this.selectedDestination?.waves ?? [];
  }

  get selectedRequest(): SummerRequestSummaryDto | undefined {
    if (!this.selectedRequestId) {
      return undefined;
    }
    return this.myRequests.find(item => item.messageId === this.selectedRequestId);
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

  get isSignalRConnected(): boolean {
    const state = String(this.signalRService.hubConnectionState ?? '').trim().toLowerCase();
    return state === 'online' || state === 'connection started';
  }

  get signalRStatusLabel(): string {
    return this.isSignalRConnected ? 'متصل بـ SignalR' : 'SignalR غير متصل';
  }

  get bookingCapacitySummary(): SummerWaveCapacityDto[] {
    return [...this.bookingWaveCapacities].sort((a, b) => a.familyCount - b.familyCount);
  }

  get transferCapacitySummary(): SummerWaveCapacityDto[] {
    return [...this.transferWaveCapacities].sort((a, b) => a.familyCount - b.familyCount);
  }

  get totalCompanions(): number {
    return this.companions.length;
  }

  get totalPassengers(): number {
    const family = this.getNumberValue(this.bookingForm.get('familyCount'));
    const extra = this.getNumberValue(this.bookingForm.get('extraCount'));
    return Math.max(0, family + extra);
  }

  get selectedRequestDetailFields(): Array<{ label: string; value: string; instanceGroupId: number }> {
    const fields = this.selectedRequestDetails?.fields ?? [];
    return fields
      .filter(field => (field.fildTxt ?? '').toString().trim().length > 0)
      .map(field => {
        const key = String(field.fildKind ?? '').trim();
        const label = this.resolveFieldLabel(key);
        const value = String(field.fildTxt ?? '').trim();
        const instanceGroupId = Number(field.instanceGroupId ?? 1) || 1;
        return { label, value, instanceGroupId };
      })
      .sort((a, b) => a.instanceGroupId - b.instanceGroupId || a.label.localeCompare(b.label));
  }

  get selectedRequestAttachments(): Array<{ id: number; name: string; size: number }> {
    const attachments = this.selectedRequestDetails?.attachments ?? [];
    return attachments
      .map(item => ({
        id: this.resolveAttachmentId(item),
        name: item.attchNm ?? '-',
        size: Number(item.attchSize ?? 0) || 0
      }))
      .filter(item => item.name.trim().length > 0);
  }

  get selectedRequestOwnerInfo(): { name: string; fileNumber: string; nationalId: string; phone: string; extraPhone: string } | null {
    if (!this.selectedRequestDetails && !this.selectedRequest) {
      return null;
    }

    const fields = this.selectedRequestDetails?.fields ?? [];
    const summary = this.selectedRequest;
    const ownerFields = fields.filter(field => {
      const groupId = Number(field.instanceGroupId ?? 1) || 1;
      return groupId === 1;
    });
    const sourceFields = ownerFields.length > 0 ? ownerFields : fields;

    const ownerName = this.coalesceText(
      this.getFieldValueByKeys(sourceFields, ['Emp_Name', 'EmployeeName', 'EmpName', 'Name', 'ArabicName', 'UserDisplayName', 'DisplayName']),
      summary?.employeeName,
      String(this.selectedRequestDetails?.createdBy ?? '').trim()
    );
    const fileNumber = this.coalesceText(
      this.getFieldValueByKeys(sourceFields, ['Emp_Id', 'EmployeeFileNumber', 'FileNumber', 'EmpId', 'EmployeeId', 'UserId']),
      summary?.employeeId
    );
    const nationalId = this.coalesceText(
      this.getFieldValueByKeys(sourceFields, [
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
    const phone = this.coalesceText(
      this.getFieldValueByKeys(sourceFields, [
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
    const extraPhone = this.coalesceText(
      this.getFieldValueByKeys(sourceFields, ['ExtraPhoneNumber', 'SecondaryPhone', 'AlternatePhone', 'PhoneSecondary', 'هاتف إضافي']),
      summary?.employeeExtraPhone
    );

    if (!ownerName && !fileNumber && !nationalId && !phone && !extraPhone) {
      return null;
    }

    return {
      name: this.toDisplayOrDash(ownerName),
      fileNumber: this.toDisplayOrDash(fileNumber),
      nationalId: this.toDisplayOrDash(nationalId),
      phone: this.toDisplayOrDash(phone),
      extraPhone: this.toDisplayOrDash(extraPhone)
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
      .map(reply => ({
        replyId: Number(reply.replyId ?? 0) || 0,
        message: String(reply.message ?? '').trim(),
        authorName: this.resolveReplyAuthorName(
          String(reply.authorName ?? '').trim(),
          String(reply.authorId ?? '').trim()
        ),
        createdDate: reply.createdDate as unknown as string,
        attachments: (reply.attchShipmentDtos ?? [])
          .map(item => ({
            id: this.resolveAttachmentId(item),
            name: item.attchNm ?? '-',
            size: Number(item.attchSize ?? 0) || 0
          }))
          .filter(item => item.name.trim().length > 0)
      }))
      .sort((a, b) => this.parseDateToEpoch(b.createdDate) - this.parseDateToEpoch(a.createdDate) || b.replyId - a.replyId);
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

        const errors = (response?.errors ?? [])
          .map(item => String(item?.message ?? '').trim())
          .filter(item => item.length > 0)
          .join('<br/>');
        this.msg.msgError('خطأ', `<h5>${errors || 'تعذر تنزيل المرفق.'}</h5>`, true);
      },
      error: () => {
        this.msg.msgError('خطأ', '<h5>تعذر تنزيل المرفق حالياً.</h5>', true);
      },
      complete: () => {
        this.spinner.hide();
      }
    });
  }

  private resolveReplyAuthorName(authorName: string, authorId: string): string {
    const cleanedName = authorName.trim();
    if (cleanedName.length > 0 && !this.isCorruptedText(cleanedName)) {
      return cleanedName;
    }

    const cleanedId = authorId.trim();
    if (cleanedId.length > 0 && !this.isCorruptedText(cleanedId)) {
      return cleanedId;
    }

    return 'غير محدد';
  }

  private isCorruptedText(value: string): boolean {
    const text = String(value ?? '').trim();
    if (!text) {
      return false;
    }

    const questionMarks = (text.match(/[\?\u061F]/g) ?? []).length;
    if (questionMarks > 0 && questionMarks >= Math.ceil(text.length * 0.35)) {
      return true;
    }

    const nonQuestionText = text.replace(/[\?\u061F\s]/g, '');
    if (!nonQuestionText.length) {
      return true;
    }

    return text.includes('�') || text.includes('Ø') || text.includes('Ù');
  }

  destinationTrackBy(_index: number, destination: SummerDestinationConfig): number {
    return destination.categoryId;
  }

  requestTrackBy(_index: number, request: SummerRequestSummaryDto): number {
    return request.messageId;
  }

  isControlRequired(form: FormGroup, controlName: string): boolean {
    const control = form.get(controlName);
    if (!control || typeof control.hasValidator !== 'function') {
      return false;
    }
    return control.hasValidator(Validators.required);
  }

  isControlInvalid(form: FormGroup, controlName: string): boolean {
    const control = form.get(controlName);
    if (!control || control.disabled) {
      return false;
    }
    return control.invalid && (control.touched || control.dirty);
  }

  getControlErrorText(form: FormGroup, controlName: string, label: string): string {
    const control = form.get(controlName);
    if (!control || !control.errors || control.disabled) {
      return '';
    }
    return this.controlErrorsToMessages(label, control.errors)[0] ?? '';
  }

  isCompanionAgeRequired(index: number): boolean {
    const group = this.companions.at(index) as FormGroup | undefined;
    if (!group) {
      return false;
    }
    const relation = String(group.get('relation')?.value ?? '').trim();
    return relation === 'ابن' || relation === 'ابنة';
  }

  isCompanionControlInvalid(index: number, controlName: string): boolean {
    const group = this.companions.at(index) as FormGroup | undefined;
    const control = group?.get(controlName);
    if (!control || control.disabled) {
      return false;
    }
    return control.invalid && (control.touched || control.dirty);
  }

  getCompanionControlErrorText(index: number, controlName: string, label: string): string {
    const group = this.companions.at(index) as FormGroup | undefined;
    const control = group?.get(controlName);
    if (!control || !control.errors || control.disabled) {
      return '';
    }
    return this.controlErrorsToMessages(label, control.errors)[0] ?? '';
  }

  addFiles(event: Event, bucket: 'identity' | 'cancel' | 'payment' | 'transfer'): void {
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

    if (!validFiles.length) {
      if (input) {
        input.value = '';
      }
      return;
    }

    if (bucket === 'identity') {
      this.identityAttachments = [...this.identityAttachments, ...validFiles];
    } else if (bucket === 'cancel') {
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

  removeFile(bucket: 'identity' | 'cancel' | 'payment' | 'transfer', index: number): void {
    if (bucket === 'identity') {
      this.identityAttachments = this.identityAttachments.filter((_, current) => current !== index);
    } else if (bucket === 'cancel') {
      this.cancelAttachments = this.cancelAttachments.filter((_, current) => current !== index);
    } else if (bucket === 'payment') {
      this.paymentAttachments = this.paymentAttachments.filter((_, current) => current !== index);
    } else {
      this.transferAttachments = this.transferAttachments.filter((_, current) => current !== index);
    }
  }

  submitBooking(): void {
    this.bookingValidationAlerts = [];
    this.bookingForm.markAllAsTouched();
    if (this.bookingForm.invalid) {
      this.bookingValidationAlerts = this.buildBookingValidationAlerts();
      this.msg.msgError('خطأ', '<h5>يرجى استكمال بيانات الحجز المطلوبة بشكل صحيح.</h5>', true);
      return;
    }

    const validationError = this.validateBookingBusinessRules();
    if (validationError) {
      this.bookingValidationAlerts = [validationError];
      this.msg.msgError('خطأ', `<h5>${validationError}</h5>`, true);
      return;
    }

    const destination = this.selectedDestination;
    if (!destination) {
      this.msg.msgError('خطأ', '<h5>يرجى اختيار المصيف.</h5>', true);
      return;
    }

    const waveCode = String(this.bookingForm.get('waveCode')?.value ?? '').trim();
    const waveLabel = this.selectedDestinationWaves.find(item => item.code === waveCode)?.startsAtLabel ?? waveCode;
    const bookingRawValue = this.bookingForm.getRawValue();
    const employeeFileNumber = String(bookingRawValue.employeeFileNumber ?? '').trim();
    const requestRefSeed = `SUMMER-${destination.slug}-${employeeFileNumber || 'EMP'}-${waveCode}`;
    const subject = `طلب حجز ${destination.name} - ${waveCode}`;
    const description = String(this.bookingForm.get('notes')?.value ?? '').trim();
    const createdBy = this.authObjectsService.returnCurrentUser() || localStorage.getItem('UserId') || '';

    const requestFields = this.buildCreateRequestFields(destination, waveCode, waveLabel);
    const unitIds = this.resolveUnitIds();

    this.submittingBooking = true;
    this.spinner.show('جاري تسجيل طلب المصيف ...');
    this.dynamicFormController.createRequest(
      0,
      requestRefSeed,
      subject,
      description,
      createdBy,
      '',
      unitIds,
      '',
      0,
      destination.categoryId,
      requestFields,
      this.toFileParameters(this.identityAttachments)
    ).subscribe({
      next: response => {
        if (response?.isSuccess) {
          this.msg.msgSuccess('تم تسجيل طلب المصيف بنجاح');
          this.identityAttachments = [];
          this.bookingValidationAlerts = [];
          this.resetBookingForNextRequest();
          this.loadMyRequests();
        } else {
          const errors = this.collectErrors(response);
          this.msg.msgError('خطأ', `<h5>${errors}</h5>`, true);
        }
      },
      error: () => {
        this.spinner.hide();
        this.submittingBooking = false;
        this.msg.msgError('خطأ', '<h5>تعذر تسجيل طلب المصيف حالياً.</h5>', true);
      },
      complete: () => {
        this.spinner.hide();
        this.submittingBooking = false;
      }
    });
  }

  submitCancel(): void {
    this.cancelForm.markAllAsTouched();
    if (!this.selectedRequestId) {
      this.msg.msgError('خطأ', '<h5>يرجى اختيار الطلب أولاً.</h5>', true);
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
        } else {
          this.msg.msgError('خطأ', `<h5>${this.collectErrors(response)}</h5>`, true);
        }
      },
      error: () => {
        this.msg.msgError('خطأ', '<h5>تعذر تنفيذ الاعتذار حالياً.</h5>', true);
      },
      complete: () => {
        this.submittingCancel = false;
      }
    });
  }

  submitPayment(): void {
    this.paymentForm.markAllAsTouched();
    if (this.paymentForm.invalid) {
      this.msg.msgError('خطأ', '<h5>يرجى إدخال تاريخ ووقت السداد.</h5>', true);
      return;
    }

    if (!this.selectedRequestId) {
      this.msg.msgError('خطأ', '<h5>يرجى اختيار الطلب أولاً.</h5>', true);
      return;
    }

    if (this.paymentAttachments.length === 0) {
      this.msg.msgError('خطأ', '<h5>يجب إرفاق مستند واحد على الأقل قبل تسجيل السداد.</h5>', true);
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
        } else {
          this.msg.msgError('خطأ', `<h5>${this.collectErrors(response)}</h5>`, true);
        }
      },
      error: () => {
        this.msg.msgError('خطأ', '<h5>تعذر تسجيل السداد حالياً.</h5>', true);
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
      this.msg.msgError('خطأ', '<h5>يرجى اختيار الطلب أولاً.</h5>', true);
      return;
    }

    if (this.seasonTransferAlreadyUsed) {
      this.msg.msgError('خطأ', '<h5>تم استخدام التحويل بالفعل خلال هذا الموسم، والتحويل مسموح مرة واحدة فقط.</h5>', true);
      return;
    }

    const targetDestination = this.transferDestination;
    if (!targetDestination) {
      this.msg.msgError('خطأ', '<h5>المصيف المستهدف غير صالح.</h5>', true);
      return;
    }

    const newFamilyCount = this.getNumberValue(this.transferForm.get('newFamilyCount'));
    const maxFamilyOption = Math.max(...targetDestination.familyOptions);
    const newExtraCount = this.getNumberValue(this.transferForm.get('newExtraCount'));

    if (newFamilyCount !== maxFamilyOption && newExtraCount > 0) {
      this.msg.msgError('خطأ', '<h5>الإضافة فوق السعة متاحة فقط عند اختيار أكبر شقة في المصيف.</h5>', true);
      return;
    }

    const transferCapacity = this.getTransferCapacityByFamily(newFamilyCount);
    if (transferCapacity && transferCapacity.availableUnits <= 0) {
      this.msg.msgError('خطأ', '<h5>لا توجد وحدات متاحة حالياً للعدد المختار في الفوج المستهدف.</h5>', true);
      return;
    }

    this.submittingTransfer = true;
    this.summerWorkflowController.transfer({
      messageId: this.selectedRequestId,
      toCategoryId: targetDestination.categoryId,
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
        } else {
          this.msg.msgError('خطأ', `<h5>${this.collectErrors(response)}</h5>`, true);
        }
      },
      error: () => {
        this.msg.msgError('خطأ', '<h5>تعذر تنفيذ التحويل حالياً.</h5>', true);
      },
      complete: () => {
        this.submittingTransfer = false;
      }
    });
  }

  selectRequest(messageId: number): void {
    this.selectedRequestId = messageId;
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

  private loadSelectedRequestDetails(messageId: number): void {
    this.loadingSelectedRequestDetails = true;
    this.dynamicFormController.getRequestById(messageId).subscribe({
      next: response => {
        if (response?.isSuccess && response.data) {
          this.selectedRequestDetails = response.data;
        } else {
          this.selectedRequestDetails = null;
        }
      },
      error: () => {
        this.selectedRequestDetails = null;
      },
      complete: () => {
        this.loadingSelectedRequestDetails = false;
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
          if (this.selectedRequestId && !this.myRequests.some(item => item.messageId === this.selectedRequestId)) {
            this.selectedRequestId = null;
            this.selectedRequestDetails = null;
          } else if (this.selectedRequestId) {
            this.loadSelectedRequestDetails(this.selectedRequestId);
          }
        } else {
          this.myRequests = [];
          this.selectedRequestId = null;
          this.selectedRequestDetails = null;
          this.seasonTransferAlreadyUsed = false;
        }
      },
      error: () => {
        this.myRequests = [];
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
    if (!value) {
      return '-';
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return value;
    }

    const parts = new Intl.DateTimeFormat('en-GB', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hour12: false,
      timeZone: 'Africa/Cairo'
    }).formatToParts(parsed);

    const day = this.getDatePart(parts, 'day');
    const month = this.getDatePart(parts, 'month');
    const year = this.getDatePart(parts, 'year');
    const hour = this.getDatePart(parts, 'hour');

    if (!day || !month || !year || !hour) {
      return value;
    }

    return `${day}/${month}/${year} ${hour}:00`;
  }

  formatFileSize(bytes: number): string {
    if (!bytes || bytes <= 0) {
      return '0 B';
    }
    const units = ['B', 'KB', 'MB', 'GB'];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / Math.pow(1024, index);
    return `${value.toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
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
    const status = (request.status || '').toLowerCase();
    if (status.includes('rejected') || status.includes('مرفوض') || status.includes('رفض')) {
      return 'status-bad';
    }
    if (status.includes('جاري') || status.includes('inprogress') || status.includes('processing')) {
      return 'status-mid';
    }
    if (status.includes('تم') || status.includes('done') || status.includes('closed')) {
      return 'status-good';
    }
    return 'status-neutral';
  }

  getStatusLabel(status: string | undefined): string {
    const normalized = (status ?? '').toLowerCase();
    if (normalized.includes('rejected') || normalized.includes('مرفوض') || normalized.includes('رفض')) {
      return 'مرفوض';
    }
    if (normalized.includes('inprogress') || normalized.includes('processing') || normalized.includes('جاري')) {
      return 'جاري التنفيذ';
    }
    if (normalized.includes('closed') || normalized.includes('done') || normalized.includes('تم') || normalized.includes('رد')) {
      return 'تم';
    }
    if (normalized.includes('new') || normalized.includes('جديد')) {
      return 'جديد';
    }
    return status?.trim() || 'غير محدد';
  }

  isCancelBlockedByWindow(): boolean {
    const info = this.getCancelWindowInfo();
    return Boolean(info?.blocked);
  }

  getCancelWindowNote(): string {
    const info = this.getCancelWindowInfo();
    if (!info) {
      return 'قواعد الاعتذار: لا يمكن الاعتذار قبل موعد الفوج بأقل من 14 يوم.';
    }

    const lockDateText = this.formatLocalDateHour(info.lastAllowedDate);
    if (info.blocked) {
      return `انتهت مهلة الاعتذار لهذا الفوج. آخر موعد كان ${lockDateText}.`;
    }

    return `آخر موعد متاح للاعتذار لهذا الفوج هو ${lockDateText}.`;
  }

  private applyOwnerEditMode(proxyMode: boolean): void {
    const ownerControls = ['employeeName', 'employeeFileNumber', 'nationalId', 'phone', 'extraPhone'];
    if (proxyMode) {
      ownerControls.forEach(name => this.bookingForm.get(name)?.enable({ emitEvent: false }));
      return;
    }

    this.bookingForm.patchValue(this.ownerProfileDefaults, { emitEvent: false });
    ownerControls.forEach(name => this.bookingForm.get(name)?.disable({ emitEvent: false }));
  }

  private patchEmployeeFromProfile(): void {
    const profile: Record<string, unknown> = this.authObjectsService.getUserProfile() as Record<string, unknown>;
    const authObject = this.asRecord(this.authObjectsService.getAuthObject());
    const exchangeUserInfo = this.asRecord(authObject['exchangeUserInfo']);
    const emailData = this.asRecord(profile['emailData']);
    const tokenClaims = this.getTokenClaims();
    const authObjectFromStorage = this.getAuthObjectFromLocalStorage();
    const authObjectExchangeFromStorage = this.asRecord(authObjectFromStorage['exchangeUserInfo']);
    const sources = [
      profile,
      emailData,
      tokenClaims,
      exchangeUserInfo,
      authObject,
      authObjectExchangeFromStorage,
      authObjectFromStorage
    ];

    const nationalIdKeys = [
      'nationalId', 'NationalId', 'NationalID', 'NATIONAL_ID', 'NATIONALID', 'national_id',
      'nationalid', 'nid', 'NID', 'IDNumber', 'NationalNo', 'nationalNo', 'National_No',
      'IdentityNo', 'IdentityNumber', 'IdNo'
    ];

    const phoneKeys = [
      'MobileNumber', 'mobileNumber', 'MobilePhone', 'mobilePhone', 'PhoneWhats', 'PhoneNumber',
      'phoneNumber', 'phone_number', 'phone', 'phoneNo', 'Phone_No', 'mobile_number', 'mobile',
      'Telephone', 'tel', 'TelNo', 'MobileNo', 'whatsapp', 'WhatsApp', 'WhatsAppNumber',
      'Phone1', 'phone1'
    ];

    const extraPhoneKeys = [
      'ExtraPhoneNumber', 'extraPhoneNumber', 'SecondaryPhone', 'AlternatePhone',
      'PhoneSecondary', 'PhoneWhats', 'WhatsAppNumber'
    ];

    const employeeName = this.pickFirstStringFromSources(
      sources,
      ['ArabicName', 'userDisplayName', 'displayName', 'name', 'given_name', 'preferred_username', 'UserDisplayName']
    ) || localStorage.getItem('firstName') || '';

    const employeeFileNumber = this.pickFirstStringFromSources(
      sources,
      ['userId', 'UserId', 'userid', 'empId', 'EmpId', 'Emp_Id', 'EmployeeId', 'FileNumber']
    ) || this.pickFirstFromLocalStorage(['UserId', 'userId', 'EMP_ID']) || '';

    const nationalId = this.pickFirstStringFromSources(
      sources, nationalIdKeys
    ) || this.pickFirstStringFromNestedSources(
      sources, nationalIdKeys
    ) || this.pickFirstFromLocalStorage([
      'NationalId', 'nationalId', 'NATIONAL_ID', 'NATIONALID', 'NID', 'IDNumber', 'NationalNo'
    ]) || '';

    const phone = this.pickFirstStringFromSources(
      sources, phoneKeys
    ) || this.pickFirstStringFromNestedSources(
      sources, phoneKeys
    ) || this.pickFirstFromLocalStorage([
      'MobileNumber', 'mobileNumber', 'mobilePhone', 'PhoneWhats', 'PhoneNumber',
      'phone', 'phoneNo', 'Phone_No', 'MobileNo'
    ]) || '';

    const extraPhone = this.pickFirstStringFromSources(
      sources, extraPhoneKeys
    ) || this.pickFirstStringFromNestedSources(
      sources, extraPhoneKeys
    ) || this.pickFirstFromLocalStorage([
      'ExtraPhoneNumber', 'extraPhoneNumber', 'SecondaryPhone', 'AlternatePhone'
    ]) || '';

    this.ownerProfileDefaults = {
      employeeName,
      employeeFileNumber,
      nationalId: this.normalizeDigits(nationalId),
      phone: this.normalizeDigits(phone),
      extraPhone: this.normalizeDigits(extraPhone)
    };

    this.bookingForm.patchValue(this.ownerProfileDefaults, { emitEvent: false });
    this.applyOwnerEditMode(Boolean(this.bookingForm.get('proxyMode')?.value));
  }

  private bindBookingRules(): void {
    const proxyModeSubscription = this.bookingForm.get('proxyMode')?.valueChanges.subscribe(value => {
      this.applyOwnerEditMode(Boolean(value));
    });
    if (proxyModeSubscription) {
      this.subscriptions.add(proxyModeSubscription);
    }

    const destinationSubscription = this.bookingForm.get('destinationId')?.valueChanges.subscribe(value => {
      this.applyDestinationRules(Number(value));
      this.loadBookingCapacity();
    });
    if (destinationSubscription) {
      this.subscriptions.add(destinationSubscription);
    }

    const waveSubscription = this.bookingForm.get('waveCode')?.valueChanges.subscribe(() => {
      this.loadBookingCapacity();
    });
    if (waveSubscription) {
      this.subscriptions.add(waveSubscription);
    }

    const familyCountSubscription = this.bookingForm.get('familyCount')?.valueChanges.subscribe(() => {
      this.applyExtraMemberRulesForBooking();
      this.syncCompanionsCount();
    });
    if (familyCountSubscription) {
      this.subscriptions.add(familyCountSubscription);
    }

    const extraCountSubscription = this.bookingForm.get('extraCount')?.valueChanges.subscribe(() => {
      this.syncCompanionsCount();
    });
    if (extraCountSubscription) {
      this.subscriptions.add(extraCountSubscription);
    }
  }

  private bindTransferRules(): void {
    const transferDestinationSubscription = this.transferForm.get('toCategoryId')?.valueChanges.subscribe(value => {
      this.applyTransferRules(Number(value));
      this.loadTransferCapacity();
    });
    if (transferDestinationSubscription) {
      this.subscriptions.add(transferDestinationSubscription);
    }

    const transferWaveSubscription = this.transferForm.get('toWaveCode')?.valueChanges.subscribe(() => {
      this.loadTransferCapacity();
    });
    if (transferWaveSubscription) {
      this.subscriptions.add(transferWaveSubscription);
    }

    const transferFamilySubscription = this.transferForm.get('newFamilyCount')?.valueChanges.subscribe(() => {
      this.applyTransferExtraRules();
    });
    if (transferFamilySubscription) {
      this.subscriptions.add(transferFamilySubscription);
    }
  }

  private bindSignalRRefresh(): void {
    const signalSubscription = this.signalRService.Notification$.subscribe(notification => {
      const title = String((notification as unknown as { title?: string; Title?: string })?.title
        ?? (notification as unknown as { title?: string; Title?: string })?.Title
        ?? '');
      const body = String((notification as unknown as { notification?: string; Notification?: string })?.notification
        ?? (notification as unknown as { notification?: string; Notification?: string })?.Notification
        ?? '');
      const text = `${title} ${body}`.toLowerCase();

      const capacityPayload = this.extractCapacityPayload([body, title]);
      if (capacityPayload) {
        this.refreshCapacityFromSignal(capacityPayload);
      }

      if (text.includes('summer') || text.includes('booking') || text.includes('capacity') || text.includes('مصيف') || text.includes('حجز')) {
        this.loadMyRequests();
        this.loadBookingCapacity();
        this.loadTransferCapacity();
      }
    });
    this.subscriptions.add(signalSubscription);
  }

  private extractCapacityPayload(texts: string[]): string | null {
    const marker = 'SUMMER_CAPACITY_UPDATED|';
    for (const item of texts) {
      const text = String(item ?? '').trim();
      if (!text) {
        continue;
      }

      const upper = text.toUpperCase();
      const index = upper.indexOf(marker);
      if (index < 0) {
        continue;
      }

      return text.substring(index).trim();
    }
    return null;
  }

  private applyDestinationRules(categoryId: number): void {
    const destination = this.destinations.find(item => item.categoryId === categoryId);
    if (!destination) {
      this.bookingWaveCapacities = [];
      this.bookingForm.patchValue(
        {
          waveCode: '',
          stayMode: '',
          familyCount: null,
          extraCount: 0
        },
        { emitEvent: false }
      );
      this.applyExtraMemberRulesForBooking();
      this.syncCompanionsCount();
      return;
    }

    const currentWaveCode = String(this.bookingForm.get('waveCode')?.value ?? '').trim();
    if (!destination.waves.some(wave => wave.code === currentWaveCode)) {
      this.bookingForm.patchValue({ waveCode: '' }, { emitEvent: false });
    }

    const currentStayMode = String(this.bookingForm.get('stayMode')?.value ?? '').trim();
    if (!destination.stayModes.some(mode => mode.code === currentStayMode)) {
      this.bookingForm.patchValue({ stayMode: '' }, { emitEvent: false });
    }

    const currentFamilyCount = this.getNumberValue(this.bookingForm.get('familyCount'));
    if (!destination.familyOptions.includes(currentFamilyCount)) {
      this.bookingForm.patchValue({ familyCount: null }, { emitEvent: false });
    }

    this.applyExtraMemberRulesForBooking();
    this.syncCompanionsCount();
    this.loadBookingCapacity();
  }

  private applyExtraMemberRulesForBooking(): void {
    const destination = this.selectedDestination;
    const familyCount = this.getNumberValue(this.bookingForm.get('familyCount'));
    const extraControl = this.bookingForm.get('extraCount');
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

    const maxFamilyOption = Math.max(...destination.familyOptions);
    const allowExtra = familyCount === maxFamilyOption;

    extraControl.setValidators([Validators.min(0), Validators.max(destination.maxExtraMembers)]);
    if (allowExtra) {
      extraControl.enable({ emitEvent: false });
    } else {
      extraControl.setValue(0, { emitEvent: false });
      extraControl.disable({ emitEvent: false });
    }
    extraControl.updateValueAndValidity({ emitEvent: false });
  }

  private syncCompanionsCount(): void {
    const familyCount = this.getNumberValue(this.bookingForm.get('familyCount'));
    const extraCount = this.getNumberValue(this.bookingForm.get('extraCount'));
    const targetCompanions = Math.max(0, familyCount + extraCount - 1);

    while (this.companions.length < targetCompanions) {
      this.companions.push(this.createCompanionGroup());
    }
    while (this.companions.length > targetCompanions) {
      this.companions.removeAt(this.companions.length - 1);
    }
  }

  private createCompanionGroup(): FormGroup {
    const group = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(120)]],
      relation: ['', Validators.required],
      nationalId: ['', [Validators.required, Validators.pattern(/^[0-9]{14}$/)]],
      age: [null]
    });

    const relationControl = group.get('relation');
    const relationSub = relationControl?.valueChanges.subscribe(value => {
      const normalized = String(value ?? '').trim();
      const ageControl = group.get('age');
      if (!ageControl) {
        return;
      }

      if (normalized === 'ابن' || normalized === 'ابنة') {
        ageControl.setValidators([Validators.required, Validators.min(0), Validators.max(21)]);
      } else {
        ageControl.setValue(null, { emitEvent: false });
        ageControl.clearValidators();
      }
      ageControl.updateValueAndValidity({ emitEvent: false });
    });

    if (relationSub) {
      this.subscriptions.add(relationSub);
    }

    return group;
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
    const maxFamilyOption = Math.max(...destination.familyOptions);
    const allowExtra = familyCount === maxFamilyOption;

    extraControl.setValidators([Validators.min(0), Validators.max(destination.maxExtraMembers)]);

    if (allowExtra) {
      extraControl.enable({ emitEvent: false });
    } else {
      extraControl.setValue(0, { emitEvent: false });
      extraControl.disable({ emitEvent: false });
    }
    extraControl.updateValueAndValidity({ emitEvent: false });
  }

  private validateBookingBusinessRules(): string | null {
    const destination = this.selectedDestination;
    if (!destination) {
      return 'يرجى اختيار المصيف.';
    }

    const bookingRaw = this.bookingForm.getRawValue();
    const employeeName = String(bookingRaw.employeeName ?? '').trim();
    const employeeFileNumber = String(bookingRaw.employeeFileNumber ?? '').trim();
    const nationalId = String(bookingRaw.nationalId ?? '').trim();
    const phone = String(bookingRaw.phone ?? '').trim();

    if (!employeeName || !employeeFileNumber || !nationalId || !phone) {
      return 'بيانات صاحب الطلب الأساسية مطلوبة (الاسم، رقم الملف، الرقم القومي، الهاتف).';
    }

    if (!/^[0-9]{14}$/.test(nationalId)) {
      return 'الرقم القومي يجب أن يتكون من 14 رقمًا.';
    }

    const familyCount = this.getNumberValue(this.bookingForm.get('familyCount'));
    const extraCount = this.getNumberValue(this.bookingForm.get('extraCount'));
    const maxFamily = Math.max(...destination.familyOptions);

    if (!destination.familyOptions.includes(familyCount)) {
      return `عدد الأفراد غير متاح في ${destination.name}.`;
    }

    const selectedCapacity = this.getBookingCapacityByFamily(familyCount);
    if (selectedCapacity && selectedCapacity.availableUnits <= 0) {
      return 'لا توجد وحدات متاحة حالياً للعدد المختار في الفوج المحدد.';
    }

    if (familyCount !== maxFamily && extraCount > 0) {
      return 'الإضافة فوق السعة متاحة فقط عند اختيار أكبر شقة في المصيف.';
    }

    if (extraCount > destination.maxExtraMembers) {
      return `الحد الأقصى للأفراد الإضافيين في ${destination.name} هو ${destination.maxExtraMembers}.`;
    }

    const waveCode = String(this.bookingForm.get('waveCode')?.value ?? '').trim();
    const hasDuplicateActive = this.myRequests.some(request =>
      request.categoryId === destination.categoryId
      && request.waveCode === waveCode
      && !this.isRejectedStatus(request.status)
    );
    if (hasDuplicateActive) {
      return 'لا يمكن الحجز لنفس الموظف في نفس المصيف ونفس الفوج أكثر من مرة.';
    }

    for (let i = 0; i < this.companions.length; i += 1) {
      const companionGroup = this.companions.at(i) as FormGroup;
      const relation = String(companionGroup.get('relation')?.value ?? '').trim();
      const age = companionGroup.get('age')?.value;
      if ((relation === 'ابن' || relation === 'ابنة') && (age === null || age === undefined || age === '')) {
        return `يرجى إدخال سن المرافق رقم ${i + 1} لأنه طفل.`;
      }
    }

    return null;
  }

  private resetBookingForNextRequest(): void {
    this.bookingForm.patchValue({
      destinationId: null,
      waveCode: '',
      stayMode: '',
      notes: '',
      familyCount: null,
      extraCount: 0,
      proxyMode: false
    }, { emitEvent: false });

    this.identityAttachments = [];
    while (this.companions.length > 0) {
      this.companions.removeAt(this.companions.length - 1);
    }

    this.patchEmployeeFromProfile();
    this.applyExtraMemberRulesForBooking();
    this.syncCompanionsCount();
  }

  private buildCreateRequestFields(destination: SummerDestinationConfig, waveCode: string, waveLabel: string): TkmendField[] {
    const fields: TkmendField[] = [];
    let fieldSql = 1;

    const pushField = (kind: string, value: string, instanceGroupId: number = 1): void => {
      fields.push({
        fildSql: fieldSql,
        fildRelted: 0,
        fildKind: kind,
        fildTxt: value,
        instanceGroupId,
        mendSql: 0,
        mendCategory: destination.categoryId,
        mendStat: false,
        mendGroup: 0,
        applicationId: '',
        groupName: '',
        isExtendable: false,
        groupWithInRow: 0
      });
      fieldSql += 1;
    };

    const subject = `طلب حجز ${destination.name} - ${waveCode}`;
    const requestRefBase = `SUMMER-${destination.slug}-${Date.now()}`;

    const raw = this.bookingForm.getRawValue();
    const employeeName = String(raw.employeeName ?? '').trim();
    const employeeFileNumber = String(raw.employeeFileNumber ?? '').trim();
    const nationalId = String(raw.nationalId ?? '').trim();
    const phone = String(raw.phone ?? '').trim();
    const extraPhone = String(raw.extraPhone ?? '').trim();
    const notes = String(raw.notes ?? '').trim();
    const stayMode = String(raw.stayMode ?? '').trim();
    const familyCount = Number(raw.familyCount ?? 0) || 0;
    const extraCount = Number(raw.extraCount ?? 0) || 0;
    const proxyMode = Boolean(raw.proxyMode);

    pushField('RequestRef', requestRefBase);
    pushField('Subject', subject);
    pushField('Emp_Name', employeeName);
    pushField('Emp_Id', employeeFileNumber);
    pushField('NationalId', nationalId);
    pushField('PhoneNumber', phone);
    pushField('ExtraPhoneNumber', extraPhone);
    pushField('SummerCamp', waveCode);
    pushField('SummerCampLabel', waveLabel);
    pushField('SummerSeasonYear', String(this.seasonYear));
    pushField('FamilyCount', String(familyCount));
    pushField('Over_Count', String(extraCount));
    pushField('SummerStayMode', stayMode);
    pushField('SummerDestinationId', String(destination.categoryId));
    pushField('SummerDestinationName', destination.name);
    pushField('SummerProxyMode', proxyMode ? '1' : '0');
    pushField('Description', notes);

    this.companions.controls.forEach((control: AbstractControl, index: number) => {
      const companion = control as FormGroup;
      const instanceGroupId = index + 1;
      pushField('FamilyMember_Name', String(companion.get('name')?.value ?? '').trim(), instanceGroupId);
      pushField('FamilyRelation', String(companion.get('relation')?.value ?? '').trim(), instanceGroupId);
      pushField('FamilyMember_NationalId', String(companion.get('nationalId')?.value ?? '').trim(), instanceGroupId);

      const ageValue = companion.get('age')?.value;
      if (ageValue !== null && ageValue !== undefined && ageValue !== '') {
        pushField('FamilyMember_Age', String(ageValue), instanceGroupId);
      }
    });

    return fields;
  }

  private resolveUnitIds(): number[] {
    const profile: Record<string, unknown> = this.authObjectsService.getUserProfile() as Record<string, unknown>;
    const units = profile['vwOrgUnitsWithCounts'];
    if (!Array.isArray(units) || !units.length) {
      return [0];
    }

    const extractedIds = units
      .map(item => {
        if (item && typeof item === 'object' && 'unitId' in item) {
          const value = (item as { unitId?: unknown }).unitId;
          const numeric = Number(value);
          return Number.isFinite(numeric) ? numeric : null;
        }
        return null;
      })
      .filter((value): value is number => value !== null);

    return extractedIds.length ? extractedIds : [0];
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
      .map(error => (error?.message ?? '').trim())
      .filter(message => message.length > 0);

    return errors.length ? errors.join('<br/>') : 'حدث خطأ غير متوقع.';
  }

  private loadBookingCapacity(): void {
    const destination = this.selectedDestination;
    const waveCode = String(this.bookingForm.get('waveCode')?.value ?? '').trim();
    if (!destination || !waveCode) {
      this.bookingWaveCapacities = [];
      return;
    }

    this.bookingCapacityLoading = true;
    this.summerWorkflowController.getWaveCapacity(destination.categoryId, waveCode).subscribe({
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

  private refreshCapacityFromSignal(payload: string): void {
    const parts = payload.split('|');
    if (parts.length < 3) {
      this.loadBookingCapacity();
      this.loadTransferCapacity();
      return;
    }

    const categoryId = Number(parts[1]);
    const waveCode = String(parts[2] ?? '').trim();
    const bookingCategory = this.selectedDestination?.categoryId ?? 0;
    const bookingWave = String(this.bookingForm.get('waveCode')?.value ?? '').trim();
    const transferCategory = this.transferDestination?.categoryId ?? 0;
    const transferWave = String(this.transferForm.get('toWaveCode')?.value ?? '').trim();

    if (categoryId === bookingCategory && waveCode === bookingWave) {
      this.loadBookingCapacity();
    }

    if (categoryId === transferCategory && waveCode === transferWave) {
      this.loadTransferCapacity();
    }
  }

  getBookingCapacityByFamily(familyCount: number): SummerWaveCapacityDto | undefined {
    return this.bookingWaveCapacities.find(item => item.familyCount === familyCount);
  }

  getTransferCapacityByFamily(familyCount: number): SummerWaveCapacityDto | undefined {
    return this.transferWaveCapacities.find(item => item.familyCount === familyCount);
  }

  getBookingFamilyOptionLabel(familyCount: number): string {
    const capacity = this.getBookingCapacityByFamily(familyCount);
    if (!capacity) {
      return `${familyCount}`;
    }

    return `${familyCount} (المتاح ${Math.max(0, capacity.availableUnits)} من ${capacity.totalUnits})`;
  }

  getTransferFamilyOptionLabel(familyCount: number): string {
    const capacity = this.getTransferCapacityByFamily(familyCount);
    if (!capacity) {
      return `${familyCount}`;
    }

    return `${familyCount} (المتاح ${Math.max(0, capacity.availableUnits)} من ${capacity.totalUnits})`;
  }

  isBookingFamilyOptionDisabled(familyCount: number): boolean {
    const selected = this.getNumberValue(this.bookingForm.get('familyCount'));
    const capacity = this.getBookingCapacityByFamily(familyCount);
    if (!capacity) {
      return false;
    }

    return familyCount !== selected && capacity.availableUnits <= 0;
  }

  isTransferFamilyOptionDisabled(familyCount: number): boolean {
    const selected = this.getNumberValue(this.transferForm.get('newFamilyCount'));
    const capacity = this.getTransferCapacityByFamily(familyCount);
    if (!capacity) {
      return false;
    }

    return familyCount !== selected && capacity.availableUnits <= 0;
  }

  private buildBookingValidationAlerts(): string[] {
    const alerts: string[] = [];
    const labels: Record<string, string> = {
      destinationId: 'المصيف',
      waveCode: 'الفوج',
      stayMode: 'نوع الحجز',
      employeeName: 'اسم الموظف',
      employeeFileNumber: 'رقم الملف',
      nationalId: 'الرقم القومي',
      phone: 'رقم الهاتف',
      extraPhone: 'الهاتف الإضافي',
      familyCount: 'عدد الأفراد',
      extraCount: 'عدد الأفراد الإضافيين',
      notes: 'الملاحظات'
    };

    Object.keys(this.bookingForm.controls).forEach(controlName => {
      const control = this.bookingForm.get(controlName);
      if (!control || !control.errors) {
        return;
      }

      const label = labels[controlName] ?? controlName;
      alerts.push(...this.controlErrorsToMessages(label, control.errors));
    });

    this.companions.controls.forEach((control, index) => {
      const group = control as FormGroup;
      const map: Record<string, string> = {
        name: `اسم المرافق ${index + 1}`,
        relation: `درجة قرابة المرافق ${index + 1}`,
        nationalId: `الرقم القومي للمرافق ${index + 1}`,
        age: `سن المرافق ${index + 1}`
      };

      Object.keys(map).forEach(key => {
        const itemControl = group.get(key);
        if (!itemControl || !itemControl.errors) {
          return;
        }
        alerts.push(...this.controlErrorsToMessages(map[key], itemControl.errors));
      });
    });

    return Array.from(new Set(alerts));
  }

  private controlErrorsToMessages(label: string, errors: Record<string, unknown>): string[] {
    const messages: string[] = [];
    const normalizedLabel = String(label ?? '').trim();
    if (errors['required']) {
      messages.push(`${label}: هذا الحقل مطلوب.`);
    }
    if (errors['maxlength']) {
      const max = Number((errors['maxlength'] as { requiredLength?: number })?.requiredLength ?? 0);
      messages.push(`${label}: الحد الأقصى ${max} حرف.`);
    }
    if (errors['minlength']) {
      const min = Number((errors['minlength'] as { requiredLength?: number })?.requiredLength ?? 0);
      messages.push(`${label}: الحد الأدنى ${min} حرف.`);
    }
    if (errors['min']) {
      const min = Number((errors['min'] as { min?: number })?.min ?? 0);
      messages.push(`${label}: أقل قيمة مسموحة هي ${min}.`);
    }
    if (errors['max']) {
      const max = Number((errors['max'] as { max?: number })?.max ?? 0);
      messages.push(`${label}: أقصى قيمة مسموحة هي ${max}.`);
    }
    if (errors['pattern']) {
      if (normalizedLabel.includes('الرقم القومي')) {
        messages.push(`${label}: يجب أن يتكون من 14 رقمًا.`);
      } else {
        messages.push(`${label}: صيغة الإدخال غير صحيحة.`);
      }
    }
    return messages;
  }

  private pickFirstStringFromSources(sources: Record<string, unknown>[], keys: string[]): string {
    for (const source of sources) {
      const value = this.pickFirstString(source, keys);
      if (value) {
        return value;
      }
    }
    return '';
  }

  private pickFirstStringFromNestedSources(sources: Record<string, unknown>[], keys: string[]): string {
    for (const source of sources) {
      const value = this.pickFirstStringDeep(source, keys);
      if (value) {
        return value;
      }
    }
    return '';
  }

  private asRecord(input: unknown): Record<string, unknown> {
    if (input && typeof input === 'object') {
      return input as Record<string, unknown>;
    }
    return {};
  }

  private getTokenClaims(): Record<string, unknown> {
    try {
      const token = localStorage.getItem('ConnectToken');
      if (!token) {
        return {};
      }

      const parts = token.split('.');
      if (parts.length < 2) {
        return {};
      }

      const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const normalized = payload.padEnd(payload.length + ((4 - payload.length % 4) % 4), '=');
      const decoded = atob(normalized);
      const json = decodeURIComponent(Array.from(decoded).map(ch => `%${(`00${ch.charCodeAt(0).toString(16)}`).slice(-2)}`).join(''));
      const claims = JSON.parse(json);
      return this.asRecord(claims);
    } catch {
      return {};
    }
  }

  private pickFirstString(source: Record<string, unknown>, keys: string[]): string {
    for (const key of keys) {
      const value = this.valueToText(source[key]);
      if (value.length > 0) {
        return value;
      }
    }
    return '';
  }

  private pickFirstStringDeep(source: Record<string, unknown>, keys: string[]): string {
    const normalizedKeys = new Set(keys.map(key => this.normalizeLookupKey(key)));
    const visited = new Set<unknown>();
    const queue: unknown[] = [source];

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current || typeof current !== 'object' || visited.has(current)) {
        continue;
      }

      visited.add(current);
      const record = current as Record<string, unknown>;
      const entries = Object.entries(record);
      for (const [key, value] of entries) {
        const normalized = this.normalizeLookupKey(key);
        if (normalizedKeys.has(normalized)) {
          const text = this.valueToText(value);
          if (text.length > 0) {
            return text;
          }
        }

        if (Array.isArray(value)) {
          queue.push(...value);
          continue;
        }

        if (value && typeof value === 'object') {
          queue.push(value);
        }
      }
    }

    return '';
  }

  private valueToText(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }

    if (typeof value === 'string') {
      return value.trim();
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(Math.trunc(value)).trim();
    }

    if (typeof value === 'bigint') {
      return value.toString().trim();
    }

    return '';
  }

  private normalizeLookupKey(value: string): string {
    return String(value ?? '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\u0600-\u06FF]/g, '');
  }

  private normalizeDigits(value: string): string {
    const source = String(value ?? '').trim();
    if (!source) {
      return '';
    }

    return source
      .replace(/[٠-٩]/g, char => String('٠١٢٣٤٥٦٧٨٩'.indexOf(char)))
      .replace(/[۰-۹]/g, char => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(char)));
  }

  private pickFirstFromLocalStorage(keys: string[]): string {
    for (const key of keys) {
      const value = localStorage.getItem(key);
      if (value && value.trim().length > 0) {
        return value.trim();
      }
    }
    return '';
  }

  private getAuthObjectFromLocalStorage(): Record<string, unknown> {
    try {
      const raw = localStorage.getItem('AuthObject');
      if (!raw) {
        return {};
      }
      return this.asRecord(JSON.parse(raw));
    } catch {
      return {};
    }
  }

  private isAllowedAttachmentFile(file: File): boolean {
    const fileName = String(file?.name ?? '').toLowerCase();
    const dotIndex = fileName.lastIndexOf('.');
    if (dotIndex < 0) {
      return false;
    }
    const extension = fileName.substring(dotIndex);
    return this.allowedAttachmentExtensions.has(extension);
  }

  private getFieldValueByKeys(fields: TkmendField[] | undefined, keys: string[]): string {
    if (!fields || !fields.length) {
      return '';
    }

    const normalizedKeys = keys.map(key => this.normalizeFieldToken(key));
    const normalizedFields = fields.map(field => ({
      rawKey: String(field.fildKind ?? '').trim(),
      normalizedKey: this.normalizeFieldToken(String(field.fildKind ?? '')),
      value: String(field.fildTxt ?? '').trim()
    }));

    // Exact normalized match first.
    for (const key of normalizedKeys) {
      const matched = normalizedFields.find(field => field.normalizedKey === key && field.value.length > 0);
      if (matched) {
        return matched.value;
      }
    }

    // Fuzzy match to support dynamic key variants (prefix/suffix/underscore changes).
    for (const key of keys) {
      const normalizedKey = this.normalizeFieldToken(key);
      const matched = normalizedFields.find(field =>
        field.value.length > 0 &&
        (field.normalizedKey.includes(normalizedKey) || normalizedKey.includes(field.normalizedKey)));
      if (matched) {
        return matched.value;
      }
    }

    return '';
  }

  private coalesceText(...values: Array<string | null | undefined>): string {
    for (const value of values) {
      const text = String(value ?? '').trim();
      if (text.length > 0 && text !== '-') {
        return text;
      }
    }
    return '';
  }

  private toDisplayOrDash(value: string): string {
    const normalized = String(value ?? '').trim();
    return normalized.length > 0 ? normalized : '-';
  }

  private resolveFieldLabel(key: string): string {
    const direct = this.fieldLabelMap[key];
    if (direct) {
      return direct;
    }

    const normalized = this.normalizeFieldToken(key);
    if (normalized.includes('national') || normalized.includes('nid') || normalized.includes('idnumber')) {
      return 'الرقم القومي';
    }
    if (normalized.includes('phone') || normalized.includes('mobile') || normalized.includes('tel')) {
      return 'رقم الهاتف';
    }
    if (normalized.includes('name')) {
      return 'الاسم';
    }
    if (normalized.includes('family') && normalized.includes('count')) {
      return 'عدد الأفراد';
    }
    if (normalized.includes('wave') || normalized.includes('summercamp')) {
      return 'الفوج';
    }
    if (normalized.includes('notes') || normalized.includes('description')) {
      return 'ملاحظات';
    }

    return key;
  }

  private normalizeFieldToken(value: string): string {
    return String(value ?? '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\u0600-\u06FF]/g, '');
  }

  private getNumberValue(control: AbstractControl | null): number {
    const raw = control?.value;
    const numeric = Number(raw);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  private parseDateToEpoch(value: string | undefined): number {
    if (!value) {
      return 0;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
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
    const detailsFields = this.selectedRequestDetails?.fields ?? [];
    const labelFromDetails = this.getFieldValueByKeys(detailsFields, ['SummerCampLabel']);
    const parsedFromDetails = this.parseWaveLabelDate(labelFromDetails);
    if (parsedFromDetails) {
      return parsedFromDetails;
    }

    const destination = this.destinations.find(item => item.categoryId === categoryId);
    const wave = destination?.waves.find(item => item.code === String(waveCode ?? '').trim());
    return this.parseWaveLabelDate(wave?.startsAtLabel ?? '');
  }

  private parseWaveLabelDate(label: string): Date | null {
    const normalized = String(label ?? '').trim();
    if (!normalized) {
      return null;
    }

    const match = normalized.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (!match) {
      return null;
    }

    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3]);
    if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) {
      return null;
    }

    const parsed = new Date(year, month - 1, day, 0, 0, 0, 0);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private formatLocalDateHour(value: Date): string {
    if (!value || Number.isNaN(value.getTime())) {
      return '-';
    }

    const day = String(value.getDate()).padStart(2, '0');
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const year = String(value.getFullYear());
    const hour = String(value.getHours()).padStart(2, '0');
    return `${day}/${month}/${year} ${hour}:00`;
  }

  isRejectedStatus(status: string | undefined): boolean {
    const normalized = (status ?? '').toLowerCase();
    return normalized.includes('rejected') || normalized.includes('مرفوض') || normalized.includes('رفض');
  }

  private resolveAttachmentId(item: { attchId?: unknown; id?: unknown } | undefined): number {
    const attchId = Number(item?.attchId);
    if (Number.isFinite(attchId) && attchId > 0) {
      return attchId;
    }

    const id = Number(item?.id);
    if (Number.isFinite(id) && id > 0) {
      return id;
    }

    return 0;
  }

  private getDatePart(parts: Intl.DateTimeFormatPart[], type: string): string {
    return parts.find(item => item.type === type)?.value ?? '';
  }
}
