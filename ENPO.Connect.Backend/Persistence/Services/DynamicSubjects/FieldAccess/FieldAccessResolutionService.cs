using Microsoft.EntityFrameworkCore;
using Models.Correspondance;
using Persistence.Data;
using Persistence.Services.DynamicSubjects;
using System.Globalization;

namespace Persistence.Services.DynamicSubjects.FieldAccess;

public sealed class FieldAccessResolutionService : IFieldAccessResolutionService
{
    private readonly ConnectContext _connectContext;
    private readonly GPAContext _gpaContext;

    public FieldAccessResolutionService(ConnectContext connectContext, GPAContext gpaContext)
    {
        _connectContext = connectContext;
        _gpaContext = gpaContext;
    }

    public async Task<FieldAccessResolutionResult> ResolveAsync(
        FieldAccessResolutionRequest request,
        CancellationToken cancellationToken = default)
    {
        var result = new FieldAccessResolutionResult();
        if (request == null || request.RequestTypeId <= 0)
        {
            return result;
        }

        var normalizedGroups = (request.Groups ?? Array.Empty<Models.DTO.DynamicSubjects.SubjectGroupDefinitionDto>())
            .Where(group => group != null)
            .GroupBy(group => group.GroupId)
            .Select(group => group.First())
            .ToList();
        var normalizedFields = (request.Fields ?? Array.Empty<Models.DTO.DynamicSubjects.SubjectFieldDefinitionDto>())
            .Where(field => field != null)
            .ToList();

        var policy = await _connectContext.FieldAccessPolicies
            .AsNoTracking()
            .Where(item => item.RequestTypeId == request.RequestTypeId && item.IsActive)
            .OrderByDescending(item => item.Id)
            .FirstOrDefaultAsync(cancellationToken);

        var rules = policy == null
            ? new List<FieldAccessPolicyRule>()
            : await _connectContext.FieldAccessPolicyRules
                .AsNoTracking()
                .Where(item => item.PolicyId == policy.Id && item.IsActive)
                .ToListAsync(cancellationToken);

        var locks = await _connectContext.FieldAccessLocks
            .AsNoTracking()
            .Where(item => item.RequestTypeId == request.RequestTypeId && item.IsActive)
            .ToListAsync(cancellationToken);

        var overrides = await _connectContext.FieldAccessOverrides
            .AsNoTracking()
            .Where(item => item.IsActive)
            .Where(item => !item.ExpiresAt.HasValue || item.ExpiresAt.Value >= DateTime.UtcNow)
            .Where(item => (item.RequestId.HasValue && request.RequestId.HasValue && item.RequestId.Value == request.RequestId.Value)
                || (item.RequestTypeId.HasValue && item.RequestTypeId.Value == request.RequestTypeId))
            .ToListAsync(cancellationToken);
        var candidateLegacyGroupIds = CollectCandidateLegacyGroupIds(rules, locks, overrides);
        var groupBridge = await SubjectCategoryGroupBridgeBuilder.BuildAsync(
            _connectContext,
            request.RequestTypeId,
            candidateLegacyGroupIds: candidateLegacyGroupIds,
            cancellationToken: cancellationToken);
        NormalizeGroupTargetIds(rules, locks, overrides, groupBridge);

        var subjectContext = await BuildSubjectContextAsync(request, cancellationToken);
        var (effectiveStageId, effectiveActionId) = await ResolveEffectiveWorkflowContextAsync(request, cancellationToken);
        var effectiveRequestContext = new FieldAccessResolutionRequest
        {
            RequestTypeId = request.RequestTypeId,
            RequestId = request.RequestId,
            StageId = effectiveStageId,
            ActionId = effectiveActionId,
            UserId = request.UserId
        };

        foreach (var group in normalizedGroups)
        {
            var state = new MutableState
            {
                IsHidden = false,
                IsReadOnly = false,
                IsRequired = false
            };

            ApplyDefaultMode(state, policy?.DefaultAccessMode);
            ApplyTargetPolicies(state, rules, overrides, subjectContext, effectiveRequestContext, "Request", request.RequestTypeId);
            ApplyTargetPolicies(state, rules, overrides, subjectContext, effectiveRequestContext, "Group", group.GroupId);
            var selectedGroupLock = SelectBestLock(locks, subjectContext, effectiveRequestContext, "Group", group.GroupId)
                ?? SelectBestLock(locks, subjectContext, effectiveRequestContext, "Request", request.RequestTypeId);
            ApplyLock(state, selectedGroupLock, subjectContext);

            result.GroupStates[group.GroupId] = state.ToResolved();
        }

        foreach (var field in normalizedFields)
        {
            var state = new MutableState
            {
                IsHidden = field.IsVisible == false,
                IsReadOnly = field.IsDisabledInit,
                IsRequired = field.Required
            };

            ApplyDefaultMode(state, policy?.DefaultAccessMode);
            ApplyTargetPolicies(state, rules, overrides, subjectContext, effectiveRequestContext, "Request", request.RequestTypeId);
            ApplyTargetPolicies(state, rules, overrides, subjectContext, effectiveRequestContext, "Group", field.MendGroup);
            ApplyTargetPolicies(state, rules, overrides, subjectContext, effectiveRequestContext, "Field", field.MendSql);

            var selectedLock = SelectBestLock(locks, subjectContext, effectiveRequestContext, "Field", field.MendSql)
                ?? SelectBestLock(locks, subjectContext, effectiveRequestContext, "Group", field.MendGroup)
                ?? SelectBestLock(locks, subjectContext, effectiveRequestContext, "Request", request.RequestTypeId);
            ApplyLock(state, selectedLock, subjectContext);

            var resolved = state.ToResolved();
            result.FieldStatesByMendSql[field.MendSql] = resolved;

            var normalizedFieldKey = NormalizeNullable(field.FieldKey);
            if (normalizedFieldKey != null)
            {
                result.FieldStatesByKey[normalizedFieldKey] = resolved;
            }
        }

        return result;
    }

