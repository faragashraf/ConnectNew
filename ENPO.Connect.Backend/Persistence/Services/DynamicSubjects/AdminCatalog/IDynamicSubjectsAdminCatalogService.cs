using Models.DTO.Common;
using Models.DTO.DynamicSubjects;

namespace Persistence.Services.DynamicSubjects.AdminCatalog;

public interface IDynamicSubjectsAdminCatalogService
{
    Task<CommonResponse<IEnumerable<AdminCatalogApplicationDto>>> GetApplicationsAsync(
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<AdminCatalogApplicationDto>> CreateApplicationAsync(
        AdminCatalogApplicationCreateRequestDto request,
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<AdminCatalogApplicationDto>> UpdateApplicationAsync(
        string applicationId,
        AdminCatalogApplicationUpdateRequestDto request,
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<IEnumerable<AdminCatalogCategoryTreeNodeDto>>> GetCategoryTreeAsync(
        string userId,
        string? appId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<AdminCatalogCategoryDto>> CreateCategoryAsync(
        AdminCatalogCategoryCreateRequestDto request,
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<AdminCatalogCategoryDto>> UpdateCategoryAsync(
        int categoryId,
        AdminCatalogCategoryUpdateRequestDto request,
        string userId,
        CancellationToken cancellationToken = default);
}
