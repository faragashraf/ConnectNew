using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Models.Correspondance;
using Models.DTO.Common;
using Models.DTO.DynamicSubjects;
using Persistence.Data;
using Persistence.Services.DynamicSubjects.AdminCatalog;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Threading;
using System.Threading.Tasks;

namespace Persistence.Services.DynamicSubjects.RuntimeCatalog;

public sealed class RequestRuntimeCatalogService : IRequestRuntimeCatalogService
{
    private const string UnassignedApplicationKey = "__UNASSIGNED_APPLICATION__";
    private const string DefaultEnvelopeDisplayName = "حزمة طلبات جديدة";

    private static readonly JsonSerializerOptions SerializerOptions = new(JsonSerializerDefaults.Web)
    {
        PropertyNameCaseInsensitive = true
    };

    private readonly ConnectContext _connectContext;
    private readonly GPAContext _gpaContext;
    private readonly IAdminControlCenterRequestPreviewResolver _requestPreviewResolver;
    private readonly ILogger<RequestRuntimeCatalogService>? _logger;

    public RequestRuntimeCatalogService(
        ConnectContext connectContext,
        GPAContext gpaContext,
        IAdminControlCenterRequestPreviewResolver requestPreviewResolver,
        ILogger<RequestRuntimeCatalogService>? logger = null)
    {
        _connectContext = connectContext;
        _gpaContext = gpaContext;
        _requestPreviewResolver = requestPreviewResolver;
        _logger = logger;
    }

