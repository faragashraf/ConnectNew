using Api.Authorization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Models.DTO.Common;
using Models.DTO.DynamicSubjects;
using Persistence.Services.DynamicSubjects.AdminRouting;

namespace Api.Controllers;

[Route("api/[controller]")]
[ApiController]
[Authorize(Policy = DynamicSubjectsAdminAuthorization.PolicyName)]
public class DynamicSubjectsAdminRoutingController : ControllerBase
{
    private readonly IDynamicSubjectsAdminRoutingService _routingService;

    public DynamicSubjectsAdminRoutingController(IDynamicSubjectsAdminRoutingService routingService)
    {
        _routingService = routingService;
    }

    [HttpGet("Profiles")]
    public Task<CommonResponse<IEnumerable<SubjectRoutingProfileDto>>> GetProfilesByRequestType(
        int subjectTypeId,
        CancellationToken cancellationToken = default)
    {
        return _routingService.GetProfilesByRequestTypeAsync(subjectTypeId, GetCurrentUserId(), cancellationToken);
    }

    [HttpGet("Profiles/ByRequestType/{subjectTypeId:int}")]
    public Task<CommonResponse<SubjectRoutingProfileWorkspaceDto>> GetProfileByRequestType(
        int subjectTypeId,
        string? direction,
        CancellationToken cancellationToken = default)
    {
        return _routingService.GetProfileByRequestTypeAsync(
            subjectTypeId,
            direction,
            GetCurrentUserId(),
            cancellationToken);
    }

    [HttpGet("Profiles/{profileId:int}/Workspace")]
    public Task<CommonResponse<SubjectRoutingProfileWorkspaceDto>> GetProfileWorkspace(
        int profileId,
        CancellationToken cancellationToken = default)
    {
        return _routingService.GetProfileWorkspaceAsync(profileId, GetCurrentUserId(), cancellationToken);
    }

    [HttpPost("Profiles")]
    public Task<CommonResponse<SubjectRoutingProfileDto>> CreateProfile(
        [FromBody] SubjectRoutingProfileUpsertRequestDto request,
        CancellationToken cancellationToken = default)
    {
        return _routingService.CreateProfileAsync(request, GetCurrentUserId(), cancellationToken);
    }

    [HttpPut("Profiles/{profileId:int}")]
    public Task<CommonResponse<SubjectRoutingProfileDto>> UpdateProfile(
        int profileId,
        [FromBody] SubjectRoutingProfileUpsertRequestDto request,
        CancellationToken cancellationToken = default)
    {
        return _routingService.UpdateProfileAsync(profileId, request, GetCurrentUserId(), cancellationToken);
    }

    [HttpPost("Steps")]
    public Task<CommonResponse<SubjectRoutingStepDto>> AddStep(
        [FromBody] SubjectRoutingStepUpsertRequestDto request,
        CancellationToken cancellationToken = default)
    {
        return _routingService.AddStepAsync(request, GetCurrentUserId(), cancellationToken);
    }

    [HttpPut("Steps/{stepId:int}")]
    public Task<CommonResponse<SubjectRoutingStepDto>> UpdateStep(
        int stepId,
        [FromBody] SubjectRoutingStepUpsertRequestDto request,
        CancellationToken cancellationToken = default)
    {
        return _routingService.UpdateStepAsync(stepId, request, GetCurrentUserId(), cancellationToken);
    }

    [HttpDelete("Steps/{stepId:int}")]
    public Task<CommonResponse<bool>> DeleteStep(
        int stepId,
        CancellationToken cancellationToken = default)
    {
        return _routingService.DeleteStepAsync(stepId, GetCurrentUserId(), cancellationToken);
    }

    [HttpPost("Targets")]
    public Task<CommonResponse<SubjectRoutingTargetDto>> AddTarget(
        [FromBody] SubjectRoutingTargetUpsertRequestDto request,
        CancellationToken cancellationToken = default)
    {
        return _routingService.AddTargetAsync(request, GetCurrentUserId(), cancellationToken);
    }

