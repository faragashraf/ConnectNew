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

    Task<CommonResponse<AdminCatalogApplicationDeleteDiagnosticsDto>> DiagnoseApplicationDeleteAsync(
        string applicationId,
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<AdminCatalogDeleteResultDto>> DeleteApplicationAsync(
        string applicationId,
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

    Task<CommonResponse<AdminCatalogCategoryDeleteDiagnosticsDto>> DiagnoseCategoryDeleteAsync(
        int categoryId,
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<AdminCatalogDeleteResultDto>> DeleteCategoryAsync(
        int categoryId,
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<IEnumerable<AdminCatalogGroupTreeNodeDto>>> GetGroupsByCategoryAsync(
        int categoryId,
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<AdminCatalogGroupDto>> CreateGroupAsync(
        AdminCatalogGroupCreateRequestDto request,
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<AdminCatalogGroupDto>> UpdateGroupAsync(
        int groupId,
        AdminCatalogGroupUpdateRequestDto request,
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<AdminCatalogDeleteResultDto>> DeleteGroupAsync(
        int groupId,
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<AdminCatalogFieldLookupsDto>> GetFieldLookupsAsync(
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<IEnumerable<AdminCatalogFieldListItemDto>>> GetFieldsAsync(
        string userId,
        string? appId,
        string? search,
        string? status,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<AdminCatalogFieldDto>> GetFieldAsync(
        string applicationId,
        string fieldKey,
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<AdminCatalogFieldDto>> CreateFieldAsync(
        AdminCatalogFieldCreateRequestDto request,
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<AdminCatalogFieldDto>> UpdateFieldAsync(
        string applicationId,
        string fieldKey,
        AdminCatalogFieldUpdateRequestDto request,
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<AdminCatalogFieldDeleteDiagnosticsDto>> DiagnoseFieldDeleteAsync(
        string applicationId,
        string fieldKey,
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<AdminCatalogDeleteResultDto>> DeleteFieldAsync(
        string applicationId,
        string fieldKey,
        string userId,
        CancellationToken cancellationToken = default);
}
