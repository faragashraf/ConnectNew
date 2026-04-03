using System;

namespace Models.Correspondance;

public partial class SubjectTimelineEvent
{
    public long TimelineEventId { get; set; }

    public int MessageId { get; set; }

    public string EventType { get; set; } = null!;

    public string EventTitle { get; set; } = null!;

    public string? EventPayloadJson { get; set; }

    public byte? StatusFrom { get; set; }

    public byte? StatusTo { get; set; }

    public string CreatedBy { get; set; } = null!;

    public DateTime CreatedAtUtc { get; set; }
}
