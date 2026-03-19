import { Component, Input, Output, EventEmitter } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { CdCategoryMandDto } from 'src/app/shared/services/BackendServices/DynamicForm/DynamicForm.dto';;
import { GenericFormsService } from '../../GenericForms.service';
import { TreeNode } from 'primeng/api';

@Component({
  selector: 'app-dropdown',
  templateUrl: './dropdown.component.html',
  styleUrls: ['./dropdown.component.scss']
})
export class DropdownComponent {
  @Input() parentForm!: FormGroup;
  @Input() control: any;
  @Input() cdCategoryMandDto: CdCategoryMandDto = {} as CdCategoryMandDto;
  @Input() isDivDisabled: boolean = false;
  @Input() isCurrentUser: boolean = false;
  dialogVisible: boolean = false;
  @Input() controlFullName: string = '';
  @Output() genericEvent = new EventEmitter<{ selected?: any, parent?: any, topParent?: any, controlFullName: string, eventType: string, event?: any }>();

  selectedNode: TreeNode = {} as TreeNode;
  constructor(public genericFormService: GenericFormsService) { }

  onChange(event: any) {
    const isClear = event && (event.value === null || event.value === undefined);

    if (isClear) {
      // ensure the underlying control/form is cleared too
      if (this.control && typeof this.control.setValue === 'function') {
        this.control.setValue(null);
      } else if (this.parentForm && this.controlFullName) {
        const ctrl = this.parentForm.get ? this.parentForm.get(this.controlFullName) : null;
        if (ctrl && typeof ctrl.setValue === 'function') {
          ctrl.setValue(null);
        }
      }

      this.selectedNode = {} as TreeNode;
      return;
    }

    this.genericEvent.emit({ event, controlFullName: this.controlFullName, eventType: 'change' });
  }
}
