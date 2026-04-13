import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MsgsService } from 'src/app/shared/services/helper/msgs.service';
import {
  AttachmentValidationDocumentTypeDto,
  AttachmentValidationDocumentTypeRuleDto,
  AttachmentValidationDocumentTypeRuleUpsertRequest,
  AttachmentValidationDocumentTypeUpsertRequest,
  AttachmentValidationMode,
  AttachmentValidationRuleDto,
  AttachmentValidationRuleUpsertRequest,
  AttachmentValidationWorkspaceDto
} from 'src/app/shared/services/BackendServices/AttachmentValidation/AttachmentValidation.dto';
import { AttachmentValidationController } from 'src/app/shared/services/BackendServices/AttachmentValidation/AttachmentValidation.service';

interface SelectOption<TValue> {
  label: string;
  value: TValue;
}

@Component({
  selector: 'app-attachment-validation-admin-page',
  templateUrl: './attachment-validation-admin-page.component.html',
  styleUrls: ['./attachment-validation-admin-page.component.scss']
})
export class AttachmentValidationAdminPageComponent implements OnInit {
  readonly validationModeOptions: Array<SelectOption<AttachmentValidationMode>> = [
    { label: 'رفع فقط', value: 'UploadOnly' },
    { label: 'رفع + تحقق قواعد', value: 'UploadAndValidate' }
  ];

  workspaceLoading = false;
  savingDocumentType = false;
  savingRule = false;
  savingBinding = false;

  documentTypes: AttachmentValidationDocumentTypeDto[] = [];
  rules: AttachmentValidationRuleDto[] = [];
  bindings: AttachmentValidationDocumentTypeRuleDto[] = [];

  previewDocumentTypeCode = 'SUMMER_PAYMENT_RECEIPT';

  readonly documentTypeForm: FormGroup;
  readonly ruleForm: FormGroup;
  readonly bindingForm: FormGroup;

  constructor(
    private readonly fb: FormBuilder,
    private readonly msg: MsgsService,
    private readonly attachmentValidationController: AttachmentValidationController
  ) {
    this.documentTypeForm = this.fb.group({
      id: [0],
      documentTypeCode: ['', [Validators.required, Validators.maxLength(100)]],
      documentTypeNameAr: ['', [Validators.required, Validators.maxLength(200)]],
      descriptionAr: ['', [Validators.maxLength(1000)]],
      validationMode: ['UploadOnly', Validators.required],
      isValidationRequired: [false],
      isActive: [true]
    });

    this.ruleForm = this.fb.group({
      id: [0],
      ruleCode: ['', [Validators.required, Validators.maxLength(100)]],
      ruleNameAr: ['', [Validators.required, Validators.maxLength(200)]],
      descriptionAr: ['', [Validators.maxLength(1000)]],
      parameterSchemaJson: [''],
      isSystemRule: [true],
      isActive: [true]
    });

    this.bindingForm = this.fb.group({
      id: [0],
      documentTypeId: [null, Validators.required],
      ruleId: [null, Validators.required],
      ruleOrder: [100, Validators.required],
      isActive: [true],
      isRequired: [true],
      stopOnFailure: [true],
      failureMessageAr: ['', [Validators.maxLength(500)]],
      parametersJson: ['']
    });
  }

  ngOnInit(): void {
    this.loadWorkspace();
  }

  get documentTypeOptions(): Array<SelectOption<number>> {
    return this.documentTypes
      .filter(item => item.isActive || item.id === Number(this.bindingForm.get('documentTypeId')?.value ?? 0))
      .map(item => ({
        value: item.id,
        label: `${item.documentTypeNameAr} (${item.documentTypeCode})`
      }));
  }

  get ruleOptions(): Array<SelectOption<number>> {
    return this.rules
      .filter(item => item.isActive || item.id === Number(this.bindingForm.get('ruleId')?.value ?? 0))
      .map(item => ({
        value: item.id,
        label: `${item.ruleNameAr} (${item.ruleCode})`
      }));
  }

  loadWorkspace(): void {
    this.workspaceLoading = true;
    this.attachmentValidationController.getAdminWorkspace().subscribe({
      next: response => {
        if (response?.isSuccess && response.data) {
          this.applyWorkspace(response.data);
          return;
        }

        this.msg.msgError('خطأ', `<h5>${this.collectErrors(response?.errors)}</h5>`, true);
      },
      error: () => {
        this.msg.msgError('خطأ', '<h5>تعذر تحميل إعدادات التحقق من المرفقات.</h5>', true);
      },
      complete: () => {
        this.workspaceLoading = false;
      }
    });
  }

