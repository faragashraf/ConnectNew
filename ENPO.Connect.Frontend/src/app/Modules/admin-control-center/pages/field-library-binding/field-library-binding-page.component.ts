import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { auditTime } from 'rxjs/operators';
import {
  BoundFieldItem,
  FieldLibraryBindingValidationResult,
  ReusableFieldLibraryItem
} from '../../domain/models/field-library-binding.models';
import {
  ControlCenterStepViewModel,
  ControlCenterViewModel
} from '../../domain/models/admin-control-center.view-models';
import { FieldLibraryBindingEngine } from '../../domain/field-library-binding/field-library-binding.engine';
import { AdminControlCenterFacade } from '../../facades/admin-control-center.facade';

@Component({
  selector: 'app-field-library-binding-page',
  templateUrl: './field-library-binding-page.component.html',
  styleUrls: ['./field-library-binding-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FieldLibraryBindingPageComponent implements OnInit, OnDestroy {
  readonly stepKey = 'field-library-binding' as const;
  readonly fieldTypeOptions = [
    { label: 'InputText', value: 'InputText' },
    { label: 'Textarea', value: 'Textarea' },
    { label: 'Dropdown', value: 'Dropdown' },
    { label: 'Number', value: 'Number' },
    { label: 'Date', value: 'Date' },
    { label: 'Checkbox', value: 'Checkbox' }
  ];

  readonly setupForm: FormGroup = this.fb.group({
    libraryVersion: [null, [Validators.required]],
    bindingStrategy: [null, [Validators.required]],
    includeLegacyFields: [false],
    bindingNotes: ['', [Validators.maxLength(1000)]]
  });

  vm: ControlCenterViewModel | null = null;
  step: ControlCenterStepViewModel | null = null;
  reusableFields: ReadonlyArray<ReusableFieldLibraryItem> = this.bindingEngine.reusableLibrary;
  bindings: BoundFieldItem[] = [];
  validation: FieldLibraryBindingValidationResult = { isValid: false, blockingIssues: [], warnings: [] };

  stepMessage = '';
  stepMessageSeverity: 'success' | 'warn' = 'warn';
  librarySearchTerm = '';

  private readonly subscriptions = new Subscription();
  private syncingFromStore = false;

  constructor(
    private readonly fb: FormBuilder,
    private readonly facade: AdminControlCenterFacade,
    private readonly router: Router,
    private readonly bindingEngine: FieldLibraryBindingEngine
  ) {}

  ngOnInit(): void {
    this.facade.initialize(this.stepKey);

    this.subscriptions.add(
      this.facade.vm$.subscribe(vm => {
        this.vm = vm;
        const matchingStep = vm.steps.find(step => step.key === this.stepKey) ?? null;
        this.step = matchingStep;
        if (!matchingStep) {
          return;
        }

        this.patchSetupFormFromStep(matchingStep.values);
        this.patchBindingsFromStep(matchingStep.values);
        this.evaluateBindings(false);
      })
    );

    this.subscriptions.add(
      this.setupForm.valueChanges
        .pipe(auditTime(80))
        .subscribe(() => {
          if (this.syncingFromStore) {
            return;
          }

          this.evaluateBindings(true);
        })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  get requiredProgressText(): string {
    if (!this.step) {
      return '0 / 0';
    }

    return `${this.step.requiredCompleted} / ${this.step.requiredTotal}`;
  }

  get filteredReusableFields(): ReusableFieldLibraryItem[] {
    const term = this.librarySearchTerm.trim().toLowerCase();
    if (!term) {
      return [...this.reusableFields];
    }

    return this.reusableFields.filter(item =>
      item.label.toLowerCase().includes(term)
      || item.fieldKey.toLowerCase().includes(term)
      || item.type.toLowerCase().includes(term)
    );
  }

  getOptions(fieldKey: string): Array<{ label: string; value: string }> {
    const field = this.step?.fields.find(item => item.key === fieldKey);
    return [...(field?.options ?? [])];
  }

  controlHasError(controlName: string): boolean {
    const control = this.setupForm.get(controlName);
    if (!control) {
      return false;
    }

    return control.invalid && (control.dirty || control.touched);
  }

  controlErrorMessage(controlName: string): string {
    const control = this.setupForm.get(controlName);
    if (!control) {
      return 'قيمة غير صحيحة.';
    }

    if (control.hasError('required')) {
      return 'هذا الحقل إلزامي.';
    }

    if (control.hasError('maxlength')) {
      return 'القيمة أطول من الحد المسموح.';
    }

    return 'قيمة غير صحيحة.';
  }

  onAddFromLibrary(item: ReusableFieldLibraryItem): void {
    const newBinding = this.bindingEngine.createBindingFromLibrary(item, this.bindings);
    this.bindings = this.bindingEngine.normalizeDisplayOrder([...this.bindings, newBinding]);
    this.evaluateBindings(true);
  }

  onDeleteBinding(binding: BoundFieldItem): void {
    this.bindings = this.bindingEngine.normalizeDisplayOrder(
      this.bindings.filter(item => item.bindingId !== binding.bindingId)
    );
    this.evaluateBindings(true);
  }

  onMoveBindingUp(binding: BoundFieldItem): void {
    this.moveBinding(binding, -1);
  }

  onMoveBindingDown(binding: BoundFieldItem): void {
    this.moveBinding(binding, 1);
  }

  onBindingChanged(): void {
    this.bindings = this.bindingEngine.normalizeDisplayOrder(
      this.bindings.map(item => ({
        ...item,
        fieldKey: String(item.fieldKey ?? '').trim(),
        label: String(item.label ?? '').trim(),
        defaultValue: String(item.defaultValue ?? '').trim(),
        displayOrder: Math.max(1, Number(item.displayOrder ?? 1))
      }))
    );
    this.evaluateBindings(true);
  }

  onSaveDraft(): void {
    this.evaluateBindings(true);
    const draftResult = this.facade.saveDraft();
    this.stepMessageSeverity = draftResult.success ? 'success' : 'warn';
    this.stepMessage = draftResult.message;
  }

  onGoNext(): void {
    this.setupForm.markAllAsTouched();
    this.evaluateBindings(true);

    if (this.setupForm.invalid || !this.validation.isValid || !this.step?.isCompleted) {
      this.stepMessageSeverity = 'warn';
      this.stepMessage = 'لا يمكن المتابعة قبل استكمال الإعدادات وحل التعارضات المانعة.';
      return;
    }

    const nextStep = this.facade.getNextStepKey(this.stepKey);
    if (!nextStep) {
      return;
    }

    this.stepMessage = '';
    this.router.navigate(['/Admin/ControlCenter', nextStep]);
  }

  isFieldAlreadyBound(item: ReusableFieldLibraryItem): boolean {
    return this.bindings.some(binding => binding.sourceFieldId === item.id);
  }

  private evaluateBindings(syncToStore: boolean): void {
    this.validation = this.bindingEngine.validateBindings(this.bindings);

    if (!syncToStore) {
      return;
    }

    const formValue = this.setupForm.getRawValue();
    const payload = this.bindingEngine.serializeBindingsPayload(this.bindings);
    const token = this.validation.isValid ? 'valid' : null;

    this.facade.updateFieldValue(this.stepKey, 'libraryVersion', formValue.libraryVersion);
    this.facade.updateFieldValue(this.stepKey, 'bindingStrategy', formValue.bindingStrategy);
    this.facade.updateFieldValue(this.stepKey, 'includeLegacyFields', formValue.includeLegacyFields);
    this.facade.updateFieldValue(this.stepKey, 'bindingNotes', formValue.bindingNotes);
    this.facade.updateFieldValue(this.stepKey, 'bindingPayload', payload);
    this.facade.updateFieldValue(this.stepKey, 'bindingValidationToken', token);
  }

  private patchSetupFormFromStep(values: Record<string, unknown>): void {
    const nextValue = {
      libraryVersion: this.normalizeNullable(values['libraryVersion']),
      bindingStrategy: this.normalizeNullable(values['bindingStrategy']),
      includeLegacyFields: values['includeLegacyFields'] === true,
      bindingNotes: String(values['bindingNotes'] ?? '').trim()
    };

    this.syncingFromStore = true;
    this.setupForm.patchValue(nextValue, { emitEvent: false });
    this.syncingFromStore = false;
  }

  private patchBindingsFromStep(values: Record<string, unknown>): void {
    const parsed = this.bindingEngine.parseBindingsPayload(values['bindingPayload']);
    const currentSerialized = this.bindingEngine.serializeBindingsPayload(this.bindings);
    const incomingSerialized = this.bindingEngine.serializeBindingsPayload(parsed);
    if (currentSerialized === incomingSerialized) {
      return;
    }

    this.bindings = parsed;
  }

  private moveBinding(binding: BoundFieldItem, direction: -1 | 1): void {
    const ordered = [...this.bindings].sort((left, right) => left.displayOrder - right.displayOrder);
    const currentIndex = ordered.findIndex(item => item.bindingId === binding.bindingId);
    if (currentIndex < 0) {
      return;
    }

    const targetIndex = currentIndex + direction;
    if (targetIndex < 0 || targetIndex >= ordered.length) {
      return;
    }

    const reordered = [...ordered];
    const [moved] = reordered.splice(currentIndex, 1);
    reordered.splice(targetIndex, 0, moved);
    this.bindings = this.bindingEngine.normalizeDisplayOrder(reordered);
    this.evaluateBindings(true);
  }

  private normalizeNullable(value: unknown): string | null {
    const normalized = String(value ?? '').trim();
    return normalized.length > 0 ? normalized : null;
  }
}
