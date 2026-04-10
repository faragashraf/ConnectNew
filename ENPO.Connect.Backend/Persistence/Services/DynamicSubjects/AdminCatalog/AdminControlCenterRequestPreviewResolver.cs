using Microsoft.EntityFrameworkCore;
using Models.Correspondance;
using Models.DTO.Common;
using Models.DTO.DynamicSubjects;
using Persistence.Data;
using Persistence.Services.DynamicSubjects.FieldAccess;

namespace Persistence.Services.DynamicSubjects.AdminCatalog;

public sealed class AdminControlCenterRequestPreviewResolver : IAdminControlCenterRequestPreviewResolver
{
    private readonly ConnectContext _connectContext;
    private readonly IFieldAccessResolutionService _fieldAccessResolutionService;

    public AdminControlCenterRequestPreviewResolver(
        ConnectContext connectContext,
        IFieldAccessResolutionService fieldAccessResolutionService)
    {
        _connectContext = connectContext;
        _fieldAccessResolutionService = fieldAccessResolutionService;
    }

    public async Task<CommonResponse<AdminControlCenterRequestPreviewDto>> ResolveAsync(
        int requestTypeId,
        string userId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<AdminControlCenterRequestPreviewDto>();

        try
        {
            var normalizedUserId = NormalizeNullable(userId);
            if (normalizedUserId == null)
            {
                response.Errors.Add(new Error { Code = "401", Message = "المستخدم غير مصرح له." });
                return response;
            }

            if (requestTypeId <= 0)
            {
                response.Errors.Add(new Error { Code = "400", Message = "نوع الطلب مطلوب." });
                return response;
            }

            var category = await _connectContext.Cdcategories
                .AsNoTracking()
                .FirstOrDefaultAsync(item => item.CatId == requestTypeId, cancellationToken);
            if (category == null)
            {
                response.Errors.Add(new Error { Code = "404", Message = "نوع الطلب غير موجود." });
                return response;
            }

            var availability = await _connectContext.SubjectTypeRequestAvailabilities
                .AsNoTracking()
                .FirstOrDefaultAsync(item => item.CategoryId == requestTypeId, cancellationToken);

            var warnings = new List<string>();
            var availabilityReasons = new List<string>();

            var isAvailable = !category.CatStatus;
            if (category.CatStatus)
            {
                availabilityReasons.Add("نوع الطلب غير مفعل في جدول CDCategory.");
            }

            var availabilityEvaluation = EvaluateAvailability(availability);
            isAvailable = isAvailable && availabilityEvaluation.IsAvailable;
            availabilityReasons.AddRange(availabilityEvaluation.Reasons);
            warnings.AddRange(availabilityEvaluation.Warnings);

            var fieldBindingRows = await LoadFieldBindingRowsAsync(requestTypeId, cancellationToken);
            if (fieldBindingRows.Count == 0)
            {
                warnings.Add("لا توجد روابط حقول نشطة لهذا النوع داخل AdminCatalogCategoryFieldBindings.");
            }

            var categoryApplicationId = NormalizeNullable(category.ApplicationId);
            var fieldKeys = fieldBindingRows
                .Select(item => NormalizeFieldKey(item.MendField))
                .Where(item => item.Length > 0)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            var mends = fieldKeys.Count == 0
                ? new List<Cdmend>()
                : await _connectContext.Cdmends
                    .AsNoTracking()
                    .Where(item => fieldKeys.Contains(item.CdmendTxt))
                    .ToListAsync(cancellationToken);

            var mendByKey = BuildMendLookup(mends, categoryApplicationId);
            var metadata = BuildFieldMetadata(requestTypeId, fieldBindingRows, mendByKey, warnings);

            FieldAccessResolutionResult resolution;
            if (metadata.Fields.Count == 0)
            {
                resolution = new FieldAccessResolutionResult();
            }
            else
            {
                resolution = await _fieldAccessResolutionService.ResolveAsync(
                    new FieldAccessResolutionRequest
                    {
                        RequestTypeId = requestTypeId,
                        RequestId = null,
                        StageId = null,
                        ActionId = null,
                        UserId = "SYSTEM_PREVIEW",
                        Groups = metadata.Groups,
                        Fields = metadata.Fields,
                        SubjectContextOverride = new FieldAccessSubjectContextOverride
                        {
                            SubjectType = "RequestOwner"
                        }
                    },
                    cancellationToken);
            }

            var preview = new AdminControlCenterRequestPreviewDto
            {
                RequestTypeId = requestTypeId,
                RequestTypeName = NormalizeNullable(category.CatName) ?? $"Request Type {requestTypeId}",
                IsAvailable = isAvailable,
                AvailabilityReasons = DistinctInOrder(availabilityReasons),
                Fields = BuildPreviewFields(metadata.Fields, resolution, warnings),
                Warnings = DistinctInOrder(warnings)
            };

            if (preview.Fields.Count == 0)
            {
                warnings.Add("لم يتم توليد أي حقول للمعاينة الفعلية.");
                preview.Warnings = DistinctInOrder(warnings);
            }

            response.Data = preview;
        }
        catch
        {
            response.Errors.Add(new Error { Code = "500", Message = "حدث خطأ غير متوقع أثناء توليد المعاينة." });
        }

        return response;
    }

