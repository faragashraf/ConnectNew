import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { auditTime } from 'rxjs/operators';
import { AccessVisibilityEngine } from '../../domain/access-visibility/access-visibility.engine';
import { FormCompositionEngine } from '../../domain/form-composition/form-composition.engine';
import { FieldLibraryBindingEngine } from '../../domain/field-library-binding/field-library-binding.engine';
import {
  ControlCenterStepViewModel,
  ControlCenterViewModel
} from '../../domain/models/admin-control-center.view-models';
import {
  ReadinessAuditCheckGroup,
  ReadinessAuditResult
} from '../../domain/models/readiness-audit.models';
import { ReadinessAuditEngine } from '../../domain/readiness-audit/readiness-audit.engine';
import { ValidationRulesEngine } from '../../domain/validation-rules/validation-rules.engine';
import { WorkflowRoutingEngine } from '../../domain/workflow-routing/workflow-routing.engine';
import { AdminControlCenterFacade } from '../../facades/admin-control-center.facade';

@Component({
  selector: 'app-readiness-audit-page',
  templateUrl: './readiness-audit-page.component.html',
  styleUrls: ['./readiness-audit-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReadinessAuditPageComponent implements OnInit, OnDestroy {
  readonly stepKey = 'readiness-audit' as const;

  readonly auditForm: FormGroup = this.fb.group({
    auditOwner: ['', [Validators.required, Validators.maxLength(120)]],
    auditChecklistVersion: ['', [Validators.required, Validators.maxLength(120)]],
    blockOnCriticalIssues: ['true', [Validators.required]],
    auditNotes: ['', [Validators.maxLength(1200)]]
  });

  vm: ControlCenterViewModel | null = null;
  step: ControlCenterStepViewModel | null = null;
  auditGroups: ReadonlyArray<ReadinessAuditCheckGroup> = [];
  auditResult: ReadinessAuditResult | null = null;

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
    private readonly workflowRoutingEngine: WorkflowRoutingEngine,
    private readonly accessEngine: AccessVisibilityEngine,
    private readonly validationRulesEngine: ValidationRulesEngine,
    private readonly readinessAuditEngine: ReadinessAuditEngine
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
        this.evaluateAudit(false);
      })
    );

    this.subscriptions.add(
      this.auditForm.valueChanges
        .pipe(auditTime(80))
        .subscribe(() => {
          if (this.syncingFromStore) {
            return;
          }

          this.evaluateAudit(true);
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
    const control = this.auditForm.get(controlName);
    if (!control) {
      return false;
    }

    return control.invalid && (control.dirty || control.touched);
  }

  controlErrorMessage(controlName: string): string {
    const control = this.auditForm.get(controlName);
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

  resolveGroupSeverity(group: ReadinessAuditCheckGroup): 'success' | 'warning' | 'danger' {
    if (group.blockingIssues.length > 0) {
      return 'danger';
    }

    if (group.warnings.length > 0) {
      return 'warning';
    }

    return 'success';
  }

  onSaveDraft(): void {
    this.evaluateAudit(true);
    const draftResult = this.facade.saveDraft();
    this.stepMessageSeverity = draftResult.success ? 'success' : 'warn';
    this.stepMessage = draftResult.message;
  }

  onGoNext(): void {
    this.auditForm.markAllAsTouched();
    this.evaluateAudit(true);

    const hasBlockingIssues = (this.auditResult?.blockingIssues.length ?? 0) > 0;
    if (this.auditForm.invalid || hasBlockingIssues || !this.step?.isCompleted) {
      this.stepMessageSeverity = 'warn';
      this.stepMessage = 'لا يمكن المتابعة قبل إغلاق كل المشكلات المانعة في تدقيق الجاهزية.';
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

  private evaluateAudit(syncToStore: boolean): void {
    if (!this.vm) {
      this.auditResult = null;
      this.auditGroups = [];
      return;
    }

    this.auditGroups = this.buildAuditGroups(this.vm);
    this.auditResult = this.readinessAuditEngine.evaluate(this.auditGroups);

    if (!syncToStore) {
      return;
    }

    const raw = this.auditForm.getRawValue();
    const token = this.auditResult.blockingIssues.length === 0 ? 'valid' : null;

    this.facade.updateFieldValue(this.stepKey, 'auditOwner', raw.auditOwner);
    this.facade.updateFieldValue(this.stepKey, 'auditChecklistVersion', raw.auditChecklistVersion);
    this.facade.updateFieldValue(this.stepKey, 'blockOnCriticalIssues', raw.blockOnCriticalIssues);
    this.facade.updateFieldValue(this.stepKey, 'auditNotes', raw.auditNotes);
    this.facade.updateFieldValue(this.stepKey, 'readinessScore', String(this.auditResult.score));
    this.facade.updateFieldValue(this.stepKey, 'auditBlockingPayload', JSON.stringify(this.auditResult.blockingIssues));
    this.facade.updateFieldValue(this.stepKey, 'auditWarningsPayload', JSON.stringify(this.auditResult.warnings));
    this.facade.updateFieldValue(this.stepKey, 'readinessAuditToken', token);
  }

  private buildAuditGroups(vm: ControlCenterViewModel): ReadonlyArray<ReadinessAuditCheckGroup> {
    const bindingStep = vm.steps.find(step => step.key === 'field-library-binding');
    const compositionStep = vm.steps.find(step => step.key === 'form-composition');
    const workflowStep = vm.steps.find(step => step.key === 'workflow-routing');
    const accessStep = vm.steps.find(step => step.key === 'access-visibility');
    const validationStep = vm.steps.find(step => step.key === 'validation-rules');

    const bindings = this.bindingEngine.parseBindingsPayload(bindingStep?.values['bindingPayload']);
    const bindingValidation = this.bindingEngine.validateBindings(bindings);

    const explicitMissingBinding = bindings.length === 0
      ? ['لا توجد روابط حقول مرتبطة بالهيكل الحالي.']
      : [];

    const explicitHiddenRequired = bindings
      .filter(item => item.required && !item.visible)
      .map(item => `الحقل الإلزامي "${item.fieldKey}" مخفي.`);

    const bindingGroup: ReadinessAuditCheckGroup = {
      category: 'binding',
      title: 'ربط مكتبة الحقول',
      stepKey: 'field-library-binding',
      blockingIssues: [...bindingValidation.blockingIssues, ...explicitMissingBinding, ...explicitHiddenRequired],
      warnings: [...bindingValidation.warnings]
    };

    const containers = this.compositionEngine.parseContainersPayload(compositionStep?.values['compositionLayoutPayload']);
    const availableFields = bindings
      .filter(item => item.visible)
      .map(item => ({ fieldKey: item.fieldKey, label: item.label, type: item.type }));
    const allowInlineSections = compositionStep?.values['allowInlineSections'] === true;
    const compositionValidation = this.compositionEngine.validate(containers, availableFields, allowInlineSections);

    const explicitEmptyVisibleGroups = containers
      .filter(item => item.visible && item.fieldKeys.length === 0)
      .map(item => `المجموعة المرئية "${item.title}" فارغة.`);

    const compositionGroup: ReadinessAuditCheckGroup = {
      category: 'composition',
      title: 'تركيب النموذج',
      stepKey: 'form-composition',
      blockingIssues: [...compositionValidation.blockingIssues, ...explicitEmptyVisibleGroups],
      warnings: [...compositionValidation.warnings]
    };

    const workflowValidation = this.workflowRoutingEngine.validate({
      routingMode: this.normalizeRoutingMode(workflowStep?.values['routingMode']),
      defaultTargetUnit: String(workflowStep?.values['defaultTargetUnit'] ?? '').trim(),
      allowManualSelection: workflowStep?.values['allowManualSelection'] === true,
      routeResolutionMode: this.normalizeRouteResolutionMode(workflowStep?.values['routeResolutionMode']),
      targetResolutionStrategy: this.normalizeTargetStrategy(workflowStep?.values['targetResolutionStrategy']),
      createConfigRouteKey: String(workflowStep?.values['createConfigRouteKey'] ?? '').trim(),
      viewConfigRouteKey: String(workflowStep?.values['viewConfigRouteKey'] ?? '').trim(),
      directionAwareBehavior: this.normalizeDirectionBehavior(workflowStep?.values['directionAwareBehavior']),
      workflowNotes: String(workflowStep?.values['workflowNotes'] ?? '').trim()
    });

    const policyGroup: ReadinessAuditCheckGroup = {
      category: 'policy',
      title: 'سياسة سير العمل',
      stepKey: 'workflow-routing',
      blockingIssues: [...workflowValidation.blockingIssues],
      warnings: [...workflowValidation.warnings]
    };

    const routeGaps: string[] = [];
    const routeKeyPrefix = String(vm.context.routeKeyPrefix ?? '').trim();
    const primaryRoute = String(vm.context.primaryConfigRouteKey ?? '').trim();
    const createRoute = String(workflowStep?.values['createConfigRouteKey'] ?? '').trim();
    const viewRoute = String(workflowStep?.values['viewConfigRouteKey'] ?? '').trim();

    if (!routeKeyPrefix) {
      routeGaps.push('Route Key Prefix غير محدد في Scope Definition.');
    }
    if (!primaryRoute) {
      routeGaps.push('Primary Config Route Key غير محدد في Scope Definition.');
    }
    if (!createRoute) {
      routeGaps.push('Create Config Route Key غير محدد.');
    }
    if (!viewRoute) {
      routeGaps.push('View Config Route Key غير محدد.');
    }

    const routeWarnings: string[] = [];
    if (routeKeyPrefix && createRoute && !createRoute.startsWith(routeKeyPrefix)) {
      routeWarnings.push('Create Config Route Key لا يبدأ بنفس Route Key Prefix.');
    }
    if (routeKeyPrefix && viewRoute && !viewRoute.startsWith(routeKeyPrefix)) {
      routeWarnings.push('View Config Route Key لا يبدأ بنفس Route Key Prefix.');
    }

    const routeGroup: ReadinessAuditCheckGroup = {
      category: 'route',
      title: 'تغطية المسارات والإعدادات',
      stepKey: 'workflow-routing',
      blockingIssues: routeGaps,
      warnings: routeWarnings
    };

    const accessValidation = this.accessEngine.validate({
      createScope: String(accessStep?.values['createScope'] ?? '').trim(),
      readScope: String(accessStep?.values['readScope'] ?? '').trim(),
      workScope: String(accessStep?.values['workScope'] ?? '').trim(),
      adminScope: String(accessStep?.values['adminScope'] ?? '').trim(),
      publishScope: String(accessStep?.values['publishScope'] ?? '').trim(),
      visibilityNotes: String(accessStep?.values['visibilityNotes'] ?? '').trim()
    });

    const accessGroup: ReadinessAuditCheckGroup = {
      category: 'access',
      title: 'الصلاحيات والرؤية',
      stepKey: 'access-visibility',
      blockingIssues: [...accessValidation.blockingIssues],
      warnings: [...accessValidation.warnings]
    };

    const parsedConditionalPayload = this.validationRulesEngine.parseConditionalPayload(
      validationStep?.values['conditionalRulesPayload']
    );
    const mergedRequiredRules = this.validationRulesEngine.mergeRequiredRules(
      parsedConditionalPayload.requiredRules,
      bindings.map(item => ({
        fieldKey: item.fieldKey,
        label: item.label,
        requiredByDefault: item.required
      }))
    );

    const rulesEvaluation = this.validationRulesEngine.evaluate({
      validationLevel: this.normalizeValidationLevel(validationStep?.values['validationLevel']),
      submitBehavior: this.normalizeSubmitBehavior(validationStep?.values['submitBehavior']),
      enableCrossFieldValidation: validationStep?.values['enableCrossFieldValidation'] === true,
      validationNotes: String(validationStep?.values['validationNotes'] ?? '').trim(),
      requiredRules: mergedRequiredRules,
      conditionalRules: parsedConditionalPayload.conditionalRules,
      blockingRules: this.validationRulesEngine.parseBlockingPayload(validationStep?.values['submissionBlockingPayload'])
    });

    const validationGroup: ReadinessAuditCheckGroup = {
      category: 'validation',
      title: 'قواعد التحقق',
      stepKey: 'validation-rules',
      blockingIssues: [...rulesEvaluation.blockingIssues],
      warnings: [...rulesEvaluation.warnings]
    };

    const previewMap = vm.derived.preview.renderingMap;
    const previewGroup: ReadinessAuditCheckGroup = {
      category: 'preview',
      title: 'المعاينة والمحاكاة',
      stepKey: 'preview-simulation',
      blockingIssues: [...previewMap.blockingIssues],
      warnings: [...previewMap.warnings]
    };

    return [
      bindingGroup,
      compositionGroup,
      policyGroup,
      routeGroup,
      accessGroup,
      validationGroup,
      previewGroup
    ];
  }

  private patchFormFromStep(values: Record<string, unknown>): void {
    const nextValue = {
      auditOwner: String(values['auditOwner'] ?? '').trim(),
      auditChecklistVersion: String(values['auditChecklistVersion'] ?? '').trim(),
      blockOnCriticalIssues: String(values['blockOnCriticalIssues'] ?? 'true').trim() || 'true',
      auditNotes: String(values['auditNotes'] ?? '').trim()
    };

    this.syncingFromStore = true;
    this.auditForm.patchValue(nextValue, { emitEvent: false });
    this.syncingFromStore = false;
  }

  private normalizeRoutingMode(value: unknown): 'static' | 'manual' | 'hybrid' | null {
    const normalized = String(value ?? '').trim();
    if (normalized === 'static' || normalized === 'manual' || normalized === 'hybrid') {
      return normalized;
    }

    return null;
  }

  private normalizeRouteResolutionMode(value: unknown): 'static' | 'pattern' | 'context' | null {
    const normalized = String(value ?? '').trim();
    if (normalized === 'static' || normalized === 'pattern' || normalized === 'context') {
      return normalized;
    }

    return null;
  }

  private normalizeTargetStrategy(value: unknown): 'default-unit' | 'scope-match' | 'manual-fallback' | null {
    const normalized = String(value ?? '').trim();
    if (normalized === 'default-unit' || normalized === 'scope-match' || normalized === 'manual-fallback') {
      return normalized;
    }

    return null;
  }

  private normalizeDirectionBehavior(value: unknown): 'shared' | 'split' | 'fallback' | null {
    const normalized = String(value ?? '').trim();
    if (normalized === 'shared' || normalized === 'split' || normalized === 'fallback') {
      return normalized;
    }

    return null;
  }

  private normalizeValidationLevel(value: unknown): 'basic' | 'strict' | 'enterprise' | null {
    const normalized = String(value ?? '').trim();
    if (normalized === 'basic' || normalized === 'strict' || normalized === 'enterprise') {
      return normalized;
    }

    return null;
  }

  private normalizeSubmitBehavior(value: unknown): 'block' | 'confirm' | null {
    const normalized = String(value ?? '').trim();
    if (normalized === 'block' || normalized === 'confirm') {
      return normalized;
    }

    return null;
  }
}
