using System;

namespace Models.Correspondance;

public partial class SubjectCategoryFieldSetting
{
    public int MendSql { get; set; }

    public int DisplayOrder { get; set; }

    public bool IsVisible { get; set; }

    public string? DisplaySettingsJson { get; set; }

    public string LastModifiedBy { get; set; } = string.Empty;

    public DateTime LastModifiedAtUtc { get; set; }
}
