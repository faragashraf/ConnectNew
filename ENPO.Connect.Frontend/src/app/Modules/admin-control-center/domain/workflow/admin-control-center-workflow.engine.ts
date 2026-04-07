import { Injectable } from '@angular/core';
import {
  ADMIN_CONTROL_CENTER_DEFAULT_STEP,
  ADMIN_CONTROL_CENTER_STEP_DEFINITIONS,
  ControlCenterContextState,
  ControlCenterFieldDefinition,
  ControlCenterState,
  ControlCenterStepDefinition,
  ControlCenterStepKey,
  ControlCenterStepState,
  ControlCenterStepTransitionResult,
  ControlCenterStepValidationState,
  INITIAL_ADMIN_CONTROL_CENTER_CONTEXT,
  isControlCenterStepKey
} from '../models/admin-control-center.models';

interface MissingMandatoryField {
  readonly key: string;
  readonly label: string;
}

@Injectable()
export class AdminControlCenterWorkflowEngine {
  private readonly stepDefinitions = ADMIN_CONTROL_CENTER_STEP_DEFINITIONS;
  private readonly definitionMap = new Map<ControlCenterStepKey, ControlCenterStepDefinition>(
    this.stepDefinitions.map(definition => [definition.key, definition])
  );

  getDefinitions(): ReadonlyArray<ControlCenterStepDefinition> {
    return this.stepDefinitions;
  }

  getDefinitionByKey(stepKey: ControlCenterStepKey): ControlCenterStepDefinition | undefined {
    return this.definitionMap.get(stepKey);
  }

  createInitialState(initialStepKey: ControlCenterStepKey = ADMIN_CONTROL_CENTER_DEFAULT_STEP): ControlCenterState {
    const initialSteps: ControlCenterStepState[] = this.stepDefinitions.map(definition => {
      const missingMandatory = definition.fields
        .filter(field => field.required)
        .map(field => ({ key: field.key, label: field.label }));

      return {
        key: definition.key,
        values: {},
        requiredCompleted: 0,
        requiredTotal: definition.fields.filter(field => field.required).length,
        optionalCompleted: 0,
        optionalTotal: definition.fields.filter(field => !field.required).length,
        status: definition.order === 1 ? 'draft' : 'blocked',
        isUnlocked: definition.order === 1,
        isCompleted: false,
        isBlocked: definition.order !== 1,
        isVisited: false,
        validation: this.buildStepValidationState(missingMandatory, definition.order === 1)
      };
    });

    return this.recalculateState({
      context: INITIAL_ADMIN_CONTROL_CENTER_CONTEXT,
      steps: initialSteps,
      activeStepKey: initialStepKey,
      completedStepKeys: [],
      blockedStepKeys: initialSteps.filter(step => step.isBlocked).map(step => step.key),
      accessibleStepKeys: initialSteps.filter(step => step.isUnlocked).map(step => step.key),
      readinessPercentage: 0,
      blockingIssues: [],
      publishState: 'draft',
      isPublished: false,
      lastSavedAt: null,
      lastPublishedAt: null
    });
  }

  recalculateState(state: ControlCenterState): ControlCenterState {
    const sourceMap = new Map<ControlCenterStepKey, ControlCenterStepState>(
      (state.steps ?? []).map(step => [step.key, step])
    );

    let allPreviousStepsCompleted = true;
    let totalRequiredFields = 0;
    let totalRequiredCompleted = 0;
    let hasAnyData = false;

    const completedStepKeys: ControlCenterStepKey[] = [];
    const blockedStepKeys: ControlCenterStepKey[] = [];
    const accessibleStepKeys: ControlCenterStepKey[] = [];

    const calculatedSteps: ControlCenterStepState[] = this.stepDefinitions.map(definition => {
      const existing = sourceMap.get(definition.key);
      const values = { ...(existing?.values ?? {}) };
      const missingMandatory = this.getMissingMandatoryFields(definition, values);

      const requiredTotal = definition.fields.filter(field => field.required).length;
      const requiredCompleted = requiredTotal - missingMandatory.length;
      const optionalTotal = definition.fields.filter(field => !field.required).length;
      const optionalCompleted = definition.fields
        .filter(field => !field.required)
        .filter(field => this.isFieldCompleted(field, values[field.key]))
        .length;

      const isUnlocked = allPreviousStepsCompleted;
      const isCompleted = isUnlocked && requiredCompleted === requiredTotal;
      const isBlocked = !isUnlocked;
      const status = isBlocked
        ? 'blocked'
        : isCompleted
          ? 'ready'
          : 'draft';

      if (isCompleted) {
        completedStepKeys.push(definition.key);
      }
      if (isBlocked) {
        blockedStepKeys.push(definition.key);
      }
      if (isUnlocked) {
        accessibleStepKeys.push(definition.key);
      }

      totalRequiredFields += requiredTotal;
      totalRequiredCompleted += requiredCompleted;

      const stepHasAnyData = this.hasAnyFieldValue(values);
      hasAnyData = hasAnyData || stepHasAnyData;

      allPreviousStepsCompleted = isCompleted;

      return {
        key: definition.key,
        values,
        requiredCompleted,
        requiredTotal,
        optionalCompleted,
        optionalTotal,
        status,
        isUnlocked,
        isCompleted,
        isBlocked,
        isVisited: (existing?.isVisited ?? false) || stepHasAnyData,
        validation: this.buildStepValidationState(missingMandatory, isUnlocked)
      };
    });

    const blockingIssues = this.buildBlockingIssues(calculatedSteps);
    const readinessPercentage = totalRequiredFields === 0
      ? 100
      : Math.round((totalRequiredCompleted / totalRequiredFields) * 100);

    const safeActiveStepKey = this.resolveSafeStepKeyFromSteps(
      calculatedSteps,
      state.activeStepKey
    );

    const publishState = state.isPublished && blockingIssues.length === 0
      ? 'published'
      : blockingIssues.length === 0
        ? 'ready'
        : hasAnyData
          ? 'blocked'
          : 'draft';

    return {
      ...state,
      context: this.normalizeContext(state.context),
      steps: calculatedSteps,
      activeStepKey: safeActiveStepKey,
      completedStepKeys,
      blockedStepKeys,
      accessibleStepKeys,
      readinessPercentage,
      blockingIssues,
      publishState
    };
  }