  saveDocumentType(): void {
    this.documentTypeForm.markAllAsTouched();
    if (this.documentTypeForm.invalid) {
      this.msg.msgError('خطأ', '<h5>يرجى استكمال بيانات نوع المستند بشكل صحيح.</h5>', true);
      return;
    }

    const raw = this.documentTypeForm.getRawValue();
    const request: AttachmentValidationDocumentTypeUpsertRequest = {
      id: Number(raw.id ?? 0),
      documentTypeCode: String(raw.documentTypeCode ?? '').trim(),
      documentTypeNameAr: String(raw.documentTypeNameAr ?? '').trim(),
      descriptionAr: this.nullIfBlank(raw.descriptionAr),
      validationMode: this.normalizeMode(raw.validationMode),
      isValidationRequired: Boolean(raw.isValidationRequired),
      isActive: Boolean(raw.isActive)
    };

    this.savingDocumentType = true;
    this.attachmentValidationController.upsertDocumentType(request).subscribe({
      next: response => {
        if (response?.isSuccess) {
          this.msg.msgSuccess('تم حفظ نوع المستند بنجاح.');
          this.resetDocumentTypeForm();
          this.loadWorkspace();
          return;
        }

        this.msg.msgError('خطأ', `<h5>${this.collectErrors(response?.errors)}</h5>`, true);
      },
      error: () => {
        this.msg.msgError('خطأ', '<h5>تعذر حفظ نوع المستند.</h5>', true);
      },
      complete: () => {
        this.savingDocumentType = false;
      }
    });
  }

  editDocumentType(item: AttachmentValidationDocumentTypeDto): void {
    this.documentTypeForm.patchValue({
      id: item.id,
      documentTypeCode: item.documentTypeCode,
      documentTypeNameAr: item.documentTypeNameAr,
      descriptionAr: item.descriptionAr ?? '',
      validationMode: this.normalizeMode(item.validationMode),
      isValidationRequired: item.isValidationRequired,
      isActive: item.isActive
    });
  }

  deactivateDocumentType(item: AttachmentValidationDocumentTypeDto): void {
    this.attachmentValidationController.deactivateDocumentType(item.id).subscribe({
      next: response => {
        if (response?.isSuccess) {
          this.msg.msgSuccess('تم تعطيل نوع المستند.');
          this.loadWorkspace();
          return;
        }

        this.msg.msgError('خطأ', `<h5>${this.collectErrors(response?.errors)}</h5>`, true);
      },
      error: () => {
        this.msg.msgError('خطأ', '<h5>تعذر تعطيل نوع المستند.</h5>', true);
      }
    });
  }

  resetDocumentTypeForm(): void {
    this.documentTypeForm.reset({
      id: 0,
      documentTypeCode: '',
      documentTypeNameAr: '',
      descriptionAr: '',
      validationMode: 'UploadOnly',
      isValidationRequired: false,
      isActive: true
    });
  }

  saveRule(): void {
    this.ruleForm.markAllAsTouched();
    if (this.ruleForm.invalid) {
      this.msg.msgError('خطأ', '<h5>يرجى استكمال بيانات القاعدة بشكل صحيح.</h5>', true);
      return;
    }

    const raw = this.ruleForm.getRawValue();
    const request: AttachmentValidationRuleUpsertRequest = {
      id: Number(raw.id ?? 0),
      ruleCode: String(raw.ruleCode ?? '').trim(),
      ruleNameAr: String(raw.ruleNameAr ?? '').trim(),
      descriptionAr: this.nullIfBlank(raw.descriptionAr),
      parameterSchemaJson: this.nullIfBlank(raw.parameterSchemaJson),
      isSystemRule: Boolean(raw.isSystemRule),
      isActive: Boolean(raw.isActive)
    };

    this.savingRule = true;
    this.attachmentValidationController.upsertRule(request).subscribe({
      next: response => {
        if (response?.isSuccess) {
          this.msg.msgSuccess('تم حفظ قاعدة التحقق بنجاح.');
          this.resetRuleForm();
          this.loadWorkspace();
          return;
        }

        this.msg.msgError('خطأ', `<h5>${this.collectErrors(response?.errors)}</h5>`, true);
      },
      error: () => {
        this.msg.msgError('خطأ', '<h5>تعذر حفظ قاعدة التحقق.</h5>', true);
      },
      complete: () => {
        this.savingRule = false;
      }
    });
  }

  editRule(item: AttachmentValidationRuleDto): void {
    this.ruleForm.patchValue({
      id: item.id,
      ruleCode: item.ruleCode,
      ruleNameAr: item.ruleNameAr,
      descriptionAr: item.descriptionAr ?? '',
      parameterSchemaJson: item.parameterSchemaJson ?? '',
      isSystemRule: item.isSystemRule,
      isActive: item.isActive
    });
  }

  deactivateRule(item: AttachmentValidationRuleDto): void {
    this.attachmentValidationController.deactivateRule(item.id).subscribe({
      next: response => {
        if (response?.isSuccess) {
          this.msg.msgSuccess('تم تعطيل القاعدة.');
          this.loadWorkspace();
          return;
        }

        this.msg.msgError('خطأ', `<h5>${this.collectErrors(response?.errors)}</h5>`, true);
      },
      error: () => {
        this.msg.msgError('خطأ', '<h5>تعذر تعطيل القاعدة.</h5>', true);
      }
    });
  }

  resetRuleForm(): void {
    this.ruleForm.reset({
      id: 0,
      ruleCode: '',
      ruleNameAr: '',
      descriptionAr: '',
      parameterSchemaJson: '',
      isSystemRule: true,
      isActive: true
    });
  }

