import { Component, EventEmitter, Input, OnDestroy, Output } from '@angular/core';
import { FormArray, FormBuilder, FormGroup } from '@angular/forms';
import { GenericFormsService } from '../GenericForms.service';
import { Subject, debounceTime, takeUntil } from 'rxjs';
import { CdCategoryMandDto } from 'src/app/shared/services/BackendServices/DynamicForm/DynamicForm.dto';

@Component({
  selector: 'app-generic-form-array',
  templateUrl: './generic-form-array.component.html',
  styleUrls: ['./generic-form-array.component.scss']
})
export class GenericFormArrayComponent implements OnDestroy {

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
  private readonly destroy$ = new Subject<void>();

  constructor(public genericFormService: GenericFormsService, private fb: FormBuilder) { }

  control!: any

  ngOnInit(): void {
    this.control = this.genericFormService.GetControl(this.mandFileds, this.controlFullName)
    this.ticketForm.valueChanges.pipe(
      debounceTime(500),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.genericFormService.logValidationErrors(this.ticketForm);
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Handler to receive events from child components and emit to parent
  onGenericElementEvent(event: any, controlFullName: string, control: any, eventType: string) {
    this.genericEvent.emit({ event, controlFullName, control: control, eventType });
  }

  isDropdownField(): boolean {
    const normalized = this.getControlTypeToken();
    return normalized.includes('drop')
      || normalized.includes('select')
      || normalized.includes('combo')
      || normalized.includes('tree');
  }

  shouldRenderTreeDropdown(): boolean {
    const normalized = this.getControlTypeToken();
    const explicitTreeType = normalized.includes('tree');
    if (explicitTreeType) {
      return true;
    }

    if (!normalized.includes('drop') && !normalized.includes('select') && !normalized.includes('combo')) {
      return false;
    }

    return this.genericFormService.isTreeBoundField(this.controlFullName);
  }

  shouldShowTreeButton(): boolean {
    return this.showTreeButton || this.genericFormService.isTreeBoundField(this.controlFullName);
  }

  private getControlTypeToken(): string {
    return String(this.genericFormService.GetPropertyValue(this.controlFullName, 'cdmendType') ?? '')
      .trim()
      .toLowerCase();
  }
}
