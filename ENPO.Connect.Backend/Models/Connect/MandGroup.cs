using System;
using System.Collections.Generic;

namespace Models.Correspondance;

public partial class MandGroup
{
    public int GroupId { get; set; }

    public string? GroupName { get; set; }

    public string? GroupDescription { get; set; }
    
    public bool? IsExtendable { get; set; }

    public Int16? GroupWithInRow { get; set; }
}
