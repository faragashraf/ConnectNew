using Models.Correspondance;
using Models.GPA;
using Models.GPA.OrgStructure;

namespace Persistence.Services.DynamicSubjects.AdminRouting;

public interface IDynamicSubjectsAdminRoutingRepository
{
    Task<bool> SubjectTypeExistsAsync(int subjectTypeId, CancellationToken cancellationToken = default);

    Task<SubjectRoutingProfile?> FindProfileAsync(int profileId, CancellationToken cancellationToken = default);

    Task<SubjectRoutingStep?> FindStepAsync(int stepId, CancellationToken cancellationToken = default);

    Task<SubjectRoutingTarget?> FindTargetAsync(int targetId, CancellationToken cancellationToken = default);

    Task<SubjectRoutingTransition?> FindTransitionAsync(int transitionId, CancellationToken cancellationToken = default);

    Task<SubjectTypeRoutingBinding?> FindBindingAsync(int bindingId, CancellationToken cancellationToken = default);

    Task<SubjectTypeRequestAvailability?> FindRequestAvailabilityBySubjectTypeAsync(
        int subjectTypeId,
        CancellationToken cancellationToken = default);

    Task<SubjectTypeRoutingBinding?> FindBindingBySubjectAndProfileAsync(
        int subjectTypeId,
        int routingProfileId,
        CancellationToken cancellationToken = default);

    Task AddProfileAsync(SubjectRoutingProfile profile, CancellationToken cancellationToken = default);

    Task AddStepAsync(SubjectRoutingStep step, CancellationToken cancellationToken = default);

    Task AddTargetAsync(SubjectRoutingTarget target, CancellationToken cancellationToken = default);

    Task AddTransitionAsync(SubjectRoutingTransition transition, CancellationToken cancellationToken = default);

    Task AddBindingAsync(SubjectTypeRoutingBinding binding, CancellationToken cancellationToken = default);

    Task AddRequestAvailabilityAsync(
        SubjectTypeRequestAvailability availability,
        CancellationToken cancellationToken = default);

    void RemoveProfile(SubjectRoutingProfile profile);

    void RemoveStep(SubjectRoutingStep step);

    void RemoveTarget(SubjectRoutingTarget target);

    void RemoveTransition(SubjectRoutingTransition transition);

    void RemoveBinding(SubjectTypeRoutingBinding binding);

    Task<IReadOnlyList<SubjectRoutingStep>> ListStepsByProfileAsync(int profileId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<SubjectRoutingTarget>> ListTargetsByProfileAsync(int profileId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<SubjectRoutingTransition>> ListTransitionsByProfileAsync(int profileId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<SubjectTypeRoutingBinding>> ListBindingsByProfileAsync(int profileId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<SubjectTypeRoutingBinding>> ListBindingsBySubjectTypeAsync(int subjectTypeId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<SubjectRoutingProfile>> ListProfilesBySubjectTypeAsync(int subjectTypeId, CancellationToken cancellationToken = default);

    Task<bool> StepCodeExistsInProfileAsync(
        int routingProfileId,
        string stepCode,
        int? excludedStepId,
        CancellationToken cancellationToken = default);

    Task<bool> HasAnotherStartStepAsync(
        int routingProfileId,
        int? excludedStepId,
        CancellationToken cancellationToken = default);

    Task<bool> TransitionExistsAsync(
        int routingProfileId,
        int fromStepId,
        int toStepId,
        string actionCode,
        int? excludedTransitionId,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<OrgUnitType>> ListOracleUnitTypesAsync(CancellationToken cancellationToken = default);

    Task<IReadOnlyList<OrgUnit>> ListOracleUnitsAsync(
        decimal? unitTypeId,
        decimal? parentId,
        string? search,
        bool activeOnly,
        CancellationToken cancellationToken = default);

    Task<OrgUnit?> FindOracleUnitAsync(
        decimal unitId,
        bool activeOnly,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<UserPosition>> ListOraclePositionsAsync(
        string? userId,
        decimal? unitId,
        bool activeOnly,
        CancellationToken cancellationToken = default);

    Task<UserPosition?> FindOraclePositionAsync(
        decimal positionId,
        bool activeOnly,
        CancellationToken cancellationToken = default);

    Task<PosUser?> FindOracleUserAsync(
        string userId,
        bool activeOnly,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<PosUser>> ListOracleUsersByIdsAsync(
        IEnumerable<string> userIds,
        CancellationToken cancellationToken = default);

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
