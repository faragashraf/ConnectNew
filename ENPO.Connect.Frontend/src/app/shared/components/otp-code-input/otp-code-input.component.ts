import { Component, Input, Output, EventEmitter, ViewChildren, QueryList, ElementRef, AfterViewInit, OnInit, forwardRef, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormArray, FormControl, FormBuilder, Validators, ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'app-otp-code-input',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './otp-code-input.component.html',
  styleUrls: ['./otp-code-input.component.scss'],
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => OtpCodeInputComponent),
    multi: true
  }]
})
export class OtpCodeInputComponent implements AfterViewInit, OnInit, ControlValueAccessor, OnChanges {
  @Input() length: number = 6;
  @Input() disabled: boolean = false;
  @Input() loading: boolean = false;
  @Input() errorText: string | null = null;

  // External two-way binding still supported via code Input/Output
  @Input()
  set code(val: string) {
    if (val !== this._code) {
      this._code = val || '';
      this.writeValue(this._code);
    }
  }
  get code(): string { return this._code; }

  @Output() codeChange = new EventEmitter<string>();
  @Output() completed = new EventEmitter<string>();

  @ViewChildren('otpInput') inputs!: QueryList<ElementRef>;

  private _code: string = '';
  public otpValues: string[] = [];
  public digits!: FormArray;

  // ControlValueAccessor callbacks
  private onChange: (value: any) => void = () => { };
  private onTouched: () => void = () => { };

