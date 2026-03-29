using Microsoft.AspNetCore.Http;
using Models.Correspondance;
using Models.DTO.Correspondance;

namespace Models.DTO.Correspondance.Publications;

public static class PublicationWorkflowStatuses
{
    public const string Draft = "Draft";
    public const string Submitted = "Submitted";
    public const string UnderReview = "UnderReview";
    public const string ReturnedForEdit = "ReturnedForEdit";
    public const string LegacyReturned = "Returned";
    public const string Rejected = "Rejected";
    public const string Approved = "Approved";

    public static readonly string[] All =
    {
        Draft,
        Submitted,
        UnderReview,
        ReturnedForEdit,
        Rejected,
        Approved
    };
}

public class PublicationRequestTypeDto
{
    public int PublicationRequestTypeId { get; set; }
    public string Code { get; set; } = string.Empty;
    public string NameAr { get; set; } = string.Empty;
    public string? NameEn { get; set; }
    public int CategoryId { get; set; }
    public int DisplayOrder { get; set; }
}

public class PublicationSearchableFieldDto
{
    public string FieldKey { get; set; } = string.Empty;
    public string FieldLabel { get; set; } = string.Empty;
    public bool IsDynamic { get; set; }
}

public class PublicationCreateRequest
{
    public string? Subject { get; set; }
    public string? Description { get; set; }
    public int PublicationRequestTypeId { get; set; }
    public decimal? DepartmentUnitId { get; set; }
    public string? Comment { get; set; }
    public List<TkmendField>? Fields { get; set; } = new();
    public List<IFormFile>? files { get; set; } = new();
}

public class PublicationEditRequest
{
    public string? Subject { get; set; }
    public string? Description { get; set; }
    public int? PublicationRequestTypeId { get; set; }
    public decimal? DepartmentUnitId { get; set; }
    public string? Comment { get; set; }
    public List<TkmendField>? Fields { get; set; } = new();
    public List<IFormFile>? files { get; set; } = new();
}

public class PublicationActionRequest
{
    public string? Comment { get; set; }
    public List<IFormFile>? files { get; set; } = new();
}

public class PublicationApproveRequest
{
    public string? Comment { get; set; }
    public List<IFormFile>? files { get; set; } = new();
}

public class PublicationRequestsQuery
{
    public int PageNumber { get; set; } = 1;
    public int PageSize { get; set; } = 20;
    public bool AdminView { get; set; }
    public int? PublicationRequestTypeId { get; set; }
    public decimal? DepartmentUnitId { get; set; }
    public string? WorkflowStatus { get; set; }
    public DateTime? CreatedFromUtc { get; set; }
    public DateTime? CreatedToUtc { get; set; }
    public string? SearchField { get; set; }
    public string? SearchText { get; set; }
    public string? SearchType { get; set; } = "Contains";
    public bool IncludeDynamicFields { get; set; }
}

public class PublicationDashboardQuery
{
    public int? PublicationRequestTypeId { get; set; }
    public decimal? DepartmentUnitId { get; set; }
    public DateTime? CreatedFromUtc { get; set; }
    public DateTime? CreatedToUtc { get; set; }
}

public class PublicationRequestSummaryDto
{
    public int MessageId { get; set; }
    public string? Subject { get; set; }
    public string? Description { get; set; }
    public string CreatedBy { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; }
    public string WorkflowStatus { get; set; } = string.Empty;
    public string? PublicationNumber { get; set; }
    public int PublicationRequestTypeId { get; set; }
    public string PublicationRequestTypeNameAr { get; set; } = string.Empty;
    public decimal DepartmentUnitId { get; set; }
    public string DepartmentUnitName { get; set; } = string.Empty;
    public int CategoryId { get; set; }
    public bool CanEdit { get; set; }
    public bool CanReview { get; set; }
    public List<TkmendField>? Fields { get; set; }
}

public class PublicationRequestDetailsDto
{
    public PublicationRequestSummaryDto Summary { get; set; } = new();
    public MessageDto? MessageDetails { get; set; }
    public List<PublicationRequestHistoryDto> History { get; set; } = new();
}

public class PublicationRequestHistoryDto
{
    public int PublicationRequestHistoryId { get; set; }
    public int MessageId { get; set; }
    public string ActionCode { get; set; } = string.Empty;
    public string? FromStatus { get; set; }
    public string ToStatus { get; set; } = string.Empty;
    public string? Comment { get; set; }
    public string ActionBy { get; set; } = string.Empty;
    public DateTime ActionAtUtc { get; set; }
    public int? ReplyId { get; set; }
}

public class PublicationDashboardDto
{
    public int TotalCount { get; set; }
    public int DraftCount { get; set; }
    public int SubmittedCount { get; set; }
    public int UnderReviewCount { get; set; }
    public int PendingReviewCount { get; set; }
    public int ReturnedCount { get; set; }
    public int RejectedCount { get; set; }
    public int ApprovedCount { get; set; }
    public double AvgApprovalHours { get; set; }
    public List<PublicationDashboardBucketDto> ByDepartment { get; set; } = new();
    public List<PublicationDashboardBucketDto> ByRequestType { get; set; } = new();
}

public class PublicationDashboardBucketDto
{
    public string Key { get; set; } = string.Empty;
    public int Count { get; set; }
}
