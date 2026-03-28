import { ErrorDto, FileParameter } from '../dto-shared';

export interface SummerWorkflowCommonResponse<T> {
  readonly isSuccess: boolean;
  errors: ErrorDto[] | undefined;
  data: T;
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  readonly totalPages: number;
}

export interface SummerRequestsPageData {
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  rangeStart: number;
  rangeEnd: number;
  first: number;
  rows: number;
  rowsPerPageOptions: number[];
}

export interface SummerRequestsPageChange {
  pageNumber: number;
  pageSize: number;
  first: number;
  rows: number;
}

export interface SummerRequestSummaryDto {
  messageId: number;
  requestRef: string;
  categoryId: number;
  categoryName: string;
  waveCode: string;
  employeeId: string;
  employeeName: string;
  employeeNationalId: string;
  employeePhone: string;
  employeeExtraPhone: string;
  status: string;
  statusLabel: string;
  workflowStateCode: string;
  workflowStateLabel: string;
  needsTransferReview: boolean;
  createdAt?: string;
  paymentDueAtUtc?: string;
  paidAtUtc?: string;
  transferUsed: boolean;
}

export interface SummerWaveCapacityDto {
  categoryId: number;
  waveCode: string;
  familyCount: number;
  totalUnits: number;
  usedUnits: number;
  availableUnits: number;
}

export interface SummerStayModeDefinitionDto {
  code: string;
  label: string;
}

export interface SummerApartmentDefinitionDto {
  familyCount: number;
  apartments: number;
}

export interface SummerWaveDefinitionDto {
  code: string;
  startsAtLabel: string;
  startsAtIso?: string;
}

export interface SummerDestinationConfigDto {
  categoryId: number;
  slug: string;
  name: string;
  stayModes: SummerStayModeDefinitionDto[];
  familyOptions: number[];
  maxExtraMembers: number;
  apartments: SummerApartmentDefinitionDto[];
  waves: SummerWaveDefinitionDto[];
}

export interface SummerCancelFormRequest {
  messageId: number;
  reason?: string;
  files?: FileParameter[];
}

export interface SummerPayFormRequest {
  messageId: number;
  paidAtUtc?: string;
  forceOverride: boolean;
  notes?: string;
  files?: FileParameter[];
}

export interface SummerTransferFormRequest {
  messageId: number;
  toCategoryId: number;
  toWaveCode: string;
  newFamilyCount?: number;
  newExtraCount?: number;
  notes?: string;
  files?: FileParameter[];
}

export interface SummerAdminRequestsQuery {
  seasonYear: number;
  messageId?: number | null;
  categoryId?: number | null;
  waveCode?: string;
  status?: string;
  paymentState?: string;
  employeeId?: string;
  search?: string;
  pageNumber: number;
  pageSize: number;
}

export interface SummerDashboardBucketDto {
  id?: number | null;
  key: string;
  count: number;
}

export interface SummerDashboardStatusBucketDto {
  statusCode: string;
  statusLabel: string;
  count: number;
}

export interface SummerAdminDashboardDto {
  scopeCategoryId?: number | null;
  scopeWaveCode?: string;
  scopeLabel?: string;
  totalRequests: number;
  newCount: number;
  inProgressCount: number;
  repliedCount: number;
  rejectedCount: number;
  paidCount: number;
  unpaidCount: number;
  overdueUnpaidCount: number;
  byDestination: SummerDashboardBucketDto[];
  byWave: SummerDashboardBucketDto[];
  byStatus: SummerDashboardStatusBucketDto[];
}

export interface SummerAdminActionRequest {
  messageId: number;
  actionCode: string;
  comment?: string;
  force?: boolean;
  toCategoryId?: number | null;
  toWaveCode?: string;
  newFamilyCount?: number | null;
  newExtraCount?: number | null;
  files?: FileParameter[];
}
