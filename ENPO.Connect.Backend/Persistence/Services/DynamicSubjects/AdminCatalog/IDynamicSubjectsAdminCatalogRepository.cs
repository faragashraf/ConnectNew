using Models.Correspondance;

namespace Persistence.Services.DynamicSubjects.AdminCatalog;

public interface IDynamicSubjectsAdminCatalogRepository
{
    Task<IReadOnlyList<Application>> ListApplicationsAsync(CancellationToken cancellationToken = default);

    Task<Application?> FindApplicationAsync(string applicationId, CancellationToken cancellationToken = default);

    Task<bool> ApplicationIdExistsAsync(string applicationId, CancellationToken cancellationToken = default);

    Task AddApplicationAsync(Application application, CancellationToken cancellationToken = default);

    Task AddCategoryAsync(Cdcategory category, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<Cdcategory>> ListCategoriesAsync(string? applicationId, CancellationToken cancellationToken = default);

    Task<Cdcategory?> FindCategoryAsync(int categoryId, CancellationToken cancellationToken = default);

    Task<bool> HasSiblingCategoryNameConflictAsync(
        int parentCategoryId,
        string categoryName,
        string? applicationId,
        int? excludedCategoryId,
        CancellationToken cancellationToken = default);

    Task<IReadOnlySet<int>> LoadDescendantCategoryIdsAsync(int categoryId, CancellationToken cancellationToken = default);

    Task<int> GenerateNextCategoryIdAsync(CancellationToken cancellationToken = default);

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
