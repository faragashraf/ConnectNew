using System;
using System.Collections.Generic;

namespace Models.Correspondance;

public partial class SubjectRoutingStep
{
    public int Id { get; set; }

    public int RoutingProfileId { get; set; }

    public string StepCode { get; set; } = string.Empty;

    public string StepNameAr { get; set; } = string.Empty;

    public string StepType { get; set; } = string.Empty;

    public int StepOrder { get; set; }

    public bool IsStart { get; set; }

    public bool IsEnd { get; set; }

    public int? SlaHours { get; set; }

    public bool IsActive { get; set; }

    public string? NotesAr { get; set; }

    public string CreatedBy { get; set; } = "SYSTEM";

    public DateTime CreatedDate { get; set; }

    public string? LastModifiedBy { get; set; }

    public DateTime? LastModifiedDate { get; set; }

    public virtual SubjectRoutingProfile RoutingProfile { get; set; } = null!;

    public virtual ICollection<SubjectRoutingTarget> Targets { get; set; } = new List<SubjectRoutingTarget>();

    public virtual ICollection<SubjectRoutingTransition> FromTransitions { get; set; } = new List<SubjectRoutingTransition>();

    public virtual ICollection<SubjectRoutingTransition> ToTransitions { get; set; } = new List<SubjectRoutingTransition>();
}
