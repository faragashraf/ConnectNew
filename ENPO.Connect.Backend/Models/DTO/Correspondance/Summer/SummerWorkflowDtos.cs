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
    public string Status { get; set; } = string.Empty;
    public DateTime? CreatedAt { get; set; }
    public DateTime? PaymentDueAtUtc { get; set; }
    public DateTime? PaidAtUtc { get; set; }
    public bool TransferUsed { get; set; }
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

