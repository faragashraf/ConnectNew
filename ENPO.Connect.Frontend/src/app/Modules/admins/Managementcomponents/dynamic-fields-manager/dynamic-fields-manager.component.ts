import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { DynamicSubjectsController } from 'src/app/shared/services/BackendServices/DynamicSubjects/DynamicSubjects.service';
import {
  SubjectAdminFieldDto,
  SubjectAdminFieldUpsertRequestDto
} from 'src/app/shared/services/BackendServices/DynamicSubjects/DynamicSubjects.dto';
import { AppNotificationService } from 'src/app/shared/services/notifications/app-notification.service';

@Component({
  selector: 'app-dynamic-fields-manager',
  templateUrl: './dynamic-fields-manager.component.html',
  styleUrls: ['./dynamic-fields-manager.component.scss']
})
export class DynamicFieldsManagerComponent implements OnInit, OnChanges {
  @Input() embeddedMode = false;
  @Input() selectedCategoryId: number | null = null;
  @Input() selectedApplicationId: string | null = null;
  @Output() fieldsChanged = new EventEmitter<void>();

  loading = false;
  saving = false;
  dialogVisible = false;
  editingFieldKey: string | null = null;

  fields: SubjectAdminFieldDto[] = [];
  searchTerm = '';
  statusFilter: 'all' | 'active' | 'inactive' = 'all';
  appFilter = '';

  form: FormGroup;

  readonly fieldTypes: Array<{ label: string; value: string }> = [
    { label: 'نص قصير', value: 'InputText' },
    { label: 'نص طويل', value: 'Textarea' },
    { label: 'قائمة منسدلة', value: 'Dropdown' },
    { label: 'شجرة منسدلة', value: 'DropdownTree' },
    { label: 'اختيار واحد', value: 'RadioButton' },
    { label: 'تاريخ', value: 'Date' },
    { label: 'مستخدم نطاق', value: 'DomainUser' },
    { label: 'رقم', value: 'Number' },
    { label: 'مربع اختيار', value: 'Checkbox' }
  ];

  constructor(
    private readonly fb: FormBuilder,
    private readonly dynamicSubjectsController: DynamicSubjectsController,
    private readonly appNotification: AppNotificationService
  ) {
    this.form = this.fb.group({
      cdmendSql: [null],
      fieldKey: ['', [Validators.required, Validators.maxLength(50)]],
      fieldType: ['InputText', [Validators.required, Validators.maxLength(50)]],
      fieldLabel: ['', Validators.maxLength(50)],
      placeholder: [''],
      defaultValue: [''],
      optionsPayload: [''],
      dataType: ['', Validators.maxLength(50)],
      required: [false],
      requiredTrue: [false],
      email: [false],
      pattern: [false],
      minValue: [''],
      maxValue: [''],
      mask: ['', Validators.maxLength(30)],
      isActive: [true],
      width: [0, [Validators.required, Validators.min(0)]],
      height: [0, [Validators.required, Validators.min(0)]],
      isDisabledInit: [false],
      isSearchable: [false],
      applicationId: ['', Validators.maxLength(10)]
    });
  }

