import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges } from '@angular/core';
import { AbstractControl, FormArray, FormBuilder, FormGroup, ValidationErrors } from '@angular/forms';
import { Subscription, debounceTime, distinctUntilChanged } from 'rxjs';
import { GenericFormsService, GroupInfo } from 'src/app/Modules/GenericComponents/GenericForms.service';
import { ComponentConfig } from 'src/app/shared/models/Component.Config.model';
import { CdCategoryMandDto, MessageDto } from 'src/app/shared/services/BackendServices/DynamicForm/DynamicForm.dto';
import { FileParameter } from 'src/app/shared/services/BackendServices/dto-shared';
import { MsgsService } from 'src/app/shared/services/helper/msgs.service';
import { GenericDynamicFormGroupsFacadeService } from './generic-dynamic-form-groups-facade.service';

@Component({
  selector: 'app-generic-dynamic-form-details',
  templateUrl: './generic-dynamic-form-details.component.html',
  styleUrls: ['./generic-dynamic-form-details.component.scss']
})
export class GenericDynamicFormDetailsComponent implements OnChanges, OnDestroy {
  @Input() messageDto: MessageDto = {} as MessageDto;
  @Input() config: ComponentConfig = new ComponentConfig();
  @Input() isCurrentUser = false;
  @Input() unitTree: any[] = [];
  @Input() fileParameters: FileParameter[] = [];
  @Input() customFilteredCategoryMand: CdCategoryMandDto[] = [];

  @Output() ticketFormChange = new EventEmitter<FormGroup>();
  @Output() submitFormChange = new EventEmitter<FormGroup>();
  @Output() genericEvent = new EventEmitter<any>();
  @Output() fileUploadEvent = new EventEmitter<FileParameter[]>();

  ticketForm: FormGroup = this.fb.group({});

  private formChangesSub: Subscription | null = null;

  constructor(
    private readonly fb: FormBuilder,
    public readonly genericFormService: GenericFormsService,
    private readonly msg: MsgsService,
    private readonly groupsFacade: GenericDynamicFormGroupsFacadeService
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    this.ensureConfigDefaults();

    if (changes['customFilteredCategoryMand'] || changes['messageDto']) {
      this.populateForm();
      return;
    }

    if (changes['config']) {
      this.syncAttachmentValidators();
    }

    if (changes['fileParameters']) {
      this.syncAttachmentsControl();
    }
  }

  ngOnDestroy(): void {
    this.formChangesSub?.unsubscribe();
    this.formChangesSub = null;
  }

  populateForm(): void {
    if (!Array.isArray(this.customFilteredCategoryMand) || this.customFilteredCategoryMand.length === 0) {
      this.genericFormService.dynamicGroups = [];
      this.ticketForm = this.fb.group({});
      this.ticketFormChange.emit(this.ticketForm);
      return;
    }

    this.resetValidationState();

    this.genericFormService.organizeFieldsByGroups(this.customFilteredCategoryMand);
    this.initForm();

    this.ticketForm.get('tkCategoryCd')?.patchValue(this.customFilteredCategoryMand[0]?.mendCategory ?? null, { emitEvent: false });
    this.ticketForm.get('messageID')?.patchValue((this.messageDto as any)?.messageId ?? null, { emitEvent: false });
    this.ticketForm.get('subject')?.patchValue((this.messageDto as any)?.subject ?? null, { emitEvent: false });
    this.ticketForm.get('createdBy')?.patchValue((this.messageDto as any)?.createdBy ?? this.resolveCreatedBy(), { emitEvent: false });

    this.buildBaseGroupControls();
    this.populateValuesFromMessage();
    this.syncAttachmentsControl();
    this.syncAttachmentValidators();

    this.genericFormService.logValidationErrors(this.ticketForm);
    this.ticketFormChange.emit(this.ticketForm);
  }

  onFileChange(files: FileParameter[]): void {
    this.fileParameters = [...(files ?? [])];
    this.fileUploadEvent.emit(this.fileParameters);
    this.syncAttachmentsControl();
  }

