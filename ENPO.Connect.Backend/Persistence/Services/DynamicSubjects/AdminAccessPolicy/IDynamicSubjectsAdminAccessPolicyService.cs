using Models.DTO.Common;
using Models.DTO.DynamicSubjects;

namespace Persistence.Services.DynamicSubjects.AdminAccessPolicy;

public interface IDynamicSubjectsAdminAccessPolicyService
{
    Task<CommonResponse<FieldAccessPolicyWorkspaceDto>> GetWorkspaceAsync(
        int requestTypeId,
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<FieldAccessPolicyWorkspaceDto>> UpsertWorkspaceAsync(
        int requestTypeId,
        FieldAccessPolicyWorkspaceUpsertRequestDto request,
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<FieldAccessPreviewResponseDto>> PreviewAsync(
        int requestTypeId,
        FieldAccessPreviewRequestDto request,
        string userId,
        CancellationToken cancellationToken = default);
}
