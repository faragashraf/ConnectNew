import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { FormGroup, FormControl } from '@angular/forms';
import { CdCategoryMandDto } from 'src/app/shared/services/BackendServices/DynamicForm/DynamicForm.dto';;
import { GenericFormsService } from '../../GenericForms.service';
import { ConditionalDate } from '../../../../shared/Pipe/Conditional-date.pipe';
import { parseToDate } from 'src/app/shared/models/Component.Config.model';

@Component({
  selector: 'app-date',
  templateUrl: './date.component.html',
  styleUrls: ['./date.component.scss']
})
export class DateComponent implements OnInit, OnChanges {
  @Input() parentForm!: FormGroup;
  @Input() control: any;
  @Input() cdCategoryMandDto: CdCategoryMandDto = {} as CdCategoryMandDto;
  @Input() isDivDisabled: boolean = false;
  @Input() isCurrentUser: boolean = false;
   showTime: boolean = false;
  timeOnly: boolean = false;
  @Input() dateFormat: string = 'yy/mm/dd';
  @Input() index: number = 0;
  @Input() controlFullName: string = '';

  minDate: Date | null = null;
  maxDate: Date | null = null;

  @Output() genericEvent = new EventEmitter<{ event: any, controlFullName: string, eventType: string }>();

  constructor(public genericFormService: GenericFormsService, private customDatePipe: ConditionalDate) { }

  ngOnInit(): void {
    if (this.isDivDisabled || this.genericFormService.GetPropertyValue(this.controlFullName, 'isDisabledInit') == 'true') {
      this.control.disable();
    } else {
      this.control.enable();
    }
    const minValueProp = this.genericFormService.GetPropertyValue(this.controlFullName, 'minValue');
    const maxValueProp = this.genericFormService.GetPropertyValue(this.controlFullName, 'maxValue');

    if (minValueProp === 'future') {
      // when min is 'future', we intentionally allow dates to extend indefinitely
      this.minDate = new Date();
    } else {
      if (maxValueProp === 'today') {
        this.maxDate = new Date();
      }
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes) {
      return;
    }
    // Handle `control` input changes safely. The incoming change may be:
    // - a FormControl instance (changes.control.currentValue is FormControl)
    // - a raw value (string/Date/number)
    if (changes['control']) {
      const incoming = changes['control'].currentValue as any;
      let valueToParse: any = null;

      if (incoming instanceof FormControl) {
        valueToParse = incoming.value;
        // ensure `this.control` refers to the FormControl instance passed in
        this.control = incoming;
      } else {
        valueToParse = incoming;
      }

      const parsed = parseToDate(valueToParse);
      // patch either with a Date or null (clears the control)
      this.control?.patchValue(parsed);
    }

    // Handle isDivDisabled change separately (if present)
    if (changes['isDivDisabled']) {
      const current = changes['isDivDisabled'].currentValue;
      if (current) {
        this.control?.disable?.();
      } else {
        this.control?.enable?.();
      }
    }
  }
  onDateFromChange(_date: any) {
    console.log('onDateFromChange', _date)
    if (!_date) return;
    const date: Date = new Date(Date.UTC(_date.getFullYear(), _date.getMonth(), _date.getDate()));

    this.control?.patchValue?.(date);
    this.parentForm.get(this.controlFullName)?.patchValue(date);
    this.genericEvent.emit({ event: date, controlFullName: this.controlFullName, eventType: 'onChange' });
  }

  onBlur(event: any) {
    this.genericEvent.emit({ event, controlFullName: this.controlFullName, eventType: 'blur' });
  }
  onSelect(event: any) {
    if (!event) return;
    const date: Date = new Date(Date.UTC(event.getFullYear(), event.getMonth(), event.getDate()));

    this.control?.patchValue?.(date);
    this.parentForm.get(this.controlFullName)?.patchValue(date);
    this.genericEvent.emit({ event: date, controlFullName: this.controlFullName, eventType: 'select' });
  }
}
