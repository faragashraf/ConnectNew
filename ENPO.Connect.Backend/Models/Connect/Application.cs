using System;
using System.Collections.Generic;

namespace Models.Correspondance;

public partial class Application
{
    public string ApplicationId { get; set; } = null!;

    public string ApplicationName { get; set; } = null!;

    public DateTime StampDate { get; set; }

    public bool? IsActive { get; set; }

    public virtual ICollection<Cdcategory> Cdcategories { get; set; } = new List<Cdcategory>();

    public virtual ICollection<Cdmend> Cdmends { get; set; } = new List<Cdmend>();
}