    [HttpPut("Targets/{targetId:int}")]
    public Task<CommonResponse<SubjectRoutingTargetDto>> UpdateTarget(
        int targetId,
        [FromBody] SubjectRoutingTargetUpsertRequestDto request,
        CancellationToken cancellationToken = default)
    {
        return _routingService.UpdateTargetAsync(targetId, request, GetCurrentUserId(), cancellationToken);
    }

    [HttpDelete("Targets/{targetId:int}")]
    public Task<CommonResponse<bool>> DeleteTarget(
        int targetId,
        CancellationToken cancellationToken = default)
    {
        return _routingService.DeleteTargetAsync(targetId, GetCurrentUserId(), cancellationToken);
    }

    [HttpPost("Transitions")]
    public Task<CommonResponse<SubjectRoutingTransitionDto>> AddTransition(
        [FromBody] SubjectRoutingTransitionUpsertRequestDto request,
        CancellationToken cancellationToken = default)
    {
        return _routingService.AddTransitionAsync(request, GetCurrentUserId(), cancellationToken);
    }

    [HttpPut("Transitions/{transitionId:int}")]
    public Task<CommonResponse<SubjectRoutingTransitionDto>> UpdateTransition(
        int transitionId,
        [FromBody] SubjectRoutingTransitionUpsertRequestDto request,
        CancellationToken cancellationToken = default)
    {
        return _routingService.UpdateTransitionAsync(transitionId, request, GetCurrentUserId(), cancellationToken);
    }

    [HttpDelete("Transitions/{transitionId:int}")]
    public Task<CommonResponse<bool>> DeleteTransition(
        int transitionId,
        CancellationToken cancellationToken = default)
    {
        return _routingService.DeleteTransitionAsync(transitionId, GetCurrentUserId(), cancellationToken);
    }

    [HttpPost("Bindings")]
    public Task<CommonResponse<SubjectTypeRoutingBindingDto>> BindProfileToRequestType(
        [FromBody] SubjectTypeRoutingBindingUpsertRequestDto request,
        CancellationToken cancellationToken = default)
    {
        return _routingService.BindProfileToRequestTypeAsync(request, GetCurrentUserId(), cancellationToken);
    }

    [HttpGet("Profiles/{profileId:int}/Preview")]
    public Task<CommonResponse<SubjectRoutingPreviewDto>> GetRoutingPreview(
        int profileId,
        CancellationToken cancellationToken = default)
    {
        return _routingService.GetRoutingPreviewAsync(profileId, GetCurrentUserId(), cancellationToken);
    }

    [HttpGet("Profiles/{profileId:int}/Validation")]
    public Task<CommonResponse<SubjectRoutingValidationResultDto>> ValidateRoutingProfile(
        int profileId,
        CancellationToken cancellationToken = default)
    {
        return _routingService.ValidateRoutingProfileAsync(profileId, GetCurrentUserId(), cancellationToken);
    }

    [HttpGet("Availability/{subjectTypeId:int}")]
    public Task<CommonResponse<SubjectTypeRequestAvailabilityDto>> GetRequestAvailability(
        int subjectTypeId,
        CancellationToken cancellationToken = default)
    {
        return _routingService.GetRequestAvailabilityAsync(subjectTypeId, GetCurrentUserId(), cancellationToken);
    }

    [HttpPut("Availability/{subjectTypeId:int}")]
    public Task<CommonResponse<SubjectTypeRequestAvailabilityDto>> UpsertRequestAvailability(
        int subjectTypeId,
        [FromBody] SubjectTypeRequestAvailabilityUpsertRequestDto request,
        CancellationToken cancellationToken = default)
    {
        return _routingService.UpsertRequestAvailabilityAsync(
            subjectTypeId,
            request,
            GetCurrentUserId(),
            cancellationToken);
    }

