import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { DynamicSubjectsController } from 'src/app/shared/services/BackendServices/DynamicSubjects/DynamicSubjects.service';
import { SubjectTypeAdminDto, SubjectTypeAdminUpsertRequestDto } from 'src/app/shared/services/BackendServices/DynamicSubjects/DynamicSubjects.dto';
import { AppNotificationService } from 'src/app/shared/services/notifications/app-notification.service';

@Component({
  selector: 'app-dynamic-subject-type-admin',
  templateUrl: './dynamic-subject-type-admin.component.html',
  styleUrls: ['./dynamic-subject-type-admin.component.scss']
})
export class DynamicSubjectTypeAdminComponent implements OnInit {
  loading = false;
  saving = false;
  subjectTypes: SubjectTypeAdminDto[] = [];
  selectedType: SubjectTypeAdminDto | null = null;
  submitAttempted = false;

  configForm: FormGroup;

  constructor(
    private readonly fb: FormBuilder,
    private readonly dynamicSubjectsController: DynamicSubjectsController,
    private readonly appNotification: AppNotificationService
  ) {
    this.configForm = this.fb.group({
      isActive: [true],
      referencePolicyEnabled: [true],
      referencePrefix: ['', Validators.required],
      referenceSeparator: ['-'],
      sourceFieldKeys: [''],
      includeYear: [true],
      useSequence: [true],
      sequenceName: ['Seq_Tickets']
    });
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.dynamicSubjectsController.getSubjectTypesAdminConfig().subscribe({
      next: response => {
        if (response?.errors?.length) {
          this.subjectTypes = [];
          this.appNotification.showApiErrors(response.errors, 'تعذر تحميل إعدادات الأنواع.');
          return;
        }

        this.subjectTypes = response?.data ?? [];
        if (this.subjectTypes.length > 0 && !this.selectedType) {
          this.selectType(this.subjectTypes[0]);
        }
      },
      error: () => {
        this.appNotification.error('حدث خطأ أثناء تحميل إعدادات الأنواع.');
      },
      complete: () => {
        this.loading = false;
      }
    });
  }

  selectType(item: SubjectTypeAdminDto): void {
    this.selectedType = item;
    this.configForm.patchValue({
      isActive: item.isActive,
      referencePolicyEnabled: item.referencePolicyEnabled,
      referencePrefix: item.referencePrefix || `SUBJ${item.categoryId}`,
      referenceSeparator: item.referenceSeparator || '-',
      sourceFieldKeys: item.sourceFieldKeys || '',
      includeYear: item.includeYear,
      useSequence: item.useSequence,
      sequenceName: item.sequenceName || 'Seq_Tickets'
    });
  }

  save(): void {
    this.submitAttempted = true;
    if (!this.selectedType || this.configForm.invalid) {
      this.configForm.markAllAsTouched();
      this.appNotification.warning('يرجى استكمال الحقول المطلوبة قبل الحفظ.');
      return;
    }

    const payload: SubjectTypeAdminUpsertRequestDto = {
      isActive: Boolean(this.configForm.get('isActive')?.value),
      referencePolicyEnabled: Boolean(this.configForm.get('referencePolicyEnabled')?.value),
      referencePrefix: String(this.configForm.get('referencePrefix')?.value ?? '').trim(),
      referenceSeparator: String(this.configForm.get('referenceSeparator')?.value ?? '-').trim() || '-',
      sourceFieldKeys: String(this.configForm.get('sourceFieldKeys')?.value ?? '').trim() || undefined,
      includeYear: Boolean(this.configForm.get('includeYear')?.value),
      useSequence: Boolean(this.configForm.get('useSequence')?.value),
      sequenceName: String(this.configForm.get('sequenceName')?.value ?? '').trim() || undefined
    };

    this.saving = true;
    this.dynamicSubjectsController.upsertSubjectTypeAdminConfig(this.selectedType.categoryId, payload).subscribe({
      next: response => {
        if (response?.errors?.length) {
          this.appNotification.showApiErrors(response.errors, 'تعذر حفظ إعدادات النوع.');
          return;
        }

        const updated = response?.data;
        if (!updated) {
          return;
        }

        const idx = this.subjectTypes.findIndex(item => item.categoryId === updated.categoryId);
        if (idx >= 0) {
          this.subjectTypes[idx] = updated;
        }
        this.selectType(updated);
        this.appNotification.success('تم حفظ الإعدادات بنجاح.');
      },
      error: () => {
        this.appNotification.error('حدث خطأ أثناء حفظ إعدادات النوع.');
      },
      complete: () => {
        this.saving = false;
      }
    });
  }

  shouldShowError(controlName: string): boolean {
    const control = this.configForm.get(controlName);
    if (!control) {
      return false;
    }

    return control.invalid && (control.touched || this.submitAttempted);
  }

  getControlErrorMessage(controlName: string): string {
    const control = this.configForm.get(controlName);
    if (!control || !control.errors) {
      return '';
    }

    if (control.errors['required']) {
      return 'هذا الحقل مطلوب.';
    }

    return 'القيمة المدخلة غير صحيحة.';
  }

  toArabicTypeState(item: SubjectTypeAdminDto): string {
    const activeText = item.isActive ? 'مفعل' : 'غير مفعل';
    const fieldsText = item.hasDynamicFields ? 'يحتوي حقولاً' : 'بدون حقول';
    return `${activeText} | ${fieldsText}`;
  }
}
