import { Component, Input, Output, EventEmitter, SimpleChanges, IterableDiffers, IterableDiffer, KeyValueDiffers, KeyValueDiffer, OnInit } from '@angular/core';
import { SpinnerService } from 'src/app/shared/services/helper/spinner.service';
import { MsgsService } from 'src/app/shared/services/helper/msgs.service';
import { TreeNode } from 'primeng/api';
import { Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { GenericFormsService, GroupInfo } from 'src/app/Modules/GenericComponents/GenericForms.service';
import { PowerBiController } from 'src/app/Modules/enpopower-bi/services/PowerBi.service';
import { ComponentConfig, getAnyNode, parseToDate } from 'src/app/shared/models/Component.Config.model';
import { Router } from '@angular/router';
import { FormArray, FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { AuthObjectsService } from 'src/app/shared/services/helper/auth-objects.service';
import { DynamicFormController, AdministrativeCertificateController } from 'src/app/shared/services/BackendServices';
import { MessageDto, TkmendField } from 'src/app/shared/services/BackendServices/AdministrativeCertificate/AdministrativeCertificate.dto';
import { CdCategoryMandDto } from 'src/app/shared/services/BackendServices/DynamicForm/DynamicForm.dto';
import { FileParameter } from 'src/app/shared/services/BackendServices/dto-shared';

@Component({
  selector: 'app-form-details',
  templateUrl: './form-details.component.html',
  styleUrls: ['./form-details.component.scss']
})
export class FormDetailsComponent {
  // Snapshot of the form value used to detect real changes
  originalFormSnapshot: string = '';
  // Flag exposed to template to indicate whether form has pending edits
  formHasChanges: boolean = false;
  // pending timer used when taking a delayed snapshot to allow async loads to finish
  private _pendingSnapshotTimer: any = null;
  // true while component is populating the form programmatically
  private isPopulating: boolean = false;
  @Input() messageDto: MessageDto = {} as MessageDto;
  @Input() config: ComponentConfig = {} as ComponentConfig;
  @Input() isCurrentUser: boolean = false;

  @Input() tree: any[] = [];
  @Input() categoryTree: TreeNode[] = [];
  @Input() unitTree: TreeNode[] = [];
  @Input() formSubmited: boolean = false;
  @Input() fileParameters: FileParameter[] = [];
  @Input() customFilteredCategoryMand: CdCategoryMandDto[] = [];

  selectedNode: TreeNode = {} as TreeNode

  filtered_CategoryMand: CdCategoryMandDto[] = [];

  ticketForm: FormGroup = {} as FormGroup;
  @Output() ticketFormChange: EventEmitter<FormGroup> = new EventEmitter<FormGroup>();
  @Output() submitFormChange: EventEmitter<FormGroup> = new EventEmitter<FormGroup>();
  @Output() genericEvent: EventEmitter<any> = new EventEmitter<any>();
  @Output() fileUploadEvent: EventEmitter<FileParameter[]> = new EventEmitter<FileParameter[]>();

  displayedSubmissionLabel: string = '';
  private typewriterTimeout: any;

  private formChangesSub: Subscription | null = null;
  private categoryTreeDiffer: IterableDiffer<TreeNode> | null = null;
  private configDiffer: KeyValueDiffer<string, any> | null = null;
  private messageDtoDiffer: KeyValueDiffer<string, any> | null = null;
  /** Guard: last messageId for which populateForm() ran to prevent duplicate processing */
  private _lastPopulatedMessageId: number | null = null;
  // Prevent populateForm from running immediately after a save which may cause UI to reset
  private _recentlySaved: boolean = false;

  private hasNodeSelection(): boolean {
    const key = this.selectedNode?.key as any;
    if (key === null || key === undefined) return false;
    if (typeof key === 'string') return key.trim().length > 0;
    if (Array.isArray(key)) return key.length > 0;
    return true;
  }

  get isNewMode(): boolean {
    return !!this.config?.isNew;
  }

  get isNodeSelected(): boolean {
    return this.hasNodeSelection();
  }

  get showSelectionEditButton(): boolean {
    return this.isNodeSelected;
  }

  get showSelectedPathLabel(): boolean {
    return this.isNodeSelected;
  }

  get showCategoryTreeSidebar(): boolean {
    return this.isNewMode && !!this.categoryTree && this.categoryTree.length > 0 && !this.isNodeSelected;
  }

  get formContainerClass(): string {
    return (this.isNodeSelected || !this.isNewMode) || this.customFilteredCategoryMand.length > 0 ? 'col-md-12' : 'col-md-5';
  }

  get hideChoiceHint(): boolean {
    return this.isNodeSelected || !this.isNewMode;
  }

  get showTicketForm(): boolean {
    return !!this.ticketForm && (this.isNodeSelected || !this.isNewMode);
  }

  get showAttachmentsRow(): boolean {
    return this.isNodeSelected && !!this.config?.attachmentConfig?.showAttachmentSection && this.genericFormService.dynamicGroups.length > 0;
  }

  constructor(public genericFormService: GenericFormsService, private dynamicFormController: DynamicFormController,
    private spinner: SpinnerService, private msg: MsgsService, private router: Router, private administrativeCertificateController: AdministrativeCertificateController,
    private fb: FormBuilder, private powerBiController: PowerBiController, public authObjectsService: AuthObjectsService,
    private iterableDiffers: IterableDiffers, private keyValueDiffers: KeyValueDiffers
  ) {
    this.ticketForm = this.fb.group({});
  }

  private ensureConfigDefaults(): void {
    try {
      if (!this.config) this.config = new ComponentConfig();
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
      } else {
        // normalize maxDate if provided as string/number
        try {
          const md: any = (this.config.fieldsConfiguration as any).maxDate;
          const parsed = parseToDate(md);
          (this.config.fieldsConfiguration as any).maxDate = parsed as any;
        } catch (e) {
          // ignore parse errors
        }
        // ensure other boolean defaults exist
        (this.config.fieldsConfiguration as any).isDivDisabled = !!(this.config.fieldsConfiguration as any).isDivDisabled;
        (this.config.fieldsConfiguration as any).useDefaultRadioView = (this.config.fieldsConfiguration as any).useDefaultRadioView !== false;
        (this.config.fieldsConfiguration as any).isNotRequired = !!(this.config.fieldsConfiguration as any).isNotRequired;
      }
    } catch (e) {
      // swallow
    }
  }

  getGenericDataById(id: number, parameters?: string) {
    this.spinner.show('جاري تحميل البيانات ...');
    return this.powerBiController.getGenericDataById(id, parameters);
  }

  ngOnDestroy(): void {
    if (this.typewriterTimeout) clearTimeout(this.typewriterTimeout);
    this.formChangesSub?.unsubscribe();
    this.formChangesSub = null;
    if (this._pendingSnapshotTimer) {
      clearTimeout(this._pendingSnapshotTimer);
      this._pendingSnapshotTimer = null;
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['messageDto']) {
      const curr = changes['messageDto'].currentValue;
      // Reset the duplicate-call guard so a new messageDto gets processed
      this._lastPopulatedMessageId = null;
      if (!this.messageDtoDiffer && curr) {
        try {
          this.messageDtoDiffer = this.keyValueDiffers.find(curr).create();
        } catch (e) {
          // ignore if differ cannot be created
        }
      }
    }
    if (changes['categoryTree']) {
      const curr = changes['categoryTree'].currentValue;
      if (!this.categoryTreeDiffer && curr) {
        try {
          this.categoryTreeDiffer = this.iterableDiffers.find(curr).create();
        } catch (e) {
          // ignore if differ cannot be created
        }
      }
    }
    if (changes['config']) {
      const curr = changes['config'].currentValue;
      if (!this.configDiffer && curr) {
        try {
          this.configDiffer = this.keyValueDiffers.find(curr).create();
        } catch (e) {
          // ignore if differ cannot be created
        }
      }
      // ensure config has sensible defaults to avoid template errors
      try {
        this.ensureConfigDefaults();
      } catch (e) { }
      // If attachments control exists update its validators according to config
      try {
        if (this.ticketForm && (this.ticketForm as FormGroup).contains('attachments')) {
          const ctrl = (this.ticketForm as FormGroup).get('attachments') as AbstractControl;
          const acfg = (this.config as any).attachmentConfig || {};
          const shouldBeMandatory = !!(acfg && acfg.showAttachmentSection && acfg.isMandatory);
          if (shouldBeMandatory) {
            ctrl.setValidators(this.attachmentsValidator.bind(this));
          } else {
            ctrl.clearValidators();
          }
          ctrl.updateValueAndValidity({ onlySelf: true, emitEvent: false });
        }
      } catch (e) { }

      try {
        if ((this.config as any).routeKey == 'Publications/AddNew') {
          if (this.ticketForm && !(this.ticketForm as FormGroup).contains('menuItemId')) {
            (this.ticketForm as FormGroup).addControl('menuItemId', this.fb.control(null, Validators.required));
          }
        }

        // Trigger typewriter for submissionLabel if changed
        if (this.config && this.config.submissionLabel) {
          this.typewriter(this.config.submissionLabel);
        }

      } catch (e) { }
    }
    if (changes['formSubmited']) {
      const curr = changes['formSubmited'].currentValue;
      const prev = changes['formSubmited'].previousValue;
      // Reset the form only when the value transitions to true
      if (curr === true && prev !== true) {
        try {
          this.ticketForm?.reset();
        } catch (e) {
          // ignore reset errors
        }
      }
    }
  }

  ngDoCheck(): void {
    if (this.categoryTreeDiffer && this.categoryTree) {
      try {
        const diff = this.categoryTreeDiffer.diff(this.categoryTree);
        if (diff) {
          this.populateForm();
          if (this.config.selectedNodeKey && this.config.selectedNodeKey.length > 0) {
            this.selectedNode = getAnyNode(this.config.selectedNodeKey as string, this.categoryTree) as any;
            this.nodeSelection(this.selectedNode)
          }
        }
      } catch (e) {
        // ignore
      }
    }
    if (this.messageDtoDiffer && this.messageDto) {
      try {
        const diff = this.messageDtoDiffer.diff(this.messageDto);
        if (diff) {
          // tree mutated (items added/removed/changed)
          this.populateForm();
          if (this.config.selectedNodeKey && this.config.selectedNodeKey.length > 0) {
            this.selectedNode = getAnyNode(this.config.selectedNodeKey as string, this.categoryTree) as any;
            this.nodeSelection(this.selectedNode)
          }
        }
      } catch (e) {
        // ignore
      }
    }
    if (this.configDiffer && this.config) {
      try {
        const diff = this.configDiffer.diff(this.config);
        if (diff) {
          // processRequestsAndPopulate(this, this.genericFormService);
          // this.populateForm();
        }
      } catch (e) {
        // ignore
      }
    }
  }
  typewriter(text: string) {
    if (this.typewriterTimeout) clearTimeout(this.typewriterTimeout);
    this.displayedSubmissionLabel = '';
    if (!text) return;

    let i = 0;
    const type = () => {
      if (i < text.length) {
        this.displayedSubmissionLabel += text.charAt(i);
        i++;
        // Speed doubled: reduce delay per character from 50ms to 25ms
        this.typewriterTimeout = setTimeout(type, 25);
      } else {
        // Also halve the pause before restarting (1000ms -> 500ms)
        this.typewriterTimeout = setTimeout(() => {
          this.displayedSubmissionLabel = '';
          i = 0;
          type();
        }, 500);
      }
    };
    type();
  }
  initForm() {
    const formConfig: any = {
      tkCategoryCd: [null],
      messageID: [null],
      subject: [null],
      createdBy: [
        localStorage.getItem('UserId') + ' - ' +
        localStorage.getItem('firstName')
      ]
    };

    // Add dynamic FormArrays for each group (including any existing instances)
    this.genericFormService.dynamicGroups.forEach(group => {
      formConfig[group.formArrayName] = this.fb.array([]);
      if (group.instances && group.instances.length > 0) {
        group.instances.forEach(inst => {
          formConfig[inst.formArrayName] = this.fb.array([]);
        });
      }
    });

    try {
      if (this.config && this.config.isNew) {
        const acfg = (this.config as any).attachmentConfig || {};
        const makeMandatory = !!(acfg && acfg.showAttachmentSection && acfg.isMandatory);
        formConfig['attachments'] = [[], makeMandatory ? this.attachmentsValidator.bind(this) : null];
      }
    } catch (e) { formConfig['attachments'] = [[]]; }

    this.ticketForm = this.fb.group(formConfig);
    this.subscribeToFormChanges();
  }

  attachmentsValidator(control: AbstractControl): ValidationErrors | null {
    try {
      const acfg = (this.config as any).attachmentConfig || {};
      const shouldRequire = !!(acfg && acfg.showAttachmentSection && acfg.isMandatory);
      if (!shouldRequire) return null;
      const val = control && control.value;
      if (!val) return { required: true };
      if (Array.isArray(val) && val.length === 0) return { required: true };
      return null;
    } catch (e) {
      return null;
    }
  }

  private subscribeToFormChanges(): void {
    // Unsubscribe previous subscription if any
    if (this.formChangesSub) {
      this.formChangesSub.unsubscribe();
      this.formChangesSub = null;
    }

    if (!this.ticketForm) return;

    this.formChangesSub = this.ticketForm.valueChanges.pipe(
      debounceTime(1000),
      distinctUntilChanged((prev: any, curr: any) => {
        try {
          return JSON.stringify(prev) === JSON.stringify(curr);
        } catch (e) {
          return prev === curr;
        }
      })
    ).subscribe((value) => {
      this.genericFormService.logValidationErrors(this.ticketForm);
      // If we are currently populating the form programmatically, ignore these changes
      if (this.isPopulating) {
        // still emit the current form for listeners, but do not mark as user-edited
        try { this.ticketFormChange.emit(this.ticketForm); } catch (e) { }
        return;
      }

      // Determine whether form differs from original snapshot (real edits)
      try {
        const current = JSON.stringify(this.ticketForm.getRawValue ? this.ticketForm.getRawValue() : this.ticketForm.value);
        this.formHasChanges = current !== this.originalFormSnapshot;
      } catch (e) {
        this.formHasChanges = true;
      }

      // Emit the current form only when actual changes detected
      try {
        this.ticketFormChange.emit(this.ticketForm);
      } catch (e) {
        // swallow emitter errors
      }
    });
  }

  // Reset snapshot after populate or successful save.
  // If delayMs > 0, schedule snapshot after that delay; if the user edits during the delay,
  // the scheduled snapshot will be skipped to avoid overriding real user edits.
  private resetFormSnapshot(delayMs: number = 0): void {
    try {
      // clear any previously scheduled snapshot
      if (this._pendingSnapshotTimer) {
        clearTimeout(this._pendingSnapshotTimer);
        this._pendingSnapshotTimer = null;
      }

      const takeSnapshot = () => {
        try {
          const raw = this.ticketForm && this.ticketForm.getRawValue ? this.ticketForm.getRawValue() : (this.ticketForm ? this.ticketForm.value : {});
          this.originalFormSnapshot = JSON.stringify(raw ?? {});
          this.formHasChanges = false;
          if (this.ticketForm && typeof (this.ticketForm as any).markAsPristine === 'function') {
            try { (this.ticketForm as any).markAsPristine(); } catch (e) { }
          }
        } catch (e) { }
      };

      if (delayMs && delayMs > 0) {
        // schedule snapshot but only apply it if user didn't edit meanwhile
        this.isPopulating = true;
        this._pendingSnapshotTimer = setTimeout(() => {
          this._pendingSnapshotTimer = null;
          if (!this.formHasChanges) takeSnapshot();
          this.isPopulating = false;
        }, delayMs);
      } else {
        takeSnapshot();
        this.isPopulating = false;
      }
    } catch (e) { }
  }

  populateForm() {
    if (this._recentlySaved) return;
    if (this.customFilteredCategoryMand && this.customFilteredCategoryMand.length > 0) {
      // this.filtered_CategoryMand = [...this.customFilteredCategoryMand];
      this.genericFormService.organizeFieldsByGroups(this.customFilteredCategoryMand);
      this.initForm();
      this.ticketForm.get('tkCategoryCd')?.patchValue(this.customFilteredCategoryMand[0]?.mendCategory);
      // Bind existing values if present in message fields
      if (this.messageDto?.fields && this.messageDto.fields.length > 0) {
        this.genericFormService.dynamicGroups.forEach(group => {
          const formArray = this.genericFormService.getFormArray(group.formArrayName, this.ticketForm);
          // If only 1 instance per field
          let idx = 0;
          group.fields.forEach((field) => {
            const ctrlName = `${field.mendField}|${idx}`;
            const matched = this.messageDto.fields?.find(f => f.fildKind === field.mendField);
            this.genericFormService.addFormArrayWithValidators(ctrlName, formArray, this.config?.fieldsConfiguration?.isNotRequired);
            // (formArray.controls[0] as FormGroup).get(ctrlName)?.patchValue(matched.fildTxt);
            if (matched && formArray.controls[0]) {

            }
            idx++;
          });
            // debug log removed
          // this.config.fieldsConfiguration.isDivDisabled = false;
          // const foundKey = this.config?.tkCategoryCds?.find(cd => String(cd.value) === String(this.messageDto?.categoryCd))?.key;
          // this.selectedNode = getAnyNode(foundKey as any, this.categoryTree) as any;
          // this.nodeSelection(this.selectedNode);
        });
      } else {
        this.genericFormService.dynamicGroups.forEach(group => {
          const formArray = this.genericFormService.getFormArray(group.formArrayName, this.ticketForm);
          group.fields.forEach((field, index) => {
            const ctrlName = `${field.mendField}|${index}`;
            this.genericFormService.addFormArrayWithValidators(ctrlName, formArray, this.config?.fieldsConfiguration?.isNotRequired);
          });
        });
      }
      this.resetFormSnapshot(1500);
      return;
    }
    let _key = this.config?.tkCategoryCds?.find(cd => cd.key === this.messageDto.categoryCd)?.key;
    if (_key === undefined) {
      _key = this.config?.tkCategoryCds?.find(cd => cd.value.toString() === this.messageDto.categoryCd?.toString())?.key;
    }
    // If editing and messageDto contains field metadata, build filtered list from messageDto.fields
    if (!this.config?.isNew && this.messageDto?.fields && this.messageDto.fields.length > 0) {
      // Guard: skip if we already populated this exact message (prevents ngDoCheck double-run)
      const currentMsgId = (this.messageDto as any).messageId ?? (this.messageDto as any).id ?? null;
      if (currentMsgId != null && currentMsgId === this._lastPopulatedMessageId) {
        return;
      }
      this._lastPopulatedMessageId = currentMsgId;

      // (debug logs removed) Organize fields by groups and initialize form
      this.genericFormService.organizeMessageFieldsByGroups(this.messageDto.fields as TkmendField[]);

      this.initForm();
      this.ticketForm.get('tkCategoryCd')?.patchValue(_key);
      // Prepare instance ids per group based on instanceGroupId present on message fields
      // Normalize so client-side instance numbering starts at 1 and increments.
      const instanceIdsRawMap: Record<number, number[]> = {};
      const instanceIdsMap: Record<number, number[]> = {};
      // Keep a mapping from normalized → raw so we can match against server data
      const normalizedToRawMap: Record<number, Record<number, number>> = {};
      if (this.messageDto?.fields) {
        this.messageDto.fields.forEach(f => {
          const g = Number(f.mendGroup || 0);
          const inst = (f.instanceGroupId ?? 0) as number;
          instanceIdsRawMap[g] = instanceIdsRawMap[g] || [];
          if (instanceIdsRawMap[g].indexOf(inst) === -1) instanceIdsRawMap[g].push(inst);
        });

        // For each group, normalize: if raw contains 0, map 0 -> 1 and shift other positive ids by +1
        Object.keys(instanceIdsRawMap).forEach(k => {
          const key = Number(k);
          const raw = instanceIdsRawMap[key] || [];
          const hasZero = raw.indexOf(0) !== -1;
          let normalized = raw.map(v => v);
          if (hasZero) {
            normalized = raw.map(v => v === 0 ? 1 : (v + 1));
          }
          // dedupe and sort
          normalized = Array.from(new Set(normalized)).sort((a, b) => a - b);
          instanceIdsMap[key] = normalized;
          // Build reverse mapping: normalized → raw
          normalizedToRawMap[key] = {};
          for (let i = 0; i < raw.length; i++) {
            const normVal = hasZero ? (raw[i] === 0 ? 1 : (raw[i] + 1)) : raw[i];
            normalizedToRawMap[key][normVal] = raw[i];
          }
        });
      }
      // debug maps removed
      // For each group, create base controls and create extra instances when needed
      this.genericFormService.dynamicGroups.forEach(group => {
        const formArray = this.genericFormService.getFormArray(group.formArrayName, this.ticketForm);

        // Determine instance ids for this group
        const instanceIds = instanceIdsMap[group.groupId] || [];
        const hasMultipleInstances = instanceIds.length > 1;

        // processing group %s

        // Determine fieldsPerInstance using multiple strategies:
        // 1) If we know how many instances exist, divide total fields by instance count
        // 2) Fallback: detect repeating sequence of field names
        let fieldsPerInstance = Math.max(1, group.fields.length);
        if (group.isExtendable || hasMultipleInstances) {
          // Strategy 1: divide by known instance count (most reliable)
          if (instanceIds.length > 1 && group.fields.length >= instanceIds.length) {
            const divided = Math.floor(group.fields.length / instanceIds.length);
            if (divided > 0 && divided * instanceIds.length === group.fields.length) {
              fieldsPerInstance = divided;
            }
          }
          // Strategy 2: detect repeat in field names (fallback)
          if (fieldsPerInstance === group.fields.length) {
            const seen: string[] = [];
            for (const f of group.fields) {
              const name = (f.mendField || '').toString();
              if (seen.indexOf(name) !== -1) break;
              seen.push(name);
            }
            if (seen.length > 0 && seen.length < group.fields.length) {
              fieldsPerInstance = seen.length;
            }
          }
          // fieldsPerInstance calculation completed
        }

        // Add base controls: take only the first instance's fields when instances exist,
        // otherwise take the whole group's fields.
        const baseFields = (group.isExtendable || hasMultipleInstances)
          ? group.fields.slice(0, fieldsPerInstance)
          : group.fields;

        const baseInstanceId = instanceIds.length > 0 ? instanceIds[0] : undefined;
        // Get the raw (server) instance ID for matching against messageDto.fields
        const baseRawInstanceId = (baseInstanceId !== undefined && normalizedToRawMap[group.groupId])
          ? (normalizedToRawMap[group.groupId][baseInstanceId] ?? baseInstanceId) : (baseInstanceId ?? 0);

        // Ensure the group has a base instanceGroupId (start at 1) when it has instances
        if (group.isExtendable || hasMultipleInstances) {
          group.instanceGroupId = baseInstanceId ?? ((group.instanceGroupId === 0) ? 1 : group.instanceGroupId) ?? 1;
        }

        // Assign client indexes for base fields so each control key is unique per instance
        baseFields.forEach((field, index) => {
          const instIdForField = baseInstanceId ?? (group.instanceGroupId ?? 1);
          (field as any).__clientIndex = `${instIdForField}_${(field as any).mendSql ?? index}`;
          this.genericFormService.addFormArrayWithValidators(`${field.mendField}|${(field as any).__clientIndex}`, formArray);
        });

        // Populate base instance (consume first instance's values) — use RAW instance ID for matching
        try {
          for (let idx = 0; idx < baseFields.length; idx++) {
            const field = baseFields[idx];
            const clientIdx = (field as any).__clientIndex ?? field.mendSql ?? idx;
            const ctrlName = `${field.mendField}|${clientIdx}`;
            const _filed = this.messageDto.fields?.find(f => (f.instanceGroupId ?? 0) === baseRawInstanceId && f.fildSql == field.mendSql);
            if (_filed) {
              const value = _filed.fildTxt;
              this.genericFormService.setControlValue(formArray, ctrlName, value);
            }
          }
        } catch (e) {
          // ignore
        }

        // Create extra instances when the group is extendable OR the data has multiple instanceGroupIds
        if (group.isExtendable || hasMultipleInstances) {
          const otherInstanceIds = (instanceIds.length > 1) ? instanceIds.slice(1) : [];

          for (let i = 0; i < otherInstanceIds.length; i++) {
            const instId = otherInstanceIds[i];
            const overallIndex = instanceIds.indexOf(instId);
            const created = this.duplicateGroup(group.groupId, fieldsPerInstance, overallIndex, instId) as GroupInfo | null;
            if (created) {
              const newFa = this.ticketForm.get(created.formArrayName) as FormArray | null;
              if (!newFa) continue;
              // Compute raw instance ID for matching against server data
              const instRawId = (normalizedToRawMap[group.groupId]) ? (normalizedToRawMap[group.groupId][instId] ?? instId) : instId;
              try {
                for (let idx = 0; idx < created.fields.length; idx++) {
                  const field = created.fields[idx];
                  const clientIdx = (field as any).__clientIndex ?? field.mendSql ?? idx;
                  const ctrlName = `${field.mendField}|${clientIdx}`;
                  const _filed = this.messageDto.fields?.find(f => (f.instanceGroupId ?? 0) === instRawId && f.fildSql == field.mendSql);
                  if (_filed) {
                    const value = _filed.fildTxt;
                    this.genericFormService.setControlValue(newFa, ctrlName, value);
                  }
                }
              } catch (e) {
              }
            }
          }

          // Trim group.fields to only the base instance's unique fields
          // so the base tab's [filtered_CategoryMand] doesn't include other instances' fields
          if (fieldsPerInstance > 0 && fieldsPerInstance < group.fields.length) {
            group.fields = baseFields;
          }
        }
      });

      // final debug logs removed

      // Set subject / IDs
      this.ticketForm.get('subject')?.patchValue(this.messageDto.subject);
      this.ticketForm.get('messageID')?.patchValue(this.messageDto.messageId);
      // snapshot current form state — no edits yet
      this.resetFormSnapshot(1500);
      this.ticketForm.get('createdBy')?.patchValue(this.messageDto.createdBy);
    } else {
      // Map messageDto.fields to CdCategoryMandDto-like objects so organizer can consume them
      this.filtered_CategoryMand = this.genericFormService.cdCategoryMandDto.map(f => ({
        mendSql: f.mendSql,
        mendCategory: f.mendCategory,
        mendField: f.mendField,
        mendStat: f.mendStat,
        mendGroup: f.mendGroup,
        groupName: f.groupName,
        isExtendable: f.isExtendable,
        groupWithInRow: f.groupWithInRow,
        applicationId: f.applicationId
      } as any as CdCategoryMandDto));
      // Default behavior: use metadata from service
      this.filtered_CategoryMand = this.genericFormService.cdCategoryMandDto.filter(f =>
        f.mendCategory.toString() == _key?.toString());
      this.initForm();
      // snapshot initial (empty/new) form state (delay to allow async loads)
      this.resetFormSnapshot(1500);
    }
  }

  // Template-safe helper: return controls array or empty array to avoid null access in template
  getFormArrayControls(formArrayName: string): any[] {
    try {
      const fa = this.genericFormService.getFormArray(formArrayName, this.ticketForm);
      return (fa && fa.controls) ? fa.controls : [];
    } catch (e) {
      return [];
    }
  }

  // Template helper to return the FormArray instance or null
  getFormArrayInstance(formArrayName: string): FormArray | null {
    try {
      const fa = this.genericFormService.getFormArray(formArrayName, this.ticketForm);
      return fa ?? null;
    } catch (e) {
      return null;
    }
  }

  private findGroupByIdRecursive(groupId: number, groups: GroupInfo[], parent: GroupInfo | null = null): { group?: GroupInfo, parent?: GroupInfo | null } {
    for (const g of groups) {
      if (g.groupId === groupId) {
        return { group: g, parent };
      }
      if (g.instances && g.instances.length > 0) {
        const found = this.findGroupByIdRecursive(groupId, g.instances, g);
        if (found.group) return found;
      }
    }
    return {} as any;
  }

  private getMaxGroupIdRecursive(groups: GroupInfo[]): number {
    let max = 0;
    for (const g of groups) {
      if (g.groupId > max) max = g.groupId;
      if (g.instances && g.instances.length > 0) {
        const childMax = this.getMaxGroupIdRecursive(g.instances);
        if (childMax > max) max = childMax;
      }
    }
    return max;
  }

  duplicateGroup(groupId: number, fieldsPerInstance?: number, instanceIndex: number = 0, instanceGroupId?: number): GroupInfo | null {
    const found = this.findGroupByIdRecursive(groupId, this.genericFormService.dynamicGroups);
    if (!found.group) {
      this.msg.msgError('خطأ', `<h5>المجموعة ${groupId} غير موجودة</h5>`, true);
      return null;
    }

    const sourceGroup = found.group as GroupInfo;
    const parent = found.parent || null;

    // Determine new group id using recursive max
    const maxId = this.getMaxGroupIdRecursive(this.genericFormService.dynamicGroups);
    let newGroupId = maxId + 1;
    if (newGroupId <= 9) newGroupId = 10;

    const newFormArrayName = `${sourceGroup.formArrayName}_inst_${newGroupId}`;

    // Determine newFields for the instance. For extendable groups we create the same
    // slice size as the base (fieldsPerInstance) so each instance has the same set
    // of controls. If none provided, copy the full group's fields.
    let newFields: any[] = [];
    if (typeof fieldsPerInstance === 'number' && fieldsPerInstance > 0) {
      const idx = (typeof instanceIndex === 'number' && instanceIndex >= 0) ? instanceIndex : 0;
      const start = idx * fieldsPerInstance;
      const end = start + fieldsPerInstance;
      newFields = sourceGroup.fields.slice(start, end).map(f => ({ ...f }));
      // If slice returned fewer fields (edge case), pad from start to ensure consistent field set
      if (newFields.length < fieldsPerInstance) {
        const pad = sourceGroup.fields.slice(0, Math.max(0, fieldsPerInstance - newFields.length)).map(f => ({ ...f }));
        newFields = newFields.concat(pad);
      }
    } else {
      newFields = sourceGroup.fields.map(f => ({ ...f }));
    }

    // Compute next instanceGroupId starting from 1 when not provided.
    let assignedInstanceGroupId: number;
    if (instanceGroupId !== undefined && instanceGroupId !== null) {
      // If server provided 0, normalize to 1; otherwise keep as-is
      assignedInstanceGroupId = (instanceGroupId === 0) ? 1 : instanceGroupId;
    } else {
      // collect existing instanceGroupIds under same source group (including top-level group's instanceGroupId if present)
      const siblingInstances = parent ? (parent.instances || []) : (sourceGroup.instances || []);
      const rawExisting: any[] = [];
      if (sourceGroup.instanceGroupId !== undefined && sourceGroup.instanceGroupId !== null) rawExisting.push(sourceGroup.instanceGroupId);
      siblingInstances.forEach(i => { if ((i as any).instanceGroupId !== undefined && (i as any).instanceGroupId !== null) rawExisting.push((i as any).instanceGroupId); });

      // Parse numeric ids robustly and take max+1. Fallback to 1 when nothing valid.
      const numericIds = rawExisting.map(x => Number(x)).filter(n => !isNaN(n) && isFinite(n) && n > 0);
      const maxExisting = numericIds.length > 0 ? Math.max(...numericIds) : 0;
      assignedInstanceGroupId = maxExisting + 1;
      if (!assignedInstanceGroupId || assignedInstanceGroupId <= 0) assignedInstanceGroupId = 1;
    }

    const newInstance: GroupInfo = {
      groupName: sourceGroup.groupName + ' (نسخة)',
      groupId: newGroupId,
      formArrayName: newFormArrayName,
      fields: newFields,
      isDuplicated: true,
      isExtendable: !!sourceGroup.isExtendable,
      instances: [],
      originGroupId: sourceGroup.groupId,
      instanceGroupId: assignedInstanceGroupId
    };

    // duplicateGroup: created newInstance

    if (sourceGroup.isExtendable) {
      // Enforce instance limits if configured in GenericFormsService
      try {
        const limitMap = this.genericFormService.instanceLimits || {};
        // check if any of the group's fields match a limited field
        for (const f of newFields) {
          const mend = (f as any).mendField as string | undefined;
          if (!mend) continue;
          const limit = limitMap[mend];
          if (limit !== undefined && limit !== null) {
            // count existing instances of this field across top-level and nested FormArrays
            let existing = 0;
            const fg = this.ticketForm as FormGroup;
            for (const key of Object.keys(fg.controls)) {
              if (key.startsWith(mend + '|')) { existing++; continue; }
              const ctrl = fg.controls[key];
              if (ctrl instanceof FormArray) {
                for (const child of ctrl.controls) {
                  if (child instanceof FormGroup) {
                    for (const childKey of Object.keys(child.controls)) {
                      if (childKey.startsWith(mend + '|')) existing++;
                    }
                  }
                }
              }
            }
            if (existing >= limit) {
              this.msg.msgError('غير مسموح', `<h5>لا يمكن إضافة المزيد من ${this.genericFormService.GetPropertyValue(mend + '|0','cdMendLbl') || mend} — الحد الأقصى ${limit}</h5>`, true);
              return null;
            }
          }
        }
      } catch (e) {
        // swallow — don't block add if check fails
      }
      // If the group is nested (has a parent), add the new instance as a sibling under the parent
      if (parent) {
        parent.instances = parent.instances || [];
        parent.instances.push(newInstance);
      } else {
        // top-level group that supports instances: add instance to the group's instances
        sourceGroup.instances = sourceGroup.instances || [];
        sourceGroup.instances.push(newInstance);
      }

      // Create new FormArray control on the form (skip if exists)
      let newArray: FormArray;
      if ((this.ticketForm as FormGroup).contains(newFormArrayName)) {
        newArray = (this.ticketForm as FormGroup).get(newFormArrayName) as FormArray;
      } else {
        newArray = this.fb.array([]);
        (this.ticketForm as FormGroup).addControl(newFormArrayName, newArray);
      }

      // Populate the new FormArray with controls for each field.
      // Use a client-side unique index for the control name so multiple instances don't share identical control keys.
      // Important: use the local index (not server mendSql) so new instances do not carry an existing fildSql.
      newFields.forEach((field, index) => {
        const clientIndex = `${assignedInstanceGroupId}_c${index}`;
        (field as any).__clientIndex = clientIndex;
        this.genericFormService.addFormArrayWithValidators(`${field.mendField}|${clientIndex}`, newArray, this.config?.fieldsConfiguration?.isNotRequired);
      });

      return newInstance;
    }

    // Fallback: add instance under the source group (do not create a top-level group)
    sourceGroup.instances = sourceGroup.instances || [];
    sourceGroup.instances.push(newInstance);

    // Create new FormArray control on the form (skip if exists)
    let fallbackArray: FormArray;
    if ((this.ticketForm as FormGroup).contains(newFormArrayName)) {
      fallbackArray = (this.ticketForm as FormGroup).get(newFormArrayName) as FormArray;
    } else {
      fallbackArray = this.fb.array([]);
      (this.ticketForm as FormGroup).addControl(newFormArrayName, fallbackArray);
    }

    // Populate the new FormArray with controls for each field (use client index naming)
    newFields.forEach((field, index) => {
      const clientIndex = `${assignedInstanceGroupId}_c${index}`;
      (field as any).__clientIndex = clientIndex;
      this.genericFormService.addFormArrayWithValidators(`${field.mendField}|${clientIndex}`, fallbackArray);
    });

    this.msg.msgSuccess(`تم النسخ: تم إضافة نسخة من المجموعة ${groupId} كمثيل داخل ${sourceGroup.groupName}`);
    return newInstance;
  }

  deleteGroup(groupId: number): void {
    if (groupId <= 9) {
      this.msg.msgError('غير مسموح', '<h5>لا يمكن حذف المجموعة الأساسية</h5>', true);
      return;
    }
    const found = this.findGroupByIdRecursive(groupId, this.genericFormService.dynamicGroups);
    if (!found.group) {
      this.msg.msgError('خطأ', `<h5>المجموعة ${groupId} غير موجودة</h5>`, true);
      return;
    }

    const target = found.group as GroupInfo;
    const parent = found.parent || null;

    this.msg.msgConfirm(`هل تريد حذف المجموعة ${target.groupName}؟`, 'حذف')
      .then(result => {
        if (result == true) {
          const formArrayName = target.formArrayName;

          // Remove the FormArray control from the form if exists
          if ((this.ticketForm as FormGroup).contains(formArrayName)) {
            (this.ticketForm as FormGroup).removeControl(formArrayName);
          }

          if (parent) {
            // remove from parent's instances
            parent.instances = parent.instances?.filter(i => i.groupId !== groupId) ?? [];
          } else {
            // top-level group
            this.genericFormService.dynamicGroups = this.genericFormService.dynamicGroups.filter(g => g.groupId !== groupId);
          }

          this.msg.msgSuccess(`تم الحذف: تم حذف المجموعة ${groupId}`);
        }
      })
  }
  onFileChange(event: any) {
    console.log(event);
    this.fileParameters = event;
    this.fileUploadEvent.emit(this.fileParameters);
    try {
      if (this.ticketForm && (this.ticketForm as FormGroup).contains('attachments')) {
        const ctrl = (this.ticketForm as FormGroup).get('attachments') as AbstractControl;
        ctrl.patchValue(this.fileParameters);
        ctrl.updateValueAndValidity();
      }
    } catch (e) { }
  }

  handleEvent(event: any) {
    try { this.genericEvent.emit(event); console.debug(event); } catch (e) { }
  }
  onSubmitClick(): void {
    try {
      this.submitFormChange.emit(this.ticketForm);
      console.debug('Form submitted', this.ticketForm.value);
    } catch (e) {
      // ignore emit errors
    }
  }
  nodeSelection(event: any) {
    this.selectedNode = event.node ?? event;
    this.genericFormService.validationMessages = []
    this.genericFormService.formErrors = []
    this.filtered_CategoryMand = [];

    this.filtered_CategoryMand = this.genericFormService.cdCategoryMandDto
      .filter(f =>
        !this.genericFormService.isHiddenField(f.mendField as string) && f.mendCategory == Number(this.selectedNode.key))

    // Organize fields by groups and create dynamic FormArrays
    this.genericFormService.organizeFieldsByGroups(this.filtered_CategoryMand);
    this.initForm(); // Reinitialize form with dynamic groups

    this.ticketForm.get('tkCategoryCd')?.patchValue(this.selectedNode.key);
    this.ticketForm.get('subject')?.patchValue(`طلب ${this.selectedNode.label} - ${localStorage.getItem('firstName')}`);

    // Populate dynamic group fields
    this.genericFormService.dynamicGroups.forEach(group => {
      const formArray = this.genericFormService.getFormArray(group.formArrayName, this.ticketForm);
      group.fields.forEach((field, index) => {
        const ctrlName = `${field.mendField}|${index}`;
        this.genericFormService.addFormArrayWithValidators(ctrlName, formArray, this.config?.fieldsConfiguration?.isNotRequired);
        let value = '';

        if (this.config.isNew === true) {
          const userProfile = (this.authObjectsService.getUserProfile() as any) ?? (this.authObjectsService as any).getUserProfile?.();
          try {
            const rawFieldName = (ctrlName.split('|')[0] || '').toString();
            const parts = rawFieldName.split('_');
          
            if (parts.length > 1 && parts[0] === 'Emp' && !this.authObjectsService.checkAuthFun('NonWorkerEnpoUsersFunc')) {
              const key = parts.slice(1).join('_');
              if (key.toLowerCase() === 'name') {
                value = userProfile?.userDisplayName ?? userProfile?.displayName ?? localStorage.getItem('firstName') ?? '';
              } else if (key.toLowerCase() === 'id') {
                value = userProfile?.userId ?? userProfile?.UserId ?? localStorage.getItem('UserId') ?? '';
              } else if (key.toLowerCase() === 'nid' || key.toLowerCase() === 'nationalid' || key.toLowerCase() === 'national_id') {
                value = userProfile?.nationalId ?? userProfile?.nid ?? userProfile?.nationalID ?? '';
              }
              else if (key.toLowerCase() === 'mobilenumber') {
                value = userProfile?.MobileNumber ?? '';
              }

              // set mapped value and skip fallback to messageDto
              this.genericFormService.setControlValue(formArray, ctrlName, value);
              return;
            }
          } catch (e) {
            // ignore mapping errors and fall back to existing behavior
          }
        }

        const _filed = this.messageDto.fields?.find(f => f.fildKind == field.mendField);
        if (_filed) {
          value = _filed.fildTxt as string;
          this.genericFormService.setControlValue(formArray, ctrlName, value);
        }
      });
    });
      // snapshot newly initialized form (no edits yet) after a short delay
      this.resetFormSnapshot(1500);
  }
  nodeUnselection(event: any) {
    console.log({} as TreeNode);
  }

  // Return an array representing the path from root to the node with the given key
  private findPathByKey(key: any, nodes: TreeNode[] | undefined): TreeNode[] {
    if (!nodes || !nodes.length) return [];
    for (const n of nodes) {
      if (n.key == key) return [n];
      if (n.children && n.children.length > 0) {
        const childPath = this.findPathByKey(key, n.children as TreeNode[]);
        if (childPath && childPath.length) return [n, ...childPath];
      }
    }
    return [];
  }

  // Public helper used by template to show the selected node and its parents in order
  getSelectedNodePath(): string {
    try {
      if (!this.selectedNode || !this.selectedNode.key) return '';
      const pathNodes = this.findPathByKey(this.selectedNode.key, this.categoryTree as TreeNode[]);
      if (!pathNodes || pathNodes.length === 0) return (this.selectedNode.label as string) || '';
      // join labels from root -> ... -> selected
      const labels = pathNodes.map(n => (n.label as string) || '');
      return labels.join(' > ');
    } catch (e) {
      return (this.selectedNode?.label as string) || '';
    }
  }
  clearTreeSelection(): void {
    this.selectedNode = {} as TreeNode;
    this.filtered_CategoryMand = [];
    this.genericFormService.dynamicGroups = [];
    // clear any selected files and notify listeners
    this.fileParameters = [];
    try { this.fileUploadEvent.emit(this.fileParameters); } catch (e) { }

    if (this.ticketForm) {
      this.ticketForm.get('tkCategoryCd')?.patchValue(null);
      try {
        if ((this.ticketForm as FormGroup).contains('attachments')) {
          const ctrl = (this.ticketForm as FormGroup).get('attachments') as AbstractControl;
          ctrl.patchValue([]);
          ctrl.updateValueAndValidity();
        }
      } catch (e) { }
    }

    this.initForm();
  }


  cancelEdit() {
    // reset form values to original messageDto values and disable editing
    // this.initForm();
    this.populateForm();
    if (this.config?.fieldsConfiguration) { this.config.fieldsConfiguration.isDivDisabled = true; }
  }
  private collectGroupFields(group: GroupInfo, requestModel: TkmendField[]): void {
    const formArray = this.genericFormService.getFormArray(group.formArrayName, this.ticketForm);
    if (!formArray) return;
    formArray.controls.forEach(grp => {
      const formGroup = grp as FormGroup;
      const controlName = Object.keys(formGroup.controls)[0];
      const [name, i] = controlName.split('|');
      const parts = (i || '').toString().split('_');
      const possibleSql = Number(parts[parts.length - 1]);
      const mendSql = Number.isNaN(possibleSql) ? undefined : possibleSql;

      const fieldMeta = group.fields?.find(f => (f.mendField?.toString() || '') === (name || '') && (f.mendSql === mendSql || mendSql === undefined));
      const instanceGroupId = (parts.length > 1 && !Number.isNaN(Number(parts[0]))) ? Number(parts[0]) : (group.instanceGroupId ?? undefined);
      const categoryVal = this.ticketForm?.get('tkCategoryCd')?.value ?? this.messageDto?.categoryCd;

      const rawValue = formGroup.controls[controlName].value;
      let safeFildTxt: string | null = null;
      try {
        if (rawValue === null || rawValue === undefined) {
          safeFildTxt = null;
        } else if (typeof rawValue === 'string') {
          safeFildTxt = rawValue;
        } else if (rawValue instanceof Date) {
          safeFildTxt = rawValue.toISOString();
        } else if (typeof rawValue === 'object') {
          try { safeFildTxt = JSON.stringify(rawValue); } catch (e) { safeFildTxt = String(rawValue); }
        } else {
          safeFildTxt = String(rawValue);
        }
      } catch (e) {
        safeFildTxt = String(rawValue);
      }

      const item: any = {
        fildRelted: this.messageDto?.messageId,
        fildSql: mendSql ?? 0,
        fildKind: name,
        fildTxt: safeFildTxt,
        mendSql: mendSql ?? fieldMeta?.mendSql,
        mendCategory: Number(categoryVal) || fieldMeta?.mendCategory,
        mendStat: fieldMeta?.mendStat ?? false,
        mendGroup: fieldMeta?.mendGroup ?? group.groupId,
        applicationId: fieldMeta?.applicationId ?? undefined,
        groupName: fieldMeta?.groupName ?? group.groupName,
        isExtendable: fieldMeta?.isExtendable ?? group.isExtendable ?? false,
        groupWithInRow: fieldMeta?.groupWithInRow ?? undefined,
        instanceGroupId: instanceGroupId ?? undefined
      } as any;

      requestModel.push(item);
    });
  }

  Save() {
    let requestModel: TkmendField[] = []

    this.genericFormService.dynamicGroups.forEach(group => {
      // Collect base group fields
      this.collectGroupFields(group, requestModel);
      // Collect instance fields
      if (group.instances && group.instances.length > 0) {
        group.instances.forEach(inst => {
          this.collectGroupFields(inst, requestModel);
        });
      }
    });
    this.spinner.show('جاري تسجيل البيانات ...');
    // mark recentlySaved to avoid accidental populateForm calls that would clear the UI
    this._recentlySaved = true;
    try {
      console.debug('EditFields requestModel preview', requestModel);
    } catch (e) { }
    this.administrativeCertificateController.editFields(requestModel)
      .subscribe({
        next: (res: any) => {
          if (res.isSuccess) {
            this.genericFormService.prePrintFormVisible = false;
            this.msg.msgSuccess('تم تعديل البيانات بنجاح');
            // mark current form as baseline (no pending edits)
            this.resetFormSnapshot();
          }
          else {
            let errors = "";
            res.errors?.forEach((e: any) => {
              errors += e.message + '\n';
            });
            this.msg.msgError('Error', '<h5>' + errors + '</h5>', true)
          }
        },
        error: (error: any) => {
          this.msg.msgError('Error', '<h5>' + error + '</h5>', true)
        },
        complete: () => {
          // release guard after short delay
          setTimeout(() => { this._recentlySaved = false; }, 1500);
        }
      })
  }

}
