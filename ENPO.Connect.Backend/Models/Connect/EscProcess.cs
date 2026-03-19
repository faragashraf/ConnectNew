using System;
using System.Collections.Generic;

namespace Models.Correspondance;

public partial class EscProcess
{
    public int EscSql { get; set; }

    public short EscId { get; set; }

    public string? EscCc { get; set; }

    public short EscDur { get; set; }

    public int EscUcatLvl { get; set; }
}
