using Microsoft.EntityFrameworkCore;
using Models.Correspondance;
using Models.GPA;
using Models.GPA.OrgStructure;
using Persistence.Data;

namespace Persistence.Services.DynamicSubjects.AdminRouting;

public sealed class DynamicSubjectsAdminRoutingRepository : IDynamicSubjectsAdminRoutingRepository
{
    private readonly ConnectContext _connectContext;
    private readonly GPAContext _gpaContext;

    public DynamicSubjectsAdminRoutingRepository(ConnectContext connectContext, GPAContext gpaContext)
    {
        _connectContext = connectContext;
        _gpaContext = gpaContext;
    }

    public async Task<bool> SubjectTypeExistsAsync(int subjectTypeId, CancellationToken cancellationToken = default)
    {
        if (subjectTypeId <= 0)
        {
            return false;
        }

        return await _connectContext.Cdcategories
            .AsNoTracking()
            .AnyAsync(item => item.CatId == subjectTypeId, cancellationToken);
    }

    public async Task<SubjectRoutingProfile?> FindProfileAsync(int profileId, CancellationToken cancellationToken = default)
    {
        if (profileId <= 0)
        {
            return null;
        }

        return await _connectContext.SubjectRoutingProfiles
            .FirstOrDefaultAsync(item => item.Id == profileId, cancellationToken);
    }

    public async Task<SubjectRoutingStep?> FindStepAsync(int stepId, CancellationToken cancellationToken = default)
    {
        if (stepId <= 0)
        {
            return null;
        }

        return await _connectContext.SubjectRoutingSteps
            .FirstOrDefaultAsync(item => item.Id == stepId, cancellationToken);
    }

    public async Task<SubjectRoutingTarget?> FindTargetAsync(int targetId, CancellationToken cancellationToken = default)
    {
        if (targetId <= 0)
        {
            return null;
        }

        return await _connectContext.SubjectRoutingTargets
            .FirstOrDefaultAsync(item => item.Id == targetId, cancellationToken);
    }

    public async Task<SubjectRoutingTransition?> FindTransitionAsync(int transitionId, CancellationToken cancellationToken = default)
    {
        if (transitionId <= 0)
        {
            return null;
        }

        return await _connectContext.SubjectRoutingTransitions
            .FirstOrDefaultAsync(item => item.Id == transitionId, cancellationToken);
    }

    public async Task<SubjectTypeRoutingBinding?> FindBindingAsync(int bindingId, CancellationToken cancellationToken = default)
    {
        if (bindingId <= 0)
        {
            return null;
        }

        return await _connectContext.SubjectTypeRoutingBindings
            .FirstOrDefaultAsync(item => item.Id == bindingId, cancellationToken);
    }

    public async Task<SubjectTypeRequestAvailability?> FindRequestAvailabilityBySubjectTypeAsync(
        int subjectTypeId,
        CancellationToken cancellationToken = default)
    {
        if (subjectTypeId <= 0)
        {
            return null;
        }

        return await _connectContext.SubjectTypeRequestAvailabilities
            .FirstOrDefaultAsync(item => item.CategoryId == subjectTypeId, cancellationToken);
    }

    public async Task<SubjectTypeRoutingBinding?> FindBindingBySubjectAndProfileAsync(
        int subjectTypeId,
        int routingProfileId,
        CancellationToken cancellationToken = default)
    {
        if (subjectTypeId <= 0 || routingProfileId <= 0)
        {
            return null;
        }

        return await _connectContext.SubjectTypeRoutingBindings
            .FirstOrDefaultAsync(item =>
                item.SubjectTypeId == subjectTypeId
                && item.RoutingProfileId == routingProfileId, cancellationToken);
    }

    public Task AddProfileAsync(SubjectRoutingProfile profile, CancellationToken cancellationToken = default)
    {
        return _connectContext.SubjectRoutingProfiles.AddAsync(profile, cancellationToken).AsTask();
    }

    public Task AddStepAsync(SubjectRoutingStep step, CancellationToken cancellationToken = default)
    {
        return _connectContext.SubjectRoutingSteps.AddAsync(step, cancellationToken).AsTask();
    }

