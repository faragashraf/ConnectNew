using System;
using System.Collections.Generic;

namespace Models.Correspondance;

public partial class Area
{
    public string AreaId { get; set; } = null!;

    public string? AreaName { get; set; }

    public string? AreaCsUser { get; set; }

    public string? AreaDistributionUser { get; set; }
}