    private async Task<List<FieldBindingRow>> LoadFieldBindingRowsAsync(
        int requestTypeId,
        CancellationToken cancellationToken)
    {
        return await (from link in _connectContext.AdminCatalogCategoryFieldBindings.AsNoTracking()
                      join fieldSetting in _connectContext.SubjectCategoryFieldSettings.AsNoTracking()
                          on link.MendSql equals fieldSetting.MendSql into fieldSettingJoin
                      from fieldSetting in fieldSettingJoin.DefaultIfEmpty()
                      join groupNode in _connectContext.AdminCatalogCategoryGroups.AsNoTracking()
                          on link.GroupId equals groupNode.GroupId into groupJoin
                      from groupNode in groupJoin.DefaultIfEmpty()
                      where link.CategoryId == requestTypeId && !link.MendStat
                      select new FieldBindingRow
                      {
                          MendSql = link.MendSql,
                          MendField = link.MendField,
                          GroupId = link.GroupId,
                          IsVisible = fieldSetting != null ? fieldSetting.IsVisible : null,
                          DisplayOrder = fieldSetting != null ? fieldSetting.DisplayOrder : null,
                          GroupDisplayOrder = groupNode != null ? groupNode.DisplayOrder : int.MaxValue,
                          GroupName = groupNode != null ? groupNode.GroupName : null,
                          GroupDescription = groupNode != null ? groupNode.GroupDescription : null
                      })
            .ToListAsync(cancellationToken);
    }

    private static (List<SubjectGroupDefinitionDto> Groups, List<SubjectFieldDefinitionDto> Fields) BuildFieldMetadata(
        int requestTypeId,
        IReadOnlyCollection<FieldBindingRow> fieldBindingRows,
        IReadOnlyDictionary<string, Cdmend> mendByKey,
        ICollection<string> warnings)
    {
        var groups = new List<SubjectGroupDefinitionDto>();
        var groupsById = new Dictionary<int, SubjectGroupDefinitionDto>();
        var fields = new List<SubjectFieldDefinitionDto>();

        foreach (var row in fieldBindingRows
                     .OrderBy(item => item.GroupDisplayOrder)
                     .ThenBy(item => item.GroupName ?? string.Empty)
                     .ThenBy(item => item.GroupId)
                     .ThenBy(item => item.DisplayOrder ?? item.MendSql)
                     .ThenBy(item => item.MendSql))
        {
            if (!groupsById.TryGetValue(row.GroupId, out var group))
            {
                group = new SubjectGroupDefinitionDto
                {
                    GroupId = row.GroupId,
                    GroupName = NormalizeNullable(row.GroupName) ?? $"مجموعة {row.GroupId}",
                    GroupDescription = NormalizeNullable(row.GroupDescription),
                    IsExtendable = false,
                    GroupWithInRow = 12
                };

                groupsById[row.GroupId] = group;
                groups.Add(group);
            }

            var normalizedFieldKey = NormalizeFieldKey(row.MendField);
            mendByKey.TryGetValue(normalizedFieldKey, out var mend);

            if (mend == null)
            {
                warnings.Add($"الحقل المرتبط '{NormalizeNullable(row.MendField) ?? row.MendSql.ToString()}' لا يملك تعريفًا في جدول CDMend.");
            }
            else if (mend.CdmendStat)
            {
                warnings.Add($"الحقل '{NormalizeNullable(mend.CDMendLbl) ?? mend.CdmendTxt}' مرتبط لكنه غير مفعل في CDMend.");
            }

            var resolvedFieldKey = NormalizeNullable(mend?.CdmendTxt)
                ?? NormalizeNullable(row.MendField)
                ?? $"Field_{row.MendSql}";

            fields.Add(new SubjectFieldDefinitionDto
            {
                MendSql = row.MendSql,
                CategoryId = requestTypeId,
                MendGroup = row.GroupId,
                FieldKey = resolvedFieldKey,
                FieldType = NormalizeNullable(mend?.CdmendType) ?? "InputText",
                FieldLabel = NormalizeNullable(mend?.CDMendLbl)
                    ?? NormalizeNullable(row.MendField)
                    ?? resolvedFieldKey,
                Placeholder = mend?.Placeholder,
                DefaultValue = mend?.DefaultValue,
                OptionsPayload = mend?.CdmendTbl,
                DataType = mend?.CdmendDatatype,
                Required = mend?.Required == true,
                RequiredTrue = mend?.RequiredTrue == true,
                Email = mend?.Email == true,
                Pattern = mend?.Pattern == true,
                MinValue = mend?.MinValue,
                MaxValue = mend?.MaxValue,
                Mask = mend?.Cdmendmask,
                IsDisabledInit = mend?.IsDisabledInit == true,
                IsSearchable = mend?.IsSearchable == true,
                Width = mend?.Width ?? 0,
                Height = mend?.Height ?? 0,
                ApplicationId = mend?.ApplicationId,
                DisplayOrder = row.DisplayOrder ?? row.MendSql,
                IsVisible = row.IsVisible ?? true,
                Group = group
            });
        }

        return (groups, fields);
    }

