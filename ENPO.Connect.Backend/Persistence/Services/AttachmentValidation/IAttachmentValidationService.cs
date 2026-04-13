using Models.DTO.Common;
using Models.DTO.Correspondance.AttachmentValidation;

namespace Persistence.Services.AttachmentValidation;

public interface IAttachmentValidationService
{
    Task<CommonResponse<AttachmentValidationWorkspaceDto>> GetWorkspaceAsync(CancellationToken cancellationToken = default);

    Task<CommonResponse<AttachmentValidationDocumentTypeDto>> UpsertDocumentTypeAsync(
        AttachmentValidationDocumentTypeUpsertRequest request,
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<AttachmentValidationRuleDto>> UpsertRuleAsync(
        AttachmentValidationRuleUpsertRequest request,
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<AttachmentValidationDocumentTypeRuleDto>> UpsertDocumentTypeRuleAsync(
        AttachmentValidationDocumentTypeRuleUpsertRequest request,
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<bool>> DeactivateDocumentTypeAsync(int id, string userId, CancellationToken cancellationToken = default);

    Task<CommonResponse<bool>> DeactivateRuleAsync(int id, string userId, CancellationToken cancellationToken = default);

    Task<CommonResponse<bool>> DeactivateDocumentTypeRuleAsync(int id, string userId, CancellationToken cancellationToken = default);

    Task<CommonResponse<AttachmentValidationSettingsDto>> GetSettingsAsync(string documentTypeCode, CancellationToken cancellationToken = default);

    Task<CommonResponse<AttachmentValidationExecutionResultDto>> ValidateAsync(
        AttachmentValidationExecuteRequest request,
        string userId,
        CancellationToken cancellationToken = default);
}
