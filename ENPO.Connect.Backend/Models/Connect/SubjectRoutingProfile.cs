using System;
using System.Collections.Generic;

namespace Models.Correspondance;

public partial class SubjectRoutingProfile
{
    public int Id { get; set; }

    public int SubjectTypeId { get; set; }

    public string NameAr { get; set; } = string.Empty;

    public string? DescriptionAr { get; set; }

    public bool IsActive { get; set; }

    public string DirectionMode { get; set; } = "Both";

    public int? StartStepId { get; set; }

    public int VersionNo { get; set; }

    public string CreatedBy { get; set; } = "SYSTEM";

    public DateTime CreatedDate { get; set; }

    public string? LastModifiedBy { get; set; }

    public DateTime? LastModifiedDate { get; set; }

    public virtual SubjectRoutingStep? StartStep { get; set; }

    public virtual ICollection<SubjectRoutingStep> Steps { get; set; } = new List<SubjectRoutingStep>();

    public virtual ICollection<SubjectRoutingTransition> Transitions { get; set; } = new List<SubjectRoutingTransition>();

    public virtual ICollection<SubjectTypeRoutingBinding> Bindings { get; set; } = new List<SubjectTypeRoutingBinding>();
}
