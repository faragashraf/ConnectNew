using System;

namespace Models.Correspondance;

public partial class SubjectEnvelopeLink
{
    public int EnvelopeLinkId { get; set; }

    public int EnvelopeId { get; set; }

    public int MessageId { get; set; }

    public string LinkedBy { get; set; } = null!;

    public DateTime LinkedAtUtc { get; set; }

    public virtual SubjectEnvelope Envelope { get; set; } = null!;
}
