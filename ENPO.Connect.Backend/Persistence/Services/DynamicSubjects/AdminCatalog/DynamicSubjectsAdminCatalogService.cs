using Models.Correspondance;
using Models.DTO.Common;
using Models.DTO.DynamicSubjects;
using System.Globalization;
using System.Text.Json;
using System.Text.Json.Nodes;

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
    private const int FieldKeyMaxLength = 50;
    private const int FieldTypeMaxLength = 50;
    private const int FieldLabelMaxLength = 50;
    private const int FieldDataTypeMaxLength = 50;
    private const int FieldMaskMaxLength = 30;
    private const int FieldMinMaxValueMaxLength = 30;
    private const int FieldPlaceholderMaxLength = 150;
    private const int FieldDefaultValueMaxLength = 100;
    private const string DefaultViewModeValue = "standard";
    private const string TabbedViewModeValue = "tabbed";

    private static readonly IReadOnlyList<string> DefaultFieldTypes = new List<string>
    {
        "InputText",
        "Textarea",
        "Dropdown",
        "DropdownTree",
        "RadioButton",
        "Date",
        "DateTime",
        "ToggleSwitch",
        "FileUpload",
        "DomainUser",
        "JsonData"
    };

    private static readonly IReadOnlyList<string> DefaultFieldDataTypes = new List<string>
    {
        "string",
        "number",
        "date",
        "boolean",
        "json",
        "nvarchar"
    };

    private readonly IDynamicSubjectsAdminCatalogRepository _repository;
    private readonly IAdminControlCenterRequestPreviewCache _requestPreviewCache;

    public DynamicSubjectsAdminCatalogService(
        IDynamicSubjectsAdminCatalogRepository repository,
        IAdminControlCenterRequestPreviewCache requestPreviewCache)
    {
        _repository = repository;
        _requestPreviewCache = requestPreviewCache;
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
            await SaveChangesAndInvalidatePreviewCacheAsync(cancellationToken);

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

            await SaveChangesAndInvalidatePreviewCacheAsync(cancellationToken);
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
                await SaveChangesAndInvalidatePreviewCacheAsync(cancellationToken);
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
            await SaveChangesAndInvalidatePreviewCacheAsync(cancellationToken);

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
            var categoryIds = categories
                .Select(item => item.CatId)
                .Where(item => item > 0)
                .Distinct()
                .ToList();
            var settingsMap = await _repository.ListCategoryAdminSettingsAsync(categoryIds, cancellationToken);
            response.Data = BuildCategoryTree(categories, settingsMap);
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
            var hasDisplaySettingsRequest = NormalizeNullable(safeRequest.DefaultViewMode) != null
                || safeRequest.AllowRequesterOverride.HasValue;
            var targetDisplaySettings = BuildDisplaySettingsState(
                safeRequest.DefaultViewMode,
                safeRequest.AllowRequesterOverride);
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
            SubjectTypeAdminSetting? categorySetting = null;
            if (hasDisplaySettingsRequest)
            {
                categorySetting = new SubjectTypeAdminSetting
                {
                    CategoryId = nextCategoryId,
                    DisplayOrder = 0,
                    DefaultViewMode = targetDisplaySettings.DefaultViewMode,
                    AllowRequesterOverride = targetDisplaySettings.AllowRequesterOverride,
                    SettingsJson = MergeDisplaySettingsIntoSettingsJson(null, targetDisplaySettings),
                    LastModifiedBy = normalizedUserId,
                    LastModifiedAtUtc = DateTime.UtcNow
                };
            }

            await _repository.AddCategoryAsync(category, cancellationToken);
            if (categorySetting != null)
            {
                await _repository.AddCategoryAdminSettingAsync(categorySetting, cancellationToken);
            }
            await SaveChangesAndInvalidatePreviewCacheAsync(cancellationToken);

            response.Data = MapCategory(category, categorySetting);
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
            var categorySetting = await _repository.FindCategoryAdminSettingAsync(categoryId, cancellationToken);

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

            var hasDefaultViewModeUpdate = NormalizeNullable(safeRequest.DefaultViewMode) != null;
            var hasAllowRequesterOverrideUpdate = safeRequest.AllowRequesterOverride.HasValue;
            if (hasDefaultViewModeUpdate || hasAllowRequesterOverrideUpdate)
            {
                var currentSettings = ResolveDisplaySettingsState(categorySetting);
                var targetSettings = BuildDisplaySettingsState(
                    hasDefaultViewModeUpdate ? safeRequest.DefaultViewMode : currentSettings.DefaultViewMode,
                    hasAllowRequesterOverrideUpdate ? safeRequest.AllowRequesterOverride : currentSettings.AllowRequesterOverride);

                if (categorySetting == null)
                {
                    categorySetting = new SubjectTypeAdminSetting
                    {
                        CategoryId = categoryId,
                        DisplayOrder = 0,
                        LastModifiedBy = normalizedUserId,
                        LastModifiedAtUtc = DateTime.UtcNow
                    };
                    await _repository.AddCategoryAdminSettingAsync(categorySetting, cancellationToken);
                }

                categorySetting.DefaultViewMode = targetSettings.DefaultViewMode;
                categorySetting.AllowRequesterOverride = targetSettings.AllowRequesterOverride;
                categorySetting.SettingsJson = MergeDisplaySettingsIntoSettingsJson(categorySetting.SettingsJson, targetSettings);
                categorySetting.LastModifiedBy = normalizedUserId;
                categorySetting.LastModifiedAtUtc = DateTime.UtcNow;
            }

            await SaveChangesAndInvalidatePreviewCacheAsync(cancellationToken);
            response.Data = MapCategory(category, categorySetting);
        }
        catch (Exception)
        {
            AddUnhandledError(response);
        }

        return response;
    }

    public async Task<CommonResponse<AdminCatalogCategoryDisplaySettingsDto>> GetCategoryDisplaySettingsAsync(
        int categoryId,
        string userId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<AdminCatalogCategoryDisplaySettingsDto>();
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

            var categorySetting = await _repository.FindCategoryAdminSettingAsync(categoryId, cancellationToken);
            var state = ResolveDisplaySettingsState(categorySetting);
            response.Data = new AdminCatalogCategoryDisplaySettingsDto
            {
                CategoryId = categoryId,
                DefaultViewMode = state.DefaultViewMode,
                AllowRequesterOverride = state.AllowRequesterOverride,
                LastModifiedBy = categorySetting?.LastModifiedBy,
                LastModifiedAtUtc = categorySetting?.LastModifiedAtUtc
            };
        }
        catch (Exception)
        {
            AddUnhandledError(response);
        }

        return response;
    }

    public async Task<CommonResponse<AdminCatalogCategoryDisplaySettingsDto>> UpsertCategoryDisplaySettingsAsync(
        int categoryId,
        AdminCatalogCategoryDisplaySettingsUpsertRequestDto request,
        string userId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<AdminCatalogCategoryDisplaySettingsDto>();
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

            var safeRequest = request ?? new AdminCatalogCategoryDisplaySettingsUpsertRequestDto();
            var categorySetting = await _repository.FindCategoryAdminSettingAsync(categoryId, cancellationToken);
            var currentSettings = ResolveDisplaySettingsState(categorySetting);
            var targetSettings = BuildDisplaySettingsState(
                safeRequest.DefaultViewMode ?? currentSettings.DefaultViewMode,
                safeRequest.AllowRequesterOverride ?? currentSettings.AllowRequesterOverride);

            if (categorySetting == null)
            {
                categorySetting = new SubjectTypeAdminSetting
                {
                    CategoryId = categoryId,
                    DisplayOrder = 0,
                    DefaultViewMode = targetSettings.DefaultViewMode,
                    AllowRequesterOverride = targetSettings.AllowRequesterOverride,
                    SettingsJson = MergeDisplaySettingsIntoSettingsJson(null, targetSettings),
                    LastModifiedBy = normalizedUserId,
                    LastModifiedAtUtc = DateTime.UtcNow
                };
                await _repository.AddCategoryAdminSettingAsync(categorySetting, cancellationToken);
            }
            else
            {
                categorySetting.DefaultViewMode = targetSettings.DefaultViewMode;
                categorySetting.AllowRequesterOverride = targetSettings.AllowRequesterOverride;
                categorySetting.SettingsJson = MergeDisplaySettingsIntoSettingsJson(categorySetting.SettingsJson, targetSettings);
                categorySetting.LastModifiedBy = normalizedUserId;
                categorySetting.LastModifiedAtUtc = DateTime.UtcNow;
            }

            await SaveChangesAndInvalidatePreviewCacheAsync(cancellationToken);

            response.Data = new AdminCatalogCategoryDisplaySettingsDto
            {
                CategoryId = categoryId,
                DefaultViewMode = targetSettings.DefaultViewMode,
                AllowRequesterOverride = targetSettings.AllowRequesterOverride,
                LastModifiedBy = categorySetting.LastModifiedBy,
                LastModifiedAtUtc = categorySetting.LastModifiedAtUtc
            };
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
                await SaveChangesAndInvalidatePreviewCacheAsync(cancellationToken);
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
            await SaveChangesAndInvalidatePreviewCacheAsync(cancellationToken);

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
            await SaveChangesAndInvalidatePreviewCacheAsync(cancellationToken);
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

            await SaveChangesAndInvalidatePreviewCacheAsync(cancellationToken);
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
            await SaveChangesAndInvalidatePreviewCacheAsync(cancellationToken);
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

    public async Task<CommonResponse<AdminCatalogFieldLookupsDto>> GetFieldLookupsAsync(
        string userId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<AdminCatalogFieldLookupsDto>();
        try
        {
            var normalizedUserId = NormalizeUser(userId);
            if (normalizedUserId.Length == 0)
            {
                response.Errors.Add(new Error { Code = "401", Message = "المستخدم غير مصرح له." });
                return response;
            }

            var fieldTypesFromDb = await _repository.ListDistinctFieldTypesAsync(cancellationToken);
            var dataTypesFromDb = await _repository.ListDistinctFieldDataTypesAsync(cancellationToken);

            response.Data = new AdminCatalogFieldLookupsDto
            {
                FieldTypes = MergeLookupValues(DefaultFieldTypes, fieldTypesFromDb),
                DataTypes = MergeLookupValues(DefaultFieldDataTypes, dataTypesFromDb),
                StatusOptions = new List<AdminCatalogFieldStatusOptionDto>
                {
                    new() { Key = "all", Label = "الكل" },
                    new() { Key = "active", Label = "مفعل" },
                    new() { Key = "inactive", Label = "غير مفعل" }
                }
            };
        }
        catch (Exception)
        {
            AddUnhandledError(response);
        }

        return response;
    }

    public async Task<CommonResponse<IEnumerable<AdminCatalogFieldListItemDto>>> GetFieldsAsync(
        string userId,
        string? appId,
        string? search,
        string? status,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<IEnumerable<AdminCatalogFieldListItemDto>>();
        try
        {
            var normalizedUserId = NormalizeUser(userId);
            if (normalizedUserId.Length == 0)
            {
                response.Errors.Add(new Error { Code = "401", Message = "المستخدم غير مصرح له." });
                return response;
            }

            var normalizedAppId = NormalizeNullable(appId);
            if (normalizedAppId != null && ExceedsMaxLength(normalizedAppId, ApplicationIdMaxLength))
            {
                response.Errors.Add(new Error { Code = "400", Message = $"معرف التطبيق يجب ألا يزيد عن {ApplicationIdMaxLength} أحرف." });
                return response;
            }

            var normalizedStatus = NormalizeNullable(status);
            var statusFilter = ParseFieldStatus(normalizedStatus);
            if (normalizedStatus != null && statusFilter == null && !IsAllStatus(normalizedStatus))
            {
                response.Errors.Add(new Error { Code = "400", Message = "قيمة حالة الحقول غير صالحة." });
                return response;
            }

            var fields = await _repository.ListFieldsAsync(
                normalizedAppId,
                NormalizeNullable(search),
                statusFilter,
                cancellationToken);

            var fieldKeys = fields
                .Select(item => item.CdmendTxt)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            var fieldSqls = fields
                .Select(item => item.CdmendSql)
                .Distinct()
                .ToList();

            var linkedCategoriesByField = await _repository.CountFieldCategoryLinksByKeysAsync(fieldKeys, activeOnly: true, cancellationToken);
            var linkedSettingsBySql = await _repository.CountFieldSettingsLinksBySqlsAsync(fieldSqls, cancellationToken);
            var linkedHistoryByField = await _repository.CountFieldHistoryLinksByKeysAsync(fieldKeys, cancellationToken);
            var linkedHistoryBySql = await _repository.CountFieldHistoryLinksBySqlsAsync(fieldSqls, cancellationToken);

            response.Data = fields
                .Select(field =>
                {
                    var linkedCategoriesCount = ReadDictionaryValue(linkedCategoriesByField, field.CdmendTxt);
                    var linkedSettingsCount = ReadDictionaryValue(linkedSettingsBySql, field.CdmendSql);
                    var linkedHistoryByKeyCount = ReadDictionaryValue(linkedHistoryByField, field.CdmendTxt);
                    var linkedHistoryBySqlCount = ReadDictionaryValue(linkedHistoryBySql, field.CdmendSql);
                    var linkedHistoryCount = Math.Max(linkedHistoryByKeyCount, linkedHistoryBySqlCount);

                    return MapFieldListItem(field, linkedCategoriesCount, linkedSettingsCount, linkedHistoryCount);
                })
                .ToList();
        }
        catch (Exception)
        {
            AddUnhandledError(response);
        }

        return response;
    }

    public async Task<CommonResponse<AdminCatalogFieldDto>> GetFieldAsync(
        string applicationId,
        string fieldKey,
        string userId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<AdminCatalogFieldDto>();
        try
        {
            var normalizedUserId = NormalizeUser(userId);
            if (normalizedUserId.Length == 0)
            {
                response.Errors.Add(new Error { Code = "401", Message = "المستخدم غير مصرح له." });
                return response;
            }

            var normalizedAppId = NormalizeNullable(applicationId);
            var normalizedFieldKey = NormalizeNullable(fieldKey);
            if (normalizedAppId == null || normalizedFieldKey == null)
            {
                response.Errors.Add(new Error { Code = "400", Message = "معرف التطبيق ومفتاح الحقل مطلوبان." });
                return response;
            }

            var field = await _repository.FindFieldAsync(normalizedAppId, normalizedFieldKey, cancellationToken);
            if (field == null)
            {
                response.Errors.Add(new Error { Code = "404", Message = "الحقل غير موجود." });
                return response;
            }

            var diagnostics = await BuildFieldDeleteDiagnosticsAsync(field, cancellationToken);
            response.Data = MapFieldDetails(field, diagnostics);
        }
        catch (Exception)
        {
            AddUnhandledError(response);
        }

        return response;
    }

    public async Task<CommonResponse<AdminCatalogFieldDto>> CreateFieldAsync(
        AdminCatalogFieldCreateRequestDto request,
        string userId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<AdminCatalogFieldDto>();
        try
        {
            var normalizedUserId = NormalizeUser(userId);
            if (normalizedUserId.Length == 0)
            {
                response.Errors.Add(new Error { Code = "401", Message = "المستخدم غير مصرح له." });
                return response;
            }

            var safeRequest = request ?? new AdminCatalogFieldCreateRequestDto();
            var validation = await ValidateFieldCreateRequestAsync(safeRequest, response, cancellationToken);
            if (!validation.IsValid)
            {
                return response;
            }

            var cdmendSql = safeRequest.CdmendSql.GetValueOrDefault();
            if (cdmendSql <= 0)
            {
                cdmendSql = await _repository.GenerateNextFieldSqlAsync(cancellationToken);
                while (await _repository.FieldSqlExistsAsync(cdmendSql, cancellationToken))
                {
                    cdmendSql++;
                }
            }
            else if (await _repository.FieldSqlExistsAsync(cdmendSql, cancellationToken))
            {
                response.Errors.Add(new Error { Code = "409", Message = "رقم الحقل (CDMendSQL) مستخدم بالفعل." });
                return response;
            }

            var field = new Cdmend
            {
                ApplicationId = validation.ApplicationId!,
                CdmendTxt = validation.FieldKey!,
                CdmendSql = cdmendSql,
                CdmendType = validation.FieldType!,
                CDMendLbl = validation.FieldLabel!,
                Placeholder = validation.Placeholder,
                DefaultValue = validation.DefaultValue,
                CdmendTbl = validation.CdmendTbl,
                CdmendDatatype = validation.DataType,
                Required = safeRequest.Required,
                RequiredTrue = safeRequest.RequiredTrue,
                Email = safeRequest.Email,
                Pattern = safeRequest.Pattern,
                MinValue = validation.MinValue,
                MaxValue = validation.MaxValue,
                Cdmendmask = validation.Mask,
                CdmendStat = !safeRequest.IsActive,
                Width = safeRequest.Width,
                Height = safeRequest.Height,
                IsDisabledInit = safeRequest.IsDisabledInit,
                IsSearchable = safeRequest.IsSearchable
            };

            await _repository.AddFieldAsync(field, cancellationToken);
            await SaveChangesAndInvalidatePreviewCacheAsync(cancellationToken);

            response.Data = MapFieldDetails(
                field,
                new AdminCatalogFieldDeleteDiagnosticsDto
                {
                    LinkedCategoriesCount = 0,
                    LinkedSettingsCount = 0,
                    LinkedHistoryByKeyCount = 0,
                    LinkedHistoryBySqlCount = 0
                });
        }
        catch (Exception)
        {
            AddUnhandledError(response);
        }

        return response;
    }

    public async Task<CommonResponse<AdminCatalogFieldDto>> UpdateFieldAsync(
        string applicationId,
        string fieldKey,
        AdminCatalogFieldUpdateRequestDto request,
        string userId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<AdminCatalogFieldDto>();
        try
        {
            var normalizedUserId = NormalizeUser(userId);
            if (normalizedUserId.Length == 0)
            {
                response.Errors.Add(new Error { Code = "401", Message = "المستخدم غير مصرح له." });
                return response;
            }

            var normalizedAppId = NormalizeNullable(applicationId);
            var normalizedFieldKey = NormalizeNullable(fieldKey);
            if (normalizedAppId == null || normalizedFieldKey == null)
            {
                response.Errors.Add(new Error { Code = "400", Message = "معرف التطبيق ومفتاح الحقل مطلوبان." });
                return response;
            }

            var field = await _repository.FindFieldAsync(normalizedAppId, normalizedFieldKey, cancellationToken);
            if (field == null)
            {
                response.Errors.Add(new Error { Code = "404", Message = "الحقل غير موجود." });
                return response;
            }

            var safeRequest = request ?? new AdminCatalogFieldUpdateRequestDto();
            var validation = ValidateFieldUpdateRequest(safeRequest, normalizedAppId, normalizedFieldKey, response);
            if (!validation.IsValid)
            {
                return response;
            }

            if (safeRequest.CdmendSql.HasValue && safeRequest.CdmendSql.Value > 0 && safeRequest.CdmendSql.Value != field.CdmendSql)
            {
                response.Errors.Add(new Error
                {
                    Code = "400",
                    Message = "لا يمكن تعديل CDMendSQL في مرحلة مكتبة الحقول للحفاظ على سلامة الروابط الحالية."
                });
                return response;
            }

            field.CdmendType = validation.FieldType!;
            field.CDMendLbl = validation.FieldLabel!;
            field.Placeholder = validation.Placeholder;
            field.DefaultValue = validation.DefaultValue;
            field.CdmendTbl = validation.CdmendTbl;
            field.CdmendDatatype = validation.DataType;
            field.Required = safeRequest.Required;
            field.RequiredTrue = safeRequest.RequiredTrue;
            field.Email = safeRequest.Email;
            field.Pattern = safeRequest.Pattern;
            field.MinValue = validation.MinValue;
            field.MaxValue = validation.MaxValue;
            field.Cdmendmask = validation.Mask;
            field.CdmendStat = !safeRequest.IsActive;
            field.Width = safeRequest.Width;
            field.Height = safeRequest.Height;
            field.IsDisabledInit = safeRequest.IsDisabledInit;
            field.IsSearchable = safeRequest.IsSearchable;

            await SaveChangesAndInvalidatePreviewCacheAsync(cancellationToken);

            var diagnostics = await BuildFieldDeleteDiagnosticsAsync(field, cancellationToken);
            response.Data = MapFieldDetails(field, diagnostics);
        }
        catch (Exception)
        {
            AddUnhandledError(response);
        }

        return response;
    }

    public async Task<CommonResponse<AdminCatalogFieldDeleteDiagnosticsDto>> DiagnoseFieldDeleteAsync(
        string applicationId,
        string fieldKey,
        string userId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<AdminCatalogFieldDeleteDiagnosticsDto>();
        try
        {
            var normalizedUserId = NormalizeUser(userId);
            if (normalizedUserId.Length == 0)
            {
                response.Errors.Add(new Error { Code = "401", Message = "المستخدم غير مصرح له." });
                return response;
            }

            var normalizedAppId = NormalizeNullable(applicationId);
            var normalizedFieldKey = NormalizeNullable(fieldKey);
            if (normalizedAppId == null || normalizedFieldKey == null)
            {
                response.Errors.Add(new Error { Code = "400", Message = "معرف التطبيق ومفتاح الحقل مطلوبان." });
                return response;
            }

            var field = await _repository.FindFieldAsync(normalizedAppId, normalizedFieldKey, cancellationToken);
            if (field == null)
            {
                response.Errors.Add(new Error { Code = "404", Message = "الحقل غير موجود." });
                return response;
            }

            response.Data = await BuildFieldDeleteDiagnosticsAsync(field, cancellationToken);
        }
        catch (Exception)
        {
            AddUnhandledError(response);
        }

        return response;
    }

    public async Task<CommonResponse<AdminCatalogDeleteResultDto>> DeleteFieldAsync(
        string applicationId,
        string fieldKey,
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

            var normalizedAppId = NormalizeNullable(applicationId);
            var normalizedFieldKey = NormalizeNullable(fieldKey);
            if (normalizedAppId == null || normalizedFieldKey == null)
            {
                response.Errors.Add(new Error { Code = "400", Message = "معرف التطبيق ومفتاح الحقل مطلوبان." });
                return response;
            }

            var field = await _repository.FindFieldAsync(normalizedAppId, normalizedFieldKey, cancellationToken);
            if (field == null)
            {
                response.Errors.Add(new Error { Code = "404", Message = "الحقل غير موجود." });
                return response;
            }

            var diagnostics = await BuildFieldDeleteDiagnosticsAsync(field, cancellationToken);
            if (diagnostics.CanHardDelete)
            {
                _repository.RemoveField(field);
                await SaveChangesAndInvalidatePreviewCacheAsync(cancellationToken);
                response.Data = new AdminCatalogDeleteResultDto
                {
                    Deleted = true,
                    Mode = "hard",
                    Message = "تم حذف الحقل حذفًا نهائيًا لعدم وجود أي استخدامات مرتبطة به."
                };

                return response;
            }

            if (field.CdmendStat)
            {
                response.Data = new AdminCatalogDeleteResultDto
                {
                    Deleted = false,
                    Mode = "soft",
                    Message = "الحقل غير مفعل بالفعل (حذف منطقي سابق)."
                };

                return response;
            }

            field.CdmendStat = true;
            await SaveChangesAndInvalidatePreviewCacheAsync(cancellationToken);
            response.Data = new AdminCatalogDeleteResultDto
            {
                Deleted = true,
                Mode = "soft",
                Message = "تم تنفيذ حذف منطقي (Soft Delete) للحفاظ على سلامة الروابط القائمة."
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

    private async Task<AdminCatalogFieldDeleteDiagnosticsDto> BuildFieldDeleteDiagnosticsAsync(
        Cdmend field,
        CancellationToken cancellationToken)
    {
        var linkedCategoriesCount = await _repository.CountFieldCategoryLinksAsync(
            field.CdmendTxt,
            activeOnly: false,
            cancellationToken);

        var linkedActiveCategoriesCount = await _repository.CountFieldCategoryLinksAsync(
            field.CdmendTxt,
            activeOnly: true,
            cancellationToken);

        var linkedSettingsCount = await _repository.CountFieldSettingsLinksAsync(field.CdmendSql, cancellationToken);
        var linkedHistoryByKeyCount = await _repository.CountFieldHistoryLinksByKeyAsync(field.CdmendTxt, cancellationToken);
        var linkedHistoryBySqlCount = await _repository.CountFieldHistoryLinksBySqlAsync(field.CdmendSql, cancellationToken);

        var canHardDelete = linkedCategoriesCount == 0
            && linkedSettingsCount == 0
            && linkedHistoryByKeyCount == 0
            && linkedHistoryBySqlCount == 0;

        return new AdminCatalogFieldDeleteDiagnosticsDto
        {
            ApplicationId = field.ApplicationId ?? string.Empty,
            FieldKey = field.CdmendTxt,
            CdmendSql = field.CdmendSql,
            LinkedCategoriesCount = linkedCategoriesCount,
            LinkedActiveCategoriesCount = linkedActiveCategoriesCount,
            LinkedSettingsCount = linkedSettingsCount,
            LinkedHistoryByKeyCount = linkedHistoryByKeyCount,
            LinkedHistoryBySqlCount = linkedHistoryBySqlCount,
            CanHardDelete = canHardDelete,
            WillUseSoftDelete = !canHardDelete,
            IsBlocked = false,
            DecisionReason = canHardDelete
                ? "لا توجد أي استخدامات مرتبطة بالحقل ويمكن تنفيذ حذف نهائي (Hard Delete)."
                : "الحقل مستخدم أو له أثر بيانات، وسيتم تنفيذ حذف منطقي (Soft Delete) للحفاظ على سلامة النظام."
        };
    }

    private async Task<FieldValidationContext> ValidateFieldCreateRequestAsync(
        AdminCatalogFieldCreateRequestDto request,
        CommonResponse<AdminCatalogFieldDto> response,
        CancellationToken cancellationToken)
    {
        var validation = ValidateFieldPayload(
            request.ApplicationId,
            request.FieldKey,
            request.FieldType,
            request.FieldLabel,
            request.Placeholder,
            request.DefaultValue,
            request.CdmendTbl,
            request.DataType,
            request.MinValue,
            request.MaxValue,
            request.Mask,
            request.Width,
            request.Height,
            response);

        if (!validation.IsValid)
        {
            return validation;
        }

        if (!await _repository.ApplicationIdExistsAsync(validation.ApplicationId!, cancellationToken))
        {
            response.Errors.Add(new Error { Code = "404", Message = "التطبيق المحدد غير موجود." });
            return FieldValidationContext.Invalid;
        }

        if (await _repository.FieldExistsAsync(validation.ApplicationId!, validation.FieldKey!, cancellationToken))
        {
            response.Errors.Add(new Error { Code = "409", Message = "مفتاح الحقل موجود بالفعل داخل نفس التطبيق." });
            return FieldValidationContext.Invalid;
        }

        return validation;
    }

    private FieldValidationContext ValidateFieldUpdateRequest(
        AdminCatalogFieldUpdateRequestDto request,
        string applicationId,
        string currentFieldKey,
        CommonResponse<AdminCatalogFieldDto> response)
    {
        return ValidateFieldPayload(
            applicationId: applicationId,
            fieldKey: currentFieldKey,
            fieldType: request.FieldType,
            fieldLabel: request.FieldLabel,
            placeholder: request.Placeholder,
            defaultValue: request.DefaultValue,
            cdmendTbl: request.CdmendTbl,
            dataType: request.DataType,
            minValue: request.MinValue,
            maxValue: request.MaxValue,
            mask: request.Mask,
            width: request.Width,
            height: request.Height,
            response);
    }

    private FieldValidationContext ValidateFieldPayload(
        string? applicationId,
        string? fieldKey,
        string? fieldType,
        string? fieldLabel,
        string? placeholder,
        string? defaultValue,
        string? cdmendTbl,
        string? dataType,
        string? minValue,
        string? maxValue,
        string? mask,
        int width,
        int height,
        CommonResponse<AdminCatalogFieldDto> response)
    {
        var normalizedApplicationId = NormalizeNullable(applicationId);
        if (normalizedApplicationId == null)
        {
            response.Errors.Add(new Error { Code = "400", Message = "معرف التطبيق مطلوب." });
            return FieldValidationContext.Invalid;
        }

        if (ExceedsMaxLength(normalizedApplicationId, ApplicationIdMaxLength))
        {
            response.Errors.Add(new Error { Code = "400", Message = $"معرف التطبيق يجب ألا يزيد عن {ApplicationIdMaxLength} أحرف." });
            return FieldValidationContext.Invalid;
        }

        var normalizedFieldKey = NormalizeNullable(fieldKey);
        if (normalizedFieldKey == null)
        {
            response.Errors.Add(new Error { Code = "400", Message = "مفتاح الحقل (CDMendTxt) مطلوب." });
            return FieldValidationContext.Invalid;
        }

        if (ExceedsMaxLength(normalizedFieldKey, FieldKeyMaxLength))
        {
            response.Errors.Add(new Error { Code = "400", Message = $"مفتاح الحقل يجب ألا يزيد عن {FieldKeyMaxLength} حرفًا." });
            return FieldValidationContext.Invalid;
        }

        var normalizedFieldType = NormalizeNullable(fieldType);
        if (normalizedFieldType == null)
        {
            response.Errors.Add(new Error { Code = "400", Message = "نوع الحقل (CDMendType) مطلوب." });
            return FieldValidationContext.Invalid;
        }

        if (ExceedsMaxLength(normalizedFieldType, FieldTypeMaxLength))
        {
            response.Errors.Add(new Error { Code = "400", Message = $"نوع الحقل يجب ألا يزيد عن {FieldTypeMaxLength} حرفًا." });
            return FieldValidationContext.Invalid;
        }

        var normalizedFieldLabel = NormalizeNullable(fieldLabel) ?? normalizedFieldKey;
        if (ExceedsMaxLength(normalizedFieldLabel, FieldLabelMaxLength))
        {
            response.Errors.Add(new Error { Code = "400", Message = $"عنوان الحقل يجب ألا يزيد عن {FieldLabelMaxLength} حرفًا." });
            return FieldValidationContext.Invalid;
        }

        var normalizedPlaceholder = NormalizeNullable(placeholder);
        if (ExceedsMaxLength(normalizedPlaceholder, FieldPlaceholderMaxLength))
        {
            response.Errors.Add(new Error { Code = "400", Message = $"Placeholder يجب ألا يزيد عن {FieldPlaceholderMaxLength} حرفًا." });
            return FieldValidationContext.Invalid;
        }

        var normalizedDefaultValue = NormalizeNullable(defaultValue);
        if (ExceedsMaxLength(normalizedDefaultValue, FieldDefaultValueMaxLength))
        {
            response.Errors.Add(new Error { Code = "400", Message = $"DefaultValue يجب ألا يزيد عن {FieldDefaultValueMaxLength} حرفًا." });
            return FieldValidationContext.Invalid;
        }

        var normalizedDataType = NormalizeNullable(dataType);
        if (ExceedsMaxLength(normalizedDataType, FieldDataTypeMaxLength))
        {
            response.Errors.Add(new Error { Code = "400", Message = $"نوع البيانات يجب ألا يزيد عن {FieldDataTypeMaxLength} حرفًا." });
            return FieldValidationContext.Invalid;
        }

        var normalizedMinValue = NormalizeNullable(minValue);
        var normalizedMaxValue = NormalizeNullable(maxValue);
        if (ExceedsMaxLength(normalizedMinValue, FieldMinMaxValueMaxLength)
            || ExceedsMaxLength(normalizedMaxValue, FieldMinMaxValueMaxLength))
        {
            response.Errors.Add(new Error { Code = "400", Message = $"قيم Min/Max يجب ألا تزيد عن {FieldMinMaxValueMaxLength} حرفًا." });
            return FieldValidationContext.Invalid;
        }

        if (normalizedMinValue != null
            && normalizedMaxValue != null
            && decimal.TryParse(normalizedMinValue, NumberStyles.Any, CultureInfo.InvariantCulture, out var parsedMin)
            && decimal.TryParse(normalizedMaxValue, NumberStyles.Any, CultureInfo.InvariantCulture, out var parsedMax)
            && parsedMin > parsedMax)
        {
            response.Errors.Add(new Error { Code = "400", Message = "قيمة MinValue يجب أن تكون أقل من أو تساوي MaxValue." });
            return FieldValidationContext.Invalid;
        }

        var normalizedMask = NormalizeNullable(mask);
        if (ExceedsMaxLength(normalizedMask, FieldMaskMaxLength))
        {
            response.Errors.Add(new Error { Code = "400", Message = $"قناع الحقل يجب ألا يزيد عن {FieldMaskMaxLength} حرفًا." });
            return FieldValidationContext.Invalid;
        }

        var normalizedCdmendTbl = NormalizeNullable(cdmendTbl);
        if (IsOptionFieldType(normalizedFieldType) && normalizedCdmendTbl == null)
        {
            response.Errors.Add(new Error { Code = "400", Message = "مصدر الخيارات (CDMendTbl) مطلوب لأن نوع الحقل قائم على قائمة." });
            return FieldValidationContext.Invalid;
        }

        if (IsOptionFieldType(normalizedFieldType) && normalizedCdmendTbl != null)
        {
            var optionsPayloadValidationError = ValidateOptionPayload(normalizedCdmendTbl);
            if (optionsPayloadValidationError != null)
            {
                response.Errors.Add(new Error { Code = "400", Message = optionsPayloadValidationError });
                return FieldValidationContext.Invalid;
            }
        }

        if (width < 0 || height < 0)
        {
            response.Errors.Add(new Error { Code = "400", Message = "القيم Width و Height يجب أن تكون صفرًا أو أعلى." });
            return FieldValidationContext.Invalid;
        }

        return new FieldValidationContext
        {
            IsValid = true,
            ApplicationId = normalizedApplicationId,
            FieldKey = normalizedFieldKey,
            FieldType = normalizedFieldType,
            FieldLabel = normalizedFieldLabel,
            Placeholder = normalizedPlaceholder,
            DefaultValue = normalizedDefaultValue,
            CdmendTbl = normalizedCdmendTbl,
            DataType = normalizedDataType,
            MinValue = normalizedMinValue,
            MaxValue = normalizedMaxValue,
            Mask = normalizedMask
        };
    }

    private static AdminCatalogFieldListItemDto MapFieldListItem(
        Cdmend field,
        int linkedCategoriesCount,
        int linkedSettingsCount,
        int linkedHistoryCount)
    {
        var isUsed = linkedCategoriesCount > 0 || linkedSettingsCount > 0 || linkedHistoryCount > 0;

        return new AdminCatalogFieldListItemDto
        {
            ApplicationId = field.ApplicationId ?? string.Empty,
            FieldKey = field.CdmendTxt,
            CdmendSql = field.CdmendSql,
            FieldLabel = field.CDMendLbl,
            FieldType = field.CdmendType,
            DataType = field.CdmendDatatype,
            Required = field.Required ?? false,
            IsActive = !field.CdmendStat,
            LinkedCategoriesCount = linkedCategoriesCount,
            LinkedSettingsCount = linkedSettingsCount,
            LinkedHistoryCount = linkedHistoryCount,
            IsUsed = isUsed
        };
    }

    private static AdminCatalogFieldDto MapFieldDetails(
        Cdmend field,
        AdminCatalogFieldDeleteDiagnosticsDto diagnostics)
    {
        var linkedHistoryCount = Math.Max(diagnostics.LinkedHistoryByKeyCount, diagnostics.LinkedHistoryBySqlCount);
        var isUsed = diagnostics.LinkedCategoriesCount > 0
            || diagnostics.LinkedSettingsCount > 0
            || linkedHistoryCount > 0;

        return new AdminCatalogFieldDto
        {
            ApplicationId = field.ApplicationId ?? string.Empty,
            FieldKey = field.CdmendTxt,
            CdmendSql = field.CdmendSql,
            FieldType = field.CdmendType,
            FieldLabel = field.CDMendLbl,
            Placeholder = field.Placeholder,
            DefaultValue = field.DefaultValue,
            CdmendTbl = field.CdmendTbl,
            DataType = field.CdmendDatatype,
            Required = field.Required ?? false,
            RequiredTrue = field.RequiredTrue ?? false,
            Email = field.Email ?? false,
            Pattern = field.Pattern ?? false,
            MinValue = field.MinValue,
            MaxValue = field.MaxValue,
            Mask = field.Cdmendmask,
            IsActive = !field.CdmendStat,
            Width = field.Width,
            Height = field.Height,
            IsDisabledInit = field.IsDisabledInit,
            IsSearchable = field.IsSearchable,
            LinkedCategoriesCount = diagnostics.LinkedCategoriesCount,
            LinkedSettingsCount = diagnostics.LinkedSettingsCount,
            LinkedHistoryCount = linkedHistoryCount,
            IsUsed = isUsed
        };
    }

    private static IReadOnlyList<string> MergeLookupValues(
        IReadOnlyList<string> baseline,
        IReadOnlyList<string> additional)
    {
        var result = new List<string>();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var value in baseline.Concat(additional))
        {
            var normalized = NormalizeNullable(value);
            if (normalized == null || !seen.Add(normalized))
            {
                continue;
            }

            result.Add(normalized);
        }

        return result;
    }

    private static bool? ParseFieldStatus(string? status)
    {
        var normalized = NormalizeNullable(status);
        if (normalized == null || normalized.Equals("all", StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        if (normalized.Equals("active", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        if (normalized.Equals("inactive", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        return null;
    }

    private static bool IsAllStatus(string status)
    {
        return string.Equals(status.Trim(), "all", StringComparison.OrdinalIgnoreCase);
    }

    private static bool IsOptionFieldType(string fieldType)
    {
        var normalized = fieldType.ToLowerInvariant();
        return normalized.Contains("drop")
            || normalized.Contains("radio")
            || normalized.Contains("select")
            || normalized.Contains("combo");
    }

    private static string? ValidateOptionPayload(string payload)
    {
        var normalizedPayload = NormalizeNullable(payload);
        if (normalizedPayload == null)
        {
            return "مصدر الخيارات (CDMendTbl) مطلوب لأن نوع الحقل قائم على قائمة.";
        }

        // نحافظ على التوافق مع أي تنسيقات قديمة غير JSON (مثل النص المفصول بعلامات).
        if (!normalizedPayload.StartsWith('{') && !normalizedPayload.StartsWith('['))
        {
            return null;
        }

        JsonDocument document;
        try
        {
            document = JsonDocument.Parse(normalizedPayload);
        }
        catch (JsonException)
        {
            return "صيغة JSON داخل CDMendTbl غير صحيحة.";
        }

        using (document)
        {
            var rows = new List<(string Key, string Value)>();
            if (document.RootElement.ValueKind == JsonValueKind.Object)
            {
                foreach (var property in document.RootElement.EnumerateObject())
                {
                    var key = NormalizeNullable(property.Name);
                    var value = NormalizeNullable(ReadJsonScalarText(property.Value));
                    if (key == null || value == null)
                    {
                        return "كل عنصر داخل CDMendTbl يجب أن يحتوي مفتاحًا وقيمة صالحين.";
                    }

                    rows.Add((key, value));
                }
            }
            else if (document.RootElement.ValueKind == JsonValueKind.Array)
            {
                var index = 0;
                foreach (var item in document.RootElement.EnumerateArray())
                {
                    index++;
                    string? key = null;
                    string? value = null;

                    if (item.ValueKind == JsonValueKind.Object)
                    {
                        key = NormalizeNullable(ReadJsonObjectValue(item, "key", "value", "id", "code", "name", "label", "text"));
                        value = NormalizeNullable(ReadJsonObjectValue(item, "name", "value", "label", "text", "key", "id", "code"));
                    }
                    else if (item.ValueKind == JsonValueKind.String
                        || item.ValueKind == JsonValueKind.Number
                        || item.ValueKind == JsonValueKind.True
                        || item.ValueKind == JsonValueKind.False)
                    {
                        var scalar = NormalizeNullable(ReadJsonScalarText(item));
                        key = scalar;
                        value = scalar;
                    }

                    if (key == null || value == null)
                    {
                        return $"العنصر رقم {index} داخل CDMendTbl غير مكتمل: يجب أن يحتوي مفتاحًا وقيمة.";
                    }

                    rows.Add((key, value));
                }
            }
            else
            {
                return "CDMendTbl يجب أن يكون JSON Object أو JSON Array.";
            }

            if (rows.Count == 0)
            {
                return "CDMendTbl يجب أن يحتوي صفًا واحدًا على الأقل.";
            }

            var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var row in rows)
            {
                if (!seen.Add(row.Key))
                {
                    return $"لا يمكن تكرار المفتاح '{row.Key}' داخل CDMendTbl.";
                }
            }
        }

        return null;
    }

    private static string? ReadJsonObjectValue(JsonElement source, params string[] keys)
    {
        foreach (var property in source.EnumerateObject())
        {
            foreach (var key in keys)
            {
                if (!string.Equals(property.Name, key, StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                var text = NormalizeNullable(ReadJsonScalarText(property.Value));
                if (text != null)
                {
                    return text;
                }
            }
        }

        return null;
    }

    private static string ReadJsonScalarText(JsonElement value)
    {
        return value.ValueKind switch
        {
            JsonValueKind.String => value.GetString() ?? string.Empty,
            JsonValueKind.Number => value.GetRawText(),
            JsonValueKind.True => "true",
            JsonValueKind.False => "false",
            JsonValueKind.Null => string.Empty,
            JsonValueKind.Undefined => string.Empty,
            _ => value.GetRawText()
        };
    }

    private static int ReadDictionaryValue(IReadOnlyDictionary<string, int> source, string key)
    {
        return source.TryGetValue(key, out var value) ? value : 0;
    }

    private static int ReadDictionaryValue(IReadOnlyDictionary<int, int> source, int key)
    {
        return source.TryGetValue(key, out var value) ? value : 0;
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

    private static AdminCatalogCategoryDto MapCategory(
        Cdcategory category,
        SubjectTypeAdminSetting? categorySetting = null)
    {
        var displaySettings = ResolveDisplaySettingsState(categorySetting);
        return new AdminCatalogCategoryDto
        {
            CategoryId = category.CatId,
            ParentCategoryId = category.CatParent,
            CategoryName = category.CatName,
            ApplicationId = category.ApplicationId,
            IsActive = !category.CatStatus,
            DefaultViewMode = displaySettings.DefaultViewMode,
            AllowRequesterOverride = displaySettings.AllowRequesterOverride
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

    private static IReadOnlyList<AdminCatalogCategoryTreeNodeDto> BuildCategoryTree(
        IReadOnlyList<Cdcategory> categories,
        IReadOnlyDictionary<int, SubjectTypeAdminSetting> settingsMap)
    {
        var safeSettingsMap = settingsMap ?? new Dictionary<int, SubjectTypeAdminSetting>();
        var nodeMap = categories.ToDictionary(
            keySelector: item => item.CatId,
            elementSelector: item =>
            {
                safeSettingsMap.TryGetValue(item.CatId, out var setting);
                var displaySettings = ResolveDisplaySettingsState(setting);
                return new CategoryTreeBuilderNode
                {
                    CategoryId = item.CatId,
                    ParentCategoryId = item.CatParent,
                    CategoryName = item.CatName,
                    ApplicationId = item.ApplicationId,
                    IsActive = !item.CatStatus,
                    DefaultViewMode = displaySettings.DefaultViewMode,
                    AllowRequesterOverride = displaySettings.AllowRequesterOverride
                };
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
            DefaultViewMode = node.DefaultViewMode,
            AllowRequesterOverride = node.AllowRequesterOverride,
            Children = node.Children.Select(MapTreeNode).ToList()
        };
    }

    private static CategoryDisplaySettingsState BuildDisplaySettingsState(
        string? defaultViewMode,
        bool? allowRequesterOverride)
    {
        return new CategoryDisplaySettingsState
        {
            DefaultViewMode = NormalizeViewMode(defaultViewMode),
            AllowRequesterOverride = allowRequesterOverride == true
        };
    }

    private static CategoryDisplaySettingsState ResolveDisplaySettingsState(SubjectTypeAdminSetting? setting)
    {
        if (setting == null)
        {
            return new CategoryDisplaySettingsState();
        }

        var fromJson = ResolveDisplaySettingsFromSettingsJson(setting.SettingsJson);
        var normalizedColumnViewMode = NormalizeNullable(setting.DefaultViewMode);

        return new CategoryDisplaySettingsState
        {
            DefaultViewMode = normalizedColumnViewMode == null
                ? fromJson.DefaultViewMode
                : NormalizeViewMode(setting.DefaultViewMode),
            AllowRequesterOverride = setting.AllowRequesterOverride
        };
    }

    private static CategoryDisplaySettingsState ResolveDisplaySettingsFromSettingsJson(string? settingsJson)
    {
        var result = new CategoryDisplaySettingsState();
        var payload = NormalizeNullable(settingsJson);
        if (payload == null)
        {
            return result;
        }

        try
        {
            var rootNode = JsonNode.Parse(payload) as JsonObject;
            if (rootNode == null)
            {
                return result;
            }

            var nestedPresentationObject = rootNode["presentationSettings"] as JsonObject;
            var defaultViewModeCandidate =
                ReadStringFromJsonNode(rootNode["defaultViewMode"])
                ?? ReadStringFromJsonNode(rootNode["defaultDisplayMode"])
                ?? ReadStringFromJsonNode(nestedPresentationObject?["defaultViewMode"])
                ?? ReadStringFromJsonNode(nestedPresentationObject?["defaultDisplayMode"]);
            var allowRequesterOverrideCandidate =
                ReadBooleanFromJsonNode(rootNode["allowRequesterOverride"])
                ?? ReadBooleanFromJsonNode(rootNode["allowUserToChangeDisplayMode"])
                ?? ReadBooleanFromJsonNode(nestedPresentationObject?["allowRequesterOverride"])
                ?? ReadBooleanFromJsonNode(nestedPresentationObject?["allowUserToChangeDisplayMode"]);

            result.DefaultViewMode = NormalizeViewMode(defaultViewModeCandidate);
            if (allowRequesterOverrideCandidate.HasValue)
            {
                result.AllowRequesterOverride = allowRequesterOverrideCandidate.Value;
            }
        }
        catch
        {
            // Keep defaults.
        }

        return result;
    }

    private static string? MergeDisplaySettingsIntoSettingsJson(
        string? settingsJson,
        CategoryDisplaySettingsState state)
    {
        JsonObject root;
        var payload = NormalizeNullable(settingsJson);
        if (payload == null)
        {
            root = new JsonObject();
        }
        else
        {
            try
            {
                root = JsonNode.Parse(payload) as JsonObject ?? new JsonObject();
            }
            catch
            {
                root = new JsonObject();
            }
        }

        var normalizedDefaultViewMode = NormalizeViewMode(state.DefaultViewMode);
        root["defaultViewMode"] = normalizedDefaultViewMode;
        root["allowRequesterOverride"] = state.AllowRequesterOverride;
        root["defaultDisplayMode"] = normalizedDefaultViewMode == TabbedViewModeValue ? "Tabbed" : "Standard";
        root["allowUserToChangeDisplayMode"] = state.AllowRequesterOverride;

        root.Remove("presentationSettings");

        return root.Count == 0
            ? null
            : root.ToJsonString(new JsonSerializerOptions { WriteIndented = false });
    }

    private static string NormalizeViewMode(string? value)
    {
        var normalized = NormalizeNullable(value)?.ToLowerInvariant();
        return normalized == TabbedViewModeValue
            ? TabbedViewModeValue
            : DefaultViewModeValue;
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

    private static bool? ReadBooleanFromJsonNode(JsonNode? node)
    {
        if (node is not JsonValue value)
        {
            return null;
        }

        if (value.TryGetValue<bool>(out var parsedBool))
        {
            return parsedBool;
        }

        if (value.TryGetValue<string>(out var parsedString))
        {
            var normalized = NormalizeNullable(parsedString)?.ToLowerInvariant();
            return normalized switch
            {
                "true" => true,
                "1" => true,
                "yes" => true,
                "y" => true,
                "false" => false,
                "0" => false,
                "no" => false,
                "n" => false,
                _ => null
            };
        }

        return null;
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

    private async Task SaveChangesAndInvalidatePreviewCacheAsync(CancellationToken cancellationToken)
    {
        await _repository.SaveChangesAsync(cancellationToken);
        await _requestPreviewCache.InvalidateAllAsync(cancellationToken);
    }

    private static void AddUnhandledError<T>(CommonResponse<T> response)
    {
        response.Errors.Add(new Error { Code = "500", Message = "حدث خطأ غير متوقع أثناء معالجة الطلب." });
    }

    private sealed class FieldValidationContext
    {
        public static FieldValidationContext Invalid { get; } = new();

        public bool IsValid { get; init; }

        public string? ApplicationId { get; init; }

        public string? FieldKey { get; init; }

        public string? FieldType { get; init; }

        public string? FieldLabel { get; init; }

        public string? Placeholder { get; init; }

        public string? DefaultValue { get; init; }

        public string? CdmendTbl { get; init; }

        public string? DataType { get; init; }

        public string? MinValue { get; init; }

        public string? MaxValue { get; init; }

        public string? Mask { get; init; }
    }

    private sealed class CategoryDisplaySettingsState
    {
        public string DefaultViewMode { get; set; } = "standard";

        public bool AllowRequesterOverride { get; set; }
    }

    private sealed class CategoryTreeBuilderNode
    {
        public int CategoryId { get; init; }

        public int ParentCategoryId { get; init; }

        public string CategoryName { get; init; } = string.Empty;

        public string? ApplicationId { get; init; }

        public bool IsActive { get; init; }

        public string DefaultViewMode { get; init; } = "standard";

        public bool AllowRequesterOverride { get; init; }

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
