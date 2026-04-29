using Api.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Models.DTO.Common;
using Models.DTO.DynamicSubjects;
using Persistence.Services.DynamicSubjects.AdminCatalog;

namespace Api.Controllers;

[Route("api/[controller]")]
[ApiController]
[Authorize(Policy = DynamicSubjectsAdminAuthorization.PolicyName)]
public class DynamicSubjectsAdminCatalogController : ControllerBase
{
    private readonly IDynamicSubjectsAdminCatalogService _adminCatalogService;

    public DynamicSubjectsAdminCatalogController(IDynamicSubjectsAdminCatalogService adminCatalogService)
    {
        _adminCatalogService = adminCatalogService;
    }

    [HttpGet("Applications")]
    public Task<CommonResponse<IEnumerable<AdminCatalogApplicationDto>>> GetApplications(
        CancellationToken cancellationToken = default)
    {
        return _adminCatalogService.GetApplicationsAsync(GetCurrentUserId(), cancellationToken);
    }

    [HttpPost("Applications")]
    public Task<CommonResponse<AdminCatalogApplicationDto>> CreateApplication(
        [FromBody] AdminCatalogApplicationCreateRequestDto request,
        CancellationToken cancellationToken = default)
    {
        return _adminCatalogService.CreateApplicationAsync(request, GetCurrentUserId(), cancellationToken);
    }

    [HttpPut("Applications/{applicationId}")]
    public Task<CommonResponse<AdminCatalogApplicationDto>> UpdateApplication(
        string applicationId,
        [FromBody] AdminCatalogApplicationUpdateRequestDto request,
        CancellationToken cancellationToken = default)
    {
        return _adminCatalogService.UpdateApplicationAsync(applicationId, request, GetCurrentUserId(), cancellationToken);
    }

    [HttpGet("Applications/{applicationId}/DeleteDiagnostics")]
    public Task<CommonResponse<AdminCatalogApplicationDeleteDiagnosticsDto>> DiagnoseApplicationDelete(
        string applicationId,
        CancellationToken cancellationToken = default)
    {
        return _adminCatalogService.DiagnoseApplicationDeleteAsync(applicationId, GetCurrentUserId(), cancellationToken);
    }

    [HttpDelete("Applications/{applicationId}")]
    public Task<CommonResponse<AdminCatalogDeleteResultDto>> DeleteApplication(
        string applicationId,
        CancellationToken cancellationToken = default)
    {
        return _adminCatalogService.DeleteApplicationAsync(applicationId, GetCurrentUserId(), cancellationToken);
    }

    [HttpGet("CategoryTree")]
    public Task<CommonResponse<IEnumerable<AdminCatalogCategoryTreeNodeDto>>> GetCategoryTree(
        string? appId,
        CancellationToken cancellationToken = default)
    {
        return _adminCatalogService.GetCategoryTreeAsync(GetCurrentUserId(), appId, cancellationToken);
    }

    [HttpPost("Categories")]
    public Task<CommonResponse<AdminCatalogCategoryDto>> CreateCategory(
        [FromBody] AdminCatalogCategoryCreateRequestDto request,
        CancellationToken cancellationToken = default)
    {
        return _adminCatalogService.CreateCategoryAsync(request, GetCurrentUserId(), cancellationToken);
    }

    [HttpPut("Categories/{categoryId:int}")]
    public Task<CommonResponse<AdminCatalogCategoryDto>> UpdateCategory(
        int categoryId,
        [FromBody] AdminCatalogCategoryUpdateRequestDto request,
        CancellationToken cancellationToken = default)
    {
        return _adminCatalogService.UpdateCategoryAsync(categoryId, request, GetCurrentUserId(), cancellationToken);
    }

    [HttpGet("Categories/{categoryId:int}/DisplaySettings")]
    public Task<CommonResponse<AdminCatalogCategoryDisplaySettingsDto>> GetCategoryDisplaySettings(
        int categoryId,
        CancellationToken cancellationToken = default)
    {
        return _adminCatalogService.GetCategoryDisplaySettingsAsync(categoryId, GetCurrentUserId(), cancellationToken);
    }

    [HttpPut("Categories/{categoryId:int}/DisplaySettings")]
    public Task<CommonResponse<AdminCatalogCategoryDisplaySettingsDto>> UpsertCategoryDisplaySettings(
        int categoryId,
        [FromBody] AdminCatalogCategoryDisplaySettingsUpsertRequestDto request,
        CancellationToken cancellationToken = default)
    {
        return _adminCatalogService.UpsertCategoryDisplaySettingsAsync(categoryId, request, GetCurrentUserId(), cancellationToken);
    }

    [HttpGet("Categories/{categoryId:int}/DeleteDiagnostics")]
    public Task<CommonResponse<AdminCatalogCategoryDeleteDiagnosticsDto>> DiagnoseCategoryDelete(
        int categoryId,
        CancellationToken cancellationToken = default)
    {
        return _adminCatalogService.DiagnoseCategoryDeleteAsync(categoryId, GetCurrentUserId(), cancellationToken);
    }