    public Task AddTargetAsync(SubjectRoutingTarget target, CancellationToken cancellationToken = default)
    {
        return _connectContext.SubjectRoutingTargets.AddAsync(target, cancellationToken).AsTask();
    }

    public Task AddTransitionAsync(SubjectRoutingTransition transition, CancellationToken cancellationToken = default)
    {
        return _connectContext.SubjectRoutingTransitions.AddAsync(transition, cancellationToken).AsTask();
    }

    public Task AddBindingAsync(SubjectTypeRoutingBinding binding, CancellationToken cancellationToken = default)
    {
        return _connectContext.SubjectTypeRoutingBindings.AddAsync(binding, cancellationToken).AsTask();
    }

    public Task AddRequestAvailabilityAsync(
        SubjectTypeRequestAvailability availability,
        CancellationToken cancellationToken = default)
    {
        return _connectContext.SubjectTypeRequestAvailabilities.AddAsync(availability, cancellationToken).AsTask();
    }

    public void RemoveProfile(SubjectRoutingProfile profile)
    {
        _connectContext.SubjectRoutingProfiles.Remove(profile);
    }

    public void RemoveStep(SubjectRoutingStep step)
    {
        _connectContext.SubjectRoutingSteps.Remove(step);
    }

    public void RemoveTarget(SubjectRoutingTarget target)
    {
        _connectContext.SubjectRoutingTargets.Remove(target);
    }

    public void RemoveTransition(SubjectRoutingTransition transition)
    {
        _connectContext.SubjectRoutingTransitions.Remove(transition);
    }

    public void RemoveBinding(SubjectTypeRoutingBinding binding)
    {
        _connectContext.SubjectTypeRoutingBindings.Remove(binding);
    }

