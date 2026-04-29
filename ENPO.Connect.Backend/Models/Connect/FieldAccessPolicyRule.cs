using System;

namespace Models.Correspondance;

public partial class FieldAccessPolicyRule
{
    public int Id { get; set; }

    public int PolicyId { get; set; }

    public string TargetLevel { get; set; } = "Field";

    public int TargetId { get; set; }

    public int? StageId { get; set; }

    public int? ActionId { get; set; }

    public string PermissionType { get; set; } = "Editable";

    public string SubjectType { get; set; } = "OrgUnit";

    public string? SubjectId { get; set; }

    public string Effect { get; set; } = "Allow";

    public int Priority { get; set; }

    public bool IsActive { get; set; }

    public string? Notes { get; set; }

    public string CreatedBy { get; set; } = "SYSTEM";

    public DateTime CreatedDate { get; set; }

    public string? LastModifiedBy { get; set; }

    public DateTime? LastModifiedDate { get; set; }

    public virtual FieldAccessPolicy Policy { get; set; } = null!;
}
