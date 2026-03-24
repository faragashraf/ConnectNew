import { Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges, ViewChild } from '@angular/core';
import { AbstractControl, FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { GenericFormsIsolationProvider, GenericFormsService, GroupInfo } from 'src/app/Modules/GenericComponents/GenericForms.service';
import { GenericDynamicFormDetailsComponent } from '../../generic-dynamic-form-details/generic-dynamic-form-details.component';
import { CdCategoryMandDto, ListRequestModel, MessageDto, RequestedData, SearchKind, TkmendField } from 'src/app/shared/services/BackendServices/DynamicForm/DynamicForm.dto';
import { DynamicFormController } from 'src/app/shared/services/BackendServices/DynamicForm/DynamicForm.service';
import { FileParameter } from 'src/app/shared/services/BackendServices/dto-shared';
import {
  SummerRequestSummaryDto,
  SummerWaveCapacityDto
} from 'src/app/shared/services/BackendServices/SummerWorkflow/SummerWorkflow.dto';
import { SummerWorkflowController } from 'src/app/shared/services/BackendServices/SummerWorkflow/SummerWorkflow.service';
import { AuthObjectsService } from 'src/app/shared/services/helper/auth-objects.service';
import { MsgsService } from 'src/app/shared/services/helper/msgs.service';
import { SpinnerService } from 'src/app/shared/services/helper/spinner.service';
import { SignalRService } from 'src/app/shared/services/SignalRServices/SignalR.service';
import { SummerDestinationConfig } from '../summer-requests-workspace.config';
import { SummerDynamicFormEngineService } from '../summer-dynamic-form-engine.service';
import { ComponentConfig, getConfigByRoute } from 'src/app/shared/models/Component.Config.model';
import { ComponentConfigService } from 'src/app/Modules/admins/services/component-config.service';
import { extractCapacityPayloadFromSignal } from '../summer-requests-workspace.utils';

type OwnerDefaults = {
  name: string;
  fileNumber: string;
  nationalId: string;
  phone: string;
  extraPhone: string;
};

@Component({
  selector: 'app-summer-dynamic-booking-builder',
  templateUrl: './summer-dynamic-booking-builder.component.html',
  styleUrls: ['./summer-dynamic-booking-builder.component.scss'],
  providers: [GenericFormsIsolationProvider, SummerDynamicFormEngineService]
})
export class SummerDynamicBookingBuilderComponent implements OnInit, OnChanges, OnDestroy {
  @Input() destinations: SummerDestinationConfig[] = [];
  @Input() seasonYear = 2026;
  @Input() applicationId = 'SUM2026DYN';
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
  resolvedApplicationId = 'SUM2026DYN';
  loadingMetadata = false;
  metadataLoaded = false;
  metadataError = '';
  submitting = false;
  isEditMode = false;
  loadingEditRequest = false;
  editRequestError = '';
  hasEditChanges = false;
  canUseProxyRegistration = false;

  bookingCapacityLoading = false;
  bookingWaveCapacities: SummerWaveCapacityDto[] = [];
  myRequests: SummerRequestSummaryDto[] = [];

  private readonly subscriptions = new Subscription();
  private baseFormConfig: ComponentConfig;
  private pendingEditRequestId: number | null = null;
  private loadedEditRequestId: number | null = null;
  private initialEditSignature = '';
  private lastProxyEnabled = false;

  constructor(
    private readonly fb: FormBuilder,
    public readonly genericFormService: GenericFormsService,
    private readonly dynamicFormController: DynamicFormController,
    private readonly summerWorkflowController: SummerWorkflowController,
    private readonly componentConfigService: ComponentConfigService,
    private readonly authObjectsService: AuthObjectsService,
    private readonly msg: MsgsService,
    private readonly spinner: SpinnerService,
    private readonly signalRService: SignalRService,
    private readonly engine: SummerDynamicFormEngineService
  ) {
    this.baseFormConfig = this.engine.createFormConfig();
    this.formConfig = new ComponentConfig({
      ...this.baseFormConfig
    });
    this.ticketForm = this.fb.group({});
  }

  ngOnInit(): void {
    this.refreshProxyModeAccess();
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

  get bookingCapacitySummary(): SummerWaveCapacityDto[] {
    return [...this.bookingWaveCapacities].sort((a, b) => a.familyCount - b.familyCount);
  }

  get submitDisabled(): boolean {
    return this.isEditMode && !this.hasEditChanges;
  }

  onDestinationChanged(
    value: string | number | null,
    options?: { preserveMessageFields?: boolean; resetFiles?: boolean }
  ): void {
    const categoryId = Number(value);
    this.selectedDestinationId = Number.isFinite(categoryId) && categoryId > 0 ? categoryId : null;
    this.bookingValidationAlerts = [];
    this.bookingWaveCapacities = [];
    if (options?.resetFiles !== false) {
      this.fileParameters = [];
    }
    this.ticketForm = this.fb.group({});
    this.genericFormService.dynamicGroups = [];
    this.lastProxyEnabled = false;
    this.editRequestError = '';
    if (!this.isEditMode) {
      this.hasEditChanges = false;
      this.initialEditSignature = '';
    }

    const destination = this.selectedDestination;
    if (!destination) {
      this.customFilteredCategoryMand = [];
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
    this.applySummerBusinessRules();
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
      return;
    }

    if (this.matchesAlias(baseName, this.engine.aliases.companionRelation)) {
      this.engine.ensureAgeRule(this.ticketForm, this.genericFormService, controlFullName);
      return;
    }

    if (this.matchesAlias(baseName, this.engine.aliases.proxyMode)) {
      this.applyOwnerDefaultMode(false);
      return;
    }

    if (this.matchesAlias(baseName, this.engine.aliases.waveCode)) {
      this.syncWaveLabel();
      this.loadBookingCapacity();
    }
  }

  onFileUpload(files: FileParameter[]): void {
    this.fileParameters = [...(files ?? [])];
    this.updateEditChangeState();
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
      this.msg.msgError('خطأ', '<h5>يرجى مراجعة قواعد التحقق وإكمال البيانات.</h5>', true);
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
    this.ensureKeyField(fields, 'Description', notes, destination.categoryId);

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
          this.msg.msgSuccess(this.isEditMode
            ? 'تم حفظ تعديلات الطلب بنجاح'
            : 'تم تسجيل الطلب بنجاح');
          this.bookingValidationAlerts = [];
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
          const errors = (response?.errors ?? [])
            .map(item => String(item?.message ?? '').trim())
            .filter(item => item.length > 0)
            .join('<br/>');
          this.msg.msgError('خطأ', `<h5>${errors || (this.isEditMode ? 'تعذر حفظ التعديلات.' : 'تعذر تسجيل الطلب.')}</h5>`, true);
        }
      },
      error: () => {
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
    if (stayModeCtrl && destination.stayModes.length === 1) {
      stayModeCtrl.setValue(destination.stayModes[0].code, { emitEvent: false });
      stayModeCtrl.disable({ emitEvent: false });
    }
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

    this.engine.ensureExtraCountRule(this.ticketForm, this.genericFormService, destination);
    this.syncCompanionInstances();
    this.applyCompanionAgeRules();
    this.syncWaveLabel();
    this.loadBookingCapacity();
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

  private bindSignalRefresh(): void {
    const signalSub = this.signalRService.Notification$.subscribe(notification => {
      const title = String((notification as { title?: string; Title?: string })?.title
        ?? (notification as { title?: string; Title?: string })?.Title
        ?? '');
      const body = String((notification as { notification?: string; Notification?: string })?.notification
        ?? (notification as { notification?: string; Notification?: string })?.Notification
        ?? '');

      const capacityPayload = extractCapacityPayloadFromSignal([body, title]);
      if (!capacityPayload) {
        return;
      }

      this.refreshCapacityFromSignal(capacityPayload);
    });

    this.subscriptions.add(signalSub);
  }

  private refreshCapacityFromSignal(payload: string): void {
    const destination = this.selectedDestination;
    if (!destination || !this.ticketForm) {
      return;
    }

    const selectedWaveCode = this.getStringValue(this.engine.aliases.waveCode);
    if (!selectedWaveCode) {
      return;
    }

    const parts = payload.split('|');
    if (parts.length < 3) {
      this.loadBookingCapacity();
      return;
    }

    const categoryId = Number(parts[1]);
    const waveCode = String(parts[2] ?? '').trim();

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

    const maxFamily = destination.familyOptions.length > 0 ? Math.max(...destination.familyOptions) : 0;
    if (maxFamily > 0 && familyCount !== maxFamily && extraCount > 0) {
      alerts.push(`الأفراد الإضافيون متاحون فقط عند اختيار السعة القصوى (${maxFamily}).`);
    }

    if (extraCount > destination.maxExtraMembers) {
      alerts.push(`الحد الأقصى للأفراد الإضافيين في ${destination.name} هو ${destination.maxExtraMembers}.`);
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
        let age = '';
        formArray.controls.forEach(control => {
          const row = control as FormGroup;
          const name = Object.keys(row.controls)[0];
          const base = this.engine.parseControlName(name).base.toLowerCase();
          const value = String(row.get(name)?.value ?? '').trim();
          if (this.matchesAlias(base, this.engine.aliases.companionRelation)) {
            relation = value;
          }
          if (this.matchesAlias(base, this.engine.aliases.companionAge)) {
            age = value;
          }
        });

        if (this.engine.isChildRelation(relation) && age.length === 0) {
          alerts.push(`سن المرافق رقم ${index + 1} مطلوب عند اختيار درجة القرابة ابن/ابنة.`);
        }
      });
    }

    return alerts;
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
      extraPhone: this.coalesceText(
        profile['PhoneWhats'],
        profile['SecondaryPhone'],
        localStorage.getItem('ExtraPhoneNumber')
      )
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

  private matchesAlias(name: string, aliases: readonly string[]): boolean {
    const lowered = String(name ?? '').trim().toLowerCase();
    return aliases.some(alias => alias.toLowerCase() === lowered);
  }

  private toBoolean(value: unknown): boolean {
    if (typeof value === 'boolean') {
      return value;
    }
    const normalized = String(value ?? '').trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes';
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
      this.canUseProxyRegistration = this.authObjectsService.checkAuthFun('ConnectAdminFunc');
    } catch {
      this.canUseProxyRegistration = false;
    }
  }

  private filterRestrictedFields(fields: CdCategoryMandDto[]): CdCategoryMandDto[] {
    if (this.canUseProxyRegistration) {
      return [...(fields ?? [])];
    }

    return (fields ?? []).filter(field => {
      const key = String(field?.mendField ?? '').trim();
      return !this.matchesAlias(key, this.engine.aliases.proxyMode);
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

    this.loadedEditRequestId = messageId;
    this.initialEditSignature = '';
    this.hasEditChanges = false;
    this.selectedDestinationId = destinationId;
    this.onDestinationChanged(destinationId, {
      preserveMessageFields: true,
      resetFiles: true
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


