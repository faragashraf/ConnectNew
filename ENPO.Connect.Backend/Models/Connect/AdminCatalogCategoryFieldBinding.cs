namespace Models.Correspondance;

public partial class AdminCatalogCategoryFieldBinding
{
    public int MendSql { get; set; }

    public int CategoryId { get; set; }

    public string MendField { get; set; } = string.Empty;

    public bool MendStat { get; set; }

    public int GroupId { get; set; }
}
