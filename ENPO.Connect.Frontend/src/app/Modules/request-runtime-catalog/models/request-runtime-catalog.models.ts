import { TreeNode } from 'primeng/api';

export interface RuntimeApiError {
  code?: string;
  message?: string;
}

export interface RuntimeApiResponse<T> {
  data?: T;
  errors?: RuntimeApiError[];
}

export interface RequestRuntimeCatalogDto {
  generatedAtUtc: string;
  totalAvailableRequests: number;
  applications: RequestRuntimeCatalogApplicationDto[];
}

export interface RequestRuntimeCatalogApplicationDto {
  applicationId: string;
  applicationName: string;
  totalAvailableRequests: number;
  categories: RequestRuntimeCatalogNodeDto[];
}

export interface RequestRuntimeCatalogNodeDto {
  categoryId: number;
  parentCategoryId: number;
  categoryName: string;
  applicationId?: string | null;
  isRequestType: boolean;
  canStart: boolean;
  displayOrder: number;
  startStage?: RequestRuntimeStartStageDto | null;
  organizationalUnitScope?: RequestRuntimeOrganizationalUnitScopeDto | null;
  envelopeDisplayName?: string | null;
  availabilityReasons: string[];
  runtimeWarnings: string[];
  children: RequestRuntimeCatalogNodeDto[];
}

export interface RequestRuntimeStartStageDto {
  stageId?: number | null;
  stageName?: string | null;
  routingProfileId?: number | null;
  routingProfileName?: string | null;
}

export interface RequestRuntimeOrganizationalUnitScopeDto {
  scopeMode: string;
  unitIds: string[];
  scopeLabel?: string | null;
}

export interface RequestRuntimeApplicationOption {
  label: string;
  value: string;
}

export interface RequestRuntimeTreeNodeData {
  categoryId: number;
  categoryName: string;
  canStart: boolean;
  isRequestType: boolean;
  applicationId: string;
  startStageId: number | null;
  startStageName: string | null;
  envelopeDisplayName: string;
  organizationalScopeLabel: string | null;
  reasons: string[];
}

export type RequestRuntimeTreeNode = TreeNode<RequestRuntimeTreeNodeData>;

export const REQUEST_RUNTIME_ALL_APPLICATIONS_VALUE = '__ALL_APPLICATIONS__';
export const REQUEST_RUNTIME_DEFAULT_ENVELOPE_DISPLAY_NAME = 'حزمة طلبات جديدة';

export interface RequestRuntimeEnvelopeTerminology {
  displayName: string;
  selectLabel: string;
  addButtonLabel: string;
  nameLabel: string;
  dialogTitle: string;
  createSuccessMessage: string;
  listEmptyMessage: string;
}

export interface RequestRuntimeFormGroupDefinitionDto {
  groupId: number;
  groupName: string;
  groupDescription?: string;
  isExtendable: boolean;
  groupWithInRow?: number;
  canView?: boolean;
  canEdit?: boolean;
  canFill?: boolean;
  isHidden?: boolean;
  isReadOnly?: boolean;
  isRequired?: boolean;
  isLocked?: boolean;
  lockReason?: string;
}

export interface RequestRuntimeFieldDefinitionDto {
  mendSql: number;
  categoryId: number;
  mendGroup: number;
  fieldKey: string;
  fieldType: string;
  fieldLabel?: string;
  placeholder?: string;
  defaultValue?: string;
  optionsPayload?: string;
  dataType?: string;
  required: boolean;
  requiredTrue: boolean;
  email: boolean;
  pattern: boolean;
  minValue?: string;
  maxValue?: string;
  mask?: string;
  isDisabledInit: boolean;
  isSearchable: boolean;
  width: number;
  height: number;
  applicationId?: string;
  displayOrder: number;
  isVisible: boolean;
  displaySettingsJson?: string;
  group?: RequestRuntimeFormGroupDefinitionDto;
  canView?: boolean;
  canEdit?: boolean;
  canFill?: boolean;
  isHidden?: boolean;
  isReadOnly?: boolean;
  isRequired?: boolean;
  isLocked?: boolean;
  lockReason?: string;
}

export type RequestRuntimeDynamicTrigger = 'init' | 'change' | 'blur';

export interface RequestRuntimeDynamicHttpRequestConfig {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH';
  query?: Record<string, string>;
  headers?: Record<string, string>;
  body?: unknown;
}

export interface RequestRuntimeDynamicOptionLoaderConfig {
  request: RequestRuntimeDynamicHttpRequestConfig;
  trigger?: RequestRuntimeDynamicTrigger;
  sourceFieldKey?: string;
  minQueryLength?: number;
  responseListPath?: string;
  responseValuePath?: string;
  responseLabelPath?: string;
  clearWhenSourceEmpty?: boolean;
}