  constructor() {
    this.otpValues = new Array(this.length).fill('');
  }
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['code']) {
      // debugger
      if (this.code.length == 0)
        this.focusFirst();
    }
  }

  ngOnInit() {
    this.buildForm();
  }

  ngAfterViewInit() {
    this.syncInputs();
    this.focusFirst();
  }

  /* 
   * Syncs the inputs to the _code value. 
     Handles external changes to [code].
   */
  private syncInputs() {
    // If mismatch, rebuild otpValues
    if (!this.otpValues || this.otpValues.length !== this.length) {
      this.otpValues = new Array(this.length).fill('');
    }

    // Ensure form array size
    this.resizeFormArrayIfNeeded();

    // Fill from _code into form controls
    for (let i = 0; i < this.length; i++) {
      const ch = this._code[i] || '';
      this.otpValues[i] = ch;
      try { this.digits.at(i).setValue(ch, { emitEvent: false }); } catch (e) { }
    }
  }

  onInput(event: any, index: number) {
    const input = event.target as HTMLInputElement;
    let val = input.value;

    // Only allow digits
    if (!/^\d*$/.test(val)) {
      input.value = '';
      return;
    }

    // Handle typing > 1 char (e.g. mobile suggestions or rapid entry not caught by paste)
    // or if the user manages to type quickly
    if (val.length > 1) {
      // If it looks like a full paste/fill
      if (val.length === this.length) {
        this.handleFullPaste(val);
        return;
      }
      val = val.slice(-1);
    }

    this.otpValues[index] = val;
    try { this.digits.at(index).setValue(val, { emitEvent: false }); } catch (e) { }
    this.emitChanges();

    // Auto-focus next
    if (val && index < this.length - 1) {
      this.inputs.get(index + 1)?.nativeElement.focus();
    }
  }

  onKeyDown(event: KeyboardEvent, index: number) {
    if (event.key === 'Backspace') {
        if (!this.otpValues[index] && index > 0) {
        // Current empty, go back and clear prev
        this.inputs.get(index - 1)?.nativeElement.focus();
        this.otpValues[index - 1] = '';
        try { this.digits.at(index - 1).setValue('', { emitEvent: false }); } catch (e) { }
        this.emitChanges();
      } else {
        // Clear current
        this.otpValues[index] = '';
        try { this.digits.at(index).setValue('', { emitEvent: false }); } catch (e) { }
        this.emitChanges();
      }
    } else if (event.key === 'ArrowLeft') {
      if (index > 0) this.inputs.get(index - 1)?.nativeElement.focus();
    } else if (event.key === 'ArrowRight') {
      if (index < this.length - 1) this.inputs.get(index + 1)?.nativeElement.focus();
    }
  }

  onPaste(event: ClipboardEvent) {
    event.preventDefault();
    const clipboardData = event.clipboardData || (window as any).clipboardData;
    const pastedText = clipboardData.getData('text');
    this.handleFullPaste(pastedText);
  }

  handleFullPaste(text: string) {
    if (!text) return;
    const digits = text.replace(/\D/g, '').slice(0, this.length);
    digits.split('').forEach((d, i) => {
      this.otpValues[i] = d;
      try { this.digits.at(i).setValue(d, { emitEvent: false }); } catch (e) { }
    });
    this.emitChanges();

    // Focus last or next empty
    const lastIdx = Math.min(digits.length, this.length - 1);
    if (this.inputs && this.inputs.get(lastIdx)) {
      this.inputs.get(lastIdx)?.nativeElement.focus();
    }
  }

  emitChanges() {
    const newCode = this.otpValues.join('');
    this._code = newCode;
    this.codeChange.emit(newCode);
    // notify reactive form value change
    try { this.onChange(newCode); } catch (e) { }

    if (newCode.length === this.length) {
      this.completed.emit(newCode);
    }
  }

  trackByIdx(index: number, obj: any): any {
    return index;
  }

  handleFocus(event: any) {
    // Select all text on focus for easier replacement
    event.target.select();
  }

  /**
   * Focus the first OTP input element (if present).
   */
  public focusFirst(): void {
    setTimeout(() => {
      try {
        const first = this.inputs && this.inputs.first;
        if (first && first.nativeElement) {
          first.nativeElement.focus();
          first.nativeElement.select && first.nativeElement.select();
        }
      } catch (e) { /* ignore DOM errors */ }
    }, 50);
  }

  /**
   * Reset the internal form and visible digits. Also notifies value change with empty string.
   */
  public reset(): void {
    try {
      if (!this.digits) this.buildForm();
      this.digits.controls.forEach(c => {
        try { c.setValue('', { emitEvent: false }); } catch (e) { }
      });
      this.otpValues = new Array(this.length).fill('');
      this._code = '';
      try { this.onChange(''); } catch (e) { }
      this.codeChange.emit('');
      // clear native inputs if available and focus first
      setTimeout(() => {
        try {
          if (this.inputs && this.inputs.length) {
            this.inputs.forEach((el: ElementRef) => {
              try { el.nativeElement.value = ''; } catch (e) { }
            });
          }
        } catch (e) { }
        this.focusFirst();
      }, 30);
    } catch (e) {
      // ignore
    }
  }

  // Build the internal FormArray
  private buildForm() {
    const arr: FormControl[] = [];
    for (let i = 0; i < this.length; i++) {
      arr.push(new FormControl(''));
    }
    this.digits = new FormArray(arr);

    // Subscribe to FormArray changes to keep otpValues in sync
    this.digits.valueChanges.subscribe((vals: any[]) => {
      for (let i = 0; i < this.length; i++) {
        this.otpValues[i] = vals[i] || '';
      }
      const joined = this.otpValues.join('');
      this._code = joined;
      this.codeChange.emit(joined);
      try { this.onChange(joined); } catch (e) { }
      if (joined.length === this.length) this.completed.emit(joined);
    });
  }

  private resizeFormArrayIfNeeded() {
    if (!this.digits) return;
    const diff = this.length - this.digits.length;
    if (diff > 0) {
      for (let i = 0; i < diff; i++) this.digits.push(new FormControl(''));
    } else if (diff < 0) {
      for (let i = 0; i < -diff; i++) this.digits.removeAt(this.digits.length - 1);
    }
  }

  // ControlValueAccessor implementation
  writeValue(obj: any): void {
    const val = (obj || '').toString();
    this._code = val;
    // ensure form built
    if (!this.digits) this.buildForm();
    for (let i = 0; i < this.length; i++) {
      const ch = val[i] || '';
      try { this.digits.at(i).setValue(ch, { emitEvent: false }); } catch (e) { }
      this.otpValues[i] = ch;
    }
  }
  registerOnChange(fn: any): void { this.onChange = fn; }
  registerOnTouched(fn: any): void { this.onTouched = fn; }
  setDisabledState?(isDisabled: boolean): void { this.disabled = isDisabled; }

  // Template helper to return a proper FormControl type
  public getControl(i: number) {
    return this.digits.at(i) as FormControl;
  }
}
