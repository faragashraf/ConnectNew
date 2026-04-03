using Microsoft.EntityFrameworkCore;
using Models.Correspondance;
using Models.DTO.Common;
using Models.DTO.DynamicSubjects;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace Persistence.Services.DynamicSubjects;

public sealed partial class DynamicSubjectsService
{
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
            var categoryName = (safeRequest.CategoryName ?? string.Empty).Trim();
            if (categoryName.Length == 0)
            {
                response.Errors.Add(new Error { Code = "400", Message = "اسم النوع مطلوب." });
                return response;
            }

            if (safeRequest.ParentCategoryId > 0)
            {
                var parentExists = await _connectContext.Cdcategories
                    .AsNoTracking()
                    .AnyAsync(item => item.CatId == safeRequest.ParentCategoryId, cancellationToken);
                if (!parentExists)
                {
                    response.Errors.Add(new Error { Code = "404", Message = "النوع الأب غير موجود." });
                    return response;
                }
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
                To = NormalizeNullable(safeRequest.To),
                Cc = NormalizeNullable(safeRequest.Cc),
                StampDate = DateTime.Now,
                CatCreatedBy = int.TryParse(normalizedUserId, out var parsedCreator) ? parsedCreator : null,
                ApplicationId = NormalizeNullable(safeRequest.ApplicationId)
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
        catch (Exception ex)
        {
            response.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });
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

