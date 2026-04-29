using System;

namespace Models.Correspondance;

public partial class NotificationRule
{
    public int Id { get; set; }

    public int SubjectTypeId { get; set; }

    public string EventType { get; set; } = null!;

    public string RecipientType { get; set; } = null!;

    public string RecipientValue { get; set; } = null!;

    public string Template { get; set; } = null!;

    public bool IsActive { get; set; }

    public string CreatedBy { get; set; } = null!;

    public DateTime CreatedAtUtc { get; set; }

    public string? LastModifiedBy { get; set; }

    public DateTime? LastModifiedAtUtc { get; set; }
}
