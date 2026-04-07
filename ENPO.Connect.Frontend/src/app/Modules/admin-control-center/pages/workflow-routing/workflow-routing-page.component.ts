import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { auditTime } from 'rxjs/operators';
import {
  WorkflowRoutingConfig,
  WorkflowRoutingValidationResult
} from '../../domain/models/workflow-routing.models';
import {
  ControlCenterStepViewModel,
  ControlCenterViewModel
} from '../../domain/models/admin-control-center.view-models';
import { WorkflowRoutingEngine } from '../../domain/workflow-routing/workflow-routing.engine';
import { AdminControlCenterFacade } from '../../facades/admin-control-center.facade';

@Component({
  selector: 'app-workflow-routing-page',
  templateUrl: './workflow-routing-page.component.html',
  styleUrls: ['./workflow-routing-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WorkflowRoutingPageComponent implements OnInit, OnDestroy {
  readonly stepKey = 'workflow-routing' as const;

  readonly workflowForm: FormGroup = this.fb.group({
    routingMode: [null, [Validators.required]],
    defaultTargetUnit: ['', [Validators.required, Validators.maxLength(100)]],
    allowManualSelection: [true],
    routeResolutionMode: [null, [Validators.required]],
    targetResolutionStrategy: [null, [Validators.required]],
    createConfigRouteKey: ['', [Validators.required, Validators.maxLength(180)]],
    viewConfigRouteKey: ['', [Validators.required, Validators.maxLength(180)]],
    directionAwareBehavior: [null, [Validators.required]],
    workflowNotes: ['', [Validators.maxLength(1200)]]
  });

  vm: ControlCenterViewModel | null = null;
  step: ControlCenterStepViewModel | null = null;
  validation: WorkflowRoutingValidationResult = { isValid: false, blockingIssues: [], warnings: [] };
  stepMessage = '';
  stepMessageSeverity: 'success' | 'warn' = 'warn';

  private readonly subscriptions = new Subscription();
  private syncingFromStore = false;

  constructor(
    private readonly fb: FormBuilder,
    private readonly facade: AdminControlCenterFacade,
    private readonly router: Router,
    private readonly workflowRoutingEngine: WorkflowRoutingEngine
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

        this.patchFormFromStep(matchingStep.values);
        this.evaluateWorkflow(false);
      })
    );

    this.subscriptions.add(
      this.workflowForm.valueChanges
        .pipe(auditTime(80))
        .subscribe(() => {
          if (this.syncingFromStore) {
            return;
          }

          this.evaluateWorkflow(true);
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
    const control = this.workflowForm.get(controlName);
    if (!control) {
      return false;
    }

    return control.invalid && (control.dirty || control.touched);
  }

  controlErrorMessage(controlName: string): string {
    const control = this.workflowForm.get(controlName);
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
    this.evaluateWorkflow(true);
    this.facade.saveDraft();
    this.stepMessageSeverity = 'success';
    this.stepMessage = 'تم حفظ إعدادات Workflow & Routing.';
  }

  onGoNext(): void {
    this.workflowForm.markAllAsTouched();
    this.evaluateWorkflow(true);

    if (this.workflowForm.invalid || !this.validation.isValid || !this.step?.isCompleted) {
      this.stepMessageSeverity = 'warn';
      this.stepMessage = 'لا يمكن المتابعة قبل استكمال قواعد Workflow & Routing.';
      return;
    }

    const nextStep = this.facade.getNextStepKey(this.stepKey);
    if (!nextStep) {
      return;
    }

    this.stepMessage = '';
    this.router.navigate(['/Admin/ControlCenter', nextStep]);
  }

  private evaluateWorkflow(syncToStore: boolean): void {
    const config = this.buildConfigFromForm();
    this.validation = this.workflowRoutingEngine.validate(config);

    if (!syncToStore) {
      return;
    }

    const token = this.validation.isValid ? 'valid' : null;
    this.facade.updateFieldValue(this.stepKey, 'routingMode', config.routingMode);
    this.facade.updateFieldValue(this.stepKey, 'defaultTargetUnit', config.defaultTargetUnit);
    this.facade.updateFieldValue(this.stepKey, 'allowManualSelection', config.allowManualSelection);
    this.facade.updateFieldValue(this.stepKey, 'routeResolutionMode', config.routeResolutionMode);
    this.facade.updateFieldValue(this.stepKey, 'targetResolutionStrategy', config.targetResolutionStrategy);
    this.facade.updateFieldValue(this.stepKey, 'createConfigRouteKey', config.createConfigRouteKey);
    this.facade.updateFieldValue(this.stepKey, 'viewConfigRouteKey', config.viewConfigRouteKey);
    this.facade.updateFieldValue(this.stepKey, 'directionAwareBehavior', config.directionAwareBehavior);
    this.facade.updateFieldValue(this.stepKey, 'workflowNotes', config.workflowNotes);
    this.facade.updateFieldValue(this.stepKey, 'workflowValidationToken', token);
  }

  private patchFormFromStep(values: Record<string, unknown>): void {
    const nextValue = {
      routingMode: this.normalizeNullable(values['routingMode']),
      defaultTargetUnit: String(values['defaultTargetUnit'] ?? '').trim(),
      allowManualSelection: values['allowManualSelection'] !== false,
      routeResolutionMode: this.normalizeNullable(values['routeResolutionMode']),
      targetResolutionStrategy: this.normalizeNullable(values['targetResolutionStrategy']),
      createConfigRouteKey: String(values['createConfigRouteKey'] ?? '').trim(),
      viewConfigRouteKey: String(values['viewConfigRouteKey'] ?? '').trim(),
      directionAwareBehavior: this.normalizeNullable(values['directionAwareBehavior']),
      workflowNotes: String(values['workflowNotes'] ?? '').trim()
    };

    this.syncingFromStore = true;
    this.workflowForm.patchValue(nextValue, { emitEvent: false });
    this.syncingFromStore = false;
  }

  private buildConfigFromForm(): WorkflowRoutingConfig {
    const raw = this.workflowForm.getRawValue();
    return {
      routingMode: raw.routingMode,
      defaultTargetUnit: String(raw.defaultTargetUnit ?? '').trim(),
      allowManualSelection: raw.allowManualSelection === true,
      routeResolutionMode: raw.routeResolutionMode,
      targetResolutionStrategy: raw.targetResolutionStrategy,
      createConfigRouteKey: String(raw.createConfigRouteKey ?? '').trim(),
      viewConfigRouteKey: String(raw.viewConfigRouteKey ?? '').trim(),
      directionAwareBehavior: raw.directionAwareBehavior,
      workflowNotes: String(raw.workflowNotes ?? '').trim()
    };
  }

  private normalizeNullable(value: unknown): string | null {
    const normalized = String(value ?? '').trim();
    return normalized.length > 0 ? normalized : null;
  }
}
