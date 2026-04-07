import {
  ControlCenterContextState,
  ControlCenterFieldDefinition,
  ControlCenterPublishState,
  ControlCenterStepKey,
  ControlCenterStepStatus
} from './admin-control-center.models';
import { PreviewSimulationDerivedArtifact } from './preview-simulation.models';

export interface ControlCenterStepViewModel {
  readonly key: ControlCenterStepKey;
  readonly order: number;
  readonly title: string;
  readonly shortTitle: string;
  readonly description: string;
  readonly fields: ReadonlyArray<ControlCenterFieldDefinition>;
  readonly requiredFields: ReadonlyArray<ControlCenterFieldDefinition>;
  readonly optionalFields: ReadonlyArray<ControlCenterFieldDefinition>;
  readonly requiredCompleted: number;
  readonly requiredTotal: number;
  readonly optionalCompleted: number;
  readonly optionalTotal: number;
  readonly status: ControlCenterStepStatus;
  readonly isUnlocked: boolean;
  readonly isCompleted: boolean;
  readonly isBlocked: boolean;
  readonly isVisited: boolean;
  readonly mandatoryMissingFieldKeys: ReadonlyArray<string>;
  readonly mandatoryMissingFieldLabels: ReadonlyArray<string>;
  readonly validationIssues: ReadonlyArray<string>;
  readonly values: Record<string, unknown>;
  readonly route: string;
}

export interface ControlCenterViewModel {
  readonly activeStepKey: ControlCenterStepKey;
  readonly context: ControlCenterContextState;
  readonly steps: ReadonlyArray<ControlCenterStepViewModel>;
  readonly completedStepKeys: ReadonlyArray<ControlCenterStepKey>;
  readonly blockedStepKeys: ReadonlyArray<ControlCenterStepKey>;
  readonly accessibleStepKeys: ReadonlyArray<ControlCenterStepKey>;
  readonly readinessPercentage: number;
  readonly publishState: ControlCenterPublishState;
  readonly blockingIssues: ReadonlyArray<string>;
  readonly readyStepsCount: number;
  readonly blockedStepsCount: number;
  readonly totalStepsCount: number;
  readonly completedRequiredFields: number;
  readonly totalRequiredFields: number;
  readonly hasUnsavedChanges: boolean;
  readonly draftRestoredAt: string | null;
  readonly draftErrorMessage: string | null;
  readonly lastSavedAt: string | null;
  readonly lastPublishedAt: string | null;
  readonly derived: {
    readonly preview: PreviewSimulationDerivedArtifact;
  };
}
