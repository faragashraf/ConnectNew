import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges } from '@angular/core';
import { AbstractControl, FormArray, FormBuilder, FormGroup, ValidationErrors } from '@angular/forms';
import { Subscription, debounceTime, distinctUntilChanged } from 'rxjs';
import { GenericFormsService, GroupInfo } from 'src/app/Modules/GenericComponents/GenericForms.service';
import { ComponentConfig } from 'src/app/shared/models/Component.Config.model';
import { CdCategoryMandDto, MessageDto } from 'src/app/shared/services/BackendServices/DynamicForm/DynamicForm.dto';
import { FileParameter } from 'src/app/shared/services/BackendServices/dto-shared';
import { MsgsService } from 'src/app/shared/services/helper/msgs.service';
import { GenericDynamicFormGroupsFacadeService } from './generic-dynamic-form-groups-facade.service';
import { SUMMER_CANONICAL_FIELD_KEYS } from '../summer-shared/core/summer-field-aliases';

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
  @Input() submitDisabled = false;

  @Output() ticketFormChange = new EventEmitter<FormGroup>();
  @Output() submitFormChange = new EventEmitter<FormGroup>();
  @Output() genericEvent = new EventEmitter<any>();
  @Output() fileUploadEvent = new EventEmitter<FileParameter[]>();

  ticketForm: FormGroup = this.fb.group({});
  private readonly companionRelationFieldNames = [...SUMMER_CANONICAL_FIELD_KEYS.companionRelation];
  private readonly companionRelationOtherFieldNames = [...SUMMER_CANONICAL_FIELD_KEYS.companionRelationOther];

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
    this.buildDynamicInstancesFromMessage();
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

  shouldRenderControl(controlFullName: string, formArrayName: string): boolean {
    if (!this.isCompanionRelationOtherField(controlFullName)) {
      return true;
    }

    return this.isOtherRelationSelected(formArrayName);
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

  private buildDynamicInstancesFromMessage(): void {
    const messageFields = this.messageDto?.fields ?? [];
    if (!Array.isArray(messageFields) || messageFields.length === 0) {
      return;
    }

    const targetInstancesByGroup = new Map<number, number[]>();
    messageFields.forEach(field => {
      const groupId = Number((field as any)?.mendGroup ?? 0);
      const instanceGroupId = Number((field as any)?.instanceGroupId ?? 1);
      const normalizedGroupId = Number.isFinite(groupId) ? Math.floor(groupId) : 0;
      const normalizedInstanceId = Number.isFinite(instanceGroupId) ? Math.floor(instanceGroupId) : 1;

      if (normalizedGroupId <= 0 || normalizedInstanceId <= 1) {
        return;
      }

      const current = targetInstancesByGroup.get(normalizedGroupId) ?? [];
      if (!current.includes(normalizedInstanceId)) {
        current.push(normalizedInstanceId);
        targetInstancesByGroup.set(normalizedGroupId, current);
      }
    });

    targetInstancesByGroup.forEach((instanceIds, groupId) => {
      const parentGroup = this.genericFormService.dynamicGroups.find(item =>
        item.groupId === groupId && item.isExtendable
      );
      if (!parentGroup) {
        return;
      }

      const orderedInstanceIds = [...instanceIds].sort((a, b) => a - b);
      orderedInstanceIds.forEach(instanceId => {
        const exists = (parentGroup.instances ?? []).some(item =>
          Number(item.instanceGroupId ?? 0) === instanceId
        );
        if (exists) {
          return;
        }

        const created = this.groupsFacade.createDuplicateInstance(
          this.genericFormService.dynamicGroups,
          parentGroup.groupId,
          parentGroup.fields.length,
          0,
          instanceId
        );
        if (!created) {
          return;
        }

        const newInstance = created.newInstance;
        const assignedInstanceId = Number(newInstance.instanceGroupId ?? instanceId) || instanceId;
        const formArray = this.fb.array([]);
        this.ticketForm.addControl(newInstance.formArrayName, formArray);
        this.addControlsToArray(newInstance, formArray, assignedInstanceId, true);
      });
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

        const rawFieldValue = (matched as any).fildTxt ?? null;
        const normalizedFieldValue = this.normalizeFieldValueForControl(controlName, rawFieldValue);
        row.get(controlName)?.patchValue(normalizedFieldValue, { emitEvent: false });
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

  private isCompanionRelationOtherField(controlFullName: string): boolean {
    const baseName = this.extractBaseFieldName(controlFullName);
    return this.companionRelationOtherFieldNames
      .some(fieldName => this.normalizeFieldName(fieldName) === baseName);
  }

  private isOtherRelationSelected(formArrayName: string): boolean {
    const formArray = this.getFormArrayInstance(formArrayName);
    if (!formArray) {
      return false;
    }

    for (const rowControl of formArray.controls) {
      const row = rowControl as FormGroup;
      const controlName = Object.keys(row.controls)[0];
      if (!controlName) {
        continue;
      }

      const baseName = this.extractBaseFieldName(controlName);
      const isRelationField = this.companionRelationFieldNames
        .some(fieldName => this.normalizeFieldName(fieldName) === baseName);

      if (!isRelationField) {
        continue;
      }

      const value = row.get(controlName)?.value;
      if (this.isOtherRelationValue(value)) {
        return true;
      }
    }

    return false;
  }

  private isOtherRelationValue(value: unknown): boolean {
    const normalized = String(value ?? '')
      .trim()
      .toLowerCase()
      .replace(/[أإآ]/g, 'ا');

    return normalized === 'اخرى'
      || normalized === 'اخري'
      || normalized === 'other';
  }

  private extractBaseFieldName(controlFullName: string): string {
    const baseName = String(controlFullName ?? '').split('|')[0];
    return this.normalizeFieldName(baseName);
  }

  private normalizeFieldName(value: string): string {
    return String(value ?? '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }

  private normalizeFieldValueForControl(controlFullName: string, value: unknown): unknown {
    const controlType = String(this.genericFormService.GetPropertyValue(controlFullName, 'cdmendType') ?? '')
      .trim()
      .toLowerCase();
    const isBooleanControl = controlType.includes('toggle')
      || controlType.includes('switch')
      || controlType.includes('checkbox')
      || controlType.includes('boolean');

    if (!isBooleanControl) {
      return value;
    }

    const parsedBoolean = this.parseBooleanLike(value);
    if (parsedBoolean === null) {
      return value === null || value === undefined || String(value).trim().length === 0
        ? false
        : value;
    }

    return parsedBoolean;
  }

  private parseBooleanLike(value: unknown): boolean | null {
    if (typeof value === 'boolean') {
      return value;
    }

    const normalized = String(value ?? '').trim().toLowerCase();
    if (!normalized) {
      return null;
    }

    if (normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'y' || normalized === 'نعم') {
      return true;
    }

    if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'n' || normalized === 'لا') {
      return false;
    }

    return null;
  }

  private resolveCreatedBy(): string {
    const userId = localStorage.getItem('UserId') ?? '';
    const firstName = localStorage.getItem('firstName') ?? '';
    return `${userId} - ${firstName}`.trim();
  }
}
