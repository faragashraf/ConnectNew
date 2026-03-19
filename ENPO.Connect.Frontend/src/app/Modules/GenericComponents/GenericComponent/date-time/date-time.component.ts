import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { FormGroup, FormControl } from '@angular/forms';
import { CdCategoryMandDto } from 'src/app/shared/services/BackendServices/DynamicForm/DynamicForm.dto';;
import { GenericFormsService } from '../../GenericForms.service';
import { ConditionalDate } from '../../../../shared/Pipe/Conditional-date.pipe';
import { parseToDate } from 'src/app/shared/models/Component.Config.model';

@Component({
  selector: 'app-date-time',
  templateUrl: './date-time.component.html',
  styleUrls: ['./date-time.component.scss']
})
export class DateTimeComponent {
  @Input() parentForm!: FormGroup;
  @Input() control: any;
  @Input() cdCategoryMandDto: CdCategoryMandDto = {} as CdCategoryMandDto;
  @Input() isDivDisabled: boolean = false;
  @Input() isCurrentUser: boolean = false;
  @Input() showTime: boolean = true;
  timeOnly: boolean = false;
  dateFormat: string = 'yy/mm/dd';
  hourFormat: '12' | '24' = '12';
  @Input() index: number = 0;
  @Input() controlFullName: string = '';

  @Input() minDate: Date | null = null;
  @Input() maxDate: Date | null = null;

  @Output() genericEvent = new EventEmitter<{ event: any, controlFullName: string, eventType: string }>();

  constructor(public genericFormService: GenericFormsService, private customDatePipe: ConditionalDate) { }

  ngOnInit(): void {
    if (this.isDivDisabled || this.genericFormService.GetPropertyValue(this.controlFullName, 'isDisabledInit') == 'true') {
      this.control.disable();
    } else {
      this.control.enable();
    }

    // if the dateFormat contains AM/PM marker use 12-hour format by default
    try {
      if (this.dateFormat && this.dateFormat.toLowerCase().includes('tt') && this.hourFormat === '24') {
        this.hourFormat = '12';
      }
    } catch (e) {
      // noop
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes) {
      return;
    }

    // normalize incoming min/max date values (they may come from config JSON as strings)
    if (changes['maxDate']) {
      this.maxDate = parseToDate(changes['maxDate'].currentValue);
    }
    if (changes['minDate']) {
      this.minDate = parseToDate(changes['minDate'].currentValue);
    }

    // if dateFormat input changed, update hourFormat accordingly (keeps select in 12/24 mode)
    if (changes['dateFormat'] && typeof changes['dateFormat'].currentValue === 'string') {
      try {
        const fmt = changes['dateFormat'].currentValue as string;
        if (fmt.toLowerCase().includes('tt')) {
          this.hourFormat = '12';
        } else if (fmt.toLowerCase().includes('hh') || fmt.toLowerCase().includes('HH')) {
          // keep existing or set to 24 if explicitly 24-hour markers used
          if (!fmt.toLowerCase().includes('tt')) this.hourFormat = '24';
        }
      } catch (e) {
        // noop
      }
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
    const hours = typeof _date.getHours === 'function' ? _date.getHours() : 0;
    const minutes = typeof _date.getMinutes === 'function' ? _date.getMinutes() : 0;
    const date: Date = new Date(_date.getFullYear(), _date.getMonth(), _date.getDate(), hours, minutes);

    this.control?.patchValue?.(date);
    this.parentForm.get(this.controlFullName)?.patchValue(date);
    this.genericEvent.emit({ event: date, controlFullName: this.controlFullName, eventType: 'onChange' });
  }

  onBlur(event: any) {
    this.genericEvent.emit({ event, controlFullName: this.controlFullName, eventType: 'blur' });
  }
  onSelect(event: any) {
    if (!event) return;
    const hours = typeof event.getHours === 'function' ? event.getHours() : 0;
    const minutes = typeof event.getMinutes === 'function' ? event.getMinutes() : 0;
    const date: Date = new Date(event.getFullYear(), event.getMonth(), event.getDate(), hours, minutes);

    this.control?.patchValue?.(date);
    this.parentForm.get(this.controlFullName)?.patchValue(date);
    this.genericEvent.emit({ event: date, controlFullName: this.controlFullName, eventType: 'select' });
  }
}
