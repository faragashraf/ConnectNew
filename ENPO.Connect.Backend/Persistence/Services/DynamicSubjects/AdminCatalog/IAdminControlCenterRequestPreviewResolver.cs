using Models.DTO.Common;
using Models.DTO.DynamicSubjects;

namespace Persistence.Services.DynamicSubjects.AdminCatalog;

public interface IAdminControlCenterRequestPreviewResolver
{
    Task<CommonResponse<AdminControlCenterRequestPreviewDto>> ResolveAsync(
        int requestTypeId,
        string userId,
        CancellationToken cancellationToken = default);
}
