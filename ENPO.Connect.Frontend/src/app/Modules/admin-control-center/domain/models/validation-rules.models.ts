export interface RequiredRuleItem {
  id: string;
  fieldKey: string;
  fieldLabel: string;
  isRequired: boolean;
}

export type ConditionalOperator = 'eq' | 'neq' | 'contains' | 'gt' | 'lt';
export type ConditionalEffect = 'required' | 'readonly' | 'hidden' | 'block-submit';

export interface ConditionalRuleItem {
  id: string;
  leftFieldKey: string;
  operator: ConditionalOperator;
  rightValue: string;
  effect: ConditionalEffect;
}

export interface SubmissionBlockingRuleItem {
  id: string;
  name: string;
  conditionExpression: string;
  message: string;
}

export interface ValidationRulesConfig {
  validationLevel: 'basic' | 'strict' | 'enterprise' | null;
  submitBehavior: 'block' | 'confirm' | null;
  enableCrossFieldValidation: boolean;
  validationNotes: string;
  requiredRules: RequiredRuleItem[];
  conditionalRules: ConditionalRuleItem[];
  blockingRules: SubmissionBlockingRuleItem[];
}

export interface ValidationRulesEvaluationResult {
  readonly isValid: boolean;
  readonly blockingIssues: ReadonlyArray<string>;
  readonly warnings: ReadonlyArray<string>;
}

export interface ValidationRulesFieldReference {
  readonly fieldKey: string;
  readonly label: string;
  readonly requiredByDefault: boolean;
}

export interface ConditionalPayloadBundle {
  readonly requiredRules: RequiredRuleItem[];
  readonly conditionalRules: ConditionalRuleItem[];
}