    private static Dictionary<string, Cdmend> BuildMendLookup(
        IReadOnlyCollection<Cdmend> mends,
        string? categoryApplicationId)
    {
        return (mends ?? Array.Empty<Cdmend>())
            .GroupBy(item => NormalizeFieldKey(item.CdmendTxt), StringComparer.OrdinalIgnoreCase)
            .Where(group => group.Key.Length > 0)
            .ToDictionary(
                group => group.Key,
                group => group
                    .OrderBy(item => item.CdmendStat ? 1 : 0)
                    .ThenBy(item => MendApplicationRank(item.ApplicationId, categoryApplicationId))
                    .ThenBy(item => item.CdmendSql)
                    .First(),
                StringComparer.OrdinalIgnoreCase);
    }

    private static List<AdminControlCenterRequestPreviewFieldDto> BuildPreviewFields(
        IReadOnlyCollection<SubjectFieldDefinitionDto> fields,
        FieldAccessResolutionResult resolution,
        ICollection<string> warnings)
    {
        var safeResolution = resolution ?? new FieldAccessResolutionResult();
        var items = new List<AdminControlCenterRequestPreviewFieldDto>();

        foreach (var field in (fields ?? Array.Empty<SubjectFieldDefinitionDto>())
                     .OrderBy(item => item.MendGroup)
                     .ThenBy(item => item.DisplayOrder)
                     .ThenBy(item => item.MendSql))
        {
            safeResolution.FieldStatesByMendSql.TryGetValue(field.MendSql, out var state);

            var reasons = new List<string>();
            if (state != null)
            {
                foreach (var trace in state.AppliedTraces ?? new List<FieldAccessAppliedTrace>())
                {
                    var description = NormalizeNullable(trace.DescriptionAr);
                    if (description != null)
                    {
                        reasons.Add(description);
                    }
                }

                AddIfNotEmpty(reasons, state.EffectiveReasonAr);
                AddIfNotEmpty(reasons, state.LockReason);
            }
            else
            {
                warnings.Add($"لم يتم إرجاع حالة وصول للحقل #{field.MendSql}. تم استخدام القيم الأساسية.");
            }

            if (reasons.Count == 0)
            {
                reasons.Add("لا توجد قواعد مطابقة، وتم اعتماد الحالة الافتراضية الحالية.");
            }

            items.Add(new AdminControlCenterRequestPreviewFieldDto
            {
                FieldId = field.MendSql,
                FieldName = NormalizeNullable(field.FieldLabel)
                    ?? NormalizeNullable(field.FieldKey)
                    ?? $"Field #{field.MendSql}",
                IsVisible = state?.CanView ?? field.IsVisible,
                IsRequired = state?.IsRequired ?? field.Required,
                Reasons = DistinctInOrder(reasons)
            });
        }

        return items;
    }

