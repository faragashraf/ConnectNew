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

    public Task AddCategoryAsync(Cdcategory category, CancellationToken cancellationToken = default)
    {
        return _connectContext.Cdcategories.AddAsync(category, cancellationToken).AsTask();
    }

    public async Task<IReadOnlyList<Cdcategory>> ListCategoriesAsync(string? applicationId, CancellationToken cancellationToken = default)
    {
        var normalizedApplicationId = NormalizeNullable(applicationId);
        IQueryable<Cdcategory> query = _connectContext.Cdcategories.AsNoTracking();

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
                .Where(item => frontier.Contains(item.CatParent))
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
        var nextFromSequence = await TryReadNextCategoryIdFromSequenceAsync(cancellationToken);
        if (nextFromSequence.HasValue && nextFromSequence.Value > 0)
        {
            return nextFromSequence.Value;
        }

        var maxCategoryId = await _connectContext.Cdcategories
            .AsNoTracking()
            .MaxAsync(item => (int?)item.CatId, cancellationToken)
            ?? 100;

        return maxCategoryId + 1;
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
