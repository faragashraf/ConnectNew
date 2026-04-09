using Api.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Models.DTO.Common;
using Models.DTO.DynamicSubjects;
using Persistence.Services.DynamicSubjects.AdminAccessPolicy;

namespace Api.Controllers;

[Route("api/[controller]")]
[ApiController]
[Authorize(Policy = DynamicSubjectsAdminAuthorization.PolicyName)]
public class DynamicSubjectsAdminAccessPolicyController : ControllerBase
{
    private readonly IDynamicSubjectsAdminAccessPolicyService _accessPolicyService;

    public DynamicSubjectsAdminAccessPolicyController(IDynamicSubjectsAdminAccessPolicyService accessPolicyService)
    {
        _accessPolicyService = accessPolicyService;
    }

    [HttpGet("Workspace/{requestTypeId:int}")]
    public Task<CommonResponse<FieldAccessPolicyWorkspaceDto>> GetWorkspace(
        int requestTypeId,
        CancellationToken cancellationToken = default)
    {
        return _accessPolicyService.GetWorkspaceAsync(requestTypeId, GetCurrentUserId(), cancellationToken);
    }

    [HttpPut("Workspace/{requestTypeId:int}")]
    public Task<CommonResponse<FieldAccessPolicyWorkspaceDto>> UpsertWorkspace(
        int requestTypeId,
        [FromBody] FieldAccessPolicyWorkspaceUpsertRequestDto request,
        CancellationToken cancellationToken = default)
    {
        return _accessPolicyService.UpsertWorkspaceAsync(
            requestTypeId,
            request ?? new FieldAccessPolicyWorkspaceUpsertRequestDto(),
            GetCurrentUserId(),
            cancellationToken);
    }

    [HttpPost("Preview/{requestTypeId:int}")]
    public Task<CommonResponse<FieldAccessPreviewResponseDto>> Preview(
        int requestTypeId,
        [FromBody] FieldAccessPreviewRequestDto request,
        CancellationToken cancellationToken = default)
    {
        return _accessPolicyService.PreviewAsync(
            requestTypeId,
            request ?? new FieldAccessPreviewRequestDto(),
            GetCurrentUserId(),
            cancellationToken);
    }

    private string GetCurrentUserId()
    {
        return HttpContext.User.Claims.FirstOrDefault(claim => claim.Type == "UserId")?.Value ?? string.Empty;
    }
}
