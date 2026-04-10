using Microsoft.EntityFrameworkCore;
using Models.Correspondance;
using Models.DTO.Common;
using Models.DTO.DynamicSubjects;
using Persistence.Data;
using Persistence.Services.DynamicSubjects;
using Persistence.Services.DynamicSubjects.AdminCatalog;
using Persistence.Services.DynamicSubjects.FieldAccess;

namespace Persistence.Services.DynamicSubjects.AdminAccessPolicy;

public sealed class DynamicSubjectsAdminAccessPolicyService : IDynamicSubjectsAdminAccessPolicyService
{
    private readonly ConnectContext _connectContext;
    private readonly IFieldAccessResolutionService _resolutionService;
    private readonly IAdminControlCenterRequestPreviewCache _requestPreviewCache;

    public DynamicSubjectsAdminAccessPolicyService(
        ConnectContext connectContext,
        IFieldAccessResolutionService resolutionService,
        IAdminControlCenterRequestPreviewCache requestPreviewCache)
    {
        _connectContext = connectContext;
        _resolutionService = resolutionService;
        _requestPreviewCache = requestPreviewCache;
    }

    public async Task<CommonResponse<FieldAccessPolicyWorkspaceDto>> GetWorkspaceAsync(
        int requestTypeId,
        string userId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<FieldAccessPolicyWorkspaceDto>();
        try
        {
            var normalizedUserId = NormalizeNullable(userId);
            if (normalizedUserId == null)
            {
                AddUnauthorized(response);
                return response;
            }

            if (requestTypeId <= 0)
            {
                response.Errors.Add(new Error { Code = "400", Message = "نوع الطلب مطلوب." });
                return response;
            }

            var workspace = await BuildWorkspaceAsync(requestTypeId, cancellationToken);
            if (workspace == null)
            {
                response.Errors.Add(new Error { Code = "404", Message = "نوع الطلب غير موجود." });
                return response;
            }

            response.Data = workspace;
        }
        catch
        {
            AddUnhandled(response);
        }

        return response;
    }

    public async Task<CommonResponse<FieldAccessPolicyWorkspaceDto>> UpsertWorkspaceAsync(
        int requestTypeId,
        FieldAccessPolicyWorkspaceUpsertRequestDto request,
        string userId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<FieldAccessPolicyWorkspaceDto>();
        try
        {
            var normalizedUserId = NormalizeNullable(userId);
            if (normalizedUserId == null)
            {
                AddUnauthorized(response);
                return response;
            }

            if (requestTypeId <= 0)
            {
                response.Errors.Add(new Error { Code = "400", Message = "نوع الطلب مطلوب." });
                return response;
            }

            var category = await _connectContext.Cdcategories
                .FirstOrDefaultAsync(item => item.CatId == requestTypeId, cancellationToken);
            if (category == null)
            {
                response.Errors.Add(new Error { Code = "404", Message = "نوع الطلب غير موجود." });
                return response;
            }

            var safeRequest = request ?? new FieldAccessPolicyWorkspaceUpsertRequestDto();
            var policyName = NormalizeNullable(safeRequest.PolicyName) ?? $"سياسة الوصول - {requestTypeId}";
            var defaultAccessMode = NormalizeAccessMode(safeRequest.DefaultAccessMode);
            var metadata = await LoadMetadataAsync(requestTypeId, cancellationToken);
            var routingLookups = await LoadRoutingLookupsAsync(requestTypeId, cancellationToken);

            var validationErrors = ValidateUpsertRequest(
                safeRequest,
                requestTypeId,
                metadata.GroupLookups.Select(item => item.Id).ToHashSet(),
                metadata.FieldLookups.Select(item => item.Id).ToHashSet(),
                routingLookups.Stages,
                routingLookups.Actions);
            if (validationErrors.Count > 0)
            {
                foreach (var error in validationErrors)
                {
                    response.Errors.Add(error);
                }

                return response;
            }

            var policy = await _connectContext.FieldAccessPolicies
                .FirstOrDefaultAsync(item => item.RequestTypeId == requestTypeId, cancellationToken);
            if (policy == null)
            {
                policy = new FieldAccessPolicy
                {
                    RequestTypeId = requestTypeId,
                    Name = policyName,
                    IsActive = safeRequest.IsPolicyActive,
                    DefaultAccessMode = defaultAccessMode,
                    CreatedBy = normalizedUserId,
                    CreatedDate = DateTime.UtcNow,
                    LastModifiedBy = normalizedUserId,
                    LastModifiedDate = DateTime.UtcNow
                };

                await _connectContext.FieldAccessPolicies.AddAsync(policy, cancellationToken);
                await _connectContext.SaveChangesAsync(cancellationToken);
                await _requestPreviewCache.InvalidateAllAsync(cancellationToken);
            }
            else
            {
                policy.Name = policyName;
                policy.IsActive = safeRequest.IsPolicyActive;
                policy.DefaultAccessMode = defaultAccessMode;
                policy.LastModifiedBy = normalizedUserId;
                policy.LastModifiedDate = DateTime.UtcNow;
            }

            var existingRules = await _connectContext.FieldAccessPolicyRules
                .Where(item => item.PolicyId == policy.Id)
                .ToListAsync(cancellationToken);
            if (existingRules.Count > 0)
            {
                _connectContext.FieldAccessPolicyRules.RemoveRange(existingRules);
            }

            var existingLocks = await _connectContext.FieldAccessLocks
                .Where(item => item.RequestTypeId == requestTypeId)
                .ToListAsync(cancellationToken);
            if (existingLocks.Count > 0)
            {
                _connectContext.FieldAccessLocks.RemoveRange(existingLocks);
            }

            foreach (var rule in safeRequest.Rules ?? new List<FieldAccessPolicyRuleDto>())
            {
                var targetLevel = NormalizeTargetLevel(rule.TargetLevel);
                var normalizedSubjectType = NormalizeSubjectType(rule.SubjectType);
                var normalizedSubjectId = NormalizeNullable(rule.SubjectId);

                await _connectContext.FieldAccessPolicyRules.AddAsync(new FieldAccessPolicyRule
                {
                    PolicyId = policy.Id,
                    TargetLevel = targetLevel!,
                    TargetId = rule.TargetId,
                    StageId = NormalizePositiveInt(rule.StageId),
                    ActionId = NormalizePositiveInt(rule.ActionId),
                    PermissionType = NormalizeAccessMode(rule.PermissionType),
                    SubjectType = normalizedSubjectType!,
                    SubjectId = normalizedSubjectId,
                    Effect = NormalizeEffect(rule.Effect),
                    Priority = rule.Priority,
                    IsActive = rule.IsActive,
                    Notes = NormalizeNullable(rule.Notes),
                    CreatedBy = normalizedUserId,
                    CreatedDate = DateTime.UtcNow,
                    LastModifiedBy = normalizedUserId,
                    LastModifiedDate = DateTime.UtcNow
                }, cancellationToken);
            }

            foreach (var lockItem in safeRequest.Locks ?? new List<FieldAccessLockDto>())
            {
                var targetLevel = NormalizeTargetLevel(lockItem.TargetLevel);

                await _connectContext.FieldAccessLocks.AddAsync(new FieldAccessLock
                {
                    RequestTypeId = requestTypeId,
                    StageId = NormalizePositiveInt(lockItem.StageId),
                    ActionId = NormalizePositiveInt(lockItem.ActionId),
                    TargetLevel = targetLevel!,
                    TargetId = lockItem.TargetId,
                    LockMode = NormalizeLockMode(lockItem.LockMode),
                    AllowedOverrideSubjectType = NormalizeSubjectType(lockItem.AllowedOverrideSubjectType),
                    AllowedOverrideSubjectId = NormalizeNullable(lockItem.AllowedOverrideSubjectId),
                    IsActive = lockItem.IsActive,
                    Notes = NormalizeNullable(lockItem.Notes),
                    CreatedBy = normalizedUserId,
                    CreatedDate = DateTime.UtcNow,
                    LastModifiedBy = normalizedUserId,
                    LastModifiedDate = DateTime.UtcNow
                }, cancellationToken);
            }

            await _connectContext.SaveChangesAsync(cancellationToken);
            await _requestPreviewCache.InvalidateAllAsync(cancellationToken);

            response.Data = await BuildWorkspaceAsync(requestTypeId, cancellationToken);
        }
        catch
        {
            AddUnhandled(response);
        }

        return response;
    }

