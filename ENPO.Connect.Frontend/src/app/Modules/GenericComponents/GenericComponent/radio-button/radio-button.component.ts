import { Component, Input, Output, EventEmitter, OnInit, SimpleChanges, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { GenericFormsService } from '../../GenericForms.service';
import {  FormGroup } from '@angular/forms';
import { CdCategoryMandDto } from 'src/app/shared/services/BackendServices/DynamicForm/DynamicForm.dto';

@Component({
  selector: 'app-radio-button',
  templateUrl: './radio-button.component.html',
  styleUrls: ['./radio-button.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RadioButtonComponent implements OnInit {
  @Input() parentForm!: FormGroup;
  @Input() control!: any;
  @Input() cdCategoryMandDto: CdCategoryMandDto = {} as CdCategoryMandDto;
  @Input() isDivDisabled: boolean = false;
  @Input() controlFullName: string = '';
  /** When true render native/default radio inputs; when false render styled pill UI */
  @Input() useDefaultRadioView: boolean = true;
  @Output() genericEvent = new EventEmitter<{event: any, controlFullName: string, eventType: string}>();

  // Cached categories to avoid returning a new array on every change detection cycle
  categories: any[] = [];

  constructor(public genericFormService: GenericFormsService, private cdr: ChangeDetectorRef) { }

  ngOnInit(): void {
    if (this.isDivDisabled || this.genericFormService.GetPropertyValue(this.controlFullName, 'isDisabledInit') == 'true') {
      this.control.disable();
    } else {
      this.control.enable();
    }
    // initialize cached categories
    this.refreshCategories();
  }

  /**
   * Cached categories used by the template. Use `refreshCategories()` to update.
   */
  // see property declaration above



  ngOnChanges(changes: SimpleChanges): void {
    if (!changes || !changes['isDivDisabled']) {
      return;
    }

    const current = changes['isDivDisabled'].currentValue;

    if (current) {
      // when isDivDisabled becomes true -> disable the control
      this.control?.disable?.();
    } else {
      // when isDivDisabled becomes false -> enable the control
      this.control?.enable?.();
    }
    // if controlFullName or related input changes, refresh categories
    if (changes['controlFullName'] || changes['cdCategoryMandDto']) {
      this.refreshCategories();
    }
  }
  onClick(event: any) {
    // Prevent emitting when the control/component is disabled
    if (this.isDivDisabled || (this.control && this.control.disabled)) {
      return;
    }

    this.genericEvent.emit({ event, controlFullName: this.controlFullName, eventType: 'click' });
  }

  /** Set selection programmatically from the custom pill UI */
  select(key: any, event?: Event) {
    event?.preventDefault();
    if (this.isDivDisabled || (this.control && this.control.disabled)) {
      return;
    }

    try {
      if (this.control && typeof this.control.setValue === 'function') {
        this.control.setValue(key);
        this.control.markAsDirty?.();
        this.control.markAsTouched?.();
      }
    } catch (err) {
      // fallback: emit the event so parent components can react
    }

    // Emit the genericEvent so existing listeners still work
    this.genericEvent.emit({ event, controlFullName: this.controlFullName, eventType: 'select' });
  }

  // trackBy function for *ngFor to avoid unnecessary re-renders
  trackByCategory(index: number, item: any) {
    return item?.key ?? index;
  }

  // Refresh cached categories from the service. Call when inputs change.
  private refreshCategories() {
    const result = this.genericFormService.implementControlSelection(this.controlFullName) || [];
    // assign a stable reference (use slice to copy if already same reference)
    this.categories = Array.isArray(result) ? result : [];
    // In OnPush mode, tell Angular to check this component
    try { this.cdr.markForCheck(); } catch (e) { }
  }
}