    private async Task<(int? StageId, int? ActionId)> ResolveEffectiveWorkflowContextAsync(
        FieldAccessResolutionRequest request,
        CancellationToken cancellationToken)
    {
        var normalizedStageId = NormalizePositiveInt(request.StageId);
        var normalizedActionId = NormalizePositiveInt(request.ActionId);
        if (!request.ResolveMissingStageActionFromWorkflowStart
            || request.RequestTypeId <= 0
            || (normalizedStageId.HasValue && normalizedActionId.HasValue))
        {
            return (normalizedStageId, normalizedActionId);
        }

        var profileIds = await _connectContext.SubjectTypeRoutingBindings
            .AsNoTracking()
            .Where(item => item.SubjectTypeId == request.RequestTypeId && item.IsActive)
            .Select(item => item.RoutingProfileId)
            .Distinct()
            .ToListAsync(cancellationToken);

        if (profileIds.Count == 0)
        {
            profileIds = await _connectContext.SubjectRoutingProfiles
                .AsNoTracking()
                .Where(item => item.SubjectTypeId == request.RequestTypeId && item.IsActive)
                .Select(item => item.Id)
                .Distinct()
                .ToListAsync(cancellationToken);
        }

        if (profileIds.Count == 0)
        {
            return (normalizedStageId, normalizedActionId);
        }

        var activeProfiles = await _connectContext.SubjectRoutingProfiles
            .AsNoTracking()
            .Where(item => profileIds.Contains(item.Id) && item.IsActive)
            .ToListAsync(cancellationToken);
        var activeProfileIds = activeProfiles
            .Select(item => item.Id)
            .Distinct()
            .ToList();
        if (activeProfileIds.Count == 0)
        {
            return (normalizedStageId, normalizedActionId);
        }

        var activeSteps = await _connectContext.SubjectRoutingSteps
            .AsNoTracking()
            .Where(item => activeProfileIds.Contains(item.RoutingProfileId) && item.IsActive)
            .OrderBy(item => item.StepOrder)
            .ThenBy(item => item.Id)
            .ToListAsync(cancellationToken);
        if (activeSteps.Count == 0)
        {
            return (normalizedStageId, normalizedActionId);
        }

        if (!normalizedStageId.HasValue && normalizedActionId.HasValue)
        {
            var actionTransition = await _connectContext.SubjectRoutingTransitions
                .AsNoTracking()
                .Where(item => activeProfileIds.Contains(item.RoutingProfileId)
                    && item.IsActive
                    && item.Id == normalizedActionId.Value)
                .Select(item => new { item.FromStepId })
                .FirstOrDefaultAsync(cancellationToken);
            if (actionTransition != null && actionTransition.FromStepId > 0)
            {
                normalizedStageId = actionTransition.FromStepId;
            }
        }

        if (!normalizedStageId.HasValue)
        {
            var stepOrderById = activeSteps.ToDictionary(step => step.Id, step => (step.StepOrder, step.Id));
            var profileStartStepId = activeProfiles
                .Where(item => item.StartStepId.HasValue && stepOrderById.ContainsKey(item.StartStepId.Value))
                .Select(item => item.StartStepId!.Value)
                .OrderBy(item => stepOrderById[item].StepOrder)
                .ThenBy(item => stepOrderById[item].Id)
                .FirstOrDefault();
            if (profileStartStepId > 0)
            {
                normalizedStageId = profileStartStepId;
            }

            if (!normalizedStageId.HasValue)
            {
                var flaggedStartStepId = activeSteps
                    .Where(item => item.IsStart)
                    .OrderBy(item => item.StepOrder)
                    .ThenBy(item => item.Id)
                    .Select(item => item.Id)
                    .FirstOrDefault();
                if (flaggedStartStepId > 0)
                {
                    normalizedStageId = flaggedStartStepId;
                }
            }

            if (!normalizedStageId.HasValue)
            {
                var firstStepId = activeSteps
                    .OrderBy(item => item.StepOrder)
                    .ThenBy(item => item.Id)
                    .Select(item => item.Id)
                    .FirstOrDefault();
                if (firstStepId > 0)
                {
                    normalizedStageId = firstStepId;
                }
            }
        }

        if (!normalizedActionId.HasValue && normalizedStageId.HasValue)
        {
            var firstActionId = await _connectContext.SubjectRoutingTransitions
                .AsNoTracking()
                .Where(item => activeProfileIds.Contains(item.RoutingProfileId)
                    && item.IsActive
                    && item.FromStepId == normalizedStageId.Value)
                .OrderBy(item => item.DisplayOrder)
                .ThenBy(item => item.Id)
                .Select(item => item.Id)
                .FirstOrDefaultAsync(cancellationToken);
            if (firstActionId > 0)
            {
                normalizedActionId = firstActionId;
            }
        }

        return (normalizedStageId, normalizedActionId);
    }