    public async Task<CommonResponse<FieldAccessPreviewResponseDto>> PreviewAsync(
        int requestTypeId,
        FieldAccessPreviewRequestDto request,
        string userId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<FieldAccessPreviewResponseDto>();
        try
        {
            var normalizedUserId = NormalizeNullable(userId);
            if (normalizedUserId == null)
            {
                AddUnauthorized(response);
                return response;
            }

            if (requestTypeId <= 0)
            {
                response.Errors.Add(new Error { Code = "400", Message = "نوع الطلب مطلوب." });
                return response;
            }

            var category = await _connectContext.Cdcategories
                .AsNoTracking()
                .FirstOrDefaultAsync(item => item.CatId == requestTypeId, cancellationToken);
            if (category == null)
            {
                response.Errors.Add(new Error { Code = "404", Message = "نوع الطلب غير موجود." });
                return response;
            }

            var safeRequest = request ?? new FieldAccessPreviewRequestDto();
            var metadata = await LoadMetadataAsync(requestTypeId, cancellationToken);
            var routingLookups = await LoadRoutingLookupsAsync(requestTypeId, cancellationToken);

            var normalizedStageId = NormalizePositiveInt(safeRequest.StageId);
            var normalizedActionId = NormalizePositiveInt(safeRequest.ActionId);
            var previewValidationErrors = ValidatePreviewRequest(
                safeRequest,
                normalizedStageId,
                normalizedActionId,
                routingLookups.Stages,
                routingLookups.Actions);
            if (previewValidationErrors.Count > 0)
            {
                foreach (var error in previewValidationErrors)
                {
                    response.Errors.Add(error);
                }

                return response;
            }

            Message? message = null;
            var requestId = NormalizePositiveInt(safeRequest.RequestId);
            if (requestId.HasValue)
            {
                message = await _connectContext.Messages
                    .AsNoTracking()
                    .FirstOrDefaultAsync(item => item.MessageId == requestId.Value, cancellationToken);
            }

            var previewSubjectType = NormalizeSubjectType(safeRequest.SubjectType);
            var subjectOverride = previewSubjectType == null
                ? null
                : new FieldAccessSubjectContextOverride
                {
                    SubjectType = previewSubjectType,
                    SubjectId = NormalizeNullable(safeRequest.SubjectId),
                    RequestOwnerUserId = NormalizeNullable(safeRequest.RequestOwnerUserId),
                    CurrentCustodianUnitId = NormalizeNullable(safeRequest.CurrentCustodianUnitId)
                };

            var resolution = await _resolutionService.ResolveAsync(new FieldAccessResolutionRequest
            {
                RequestTypeId = requestTypeId,
                RequestId = requestId,
                StageId = normalizedStageId,
                ActionId = normalizedActionId,
                UserId = normalizedUserId,
                Message = message,
                Groups = metadata.Groups,
                Fields = metadata.Fields,
                SubjectContextOverride = subjectOverride
            }, cancellationToken);

            var groupResolutionItems = new List<FieldAccessPreviewResolutionItemDto>();
            foreach (var group in metadata.Groups)
            {
                if (!resolution.GroupStates.TryGetValue(group.GroupId, out var state))
                {
                    continue;
                }

                ApplyResolvedState(group, state);
                groupResolutionItems.Add(BuildGroupResolutionItem(group, state));
            }

            var groupNameMap = metadata.Groups
                .GroupBy(item => item.GroupId)
                .ToDictionary(group => group.Key, group => group.First().GroupName);

            var fieldResolutionItems = new List<FieldAccessPreviewResolutionItemDto>();
            foreach (var field in metadata.Fields)
            {
                if (!resolution.FieldStatesByMendSql.TryGetValue(field.MendSql, out var state))
                {
                    continue;
                }

                ApplyResolvedState(field, state);
                fieldResolutionItems.Add(BuildFieldResolutionItem(field, groupNameMap, state));
            }

            var stageLabel = ResolveStageLabel(normalizedStageId, routingLookups.Stages);
            var actionLabel = ResolveActionLabel(normalizedActionId, routingLookups.Actions);
            var contextSummaryAr = BuildPreviewContextSummaryAr(
                stageLabel,
                actionLabel,
                previewSubjectType,
                NormalizeNullable(safeRequest.SubjectId));

            response.Data = new FieldAccessPreviewResponseDto
            {
                RequestTypeId = requestTypeId,
                StageId = normalizedStageId,
                ActionId = normalizedActionId,
                StageLabel = stageLabel,
                ActionLabel = actionLabel,
                SubjectType = previewSubjectType,
                SubjectId = NormalizeNullable(safeRequest.SubjectId),
                ContextSummaryAr = contextSummaryAr,
                Groups = metadata.Groups,
                Fields = metadata.Fields,
                GroupResolutions = groupResolutionItems,
                FieldResolutions = fieldResolutionItems,
                HiddenGroupsCount = metadata.Groups.Count(item => item.IsHidden),
                HiddenFieldsCount = metadata.Fields.Count(item => item.IsHidden),
                ReadOnlyFieldsCount = metadata.Fields.Count(item => item.IsReadOnly),
                RequiredFieldsCount = metadata.Fields.Count(item => item.IsRequired),
                LockedFieldsCount = metadata.Fields.Count(item => item.IsLocked)
            };
        }
        catch
        {
            AddUnhandled(response);
        }

        return response;
    }

