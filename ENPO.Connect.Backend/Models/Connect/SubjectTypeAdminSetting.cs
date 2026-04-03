using System;

namespace Models.Correspondance;

public partial class SubjectTypeAdminSetting
{
    public int CategoryId { get; set; }

    public int DisplayOrder { get; set; }

    public string? SettingsJson { get; set; }

    public string LastModifiedBy { get; set; } = string.Empty;

    public DateTime LastModifiedAtUtc { get; set; }
}