    public async Task<IReadOnlyList<SubjectRoutingStep>> ListStepsByProfileAsync(
        int profileId,
        CancellationToken cancellationToken = default)
    {
        if (profileId <= 0)
        {
            return Array.Empty<SubjectRoutingStep>();
        }

        return await _connectContext.SubjectRoutingSteps
            .AsNoTracking()
            .Where(item => item.RoutingProfileId == profileId)
            .OrderBy(item => item.StepOrder)
            .ThenBy(item => item.Id)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<SubjectRoutingTarget>> ListTargetsByProfileAsync(
        int profileId,
        CancellationToken cancellationToken = default)
    {
        if (profileId <= 0)
        {
            return Array.Empty<SubjectRoutingTarget>();
        }

        var stepIds = _connectContext.SubjectRoutingSteps
            .AsNoTracking()
            .Where(item => item.RoutingProfileId == profileId)
            .Select(item => item.Id);

        return await _connectContext.SubjectRoutingTargets
            .AsNoTracking()
            .Where(item => stepIds.Contains(item.RoutingStepId))
            .OrderBy(item => item.RoutingStepId)
            .ThenBy(item => item.Id)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<SubjectRoutingTransition>> ListTransitionsByProfileAsync(
        int profileId,
        CancellationToken cancellationToken = default)
    {
        if (profileId <= 0)
        {
            return Array.Empty<SubjectRoutingTransition>();
        }

        return await _connectContext.SubjectRoutingTransitions
            .AsNoTracking()
            .Where(item => item.RoutingProfileId == profileId)
            .OrderBy(item => item.DisplayOrder)
            .ThenBy(item => item.Id)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<SubjectTypeRoutingBinding>> ListBindingsByProfileAsync(
        int profileId,
        CancellationToken cancellationToken = default)
    {
        if (profileId <= 0)
        {
            return Array.Empty<SubjectTypeRoutingBinding>();
        }

        return await _connectContext.SubjectTypeRoutingBindings
            .AsNoTracking()
            .Where(item => item.RoutingProfileId == profileId)
            .OrderByDescending(item => item.IsDefault)
            .ThenByDescending(item => item.IsActive)
            .ThenBy(item => item.Id)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<SubjectTypeRoutingBinding>> ListBindingsBySubjectTypeAsync(
        int subjectTypeId,
        CancellationToken cancellationToken = default)
    {
        if (subjectTypeId <= 0)
        {
            return Array.Empty<SubjectTypeRoutingBinding>();
        }

        return await _connectContext.SubjectTypeRoutingBindings
            .AsNoTracking()
            .Where(item => item.SubjectTypeId == subjectTypeId)
            .OrderByDescending(item => item.IsDefault)
            .ThenByDescending(item => item.IsActive)
            .ThenBy(item => item.Id)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<SubjectRoutingProfile>> ListProfilesBySubjectTypeAsync(
        int subjectTypeId,
        CancellationToken cancellationToken = default)
    {
        if (subjectTypeId <= 0)
        {
            return Array.Empty<SubjectRoutingProfile>();
        }

        return await _connectContext.SubjectRoutingProfiles
            .AsNoTracking()
            .Where(item => item.SubjectTypeId == subjectTypeId)
            .OrderByDescending(item => item.IsActive)
            .ThenByDescending(item => item.VersionNo)
            .ThenBy(item => item.Id)
            .ToListAsync(cancellationToken);
    }

    public async Task<bool> StepCodeExistsInProfileAsync(
        int routingProfileId,
        string stepCode,
        int? excludedStepId,
        CancellationToken cancellationToken = default)
    {
        var normalizedStepCode = NormalizeNullable(stepCode);
        if (routingProfileId <= 0 || normalizedStepCode == null)
        {
            return false;
        }

        var query = _connectContext.SubjectRoutingSteps
            .AsNoTracking()
            .Where(item => item.RoutingProfileId == routingProfileId && item.StepCode == normalizedStepCode);

        if (excludedStepId.HasValue && excludedStepId.Value > 0)
        {
            var excluded = excludedStepId.Value;
            query = query.Where(item => item.Id != excluded);
        }

        return await query.AnyAsync(cancellationToken);
    }

    public async Task<bool> HasAnotherStartStepAsync(
        int routingProfileId,
        int? excludedStepId,
        CancellationToken cancellationToken = default)
    {
        if (routingProfileId <= 0)
        {
            return false;
        }

        var query = _connectContext.SubjectRoutingSteps
            .AsNoTracking()
            .Where(item => item.RoutingProfileId == routingProfileId && item.IsStart);

        if (excludedStepId.HasValue && excludedStepId.Value > 0)
        {
            var excluded = excludedStepId.Value;
            query = query.Where(item => item.Id != excluded);
        }

        return await query.AnyAsync(cancellationToken);
    }

    public async Task<bool> TransitionExistsAsync(
        int routingProfileId,
        int fromStepId,
        int toStepId,
        string actionCode,
        int? excludedTransitionId,
        CancellationToken cancellationToken = default)
    {
        var normalizedActionCode = NormalizeNullable(actionCode);
        if (routingProfileId <= 0
            || fromStepId <= 0
            || toStepId <= 0
            || normalizedActionCode == null)
        {
            return false;
        }

        var query = _connectContext.SubjectRoutingTransitions
            .AsNoTracking()
            .Where(item =>
                item.RoutingProfileId == routingProfileId
                && item.FromStepId == fromStepId
                && item.ToStepId == toStepId
                && item.ActionCode == normalizedActionCode);

        if (excludedTransitionId.HasValue && excludedTransitionId.Value > 0)
        {
            var excluded = excludedTransitionId.Value;
            query = query.Where(item => item.Id != excluded);
        }

        return await query.AnyAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<OrgUnitType>> ListOracleUnitTypesAsync(CancellationToken cancellationToken = default)
    {
        return await _gpaContext.OrgUnitTypes
            .AsNoTracking()
            .OrderByDescending(item => item.Status ?? false)
            .ThenBy(item => item.TypeName)
            .ThenBy(item => item.UnitTypeId)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<OrgUnit>> ListOracleUnitsAsync(
        decimal? unitTypeId,
        decimal? parentId,
        string? search,
        bool activeOnly,
        CancellationToken cancellationToken = default)
    {
        var normalizedSearch = NormalizeNullable(search);

        IQueryable<OrgUnit> query = _gpaContext.OrgUnits
            .AsNoTracking()
            .Include(item => item.UnitType);

        if (unitTypeId.HasValue && unitTypeId.Value > 0)
        {
            var normalizedTypeId = unitTypeId.Value;
            query = query.Where(item => item.UnitTypeId == normalizedTypeId);
        }

        if (parentId.HasValue && parentId.Value > 0)
        {
            var normalizedParentId = parentId.Value;
            query = query.Where(item => item.ParentId == normalizedParentId);
        }

        if (activeOnly)
        {
            query = query.Where(item => item.Status != false);
        }

        if (normalizedSearch != null)
        {
            var term = $"%{normalizedSearch}%";
            query = query.Where(item => EF.Functions.Like(item.UnitName, term));
        }

        return await query
            .OrderBy(item => item.UnitTypeId)
            .ThenBy(item => item.UnitName)
            .ThenBy(item => item.UnitId)
            .ToListAsync(cancellationToken);
    }

    public async Task<OrgUnit?> FindOracleUnitAsync(
        decimal unitId,
        bool activeOnly,
        CancellationToken cancellationToken = default)
    {
        if (unitId <= 0)
        {
            return null;
        }

        IQueryable<OrgUnit> query = _gpaContext.OrgUnits
            .AsNoTracking()
            .Include(item => item.UnitType)
            .Where(item => item.UnitId == unitId);

        if (activeOnly)
        {
            query = query.Where(item => item.Status != false);
        }

        return await query.FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<UserPosition>> ListOraclePositionsAsync(
        string? userId,
        decimal? unitId,
        bool activeOnly,
        CancellationToken cancellationToken = default)
    {
        var normalizedUserId = NormalizeNullable(userId);
        var today = DateTime.Today;

        IQueryable<UserPosition> query = _gpaContext.UserPositions
            .AsNoTracking()
            .Include(item => item.Unit);

        if (normalizedUserId != null)
        {
            query = query.Where(item => item.UserId == normalizedUserId);
        }

        if (unitId.HasValue && unitId.Value > 0)
        {
            var normalizedUnitId = unitId.Value;
            query = query.Where(item => item.UnitId == normalizedUnitId);
        }

        if (activeOnly)
        {
            query = query.Where(item =>
                item.IsActive != false
                && (!item.StartDate.HasValue || item.StartDate.Value <= today)
                && (!item.EndDate.HasValue || item.EndDate.Value >= today));
        }

        return await query
            .OrderBy(item => item.UnitId)
            .ThenBy(item => item.UserId)
            .ThenBy(item => item.PositionId)
            .ToListAsync(cancellationToken);
    }

    public async Task<UserPosition?> FindOraclePositionAsync(
        decimal positionId,
        bool activeOnly,
        CancellationToken cancellationToken = default)
    {
        if (positionId <= 0)
        {
            return null;
        }

        var today = DateTime.Today;
        IQueryable<UserPosition> query = _gpaContext.UserPositions
            .AsNoTracking()
            .Include(item => item.Unit)
            .Where(item => item.PositionId == positionId);

        if (activeOnly)
        {
            query = query.Where(item =>
                item.IsActive != false
                && (!item.StartDate.HasValue || item.StartDate.Value <= today)
                && (!item.EndDate.HasValue || item.EndDate.Value >= today));
        }

        return await query.FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<PosUser?> FindOracleUserAsync(
        string userId,
        bool activeOnly,
        CancellationToken cancellationToken = default)
    {
        var normalizedUserId = NormalizeNullable(userId);
        if (normalizedUserId == null)
        {
            return null;
        }

        IQueryable<PosUser> query = _gpaContext.PosUsers
            .AsNoTracking()
            .Where(item => item.UserId == normalizedUserId);

        if (activeOnly)
        {
            query = query.Where(item => item.Status == null || item.Status > 0);
        }

        return await query.FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<PosUser>> ListOracleUsersByIdsAsync(
        IEnumerable<string> userIds,
        CancellationToken cancellationToken = default)
    {
        var normalizedIds = (userIds ?? Array.Empty<string>())
            .Select(NormalizeNullable)
            .Where(item => item != null)
            .Cast<string>()
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (normalizedIds.Count == 0)
        {
            return Array.Empty<PosUser>();
        }

        return await _gpaContext.PosUsers
            .AsNoTracking()
            .Where(item => normalizedIds.Contains(item.UserId))
            .ToListAsync(cancellationToken);
    }

    public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        return _connectContext.SaveChangesAsync(cancellationToken);
    }

    private static string? NormalizeNullable(string? value)
    {
        var normalized = (value ?? string.Empty).Trim();
        return normalized.Length == 0 ? null : normalized;
    }
}
