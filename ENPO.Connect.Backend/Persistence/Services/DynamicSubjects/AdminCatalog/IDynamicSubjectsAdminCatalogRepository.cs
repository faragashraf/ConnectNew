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

    Task<IReadOnlyList<Cdmend>> ListFieldsAsync(
        string? applicationId,
        string? search,
        bool? isActive,
        CancellationToken cancellationToken = default);

    Task<Cdmend?> FindFieldAsync(
        string applicationId,
        string fieldKey,
        CancellationToken cancellationToken = default);

    Task<bool> FieldExistsAsync(
        string applicationId,
        string fieldKey,
        CancellationToken cancellationToken = default);

    Task<bool> FieldSqlExistsAsync(int cdmendSql, CancellationToken cancellationToken = default);

    Task<int> GenerateNextFieldSqlAsync(CancellationToken cancellationToken = default);

    Task AddFieldAsync(Cdmend field, CancellationToken cancellationToken = default);

    void RemoveField(Cdmend field);

    Task<int> CountFieldCategoryLinksAsync(
        string fieldKey,
        bool activeOnly,
        CancellationToken cancellationToken = default);

    Task<int> CountFieldSettingsLinksAsync(int cdmendSql, CancellationToken cancellationToken = default);

    Task<int> CountFieldHistoryLinksByKeyAsync(string fieldKey, CancellationToken cancellationToken = default);

    Task<int> CountFieldHistoryLinksBySqlAsync(int cdmendSql, CancellationToken cancellationToken = default);

    Task<IReadOnlyDictionary<string, int>> CountFieldCategoryLinksByKeysAsync(
        IReadOnlyCollection<string> fieldKeys,
        bool activeOnly,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyDictionary<int, int>> CountFieldSettingsLinksBySqlsAsync(
        IReadOnlyCollection<int> cdmendSqls,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyDictionary<string, int>> CountFieldHistoryLinksByKeysAsync(
        IReadOnlyCollection<string> fieldKeys,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyDictionary<int, int>> CountFieldHistoryLinksBySqlsAsync(
        IReadOnlyCollection<int> cdmendSqls,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<string>> ListDistinctFieldTypesAsync(CancellationToken cancellationToken = default);

    Task<IReadOnlyList<string>> ListDistinctFieldDataTypesAsync(CancellationToken cancellationToken = default);

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
