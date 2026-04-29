using System;

namespace Models.Correspondance;

public partial class SubjectTypeRequestAvailability
{
    public int CategoryId { get; set; }

    public string AvailabilityMode { get; set; } = "Public";

    public string? SelectedNodeType { get; set; }

    public decimal? SelectedNodeNumericId { get; set; }

    public string? SelectedNodeUserId { get; set; }

    public string? SelectionLabelAr { get; set; }

    public string? SelectionPathAr { get; set; }

    public string LastModifiedBy { get; set; } = "SYSTEM";

    public DateTime LastModifiedAtUtc { get; set; }
}
