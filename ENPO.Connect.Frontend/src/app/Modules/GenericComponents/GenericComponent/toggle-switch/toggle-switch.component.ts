import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { CdCategoryMandDto } from 'src/app/shared/services/BackendServices/DynamicForm/DynamicForm.dto';
import { GenericFormsService } from '../../GenericForms.service';

@Component({
  selector: 'app-toggle-switch',
  templateUrl: './toggle-switch.component.html',
  styleUrls: ['./toggle-switch.component.scss']
})
export class ToggleSwitchComponent {
  @Input() parentForm!: FormGroup;
  @Input() control: any;
  @Input() cdCategoryMandDto: CdCategoryMandDto = {} as CdCategoryMandDto;
  @Input() isDivDisabled = false;
  @Input() controlFullName = '';
  @Output() genericEvent = new EventEmitter<{ event: any; controlFullName: string; eventType: string }>();

  constructor(public genericFormService: GenericFormsService) { }

  ngOnInit(): void {
    if (this.isDivDisabled || this.genericFormService.GetPropertyValue(this.controlFullName, 'isDisabledInit') === 'true') {
      this.control?.disable?.();
    } else {
      this.control?.enable?.();
    }
  }

  ngOnChanges(): void {
    if (this.isDivDisabled) {
      this.control?.disable?.();
      return;
    }

    if (this.genericFormService.GetPropertyValue(this.controlFullName, 'isDisabledInit') === 'true') {
      this.control?.disable?.();
      return;
    }

    this.control?.enable?.();
  }

  onChange(event: any): void {
    if (this.isDivDisabled || this.control?.disabled) {
      return;
    }
    this.genericEvent.emit({ event, controlFullName: this.controlFullName, eventType: 'change' });
  }
}

