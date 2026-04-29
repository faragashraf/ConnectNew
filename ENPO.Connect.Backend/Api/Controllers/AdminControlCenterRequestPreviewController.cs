using Api.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Models.DTO.Common;
using Models.DTO.DynamicSubjects;
using Persistence.Services.DynamicSubjects.AdminCatalog;

namespace Api.Controllers;

[Route("api/admin/control-center/request-preview")]
[ApiController]
[Authorize(Policy = DynamicSubjectsAdminAuthorization.PolicyName)]
public class AdminControlCenterRequestPreviewController : ControllerBase
{
    private readonly IAdminControlCenterRequestPreviewResolver _requestPreviewResolver;

    public AdminControlCenterRequestPreviewController(
        IAdminControlCenterRequestPreviewResolver requestPreviewResolver)
    {
        _requestPreviewResolver = requestPreviewResolver;
    }

    [HttpGet("{requestTypeId:int}")]
    public Task<CommonResponse<AdminControlCenterRequestPreviewDto>> GetRequestPreview(
        int requestTypeId,
        CancellationToken cancellationToken = default)
    {
        return _requestPreviewResolver.ResolveAsync(
            requestTypeId,
            GetCurrentUserId(),
            cancellationToken);
    }

    private string GetCurrentUserId()
    {
        return HttpContext.User.Claims.FirstOrDefault(claim => claim.Type == "UserId")?.Value ?? string.Empty;
    }
}