    public async Task<CommonResponse<RequestRuntimeCatalogDto>> GetAvailableRegistrationTreeAsync(
        string userId,
        string? appId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<RequestRuntimeCatalogDto>();
        try
        {
            var normalizedUserId = NormalizeUser(userId);
            if (normalizedUserId.Length == 0)
            {
                response.Errors.Add(new Error { Code = "401", Message = "المستخدم غير مصرح له." });
                return response;
            }

            var normalizedAppId = NormalizeNullable(appId);
            IQueryable<Cdcategory> categoriesQuery = _connectContext.Cdcategories.AsNoTracking();
            if (normalizedAppId != null)
            {
                categoriesQuery = categoriesQuery.Where(category =>
                    (category.ApplicationId ?? string.Empty) == normalizedAppId);
            }

            var categories = await categoriesQuery
                .OrderBy(category => category.CatParent)
                .ThenBy(category => category.CatName)
                .ToListAsync(cancellationToken);

            if (categories.Count == 0)
            {
                response.Data = new RequestRuntimeCatalogDto();
                return response;
            }

            var categoryById = categories.ToDictionary(category => category.CatId);
            var categoryIds = categories.Select(item => item.CatId).ToHashSet();

            var userUnitIds = await GetCurrentUserUnitIdsAsync(normalizedUserId, cancellationToken);

            var categorySettingsMap = await _connectContext.SubjectTypeAdminSettings
                .AsNoTracking()
                .Where(setting => categoryIds.Contains(setting.CategoryId))
                .ToDictionaryAsync(setting => setting.CategoryId, cancellationToken);

            var categoriesWithFieldsSet = (await _connectContext.AdminCatalogCategoryFieldBindings
                .AsNoTracking()
                .Where(link => categoryIds.Contains(link.CategoryId) && !link.MendStat)
                .Select(link => link.CategoryId)
                .Distinct()
                .ToListAsync(cancellationToken))
                .ToHashSet();

            var availabilityRows = await _connectContext.SubjectTypeRequestAvailabilities
                .AsNoTracking()
                .Where(item => categoryIds.Contains(item.CategoryId))
                .ToDictionaryAsync(item => item.CategoryId, cancellationToken);

            var specificUserEligibleCategoryIds = availabilityRows
                .Where(item => IsSpecificUserAvailabilityMatch(item.Value, normalizedUserId))
                .Select(item => item.Key)
                .ToHashSet();

            var scopedCategoryIds = BuildScopedCategoryIds(
                categories,
                userUnitIds,
                categorySettingsMap,
                specificUserEligibleCategoryIds);

            if (scopedCategoryIds.Count == 0)
            {
                response.Data = new RequestRuntimeCatalogDto();
                return response;
            }

            var scopedCategories = categories
                .Where(category => scopedCategoryIds.Contains(category.CatId))
                .ToList();

            var requestPolicyByCategoryId = categorySettingsMap
                .ToDictionary(
                    item => item.Key,
                    item => TryReadRequestPolicyFromSettingsJson(item.Value.SettingsJson));

            bool CanCreateByPolicy(Cdcategory category)
            {
                var hasDynamicFields = categoriesWithFieldsSet.Contains(category.CatId);
                if (!hasDynamicFields || category.CatStatus)
                {
                    return false;
                }

                requestPolicyByCategoryId.TryGetValue(category.CatId, out var requestPolicy);
                if (requestPolicy == null)
                {
                    var legacyAllowed = HasLegacyCreateAccess(category.CatId, userUnitIds, categoryById);
                    if (!legacyAllowed && specificUserEligibleCategoryIds.Contains(category.CatId))
                    {
                        return true;
                    }

                    return legacyAllowed;
                }

                var resolvedAccess = RequestPolicyResolver.ResolveAccessPolicy(requestPolicy);
                if (resolvedAccess.CreateUnitIds.Count > 0)
                {
                    return RequestPolicyResolver.IsCreateAllowedForUnits(requestPolicy, userUnitIds);
                }

                if (!resolvedAccess.InheritLegacyAccess)
                {
                    return true;
                }

                var legacyAllowedWithPolicy = HasLegacyCreateAccess(category.CatId, userUnitIds, categoryById);
                if (!legacyAllowedWithPolicy && specificUserEligibleCategoryIds.Contains(category.CatId))
                {
                    return true;
                }

                return legacyAllowedWithPolicy;
            }

            var candidateRuntimeCategoryIds = scopedCategories
                .Where(category => categoriesWithFieldsSet.Contains(category.CatId) && !category.CatStatus)
                .Select(category => category.CatId)
                .Distinct()
                .ToList();

            var runtimeAvailabilityMap = await ResolveRuntimePreviewAvailabilityMapAsync(
                candidateRuntimeCategoryIds,
                normalizedUserId,
                cancellationToken);

            var startableCategoryIds = scopedCategories
                .Where(category => CanCreateByPolicy(category)
                    && runtimeAvailabilityMap.TryGetValue(category.CatId, out var runtime)
                    && runtime.IsAvailable)
                .Select(category => category.CatId)
                .ToHashSet();

            if (startableCategoryIds.Count == 0)
            {
                response.Data = new RequestRuntimeCatalogDto();
                return response;
            }

            var includeTreeIds = new HashSet<int>();
            foreach (var categoryId in startableCategoryIds)
            {
                IncludeAncestors(categoryId, categoryById, includeTreeIds);
            }

            var filteredCategories = scopedCategories
                .Where(category => includeTreeIds.Contains(category.CatId))
                .ToList();

            var startStageMap = await LoadStartStageMapAsync(startableCategoryIds, cancellationToken);

            var appIds = filteredCategories
                .Select(category => NormalizeNullable(category.ApplicationId))
                .Where(applicationId => applicationId != null)
                .Cast<string>()
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            Dictionary<string, string> appNameMap;
            if (appIds.Count == 0)
            {
                appNameMap = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            }
            else
            {
                var appRows = await _connectContext.Set<Application>()
                    .AsNoTracking()
                    .Where(item => appIds.Contains(item.ApplicationId))
                    .ToListAsync(cancellationToken);

                appNameMap = appRows
                    .GroupBy(item => item.ApplicationId, StringComparer.OrdinalIgnoreCase)
                    .ToDictionary(
                        group => group.Key,
                        group =>
                        {
                            var first = group.First();
                            return NormalizeNullable(first.ApplicationName) ?? first.ApplicationId;
                        },
                        StringComparer.OrdinalIgnoreCase);
            }

            var displayOrderByCategoryId = categorySettingsMap
                .ToDictionary(item => item.Key, item => item.Value.DisplayOrder);

            var categoriesByApplication = filteredCategories
                .GroupBy(category => NormalizeNullable(category.ApplicationId) ?? UnassignedApplicationKey)
                .OrderBy(group => group.Key, StringComparer.OrdinalIgnoreCase)
                .ToList();

            var applications = new List<RequestRuntimeCatalogApplicationDto>();

            foreach (var applicationGroup in categoriesByApplication)
            {
                var appKey = applicationGroup.Key;
                var categoryItems = applicationGroup.ToList();
                var appCategoryById = categoryItems.ToDictionary(item => item.CatId);

                var childrenLookup = categoryItems
                    .GroupBy(item => item.CatParent)
                    .ToDictionary(
                        group => group.Key,
                        group => group
                            .OrderBy(item => displayOrderByCategoryId.TryGetValue(item.CatId, out var displayOrder)
                                ? displayOrder
                                : int.MaxValue)
                            .ThenBy(item => item.CatName)
                            .ToList());

                RequestRuntimeCatalogNodeDto? BuildNode(Cdcategory category)
                {
                    var childNodes = new List<RequestRuntimeCatalogNodeDto>();
                    if (childrenLookup.TryGetValue(category.CatId, out var childCategories))
                    {
                        foreach (var childCategory in childCategories)
                        {
                            var mappedChild = BuildNode(childCategory);
                            if (mappedChild != null)
                            {
                                childNodes.Add(mappedChild);
                            }
                        }
                    }

                    var canStart = startableCategoryIds.Contains(category.CatId);
                    if (!canStart && childNodes.Count == 0)
                    {
                        return null;
                    }

                    requestPolicyByCategoryId.TryGetValue(category.CatId, out var requestPolicy);
                    availabilityRows.TryGetValue(category.CatId, out var availabilityRow);

                    runtimeAvailabilityMap.TryGetValue(category.CatId, out var runtimeState);

                    var node = new RequestRuntimeCatalogNodeDto
                    {
                        CategoryId = category.CatId,
                        ParentCategoryId = category.CatParent,
                        CategoryName = category.CatName,
                        ApplicationId = NormalizeNullable(category.ApplicationId),
                        IsRequestType = categoriesWithFieldsSet.Contains(category.CatId),
                        CanStart = canStart,
                        DisplayOrder = displayOrderByCategoryId.TryGetValue(category.CatId, out var displayOrder)
                            ? displayOrder
                            : 0,
                        OrganizationalUnitScope = BuildOrganizationalScope(
                            category.CatId,
                            requestPolicy,
                            availabilityRow,
                            categoryById),
                        EnvelopeDisplayName = categorySettingsMap.TryGetValue(category.CatId, out var categorySetting)
                            ? ResolveEnvelopeDisplayName(categorySetting.SettingsJson)
                            : DefaultEnvelopeDisplayName,
                        StartStage = canStart
                            ? (startStageMap.TryGetValue(category.CatId, out var startStage)
                                ? startStage
                                : null)
                            : null,
                        AvailabilityReasons = canStart
                            ? (runtimeState != null
                                ? runtimeState.Reasons
                                : new List<string>())
                            : new List<string>(),
                        RuntimeWarnings = canStart
                            ? (runtimeState != null
                                ? runtimeState.Warnings
                                : new List<string>())
                            : new List<string>(),
                        Children = childNodes
                    };

                    return node;
                }

                var rootCategories = categoryItems
                    .Where(category => category.CatParent <= 0 || !appCategoryById.ContainsKey(category.CatParent))
                    .OrderBy(category => displayOrderByCategoryId.TryGetValue(category.CatId, out var displayOrder)
                        ? displayOrder
                        : int.MaxValue)
                    .ThenBy(category => category.CatName)
                    .ToList();

                var treeNodes = new List<RequestRuntimeCatalogNodeDto>();
                foreach (var rootCategory in rootCategories)
                {
                    var node = BuildNode(rootCategory);
                    if (node != null)
                    {
                        treeNodes.Add(node);
                    }
                }

                var appStartableCount = categoryItems.Count(item => startableCategoryIds.Contains(item.CatId));
                if (appStartableCount <= 0 || treeNodes.Count == 0)
                {
                    continue;
                }

                var resolvedAppId = appKey == UnassignedApplicationKey ? string.Empty : appKey;
                var resolvedAppName = resolvedAppId.Length == 0
                    ? "بدون تطبيق"
                    : (appNameMap.TryGetValue(resolvedAppId, out var appName)
                        ? appName
                        : resolvedAppId);

                applications.Add(new RequestRuntimeCatalogApplicationDto
                {
                    ApplicationId = resolvedAppId,
                    ApplicationName = resolvedAppName,
                    TotalAvailableRequests = appStartableCount,
                    Categories = treeNodes
                });
            }

            response.Data = new RequestRuntimeCatalogDto
            {
                GeneratedAtUtc = DateTime.UtcNow,
                TotalAvailableRequests = applications.Sum(item => item.TotalAvailableRequests),
                Applications = applications
                    .OrderBy(item => item.ApplicationName)
                    .ThenBy(item => item.ApplicationId)
                    .ToList()
            };
        }
        catch (Exception ex)
        {
            _logger?.LogError(ex, "Failed to resolve request runtime catalog for user {UserId}", userId);
            response.Errors.Add(new Error
            {
                Code = "500",
                Message = "حدث خطأ غير متوقع أثناء تحميل شجرة الطلبات المتاحة للتسجيل."
            });
        }

        return response;
    }