    private static void ApplyTargetPolicies(
        MutableState state,
        IReadOnlyCollection<FieldAccessPolicyRule> rules,
        IReadOnlyCollection<FieldAccessOverride> overrides,
        SubjectContext subjectContext,
        FieldAccessResolutionRequest request,
        string targetLevel,
        int targetId)
    {
        if (targetId <= 0)
        {
            return;
        }

        var visibilityOverride = SelectBestOverride(overrides, subjectContext, request, targetLevel, targetId, "visibility");
        if (visibilityOverride != null)
        {
            var description = BuildOverrideDescriptionAr(visibilityOverride, targetLevel, targetId, "visibility");
            ApplyPermission(state, visibilityOverride.OverridePermissionType, effect: "Allow", permissionKind: "visibility", sourceType: "Override", reasonAr: description);
            state.AppliedTraces.Add(new FieldAccessAppliedTrace
            {
                SourceType = "Override",
                PermissionKind = "visibility",
                TargetLevel = targetLevel,
                TargetId = targetId,
                OverrideId = visibilityOverride.Id,
                RuleId = visibilityOverride.RuleId,
                PermissionType = visibilityOverride.OverridePermissionType,
                Effect = "Allow",
                SubjectType = visibilityOverride.SubjectType,
                SubjectId = visibilityOverride.SubjectId,
                Notes = visibilityOverride.Reason,
                DescriptionAr = description
            });
        }
        else
        {
            var visibilityRule = SelectBestRule(rules, subjectContext, request, targetLevel, targetId, "visibility");
            if (visibilityRule != null)
            {
                var sourceType = ResolveRuleSourceType(visibilityRule.StageId, visibilityRule.ActionId);
                var description = BuildRuleDescriptionAr(visibilityRule, targetLevel, targetId, "visibility");
                ApplyPermission(state, visibilityRule.PermissionType, visibilityRule.Effect, permissionKind: "visibility", sourceType, description);
                state.AppliedTraces.Add(new FieldAccessAppliedTrace
                {
                    SourceType = sourceType,
                    PermissionKind = "visibility",
                    TargetLevel = targetLevel,
                    TargetId = targetId,
                    StageId = visibilityRule.StageId,
                    ActionId = visibilityRule.ActionId,
                    RuleId = visibilityRule.Id,
                    PermissionType = visibilityRule.PermissionType,
                    Effect = visibilityRule.Effect,
                    SubjectType = visibilityRule.SubjectType,
                    SubjectId = visibilityRule.SubjectId,
                    Notes = visibilityRule.Notes,
                    DescriptionAr = description
                });
            }
        }

        var requirementOverride = SelectBestOverride(overrides, subjectContext, request, targetLevel, targetId, "requirement");
        if (requirementOverride != null)
        {
            var description = BuildOverrideDescriptionAr(requirementOverride, targetLevel, targetId, "requirement");
            ApplyPermission(state, requirementOverride.OverridePermissionType, effect: "Allow", permissionKind: "requirement", sourceType: "Override", reasonAr: description);
            state.AppliedTraces.Add(new FieldAccessAppliedTrace
            {
                SourceType = "Override",
                PermissionKind = "requirement",
                TargetLevel = targetLevel,
                TargetId = targetId,
                OverrideId = requirementOverride.Id,
                RuleId = requirementOverride.RuleId,
                PermissionType = requirementOverride.OverridePermissionType,
                Effect = "Allow",
                SubjectType = requirementOverride.SubjectType,
                SubjectId = requirementOverride.SubjectId,
                Notes = requirementOverride.Reason,
                DescriptionAr = description
            });
        }
        else
        {
            var requirementRule = SelectBestRule(rules, subjectContext, request, targetLevel, targetId, "requirement");
            if (requirementRule != null)
            {
                var sourceType = ResolveRuleSourceType(requirementRule.StageId, requirementRule.ActionId);
                var description = BuildRuleDescriptionAr(requirementRule, targetLevel, targetId, "requirement");
                ApplyPermission(state, requirementRule.PermissionType, requirementRule.Effect, permissionKind: "requirement", sourceType, description);
                state.AppliedTraces.Add(new FieldAccessAppliedTrace
                {
                    SourceType = sourceType,
                    PermissionKind = "requirement",
                    TargetLevel = targetLevel,
                    TargetId = targetId,
                    StageId = requirementRule.StageId,
                    ActionId = requirementRule.ActionId,
                    RuleId = requirementRule.Id,
                    PermissionType = requirementRule.PermissionType,
                    Effect = requirementRule.Effect,
                    SubjectType = requirementRule.SubjectType,
                    SubjectId = requirementRule.SubjectId,
                    Notes = requirementRule.Notes,
                    DescriptionAr = description
                });
            }
        }
    }

    private static FieldAccessPolicyRule? SelectBestRule(
        IReadOnlyCollection<FieldAccessPolicyRule> rules,
        SubjectContext subjectContext,
        FieldAccessResolutionRequest request,
        string targetLevel,
        int targetId,
        string permissionKind)
    {
        return rules
            .Where(rule => MatchesTarget(rule.TargetLevel, rule.TargetId, targetLevel, targetId))
            .Where(rule => MatchesPermissionKind(rule.PermissionType, permissionKind))
            .Where(rule => MatchesSubject(rule.SubjectType, rule.SubjectId, subjectContext))
            .Select(rule => new
            {
                Rule = rule,
                Rank = GetRuleContextRank(rule.StageId, rule.ActionId, request.StageId, request.ActionId)
            })
            .Where(item => item.Rank > 0)
            .OrderByDescending(item => item.Rank)
            .ThenByDescending(item => item.Rule.Priority)
            .ThenByDescending(item => item.Rule.Id)
            .Select(item => item.Rule)
            .FirstOrDefault();
    }

    private static FieldAccessOverride? SelectBestOverride(
        IReadOnlyCollection<FieldAccessOverride> overrides,
        SubjectContext subjectContext,
        FieldAccessResolutionRequest request,
        string targetLevel,
        int targetId,
        string permissionKind)
    {
        return overrides
            .Where(item => MatchesRequestScope(item, request))
            .Where(item => MatchesTarget(item.TargetLevel, item.TargetId ?? 0, targetLevel, targetId))
            .Where(item => MatchesPermissionKind(item.OverridePermissionType, permissionKind))
            .Where(item => MatchesSubject(item.SubjectType, item.SubjectId, subjectContext))
            .OrderByDescending(item => item.GrantedAt)
            .ThenByDescending(item => item.Id)
            .FirstOrDefault();
    }

