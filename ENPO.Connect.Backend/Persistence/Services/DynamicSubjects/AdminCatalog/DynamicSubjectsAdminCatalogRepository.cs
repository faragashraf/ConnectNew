using Microsoft.EntityFrameworkCore;
using Models.Correspondance;
using Persistence.Data;
using System.Data;

namespace Persistence.Services.DynamicSubjects.AdminCatalog;

public sealed class DynamicSubjectsAdminCatalogRepository : IDynamicSubjectsAdminCatalogRepository
{
    private readonly ConnectContext _connectContext;

    public DynamicSubjectsAdminCatalogRepository(ConnectContext connectContext)
    {
        _connectContext = connectContext;
    }

    public async Task<IReadOnlyList<Application>> ListApplicationsAsync(CancellationToken cancellationToken = default)
    {
        return await _connectContext
            .Set<Application>()
            .AsNoTracking()
            .OrderByDescending(item => item.IsActive ?? false)
            .ThenBy(item => item.ApplicationName)
            .ThenBy(item => item.ApplicationId)
            .ToListAsync(cancellationToken);
    }

    public Task<Application?> FindApplicationAsync(string applicationId, CancellationToken cancellationToken = default)
    {
        var normalizedApplicationId = NormalizeNullable(applicationId);
        if (normalizedApplicationId == null)
        {
            return Task.FromResult<Application?>(null);
        }

        return _connectContext
            .Set<Application>()
            .FirstOrDefaultAsync(item => item.ApplicationId == normalizedApplicationId, cancellationToken);
    }

    public async Task<bool> ApplicationIdExistsAsync(string applicationId, CancellationToken cancellationToken = default)
    {
        var normalizedApplicationId = NormalizeNullable(applicationId);
        if (normalizedApplicationId == null)
        {
            return false;
        }

        return await _connectContext
            .Set<Application>()
            .AsNoTracking()
            .AnyAsync(item => item.ApplicationId == normalizedApplicationId, cancellationToken);
    }

    public Task AddApplicationAsync(Application application, CancellationToken cancellationToken = default)
    {
        return _connectContext.Set<Application>().AddAsync(application, cancellationToken).AsTask();
    }

    public void RemoveApplication(Application application)
    {
        _connectContext.Set<Application>().Remove(application);
    }

    public async Task<int> CountCategoriesByApplicationAsync(string applicationId, CancellationToken cancellationToken = default)
    {
        var normalizedApplicationId = NormalizeNullable(applicationId);
        if (normalizedApplicationId == null)
        {
            return 0;
        }

        return await _connectContext.Cdcategories
            .AsNoTracking()
            .CountAsync(item => (item.ApplicationId ?? string.Empty) == normalizedApplicationId, cancellationToken);
    }

    public async Task<int> CountFieldsByApplicationAsync(string applicationId, CancellationToken cancellationToken = default)
    {
        var normalizedApplicationId = NormalizeNullable(applicationId);
        if (normalizedApplicationId == null)
        {
            return 0;
        }

        return await _connectContext.Cdmends
            .AsNoTracking()
            .CountAsync(item => (item.ApplicationId ?? string.Empty) == normalizedApplicationId, cancellationToken);
    }

    public async Task<int> CountCategoryGroupsByApplicationAsync(string applicationId, CancellationToken cancellationToken = default)
    {
        var normalizedApplicationId = NormalizeNullable(applicationId);
        if (normalizedApplicationId == null)
        {
            return 0;
        }

        return await _connectContext.AdminCatalogCategoryGroups
            .AsNoTracking()
            .CountAsync(item => (item.ApplicationId ?? string.Empty) == normalizedApplicationId && item.IsActive, cancellationToken);
    }

    public Task AddCategoryAsync(Cdcategory category, CancellationToken cancellationToken = default)
    {
        return _connectContext.Cdcategories.AddAsync(category, cancellationToken).AsTask();
    }

    public void RemoveCategory(Cdcategory category)
    {
        _connectContext.Cdcategories.Remove(category);
    }

    public async Task<IReadOnlyList<Cdcategory>> ListCategoriesAsync(string? applicationId, CancellationToken cancellationToken = default)
    {
        var normalizedApplicationId = NormalizeNullable(applicationId);
        IQueryable<Cdcategory> query = _connectContext.Cdcategories
            .AsNoTracking()
            .Where(item => !item.CatStatus);

        if (normalizedApplicationId != null)
        {
            query = query.Where(item => (item.ApplicationId ?? string.Empty) == normalizedApplicationId);
        }

        return await query
            .OrderBy(item => item.CatParent)
            .ThenBy(item => item.CatName)
            .ThenBy(item => item.CatId)
            .ToListAsync(cancellationToken);
    }

