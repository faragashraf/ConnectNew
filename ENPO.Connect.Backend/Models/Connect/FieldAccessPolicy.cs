using System;
using System.Collections.Generic;

namespace Models.Correspondance;

public partial class FieldAccessPolicy
{
    public int Id { get; set; }

    public int RequestTypeId { get; set; }

    public string Name { get; set; } = string.Empty;

    public bool IsActive { get; set; }

    public string DefaultAccessMode { get; set; } = "Editable";

    public string CreatedBy { get; set; } = "SYSTEM";

    public DateTime CreatedDate { get; set; }

    public string? LastModifiedBy { get; set; }

    public DateTime? LastModifiedDate { get; set; }

    public virtual ICollection<FieldAccessPolicyRule> Rules { get; set; } = new List<FieldAccessPolicyRule>();
}