    private static (bool IsAvailable, List<string> Reasons, List<string> Warnings) EvaluateAvailability(
        SubjectTypeRequestAvailability? availability)
    {
        var reasons = new List<string>();
        var warnings = new List<string>();

        if (availability == null)
        {
            reasons.Add("لا يوجد سجل إتاحة محفوظ؛ تم اعتماد الوضع الافتراضي Public (متاح).");
            return (true, reasons, warnings);
        }

        if (!TryNormalizeAvailabilityMode(availability.AvailabilityMode, out var mode))
        {
            reasons.Add("نمط الإتاحة غير معروف، لذلك تم اعتباره غير متاح حتى تصحيح الإعداد.");
            warnings.Add($"قيمة AvailabilityMode الحالية غير مدعومة: '{availability.AvailabilityMode}'.");
            return (false, reasons, warnings);
        }

        if (string.Equals(mode, "Public", StringComparison.OrdinalIgnoreCase))
        {
            reasons.Add("نمط الإتاحة الحالي Public: نوع الطلب متاح لجميع المستخدمين المسجلين.");
            return (true, reasons, warnings);
        }

        reasons.Add("نمط الإتاحة الحالي Restricted: نوع الطلب متاح لفئة تنظيمية محددة.");

        if (!TryNormalizeSelectedNodeType(availability.SelectedNodeType, out var selectedNodeType))
        {
            reasons.Add("الإتاحة المقيّدة غير مكتملة لأن SelectedNodeType غير صالح.");
            warnings.Add("SelectedNodeType مفقود أو غير مدعوم رغم أن AvailabilityMode = Restricted.");
            return (false, reasons, warnings);
        }

        if (string.Equals(selectedNodeType, "SpecificUser", StringComparison.OrdinalIgnoreCase))
        {
            var selectedUserId = NormalizeNullable(availability.SelectedNodeUserId);
            if (selectedUserId == null)
            {
                reasons.Add("الإتاحة المقيّدة غير مكتملة لأن SelectedNodeUserId غير محدد.");
                warnings.Add("SelectedNodeUserId مطلوب عند اختيار SpecificUser.");
                return (false, reasons, warnings);
            }

            reasons.Add($"الإتاحة مقيدة على مستخدم محدد: {selectedUserId}.");
            return (true, reasons, warnings);
        }

        if (!availability.SelectedNodeNumericId.HasValue || availability.SelectedNodeNumericId.Value <= 0)
        {
            reasons.Add("الإتاحة المقيّدة غير مكتملة لأن SelectedNodeNumericId غير صالح.");
            warnings.Add($"SelectedNodeNumericId مطلوب لنوع العقدة {selectedNodeType}.");
            return (false, reasons, warnings);
        }

        reasons.Add($"الإتاحة مقيدة على عقدة {selectedNodeType} برقم {availability.SelectedNodeNumericId.Value}.");

        var selectionLabel = NormalizeNullable(availability.SelectionLabelAr);
        if (selectionLabel != null)
        {
            reasons.Add($"العقدة المختارة: {selectionLabel}.");
        }

        var selectionPath = NormalizeNullable(availability.SelectionPathAr);
        if (selectionPath != null)
        {
            reasons.Add($"المسار التنظيمي: {selectionPath}.");
        }

        return (true, reasons, warnings);
    }

    private static bool TryNormalizeAvailabilityMode(string? availabilityMode, out string normalized)
    {
        var key = NormalizeNullable(availabilityMode)?.ToLowerInvariant();
        if (key == null)
        {
            normalized = string.Empty;
            return false;
        }

        normalized = key switch
        {
            "public" => "Public",
            "restricted" => "Restricted",
            _ => string.Empty
        };

        return normalized.Length > 0;
    }

    private static bool TryNormalizeSelectedNodeType(string? selectedNodeType, out string normalized)
    {
        var key = NormalizeNullable(selectedNodeType)?.ToLowerInvariant();
        if (key == null)
        {
            normalized = string.Empty;
            return false;
        }

        normalized = key switch
        {
            "orgunit" => "OrgUnit",
            "position" => "Position",
            "specificuser" => "SpecificUser",
            _ => string.Empty
        };

        return normalized.Length > 0;
    }

    private static string NormalizeFieldKey(string? value)
    {
        return NormalizeNullable(value) ?? string.Empty;
    }

    private static int MendApplicationRank(string? mendApplicationId, string? categoryApplicationId)
    {
        var normalizedMendAppId = NormalizeNullable(mendApplicationId);

        if (categoryApplicationId != null
            && normalizedMendAppId != null
            && string.Equals(categoryApplicationId, normalizedMendAppId, StringComparison.OrdinalIgnoreCase))
        {
            return 0;
        }

        if (normalizedMendAppId == null)
        {
            return 1;
        }

        return 2;
    }

    private static string? NormalizeNullable(string? value)
    {
        var normalized = (value ?? string.Empty).Trim();
        return normalized.Length == 0 ? null : normalized;
    }

    private static void AddIfNotEmpty(ICollection<string> collection, string? value)
    {
        var normalized = NormalizeNullable(value);
        if (normalized != null)
        {
            collection.Add(normalized);
        }
    }

    private static List<string> DistinctInOrder(IEnumerable<string> values)
    {
        var result = new List<string>();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var value in values ?? Array.Empty<string>())
        {
            var normalized = NormalizeNullable(value);
            if (normalized == null)
            {
                continue;
            }

            if (!seen.Add(normalized))
            {
                continue;
            }

            result.Add(normalized);
        }

        return result;
    }

    private sealed class FieldBindingRow
    {
        public int MendSql { get; set; }

        public string MendField { get; set; } = string.Empty;

        public int GroupId { get; set; }

        public bool? IsVisible { get; set; }

        public int? DisplayOrder { get; set; }

        public int GroupDisplayOrder { get; set; }

        public string? GroupName { get; set; }

        public string? GroupDescription { get; set; }
    }
}