    private static FieldAccessLock? SelectBestLock(
        IReadOnlyCollection<FieldAccessLock> locks,
        SubjectContext subjectContext,
        FieldAccessResolutionRequest request,
        string targetLevel,
        int targetId)
    {
        if (targetId <= 0)
        {
            return null;
        }

        return locks
            .Where(item => MatchesTarget(item.TargetLevel, item.TargetId, targetLevel, targetId))
            .Select(item => new
            {
                Lock = item,
                Rank = GetRuleContextRank(item.StageId, item.ActionId, request.StageId, request.ActionId)
            })
            .Where(item => item.Rank > 0)
            .OrderByDescending(item => item.Rank)
            .ThenByDescending(item => LockSeverityRank(item.Lock.LockMode))
            .ThenByDescending(item => item.Lock.Id)
            .Select(item => item.Lock)
            .FirstOrDefault(item => !CanBypassLock(item, subjectContext));
    }

    private static bool MatchesRequestScope(FieldAccessOverride item, FieldAccessResolutionRequest request)
    {
        if (item == null)
        {
            return false;
        }

        if (item.RequestId.HasValue && request.RequestId.HasValue)
        {
            return item.RequestId.Value == request.RequestId.Value;
        }

        if (item.RequestTypeId.HasValue)
        {
            return item.RequestTypeId.Value == request.RequestTypeId;
        }

        return false;
    }

    private static void NormalizeGroupTargetIds(
        IReadOnlyCollection<FieldAccessPolicyRule> rules,
        IReadOnlyCollection<FieldAccessLock> locks,
        IReadOnlyCollection<FieldAccessOverride> overrides,
        SubjectCategoryGroupBridge groupBridge)
    {
        foreach (var rule in rules ?? Array.Empty<FieldAccessPolicyRule>())
        {
            if (IsGroupTargetLevel(rule.TargetLevel) && rule.TargetId > 0)
            {
                rule.TargetId = groupBridge.ResolveCanonicalGroupId(rule.TargetId);
            }
        }

        foreach (var lockItem in locks ?? Array.Empty<FieldAccessLock>())
        {
            if (IsGroupTargetLevel(lockItem.TargetLevel) && lockItem.TargetId > 0)
            {
                lockItem.TargetId = groupBridge.ResolveCanonicalGroupId(lockItem.TargetId);
            }
        }

        foreach (var overrideItem in overrides ?? Array.Empty<FieldAccessOverride>())
        {
            if (IsGroupTargetLevel(overrideItem.TargetLevel)
                && overrideItem.TargetId.HasValue
                && overrideItem.TargetId.Value > 0)
            {
                overrideItem.TargetId = groupBridge.ResolveCanonicalGroupId(overrideItem.TargetId.Value);
            }
        }
    }

    private static IReadOnlyCollection<int> CollectCandidateLegacyGroupIds(
        IReadOnlyCollection<FieldAccessPolicyRule> rules,
        IReadOnlyCollection<FieldAccessLock> locks,
        IReadOnlyCollection<FieldAccessOverride> overrides)
    {
        var candidateIds = new HashSet<int>();

        foreach (var rule in rules ?? Array.Empty<FieldAccessPolicyRule>())
        {
            if (IsGroupTargetLevel(rule.TargetLevel) && rule.TargetId > 0)
            {
                candidateIds.Add(rule.TargetId);
            }
        }

        foreach (var lockItem in locks ?? Array.Empty<FieldAccessLock>())
        {
            if (IsGroupTargetLevel(lockItem.TargetLevel) && lockItem.TargetId > 0)
            {
                candidateIds.Add(lockItem.TargetId);
            }
        }

        foreach (var overrideItem in overrides ?? Array.Empty<FieldAccessOverride>())
        {
            if (IsGroupTargetLevel(overrideItem.TargetLevel)
                && overrideItem.TargetId.HasValue
                && overrideItem.TargetId.Value > 0)
            {
                candidateIds.Add(overrideItem.TargetId.Value);
            }
        }

        return candidateIds
            .OrderBy(item => item)
            .ToArray();
    }

    private static bool IsGroupTargetLevel(string? targetLevel)
    {
        return string.Equals(NormalizeLevel(targetLevel), "group", StringComparison.OrdinalIgnoreCase);
    }

    private static bool MatchesTarget(string? sourceTargetLevel, int sourceTargetId, string expectedTargetLevel, int expectedTargetId)
    {
        if (expectedTargetId <= 0)
        {
            return false;
        }

        var normalizedLevel = NormalizeLevel(sourceTargetLevel);
        var normalizedExpectedLevel = NormalizeLevel(expectedTargetLevel);
        return normalizedLevel == normalizedExpectedLevel && sourceTargetId == expectedTargetId;
    }

    private static bool MatchesPermissionKind(string? permissionType, string permissionKind)
    {
        var normalizedPermission = NormalizePermission(permissionType);
        if (permissionKind == "requirement")
        {
            return normalizedPermission == "requiredinput";
        }

        return normalizedPermission == "hidden"
            || normalizedPermission == "readonly"
            || normalizedPermission == "editable";
    }

    private static int GetRuleContextRank(int? stageId, int? actionId, int? requestedStageId, int? requestedActionId)
    {
        if (actionId.HasValue)
        {
            if (!requestedActionId.HasValue || requestedActionId.Value != actionId.Value)
            {
                return 0;
            }

            if (stageId.HasValue && (!requestedStageId.HasValue || requestedStageId.Value != stageId.Value))
            {
                return 0;
            }

            return 3;
        }

        if (stageId.HasValue)
        {
            return requestedStageId.HasValue && requestedStageId.Value == stageId.Value
                ? 2
                : 0;
        }

        return 1;
    }

