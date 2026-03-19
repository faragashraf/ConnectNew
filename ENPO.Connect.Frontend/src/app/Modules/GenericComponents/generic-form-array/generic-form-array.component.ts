import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormArray, FormBuilder, FormGroup } from '@angular/forms';
import { GenericFormsService } from '../GenericForms.service';
import { debounceTime } from 'rxjs';
import { CdCategoryMandDto } from 'src/app/shared/services/BackendServices/DynamicForm/DynamicForm.dto';

@Component({
  selector: 'app-generic-form-array',
  templateUrl: './generic-form-array.component.html',
  styleUrls: ['./generic-form-array.component.scss']
})
export class GenericFormArrayComponent {

  @Input() filtered_CategoryMand: CdCategoryMandDto[] = [];
  @Input() index: number = 0;
  @Input() controlFullName: string = '';
  @Input() mandFileds!: FormArray
  @Input() ticketForm!: FormGroup;
  @Input() controlName: boolean = false;
  @Input() isDivDisabled: boolean = false;
  @Input() isCurrentUser: boolean = false;
  @Input() tree: any[] = [];
  @Input() showTreeButton: boolean = false;
  @Input() isNotRequired: boolean = false;
  isDisabled: boolean = true;
  @Input() useDefaultRadioView: boolean = true;



  @Output() genericEvent = new EventEmitter<{ event: any, controlFullName: string, control: any, eventType: string }>();

  constructor(public genericFormService: GenericFormsService, private fb: FormBuilder) { }

  control!: any

  ngOnInit(): void {
    this.control = this.genericFormService.GetControl(this.mandFileds, this.controlFullName)
    this.ticketForm.valueChanges.pipe(
      debounceTime(500)
    ).subscribe(() => {
      this.genericFormService.logValidationErrors(this.ticketForm);
    });
  }

  // Handler to receive events from child components and emit to parent
  onGenericElementEvent(event: any, controlFullName: string, control: any, eventType: string) {
    this.genericEvent.emit({ event, controlFullName, control: control, eventType });
  }
}
