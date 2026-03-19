import { Component, Input, Output, EventEmitter } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { GenericFormsService } from 'src/app/Modules/GenericComponents/GenericForms.service';
import { CdCategoryMandDto } from 'src/app/shared/services/BackendServices/DynamicForm/DynamicForm.dto';


@Component({
  selector: 'app-textarea',
  templateUrl: './textarea.component.html',
  styleUrls: ['./textarea.component.scss']
})
export class TextareaComponent {
  @Input() parentForm!: FormGroup;
  @Input() control: any;
  @Input() cdCategoryMandDto: CdCategoryMandDto = {} as CdCategoryMandDto;
  @Input() isDivDisabled: boolean = false;
  @Input() controlFullName: string = '';
  @Output() genericEvent = new EventEmitter<{event: any, controlFullName: string, eventType: string}>();

  constructor(public genericFormService: GenericFormsService) { }

  onBlur(event: any) {
    this.genericEvent.emit({ event, controlFullName: this.controlFullName, eventType: 'blur' });
  }
  onInput(event: any) {
    this.genericEvent.emit({ event, controlFullName: this.controlFullName, eventType: 'input' });
  }
}
