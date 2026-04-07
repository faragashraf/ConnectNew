import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { auditTime } from 'rxjs/operators';
import { FormCompositionEngine } from '../../domain/form-composition/form-composition.engine';
import { FieldLibraryBindingEngine } from '../../domain/field-library-binding/field-library-binding.engine';
import {
  ControlCenterStepViewModel,
  ControlCenterViewModel
} from '../../domain/models/admin-control-center.view-models';
import {
  PreviewRenderingMap,
  PreviewSimulationDirection,
  PreviewSimulationMode
} from '../../domain/models/preview-simulation.models';
import { ValidationRulesEngine } from '../../domain/validation-rules/validation-rules.engine';
import { PreviewSimulationEngine } from '../../domain/preview-simulation/preview-simulation.engine';
import { AdminControlCenterFacade } from '../../facades/admin-control-center.facade';

@Component({
  selector: 'app-preview-simulation-page',
  templateUrl: './preview-simulation-page.component.html',
  styleUrls: ['./preview-simulation-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PreviewSimulationPageComponent implements OnInit, OnDestroy {
  readonly stepKey = 'preview-simulation' as const;

  readonly previewForm: FormGroup = this.fb.group({
    previewDirection: [null, [Validators.required]],
    previewMode: [null, [Validators.required]],
    sampleReference: ['', [Validators.maxLength(120)]],
    enableSimulationTrace: [false],
    previewNotes: ['', [Validators.maxLength(1200)]]
  });

  vm: ControlCenterViewModel | null = null;
  step: ControlCenterStepViewModel | null = null;
  renderingMap: PreviewRenderingMap | null = null;

  stepMessage = '';
  stepMessageSeverity: 'success' | 'warn' = 'warn';

  private readonly subscriptions = new Subscription();
  private syncingFromStore = false;

  constructor(
    private readonly fb: FormBuilder,
    private readonly facade: AdminControlCenterFacade,
    private readonly router: Router,
    private readonly bindingEngine: FieldLibraryBindingEngine,
    private readonly compositionEngine: FormCompositionEngine,
    private readonly validationRulesEngine: ValidationRulesEngine,
    private readonly previewEngine: PreviewSimulationEngine
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

        this.patchFormFromStep(matchingStep.values, vm.context.documentDirection);
        this.evaluatePreview(false);
      })
    );

    this.subscriptions.add(
      this.previewForm.valueChanges
        .pipe(auditTime(80))
        .subscribe(() => {
          if (this.syncingFromStore) {
            return;
          }

          this.evaluatePreview(true);
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

  getOptions(fieldKey: string): Array<{ label: string; value: string }> {
    const field = this.step?.fields.find(item => item.key === fieldKey);
    return [...(field?.options ?? [])];
  }

  controlHasError(controlName: string): boolean {
    const control = this.previewForm.get(controlName);
    if (!control) {
      return false;
    }

    return control.invalid && (control.dirty || control.touched);
  }

  controlErrorMessage(controlName: string): string {
    const control = this.previewForm.get(controlName);
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

  onSaveDraft(): void {
    this.evaluatePreview(true);
    const draftResult = this.facade.saveDraft();
    this.stepMessageSeverity = draftResult.success ? 'success' : 'warn';
    this.stepMessage = draftResult.message;
  }

  onGoNext(): void {
    this.previewForm.markAllAsTouched();
    this.evaluatePreview(true);

    const hasBlockingIssues = (this.renderingMap?.blockingIssues.length ?? 0) > 0;
    if (this.previewForm.invalid || hasBlockingIssues || !this.step?.isCompleted) {
      this.stepMessageSeverity = 'warn';
      this.stepMessage = 'لا يمكن المتابعة قبل إغلاق مشاكل المعاينة المانعة.';
      return;
    }

    const nextStep = this.facade.getNextStepKey(this.stepKey);
    if (!nextStep) {
      return;
    }

    this.stepMessage = '';
    this.router.navigate(['/Admin/ControlCenter', nextStep]);
  }

  goToSafeStep(): void {
    const safeStep = this.facade.resolveSafeStepKey(this.stepKey);
    this.facade.setActiveStepByKey(safeStep);
    this.router.navigate(['/Admin/ControlCenter', safeStep]);
  }

  private evaluatePreview(syncToStore: boolean): void {
    if (!this.vm) {
      this.renderingMap = null;
      return;
    }

    const input = this.buildPreviewInput(this.vm);
    this.renderingMap = this.previewEngine.buildRenderingMap(input);

    if (!syncToStore) {
      return;
    }

    const raw = this.previewForm.getRawValue();
    const payload = this.previewEngine.serializeRenderingMap(this.renderingMap);
    const token = this.renderingMap.blockingIssues.length === 0 ? 'valid' : null;

    this.facade.updateFieldValue(this.stepKey, 'previewDirection', raw.previewDirection);
    this.facade.updateFieldValue(this.stepKey, 'previewMode', raw.previewMode);
    this.facade.updateFieldValue(this.stepKey, 'sampleReference', raw.sampleReference);
    this.facade.updateFieldValue(this.stepKey, 'enableSimulationTrace', raw.enableSimulationTrace);
    this.facade.updateFieldValue(this.stepKey, 'previewNotes', raw.previewNotes);
    this.facade.updateFieldValue(this.stepKey, 'renderingMapPayload', payload);
    this.facade.updateFieldValue(this.stepKey, 'previewValidationToken', token);
  }

  private buildPreviewInput(vm: ControlCenterViewModel): {
    mode: PreviewSimulationMode;
    direction: PreviewSimulationDirection;
    bindings: ReturnType<FieldLibraryBindingEngine['parseBindingsPayload']>;
    containers: ReturnType<FormCompositionEngine['parseContainersPayload']>;
    requiredFieldKeys: string[];
    workflow: {
      routingMode: string | null;
      routeResolutionMode: string | null;
      targetResolutionStrategy: string | null;
      directionAwareBehavior: string | null;
      createConfigRouteKey: string | null;
      viewConfigRouteKey: string | null;
      routeKeyPrefix: string | null;
      primaryConfigRouteKey: string | null;
    };
  } {
    const raw = this.previewForm.getRawValue();

    const bindingStep = vm.steps.find(step => step.key === 'field-library-binding');
    const compositionStep = vm.steps.find(step => step.key === 'form-composition');
    const workflowStep = vm.steps.find(step => step.key === 'workflow-routing');
    const validationStep = vm.steps.find(step => step.key === 'validation-rules');

    const bindings = this.bindingEngine.parseBindingsPayload(bindingStep?.values['bindingPayload']);
    const containers = this.compositionEngine.parseContainersPayload(compositionStep?.values['compositionLayoutPayload']);

    const parsedConditionalPayload = this.validationRulesEngine.parseConditionalPayload(
      validationStep?.values['conditionalRulesPayload']
    );

    const requiredFieldKeys = parsedConditionalPayload.requiredRules
      .filter(rule => rule.isRequired)
      .map(rule => rule.fieldKey);

    return {
      mode: this.normalizeMode(raw.previewMode),
      direction: this.normalizeDirection(raw.previewDirection),
      bindings,
      containers,
      requiredFieldKeys,
      workflow: {
        routingMode: this.normalizeNullable(workflowStep?.values['routingMode']),
        routeResolutionMode: this.normalizeNullable(workflowStep?.values['routeResolutionMode']),
        targetResolutionStrategy: this.normalizeNullable(workflowStep?.values['targetResolutionStrategy']),
        directionAwareBehavior: this.normalizeNullable(workflowStep?.values['directionAwareBehavior']),
        createConfigRouteKey: this.normalizeNullable(workflowStep?.values['createConfigRouteKey']),
        viewConfigRouteKey: this.normalizeNullable(workflowStep?.values['viewConfigRouteKey']),
        routeKeyPrefix: this.normalizeNullable(vm.context.routeKeyPrefix),
        primaryConfigRouteKey: this.normalizeNullable(vm.context.primaryConfigRouteKey)
      }
    };
  }

  private patchFormFromStep(values: Record<string, unknown>, defaultDirection: 'incoming' | 'outgoing' | null): void {
    const resolvedDirection = this.normalizeDirection(values['previewDirection'] ?? defaultDirection ?? 'incoming');
    const resolvedMode = this.normalizeMode(values['previewMode'] ?? 'create');

    const nextValue = {
      previewDirection: resolvedDirection,
      previewMode: resolvedMode,
      sampleReference: String(values['sampleReference'] ?? '').trim(),
      enableSimulationTrace: values['enableSimulationTrace'] === true,
      previewNotes: String(values['previewNotes'] ?? '').trim()
    };

    this.syncingFromStore = true;
    this.previewForm.patchValue(nextValue, { emitEvent: false });
    this.syncingFromStore = false;
  }

  private normalizeMode(value: unknown): PreviewSimulationMode {
    const normalized = String(value ?? '').trim();
    if (normalized === 'edit' || normalized === 'view') {
      return normalized;
    }

    return 'create';
  }

  private normalizeDirection(value: unknown): PreviewSimulationDirection {
    const normalized = String(value ?? '').trim();
    return normalized === 'outgoing' ? 'outgoing' : 'incoming';
  }

  private normalizeNullable(value: unknown): string | null {
    const normalized = String(value ?? '').trim();
    return normalized.length > 0 ? normalized : null;
  }
}
