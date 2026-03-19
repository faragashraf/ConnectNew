
namespace Models.Correspondance;

public partial class CdholDay
{
    public DateTime Hdate { get; set; }

    public string Hday { get; set; } = null!;

    public short HdayW { get; set; }

    public string? Hdetails { get; set; }

    public short Hdy { get; set; }

    public bool Hconfrm { get; set; }
}
