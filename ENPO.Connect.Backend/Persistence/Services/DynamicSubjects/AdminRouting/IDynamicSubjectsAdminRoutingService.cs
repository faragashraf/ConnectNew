using Models.DTO.Common;
using Models.DTO.DynamicSubjects;

namespace Persistence.Services.DynamicSubjects.AdminRouting;

public interface IDynamicSubjectsAdminRoutingService
{
    Task<CommonResponse<IEnumerable<SubjectRoutingProfileDto>>> GetProfilesByRequestTypeAsync(
        int subjectTypeId,
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<SubjectRoutingProfileWorkspaceDto>> GetProfileByRequestTypeAsync(
        int subjectTypeId,
        string? direction,
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<SubjectRoutingProfileWorkspaceDto>> GetProfileWorkspaceAsync(
        int profileId,
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<SubjectRoutingProfileDto>> CreateProfileAsync(
        SubjectRoutingProfileUpsertRequestDto request,
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<SubjectRoutingProfileDto>> UpdateProfileAsync(
        int profileId,
        SubjectRoutingProfileUpsertRequestDto request,
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<SubjectRoutingStepDto>> AddStepAsync(
        SubjectRoutingStepUpsertRequestDto request,
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<SubjectRoutingStepDto>> UpdateStepAsync(
        int stepId,
        SubjectRoutingStepUpsertRequestDto request,
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<bool>> DeleteStepAsync(
        int stepId,
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<SubjectRoutingTargetDto>> AddTargetAsync(
        SubjectRoutingTargetUpsertRequestDto request,
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<SubjectRoutingTargetDto>> UpdateTargetAsync(
        int targetId,
        SubjectRoutingTargetUpsertRequestDto request,
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<bool>> DeleteTargetAsync(
        int targetId,
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<SubjectRoutingTransitionDto>> AddTransitionAsync(
        SubjectRoutingTransitionUpsertRequestDto request,
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<SubjectRoutingTransitionDto>> UpdateTransitionAsync(
        int transitionId,
        SubjectRoutingTransitionUpsertRequestDto request,
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<bool>> DeleteTransitionAsync(
        int transitionId,
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<SubjectTypeRoutingBindingDto>> BindProfileToRequestTypeAsync(
        SubjectTypeRoutingBindingUpsertRequestDto request,
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<SubjectRoutingPreviewDto>> GetRoutingPreviewAsync(
        int profileId,
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<SubjectRoutingValidationResultDto>> ValidateRoutingProfileAsync(
        int profileId,
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<SubjectTypeRequestAvailabilityDto>> GetRequestAvailabilityAsync(
        int subjectTypeId,
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<SubjectTypeRequestAvailabilityDto>> UpsertRequestAvailabilityAsync(
        int subjectTypeId,
        SubjectTypeRequestAvailabilityUpsertRequestDto request,
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<SubjectAvailabilityNodeValidationResultDto>> ValidateRequestAvailabilityNodeAsync(
        int subjectTypeId,
        SubjectAvailabilityNodeValidationRequestDto request,
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<IEnumerable<SubjectRoutingOrgTreeNodeDto>>> GetAvailabilityTreeNodesAsync(
        int subjectTypeId,
        string userId,
        string? parentNodeType,
        decimal? parentNodeNumericId,
        string? parentNodeUserId,
        string? search,
        bool activeOnly,
        bool includeUsers,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<IEnumerable<SubjectRoutingOrgUnitTypeLookupDto>>> GetOracleUnitTypesAsync(
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<SubjectRoutingOrgUnitTypeLookupDto>> CreateOracleUnitTypeAsync(
        SubjectRoutingOrgUnitTypeUpsertRequestDto request,
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<SubjectRoutingOrgUnitTypeLookupDto>> UpdateOracleUnitTypeAsync(
        decimal unitTypeId,
        SubjectRoutingOrgUnitTypeUpsertRequestDto request,
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<bool>> DeleteOracleUnitTypeAsync(
        decimal unitTypeId,
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<IEnumerable<SubjectRoutingOrgUnitLookupDto>>> GetOracleUnitsAsync(
        string userId,
        decimal? unitTypeId,
        decimal? parentId,
        string? search,
        bool activeOnly,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<SubjectRoutingOrgUnitLookupDto>> CreateOracleUnitAsync(
        SubjectRoutingOrgUnitUpsertRequestDto request,
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<SubjectRoutingOrgUnitLookupDto>> UpdateOracleUnitAsync(
        decimal unitId,
        SubjectRoutingOrgUnitUpsertRequestDto request,
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<bool>> DeleteOracleUnitAsync(
        decimal unitId,
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<IEnumerable<SubjectRoutingOrgPositionLookupDto>>> GetOraclePositionsAsync(
        string userId,
        string? targetUserId,
        decimal? unitId,
        bool activeOnly,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<SubjectRoutingOrgPositionLookupDto>> CreateOraclePositionAsync(
        SubjectRoutingOrgPositionUpsertRequestDto request,
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<SubjectRoutingOrgPositionLookupDto>> UpdateOraclePositionAsync(
        decimal positionId,
        SubjectRoutingOrgPositionUpsertRequestDto request,
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<bool>> DeleteOraclePositionAsync(
        decimal positionId,
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<IEnumerable<SubjectRoutingOrgUserLookupDto>>> GetOracleUsersAsync(
        string userId,
        bool activeOnly,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<IEnumerable<SubjectRoutingOrgTreeNodeDto>>> GetOracleTreeNodesAsync(
        string userId,
        string? parentNodeType,
        decimal? parentNodeNumericId,
        string? parentNodeUserId,
        string? search,
        bool activeOnly,
        bool includeUsers,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<IEnumerable<SubjectRoutingOrgUnitWithCountTreeNodeDto>>> GetOracleUnitsWithCountTreeAsync(
        string userId,
        bool activeOnly,
        CancellationToken cancellationToken = default);
}