    private static HashSet<int> BuildScopedCategoryIds(
        IReadOnlyCollection<Cdcategory> categories,
        IReadOnlyCollection<string> unitIds,
        IReadOnlyDictionary<int, SubjectTypeAdminSetting> categorySettingsMap,
        IReadOnlyCollection<int> specificUserEligibleCategoryIds)
    {
        var includeIds = new HashSet<int>();
        var byId = categories.ToDictionary(item => item.CatId);

        var unitNumbers = (unitIds ?? Array.Empty<string>())
            .Select(unit => int.TryParse(unit, out var parsed) ? parsed : 0)
            .Where(parsed => parsed > 0)
            .ToHashSet();

        if (unitNumbers.Count > 0)
        {
            foreach (var category in categories)
            {
                var rootCategoryId = ResolveRootCategoryId(category.CatId, byId);
                if (!unitNumbers.Contains(rootCategoryId))
                {
                    continue;
                }

                includeIds.Add(category.CatId);
                IncludeAncestors(category.CatId, byId, includeIds);
            }

            var normalizedUnitSet = unitIds
                .Select(unit => NormalizeNullable(unit))
                .Where(unit => unit != null)
                .Cast<string>()
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

            if (normalizedUnitSet.Count > 0)
            {
                foreach (var settingsRow in categorySettingsMap)
                {
                    if (!byId.ContainsKey(settingsRow.Key))
                    {
                        continue;
                    }

                    var requestPolicy = TryReadRequestPolicyFromSettingsJson(settingsRow.Value.SettingsJson);
                    if (requestPolicy == null)
                    {
                        continue;
                    }

                    var resolvedAccess = RequestPolicyResolver.ResolveAccessPolicy(requestPolicy);
                    var includeByPolicy =
                        resolvedAccess.CreateUnitIds.Overlaps(normalizedUnitSet)
                        || resolvedAccess.ReadUnitIds.Overlaps(normalizedUnitSet)
                        || resolvedAccess.WorkUnitIds.Overlaps(normalizedUnitSet);
                    if (!includeByPolicy)
                    {
                        continue;
                    }

                    includeIds.Add(settingsRow.Key);
                    IncludeAncestors(settingsRow.Key, byId, includeIds);
                }
            }
        }

        foreach (var categoryId in specificUserEligibleCategoryIds ?? Array.Empty<int>())
        {
            if (!byId.ContainsKey(categoryId))
            {
                continue;
            }

            includeIds.Add(categoryId);
            IncludeAncestors(categoryId, byId, includeIds);
        }

        return includeIds;
    }

