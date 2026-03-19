using System;
using System.Collections.Generic;

namespace Models.GPA;

public partial class EnpoTeamStructure
{
    public int? Id { get; set; }

    public string? NameAr { get; set; }

    public int? ParentId { get; set; }

    public bool? IsSinglePosition { get; set; }
}
