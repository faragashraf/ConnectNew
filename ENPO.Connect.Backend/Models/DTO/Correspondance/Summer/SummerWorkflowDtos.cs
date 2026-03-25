using Microsoft.AspNetCore.Http;

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

public class SummerWaveCapacityDto
{
    public int CategoryId { get; set; }
    public string WaveCode { get; set; } = string.Empty;
    public int FamilyCount { get; set; }
    public int TotalUnits { get; set; }
    public int UsedUnits { get; set; }
    public int AvailableUnits { get; set; }
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

public class SummerCancelRequest
{
    public int MessageId { get; set; }
    public string? Reason { get; set; }
    public List<IFormFile>? files { get; set; } = new();
}

public class SummerPayRequest
{
    public int MessageId { get; set; }
    public DateTime? PaidAtUtc { get; set; }
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
