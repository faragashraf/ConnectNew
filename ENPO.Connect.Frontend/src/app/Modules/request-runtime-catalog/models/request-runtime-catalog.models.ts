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
  startStageName: string | null;
  organizationalScopeLabel: string | null;
  reasons: string[];
}

export type RequestRuntimeTreeNode = TreeNode<RequestRuntimeTreeNodeData>;

export const REQUEST_RUNTIME_ALL_APPLICATIONS_VALUE = '__ALL_APPLICATIONS__';

export function createEmptyRuntimeCatalog(): RequestRuntimeCatalogDto {
  return {
    generatedAtUtc: '',
    totalAvailableRequests: 0,
    applications: []
  };
}
