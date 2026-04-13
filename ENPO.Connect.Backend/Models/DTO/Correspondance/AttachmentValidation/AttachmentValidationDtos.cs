using Microsoft.AspNetCore.Http;

namespace Models.DTO.Correspondance.AttachmentValidation;

public sealed class AttachmentValidationWorkspaceDto
{
    public List<AttachmentValidationDocumentTypeDto> DocumentTypes { get; set; } = new();
    public List<AttachmentValidationRuleDto> Rules { get; set; } = new();
    public List<AttachmentValidationDocumentTypeRuleDto> DocumentTypeRules { get; set; } = new();
}

public sealed class AttachmentValidationDocumentTypeDto
{
    public int Id { get; set; }
    public string DocumentTypeCode { get; set; } = string.Empty;
    public string DocumentTypeNameAr { get; set; } = string.Empty;
    public string? DescriptionAr { get; set; }
    public string ValidationMode { get; set; } = "UploadOnly";
    public bool IsValidationRequired { get; set; }
    public bool IsActive { get; set; }
    public string CreatedBy { get; set; } = string.Empty;
    public DateTime CreatedDate { get; set; }
    public string? LastModifiedBy { get; set; }
    public DateTime? LastModifiedDate { get; set; }
}

public sealed class AttachmentValidationRuleDto
{
    public int Id { get; set; }
    public string RuleCode { get; set; } = string.Empty;
    public string RuleNameAr { get; set; } = string.Empty;
    public string? DescriptionAr { get; set; }
    public string? ParameterSchemaJson { get; set; }
    public bool IsSystemRule { get; set; }
    public bool IsActive { get; set; }
    public string CreatedBy { get; set; } = string.Empty;
    public DateTime CreatedDate { get; set; }
    public string? LastModifiedBy { get; set; }
    public DateTime? LastModifiedDate { get; set; }
}

public sealed class AttachmentValidationDocumentTypeRuleDto
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
    public string? DocumentTypeCode { get; set; }
    public string? DocumentTypeNameAr { get; set; }
    public string? RuleCode { get; set; }
    public string? RuleNameAr { get; set; }
    public string CreatedBy { get; set; } = string.Empty;
    public DateTime CreatedDate { get; set; }
    public string? LastModifiedBy { get; set; }
    public DateTime? LastModifiedDate { get; set; }
}

public sealed class AttachmentValidationDocumentTypeUpsertRequest
{
    public int Id { get; set; }
    public string DocumentTypeCode { get; set; } = string.Empty;
    public string DocumentTypeNameAr { get; set; } = string.Empty;
    public string? DescriptionAr { get; set; }
    public string ValidationMode { get; set; } = "UploadOnly";
    public bool IsValidationRequired { get; set; }
    public bool IsActive { get; set; } = true;
}

public sealed class AttachmentValidationRuleUpsertRequest
{
    public int Id { get; set; }
    public string RuleCode { get; set; } = string.Empty;
    public string RuleNameAr { get; set; } = string.Empty;
    public string? DescriptionAr { get; set; }
    public string? ParameterSchemaJson { get; set; }
    public bool IsSystemRule { get; set; } = true;
    public bool IsActive { get; set; } = true;
}

public sealed class AttachmentValidationDocumentTypeRuleUpsertRequest
{
    public int Id { get; set; }
    public int DocumentTypeId { get; set; }
    public int RuleId { get; set; }
    public int RuleOrder { get; set; } = 100;
    public bool IsActive { get; set; } = true;
    public bool IsRequired { get; set; } = true;
    public bool StopOnFailure { get; set; } = true;
    public string? FailureMessageAr { get; set; }
    public string? ParametersJson { get; set; }
}

public sealed class AttachmentValidationSettingsDto
{
    public int DocumentTypeId { get; set; }
    public string DocumentTypeCode { get; set; } = string.Empty;
    public string DocumentTypeNameAr { get; set; } = string.Empty;
    public string ValidationMode { get; set; } = "UploadOnly";
    public bool IsValidationRequired { get; set; }
    public List<AttachmentValidationResolvedRuleDto> Rules { get; set; } = new();
}

public sealed class AttachmentValidationResolvedRuleDto
{
    public int BindingId { get; set; }
    public int RuleId { get; set; }
    public string RuleCode { get; set; } = string.Empty;
    public string RuleNameAr { get; set; } = string.Empty;
    public int RuleOrder { get; set; }
    public bool IsRequired { get; set; }
    public bool StopOnFailure { get; set; }
    public string? FailureMessageAr { get; set; }
    public string? ParametersJson { get; set; }
}

public sealed class AttachmentValidationExecuteRequest
{
    public string DocumentTypeCode { get; set; } = string.Empty;
    public List<IFormFile>? files { get; set; } = new();
}

public sealed class AttachmentValidationExecutionResultDto
{
    public int DocumentTypeId { get; set; }
    public string DocumentTypeCode { get; set; } = string.Empty;
    public string DocumentTypeNameAr { get; set; } = string.Empty;
    public string ValidationMode { get; set; } = "UploadOnly";
    public bool IsValidationRequired { get; set; }
    public int FilesCount { get; set; }
    public bool IsValid { get; set; }
    public List<string> Errors { get; set; } = new();
    public List<string> Warnings { get; set; } = new();
    public List<AttachmentValidationRuleResultDto> RuleResults { get; set; } = new();
}

public sealed class AttachmentValidationRuleResultDto
{
    public int BindingId { get; set; }
    public int RuleId { get; set; }
    public string RuleCode { get; set; } = string.Empty;
    public string RuleNameAr { get; set; } = string.Empty;
    public bool IsRequired { get; set; }
    public bool Passed { get; set; }
    public string MessageAr { get; set; } = string.Empty;
}
