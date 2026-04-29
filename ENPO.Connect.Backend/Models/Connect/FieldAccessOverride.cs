using System;

namespace Models.Correspondance;

public partial class FieldAccessOverride
{
    public int Id { get; set; }

    public int? RequestId { get; set; }

    public int? RequestTypeId { get; set; }

    public int? RuleId { get; set; }

    public string? TargetLevel { get; set; }

    public int? TargetId { get; set; }

    public string SubjectType { get; set; } = "User";

    public string? SubjectId { get; set; }

    public string OverridePermissionType { get; set; } = "Editable";

    public string? Reason { get; set; }

    public string GrantedBy { get; set; } = "SYSTEM";

    public DateTime GrantedAt { get; set; }

    public DateTime? ExpiresAt { get; set; }

    public bool IsActive { get; set; }

    public virtual FieldAccessPolicyRule? Rule { get; set; }
}
