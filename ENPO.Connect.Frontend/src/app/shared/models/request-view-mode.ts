export type RequestViewMode = 'standard' | 'tabbed';

export const REQUEST_VIEW_MODE_STANDARD: RequestViewMode = 'standard';
export const REQUEST_VIEW_MODE_TABBED: RequestViewMode = 'tabbed';

export interface RequestViewModeOption {
  label: string;
  value: RequestViewMode;
}

export const REQUEST_VIEW_MODE_OPTIONS_AR: ReadonlyArray<RequestViewModeOption> = [
  { label: 'قياسي', value: REQUEST_VIEW_MODE_STANDARD },
  { label: 'مبوب', value: REQUEST_VIEW_MODE_TABBED }
];

export function normalizeRequestViewMode(value: unknown): RequestViewMode {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized === REQUEST_VIEW_MODE_TABBED
    ? REQUEST_VIEW_MODE_TABBED
    : REQUEST_VIEW_MODE_STANDARD;
}

export function resolveRequestViewModeLabel(value: unknown): string {
  return normalizeRequestViewMode(value) === REQUEST_VIEW_MODE_TABBED
    ? 'مبوب'
    : 'قياسي';
}
