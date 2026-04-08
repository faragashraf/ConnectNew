using Models.Correspondance;
using Models.DTO.Common;
using Models.DTO.DynamicSubjects;

namespace Persistence.Services.DynamicSubjects.AdminCatalog;

public sealed class DynamicSubjectsAdminCatalogService : IDynamicSubjectsAdminCatalogService
{
    private const int ApplicationIdMaxLength = 10;
    private const int ApplicationNameMaxLength = 200;
    private const int CategoryNameMaxLength = 50;

    private readonly IDynamicSubjectsAdminCatalogRepository _repository;

    public DynamicSubjectsAdminCatalogService(IDynamicSubjectsAdminCatalogRepository repository)
    {
        _repository = repository;
    }

    public async Task<CommonResponse<IEnumerable<AdminCatalogApplicationDto>>> GetApplicationsAsync(
        string userId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<IEnumerable<AdminCatalogApplicationDto>>();
        try
        {
            var normalizedUserId = NormalizeUser(userId);
            if (normalizedUserId.Length == 0)
            {
                response.Errors.Add(new Error { Code = "401", Message = "المستخدم غير مصرح له." });
                return response;
            }

            var applications = await _repository.ListApplicationsAsync(cancellationToken);
            response.Data = applications.Select(MapApplication).ToList();
        }
        catch (Exception)
        {
            AddUnhandledError(response);
        }

        return response;
    }

    public async Task<CommonResponse<AdminCatalogApplicationDto>> CreateApplicationAsync(
        AdminCatalogApplicationCreateRequestDto request,
        string userId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<AdminCatalogApplicationDto>();
        try
        {
            var normalizedUserId = NormalizeUser(userId);
            if (normalizedUserId.Length == 0)
            {
                response.Errors.Add(new Error { Code = "401", Message = "المستخدم غير مصرح له." });
                return response;
            }

            var safeRequest = request ?? new AdminCatalogApplicationCreateRequestDto();
            var applicationId = NormalizeNullable(safeRequest.ApplicationId);
            if (applicationId == null)
            {
                response.Errors.Add(new Error { Code = "400", Message = "معرف التطبيق مطلوب." });
                return response;
            }

            if (ExceedsMaxLength(applicationId, ApplicationIdMaxLength))
            {
                response.Errors.Add(new Error { Code = "400", Message = $"معرف التطبيق يجب ألا يزيد عن {ApplicationIdMaxLength} أحرف." });
                return response;
            }

            var applicationName = NormalizeNullable(safeRequest.ApplicationName);
            if (applicationName == null)
            {
                response.Errors.Add(new Error { Code = "400", Message = "اسم التطبيق مطلوب." });
                return response;
            }

            if (ExceedsMaxLength(applicationName, ApplicationNameMaxLength))
            {
                response.Errors.Add(new Error { Code = "400", Message = $"اسم التطبيق يجب ألا يزيد عن {ApplicationNameMaxLength} حرفًا." });
                return response;
            }

            if (await _repository.ApplicationIdExistsAsync(applicationId, cancellationToken))
            {
                response.Errors.Add(new Error { Code = "409", Message = "معرف التطبيق موجود بالفعل." });
                return response;
            }

            var application = new Application
            {
                ApplicationId = applicationId,
                ApplicationName = applicationName,
                IsActive = safeRequest.IsActive,
                StampDate = DateTime.Now
            };

            await _repository.AddApplicationAsync(application, cancellationToken);
            await _repository.SaveChangesAsync(cancellationToken);

            response.Data = MapApplication(application);
        }
        catch (Exception)
        {
            AddUnhandledError(response);
        }

        return response;
    }

