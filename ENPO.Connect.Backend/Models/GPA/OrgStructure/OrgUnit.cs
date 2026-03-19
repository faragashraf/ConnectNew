using System;
using System.Collections.Generic;

namespace Models.GPA.OrgStructure;

public partial class OrgUnit
{
    public decimal UnitId { get; set; }

    public string UnitName { get; set; } = null!;

    public decimal UnitTypeId { get; set; }

    public decimal? ParentId { get; set; }

    public bool? Status { get; set; }

    public DateTime? CreatedDate { get; set; }

    public string? CreatedBy { get; set; }

    public virtual OrgUnitType UnitType { get; set; } = null!;

    public virtual ICollection<UserPosition> UserPositions { get; set; } = new List<UserPosition>();
}
