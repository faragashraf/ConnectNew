using System;

namespace Models.Correspondance;

public partial class PublicationRequestHistory
{
    public int PublicationRequestHistoryId { get; set; }
    public int MessageId { get; set; }
    public string ActionCode { get; set; } = string.Empty;
    public string? FromStatus { get; set; }
    public string ToStatus { get; set; } = string.Empty;
    public string? Comment { get; set; }
    public string ActionBy { get; set; } = string.Empty;
    public DateTime ActionAtUtc { get; set; } = DateTime.UtcNow;
    public int? ReplyId { get; set; }

    public virtual PublicationRequest PublicationRequest { get; set; } = null!;
}