  handleEvent(event: any): void {
    this.genericEvent.emit(event);
  }

  onSubmitClick(): void {
    this.ticketForm.markAllAsTouched();
    this.genericFormService.logValidationErrors(this.ticketForm);
    this.submitFormChange.emit(this.ticketForm);
  }

  getFormArrayControls(formArrayName: string): AbstractControl[] {
    const formArray = this.getFormArrayInstance(formArrayName);
    return formArray?.controls ?? [];
  }

  getFormArrayInstance(formArrayName: string): FormArray | null {
    try {
      return this.genericFormService.getFormArray(formArrayName, this.ticketForm) ?? null;
    } catch {
      return null;
    }
  }

  duplicateGroup(
    groupId: number,
    fieldsPerInstance?: number,
    instanceIndex = 0,
    instanceGroupId?: number
  ): GroupInfo | null {
    const created = this.groupsFacade.createDuplicateInstance(
      this.genericFormService.dynamicGroups,
      groupId,
      fieldsPerInstance,
      instanceIndex,
      instanceGroupId
    );

    if (!created) {
      this.msg.msgError('خطأ', `<h5>المجموعة ${groupId} غير موجودة</h5>`, true);
      return null;
    }

    const newInstance = created.newInstance;
    const assignedInstanceId = Number(newInstance.instanceGroupId ?? 1) || 1;
    const formArray = this.fb.array([]);
    this.ticketForm.addControl(newInstance.formArrayName, formArray);
    this.addControlsToArray(newInstance, formArray, assignedInstanceId, true);
    this.ticketForm.markAsDirty();
    this.ticketFormChange.emit(this.ticketForm);
    return newInstance;
  }

  deleteGroup(groupId: number): void {
    if (groupId <= 9) {
      return;
    }

    const removed = this.groupsFacade.removeGroup(this.genericFormService.dynamicGroups, groupId);
    if (!removed) {
      return;
    }

    const target = removed.removedGroup;
    if (this.ticketForm.contains(target.formArrayName)) {
      this.ticketForm.removeControl(target.formArrayName);
    }

    this.ticketForm.markAsDirty();
    this.ticketFormChange.emit(this.ticketForm);
  }

  private resetValidationState(): void {
    this.genericFormService.resetDynamicRuntimeState(false);
  }

  private ensureConfigDefaults(): void {
    if (!this.config) {
      this.config = new ComponentConfig();
    }

    if (!this.config.fieldsConfiguration) {
      this.config.fieldsConfiguration = {
        isDivDisabled: false,
        dateFormat: 'yy/mm/dd',
        showTime: false,
        timeOnly: false,
        maxDate: new Date(),
        useDefaultRadioView: true,
        isNotRequired: false
      } as any;
    }

    if (!this.config.attachmentConfig) {
      this.config.attachmentConfig = {
        showAttachmentSection: false,
        AllowedExtensions: ['.pdf', '.jpg', '.jpeg', '.png'],
        maximumFileSize: 10,
        maxFileCount: 0,
        isMandatory: false,
        allowAdd: true,
        allowMultiple: true
      } as any;
    }
  }

  private initForm(): void {
    this.ticketForm = this.genericFormService.createDynamicFormShell(this.genericFormService.dynamicGroups, {
      includeAttachments: !!this.config?.attachmentConfig?.showAttachmentSection,
      attachmentsMandatory: !!this.config?.attachmentConfig?.isMandatory,
      createdBy: this.resolveCreatedBy()
    });
    if (this.ticketForm.contains('attachments')) {
      const control = this.ticketForm.get('attachments');
      control?.setValidators(this.attachmentsValidator.bind(this));
      control?.updateValueAndValidity({ emitEvent: false });
    }
    this.subscribeToFormChanges();
  }