    [HttpPost("Availability/{subjectTypeId:int}/ValidateNode")]
    public Task<CommonResponse<SubjectAvailabilityNodeValidationResultDto>> ValidateRequestAvailabilityNode(
        int subjectTypeId,
        [FromBody] SubjectAvailabilityNodeValidationRequestDto request,
        CancellationToken cancellationToken = default)
    {
        return _routingService.ValidateRequestAvailabilityNodeAsync(
            subjectTypeId,
            request,
            GetCurrentUserId(),
            cancellationToken);
    }

    [HttpGet("Availability/{subjectTypeId:int}/TreeNodes")]
    public Task<CommonResponse<IEnumerable<SubjectRoutingOrgTreeNodeDto>>> GetAvailabilityTreeNodes(
        int subjectTypeId,
        string? parentNodeType,
        decimal? parentNodeNumericId,
        string? parentNodeUserId,
        string? search,
        bool activeOnly = true,
        bool includeUsers = true,
        CancellationToken cancellationToken = default)
    {
        return _routingService.GetAvailabilityTreeNodesAsync(
            subjectTypeId,
            GetCurrentUserId(),
            parentNodeType,
            parentNodeNumericId,
            parentNodeUserId,
            search,
            activeOnly,
            includeUsers,
            cancellationToken);
    }

    [HttpGet("Oracle/UnitTypes")]
    public Task<CommonResponse<IEnumerable<SubjectRoutingOrgUnitTypeLookupDto>>> GetOracleUnitTypes(
        CancellationToken cancellationToken = default)
    {
        return _routingService.GetOracleUnitTypesAsync(GetCurrentUserId(), cancellationToken);
    }

    [HttpPost("Oracle/UnitTypes")]
    public Task<CommonResponse<SubjectRoutingOrgUnitTypeLookupDto>> CreateOracleUnitType(
        [FromBody] SubjectRoutingOrgUnitTypeUpsertRequestDto request,
        CancellationToken cancellationToken = default)
    {
        return _routingService.CreateOracleUnitTypeAsync(request, GetCurrentUserId(), cancellationToken);
    }

    [HttpPut("Oracle/UnitTypes/{unitTypeId:decimal}")]
    public Task<CommonResponse<SubjectRoutingOrgUnitTypeLookupDto>> UpdateOracleUnitType(
        decimal unitTypeId,
        [FromBody] SubjectRoutingOrgUnitTypeUpsertRequestDto request,
        CancellationToken cancellationToken = default)
    {
        return _routingService.UpdateOracleUnitTypeAsync(unitTypeId, request, GetCurrentUserId(), cancellationToken);
    }

    [HttpDelete("Oracle/UnitTypes/{unitTypeId:decimal}")]
    public Task<CommonResponse<bool>> DeleteOracleUnitType(
        decimal unitTypeId,
        CancellationToken cancellationToken = default)
    {
        return _routingService.DeleteOracleUnitTypeAsync(unitTypeId, GetCurrentUserId(), cancellationToken);
    }

    [HttpGet("Oracle/Units")]
    public Task<CommonResponse<IEnumerable<SubjectRoutingOrgUnitLookupDto>>> GetOracleUnits(
        decimal? unitTypeId,
        decimal? parentId,
        string? search,
        bool activeOnly = true,
        CancellationToken cancellationToken = default)
    {
        return _routingService.GetOracleUnitsAsync(
            GetCurrentUserId(),
            unitTypeId,
            parentId,
            search,
            activeOnly,
            cancellationToken);
    }

    [HttpPost("Oracle/Units")]
    public Task<CommonResponse<SubjectRoutingOrgUnitLookupDto>> CreateOracleUnit(
        [FromBody] SubjectRoutingOrgUnitUpsertRequestDto request,
        CancellationToken cancellationToken = default)
    {
        return _routingService.CreateOracleUnitAsync(request, GetCurrentUserId(), cancellationToken);
    }