  canAccessStep(state: ControlCenterState, rawStepKey: string | null | undefined): boolean {
    if (!isControlCenterStepKey(rawStepKey)) {
      return false;
    }

    const calculated = this.recalculateState(state);
    return calculated.steps.some(step => step.key === rawStepKey && step.isUnlocked);
  }

  evaluateStepTransition(
    state: ControlCenterState,
    rawRequestedStepKey: string | null | undefined
  ): ControlCenterStepTransitionResult {
    const calculated = this.recalculateState(state);
    const safeStep = this.resolveSafeStepKeyFromSteps(calculated.steps, rawRequestedStepKey);

    if (!isControlCenterStepKey(rawRequestedStepKey)) {
      return {
        allowed: false,
        reason: 'invalid-step',
        requestedStepKey: null,
        resolvedStepKey: safeStep,
        blockingStepKey: null,
        message: 'الخطوة المطلوبة غير صالحة وتم تحويلك إلى أقرب خطوة متاحة.'
      };
    }

    const requestedStep = calculated.steps.find(step => step.key === rawRequestedStepKey);
    if (requestedStep?.isUnlocked) {
      return {
        allowed: true,
        reason: 'allowed',
        requestedStepKey: rawRequestedStepKey,
        resolvedStepKey: rawRequestedStepKey,
        blockingStepKey: null,
        message: 'تم فتح الخطوة بنجاح.'
      };
    }

    const blockingStep = this.findBlockingStepForTarget(calculated.steps, rawRequestedStepKey);
    const blockingTitle = blockingStep
      ? this.definitionMap.get(blockingStep.key)?.title
      : null;

    return {
      allowed: false,
      reason: 'step-blocked',
      requestedStepKey: rawRequestedStepKey,
      resolvedStepKey: safeStep,
      blockingStepKey: blockingStep?.key ?? null,
      message: blockingTitle
        ? `لا يمكن فتح هذه الخطوة قبل استكمال "${blockingTitle}".`
        : 'لا يمكن فتح هذه الخطوة قبل استكمال المتطلبات الإلزامية في الخطوات السابقة.'
    };
  }

  resolveSafeStepKey(state: ControlCenterState, rawStepKey: string | null | undefined): ControlCenterStepKey {
    const calculated = this.recalculateState(state);
    return this.resolveSafeStepKeyFromSteps(calculated.steps, rawStepKey);
  }

  getNextStepKey(state: ControlCenterState, rawStepKey: string | null | undefined): ControlCenterStepKey | null {
    if (!isControlCenterStepKey(rawStepKey)) {
      return null;
    }

    const calculated = this.recalculateState(state);
    const stepIndex = calculated.steps.findIndex(step => step.key === rawStepKey);
    if (stepIndex < 0) {
      return null;
    }

    const nextStep = calculated.steps[stepIndex + 1];
    if (!nextStep || !nextStep.isUnlocked) {
      return null;
    }

    return nextStep.key;
  }

  getPreviousStepKey(rawStepKey: string | null | undefined): ControlCenterStepKey | null {
    if (!isControlCenterStepKey(rawStepKey)) {
      return null;
    }

    const currentDefinition = this.definitionMap.get(rawStepKey);
    if (!currentDefinition) {
      return null;
    }

    const previousDefinition = this.stepDefinitions.find(
      definition => definition.order === currentDefinition.order - 1
    );

    return previousDefinition?.key ?? null;
  }

  private resolveSafeStepKeyFromSteps(
    steps: ReadonlyArray<ControlCenterStepState>,
    rawStepKey: string | null | undefined
  ): ControlCenterStepKey {
    if (isControlCenterStepKey(rawStepKey)) {
      const matching = steps.find(step => step.key === rawStepKey);
      if (matching?.isUnlocked) {
        return rawStepKey;
      }
    }

    const firstUnlockedIncomplete = steps.find(step => step.isUnlocked && !step.isCompleted);
    if (firstUnlockedIncomplete) {
      return firstUnlockedIncomplete.key;
    }

    const lastUnlocked = [...steps].reverse().find(step => step.isUnlocked);
    return lastUnlocked?.key ?? ADMIN_CONTROL_CENTER_DEFAULT_STEP;
  }