    public async Task<CommonResponse<AdminCatalogApplicationDto>> UpdateApplicationAsync(
        string applicationId,
        AdminCatalogApplicationUpdateRequestDto request,
        string userId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<AdminCatalogApplicationDto>();
        try
        {
            var normalizedUserId = NormalizeUser(userId);
            if (normalizedUserId.Length == 0)
            {
                response.Errors.Add(new Error { Code = "401", Message = "المستخدم غير مصرح له." });
                return response;
            }

            var normalizedApplicationId = NormalizeNullable(applicationId);
            if (normalizedApplicationId == null)
            {
                response.Errors.Add(new Error { Code = "400", Message = "معرف التطبيق مطلوب." });
                return response;
            }

            var application = await _repository.FindApplicationAsync(normalizedApplicationId, cancellationToken);
            if (application == null)
            {
                response.Errors.Add(new Error { Code = "404", Message = "التطبيق غير موجود." });
                return response;
            }

            var safeRequest = request ?? new AdminCatalogApplicationUpdateRequestDto();
            var applicationName = NormalizeNullable(safeRequest.ApplicationName);
            if (applicationName == null)
            {
                response.Errors.Add(new Error { Code = "400", Message = "اسم التطبيق مطلوب." });
                return response;
            }

            if (ExceedsMaxLength(applicationName, ApplicationNameMaxLength))
            {
                response.Errors.Add(new Error { Code = "400", Message = $"اسم التطبيق يجب ألا يزيد عن {ApplicationNameMaxLength} حرفًا." });
                return response;
            }

            application.ApplicationName = applicationName;
            application.IsActive = safeRequest.IsActive;
            application.StampDate = DateTime.Now;

            await _repository.SaveChangesAsync(cancellationToken);
            response.Data = MapApplication(application);
        }
        catch (Exception)
        {
            AddUnhandledError(response);
        }

        return response;
    }

    public async Task<CommonResponse<IEnumerable<AdminCatalogCategoryTreeNodeDto>>> GetCategoryTreeAsync(
        string userId,
        string? appId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<IEnumerable<AdminCatalogCategoryTreeNodeDto>>();
        try
        {
            var normalizedUserId = NormalizeUser(userId);
            if (normalizedUserId.Length == 0)
            {
                response.Errors.Add(new Error { Code = "401", Message = "المستخدم غير مصرح له." });
                return response;
            }

            var normalizedAppId = NormalizeNullable(appId);
            var categories = await _repository.ListCategoriesAsync(normalizedAppId, cancellationToken);
            response.Data = BuildCategoryTree(categories);
        }
        catch (Exception)
        {
            AddUnhandledError(response);
        }

        return response;
    }

    public async Task<CommonResponse<AdminCatalogCategoryDto>> CreateCategoryAsync(
        AdminCatalogCategoryCreateRequestDto request,
        string userId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<AdminCatalogCategoryDto>();
        try
        {
            var normalizedUserId = NormalizeUser(userId);
            if (normalizedUserId.Length == 0)
            {
                response.Errors.Add(new Error { Code = "401", Message = "المستخدم غير مصرح له." });
                return response;
            }

            var safeRequest = request ?? new AdminCatalogCategoryCreateRequestDto();
            var applicationId = NormalizeNullable(safeRequest.ApplicationId);
            if (applicationId == null)
            {
                response.Errors.Add(new Error { Code = "400", Message = "معرف التطبيق مطلوب." });
                return response;
            }

            if (ExceedsMaxLength(applicationId, ApplicationIdMaxLength))
            {
                response.Errors.Add(new Error { Code = "400", Message = $"معرف التطبيق يجب ألا يزيد عن {ApplicationIdMaxLength} أحرف." });
                return response;
            }

            if (!await _repository.ApplicationIdExistsAsync(applicationId, cancellationToken))
            {
                response.Errors.Add(new Error { Code = "404", Message = "التطبيق المطلوب غير موجود." });
                return response;
            }

            if (safeRequest.ParentCategoryId < 0)
            {
                response.Errors.Add(new Error { Code = "400", Message = "المعرف الأب غير صالح." });
                return response;
            }

            var categoryName = NormalizeNullable(safeRequest.CategoryName);
            if (categoryName == null)
            {
                response.Errors.Add(new Error { Code = "400", Message = "اسم العنصر مطلوب." });
                return response;
            }

            if (ExceedsMaxLength(categoryName, CategoryNameMaxLength))
            {
                response.Errors.Add(new Error { Code = "400", Message = $"اسم العنصر يجب ألا يزيد عن {CategoryNameMaxLength} حرفًا." });
                return response;
            }

            if (safeRequest.ParentCategoryId > 0)
            {
                var parentCategory = await _repository.FindCategoryAsync(safeRequest.ParentCategoryId, cancellationToken);
                if (parentCategory == null)
                {
                    response.Errors.Add(new Error { Code = "404", Message = "العنصر الأب غير موجود." });
                    return response;
                }

                var parentApplicationId = NormalizeNullable(parentCategory.ApplicationId);
                if (parentApplicationId != null && !EqualsNormalized(parentApplicationId, applicationId))
                {
                    response.Errors.Add(new Error { Code = "400", Message = "لا يمكن ربط عنصر بتطبيق مختلف عن التطبيق الموجود في العنصر الأب." });
                    return response;
                }
            }

            if (await _repository.HasSiblingCategoryNameConflictAsync(
                    safeRequest.ParentCategoryId,
                    categoryName,
                    applicationId,
                    excludedCategoryId: null,
                    cancellationToken))
            {
                response.Errors.Add(new Error { Code = "409", Message = "يوجد عنصر آخر بنفس الاسم داخل نفس المستوى." });
                return response;
            }

            var nextCategoryId = await _repository.GenerateNextCategoryIdAsync(cancellationToken);
            var category = new Cdcategory
            {
                CatId = nextCategoryId,
                CatParent = safeRequest.ParentCategoryId,
                CatName = categoryName,
                CatStatus = !safeRequest.IsActive,
                CatMend = null,
                CatWorkFlow = 0,
                CatSms = false,
                CatMailNotification = false,
                To = null,
                Cc = null,
                StampDate = DateTime.Now,
                CatCreatedBy = ParseUserIdOrNull(normalizedUserId),
                CatInterval = string.Empty,
                CatIntervalCount = 0,
                ApplicationId = applicationId
            };

            await _repository.AddCategoryAsync(category, cancellationToken);
            await _repository.SaveChangesAsync(cancellationToken);

            response.Data = MapCategory(category);
        }
        catch (Exception)
        {
            AddUnhandledError(response);
        }

        return response;
    }