    private static int LockSeverityRank(string? lockMode)
    {
        return NormalizeLockMode(lockMode) switch
        {
            "fulllock" => 3,
            "noinput" => 2,
            "noedit" => 1,
            _ => 0
        };
    }

    private static bool CanBypassLock(FieldAccessLock lockItem, SubjectContext subjectContext)
    {
        var subjectType = NormalizeSubjectType(lockItem.AllowedOverrideSubjectType);
        if (subjectType == null)
        {
            return false;
        }

        var subjectId = NormalizeNullable(lockItem.AllowedOverrideSubjectId);

        if (subjectType == "user")
        {
            if (subjectContext.UserId == null)
            {
                return false;
            }

            return subjectId == null || string.Equals(subjectContext.UserId, subjectId, StringComparison.OrdinalIgnoreCase);
        }

        if (subjectType == "orgunit")
        {
            if (subjectId == null)
            {
                return false;
            }

            return subjectContext.OrgUnitIds.Contains(subjectId);
        }

        if (subjectType == "position")
        {
            if (subjectId == null)
            {
                return false;
            }

            return subjectContext.PositionIds.Contains(subjectId);
        }

        if (subjectType == "requestowner")
        {
            return subjectContext.IsRequestOwner;
        }

        if (subjectType == "currentcustodian")
        {
            if (!subjectContext.IsCurrentCustodian)
            {
                return false;
            }

            return subjectId == null
                || string.Equals(subjectContext.CurrentCustodianUnitId, subjectId, StringComparison.OrdinalIgnoreCase);
        }

        return false;
    }

    private static bool MatchesSubject(string? subjectType, string? subjectId, SubjectContext context)
    {
        var normalizedType = NormalizeSubjectType(subjectType);
        if (normalizedType == null)
        {
            return false;
        }

        var normalizedSubjectId = NormalizeNullable(subjectId);

        if (normalizedType == "orgunit")
        {
            if (normalizedSubjectId == null)
            {
                return false;
            }

            return context.OrgUnitIds.Contains(normalizedSubjectId);
        }

        if (normalizedType == "position")
        {
            if (normalizedSubjectId == null)
            {
                return false;
            }

            return context.PositionIds.Contains(normalizedSubjectId);
        }

        if (normalizedType == "user")
        {
            if (context.UserId == null)
            {
                return false;
            }

            return normalizedSubjectId != null
                && string.Equals(context.UserId, normalizedSubjectId, StringComparison.OrdinalIgnoreCase);
        }

        if (normalizedType == "requestowner")
        {
            return context.IsRequestOwner;
        }

        if (normalizedType == "currentcustodian")
        {
            if (!context.IsCurrentCustodian)
            {
                return false;
            }

            if (normalizedSubjectId == null)
            {
                return true;
            }

            return string.Equals(context.CurrentCustodianUnitId, normalizedSubjectId, StringComparison.OrdinalIgnoreCase);
        }

        return false;
    }

    private static void ApplyDefaultMode(MutableState state, string? defaultAccessMode)
    {
        var normalizedMode = NormalizePermission(defaultAccessMode);
        if (normalizedMode.Length == 0)
        {
            return;
        }

        var visibilityDescription = BuildDefaultPolicyDescriptionAr(defaultAccessMode, "visibility");
        ApplyPermission(
            state,
            normalizedMode,
            effect: "Allow",
            permissionKind: "visibility",
            sourceType: "DefaultPolicy",
            reasonAr: visibilityDescription);
        state.AppliedTraces.Add(new FieldAccessAppliedTrace
        {
            SourceType = "DefaultPolicy",
            PermissionKind = "visibility",
            TargetLevel = "Request",
            TargetId = 0,
            PermissionType = defaultAccessMode,
            Effect = "Allow",
            DescriptionAr = visibilityDescription
        });

        if (normalizedMode == "requiredinput")
        {
            var requirementDescription = BuildDefaultPolicyDescriptionAr(defaultAccessMode, "requirement");
            ApplyPermission(
                state,
                normalizedMode,
                effect: "Allow",
                permissionKind: "requirement",
                sourceType: "DefaultPolicy",
                reasonAr: requirementDescription);
            state.AppliedTraces.Add(new FieldAccessAppliedTrace
            {
                SourceType = "DefaultPolicy",
                PermissionKind = "requirement",
                TargetLevel = "Request",
                TargetId = 0,
                PermissionType = defaultAccessMode,
                Effect = "Allow",
                DescriptionAr = requirementDescription
            });
        }
    }

    private static void ApplyPermission(
        MutableState state,
        string? permissionType,
        string? effect,
        string permissionKind,
        string sourceType,
        string? reasonAr)
    {
        var normalizedPermission = NormalizePermission(permissionType);
        if (normalizedPermission.Length == 0)
        {
            return;
        }

        var normalizedEffect = NormalizeNullable(effect)?.ToLowerInvariant() ?? "allow";
        if (permissionKind == "requirement")
        {
            if (normalizedPermission != "requiredinput")
            {
                return;
            }

            state.IsRequired = normalizedEffect == "deny" ? false : true;
            state.LastRequirementSourceType = sourceType;
            state.LastRequirementReasonAr = reasonAr;
            return;
        }

        if (normalizedEffect == "deny")
        {
            normalizedPermission = normalizedPermission switch
            {
                "editable" => "readonly",
                "readonly" => "hidden",
                _ => normalizedPermission
            };
        }

        if (normalizedPermission == "hidden")
        {
            state.IsHidden = true;
            state.IsReadOnly = true;
            state.IsRequired = false;
            state.LastVisibilitySourceType = sourceType;
            state.LastVisibilityReasonAr = reasonAr;
            return;
        }

        if (normalizedPermission == "readonly")
        {
            state.IsHidden = false;
            state.IsReadOnly = true;
            state.LastVisibilitySourceType = sourceType;
            state.LastVisibilityReasonAr = reasonAr;
            return;
        }

        if (normalizedPermission == "editable")
        {
            state.IsHidden = false;
            state.IsReadOnly = false;
            state.LastVisibilitySourceType = sourceType;
            state.LastVisibilityReasonAr = reasonAr;
        }
    }

