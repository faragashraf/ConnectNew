using System;
using System.Collections.Generic;

namespace Models.GPA;

public partial class PosUserTeam
{
    public string UserId { get; set; } = null!;

    public decimal TeamId { get; set; }

    public decimal? IsActive { get; set; }
}
