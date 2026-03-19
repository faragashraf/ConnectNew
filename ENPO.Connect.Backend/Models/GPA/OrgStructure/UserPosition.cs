using System;
using System.Collections.Generic;

namespace Models.GPA.OrgStructure;

public partial class UserPosition
{
    public decimal PositionId { get; set; }

    public string UserId { get; set; } = null!;

    public decimal UnitId { get; set; }

    public DateTime? StartDate { get; set; }

    public DateTime? EndDate { get; set; }

    public bool? IsActive { get; set; }

    public bool? IsManager { get; set; }

    public virtual OrgUnit Unit { get; set; } = null!;
}
