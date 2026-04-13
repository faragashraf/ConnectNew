using System;
using System.Collections.Generic;

namespace Models.Correspondance;

public partial class AttachmentValidationDocumentType
{
    public int Id { get; set; }

    public string DocumentTypeCode { get; set; } = string.Empty;

    public string DocumentTypeNameAr { get; set; } = string.Empty;

    public string? DescriptionAr { get; set; }

    public string ValidationMode { get; set; } = "UploadOnly";

    public bool IsValidationRequired { get; set; }

    public bool IsActive { get; set; }

    public string CreatedBy { get; set; } = "SYSTEM";

    public DateTime CreatedDate { get; set; }

    public string? LastModifiedBy { get; set; }

    public DateTime? LastModifiedDate { get; set; }

    public virtual ICollection<AttachmentValidationDocumentTypeRule> Rules { get; set; } = new List<AttachmentValidationDocumentTypeRule>();
}
