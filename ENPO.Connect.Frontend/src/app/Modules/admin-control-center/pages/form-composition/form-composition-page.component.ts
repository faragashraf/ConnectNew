import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { auditTime } from 'rxjs/operators';
import {
  CompositionFieldReference,
  FormCompositionContainer,
  FormCompositionValidationResult
} from '../../domain/models/form-composition.models';
import {
  ControlCenterStepViewModel,
  ControlCenterViewModel
} from '../../domain/models/admin-control-center.view-models';
import { FormCompositionEngine } from '../../domain/form-composition/form-composition.engine';
import { AdminControlCenterFacade } from '../../facades/admin-control-center.facade';
import { FieldLibraryBindingEngine } from '../../domain/field-library-binding/field-library-binding.engine';

@Component({
  selector: 'app-form-composition-page',
  templateUrl: './form-composition-page.component.html',
  styleUrls: ['./form-composition-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FormCompositionPageComponent implements OnInit, OnDestroy {
  readonly stepKey = 'form-composition' as const;
  readonly containerTypeOptions = [
    { label: 'Group', value: 'group' },
    { label: 'Section', value: 'section' },
    { label: 'Card', value: 'card' },
    { label: 'Tab', value: 'tab' }
  ];

  readonly setupForm: FormGroup = this.fb.group({
    defaultGroupLabel: ['', [Validators.required, Validators.maxLength(120)]],
    layoutDirection: [null, [Validators.required]],
    allowInlineSections: [false],
    compositionNotes: ['', [Validators.maxLength(1000)]]
  });

  readonly containerForm: FormGroup = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(120)]],
    type: ['group', [Validators.required]],
    visible: [true],
    displayOrder: [1, [Validators.required, Validators.min(1)]],
    fieldKeys: [[], [Validators.required]]
  });

  vm: ControlCenterViewModel | null = null;
  step: ControlCenterStepViewModel | null = null;
  containers: FormCompositionContainer[] = [];
  availableFields: CompositionFieldReference[] = [];
  validation: FormCompositionValidationResult = { isValid: false, blockingIssues: [], warnings: [] };

  containerDialogVisible = false;
  editingContainerId: string | null = null;
  stepMessage = '';
  stepMessageSeverity: 'success' | 'warn' = 'warn';

  private readonly subscriptions = new Subscription();
  private syncingFromStore = false;

  constructor(
    private readonly fb: FormBuilder,
    private readonly facade: AdminControlCenterFacade,
    private readonly router: Router,
    private readonly compositionEngine: FormCompositionEngine,
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

        this.availableFields = this.resolveAvailableFields(vm);
        this.patchSetupFormFromStep(matchingStep.values);
        this.patchContainersFromStep(matchingStep.values);
        this.evaluateComposition(false);
      })
    );

    this.subscriptions.add(
      this.setupForm.valueChanges
        .pipe(auditTime(80))
        .subscribe(() => {
          if (this.syncingFromStore) {
            return;
          }

          this.evaluateComposition(true);
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

  get visibleContainers(): FormCompositionContainer[] {
    return this.containers.filter(item => item.visible).sort((left, right) => left.displayOrder - right.displayOrder);
  }

  get fieldOptions(): Array<{ label: string; value: string }> {
    return this.availableFields.map(item => ({
      label: `${item.label} (${item.fieldKey})`,
      value: item.fieldKey
    }));
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

  openAddContainerDialog(): void {
    this.editingContainerId = null;
    this.containerForm.reset({
      title: '',
      type: 'group',
      visible: true,
      displayOrder: this.containers.length + 1,
      fieldKeys: []
    });
    this.containerDialogVisible = true;
  }

  openEditContainerDialog(container: FormCompositionContainer): void {
    this.editingContainerId = container.id;
    this.containerForm.reset({
      title: container.title,
      type: container.type,
      visible: container.visible,
      displayOrder: container.displayOrder,
      fieldKeys: [...container.fieldKeys]
    });
    this.containerDialogVisible = true;
  }

  saveContainerDialog(): void {
    if (this.containerForm.invalid) {
      this.containerForm.markAllAsTouched();
      return;
    }

    const raw = this.containerForm.getRawValue();
    const containerId = this.editingContainerId ?? this.buildContainerId();
    const candidate: FormCompositionContainer = {
      id: containerId,
      title: String(raw.title ?? '').trim(),
      type: raw.type,
      visible: raw.visible !== false,
      displayOrder: Math.max(1, Number(raw.displayOrder ?? 1)),
      fieldKeys: Array.isArray(raw.fieldKeys)
        ? raw.fieldKeys.map((item: unknown) => String(item ?? '').trim()).filter(Boolean)
        : []
    };

    const withoutCurrent = this.containers.filter(item => item.id !== containerId);
    this.containers = this.compositionEngine.normalizeDisplayOrder([...withoutCurrent, candidate]);
    this.containerDialogVisible = false;
    this.evaluateComposition(true);
  }

  deleteContainer(container: FormCompositionContainer): void {
    this.containers = this.compositionEngine.normalizeDisplayOrder(
      this.containers.filter(item => item.id !== container.id)
    );
    this.evaluateComposition(true);
  }

  moveContainerUp(container: FormCompositionContainer): void {
    this.moveContainer(container, -1);
  }

  moveContainerDown(container: FormCompositionContainer): void {
    this.moveContainer(container, 1);
  }

  onSaveDraft(): void {
    this.evaluateComposition(true);
    const draftResult = this.facade.saveDraft();
    this.stepMessageSeverity = draftResult.success ? 'success' : 'warn';
    this.stepMessage = draftResult.message;
  }

  onGoNext(): void {
    this.setupForm.markAllAsTouched();
    this.evaluateComposition(true);

    if (this.setupForm.invalid || !this.validation.isValid || !this.step?.isCompleted) {
      this.stepMessageSeverity = 'warn';
      this.stepMessage = 'لا يمكن المتابعة قبل استكمال التكوين وحل المشكلات المانعة.';
      return;
    }

    const nextStep = this.facade.getNextStepKey(this.stepKey);
    if (!nextStep) {
      return;
    }

    this.stepMessage = '';
    this.router.navigate(['/Admin/ControlCenter', nextStep]);
  }

  resolveFieldLabel(fieldKey: string): string {
    return this.availableFields.find(item => item.fieldKey === fieldKey)?.label ?? fieldKey;
  }

  private evaluateComposition(syncToStore: boolean): void {
    const allowInlineSections = this.setupForm.get('allowInlineSections')?.value === true;
    this.validation = this.compositionEngine.validate(this.containers, this.availableFields, allowInlineSections);

    if (!syncToStore) {
      return;
    }

    const raw = this.setupForm.getRawValue();
    const payload = this.compositionEngine.serializeContainersPayload(this.containers);
    const token = this.validation.isValid ? 'valid' : null;

    this.facade.updateFieldValue(this.stepKey, 'defaultGroupLabel', raw.defaultGroupLabel);
    this.facade.updateFieldValue(this.stepKey, 'layoutDirection', raw.layoutDirection);
    this.facade.updateFieldValue(this.stepKey, 'allowInlineSections', raw.allowInlineSections);
    this.facade.updateFieldValue(this.stepKey, 'compositionNotes', raw.compositionNotes);
    this.facade.updateFieldValue(this.stepKey, 'compositionLayoutPayload', payload);
    this.facade.updateFieldValue(this.stepKey, 'compositionValidationToken', token);
  }

  private patchSetupFormFromStep(values: Record<string, unknown>): void {
    const nextValue = {
      defaultGroupLabel: String(values['defaultGroupLabel'] ?? '').trim(),
      layoutDirection: this.normalizeNullable(values['layoutDirection']),
      allowInlineSections: values['allowInlineSections'] === true,
      compositionNotes: String(values['compositionNotes'] ?? '').trim()
    };

    this.syncingFromStore = true;
    this.setupForm.patchValue(nextValue, { emitEvent: false });
    this.syncingFromStore = false;
  }

  private patchContainersFromStep(values: Record<string, unknown>): void {
    const parsed = this.compositionEngine.parseContainersPayload(values['compositionLayoutPayload']);
    const currentSerialized = this.compositionEngine.serializeContainersPayload(this.containers);
    const incomingSerialized = this.compositionEngine.serializeContainersPayload(parsed);
    if (currentSerialized === incomingSerialized) {
      return;
    }

    this.containers = parsed;
  }

  private resolveAvailableFields(vm: ControlCenterViewModel): CompositionFieldReference[] {
    const bindingStep = vm.steps.find(step => step.key === 'field-library-binding');
    const bindings = this.bindingEngine.parseBindingsPayload(bindingStep?.values['bindingPayload']);
    return bindings
      .filter(item => item.visible)
      .sort((left, right) => left.displayOrder - right.displayOrder)
      .map(item => ({
        fieldKey: item.fieldKey,
        label: item.label,
        type: item.type
      }));
  }

  private moveContainer(container: FormCompositionContainer, direction: -1 | 1): void {
    const ordered = [...this.containers].sort((left, right) => left.displayOrder - right.displayOrder);
    const currentIndex = ordered.findIndex(item => item.id === container.id);
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
    this.containers = this.compositionEngine.normalizeDisplayOrder(reordered);
    this.evaluateComposition(true);
  }

  private normalizeNullable(value: unknown): string | null {
    const normalized = String(value ?? '').trim();
    return normalized.length > 0 ? normalized : null;
  }

  private buildContainerId(): string {
    return `container-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  }
}