export interface RequestRuntimeDynamicAsyncValidationConfig {
  request: RequestRuntimeDynamicHttpRequestConfig;
  trigger?: Exclude<RequestRuntimeDynamicTrigger, 'init'>;
  debounceMs?: number;
  minValueLength?: number;
  responseValidPath?: string;
  responseMessagePath?: string;
  defaultErrorMessage?: string;
}

export interface RequestRuntimeDynamicActionPatchConfig {
  targetFieldKey: string;
  valuePath?: string;
  valueTemplate?: string;
  clearWhenMissing?: boolean;
}

export interface RequestRuntimeDynamicActionConfig {
  trigger?: Exclude<RequestRuntimeDynamicTrigger, 'init'>;
  whenEquals?: string;
  request?: RequestRuntimeDynamicHttpRequestConfig;
  patches: RequestRuntimeDynamicActionPatchConfig[];
  clearTargetsWhenEmpty?: boolean;
}

export interface RequestRuntimeDynamicFieldBehaviorConfig {
  optionLoader?: RequestRuntimeDynamicOptionLoaderConfig;
  asyncValidation?: RequestRuntimeDynamicAsyncValidationConfig;
  actions?: RequestRuntimeDynamicActionConfig[];
}

export interface RequestRuntimeRequestPolicyWorkflowDto {
  mode?: string;
  directionMode?: string;
  fixedDirection?: string;
}

export interface RequestRuntimeRequestPolicyDto {
  workflowPolicy?: RequestRuntimeRequestPolicyWorkflowDto;
}

export interface RequestRuntimeFormDefinitionDto {
  categoryId: number;
  categoryName: string;
  parentCategoryId: number;
  applicationId?: string;
  groups: RequestRuntimeFormGroupDefinitionDto[];
  fields: RequestRuntimeFieldDefinitionDto[];
  requestPolicy?: RequestRuntimeRequestPolicyDto;
  defaultViewMode?: 'standard' | 'tabbed' | string;
  allowRequesterOverride?: boolean;
  defaultDisplayMode?: 'standard' | 'tabbed' | string;
  allowUserToChangeDisplayMode?: boolean;
}

export interface RequestRuntimeAdminGroupTreeNodeDto {
  groupId: number;
  categoryId: number;
  applicationId: string;
  groupName: string;
  groupDescription?: string;
  parentGroupId?: number;
  displayOrder: number;
  isActive: boolean;
  children: RequestRuntimeAdminGroupTreeNodeDto[];
}

export interface RequestRuntimeEnvelopeSummaryDto {
  envelopeId: number;
  envelopeRef: string;
  incomingDate: string;
  sourceEntity?: string;
  deliveryDelegate?: string;
  linkedSubjectsCount: number;
}

export interface RequestRuntimePagedEnvelopeListDto {
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  items: RequestRuntimeEnvelopeSummaryDto[];
}

export interface RequestRuntimeEnvelopeDetailDto {
  envelopeId: number;
  envelopeRef: string;
  incomingDate: string;
  sourceEntity?: string;
  deliveryDelegate?: string;
  notes?: string;
}

export interface RequestRuntimeEnvelopeUpsertRequestDto {
  envelopeRef: string;
  incomingDate: string;
  sourceEntity?: string;
  deliveryDelegate?: string;
  notes?: string;
  linkedSubjectIds: number[];
}

export interface RequestRuntimeSubjectFieldValueDto {
  fieldKey: string;
  value?: string;
  instanceGroupId?: number;
}

export interface RequestRuntimeSubjectUpsertRequestDto {
  categoryId: number;
  documentDirection?: string;
  stageId?: number;
  subject?: string;
  description?: string;
  saveAsDraft: boolean;
  submit: boolean;
  envelopeId?: number;
  dynamicFields: RequestRuntimeSubjectFieldValueDto[];
  stakeholders: unknown[];
  tasks: unknown[];
}

export interface RequestRuntimeSubjectDetailDto {
  messageId: number;
  requestRef?: string;
  subject?: string;
}