    private async Task<FieldAccessPolicyWorkspaceDto?> BuildWorkspaceAsync(
        int requestTypeId,
        CancellationToken cancellationToken)
    {
        var category = await _connectContext.Cdcategories
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.CatId == requestTypeId, cancellationToken);
        if (category == null)
        {
            return null;
        }

        var policy = await _connectContext.FieldAccessPolicies
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.RequestTypeId == requestTypeId, cancellationToken);

        var rules = policy == null
            ? new List<FieldAccessPolicyRule>()
            : await _connectContext.FieldAccessPolicyRules
                .AsNoTracking()
                .Where(item => item.PolicyId == policy.Id)
                .OrderByDescending(item => item.IsActive)
                .ThenByDescending(item => item.Priority)
                .ThenByDescending(item => item.Id)
                .ToListAsync(cancellationToken);

        var locks = await _connectContext.FieldAccessLocks
            .AsNoTracking()
            .Where(item => item.RequestTypeId == requestTypeId)
            .OrderByDescending(item => item.IsActive)
            .ThenByDescending(item => item.Id)
            .ToListAsync(cancellationToken);

        var candidateLegacyGroupIds = CollectCandidateLegacyGroupIds(rules, locks);
        var groupBridge = await SubjectCategoryGroupBridgeBuilder.BuildAsync(
            _connectContext,
            requestTypeId,
            candidateLegacyGroupIds: candidateLegacyGroupIds,
            cancellationToken: cancellationToken);
        NormalizeGroupTargetIds(rules, locks, groupBridge);

        var metadata = await LoadMetadataAsync(requestTypeId, cancellationToken);
        var routingLookups = await LoadRoutingLookupsAsync(requestTypeId, cancellationToken);

        return new FieldAccessPolicyWorkspaceDto
        {
            RequestTypeId = requestTypeId,
            RequestTypeName = category.CatName,
            Policy = new FieldAccessPolicyDto
            {
                Id = policy?.Id,
                Name = policy?.Name ?? $"سياسة الوصول - {requestTypeId}",
                IsActive = policy?.IsActive ?? true,
                DefaultAccessMode = policy?.DefaultAccessMode ?? "Editable",
                LastModifiedDateUtc = policy?.LastModifiedDate ?? policy?.CreatedDate,
                LastModifiedBy = policy?.LastModifiedBy ?? policy?.CreatedBy
            },
            Rules = rules.Select(MapRule).ToList(),
            Locks = locks.Select(MapLock).ToList(),
            Groups = metadata.GroupLookups,
            Fields = metadata.FieldLookups,
            Stages = routingLookups.Stages,
            Actions = routingLookups.Actions,
            GeneratedAtUtc = DateTime.UtcNow
        };
    }

    private async Task<(List<SubjectGroupDefinitionDto> Groups, List<SubjectFieldDefinitionDto> Fields, List<FieldAccessLookupItemDto> GroupLookups, List<FieldAccessLookupItemDto> FieldLookups)> LoadMetadataAsync(
        int requestTypeId,
        CancellationToken cancellationToken)
    {
        var adminGroups = await _connectContext.AdminCatalogCategoryGroups
            .AsNoTracking()
            .Where(item => item.CategoryId == requestTypeId && item.IsActive)
            .ToListAsync(cancellationToken);
        var adminGroupById = adminGroups
            .GroupBy(item => item.GroupId)
            .ToDictionary(group => group.Key, group => group.First());

        var linkRows = await (from link in _connectContext.AdminCatalogCategoryFieldBindings.AsNoTracking()
                              join fieldSetting in _connectContext.SubjectCategoryFieldSettings.AsNoTracking()
                                  on link.MendSql equals fieldSetting.MendSql into fieldSettingJoin
                              from fieldSetting in fieldSettingJoin.DefaultIfEmpty()
                              join groupNode in _connectContext.AdminCatalogCategoryGroups.AsNoTracking()
                                  on link.GroupId equals groupNode.GroupId into groupJoin
                              from groupNode in groupJoin.DefaultIfEmpty()
                              where link.CategoryId == requestTypeId && !link.MendStat
                              select new
                              {
                                  link.MendSql,
                                  link.MendField,
                                  GroupId = link.GroupId,
                                  GroupName = groupNode != null ? groupNode.GroupName : null,
                                  GroupDescription = groupNode != null ? groupNode.GroupDescription : null,
                                  GroupDisplayOrder = groupNode != null ? groupNode.DisplayOrder : int.MaxValue,
                                  IsVisible = fieldSetting == null || fieldSetting.IsVisible,
                                  DisplayOrder = fieldSetting != null ? fieldSetting.DisplayOrder : link.MendSql,
                                  DisplaySettingsJson = fieldSetting != null ? fieldSetting.DisplaySettingsJson : null
                              })
            .ToListAsync(cancellationToken);

        var mendByFieldKey = await BuildMendLookupAsync(cancellationToken);

        var groups = adminGroups
            .OrderBy(item => item.DisplayOrder)
            .ThenBy(item => item.GroupName)
            .ThenBy(item => item.GroupId)
            .Select(group => new SubjectGroupDefinitionDto
            {
                GroupId = group.GroupId,
                GroupName = NormalizeNullable(group.GroupName) ?? $"مجموعة {group.GroupId}",
                GroupDescription = NormalizeNullable(group.GroupDescription),
                IsExtendable = false,
                GroupWithInRow = 12
            })
            .ToList();

        var groupLookupById = groups.ToDictionary(item => item.GroupId);
        var fields = new List<SubjectFieldDefinitionDto>();

        foreach (var row in linkRows
                     .OrderBy(item => item.GroupDisplayOrder)
                     .ThenBy(item => item.GroupId)
                     .ThenBy(item => item.DisplayOrder)
                     .ThenBy(item => item.MendSql))
        {
            var canonicalGroupId = row.GroupId;
            var normalizedFieldKey = NormalizeFieldKey(row.MendField);
            mendByFieldKey.TryGetValue(normalizedFieldKey, out var mend);

            if (!groupLookupById.TryGetValue(canonicalGroupId, out var group))
            {
                adminGroupById.TryGetValue(canonicalGroupId, out var adminGroup);
                group = new SubjectGroupDefinitionDto
                {
                    GroupId = canonicalGroupId,
                    GroupName = NormalizeNullable(adminGroup?.GroupName)
                        ?? NormalizeNullable(row.GroupName)
                        ?? $"مجموعة {canonicalGroupId}",
                    GroupDescription = NormalizeNullable(adminGroup?.GroupDescription)
                        ?? NormalizeNullable(row.GroupDescription),
                    IsExtendable = false,
                    GroupWithInRow = 12
                };
                groupLookupById[canonicalGroupId] = group;
                groups.Add(group);
            }

            fields.Add(new SubjectFieldDefinitionDto
            {
                MendSql = row.MendSql,
                CategoryId = requestTypeId,
                MendGroup = canonicalGroupId,
                FieldKey = mend?.CdmendTxt ?? NormalizeNullable(row.MendField) ?? string.Empty,
                FieldType = mend?.CdmendType ?? "InputText",
                FieldLabel = NormalizeNullable(mend?.CDMendLbl) ?? NormalizeNullable(row.MendField) ?? string.Empty,
                Placeholder = mend?.Placeholder,
                DefaultValue = mend?.DefaultValue,
                OptionsPayload = mend?.CdmendTbl,
                DataType = mend?.CdmendDatatype,
                Required = mend?.Required == true,
                RequiredTrue = mend?.RequiredTrue == true,
                Email = mend?.Email == true,
                Pattern = mend?.Pattern == true,
                MinValue = mend?.MinValue,
                MaxValue = mend?.MaxValue,
                Mask = mend?.Cdmendmask,
                IsDisabledInit = mend?.IsDisabledInit == true,
                IsSearchable = mend?.IsSearchable == true,
                Width = mend?.Width ?? 0,
                Height = mend?.Height ?? 0,
                ApplicationId = mend?.ApplicationId,
                DisplayOrder = row.DisplayOrder,
                IsVisible = row.IsVisible,
                DisplaySettingsJson = row.DisplaySettingsJson,
                Group = group
            });
        }

        groups = groups
            .GroupBy(item => item.GroupId)
            .Select(group => group.First())
            .OrderBy(item => item.GroupId)
            .ToList();

        var groupLookups = groups
            .Select(group => new FieldAccessLookupItemDto
            {
                Id = group.GroupId,
                Code = group.GroupId.ToString(),
                Label = group.GroupName
            })
            .OrderBy(item => item.Label)
            .ThenBy(item => item.Id)
            .ToList();

        var fieldLookups = fields
            .Select(field => new FieldAccessLookupItemDto
            {
                Id = field.MendSql,
                Code = NormalizeNullable(field.FieldKey) ?? field.MendSql.ToString(),
                Label = NormalizeNullable(field.FieldLabel) ?? NormalizeNullable(field.FieldKey) ?? field.MendSql.ToString(),
                GroupId = field.MendGroup
            })
            .OrderBy(item => item.Label)
            .ThenBy(item => item.Id)
            .ToList();

        return (groups, fields, groupLookups, fieldLookups);
    }

    private async Task<Dictionary<string, Cdmend>> BuildMendLookupAsync(CancellationToken cancellationToken)
    {
        var allMends = await _connectContext.Cdmends
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        return allMends
            .GroupBy(item => NormalizeFieldKey(item.CdmendTxt))
            .Where(group => group.Key.Length > 0)
            .ToDictionary(
                group => group.Key,
                group => group
                    .OrderBy(item => item.CdmendStat ? 1 : 0)
                    .ThenBy(item => item.CdmendSql)
                    .First(),
                StringComparer.OrdinalIgnoreCase);
    }

    private async Task<(List<FieldAccessStageLookupDto> Stages, List<FieldAccessActionLookupDto> Actions)> LoadRoutingLookupsAsync(
        int requestTypeId,
        CancellationToken cancellationToken)
    {
        var profileIdsFromBindings = await _connectContext.SubjectTypeRoutingBindings
            .AsNoTracking()
            .Where(item => item.SubjectTypeId == requestTypeId && item.IsActive)
            .Select(item => item.RoutingProfileId)
            .Distinct()
            .ToListAsync(cancellationToken);

        List<int> profileIds;
        if (profileIdsFromBindings.Count > 0)
        {
            profileIds = profileIdsFromBindings;
        }
        else
        {
            profileIds = await _connectContext.SubjectRoutingProfiles
                .AsNoTracking()
                .Where(item => item.SubjectTypeId == requestTypeId && item.IsActive)
                .Select(item => item.Id)
                .Distinct()
                .ToListAsync(cancellationToken);
        }

        if (profileIds.Count == 0)
        {
            return (new List<FieldAccessStageLookupDto>(), new List<FieldAccessActionLookupDto>());
        }

        var steps = await _connectContext.SubjectRoutingSteps
            .AsNoTracking()
            .Where(item => profileIds.Contains(item.RoutingProfileId) && item.IsActive)
            .OrderBy(item => item.StepOrder)
            .ThenBy(item => item.Id)
            .ToListAsync(cancellationToken);

        var transitions = await _connectContext.SubjectRoutingTransitions
            .AsNoTracking()
            .Where(item => profileIds.Contains(item.RoutingProfileId) && item.IsActive)
            .OrderBy(item => item.DisplayOrder)
            .ThenBy(item => item.Id)
            .ToListAsync(cancellationToken);

        var stages = steps
            .Select(step => new FieldAccessStageLookupDto
            {
                Id = step.Id,
                Code = NormalizeNullable(step.StepCode) ?? step.Id.ToString(),
                Label = NormalizeNullable(step.StepNameAr) ?? NormalizeNullable(step.StepCode) ?? step.Id.ToString(),
                StepOrder = step.StepOrder
            })
            .OrderBy(item => item.StepOrder)
            .ThenBy(item => item.Id)
            .ToList();

        var stepMap = stages.ToDictionary(item => item.Id);
        var actions = transitions
            .Select(transition => new FieldAccessActionLookupDto
            {
                Id = transition.Id,
                StageId = transition.FromStepId,
                Code = NormalizeNullable(transition.ActionCode) ?? transition.Id.ToString(),
                Label = NormalizeNullable(transition.ActionNameAr) ?? NormalizeNullable(transition.ActionCode) ?? transition.Id.ToString(),
                DisplayOrder = transition.DisplayOrder
            })
            .Where(item => stepMap.ContainsKey(item.StageId))
            .OrderBy(item => stepMap[item.StageId].StepOrder)
            .ThenBy(item => item.DisplayOrder)
            .ThenBy(item => item.Id)
            .ToList();

        return (stages, actions);
    }

    private static FieldAccessPolicyRuleDto MapRule(FieldAccessPolicyRule item)
    {
        return new FieldAccessPolicyRuleDto
        {
            Id = item.Id,
            TargetLevel = item.TargetLevel,
            TargetId = item.TargetId,
            StageId = item.StageId,
            ActionId = item.ActionId,
            PermissionType = item.PermissionType,
            SubjectType = item.SubjectType,
            SubjectId = item.SubjectId,
            Effect = item.Effect,
            Priority = item.Priority,
            IsActive = item.IsActive,
            Notes = item.Notes
        };
    }

    private static FieldAccessLockDto MapLock(FieldAccessLock item)
    {
        return new FieldAccessLockDto
        {
            Id = item.Id,
            StageId = item.StageId,
            ActionId = item.ActionId,
            TargetLevel = item.TargetLevel,
            TargetId = item.TargetId,
            LockMode = item.LockMode,
            AllowedOverrideSubjectType = item.AllowedOverrideSubjectType,
            AllowedOverrideSubjectId = item.AllowedOverrideSubjectId,
            IsActive = item.IsActive,
            Notes = item.Notes
        };
    }

    private static void NormalizeGroupTargetIds(
        IReadOnlyCollection<FieldAccessPolicyRule> rules,
        IReadOnlyCollection<FieldAccessLock> locks,
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
    }

    private static IReadOnlyCollection<int> CollectCandidateLegacyGroupIds(
        IReadOnlyCollection<FieldAccessPolicyRule> rules,
        IReadOnlyCollection<FieldAccessLock> locks)
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

        return candidateIds
            .OrderBy(item => item)
            .ToArray();
    }

    private static bool IsGroupTargetLevel(string? targetLevel)
    {
        return string.Equals(NormalizeTargetLevel(targetLevel), "Group", StringComparison.OrdinalIgnoreCase);
    }

    private static void ApplyResolvedState(SubjectGroupDefinitionDto target, FieldAccessResolvedState source)
    {
        target.CanView = source.CanView;
        target.CanEdit = source.CanEdit;
        target.CanFill = source.CanFill;
        target.IsHidden = source.IsHidden;
        target.IsReadOnly = source.IsReadOnly;
        target.IsRequired = source.IsRequired;
        target.IsLocked = source.IsLocked;
        target.LockReason = source.LockReason;
    }

    private static void ApplyResolvedState(SubjectFieldDefinitionDto target, FieldAccessResolvedState source)
    {
        target.CanView = source.CanView;
        target.CanEdit = source.CanEdit;
        target.CanFill = source.CanFill;
        target.IsHidden = source.IsHidden;
        target.IsReadOnly = source.IsReadOnly;
        target.IsRequired = source.IsRequired;
        target.IsLocked = source.IsLocked;
        target.LockReason = source.LockReason;

        target.IsVisible = source.CanView;
        target.IsDisabledInit = !source.CanEdit;
        target.Required = source.IsRequired;
    }

    private static List<Error> ValidateUpsertRequest(
        FieldAccessPolicyWorkspaceUpsertRequestDto request,
        int requestTypeId,
        HashSet<int> validGroupIds,
        HashSet<int> validFieldIds,
        IReadOnlyCollection<FieldAccessStageLookupDto> stageLookups,
        IReadOnlyCollection<FieldAccessActionLookupDto> actionLookups)
    {
        var errors = new List<Error>();
        var safeRequest = request ?? new FieldAccessPolicyWorkspaceUpsertRequestDto();
        var validStageIds = stageLookups.Select(item => item.Id).ToHashSet();
        var actionById = actionLookups.ToDictionary(item => item.Id);

        for (var index = 0; index < (safeRequest.Rules?.Count ?? 0); index++)
        {
            var rule = safeRequest.Rules[index];
            var rowLabel = $"القاعدة رقم {index + 1}";
            var targetLevel = NormalizeTargetLevel(rule.TargetLevel);
            if (targetLevel == null)
            {
                errors.Add(new Error { Code = "400", Message = $"{rowLabel}: مستوى الهدف غير صالح." });
                continue;
            }

            if (rule.TargetId <= 0)
            {
                errors.Add(new Error { Code = "400", Message = $"{rowLabel}: TargetId مطلوب." });
            }
            else if (!IsValidTarget(targetLevel, rule.TargetId, requestTypeId, validGroupIds, validFieldIds))
            {
                errors.Add(new Error { Code = "400", Message = $"{rowLabel}: الهدف المحدد لا ينتمي لنوع الطلب الحالي." });
            }

            var normalizedSubjectType = NormalizeSubjectType(rule.SubjectType);
            if (normalizedSubjectType == null)
            {
                errors.Add(new Error { Code = "400", Message = $"{rowLabel}: نوع الجهة غير صالح." });
            }
            else
            {
                var normalizedSubjectId = NormalizeNullable(rule.SubjectId);
                if (RequiresSubjectId(normalizedSubjectType) && normalizedSubjectId == null)
                {
                    errors.Add(new Error { Code = "400", Message = $"{rowLabel}: SubjectId إلزامي لنوع الجهة المحدد." });
                }
            }

            var stageId = NormalizePositiveInt(rule.StageId);
            var actionId = NormalizePositiveInt(rule.ActionId);
            if (actionId.HasValue && !stageId.HasValue)
            {
                errors.Add(new Error { Code = "400", Message = $"{rowLabel}: عند تحديد Action يجب تحديد Stage." });
            }

            if (stageId.HasValue && validStageIds.Count > 0 && !validStageIds.Contains(stageId.Value))
            {
                errors.Add(new Error { Code = "400", Message = $"{rowLabel}: Stage المحددة غير مرتبطة بمسار هذا النوع." });
            }

            if (actionId.HasValue)
            {
                if (!actionById.TryGetValue(actionId.Value, out var actionLookup))
                {
                    errors.Add(new Error { Code = "400", Message = $"{rowLabel}: Action المحددة غير مرتبطة بمسار هذا النوع." });
                }
                else if (stageId.HasValue && actionLookup.StageId != stageId.Value)
                {
                    errors.Add(new Error { Code = "400", Message = $"{rowLabel}: Action المحددة لا تتبع Stage المختارة." });
                }
            }

            if (rule.Priority < 0 || rule.Priority > 100000)
            {
                errors.Add(new Error { Code = "400", Message = $"{rowLabel}: Priority خارج النطاق المسموح (0-100000)." });
            }
        }

        for (var index = 0; index < (safeRequest.Locks?.Count ?? 0); index++)
        {
            var lockItem = safeRequest.Locks[index];
            var rowLabel = $"القفل رقم {index + 1}";
            var targetLevel = NormalizeTargetLevel(lockItem.TargetLevel);
            if (targetLevel == null)
            {
                errors.Add(new Error { Code = "400", Message = $"{rowLabel}: مستوى الهدف غير صالح." });
                continue;
            }

            if (lockItem.TargetId <= 0)
            {
                errors.Add(new Error { Code = "400", Message = $"{rowLabel}: TargetId مطلوب." });
            }
            else if (!IsValidTarget(targetLevel, lockItem.TargetId, requestTypeId, validGroupIds, validFieldIds))
            {
                errors.Add(new Error { Code = "400", Message = $"{rowLabel}: الهدف المحدد لا ينتمي لنوع الطلب الحالي." });
            }

            var stageId = NormalizePositiveInt(lockItem.StageId);
            var actionId = NormalizePositiveInt(lockItem.ActionId);
            if (actionId.HasValue && !stageId.HasValue)
            {
                errors.Add(new Error { Code = "400", Message = $"{rowLabel}: عند تحديد Action يجب تحديد Stage." });
            }

            if (stageId.HasValue && validStageIds.Count > 0 && !validStageIds.Contains(stageId.Value))
            {
                errors.Add(new Error { Code = "400", Message = $"{rowLabel}: Stage المحددة غير مرتبطة بمسار هذا النوع." });
            }

            if (actionId.HasValue)
            {
                if (!actionById.TryGetValue(actionId.Value, out var actionLookup))
                {
                    errors.Add(new Error { Code = "400", Message = $"{rowLabel}: Action المحددة غير مرتبطة بمسار هذا النوع." });
                }
                else if (stageId.HasValue && actionLookup.StageId != stageId.Value)
                {
                    errors.Add(new Error { Code = "400", Message = $"{rowLabel}: Action المحددة لا تتبع Stage المختارة." });
                }
            }

            var overrideSubjectType = NormalizeSubjectType(lockItem.AllowedOverrideSubjectType);
            var overrideSubjectId = NormalizeNullable(lockItem.AllowedOverrideSubjectId);
            if (overrideSubjectType == null && overrideSubjectId != null)
            {
                errors.Add(new Error { Code = "400", Message = $"{rowLabel}: لا يمكن إرسال Override SubjectId بدون تحديد Override SubjectType." });
            }

            if (overrideSubjectType != null && RequiresSubjectId(overrideSubjectType) && overrideSubjectId == null)
            {
                errors.Add(new Error { Code = "400", Message = $"{rowLabel}: Override SubjectId إلزامي لنوع الجهة المحدد." });
            }
        }

        return errors;
    }

    private static List<Error> ValidatePreviewRequest(
        FieldAccessPreviewRequestDto request,
        int? stageId,
        int? actionId,
        IReadOnlyCollection<FieldAccessStageLookupDto> stageLookups,
        IReadOnlyCollection<FieldAccessActionLookupDto> actionLookups)
    {
        var errors = new List<Error>();
        var safeRequest = request ?? new FieldAccessPreviewRequestDto();
        var validStageIds = stageLookups.Select(item => item.Id).ToHashSet();
        var actionById = actionLookups.ToDictionary(item => item.Id);
        var subjectType = NormalizeSubjectType(safeRequest.SubjectType);
        var subjectId = NormalizeNullable(safeRequest.SubjectId);

        if (NormalizeNullable(safeRequest.SubjectType) != null && subjectType == null)
        {
            errors.Add(new Error { Code = "400", Message = "نوع الجهة في المعاينة غير صالح." });
        }

        if (actionId.HasValue && !stageId.HasValue)
        {
            errors.Add(new Error { Code = "400", Message = "عند تحديد Action في المعاينة يجب تحديد Stage." });
        }

        if (stageId.HasValue && validStageIds.Count > 0 && !validStageIds.Contains(stageId.Value))
        {
            errors.Add(new Error { Code = "400", Message = "Stage المختارة غير مرتبطة بمسار هذا النوع." });
        }

        if (actionId.HasValue)
        {
            if (!actionById.TryGetValue(actionId.Value, out var actionLookup))
            {
                errors.Add(new Error { Code = "400", Message = "Action المختارة غير مرتبطة بمسار هذا النوع." });
            }
            else if (stageId.HasValue && actionLookup.StageId != stageId.Value)
            {
                errors.Add(new Error { Code = "400", Message = "Action المختارة لا تتبع Stage المحددة." });
            }
        }

        if (subjectType != null && RequiresSubjectId(subjectType) && subjectId == null)
        {
            errors.Add(new Error { Code = "400", Message = "SubjectId مطلوب في المعاينة لهذا النوع من الجهة." });
        }

        if (subjectType == null && subjectId != null)
        {
            errors.Add(new Error { Code = "400", Message = "لا يمكن إدخال SubjectId بدون تحديد SubjectType." });
        }

        return errors;
    }

    private static FieldAccessPreviewResolutionItemDto BuildGroupResolutionItem(
        SubjectGroupDefinitionDto group,
        FieldAccessResolvedState state)
    {
        return new FieldAccessPreviewResolutionItemDto
        {
            TargetLevel = "Group",
            TargetId = group.GroupId,
            TargetLabel = group.GroupName,
            CanView = state.CanView,
            IsReadOnly = state.IsReadOnly,
            IsRequired = state.IsRequired,
            IsLocked = state.IsLocked,
            FinalStateCode = state.FinalStateCode,
            FinalStateAr = FinalStateLabelAr(state.FinalStateCode),
            EffectiveSourceType = state.EffectiveSourceType ?? "DefaultPolicy",
            EffectiveSourceAr = SourceTypeLabelAr(state.EffectiveSourceType),
            FinalReasonAr = NormalizeNullable(state.EffectiveReasonAr) ?? "تم تطبيق السياسة الافتراضية.",
            AppliedPolicies = (state.AppliedTraces ?? new List<FieldAccessAppliedTrace>())
                .Select(MapAppliedPolicyTrace)
                .ToList()
        };
    }

    private static FieldAccessPreviewResolutionItemDto BuildFieldResolutionItem(
        SubjectFieldDefinitionDto field,
        IReadOnlyDictionary<int, string> groupNameMap,
        FieldAccessResolvedState state)
    {
        groupNameMap.TryGetValue(field.MendGroup, out var groupName);
        return new FieldAccessPreviewResolutionItemDto
        {
            TargetLevel = "Field",
            TargetId = field.MendSql,
            TargetLabel = NormalizeNullable(field.FieldLabel) ?? NormalizeNullable(field.FieldKey) ?? field.MendSql.ToString(),
            GroupId = field.MendGroup,
            GroupLabel = groupName,
            CanView = state.CanView,
            IsReadOnly = state.IsReadOnly,
            IsRequired = state.IsRequired,
            IsLocked = state.IsLocked,
            FinalStateCode = state.FinalStateCode,
            FinalStateAr = FinalStateLabelAr(state.FinalStateCode),
            EffectiveSourceType = state.EffectiveSourceType ?? "DefaultPolicy",
            EffectiveSourceAr = SourceTypeLabelAr(state.EffectiveSourceType),
            FinalReasonAr = NormalizeNullable(state.EffectiveReasonAr) ?? "تم تطبيق السياسة الافتراضية.",
            AppliedPolicies = (state.AppliedTraces ?? new List<FieldAccessAppliedTrace>())
                .Select(MapAppliedPolicyTrace)
                .ToList()
        };
    }

    private static FieldAccessPreviewAppliedPolicyDto MapAppliedPolicyTrace(FieldAccessAppliedTrace trace)
    {
        return new FieldAccessPreviewAppliedPolicyDto
        {
            SourceType = trace.SourceType,
            SourceTypeAr = SourceTypeLabelAr(trace.SourceType),
            PermissionKind = trace.PermissionKind,
            PermissionKindAr = PermissionKindLabelAr(trace.PermissionKind),
            TargetLevel = trace.TargetLevel,
            TargetId = trace.TargetId,
            StageId = trace.StageId,
            ActionId = trace.ActionId,
            RuleId = trace.RuleId,
            LockId = trace.LockId,
            OverrideId = trace.OverrideId,
            PermissionType = trace.PermissionType,
            Effect = trace.Effect,
            LockMode = trace.LockMode,
            SubjectType = trace.SubjectType,
            SubjectId = trace.SubjectId,
            Notes = trace.Notes,
            DescriptionAr = NormalizeNullable(trace.DescriptionAr)
                ?? BuildAppliedTraceFallbackDescriptionAr(trace)
        };
    }

    private static string ResolveStageLabel(int? stageId, IReadOnlyCollection<FieldAccessStageLookupDto> stages)
    {
        if (!stageId.HasValue)
        {
            return "كل المراحل";
        }

        var stage = stages.FirstOrDefault(item => item.Id == stageId.Value);
        return stage?.Label ?? $"Stage #{stageId.Value}";
    }

    private static string ResolveActionLabel(int? actionId, IReadOnlyCollection<FieldAccessActionLookupDto> actions)
    {
        if (!actionId.HasValue)
        {
            return "كل الإجراءات";
        }

        var action = actions.FirstOrDefault(item => item.Id == actionId.Value);
        return action?.Label ?? $"Action #{actionId.Value}";
    }

    private static string BuildPreviewContextSummaryAr(
        string stageLabel,
        string actionLabel,
        string? subjectType,
        string? subjectId)
    {
        var subjectText = SubjectTypeLabelAr(subjectType);
        var normalizedSubjectId = NormalizeNullable(subjectId);
        if (normalizedSubjectId != null)
        {
            subjectText = $"{subjectText} ({normalizedSubjectId})";
        }

        return $"سياق المعاينة الحالي: المرحلة \"{stageLabel}\"، الإجراء \"{actionLabel}\"، والجهة \"{subjectText}\".";
    }

    private static bool IsValidTarget(
        string targetLevel,
        int targetId,
        int requestTypeId,
        IReadOnlySet<int> validGroupIds,
        IReadOnlySet<int> validFieldIds)
    {
        if (targetLevel.Equals("Request", StringComparison.OrdinalIgnoreCase))
        {
            return targetId == requestTypeId;
        }

        if (targetLevel.Equals("Group", StringComparison.OrdinalIgnoreCase))
        {
            return validGroupIds.Contains(targetId);
        }

        if (targetLevel.Equals("Field", StringComparison.OrdinalIgnoreCase))
        {
            return validFieldIds.Contains(targetId);
        }

        return false;
    }

    private static string FinalStateLabelAr(string? finalStateCode)
    {
        var normalized = NormalizeNullable(finalStateCode)?.ToLowerInvariant();
        return normalized switch
        {
            "hidden" => "مخفي",
            "readonly" => "قراءة فقط",
            "requiredinput" => "إدخال إلزامي",
            _ => "قابل للتعديل"
        };
    }

    private static string SourceTypeLabelAr(string? sourceType)
    {
        var normalized = NormalizeNullable(sourceType)?.ToLowerInvariant();
        return normalized switch
        {
            "actionrule" => "Action Rule",
            "stagerule" => "Stage Rule",
            "rule" => "Rule عامة",
            "override" => "Override",
            "lock" => "Lock",
            _ => "السياسة الافتراضية"
        };
    }

    private static string PermissionKindLabelAr(string? permissionKind)
    {
        var normalized = NormalizeNullable(permissionKind)?.ToLowerInvariant();
        return normalized == "requirement"
            ? "متطلب إدخال"
            : normalized == "lock"
                ? "قفل"
                : "رؤية/تعديل";
    }

    private static string SubjectTypeLabelAr(string? subjectType)
    {
        var normalized = NormalizeSubjectType(subjectType);
        return normalized switch
        {
            "OrgUnit" => "وحدة تنظيمية",
            "Position" => "منصب",
            "User" => "مستخدم",
            "RequestOwner" => "منشئ الطلب",
            "CurrentCustodian" => "الحاضن الحالي",
            _ => "المستخدم الحالي"
        };
    }

    private static string BuildAppliedTraceFallbackDescriptionAr(FieldAccessAppliedTrace trace)
    {
        var source = SourceTypeLabelAr(trace.SourceType);
        var kind = PermissionKindLabelAr(trace.PermissionKind);
        var target = trace.TargetLevel.Equals("Group", StringComparison.OrdinalIgnoreCase)
            ? "المجموعة"
            : trace.TargetLevel.Equals("Request", StringComparison.OrdinalIgnoreCase)
                ? "نوع الطلب"
                : "الحقل";
        var permission = NormalizeNullable(trace.PermissionType) ?? NormalizeNullable(trace.LockMode) ?? "—";
        return $"{source} طبق {kind} على {target} #{trace.TargetId} بالقيمة {permission}.";
    }

    private static bool RequiresSubjectId(string subjectType)
    {
        return string.Equals(subjectType, "OrgUnit", StringComparison.OrdinalIgnoreCase)
            || string.Equals(subjectType, "Position", StringComparison.OrdinalIgnoreCase)
            || string.Equals(subjectType, "User", StringComparison.OrdinalIgnoreCase);
    }

    private static string? NormalizeNullable(string? value)
    {
        var normalized = (value ?? string.Empty).Trim();
        return normalized.Length == 0 ? null : normalized;
    }

    private static string NormalizeFieldKey(string? value)
    {
        return (value ?? string.Empty).Trim().ToLowerInvariant();
    }

    private static int? NormalizePositiveInt(int? value)
    {
        if (!value.HasValue || value.Value <= 0)
        {
            return null;
        }

        return value.Value;
    }

    private static string NormalizeAccessMode(string? value)
    {
        var normalized = NormalizeNullable(value)?.ToLowerInvariant();
        return normalized switch
        {
            "hidden" => "Hidden",
            "readonly" => "ReadOnly",
            "requiredinput" => "RequiredInput",
            _ => "Editable"
        };
    }

    private static string NormalizeLockMode(string? value)
    {
        var normalized = NormalizeNullable(value)?.ToLowerInvariant();
        return normalized switch
        {
            "fulllock" => "FullLock",
            "noinput" => "NoInput",
            _ => "NoEdit"
        };
    }

    private static string NormalizeEffect(string? value)
    {
        var normalized = NormalizeNullable(value)?.ToLowerInvariant();
        return normalized == "deny" ? "Deny" : "Allow";
    }

    private static string? NormalizeTargetLevel(string? value)
    {
        var normalized = NormalizeNullable(value)?.ToLowerInvariant();
        return normalized switch
        {
            "field" => "Field",
            "group" => "Group",
            "request" => "Request",
            _ => null
        };
    }

    private static string? NormalizeSubjectType(string? value)
    {
        var normalized = NormalizeNullable(value)?.ToLowerInvariant();
        return normalized switch
        {
            "orgunit" => "OrgUnit",
            "position" => "Position",
            "user" => "User",
            "requestowner" => "RequestOwner",
            "currentcustodian" => "CurrentCustodian",
            _ => null
        };
    }

    private static void AddUnauthorized<T>(CommonResponse<T> response)
    {
        response.Errors.Add(new Error { Code = "401", Message = "المستخدم غير مصرح له." });
    }

    private static void AddUnhandled<T>(CommonResponse<T> response)
    {
        response.Errors.Add(new Error { Code = "500", Message = "حدث خطأ غير متوقع أثناء تنفيذ العملية." });
    }
}
