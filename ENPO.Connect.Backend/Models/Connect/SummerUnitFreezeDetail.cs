namespace Models.Correspondance;

public partial class SummerUnitFreezeDetail
{
    public int FreezeDetailId { get; set; }

    public int FreezeId { get; set; }

    public int SlotNumber { get; set; }

    public string Status { get; set; } = string.Empty;

    public int? AssignedMessageId { get; set; }

    public DateTime? AssignedAtUtc { get; set; }

    public DateTime? ReleasedAtUtc { get; set; }

    public string? ReleasedBy { get; set; }

    public DateTime LastStatusChangedAtUtc { get; set; }

    public virtual SummerUnitFreezeBatch Freeze { get; set; } = null!;
}