    public async Task<CommonResponse<AdminCatalogCategoryDto>> UpdateCategoryAsync(
        int categoryId,
        AdminCatalogCategoryUpdateRequestDto request,
        string userId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<AdminCatalogCategoryDto>();
        try
        {
            var normalizedUserId = NormalizeUser(userId);
            if (normalizedUserId.Length == 0)
            {
                response.Errors.Add(new Error { Code = "401", Message = "المستخدم غير مصرح له." });
                return response;
            }

            if (categoryId <= 0)
            {
                response.Errors.Add(new Error { Code = "400", Message = "العنصر المطلوب غير صالح." });
                return response;
            }

            var category = await _repository.FindCategoryAsync(categoryId, cancellationToken);
            if (category == null)
            {
                response.Errors.Add(new Error { Code = "404", Message = "العنصر غير موجود." });
                return response;
            }

            var safeRequest = request ?? new AdminCatalogCategoryUpdateRequestDto();
            if (safeRequest.ParentCategoryId < 0)
            {
                response.Errors.Add(new Error { Code = "400", Message = "المعرف الأب غير صالح." });
                return response;
            }

            if (safeRequest.ParentCategoryId == categoryId)
            {
                response.Errors.Add(new Error { Code = "400", Message = "لا يمكن ربط العنصر بنفسه." });
                return response;
            }

            var categoryName = NormalizeNullable(safeRequest.CategoryName);
            if (categoryName == null)
            {
                response.Errors.Add(new Error { Code = "400", Message = "اسم العنصر مطلوب." });
                return response;
            }

            if (ExceedsMaxLength(categoryName, CategoryNameMaxLength))
            {
                response.Errors.Add(new Error { Code = "400", Message = $"اسم العنصر يجب ألا يزيد عن {CategoryNameMaxLength} حرفًا." });
                return response;
            }

            var categoryApplicationId = NormalizeNullable(category.ApplicationId);
            if (safeRequest.ParentCategoryId > 0)
            {
                var parentCategory = await _repository.FindCategoryAsync(safeRequest.ParentCategoryId, cancellationToken);
                if (parentCategory == null)
                {
                    response.Errors.Add(new Error { Code = "404", Message = "العنصر الأب غير موجود." });
                    return response;
                }

                var descendants = await _repository.LoadDescendantCategoryIdsAsync(categoryId, cancellationToken);
                if (descendants.Contains(safeRequest.ParentCategoryId))
                {
                    response.Errors.Add(new Error { Code = "400", Message = "لا يمكن نقل العنصر تحت أحد الأبناء." });
                    return response;
                }

                var parentApplicationId = NormalizeNullable(parentCategory.ApplicationId);
                if (categoryApplicationId != null && parentApplicationId != null && !EqualsNormalized(categoryApplicationId, parentApplicationId))
                {
                    response.Errors.Add(new Error { Code = "400", Message = "لا يمكن ربط العنصر بأب يتبع تطبيقًا مختلفًا." });
                    return response;
                }

                if (categoryApplicationId == null && parentApplicationId != null)
                {
                    categoryApplicationId = parentApplicationId;
                    category.ApplicationId = parentApplicationId;
                }
            }

            if (await _repository.HasSiblingCategoryNameConflictAsync(
                    safeRequest.ParentCategoryId,
                    categoryName,
                    categoryApplicationId,
                    excludedCategoryId: categoryId,
                    cancellationToken))
            {
                response.Errors.Add(new Error { Code = "409", Message = "يوجد عنصر آخر بنفس الاسم داخل نفس المستوى." });
                return response;
            }

            category.CatName = categoryName;
            category.CatParent = safeRequest.ParentCategoryId;
            category.CatStatus = !safeRequest.IsActive;
            category.StampDate = DateTime.Now;

            await _repository.SaveChangesAsync(cancellationToken);

            response.Data = MapCategory(category);
        }
        catch (Exception)
        {
            AddUnhandledError(response);
        }

        return response;
    }

