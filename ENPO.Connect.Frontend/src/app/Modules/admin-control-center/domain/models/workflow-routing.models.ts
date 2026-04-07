export interface WorkflowRoutingConfig {
  routingMode: 'static' | 'manual' | 'hybrid' | null;
  defaultTargetUnit: string;
  allowManualSelection: boolean;
  routeResolutionMode: 'static' | 'pattern' | 'context' | null;
  targetResolutionStrategy: 'default-unit' | 'scope-match' | 'manual-fallback' | null;
  createConfigRouteKey: string;
  viewConfigRouteKey: string;
  directionAwareBehavior: 'shared' | 'split' | 'fallback' | null;
  workflowNotes: string;
}

export interface WorkflowRoutingValidationResult {
  readonly isValid: boolean;
  readonly blockingIssues: ReadonlyArray<string>;
  readonly warnings: ReadonlyArray<string>;
}
