using System;
using System.Collections.Generic;

namespace Models.Correspondance;

public partial class Cdmend
{
    public int CdmendSql { get; set; }

    public string CdmendType { get; set; } = null!;

    public string CdmendTxt { get; set; } = null!;
    
    public string CDMendLbl { get; set; } = null!;

    public string? Placeholder { get; set; } = null!;

    public string? DefaultValue { get; set; } = null!;

    public string? CdmendTbl { get; set; }

    public string? CdmendDatatype { get; set; }

    public bool? Required { get; set; }

    public bool? RequiredTrue { get; set; }

    public bool? Email { get; set; }

    public bool? Pattern { get; set; }

    public string? MinValue { get; set; }

    public string? MaxValue { get; set; }

    //public short? MinxLenght { get; set; }

    //public short? MaxLenght { get; set; }

    public string? Cdmendmask { get; set; }

    public bool CdmendStat { get; set; }

    public int Width { get; set; }

    public int Height { get; set; }

    public bool IsDisabledInit { get; set; }
    public bool IsSearchable { get; set; }
    public string? ApplicationId { get; set; }
    public virtual ICollection<CdCategoryMand> CdCategoryMands { get; set; } = new List<CdCategoryMand>();
    //public virtual Application? Application { get; set; }
    // public virtual ICollection<TkmendField> TkmendFields { get; set; } = new List<TkmendField>();
}