    private static AdminCatalogApplicationDto MapApplication(Application application)
    {
        return new AdminCatalogApplicationDto
        {
            ApplicationId = application.ApplicationId,
            ApplicationName = application.ApplicationName,
            IsActive = application.IsActive ?? true
        };
    }

    private static AdminCatalogCategoryDto MapCategory(Cdcategory category)
    {
        return new AdminCatalogCategoryDto
        {
            CategoryId = category.CatId,
            ParentCategoryId = category.CatParent,
            CategoryName = category.CatName,
            ApplicationId = category.ApplicationId,
            IsActive = !category.CatStatus
        };
    }

    private static IReadOnlyList<AdminCatalogCategoryTreeNodeDto> BuildCategoryTree(IReadOnlyList<Cdcategory> categories)
    {
        var nodeMap = categories.ToDictionary(
            keySelector: item => item.CatId,
            elementSelector: item => new CategoryTreeBuilderNode
            {
                CategoryId = item.CatId,
                ParentCategoryId = item.CatParent,
                CategoryName = item.CatName,
                ApplicationId = item.ApplicationId,
                IsActive = !item.CatStatus
            });

        var rootNodes = new List<CategoryTreeBuilderNode>();
        foreach (var category in categories)
        {
            var node = nodeMap[category.CatId];
            if (category.CatParent > 0 && nodeMap.TryGetValue(category.CatParent, out var parentNode))
            {
                parentNode.Children.Add(node);
                continue;
            }

            rootNodes.Add(node);
        }

        SortNodes(rootNodes);
        return rootNodes.Select(MapTreeNode).ToList();
    }

    private static void SortNodes(List<CategoryTreeBuilderNode> nodes)
    {
        nodes.Sort((left, right) =>
        {
            var byName = string.Compare(left.CategoryName, right.CategoryName, StringComparison.OrdinalIgnoreCase);
            if (byName != 0)
            {
                return byName;
            }

            return left.CategoryId.CompareTo(right.CategoryId);
        });

        foreach (var node in nodes)
        {
            if (node.Children.Count == 0)
            {
                continue;
            }

            SortNodes(node.Children);
        }
    }

    private static AdminCatalogCategoryTreeNodeDto MapTreeNode(CategoryTreeBuilderNode node)
    {
        return new AdminCatalogCategoryTreeNodeDto
        {
            CategoryId = node.CategoryId,
            ParentCategoryId = node.ParentCategoryId,
            CategoryName = node.CategoryName,
            ApplicationId = node.ApplicationId,
            IsActive = node.IsActive,
            Children = node.Children.Select(MapTreeNode).ToList()
        };
    }

    private static int? ParseUserIdOrNull(string userId)
    {
        return int.TryParse(userId, out var parsedUserId) ? parsedUserId : null;
    }

    private static string NormalizeUser(string userId)
    {
        return (userId ?? string.Empty).Trim();
    }

    private static bool EqualsNormalized(string left, string right)
    {
        return string.Equals(left.Trim(), right.Trim(), StringComparison.OrdinalIgnoreCase);
    }

    private static string? NormalizeNullable(string? value)
    {
        var normalized = (value ?? string.Empty).Trim();
        return normalized.Length == 0 ? null : normalized;
    }

    private static bool ExceedsMaxLength(string? value, int maxLength)
    {
        return (value ?? string.Empty).Length > maxLength;
    }

    private static void AddUnhandledError<T>(CommonResponse<T> response)
    {
        response.Errors.Add(new Error { Code = "500", Message = "حدث خطأ غير متوقع أثناء معالجة الطلب." });
    }

    private sealed class CategoryTreeBuilderNode
    {
        public int CategoryId { get; init; }

        public int ParentCategoryId { get; init; }

        public string CategoryName { get; init; } = string.Empty;

        public string? ApplicationId { get; init; }

        public bool IsActive { get; init; }

        public List<CategoryTreeBuilderNode> Children { get; } = new();
    }
}