export function parseRequestRuntimeDynamicFieldBehavior(
  displaySettingsJson?: string
): RequestRuntimeDynamicFieldBehaviorConfig | null {
  const payload = String(displaySettingsJson ?? '').trim();
  if (!payload) {
    return null;
  }

  try {
    const parsed = JSON.parse(payload) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }

    const runtimeConfig = parsed['dynamicRuntime'];
    if (!runtimeConfig || typeof runtimeConfig !== 'object' || Array.isArray(runtimeConfig)) {
      return null;
    }

    const optionLoader = readOptionLoaderConfig(runtimeConfig as Record<string, unknown>);
    const asyncValidation = readAsyncValidationConfig(runtimeConfig as Record<string, unknown>);
    const actions = readActionConfigs(runtimeConfig as Record<string, unknown>);

    if (!optionLoader && !asyncValidation && actions.length === 0) {
      return null;
    }

    return {
      optionLoader: optionLoader ?? undefined,
      asyncValidation: asyncValidation ?? undefined,
      actions: actions.length > 0 ? actions : undefined
    };
  } catch {
    return null;
  }
}

export function getRuntimeValueByPath(source: unknown, path?: string): unknown {
  const normalizedPath = String(path ?? '').trim();
  if (!normalizedPath) {
    return source;
  }

  const segments = normalizedPath
    .split('.')
    .map(segment => segment.trim())
    .filter(segment => segment.length > 0);

  let cursor: unknown = source;
  for (const segment of segments) {
    if (cursor == null) {
      return undefined;
    }

    const indexCandidate = Number(segment);
    if (Array.isArray(cursor) && Number.isInteger(indexCandidate) && indexCandidate >= 0) {
      cursor = cursor[indexCandidate];
      continue;
    }

    if (typeof cursor !== 'object') {
      return undefined;
    }

    cursor = (cursor as Record<string, unknown>)[segment];
  }

  return cursor;
}

function readOptionLoaderConfig(payload: Record<string, unknown>): RequestRuntimeDynamicOptionLoaderConfig | null {
  const candidate = payload['optionLoader'];
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return null;
  }

  const raw = candidate as Record<string, unknown>;
  const request = readHttpRequestConfig(raw['request']);
  if (!request) {
    return null;
  }

  return {
    request,
    trigger: normalizeTrigger(raw['trigger'], 'change'),
    sourceFieldKey: normalizeNullableString(raw['sourceFieldKey']) ?? undefined,
    minQueryLength: normalizeNonNegativeInt(raw['minQueryLength']),
    responseListPath: normalizeNullableString(raw['responseListPath']) ?? undefined,
    responseValuePath: normalizeNullableString(raw['responseValuePath']) ?? undefined,
    responseLabelPath: normalizeNullableString(raw['responseLabelPath']) ?? undefined,
    clearWhenSourceEmpty: raw['clearWhenSourceEmpty'] === true
  };
}

function readAsyncValidationConfig(payload: Record<string, unknown>): RequestRuntimeDynamicAsyncValidationConfig | null {
  const candidate = payload['asyncValidation'];
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return null;
  }

  const raw = candidate as Record<string, unknown>;
  const request = readHttpRequestConfig(raw['request']);
  if (!request) {
    return null;
  }

  const trigger = normalizeTrigger(raw['trigger'], 'blur');
  const normalizedTrigger = trigger === 'init' ? 'blur' : trigger;

  return {
    request,
    trigger: normalizedTrigger,
    debounceMs: normalizePositiveInt(raw['debounceMs']),
    minValueLength: normalizeNonNegativeInt(raw['minValueLength']),
    responseValidPath: normalizeNullableString(raw['responseValidPath']) ?? undefined,
    responseMessagePath: normalizeNullableString(raw['responseMessagePath']) ?? undefined,
    defaultErrorMessage: normalizeNullableString(raw['defaultErrorMessage']) ?? undefined
  };
}

function readActionConfigs(payload: Record<string, unknown>): RequestRuntimeDynamicActionConfig[] {
  const candidate = payload['actions'];
  if (!Array.isArray(candidate)) {
    return [];
  }

  return candidate
    .map(item => readActionConfig(item))
    .filter((item): item is RequestRuntimeDynamicActionConfig => item != null);
}

function readActionConfig(item: unknown): RequestRuntimeDynamicActionConfig | null {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    return null;
  }

  const raw = item as Record<string, unknown>;
  const patches = Array.isArray(raw['patches'])
    ? raw['patches']
      .map(candidate => readActionPatchConfig(candidate))
      .filter((candidate): candidate is RequestRuntimeDynamicActionPatchConfig => candidate != null)
    : [];

  if (patches.length === 0) {
    return null;
  }

  const request = readHttpRequestConfig(raw['request']);
  const trigger = normalizeTrigger(raw['trigger'], 'change');
  const normalizedTrigger = trigger === 'init' ? 'change' : trigger;

  return {
    trigger: normalizedTrigger,
    whenEquals: normalizeNullableString(raw['whenEquals']) ?? undefined,
    request: request ?? undefined,
    patches,
    clearTargetsWhenEmpty: raw['clearTargetsWhenEmpty'] === true
  };
}

