using Microsoft.EntityFrameworkCore;
using Models.Correspondance;
using Persistence.Data;

namespace Persistence.Services.DynamicSubjects;

internal sealed class SubjectCategoryGroupBridge
{
    private readonly IReadOnlyDictionary<int, AdminCatalogCategoryGroup> _canonicalGroupsById;
    private readonly IReadOnlyDictionary<int, MandGroup> _legacyGroupsById;
    private readonly IReadOnlyDictionary<int, int> _legacyToCanonicalMap;
    private readonly IReadOnlyDictionary<int, int> _canonicalToLegacyMap;

    public SubjectCategoryGroupBridge(
        int categoryId,
        IReadOnlyDictionary<int, AdminCatalogCategoryGroup> canonicalGroupsById,
        IReadOnlyDictionary<int, MandGroup> legacyGroupsById,
        IReadOnlyDictionary<int, int> legacyToCanonicalMap,
        IReadOnlyDictionary<int, int> canonicalToLegacyMap,
        IReadOnlyCollection<int> ambiguousLegacyGroupIds)
    {
        CategoryId = categoryId;
        _canonicalGroupsById = canonicalGroupsById ?? new Dictionary<int, AdminCatalogCategoryGroup>();
        _legacyGroupsById = legacyGroupsById ?? new Dictionary<int, MandGroup>();
        _legacyToCanonicalMap = legacyToCanonicalMap ?? new Dictionary<int, int>();
        _canonicalToLegacyMap = canonicalToLegacyMap ?? new Dictionary<int, int>();
        AmbiguousLegacyGroupIds = ambiguousLegacyGroupIds == null
            ? Array.Empty<int>()
            : ambiguousLegacyGroupIds
                .Distinct()
                .OrderBy(item => item)
                .ToArray();
    }

    public int CategoryId { get; }

    public IReadOnlyDictionary<int, AdminCatalogCategoryGroup> CanonicalGroupsById => _canonicalGroupsById;

    public IReadOnlyDictionary<int, MandGroup> LegacyGroupsById => _legacyGroupsById;

    public IReadOnlyCollection<int> AmbiguousLegacyGroupIds { get; }

    public int ResolveCanonicalGroupId(int legacyGroupId)
    {
        if (legacyGroupId <= 0)
        {
            return legacyGroupId;
        }

        if (_legacyToCanonicalMap.TryGetValue(legacyGroupId, out var mappedGroupId) && mappedGroupId > 0)
        {
            return mappedGroupId;
        }

        if (_canonicalGroupsById.ContainsKey(legacyGroupId))
        {
            return legacyGroupId;
        }

        return legacyGroupId;
    }

    public int ResolveLegacyGroupId(int canonicalGroupId)
    {
        if (canonicalGroupId <= 0)
        {
            return canonicalGroupId;
        }

        if (_canonicalToLegacyMap.TryGetValue(canonicalGroupId, out var mappedGroupId) && mappedGroupId > 0)
        {
            return mappedGroupId;
        }

        if (_legacyGroupsById.ContainsKey(canonicalGroupId))
        {
            return canonicalGroupId;
        }

        return canonicalGroupId;
    }

    public bool TryGetCanonicalGroup(int canonicalGroupId, out AdminCatalogCategoryGroup? group)
    {
        if (_canonicalGroupsById.TryGetValue(canonicalGroupId, out var candidate))
        {
            group = candidate;
            return true;
        }

        group = null;
        return false;
    }

    public bool TryGetLegacyGroup(int legacyGroupId, out MandGroup? group)
    {
        if (_legacyGroupsById.TryGetValue(legacyGroupId, out var candidate))
        {
            group = candidate;
            return true;
        }

        group = null;
        return false;
    }

    public string ResolveCanonicalGroupName(int canonicalGroupId, int? legacyGroupId = null)
    {
        if (TryGetCanonicalGroup(canonicalGroupId, out var canonical)
            && NormalizeNullable(canonical!.GroupName) is { } canonicalName)
        {
            return canonicalName;
        }

        if (legacyGroupId.HasValue
            && TryGetLegacyGroup(legacyGroupId.Value, out var legacy)
            && NormalizeNullable(legacy!.GroupName) is { } legacyName)
        {
            return legacyName;
        }

        return $"مجموعة {canonicalGroupId}";
    }

    public string? ResolveCanonicalGroupDescription(int canonicalGroupId, int? legacyGroupId = null)
    {
        if (TryGetCanonicalGroup(canonicalGroupId, out var canonical)
            && NormalizeNullable(canonical!.GroupDescription) is { } canonicalDescription)
        {
            return canonicalDescription;
        }

        if (legacyGroupId.HasValue
            && TryGetLegacyGroup(legacyGroupId.Value, out var legacy)
            && NormalizeNullable(legacy!.GroupDescription) is { } legacyDescription)
        {
            return legacyDescription;
        }

        return null;
    }

