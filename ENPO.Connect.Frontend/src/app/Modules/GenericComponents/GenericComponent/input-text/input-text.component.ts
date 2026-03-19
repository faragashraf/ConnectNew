import { Component, Input, Output, EventEmitter } from '@angular/core';
import { GenericFormsService } from '../../GenericForms.service';
import { AbstractControl, FormControl, FormGroup } from '@angular/forms';
import { CdCategoryMandDto } from 'src/app/shared/services/BackendServices/DynamicForm/DynamicForm.dto';;

@Component({
  selector: 'app-input-text',
  templateUrl: './input-text.component.html',
  styleUrls: ['./input-text.component.scss']
})
export class InputTextComponent {
  @Input() parentForm!: FormGroup;
  @Input() control!: any;
  @Input() cdCategoryMandDto: CdCategoryMandDto = {} as CdCategoryMandDto;
  @Input() controlFullName: string = '';
  @Input() isDivDisabled: boolean = false;
  @Output() genericEvent = new EventEmitter<{event: any, controlFullName: string, eventType: string}>();

  constructor(public genericFormService: GenericFormsService) { }

  onBlur(event: any) {
    this.genericEvent.emit({ event, controlFullName: this.controlFullName, eventType: 'blur' });
  }
  onInput(event: any) {
    this.genericEvent.emit({ event, controlFullName: this.controlFullName, eventType: 'input' });
  }
}