    [HttpPut("Oracle/Units/{unitId:decimal}")]
    public Task<CommonResponse<SubjectRoutingOrgUnitLookupDto>> UpdateOracleUnit(
        decimal unitId,
        [FromBody] SubjectRoutingOrgUnitUpsertRequestDto request,
        CancellationToken cancellationToken = default)
    {
        return _routingService.UpdateOracleUnitAsync(unitId, request, GetCurrentUserId(), cancellationToken);
    }

    [HttpDelete("Oracle/Units/{unitId:decimal}")]
    public Task<CommonResponse<bool>> DeleteOracleUnit(
        decimal unitId,
        CancellationToken cancellationToken = default)
    {
        return _routingService.DeleteOracleUnitAsync(unitId, GetCurrentUserId(), cancellationToken);
    }

    [HttpGet("Oracle/Positions")]
    public Task<CommonResponse<IEnumerable<SubjectRoutingOrgPositionLookupDto>>> GetOraclePositions(
        string? targetUserId,
        decimal? unitId,
        bool activeOnly = true,
        CancellationToken cancellationToken = default)
    {
        return _routingService.GetOraclePositionsAsync(
            GetCurrentUserId(),
            targetUserId,
            unitId,
            activeOnly,
            cancellationToken);
    }

    [HttpPost("Oracle/Positions")]
    public Task<CommonResponse<SubjectRoutingOrgPositionLookupDto>> CreateOraclePosition(
        [FromBody] SubjectRoutingOrgPositionUpsertRequestDto request,
        CancellationToken cancellationToken = default)
    {
        return _routingService.CreateOraclePositionAsync(request, GetCurrentUserId(), cancellationToken);
    }

    [HttpPut("Oracle/Positions/{positionId:decimal}")]
    public Task<CommonResponse<SubjectRoutingOrgPositionLookupDto>> UpdateOraclePosition(
        decimal positionId,
        [FromBody] SubjectRoutingOrgPositionUpsertRequestDto request,
        CancellationToken cancellationToken = default)
    {
        return _routingService.UpdateOraclePositionAsync(positionId, request, GetCurrentUserId(), cancellationToken);
    }

    [HttpDelete("Oracle/Positions/{positionId:decimal}")]
    public Task<CommonResponse<bool>> DeleteOraclePosition(
        decimal positionId,
        CancellationToken cancellationToken = default)
    {
        return _routingService.DeleteOraclePositionAsync(positionId, GetCurrentUserId(), cancellationToken);
    }

    [HttpGet("Oracle/Users")]
    public Task<CommonResponse<IEnumerable<SubjectRoutingOrgUserLookupDto>>> GetOracleUsers(
        bool activeOnly = true,
        CancellationToken cancellationToken = default)
    {
        return _routingService.GetOracleUsersAsync(GetCurrentUserId(), activeOnly, cancellationToken);
    }

    [HttpGet("Oracle/TreeNodes")]
    public Task<CommonResponse<IEnumerable<SubjectRoutingOrgTreeNodeDto>>> GetOracleTreeNodes(
        string? parentNodeType,
        decimal? parentNodeNumericId,
        string? parentNodeUserId,
        string? search,
        bool activeOnly = true,
        bool includeUsers = true,
        CancellationToken cancellationToken = default)
    {
        return _routingService.GetOracleTreeNodesAsync(
            GetCurrentUserId(),
            parentNodeType,
            parentNodeNumericId,
            parentNodeUserId,
            search,
            activeOnly,
            includeUsers,
            cancellationToken);
    }

    [HttpGet("Oracle/UnitsWithCountTree")]
    public Task<CommonResponse<IEnumerable<SubjectRoutingOrgUnitWithCountTreeNodeDto>>> GetOracleUnitsWithCountTree(
        bool activeOnly = true,
        CancellationToken cancellationToken = default)
    {
        return _routingService.GetOracleUnitsWithCountTreeAsync(GetCurrentUserId(), activeOnly, cancellationToken);
    }

    private string GetCurrentUserId()
    {
        return HttpContext.User.Claims.FirstOrDefault(claim => claim.Type == "UserId")?.Value ?? string.Empty;
    }
}
