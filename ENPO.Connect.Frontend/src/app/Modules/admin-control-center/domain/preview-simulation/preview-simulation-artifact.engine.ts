import { Injectable } from '@angular/core';
import { FieldLibraryBindingEngine } from '../field-library-binding/field-library-binding.engine';
import { FormCompositionEngine } from '../form-composition/form-composition.engine';
import {
  ControlCenterState,
  ControlCenterStepKey
} from '../models/admin-control-center.models';
import {
  PreviewSimulationDerivedArtifact,
  PreviewSimulationDirection,
  PreviewSimulationInput,
  PreviewSimulationMode
} from '../models/preview-simulation.models';
import { ValidationRulesEngine } from '../validation-rules/validation-rules.engine';
import { PreviewSimulationEngine } from './preview-simulation.engine';

@Injectable()
export class PreviewSimulationArtifactEngine {
  constructor(
    private readonly bindingEngine: FieldLibraryBindingEngine,
    private readonly compositionEngine: FormCompositionEngine,
    private readonly validationRulesEngine: ValidationRulesEngine,
    private readonly previewEngine: PreviewSimulationEngine
  ) {}

  buildDerivedArtifact(state: ControlCenterState): PreviewSimulationDerivedArtifact {
    const bindingValues = this.getStepValues(state, 'field-library-binding');
    const compositionValues = this.getStepValues(state, 'form-composition');
    const workflowValues = this.getStepValues(state, 'workflow-routing');
    const validationValues = this.getStepValues(state, 'validation-rules');
    const previewValues = this.getStepValues(state, 'preview-simulation');

    const bindings = this.bindingEngine.parseBindingsPayload(bindingValues['bindingPayload']);
    const containers = this.compositionEngine.parseContainersPayload(compositionValues['compositionLayoutPayload']);
    const parsedConditionalPayload = this.validationRulesEngine.parseConditionalPayload(
      validationValues['conditionalRulesPayload']
    );

    const requiredFieldKeys = parsedConditionalPayload.requiredRules
      .filter(rule => rule.isRequired)
      .map(rule => rule.fieldKey);

    const input: PreviewSimulationInput = {
      mode: this.normalizeMode(previewValues['previewMode']),
      direction: this.normalizeDirection(previewValues['previewDirection'] ?? state.context.documentDirection),
      bindings,
      containers,
      requiredFieldKeys,
      workflow: {
        routingMode: this.normalizeNullable(workflowValues['routingMode']),
        routeResolutionMode: this.normalizeNullable(workflowValues['routeResolutionMode']),
        targetResolutionStrategy: this.normalizeNullable(workflowValues['targetResolutionStrategy']),
        directionAwareBehavior: this.normalizeNullable(workflowValues['directionAwareBehavior']),
        createConfigRouteKey: this.normalizeNullable(workflowValues['createConfigRouteKey']),
        viewConfigRouteKey: this.normalizeNullable(workflowValues['viewConfigRouteKey']),
        routeKeyPrefix: this.normalizeNullable(state.context.routeKeyPrefix),
        primaryConfigRouteKey: this.normalizeNullable(state.context.primaryConfigRouteKey)
      }
    };

    return {
      input,
      renderingMap: this.previewEngine.buildRenderingMap(input)
    };
  }

  applyDerivedArtifactToState(state: ControlCenterState): ControlCenterState {
    const previewStepIndex = state.steps.findIndex(step => step.key === 'preview-simulation');
    if (previewStepIndex < 0) {
      return state;
    }

    const artifact = this.buildDerivedArtifact(state);
    const serializedMap = this.previewEngine.serializeRenderingMap(artifact.renderingMap);
    const previewToken = artifact.renderingMap.blockingIssues.length === 0 ? 'valid' : null;

    const currentStep = state.steps[previewStepIndex];
    const currentValues = currentStep.values ?? {};
    const currentPayload = String(currentValues['renderingMapPayload'] ?? '').trim();
    const currentToken = this.normalizeNullable(currentValues['previewValidationToken']);

    let hasChanged = false;
    const nextValues: Record<string, unknown> = { ...currentValues };

    if (currentPayload !== serializedMap) {
      nextValues['renderingMapPayload'] = serializedMap;
      hasChanged = true;
    }

    if (previewToken) {
      if (currentToken !== previewToken) {
        nextValues['previewValidationToken'] = previewToken;
        hasChanged = true;
      }
    } else if (Object.prototype.hasOwnProperty.call(nextValues, 'previewValidationToken')) {
      delete nextValues['previewValidationToken'];
      hasChanged = true;
    }

    if (!hasChanged) {
      return state;
    }

    const nextSteps = [...state.steps];
    nextSteps[previewStepIndex] = {
      ...currentStep,
      values: nextValues
    };

    return {
      ...state,
      steps: nextSteps
    };
  }

  private getStepValues(state: ControlCenterState, stepKey: ControlCenterStepKey): Record<string, unknown> {
    const matching = state.steps.find(step => step.key === stepKey);
    if (!matching || !matching.values || typeof matching.values !== 'object') {
      return {};
    }

    return { ...matching.values };
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
