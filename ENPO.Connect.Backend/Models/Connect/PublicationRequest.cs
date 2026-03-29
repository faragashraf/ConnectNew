using System;
using System.Collections.Generic;

namespace Models.Correspondance;

public partial class PublicationRequest
{
    public int MessageId { get; set; }
    public int PublicationRequestTypeId { get; set; }
    public decimal DepartmentUnitId { get; set; }
    public string WorkflowStatus { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? SubmittedAtUtc { get; set; }
    public DateTime? ReviewedAtUtc { get; set; }
    public DateTime? ReturnedAtUtc { get; set; }
    public DateTime? RejectedAtUtc { get; set; }
    public DateTime? ApprovedAtUtc { get; set; }
    public int? PublicationYear { get; set; }
    public int? PublicationSerial { get; set; }
    public string? PublicationNumber { get; set; }
    public int? FinalApprovalReplyId { get; set; }
    public string CreatedBy { get; set; } = string.Empty;
    public string? LastActionBy { get; set; }
    public DateTime? LastActionAtUtc { get; set; }
    public byte[] RowVersion { get; set; } = Array.Empty<byte>();

    public virtual Message Message { get; set; } = null!;
    public virtual PublicationRequestType PublicationRequestType { get; set; } = null!;
    public virtual ICollection<PublicationRequestHistory> Histories { get; set; } = new List<PublicationRequestHistory>();
}