function readActionPatchConfig(item: unknown): RequestRuntimeDynamicActionPatchConfig | null {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    return null;
  }

  const raw = item as Record<string, unknown>;
  const targetFieldKey = normalizeNullableString(raw['targetFieldKey']);
  if (!targetFieldKey) {
    return null;
  }

  return {
    targetFieldKey,
    valuePath: normalizeNullableString(raw['valuePath']) ?? undefined,
    valueTemplate: normalizeNullableString(raw['valueTemplate']) ?? undefined,
    clearWhenMissing: raw['clearWhenMissing'] === true
  };
}

function readHttpRequestConfig(value: unknown): RequestRuntimeDynamicHttpRequestConfig | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const payload = value as Record<string, unknown>;
  const url = normalizeNullableString(payload['url']);
  if (!url) {
    return null;
  }

  const query = normalizeRecord(payload['query']);
  const headers = normalizeRecord(payload['headers']);

  return {
    url,
    method: normalizeHttpMethod(payload['method']),
    query: query ?? undefined,
    headers: headers ?? undefined,
    body: payload['body']
  };
}

function normalizeRecord(value: unknown): Record<string, string> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const source = value as Record<string, unknown>;
  const result: Record<string, string> = {};

  Object.keys(source).forEach(key => {
    const normalizedKey = String(key ?? '').trim();
    const normalizedValue = normalizeNullableString(source[key]);
    if (!normalizedKey || normalizedValue == null) {
      return;
    }

    result[normalizedKey] = normalizedValue;
  });

  return Object.keys(result).length > 0 ? result : null;
}

function normalizeHttpMethod(value: unknown): 'GET' | 'POST' | 'PUT' | 'PATCH' {
  const normalized = String(value ?? '').trim().toUpperCase();
  if (normalized === 'POST' || normalized === 'PUT' || normalized === 'PATCH') {
    return normalized;
  }

  return 'GET';
}

function normalizeTrigger(value: unknown, fallback: RequestRuntimeDynamicTrigger): RequestRuntimeDynamicTrigger {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'init' || normalized === 'change' || normalized === 'blur') {
    return normalized;
  }

  return fallback;
}

function normalizeNonNegativeInt(value: unknown): number | undefined {
  const normalized = Number(value ?? NaN);
  if (!Number.isFinite(normalized) || normalized < 0) {
    return undefined;
  }

  return Math.trunc(normalized);
}

function normalizePositiveInt(value: unknown): number | undefined {
  const normalized = Number(value ?? NaN);
  if (!Number.isFinite(normalized) || normalized <= 0) {
    return undefined;
  }

  return Math.trunc(normalized);
}

function normalizeNullableString(value: unknown): string | null {
  const normalized = String(value ?? '').trim();
  return normalized.length > 0 ? normalized : null;
}

export function createEmptyRuntimeCatalog(): RequestRuntimeCatalogDto {
  return {
    generatedAtUtc: '',
    totalAvailableRequests: 0,
    applications: []
  };
}

export function resolveEnvelopeDisplayName(value: unknown): string {
  const normalized = String(value ?? '').trim();
  return normalized.length > 0 ? normalized : REQUEST_RUNTIME_DEFAULT_ENVELOPE_DISPLAY_NAME;
}

export function buildEnvelopeTerminology(value: unknown): RequestRuntimeEnvelopeTerminology {
  const displayName = resolveEnvelopeDisplayName(value);
  const selectLabel = displayName === REQUEST_RUNTIME_DEFAULT_ENVELOPE_DISPLAY_NAME
    ? `اختر ${displayName}`
    : `اختر ${toArabicAccusative(displayName)}`;
  const addButtonLabel = displayName === REQUEST_RUNTIME_DEFAULT_ENVELOPE_DISPLAY_NAME
    ? `إضافة ${displayName}`
    : `إضافة ${displayName} جديد`;
  const nameLabel = `اسم ${displayName}`;

  return {
    displayName,
    selectLabel,
    addButtonLabel,
    nameLabel,
    dialogTitle: addButtonLabel,
    createSuccessMessage: `تمت إضافة ${displayName} بنجاح.`,
    listEmptyMessage: `لا توجد ${displayName} متاحة حاليًا.`
  };
}

function toArabicAccusative(value: string): string {
  const normalized = String(value ?? '').trim();
  if (normalized === 'ظرف') {
    return 'ظرفًا';
  }

  if (normalized === 'ملف') {
    return 'ملفًا';
  }

  return normalized;
}
