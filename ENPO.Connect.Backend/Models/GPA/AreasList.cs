using System;
using System.Collections.Generic;

namespace Models.GPA;

public partial class AreasList
{
    public string AreaId { get; set; } = null!;

    public string? AreaAName { get; set; }

    public string? AreaEName { get; set; }

    public DateTime? LastModifiedDate { get; set; }

    public string? DefaultTc { get; set; }

    public int? DefaultTcIntId { get; set; }

    public string? BarcodeUnitId { get; set; }

    public decimal? InvalidOffline { get; set; }
}
