import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';
import { AbstractControl, FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { GenericFormsIsolationProvider, GenericFormsService, GroupInfo } from 'src/app/Modules/GenericComponents/GenericForms.service';
import { GenericDynamicFormDetailsComponent } from '../../generic-dynamic-form-details/generic-dynamic-form-details.component';
import { CdCategoryMandDto, TkmendField } from 'src/app/shared/services/BackendServices/DynamicForm/DynamicForm.dto';
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
import { SummerDestinationConfig } from '../summer-requests-workspace.config';
import { SummerDynamicFormEngineService } from '../summer-dynamic-form-engine.service';
import { ComponentConfig, getConfigByRoute } from 'src/app/shared/models/Component.Config.model';
import { ComponentConfigService } from 'src/app/Modules/admins/services/component-config.service';

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
export class SummerDynamicBookingBuilderComponent implements OnInit, OnDestroy {
  @Input() destinations: SummerDestinationConfig[] = [];
  @Input() seasonYear = 2026;
  @Input() applicationId = 'SUM2026DYN';
  @Input() configRouteKey = 'admins/summer-requests/dynamic-booking';
  @Output() bookingCreated = new EventEmitter<void>();

  @ViewChild(GenericDynamicFormDetailsComponent) formDetailsRef?: GenericDynamicFormDetailsComponent;

  formConfig: ComponentConfig;
  messageDto: any = {};
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

  bookingCapacityLoading = false;
  bookingWaveCapacities: SummerWaveCapacityDto[] = [];
  myRequests: SummerRequestSummaryDto[] = [];

  private readonly subscriptions = new Subscription();

  constructor(
    private readonly fb: FormBuilder,
    public readonly genericFormService: GenericFormsService,
    private readonly dynamicFormController: DynamicFormController,
    private readonly summerWorkflowController: SummerWorkflowController,
    private readonly componentConfigService: ComponentConfigService,
    private readonly authObjectsService: AuthObjectsService,
    private readonly msg: MsgsService,
    private readonly spinner: SpinnerService,
    private readonly engine: SummerDynamicFormEngineService
  ) {
    this.formConfig = this.engine.createFormConfig();
    this.ticketForm = this.fb.group({});
  }

  ngOnInit(): void {
    this.resolvedApplicationId = this.applicationId;
    this.initializeFromComponentConfig();
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

  onDestinationChanged(value: string | number | null): void {
    const categoryId = Number(value);
    this.selectedDestinationId = Number.isFinite(categoryId) && categoryId > 0 ? categoryId : null;
    this.bookingValidationAlerts = [];
    this.bookingWaveCapacities = [];
    this.fileParameters = [];
    this.ticketForm = this.fb.group({});
    this.genericFormService.dynamicGroups = [];

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

    this.customFilteredCategoryMand = filtered;

    if (!this.customFilteredCategoryMand.length) {
      this.msg.msgError(
        'Ø¨ÙŠØ§Ù†Ø§Øª ØºÙŠØ± Ù…ÙƒØªÙ…Ù„Ø©',
        '<h5>Ù„Ø§ ØªÙˆØ¬Ø¯ Ø­Ù‚ÙˆÙ„ Ø¯ÙŠÙ†Ø§Ù…ÙŠÙƒÙŠØ© Ù…Ø±ØªØ¨Ø·Ø© Ø¨Ø§Ù„Ù…ØµÙŠÙ Ø§Ù„Ù…Ø®ØªØ§Ø± Ø¶Ù…Ù† Ù…Ø¹Ø±Ù‘Ù Ø§Ù„ØªØ·Ø¨ÙŠÙ‚ Ø§Ù„Ø­Ø§Ù„ÙŠ (ApplicationID).</h5>',
        true
      );
      return;
    }

    this.messageDto = {
      ...(this.messageDto ?? {}),
      fields: [],
      categoryCd: destination.categoryId
    };

    setTimeout(() => this.formDetailsRef?.populateForm(), 0);
  }

  onTicketFormChange(form: FormGroup): void {
    this.ticketForm = form;
    this.applyDestinationFieldDefaults();
    this.applyOwnerDefaultMode();
    this.applySummerBusinessRules();
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
      this.applyOwnerDefaultMode();
      return;
    }

    if (this.matchesAlias(baseName, this.engine.aliases.waveCode)) {
      this.syncWaveLabel();
      this.loadBookingCapacity();
    }
  }

  onFileUpload(files: FileParameter[]): void {
    this.fileParameters = [...(files ?? [])];
  }

  submitDynamicBooking(form: FormGroup): void {
    this.ticketForm = form;
    this.bookingValidationAlerts = [];
    this.ticketForm.markAllAsTouched();

    const destination = this.selectedDestination;
    if (!destination) {
      this.bookingValidationAlerts = ['ÙŠØ±Ø¬Ù‰ Ø§Ø®ØªÙŠØ§Ø± Ø§Ù„Ù…ØµÙŠÙ Ø£ÙˆÙ„Ø§Ù‹.'];
      this.msg.msgError('Ø®Ø·Ø£', '<h5>ÙŠØ±Ø¬Ù‰ Ø§Ø®ØªÙŠØ§Ø± Ø§Ù„Ù…ØµÙŠÙ Ø£ÙˆÙ„Ø§Ù‹.</h5>', true);
      return;
    }

    const validationAlerts = this.validateBookingRules(destination);
    if (this.ticketForm.invalid || validationAlerts.length > 0) {
      this.bookingValidationAlerts = validationAlerts.length > 0 ? validationAlerts : ['ÙŠØ±Ø¬Ù‰ Ø§Ø³ØªÙƒÙ…Ø§Ù„ Ø§Ù„Ø­Ù‚ÙˆÙ„ Ø§Ù„Ø¥Ù„Ø²Ø§Ù…ÙŠØ© Ø¨Ø´ÙƒÙ„ ØµØ­ÙŠØ­.'];
      this.msg.msgError('Ø®Ø·Ø£', '<h5>ÙŠØ±Ø¬Ù‰ Ù…Ø±Ø§Ø¬Ø¹Ø© Ù‚ÙˆØ§Ø¹Ø¯ Ø§Ù„ØªØ­Ù‚Ù‚ ÙˆØ¥ÙƒÙ…Ø§Ù„ Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª.</h5>', true);
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
    const proxyMode = this.getStringValue(this.engine.aliases.proxyMode);
    const destinationSlug = String(destination.slug ?? '').trim() || `CAT${destination.categoryId}`;
    const requestRef = `SUMMER-${destinationSlug}-${employeeFileNumber}-${Date.now()}`;
    const subject = `Ø·Ù„Ø¨ Ø­Ø¬Ø² ${destination.name} - ${waveCode}`;
    const createdBy = this.authObjectsService.returnCurrentUser() || localStorage.getItem('UserId') || '';

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
    this.spinner.show('Ø¬Ø§Ø±ÙŠ ØªØ³Ø¬ÙŠÙ„ Ø·Ù„Ø¨ Ø§Ù„Ù…ØµÙŠÙ Ø§Ù„Ø¯ÙŠÙ†Ø§Ù…ÙŠÙƒÙŠ ...');
    this.dynamicFormController.createRequest(
      0,
      requestRef,
      subject,
      notes,
      createdBy,
      '',
      unitIds,
      '',
      0,
      destination.categoryId,
      fields as TkmendField[],
      this.fileParameters
    ).subscribe({
      next: response => {
        if (response?.isSuccess) {
          this.msg.msgSuccess('ØªÙ… ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø·Ù„Ø¨ Ø§Ù„Ø¯ÙŠÙ†Ø§Ù…ÙŠÙƒÙŠ Ø¨Ù†Ø¬Ø§Ø­');
          this.bookingValidationAlerts = [];
          this.fileParameters = [];
          this.loadMyRequests();
          this.bookingCreated.emit();
          const selected = this.selectedDestinationId;
          this.onDestinationChanged(selected);
        } else {
          const errors = (response?.errors ?? [])
            .map(item => String(item?.message ?? '').trim())
            .filter(item => item.length > 0)
            .join('<br/>');
          this.msg.msgError('Ø®Ø·Ø£', `<h5>${errors || 'ØªØ¹Ø°Ø± ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø·Ù„Ø¨.'}</h5>`, true);
        }
      },
      error: () => {
        this.msg.msgError('Ø®Ø·Ø£', '<h5>ØªØ¹Ø°Ø± ØªØ³Ø¬ÙŠÙ„ Ø·Ù„Ø¨ Ø§Ù„Ù…ØµÙŠÙ Ø­Ø§Ù„ÙŠØ§Ù‹.</h5>', true);
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
          this.metadataError = 'ØªØ¹Ø°Ø± ØªØ­Ù…ÙŠÙ„ Ø§Ù„Ø­Ù‚ÙˆÙ„ Ø§Ù„Ø¯ÙŠÙ†Ø§Ù…ÙŠÙƒÙŠØ© Ù„Ù„Ù…ØµØ§ÙŠÙ. Ø±Ø§Ø¬Ø¹ Ù…Ø¹Ø±Ù‘Ù Ø§Ù„ØªØ·Ø¨ÙŠÙ‚ (ApplicationID) ÙˆØ±Ø¨Ø· Ø§Ù„Ø­Ù‚ÙˆÙ„.';
        }
      },
      error: () => {
        this.metadataLoaded = false;
        this.metadataError = 'ØªØ¹Ø°Ø± ØªØ­Ù…ÙŠÙ„ Ø§Ù„Ø­Ù‚ÙˆÙ„ Ø§Ù„Ø¯ÙŠÙ†Ø§Ù…ÙŠÙƒÙŠØ© Ù„Ù„Ù…ØµØ§ÙŠÙ. Ø±Ø§Ø¬Ø¹ Ù…Ø¹Ø±Ù‘Ù Ø§Ù„ØªØ·Ø¨ÙŠÙ‚ (ApplicationID) ÙˆØ±Ø¨Ø· Ø§Ù„Ø­Ù‚ÙˆÙ„.';
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
      },
      error: () => {
        this.myRequests = [];
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

  private applyOwnerDefaultMode(): void {
    if (!this.ticketForm) {
      return;
    }

    const proxyCtrl = this.engine.resolveControl(this.ticketForm, this.genericFormService, this.engine.aliases.proxyMode);
    if (proxyCtrl && (proxyCtrl.value === null || proxyCtrl.value === undefined || proxyCtrl.value === '')) {
      proxyCtrl.setValue(false, { emitEvent: false });
    }

    const proxyEnabled = this.toBoolean(proxyCtrl?.value);
    const defaults = this.extractOwnerDefaults();

    const ownerControls = [
      { aliases: this.engine.aliases.ownerName, value: defaults.name, required: true },
      { aliases: this.engine.aliases.ownerFileNumber, value: defaults.fileNumber, required: true },
      { aliases: this.engine.aliases.ownerNationalId, value: defaults.nationalId, required: true },
      { aliases: this.engine.aliases.ownerPhone, value: defaults.phone, required: true },
      { aliases: this.engine.aliases.ownerExtraPhone, value: defaults.extraPhone, required: false }
    ];

    ownerControls.forEach(item => {
      const control = this.engine.resolveControl(this.ticketForm, this.genericFormService, item.aliases);
      if (!control) {
        return;
      }

      if (proxyEnabled) {
        control.enable({ emitEvent: false });
        if (item.required) {
          control.addValidators(Validators.required);
        }
      } else {
        control.setValue(item.value, { emitEvent: false });
        control.disable({ emitEvent: false });
      }
      control.updateValueAndValidity({ emitEvent: false });
    });
  }

  private applySummerBusinessRules(): void {
    const destination = this.selectedDestination;
    if (!destination || !this.ticketForm) {
      return;
    }

    this.engine.ensureExtraCountRule(this.ticketForm, this.genericFormService, destination);
    this.syncCompanionInstances();
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

  private validateBookingRules(destination: SummerDestinationConfig): string[] {
    const alerts: string[] = [];
    const waveCode = this.getStringValue(this.engine.aliases.waveCode);
    const stayMode = this.getStringValue(this.engine.aliases.stayMode);
    const familyCount = Number(this.getStringValue(this.engine.aliases.familyCount) || 0) || 0;
    const extraCount = Number(this.getStringValue(this.engine.aliases.extraCount) || 0) || 0;
    const employeeId = this.getStringValue(this.engine.aliases.ownerFileNumber);

    if (!waveCode) {
      alerts.push('Ø§Ø®ØªÙŠØ§Ø± Ø§Ù„ÙÙˆØ¬ Ù…Ø·Ù„ÙˆØ¨.');
    }

    if (destination.stayModes.length > 1 && !stayMode) {
      alerts.push('ÙŠØ±Ø¬Ù‰ Ø§Ø®ØªÙŠØ§Ø± Ù†ÙˆØ¹ Ø§Ù„Ø­Ø¬Ø².');
    }

    const maxFamily = destination.familyOptions.length > 0 ? Math.max(...destination.familyOptions) : 0;
    if (maxFamily > 0 && familyCount !== maxFamily && extraCount > 0) {
      alerts.push(`Ø§Ù„Ø£ÙØ±Ø§Ø¯ Ø§Ù„Ø¥Ø¶Ø§ÙÙŠÙˆÙ† Ù…ØªØ§Ø­ÙˆÙ† ÙÙ‚Ø· Ø¹Ù†Ø¯ Ø§Ø®ØªÙŠØ§Ø± Ø§Ù„Ø³Ø¹Ø© Ø§Ù„Ù‚ØµÙˆÙ‰ (${maxFamily}).`);
    }

    if (extraCount > destination.maxExtraMembers) {
      alerts.push(`Ø§Ù„Ø­Ø¯ Ø§Ù„Ø£Ù‚ØµÙ‰ Ù„Ù„Ø£ÙØ±Ø§Ø¯ Ø§Ù„Ø¥Ø¶Ø§ÙÙŠÙŠÙ† ÙÙŠ ${destination.name} Ù‡Ùˆ ${destination.maxExtraMembers}.`);
    }

    const duplicateActive = this.myRequests.some(request =>
      request.categoryId === destination.categoryId &&
      String(request.waveCode ?? '').trim() === waveCode &&
      String(request.employeeId ?? '').trim() === employeeId &&
      String(request.status ?? '').trim().toLowerCase() !== 'rejected'
    );
    if (duplicateActive) {
      alerts.push('Ù„Ø§ ÙŠÙ…ÙƒÙ† ØªØ³Ø¬ÙŠÙ„ Ø£ÙƒØ«Ø± Ù…Ù† Ø­Ø¬Ø² Ù†Ø´Ø· Ù„Ù†ÙØ³ Ø§Ù„Ù…ÙˆØ¸Ù ÙÙŠ Ù†ÙØ³ Ø§Ù„ÙÙˆØ¬ ÙˆØ§Ù„Ù…ØµÙŠÙ.');
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

        if ((relation === 'Ø§Ø¨Ù†' || relation === 'Ø§Ø¨Ù†Ø©') && age.length === 0) {
          alerts.push(`Ø³Ù† Ø§Ù„Ù…Ø±Ø§ÙÙ‚ Ø±Ù‚Ù… ${index + 1} Ù…Ø·Ù„ÙˆØ¨ Ø¹Ù†Ø¯ Ø§Ø®ØªÙŠØ§Ø± Ø¯Ø±Ø¬Ø© Ø§Ù„Ù‚Ø±Ø§Ø¨Ø© Ø§Ø¨Ù†/Ø§Ø¨Ù†Ø©.`);
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
          this.applyOwnerDefaultMode();
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
      ...this.formConfig,
      ...config
    });

    merged.isNew = true;
    merged.showViewToggle = false;
    merged.formDisplayOption = merged.formDisplayOption || 'fullscreen';
    merged.submitButtonText = (merged.submitButtonText || '').trim() || 'ØªØ³Ø¬ÙŠÙ„ Ø·Ù„Ø¨ Ø§Ù„Ù…ØµÙŠÙ';
    merged.attachmentConfig = {
      ...this.formConfig.attachmentConfig,
      ...(config.attachmentConfig || {})
    };

    this.formConfig = merged;

    const dynamicSettings = merged.dynamicFormSettings || {};
    const appIdFromConfig = String(dynamicSettings.applicationId ?? merged.genericFormName ?? '').trim();
    if (appIdFromConfig.length > 0) {
      this.resolvedApplicationId = appIdFromConfig;
    }

    this.engine.applyAliasOverrides(dynamicSettings.aliases);
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

