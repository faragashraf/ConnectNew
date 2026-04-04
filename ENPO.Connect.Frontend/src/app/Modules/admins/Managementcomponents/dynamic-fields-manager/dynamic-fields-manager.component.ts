import { Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { DynamicSubjectsController } from 'src/app/shared/services/BackendServices/DynamicSubjects/DynamicSubjects.service';
import {
  SubjectAdminFieldDto,
  SubjectAdminFieldUpsertRequestDto
} from 'src/app/shared/services/BackendServices/DynamicSubjects/DynamicSubjects.dto';
import { AppNotificationService } from 'src/app/shared/services/notifications/app-notification.service';

interface FieldOptionRow {
  key: string;
  value: string;
}

@Component({
  selector: 'app-dynamic-fields-manager',
  templateUrl: './dynamic-fields-manager.component.html',
  styleUrls: ['./dynamic-fields-manager.component.scss']
})
export class DynamicFieldsManagerComponent implements OnInit, OnChanges, OnDestroy {
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

  optionRows: FieldOptionRow[] = [];
  optionRowsTouched = false;

  private readonly subscriptions = new Subscription();
  private fieldsRequestSeq = 0;

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

    const fieldTypeControl = this.form.get('fieldType');
    if (fieldTypeControl) {
      this.subscriptions.add(
        fieldTypeControl.valueChanges.subscribe(() => {
          this.onFieldTypeChanged();
        })
      );
    }

    this.onFieldTypeChanged();
    this.loadFields();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedApplicationId'] && !changes['selectedApplicationId'].firstChange) {
      const currentApp = String(changes['selectedApplicationId'].currentValue ?? '').trim();
      const previousApp = String(changes['selectedApplicationId'].previousValue ?? '').trim();
      if (currentApp === previousApp) {
        return;
      }

      this.appFilter = this.selectedApplicationId || '';
      this.loadFields();
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
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

  get optionsPreviewValue(): string {
    const payload = this.serializeOptionRows(this.optionRows);
    return payload || '';
  }

  loadFields(): void {
    const requestSeq = ++this.fieldsRequestSeq;
    this.loading = true;
    const appId = this.embeddedMode
      ? (String(this.selectedApplicationId ?? '').trim() || undefined)
      : (this.appFilter.trim() || undefined);

    this.dynamicSubjectsController.getAdminFields(appId).subscribe({
      next: response => {
        if (requestSeq !== this.fieldsRequestSeq) {
          return;
        }

        if (response?.errors?.length) {
          this.fields = [];
          this.appNotification.showApiErrors(response.errors, 'تعذر تحميل الحقول الديناميكية.');
          return;
        }

        this.fields = response?.data ?? [];
      },
      error: () => {
        if (requestSeq !== this.fieldsRequestSeq) {
          return;
        }

        this.fields = [];
        this.appNotification.error('حدث خطأ أثناء تحميل الحقول الديناميكية.');
      },
      complete: () => {
        if (requestSeq === this.fieldsRequestSeq) {
          this.loading = false;
        }
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

    this.optionRows = [];
    this.optionRowsTouched = false;
    this.onFieldTypeChanged();

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

    this.optionRows = this.parseOptionsPayloadToRows(item.optionsPayload);
    this.optionRowsTouched = false;
    this.onFieldTypeChanged();

    this.dialogVisible = true;
  }

  saveField(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.appNotification.warning('يرجى استكمال البيانات المطلوبة قبل الحفظ.');
      return;
    }

    if (this.isOptionsTypeSelected()) {
      const optionsValidationError = this.getOptionsValidationMessage();
      if (optionsValidationError.length > 0) {
        this.optionRowsTouched = true;
        this.appNotification.warning(optionsValidationError);
        return;
      }
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
    return type.includes('drop') || type.includes('radio') || type.includes('select') || type.includes('combo');
  }

  addOptionRow(): void {
    this.optionRows = [...this.optionRows, this.createEmptyOptionRow()];
    this.optionRowsTouched = true;
  }

  removeOptionRow(index: number): void {
    if (index < 0 || index >= this.optionRows.length) {
      return;
    }

    this.optionRows = this.optionRows.filter((_item, idx) => idx !== index);
    if (this.optionRows.length === 0 && this.isOptionsTypeSelected()) {
      this.optionRows = [this.createEmptyOptionRow()];
    }

    this.optionRowsTouched = true;
  }

  onOptionRowsChanged(): void {
    this.optionRowsTouched = true;
  }

  hasOptionsValidationError(): boolean {
    return this.optionRowsTouched && this.getOptionsValidationMessage().length > 0;
  }

  getOptionsValidationMessage(): string {
    if (!this.isOptionsTypeSelected()) {
      return '';
    }

    const normalizedRows = this.optionRows.map(row => ({
      key: String(row.key ?? '').trim(),
      value: String(row.value ?? '').trim()
    }));

    if (normalizedRows.length === 0) {
      return 'يجب إدخال خيار واحد على الأقل لحقول القائمة.';
    }

    const invalidRowIndex = normalizedRows.findIndex(row => row.key.length === 0 || row.value.length === 0);
    if (invalidRowIndex >= 0) {
      return `الصف رقم ${invalidRowIndex + 1} يجب أن يحتوي على key و value.`;
    }

    const seen = new Set<string>();
    for (const row of normalizedRows) {
      const normalizedKey = row.key.toLowerCase();
      if (seen.has(normalizedKey)) {
        return `لا يمكن تكرار key '${row.key}'.`;
      }

      seen.add(normalizedKey);
    }

    return '';
  }

  trackByOptionRow(index: number, item: FieldOptionRow): string {
    return `${index}-${item.key}`;
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

  private onFieldTypeChanged(): void {
    if (!this.isOptionsTypeSelected()) {
      return;
    }

    if (this.optionRows.length > 0) {
      return;
    }

    const payload = String(this.form.get('optionsPayload')?.value ?? '').trim();
    this.optionRows = this.parseOptionsPayloadToRows(payload);

    if (this.optionRows.length === 0) {
      this.optionRows = [this.createEmptyOptionRow()];
    }
  }

  private toUpsertPayload(): SubjectAdminFieldUpsertRequestDto {
    const value = this.form.value;

    const optionsPayload = this.isOptionsTypeSelected()
      ? this.serializeOptionRows(this.optionRows)
      : String(value.optionsPayload ?? '').trim() || undefined;

    return {
      cdmendSql: value.cdmendSql ?? undefined,
      fieldKey: String(value.fieldKey ?? '').trim(),
      fieldType: String(value.fieldType ?? '').trim(),
      fieldLabel: String(value.fieldLabel ?? '').trim() || undefined,
      placeholder: String(value.placeholder ?? '').trim() || undefined,
      defaultValue: String(value.defaultValue ?? '').trim() || undefined,
      optionsPayload,
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

  private createEmptyOptionRow(): FieldOptionRow {
    return { key: '', value: '' };
  }

  private parseOptionsPayloadToRows(payload: string | undefined): FieldOptionRow[] {
    const raw = String(payload ?? '').trim();
    if (raw.length === 0) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw);

      if (Array.isArray(parsed)) {
        return parsed
          .map(item => {
            if (item == null) {
              return null;
            }

            if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') {
              const value = String(item);
              return { key: value, value };
            }

            const hasExplicitKeyValue = Object.prototype.hasOwnProperty.call(item, 'key')
              && Object.prototype.hasOwnProperty.call(item, 'value')
              && !Object.prototype.hasOwnProperty.call(item, 'label');
            if (hasExplicitKeyValue) {
              const key = String((item as any).key ?? '').trim();
              const value = String((item as any).value ?? '').trim();
              if (key.length === 0 && value.length === 0) {
                return null;
              }

              return {
                key: key || value,
                value: value || key
              };
            }

            const key = String((item as any).value ?? (item as any).id ?? (item as any).key ?? (item as any).code ?? (item as any).label ?? (item as any).name ?? '').trim();
            const value = String((item as any).label ?? (item as any).name ?? (item as any).text ?? (item as any).value ?? (item as any).key ?? (item as any).id ?? '').trim();
            if (key.length === 0 && value.length === 0) {
              return null;
            }

            return {
              key: key || value,
              value: value || key
            };
          })
          .filter((item): item is FieldOptionRow => item !== null);
      }

      if (parsed && typeof parsed === 'object') {
        return Object.entries(parsed)
          .map(([key, value]) => ({
            key: String(key ?? '').trim(),
            value: String(value ?? '').trim() || String(key ?? '').trim()
          }))
          .filter(item => item.key.length > 0 || item.value.length > 0)
          .map(item => ({
            key: item.key || item.value,
            value: item.value || item.key
          }));
      }
    } catch {
      // fallback format: tokenized text
    }

    return raw
      .split(/[|,;\n]+/g)
      .map(token => token.trim())
      .filter(token => token.length > 0)
      .map(token => ({ key: token, value: token }));
  }

  private serializeOptionRows(rows: FieldOptionRow[]): string | undefined {
    const normalizedRows = rows
      .map(row => ({
        key: String(row.key ?? '').trim(),
        value: String(row.value ?? '').trim()
      }))
      .filter(row => row.key.length > 0 || row.value.length > 0)
      .map(row => ({
        key: row.key || row.value,
        value: row.value || row.key
      }));

    if (normalizedRows.length === 0) {
      return undefined;
    }

    return JSON.stringify(normalizedRows);
  }
}
