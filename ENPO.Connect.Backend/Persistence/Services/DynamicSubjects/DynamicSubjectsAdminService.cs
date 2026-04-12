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
    private const int DiagnosticsPayloadPreviewMaxLength = 700;

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

            var hasDynamicFields = await _connectContext.AdminCatalogCategoryFieldBindings
                .AsNoTracking()
                .AnyAsync(link => link.CategoryId == categoryId && !link.MendStat, cancellationToken);
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
            var hasLinks = await _connectContext.AdminCatalogCategoryFieldBindings
                .AsNoTracking()
                .AnyAsync(item => item.CategoryId == categoryId, cancellationToken);

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
                    categoryId: categoryId,
                    userId: normalizedUserId,
                    appId: category.ApplicationId,
                    documentDirection: null,
                    allowInactiveCategory: true,
                    stageId: null,
                    actionId: null,
                    requestId: null,
                    includeMetadataHiddenLinks: true,
                    preserveHiddenByAccessInPayload: true,
                    cancellationToken: cancellationToken);
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

            var hasDynamicFields = await _connectContext.AdminCatalogCategoryFieldBindings
                .AsNoTracking()
                .AnyAsync(link => link.CategoryId == categoryId && !link.MendStat, cancellationToken);
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
                categoryId: categoryId,
                userId: normalizedUserId,
                appId: category.ApplicationId,
                documentDirection: normalizedDirection,
                allowInactiveCategory: true,
                stageId: null,
                actionId: null,
                requestId: null,
                includeMetadataHiddenLinks: true,
                preserveHiddenByAccessInPayload: true,
                cancellationToken: cancellationToken);
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

            var linkedCounts = await _connectContext.AdminCatalogCategoryFieldBindings
                .AsNoTracking()
                .Where(link => fieldKeys.Contains(link.MendField) && !link.MendStat)
                .GroupBy(link => link.MendField)
                .Select(group => new
                {
                    FieldKey = group.Key,
                    Count = group.Select(item => item.CategoryId).Distinct().Count()
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
        var fieldContextKey = string.Empty;
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
            fieldContextKey = fieldKey;
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
            var normalizedDefaultValue = NormalizeNullable(safeRequest.DefaultValue);
            var normalizedOptionsPayload = NormalizeNullable(safeRequest.OptionsPayload);
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

            var (fieldBusinessValidationError, optionSourceDiagnostics) = ValidateAdminFieldBusinessRules(
                fieldKey,
                fieldLabel,
                fieldType,
                dataType,
                normalizedDefaultValue,
                normalizedOptionsPayload,
                displaySettingsJson: null,
                DisplaySettingsRuntimeInspection.Empty);
            _logger?.LogInformation(
                "CreateAdminField request snapshot: {Payload}",
                JsonSerializer.Serialize(
                    BuildFieldUpsertDiagnosticsSnapshot(
                        fieldKey,
                        fieldLabel,
                        fieldType,
                        dataType,
                        normalizedDefaultValue,
                        normalizedOptionsPayload,
                        null,
                        null,
                        null,
                        null,
                        optionSourceDiagnostics: optionSourceDiagnostics,
                        runtimeInspection: DisplaySettingsRuntimeInspection.Empty),
                    SerializerOptions));
            if (fieldBusinessValidationError != null)
            {
                response.Errors.Add(fieldBusinessValidationError);
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
                DefaultValue = normalizedDefaultValue,
                CdmendTbl = normalizedOptionsPayload,
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
        catch (Exception ex)
        {
            _logger?.LogError(ex, "Failed to create admin field {FieldKey}.", fieldContextKey);
            response.Errors.Add(new Error
            {
                Code = "500",
                Message = BuildFieldUnhandledBusinessErrorMessage(fieldContextKey, "إنشاء")
            });
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
        var fieldContextKey = (fieldKey ?? string.Empty).Trim();
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
            fieldContextKey = newFieldKey.Length > 0 ? newFieldKey : oldFieldKey;
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
            var normalizedDefaultValue = NormalizeNullable(safeRequest.DefaultValue);
            var normalizedOptionsPayload = NormalizeNullable(safeRequest.OptionsPayload);
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

            var (fieldBusinessValidationError, optionSourceDiagnostics) = ValidateAdminFieldBusinessRules(
                newFieldKey,
                fieldLabel,
                fieldType,
                dataType,
                normalizedDefaultValue,
                normalizedOptionsPayload,
                displaySettingsJson: null,
                DisplaySettingsRuntimeInspection.Empty);
            _logger?.LogInformation(
                "UpdateAdminField request snapshot: {Payload}",
                JsonSerializer.Serialize(
                    BuildFieldUpsertDiagnosticsSnapshot(
                        newFieldKey,
                        fieldLabel,
                        fieldType,
                        dataType,
                        normalizedDefaultValue,
                        normalizedOptionsPayload,
                        null,
                        null,
                        null,
                        null,
                        optionSourceDiagnostics: optionSourceDiagnostics,
                        runtimeInspection: DisplaySettingsRuntimeInspection.Empty),
                    SerializerOptions));
            if (fieldBusinessValidationError != null)
            {
                response.Errors.Add(fieldBusinessValidationError);
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

                var linkedRows = await _connectContext.AdminCatalogCategoryFieldBindings
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
            field.DefaultValue = normalizedDefaultValue;
            field.CdmendTbl = normalizedOptionsPayload;
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

            var linkedCount = await _connectContext.AdminCatalogCategoryFieldBindings
                .AsNoTracking()
                .Where(item => item.MendField == newFieldKey && !item.MendStat)
                .Select(item => item.CategoryId)
                .Distinct()
                .CountAsync(cancellationToken);

            response.Data = MapAdminField(
                field,
                new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase)
                {
                    [newFieldKey] = linkedCount
                });
        }
        catch (Exception ex)
        {
            _logger?.LogError(ex, "Failed to update admin field {FieldKey}.", fieldContextKey);
            response.Errors.Add(new Error
            {
                Code = "500",
                Message = BuildFieldUnhandledBusinessErrorMessage(fieldContextKey, "تحديث")
            });
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

            var hasLinks = await _connectContext.AdminCatalogCategoryFieldBindings
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
        var saveStage = "تهيئة الحفظ";
        var saveFieldKey = string.Empty;
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

            var normalizedIncomingItems = (request?.Links ?? new List<SubjectCategoryFieldLinkUpsertItemDto>())
                .Select((item, index) => new NormalizedFieldLinkRequestItem
                {
                    RowNumber = index + 1,
                    MendSql = item.MendSql,
                    FieldKey = NormalizeNullable(item.FieldKey),
                    GroupId = item.GroupId,
                    IsActive = item.IsActive,
                    DisplayOrder = item.DisplayOrder <= 0 ? 1 : item.DisplayOrder,
                    IsVisible = item.IsVisible,
                    DisplaySettingsJson = NormalizeNullable(item.DisplaySettingsJson)
                })
                .ToList();
            var containsLegacyFieldLevelPayload = normalizedIncomingItems.Any(item =>
                item.IsVisible == false
                || item.DisplaySettingsJson != null);

            var invalidFieldKeyRow = normalizedIncomingItems
                .FirstOrDefault(item => string.IsNullOrWhiteSpace(item.FieldKey));
            if (invalidFieldKeyRow != null)
            {
                response.Errors.Add(new Error
                {
                    Code = "400",
                    Message = $"فشل حفظ الربط في السطر {invalidFieldKeyRow.RowNumber} بسبب fieldKey غير صالح."
                });
                return response;
            }

            var invalidGroupRow = normalizedIncomingItems
                .FirstOrDefault(item => item.GroupId <= 0);
            if (invalidGroupRow != null)
            {
                response.Errors.Add(new Error
                {
                    Code = "400",
                    Message = $"فشل حفظ الحقل '{invalidGroupRow.FieldKey}' بسبب GroupId غير صالح."
                });
                return response;
            }

            var invalidMendSqlRow = normalizedIncomingItems
                .FirstOrDefault(item => item.MendSql.HasValue && item.MendSql.Value <= 0);
            if (invalidMendSqlRow != null)
            {
                response.Errors.Add(new Error
                {
                    Code = "400",
                    Message = $"فشل حفظ الحقل '{invalidMendSqlRow.FieldKey}' بسبب MendSql غير صالح."
                });
                return response;
            }

            var safeItems = normalizedIncomingItems
                .Select(item => new SubjectCategoryFieldLinkUpsertItemDto
                {
                    MendSql = item.MendSql,
                    FieldKey = item.FieldKey ?? string.Empty,
                    GroupId = item.GroupId,
                    IsActive = item.IsActive,
                    DisplayOrder = item.DisplayOrder,
                    IsVisible = true,
                    DisplaySettingsJson = null
                })
                .ToList();

            if (containsLegacyFieldLevelPayload)
            {
                _logger?.LogInformation(
                    "Ignoring legacy field-level payload during field-links upsert for category {CategoryId}; binding endpoint now accepts linking/order only.",
                    categoryId);
            }

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
                .Select(item => new
                {
                    item.CdmendTxt,
                    item.ApplicationId,
                    item.CDMendLbl,
                    item.CdmendType,
                    item.CdmendDatatype,
                    item.DefaultValue,
                    OptionsPayload = item.CdmendTbl
                })
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

            var validGroups = await _connectContext.AdminCatalogCategoryGroups
                .AsNoTracking()
                .Where(item => item.CategoryId == categoryId && item.IsActive)
                .ToListAsync(cancellationToken);
            var validGroupById = validGroups
                .GroupBy(item => item.GroupId)
                .ToDictionary(group => group.Key, group => group.First());

            var requestedGroupIds = safeItems
                .Select(item => item.GroupId)
                .Distinct()
                .ToList();
            var invalidGroupId = requestedGroupIds.FirstOrDefault(groupId =>
                !validGroupById.ContainsKey(groupId));
            if (invalidGroupId > 0)
            {
                response.Errors.Add(new Error
                {
                    Code = "400",
                    Message = $"المجموعة '{invalidGroupId}' غير مرتبطة بشجرة الجروبات الحالية لهذا النوع."
                });
                return response;
            }

            var duplicatedMendSqlGroup = safeItems
                .Where(item => item.MendSql.HasValue && item.MendSql.Value > 0)
                .GroupBy(item => item.MendSql!.Value)
                .FirstOrDefault(group => group.Count() > 1);
            if (duplicatedMendSqlGroup != null)
            {
                response.Errors.Add(new Error
                {
                    Code = "400",
                    Message = $"فشل الحفظ بسبب تكرار MendSql='{duplicatedMendSqlGroup.Key}' في أكثر من حقل."
                });
                return response;
            }

            var duplicatedDisplayOrder = safeItems
                .GroupBy(item => item.DisplayOrder)
                .FirstOrDefault(group => group.Count() > 1);
            if (duplicatedDisplayOrder != null)
            {
                var duplicatedKeys = duplicatedDisplayOrder
                    .Select(item => item.FieldKey)
                    .Where(item => !string.IsNullOrWhiteSpace(item))
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToList();
                response.Errors.Add(new Error
                {
                    Code = "400",
                    Message = duplicatedKeys.Count > 0
                        ? $"فشل الحفظ لأن ترتيب العرض '{duplicatedDisplayOrder.Key}' مكرر في الحقول: {string.Join(", ", duplicatedKeys)}."
                        : $"فشل الحفظ لأن ترتيب العرض '{duplicatedDisplayOrder.Key}' مكرر."
                });
                return response;
            }

            var existingLinks = await _connectContext.AdminCatalogCategoryFieldBindings
                .Where(item => item.CategoryId == categoryId)
                .ToListAsync(cancellationToken);

            int? nextGeneratedMendSql = null;

            async Task<int> AllocateMendSqlAsync()
            {
                if (!nextGeneratedMendSql.HasValue)
                {
                    nextGeneratedMendSql = await _connectContext.AdminCatalogCategoryFieldBindings
                        .AsNoTracking()
                        .Select(item => (int?)item.MendSql)
                        .MaxAsync(cancellationToken) ?? 0;
                }

                nextGeneratedMendSql += 1;
                return nextGeneratedMendSql.Value;
            }

            foreach (var item in safeItems)
            {
                saveStage = "ترحيل روابط الحقول";
                saveFieldKey = item.FieldKey;
                var canonicalGroupId = item.GroupId;
                AdminCatalogCategoryFieldBinding? link = null;
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
                    link = new AdminCatalogCategoryFieldBinding
                    {
                        MendSql = await AllocateMendSqlAsync(),
                        CategoryId = categoryId,
                        MendField = item.FieldKey,
                        GroupId = canonicalGroupId,
                        MendStat = !item.IsActive
                    };
                    await _connectContext.AdminCatalogCategoryFieldBindings.AddAsync(link, cancellationToken);
                    existingLinks.Add(link);
                }
                else
                {
                    link.MendField = item.FieldKey;
                    link.GroupId = canonicalGroupId;
                    link.MendStat = !item.IsActive;
                }
            }

            await _connectContext.SaveChangesAsync(cancellationToken);

            foreach (var item in safeItems)
            {
                saveStage = "حفظ إعدادات الربط";
                saveFieldKey = item.FieldKey;
                var canonicalGroupId = item.GroupId;
                AdminCatalogCategoryFieldBinding? link = null;
                if (item.MendSql.HasValue && item.MendSql.Value > 0)
                {
                    link = existingLinks.FirstOrDefault(existing => existing.MendSql == item.MendSql.Value);
                }

                if (link == null)
                {
                    link = existingLinks.FirstOrDefault(existing =>
                        string.Equals(existing.MendField, item.FieldKey, StringComparison.OrdinalIgnoreCase)
                        && existing.GroupId == canonicalGroupId);
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
                        IsVisible = true,
                        DisplaySettingsJson = null,
                        LastModifiedBy = normalizedUserId,
                        LastModifiedAtUtc = DateTime.UtcNow
                    };
                    await _connectContext.SubjectCategoryFieldSettings.AddAsync(setting, cancellationToken);
                }
                else
                {
                    setting.DisplayOrder = item.DisplayOrder;
                    setting.LastModifiedBy = normalizedUserId;
                    setting.LastModifiedAtUtc = DateTime.UtcNow;
                }
            }

            foreach (var existing in existingLinks.Where(link => !safeItems.Any(item =>
                (item.MendSql.HasValue && item.MendSql.Value == link.MendSql)
                || (!item.MendSql.HasValue && string.Equals(item.FieldKey, link.MendField, StringComparison.OrdinalIgnoreCase)))))
            {
                saveStage = "تعطيل الروابط غير المرسلة";
                saveFieldKey = existing.MendField;
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

            saveStage = "مزامنة الروابط القديمة";
            saveFieldKey = string.Empty;
            await SyncLegacyCategoryFieldBindingsAsync(categoryId, existingLinks, validGroupById, cancellationToken);

            response.Data = await LoadAdminCategoryFieldLinksAsync(categoryId, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger?.LogError(
                ex,
                "Failed to upsert admin category field links for category {CategoryId}. Stage={Stage}, FieldKey={FieldKey}.",
                categoryId,
                saveStage,
                saveFieldKey);
            response.Errors.Add(new Error
            {
                Code = "500",
                Message = BuildFieldLinksUnhandledBusinessErrorMessage(saveFieldKey, saveStage)
            });
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

        return BuildFormDefinitionAsync(
            categoryId: categoryId,
            userId: userId,
            appId: appId,
            documentDirection: null,
            allowInactiveCategory: true,
            stageId: null,
            actionId: null,
            requestId: null,
            includeMetadataHiddenLinks: true,
            preserveHiddenByAccessInPayload: true,
            cancellationToken: cancellationToken);
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

            var hasDynamicFields = await _connectContext.AdminCatalogCategoryFieldBindings
                .AsNoTracking()
                .AnyAsync(item => item.CategoryId == categoryId && !item.MendStat, cancellationToken);

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
                categoryId: categoryId,
                userId: normalizedUserId,
                appId: appId,
                documentDirection: requestedDirection,
                allowInactiveCategory: true,
                stageId: null,
                actionId: null,
                requestId: null,
                includeMetadataHiddenLinks: true,
                preserveHiddenByAccessInPayload: true,
                cancellationToken: cancellationToken);

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

    private static (Error? Error, FieldOptionSourceDiagnostics OptionSourceDiagnostics) ValidateAdminFieldBusinessRules(
        string fieldKey,
        string fieldLabel,
        string? fieldType,
        string? dataType,
        string? defaultValue,
        string? optionsPayload,
        string? displaySettingsJson,
        DisplaySettingsRuntimeInspection runtimeInspection)
    {
        var safeRuntimeInspection = runtimeInspection ?? DisplaySettingsRuntimeInspection.Empty;
        var normalizedFieldKey = NormalizeNullable(fieldKey) ?? "غير معروف";
        var normalizedFieldLabel = NormalizeNullable(fieldLabel) ?? normalizedFieldKey;
        var normalizedFieldType = NormalizeNullable(fieldType) ?? string.Empty;
        var normalizedDataType = NormalizeNullable(dataType) ?? string.Empty;
        var normalizedDefaultValue = NormalizeNullable(defaultValue);
        var staticOptionsDiagnostics = ResolveStaticOptionsDiagnostics(optionsPayload, displaySettingsJson);
        var requiresOptionsBinding = RequiresOptionsBinding(normalizedFieldType);
        var optionSourceDiagnostics = ResolveFieldOptionSourceDiagnostics(
            requiresOptionsBinding,
            staticOptionsDiagnostics,
            safeRuntimeInspection);

        if (optionSourceDiagnostics.HasExplicitDynamicOptionSource && !requiresOptionsBinding)
        {
            return (new Error
            {
                Code = "400",
                Message = $"فشل حفظ الحقل '{normalizedFieldKey}' لأن optionLoader غير متوافق مع نوع الحقل '{normalizedFieldType}'."
            }, optionSourceDiagnostics);
        }

        if (requiresOptionsBinding && string.Equals(optionSourceDiagnostics.EffectiveSource, "None", StringComparison.Ordinal))
        {
            if (string.Equals(staticOptionsDiagnostics.State, "invalid", StringComparison.Ordinal))
            {
                return (new Error
                {
                    Code = "400",
                    Message = $"فشل حفظ الحقل '{normalizedFieldKey}' لأن مصدر الخيارات الثابت غير صالح بعد التطبيع، ولم يتم العثور على مصدر خيارات داخلي/خارجي صالح."
                }, optionSourceDiagnostics);
            }

            if (safeRuntimeInspection.HasOptionLoaderConfig && !safeRuntimeInspection.HasExplicitDynamicOptionSource)
            {
                return (new Error
                {
                    Code = "400",
                    Message = $"فشل حفظ الحقل '{normalizedFieldKey}' لأن dynamicRuntime.optionLoader غير مكتمل ولم يفعّل مصدر خيارات ديناميكي صريح."
                }, optionSourceDiagnostics);
            }

            return (new Error
            {
                Code = "400",
                Message = $"فشل حفظ الحقل '{normalizedFieldKey}' لأنه لا يحتوي على خيارات ثابتة صالحة ولا مصدر خيارات داخلي/خارجي صالح."
            }, optionSourceDiagnostics);
        }

        if (normalizedDefaultValue != null
            && requiresOptionsBinding
            && string.Equals(optionSourceDiagnostics.EffectiveSource, "Static", StringComparison.Ordinal)
            && !staticOptionsDiagnostics.NormalizedValues.Contains(normalizedDefaultValue))
        {
            return (new Error
            {
                Code = "400",
                Message = $"فشل حفظ الحقل '{normalizedFieldKey}' لأن القيمة الافتراضية غير موجودة ضمن الخيارات."
            }, optionSourceDiagnostics);
        }

        if (normalizedDefaultValue != null && IsNumericFieldType(normalizedFieldType, normalizedDataType))
        {
            var parsedAsInvariant = decimal.TryParse(
                normalizedDefaultValue,
                NumberStyles.Any,
                CultureInfo.InvariantCulture,
                out _);
            var parsedAsCurrent = decimal.TryParse(
                normalizedDefaultValue,
                NumberStyles.Any,
                CultureInfo.CurrentCulture,
                out _);
            if (!parsedAsInvariant && !parsedAsCurrent)
            {
                return (new Error
                {
                    Code = "400",
                    Message = $"فشل حفظ الحقل '{normalizedFieldKey}' لأن القيمة الافتراضية يجب أن تكون رقمًا صالحًا."
                }, optionSourceDiagnostics);
            }
        }

        if (normalizedDefaultValue != null && IsBooleanFieldType(normalizedFieldType, normalizedDataType))
        {
            if (!TryParseBooleanToken(normalizedDefaultValue, out _))
            {
                return (new Error
                {
                    Code = "400",
                    Message = $"فشل حفظ الحقل '{normalizedFieldKey}' لأن قيمة الحقل المنطقي يجب أن تكون true أو false."
                }, optionSourceDiagnostics);
            }
        }

        if (normalizedDefaultValue != null && IsDateFieldType(normalizedFieldType, normalizedDataType))
        {
            if (!DateTime.TryParse(normalizedDefaultValue, out _))
            {
                return (new Error
                {
                    Code = "400",
                    Message = $"فشل حفظ الحقل '{normalizedFieldKey}' لأن القيمة الافتراضية للتاريخ غير صالحة."
                }, optionSourceDiagnostics);
            }
        }

        if (normalizedFieldLabel.Length == 0)
        {
            return (new Error
            {
                Code = "400",
                Message = $"فشل حفظ الحقل '{normalizedFieldKey}' لأن اسم الحقل غير صالح."
            }, optionSourceDiagnostics);
        }

        return (null, optionSourceDiagnostics);
    }

    private static FieldOptionSourceDiagnostics ResolveFieldOptionSourceDiagnostics(
        bool requiresOptionsBinding,
        StaticOptionsResolutionDiagnostics staticOptionsDiagnostics,
        DisplaySettingsRuntimeInspection runtimeInspection)
    {
        var safeStaticDiagnostics = staticOptionsDiagnostics ?? StaticOptionsResolutionDiagnostics.Empty;
        var staticOptionsCount = safeStaticDiagnostics.NormalizedValues.Count;
        var hasValidStaticOptions = string.Equals(safeStaticDiagnostics.State, "valid", StringComparison.Ordinal)
            && staticOptionsCount > 0;

        if (hasValidStaticOptions)
        {
            return new FieldOptionSourceDiagnostics
            {
                EffectiveSource = "Static",
                EffectiveSourceReason = requiresOptionsBinding
                    ? "تم اعتماد الخيارات الثابتة بعد التطبيع (أولوية Static أعلى من Internal/External)."
                    : "تم اعتماد الخيارات الثابتة بعد التطبيع.",
                HasRuntimePayload = runtimeInspection.HasRuntimePayload,
                HasBehavioralRuntimeConfig = runtimeInspection.HasBehavioralRuntimeConfig,
                HasOptionLoaderConfig = runtimeInspection.HasOptionLoaderConfig,
                HasExplicitDynamicOptionSource = runtimeInspection.HasExplicitDynamicOptionSource,
                DynamicOptionSourceKind = runtimeInspection.DynamicOptionSourceKind,
                DynamicOptionSourceReason = runtimeInspection.DynamicOptionSourceReason,
                OptionLoaderRejectedReason = runtimeInspection.OptionLoaderRejectedReason,
                HasStaticOptionsPayload = safeStaticDiagnostics.RawOptionSourceCount > 0,
                IsStaticOptionsPayloadValid = true,
                StaticOptionsCount = staticOptionsCount,
                IsStaticOptionsIgnored = false,
                StaticOptionsIgnoredReason = null,
                StaticOptionsExcludedReason = null,
                RawOptionSourcesPreview = safeStaticDiagnostics.RawOptionSourcePreviews
            };
        }

        if (runtimeInspection.HasExplicitDynamicOptionSource)
        {
            var normalizedDynamicKind = NormalizeDynamicOptionSourceKind(runtimeInspection.DynamicOptionSourceKind);
            var effectiveSource = normalizedDynamicKind ?? "External";
            return new FieldOptionSourceDiagnostics
            {
                EffectiveSource = effectiveSource,
                EffectiveSourceReason = runtimeInspection.DynamicOptionSourceReason
                    ?? (effectiveSource == "Internal"
                        ? "تم اعتماد مصدر خيارات ديناميكي داخلي."
                        : "تم اعتماد مصدر خيارات ديناميكي خارجي."),
                HasRuntimePayload = runtimeInspection.HasRuntimePayload,
                HasBehavioralRuntimeConfig = runtimeInspection.HasBehavioralRuntimeConfig,
                HasOptionLoaderConfig = runtimeInspection.HasOptionLoaderConfig,
                HasExplicitDynamicOptionSource = runtimeInspection.HasExplicitDynamicOptionSource,
                DynamicOptionSourceKind = effectiveSource,
                DynamicOptionSourceReason = runtimeInspection.DynamicOptionSourceReason,
                OptionLoaderRejectedReason = runtimeInspection.OptionLoaderRejectedReason,
                HasStaticOptionsPayload = safeStaticDiagnostics.RawOptionSourceCount > 0,
                IsStaticOptionsPayloadValid = false,
                StaticOptionsCount = staticOptionsCount,
                IsStaticOptionsIgnored = false,
                StaticOptionsIgnoredReason = null,
                StaticOptionsExcludedReason = BuildStaticOptionsExcludedReason(safeStaticDiagnostics),
                RawOptionSourcesPreview = safeStaticDiagnostics.RawOptionSourcePreviews
            };
        }

        return new FieldOptionSourceDiagnostics
        {
            EffectiveSource = "None",
            EffectiveSourceReason = BuildNoOptionsSourceReason(
                requiresOptionsBinding,
                safeStaticDiagnostics,
                runtimeInspection),
            HasRuntimePayload = runtimeInspection.HasRuntimePayload,
            HasBehavioralRuntimeConfig = runtimeInspection.HasBehavioralRuntimeConfig,
            HasOptionLoaderConfig = runtimeInspection.HasOptionLoaderConfig,
            HasExplicitDynamicOptionSource = runtimeInspection.HasExplicitDynamicOptionSource,
            DynamicOptionSourceKind = NormalizeDynamicOptionSourceKind(runtimeInspection.DynamicOptionSourceKind),
            DynamicOptionSourceReason = runtimeInspection.DynamicOptionSourceReason,
            OptionLoaderRejectedReason = runtimeInspection.OptionLoaderRejectedReason,
            HasStaticOptionsPayload = safeStaticDiagnostics.RawOptionSourceCount > 0,
            IsStaticOptionsPayloadValid = false,
            StaticOptionsCount = staticOptionsCount,
            IsStaticOptionsIgnored = false,
            StaticOptionsIgnoredReason = null,
            StaticOptionsExcludedReason = BuildStaticOptionsExcludedReason(safeStaticDiagnostics),
            RawOptionSourcesPreview = safeStaticDiagnostics.RawOptionSourcePreviews
        };
    }

    private static string BuildNoOptionsSourceReason(
        bool requiresOptionsBinding,
        StaticOptionsResolutionDiagnostics staticOptionsDiagnostics,
        DisplaySettingsRuntimeInspection runtimeInspection)
    {
        if (!requiresOptionsBinding)
        {
            return "الحقل لا يعتمد على مصدر خيارات.";
        }

        if (string.Equals(staticOptionsDiagnostics.State, "invalid", StringComparison.Ordinal))
        {
            return "مصدر الخيارات الثابت غير صالح بعد التطبيع.";
        }

        if (string.Equals(staticOptionsDiagnostics.State, "empty", StringComparison.Ordinal))
        {
            return "مصدر الخيارات الثابت موجود لكنه فارغ بعد التطبيع.";
        }

        if (runtimeInspection.HasOptionLoaderConfig && !runtimeInspection.HasExplicitDynamicOptionSource)
        {
            return runtimeInspection.OptionLoaderRejectedReason
                ?? "تم تجاهل optionLoader لأنه لا يحتوي مصدر خيارات داخلي/خارجي صالح.";
        }

        if (runtimeInspection.HasBehavioralRuntimeConfig && !runtimeInspection.HasOptionLoaderConfig)
        {
            return "dynamicRuntime يحتوي سلوكًا فقط بدون مصدر خيارات.";
        }

        return "لا توجد خيارات ثابتة صالحة ولا مصدر خيارات داخلي/خارجي صالح.";
    }

    private static string? BuildStaticOptionsExcludedReason(StaticOptionsResolutionDiagnostics staticOptionsDiagnostics)
    {
        if (string.Equals(staticOptionsDiagnostics.State, "invalid", StringComparison.Ordinal))
        {
            return staticOptionsDiagnostics.InvalidReason ?? "فشل parse/normalize لمصدر الخيارات الثابت.";
        }

        if (string.Equals(staticOptionsDiagnostics.State, "empty", StringComparison.Ordinal))
        {
            return "مصدر الخيارات الثابت موجود لكنه فارغ بعد التطبيع.";
        }

        if (string.Equals(staticOptionsDiagnostics.State, "missing", StringComparison.Ordinal))
        {
            return "لا يوجد مصدر خيارات ثابت (optionsPayload/legacy).";
        }

        return null;
    }

    private static string? NormalizeDynamicOptionSourceKind(string? sourceKind)
    {
        var normalized = NormalizeNullable(sourceKind);
        if (normalized == null)
        {
            return null;
        }

        if (string.Equals(normalized, "internal", StringComparison.OrdinalIgnoreCase))
        {
            return "Internal";
        }

        if (string.Equals(normalized, "external", StringComparison.OrdinalIgnoreCase))
        {
            return "External";
        }

        return null;
    }

    private static StaticOptionsResolutionDiagnostics ResolveStaticOptionsDiagnostics(
        string? optionsPayload,
        string? displaySettingsJson)
    {
        var rawSources = CollectRawStaticOptionSources(optionsPayload, displaySettingsJson);
        if (rawSources.Count == 0)
        {
            return new StaticOptionsResolutionDiagnostics
            {
                State = "missing",
                RawOptionSourceCount = 0,
                RawOptionSourcePreviews = Array.Empty<string>(),
                NormalizedValues = new HashSet<string>(StringComparer.OrdinalIgnoreCase),
                InvalidReason = null
            };
        }

        var normalizedValues = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var invalidSourceCount = 0;
        var emptySourceCount = 0;
        string? firstInvalidReason = null;

        foreach (var source in rawSources)
        {
            var parsed = ParseOptionValues(source.Payload);
            if (parsed.Values.Count > 0)
            {
                foreach (var value in parsed.Values)
                {
                    normalizedValues.Add(value);
                }

                continue;
            }

            if (parsed.IsValid)
            {
                emptySourceCount++;
                continue;
            }

            invalidSourceCount++;
            firstInvalidReason ??= $"{source.Source}: صيغة JSON غير صالحة أو غير قابلة للتطبيع.";
        }

        var state = normalizedValues.Count > 0
            ? "valid"
            : (invalidSourceCount > 0 ? "invalid" : "empty");

        return new StaticOptionsResolutionDiagnostics
        {
            State = state,
            RawOptionSourceCount = rawSources.Count,
            RawOptionSourcePreviews = rawSources
                .Select(item => $"{item.Source}={TruncatePayloadForDiagnostics(item.Payload)}")
                .ToList(),
            NormalizedValues = normalizedValues,
            InvalidReason = state == "invalid"
                ? (firstInvalidReason ?? "فشل parse/normalize لمصدر الخيارات الثابت.")
                : null,
            InvalidSourceCount = invalidSourceCount,
            EmptySourceCount = emptySourceCount
        };
    }

    private static List<StaticRawOptionSource> CollectRawStaticOptionSources(
        string? optionsPayload,
        string? displaySettingsJson)
    {
        var collected = new List<StaticRawOptionSource>();
        AddRawStaticOptionSource(collected, "optionsPayload", optionsPayload);

        var normalizedDisplaySettings = NormalizeNullable(displaySettingsJson);
        if (normalizedDisplaySettings == null)
        {
            return collected;
        }

        try
        {
            using var document = JsonDocument.Parse(normalizedDisplaySettings);
            if (document.RootElement.ValueKind != JsonValueKind.Object)
            {
                return collected;
            }

            var legacyKeys = new[]
            {
                "optionsPayload",
                "options",
                "items",
                "values",
                "lookupOptions",
                "dropdownOptions",
                "sourceOptions",
                "cdmendTbl"
            };

            foreach (var key in legacyKeys)
            {
                if (!document.RootElement.TryGetProperty(key, out var valueElement))
                {
                    continue;
                }

                AddRawStaticOptionSource(
                    collected,
                    $"displaySettings.{key}",
                    SerializeOptionSourcePayload(valueElement));
            }
        }
        catch (JsonException)
        {
            // Ignore display-settings legacy options when payload is invalid.
        }

        return collected;
    }

    private static void AddRawStaticOptionSource(
        ICollection<StaticRawOptionSource> target,
        string sourceName,
        string? payload)
    {
        var normalizedPayload = NormalizeNullable(payload);
        if (normalizedPayload == null)
        {
            return;
        }

        var normalizedSourceName = NormalizeNullable(sourceName) ?? "unknown";
        var duplicate = target.Any(item =>
            string.Equals(item.Source, normalizedSourceName, StringComparison.OrdinalIgnoreCase)
            && string.Equals(item.Payload, normalizedPayload, StringComparison.Ordinal));
        if (duplicate)
        {
            return;
        }

        target.Add(new StaticRawOptionSource
        {
            Source = normalizedSourceName,
            Payload = normalizedPayload
        });
    }

    private static string? SerializeOptionSourcePayload(JsonElement valueElement)
    {
        return valueElement.ValueKind switch
        {
            JsonValueKind.String => NormalizeNullable(valueElement.GetString()),
            JsonValueKind.Null or JsonValueKind.Undefined => null,
            _ => NormalizeNullable(valueElement.GetRawText())
        };
    }

    private static bool TryInspectDisplaySettingsPayload(
        string? displaySettingsJson,
        out DisplaySettingsRuntimeInspection runtimeInspection,
        out string? validationError)
    {
        runtimeInspection = DisplaySettingsRuntimeInspection.Empty;
        validationError = null;

        var normalizedPayload = NormalizeNullable(displaySettingsJson);
        if (normalizedPayload == null)
        {
            return true;
        }

        try
        {
            using var displaySettingsDoc = JsonDocument.Parse(normalizedPayload);
            if (displaySettingsDoc.RootElement.ValueKind != JsonValueKind.Object)
            {
                validationError = "displaySettingsJson يجب أن يكون كائن JSON صالح.";
                return false;
            }

            if (!TryResolveDynamicRuntimePayload(
                displaySettingsDoc.RootElement,
                out var dynamicRuntimeElement,
                out validationError))
            {
                return false;
            }

            if (!dynamicRuntimeElement.HasValue)
            {
                return true;
            }

            var runtimePayload = dynamicRuntimeElement.Value;
            if (runtimePayload.ValueKind != JsonValueKind.Object)
            {
                validationError = "dynamicRuntime يجب أن يكون كائن JSON صالح.";
                return false;
            }

            var hasBehavioralRuntimeConfig = false;
            var hasOptionLoaderConfig = false;
            var hasExplicitDynamicOptionSource = false;
            string? dynamicOptionSourceKind = null;
            string? dynamicOptionSourceReason = null;
            string? optionLoaderRejectedReason = null;

            if (runtimePayload.TryGetProperty("optionLoader", out var optionLoaderElement))
            {
                if (optionLoaderElement.ValueKind != JsonValueKind.Object)
                {
                    validationError = "dynamicRuntime.optionLoader يجب أن يكون كائن JSON صالح.";
                    return false;
                }

                hasBehavioralRuntimeConfig = true;
                hasOptionLoaderConfig = true;

                if (!TryReadDynamicOptionSourceDetails(
                    optionLoaderElement,
                    out hasExplicitDynamicOptionSource,
                    out dynamicOptionSourceKind,
                    out dynamicOptionSourceReason,
                    out optionLoaderRejectedReason,
                    out validationError))
                {
                    return false;
                }
            }

            if (runtimePayload.TryGetProperty("asyncValidation", out var asyncValidationElement))
            {
                if (asyncValidationElement.ValueKind != JsonValueKind.Object)
                {
                    validationError = "dynamicRuntime.asyncValidation يجب أن يكون كائن JSON صالح.";
                    return false;
                }

                hasBehavioralRuntimeConfig = true;
            }

            if (runtimePayload.TryGetProperty("actions", out var actionsElement))
            {
                if (actionsElement.ValueKind != JsonValueKind.Array)
                {
                    validationError = "dynamicRuntime.actions يجب أن تكون مصفوفة JSON صالحة.";
                    return false;
                }

                hasBehavioralRuntimeConfig = true;
            }

            runtimeInspection = new DisplaySettingsRuntimeInspection
            {
                HasRuntimePayload = true,
                HasBehavioralRuntimeConfig = hasBehavioralRuntimeConfig,
                HasOptionLoaderConfig = hasOptionLoaderConfig,
                HasExplicitDynamicOptionSource = hasExplicitDynamicOptionSource,
                DynamicOptionSourceKind = dynamicOptionSourceKind,
                DynamicOptionSourceReason = dynamicOptionSourceReason,
                OptionLoaderRejectedReason = optionLoaderRejectedReason,
                DynamicRuntimePayloadPreview = TruncatePayloadForDiagnostics(runtimePayload.GetRawText())
            };

            return true;
        }
        catch (JsonException)
        {
            validationError = "JSON غير صالح في displaySettingsJson.";
            return false;
        }
    }

    private static bool TryReadDynamicOptionSourceDetails(
        JsonElement optionLoaderElement,
        out bool hasExplicitDynamicOptionSource,
        out string? dynamicOptionSourceKind,
        out string? dynamicOptionSourceReason,
        out string? optionLoaderRejectedReason,
        out string? validationError)
    {
        hasExplicitDynamicOptionSource = false;
        dynamicOptionSourceKind = null;
        dynamicOptionSourceReason = null;
        optionLoaderRejectedReason = null;
        validationError = null;

        if (optionLoaderElement.TryGetProperty("integration", out var integrationElement))
        {
            if (integrationElement.ValueKind != JsonValueKind.Object)
            {
                validationError = "dynamicRuntime.optionLoader.integration يجب أن يكون كائن JSON صالح.";
                return false;
            }

            var sourceType = (ReadJsonStringProperty(integrationElement, "sourceType") ?? string.Empty)
                .Trim()
                .ToLowerInvariant();
            var statementId = ReadPositiveIntProperty(integrationElement, "statementId");
            var fullUrl = ReadJsonStringProperty(integrationElement, "fullUrl");

            if ((sourceType == "powerbi" && statementId.HasValue)
                || (sourceType.Length == 0 && statementId.HasValue))
            {
                hasExplicitDynamicOptionSource = true;
                dynamicOptionSourceKind = "Internal";
                dynamicOptionSourceReason = "تم تفعيل المصدر الديناميكي عبر integration.statementId.";
                return true;
            }

            if ((sourceType == "external" && fullUrl != null)
                || (sourceType.Length == 0 && fullUrl != null))
            {
                hasExplicitDynamicOptionSource = true;
                dynamicOptionSourceKind = "External";
                dynamicOptionSourceReason = "تم تفعيل المصدر الديناميكي عبر integration.fullUrl.";
                return true;
            }
        }

        if (optionLoaderElement.TryGetProperty("request", out var requestElement))
        {
            if (requestElement.ValueKind != JsonValueKind.Object)
            {
                validationError = "dynamicRuntime.optionLoader.request يجب أن يكون كائن JSON صالح.";
                return false;
            }

            var requestUrl = ReadJsonStringProperty(requestElement, "url");
            if (requestUrl != null)
            {
                hasExplicitDynamicOptionSource = true;
                dynamicOptionSourceKind = "External";
                dynamicOptionSourceReason = "تم تفعيل المصدر الديناميكي عبر optionLoader.request.url.";
                return true;
            }
        }

        optionLoaderRejectedReason = "تم تجاهل optionLoader لأنه لا يحتوي integration/request صالح لتفعيل مصدر الخيارات الديناميكي.";
        return true;
    }

    private static string? ReadJsonStringProperty(JsonElement element, string propertyName)
    {
        if (!element.TryGetProperty(propertyName, out var valueElement))
        {
            return null;
        }

        return valueElement.ValueKind switch
        {
            JsonValueKind.String => NormalizeNullable(valueElement.GetString()),
            JsonValueKind.Number => NormalizeNullable(valueElement.ToString()),
            JsonValueKind.True => "true",
            JsonValueKind.False => "false",
            _ => null
        };
    }

    private static int? ReadPositiveIntProperty(JsonElement element, string propertyName)
    {
        if (!element.TryGetProperty(propertyName, out var valueElement))
        {
            return null;
        }

        if (valueElement.ValueKind == JsonValueKind.Number && valueElement.TryGetInt32(out var numericValue))
        {
            return numericValue > 0 ? numericValue : null;
        }

        if (valueElement.ValueKind != JsonValueKind.String)
        {
            return null;
        }

        var rawValue = NormalizeNullable(valueElement.GetString());
        if (rawValue == null)
        {
            return null;
        }

        if (int.TryParse(rawValue, NumberStyles.Integer, CultureInfo.InvariantCulture, out var parsedAsInvariant)
            && parsedAsInvariant > 0)
        {
            return parsedAsInvariant;
        }

        if (int.TryParse(rawValue, NumberStyles.Integer, CultureInfo.CurrentCulture, out var parsedAsCurrent)
            && parsedAsCurrent > 0)
        {
            return parsedAsCurrent;
        }

        return null;
    }

    private static bool TryResolveDynamicRuntimePayload(
        JsonElement displaySettingsRoot,
        out JsonElement? runtimePayload,
        out string? validationError)
    {
        runtimePayload = null;
        validationError = null;

        if (displaySettingsRoot.ValueKind != JsonValueKind.Object)
        {
            validationError = "displaySettingsJson يجب أن يكون كائن JSON صالح.";
            return false;
        }

        if (displaySettingsRoot.TryGetProperty("dynamicRuntime", out var dynamicRuntimeElement))
        {
            if (dynamicRuntimeElement.ValueKind == JsonValueKind.String)
            {
                var embeddedPayload = NormalizeNullable(dynamicRuntimeElement.GetString());
                if (embeddedPayload == null)
                {
                    return true;
                }

                try
                {
                    using var embeddedRuntimeDoc = JsonDocument.Parse(embeddedPayload);
                    runtimePayload = embeddedRuntimeDoc.RootElement.Clone();
                    return true;
                }
                catch (JsonException)
                {
                    validationError = "JSON غير صالح في dynamicRuntime.";
                    return false;
                }
            }

            runtimePayload = dynamicRuntimeElement.Clone();
            return true;
        }

        var hasDirectRuntimeMarkers = (displaySettingsRoot.TryGetProperty("optionLoader", out var directOptionLoader)
                && directOptionLoader.ValueKind == JsonValueKind.Object)
            || (displaySettingsRoot.TryGetProperty("asyncValidation", out var directAsyncValidation)
                && directAsyncValidation.ValueKind == JsonValueKind.Object)
            || (displaySettingsRoot.TryGetProperty("actions", out var directActions)
                && directActions.ValueKind == JsonValueKind.Array);
        if (hasDirectRuntimeMarkers)
        {
            runtimePayload = displaySettingsRoot.Clone();
        }

        return true;
    }

    private static (bool IsValid, HashSet<string> Values) ParseOptionValues(string? optionsPayload)
    {
        var values = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var payload = NormalizeNullable(optionsPayload);
        if (payload == null)
        {
            return (true, values);
        }

        var looksLikeJson = payload.StartsWith("{", StringComparison.Ordinal)
            || payload.StartsWith("[", StringComparison.Ordinal)
            || payload.StartsWith("\"", StringComparison.Ordinal);
        if (looksLikeJson)
        {
            if (TryParseOptionJsonPayload(payload, out var jsonRoot))
            {
                ExtractOptionValueTokens(jsonRoot, values);
                return (true, values);
            }

            return (false, values);
        }

        var rawTokens = payload
            .Split(new[] { '\r', '\n', '|', ';' }, StringSplitOptions.RemoveEmptyEntries)
            .Select(token => token.Trim())
            .Where(token => token.Length > 0)
            .ToList();
        if (rawTokens.Count == 1 && rawTokens[0].Contains(',', StringComparison.Ordinal))
        {
            rawTokens = rawTokens[0]
                .Split(',', StringSplitOptions.RemoveEmptyEntries)
                .Select(token => token.Trim())
                .Where(token => token.Length > 0)
                .ToList();
        }

        foreach (var token in rawTokens)
        {
            var pairSeparators = new[] { ':', '=' };
            var separatorIndex = token.IndexOfAny(pairSeparators);
            if (separatorIndex <= 0)
            {
                values.Add(token);
                continue;
            }

            var left = token.Substring(0, separatorIndex).Trim();
            if (left.Length > 0)
            {
                values.Add(left);
            }
        }

        return (true, values);
    }

    private static bool TryParseOptionJsonPayload(string payload, out JsonElement rootElement)
    {
        rootElement = default;
        var normalizedPayload = NormalizeNullable(payload);
        if (normalizedPayload == null)
        {
            return false;
        }

        if (TryParseOptionJsonPayloadCore(normalizedPayload, out rootElement))
        {
            return true;
        }

        var singleQuoteNormalized = normalizedPayload.Replace('\'', '"');
        if (TryParseOptionJsonPayloadCore(singleQuoteNormalized, out rootElement))
        {
            return true;
        }

        return false;
    }

    private static bool TryParseOptionJsonPayloadCore(string payload, out JsonElement rootElement)
    {
        rootElement = default;
        try
        {
            using var document = JsonDocument.Parse(payload);
            var root = document.RootElement.Clone();
            if (root.ValueKind == JsonValueKind.String)
            {
                var embedded = NormalizeNullable(root.GetString());
                if (embedded != null
                    && (embedded.StartsWith("{", StringComparison.Ordinal)
                        || embedded.StartsWith("[", StringComparison.Ordinal)))
                {
                    return TryParseOptionJsonPayload(embedded, out rootElement);
                }
            }

            rootElement = root;
            return true;
        }
        catch (JsonException)
        {
            return false;
        }
    }

    private static void ExtractOptionValueTokens(JsonElement element, ISet<string> collector)
    {
        if (collector == null)
        {
            return;
        }

        switch (element.ValueKind)
        {
            case JsonValueKind.Array:
                foreach (var item in element.EnumerateArray())
                {
                    ExtractOptionValueTokens(item, collector);
                }

                break;
            case JsonValueKind.Object:
                if (TryReadLegacyOptionValueToken(element, out var legacyValueToken)
                    && legacyValueToken != null)
                {
                    collector.Add(legacyValueToken);
                    break;
                }

                var containerKeys = new[]
                {
                    "options",
                    "items",
                    "data",
                    "values",
                    "lookupoptions",
                    "dropdownoptions",
                    "list",
                    "sourceoptions"
                };
                var hasContainer = false;
                foreach (var property in element.EnumerateObject())
                {
                    var normalizedKey = property.Name.Trim().ToLowerInvariant();
                    if (!containerKeys.Contains(normalizedKey, StringComparer.Ordinal))
                    {
                        continue;
                    }

                    hasContainer = true;
                    ExtractOptionValueTokens(property.Value, collector);
                }

                if (hasContainer)
                {
                    break;
                }

                foreach (var property in element.EnumerateObject())
                {
                    var normalizedKey = NormalizeNullable(property.Name);
                    if (normalizedKey == null)
                    {
                        continue;
                    }

                    if (property.Value.ValueKind is JsonValueKind.String
                        or JsonValueKind.Number
                        or JsonValueKind.True
                        or JsonValueKind.False)
                    {
                        collector.Add(normalizedKey);
                    }
                }

                break;
            case JsonValueKind.String:
            {
                var raw = NormalizeNullable(element.GetString());
                if (raw != null)
                {
                    collector.Add(raw);
                }

                break;
            }
            case JsonValueKind.Number:
            case JsonValueKind.True:
            case JsonValueKind.False:
            {
                var primitive = NormalizeNullable(element.ToString());
                if (primitive != null)
                {
                    collector.Add(primitive);
                }

                break;
            }
            default:
                break;
        }
    }

    private static bool TryReadLegacyOptionValueToken(JsonElement element, out string? token)
    {
        token = null;
        if (element.ValueKind != JsonValueKind.Object)
        {
            return false;
        }

        var candidateKeys = new[] { "value", "key", "id", "code" };
        foreach (var candidateKey in candidateKeys)
        {
            if (!element.TryGetProperty(candidateKey, out var valueElement))
            {
                continue;
            }

            var normalized = valueElement.ValueKind switch
            {
                JsonValueKind.String => NormalizeNullable(valueElement.GetString()),
                JsonValueKind.Number => NormalizeNullable(valueElement.ToString()),
                JsonValueKind.True => "true",
                JsonValueKind.False => "false",
                _ => null
            };
            if (normalized == null)
            {
                continue;
            }

            token = normalized;
            return true;
        }

        return false;
    }
    private static bool IsNumericFieldType(string fieldType, string dataType)
    {
        var normalizedFieldType = (fieldType ?? string.Empty).Trim().ToLowerInvariant();
        var normalizedDataType = (dataType ?? string.Empty).Trim().ToLowerInvariant();

        return normalizedFieldType.Contains("number", StringComparison.Ordinal)
            || normalizedFieldType.Contains("decimal", StringComparison.Ordinal)
            || normalizedFieldType.Contains("int", StringComparison.Ordinal)
            || normalizedDataType.Contains("number", StringComparison.Ordinal)
            || normalizedDataType.Contains("decimal", StringComparison.Ordinal)
            || normalizedDataType.Contains("int", StringComparison.Ordinal);
    }

    private static bool IsBooleanFieldType(string fieldType, string dataType)
    {
        var normalizedFieldType = (fieldType ?? string.Empty).Trim().ToLowerInvariant();
        var normalizedDataType = (dataType ?? string.Empty).Trim().ToLowerInvariant();

        return normalizedFieldType.Contains("check", StringComparison.Ordinal)
            || normalizedFieldType.Contains("bool", StringComparison.Ordinal)
            || normalizedFieldType.Contains("switch", StringComparison.Ordinal)
            || normalizedDataType.Contains("bool", StringComparison.Ordinal);
    }

    private static bool IsDateFieldType(string fieldType, string dataType)
    {
        var normalizedFieldType = (fieldType ?? string.Empty).Trim().ToLowerInvariant();
        var normalizedDataType = (dataType ?? string.Empty).Trim().ToLowerInvariant();

        return normalizedFieldType.Contains("date", StringComparison.Ordinal)
            || normalizedDataType.Contains("date", StringComparison.Ordinal)
            || normalizedDataType.Contains("time", StringComparison.Ordinal);
    }

    private static bool TryParseBooleanToken(string value, out bool parsed)
    {
        var normalized = (value ?? string.Empty).Trim().ToLowerInvariant();
        switch (normalized)
        {
            case "true":
            case "1":
            case "yes":
            case "y":
            case "on":
            case "نعم":
            case "صح":
                parsed = true;
                return true;
            case "false":
            case "0":
            case "no":
            case "n":
            case "off":
            case "لا":
            case "خطأ":
                parsed = false;
                return true;
            default:
                return bool.TryParse(normalized, out parsed);
        }
    }

    private static object BuildFieldUpsertDiagnosticsSnapshot(
        string? fieldKey,
        string? fieldLabel,
        string? fieldType,
        string? dataType,
        string? defaultValue,
        string? optionsPayload,
        string? displaySettingsJson,
        string? dynamicRuntimeJson,
        int? groupId,
        int? displayOrder,
        int? mendSql = null,
        int? cdmendSql = null,
        FieldOptionSourceDiagnostics? optionSourceDiagnostics = null,
        DisplaySettingsRuntimeInspection? runtimeInspection = null)
    {
        return new
        {
            fieldKey = NormalizeNullable(fieldKey),
            fieldLabel = NormalizeNullable(fieldLabel),
            fieldType = NormalizeNullable(fieldType),
            dataType = NormalizeNullable(dataType),
            defaultValue = NormalizeNullable(defaultValue),
            optionsPayload = TruncatePayloadForDiagnostics(optionsPayload),
            configJson = TruncatePayloadForDiagnostics(displaySettingsJson),
            dynamicJson = TruncatePayloadForDiagnostics(dynamicRuntimeJson),
            finalOptionSource = optionSourceDiagnostics?.EffectiveSource,
            finalOptionSourceReason = optionSourceDiagnostics?.EffectiveSourceReason,
            hasRuntimeConfig = runtimeInspection?.HasRuntimePayload ?? optionSourceDiagnostics?.HasRuntimePayload,
            hasBehavioralRuntimeConfig = runtimeInspection?.HasBehavioralRuntimeConfig ?? optionSourceDiagnostics?.HasBehavioralRuntimeConfig,
            hasOptionLoaderConfig = runtimeInspection?.HasOptionLoaderConfig ?? optionSourceDiagnostics?.HasOptionLoaderConfig,
            hasExplicitDynamicOptionSource = runtimeInspection?.HasExplicitDynamicOptionSource ?? optionSourceDiagnostics?.HasExplicitDynamicOptionSource,
            dynamicOptionSourceKind = runtimeInspection?.DynamicOptionSourceKind ?? optionSourceDiagnostics?.DynamicOptionSourceKind,
            dynamicOptionSourceReason = runtimeInspection?.DynamicOptionSourceReason ?? optionSourceDiagnostics?.DynamicOptionSourceReason,
            optionLoaderRejectedReason = runtimeInspection?.OptionLoaderRejectedReason ?? optionSourceDiagnostics?.OptionLoaderRejectedReason,
            staticOptionsPayloadValid = optionSourceDiagnostics?.IsStaticOptionsPayloadValid,
            staticOptionsCount = optionSourceDiagnostics?.StaticOptionsCount,
            normalizedOptionsCount = optionSourceDiagnostics?.StaticOptionsCount,
            rawOptionsSource = optionSourceDiagnostics?.RawOptionSourcesPreview,
            optionsPayloadIgnored = optionSourceDiagnostics?.IsStaticOptionsIgnored,
            optionsPayloadIgnoredReason = optionSourceDiagnostics?.StaticOptionsIgnoredReason,
            staticExcludedReason = optionSourceDiagnostics?.StaticOptionsExcludedReason,
            groupId,
            displayOrder,
            mendSql,
            cdmendSql
        };
    }

    private static string? TruncatePayloadForDiagnostics(string? payload)
    {
        var normalized = NormalizeNullable(payload);
        if (normalized == null)
        {
            return null;
        }

        if (normalized.Length <= DiagnosticsPayloadPreviewMaxLength)
        {
            return normalized;
        }

        return normalized.Substring(0, DiagnosticsPayloadPreviewMaxLength) + "...";
    }

    private static string BuildFieldUnhandledBusinessErrorMessage(string fieldKey, string operation)
    {
        var normalizedKey = NormalizeNullable(fieldKey);
        if (normalizedKey == null)
        {
            return $"تعذر {operation} الحقل بسبب خطأ داخلي غير متوقع. راجع سجل النظام.";
        }

        return $"فشل {operation} الحقل '{normalizedKey}' بسبب خطأ داخلي غير متوقع. راجع سجل النظام.";
    }

    private static string BuildFieldLinksUnhandledBusinessErrorMessage(string fieldKey, string stage)
    {
        var normalizedKey = NormalizeNullable(fieldKey);
        var normalizedStage = NormalizeNullable(stage);
        if (normalizedKey != null && normalizedStage != null)
        {
            return $"فشل حفظ الحقل '{normalizedKey}' أثناء مرحلة '{normalizedStage}' بسبب خطأ داخلي غير متوقع. راجع سجل النظام.";
        }

        if (normalizedKey != null)
        {
            return $"فشل حفظ الحقل '{normalizedKey}' بسبب خطأ داخلي غير متوقع. راجع سجل النظام.";
        }

        if (normalizedStage != null)
        {
            return $"فشل حفظ روابط الحقول أثناء مرحلة '{normalizedStage}' بسبب خطأ داخلي غير متوقع. راجع سجل النظام.";
        }

        return "فشل حفظ روابط الحقول بسبب خطأ داخلي غير متوقع. راجع سجل النظام.";
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

    private async Task SyncLegacyCategoryFieldBindingsAsync(
        int categoryId,
        IReadOnlyCollection<AdminCatalogCategoryFieldBinding> canonicalLinks,
        IReadOnlyDictionary<int, AdminCatalogCategoryGroup> canonicalGroupsById,
        CancellationToken cancellationToken)
    {
        if (categoryId <= 0)
        {
            return;
        }

        var safeLinks = (canonicalLinks ?? Array.Empty<AdminCatalogCategoryFieldBinding>())
            .Where(item => item.CategoryId == categoryId)
            .GroupBy(item => item.MendSql)
            .Select(group => group.First())
            .ToList();

        var canonicalGroupIds = safeLinks
            .Select(item => item.GroupId)
            .Where(item => item > 0)
            .Distinct()
            .ToList();

        var existingLegacyGroups = canonicalGroupIds.Count == 0
            ? new Dictionary<int, MandGroup>()
            : await _connectContext.MandGroups
                .Where(item => canonicalGroupIds.Contains(item.GroupId))
                .ToDictionaryAsync(item => item.GroupId, cancellationToken);

        var createdLegacyGroups = 0;
        foreach (var canonicalGroupId in canonicalGroupIds)
        {
            if (existingLegacyGroups.ContainsKey(canonicalGroupId))
            {
                continue;
            }

            canonicalGroupsById.TryGetValue(canonicalGroupId, out var canonicalGroup);
            var fallbackName = NormalizeNullable(canonicalGroup?.GroupName)
                ?? $"مجموعة {canonicalGroupId}";
            var fallbackDescription = NormalizeNullable(canonicalGroup?.GroupDescription);

            var safeGroupName = fallbackName.Length > GroupNameMaxLength
                ? fallbackName.Substring(0, GroupNameMaxLength)
                : fallbackName;
            var safeGroupDescription = fallbackDescription != null && fallbackDescription.Length > GroupDescriptionMaxLength
                ? fallbackDescription.Substring(0, GroupDescriptionMaxLength)
                : fallbackDescription;

            var legacyGroup = new MandGroup
            {
                GroupId = canonicalGroupId,
                GroupName = safeGroupName,
                GroupDescription = safeGroupDescription,
                IsExtendable = false,
                GroupWithInRow = 12
            };
            await _connectContext.MandGroups.AddAsync(legacyGroup, cancellationToken);
            existingLegacyGroups[legacyGroup.GroupId] = legacyGroup;
            createdLegacyGroups++;
        }

        if (createdLegacyGroups > 0)
        {
            await _connectContext.SaveChangesAsync(cancellationToken);
        }

        var legacyLinks = await _connectContext.CdCategoryMands
            .Where(item => item.MendCategory == categoryId)
            .ToListAsync(cancellationToken);
        var legacyByMendSql = legacyLinks
            .GroupBy(item => item.MendSql)
            .ToDictionary(group => group.Key, group => group.First());

        var hasChanges = false;
        foreach (var canonicalLink in safeLinks)
        {
            if (!legacyByMendSql.TryGetValue(canonicalLink.MendSql, out var legacyLink))
            {
                legacyLink = new CdCategoryMand
                {
                    MendSql = canonicalLink.MendSql,
                    MendCategory = categoryId,
                    MendField = canonicalLink.MendField,
                    MendGroup = canonicalLink.GroupId,
                    MendStat = canonicalLink.MendStat
                };
                await _connectContext.CdCategoryMands.AddAsync(legacyLink, cancellationToken);
                legacyLinks.Add(legacyLink);
                legacyByMendSql[legacyLink.MendSql] = legacyLink;
                hasChanges = true;
                continue;
            }

            if (!string.Equals(legacyLink.MendField, canonicalLink.MendField, StringComparison.OrdinalIgnoreCase))
            {
                legacyLink.MendField = canonicalLink.MendField;
                hasChanges = true;
            }

            if (legacyLink.MendGroup != canonicalLink.GroupId)
            {
                legacyLink.MendGroup = canonicalLink.GroupId;
                hasChanges = true;
            }

            if (legacyLink.MendStat != canonicalLink.MendStat)
            {
                legacyLink.MendStat = canonicalLink.MendStat;
                hasChanges = true;
            }
        }

        var safeMendSqls = safeLinks
            .Select(item => item.MendSql)
            .ToHashSet();
        foreach (var legacyLink in legacyLinks.Where(item => !safeMendSqls.Contains(item.MendSql)))
        {
            if (!legacyLink.MendStat)
            {
                legacyLink.MendStat = true;
                hasChanges = true;
            }
        }

        if (hasChanges)
        {
            await _connectContext.SaveChangesAsync(cancellationToken);
        }
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
        var adminGroups = await _connectContext.AdminCatalogCategoryGroups
            .AsNoTracking()
            .Where(item => item.CategoryId == categoryId && item.IsActive)
            .ToListAsync(cancellationToken);
        var adminGroupById = adminGroups
            .GroupBy(item => item.GroupId)
            .ToDictionary(group => group.Key, group => group.First());

        int ResolveGroupDisplayOrder(int groupId)
        {
            return adminGroupById.TryGetValue(groupId, out var group)
                ? group.DisplayOrder
                : int.MaxValue;
        }

        string ResolveGroupName(int groupId, string? fallbackName = null)
        {
            if (adminGroupById.TryGetValue(groupId, out var group)
                && NormalizeNullable(group.GroupName) is { } groupName)
            {
                return groupName;
            }

            if (NormalizeNullable(fallbackName) is { } fallback)
            {
                return fallback;
            }

            return $"مجموعة {groupId}";
        }

        var linkRows = await (from link in _connectContext.AdminCatalogCategoryFieldBindings.AsNoTracking()
                              join setting in _connectContext.SubjectCategoryFieldSettings.AsNoTracking()
                                  on link.MendSql equals setting.MendSql into settingJoin
                              from setting in settingJoin.DefaultIfEmpty()
                              join groupNode in _connectContext.AdminCatalogCategoryGroups.AsNoTracking()
                                  on link.GroupId equals groupNode.GroupId into groupJoin
                              from groupNode in groupJoin.DefaultIfEmpty()
                              where link.CategoryId == categoryId
                              select new
                              {
                                  link.MendSql,
                                  MendCategory = link.CategoryId,
                                  link.MendField,
                                  MendGroup = link.GroupId,
                                  link.MendStat,
                                  GroupName = groupNode != null ? groupNode.GroupName : null,
                                  GroupDisplayOrder = groupNode != null ? groupNode.DisplayOrder : int.MaxValue,
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
            .OrderBy(row => ResolveGroupDisplayOrder(row.MendGroup))
            .ThenBy(row => row.MendGroup)
            .ThenBy(row => row.DisplayOrder)
            .ThenBy(row => row.MendSql)
            .Select(row =>
            {
                var normalizedFieldKey = NormalizeFieldKey(row.MendField);
                fieldLookup.TryGetValue(normalizedFieldKey, out var candidates);
                var selectedMetadata = SelectPreferredMend(
                    candidates ?? Array.Empty<Cdmend>(),
                    normalizedRequestAppId: string.Empty,
                    normalizedCategoryAppId: categoryAppId,
                    out _);
                var canonicalGroupId = row.MendGroup;

                return new SubjectCategoryFieldLinkAdminDto
                {
                    MendSql = row.MendSql,
                    CategoryId = row.MendCategory,
                    FieldKey = row.MendField,
                    FieldLabel = selectedMetadata?.CDMendLbl ?? row.MendField,
                    FieldType = selectedMetadata?.CdmendType,
                    GroupId = canonicalGroupId,
                    GroupName = ResolveGroupName(canonicalGroupId, row.GroupName),
                    IsActive = !row.MendStat,
                    DisplayOrder = row.DisplayOrder,
                    IsVisible = row.IsVisible,
                    DisplaySettingsJson = row.DisplaySettingsJson,
                    ApplicationId = selectedMetadata?.ApplicationId
                };
            })
            .ToList();

        return mapped;
    }

    private sealed class NormalizedFieldLinkRequestItem
    {
        public int RowNumber { get; init; }

        public int? MendSql { get; init; }

        public string? FieldKey { get; init; }

        public int GroupId { get; init; }

        public bool IsActive { get; init; }

        public int DisplayOrder { get; init; }

        public bool IsVisible { get; init; }

        public string? DisplaySettingsJson { get; init; }
    }

    private sealed class DisplaySettingsRuntimeInspection
    {
        public static DisplaySettingsRuntimeInspection Empty { get; } = new();

        public bool HasRuntimePayload { get; init; }

        public bool HasBehavioralRuntimeConfig { get; init; }

        public bool HasOptionLoaderConfig { get; init; }

        public bool HasExplicitDynamicOptionSource { get; init; }

        public string? DynamicOptionSourceKind { get; init; }

        public string? DynamicOptionSourceReason { get; init; }

        public string? OptionLoaderRejectedReason { get; init; }

        public string? DynamicRuntimePayloadPreview { get; init; }
    }

    private sealed class FieldOptionSourceDiagnostics
    {
        public string EffectiveSource { get; init; } = "None";

        public string EffectiveSourceReason { get; init; } = string.Empty;

        public bool HasRuntimePayload { get; init; }

        public bool HasBehavioralRuntimeConfig { get; init; }

        public bool HasOptionLoaderConfig { get; init; }

        public bool HasExplicitDynamicOptionSource { get; init; }

        public string? DynamicOptionSourceKind { get; init; }

        public string? DynamicOptionSourceReason { get; init; }

        public string? OptionLoaderRejectedReason { get; init; }

        public bool HasStaticOptionsPayload { get; init; }

        public bool IsStaticOptionsPayloadValid { get; init; }

        public int StaticOptionsCount { get; init; }

        public bool IsStaticOptionsIgnored { get; init; }

        public string? StaticOptionsIgnoredReason { get; init; }

        public string? StaticOptionsExcludedReason { get; init; }

        public IReadOnlyList<string> RawOptionSourcesPreview { get; init; } = Array.Empty<string>();
    }

    private sealed class StaticOptionsResolutionDiagnostics
    {
        public static StaticOptionsResolutionDiagnostics Empty { get; } = new()
        {
            State = "missing",
            RawOptionSourceCount = 0,
            RawOptionSourcePreviews = Array.Empty<string>(),
            NormalizedValues = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        };

        public string State { get; init; } = "missing";

        public int RawOptionSourceCount { get; init; }

        public IReadOnlyList<string> RawOptionSourcePreviews { get; init; } = Array.Empty<string>();

        public HashSet<string> NormalizedValues { get; init; } = new(StringComparer.OrdinalIgnoreCase);

        public int InvalidSourceCount { get; init; }

        public int EmptySourceCount { get; init; }

        public string? InvalidReason { get; init; }
    }

    private sealed class StaticRawOptionSource
    {
        public string Source { get; init; } = string.Empty;

        public string Payload { get; init; } = string.Empty;
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
