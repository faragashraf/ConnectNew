using System;
using System.Collections.Generic;

namespace Models.Correspondance;

public partial class AdminCatalogCategoryGroup
{
    public int GroupId { get; set; }

    public int CategoryId { get; set; }

    public string ApplicationId { get; set; } = string.Empty;

    public string GroupName { get; set; } = string.Empty;

    public string? GroupDescription { get; set; }

    public int? ParentGroupId { get; set; }

    public int DisplayOrder { get; set; }

    public bool IsActive { get; set; }

    public DateTime StampDate { get; set; }

    public int? CreatedBy { get; set; }

    public virtual Cdcategory Category { get; set; } = null!;

    public virtual AdminCatalogCategoryGroup? ParentGroup { get; set; }

    public virtual ICollection<AdminCatalogCategoryGroup> Children { get; set; }
        = new List<AdminCatalogCategoryGroup>();
}
