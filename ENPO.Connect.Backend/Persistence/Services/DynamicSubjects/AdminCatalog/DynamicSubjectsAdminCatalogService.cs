using Models.Correspondance;
using Models.DTO.Common;
using Models.DTO.DynamicSubjects;

namespace Persistence.Services.DynamicSubjects.AdminCatalog;

public sealed class DynamicSubjectsAdminCatalogService : IDynamicSubjectsAdminCatalogService
{
    private const int ApplicationIdMaxLength = 10;
    private const int ApplicationNameMaxLength = 200;
    private const int CategoryNameMaxLength = 50;
    private const int GroupNameMaxLength = 200;
    private const int GroupDescriptionMaxLength = 255;
    private const int GroupDisplayOrderMin = 0;
    private const int GroupDisplayOrderMax = 100000;

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

    public async Task<CommonResponse<AdminCatalogApplicationDeleteDiagnosticsDto>> DiagnoseApplicationDeleteAsync(
        string applicationId,
        string userId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<AdminCatalogApplicationDeleteDiagnosticsDto>();
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

            response.Data = await BuildApplicationDeleteDiagnosticsAsync(normalizedApplicationId, cancellationToken);
        }
        catch (Exception)
        {
            AddUnhandledError(response);
        }

        return response;
    }

    public async Task<CommonResponse<AdminCatalogDeleteResultDto>> DeleteApplicationAsync(
        string applicationId,
        string userId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<AdminCatalogDeleteResultDto>();
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

            var diagnostics = await BuildApplicationDeleteDiagnosticsAsync(normalizedApplicationId, cancellationToken);
            if (diagnostics.CanHardDelete)
            {
                _repository.RemoveApplication(application);
                await _repository.SaveChangesAsync(cancellationToken);
                response.Data = new AdminCatalogDeleteResultDto
                {
                    Deleted = true,
                    Mode = "hard",
                    Message = "تم حذف التطبيق حذفًا نهائيًا لعدم وجود أي ارتباطات." 
                };

                return response;
            }

            if (application.IsActive == false)
            {
                response.Data = new AdminCatalogDeleteResultDto
                {
                    Deleted = false,
                    Mode = "soft",
                    Message = "التطبيق غير مفعل بالفعل (حذف منطقي سابق)."
                };

                return response;
            }

            application.IsActive = false;
            application.StampDate = DateTime.Now;
            await _repository.SaveChangesAsync(cancellationToken);

            response.Data = new AdminCatalogDeleteResultDto
            {
                Deleted = true,
                Mode = "soft",
                Message = "تم تنفيذ حذف منطقي (Soft Delete) لأن التطبيق مرتبط ببيانات أخرى."
            };
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
                if (parentCategory == null || parentCategory.CatStatus)
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
            if (category == null || category.CatStatus)
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
                if (parentCategory == null || parentCategory.CatStatus)
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

    public async Task<CommonResponse<AdminCatalogCategoryDeleteDiagnosticsDto>> DiagnoseCategoryDeleteAsync(
        int categoryId,
        string userId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<AdminCatalogCategoryDeleteDiagnosticsDto>();
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

            response.Data = await BuildCategoryDeleteDiagnosticsAsync(category.CatId, cancellationToken);
        }
        catch (Exception)
        {
            AddUnhandledError(response);
        }

        return response;
    }

    public async Task<CommonResponse<AdminCatalogDeleteResultDto>> DeleteCategoryAsync(
        int categoryId,
        string userId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<AdminCatalogDeleteResultDto>();
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

            var diagnostics = await BuildCategoryDeleteDiagnosticsAsync(categoryId, cancellationToken);
            if (diagnostics.IsBlocked)
            {
                response.Errors.Add(new Error { Code = "400", Message = diagnostics.DecisionReason ?? "لا يمكن حذف العنصر." });
                return response;
            }

            if (diagnostics.CanHardDelete)
            {
                _repository.RemoveCategory(category);
                await _repository.SaveChangesAsync(cancellationToken);
                response.Data = new AdminCatalogDeleteResultDto
                {
                    Deleted = true,
                    Mode = "hard",
                    Message = "تم حذف العنصر حذفًا نهائيًا لعدم وجود أي ارتباطات."
                };

                return response;
            }

            if (category.CatStatus)
            {
                response.Data = new AdminCatalogDeleteResultDto
                {
                    Deleted = false,
                    Mode = "soft",
                    Message = "العنصر محذوف منطقيًا بالفعل."
                };

                return response;
            }

            category.CatStatus = true;
            category.StampDate = DateTime.Now;
            await _repository.SaveChangesAsync(cancellationToken);

            response.Data = new AdminCatalogDeleteResultDto
            {
                Deleted = true,
                Mode = "soft",
                Message = "تم تنفيذ حذف منطقي (Soft Delete) لأن العنصر مرتبط ببيانات أخرى."
            };
        }
        catch (Exception)
        {
            AddUnhandledError(response);
        }

        return response;
    }

    public async Task<CommonResponse<IEnumerable<AdminCatalogGroupTreeNodeDto>>> GetGroupsByCategoryAsync(
        int categoryId,
        string userId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<IEnumerable<AdminCatalogGroupTreeNodeDto>>();
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
            if (category == null || category.CatStatus)
            {
                response.Errors.Add(new Error { Code = "404", Message = "العنصر غير موجود أو محذوف." });
                return response;
            }

            var groups = await _repository.ListGroupsByCategoryAsync(categoryId, cancellationToken);
            response.Data = BuildGroupTree(groups);
        }
        catch (Exception)
        {
            AddUnhandledError(response);
        }

        return response;
    }

    public async Task<CommonResponse<AdminCatalogGroupDto>> CreateGroupAsync(
        AdminCatalogGroupCreateRequestDto request,
        string userId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<AdminCatalogGroupDto>();
        try
        {
            var normalizedUserId = NormalizeUser(userId);
            if (normalizedUserId.Length == 0)
            {
                response.Errors.Add(new Error { Code = "401", Message = "المستخدم غير مصرح له." });
                return response;
            }

            var safeRequest = request ?? new AdminCatalogGroupCreateRequestDto();
            if (safeRequest.CategoryId <= 0)
            {
                response.Errors.Add(new Error { Code = "400", Message = "اختيار النود مطلوب." });
                return response;
            }

            var category = await _repository.FindCategoryAsync(safeRequest.CategoryId, cancellationToken);
            if (category == null || category.CatStatus)
            {
                response.Errors.Add(new Error { Code = "404", Message = "النود المختارة غير موجودة أو محذوفة." });
                return response;
            }

            var requestedApplicationId = NormalizeNullable(safeRequest.ApplicationId);
            if (requestedApplicationId == null)
            {
                response.Errors.Add(new Error { Code = "400", Message = "معرف التطبيق مطلوب." });
                return response;
            }

            if (ExceedsMaxLength(requestedApplicationId, ApplicationIdMaxLength))
            {
                response.Errors.Add(new Error { Code = "400", Message = $"معرف التطبيق يجب ألا يزيد عن {ApplicationIdMaxLength} أحرف." });
                return response;
            }

            var categoryApplicationId = NormalizeNullable(category.ApplicationId);
            if (categoryApplicationId == null || !EqualsNormalized(categoryApplicationId, requestedApplicationId))
            {
                response.Errors.Add(new Error { Code = "400", Message = "النود المختارة لا تتبع التطبيق المحدد." });
                return response;
            }

            var groupName = NormalizeNullable(safeRequest.GroupName);
            if (groupName == null)
            {
                response.Errors.Add(new Error { Code = "400", Message = "اسم الجروب مطلوب." });
                return response;
            }

            if (ExceedsMaxLength(groupName, GroupNameMaxLength))
            {
                response.Errors.Add(new Error { Code = "400", Message = $"اسم الجروب يجب ألا يزيد عن {GroupNameMaxLength} حرفًا." });
                return response;
            }

            var groupDescription = NormalizeNullable(safeRequest.GroupDescription);
            if (ExceedsMaxLength(groupDescription, GroupDescriptionMaxLength))
            {
                response.Errors.Add(new Error { Code = "400", Message = $"وصف الجروب يجب ألا يزيد عن {GroupDescriptionMaxLength} حرفًا." });
                return response;
            }

            if (safeRequest.DisplayOrder < GroupDisplayOrderMin || safeRequest.DisplayOrder > GroupDisplayOrderMax)
            {
                response.Errors.Add(new Error { Code = "400", Message = $"ترتيب العرض يجب أن يكون بين {GroupDisplayOrderMin} و {GroupDisplayOrderMax}." });
                return response;
            }

            var parentGroupId = NormalizeParentGroupId(safeRequest.ParentGroupId);
            if (parentGroupId.HasValue)
            {
                var parentGroup = await _repository.FindGroupAsync(parentGroupId.Value, cancellationToken);
                if (parentGroup == null || !parentGroup.IsActive)
                {
                    response.Errors.Add(new Error { Code = "404", Message = "الجروب الأب غير موجود." });
                    return response;
                }

                if (parentGroup.CategoryId != safeRequest.CategoryId)
                {
                    response.Errors.Add(new Error { Code = "400", Message = "لا يمكن اختيار جروب أب تابع لنود مختلفة." });
                    return response;
                }
            }

            if (await _repository.HasSiblingGroupNameConflictAsync(
                    safeRequest.CategoryId,
                    parentGroupId,
                    groupName,
                    excludedGroupId: null,
                    cancellationToken))
            {
                response.Errors.Add(new Error { Code = "409", Message = "يوجد جروب آخر بنفس الاسم داخل نفس المستوى." });
                return response;
            }

            var nextGroupId = await _repository.GenerateNextGroupIdAsync(cancellationToken);
            var group = new AdminCatalogCategoryGroup
            {
                GroupId = nextGroupId,
                CategoryId = safeRequest.CategoryId,
                ApplicationId = requestedApplicationId,
                GroupName = groupName,
                GroupDescription = groupDescription,
                ParentGroupId = parentGroupId,
                DisplayOrder = safeRequest.DisplayOrder,
                IsActive = safeRequest.IsActive,
                StampDate = DateTime.Now,
                CreatedBy = ParseUserIdOrNull(normalizedUserId)
            };

            await _repository.AddGroupAsync(group, cancellationToken);
            await _repository.SaveChangesAsync(cancellationToken);
            response.Data = MapGroup(group);
        }
        catch (Exception)
        {
            AddUnhandledError(response);
        }

        return response;
    }

    public async Task<CommonResponse<AdminCatalogGroupDto>> UpdateGroupAsync(
        int groupId,
        AdminCatalogGroupUpdateRequestDto request,
        string userId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<AdminCatalogGroupDto>();
        try
        {
            var normalizedUserId = NormalizeUser(userId);
            if (normalizedUserId.Length == 0)
            {
                response.Errors.Add(new Error { Code = "401", Message = "المستخدم غير مصرح له." });
                return response;
            }

            if (groupId <= 0)
            {
                response.Errors.Add(new Error { Code = "400", Message = "الجروب المطلوب غير صالح." });
                return response;
            }

            var group = await _repository.FindGroupAsync(groupId, cancellationToken);
            if (group == null || !group.IsActive)
            {
                response.Errors.Add(new Error { Code = "404", Message = "الجروب غير موجود." });
                return response;
            }

            var safeRequest = request ?? new AdminCatalogGroupUpdateRequestDto();
            var groupName = NormalizeNullable(safeRequest.GroupName);
            if (groupName == null)
            {
                response.Errors.Add(new Error { Code = "400", Message = "اسم الجروب مطلوب." });
                return response;
            }

            if (ExceedsMaxLength(groupName, GroupNameMaxLength))
            {
                response.Errors.Add(new Error { Code = "400", Message = $"اسم الجروب يجب ألا يزيد عن {GroupNameMaxLength} حرفًا." });
                return response;
            }

            var groupDescription = NormalizeNullable(safeRequest.GroupDescription);
            if (ExceedsMaxLength(groupDescription, GroupDescriptionMaxLength))
            {
                response.Errors.Add(new Error { Code = "400", Message = $"وصف الجروب يجب ألا يزيد عن {GroupDescriptionMaxLength} حرفًا." });
                return response;
            }

            if (safeRequest.DisplayOrder < GroupDisplayOrderMin || safeRequest.DisplayOrder > GroupDisplayOrderMax)
            {
                response.Errors.Add(new Error { Code = "400", Message = $"ترتيب العرض يجب أن يكون بين {GroupDisplayOrderMin} و {GroupDisplayOrderMax}." });
                return response;
            }

            var parentGroupId = NormalizeParentGroupId(safeRequest.ParentGroupId);
            if (parentGroupId.HasValue && parentGroupId.Value == groupId)
            {
                response.Errors.Add(new Error { Code = "400", Message = "لا يمكن اختيار نفس الجروب كأب له." });
                return response;
            }

            if (parentGroupId.HasValue)
            {
                var parentGroup = await _repository.FindGroupAsync(parentGroupId.Value, cancellationToken);
                if (parentGroup == null || !parentGroup.IsActive)
                {
                    response.Errors.Add(new Error { Code = "404", Message = "الجروب الأب غير موجود." });
                    return response;
                }

                if (parentGroup.CategoryId != group.CategoryId)
                {
                    response.Errors.Add(new Error { Code = "400", Message = "لا يمكن اختيار جروب أب تابع لنود مختلفة." });
                    return response;
                }

                var descendants = await _repository.LoadDescendantGroupIdsAsync(groupId, cancellationToken);
                if (descendants.Contains(parentGroupId.Value))
                {
                    response.Errors.Add(new Error { Code = "400", Message = "لا يمكن نقل الجروب تحت أحد الأبناء." });
                    return response;
                }
            }

            if (await _repository.HasSiblingGroupNameConflictAsync(
                    group.CategoryId,
                    parentGroupId,
                    groupName,
                    excludedGroupId: groupId,
                    cancellationToken))
            {
                response.Errors.Add(new Error { Code = "409", Message = "يوجد جروب آخر بنفس الاسم داخل نفس المستوى." });
                return response;
            }

            group.GroupName = groupName;
            group.GroupDescription = groupDescription;
            group.ParentGroupId = parentGroupId;
            group.DisplayOrder = safeRequest.DisplayOrder;
            group.IsActive = safeRequest.IsActive;
            group.StampDate = DateTime.Now;

            await _repository.SaveChangesAsync(cancellationToken);
            response.Data = MapGroup(group);
        }
        catch (Exception)
        {
            AddUnhandledError(response);
        }

        return response;
    }

    public async Task<CommonResponse<AdminCatalogDeleteResultDto>> DeleteGroupAsync(
        int groupId,
        string userId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<AdminCatalogDeleteResultDto>();
        try
        {
            var normalizedUserId = NormalizeUser(userId);
            if (normalizedUserId.Length == 0)
            {
                response.Errors.Add(new Error { Code = "401", Message = "المستخدم غير مصرح له." });
                return response;
            }

            if (groupId <= 0)
            {
                response.Errors.Add(new Error { Code = "400", Message = "الجروب المطلوب غير صالح." });
                return response;
            }

            var group = await _repository.FindGroupAsync(groupId, cancellationToken);
            if (group == null || !group.IsActive)
            {
                response.Errors.Add(new Error { Code = "404", Message = "الجروب غير موجود." });
                return response;
            }

            var childCount = await _repository.CountChildGroupsAsync(groupId, cancellationToken);
            if (childCount > 0)
            {
                response.Errors.Add(new Error { Code = "400", Message = "لا يمكن حذف جروب يحتوي على جروبات فرعية." });
                return response;
            }

            _repository.RemoveGroup(group);
            await _repository.SaveChangesAsync(cancellationToken);
            response.Data = new AdminCatalogDeleteResultDto
            {
                Deleted = true,
                Mode = "hard",
                Message = "تم حذف الجروب بنجاح."
            };
        }
        catch (Exception)
        {
            AddUnhandledError(response);
        }

        return response;
    }

    private async Task<AdminCatalogApplicationDeleteDiagnosticsDto> BuildApplicationDeleteDiagnosticsAsync(
        string applicationId,
        CancellationToken cancellationToken)
    {
        var linkedCategoriesCount = await _repository.CountCategoriesByApplicationAsync(applicationId, cancellationToken);
        var linkedFieldsCount = await _repository.CountFieldsByApplicationAsync(applicationId, cancellationToken);
        var linkedGroupsCount = await _repository.CountCategoryGroupsByApplicationAsync(applicationId, cancellationToken);

        var canHardDelete = linkedCategoriesCount == 0
            && linkedFieldsCount == 0
            && linkedGroupsCount == 0;

        return new AdminCatalogApplicationDeleteDiagnosticsDto
        {
            ApplicationId = applicationId,
            LinkedCategoriesCount = linkedCategoriesCount,
            LinkedFieldsCount = linkedFieldsCount,
            LinkedGroupsCount = linkedGroupsCount,
            CanHardDelete = canHardDelete,
            WillUseSoftDelete = !canHardDelete,
            IsBlocked = false,
            DecisionReason = canHardDelete
                ? "لا توجد أي ارتباطات، يمكن تنفيذ حذف نهائي (Hard Delete)."
                : "التطبيق مرتبط ببيانات أخرى، وسيتم تنفيذ حذف منطقي (Soft Delete) للحفاظ على سلامة العلاقات."
        };
    }

    private async Task<AdminCatalogCategoryDeleteDiagnosticsDto> BuildCategoryDeleteDiagnosticsAsync(
        int categoryId,
        CancellationToken cancellationToken)
    {
        var childrenCount = await _repository.CountActiveChildCategoriesAsync(categoryId, cancellationToken);
        var linkedFieldsCount = await _repository.CountCategoryFieldLinksAsync(categoryId, cancellationToken);
        var linkedMessagesCount = await _repository.CountCategoryMessageLinksAsync(categoryId, cancellationToken);
        var linkedGroupsCount = await _repository.CountCategoryGroupsAsync(categoryId, cancellationToken);

        var isBlocked = childrenCount > 0;
        var canHardDelete = !isBlocked
            && linkedFieldsCount == 0
            && linkedMessagesCount == 0
            && linkedGroupsCount == 0;

        var willUseSoftDelete = !isBlocked && !canHardDelete;

        var decisionReason = isBlocked
            ? "لا يمكن حذف النود لأنها تحتوي على عناصر أبناء."
            : canHardDelete
                ? "لا توجد ارتباطات ويمكن تنفيذ حذف نهائي (Hard Delete)."
                : "النود مرتبطة ببيانات أخرى، وسيتم تنفيذ حذف منطقي (Soft Delete).";

        return new AdminCatalogCategoryDeleteDiagnosticsDto
        {
            CategoryId = categoryId,
            ChildrenCount = childrenCount,
            LinkedFieldsCount = linkedFieldsCount,
            LinkedMessagesCount = linkedMessagesCount,
            LinkedGroupsCount = linkedGroupsCount,
            CanHardDelete = canHardDelete,
            WillUseSoftDelete = willUseSoftDelete,
            IsBlocked = isBlocked,
            DecisionReason = decisionReason
        };
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

    private static AdminCatalogGroupDto MapGroup(AdminCatalogCategoryGroup group)
    {
        return new AdminCatalogGroupDto
        {
            GroupId = group.GroupId,
            CategoryId = group.CategoryId,
            ApplicationId = group.ApplicationId,
            GroupName = group.GroupName,
            GroupDescription = group.GroupDescription,
            ParentGroupId = group.ParentGroupId,
            DisplayOrder = group.DisplayOrder,
            IsActive = group.IsActive
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

        SortCategoryNodes(rootNodes);
        return rootNodes.Select(MapTreeNode).ToList();
    }

    private static IReadOnlyList<AdminCatalogGroupTreeNodeDto> BuildGroupTree(IReadOnlyList<AdminCatalogCategoryGroup> groups)
    {
        var nodeMap = groups.ToDictionary(
            keySelector: item => item.GroupId,
            elementSelector: item => new GroupTreeBuilderNode
            {
                GroupId = item.GroupId,
                CategoryId = item.CategoryId,
                ApplicationId = item.ApplicationId,
                GroupName = item.GroupName,
                GroupDescription = item.GroupDescription,
                ParentGroupId = item.ParentGroupId,
                DisplayOrder = item.DisplayOrder,
                IsActive = item.IsActive
            });

        var rootNodes = new List<GroupTreeBuilderNode>();
        foreach (var group in groups)
        {
            var node = nodeMap[group.GroupId];
            if (group.ParentGroupId.HasValue && group.ParentGroupId.Value > 0
                && nodeMap.TryGetValue(group.ParentGroupId.Value, out var parentNode))
            {
                parentNode.Children.Add(node);
                continue;
            }

            rootNodes.Add(node);
        }

        SortGroupNodes(rootNodes);
        return rootNodes.Select(MapGroupTreeNode).ToList();
    }

    private static void SortCategoryNodes(List<CategoryTreeBuilderNode> nodes)
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

            SortCategoryNodes(node.Children);
        }
    }

    private static void SortGroupNodes(List<GroupTreeBuilderNode> nodes)
    {
        nodes.Sort((left, right) =>
        {
            var byOrder = left.DisplayOrder.CompareTo(right.DisplayOrder);
            if (byOrder != 0)
            {
                return byOrder;
            }

            var byName = string.Compare(left.GroupName, right.GroupName, StringComparison.OrdinalIgnoreCase);
            if (byName != 0)
            {
                return byName;
            }

            return left.GroupId.CompareTo(right.GroupId);
        });

        foreach (var node in nodes)
        {
            if (node.Children.Count == 0)
            {
                continue;
            }

            SortGroupNodes(node.Children);
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

    private static AdminCatalogGroupTreeNodeDto MapGroupTreeNode(GroupTreeBuilderNode node)
    {
        return new AdminCatalogGroupTreeNodeDto
        {
            GroupId = node.GroupId,
            CategoryId = node.CategoryId,
            ApplicationId = node.ApplicationId,
            GroupName = node.GroupName,
            GroupDescription = node.GroupDescription,
            ParentGroupId = node.ParentGroupId,
            DisplayOrder = node.DisplayOrder,
            IsActive = node.IsActive,
            Children = node.Children.Select(MapGroupTreeNode).ToList()
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

    private static int? NormalizeParentGroupId(int? value)
    {
        if (!value.HasValue || value.Value <= 0)
        {
            return null;
        }

        return value.Value;
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

    private sealed class GroupTreeBuilderNode
    {
        public int GroupId { get; init; }

        public int CategoryId { get; init; }

        public string ApplicationId { get; init; } = string.Empty;

        public string GroupName { get; init; } = string.Empty;

        public string? GroupDescription { get; init; }

        public int? ParentGroupId { get; init; }

        public int DisplayOrder { get; init; }

        public bool IsActive { get; init; }

        public List<GroupTreeBuilderNode> Children { get; } = new();
    }
}