  saveBinding(): void {
    this.bindingForm.markAllAsTouched();
    if (this.bindingForm.invalid) {
      this.msg.msgError('خطأ', '<h5>يرجى استكمال بيانات الربط بشكل صحيح.</h5>', true);
      return;
    }

    const raw = this.bindingForm.getRawValue();
    const request: AttachmentValidationDocumentTypeRuleUpsertRequest = {
      id: Number(raw.id ?? 0),
      documentTypeId: Number(raw.documentTypeId ?? 0),
      ruleId: Number(raw.ruleId ?? 0),
      ruleOrder: Math.max(1, Number(raw.ruleOrder ?? 100)),
      isActive: Boolean(raw.isActive),
      isRequired: Boolean(raw.isRequired),
      stopOnFailure: Boolean(raw.stopOnFailure),
      failureMessageAr: this.nullIfBlank(raw.failureMessageAr),
      parametersJson: this.nullIfBlank(raw.parametersJson)
    };

    this.savingBinding = true;
    this.attachmentValidationController.upsertDocumentTypeRule(request).subscribe({
      next: response => {
        if (response?.isSuccess) {
          this.msg.msgSuccess('تم حفظ الربط بنجاح.');
          this.resetBindingForm();
          this.loadWorkspace();
          return;
        }

        this.msg.msgError('خطأ', `<h5>${this.collectErrors(response?.errors)}</h5>`, true);
      },
      error: () => {
        this.msg.msgError('خطأ', '<h5>تعذر حفظ الربط.</h5>', true);
      },
      complete: () => {
        this.savingBinding = false;
      }
    });
  }

  editBinding(item: AttachmentValidationDocumentTypeRuleDto): void {
    this.bindingForm.patchValue({
      id: item.id,
      documentTypeId: item.documentTypeId,
      ruleId: item.ruleId,
      ruleOrder: item.ruleOrder,
      isActive: item.isActive,
      isRequired: item.isRequired,
      stopOnFailure: item.stopOnFailure,
      failureMessageAr: item.failureMessageAr ?? '',
      parametersJson: item.parametersJson ?? ''
    });
  }

  deactivateBinding(item: AttachmentValidationDocumentTypeRuleDto): void {
    this.attachmentValidationController.deactivateDocumentTypeRule(item.id).subscribe({
      next: response => {
        if (response?.isSuccess) {
          this.msg.msgSuccess('تم تعطيل الربط.');
          this.loadWorkspace();
          return;
        }

        this.msg.msgError('خطأ', `<h5>${this.collectErrors(response?.errors)}</h5>`, true);
      },
      error: () => {
        this.msg.msgError('خطأ', '<h5>تعذر تعطيل الربط.</h5>', true);
      }
    });
  }

  resetBindingForm(): void {
    this.bindingForm.reset({
      id: 0,
      documentTypeId: null,
      ruleId: null,
      ruleOrder: 100,
      isActive: true,
      isRequired: true,
      stopOnFailure: true,
      failureMessageAr: '',
      parametersJson: ''
    });
  }

  private applyWorkspace(workspace: AttachmentValidationWorkspaceDto): void {
    this.documentTypes = [...(workspace?.documentTypes ?? [])].sort((a, b) =>
      String(a.documentTypeNameAr ?? '').localeCompare(String(b.documentTypeNameAr ?? ''), 'ar')
    );

    this.rules = [...(workspace?.rules ?? [])].sort((a, b) =>
      String(a.ruleNameAr ?? '').localeCompare(String(b.ruleNameAr ?? ''), 'ar')
    );

    this.bindings = [...(workspace?.documentTypeRules ?? [])].sort((a, b) => {
      const leftName = String(a.documentTypeNameAr ?? '');
      const rightName = String(b.documentTypeNameAr ?? '');
      if (leftName !== rightName) {
        return leftName.localeCompare(rightName, 'ar');
      }

      const leftOrder = Number(a.ruleOrder ?? 0);
      const rightOrder = Number(b.ruleOrder ?? 0);
      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }

      return Number(a.id ?? 0) - Number(b.id ?? 0);
    });

    const availableCodes = this.documentTypes.map(item => String(item.documentTypeCode ?? '').trim());
    if (!availableCodes.includes(this.previewDocumentTypeCode) && availableCodes.length > 0) {
      this.previewDocumentTypeCode = availableCodes[0];
    }
  }

  private normalizeMode(value: unknown): AttachmentValidationMode {
    return String(value ?? '').trim() === 'UploadAndValidate' ? 'UploadAndValidate' : 'UploadOnly';
  }

  private collectErrors(errors: Array<{ message?: string }> | undefined): string {
    const list = (errors ?? [])
      .map(item => String(item?.message ?? '').trim())
      .filter(item => item.length > 0);

    return list.length ? list.join('<br/>') : 'تعذر تنفيذ العملية المطلوبة.';
  }

  private nullIfBlank(value: unknown): string | null {
    const normalized = String(value ?? '').trim();
    return normalized.length > 0 ? normalized : null;
  }
}
