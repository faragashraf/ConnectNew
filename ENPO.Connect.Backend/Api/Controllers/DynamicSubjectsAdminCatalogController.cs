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

    private string GetCurrentUserId()
    {
        return HttpContext.User.Claims.FirstOrDefault(claim => claim.Type == "UserId")?.Value ?? string.Empty;
    }
}
