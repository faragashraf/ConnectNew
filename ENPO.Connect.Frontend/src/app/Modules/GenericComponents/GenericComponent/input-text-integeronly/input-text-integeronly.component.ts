import { Component, Input, Output, EventEmitter } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { GenericFormsService } from '../../GenericForms.service';
import { CdCategoryMandDto } from 'src/app/shared/services/BackendServices/DynamicForm/DynamicForm.dto';

@Component({
  selector: 'app-input-text-integeronly',
  templateUrl: './input-text-integeronly.component.html',
  styleUrls: ['./input-text-integeronly.component.scss']
})
export class InputTextIntegeronlyComponent {
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
    // try {
    //   // ensure negative values are not accepted
    //   const raw = this.control && this.control.value != null ? Number(this.control.value) : NaN;
    //   if (!isNaN(raw) && raw < 0) {
    //     if (typeof this.control.setValue === 'function') this.control.setValue(0);
    //     event = { ...event, value: 0 };
    //   }
    // } catch (e) { /* ignore */ }
    this.genericEvent.emit({ event, controlFullName: this.controlFullName, eventType: 'input' });
  }
}
