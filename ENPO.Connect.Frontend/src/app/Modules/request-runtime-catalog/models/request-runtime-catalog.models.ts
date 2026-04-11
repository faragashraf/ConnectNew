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
}

export interface RequestRuntimeFieldDefinitionDto {
  mendSql: number;
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
  displayOrder: number;
  isVisible: boolean;
  group?: RequestRuntimeFormGroupDefinitionDto;
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
