import { ControlCenterStepKey } from './admin-control-center.models';

export type ReadinessAuditSeverity = 'blocking' | 'warning';
export type ReadinessAuditCategory = 'binding' | 'composition' | 'policy' | 'route' | 'access' | 'validation' | 'preview';

export interface ReadinessAuditCheckGroup {
  readonly category: ReadinessAuditCategory;
  readonly title: string;
  readonly stepKey: ControlCenterStepKey;
  readonly blockingIssues: ReadonlyArray<string>;
  readonly warnings: ReadonlyArray<string>;
}

export interface ReadinessAuditIssue {
  readonly id: string;
  readonly severity: ReadinessAuditSeverity;
  readonly category: ReadinessAuditCategory;
  readonly title: string;
  readonly stepKey: ControlCenterStepKey;
  readonly message: string;
}

export interface ReadinessAuditResult {
  readonly score: number;
  readonly status: 'ready' | 'blocked';
  readonly issues: ReadonlyArray<ReadinessAuditIssue>;
  readonly blockingIssues: ReadonlyArray<ReadinessAuditIssue>;
  readonly warnings: ReadonlyArray<ReadinessAuditIssue>;
}

export interface ReadinessAuditPayload {
  readonly score: number;
  readonly status: 'ready' | 'blocked';
  readonly generatedAt: string;
  readonly blockingIssues: ReadonlyArray<ReadinessAuditIssue>;
  readonly warnings: ReadonlyArray<ReadinessAuditIssue>;
}
