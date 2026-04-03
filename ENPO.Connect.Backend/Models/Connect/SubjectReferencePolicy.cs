using System;

namespace Models.Correspondance;

public partial class SubjectReferencePolicy
{
    public int PolicyId { get; set; }

    public int CategoryId { get; set; }

    public string Prefix { get; set; } = null!;

    public string Separator { get; set; } = "-";

    public string? SourceFieldKeys { get; set; }

    public bool IncludeYear { get; set; }

    public bool UseSequence { get; set; }

    public string? SequenceName { get; set; }

    public bool IsActive { get; set; }

    public string CreatedBy { get; set; } = null!;

    public DateTime CreatedAtUtc { get; set; }

    public string? LastModifiedBy { get; set; }

    public DateTime? LastModifiedAtUtc { get; set; }
}
