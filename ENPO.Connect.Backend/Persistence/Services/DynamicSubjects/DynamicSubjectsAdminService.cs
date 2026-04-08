using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Models.Correspondance;
using Models.DTO.Common;
using Models.DTO.DynamicSubjects;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace Persistence.Services.DynamicSubjects;

public sealed partial class DynamicSubjectsService
{
    private const int CategoryNameMaxLength = 50;
    private const int ApplicationIdMaxLength = 10;
    private const int RecipientMaxLength = 100;
    private const int FieldKeyMaxLength = 50;
    private const int FieldTypeMaxLength = 50;
    private const int FieldLabelMaxLength = 50;
    private const int FieldDataTypeMaxLength = 50;
    private const int FieldMaskMaxLength = 30;
    private const int GroupNameMaxLength = 100;
    private const int GroupDescriptionMaxLength = 255;
    private const int GroupWithInRowMaxValue = 12;
    private const int ReferencePrefixMaxLength = 40;
    private const int ReferenceSeparatorMaxLength = 10;
    private const int SourceFieldKeysMaxLength = 500;
    private const int SequenceNameMaxLength = 80;

    public async Task<CommonResponse<IEnumerable<SubjectTypeAdminDto>>> GetAdminCategoryTreeAsync(
        string userId,
        string? appId,
        CancellationToken cancellationToken = default)
    {
        return await GetSubjectTypeAdminConfigsAsync(userId, appId, cancellationToken);
    }

    public async Task<CommonResponse<SubjectTypeAdminDto>> CreateAdminCategoryAsync(
        SubjectTypeAdminCreateRequestDto request,
        string userId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<SubjectTypeAdminDto>();
        try
        {
            var normalizedUserId = NormalizeUser(userId);
            if (normalizedUserId.Length == 0)
            {
                response.Errors.Add(new Error { Code = "401", Message = "المستخدم غير مصرح له." });
                return response;
            }

            var safeRequest = request ?? new SubjectTypeAdminCreateRequestDto();
            if (safeRequest.ParentCategoryId < 0)
            {
                response.Errors.Add(new Error { Code = "400", Message = "المعرف الأب غير صالح." });
                return response;
            }

            if (safeRequest.CatWorkFlow < 0)
            {
                response.Errors.Add(new Error { Code = "400", Message = "رقم مسار العمل يجب أن يكون صفرًا أو قيمة موجبة." });
                return response;
            }

            var categoryName = (safeRequest.CategoryName ?? string.Empty).Trim();
            if (categoryName.Length == 0)
            {
                response.Errors.Add(new Error { Code = "400", Message = "اسم النوع مطلوب." });
                return response;
            }

            if (categoryName.Length > CategoryNameMaxLength)
            {
                response.Errors.Add(new Error { Code = "400", Message = $"اسم النوع يجب ألا يزيد عن {CategoryNameMaxLength} حرفًا." });
                return response;
            }

            var applicationId = NormalizeNullable(safeRequest.ApplicationId);
            if (ExceedsMaxLength(applicationId, ApplicationIdMaxLength))
            {
                response.Errors.Add(new Error { Code = "400", Message = $"معرف التطبيق يجب ألا يزيد عن {ApplicationIdMaxLength} أحرف." });
                return response;
            }

            var to = NormalizeNullable(safeRequest.To);
            if (ExceedsMaxLength(to, RecipientMaxLength))
            {
                response.Errors.Add(new Error { Code = "400", Message = $"حقل 'إلى' يجب ألا يزيد عن {RecipientMaxLength} حرفًا." });
                return response;
            }

            var cc = NormalizeNullable(safeRequest.Cc);
            if (ExceedsMaxLength(cc, RecipientMaxLength))
            {
                response.Errors.Add(new Error { Code = "400", Message = $"حقل 'نسخة' يجب ألا يزيد عن {RecipientMaxLength} حرفًا." });
                return response;
            }

            Cdcategory? parentCategory = null;
            if (safeRequest.ParentCategoryId > 0)
            {
                parentCategory = await _connectContext.Cdcategories
                    .AsNoTracking()
                    .FirstOrDefaultAsync(item => item.CatId == safeRequest.ParentCategoryId, cancellationToken);
                if (parentCategory == null)
                {
                    response.Errors.Add(new Error { Code = "404", Message = "النوع الأب غير موجود." });
                    return response;
                }

                var parentApplicationId = NormalizeNullable(parentCategory.ApplicationId);
                if (applicationId == null)
                {
                    applicationId = parentApplicationId;
                }
                else if (parentApplicationId != null && !EqualsNormalized(parentApplicationId, applicationId))
                {
                    response.Errors.Add(new Error { Code = "400", Message = "لا يمكن إنشاء نوع فرعي بتطبيق مختلف عن النوع الأب." });
                    return response;
                }
            }

            if (await HasSiblingCategoryNameConflictAsync(
                    excludedCategoryId: null,
                    parentCategoryId: safeRequest.ParentCategoryId,
                    categoryName: categoryName,
                    applicationId: applicationId,
                    cancellationToken: cancellationToken))
            {
                response.Errors.Add(new Error { Code = "409", Message = "يوجد نوع آخر بنفس الاسم داخل نفس المستوى." });
                return response;
            }

            var nextCategoryId = _helperService.GetSequenceNextValue("Seq_Categories");
            if (nextCategoryId <= 0)
            {
                var maxCategoryId = await _connectContext.Cdcategories.MaxAsync(item => (int?)item.CatId, cancellationToken) ?? 100;
                nextCategoryId = maxCategoryId + 1;
            }

            var category = new Cdcategory
            {
                CatId = nextCategoryId,
                CatParent = safeRequest.ParentCategoryId,
                CatName = categoryName,
                CatStatus = !safeRequest.IsActive,
                CatMend = NormalizeNullable(safeRequest.CatMend),
                CatWorkFlow = safeRequest.CatWorkFlow,
                CatSms = safeRequest.CatSms,
                CatMailNotification = safeRequest.CatMailNotification,
                To = to,
                Cc = cc,
                StampDate = DateTime.Now,
                CatCreatedBy = int.TryParse(normalizedUserId, out var parsedCreator) ? parsedCreator : null,
                ApplicationId = applicationId
            };

            await _connectContext.Cdcategories.AddAsync(category, cancellationToken);

            var displayOrder = await ResolveNextCategoryDisplayOrderAsync(safeRequest.ParentCategoryId, cancellationToken);
            await _connectContext.SubjectTypeAdminSettings.AddAsync(new SubjectTypeAdminSetting
            {
                CategoryId = category.CatId,
                DisplayOrder = displayOrder,
                SettingsJson = null,
                LastModifiedBy = normalizedUserId,
                LastModifiedAtUtc = DateTime.UtcNow
            }, cancellationToken);

            await _connectContext.SaveChangesAsync(cancellationToken);

            response.Data = BuildSubjectTypeAdminDto(
                category,
                hasDynamicFields: false,
                policy: null,
                settings: new SubjectTypeAdminSetting
                {
                    CategoryId = category.CatId,
                    DisplayOrder = displayOrder
                });
        }
        catch (Exception)
        {
            AddUnhandledError(response);
        }

        return response;
    }

    public async Task<CommonResponse<SubjectTypeAdminDto>> UpdateAdminCategoryAsync(
        int categoryId,
        SubjectTypeAdminUpdateRequestDto request,
        string userId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<SubjectTypeAdminDto>();
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
                response.Errors.Add(new Error { Code = "400", Message = "النوع مطلوب." });
                return response;
            }

            var category = await _connectContext.Cdcategories
                .FirstOrDefaultAsync(item => item.CatId == categoryId, cancellationToken);
            if (category == null)
            {
                response.Errors.Add(new Error { Code = "404", Message = "النوع غير موجود." });
                return response;
            }

            var safeRequest = request ?? new SubjectTypeAdminUpdateRequestDto();
            var categoryName = (safeRequest.CategoryName ?? string.Empty).Trim();
            if (categoryName.Length == 0)
            {
                response.Errors.Add(new Error { Code = "400", Message = "اسم النوع مطلوب." });
                return response;
            }

            if (categoryName.Length > CategoryNameMaxLength)
            {
                response.Errors.Add(new Error { Code = "400", Message = $"اسم النوع يجب ألا يزيد عن {CategoryNameMaxLength} حرفًا." });
                return response;
            }

            if (safeRequest.CatWorkFlow < 0)
            {
                response.Errors.Add(new Error { Code = "400", Message = "رقم مسار العمل يجب أن يكون صفرًا أو قيمة موجبة." });
                return response;
            }

            var applicationId = NormalizeNullable(safeRequest.ApplicationId);
            if (ExceedsMaxLength(applicationId, ApplicationIdMaxLength))
            {
                response.Errors.Add(new Error { Code = "400", Message = $"معرف التطبيق يجب ألا يزيد عن {ApplicationIdMaxLength} أحرف." });
                return response;
            }

            var to = NormalizeNullable(safeRequest.To);
            if (ExceedsMaxLength(to, RecipientMaxLength))
            {
                response.Errors.Add(new Error { Code = "400", Message = $"حقل 'إلى' يجب ألا يزيد عن {RecipientMaxLength} حرفًا." });
                return response;
            }

            var cc = NormalizeNullable(safeRequest.Cc);
            if (ExceedsMaxLength(cc, RecipientMaxLength))
            {
                response.Errors.Add(new Error { Code = "400", Message = $"حقل 'نسخة' يجب ألا يزيد عن {RecipientMaxLength} حرفًا." });
                return response;
            }

            if (category.CatParent > 0)
            {
                var parentCategory = await _connectContext.Cdcategories
                    .AsNoTracking()
                    .FirstOrDefaultAsync(item => item.CatId == category.CatParent, cancellationToken);
                if (parentCategory == null)
                {
                    response.Errors.Add(new Error { Code = "404", Message = "النوع الأب غير موجود." });
                    return response;
                }

                var parentApplicationId = NormalizeNullable(parentCategory.ApplicationId);
                if (applicationId == null)
                {
                    applicationId = parentApplicationId;
                }
                else if (parentApplicationId != null && !EqualsNormalized(parentApplicationId, applicationId))
                {
                    response.Errors.Add(new Error { Code = "400", Message = "لا يمكن تعيين تطبيق مختلف عن النوع الأب." });
                    return response;
                }
            }

            if (await HasSiblingCategoryNameConflictAsync(
                    excludedCategoryId: categoryId,
                    parentCategoryId: category.CatParent,
                    categoryName: categoryName,
                    applicationId: applicationId,
                    cancellationToken: cancellationToken))
            {
                response.Errors.Add(new Error { Code = "409", Message = "يوجد نوع آخر بنفس الاسم داخل نفس المستوى." });
                return response;
            }

            category.CatName = categoryName;
            category.ApplicationId = applicationId;
            category.CatMend = NormalizeNullable(safeRequest.CatMend);
            category.CatWorkFlow = safeRequest.CatWorkFlow;
            category.CatSms = safeRequest.CatSms;
            category.CatMailNotification = safeRequest.CatMailNotification;
            category.To = to;
            category.Cc = cc;
            category.CatStatus = !safeRequest.IsActive;
            category.StampDate = DateTime.Now;