    private static bool HasLegacyCreateAccess(
        int categoryId,
        IReadOnlyCollection<string> unitIds,
        IReadOnlyDictionary<int, Cdcategory> categoryById)
    {
        if (categoryId <= 0 || unitIds == null || unitIds.Count == 0)
        {
            return false;
        }

        var numericUnitIds = unitIds
            .Select(unit => int.TryParse(unit, out var parsed) ? parsed : 0)
            .Where(parsed => parsed > 0)
            .ToHashSet();

        if (numericUnitIds.Count == 0)
        {
            return false;
        }

        if (!categoryById.ContainsKey(categoryId))
        {
            return false;
        }

        var rootCategoryId = ResolveRootCategoryId(categoryId, categoryById);
        return numericUnitIds.Contains(rootCategoryId);
    }

    private async Task<List<string>> GetCurrentUserUnitIdsAsync(string userId, CancellationToken cancellationToken)
    {
        var normalized = NormalizeUser(userId);
        if (normalized.Length == 0)
        {
            return new List<string>();
        }

        var today = DateTime.Today;
        var unitIds = await _gpaContext.UserPositions
            .AsNoTracking()
            .Where(position => position.UserId == normalized
                && position.IsActive != false
                && (!position.StartDate.HasValue || position.StartDate.Value <= today)
                && (!position.EndDate.HasValue || position.EndDate.Value >= today))
            .Select(position => position.UnitId)
            .Distinct()
            .ToListAsync(cancellationToken);

        return unitIds
            .Select(unitId => unitId.ToString(CultureInfo.InvariantCulture))
            .Select(unitId => (unitId ?? string.Empty).Trim())
            .Where(unitId => unitId.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    private async Task<Dictionary<int, RequestRuntimeStartStageDto?>> LoadStartStageMapAsync(
        IReadOnlyCollection<int> categoryIds,
        CancellationToken cancellationToken)
    {
        var result = new Dictionary<int, RequestRuntimeStartStageDto?>();
        var requestTypeIds = (categoryIds ?? Array.Empty<int>())
            .Where(item => item > 0)
            .Distinct()
            .ToList();

        if (requestTypeIds.Count == 0)
        {
            return result;
        }

        var activeBindings = await _connectContext.SubjectTypeRoutingBindings
            .AsNoTracking()
            .Where(item => requestTypeIds.Contains(item.SubjectTypeId) && item.IsActive)
            .ToListAsync(cancellationToken);

        var activeProfiles = await _connectContext.SubjectRoutingProfiles
            .AsNoTracking()
            .Where(item => requestTypeIds.Contains(item.SubjectTypeId) && item.IsActive)
            .ToListAsync(cancellationToken);

        var profileById = activeProfiles.ToDictionary(item => item.Id);
        var activeProfileIds = activeProfiles
            .Select(item => item.Id)
            .Distinct()
            .ToList();

        var activeSteps = activeProfileIds.Count == 0
            ? new List<SubjectRoutingStep>()
            : await _connectContext.SubjectRoutingSteps
                .AsNoTracking()
                .Where(item => activeProfileIds.Contains(item.RoutingProfileId) && item.IsActive)
                .ToListAsync(cancellationToken);

        var stepsByProfileId = activeSteps
            .GroupBy(item => item.RoutingProfileId)
            .ToDictionary(
                group => group.Key,
                group => group
                    .OrderBy(item => item.StepOrder)
                    .ThenBy(item => item.Id)
                    .ToList());

        foreach (var requestTypeId in requestTypeIds)
        {
            var selectedProfile = activeBindings
                .Where(item => item.SubjectTypeId == requestTypeId)
                .OrderByDescending(item => item.IsDefault)
                .ThenBy(item => item.Id)
                .Select(item => profileById.TryGetValue(item.RoutingProfileId, out var profile) ? profile : null)
                .FirstOrDefault(item => item != null);

            selectedProfile ??= activeProfiles
                .Where(item => item.SubjectTypeId == requestTypeId)
                .OrderBy(item => item.Id)
                .FirstOrDefault();

            if (selectedProfile == null)
            {
                result[requestTypeId] = null;
                continue;
            }

            stepsByProfileId.TryGetValue(selectedProfile.Id, out var candidateSteps);
            candidateSteps ??= new List<SubjectRoutingStep>();

            SubjectRoutingStep? startStep = null;

            if (selectedProfile.StartStepId.HasValue && selectedProfile.StartStepId.Value > 0)
            {
                startStep = candidateSteps.FirstOrDefault(item => item.Id == selectedProfile.StartStepId.Value);
            }

            startStep ??= candidateSteps
                .Where(item => item.IsStart)
                .OrderBy(item => item.StepOrder)
                .ThenBy(item => item.Id)
                .FirstOrDefault();

            startStep ??= candidateSteps
                .OrderBy(item => item.StepOrder)
                .ThenBy(item => item.Id)
                .FirstOrDefault();

            result[requestTypeId] = new RequestRuntimeStartStageDto
            {
                StageId = startStep?.Id,
                StageName = NormalizeNullable(startStep?.StepNameAr) ?? NormalizeNullable(startStep?.StepCode),
                RoutingProfileId = selectedProfile.Id,
                RoutingProfileName = NormalizeNullable(selectedProfile.NameAr)
            };
        }

        return result;
    }

    private async Task<Dictionary<int, RuntimePreviewAvailabilityState>> ResolveRuntimePreviewAvailabilityMapAsync(
        IReadOnlyCollection<int> categoryIds,
        string normalizedUserId,
        CancellationToken cancellationToken)
    {
        var map = new Dictionary<int, RuntimePreviewAvailabilityState>();
        foreach (var categoryId in (categoryIds ?? Array.Empty<int>())
                     .Where(item => item > 0)
                     .Distinct()
                     .OrderBy(item => item))
        {
            map[categoryId] = await ResolveRuntimePreviewAvailabilityAsync(categoryId, normalizedUserId, cancellationToken);
        }

        return map;
    }

    private async Task<RuntimePreviewAvailabilityState> ResolveRuntimePreviewAvailabilityAsync(
        int categoryId,
        string normalizedUserId,
        CancellationToken cancellationToken)
    {
        if (categoryId <= 0 || normalizedUserId.Length == 0)
        {
            return RuntimePreviewAvailabilityState.CreateDenied;
        }

        try
        {
            var previewResponse = await _requestPreviewResolver.ResolveAsync(
                categoryId,
                normalizedUserId,
                cancellationToken);
            if (previewResponse?.Data != null && (previewResponse.Errors?.Count ?? 0) == 0)
            {
                return new RuntimePreviewAvailabilityState
                {
                    IsAvailable = previewResponse.Data.IsAvailable,
                    Reasons = DistinctNormalized(previewResponse.Data.AvailabilityReasons),
                    Warnings = DistinctNormalized(previewResponse.Data.Warnings)
                };
            }

            var warningMessages = new List<string> { "تعذر تقييم Runtime Availability لهذا النوع أثناء التحميل." };
            if (previewResponse?.Errors != null)
            {
                warningMessages.AddRange(
                    previewResponse.Errors
                        .Select(error => NormalizeNullable(error?.Message))
                        .Where(message => message != null)
                        .Select(message => message!));
            }

            return new RuntimePreviewAvailabilityState
            {
                IsAvailable = false,
                Reasons = new List<string> { "تم حجب النوع لعدم اكتمال تقييم Runtime Availability." },
                Warnings = DistinctNormalized(warningMessages)
            };
        }
        catch (Exception ex)
        {
            _logger?.LogWarning(
                ex,
                "Runtime preview availability evaluation failed for categoryId {CategoryId}, userId {UserId}.",
                categoryId,
                normalizedUserId);
            return new RuntimePreviewAvailabilityState
            {
                IsAvailable = false,
                Reasons = new List<string> { "تم حجب النوع بسبب خطأ أثناء تقييم Runtime Availability." },
                Warnings = new List<string> { "تعذر الوصول لنتيجة Runtime Preview في هذه اللحظة." }
            };
        }
    }

    private static RequestRuntimeOrganizationalUnitScopeDto BuildOrganizationalScope(
        int categoryId,
        RequestPolicyDefinitionDto? requestPolicy,
        SubjectTypeRequestAvailability? availability,
        IReadOnlyDictionary<int, Cdcategory> categoryById)
    {
        var resolvedAccess = RequestPolicyResolver.ResolveAccessPolicy(requestPolicy);
        if (resolvedAccess.CreateUnitIds.Count > 0)
        {
            return new RequestRuntimeOrganizationalUnitScopeDto
            {
                ScopeMode = "RequestPolicyCreateScope",
                UnitIds = resolvedAccess.CreateUnitIds
                    .OrderBy(item => item)
                    .ToList(),
                ScopeLabel = "نطاق الإنشاء محدد من Access Policy"
            };
        }

        var availabilityMode = NormalizeNullable(availability?.AvailabilityMode);
        var availabilityNodeType = NormalizeNullable(availability?.SelectedNodeType);
        var availabilityNodeId = availability?.SelectedNodeNumericId;

        if (string.Equals(availabilityMode, "Restricted", StringComparison.OrdinalIgnoreCase)
            && string.Equals(availabilityNodeType, "OrgUnit", StringComparison.OrdinalIgnoreCase)
            && availabilityNodeId.HasValue
            && availabilityNodeId.Value > 0)
        {
            var unitId = availabilityNodeId.Value.ToString(CultureInfo.InvariantCulture);
            return new RequestRuntimeOrganizationalUnitScopeDto
            {
                ScopeMode = "RuntimeAvailabilityOrgUnit",
                UnitIds = new List<string> { unitId },
                ScopeLabel = NormalizeNullable(availability?.SelectionPathAr)
                    ?? NormalizeNullable(availability?.SelectionLabelAr)
                    ?? "وحدة تنظيمية محددة من Runtime Availability"
            };
        }

        var rootCategoryId = ResolveRootCategoryId(categoryId, categoryById);
        return new RequestRuntimeOrganizationalUnitScopeDto
        {
            ScopeMode = "LegacyRoot",
            UnitIds = rootCategoryId > 0
                ? new List<string> { rootCategoryId.ToString(CultureInfo.InvariantCulture) }
                : new List<string>(),
            ScopeLabel = "نطاق الجذر التقليدي"
        };
    }

    private static bool IsSpecificUserAvailabilityMatch(
        SubjectTypeRequestAvailability? availability,
        string normalizedUserId)
    {
        if (availability == null || normalizedUserId.Length == 0)
        {
            return false;
        }

        var availabilityMode = NormalizeNullable(availability.AvailabilityMode);
        if (!string.Equals(availabilityMode, "Restricted", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        var selectedNodeType = NormalizeNullable(availability.SelectedNodeType);
        if (!string.Equals(selectedNodeType, "SpecificUser", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        var selectedUserId = NormalizeNullable(availability.SelectedNodeUserId);
        if (selectedUserId == null)
        {
            return false;
        }

        return string.Equals(selectedUserId, normalizedUserId, StringComparison.OrdinalIgnoreCase);
    }

    private static RequestPolicyDefinitionDto? TryReadRequestPolicyFromSettingsJson(string? settingsJson)
    {
        var payload = (settingsJson ?? string.Empty).Trim();
        if (payload.Length == 0)
        {
            return null;
        }

        try
        {
            var rootNode = JsonNode.Parse(payload);
            if (rootNode is JsonObject rootObject)
            {
                if (rootObject.TryGetPropertyValue("requestPolicy", out var policyNode) && policyNode != null)
                {
                    var nestedPolicy = policyNode.Deserialize<RequestPolicyDefinitionDto>(SerializerOptions);
                    return nestedPolicy == null ? null : RequestPolicyResolver.Normalize(nestedPolicy);
                }

                var directPolicy = rootObject.Deserialize<RequestPolicyDefinitionDto>(SerializerOptions);
                var hasPolicyShape =
                    rootObject.TryGetPropertyValue("presentationRules", out _)
                    || rootObject.TryGetPropertyValue("accessPolicy", out _)
                    || rootObject.TryGetPropertyValue("workflowPolicy", out _);
                if (directPolicy != null && hasPolicyShape)
                {
                    return RequestPolicyResolver.Normalize(directPolicy);
                }
            }
        }
        catch
        {
            return null;
        }

        return null;
    }

    private static string ResolveEnvelopeDisplayName(string? settingsJson)
    {
        var payload = (settingsJson ?? string.Empty).Trim();
        if (payload.Length == 0)
        {
            return DefaultEnvelopeDisplayName;
        }

        try
        {
            var rootNode = JsonNode.Parse(payload);
            if (rootNode is not JsonObject rootObject)
            {
                return DefaultEnvelopeDisplayName;
            }

            var nestedPresentationObject = rootObject["presentationSettings"] as JsonObject;
            var candidate =
                ReadStringFromJsonNode(rootObject["envelopeDisplayName"])
                ?? ReadStringFromJsonNode(rootObject["requestEnvelopeDisplayName"])
                ?? ReadStringFromJsonNode(nestedPresentationObject?["envelopeDisplayName"]);

            return NormalizeNullable(candidate) ?? DefaultEnvelopeDisplayName;
        }
        catch
        {
            return DefaultEnvelopeDisplayName;
        }
    }

    private static string? ReadStringFromJsonNode(JsonNode? node)
    {
        if (node is not JsonValue value)
        {
            return null;
        }

        return value.TryGetValue<string>(out var parsed)
            ? NormalizeNullable(parsed)
            : null;
    }

    private static int ResolveRootCategoryId(int categoryId, IReadOnlyDictionary<int, Cdcategory> byId)
    {
        var cursor = categoryId;
        var safety = 0;

        while (safety++ < 150
            && byId.TryGetValue(cursor, out var category)
            && category.CatParent > 0
            && byId.ContainsKey(category.CatParent))
        {
            cursor = category.CatParent;
        }

        return cursor;
    }

    private static void IncludeAncestors(int categoryId, IReadOnlyDictionary<int, Cdcategory> byId, HashSet<int> includeIds)
    {
        var cursor = categoryId;
        var safety = 0;
        while (safety++ < 150 && byId.TryGetValue(cursor, out var category))
        {
            includeIds.Add(category.CatId);
            if (category.CatParent <= 0)
            {
                break;
            }

            cursor = category.CatParent;
        }
    }

    private static List<string> DistinctNormalized(IEnumerable<string> values)
    {
        var result = new List<string>();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var value in values ?? Array.Empty<string>())
        {
            var normalized = NormalizeNullable(value);
            if (normalized == null)
            {
                continue;
            }

            if (!seen.Add(normalized))
            {
                continue;
            }

            result.Add(normalized);
        }

        return result;
    }

    private static string NormalizeUser(string? userId)
    {
        return (userId ?? string.Empty).Trim();
    }

    private static string? NormalizeNullable(string? value)
    {
        var normalized = (value ?? string.Empty).Trim();
        return normalized.Length == 0 ? null : normalized;
    }

    private sealed class RuntimePreviewAvailabilityState
    {
        public static RuntimePreviewAvailabilityState CreateDenied => new()
        {
            IsAvailable = false,
            Reasons = new List<string> { "النوع غير متاح وفق السياسة الحالية." }
        };

        public bool IsAvailable { get; set; }

        public List<string> Reasons { get; set; } = new();

        public List<string> Warnings { get; set; } = new();
    }
}
