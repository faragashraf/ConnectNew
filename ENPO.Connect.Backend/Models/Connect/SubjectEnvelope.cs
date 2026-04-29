using System;
using System.Collections.Generic;

namespace Models.Correspondance;

public partial class SubjectEnvelope
{
    public int EnvelopeId { get; set; }

    public string EnvelopeRef { get; set; } = null!;

    public DateTime IncomingDate { get; set; }

    public string? SourceEntity { get; set; }

    public string? DeliveryDelegate { get; set; }

    public string? Notes { get; set; }

    public string CreatedBy { get; set; } = null!;

    public DateTime CreatedAtUtc { get; set; }

    public string? LastModifiedBy { get; set; }

    public DateTime? LastModifiedAtUtc { get; set; }

    public virtual ICollection<SubjectEnvelopeLink> LinkedSubjects { get; set; } = new List<SubjectEnvelopeLink>();
}