    private static void ApplyLock(MutableState state, FieldAccessLock? lockItem, SubjectContext subjectContext)
    {
        if (lockItem == null || CanBypassLock(lockItem, subjectContext))
        {
            return;
        }

        state.IsLocked = true;
        state.LockReason = NormalizeNullable(lockItem.Notes)
            ?? BuildLockReason(lockItem.LockMode);
        state.LastLockSourceType = "Lock";
        state.LastLockReasonAr = state.LockReason;
        state.AppliedTraces.Add(new FieldAccessAppliedTrace
        {
            SourceType = "Lock",
            PermissionKind = "lock",
            TargetLevel = lockItem.TargetLevel,
            TargetId = lockItem.TargetId,
            StageId = lockItem.StageId,
            ActionId = lockItem.ActionId,
            LockId = lockItem.Id,
            LockMode = lockItem.LockMode,
            SubjectType = lockItem.AllowedOverrideSubjectType,
            SubjectId = lockItem.AllowedOverrideSubjectId,
            Notes = lockItem.Notes,
            DescriptionAr = BuildLockDescriptionAr(lockItem)
        });

        var normalizedMode = NormalizeLockMode(lockItem.LockMode);
        if (normalizedMode == "fulllock")
        {
            state.IsHidden = true;
            state.IsReadOnly = true;
            state.IsRequired = false;
            return;
        }

        if (normalizedMode == "noinput")
        {
            state.IsReadOnly = true;
            state.IsRequired = false;
            return;
        }

        if (normalizedMode == "noedit")
        {
            state.IsReadOnly = true;
        }
    }

    private static string BuildLockReason(string? lockMode)
    {
        return NormalizeLockMode(lockMode) switch
        {
            "fulllock" => "الهدف مقفل بالكامل في هذه المرحلة/الإجراء.",
            "noinput" => "الهدف لا يقبل إدخال بيانات في هذه المرحلة/الإجراء.",
            _ => "الهدف للقراءة فقط في هذه المرحلة/الإجراء."
        };
    }

    private static string BuildDefaultPolicyDescriptionAr(string? defaultAccessMode, string permissionKind)
    {
        var permissionLabel = PermissionLabelAr(defaultAccessMode);
        if (permissionKind == "requirement")
        {
            return $"تأثير Requirement من السياسة الافتراضية: {permissionLabel}.";
        }

        return $"تأثير Visibility من السياسة الافتراضية: {permissionLabel}.";
    }

    private static string BuildRuleDescriptionAr(FieldAccessPolicyRule rule, string targetLevel, int targetId, string permissionKind)
    {
        var scopeLabel = RuleScopeLabelAr(rule.StageId, rule.ActionId);
        var permissionLabel = PermissionLabelAr(rule.PermissionType);
        var effectLabel = EffectLabelAr(rule.Effect);
        var kindLabel = permissionKind == "requirement" ? "Requirement" : "Visibility";
        var subjectLabel = SubjectLabelAr(rule.SubjectType, rule.SubjectId);
        return $"{scopeLabel} ({kindLabel}) على {TargetLabelAr(targetLevel)} #{targetId}: {permissionLabel} ({effectLabel}) للجهة {subjectLabel}.";
    }

    private static string BuildOverrideDescriptionAr(FieldAccessOverride item, string targetLevel, int targetId, string permissionKind)
    {
        var permissionLabel = PermissionLabelAr(item.OverridePermissionType);
        var kindLabel = permissionKind == "requirement" ? "Requirement" : "Visibility";
        var subjectLabel = SubjectLabelAr(item.SubjectType, item.SubjectId);
        var reason = NormalizeNullable(item.Reason);
        return reason == null
            ? $"Override ({kindLabel}) على {TargetLabelAr(targetLevel)} #{targetId}: {permissionLabel} للجهة {subjectLabel}."
            : $"Override ({kindLabel}) على {TargetLabelAr(targetLevel)} #{targetId}: {permissionLabel} للجهة {subjectLabel}. السبب: {reason}.";
    }

    private static string BuildLockDescriptionAr(FieldAccessLock item)
    {
        var modeLabel = LockModeLabelAr(item.LockMode);
        var targetLabel = TargetLabelAr(item.TargetLevel);
        var notes = NormalizeNullable(item.Notes);
        return notes == null
            ? $"Lock ({modeLabel}) مطبق على {targetLabel} #{item.TargetId}."
            : $"Lock ({modeLabel}) مطبق على {targetLabel} #{item.TargetId}. السبب: {notes}.";
    }

    private static string ResolveRuleSourceType(int? stageId, int? actionId)
    {
        if (actionId.HasValue)
        {
            return "ActionRule";
        }

        if (stageId.HasValue)
        {
            return "StageRule";
        }

        return "Rule";
    }

    private static string PermissionLabelAr(string? permissionType)
    {
        return NormalizePermission(permissionType) switch
        {
            "hidden" => "مخفي",
            "readonly" => "قراءة فقط",
            "requiredinput" => "إدخال إلزامي",
            _ => "قابل للتعديل"
        };
    }

