export interface AccessVisibilityConfig {
  createScope: string;
  readScope: string;
  workScope: string;
  adminScope: string;
  publishScope: string;
  visibilityNotes: string;
}

export interface AccessVisibilityValidationResult {
  readonly isValid: boolean;
  readonly blockingIssues: ReadonlyArray<string>;
  readonly warnings: ReadonlyArray<string>;
  readonly normalizedScopes: {
    create: string[];
    read: string[];
    work: string[];
    admin: string[];
    publish: string[];
  };
}
