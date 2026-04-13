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
  paymentStateCode?: string;
  paymentStateLabel?: string;
  paidInstallmentsCount?: number;
  totalInstallmentsCount?: number;
  transferUsed: boolean;
}

export interface SummerCreateEditTokenRequest {
  messageId: number;
  expireMinutes?: number | null;
  oneTimeUse?: boolean;
}

export interface SummerEditTokenResolutionDto {
  messageId: number;
  expiresAtUtc?: string;
  isOneTimeUse: boolean;
}

export interface SummerWaveCapacityDto {
  categoryId: number;
  waveCode: string;
  familyCount: number;
  totalUnits: number;
  usedUnits: number;
  availableUnits: number;
  frozenAvailableUnits: number;
  frozenAssignedUnits: number;
}

export interface SummerWaveBookingsPrintRowDto {
  messageId: number;
  requestRef: string;
  bookerName: string;
  workEntity: string;
  bookingTypeLabel: string;
  unitNumber: string;
  personsCount: number;
  statusLabel: string;
  notes: string;
  paymentMode: string;
  paymentModeLabel: string;
  collectionStatusLabel: string;
  bookingAmount: number;
  insuranceAmount: number;
  finalAmount: number;
  collectedAmount: number;
  uncollectedAmount: number;
  isFullyCollected: boolean;
}

export interface SummerWaveBookingsPrintSectionDto {
  familyCount?: number | null;
  sectionLabel: string;
  totalBookings: number;
  totalBookingAmount: number;
  totalInsuranceAmount: number;
  totalFinalAmount: number;
  totalCollectedAmount: number;
  totalUncollectedAmount: number;
  cashBookingsCount: number;
  installmentBookingsCount: number;
  cashFinalAmount: number;
  installmentFinalAmount: number;
  rows: SummerWaveBookingsPrintRowDto[];
}

export interface SummerWaveBookingsPrintReportDto {
  categoryId: number;
  categoryName: string;
  waveCode: string;
  waveStartAtUtc?: string | null;
  waveEndAtUtc?: string | null;
  generatedAtUtc?: string;
  generatedByUserId: string;
  includeFinancials: boolean;
  totalBookings: number;
  totalBookingAmount: number;
  totalInsuranceAmount: number;
  totalFinalAmount: number;
  totalCollectedAmount: number;
  totalUncollectedAmount: number;
  cashBookingsCount: number;
  installmentBookingsCount: number;
  cashFinalAmount: number;
  installmentFinalAmount: number;
  sections: SummerWaveBookingsPrintSectionDto[];
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

export interface SummerPricingQuoteRequest {
  categoryId: number;
  seasonYear: number;
  waveCode: string;
  waveLabel?: string;
  waveStartsAtIso?: string;
  periodKey?: string;
  personsCount: number;
  familyCount?: number | null;
  extraCount?: number | null;
  stayMode?: string;
  isProxyBooking?: boolean;
  membershipType?: string;
  destinationName?: string;
}

export interface SummerPricingQuoteDto {
  pricingConfigId: string;
  categoryId: number;
  seasonYear: number;
  waveCode: string;
  waveLabel: string;
  periodKey: string;
  pricingMode: string;
  transportationMandatory: boolean;
  personsCount: number;
  accommodationPricePerPerson: number;
  transportationPricePerPerson: number;
  membershipType: string;
  membershipTypeLabel: string;
  selectedStayMode: string;
  normalizedStayMode: string;
  stayModeWasNormalized: boolean;
  accommodationTotal: number;
  transportationTotal: number;
  insuranceAmount: number;
  proxyInsuranceAmount?: number | null;
  appliedInsuranceAmount: number;
  grandTotal: number;
  displayText: string;
  smsText: string;
  whatsAppText: string;
}

export interface SummerPricingCatalogRecordDto {
  pricingConfigId: string;
  categoryId: number;
  seasonYear: number;
  waveCode: string;
  periodKey: string;
  dateFrom?: string;
  dateTo?: string;
  accommodationPricePerPerson: number;
  transportationPricePerPerson: number;
  insuranceAmount: number;
  proxyInsuranceAmount?: number | null;
  pricingMode: string;
  transportationMandatory: boolean;
  isActive: boolean;
  displayLabel: string;
  notes: string;
}

export interface SummerPricingCatalogDto {
  seasonYear: number;
  records: SummerPricingCatalogRecordDto[];
}

export interface SummerPricingCatalogUpsertRequest {
  seasonYear: number;
  records: SummerPricingCatalogRecordDto[];
}

export interface SummerCancelFormRequest {
  messageId: number;
  reason?: string;
  files?: FileParameter[];
}

export interface SummerPayFormRequest {
  messageId: number;
  paidAtUtc?: string;
  paymentStatus?: string;
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
  partialPaidCount: number;
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

export interface SummerUnitFreezeCreateRequest {
  categoryId: number;
  waveCode: string;
  familyCount: number;
  requestedUnitsCount: number;
  freezeType?: string;
  reason?: string;
  notes?: string;
}

export interface SummerUnitFreezeReleaseRequest {
  freezeId: number;
}

export interface SummerUnitFreezeQuery {
  categoryId?: number | null;
  waveCode?: string;
  familyCount?: number | null;
  isActive?: boolean | null;
}

export interface SummerUnitFreezeDto {
  freezeId: number;
  categoryId: number;
  waveCode: string;
  familyCount: number;
  requestedUnitsCount: number;
  frozenAvailableUnits: number;
  frozenAssignedUnits: number;
  freezeType: string;
  reason?: string;
  notes?: string;
  createdBy: string;
  createdAtUtc: string;
  isActive: boolean;
  releasedAtUtc?: string;
  releasedBy?: string;
}

export interface SummerUnitFreezeDetailDto {
  freezeDetailId: number;
  slotNumber: number;
  status: string;
  assignedMessageId?: number | null;
  assignedAtUtc?: string;
  releasedAtUtc?: string;
  releasedBy?: string;
  lastStatusChangedAtUtc: string;
}

export interface SummerUnitFreezeDetailsDto {
  freeze: SummerUnitFreezeDto;
  units: SummerUnitFreezeDetailDto[];
}

export interface SummerUnitsAvailableCountQuery {
  resortId: number;
  waveId: string;
  capacity: number;
  includeFrozenUnits?: boolean;
}

export interface SummerUnitsAvailableCountDto {
  categoryId: number;
  waveCode: string;
  familyCount: number;
  totalUnits: number;
  usedUnits: number;
  frozenAvailableUnits: number;
  frozenAssignedUnits: number;
  publicAvailableUnits: number;
  availableUnits: number;
  includeFrozenUnits: boolean;
}

export interface AdminUnitFreezeCreatePayload {
  resortId: number;
  waveId: string;
  capacity: number;
  unitsCount: number;
  freezeType?: string;
  reason?: string;
  notes?: string;
}

export interface AdminUnitFreezeListQuery {
  resortId?: number | null;
  waveId?: string;
  capacity?: number | null;
  isActive?: boolean | null;
}
