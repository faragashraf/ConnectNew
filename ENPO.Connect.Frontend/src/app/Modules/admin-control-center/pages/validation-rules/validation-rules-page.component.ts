import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { auditTime } from 'rxjs/operators';
import {
  ConditionalPayloadBundle,
  ConditionalRuleItem,
  RequiredRuleItem,
  SubmissionBlockingRuleItem,
  ValidationRulesConfig,
  ValidationRulesEvaluationResult,
  ValidationRulesFieldReference
} from '../../domain/models/validation-rules.models';
import {
  ControlCenterStepViewModel,
  ControlCenterViewModel
} from '../../domain/models/admin-control-center.view-models';
import { FieldLibraryBindingEngine } from '../../domain/field-library-binding/field-library-binding.engine';
import { ValidationRulesEngine } from '../../domain/validation-rules/validation-rules.engine';
import { AdminControlCenterFacade } from '../../facades/admin-control-center.facade';

@Component({
  selector: 'app-validation-rules-page',
  templateUrl: './validation-rules-page.component.html',
  styleUrls: ['./validation-rules-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ValidationRulesPageComponent implements OnInit, OnDestroy {
  readonly stepKey = 'validation-rules' as const;

  readonly operatorOptions = [
    { label: 'يساوي', value: 'eq' },
    { label: 'لا يساوي', value: 'neq' },
    { label: 'يحتوي', value: 'contains' },
    { label: 'أكبر من', value: 'gt' },
    { label: 'أقل من', value: 'lt' }
  ];

  readonly effectOptions = [
    { label: 'إجبار الحقل (Required)', value: 'required' },
    { label: 'قراءة فقط (Readonly)', value: 'readonly' },
    { label: 'إخفاء الحقل (Hidden)', value: 'hidden' },
    { label: 'منع الإرسال (Block Submit)', value: 'block-submit' }
  ];

  readonly validationForm: FormGroup = this.fb.group({
    validationLevel: [null, [Validators.required]],
    submitBehavior: [null, [Validators.required]],
    enableCrossFieldValidation: [false],
    validationNotes: ['', [Validators.maxLength(1200)]]
  });

  readonly conditionalRuleForm: FormGroup = this.fb.group({
    leftFieldKey: [null, [Validators.required]],
    operator: ['eq', [Validators.required]],
    rightValue: ['', [Validators.required, Validators.maxLength(200)]],
    effect: ['required', [Validators.required]]
  });

  readonly blockingRuleForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    conditionExpression: ['', [Validators.required, Validators.maxLength(300)]],
    message: ['', [Validators.required, Validators.maxLength(300)]]
  });

  vm: ControlCenterViewModel | null = null;
  step: ControlCenterStepViewModel | null = null;
  availableFields: ValidationRulesFieldReference[] = [];
  requiredRules: RequiredRuleItem[] = [];
  conditionalRules: ConditionalRuleItem[] = [];
  blockingRules: SubmissionBlockingRuleItem[] = [];
  evaluation: ValidationRulesEvaluationResult = { isValid: false, blockingIssues: [], warnings: [] };

  conditionalDialogVisible = false;
  blockingDialogVisible = false;
  editingConditionalRuleId: string | null = null;
  editingBlockingRuleId: string | null = null;

  stepMessage = '';
  stepMessageSeverity: 'success' | 'warn' = 'warn';

  private readonly subscriptions = new Subscription();
  private syncingFromStore = false;

  constructor(
    private readonly fb: FormBuilder,
    private readonly facade: AdminControlCenterFacade,
    private readonly router: Router,
    private readonly bindingEngine: FieldLibraryBindingEngine,
    private readonly rulesEngine: ValidationRulesEngine
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
        this.patchFormFromStep(matchingStep.values);
        this.patchRulesFromStep(matchingStep.values);
        this.evaluateRules(false);
      })
    );

    this.subscriptions.add(
      this.validationForm.valueChanges
        .pipe(auditTime(80))
        .subscribe(() => {
          if (this.syncingFromStore) {
            return;
          }

          this.evaluateRules(true);
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

  get enabledRequiredRulesCount(): number {
    return this.requiredRules.filter(rule => rule.isRequired).length;
  }

  get fieldOptions(): Array<{ label: string; value: string }> {
    return this.availableFields.map(field => ({
      label: `${field.label} (${field.fieldKey})`,
      value: field.fieldKey
    }));
  }

  getOptions(fieldKey: string): Array<{ label: string; value: string }> {
    const field = this.step?.fields.find(item => item.key === fieldKey);
    return [...(field?.options ?? [])];
  }

  controlHasError(controlName: string): boolean {
    const control = this.validationForm.get(controlName);
    if (!control) {
      return false;
    }

    return control.invalid && (control.dirty || control.touched);
  }

  dialogHasError(dialogType: 'conditional' | 'blocking', controlName: string): boolean {
    const form = dialogType === 'conditional' ? this.conditionalRuleForm : this.blockingRuleForm;
    const control = form.get(controlName);
    if (!control) {
      return false;
    }

    return control.invalid && (control.dirty || control.touched);
  }

  controlErrorMessage(controlName: string): string {
    const control = this.validationForm.get(controlName);
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

  dialogErrorMessage(dialogType: 'conditional' | 'blocking', controlName: string): string {
    const form = dialogType === 'conditional' ? this.conditionalRuleForm : this.blockingRuleForm;
    const control = form.get(controlName);
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

  resolveOperatorLabel(operator: ConditionalRuleItem['operator']): string {
    return this.operatorOptions.find(option => option.value === operator)?.label ?? operator;
  }

  resolveEffectLabel(effect: ConditionalRuleItem['effect']): string {
    return this.effectOptions.find(option => option.value === effect)?.label ?? effect;
  }

  resolveFieldLabel(fieldKey: string): string {
    return this.availableFields.find(item => item.fieldKey === fieldKey)?.label ?? fieldKey;
  }

  onRequiredRuleToggle(rule: RequiredRuleItem, isRequired: boolean): void {
    this.requiredRules = this.requiredRules.map(item =>
      item.id === rule.id
        ? { ...item, isRequired }
        : item
    );
    this.evaluateRules(true);
  }

  openAddConditionalDialog(): void {
    this.editingConditionalRuleId = null;
    this.conditionalRuleForm.reset({
      leftFieldKey: this.availableFields[0]?.fieldKey ?? null,
      operator: 'eq',
      rightValue: '',
      effect: 'required'
    });
    this.conditionalDialogVisible = true;
  }

  openEditConditionalDialog(rule: ConditionalRuleItem): void {
    this.editingConditionalRuleId = rule.id;
    this.conditionalRuleForm.reset({
      leftFieldKey: rule.leftFieldKey,
      operator: rule.operator,
      rightValue: rule.rightValue,
      effect: rule.effect
    });
    this.conditionalDialogVisible = true;
  }

  saveConditionalDialog(): void {
    if (this.conditionalRuleForm.invalid) {
      this.conditionalRuleForm.markAllAsTouched();
      return;
    }

    const raw = this.conditionalRuleForm.getRawValue();
    const id = this.editingConditionalRuleId ?? this.buildConditionalRuleId();
    const candidate: ConditionalRuleItem = {
      id,
      leftFieldKey: String(raw.leftFieldKey ?? '').trim(),
      operator: raw.operator,
      rightValue: String(raw.rightValue ?? '').trim(),
      effect: raw.effect
    };

    const withoutCurrent = this.conditionalRules.filter(item => item.id !== id);
    this.conditionalRules = [...withoutCurrent, candidate];
    this.conditionalDialogVisible = false;
    this.evaluateRules(true);
  }

  deleteConditionalRule(rule: ConditionalRuleItem): void {
    this.conditionalRules = this.conditionalRules.filter(item => item.id !== rule.id);
    this.evaluateRules(true);
  }

  openAddBlockingDialog(): void {
    this.editingBlockingRuleId = null;
    this.blockingRuleForm.reset({
      name: '',
      conditionExpression: '',
      message: ''
    });
    this.blockingDialogVisible = true;
  }

  openEditBlockingDialog(rule: SubmissionBlockingRuleItem): void {
    this.editingBlockingRuleId = rule.id;
    this.blockingRuleForm.reset({
      name: rule.name,
      conditionExpression: rule.conditionExpression,
      message: rule.message
    });
    this.blockingDialogVisible = true;
  }

  saveBlockingDialog(): void {
    if (this.blockingRuleForm.invalid) {
      this.blockingRuleForm.markAllAsTouched();
      return;
    }

    const raw = this.blockingRuleForm.getRawValue();
    const id = this.editingBlockingRuleId ?? this.buildBlockingRuleId();
    const candidate: SubmissionBlockingRuleItem = {
      id,
      name: String(raw.name ?? '').trim(),
      conditionExpression: String(raw.conditionExpression ?? '').trim(),
      message: String(raw.message ?? '').trim()
    };

    const withoutCurrent = this.blockingRules.filter(item => item.id !== id);
    this.blockingRules = [...withoutCurrent, candidate];
    this.blockingDialogVisible = false;
    this.evaluateRules(true);
  }

  deleteBlockingRule(rule: SubmissionBlockingRuleItem): void {
    this.blockingRules = this.blockingRules.filter(item => item.id !== rule.id);
    this.evaluateRules(true);
  }

  onSaveDraft(): void {
    this.evaluateRules(true);
    this.facade.saveDraft();
    this.stepMessageSeverity = 'success';
    this.stepMessage = 'تم حفظ إعدادات Validation Rules.';
  }

  onGoNext(): void {
    this.validationForm.markAllAsTouched();
    this.evaluateRules(true);

    if (this.validationForm.invalid || !this.evaluation.isValid || !this.step?.isCompleted) {
      this.stepMessageSeverity = 'warn';
      this.stepMessage = 'لا يمكن المتابعة قبل استكمال قواعد التحقق وحل المشكلات المانعة.';
      return;
    }

    const nextStep = this.facade.getNextStepKey(this.stepKey);
    if (!nextStep) {
      return;
    }

    this.stepMessage = '';
    this.router.navigate(['/Admin/ControlCenter', nextStep]);
  }

  private evaluateRules(syncToStore: boolean): void {
    const config = this.buildConfig();
    this.evaluation = this.rulesEngine.evaluate(config);

    if (!syncToStore) {
      return;
    }

    const conditionalPayload = this.rulesEngine.serializeConditionalPayload({
      requiredRules: this.requiredRules,
      conditionalRules: this.conditionalRules
    });
    const blockingPayload = this.rulesEngine.serializeBlockingPayload(this.blockingRules);
    const token = this.evaluation.isValid ? 'valid' : null;

    this.facade.updateFieldValue(this.stepKey, 'validationLevel', config.validationLevel);
    this.facade.updateFieldValue(this.stepKey, 'submitBehavior', config.submitBehavior);
    this.facade.updateFieldValue(this.stepKey, 'enableCrossFieldValidation', config.enableCrossFieldValidation);
    this.facade.updateFieldValue(this.stepKey, 'validationNotes', config.validationNotes);
    this.facade.updateFieldValue(this.stepKey, 'conditionalRulesPayload', conditionalPayload);
    this.facade.updateFieldValue(this.stepKey, 'submissionBlockingPayload', blockingPayload);
    this.facade.updateFieldValue(this.stepKey, 'validationRulesToken', token);
  }

  private patchFormFromStep(values: Record<string, unknown>): void {
    const nextValue = {
      validationLevel: this.normalizeNullable(values['validationLevel']),
      submitBehavior: this.normalizeNullable(values['submitBehavior']),
      enableCrossFieldValidation: values['enableCrossFieldValidation'] === true,
      validationNotes: String(values['validationNotes'] ?? '').trim()
    };

    this.syncingFromStore = true;
    this.validationForm.patchValue(nextValue, { emitEvent: false });
    this.syncingFromStore = false;
  }

  private patchRulesFromStep(values: Record<string, unknown>): void {
    const parsedConditional = this.rulesEngine.parseConditionalPayload(values['conditionalRulesPayload']);
    const mergedRequiredRules = this.rulesEngine.mergeRequiredRules(parsedConditional.requiredRules, this.availableFields);
    const incomingConditionalBundle: ConditionalPayloadBundle = {
      requiredRules: mergedRequiredRules,
      conditionalRules: parsedConditional.conditionalRules
    };

    const currentConditionalSerialized = this.rulesEngine.serializeConditionalPayload({
      requiredRules: this.requiredRules,
      conditionalRules: this.conditionalRules
    });
    const incomingConditionalSerialized = this.rulesEngine.serializeConditionalPayload(incomingConditionalBundle);
    if (currentConditionalSerialized !== incomingConditionalSerialized) {
      this.requiredRules = [...incomingConditionalBundle.requiredRules];
      this.conditionalRules = [...incomingConditionalBundle.conditionalRules];
    }

    const incomingBlockingRules = this.rulesEngine.parseBlockingPayload(values['submissionBlockingPayload']);
    const currentBlockingSerialized = this.rulesEngine.serializeBlockingPayload(this.blockingRules);
    const incomingBlockingSerialized = this.rulesEngine.serializeBlockingPayload(incomingBlockingRules);
    if (currentBlockingSerialized !== incomingBlockingSerialized) {
      this.blockingRules = [...incomingBlockingRules];
    }
  }

  private resolveAvailableFields(vm: ControlCenterViewModel): ValidationRulesFieldReference[] {
    const bindingStep = vm.steps.find(step => step.key === 'field-library-binding');
    const bindings = this.bindingEngine.parseBindingsPayload(bindingStep?.values['bindingPayload']);

    return bindings
      .filter(item => item.visible)
      .sort((left, right) => left.displayOrder - right.displayOrder)
      .map(item => ({
        fieldKey: item.fieldKey,
        label: item.label,
        requiredByDefault: item.required
      }));
  }

  private buildConfig(): ValidationRulesConfig {
    const raw = this.validationForm.getRawValue();

    return {
      validationLevel: raw.validationLevel,
      submitBehavior: raw.submitBehavior,
      enableCrossFieldValidation: raw.enableCrossFieldValidation === true,
      validationNotes: String(raw.validationNotes ?? '').trim(),
      requiredRules: this.requiredRules,
      conditionalRules: this.conditionalRules,
      blockingRules: this.blockingRules
    };
  }

  private normalizeNullable(value: unknown): string | null {
    const normalized = String(value ?? '').trim();
    return normalized.length > 0 ? normalized : null;
  }

  private buildConditionalRuleId(): string {
    return `cond-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  }

  private buildBlockingRuleId(): string {
    return `block-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  }
}