    private static string? NormalizeNullable(string? value)
    {
        var normalized = (value ?? string.Empty).Trim();
        return normalized.Length == 0 ? null : normalized;
    }
}

internal static class SubjectCategoryGroupBridgeBuilder
{
    public static async Task<SubjectCategoryGroupBridge> BuildAsync(
        ConnectContext connectContext,
        int categoryId,
        IReadOnlyCollection<int>? candidateLegacyGroupIds = null,
        CancellationToken cancellationToken = default)
    {
        if (connectContext == null || categoryId <= 0)
        {
            return new SubjectCategoryGroupBridge(
                categoryId,
                new Dictionary<int, AdminCatalogCategoryGroup>(),
                new Dictionary<int, MandGroup>(),
                new Dictionary<int, int>(),
                new Dictionary<int, int>(),
                Array.Empty<int>());
        }

        var adminGroups = await connectContext.AdminCatalogCategoryGroups
            .AsNoTracking()
            .Where(item => item.CategoryId == categoryId && item.IsActive)
            .ToListAsync(cancellationToken);
        var adminById = adminGroups
            .GroupBy(item => item.GroupId)
            .ToDictionary(group => group.Key, group => group.First());

        var requestedLegacyGroupIds = (candidateLegacyGroupIds ?? Array.Empty<int>())
            .Where(item => item > 0)
            .Distinct()
            .ToList();

        var unresolvedLegacyGroupIds = requestedLegacyGroupIds
            .Where(item => !adminById.ContainsKey(item))
            .Distinct()
            .ToList();
        var legacyGroups = unresolvedLegacyGroupIds.Count == 0
            ? new List<MandGroup>()
            : await connectContext.MandGroups
                .AsNoTracking()
                .Where(item => unresolvedLegacyGroupIds.Contains(item.GroupId))
                .ToListAsync(cancellationToken);
        var legacyById = legacyGroups
            .GroupBy(item => item.GroupId)
            .ToDictionary(group => group.Key, group => group.First());

        var adminNameIndex = adminGroups
            .Select(item => new
            {
                item.GroupId,
                NameKey = NormalizeName(item.GroupName)
            })
            .Where(item => item.NameKey != null)
            .GroupBy(item => item.NameKey!, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(
                group => group.Key,
                group => group
                    .Select(item => item.GroupId)
                    .Distinct()
                    .OrderBy(item => item)
                    .ToList(),
                StringComparer.OrdinalIgnoreCase);

        var legacyToCanonicalMap = new Dictionary<int, int>();
        var ambiguousLegacyIds = new HashSet<int>();
        foreach (var legacyGroupId in requestedLegacyGroupIds.OrderBy(item => item))
        {
            if (legacyGroupId <= 0)
            {
                continue;
            }

            if (adminById.ContainsKey(legacyGroupId))
            {
                legacyToCanonicalMap[legacyGroupId] = legacyGroupId;
                continue;
            }

            if (!legacyById.TryGetValue(legacyGroupId, out var legacyGroup))
            {
                continue;
            }

            var normalizedLegacyName = NormalizeName(legacyGroup.GroupName);
            if (normalizedLegacyName == null)
            {
                continue;
            }

            if (!adminNameIndex.TryGetValue(normalizedLegacyName, out var candidates) || candidates.Count == 0)
            {
                continue;
            }

            if (candidates.Count == 1)
            {
                legacyToCanonicalMap[legacyGroupId] = candidates[0];
                continue;
            }

            ambiguousLegacyIds.Add(legacyGroupId);
        }

        var canonicalToLegacyMap = new Dictionary<int, int>();
        foreach (var canonicalGroupId in adminById.Keys.OrderBy(item => item))
        {
            canonicalToLegacyMap[canonicalGroupId] = canonicalGroupId;
        }

        foreach (var pair in legacyToCanonicalMap.OrderBy(item => item.Key))
        {
            if (!canonicalToLegacyMap.ContainsKey(pair.Value))
            {
                canonicalToLegacyMap[pair.Value] = pair.Key;
            }
        }

        return new SubjectCategoryGroupBridge(
            categoryId,
            adminById,
            legacyById,
            legacyToCanonicalMap,
            canonicalToLegacyMap,
            ambiguousLegacyIds);
    }

    private static string? NormalizeName(string? value)
    {
        var normalized = (value ?? string.Empty).Trim();
        return normalized.Length == 0 ? null : normalized.ToUpperInvariant();
    }
}
