using System;
using System.Collections.Generic;

namespace Models.Models;

public partial class VwOrgUnitsWithCount
{
    public decimal UnitId { get; set; }

    public string UnitName { get; set; }

    public string TypeName { get; set; } = null!;

    public string? LeaderTitle { get; set; }

    public bool? IsSingleOccupancy { get; set; }

    public decimal? ParentId { get; set; }

    public bool? Status { get; set; }

    public DateTime? CreatedDate { get; set; }

    public string? CreatedBy { get; set; }

    public decimal? OccupancyCount { get; set; }

    public decimal? ParentTypeId { get; set; }

    public string? ParentTypeName { get; set; }

    public string? ParentUnitName { get; set; }
}
