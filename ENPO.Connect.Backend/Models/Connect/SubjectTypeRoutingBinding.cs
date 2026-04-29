using System;

namespace Models.Correspondance;

public partial class SubjectTypeRoutingBinding
{
    public int Id { get; set; }

    public int SubjectTypeId { get; set; }

    public int RoutingProfileId { get; set; }

    public bool IsDefault { get; set; }

    public bool AppliesToInbound { get; set; }

    public bool AppliesToOutbound { get; set; }

    public bool IsActive { get; set; }

    public string CreatedBy { get; set; } = "SYSTEM";

    public DateTime CreatedDate { get; set; }

    public string? LastModifiedBy { get; set; }

    public DateTime? LastModifiedDate { get; set; }

    public virtual SubjectRoutingProfile RoutingProfile { get; set; } = null!;
}
