import { ControlCenterPublishState, ControlCenterStepKey } from './admin-control-center.models';

export interface PublishChangeSummary {
  readonly publishState: ControlCenterPublishState;
  readonly readyStepsCount: number;
  readonly totalStepsCount: number;
  readonly completedRequiredFields: number;
  readonly totalRequiredFields: number;
  readonly blockingIssuesCount: number;
  readonly blockingIssueMessages: ReadonlyArray<string>;
  readonly warningCount: number;
  readonly touchedSteps: ReadonlyArray<{
    key: ControlCenterStepKey;
    title: string;
    requiredProgress: string;
    optionalProgress: string;
  }>;
}

export interface PublishReadinessResult {
  readonly isReady: boolean;
  readonly blockingIssues: ReadonlyArray<string>;
  readonly warnings: ReadonlyArray<string>;
}
