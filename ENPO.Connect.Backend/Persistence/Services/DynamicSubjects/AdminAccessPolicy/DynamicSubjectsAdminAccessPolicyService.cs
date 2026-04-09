using Microsoft.EntityFrameworkCore;
using Models.Correspondance;
using Models.DTO.Common;
using Models.DTO.DynamicSubjects;
using Persistence.Data;
using Persistence.Services.DynamicSubjects.FieldAccess;

namespace Persistence.Services.DynamicSubjects.AdminAccessPolicy;

public sealed class DynamicSubjectsAdminAccessPolicyService : IDynamicSubjectsAdminAccessPolicyService
{
    private readonly ConnectContext _connectContext;
    private readonly IFieldAccessResolutionService _resolutionService;

    public DynamicSubjectsAdminAccessPolicyService(
        ConnectContext connectContext,
        IFieldAccessResolutionService resolutionService)
    {
        _connectContext = connectContext;
        _resolutionService = resolutionService;
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

            var validationErrors = ValidateUpsertRequest(safeRequest);
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
                if (targetLevel == null || rule.TargetId <= 0)
                {
                    continue;
                }

                var normalizedSubjectType = NormalizeSubjectType(rule.SubjectType);
                if (normalizedSubjectType == null)
                {
                    continue;
                }

                var normalizedSubjectId = NormalizeNullable(rule.SubjectId);
                if (RequiresSubjectId(normalizedSubjectType) && normalizedSubjectId == null)
                {
                    continue;
                }

                await _connectContext.FieldAccessPolicyRules.AddAsync(new FieldAccessPolicyRule
                {
                    PolicyId = policy.Id,
                    TargetLevel = targetLevel,
                    TargetId = rule.TargetId,
                    StageId = NormalizePositiveInt(rule.StageId),
                    ActionId = NormalizePositiveInt(rule.ActionId),
                    PermissionType = NormalizeAccessMode(rule.PermissionType),
                    SubjectType = normalizedSubjectType,
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
                if (targetLevel == null || lockItem.TargetId <= 0)
                {
                    continue;
                }

                await _connectContext.FieldAccessLocks.AddAsync(new FieldAccessLock
                {
                    RequestTypeId = requestTypeId,
                    StageId = NormalizePositiveInt(lockItem.StageId),
                    ActionId = NormalizePositiveInt(lockItem.ActionId),
                    TargetLevel = targetLevel,
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

            var metadata = await LoadMetadataAsync(requestTypeId, cancellationToken);

            Message? message = null;
            var requestId = NormalizePositiveInt(request?.RequestId);
            if (requestId.HasValue)
            {
                message = await _connectContext.Messages
                    .AsNoTracking()
                    .FirstOrDefaultAsync(item => item.MessageId == requestId.Value, cancellationToken);
            }

            var previewSubjectType = NormalizeSubjectType(request?.SubjectType);
            var subjectOverride = previewSubjectType == null
                ? null
                : new FieldAccessSubjectContextOverride
                {
                    SubjectType = previewSubjectType,
                    SubjectId = NormalizeNullable(request?.SubjectId),
                    RequestOwnerUserId = NormalizeNullable(request?.RequestOwnerUserId),
                    CurrentCustodianUnitId = NormalizeNullable(request?.CurrentCustodianUnitId)
                };

            var resolution = await _resolutionService.ResolveAsync(new FieldAccessResolutionRequest
            {
                RequestTypeId = requestTypeId,
                RequestId = requestId,
                StageId = NormalizePositiveInt(request?.StageId),
                ActionId = NormalizePositiveInt(request?.ActionId),
                UserId = normalizedUserId,
                Message = message,
                Groups = metadata.Groups,
                Fields = metadata.Fields,
                SubjectContextOverride = subjectOverride
            }, cancellationToken);

            foreach (var group in metadata.Groups)
            {
                if (!resolution.GroupStates.TryGetValue(group.GroupId, out var state))
                {
                    continue;
                }

                ApplyResolvedState(group, state);
            }

            foreach (var field in metadata.Fields)
            {
                if (!resolution.FieldStatesByMendSql.TryGetValue(field.MendSql, out var state))
                {
                    continue;
                }

                ApplyResolvedState(field, state);
            }

            response.Data = new FieldAccessPreviewResponseDto
            {
                RequestTypeId = requestTypeId,
                StageId = NormalizePositiveInt(request?.StageId),
                ActionId = NormalizePositiveInt(request?.ActionId),
                SubjectType = previewSubjectType,
                SubjectId = NormalizeNullable(request?.SubjectId),
                Groups = metadata.Groups,
                Fields = metadata.Fields,
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
                DefaultAccessMode = policy?.DefaultAccessMode ?? "Editable"
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
        var linkRows = await (from link in _connectContext.CdCategoryMands.AsNoTracking()
                              join adminGroup in _connectContext.AdminCatalogCategoryGroups.AsNoTracking()
                                  on new { GroupId = link.MendGroup, CategoryId = link.MendCategory }
                                  equals new { GroupId = adminGroup.GroupId, CategoryId = adminGroup.CategoryId }
                                  into groupJoin
                              from adminGroup in groupJoin.DefaultIfEmpty()
                              join fieldSetting in _connectContext.SubjectCategoryFieldSettings.AsNoTracking()
                                  on link.MendSql equals fieldSetting.MendSql into fieldSettingJoin
                              from fieldSetting in fieldSettingJoin.DefaultIfEmpty()
                              where link.MendCategory == requestTypeId && !link.MendStat
                              select new
                              {
                                  link.MendSql,
                                  link.MendField,
                                  link.MendGroup,
                                  GroupName = adminGroup != null ? adminGroup.GroupName : null,
                                  GroupDescription = adminGroup != null ? adminGroup.GroupDescription : null,
                                  IsVisible = fieldSetting == null || fieldSetting.IsVisible,
                                  DisplayOrder = fieldSetting != null ? fieldSetting.DisplayOrder : link.MendSql,
                                  DisplaySettingsJson = fieldSetting != null ? fieldSetting.DisplaySettingsJson : null
                              })
            .ToListAsync(cancellationToken);

        var mendByFieldKey = await BuildMendLookupAsync(cancellationToken);

        var groups = linkRows
            .GroupBy(item => item.MendGroup)
            .Select(group => new SubjectGroupDefinitionDto
            {
                GroupId = group.Key,
                GroupName = NormalizeNullable(group.FirstOrDefault()?.GroupName) ?? $"مجموعة {group.Key}",
                GroupDescription = NormalizeNullable(group.FirstOrDefault()?.GroupDescription),
                IsExtendable = false,
                GroupWithInRow = 12
            })
            .OrderBy(item => item.GroupId)
            .ToList();

        var groupLookupById = groups.ToDictionary(item => item.GroupId);
        var fields = new List<SubjectFieldDefinitionDto>();

        foreach (var row in linkRows
                     .OrderBy(item => item.MendGroup)
                     .ThenBy(item => item.DisplayOrder)
                     .ThenBy(item => item.MendSql))
        {
            var normalizedFieldKey = NormalizeFieldKey(row.MendField);
            mendByFieldKey.TryGetValue(normalizedFieldKey, out var mend);

            if (!groupLookupById.TryGetValue(row.MendGroup, out var group))
            {
                group = new SubjectGroupDefinitionDto
                {
                    GroupId = row.MendGroup,
                    GroupName = $"مجموعة {row.MendGroup}",
                    IsExtendable = false,
                    GroupWithInRow = 12
                };
                groupLookupById[row.MendGroup] = group;
            }

            fields.Add(new SubjectFieldDefinitionDto
            {
                MendSql = row.MendSql,
                CategoryId = requestTypeId,
                MendGroup = row.MendGroup,
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

    private static List<Error> ValidateUpsertRequest(FieldAccessPolicyWorkspaceUpsertRequestDto request)
    {
        var errors = new List<Error>();
        var safeRequest = request ?? new FieldAccessPolicyWorkspaceUpsertRequestDto();

        foreach (var rule in safeRequest.Rules ?? new List<FieldAccessPolicyRuleDto>())
        {
            var targetLevel = NormalizeTargetLevel(rule.TargetLevel);
            if (targetLevel == null)
            {
                errors.Add(new Error { Code = "400", Message = "مستوى الهدف في القاعدة غير صالح." });
                continue;
            }

            if (rule.TargetId <= 0)
            {
                errors.Add(new Error { Code = "400", Message = "TargetId في القاعدة مطلوب." });
            }

            if (NormalizeSubjectType(rule.SubjectType) == null)
            {
                errors.Add(new Error { Code = "400", Message = "نوع الجهة في القاعدة غير صالح." });
            }

            if (NormalizePositiveInt(rule.ActionId).HasValue && !NormalizePositiveInt(rule.StageId).HasValue)
            {
                errors.Add(new Error { Code = "400", Message = "عند تحديد Action يجب تحديد Stage في القاعدة." });
            }
        }

        foreach (var lockItem in safeRequest.Locks ?? new List<FieldAccessLockDto>())
        {
            if (NormalizeTargetLevel(lockItem.TargetLevel) == null)
            {
                errors.Add(new Error { Code = "400", Message = "مستوى الهدف في القفل غير صالح." });
                continue;
            }

            if (lockItem.TargetId <= 0)
            {
                errors.Add(new Error { Code = "400", Message = "TargetId في القفل مطلوب." });
            }

            if (NormalizePositiveInt(lockItem.ActionId).HasValue && !NormalizePositiveInt(lockItem.StageId).HasValue)
            {
                errors.Add(new Error { Code = "400", Message = "عند تحديد Action يجب تحديد Stage في القفل." });
            }
        }

        return errors;
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
