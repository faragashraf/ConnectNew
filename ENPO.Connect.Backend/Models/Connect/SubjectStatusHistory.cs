using System;

namespace Models.Correspondance;

public partial class SubjectStatusHistory
{
    public int StatusHistoryId { get; set; }

    public int MessageId { get; set; }

    public byte? OldStatus { get; set; }

    public byte NewStatus { get; set; }

    public string? Notes { get; set; }

    public string ChangedBy { get; set; } = null!;

    public DateTime ChangedAtUtc { get; set; }
}