  private attachmentsValidator(control: AbstractControl): ValidationErrors | null {
    if (!this.config?.attachmentConfig?.showAttachmentSection) {
      return null;
    }

    if (!this.config?.attachmentConfig?.isMandatory) {
      return null;
    }

    const value = control?.value;
    if (!Array.isArray(value) || value.length === 0) {
      return { required: true };
    }
    return null;
  }

  private subscribeToFormChanges(): void {
    this.formChangesSub?.unsubscribe();
    this.formChangesSub = this.ticketForm.valueChanges
      .pipe(
        debounceTime(250),
        distinctUntilChanged((previous, current) => {
          try {
            return JSON.stringify(previous) === JSON.stringify(current);
          } catch {
            return previous === current;
          }
        })
      )
      .subscribe(() => {
        this.genericFormService.logValidationErrors(this.ticketForm);
        this.ticketFormChange.emit(this.ticketForm);
      });
  }

  private buildBaseGroupControls(): void {
    this.genericFormService.dynamicGroups.forEach(group => {
      const formArray = this.getFormArrayInstance(group.formArrayName);
      if (!formArray) {
        return;
      }

      if (!group.instanceGroupId || group.instanceGroupId <= 0) {
        group.instanceGroupId = 1;
      }

      this.addControlsToArray(group, formArray, group.instanceGroupId, false);
    });
  }

  private addControlsToArray(group: GroupInfo, formArray: FormArray, instanceGroupId: number, useInstancePrefix: boolean): void {
    group.fields.forEach((field, index) => {
      const controlIndex = useInstancePrefix
        ? `${instanceGroupId}_c${index}`
        : String(index);
      this.genericFormService.addFormArrayWithValidators(
        `${field.mendField}|${controlIndex}`,
        formArray,
        !!this.config?.fieldsConfiguration?.isNotRequired
      );
    });
  }

  private populateValuesFromMessage(): void {
    const messageFields = this.messageDto?.fields ?? [];
    if (!Array.isArray(messageFields) || messageFields.length === 0) {
      return;
    }

    const assignGroupValues = (group: GroupInfo): void => {
      const formArray = this.getFormArrayInstance(group.formArrayName);
      if (!formArray) {
        return;
      }

      const groupInstanceId = Number(group.instanceGroupId ?? 1) || 1;
      formArray.controls.forEach(control => {
        const row = control as FormGroup;
        const controlName = Object.keys(row.controls)[0];
        const [baseName] = String(controlName ?? '').split('|');
        if (!baseName) {
          return;
        }

        const matchedByGroup = messageFields.find(field =>
          String(field.fildKind ?? '').trim() === baseName &&
          (Number(field.instanceGroupId ?? 1) || 1) === groupInstanceId
        );
        const matched = matchedByGroup ?? messageFields.find(field => String(field.fildKind ?? '').trim() === baseName);
        if (!matched) {
          return;
        }

        row.get(controlName)?.patchValue((matched as any).fildTxt ?? null, { emitEvent: false });
      });
    };

    this.genericFormService.dynamicGroups.forEach(group => {
      assignGroupValues(group);
      (group.instances ?? []).forEach(instance => assignGroupValues(instance));
    });
  }

  private syncAttachmentsControl(): void {
    if (!this.ticketForm.contains('attachments')) {
      return;
    }

    const control = this.ticketForm.get('attachments');
    control?.patchValue([...(this.fileParameters ?? [])], { emitEvent: false });
    control?.updateValueAndValidity({ emitEvent: false });
  }

  private syncAttachmentValidators(): void {
    const control = this.ticketForm.get('attachments');
    if (!control) {
      return;
    }

    if (this.config?.attachmentConfig?.showAttachmentSection && this.config?.attachmentConfig?.isMandatory) {
      control.setValidators(this.attachmentsValidator.bind(this));
    } else {
      control.clearValidators();
    }

    control.updateValueAndValidity({ emitEvent: false });
  }

  private resolveCreatedBy(): string {
    const userId = localStorage.getItem('UserId') ?? '';
    const firstName = localStorage.getItem('firstName') ?? '';
    return `${userId} - ${firstName}`.trim();
  }
}