    public async Task<Cdcategory?> FindCategoryAsync(int categoryId, CancellationToken cancellationToken = default)
    {
        if (categoryId <= 0)
        {
            return null;
        }

        return await _connectContext.Cdcategories
            .FirstOrDefaultAsync(item => item.CatId == categoryId, cancellationToken);
    }

    public async Task<int> CountActiveChildCategoriesAsync(int categoryId, CancellationToken cancellationToken = default)
    {
        if (categoryId <= 0)
        {
            return 0;
        }

        return await _connectContext.Cdcategories
            .AsNoTracking()
            .CountAsync(item => item.CatParent == categoryId && !item.CatStatus, cancellationToken);
    }

    public async Task<int> CountCategoryFieldLinksAsync(int categoryId, CancellationToken cancellationToken = default)
    {
        if (categoryId <= 0)
        {
            return 0;
        }

        return await _connectContext.CdCategoryMands
            .AsNoTracking()
            .CountAsync(item => item.MendCategory == categoryId, cancellationToken);
    }

    public async Task<int> CountCategoryMessageLinksAsync(int categoryId, CancellationToken cancellationToken = default)
    {
        if (categoryId <= 0)
        {
            return 0;
        }

        return await _connectContext.Messages
            .AsNoTracking()
            .CountAsync(item => item.CategoryCd == categoryId, cancellationToken);
    }

    public async Task<int> CountCategoryGroupsAsync(int categoryId, CancellationToken cancellationToken = default)
    {
        if (categoryId <= 0)
        {
            return 0;
        }

        return await _connectContext.AdminCatalogCategoryGroups
            .AsNoTracking()
            .CountAsync(item => item.CategoryId == categoryId && item.IsActive, cancellationToken);
    }

    public async Task<bool> HasSiblingCategoryNameConflictAsync(
        int parentCategoryId,
        string categoryName,
        string? applicationId,
        int? excludedCategoryId,
        CancellationToken cancellationToken = default)
    {
        var normalizedCategoryName = (categoryName ?? string.Empty).Trim();
        if (normalizedCategoryName.Length == 0)
        {
            return false;
        }

        var normalizedApplicationId = NormalizeNullable(applicationId);

        var query = _connectContext.Cdcategories
            .AsNoTracking()
            .Where(item => !item.CatStatus)
            .Where(item => item.CatParent == parentCategoryId)
            .Where(item => item.CatName == normalizedCategoryName);

        if (excludedCategoryId.HasValue && excludedCategoryId.Value > 0)
        {
            var excludedId = excludedCategoryId.Value;
            query = query.Where(item => item.CatId != excludedId);
        }

        if (normalizedApplicationId == null)
        {
            query = query.Where(item => string.IsNullOrEmpty(item.ApplicationId));
        }
        else
        {
            query = query.Where(item => (item.ApplicationId ?? string.Empty) == normalizedApplicationId);
        }

        return await query.AnyAsync(cancellationToken);
    }

    public async Task<IReadOnlySet<int>> LoadDescendantCategoryIdsAsync(int categoryId, CancellationToken cancellationToken = default)
    {
        var descendants = new HashSet<int>();
        if (categoryId <= 0)
        {
            return descendants;
        }

        var frontier = new List<int> { categoryId };
        while (frontier.Count > 0)
        {
            var children = await _connectContext.Cdcategories
                .AsNoTracking()
                .Where(item => frontier.Contains(item.CatParent) && !item.CatStatus)
                .Select(item => item.CatId)
                .ToListAsync(cancellationToken);

            frontier = new List<int>();
            foreach (var childId in children)
            {
                if (!descendants.Add(childId))
                {
                    continue;
                }

                frontier.Add(childId);
            }
        }

        return descendants;
    }

    public async Task<int> GenerateNextCategoryIdAsync(CancellationToken cancellationToken = default)
    {
        var maxCategoryId = await _connectContext.Cdcategories
            .AsNoTracking()
            .MaxAsync(item => (int?)item.CatId, cancellationToken)
            ?? 100;

        var nextFromSequence = await TryReadNextCategoryIdFromSequenceAsync(cancellationToken);
        if (nextFromSequence.HasValue && nextFromSequence.Value > maxCategoryId)
        {
            return nextFromSequence.Value;
        }

        return maxCategoryId + 1;
    }

    public async Task<IReadOnlyList<AdminCatalogCategoryGroup>> ListGroupsByCategoryAsync(
        int categoryId,
        CancellationToken cancellationToken = default)
    {
        if (categoryId <= 0)
        {
            return Array.Empty<AdminCatalogCategoryGroup>();
        }

        return await _connectContext.AdminCatalogCategoryGroups
            .AsNoTracking()
            .Where(item => item.CategoryId == categoryId && item.IsActive)
            .OrderBy(item => item.ParentGroupId)
            .ThenBy(item => item.DisplayOrder)
            .ThenBy(item => item.GroupName)
            .ThenBy(item => item.GroupId)
            .ToListAsync(cancellationToken);
    }

