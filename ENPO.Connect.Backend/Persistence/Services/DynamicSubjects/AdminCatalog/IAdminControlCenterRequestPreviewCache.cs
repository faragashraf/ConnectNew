using Models.DTO.Common;
using Models.DTO.DynamicSubjects;

namespace Persistence.Services.DynamicSubjects.AdminCatalog;

public interface IAdminControlCenterRequestPreviewCache
{
    Task<CommonResponse<AdminControlCenterRequestPreviewDto>?> TryGetAsync(
        int requestTypeId,
        string userId,
        CancellationToken cancellationToken = default);

    Task SetAsync(
        int requestTypeId,
        string userId,
        CommonResponse<AdminControlCenterRequestPreviewDto> value,
        TimeSpan ttl,
        CancellationToken cancellationToken = default);

    Task InvalidateAllAsync(CancellationToken cancellationToken = default);
}
