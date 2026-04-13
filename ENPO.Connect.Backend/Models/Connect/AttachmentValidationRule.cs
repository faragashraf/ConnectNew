using System;
using System.Collections.Generic;

namespace Models.Correspondance;

public partial class AttachmentValidationRule
{
    public int Id { get; set; }

    public string RuleCode { get; set; } = string.Empty;

    public string RuleNameAr { get; set; } = string.Empty;

    public string? DescriptionAr { get; set; }

    public string? ParameterSchemaJson { get; set; }

    public bool IsSystemRule { get; set; }

    public bool IsActive { get; set; }

    public string CreatedBy { get; set; } = "SYSTEM";

    public DateTime CreatedDate { get; set; }

    public string? LastModifiedBy { get; set; }

    public DateTime? LastModifiedDate { get; set; }

    public virtual ICollection<AttachmentValidationDocumentTypeRule> DocumentTypeRules { get; set; } = new List<AttachmentValidationDocumentTypeRule>();
}
