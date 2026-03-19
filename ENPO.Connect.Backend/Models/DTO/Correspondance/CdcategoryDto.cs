using System;
using System.Collections.Generic;

namespace Models.DTO.Correspondance;

public class CdcategoryDto
{
    public int CatId { get; set; }

    public int CatParent { get; set; }

    public string CatName { get; set; } = null!;

    public string? CatMend { get; set; }

    public int CatWorkFlow { get; set; }

    public bool CatSms { get; set; }

    public bool CatMailNotification { get; set; }

    public string? To { get; set; }

    public string? Cc { get; set; }

    public string? ApplicationId { get; set; } = null!;

}