            var setting = await EnsureCategorySettingAsync(category.CatId, category.CatParent, normalizedUserId, cancellationToken);
            setting.LastModifiedBy = normalizedUserId;
            setting.LastModifiedAtUtc = DateTime.UtcNow;

            await _connectContext.SaveChangesAsync(cancellationToken);

            var hasDynamicFields = await _connectContext.CdCategoryMands
                .AsNoTracking()
                .AnyAsync(link => link.MendCategory == categoryId && !link.MendStat, cancellationToken);
            var policy = await _connectContext.SubjectReferencePolicies
                .AsNoTracking()
                .FirstOrDefaultAsync(item => item.CategoryId == categoryId, cancellationToken);

            response.Data = BuildSubjectTypeAdminDto(category, hasDynamicFields, policy, setting);
        }
        catch (Exception)
        {
            AddUnhandledError(response);
        }

        return response;
    }

    public async Task<CommonResponse<bool>> DeleteAdminCategoryAsync(
        int categoryId,
        string userId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<bool>();
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
                response.Errors.Add(new Error { Code = "400", Message = "النوع مطلوب." });
                return response;
            }

            var category = await _connectContext.Cdcategories
                .FirstOrDefaultAsync(item => item.CatId == categoryId, cancellationToken);
            if (category == null)
            {
                response.Errors.Add(new Error { Code = "404", Message = "النوع غير موجود." });
                return response;
            }

            var hasChildren = await _connectContext.Cdcategories
                .AsNoTracking()
                .AnyAsync(item => item.CatParent == categoryId, cancellationToken);
            if (hasChildren)
            {
                response.Errors.Add(new Error { Code = "400", Message = "لا يمكن حذف نوع يحتوي على أنواع فرعية." });
                return response;
            }

            var hasMessages = await _connectContext.Messages
                .AsNoTracking()
                .AnyAsync(item => item.CategoryCd == categoryId, cancellationToken);
            var hasLinks = await _connectContext.CdCategoryMands
                .AsNoTracking()
                .AnyAsync(item => item.MendCategory == categoryId, cancellationToken);

            if (hasMessages || hasLinks)
            {
                category.CatStatus = true;
                await _connectContext.SaveChangesAsync(cancellationToken);
                response.Data = true;
                return response;
            }

            var setting = await _connectContext.SubjectTypeAdminSettings
                .FirstOrDefaultAsync(item => item.CategoryId == categoryId, cancellationToken);
            if (setting != null)
            {
                _connectContext.SubjectTypeAdminSettings.Remove(setting);
            }

            var policy = await _connectContext.SubjectReferencePolicies
                .FirstOrDefaultAsync(item => item.CategoryId == categoryId, cancellationToken);
            if (policy != null)
            {
                _connectContext.SubjectReferencePolicies.Remove(policy);
            }

            _connectContext.Cdcategories.Remove(category);
            await _connectContext.SaveChangesAsync(cancellationToken);

            await RebalanceCategoryDisplayOrderAsync(category.CatParent, normalizedUserId, cancellationToken);

            response.Data = true;
        }
        catch (Exception)
        {
            AddUnhandledError(response);
        }

        return response;
    }

    public async Task<CommonResponse<SubjectTypeAdminDto>> SetAdminCategoryStatusAsync(
        int categoryId,
        SubjectTypeAdminStatusRequestDto request,
        string userId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<SubjectTypeAdminDto>();
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
                response.Errors.Add(new Error { Code = "400", Message = "النوع مطلوب." });
                return response;
            }

            var category = await _connectContext.Cdcategories
                .FirstOrDefaultAsync(item => item.CatId == categoryId, cancellationToken);
            if (category == null)
            {
                response.Errors.Add(new Error { Code = "404", Message = "النوع غير موجود." });
                return response;
            }

            var safeRequest = request ?? new SubjectTypeAdminStatusRequestDto();
            if (safeRequest.IsActive && category.CatParent > 0)
            {
                var parentCategory = await _connectContext.Cdcategories
                    .AsNoTracking()
                    .FirstOrDefaultAsync(item => item.CatId == category.CatParent, cancellationToken);
                if (parentCategory == null)
                {
                    response.Errors.Add(new Error { Code = "404", Message = "النوع الأب غير موجود." });
                    return response;
                }

                if (parentCategory.CatStatus)
                {
                    response.Errors.Add(new Error { Code = "400", Message = "لا يمكن تفعيل نوع فرعي تحت نوع أب غير مفعل." });
                    return response;
                }
            }

            var setting = await EnsureCategorySettingAsync(category.CatId, category.CatParent, normalizedUserId, cancellationToken);
            var requestPolicy = TryReadRequestPolicyFromSettingsJson(setting.SettingsJson);
            var directionLifecycle = ResolveDirectionLifecycleFromSettingsJson(
                setting.SettingsJson,
                fallbackIsPublished: !category.CatStatus);

            if (safeRequest.IsActive)
            {
                var links = await LoadAdminCategoryFieldLinksAsync(categoryId, cancellationToken);
                var definitionResponse = await BuildFormDefinitionAsync(
                    categoryId,
                    normalizedUserId,
                    category.ApplicationId,
                    allowInactiveCategory: true,
                    cancellationToken);
                if (definitionResponse.Errors?.Count > 0)
                {
                    foreach (var error in definitionResponse.Errors)
                    {
                        response.Errors.Add(error);
                    }

                    return response;
                }

                var definition = definitionResponse.Data ?? new SubjectFormDefinitionDto
                {
                    CategoryId = category.CatId,
                    CategoryName = category.CatName,
                    ParentCategoryId = category.CatParent,
                    ApplicationId = category.ApplicationId,
                    Groups = new List<SubjectGroupDefinitionDto>(),
                    Fields = new List<SubjectFieldDefinitionDto>()
                };

                foreach (var direction in DefaultRequestDirections)
                {
                    var readiness = BuildPreviewWorkspaceReadiness(
                        category,
                        links,
                        definition,
                        requestPolicy,
                        direction);
                    if (!readiness.IsReady)
                    {
                        response.Errors.Add(new Error
                        {
                            Code = "400",
                            Message = $"لا يمكن التفعيل الكامل لأن readiness غير مكتملة للاتجاه '{direction}'."
                        });
                        return response;
                    }
                }
            }

            foreach (var direction in DefaultRequestDirections)
            {
                if (!directionLifecycle.TryGetValue(direction, out var state) || state == null)
                {
                    state = new DirectionLifecycleSettingsState();
                    directionLifecycle[direction] = state;
                }

                state.IsPublished = safeRequest.IsActive;
                state.LastChangedAtUtc = DateTime.UtcNow;
                state.LastChangedBy = normalizedUserId;
            }

            setting.SettingsJson = MergeDirectionLifecycleIntoSettingsJson(setting.SettingsJson, directionLifecycle);
            category.CatStatus = !safeRequest.IsActive;
            setting.LastModifiedBy = normalizedUserId;
            setting.LastModifiedAtUtc = DateTime.UtcNow;

            await _connectContext.SaveChangesAsync(cancellationToken);

            var hasDynamicFields = await _connectContext.CdCategoryMands
                .AsNoTracking()
                .AnyAsync(link => link.MendCategory == categoryId && !link.MendStat, cancellationToken);
            var policy = await _connectContext.SubjectReferencePolicies
                .AsNoTracking()
                .FirstOrDefaultAsync(item => item.CategoryId == categoryId, cancellationToken);

            response.Data = BuildSubjectTypeAdminDto(category, hasDynamicFields, policy, setting);
        }
        catch (Exception)
        {
            AddUnhandledError(response);
        }

        return response;
    }

    public async Task<CommonResponse<SubjectAdminDirectionalReadinessDto>> SetAdminCategoryDirectionStatusAsync(
        int categoryId,
        string documentDirection,
        SubjectTypeAdminDirectionStatusRequestDto request,
        string userId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<SubjectAdminDirectionalReadinessDto>();
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
                response.Errors.Add(new Error { Code = "400", Message = "النوع مطلوب." });
                return response;
            }

            var normalizedDirection = NormalizeDirectionKey(documentDirection);
            if (normalizedDirection == null)
            {
                response.Errors.Add(new Error { Code = "400", Message = "الاتجاه غير مدعوم. القيم المتاحة: incoming أو outgoing." });
                return response;
            }

            var category = await _connectContext.Cdcategories
                .FirstOrDefaultAsync(item => item.CatId == categoryId, cancellationToken);
            if (category == null)
            {
                response.Errors.Add(new Error { Code = "404", Message = "النوع غير موجود." });
                return response;
            }

            var safeRequest = request ?? new SubjectTypeAdminDirectionStatusRequestDto();
            if (safeRequest.IsActive && category.CatParent > 0)
            {
                var parentCategory = await _connectContext.Cdcategories
                    .AsNoTracking()
                    .FirstOrDefaultAsync(item => item.CatId == category.CatParent, cancellationToken);
                if (parentCategory == null)
                {
                    response.Errors.Add(new Error { Code = "404", Message = "النوع الأب غير موجود." });
                    return response;
                }

                if (parentCategory.CatStatus)
                {
                    response.Errors.Add(new Error { Code = "400", Message = "لا يمكن تفعيل اتجاه داخل نوع فرعي تحت نوع أب غير مفعل." });
                    return response;
                }
            }

            var setting = await EnsureCategorySettingAsync(category.CatId, category.CatParent, normalizedUserId, cancellationToken);
            var requestPolicy = TryReadRequestPolicyFromSettingsJson(setting.SettingsJson);
            var directionLifecycle = ResolveDirectionLifecycleFromSettingsJson(
                setting.SettingsJson,
                fallbackIsPublished: !category.CatStatus);

            var links = await LoadAdminCategoryFieldLinksAsync(categoryId, cancellationToken);
            var definitionResponse = await BuildFormDefinitionAsync(
                categoryId,
                normalizedUserId,
                category.ApplicationId,
                allowInactiveCategory: true,
                cancellationToken);
            if (definitionResponse.Errors?.Count > 0)
            {
                foreach (var error in definitionResponse.Errors)
                {
                    response.Errors.Add(error);
                }

                return response;
            }

            var definition = definitionResponse.Data ?? new SubjectFormDefinitionDto
            {
                CategoryId = category.CatId,
                CategoryName = category.CatName,
                ParentCategoryId = category.CatParent,
                ApplicationId = category.ApplicationId,
                Groups = new List<SubjectGroupDefinitionDto>(),
                Fields = new List<SubjectFieldDefinitionDto>()
            };

            var readiness = BuildPreviewWorkspaceReadiness(
                category,
                links,
                definition,
                requestPolicy,
                normalizedDirection);
            if (safeRequest.IsActive && !readiness.IsReady)
            {
                response.Errors.Add(new Error
                {
                    Code = "400",
                    Message = $"لا يمكن تفعيل الاتجاه '{normalizedDirection}' لأن readiness غير مكتملة."
                });
                return response;
            }

            if (!directionLifecycle.TryGetValue(normalizedDirection, out var lifecycleState) || lifecycleState == null)
            {
                lifecycleState = new DirectionLifecycleSettingsState();
                directionLifecycle[normalizedDirection] = lifecycleState;
            }

            lifecycleState.IsPublished = safeRequest.IsActive;
            lifecycleState.LastChangedAtUtc = DateTime.UtcNow;
            lifecycleState.LastChangedBy = normalizedUserId;

            var anyPublishedDirection = directionLifecycle.Values.Any(item => item?.IsPublished == true);
            category.CatStatus = !anyPublishedDirection;
            setting.SettingsJson = MergeDirectionLifecycleIntoSettingsJson(setting.SettingsJson, directionLifecycle);
            setting.LastModifiedBy = normalizedUserId;
            setting.LastModifiedAtUtc = DateTime.UtcNow;

            await _connectContext.SaveChangesAsync(cancellationToken);

            response.Data = new SubjectAdminDirectionalReadinessDto
            {
                Direction = normalizedDirection,
                IsPublished = lifecycleState.IsPublished,
                LastChangedAtUtc = lifecycleState.LastChangedAtUtc,
                LastChangedBy = lifecycleState.LastChangedBy,
                Readiness = readiness
            };
        }
        catch (Exception)
        {
            AddUnhandledError(response);
        }

        return response;
    }

    public async Task<CommonResponse<IEnumerable<SubjectTypeAdminDto>>> MoveAdminCategoryAsync(
        int categoryId,
        SubjectTypeAdminTreeMoveRequestDto request,
        string userId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<IEnumerable<SubjectTypeAdminDto>>();
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
                response.Errors.Add(new Error { Code = "400", Message = "النوع مطلوب." });
                return response;
            }

            var category = await _connectContext.Cdcategories
                .FirstOrDefaultAsync(item => item.CatId == categoryId, cancellationToken);
            if (category == null)
            {
                response.Errors.Add(new Error { Code = "404", Message = "النوع غير موجود." });
                return response;
            }

            var safeRequest = request ?? new SubjectTypeAdminTreeMoveRequestDto();
            var newParentId = safeRequest.NewParentCategoryId;
            var oldParentId = category.CatParent;
            var safeTargetIndex = Math.Max(0, safeRequest.NewIndex);

            if (newParentId < 0)
            {
                response.Errors.Add(new Error { Code = "400", Message = "المعرف الأب الهدف غير صالح." });
                return response;
            }

            if (newParentId == categoryId)
            {
                response.Errors.Add(new Error { Code = "400", Message = "لا يمكن نقل النوع تحت نفسه." });
                return response;
            }

            if (newParentId > 0)
            {
                var newParent = await _connectContext.Cdcategories
                    .AsNoTracking()
                    .FirstOrDefaultAsync(item => item.CatId == newParentId, cancellationToken);
                if (newParent == null)
                {
                    response.Errors.Add(new Error { Code = "404", Message = "النوع الأب الهدف غير موجود." });
                    return response;
                }

                var parentApplicationId = NormalizeNullable(newParent.ApplicationId);
                var currentApplicationId = NormalizeNullable(category.ApplicationId);
                if (parentApplicationId != null && currentApplicationId != null && !EqualsNormalized(parentApplicationId, currentApplicationId))
                {
                    response.Errors.Add(new Error { Code = "400", Message = "لا يمكن نقل النوع تحت نوع أب من تطبيق مختلف." });
                    return response;
                }

                if (parentApplicationId != null && currentApplicationId == null)
                {
                    category.ApplicationId = parentApplicationId;
                }

                var descendants = await LoadDescendantCategoryIdsAsync(categoryId, cancellationToken);
                if (descendants.Contains(newParentId))
                {
                    response.Errors.Add(new Error { Code = "400", Message = "لا يمكن نقل النوع تحت أحد أبنائه." });
                    return response;
                }
            }

            category.CatParent = newParentId;
            category.StampDate = DateTime.Now;

            await EnsureCategorySettingAsync(category.CatId, category.CatParent, normalizedUserId, cancellationToken);
            await _connectContext.SaveChangesAsync(cancellationToken);

            await RebalanceCategoryDisplayOrderAsync(oldParentId, normalizedUserId, cancellationToken);
            await RebalanceCategoryDisplayOrderAsync(newParentId, normalizedUserId, cancellationToken, categoryId, safeTargetIndex);

            response.Data = (await GetAdminCategoryTreeAsync(normalizedUserId, appId: null, cancellationToken)).Data ?? new List<SubjectTypeAdminDto>();
        }
        catch (Exception)
        {
            AddUnhandledError(response);
        }

        return response;
    }

    public async Task<CommonResponse<IEnumerable<SubjectAdminFieldDto>>> GetAdminFieldsAsync(
        string userId,
        string? appId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<IEnumerable<SubjectAdminFieldDto>>();
        try
        {
            var normalizedUserId = NormalizeUser(userId);
            if (normalizedUserId.Length == 0)
            {
                response.Errors.Add(new Error { Code = "401", Message = "المستخدم غير مصرح له." });
                return response;
            }

            IQueryable<Cdmend> query = _connectContext.Cdmends.AsNoTracking();
            var normalizedAppId = NormalizeNullable(appId);
            if (normalizedAppId != null)
            {
                query = query.Where(item => (item.ApplicationId ?? string.Empty) == normalizedAppId);
            }

            var fields = await query
                .OrderBy(item => item.CdmendTxt)
                .ToListAsync(cancellationToken);

            var fieldKeys = fields
                .Select(item => item.CdmendTxt)
                .Where(item => !string.IsNullOrWhiteSpace(item))
                .ToList();

            var linkedCounts = await _connectContext.CdCategoryMands
                .AsNoTracking()
                .Where(link => fieldKeys.Contains(link.MendField) && !link.MendStat)
                .GroupBy(link => link.MendField)
                .Select(group => new
                {
                    FieldKey = group.Key,
                    Count = group.Select(item => item.MendCategory).Distinct().Count()
                })
                .ToDictionaryAsync(item => item.FieldKey, item => item.Count, cancellationToken);

            response.Data = fields.Select(field => MapAdminField(field, linkedCounts)).ToList();
        }
        catch (Exception)
        {
            AddUnhandledError(response);
        }

        return response;
    }

    public async Task<CommonResponse<SubjectAdminFieldDto>> CreateAdminFieldAsync(
        SubjectAdminFieldUpsertRequestDto request,
        string userId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<SubjectAdminFieldDto>();
        try
        {
            var normalizedUserId = NormalizeUser(userId);
            if (normalizedUserId.Length == 0)
            {
                response.Errors.Add(new Error { Code = "401", Message = "المستخدم غير مصرح له." });
                return response;
            }

            var safeRequest = request ?? new SubjectAdminFieldUpsertRequestDto();
            var fieldKey = (safeRequest.FieldKey ?? string.Empty).Trim();
            var fieldType = (safeRequest.FieldType ?? string.Empty).Trim();
            if (fieldKey.Length == 0 || fieldType.Length == 0)
            {
                response.Errors.Add(new Error { Code = "400", Message = "مفتاح الحقل ونوع الحقل مطلوبان." });
                return response;
            }

            if (fieldKey.Length > FieldKeyMaxLength)
            {
                response.Errors.Add(new Error { Code = "400", Message = $"مفتاح الحقل يجب ألا يزيد عن {FieldKeyMaxLength} حرفًا." });
                return response;
            }

            if (fieldType.Length > FieldTypeMaxLength)
            {
                response.Errors.Add(new Error { Code = "400", Message = $"نوع الحقل يجب ألا يزيد عن {FieldTypeMaxLength} حرفًا." });
                return response;
            }

            var fieldLabel = NormalizeNullable(safeRequest.FieldLabel) ?? fieldKey;
            if (fieldLabel.Length > FieldLabelMaxLength)
            {
                response.Errors.Add(new Error { Code = "400", Message = $"وصف الحقل يجب ألا يزيد عن {FieldLabelMaxLength} حرفًا." });
                return response;
            }

            var dataType = NormalizeNullable(safeRequest.DataType);
            if (ExceedsMaxLength(dataType, FieldDataTypeMaxLength))
            {
                response.Errors.Add(new Error { Code = "400", Message = $"نوع البيانات يجب ألا يزيد عن {FieldDataTypeMaxLength} حرفًا." });
                return response;
            }

            var mask = NormalizeNullable(safeRequest.Mask);
            if (ExceedsMaxLength(mask, FieldMaskMaxLength))
            {
                response.Errors.Add(new Error { Code = "400", Message = $"قناع الإدخال يجب ألا يزيد عن {FieldMaskMaxLength} حرفًا." });
                return response;
            }

            var applicationId = NormalizeNullable(safeRequest.ApplicationId);
            if (ExceedsMaxLength(applicationId, ApplicationIdMaxLength))
            {
                response.Errors.Add(new Error { Code = "400", Message = $"معرف التطبيق يجب ألا يزيد عن {ApplicationIdMaxLength} أحرف." });
                return response;
            }

            if (safeRequest.Width < 0 || safeRequest.Height < 0)
            {
                response.Errors.Add(new Error { Code = "400", Message = "أبعاد الحقل يجب أن تكون صفرًا أو قيمًا موجبة." });
                return response;
            }

            var exists = await _connectContext.Cdmends
                .AsNoTracking()
                .AnyAsync(item => item.CdmendTxt == fieldKey, cancellationToken);
            if (exists)
            {
                response.Errors.Add(new Error { Code = "409", Message = "مفتاح الحقل موجود بالفعل." });
                return response;
            }

            var nextSql = safeRequest.CdmendSql.GetValueOrDefault();
            if (nextSql <= 0)
            {
                nextSql = (await _connectContext.Cdmends.MaxAsync(item => (int?)item.CdmendSql, cancellationToken) ?? 0) + 1;
            }
            else
            {
                var sqlExists = await _connectContext.Cdmends
                    .AsNoTracking()
                    .AnyAsync(item => item.CdmendSql == nextSql, cancellationToken);
                if (sqlExists)
                {
                    response.Errors.Add(new Error { Code = "409", Message = "رقم الحقل مستخدم بالفعل." });
                    return response;
                }
            }

            var field = new Cdmend
            {
                CdmendSql = nextSql,
                CdmendTxt = fieldKey,
                CdmendType = fieldType,
                CDMendLbl = fieldLabel,
                Placeholder = NormalizeNullable(safeRequest.Placeholder),
                DefaultValue = NormalizeNullable(safeRequest.DefaultValue),
                CdmendTbl = NormalizeNullable(safeRequest.OptionsPayload),
                CdmendDatatype = dataType,
                Required = safeRequest.Required,
                RequiredTrue = safeRequest.RequiredTrue,
                Email = safeRequest.Email,
                Pattern = safeRequest.Pattern,
                MinValue = NormalizeNullable(safeRequest.MinValue),
                MaxValue = NormalizeNullable(safeRequest.MaxValue),
                Cdmendmask = mask,
                CdmendStat = !safeRequest.IsActive,
                Width = safeRequest.Width,
                Height = safeRequest.Height,
                IsDisabledInit = safeRequest.IsDisabledInit,
                IsSearchable = safeRequest.IsSearchable,
                ApplicationId = applicationId
            };

            await _connectContext.Cdmends.AddAsync(field, cancellationToken);
            await _connectContext.SaveChangesAsync(cancellationToken);

            response.Data = MapAdminField(field, new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase));
        }
        catch (Exception)
        {
            AddUnhandledError(response);
        }

        return response;
    }

    public async Task<CommonResponse<SubjectAdminFieldDto>> UpdateAdminFieldAsync(
        string fieldKey,
        SubjectAdminFieldUpsertRequestDto request,
        string userId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<SubjectAdminFieldDto>();
        try
        {
            var normalizedUserId = NormalizeUser(userId);
            if (normalizedUserId.Length == 0)
            {
                response.Errors.Add(new Error { Code = "401", Message = "المستخدم غير مصرح له." });
                return response;
            }

            var oldFieldKey = (fieldKey ?? string.Empty).Trim();
            if (oldFieldKey.Length == 0)
            {
                response.Errors.Add(new Error { Code = "400", Message = "مفتاح الحقل مطلوب." });
                return response;
            }

            var field = await _connectContext.Cdmends
                .FirstOrDefaultAsync(item => item.CdmendTxt == oldFieldKey, cancellationToken);
            if (field == null)
            {
                response.Errors.Add(new Error { Code = "404", Message = "الحقل غير موجود." });
                return response;
            }

            var safeRequest = request ?? new SubjectAdminFieldUpsertRequestDto();
            var newFieldKey = (safeRequest.FieldKey ?? string.Empty).Trim();
            var fieldType = (safeRequest.FieldType ?? string.Empty).Trim();
            if (newFieldKey.Length == 0 || fieldType.Length == 0)
            {
                response.Errors.Add(new Error { Code = "400", Message = "مفتاح الحقل ونوع الحقل مطلوبان." });
                return response;
            }

            if (newFieldKey.Length > FieldKeyMaxLength)
            {
                response.Errors.Add(new Error { Code = "400", Message = $"مفتاح الحقل يجب ألا يزيد عن {FieldKeyMaxLength} حرفًا." });
                return response;
            }

            if (fieldType.Length > FieldTypeMaxLength)
            {
                response.Errors.Add(new Error { Code = "400", Message = $"نوع الحقل يجب ألا يزيد عن {FieldTypeMaxLength} حرفًا." });
                return response;
            }

            var fieldLabel = NormalizeNullable(safeRequest.FieldLabel) ?? newFieldKey;
            if (fieldLabel.Length > FieldLabelMaxLength)
            {
                response.Errors.Add(new Error { Code = "400", Message = $"وصف الحقل يجب ألا يزيد عن {FieldLabelMaxLength} حرفًا." });
                return response;
            }

            var dataType = NormalizeNullable(safeRequest.DataType);
            if (ExceedsMaxLength(dataType, FieldDataTypeMaxLength))
            {
                response.Errors.Add(new Error { Code = "400", Message = $"نوع البيانات يجب ألا يزيد عن {FieldDataTypeMaxLength} حرفًا." });
                return response;
            }

            var mask = NormalizeNullable(safeRequest.Mask);
            if (ExceedsMaxLength(mask, FieldMaskMaxLength))
            {
                response.Errors.Add(new Error { Code = "400", Message = $"قناع الإدخال يجب ألا يزيد عن {FieldMaskMaxLength} حرفًا." });
                return response;
            }

            var applicationId = NormalizeNullable(safeRequest.ApplicationId);
            if (ExceedsMaxLength(applicationId, ApplicationIdMaxLength))
            {
                response.Errors.Add(new Error { Code = "400", Message = $"معرف التطبيق يجب ألا يزيد عن {ApplicationIdMaxLength} أحرف." });
                return response;
            }

            if (safeRequest.Width < 0 || safeRequest.Height < 0)
            {
                response.Errors.Add(new Error { Code = "400", Message = "أبعاد الحقل يجب أن تكون صفرًا أو قيمًا موجبة." });
                return response;
            }

            if (!string.Equals(oldFieldKey, newFieldKey, StringComparison.OrdinalIgnoreCase))
            {
                var targetExists = await _connectContext.Cdmends
                    .AsNoTracking()
                    .AnyAsync(item => item.CdmendTxt == newFieldKey, cancellationToken);
                if (targetExists)
                {
                    response.Errors.Add(new Error { Code = "409", Message = "مفتاح الحقل الجديد موجود بالفعل." });
                    return response;
                }

                var linkedRows = await _connectContext.CdCategoryMands
                    .Where(item => item.MendField == oldFieldKey)
                    .ToListAsync(cancellationToken);
                foreach (var row in linkedRows)
                {
                    row.MendField = newFieldKey;
                }
            }

            field.CdmendTxt = newFieldKey;
            field.CdmendType = fieldType;
            field.CDMendLbl = fieldLabel;
            field.Placeholder = NormalizeNullable(safeRequest.Placeholder);
            field.DefaultValue = NormalizeNullable(safeRequest.DefaultValue);
            field.CdmendTbl = NormalizeNullable(safeRequest.OptionsPayload);
            field.CdmendDatatype = dataType;
            field.Required = safeRequest.Required;
            field.RequiredTrue = safeRequest.RequiredTrue;
            field.Email = safeRequest.Email;
            field.Pattern = safeRequest.Pattern;
            field.MinValue = NormalizeNullable(safeRequest.MinValue);
            field.MaxValue = NormalizeNullable(safeRequest.MaxValue);
            field.Cdmendmask = mask;
            field.CdmendStat = !safeRequest.IsActive;
            field.Width = safeRequest.Width;
            field.Height = safeRequest.Height;
            field.IsDisabledInit = safeRequest.IsDisabledInit;
            field.IsSearchable = safeRequest.IsSearchable;
            field.ApplicationId = applicationId;

            await _connectContext.SaveChangesAsync(cancellationToken);

            var linkedCount = await _connectContext.CdCategoryMands
                .AsNoTracking()
                .Where(item => item.MendField == newFieldKey && !item.MendStat)
                .Select(item => item.MendCategory)
                .Distinct()
                .CountAsync(cancellationToken);

            response.Data = MapAdminField(
                field,
                new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase)
                {
                    [newFieldKey] = linkedCount
                });
        }
        catch (Exception)
        {
            AddUnhandledError(response);
        }

        return response;
    }

    public async Task<CommonResponse<bool>> DeleteAdminFieldAsync(
        string fieldKey,
        string userId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<bool>();
        try
        {
            var normalizedUserId = NormalizeUser(userId);
            if (normalizedUserId.Length == 0)
            {
                response.Errors.Add(new Error { Code = "401", Message = "المستخدم غير مصرح له." });
                return response;
            }

            var key = (fieldKey ?? string.Empty).Trim();
            if (key.Length == 0)
            {
                response.Errors.Add(new Error { Code = "400", Message = "مفتاح الحقل مطلوب." });
                return response;
            }

            var field = await _connectContext.Cdmends
                .FirstOrDefaultAsync(item => item.CdmendTxt == key, cancellationToken);
            if (field == null)
            {
                response.Errors.Add(new Error { Code = "404", Message = "الحقل غير موجود." });
                return response;
            }

            var hasLinks = await _connectContext.CdCategoryMands
                .AsNoTracking()
                .AnyAsync(item => item.MendField == key, cancellationToken);
            if (hasLinks)
            {
                field.CdmendStat = true;
                await _connectContext.SaveChangesAsync(cancellationToken);
                response.Data = true;
                return response;
            }

            _connectContext.Cdmends.Remove(field);
            await _connectContext.SaveChangesAsync(cancellationToken);
            response.Data = true;
        }
        catch (Exception)
        {
            AddUnhandledError(response);
        }

        return response;
    }

    public async Task<CommonResponse<IEnumerable<SubjectAdminGroupDto>>> GetAdminGroupsAsync(
        string userId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<IEnumerable<SubjectAdminGroupDto>>();
        try
        {
            var normalizedUserId = NormalizeUser(userId);
            if (normalizedUserId.Length == 0)
            {
                response.Errors.Add(new Error { Code = "401", Message = "المستخدم غير مصرح له." });
                return response;
            }

            var groups = await _connectContext.MandGroups
                .AsNoTracking()
                .OrderBy(item => item.GroupId)
                .ToListAsync(cancellationToken);

            var linkedCounts = await _connectContext.CdCategoryMands
                .AsNoTracking()
                .Where(item => !item.MendStat)
                .GroupBy(item => item.MendGroup)
                .Select(group => new
                {
                    GroupId = group.Key,
                    Count = group.Count()
                })
                .ToDictionaryAsync(item => item.GroupId, item => item.Count, cancellationToken);

            response.Data = groups.Select(group => new SubjectAdminGroupDto
            {
                GroupId = group.GroupId,
                GroupName = group.GroupName,
                GroupDescription = group.GroupDescription,
                IsExtendable = group.IsExtendable == true,
                GroupWithInRow = group.GroupWithInRow,
                LinkedFieldsCount = linkedCounts.TryGetValue(group.GroupId, out var count) ? count : 0
            }).ToList();
        }
        catch (Exception)
        {
            AddUnhandledError(response);
        }

        return response;
    }

    public async Task<CommonResponse<SubjectAdminGroupDto>> CreateAdminGroupAsync(
        SubjectAdminGroupUpsertRequestDto request,
        string userId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<SubjectAdminGroupDto>();
        try
        {
            var normalizedUserId = NormalizeUser(userId);
            if (normalizedUserId.Length == 0)
            {
                response.Errors.Add(new Error { Code = "401", Message = "المستخدم غير مصرح له." });
                return response;
            }

            var safeRequest = request ?? new SubjectAdminGroupUpsertRequestDto();
            var groupName = NormalizeNullable(safeRequest.GroupName);
            if (groupName == null)
            {
                response.Errors.Add(new Error { Code = "400", Message = "اسم المجموعة مطلوب." });
                return response;
            }

            if (groupName.Length > GroupNameMaxLength)
            {
                response.Errors.Add(new Error { Code = "400", Message = $"اسم المجموعة يجب ألا يزيد عن {GroupNameMaxLength} حرفًا." });
                return response;
            }

            var groupDescription = NormalizeNullable(safeRequest.GroupDescription);
            if (ExceedsMaxLength(groupDescription, GroupDescriptionMaxLength))
            {
                response.Errors.Add(new Error { Code = "400", Message = $"وصف المجموعة يجب ألا يزيد عن {GroupDescriptionMaxLength} حرفًا." });
                return response;
            }

            var groupWithInRow = safeRequest.GroupWithInRow.GetValueOrDefault(1);
            if (groupWithInRow <= 0 || groupWithInRow > GroupWithInRowMaxValue)
            {
                response.Errors.Add(new Error
                {
                    Code = "400",
                    Message = $"عدد العناصر داخل الصف يجب أن يكون بين 1 و {GroupWithInRowMaxValue}."
                });
                return response;
            }

            var duplicateNameExists = await _connectContext.MandGroups
                .AsNoTracking()
                .AnyAsync(item => item.GroupName == groupName, cancellationToken);
            if (duplicateNameExists)
            {
                response.Errors.Add(new Error { Code = "409", Message = "اسم المجموعة موجود بالفعل." });
                return response;
            }

            var nextId = (await _connectContext.MandGroups
                .AsNoTracking()
                .MaxAsync(item => (int?)item.GroupId, cancellationToken) ?? 0) + 1;

            var group = new MandGroup
            {
                GroupId = nextId,
                GroupName = groupName,
                GroupDescription = groupDescription,
                IsExtendable = safeRequest.IsExtendable,
                GroupWithInRow = groupWithInRow
            };

            await _connectContext.MandGroups.AddAsync(group, cancellationToken);
            await _connectContext.SaveChangesAsync(cancellationToken);

            response.Data = new SubjectAdminGroupDto
            {
                GroupId = group.GroupId,
                GroupName = group.GroupName,
                GroupDescription = group.GroupDescription,
                IsExtendable = group.IsExtendable == true,
                GroupWithInRow = group.GroupWithInRow,
                LinkedFieldsCount = 0
            };
        }
        catch (Exception)
        {
            AddUnhandledError(response);
        }

        return response;
    }

    public async Task<CommonResponse<SubjectAdminGroupDto>> UpdateAdminGroupAsync(
        int groupId,
        SubjectAdminGroupUpsertRequestDto request,
        string userId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<SubjectAdminGroupDto>();
        try
        {
            var normalizedUserId = NormalizeUser(userId);
            if (normalizedUserId.Length == 0)
            {
                response.Errors.Add(new Error { Code = "401", Message = "المستخدم غير مصرح له." });
                return response;
            }

            var group = await _connectContext.MandGroups
                .FirstOrDefaultAsync(item => item.GroupId == groupId, cancellationToken);
            if (group == null)
            {
                response.Errors.Add(new Error { Code = "404", Message = "المجموعة غير موجودة." });
                return response;
            }

            var safeRequest = request ?? new SubjectAdminGroupUpsertRequestDto();
            var groupName = NormalizeNullable(safeRequest.GroupName);
            if (groupName == null)
            {
                response.Errors.Add(new Error { Code = "400", Message = "اسم المجموعة مطلوب." });
                return response;
            }

            if (groupName.Length > GroupNameMaxLength)
            {
                response.Errors.Add(new Error { Code = "400", Message = $"اسم المجموعة يجب ألا يزيد عن {GroupNameMaxLength} حرفًا." });
                return response;
            }

            var groupDescription = NormalizeNullable(safeRequest.GroupDescription);
            if (ExceedsMaxLength(groupDescription, GroupDescriptionMaxLength))
            {
                response.Errors.Add(new Error { Code = "400", Message = $"وصف المجموعة يجب ألا يزيد عن {GroupDescriptionMaxLength} حرفًا." });
                return response;
            }

            var groupWithInRow = safeRequest.GroupWithInRow.GetValueOrDefault(1);
            if (groupWithInRow <= 0 || groupWithInRow > GroupWithInRowMaxValue)
            {
                response.Errors.Add(new Error
                {
                    Code = "400",
                    Message = $"عدد العناصر داخل الصف يجب أن يكون بين 1 و {GroupWithInRowMaxValue}."
                });
                return response;
            }

            var duplicateNameExists = await _connectContext.MandGroups
                .AsNoTracking()
                .AnyAsync(item => item.GroupId != groupId && item.GroupName == groupName, cancellationToken);
            if (duplicateNameExists)
            {
                response.Errors.Add(new Error { Code = "409", Message = "اسم المجموعة موجود بالفعل." });
                return response;
            }

            group.GroupName = groupName;
            group.GroupDescription = groupDescription;
            group.IsExtendable = safeRequest.IsExtendable;
            group.GroupWithInRow = groupWithInRow;

            await _connectContext.SaveChangesAsync(cancellationToken);

            var linkedFieldsCount = await _connectContext.CdCategoryMands
                .AsNoTracking()
                .Where(item => item.MendGroup == groupId && !item.MendStat)
                .CountAsync(cancellationToken);

            response.Data = new SubjectAdminGroupDto
            {
                GroupId = group.GroupId,
                GroupName = group.GroupName,
                GroupDescription = group.GroupDescription,
                IsExtendable = group.IsExtendable == true,
                GroupWithInRow = group.GroupWithInRow,
                LinkedFieldsCount = linkedFieldsCount
            };
        }
        catch (Exception)
        {
            AddUnhandledError(response);
        }

        return response;
    }

    public async Task<CommonResponse<bool>> DeleteAdminGroupAsync(
        int groupId,
        string userId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<bool>();
        try
        {
            var normalizedUserId = NormalizeUser(userId);
            if (normalizedUserId.Length == 0)
            {
                response.Errors.Add(new Error { Code = "401", Message = "المستخدم غير مصرح له." });
                return response;
            }

            var group = await _connectContext.MandGroups
                .FirstOrDefaultAsync(item => item.GroupId == groupId, cancellationToken);
            if (group == null)
            {
                response.Errors.Add(new Error { Code = "404", Message = "المجموعة غير موجودة." });
                return response;
            }

            var hasLinks = await _connectContext.CdCategoryMands
                .AsNoTracking()
                .AnyAsync(item => item.MendGroup == groupId && !item.MendStat, cancellationToken);
            if (hasLinks)
            {
                response.Errors.Add(new Error { Code = "400", Message = "المجموعة مرتبطة بحقول فعالة ولا يمكن حذفها." });
                return response;
            }

            _connectContext.MandGroups.Remove(group);
            await _connectContext.SaveChangesAsync(cancellationToken);
            response.Data = true;
        }
        catch (Exception)
        {
            AddUnhandledError(response);
        }

        return response;
    }

    public async Task<CommonResponse<IEnumerable<SubjectCategoryFieldLinkAdminDto>>> GetAdminCategoryFieldLinksAsync(
        int categoryId,
        string userId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<IEnumerable<SubjectCategoryFieldLinkAdminDto>>();
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
                response.Errors.Add(new Error { Code = "400", Message = "النوع مطلوب." });
                return response;
            }

            var category = await _connectContext.Cdcategories
                .AsNoTracking()
                .FirstOrDefaultAsync(item => item.CatId == categoryId, cancellationToken);
            if (category == null)
            {
                response.Errors.Add(new Error { Code = "404", Message = "النوع غير موجود." });
                return response;
            }

            response.Data = await LoadAdminCategoryFieldLinksAsync(categoryId, cancellationToken);
        }
        catch (Exception)
        {
            AddUnhandledError(response);
        }

        return response;
    }

    public async Task<CommonResponse<IEnumerable<SubjectCategoryFieldLinkAdminDto>>> UpsertAdminCategoryFieldLinksAsync(
        int categoryId,
        SubjectCategoryFieldLinksUpsertRequestDto request,
        string userId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<IEnumerable<SubjectCategoryFieldLinkAdminDto>>();
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
                response.Errors.Add(new Error { Code = "400", Message = "النوع مطلوب." });
                return response;
            }

            var category = await _connectContext.Cdcategories
                .FirstOrDefaultAsync(item => item.CatId == categoryId, cancellationToken);
            if (category == null)
            {
                response.Errors.Add(new Error { Code = "404", Message = "النوع غير موجود." });
                return response;
            }

            var safeItems = (request?.Links ?? new List<SubjectCategoryFieldLinkUpsertItemDto>())
                .Where(item => !string.IsNullOrWhiteSpace(item.FieldKey) && item.GroupId > 0)
                .Select(item => new SubjectCategoryFieldLinkUpsertItemDto
                {
                    MendSql = item.MendSql,
                    FieldKey = (item.FieldKey ?? string.Empty).Trim(),
                    GroupId = item.GroupId,
                    IsActive = item.IsActive,
                    DisplayOrder = item.DisplayOrder <= 0 ? 1 : item.DisplayOrder,
                    IsVisible = item.IsVisible,
                    DisplaySettingsJson = NormalizeNullable(item.DisplaySettingsJson)
                })
                .ToList();

            var duplicatedField = safeItems
                .GroupBy(item => item.FieldKey, StringComparer.OrdinalIgnoreCase)
                .FirstOrDefault(group => group.Count() > 1)?
                .Key;
            if (!string.IsNullOrWhiteSpace(duplicatedField))
            {
                response.Errors.Add(new Error { Code = "400", Message = $"الحقل '{duplicatedField}' مكرر داخل نفس النوع." });
                return response;
            }

            var requestedFieldKeys = safeItems
                .Select(item => item.FieldKey)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
            var existingFields = await _connectContext.Cdmends
                .AsNoTracking()
                .Where(item => requestedFieldKeys.Contains(item.CdmendTxt) && !item.CdmendStat)
                .Select(item => new { item.CdmendTxt, item.ApplicationId })
                .ToListAsync(cancellationToken);
            var existingFieldsSet = existingFields
                .Select(item => item.CdmendTxt)
                .ToHashSet(StringComparer.OrdinalIgnoreCase);
            var missingField = requestedFieldKeys.FirstOrDefault(key => !existingFieldsSet.Contains(key));
            if (!string.IsNullOrWhiteSpace(missingField))
            {
                response.Errors.Add(new Error { Code = "400", Message = $"الحقل '{missingField}' غير موجود أو غير مفعل." });
                return response;
            }

            var categoryApplicationId = NormalizeNullable(category.ApplicationId);
            if (categoryApplicationId != null)
            {
                var incompatibleField = existingFields.FirstOrDefault(field =>
                {
                    var fieldApplicationId = NormalizeNullable(field.ApplicationId);
                    return fieldApplicationId != null && !EqualsNormalized(fieldApplicationId, categoryApplicationId);
                });

                if (incompatibleField != null)
                {
                    response.Errors.Add(new Error
                    {
                        Code = "400",
                        Message = $"الحقل '{incompatibleField.CdmendTxt}' يتبع تطبيقًا مختلفًا عن النوع الحالي."
                    });
                    return response;
                }
            }

            var requestedGroupIds = safeItems
                .Select(item => item.GroupId)
                .Distinct()
                .ToList();
            var existingGroups = await _connectContext.MandGroups
                .AsNoTracking()
                .Where(item => requestedGroupIds.Contains(item.GroupId))
                .Select(item => item.GroupId)
                .ToListAsync(cancellationToken);
            var existingGroupsSet = existingGroups.ToHashSet();
            var missingGroup = requestedGroupIds.FirstOrDefault(groupId => !existingGroupsSet.Contains(groupId));
            if (missingGroup > 0)
            {
                response.Errors.Add(new Error { Code = "400", Message = $"المجموعة '{missingGroup}' غير موجودة." });
                return response;
            }

            var existingLinks = await _connectContext.CdCategoryMands
                .Where(item => item.MendCategory == categoryId)
                .ToListAsync(cancellationToken);

            int? nextGeneratedMendSql = null;

            async Task<int> AllocateMendSqlAsync()
            {
                if (!nextGeneratedMendSql.HasValue)
                {
                    nextGeneratedMendSql = await _connectContext.CdCategoryMands
                        .AsNoTracking()
                        .Select(item => (int?)item.MendSql)
                        .MaxAsync(cancellationToken) ?? 0;
                }

                nextGeneratedMendSql += 1;
                return nextGeneratedMendSql.Value;
            }

            foreach (var item in safeItems)
            {
                CdCategoryMand? link = null;
                if (item.MendSql.HasValue && item.MendSql.Value > 0)
                {
                    link = existingLinks.FirstOrDefault(existing => existing.MendSql == item.MendSql.Value);
                }

                if (link == null)
                {
                    link = existingLinks.FirstOrDefault(existing =>
                        string.Equals(existing.MendField, item.FieldKey, StringComparison.OrdinalIgnoreCase));
                }

                if (link == null)
                {
                    link = new CdCategoryMand
                    {
                        MendSql = await AllocateMendSqlAsync(),
                        MendCategory = categoryId,
                        MendField = item.FieldKey,
                        MendGroup = item.GroupId,
                        MendStat = !item.IsActive
                    };
                    await _connectContext.CdCategoryMands.AddAsync(link, cancellationToken);
                    existingLinks.Add(link);
                }
                else
                {
                    link.MendField = item.FieldKey;
                    link.MendGroup = item.GroupId;
                    link.MendStat = !item.IsActive;
                }

            }

            await _connectContext.SaveChangesAsync(cancellationToken);

            foreach (var item in safeItems)
            {
                CdCategoryMand? link = null;
                if (item.MendSql.HasValue && item.MendSql.Value > 0)
                {
                    link = existingLinks.FirstOrDefault(existing => existing.MendSql == item.MendSql.Value);
                }

                if (link == null)
                {
                    link = existingLinks.FirstOrDefault(existing =>
                        string.Equals(existing.MendField, item.FieldKey, StringComparison.OrdinalIgnoreCase)
                        && existing.MendGroup == item.GroupId);
                }

                if (link == null || link.MendSql <= 0)
                {
                    continue;
                }

                var setting = await _connectContext.SubjectCategoryFieldSettings
                    .FirstOrDefaultAsync(s => s.MendSql == link.MendSql, cancellationToken);
                if (setting == null)
                {
                    setting = new SubjectCategoryFieldSetting
                    {
                        MendSql = link.MendSql,
                        DisplayOrder = item.DisplayOrder,
                        IsVisible = item.IsVisible,
                        DisplaySettingsJson = NormalizeNullable(item.DisplaySettingsJson),
                        LastModifiedBy = normalizedUserId,
                        LastModifiedAtUtc = DateTime.UtcNow
                    };
                    await _connectContext.SubjectCategoryFieldSettings.AddAsync(setting, cancellationToken);
                }
                else
                {
                    setting.DisplayOrder = item.DisplayOrder;
                    setting.IsVisible = item.IsVisible;
                    setting.DisplaySettingsJson = NormalizeNullable(item.DisplaySettingsJson);
                    setting.LastModifiedBy = normalizedUserId;
                    setting.LastModifiedAtUtc = DateTime.UtcNow;
                }
            }

            foreach (var existing in existingLinks.Where(link => !safeItems.Any(item =>
                (item.MendSql.HasValue && item.MendSql.Value == link.MendSql)
                || (!item.MendSql.HasValue && string.Equals(item.FieldKey, link.MendField, StringComparison.OrdinalIgnoreCase)))))
            {
                existing.MendStat = true;

                var hiddenSetting = await _connectContext.SubjectCategoryFieldSettings
                    .FirstOrDefaultAsync(s => s.MendSql == existing.MendSql, cancellationToken);
                if (hiddenSetting != null)
                {
                    hiddenSetting.IsVisible = false;
                    hiddenSetting.LastModifiedBy = normalizedUserId;
                    hiddenSetting.LastModifiedAtUtc = DateTime.UtcNow;
                }
            }

            await _connectContext.SaveChangesAsync(cancellationToken);

            response.Data = await LoadAdminCategoryFieldLinksAsync(categoryId, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger?.LogError(ex, "Failed to upsert admin category field links for category {CategoryId}.", categoryId);
            AddUnhandledError(response);
        }

        return response;
    }

    public Task<CommonResponse<SubjectFormDefinitionDto>> GetAdminPreviewAsync(
        int categoryId,
        string userId,
        string? appId,
        CancellationToken cancellationToken = default)
    {
        if (categoryId <= 0)
        {
            var invalidResponse = new CommonResponse<SubjectFormDefinitionDto>();
            invalidResponse.Errors.Add(new Error { Code = "400", Message = "النوع مطلوب." });
            return Task.FromResult(invalidResponse);
        }

        return BuildFormDefinitionAsync(categoryId, userId, appId, allowInactiveCategory: true, cancellationToken);
    }

    public async Task<CommonResponse<SubjectAdminPreviewWorkspaceDto>> GetAdminPreviewWorkspaceAsync(
        int categoryId,
        string userId,
        string? appId,
        string? documentDirection,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<SubjectAdminPreviewWorkspaceDto>();
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
                response.Errors.Add(new Error { Code = "400", Message = "النوع مطلوب." });
                return response;
            }

            var category = await _connectContext.Cdcategories
                .AsNoTracking()
                .FirstOrDefaultAsync(item => item.CatId == categoryId, cancellationToken);
            if (category == null)
            {
                response.Errors.Add(new Error { Code = "404", Message = "النوع غير موجود." });
                return response;
            }

            var normalizedAppId = NormalizeNullable(appId);
            var normalizedCategoryAppId = NormalizeNullable(category.ApplicationId);
            if (normalizedAppId != null
                && normalizedCategoryAppId != null
                && !EqualsNormalized(normalizedAppId, normalizedCategoryAppId))
            {
                response.Errors.Add(new Error { Code = "404", Message = "النوع خارج نطاق التطبيق المطلوب." });
                return response;
            }

            var hasDynamicFields = await _connectContext.CdCategoryMands
                .AsNoTracking()
                .AnyAsync(item => item.MendCategory == categoryId && !item.MendStat, cancellationToken);

            var policy = await _connectContext.SubjectReferencePolicies
                .AsNoTracking()
                .FirstOrDefaultAsync(item => item.CategoryId == categoryId, cancellationToken);

            var setting = await _connectContext.SubjectTypeAdminSettings
                .AsNoTracking()
                .FirstOrDefaultAsync(item => item.CategoryId == categoryId, cancellationToken);
            var requestPolicy = TryReadRequestPolicyFromSettingsJson(setting?.SettingsJson);
            var directionLifecycle = ResolveDirectionLifecycleFromSettingsJson(
                setting?.SettingsJson,
                fallbackIsPublished: !category.CatStatus);
            var requestedDirection = NormalizeDirectionKey(documentDirection);

            var links = await LoadAdminCategoryFieldLinksAsync(categoryId, cancellationToken);
            var definitionResponse = await BuildFormDefinitionAsync(
                categoryId,
                normalizedUserId,
                appId,
                allowInactiveCategory: true,
                cancellationToken);

            if (definitionResponse.Errors?.Count > 0)
            {
                foreach (var error in definitionResponse.Errors)
                {
                    response.Errors.Add(error);
                }

                return response;
            }

            var definition = definitionResponse.Data ?? new SubjectFormDefinitionDto
            {
                CategoryId = category.CatId,
                CategoryName = category.CatName,
                ParentCategoryId = category.CatParent,
                ApplicationId = category.ApplicationId,
                Groups = new List<SubjectGroupDefinitionDto>(),
                Fields = new List<SubjectFieldDefinitionDto>()
            };

            var directions = new List<string>(DefaultRequestDirections);
            if (requestedDirection != null
                && !directions.Contains(requestedDirection, StringComparer.OrdinalIgnoreCase))
            {
                directions.Add(requestedDirection);
            }

            var directionalReadiness = directions
                .Select(direction =>
                {
                    directionLifecycle.TryGetValue(direction, out var directionState);
                    return new SubjectAdminDirectionalReadinessDto
                    {
                        Direction = direction,
                        IsPublished = directionState?.IsPublished ?? !category.CatStatus,
                        LastChangedAtUtc = directionState?.LastChangedAtUtc,
                        LastChangedBy = directionState?.LastChangedBy,
                        Readiness = BuildPreviewWorkspaceReadiness(category, links, definition, requestPolicy, direction)
                    };
                })
                .ToList();

            var activeDirection = requestedDirection ?? directions.FirstOrDefault();
            var primaryReadiness = activeDirection == null
                ? BuildPreviewWorkspaceReadiness(category, links, definition, requestPolicy, null)
                : directionalReadiness
                    .FirstOrDefault(item => string.Equals(item.Direction, activeDirection, StringComparison.OrdinalIgnoreCase))
                    ?.Readiness
                    ?? BuildPreviewWorkspaceReadiness(category, links, definition, requestPolicy, activeDirection);

            response.Data = new SubjectAdminPreviewWorkspaceDto
            {
                CategoryId = category.CatId,
                CategoryName = category.CatName,
                ParentCategoryId = category.CatParent,
                ApplicationId = category.ApplicationId,
                SubjectType = BuildSubjectTypeAdminDto(category, hasDynamicFields, policy, setting),
                FormDefinition = definition,
                FieldLinks = links,
                Readiness = primaryReadiness,
                ActiveDirection = activeDirection,
                DirectionalReadiness = directionalReadiness,
                AllDirectionsReady = directionalReadiness.Count == 0 || directionalReadiness.All(item => item.Readiness.IsReady),
                GeneratedAtUtc = DateTime.UtcNow
            };
        }
        catch (Exception)
        {
            AddUnhandledError(response);
        }

        return response;
    }

    private static SubjectAdminPreviewReadinessDto BuildPreviewWorkspaceReadiness(
        Cdcategory category,
        IReadOnlyCollection<SubjectCategoryFieldLinkAdminDto> links,
        SubjectFormDefinitionDto definition,
        RequestPolicyDefinitionDto? requestPolicy,
        string? documentDirection)
    {
        var policyContext = BuildPolicyContext(documentDirection);
        var issues = new List<SubjectAdminPreviewIssueDto>();
        var issueDedup = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        static string BuildIssueKey(SubjectAdminPreviewIssueDto issue)
        {
            return string.Join("|",
                issue.Code ?? string.Empty,
                issue.Severity ?? string.Empty,
                issue.FieldKey ?? string.Empty,
                issue.GroupId?.ToString(CultureInfo.InvariantCulture) ?? string.Empty,
                issue.Message ?? string.Empty);
        }
        void AddIssue(SubjectAdminPreviewIssueDto issue)
        {
            var key = BuildIssueKey(issue);
            if (issueDedup.Add(key))
            {
                issues.Add(issue);
            }
        }

        var normalizedLinks = links?.ToList() ?? new List<SubjectCategoryFieldLinkAdminDto>();
        var activeLinks = normalizedLinks.Where(item => item.IsActive).ToList();
        var definitionFields = (definition?.Fields ?? new List<SubjectFieldDefinitionDto>()).ToList();
        var definitionByMendSqlAll = definitionFields
            .GroupBy(item => item.MendSql)
            .ToDictionary(group => group.Key, group => group.First());

        var renderableFields = definitionFields
            .Where(item => ResolveEffectiveVisibility(item, requestPolicy, policyContext))
            .ToList();

        if (category.CatStatus)
        {
            AddIssue(new SubjectAdminPreviewIssueDto
            {
                Code = "CATEGORY_INACTIVE",
                Severity = "Warning",
                Message = "النوع الحالي غير مفعل. يمكن المعاينة إداريًا لكن لن يظهر للمستخدم النهائي حتى يتم تفعيله."
            });
        }

        if (!string.IsNullOrWhiteSpace(documentDirection))
        {
            AddIssue(new SubjectAdminPreviewIssueDto
            {
                Code = "DIRECTION_CONTEXT",
                Severity = "Info",
                Message = $"تم تقييم readiness في سياق الاتجاه: {documentDirection}."
            });
        }

        if (activeLinks.Count == 0)
        {
            AddIssue(new SubjectAdminPreviewIssueDto
            {
                Code = "NO_ACTIVE_LINKS",
                Severity = "Error",
                Message = "لا توجد روابط حقول فعالة لهذا النوع."
            });
        }

        var visibleActiveLinks = new List<SubjectCategoryFieldLinkAdminDto>();
        foreach (var link in activeLinks.Where(item => item.IsVisible))
        {
            if (!definitionByMendSqlAll.TryGetValue(link.MendSql, out var fieldByLink))
            {
                visibleActiveLinks.Add(link);
                continue;
            }

            if (ResolveEffectiveVisibility(fieldByLink, requestPolicy, policyContext))
            {
                visibleActiveLinks.Add(link);
            }
        }

        var distinctVisibleActiveLinks = visibleActiveLinks
            .GroupBy(item =>
            {
                if (item.MendSql > 0)
                {
                    return $"m:{item.MendSql}";
                }

                return $"f:{NormalizeFieldKey(item.FieldKey)}";
            })
            .Select(group => group.First())
            .ToList();

        if (distinctVisibleActiveLinks.Count == 0)
        {
            AddIssue(new SubjectAdminPreviewIssueDto
            {
                Code = "NO_VISIBLE_FIELDS",
                Severity = "Error",
                Message = "لا توجد حقول مرئية بعد تطبيق إعدادات العرض."
            });
        }

        if (renderableFields.Count == 0)
        {
            AddIssue(new SubjectAdminPreviewIssueDto
            {
                Code = "NO_RENDERABLE_FIELDS",
                Severity = "Error",
                Message = "تعريف المعاينة لا يحتوي على حقول قابلة للعرض."
            });
        }

        var missingDefinitionCount = 0;
        var missingBindingsCount = 0;
        var invalidDisplaySettingsCount = 0;

        foreach (var link in distinctVisibleActiveLinks)
        {
            if (!definitionByMendSqlAll.TryGetValue(link.MendSql, out var field))
            {
                missingDefinitionCount++;
                AddIssue(new SubjectAdminPreviewIssueDto
                {
                    Code = "MISSING_FIELD_DEFINITION",
                    Severity = "Error",
                    Message = $"الحقل '{link.FieldKey}' مرتبط لكنه غير موجود في تعريف المعاينة.",
                    FieldKey = link.FieldKey,
                    GroupId = link.GroupId
                });
                continue;
            }

            if (!ResolveEffectiveVisibility(field, requestPolicy, policyContext))
            {
                continue;
            }

            if (!TryReadBindingFromDisplaySettings(field.DisplaySettingsJson, out var hasBinding, out var isDisplaySettingsJsonInvalid))
            {
                isDisplaySettingsJsonInvalid = true;
                hasBinding = false;
            }

            if (isDisplaySettingsJsonInvalid)
            {
                invalidDisplaySettingsCount++;
                AddIssue(new SubjectAdminPreviewIssueDto
                {
                    Code = "INVALID_DISPLAY_SETTINGS",
                    Severity = "Warning",
                    Message = $"إعدادات العرض للحقل '{field.FieldKey}' ليست JSON صالحًا.",
                    FieldKey = field.FieldKey,
                    GroupId = field.MendGroup
                });
            }

            var hasInlineOptions = !string.IsNullOrWhiteSpace(field.OptionsPayload);
            if (RequiresOptionsBinding(field.FieldType) && !hasInlineOptions && !hasBinding)
            {
                missingBindingsCount++;
                AddIssue(new SubjectAdminPreviewIssueDto
                {
                    Code = "MISSING_OPTIONS_BINDING",
                    Severity = "Error",
                    Message = $"الحقل '{field.FieldKey}' يحتاج مصدر خيارات (Options/Binding) ولم يتم توفيره.",
                    FieldKey = field.FieldKey,
                    GroupId = field.MendGroup
                });
            }
        }

        AppendWorkflowReadinessIssues(
            AddIssue,
            requestPolicy,
            renderableFields,
            documentDirection);

        var readiness = new SubjectAdminPreviewReadinessDto
        {
            LinkedFieldsCount = normalizedLinks.Count,
            ActiveLinkedFieldsCount = activeLinks.Count,
            VisibleLinkedFieldsCount = distinctVisibleActiveLinks.Count,
            RenderableFieldsCount = renderableFields.Count,
            MissingDefinitionCount = missingDefinitionCount,
            MissingBindingsCount = missingBindingsCount,
            InvalidDisplaySettingsCount = invalidDisplaySettingsCount,
            Issues = issues
        };
        readiness.IsReady = !issues.Any(item => string.Equals(item.Severity, "Error", StringComparison.OrdinalIgnoreCase));
        return readiness;
    }

    private static IReadOnlyDictionary<string, string?> BuildPolicyContext(string? documentDirection)
    {
        var map = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);
        var normalizedDirection = NormalizeDirectionKey(documentDirection);
        if (normalizedDirection != null)
        {
            map["documentDirection"] = normalizedDirection;
        }

        return map;
    }

    private static bool ResolveEffectiveVisibility(
        SubjectFieldDefinitionDto field,
        RequestPolicyDefinitionDto? policy,
        IReadOnlyDictionary<string, string?> context)
    {
        var baseVisible = field?.IsVisible ?? false;
        if (field == null)
        {
            return false;
        }

        if (policy == null)
        {
            return baseVisible;
        }

        var resolvedPatch = RequestPolicyResolver.ResolvePresentationMetadata(field.FieldKey, policy, context);
        return resolvedPatch?.Visible ?? baseVisible;
    }

    private static void AppendWorkflowReadinessIssues(
        Action<SubjectAdminPreviewIssueDto> addIssue,
        RequestPolicyDefinitionDto? requestPolicy,
        IReadOnlyCollection<SubjectFieldDefinitionDto> renderableFields,
        string? documentDirection)
    {
        if (requestPolicy == null)
        {
            return;
        }

        void AddWorkflowIssue(string code, string message)
        {
            addIssue(new SubjectAdminPreviewIssueDto
            {
                Code = code,
                Severity = "Error",
                Message = message
            });
        }

        var resolvedWorkflow = RequestPolicyResolver.ResolveWorkflowPolicy(requestPolicy);
        var workflowMode = (resolvedWorkflow.Mode ?? "manual").Trim().ToLowerInvariant();
        var staticTargets = resolvedWorkflow.StaticTargetUnitIds ?? new List<string>();
        var defaultTarget = NormalizeNullable(resolvedWorkflow.DefaultTargetUnitId);
        var manualTargetFieldKey = NormalizeFieldKey(resolvedWorkflow.ManualTargetFieldKey);
        var allowManual = resolvedWorkflow.AllowManualSelection;

        if (workflowMode == "static" && staticTargets.Count == 0 && defaultTarget == null)
        {
            AddWorkflowIssue(
                "WORKFLOW_STATIC_TARGET_MISSING",
                "Workflow static يتطلب جهة توجيه ثابتة (StaticTargetUnitIds أو DefaultTargetUnitId).");
        }

        if (workflowMode == "manual" && !allowManual && defaultTarget == null)
        {
            AddWorkflowIssue(
                "WORKFLOW_MANUAL_DEFAULT_TARGET_MISSING",
                "Workflow manual بدون اختيار يدوي يتطلب DefaultTargetUnitId.");
        }

        if (workflowMode == "hybrid" && !allowManual && staticTargets.Count == 0 && defaultTarget == null)
        {
            AddWorkflowIssue(
                "WORKFLOW_HYBRID_FALLBACK_TARGET_MISSING",
                "Workflow hybrid بدون اختيار يدوي يتطلب جهة fallback ثابتة.");
        }

        if ((workflowMode == "manual" || workflowMode == "hybrid")
            && allowManual
            && manualTargetFieldKey.Length > 0)
        {
            var hasManualTargetField = (renderableFields ?? Array.Empty<SubjectFieldDefinitionDto>())
                .Any(field => string.Equals(
                    NormalizeFieldKey(field.FieldKey),
                    manualTargetFieldKey,
                    StringComparison.Ordinal));
            if (!hasManualTargetField)
            {
                AddWorkflowIssue(
                    "WORKFLOW_MANUAL_TARGET_FIELD_NOT_RENDERABLE",
                    $"حقل اختيار جهة التوجيه اليدوي '{resolvedWorkflow.ManualTargetFieldKey}' غير ظاهر في المعاينة الحالية"
                    + (string.IsNullOrWhiteSpace(documentDirection) ? "." : $" للاتجاه {documentDirection}."));
            }
        }
    }

    private static bool RequiresOptionsBinding(string? fieldType)
    {
        var normalized = (fieldType ?? string.Empty).Trim().ToLowerInvariant();
        return normalized.Contains("dropdown")
            || normalized.Contains("select")
            || normalized.Contains("combo")
            || normalized.Contains("radio")
            || normalized.Contains("tree");
    }

    private static bool TryReadBindingFromDisplaySettings(
        string? displaySettingsJson,
        out bool hasBinding,
        out bool isInvalidJson)
    {
        hasBinding = false;
        isInvalidJson = false;

        var payload = (displaySettingsJson ?? string.Empty).Trim();
        if (payload.Length == 0)
        {
            return true;
        }

        try
        {
            using var document = JsonDocument.Parse(payload);
            var root = document.RootElement;
            if (root.ValueKind != JsonValueKind.Object)
            {
                return true;
            }

            hasBinding = root.EnumerateObject().Any(property =>
            {
                var key = property.Name;
                if (!(key.Contains("binding", StringComparison.OrdinalIgnoreCase)
                    || key.Contains("source", StringComparison.OrdinalIgnoreCase)
                    || key.Contains("lookup", StringComparison.OrdinalIgnoreCase)
                    || key.Contains("request", StringComparison.OrdinalIgnoreCase)
                    || key.Contains("endpoint", StringComparison.OrdinalIgnoreCase)))
                {
                    return false;
                }

                return property.Value.ValueKind switch
                {
                    JsonValueKind.String => !string.IsNullOrWhiteSpace(property.Value.GetString()),
                    JsonValueKind.Number => true,
                    JsonValueKind.True => true,
                    JsonValueKind.False => false,
                    JsonValueKind.Array => property.Value.GetArrayLength() > 0,
                    JsonValueKind.Object => property.Value.EnumerateObject().Any(),
                    _ => false
                };
            });

            return true;
        }
        catch
        {
            isInvalidJson = true;
            return false;
        }
    }

    private SubjectAdminFieldDto MapAdminField(Cdmend field, IReadOnlyDictionary<string, int> linkedCounts)
    {
        var key = field.CdmendTxt ?? string.Empty;
        return new SubjectAdminFieldDto
        {
            CdmendSql = field.CdmendSql,
            FieldKey = key,
            FieldType = field.CdmendType ?? string.Empty,
            FieldLabel = field.CDMendLbl,
            Placeholder = field.Placeholder,
            DefaultValue = field.DefaultValue,
            OptionsPayload = field.CdmendTbl,
            DataType = field.CdmendDatatype,
            Required = field.Required == true,
            RequiredTrue = field.RequiredTrue == true,
            Email = field.Email == true,
            Pattern = field.Pattern == true,
            MinValue = field.MinValue,
            MaxValue = field.MaxValue,
            Mask = field.Cdmendmask,
            IsActive = !field.CdmendStat,
            Width = field.Width,
            Height = field.Height,
            IsDisabledInit = field.IsDisabledInit,
            IsSearchable = field.IsSearchable,
            ApplicationId = field.ApplicationId,
            LinkedCategoriesCount = linkedCounts.TryGetValue(key, out var count) ? count : 0
        };
    }

    private async Task<int> ResolveNextCategoryDisplayOrderAsync(int parentCategoryId, CancellationToken cancellationToken)
    {
        var siblingCategoryIds = await _connectContext.Cdcategories
            .AsNoTracking()
            .Where(item => item.CatParent == parentCategoryId)
            .Select(item => item.CatId)
            .ToListAsync(cancellationToken);
        if (siblingCategoryIds.Count == 0)
        {
            return 1;
        }

        var maxOrder = await _connectContext.SubjectTypeAdminSettings
            .AsNoTracking()
            .Where(item => siblingCategoryIds.Contains(item.CategoryId))
            .MaxAsync(item => (int?)item.DisplayOrder, cancellationToken) ?? 0;

        return maxOrder + 1;
    }

    private async Task<SubjectTypeAdminSetting> EnsureCategorySettingAsync(
        int categoryId,
        int parentCategoryId,
        string userId,
        CancellationToken cancellationToken)
    {
        var setting = await _connectContext.SubjectTypeAdminSettings
            .FirstOrDefaultAsync(item => item.CategoryId == categoryId, cancellationToken);
        if (setting != null)
        {
            return setting;
        }

        setting = new SubjectTypeAdminSetting
        {
            CategoryId = categoryId,
            DisplayOrder = await ResolveNextCategoryDisplayOrderAsync(parentCategoryId, cancellationToken),
            SettingsJson = null,
            LastModifiedBy = userId,
            LastModifiedAtUtc = DateTime.UtcNow
        };
        await _connectContext.SubjectTypeAdminSettings.AddAsync(setting, cancellationToken);
        return setting;
    }

    private async Task RebalanceCategoryDisplayOrderAsync(
        int parentCategoryId,
        string userId,
        CancellationToken cancellationToken,
        int? movedCategoryId = null,
        int movedCategoryTargetIndex = 0)
    {
        var siblings = await _connectContext.Cdcategories
            .AsNoTracking()
            .Where(item => item.CatParent == parentCategoryId)
            .Select(item => new { item.CatId, item.CatName })
            .ToListAsync(cancellationToken);

        var siblingIds = siblings.Select(item => item.CatId).ToList();
        if (siblingIds.Count == 0)
        {
            return;
        }

        var settingsMap = await _connectContext.SubjectTypeAdminSettings
            .Where(item => siblingIds.Contains(item.CategoryId))
            .ToDictionaryAsync(item => item.CategoryId, cancellationToken);

        foreach (var siblingId in siblingIds)
        {
            if (!settingsMap.ContainsKey(siblingId))
            {
                var created = new SubjectTypeAdminSetting
                {
                    CategoryId = siblingId,
                    DisplayOrder = int.MaxValue,
                    SettingsJson = null,
                    LastModifiedBy = userId,
                    LastModifiedAtUtc = DateTime.UtcNow
                };
                await _connectContext.SubjectTypeAdminSettings.AddAsync(created, cancellationToken);
                settingsMap[siblingId] = created;
            }
        }

        var ordered = siblings
            .OrderBy(item => settingsMap.TryGetValue(item.CatId, out var setting) ? setting.DisplayOrder : int.MaxValue)
            .ThenBy(item => item.CatName)
            .Select(item => item.CatId)
            .ToList();

        if (movedCategoryId.HasValue)
        {
            ordered.Remove(movedCategoryId.Value);
            var safeIndex = Math.Max(0, Math.Min(movedCategoryTargetIndex, ordered.Count));
            ordered.Insert(safeIndex, movedCategoryId.Value);
        }

        for (var idx = 0; idx < ordered.Count; idx++)
        {
            var catId = ordered[idx];
            if (!settingsMap.TryGetValue(catId, out var setting))
            {
                continue;
            }

            setting.DisplayOrder = idx + 1;
            setting.LastModifiedBy = userId;
            setting.LastModifiedAtUtc = DateTime.UtcNow;
        }

        await _connectContext.SaveChangesAsync(cancellationToken);
    }

    private async Task<HashSet<int>> LoadDescendantCategoryIdsAsync(int categoryId, CancellationToken cancellationToken)
    {
        var allCategories = await _connectContext.Cdcategories
            .AsNoTracking()
            .Select(item => new { item.CatId, item.CatParent })
            .ToListAsync(cancellationToken);

        var byParent = allCategories
            .GroupBy(item => item.CatParent)
            .ToDictionary(group => group.Key, group => group.Select(item => item.CatId).ToList());

        var result = new HashSet<int>();
        var queue = new Queue<int>();
        queue.Enqueue(categoryId);

        while (queue.Count > 0)
        {
            var current = queue.Dequeue();
            if (!byParent.TryGetValue(current, out var children))
            {
                continue;
            }

            foreach (var child in children)
            {
                if (result.Add(child))
                {
                    queue.Enqueue(child);
                }
            }
        }

        return result;
    }

    private async Task<List<SubjectCategoryFieldLinkAdminDto>> LoadAdminCategoryFieldLinksAsync(
        int categoryId,
        CancellationToken cancellationToken)
    {
        var categoryAppId = NormalizeApplicationId(await _connectContext.Cdcategories
            .AsNoTracking()
            .Where(item => item.CatId == categoryId)
            .Select(item => item.ApplicationId)
            .FirstOrDefaultAsync(cancellationToken));

        var linkRows = await (from link in _connectContext.CdCategoryMands.AsNoTracking()
                              join mandGroup in _connectContext.MandGroups.AsNoTracking()
                                  on link.MendGroup equals mandGroup.GroupId into groupJoin
                              from mandGroup in groupJoin.DefaultIfEmpty()
                              join setting in _connectContext.SubjectCategoryFieldSettings.AsNoTracking()
                                  on link.MendSql equals setting.MendSql into settingJoin
                              from setting in settingJoin.DefaultIfEmpty()
                              where link.MendCategory == categoryId
                              orderby link.MendGroup,
                                      setting != null ? setting.DisplayOrder : link.MendSql,
                                      link.MendSql
                              select new
                              {
                                  link.MendSql,
                                  link.MendCategory,
                                  link.MendField,
                                  link.MendGroup,
                                  link.MendStat,
                                  GroupName = mandGroup != null ? mandGroup.GroupName : null,
                                  DisplayOrder = setting != null ? setting.DisplayOrder : link.MendSql,
                                  IsVisible = setting == null || setting.IsVisible,
                                  DisplaySettingsJson = setting != null ? setting.DisplaySettingsJson : null
                              })
            .ToListAsync(cancellationToken);

        var fieldKeys = linkRows
            .Select(item => item.MendField)
            .Where(item => !string.IsNullOrWhiteSpace(item))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        var fields = await _connectContext.Cdmends
            .AsNoTracking()
            .Where(item => fieldKeys.Contains(item.CdmendTxt))
            .ToListAsync(cancellationToken);
        var fieldLookup = fields
            .GroupBy(item => NormalizeFieldKey(item.CdmendTxt))
            .ToDictionary(group => group.Key, group => (IReadOnlyCollection<Cdmend>)group.ToList(), StringComparer.Ordinal);

        var mapped = linkRows
            .GroupBy(item => item.MendSql)
            .Select(group => group.First())
            .Select(row =>
            {
                var normalizedFieldKey = NormalizeFieldKey(row.MendField);
                fieldLookup.TryGetValue(normalizedFieldKey, out var candidates);
                var selectedMetadata = SelectPreferredMend(
                    candidates ?? Array.Empty<Cdmend>(),
                    normalizedRequestAppId: string.Empty,
                    normalizedCategoryAppId: categoryAppId,
                    out _);

                return new SubjectCategoryFieldLinkAdminDto
                {
                    MendSql = row.MendSql,
                    CategoryId = row.MendCategory,
                    FieldKey = row.MendField,
                    FieldLabel = selectedMetadata?.CDMendLbl ?? row.MendField,
                    FieldType = selectedMetadata?.CdmendType,
                    GroupId = row.MendGroup,
                    GroupName = row.GroupName,
                    IsActive = !row.MendStat,
                    DisplayOrder = row.DisplayOrder,
                    IsVisible = row.IsVisible,
                    DisplaySettingsJson = row.DisplaySettingsJson,
                    ApplicationId = selectedMetadata?.ApplicationId
                };
            })
            .OrderBy(item => item.GroupId)
            .ThenBy(item => item.DisplayOrder)
            .ThenBy(item => item.MendSql)
            .ToList();

        return mapped;
    }

    private static bool ExceedsMaxLength(string? value, int maxLength)
    {
        return value != null && value.Length > maxLength;
    }

    private static bool EqualsNormalized(string? left, string? right)
    {
        return string.Equals(
            NormalizeCompare(left),
            NormalizeCompare(right),
            StringComparison.OrdinalIgnoreCase);
    }

    private static string NormalizeCompare(string? value)
    {
        return (value ?? string.Empty).Trim();
    }

    private async Task<bool> HasSiblingCategoryNameConflictAsync(
        int? excludedCategoryId,
        int parentCategoryId,
        string categoryName,
        string? applicationId,
        CancellationToken cancellationToken)
    {
        var siblings = await _connectContext.Cdcategories
            .AsNoTracking()
            .Where(item =>
                item.CatParent == parentCategoryId
                && (!excludedCategoryId.HasValue || item.CatId != excludedCategoryId.Value))
            .Select(item => new
            {
                item.CatName,
                item.ApplicationId
            })
            .ToListAsync(cancellationToken);

        return siblings.Any(item =>
            EqualsNormalized(item.CatName, categoryName)
            && EqualsNormalized(item.ApplicationId, applicationId));
    }

    private static void AddUnhandledError<T>(CommonResponse<T> response)
    {
        response.Errors.Add(new Error
        {
            Code = "500",
            Message = "حدث خطأ غير متوقع أثناء تنفيذ العملية."
        });
    }
}
