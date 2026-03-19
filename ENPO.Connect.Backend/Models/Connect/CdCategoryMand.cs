using System;
using System.Collections.Generic;

namespace Models.Correspondance;

public partial class CdCategoryMand
{
    public int MendSql { get; set; }

    public int MendCategory { get; set; }

    public string MendField { get; set; } = null!;

    public bool MendStat { get; set; }

    public int MendGroup { get; set; }

    public virtual Cdcategory MendCategoryNavigation { get; set; } = null!;

    public virtual Cdmend MendFieldNavigation { get; set; } = null!;
}