    [HttpDelete("Categories/{categoryId:int}")]
    public Task<CommonResponse<AdminCatalogDeleteResultDto>> DeleteCategory(
        int categoryId,
        CancellationToken cancellationToken = default)
    {
        return _adminCatalogService.DeleteCategoryAsync(categoryId, GetCurrentUserId(), cancellationToken);
    }

    [HttpGet("Categories/{categoryId:int}/Groups")]
    public Task<CommonResponse<IEnumerable<AdminCatalogGroupTreeNodeDto>>> GetGroupsByCategory(
        int categoryId,
        CancellationToken cancellationToken = default)
    {
        return _adminCatalogService.GetGroupsByCategoryAsync(categoryId, GetCurrentUserId(), cancellationToken);
    }

    [HttpPost("Groups")]
    public Task<CommonResponse<AdminCatalogGroupDto>> CreateGroup(
        [FromBody] AdminCatalogGroupCreateRequestDto request,
        CancellationToken cancellationToken = default)
    {
        return _adminCatalogService.CreateGroupAsync(request, GetCurrentUserId(), cancellationToken);
    }

    [HttpPut("Groups/{groupId:int}")]
    public Task<CommonResponse<AdminCatalogGroupDto>> UpdateGroup(
        int groupId,
        [FromBody] AdminCatalogGroupUpdateRequestDto request,
        CancellationToken cancellationToken = default)
    {
        return _adminCatalogService.UpdateGroupAsync(groupId, request, GetCurrentUserId(), cancellationToken);
    }

    [HttpDelete("Groups/{groupId:int}")]
    public Task<CommonResponse<AdminCatalogDeleteResultDto>> DeleteGroup(
        int groupId,
        CancellationToken cancellationToken = default)
    {
        return _adminCatalogService.DeleteGroupAsync(groupId, GetCurrentUserId(), cancellationToken);
    }

    [HttpGet("FieldLibrary/Lookups")]
    public Task<CommonResponse<AdminCatalogFieldLookupsDto>> GetFieldLookups(
        CancellationToken cancellationToken = default)
    {
        return _adminCatalogService.GetFieldLookupsAsync(GetCurrentUserId(), cancellationToken);
    }

    [HttpGet("FieldLibrary")]
    public Task<CommonResponse<IEnumerable<AdminCatalogFieldListItemDto>>> GetFieldLibrary(
        string? appId,
        string? search,
        string? status,
        CancellationToken cancellationToken = default)
    {
        return _adminCatalogService.GetFieldsAsync(GetCurrentUserId(), appId, search, status, cancellationToken);
    }

    [HttpGet("FieldLibrary/{applicationId}/{fieldKey}")]
    public Task<CommonResponse<AdminCatalogFieldDto>> GetField(
        string applicationId,
        string fieldKey,
        CancellationToken cancellationToken = default)
    {
        return _adminCatalogService.GetFieldAsync(applicationId, fieldKey, GetCurrentUserId(), cancellationToken);
    }

    [HttpPost("FieldLibrary")]
    public Task<CommonResponse<AdminCatalogFieldDto>> CreateField(
        [FromBody] AdminCatalogFieldCreateRequestDto request,
        CancellationToken cancellationToken = default)
    {
        return _adminCatalogService.CreateFieldAsync(request, GetCurrentUserId(), cancellationToken);
    }

    [HttpPut("FieldLibrary/{applicationId}/{fieldKey}")]
    public Task<CommonResponse<AdminCatalogFieldDto>> UpdateField(
        string applicationId,
        string fieldKey,
        [FromBody] AdminCatalogFieldUpdateRequestDto request,
        CancellationToken cancellationToken = default)
    {
        return _adminCatalogService.UpdateFieldAsync(applicationId, fieldKey, request, GetCurrentUserId(), cancellationToken);
    }

    [HttpGet("FieldLibrary/{applicationId}/{fieldKey}/DeleteDiagnostics")]
    public Task<CommonResponse<AdminCatalogFieldDeleteDiagnosticsDto>> DiagnoseFieldDelete(
        string applicationId,
        string fieldKey,
        CancellationToken cancellationToken = default)
    {
        return _adminCatalogService.DiagnoseFieldDeleteAsync(applicationId, fieldKey, GetCurrentUserId(), cancellationToken);
    }

    [HttpDelete("FieldLibrary/{applicationId}/{fieldKey}")]
    public Task<CommonResponse<AdminCatalogDeleteResultDto>> DeleteField(
        string applicationId,
        string fieldKey,
        CancellationToken cancellationToken = default)
    {
        return _adminCatalogService.DeleteFieldAsync(applicationId, fieldKey, GetCurrentUserId(), cancellationToken);
    }

    private string GetCurrentUserId()
    {
        return HttpContext.User.Claims.FirstOrDefault(claim => claim.Type == "UserId")?.Value ?? string.Empty;
    }
}
