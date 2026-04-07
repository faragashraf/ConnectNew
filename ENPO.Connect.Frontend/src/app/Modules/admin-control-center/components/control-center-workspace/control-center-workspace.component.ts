import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, combineLatest } from 'rxjs';
import {
  AdminControlCenterFacade,
  ControlCenterStepViewModel
} from '../../facades/admin-control-center.facade';
import {
  ControlCenterFieldDefinition,
  ControlCenterFieldOption,
  isControlCenterStepKey
} from '../../domain/models/admin-control-center.models';

@Component({
  selector: 'app-control-center-workspace',
  templateUrl: './control-center-workspace.component.html',
  styleUrls: ['./control-center-workspace.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ControlCenterWorkspaceComponent implements OnInit, OnDestroy {
  stepForm: FormGroup = new FormGroup({});
  currentStep: ControlCenterStepViewModel | null = null;
  requiredFields: ReadonlyArray<ControlCenterFieldDefinition> = [];
  optionalFields: ReadonlyArray<ControlCenterFieldDefinition> = [];
  stepMessage = '';
  stepMessageSeverity: 'warn' | 'success' = 'warn';

  private readonly subscriptions = new Subscription();
  private readonly formSubscriptions = new Subscription();
  private activeRouteStepKey: string | null = null;

  constructor(
    private readonly facade: AdminControlCenterFacade,
    private readonly route: ActivatedRoute,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.subscriptions.add(
      combineLatest([this.route.paramMap, this.facade.vm$]).subscribe(([params, vm]) => {
        const routeStepKey = params.get('stepKey');
        if (!isControlCenterStepKey(routeStepKey)) {
          const fallback = this.facade.resolveSafeStepKey(routeStepKey);
          this.router.navigate(['/Admin/ControlCenter', fallback]);
          return;
        }

        const currentStep = vm.steps.find(step => step.key === routeStepKey) ?? null;
        if (!currentStep) {
          return;
        }

        this.currentStep = currentStep;
        this.requiredFields = currentStep.requiredFields;
        this.optionalFields = currentStep.optionalFields;

        if (this.activeRouteStepKey !== routeStepKey) {
          this.activeRouteStepKey = routeStepKey;
          this.facade.setActiveStepByKey(routeStepKey);
          this.rebuildForm(currentStep);
          this.stepMessage = '';
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.formSubscriptions.unsubscribe();
  }

  trackField = (_index: number, field: ControlCenterFieldDefinition): string => field.key;

  resolveOptions(field: ControlCenterFieldDefinition): ControlCenterFieldOption[] {
    return field.options ? [...field.options] : [];
  }

  isFieldInvalid(field: ControlCenterFieldDefinition): boolean {
    const control = this.stepForm.get(field.key);
    if (!control || !field.required || field.type === 'switch') {
      return false;
    }

    return control.invalid && control.touched;
  }

  onSaveCurrentStepDraft(): void {
    this.facade.saveDraft();
    this.stepMessageSeverity = 'success';
    this.stepMessage = 'تم حفظ بيانات هذه الخطوة ضمن المسودة.';
  }

  onGoPrevious(): void {
    if (!this.currentStep) {
      return;
    }

    const previousStepKey = this.facade.getPreviousStepKey(this.currentStep.key);
    if (!previousStepKey) {
      return;
    }

    this.router.navigate(['/Admin/ControlCenter', previousStepKey]);
  }

  onGoNext(): void {
    if (!this.currentStep) {
      return;
    }

    if (!this.facade.isStepComplete(this.currentStep.key)) {
      this.markRequiredControlsAsTouched();
      this.stepMessageSeverity = 'warn';
      this.stepMessage = 'لا يمكن الانتقال للخطوة التالية قبل استكمال البيانات الإلزامية.';
      return;
    }

    const nextStepKey = this.facade.getNextStepKey(this.currentStep.key);
    if (!nextStepKey) {
      this.stepMessageSeverity = 'success';
      this.stepMessage = 'تم استكمال هذه الخطوة. يمكنك الآن استخدام مركز النشر من أعلى الصفحة.';
      return;
    }

    this.router.navigate(['/Admin/ControlCenter', nextStepKey]);
  }

  hasPreviousStep(): boolean {
    if (!this.currentStep) {
      return false;
    }

    return this.facade.getPreviousStepKey(this.currentStep.key) != null;
  }

  hasNextStep(): boolean {
    if (!this.currentStep) {
      return false;
    }

    return this.facade.getNextStepKey(this.currentStep.key) != null;
  }

  onReturnToSafeStep(): void {
    const safeStep = this.facade.resolveSafeStepKey(this.activeRouteStepKey);
    this.facade.setActiveStepByKey(safeStep);
    this.router.navigate(['/Admin/ControlCenter', safeStep]);
  }

  private rebuildForm(step: ControlCenterStepViewModel): void {
    this.formSubscriptions.unsubscribe();
    const controls: Record<string, FormControl<unknown>> = {};

    for (const field of step.fields) {
      const value = this.resolveControlInitialValue(field, step.values[field.key]);
      const validators = field.required && field.type !== 'switch'
        ? [Validators.required]
        : [];
      controls[field.key] = new FormControl(value, validators);
    }

    this.stepForm = new FormGroup(controls);

    for (const field of step.fields) {
      const control = this.stepForm.get(field.key);
      if (!control) {
        continue;
      }

      this.formSubscriptions.add(
        control.valueChanges.subscribe(value => {
          this.facade.updateFieldValue(step.key, field.key, value);
        })
      );
    }
  }

  private resolveControlInitialValue(field: ControlCenterFieldDefinition, value: unknown): unknown {
    if (field.type === 'switch') {
      return typeof value === 'boolean' ? value : null;
    }

    if (field.type === 'select') {
      return value ?? null;
    }

    return value ?? '';
  }

  private markRequiredControlsAsTouched(): void {
    for (const field of this.requiredFields) {
      if (field.type === 'switch') {
        continue;
      }

      const control = this.stepForm.get(field.key);
      control?.markAsTouched();
    }
  }
}
