using Models.Correspondance;

namespace Persistence.Services.DynamicSubjects.AdminCatalog;

public interface IDynamicSubjectsAdminCatalogRepository
{
    Task<IReadOnlyList<Application>> ListApplicationsAsync(CancellationToken cancellationToken = default);

    Task<Application?> FindApplicationAsync(string applicationId, CancellationToken cancellationToken = default);

    Task<bool> ApplicationIdExistsAsync(string applicationId, CancellationToken cancellationToken = default);

    Task AddApplicationAsync(Application application, CancellationToken cancellationToken = default);

    void RemoveApplication(Application application);

    Task<int> CountCategoriesByApplicationAsync(string applicationId, CancellationToken cancellationToken = default);

    Task<int> CountFieldsByApplicationAsync(string applicationId, CancellationToken cancellationToken = default);

    Task<int> CountCategoryGroupsByApplicationAsync(string applicationId, CancellationToken cancellationToken = default);

    Task AddCategoryAsync(Cdcategory category, CancellationToken cancellationToken = default);

    void RemoveCategory(Cdcategory category);

    Task<IReadOnlyList<Cdcategory>> ListCategoriesAsync(string? applicationId, CancellationToken cancellationToken = default);

    Task<Cdcategory?> FindCategoryAsync(int categoryId, CancellationToken cancellationToken = default);

    Task<int> CountActiveChildCategoriesAsync(int categoryId, CancellationToken cancellationToken = default);

    Task<int> CountCategoryFieldLinksAsync(int categoryId, CancellationToken cancellationToken = default);

    Task<int> CountCategoryMessageLinksAsync(int categoryId, CancellationToken cancellationToken = default);

    Task<int> CountCategoryGroupsAsync(int categoryId, CancellationToken cancellationToken = default);

    Task<bool> HasSiblingCategoryNameConflictAsync(
        int parentCategoryId,
        string categoryName,
        string? applicationId,
        int? excludedCategoryId,
        CancellationToken cancellationToken = default);

    Task<IReadOnlySet<int>> LoadDescendantCategoryIdsAsync(int categoryId, CancellationToken cancellationToken = default);

    Task<int> GenerateNextCategoryIdAsync(CancellationToken cancellationToken = default);

    Task<IReadOnlyList<AdminCatalogCategoryGroup>> ListGroupsByCategoryAsync(
        int categoryId,
        CancellationToken cancellationToken = default);

    Task<AdminCatalogCategoryGroup?> FindGroupAsync(int groupId, CancellationToken cancellationToken = default);

    Task AddGroupAsync(AdminCatalogCategoryGroup group, CancellationToken cancellationToken = default);

    void RemoveGroup(AdminCatalogCategoryGroup group);

    Task<int> CountChildGroupsAsync(int groupId, CancellationToken cancellationToken = default);

    Task<IReadOnlySet<int>> LoadDescendantGroupIdsAsync(int groupId, CancellationToken cancellationToken = default);

    Task<bool> HasSiblingGroupNameConflictAsync(
        int categoryId,
        int? parentGroupId,
        string groupName,
        int? excludedGroupId,
        CancellationToken cancellationToken = default);

    Task<int> GenerateNextGroupIdAsync(CancellationToken cancellationToken = default);

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
