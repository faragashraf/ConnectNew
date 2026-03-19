using Models.Correspondance;
using System;
using System.Collections.Generic;

namespace Models.DTO.Correspondance;

public class CdCategoryMandDto
{
    public int MendSql { get; set; }

    public int MendCategory { get; set; }

    public string MendField { get; set; } = null!;

    public bool MendStat { get; set; }

    public int MendGroup { get; set; }

    public string? ApplicationId { get; set; }

    public string? GroupName { get; set; }
    
    public bool? IsExtendable { get; set; }
    
    public Int16? GroupWithInRow { get; set; }

}

public class CdmendDto
{
    public int CdmendSql { get; set; }

    public string CdmendType { get; set; } = null!;

    public string CdmendTxt { get; set; } = null!;

    public string? CDMendLbl { get; set; } = null!;
    
    public string? Placeholder { get; set; } = null!;
    
    public string? DefaultValue { get; set; } = null!;

    public string? CdmendTbl { get; set; }

    public string? CdmendDatatype { get; set; }

    public bool? Required { get; set; }

    public bool? RequiredTrue { get; set; }

    public bool? Email { get; set; }

    public bool? Pattern { get; set; }

    public short? Min { get; set; }

    public short? Max { get; set; }

    public short? MinxLenght { get; set; }

    public short? MaxLenght { get; set; }

    public string? MinValue { get; set; }

    public string? MaxValue { get; set; }
    public string? Cdmendmask { get; set; }

    public bool CdmendStat { get; set; }

    public int Width { get; set; }
    
    public int Height { get; set; }

    public bool IsDisabledInit { get; set; }
    public bool IsSearchable { get; set; }
    public string? ApplicationId { get; set; }
}