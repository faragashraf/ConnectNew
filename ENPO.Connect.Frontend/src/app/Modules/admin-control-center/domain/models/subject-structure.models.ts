export interface SubjectStructureNode {
  readonly id: string;
  readonly key: string;
  readonly label: string;
  readonly parentId: string | null;
  readonly displayOrder: number;
  readonly isActive: boolean;
}

export interface SubjectStructureTreeNode {
  readonly id: string;
  readonly key: string;
  readonly label: string;
  readonly displayOrder: number;
  readonly children: ReadonlyArray<SubjectStructureTreeNode>;
}

export interface SubjectStructureValidationResult {
  readonly isValid: boolean;
  readonly blockingIssues: ReadonlyArray<string>;
  readonly warnings: ReadonlyArray<string>;
}
