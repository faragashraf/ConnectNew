export type CompositionContainerType = 'group' | 'section' | 'card' | 'tab';

export interface CompositionFieldReference {
  readonly fieldKey: string;
  readonly label: string;
  readonly type: string;
}

export interface FormCompositionContainer {
  id: string;
  title: string;
  type: CompositionContainerType;
  visible: boolean;
  displayOrder: number;
  fieldKeys: string[];
}

export interface FormCompositionValidationResult {
  readonly isValid: boolean;
  readonly blockingIssues: ReadonlyArray<string>;
  readonly warnings: ReadonlyArray<string>;
}
