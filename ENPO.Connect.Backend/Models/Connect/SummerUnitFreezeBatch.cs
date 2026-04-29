namespace Models.Correspondance;

public partial class SummerUnitFreezeBatch
{
    public int FreezeId { get; set; }

    public int CategoryId { get; set; }

    public string WaveCode { get; set; } = string.Empty;

    public int FamilyCount { get; set; }

    public int RequestedUnitsCount { get; set; }

    public string FreezeType { get; set; } = "GENERAL";

    public string? Reason { get; set; }

    public string? Notes { get; set; }

    public string CreatedBy { get; set; } = string.Empty;

    public DateTime CreatedAtUtc { get; set; }

    public bool IsActive { get; set; }

    public DateTime? ReleasedAtUtc { get; set; }

    public string? ReleasedBy { get; set; }

    public virtual ICollection<SummerUnitFreezeDetail> Details { get; set; } = new List<SummerUnitFreezeDetail>();
}