    private static string LockModeLabelAr(string? lockMode)
    {
        return NormalizeLockMode(lockMode) switch
        {
            "fulllock" => "قفل كامل",
            "noinput" => "منع إدخال",
            _ => "منع تعديل"
        };
    }

    private static string EffectLabelAr(string? effect)
    {
        var normalized = NormalizeNullable(effect)?.ToLowerInvariant();
        return normalized == "deny" ? "منع" : "سماح";
    }

    private static string TargetLabelAr(string? targetLevel)
    {
        return NormalizeLevel(targetLevel) switch
        {
            "request" => "نوع الطلب",
            "group" => "المجموعة",
            _ => "الحقل"
        };
    }

    private static string SubjectLabelAr(string? subjectType, string? subjectId)
    {
        var typeLabel = NormalizeSubjectType(subjectType) switch
        {
            "orgunit" => "وحدة تنظيمية",
            "position" => "منصب",
            "user" => "مستخدم",
            "requestowner" => "منشئ الطلب",
            "currentcustodian" => "الحاضن الحالي",
            _ => "جهة غير معروفة"
        };

        var normalizedSubjectId = NormalizeNullable(subjectId);
        return normalizedSubjectId == null ? typeLabel : $"{typeLabel} ({normalizedSubjectId})";
    }

    private static string RuleScopeLabelAr(int? stageId, int? actionId)
    {
        if (actionId.HasValue)
        {
            return "Action Rule";
        }

        if (stageId.HasValue)
        {
            return "Stage Rule";
        }

        return "Rule عامة";
    }

    private async Task<SubjectContext> BuildSubjectContextAsync(
        FieldAccessResolutionRequest request,
        CancellationToken cancellationToken)
    {
        var overrideContext = request.SubjectContextOverride;
        if (overrideContext != null && NormalizeSubjectType(overrideContext.SubjectType) != null)
        {
            return BuildSubjectContextFromOverride(overrideContext);
        }

        var normalizedUserId = NormalizeNullable(request.UserId);
        var today = DateTime.Today;

        var positions = normalizedUserId == null
            ? new List<Models.GPA.OrgStructure.UserPosition>()
            : await _gpaContext.UserPositions
                .AsNoTracking()
                .Where(position => position.UserId == normalizedUserId
                    && position.IsActive != false
                    && (!position.StartDate.HasValue || position.StartDate.Value <= today)
                    && (!position.EndDate.HasValue || position.EndDate.Value >= today))
                .ToListAsync(cancellationToken);

        var unitIds = positions
            .Select(position => position.UnitId.ToString(CultureInfo.InvariantCulture))
            .Select(id => NormalizeNullable(id))
            .Where(id => id != null)
            .Select(id => id!)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var positionIds = positions
            .Select(position => position.PositionId.ToString(CultureInfo.InvariantCulture))
            .Select(id => NormalizeNullable(id))
            .Where(id => id != null)
            .Select(id => id!)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var message = request.Message;
        var normalizedMessageCreatedBy = NormalizeNullable(message?.CreatedBy);
        var messageActorId = NormalizeMessageActorId(request.UserId);
        var normalizedMessageActorId = NormalizeNullable(messageActorId);
        var isRequestOwner = message == null
            ? true
            : normalizedUserId != null
                && (string.Equals(normalizedMessageCreatedBy, normalizedUserId, StringComparison.OrdinalIgnoreCase)
                    || string.Equals(normalizedMessageCreatedBy, normalizedMessageActorId, StringComparison.OrdinalIgnoreCase));

        var currentCustodianUnitId = NormalizeNullable(message?.CurrentResponsibleSectorId);
        var isCurrentCustodian = currentCustodianUnitId != null
            && unitIds.Contains(currentCustodianUnitId);

        return new SubjectContext
        {
            UserId = normalizedUserId,
            OrgUnitIds = unitIds,
            PositionIds = positionIds,
            IsRequestOwner = isRequestOwner,
            IsCurrentCustodian = isCurrentCustodian,
            CurrentCustodianUnitId = currentCustodianUnitId
        };
    }

    private static SubjectContext BuildSubjectContextFromOverride(FieldAccessSubjectContextOverride overrideContext)
    {
        var context = new SubjectContext();
        var normalizedType = NormalizeSubjectType(overrideContext.SubjectType);
        var normalizedSubjectId = NormalizeNullable(overrideContext.SubjectId);

        if (normalizedType == "orgunit" && normalizedSubjectId != null)
        {
            context.OrgUnitIds.Add(normalizedSubjectId);
        }
        else if (normalizedType == "position" && normalizedSubjectId != null)
        {
            context.PositionIds.Add(normalizedSubjectId);
        }
        else if (normalizedType == "user" && normalizedSubjectId != null)
        {
            context.UserId = normalizedSubjectId;
        }
        else if (normalizedType == "requestowner")
        {
            context.IsRequestOwner = true;
            context.UserId = NormalizeNullable(overrideContext.RequestOwnerUserId) ?? normalizedSubjectId;
        }
        else if (normalizedType == "currentcustodian")
        {
            context.IsCurrentCustodian = true;
            context.CurrentCustodianUnitId = NormalizeNullable(overrideContext.CurrentCustodianUnitId) ?? normalizedSubjectId;
            if (context.CurrentCustodianUnitId != null)
            {
                context.OrgUnitIds.Add(context.CurrentCustodianUnitId);
            }
        }

        var requestOwnerUserId = NormalizeNullable(overrideContext.RequestOwnerUserId);
        if (requestOwnerUserId != null)
        {
            context.IsRequestOwner = true;
            context.UserId ??= requestOwnerUserId;
        }

        var currentCustodianUnitId = NormalizeNullable(overrideContext.CurrentCustodianUnitId);
        if (currentCustodianUnitId != null)
        {
            context.IsCurrentCustodian = true;
            context.CurrentCustodianUnitId = currentCustodianUnitId;
            context.OrgUnitIds.Add(currentCustodianUnitId);
        }

        return context;
    }

