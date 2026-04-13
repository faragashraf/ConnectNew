using Microsoft.AspNetCore.Mvc;
using Models.DTO.Common;
using Models.DTO.Correspondance.AttachmentValidation;
using Persistence.Services.AttachmentValidation;

namespace Api.Controllers;

[Route("api/[controller]")]
[ApiController]
public class AttachmentValidationController : ControllerBase
{
    private readonly IAttachmentValidationService _attachmentValidationService;

    public AttachmentValidationController(IAttachmentValidationService attachmentValidationService)
    {
        _attachmentValidationService = attachmentValidationService;
    }

    [HttpGet("Admin/Workspace")]
    public Task<CommonResponse<AttachmentValidationWorkspaceDto>> GetAdminWorkspace(CancellationToken cancellationToken = default)
    {
        return _attachmentValidationService.GetWorkspaceAsync(cancellationToken);
    }

    [HttpPost("Admin/DocumentTypes/Upsert")]
    public Task<CommonResponse<AttachmentValidationDocumentTypeDto>> UpsertDocumentType(
        [FromBody] AttachmentValidationDocumentTypeUpsertRequest request,
        CancellationToken cancellationToken = default)
    {
        return _attachmentValidationService.UpsertDocumentTypeAsync(request, GetCurrentUserId(), cancellationToken);
    }

    [HttpPost("Admin/Rules/Upsert")]
    public Task<CommonResponse<AttachmentValidationRuleDto>> UpsertRule(
        [FromBody] AttachmentValidationRuleUpsertRequest request,
        CancellationToken cancellationToken = default)
    {
        return _attachmentValidationService.UpsertRuleAsync(request, GetCurrentUserId(), cancellationToken);
    }

    [HttpPost("Admin/DocumentTypeRules/Upsert")]
    public Task<CommonResponse<AttachmentValidationDocumentTypeRuleDto>> UpsertDocumentTypeRule(
        [FromBody] AttachmentValidationDocumentTypeRuleUpsertRequest request,
        CancellationToken cancellationToken = default)
    {
        return _attachmentValidationService.UpsertDocumentTypeRuleAsync(request, GetCurrentUserId(), cancellationToken);
    }

    [HttpPost("Admin/DocumentTypes/{id:int}/Deactivate")]
    public Task<CommonResponse<bool>> DeactivateDocumentType(int id, CancellationToken cancellationToken = default)
    {
        return _attachmentValidationService.DeactivateDocumentTypeAsync(id, GetCurrentUserId(), cancellationToken);
    }

    [HttpPost("Admin/Rules/{id:int}/Deactivate")]
    public Task<CommonResponse<bool>> DeactivateRule(int id, CancellationToken cancellationToken = default)
    {
        return _attachmentValidationService.DeactivateRuleAsync(id, GetCurrentUserId(), cancellationToken);
    }

    [HttpPost("Admin/DocumentTypeRules/{id:int}/Deactivate")]
    public Task<CommonResponse<bool>> DeactivateDocumentTypeRule(int id, CancellationToken cancellationToken = default)
    {
        return _attachmentValidationService.DeactivateDocumentTypeRuleAsync(id, GetCurrentUserId(), cancellationToken);
    }

    [HttpGet("Settings/{documentTypeCode}")]
    public Task<CommonResponse<AttachmentValidationSettingsDto>> GetSettings(
        string documentTypeCode,
        CancellationToken cancellationToken = default)
    {
        return _attachmentValidationService.GetSettingsAsync(documentTypeCode, cancellationToken);
    }

    [HttpPost("Validate")]
    [Consumes("multipart/form-data")]
    public Task<CommonResponse<AttachmentValidationExecutionResultDto>> Validate(
        [FromForm] AttachmentValidationExecuteRequest request,
        CancellationToken cancellationToken = default)
    {
        return _attachmentValidationService.ValidateAsync(request, GetCurrentUserId(), cancellationToken);
    }

    private string GetCurrentUserId()
    {
        return HttpContext.User.Claims.FirstOrDefault(claim => claim.Type == "UserId")?.Value ?? string.Empty;
    }
}
