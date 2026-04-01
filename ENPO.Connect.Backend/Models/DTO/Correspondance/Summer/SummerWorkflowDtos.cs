using Microsoft.AspNetCore.Http;
using System.Text.Json.Serialization;

namespace Models.DTO.Correspondance.Summer;

public class SummerRequestSummaryDto
{
    public int MessageId { get; set; }
    public string RequestRef { get; set; } = string.Empty;
    public int CategoryId { get; set; }
    public string CategoryName { get; set; } = string.Empty;
    public string WaveCode { get; set; } = string.Empty;
    public string EmployeeId { get; set; } = string.Empty;
    public string EmployeeName { get; set; } = string.Empty;
    public string EmployeeNationalId { get; set; } = string.Empty;
    public string EmployeePhone { get; set; } = string.Empty;
    public string EmployeeExtraPhone { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string StatusLabel { get; set; } = string.Empty;
    public string WorkflowStateCode { get; set; } = string.Empty;
    public string WorkflowStateLabel { get; set; } = string.Empty;
    public bool NeedsTransferReview { get; set; }
    public DateTime? CreatedAt { get; set; }
    public DateTime? PaymentDueAtUtc { get; set; }
    public DateTime? PaidAtUtc { get; set; }
    public bool TransferUsed { get; set; }
}

public class SummerCreateEditTokenRequest
{
    public int MessageId { get; set; }
    public int? ExpireMinutes { get; set; } = 30;
    public bool OneTimeUse { get; set; }
}

public class SummerEditTokenResolutionDto
{
    public int MessageId { get; set; }
    public DateTime? ExpiresAtUtc { get; set; }
    public bool IsOneTimeUse { get; set; }
}

public class SummerWaveCapacityDto
{
    public int CategoryId { get; set; }
    public string WaveCode { get; set; } = string.Empty;
    public int FamilyCount { get; set; }
    public int TotalUnits { get; set; }
    public int UsedUnits { get; set; }
    public int AvailableUnits { get; set; }
    public int FrozenAvailableUnits { get; set; }
    public int FrozenAssignedUnits { get; set; }
}

public class SummerWaveBookingsPrintReportDto
{
    public int CategoryId { get; set; }
    public string CategoryName { get; set; } = string.Empty;
    public string WaveCode { get; set; } = string.Empty;
    public DateTime? WaveStartAtUtc { get; set; }
    public DateTime? WaveEndAtUtc { get; set; }
    public DateTime GeneratedAtUtc { get; set; }
    public string GeneratedByUserId { get; set; } = string.Empty;
    public int TotalBookings { get; set; }
    public List<SummerWaveBookingsPrintSectionDto> Sections { get; set; } = new();
}

public class SummerWaveBookingsPrintSectionDto
{
    public int? FamilyCount { get; set; }
    public string SectionLabel { get; set; } = string.Empty;
    public int TotalBookings { get; set; }
    public List<SummerWaveBookingPrintRowDto> Rows { get; set; } = new();
}

public class SummerWaveBookingPrintRowDto
{
    public int MessageId { get; set; }
    public string RequestRef { get; set; } = string.Empty;
    public string BookerName { get; set; } = string.Empty;
    public string WorkEntity { get; set; } = string.Empty;
    public string BookingTypeLabel { get; set; } = string.Empty;
    public string UnitNumber { get; set; } = string.Empty;
    public int PersonsCount { get; set; }
    public string StatusLabel { get; set; } = string.Empty;
    public string Notes { get; set; } = string.Empty;
}

public class SummerDestinationConfigDto
{
    public int CategoryId { get; set; }
    public string Slug { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public int MaxExtraMembers { get; set; }
    public List<SummerStayModeDefinitionDto> StayModes { get; set; } = new();
    public List<int> FamilyOptions { get; set; } = new();
    public List<SummerApartmentDefinitionDto> Apartments { get; set; } = new();
    public List<SummerWaveDefinitionDto> Waves { get; set; } = new();
}

public class SummerStayModeDefinitionDto
{
    public string Code { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
}

public class SummerApartmentDefinitionDto
{
    public int FamilyCount { get; set; }
    public int Apartments { get; set; }
}

public class SummerWaveDefinitionDto
{
    public string Code { get; set; } = string.Empty;
    public string StartsAtLabel { get; set; } = string.Empty;
    public string? StartsAtIso { get; set; }
}

public class SummerPricingQuoteRequest
{
    public int CategoryId { get; set; }
    public int SeasonYear { get; set; } = 2026;
    public string WaveCode { get; set; } = string.Empty;
    public string? WaveLabel { get; set; }
    public string? WaveStartsAtIso { get; set; }
    public string? PeriodKey { get; set; }
    public int PersonsCount { get; set; }
    public int? FamilyCount { get; set; }
    public int? ExtraCount { get; set; }
    public string? StayMode { get; set; }
    public bool IsProxyBooking { get; set; }
    public string? DestinationName { get; set; }
}

public class SummerPricingQuoteDto
{
    public string PricingConfigId { get; set; } = string.Empty;
    public int CategoryId { get; set; }
    public int SeasonYear { get; set; }
    public string WaveCode { get; set; } = string.Empty;
    public string WaveLabel { get; set; } = string.Empty;
    public string PeriodKey { get; set; } = string.Empty;
    public string PricingMode { get; set; } = string.Empty;
    public bool TransportationMandatory { get; set; }
    public int PersonsCount { get; set; }
    public decimal AccommodationPricePerPerson { get; set; }
    public decimal TransportationPricePerPerson { get; set; }
    public string SelectedStayMode { get; set; } = string.Empty;
    public string NormalizedStayMode { get; set; } = string.Empty;
    public bool StayModeWasNormalized { get; set; }
    public decimal AccommodationTotal { get; set; }
    public decimal TransportationTotal { get; set; }
    public decimal InsuranceAmount { get; set; }
    public decimal? ProxyInsuranceAmount { get; set; }
    public decimal AppliedInsuranceAmount { get; set; }
    public decimal GrandTotal { get; set; }
    public string DisplayText { get; set; } = string.Empty;
    public string SmsText { get; set; } = string.Empty;
    public string WhatsAppText { get; set; } = string.Empty;
}

public class SummerPricingCatalogDto
{
    public int SeasonYear { get; set; } = 2026;
    public List<SummerPricingCatalogRecordDto> Records { get; set; } = new();
}

public class SummerPricingCatalogRecordDto
{
    public string PricingConfigId { get; set; } = string.Empty;
    public int CategoryId { get; set; }
    public int SeasonYear { get; set; } = 2026;
    public string WaveCode { get; set; } = string.Empty;
    public string PeriodKey { get; set; } = string.Empty;
    public string? DateFrom { get; set; }
    public string? DateTo { get; set; }
    public decimal AccommodationPricePerPerson { get; set; }
    public decimal TransportationPricePerPerson { get; set; }
    public decimal InsuranceAmount { get; set; }
    public decimal? ProxyInsuranceAmount { get; set; }
    public string PricingMode { get; set; } = string.Empty;
    public bool TransportationMandatory { get; set; }
    public bool IsActive { get; set; } = true;
    public string DisplayLabel { get; set; } = string.Empty;
    public string Notes { get; set; } = string.Empty;
}

public class SummerPricingCatalogUpsertRequest
{
    public int SeasonYear { get; set; } = 2026;
    [JsonPropertyName("records")]
    public List<SummerPricingCatalogRecordDto> Records { get; set; } = new();
    [JsonPropertyName("pricingRecords")]
    public List<SummerPricingCatalogRecordDto>? PricingRecords { get; set; }
}

public class SummerCancelRequest
{
    public int MessageId { get; set; }
    public string? Reason { get; set; }
    public List<IFormFile>? files { get; set; } = new();
}

public class SummerPayRequest
{
    public int MessageId { get; set; }
    public DateTimeOffset? PaidAtUtc { get; set; }
    public bool ForceOverride { get; set; }
    public string? Notes { get; set; }
    public List<IFormFile>? files { get; set; } = new();
}

public class SummerTransferRequest
{
    public int MessageId { get; set; }
    public int ToCategoryId { get; set; }
    public string ToWaveCode { get; set; } = string.Empty;
    public int? NewFamilyCount { get; set; }
    public int? NewExtraCount { get; set; }
    public string? Notes { get; set; }
    public List<IFormFile>? files { get; set; } = new();
}

public class SummerAdminRequestsQuery
{
    public int SeasonYear { get; set; } = 2026;
    public int? MessageId { get; set; }
    public int? CategoryId { get; set; }
    public string? WaveCode { get; set; }
    public string? Status { get; set; }
    public string? PaymentState { get; set; }
    public string? EmployeeId { get; set; }
    public string? Search { get; set; }
    public int PageNumber { get; set; } = 1;
    public int PageSize { get; set; } = 50;
}

public class SummerAdminDashboardDto
{
    public int? ScopeCategoryId { get; set; }
    public string ScopeWaveCode { get; set; } = string.Empty;
    public string ScopeLabel { get; set; } = string.Empty;
    public int TotalRequests { get; set; }
    public int NewCount { get; set; }
    public int InProgressCount { get; set; }
    public int RepliedCount { get; set; }
    public int RejectedCount { get; set; }
    public int PaidCount { get; set; }
    public int UnpaidCount { get; set; }
    public int OverdueUnpaidCount { get; set; }
    public List<SummerDashboardBucketDto> ByDestination { get; set; } = new();
    public List<SummerDashboardBucketDto> ByWave { get; set; } = new();
    public List<SummerDashboardStatusBucketDto> ByStatus { get; set; } = new();
}

public class SummerDashboardBucketDto
{
    public int? Id { get; set; }
    public string Key { get; set; } = string.Empty;
    public int Count { get; set; }
}

public class SummerDashboardStatusBucketDto
{
    public string StatusCode { get; set; } = string.Empty;
    public string StatusLabel { get; set; } = string.Empty;
    public int Count { get; set; }
}

public class SummerAdminActionRequest
{
    public int MessageId { get; set; }
    public string ActionCode { get; set; } = string.Empty;
    public string? Comment { get; set; }
    public bool Force { get; set; }
    public int? ToCategoryId { get; set; }
    public string? ToWaveCode { get; set; }
    public int? NewFamilyCount { get; set; }
    public int? NewExtraCount { get; set; }
    public List<IFormFile>? files { get; set; } = new();
}

public class SummerUnitFreezeCreateRequest
{
    public int CategoryId { get; set; }
    public string WaveCode { get; set; } = string.Empty;
    public int FamilyCount { get; set; }
    public int RequestedUnitsCount { get; set; }
    public string? FreezeType { get; set; }
    public string? Reason { get; set; }
    public string? Notes { get; set; }
}

public class SummerUnitFreezeReleaseRequest
{
    public int FreezeId { get; set; }
}

public class SummerUnitFreezeQuery
{
    public int? CategoryId { get; set; }
    public string? WaveCode { get; set; }
    public int? FamilyCount { get; set; }
    public bool? IsActive { get; set; }
}

public class SummerUnitFreezeDto
{
    public int FreezeId { get; set; }
    public int CategoryId { get; set; }
    public string WaveCode { get; set; } = string.Empty;
    public int FamilyCount { get; set; }
    public int RequestedUnitsCount { get; set; }
    public int FrozenAvailableUnits { get; set; }
    public int FrozenAssignedUnits { get; set; }
    public string FreezeType { get; set; } = string.Empty;
    public string? Reason { get; set; }
    public string? Notes { get; set; }
    public string CreatedBy { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; }
    public bool IsActive { get; set; }
    public DateTime? ReleasedAtUtc { get; set; }
    public string? ReleasedBy { get; set; }
}

public class SummerUnitFreezeDetailDto
{
    public int FreezeDetailId { get; set; }
    public int SlotNumber { get; set; }
    public string Status { get; set; } = string.Empty;
    public int? AssignedMessageId { get; set; }
    public DateTime? AssignedAtUtc { get; set; }
    public DateTime? ReleasedAtUtc { get; set; }
    public string? ReleasedBy { get; set; }
    public DateTime LastStatusChangedAtUtc { get; set; }
}

public class SummerUnitFreezeDetailsDto
{
    public SummerUnitFreezeDto Freeze { get; set; } = new();
    public List<SummerUnitFreezeDetailDto> Units { get; set; } = new();
}

public class SummerUnitsAvailableCountQuery
{
    public int CategoryId { get; set; }
    public string WaveCode { get; set; } = string.Empty;
    public int FamilyCount { get; set; }
    public bool IncludeFrozenUnits { get; set; }
}

public class SummerUnitsAvailableCountDto
{
    public int CategoryId { get; set; }
    public string WaveCode { get; set; } = string.Empty;
    public int FamilyCount { get; set; }
    public int TotalUnits { get; set; }
    public int UsedUnits { get; set; }
    public int FrozenAvailableUnits { get; set; }
    public int FrozenAssignedUnits { get; set; }
    public int PublicAvailableUnits { get; set; }
    public int AvailableUnits { get; set; }
    public bool IncludeFrozenUnits { get; set; }
}

public class AdminUnitsAvailableCountQuery
{
    public int ResortId { get; set; }
    public string WaveId { get; set; } = string.Empty;
    public int Capacity { get; set; }
    public bool IncludeFrozenUnits { get; set; }
}

public class AdminUnitFreezeCreateRequest
{
    public int ResortId { get; set; }
    public string WaveId { get; set; } = string.Empty;
    public int Capacity { get; set; }
    public int UnitsCount { get; set; }
    public string? FreezeType { get; set; }
    public string? Reason { get; set; }
    public string? Notes { get; set; }
}

public class AdminUnitFreezeListQuery
{
    public int? ResortId { get; set; }
    public string? WaveId { get; set; }
    public int? Capacity { get; set; }
    public bool? IsActive { get; set; }
}
