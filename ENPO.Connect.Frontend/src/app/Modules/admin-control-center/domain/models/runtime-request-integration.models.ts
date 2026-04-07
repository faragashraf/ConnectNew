export interface RuntimeRequestLaunchPlan {
  readonly runtimePath: string;
  readonly queryParams: Readonly<Record<string, string | number>>;
  readonly blockingIssues: ReadonlyArray<string>;
  readonly warnings: ReadonlyArray<string>;
  readonly isRuntimeReady: boolean;
}