    public async Task<AdminCatalogCategoryGroup?> FindGroupAsync(int groupId, CancellationToken cancellationToken = default)
    {
        if (groupId <= 0)
        {
            return null;
        }

        return await _connectContext.AdminCatalogCategoryGroups
            .FirstOrDefaultAsync(item => item.GroupId == groupId, cancellationToken);
    }

    public Task AddGroupAsync(AdminCatalogCategoryGroup group, CancellationToken cancellationToken = default)
    {
        return _connectContext.AdminCatalogCategoryGroups.AddAsync(group, cancellationToken).AsTask();
    }

    public void RemoveGroup(AdminCatalogCategoryGroup group)
    {
        _connectContext.AdminCatalogCategoryGroups.Remove(group);
    }

    public async Task<int> CountChildGroupsAsync(int groupId, CancellationToken cancellationToken = default)
    {
        if (groupId <= 0)
        {
            return 0;
        }

        return await _connectContext.AdminCatalogCategoryGroups
            .AsNoTracking()
            .CountAsync(item => item.ParentGroupId == groupId && item.IsActive, cancellationToken);
    }

    public async Task<IReadOnlySet<int>> LoadDescendantGroupIdsAsync(int groupId, CancellationToken cancellationToken = default)
    {
        var descendants = new HashSet<int>();
        if (groupId <= 0)
        {
            return descendants;
        }

        var frontier = new List<int> { groupId };
        while (frontier.Count > 0)
        {
            var children = await _connectContext.AdminCatalogCategoryGroups
                .AsNoTracking()
                .Where(item => item.IsActive && item.ParentGroupId.HasValue && frontier.Contains(item.ParentGroupId.Value))
                .Select(item => item.GroupId)
                .ToListAsync(cancellationToken);

            frontier = new List<int>();
            foreach (var childId in children)
            {
                if (!descendants.Add(childId))
                {
                    continue;
                }

                frontier.Add(childId);
            }
        }

        return descendants;
    }

    public async Task<bool> HasSiblingGroupNameConflictAsync(
        int categoryId,
        int? parentGroupId,
        string groupName,
        int? excludedGroupId,
        CancellationToken cancellationToken = default)
    {
        var normalizedGroupName = (groupName ?? string.Empty).Trim();
        if (categoryId <= 0 || normalizedGroupName.Length == 0)
        {
            return false;
        }

        var query = _connectContext.AdminCatalogCategoryGroups
            .AsNoTracking()
            .Where(item => item.IsActive)
            .Where(item => item.CategoryId == categoryId)
            .Where(item => item.GroupName == normalizedGroupName);

        if (parentGroupId.HasValue && parentGroupId.Value > 0)
        {
            var normalizedParentGroupId = parentGroupId.Value;
            query = query.Where(item => item.ParentGroupId == normalizedParentGroupId);
        }
        else
        {
            query = query.Where(item => !item.ParentGroupId.HasValue || item.ParentGroupId.Value <= 0);
        }

        if (excludedGroupId.HasValue && excludedGroupId.Value > 0)
        {
            var normalizedExcludedId = excludedGroupId.Value;
            query = query.Where(item => item.GroupId != normalizedExcludedId);
        }

        return await query.AnyAsync(cancellationToken);
    }

    public async Task<int> GenerateNextGroupIdAsync(CancellationToken cancellationToken = default)
    {
        var maxGroupId = await _connectContext.AdminCatalogCategoryGroups
            .AsNoTracking()
            .MaxAsync(item => (int?)item.GroupId, cancellationToken)
            ?? 0;

        return maxGroupId + 1;
    }

    public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        return _connectContext.SaveChangesAsync(cancellationToken);
    }

    private async Task<int?> TryReadNextCategoryIdFromSequenceAsync(CancellationToken cancellationToken)
    {
        try
        {
            var connection = _connectContext.Database.GetDbConnection();
            var shouldCloseConnection = connection.State != ConnectionState.Open;
            if (shouldCloseConnection)
            {
                await connection.OpenAsync(cancellationToken);
            }

            try
            {
                await using var command = connection.CreateCommand();
                command.CommandText = "SELECT NEXT VALUE FOR Seq_Categories";
                var rawValue = await command.ExecuteScalarAsync(cancellationToken);
                if (rawValue == null || rawValue == DBNull.Value)
                {
                    return null;
                }

                var parsed = Convert.ToInt32(rawValue);
                return parsed > 0 ? parsed : null;
            }
            finally
            {
                if (shouldCloseConnection)
                {
                    await connection.CloseAsync();
                }
            }
        }
        catch
        {
            return null;
        }
    }

    private static string? NormalizeNullable(string? value)
    {
        var normalized = (value ?? string.Empty).Trim();
        return normalized.Length == 0 ? null : normalized;
    }
}
