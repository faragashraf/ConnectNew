using System;

namespace Models.Correspondance;

public partial class SubjectRoutingTransition
{
    public int Id { get; set; }

    public int RoutingProfileId { get; set; }

    public int FromStepId { get; set; }

    public int ToStepId { get; set; }

    public string ActionCode { get; set; } = string.Empty;

    public string ActionNameAr { get; set; } = string.Empty;

    public int DisplayOrder { get; set; }

    public bool RequiresComment { get; set; }

    public bool RequiresMandatoryFieldsCompletion { get; set; }

    public bool IsRejectPath { get; set; }

    public bool IsReturnPath { get; set; }

    public bool IsEscalationPath { get; set; }

    public string? ConditionExpression { get; set; }

    public bool IsActive { get; set; }

    public string CreatedBy { get; set; } = "SYSTEM";

    public DateTime CreatedDate { get; set; }

    public string? LastModifiedBy { get; set; }

    public DateTime? LastModifiedDate { get; set; }

    public virtual SubjectRoutingProfile RoutingProfile { get; set; } = null!;

    public virtual SubjectRoutingStep FromStep { get; set; } = null!;

    public virtual SubjectRoutingStep ToStep { get; set; } = null!;
}
