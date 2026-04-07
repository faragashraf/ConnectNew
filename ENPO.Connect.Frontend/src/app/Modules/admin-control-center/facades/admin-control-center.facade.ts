import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';
import {
  ControlCenterContextState,
  ControlCenterState,
  ControlCenterStepDefinition,
  ControlCenterStepKey,
  ControlCenterStepStatus,
  ControlCenterStepTransitionResult,
  isControlCenterStepKey
} from '../domain/models/admin-control-center.models';
import {
  ControlCenterStepViewModel,
  ControlCenterViewModel
} from '../domain/models/admin-control-center.view-models';
import { PreviewSimulationArtifactEngine } from '../domain/preview-simulation/preview-simulation-artifact.engine';
import {
  AdminControlCenterStore,
  ControlCenterDraftSaveResult,
  ControlCenterPublishResult,
  ControlCenterStateActionResult
} from '../store/admin-control-center.store';
export type { ControlCenterStepViewModel, ControlCenterViewModel };

@Injectable()
export class AdminControlCenterFacade {
  readonly vm$: Observable<ControlCenterViewModel> = this.store.state$.pipe(
    map(state => this.buildViewModelFromState(state)),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  constructor(
    private readonly store: AdminControlCenterStore,
    private readonly previewArtifactEngine: PreviewSimulationArtifactEngine
  ) {}

  initialize(rawStepKey?: string | null): void {
    this.store.initialize(rawStepKey);
  }

  updateContext(patch: Partial<ControlCenterContextState>): void {
    this.store.patchContext(patch);
  }

  setActiveStepByKey(rawStepKey: string | null | undefined): boolean {
    return this.store.setActiveStep(rawStepKey);
  }

  evaluateStepTransition(rawStepKey: string | null | undefined): ControlCenterStepTransitionResult {
    return this.store.evaluateStepTransition(rawStepKey);
  }

  canAccessStepByKey(rawStepKey: string | null | undefined): boolean {
    return this.store.canAccessStep(rawStepKey);
  }

  resolveSafeStepKey(rawStepKey: string | null | undefined): ControlCenterStepKey {
    return this.store.resolveSafeStepKey(rawStepKey);
  }

  updateFieldValue(stepKey: ControlCenterStepKey, fieldKey: string, value: unknown): void {
    this.store.upsertFieldValue(stepKey, fieldKey, value);
  }

  saveDraft(): ControlCenterDraftSaveResult {
    return this.store.saveDraft();
  }

  clearDraft(rawStepKey?: string | null): ControlCenterStateActionResult {
    return this.store.clearDraft(rawStepKey);
  }

  startNewScope(rawStepKey?: string | null): ControlCenterStateActionResult {
    return this.store.startNewScope(rawStepKey);
  }

  loadDemoScope(rawStepKey?: string | null): ControlCenterStateActionResult {
    return this.store.loadDemoScope(rawStepKey);
  }

  publish(): Promise<ControlCenterPublishResult> {
    return this.store.publish();
  }

  getStepViewModelByKey(rawStepKey: string | null | undefined): ControlCenterStepViewModel | null {
    if (!isControlCenterStepKey(rawStepKey)) {
      return null;
    }

    const current = this.buildCurrentViewModel();
    return current.steps.find(step => step.key === rawStepKey) ?? null;
  }

  getCurrentViewModel(): ControlCenterViewModel {
    return this.buildCurrentViewModel();
  }

  getNextStepKey(rawStepKey: string | null | undefined): ControlCenterStepKey | null {
    return this.store.getNextStepKey(rawStepKey);
  }

  getPreviousStepKey(rawStepKey: string | null | undefined): ControlCenterStepKey | null {
    return this.store.getPreviousStepKey(rawStepKey);
  }

  isStepComplete(rawStepKey: string | null | undefined): boolean {
    if (!isControlCenterStepKey(rawStepKey)) {
      return false;
    }

    const current = this.buildCurrentViewModel();
    const targetStep = current.steps.find(step => step.key === rawStepKey);
    if (!targetStep) {
      return false;
    }

    return targetStep.isCompleted;
  }

  getStepDefinitionByKey(rawStepKey: string | null | undefined): ControlCenterStepDefinition | null {
    if (!isControlCenterStepKey(rawStepKey)) {
      return null;
    }

    return this.store.getStepDefinitions().find(step => step.key === rawStepKey) ?? null;
  }

  private buildCurrentViewModel(): ControlCenterViewModel {
    return this.buildViewModelFromState(this.store.snapshot);
  }

  private buildViewModelFromState(state: ControlCenterState): ControlCenterViewModel {
    const definitions = this.store.getStepDefinitions();
    const previewDerived = this.previewArtifactEngine.buildDerivedArtifact(state);
    const steps = definitions.map(definition => {
      const matchingState = state.steps.find(step => step.key === definition.key);
      const safeState = matchingState ?? {
        key: definition.key,
        values: {},
        requiredCompleted: 0,
        requiredTotal: 0,
        optionalCompleted: 0,
        optionalTotal: 0,
        status: 'draft' as const,
        isUnlocked: false,
        isCompleted: false,
        isBlocked: true,
        isVisited: false,
        validation: {
          isValid: false,
          mandatoryMissingFieldKeys: [],
          mandatoryMissingFieldLabels: [],
          issues: []
        }
      };

      return this.toStepViewModel(definition, safeState);
    });

    const completedRequiredFields = steps.reduce((sum, step) => sum + step.requiredCompleted, 0);
    const totalRequiredFields = steps.reduce((sum, step) => sum + step.requiredTotal, 0);

    return {
      activeStepKey: state.activeStepKey,
      context: state.context,
      steps,
      completedStepKeys: state.completedStepKeys,
      blockedStepKeys: state.blockedStepKeys,
      accessibleStepKeys: state.accessibleStepKeys,
      readinessPercentage: state.readinessPercentage,
      publishState: state.publishState,
      blockingIssues: state.blockingIssues,
      readyStepsCount: steps.filter(step => step.status === 'ready').length,
      blockedStepsCount: steps.filter(step => step.isBlocked).length,
      totalStepsCount: steps.length,
      completedRequiredFields,
      totalRequiredFields,
      hasUnsavedChanges: state.hasUnsavedChanges,
      draftRestoredAt: state.draftRestoredAt,
      draftErrorMessage: state.draftErrorMessage,
      lastSavedAt: state.lastSavedAt,
      lastPublishedAt: state.lastPublishedAt,
      derived: {
        preview: previewDerived
      }
    };
  }

  private toStepViewModel(
    definition: ControlCenterStepDefinition,
    state: {
      readonly values: Record<string, unknown>;
      readonly requiredCompleted: number;
      readonly requiredTotal: number;
      readonly optionalCompleted: number;
      readonly optionalTotal: number;
      readonly status: ControlCenterStepStatus;
      readonly isUnlocked: boolean;
      readonly isCompleted: boolean;
      readonly isBlocked: boolean;
      readonly isVisited: boolean;
      readonly validation: {
        readonly mandatoryMissingFieldKeys: ReadonlyArray<string>;
        readonly mandatoryMissingFieldLabels: ReadonlyArray<string>;
        readonly issues: ReadonlyArray<string>;
      };
    }
  ): ControlCenterStepViewModel {
    const requiredFields = definition.fields.filter(field => field.required);
    const optionalFields = definition.fields.filter(field => !field.required);

    return {
      key: definition.key,
      order: definition.order,
      title: definition.title,
      shortTitle: definition.shortTitle,
      description: definition.description,
      fields: definition.fields,
      requiredFields,
      optionalFields,
      requiredCompleted: state.requiredCompleted,
      requiredTotal: state.requiredTotal,
      optionalCompleted: state.optionalCompleted,
      optionalTotal: state.optionalTotal,
      status: state.status,
      isUnlocked: state.isUnlocked,
      isCompleted: state.isCompleted,
      isBlocked: state.isBlocked,
      isVisited: state.isVisited,
      mandatoryMissingFieldKeys: state.validation.mandatoryMissingFieldKeys,
      mandatoryMissingFieldLabels: state.validation.mandatoryMissingFieldLabels,
      validationIssues: state.validation.issues,
      values: state.values,
      route: `/Admin/ControlCenter/${definition.key}`
    };
  }
}
