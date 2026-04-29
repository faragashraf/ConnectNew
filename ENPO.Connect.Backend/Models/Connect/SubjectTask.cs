using System;

namespace Models.Correspondance;

public partial class SubjectTask
{
    public long TaskId { get; set; }

    public int MessageId { get; set; }

    public string ActionTitle { get; set; } = null!;

    public string? ActionDescription { get; set; }

    public string? AssignedToUserId { get; set; }

    public string? AssignedUnitId { get; set; }

    public byte Status { get; set; }

    public DateTime? DueDateUtc { get; set; }

    public DateTime? CompletedAtUtc { get; set; }

    public string CreatedBy { get; set; } = null!;

    public DateTime CreatedAtUtc { get; set; }

    public string? LastModifiedBy { get; set; }

    public DateTime? LastModifiedAtUtc { get; set; }
}
