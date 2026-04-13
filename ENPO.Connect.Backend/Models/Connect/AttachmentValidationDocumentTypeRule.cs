using System;

namespace Models.Correspondance;

public partial class AttachmentValidationDocumentTypeRule
{
    public int Id { get; set; }

    public int DocumentTypeId { get; set; }

    public int RuleId { get; set; }

    public int RuleOrder { get; set; }

    public bool IsActive { get; set; }

    public bool IsRequired { get; set; }

    public bool StopOnFailure { get; set; }

    public string? FailureMessageAr { get; set; }

    public string? ParametersJson { get; set; }

    public string CreatedBy { get; set; } = "SYSTEM";

    public DateTime CreatedDate { get; set; }

    public string? LastModifiedBy { get; set; }

    public DateTime? LastModifiedDate { get; set; }

    public virtual AttachmentValidationDocumentType DocumentType { get; set; } = null!;

    public virtual AttachmentValidationRule Rule { get; set; } = null!;
}