  ngOnInit(): void {
    if (this.selectedApplicationId) {
      this.appFilter = this.selectedApplicationId;
    }

    this.loadFields();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedApplicationId'] && !changes['selectedApplicationId'].firstChange) {
      this.appFilter = this.selectedApplicationId || '';
      this.loadFields();
    }
  }

  get appOptions(): Array<{ label: string; value: string }> {
    const apps = [...new Set((this.fields ?? []).map(item => String(item.applicationId ?? '').trim()).filter(item => item.length > 0))]
      .sort((a, b) => a.localeCompare(b));

    return apps.map(app => ({ label: app, value: app }));
  }

  get filteredFields(): SubjectAdminFieldDto[] {
    let rows = [...(this.fields ?? [])];

    const effectiveAppFilter = this.embeddedMode
      ? (this.selectedApplicationId || '').trim()
      : this.appFilter.trim();

    if (effectiveAppFilter.length > 0) {
      rows = rows.filter(item => String(item.applicationId ?? '').trim().toLowerCase() === effectiveAppFilter.toLowerCase());
    }

    if (this.statusFilter === 'active') {
      rows = rows.filter(item => item.isActive);
    } else if (this.statusFilter === 'inactive') {
      rows = rows.filter(item => !item.isActive);
    }

    const term = this.searchTerm.trim().toLowerCase();
    if (term.length > 0) {
      rows = rows.filter(item =>
        String(item.fieldKey ?? '').toLowerCase().includes(term)
        || String(item.fieldLabel ?? '').toLowerCase().includes(term)
        || String(item.fieldType ?? '').toLowerCase().includes(term)
        || String(item.applicationId ?? '').toLowerCase().includes(term)
      );
    }

    return rows;
  }

  loadFields(): void {
    this.loading = true;
    const appId = this.embeddedMode
      ? (this.selectedApplicationId || undefined)
      : (this.appFilter.trim() || undefined);

    this.dynamicSubjectsController.getAdminFields(appId).subscribe({
      next: response => {
        if (response?.errors?.length) {
          this.fields = [];
          this.appNotification.showApiErrors(response.errors, 'تعذر تحميل الحقول الديناميكية.');
          return;
        }

        this.fields = response?.data ?? [];
      },
      error: () => {
        this.fields = [];
        this.appNotification.error('حدث خطأ أثناء تحميل الحقول الديناميكية.');
      },
      complete: () => {
        this.loading = false;
      }
    });
  }

  openCreateDialog(): void {
    this.editingFieldKey = null;
    this.form.reset({
      cdmendSql: null,
      fieldKey: '',
      fieldType: 'InputText',
      fieldLabel: '',
      placeholder: '',
      defaultValue: '',
      optionsPayload: '',
      dataType: '',
      required: false,
      requiredTrue: false,
      email: false,
      pattern: false,
      minValue: '',
      maxValue: '',
      mask: '',
      isActive: true,
      width: 0,
      height: 0,
      isDisabledInit: false,
      isSearchable: false,
      applicationId: this.selectedApplicationId || this.appFilter || ''
    });

    this.dialogVisible = true;
  }

  openEditDialog(item: SubjectAdminFieldDto): void {
    this.editingFieldKey = item.fieldKey;
    this.form.patchValue({
      cdmendSql: item.cdmendSql,
      fieldKey: item.fieldKey,
      fieldType: item.fieldType,
      fieldLabel: item.fieldLabel ?? '',
      placeholder: item.placeholder ?? '',
      defaultValue: item.defaultValue ?? '',
      optionsPayload: item.optionsPayload ?? '',
      dataType: item.dataType ?? '',
      required: item.required,
      requiredTrue: item.requiredTrue,
      email: item.email,
      pattern: item.pattern,
      minValue: item.minValue ?? '',
      maxValue: item.maxValue ?? '',
      mask: item.mask ?? '',
      isActive: item.isActive,
      width: item.width,
      height: item.height,
      isDisabledInit: item.isDisabledInit,
      isSearchable: item.isSearchable,
      applicationId: item.applicationId ?? ''
    });

    this.dialogVisible = true;
  }

  saveField(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.appNotification.warning('يرجى استكمال البيانات المطلوبة قبل الحفظ.');
      return;
    }

    const payload = this.toUpsertPayload();
    const request$ = this.editingFieldKey
      ? this.dynamicSubjectsController.updateAdminField(this.editingFieldKey, payload)
      : this.dynamicSubjectsController.createAdminField(payload);

    this.saving = true;
    request$.subscribe({
      next: response => {
        if (response?.errors?.length) {
          this.appNotification.showApiErrors(response.errors, 'تعذر حفظ الحقل.');
          return;
        }

        this.dialogVisible = false;
        this.loadFields();
        this.fieldsChanged.emit();
        this.appNotification.success('تم حفظ بيانات الحقل بنجاح.');
      },
      error: () => {
        this.appNotification.error('حدث خطأ أثناء حفظ الحقل.');
      },
      complete: () => {
        this.saving = false;
      }
    });
  }

  deleteField(item: SubjectAdminFieldDto): void {
    const confirmed = window.confirm(`هل أنت متأكد من حذف الحقل "${item.fieldLabel || item.fieldKey}"؟`);
    if (!confirmed) {
      return;
    }

    this.dynamicSubjectsController.deleteAdminField(item.fieldKey).subscribe({
      next: response => {
        if (response?.errors?.length) {
          this.appNotification.showApiErrors(response.errors, 'تعذر حذف الحقل.');
          return;
        }

        this.loadFields();
        this.fieldsChanged.emit();
        this.appNotification.success('تم حذف/تعطيل الحقل بنجاح.');
      },
      error: () => {
        this.appNotification.error('حدث خطأ أثناء حذف الحقل.');
      }
    });
  }

  onStandaloneAppFilterChange(): void {
    this.loadFields();
  }

  getDialogTitle(): string {
    return this.editingFieldKey ? 'تعديل الحقل الديناميكي' : 'إضافة حقل ديناميكي';
  }

  isOptionsTypeSelected(): boolean {
    const type = String(this.form.get('fieldType')?.value ?? '').toLowerCase();
    return type.includes('drop') || type.includes('radio');
  }

  isInvalid(controlName: string): boolean {
    const control = this.form.get(controlName);
    return !!control && control.invalid && (control.touched || control.dirty);
  }

  hasRequiredError(controlName: string): boolean {
    const control = this.form.get(controlName);
    return !!control?.errors?.['required'] && (control.touched || control.dirty);
  }

  getValidationMessage(controlName: string, label: string): string {
    const control = this.form.get(controlName);
    if (!control?.errors) {
      return '';
    }

    if (control.errors['required']) {
      return `${label} مطلوب.`;
    }

    if (control.errors['maxlength']) {
      return `${label} يجب ألا يزيد عن ${control.errors['maxlength'].requiredLength} حرفًا.`;
    }

    if (control.errors['min']) {
      return `${label} يجب أن يكون ${control.errors['min'].min} أو أكبر.`;
    }

    if (control.errors['max']) {
      return `${label} يجب أن يكون ${control.errors['max'].max} أو أقل.`;
    }

    return `قيمة ${label} غير صالحة.`;
  }

  private toUpsertPayload(): SubjectAdminFieldUpsertRequestDto {
    const value = this.form.value;
    return {
      cdmendSql: value.cdmendSql ?? undefined,
      fieldKey: String(value.fieldKey ?? '').trim(),
      fieldType: String(value.fieldType ?? '').trim(),
      fieldLabel: String(value.fieldLabel ?? '').trim() || undefined,
      placeholder: String(value.placeholder ?? '').trim() || undefined,
      defaultValue: String(value.defaultValue ?? '').trim() || undefined,
      optionsPayload: String(value.optionsPayload ?? '').trim() || undefined,
      dataType: String(value.dataType ?? '').trim() || undefined,
      required: Boolean(value.required),
      requiredTrue: Boolean(value.requiredTrue),
      email: Boolean(value.email),
      pattern: Boolean(value.pattern),
      minValue: String(value.minValue ?? '').trim() || undefined,
      maxValue: String(value.maxValue ?? '').trim() || undefined,
      mask: String(value.mask ?? '').trim() || undefined,
      isActive: Boolean(value.isActive),
      width: Number(value.width ?? 0),
      height: Number(value.height ?? 0),
      isDisabledInit: Boolean(value.isDisabledInit),
      isSearchable: Boolean(value.isSearchable),
      applicationId: String(value.applicationId ?? '').trim() || undefined
    };
  }
}