            category.CatName = categoryName;
            category.ApplicationId = NormalizeNullable(safeRequest.ApplicationId);
            category.CatMend = NormalizeNullable(safeRequest.CatMend);
            category.CatWorkFlow = safeRequest.CatWorkFlow;
            category.CatSms = safeRequest.CatSms;
            category.CatMailNotification = safeRequest.CatMailNotification;
            category.To = NormalizeNullable(safeRequest.To);
            category.Cc = NormalizeNullable(safeRequest.Cc);
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
        catch (Exception ex)
        {
            response.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });
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
        catch (Exception ex)
        {
            response.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });
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

            var category = await _connectContext.Cdcategories
                .FirstOrDefaultAsync(item => item.CatId == categoryId, cancellationToken);
            if (category == null)
            {
                response.Errors.Add(new Error { Code = "404", Message = "النوع غير موجود." });
                return response;
            }

            var safeRequest = request ?? new SubjectTypeAdminStatusRequestDto();
            category.CatStatus = !safeRequest.IsActive;

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
        catch (Exception ex)
        {
            response.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });
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
            await RebalanceCategoryDisplayOrderAsync(newParentId, normalizedUserId, cancellationToken, categoryId, safeRequest.NewIndex);

            response.Data = (await GetAdminCategoryTreeAsync(normalizedUserId, appId: null, cancellationToken)).Data ?? new List<SubjectTypeAdminDto>();
        }
        catch (Exception ex)
        {
            response.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });
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
            if (!string.IsNullOrWhiteSpace(appId))
            {
                query = query.Where(item =>
                    string.Equals(item.ApplicationId ?? string.Empty, appId, StringComparison.OrdinalIgnoreCase));
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
        catch (Exception ex)
        {
            response.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });
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

            var field = new Cdmend
            {
                CdmendSql = nextSql,
                CdmendTxt = fieldKey,
                CdmendType = fieldType,
                CDMendLbl = NormalizeNullable(safeRequest.FieldLabel) ?? fieldKey,
                Placeholder = NormalizeNullable(safeRequest.Placeholder),
                DefaultValue = NormalizeNullable(safeRequest.DefaultValue),
                CdmendTbl = NormalizeNullable(safeRequest.OptionsPayload),
                CdmendDatatype = NormalizeNullable(safeRequest.DataType),
                Required = safeRequest.Required,
                RequiredTrue = safeRequest.RequiredTrue,
                Email = safeRequest.Email,
                Pattern = safeRequest.Pattern,
                MinValue = NormalizeNullable(safeRequest.MinValue),
                MaxValue = NormalizeNullable(safeRequest.MaxValue),
                Cdmendmask = NormalizeNullable(safeRequest.Mask),
                CdmendStat = !safeRequest.IsActive,
                Width = safeRequest.Width,
                Height = safeRequest.Height,
                IsDisabledInit = safeRequest.IsDisabledInit,
                IsSearchable = safeRequest.IsSearchable,
                ApplicationId = NormalizeNullable(safeRequest.ApplicationId)
            };

            await _connectContext.Cdmends.AddAsync(field, cancellationToken);
            await _connectContext.SaveChangesAsync(cancellationToken);

            response.Data = MapAdminField(field, new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase));
        }
        catch (Exception ex)
        {
            response.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });
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
            field.CDMendLbl = NormalizeNullable(safeRequest.FieldLabel) ?? newFieldKey;
            field.Placeholder = NormalizeNullable(safeRequest.Placeholder);
            field.DefaultValue = NormalizeNullable(safeRequest.DefaultValue);
            field.CdmendTbl = NormalizeNullable(safeRequest.OptionsPayload);
            field.CdmendDatatype = NormalizeNullable(safeRequest.DataType);
            field.Required = safeRequest.Required;
            field.RequiredTrue = safeRequest.RequiredTrue;
            field.Email = safeRequest.Email;
            field.Pattern = safeRequest.Pattern;
            field.MinValue = NormalizeNullable(safeRequest.MinValue);
            field.MaxValue = NormalizeNullable(safeRequest.MaxValue);
            field.Cdmendmask = NormalizeNullable(safeRequest.Mask);
            field.CdmendStat = !safeRequest.IsActive;
            field.Width = safeRequest.Width;
            field.Height = safeRequest.Height;
            field.IsDisabledInit = safeRequest.IsDisabledInit;
            field.IsSearchable = safeRequest.IsSearchable;
            field.ApplicationId = NormalizeNullable(safeRequest.ApplicationId);

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
        catch (Exception ex)
        {
            response.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });
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
        catch (Exception ex)
        {
            response.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });
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
        catch (Exception ex)
        {
            response.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });
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

            var nextId = (await _connectContext.MandGroups
                .AsNoTracking()
                .MaxAsync(item => (int?)item.GroupId, cancellationToken) ?? 0) + 1;

            var group = new MandGroup
            {
                GroupId = nextId,
                GroupName = groupName,
                GroupDescription = NormalizeNullable(safeRequest.GroupDescription),
                IsExtendable = safeRequest.IsExtendable,
                GroupWithInRow = safeRequest.GroupWithInRow
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
        catch (Exception ex)
        {
            response.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });
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

            group.GroupName = groupName;
            group.GroupDescription = NormalizeNullable(safeRequest.GroupDescription);
            group.IsExtendable = safeRequest.IsExtendable;
            group.GroupWithInRow = safeRequest.GroupWithInRow;

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
        catch (Exception ex)
        {
            response.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });
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
        catch (Exception ex)
        {
            response.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });
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
        catch (Exception ex)
        {
            response.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });
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
                    DisplayOrder = item.DisplayOrder,
                    IsVisible = item.IsVisible,
                    DisplaySettingsJson = NormalizeNullable(item.DisplaySettingsJson)
                })
                .ToList();

            var requestedFieldKeys = safeItems
                .Select(item => item.FieldKey)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
            var existingFields = await _connectContext.Cdmends
                .AsNoTracking()
                .Where(item => requestedFieldKeys.Contains(item.CdmendTxt))
                .Select(item => item.CdmendTxt)
                .ToListAsync(cancellationToken);
            var existingFieldsSet = existingFields.ToHashSet(StringComparer.OrdinalIgnoreCase);
            var missingField = requestedFieldKeys.FirstOrDefault(key => !existingFieldsSet.Contains(key));
            if (!string.IsNullOrWhiteSpace(missingField))
            {
                response.Errors.Add(new Error { Code = "400", Message = $"الحقل '{missingField}' غير موجود." });
                return response;
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

            var touchedMendSql = new HashSet<int>();

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

                if (link.MendSql > 0)
                {
                    touchedMendSql.Add(link.MendSql);
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

                touchedMendSql.Add(link.MendSql);
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
            response.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });
        }

        return response;
    }

    public Task<CommonResponse<SubjectFormDefinitionDto>> GetAdminPreviewAsync(
        int categoryId,
        string userId,
        string? appId,
        CancellationToken cancellationToken = default)
    {
        return GetFormDefinitionAsync(categoryId, userId, appId, cancellationToken);
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
        return await (from link in _connectContext.CdCategoryMands.AsNoTracking()
                      join field in _connectContext.Cdmends.AsNoTracking()
                          on link.MendField equals field.CdmendTxt
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
                      select new SubjectCategoryFieldLinkAdminDto
                      {
                          MendSql = link.MendSql,
                          CategoryId = link.MendCategory,
                          FieldKey = link.MendField,
                          FieldLabel = field.CDMendLbl,
                          FieldType = field.CdmendType,
                          GroupId = link.MendGroup,
                          GroupName = mandGroup != null ? mandGroup.GroupName : null,
                          IsActive = !link.MendStat,
                          DisplayOrder = setting != null ? setting.DisplayOrder : link.MendSql,
                          IsVisible = setting == null || setting.IsVisible,
                          DisplaySettingsJson = setting != null ? setting.DisplaySettingsJson : null,
                          ApplicationId = field.ApplicationId
                      }).ToListAsync(cancellationToken);
    }
}
