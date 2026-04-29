using System;

namespace Models.Correspondance;

public partial class ReferenceSequence
{
    public int SequenceId { get; set; }

    public int SubjectId { get; set; }

    public string SequenceKey { get; set; } = null!;

    public long CurrentValue { get; set; }

    public string ResetPolicy { get; set; } = "none";

    public DateTime? LastResetAtUtc { get; set; }

    public DateTime CreatedAtUtc { get; set; }

    public DateTime LastModifiedAtUtc { get; set; }
}
