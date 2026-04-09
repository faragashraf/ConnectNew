using System;

namespace Models.Correspondance;

public partial class FieldAccessLock
{
    public int Id { get; set; }

    public int RequestTypeId { get; set; }

    public int? StageId { get; set; }

    public int? ActionId { get; set; }

    public string TargetLevel { get; set; } = "Field";

    public int TargetId { get; set; }

    public string LockMode { get; set; } = "NoEdit";

    public string? AllowedOverrideSubjectType { get; set; }

    public string? AllowedOverrideSubjectId { get; set; }

    public bool IsActive { get; set; }

    public string? Notes { get; set; }

    public string CreatedBy { get; set; } = "SYSTEM";

    public DateTime CreatedDate { get; set; }

    public string? LastModifiedBy { get; set; }

    public DateTime? LastModifiedDate { get; set; }
}