    private static int? NormalizePositiveInt(int? value)
    {
        return value.HasValue && value.Value > 0
            ? value.Value
            : null;
    }

    private static string NormalizePermission(string? permissionType)
    {
        var normalized = NormalizeNullable(permissionType)?.ToLowerInvariant() ?? string.Empty;
        return normalized.Replace("_", string.Empty).Replace("-", string.Empty).Replace(" ", string.Empty);
    }

    private static string NormalizeLockMode(string? lockMode)
    {
        var normalized = NormalizeNullable(lockMode)?.ToLowerInvariant() ?? string.Empty;
        return normalized.Replace("_", string.Empty).Replace("-", string.Empty).Replace(" ", string.Empty);
    }

    private static string NormalizeLevel(string? level)
    {
        var normalized = NormalizeNullable(level)?.ToLowerInvariant() ?? string.Empty;
        if (normalized.StartsWith("request"))
        {
            return "request";
        }

        if (normalized.StartsWith("group"))
        {
            return "group";
        }

        return "field";
    }

    private static string? NormalizeSubjectType(string? subjectType)
    {
        var normalized = NormalizeNullable(subjectType)?.ToLowerInvariant();
        if (normalized == null)
        {
            return null;
        }

        return normalized switch
        {
            "orgunit" => "orgunit",
            "position" => "position",
            "user" => "user",
            "requestowner" => "requestowner",
            "currentcustodian" => "currentcustodian",
            _ => null
        };
    }

    private static string? NormalizeNullable(string? value)
    {
        var normalized = (value ?? string.Empty).Trim();
        return normalized.Length == 0 ? null : normalized;
    }

    private static string NormalizeMessageActorId(string? userId)
    {
        var normalized = NormalizeNullable(userId) ?? string.Empty;
        if (normalized.Length <= 20)
        {
            return normalized;
        }

        return normalized[..20];
    }

    private sealed class SubjectContext
    {
        public string? UserId { get; set; }

        public HashSet<string> OrgUnitIds { get; set; } = new(StringComparer.OrdinalIgnoreCase);

        public HashSet<string> PositionIds { get; set; } = new(StringComparer.OrdinalIgnoreCase);

        public bool IsRequestOwner { get; set; }

        public bool IsCurrentCustodian { get; set; }

        public string? CurrentCustodianUnitId { get; set; }
    }

    private sealed class MutableState
    {
        public bool IsHidden { get; set; }

        public bool IsReadOnly { get; set; }

        public bool IsRequired { get; set; }

        public bool IsLocked { get; set; }

        public string? LockReason { get; set; }

        public string? LastVisibilitySourceType { get; set; }

        public string? LastVisibilityReasonAr { get; set; }

        public string? LastRequirementSourceType { get; set; }

        public string? LastRequirementReasonAr { get; set; }

        public string? LastLockSourceType { get; set; }

        public string? LastLockReasonAr { get; set; }

        public List<FieldAccessAppliedTrace> AppliedTraces { get; } = new();

        public FieldAccessResolvedState ToResolved()
        {
            if (IsHidden)
            {
                var sourceType = LastLockSourceType ?? LastVisibilitySourceType ?? "DefaultPolicy";
                var reasonAr = LastLockReasonAr ?? LastVisibilityReasonAr ?? "تم تطبيق سياسة الإخفاء.";
                return new FieldAccessResolvedState
                {
                    CanView = false,
                    CanEdit = false,
                    CanFill = false,
                    IsHidden = true,
                    IsReadOnly = true,
                    IsRequired = false,
                    IsLocked = IsLocked,
                    LockReason = LockReason,
                    FinalStateCode = "Hidden",
                    EffectiveSourceType = sourceType,
                    EffectiveReasonAr = reasonAr,
                    AppliedTraces = AppliedTraces.ToList()
                };
            }

            var effectiveReadOnly = IsReadOnly;
            var effectiveRequired = IsRequired && !effectiveReadOnly;
            var finalStateCode = effectiveReadOnly
                ? "ReadOnly"
                : effectiveRequired
                    ? "RequiredInput"
                    : "Editable";
            var source = finalStateCode switch
            {
                "ReadOnly" => LastLockSourceType ?? LastVisibilitySourceType ?? "DefaultPolicy",
                "RequiredInput" => LastRequirementSourceType ?? LastVisibilitySourceType ?? "DefaultPolicy",
                _ => LastVisibilitySourceType ?? "DefaultPolicy"
            };
            var reason = finalStateCode switch
            {
                "ReadOnly" => LastLockReasonAr ?? LastVisibilityReasonAr ?? "تم تطبيق القراءة فقط.",
                "RequiredInput" => LastRequirementReasonAr ?? LastVisibilityReasonAr ?? "تم تطبيق الإدخال الإلزامي.",
                _ => LastVisibilityReasonAr ?? "تم تطبيق الوضع القابل للتعديل."
            };

            return new FieldAccessResolvedState
            {
                CanView = true,
                CanEdit = !effectiveReadOnly,
                CanFill = !effectiveReadOnly,
                IsHidden = false,
                IsReadOnly = effectiveReadOnly,
                IsRequired = effectiveRequired,
                IsLocked = IsLocked,
                LockReason = LockReason,
                FinalStateCode = finalStateCode,
                EffectiveSourceType = source,
                EffectiveReasonAr = reason,
                AppliedTraces = AppliedTraces.ToList()
            };
        }
    }
}
