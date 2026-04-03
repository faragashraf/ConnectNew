import { Component, Input } from '@angular/core';
import { AbstractControl, FormGroup } from '@angular/forms';
import { SubjectFieldDefinitionDto } from 'src/app/shared/services/BackendServices/DynamicSubjects/DynamicSubjects.dto';

export interface DynamicFieldRenderItem {
  controlName: string;
  definition: SubjectFieldDefinitionDto;
}

export interface DynamicGroupRenderItem {
  groupId: number;
  groupName: string;
  fields: DynamicFieldRenderItem[];
}

@Component({
  selector: 'app-dynamic-fields-section',
  templateUrl: './dynamic-fields-section.component.html',
  styleUrls: ['./dynamic-fields-section.component.scss']
})
export class DynamicFieldsSectionComponent {
  @Input() form!: FormGroup;
  @Input() groups: DynamicGroupRenderItem[] = [];
  @Input() readOnly = false;

  trackByGroup = (_index: number, group: DynamicGroupRenderItem): number => group.groupId;
  trackByField = (_index: number, field: DynamicFieldRenderItem): string => field.controlName;

  isTextarea(field: SubjectFieldDefinitionDto): boolean {
    return this.normalizeType(field.fieldType).includes('textarea');
  }

  isDate(field: SubjectFieldDefinitionDto): boolean {
    const normalized = this.normalizeType(field.fieldType);
    return normalized.includes('date') || normalized.includes('calendar');
  }

  isNumber(field: SubjectFieldDefinitionDto): boolean {
    const normalized = this.normalizeType(field.fieldType);
    return normalized.includes('number') || normalized.includes('int') || normalized.includes('decimal');
  }

  isBoolean(field: SubjectFieldDefinitionDto): boolean {
    const normalized = this.normalizeType(field.fieldType);
    return normalized.includes('bool') || normalized.includes('check') || normalized.includes('toggle');
  }

  isSelect(field: SubjectFieldDefinitionDto): boolean {
    const normalized = this.normalizeType(field.fieldType);
    return normalized.includes('select') || normalized.includes('drop') || normalized.includes('combo') || normalized.includes('radio');
  }

  parseOptions(field: SubjectFieldDefinitionDto): Array<{ label: string; value: string }> {
    const payload = String(field.optionsPayload ?? '').trim();
    if (!payload) {
      return [];
    }

    try {
      const parsed = JSON.parse(payload);
      if (Array.isArray(parsed)) {
        return parsed
          .map(option => {
            if (option == null) {
              return null;
            }

            if (typeof option === 'string' || typeof option === 'number' || typeof option === 'boolean') {
              const value = String(option);
              return { label: value, value };
            }

            const value = String(option.value ?? option.id ?? option.key ?? option.label ?? option.name ?? '');
            const label = String(option.label ?? option.name ?? option.text ?? value);
            if (!value && !label) {
              return null;
            }

            return { label: label || value, value: value || label };
          })
          .filter((option): option is { label: string; value: string } => option !== null);
      }
    } catch {
      // ignore parse failures and fallback to splitting
    }

    return payload
      .split(/[|,;\n]+/g)
      .map(item => item.trim())
      .filter(item => item.length > 0)
      .map(item => ({ label: item, value: item }));
  }

  private normalizeType(type: string | undefined): string {
    return String(type ?? '').trim().toLowerCase();
  }

  getGroupDisplayName(group: DynamicGroupRenderItem): string {
    const groupName = String(group.groupName ?? '').trim();
    return groupName.length > 0 ? groupName : `مجموعة ${group.groupId}`;
  }

  isControlInvalid(controlName: string): boolean {
    const control = this.form?.get(controlName);
    if (!control) {
      return false;
    }

    return control.invalid && (control.touched || control.dirty);
  }

  getControlErrorMessage(item: DynamicFieldRenderItem): string {
    const control = this.form?.get(item.controlName);
    if (!control || !control.errors) {
      return '';
    }

    return this.resolveControlErrorMessage(control, item.definition);
  }

  private resolveControlErrorMessage(control: AbstractControl, definition: SubjectFieldDefinitionDto): string {
    if (!control.errors) {
      return '';
    }

    if (control.errors['required']) {
      return 'هذا الحقل مطلوب.';
    }
    if (control.errors['requiredTrue']) {
      return 'يرجى تأكيد هذا الحقل.';
    }
    if (control.errors['email']) {
      return 'صيغة البريد الإلكتروني غير صحيحة.';
    }
    if (control.errors['pattern']) {
      return 'صيغة الإدخال غير مطابقة للنمط المطلوب.';
    }
    if (control.errors['min']) {
      return `القيمة يجب أن تكون أكبر من أو تساوي ${definition.minValue ?? ''}.`;
    }
    if (control.errors['max']) {
      return `القيمة يجب أن تكون أقل من أو تساوي ${definition.maxValue ?? ''}.`;
    }

    return 'القيمة المدخلة غير صحيحة.';
  }
}
