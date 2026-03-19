using System;
using System.Collections.Generic;

namespace Models.Correspondance;

public partial class Cdevent
{
    public short EvId { get; set; }

    public string EvNm { get; set; } = null!;

    public bool EvSusp { get; set; }

    public DateTime EvStime { get; set; }

    public bool EvBkOfic { get; set; }

    //public virtual ICollection<TkEvent> TkEvents { get; set; } = new List<TkEvent>();
}
