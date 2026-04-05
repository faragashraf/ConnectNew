import { Component, Input } from '@angular/core';
import { AbstractControl, FormArray, FormGroup } from '@angular/forms';
import { CdCategoryMandDto } from 'src/app/shared/services/BackendServices/DynamicForm/DynamicForm.dto';

export interface DynamicGroupRenderItem {
  groupId: number;
  groupName: string;
  formArrayName: string;
  fields: CdCategoryMandDto[];
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

  getGroupDisplayName(group: DynamicGroupRenderItem): string {
    const groupName = String(group.groupName ?? '').trim();
    return groupName.length > 0 ? groupName : `مجموعة ${group.groupId}`;
  }

  getFormArrayControls(formArrayName: string): AbstractControl[] {
    const formArray = this.getFormArrayInstance(formArrayName);
    return formArray?.controls ?? [];
  }

  getFormArrayInstance(formArrayName: string): FormArray | null {
    const control = this.form?.get(formArrayName);
    return control instanceof FormArray ? control : null;
  }

  getControlNamesFromGroup(groupControl: AbstractControl): string[] {
    if (groupControl instanceof FormGroup) {
      return Object.keys(groupControl.controls);
    }

    return [];
  }

  onGenericEvent(_event: unknown): void {
    // hook reserved for future cross-field interactions
  }
}