  private findBlockingStepForTarget(
    steps: ReadonlyArray<ControlCenterStepState>,
    targetStepKey: ControlCenterStepKey
  ): ControlCenterStepState | null {
    const targetDefinition = this.definitionMap.get(targetStepKey);
    if (!targetDefinition) {
      return null;
    }

    for (const step of steps) {
      const definition = this.definitionMap.get(step.key);
      if (!definition) {
        continue;
      }

      if (definition.order >= targetDefinition.order) {
        break;
      }

      if (!step.isCompleted) {
        return step;
      }
    }

    return null;
  }

  private buildBlockingIssues(steps: ReadonlyArray<ControlCenterStepState>): string[] {
    const issues: string[] = [];
    for (const step of steps) {
      if (!step.isUnlocked || step.validation.isValid) {
        continue;
      }

      const definition = this.definitionMap.get(step.key);
      if (!definition) {
        continue;
      }

      issues.push(`الخطوة "${definition.title}" تحتاج استكمال: ${step.validation.mandatoryMissingFieldLabels.join('، ')}`);
    }

    return issues;
  }

  private getMissingMandatoryFields(
    definition: ControlCenterStepDefinition,
    values: Record<string, unknown>
  ): MissingMandatoryField[] {
    return definition.fields
      .filter(field => field.required)
      .filter(field => !this.isFieldCompleted(field, values[field.key]))
      .map(field => ({
        key: field.key,
        label: field.label
      }));
  }

  private buildStepValidationState(
    missingMandatory: ReadonlyArray<MissingMandatoryField>,
    isUnlocked: boolean
  ): ControlCenterStepValidationState {
    const missingLabels = missingMandatory.map(field => field.label);
    const missingKeys = missingMandatory.map(field => field.key);
    const issues = missingLabels.length === 0
      ? []
      : [`يرجى استكمال الحقول الإلزامية: ${missingLabels.join('، ')}`];

    return {
      isValid: isUnlocked ? missingMandatory.length === 0 : false,
      mandatoryMissingFieldKeys: missingKeys,
      mandatoryMissingFieldLabels: missingLabels,
      issues
    };
  }

  private hasAnyFieldValue(values: Record<string, unknown>): boolean {
    return Object.values(values).some(value => this.hasValue(value));
  }

  private isFieldCompleted(field: ControlCenterFieldDefinition, value: unknown): boolean {
    if (!this.hasValue(value)) {
      return false;
    }

    if (field.type === 'switch') {
      return typeof value === 'boolean';
    }

    if (field.type === 'select') {
      return this.normalizeString(value) != null;
    }

    return this.normalizeString(value) != null;
  }

  private hasValue(value: unknown): boolean {
    if (value == null) {
      return false;
    }

    if (typeof value === 'string') {
      return value.trim().length > 0;
    }

    if (Array.isArray(value)) {
      return value.length > 0;
    }

    if (typeof value === 'boolean') {
      return true;
    }

    if (typeof value === 'number') {
      return Number.isFinite(value);
    }

    return true;
  }

  private normalizeContext(context: ControlCenterContextState | null | undefined): ControlCenterContextState {
    return {
      applicationId: this.normalizeString(context?.applicationId),
      categoryId: this.normalizePositiveInt(context?.categoryId),
      routeKeyPrefix: this.normalizeString(context?.routeKeyPrefix),
      documentDirection: this.normalizeDirection(context?.documentDirection),
      requestMode: this.normalizeString(context?.requestMode),
      primaryConfigRouteKey: this.normalizeString(context?.primaryConfigRouteKey),
      createUnitScope: this.normalizeString(context?.createUnitScope),
      readUnitScope: this.normalizeString(context?.readUnitScope),
      creatorUnitDefault: this.normalizeString(context?.creatorUnitDefault),
      targetUnitDefault: this.normalizeString(context?.targetUnitDefault),
      runtimeContextJson: this.normalizeString(context?.runtimeContextJson),
      localizationProfile: this.normalizeString(context?.localizationProfile),
      uiPreset: this.normalizeString(context?.uiPreset)
    };
  }

  private normalizeDirection(value: unknown): 'incoming' | 'outgoing' | null {
    const normalized = this.normalizeString(value);
    if (normalized === 'incoming' || normalized === 'outgoing') {
      return normalized;
    }

    return null;
  }

  private normalizePositiveInt(value: unknown): number | null {
    const normalized = Number(value ?? 0);
    if (!Number.isFinite(normalized) || normalized <= 0) {
      return null;
    }

    return Math.trunc(normalized);
  }

  private normalizeString(value: unknown): string | null {
    const normalized = String(value ?? '').trim();
    return normalized.length > 0 ? normalized : null;
  }
}
