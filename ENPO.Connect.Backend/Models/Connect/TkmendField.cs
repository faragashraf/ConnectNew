using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations.Schema;

namespace Models.Correspondance;

public class TkmendField
{
    public int FildSql { get; set; }

    public int FildRelted { get; set; }

    public string? FildKind { get; set; }

    public string? FildTxt { get; set; }

    public int? InstanceGroupId { get; set; } = 1;

    // Non-persisted metadata from CdCategoryMand (populated at query time)
    [NotMapped]
    public int? MendSql { get; set; }

    [NotMapped]
    public int? MendCategory { get; set; }

    [NotMapped]
    public bool? MendStat { get; set; }

    [NotMapped]
    public int? MendGroup { get; set; }

    [NotMapped]
    public string? ApplicationId { get; set; }

    [NotMapped]
    public string? GroupName { get; set; }

    [NotMapped]
    public bool? IsExtendable { get; set; }

    [NotMapped]
    public int? GroupWithInRow { get; set; }

    //public virtual Cdmend? FildKindNavigation { get; set; }
}
