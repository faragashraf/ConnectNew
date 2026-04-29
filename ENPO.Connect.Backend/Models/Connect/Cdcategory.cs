using System;
using System.Collections.Generic;

namespace Models.Correspondance;

public partial class Cdcategory
{
    public int CatId { get; set; }

    public int CatParent { get; set; }

    public string CatName { get; set; } = null!;

    public bool CatStatus { get; set; }

    public string? CatMend { get; set; }

    public int CatWorkFlow { get; set; }

    public bool CatSms { get; set; }

    public bool CatMailNotification { get; set; }

    public string? To { get; set; }

    public string? Cc { get; set; }

    public DateTime StampDate { get; set; }

    public int? CatCreatedBy { get; set; }
    public string? ApplicationId { get; set; }
    public int? Stockholder { get; set; }
    public string? CatInterval { get; set; }
    public int? CatIntervalCount { get; set; }
    public virtual ICollection<Application> Application { get; set; } = null!;
    public virtual ICollection<CdCategoryMand> CdCategoryMands { get; set; } = new List<CdCategoryMand>();
    public virtual ICollection<AdminCatalogCategoryGroup> AdminCatalogCategoryGroups { get; set; } = new List<AdminCatalogCategoryGroup>();

}
