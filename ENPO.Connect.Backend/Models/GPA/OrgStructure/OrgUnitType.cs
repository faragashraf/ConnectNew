using System;
using System.Collections.Generic;

namespace Models.GPA.OrgStructure;

public partial class OrgUnitType
{
    public decimal UnitTypeId { get; set; }

    public string TypeName { get; set; } = null!;

    public string? LeaderTitle { get; set; }

    public bool? IsSingleOccupancy { get; set; }

    public bool? Status { get; set; }

    public DateTime? CreatedDate { get; set; }

    public string? CreatedBy { get; set; }

    public virtual ICollection<OrgUnit> OrgUnits { get; set; } = new List<OrgUnit>();
}
