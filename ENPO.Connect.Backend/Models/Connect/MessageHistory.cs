using System;
using System.Collections.Generic;

namespace Models.Correspondance;

public partial class MessageHistory
{
    public int HistoryId { get; set; }

    public int MessageId { get; set; }

    public string FieldChanged { get; set; } = null!;

    public string? OldValue { get; set; }

    public string? NewValue { get; set; }

    public string ChangedBy { get; set; } = null!;

    public DateTime ChangeDate { get; set; }
}
