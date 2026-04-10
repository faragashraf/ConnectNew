using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Models.Correspondance;
using Models.DTO.Common;
using Models.DTO.DynamicSubjects;
using Persistence.Data;
using Persistence.Services.DynamicSubjects.FieldAccess;
using System.Diagnostics;
using System.Globalization;

namespace Persistence.Services.DynamicSubjects.AdminCatalog;

public sealed class AdminControlCenterRequestPreviewResolver : IAdminControlCenterRequestPreviewResolver
{
    private static readonly TimeSpan PreviewCacheTtl = TimeSpan.FromMinutes(10);

    private readonly ConnectContext _connectContext;
    private readonly GPAContext _gpaContext;
    private readonly IFieldAccessResolutionService _fieldAccessResolutionService;
    private readonly IAdminControlCenterRequestPreviewCache _requestPreviewCache;
    private readonly ILogger<AdminControlCenterRequestPreviewResolver> _logger;

    public AdminControlCenterRequestPreviewResolver(
        ConnectContext connectContext,
        GPAContext gpaContext,
        IFieldAccessResolutionService fieldAccessResolutionService,
        IAdminControlCenterRequestPreviewCache requestPreviewCache,
        ILogger<AdminControlCenterRequestPreviewResolver> logger)
    {
        _connectContext = connectContext;
        _gpaContext = gpaContext;
        _fieldAccessResolutionService = fieldAccessResolutionService;
        _requestPreviewCache = requestPreviewCache;
        _logger = logger;
    }

    public async Task<CommonResponse<AdminControlCenterRequestPreviewDto>> ResolveAsync(
        int requestTypeId,
        string userId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<AdminControlCenterRequestPreviewDto>();
        var totalStopwatch = Stopwatch.StartNew();

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

            var cached = await _requestPreviewCache.TryGetAsync(requestTypeId, normalizedUserId, cancellationToken);
            if (cached != null
                && cached.Data != null
                && (cached.Errors?.Count ?? 0) == 0)
            {
                _logger.LogInformation(
                    "Request preview cache hit for requestTypeId {RequestTypeId}, userId {UserId}. totalElapsedMs={ElapsedMs}",
                    requestTypeId,
                    normalizedUserId,
                    totalStopwatch.ElapsedMilliseconds);
                return cached;
            }

            var resolverStopwatch = Stopwatch.StartNew();

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

            var userContext = await ResolveUserRuntimeContextAsync(normalizedUserId, cancellationToken);

            var requestDiagnostics = new DiagnosticsCollector();
            var availabilityReasons = new List<string>();

            var isAvailable = !category.CatStatus;
            if (category.CatStatus)
            {
                const string categoryInactiveMessage = "نوع الطلب غير مفعل في جدول CDCategory.";
                availabilityReasons.Add(categoryInactiveMessage);
                requestDiagnostics.AddWarning(categoryInactiveMessage, "REQUEST_TYPE_INACTIVE");
            }
            else
            {
                requestDiagnostics.AddInfo("نوع الطلب مفعل على مستوى CDCategory.", "REQUEST_TYPE_ACTIVE");
            }

            if (!userContext.IsResolved)
            {
                requestDiagnostics.AddWarning(
                    "تعذر تحميل سياق المستخدم الحالي (الوحدات/المناصب) بدقة.",
                    "USER_CONTEXT_UNRESOLVED");
            }
            else if (userContext.UnitIds.Count == 0)
            {
                requestDiagnostics.AddWarning(
                    "لا توجد عضويات وحدات نشطة للمستخدم الحالي داخل GPA.",
                    "NO_ACTIVE_UNIT_MEMBERSHIPS");
            }
            else
            {
                requestDiagnostics.AddInfo(
                    $"تم تحميل عضويات المستخدم الحالية بنجاح ({userContext.UnitIds.Count} وحدة).",
                    "USER_CONTEXT_UNITS_LOADED");
            }

            var availabilityEvaluation = EvaluateAvailability(availability, userContext);
            isAvailable = isAvailable && availabilityEvaluation.IsAvailable;
            availabilityReasons.AddRange(availabilityEvaluation.Reasons);
            requestDiagnostics.AddRange(availabilityEvaluation.Diagnostics);

            if (category.CatStatus && availabilityEvaluation.IsAvailable)
            {
                requestDiagnostics.AddConflict(
                    "نوع الطلب تم تقييمه كمتاح وفق قواعد الإتاحة، لكنه غير مفعل في CDCategory ولذلك النتيجة النهائية غير متاح.",
                    "AVAILABILITY_CATEGORY_STATUS_CONFLICT");
            }

            var fieldBindingRows = await LoadFieldBindingRowsAsync(requestTypeId, cancellationToken);
            if (fieldBindingRows.Count == 0)
            {
                requestDiagnostics.AddWarning(
                    "لا توجد روابط حقول نشطة لهذا النوع داخل AdminCatalogCategoryFieldBindings.",
                    "NO_ACTIVE_FIELD_BINDINGS");
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
            var metadata = BuildFieldMetadata(requestTypeId, fieldBindingRows, mendByKey, requestDiagnostics);

            FieldAccessResolutionResult resolution;
            if (metadata.Fields.Count == 0)
            {
                resolution = new FieldAccessResolutionResult();
                requestDiagnostics.AddWarning(
                    "لم يتم استخراج حقول صالحة لبناء تقييم Field Access؛ تم استخدام نتيجة فارغة.",
                    "NO_FIELDS_FOR_ACCESS_RESOLUTION");
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
                        UserId = normalizedUserId,
                        Groups = metadata.Groups,
                        Fields = metadata.Fields
                    },
                    cancellationToken);
            }

            var fields = BuildPreviewFields(metadata.Fields, resolution, requestDiagnostics);

            if (fields.Count == 0)
            {
                requestDiagnostics.AddWarning("لم يتم توليد أي حقول للمعاينة الفعلية.", "PREVIEW_FIELDS_EMPTY");
            }

            var requestLevelDiagnostics = requestDiagnostics.ToList();
            var requestLevelWarnings = requestDiagnostics.MessagesBySeverity("Warning");
            var requestLevelConflicts = requestDiagnostics.MessagesBySeverity("Conflict");
            var diagnosticsSummary = BuildDiagnosticsSummary(requestLevelDiagnostics, fields);

            var preview = new AdminControlCenterRequestPreviewDto
            {
                RequestTypeId = requestTypeId,
                RequestTypeName = NormalizeNullable(category.CatName) ?? $"Request Type {requestTypeId}",
                EvaluatedForUserId = userContext.UserId ?? normalizedUserId,
                IsUserContextResolved = userContext.IsResolved,
                UserUnitIds = userContext.UnitIds
                    .OrderBy(item => item)
                    .Select(item => item.ToString(CultureInfo.InvariantCulture))
                    .ToList(),
                UserPositionIds = userContext.PositionIds
                    .OrderBy(item => item)
                    .Select(item => item.ToString(CultureInfo.InvariantCulture))
                    .ToList(),
                IsAvailable = isAvailable,
                AvailabilityReasons = DistinctInOrder(availabilityReasons),
                Fields = fields,
                Warnings = requestLevelWarnings,
                Conflicts = requestLevelConflicts,
                DiagnosticsSummary = diagnosticsSummary,
                Diagnostics = requestLevelDiagnostics
            };

            response.Data = preview;

            if (response.Data != null && (response.Errors?.Count ?? 0) == 0)
            {
                await _requestPreviewCache.SetAsync(
                    requestTypeId,
                    normalizedUserId,
                    response,
                    PreviewCacheTtl,
                    cancellationToken);
            }

            _logger.LogInformation(
                "Request preview cache miss for requestTypeId {RequestTypeId}, userId {UserId}. resolverElapsedMs={ResolverElapsedMs}, totalElapsedMs={TotalElapsedMs}",
                requestTypeId,
                normalizedUserId,
                resolverStopwatch.ElapsedMilliseconds,
                totalStopwatch.ElapsedMilliseconds);
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
        DiagnosticsCollector requestDiagnostics)
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
            if (row.GroupId <= 0)
            {
                requestDiagnostics.AddConflict(
                    $"الحقل المرتبط #{row.MendSql} يحمل GroupId غير صالح ({row.GroupId}).",
                    "INVALID_GROUP_BINDING");
            }

            if (NormalizeNullable(row.GroupName) == null)
            {
                requestDiagnostics.AddWarning(
                    $"الربط للحقل #{row.MendSql} يشير إلى مجموعة غير مكتملة أو غير موجودة (GroupId={row.GroupId}).",
                    "MISSING_GROUP_BINDING");
            }

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
                requestDiagnostics.AddWarning(
                    $"الحقل المرتبط '{NormalizeNullable(row.MendField) ?? row.MendSql.ToString()}' لا يملك تعريفًا في جدول CDMend.",
                    "MEND_DEFINITION_MISSING");
            }
            else if (mend.CdmendStat)
            {
                requestDiagnostics.AddWarning(
                    $"الحقل '{NormalizeNullable(mend.CDMendLbl) ?? mend.CdmendTxt}' مرتبط لكنه غير مفعل في CDMend.",
                    "MEND_INACTIVE");
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
        DiagnosticsCollector requestDiagnostics)
    {
        var safeResolution = resolution ?? new FieldAccessResolutionResult();
        var items = new List<AdminControlCenterRequestPreviewFieldDto>();

        foreach (var field in (fields ?? Array.Empty<SubjectFieldDefinitionDto>())
                     .OrderBy(item => item.MendGroup)
                     .ThenBy(item => item.DisplayOrder)
                     .ThenBy(item => item.MendSql))
        {
            safeResolution.FieldStatesByMendSql.TryGetValue(field.MendSql, out var state);
            var resolvedIsVisible = state?.CanView ?? field.IsVisible;
            var resolvedIsRequired = state?.IsRequired ?? field.Required;

            var reasons = new List<string>();
            var fieldDiagnostics = new DiagnosticsCollector();
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

                AddTraceConflictDiagnostics(state.AppliedTraces, fieldDiagnostics);

                AddIfNotEmpty(reasons, state.EffectiveReasonAr);
                AddIfNotEmpty(reasons, state.LockReason);

                if (!resolvedIsVisible)
                {
                    reasons.Add("Field hidden بسبب access policy (CanView=false).");
                    fieldDiagnostics.AddInfo("تم إخفاء الحقل بعد تقييم access policy.", "FIELD_HIDDEN_BY_POLICY");
                }
                else if (!field.IsVisible && resolvedIsVisible)
                {
                    reasons.Add("Field visible بسبب access policy (CanView=true).");
                    fieldDiagnostics.AddInfo(
                        "الحقل كان مخفيًا في الربط الأساسي لكن access policy أعاد إظهاره.",
                        "FIELD_VISIBILITY_OVERRIDDEN");
                }

                if (!field.Required && resolvedIsRequired)
                {
                    reasons.Add("Field required بسبب access policy (IsRequired=true).");
                    fieldDiagnostics.AddInfo("تم تحويل الحقل إلى Required بواسطة access policy.", "FIELD_REQUIRED_BY_POLICY");
                }
                else if (field.Required && !resolvedIsRequired)
                {
                    reasons.Add("Field optional بسبب access policy (IsRequired=false).");
                    fieldDiagnostics.AddInfo("تم تحويل الحقل إلى Optional بواسطة access policy.", "FIELD_OPTIONAL_BY_POLICY");
                }

                if (state.AppliedTraces.Count == 0)
                {
                    fieldDiagnostics.AddWarning(
                        "لا توجد traces مطبقة على الحقل؛ تم الاعتماد على الحالة الأساسية/الافتراضية.",
                        "FIELD_NO_APPLIED_TRACES");
                }

                if (string.Equals(NormalizeNullable(state.EffectiveSourceType), "DefaultPolicy", StringComparison.OrdinalIgnoreCase))
                {
                    fieldDiagnostics.AddInfo(
                        "تم استخدام DefaultPolicy كمرجع نهائي لهذا الحقل.",
                        "FIELD_DEFAULT_POLICY_FALLBACK");
                }
            }
            else
            {
                var missingStateMessage = $"لم يتم إرجاع حالة وصول للحقل #{field.MendSql}. تم استخدام القيم الأساسية.";
                fieldDiagnostics.AddWarning(missingStateMessage, "FIELD_STATE_MISSING");
                requestDiagnostics.AddWarning(missingStateMessage, "FIELD_STATE_MISSING");
            }

            if (reasons.Count == 0)
            {
                reasons.Add("لا توجد قواعد مطابقة، وتم اعتماد الحالة الافتراضية الحالية.");
                fieldDiagnostics.AddInfo(
                    "لا توجد قواعد Access مطابقة؛ تم استخدام fallback الافتراضي الحالي.",
                    "FIELD_FALLBACK_DEFAULT");
            }

            if (!resolvedIsVisible && resolvedIsRequired)
            {
                fieldDiagnostics.AddConflict(
                    "الحقل Hidden وفي نفس الوقت Required؛ تم الاحتفاظ بـ Required في المخرجات لأغراض التشخيص فقط.",
                    "FIELD_HIDDEN_REQUIRED_CONFLICT");
            }

            items.Add(new AdminControlCenterRequestPreviewFieldDto
            {
                FieldId = field.MendSql,
                FieldName = NormalizeNullable(field.FieldLabel)
                    ?? NormalizeNullable(field.FieldKey)
                    ?? $"Field #{field.MendSql}",
                IsVisible = resolvedIsVisible,
                IsRequired = resolvedIsRequired,
                Reasons = DistinctInOrder(reasons),
                Warnings = fieldDiagnostics.MessagesBySeverity("Warning"),
                Conflicts = fieldDiagnostics.MessagesBySeverity("Conflict"),
                Diagnostics = fieldDiagnostics.ToList()
            });
        }

        return items;
    }

    private static AvailabilityEvaluation EvaluateAvailability(
        SubjectTypeRequestAvailability? availability,
        UserRuntimeContext userContext)
    {
        var evaluation = new AvailabilityEvaluation();
        var reasons = new List<string>();
        var diagnostics = new DiagnosticsCollector();

        if (availability == null)
        {
            reasons.Add("لا يوجد سجل إتاحة محفوظ؛ تم اعتماد الوضع الافتراضي Public (متاح).");
            diagnostics.AddWarning(
                "لا يوجد سجل إتاحة محفوظ؛ تم تفعيل fallback إلى Public.",
                "AVAILABILITY_FALLBACK_PUBLIC");
            evaluation.IsAvailable = true;
            evaluation.Reasons = DistinctInOrder(reasons);
            evaluation.Diagnostics = diagnostics.ToList();
            return evaluation;
        }

        if (!TryNormalizeAvailabilityMode(availability.AvailabilityMode, out var mode))
        {
            reasons.Add("نمط الإتاحة غير معروف، لذلك تم اعتباره غير متاح حتى تصحيح الإعداد.");
            diagnostics.AddConflict(
                $"قيمة AvailabilityMode الحالية غير مدعومة: '{availability.AvailabilityMode}'.",
                "AVAILABILITY_MODE_UNSUPPORTED");
            evaluation.IsAvailable = false;
            evaluation.Reasons = DistinctInOrder(reasons);
            evaluation.Diagnostics = diagnostics.ToList();
            return evaluation;
        }

        if (string.Equals(mode, "Public", StringComparison.OrdinalIgnoreCase))
        {
            reasons.Add("نمط الإتاحة الحالي Public: النوع متاح للمستخدم الحالي.");
            diagnostics.AddInfo("تم تطبيق AvailabilityMode=Public بدون قيود إضافية.", "AVAILABILITY_PUBLIC");
            evaluation.IsAvailable = true;
            evaluation.Reasons = DistinctInOrder(reasons);
            evaluation.Diagnostics = diagnostics.ToList();
            return evaluation;
        }

        reasons.Add("نمط الإتاحة الحالي Restricted: يجب مطابقة سياق المستخدم الحالي مع عقدة الإتاحة.");
        diagnostics.AddInfo("تم تفعيل تقييم Restricted availability.", "AVAILABILITY_RESTRICTED");

        if (!TryNormalizeSelectedNodeType(availability.SelectedNodeType, out var selectedNodeType))
        {
            reasons.Add("الإتاحة المقيّدة غير مكتملة لأن SelectedNodeType غير صالح.");
            diagnostics.AddConflict(
                "SelectedNodeType مفقود أو غير مدعوم رغم أن AvailabilityMode = Restricted.",
                "RESTRICTED_NODE_TYPE_INVALID");
            evaluation.IsAvailable = false;
            evaluation.Reasons = DistinctInOrder(reasons);
            evaluation.Diagnostics = diagnostics.ToList();
            return evaluation;
        }

        if (string.Equals(selectedNodeType, "SpecificUser", StringComparison.OrdinalIgnoreCase))
        {
            var selectedUserId = NormalizeNullable(availability.SelectedNodeUserId);
            if (selectedUserId == null)
            {
                reasons.Add("الإتاحة المقيّدة غير مكتملة لأن SelectedNodeUserId غير محدد.");
                diagnostics.AddConflict(
                    "SelectedNodeUserId مطلوب عند اختيار SpecificUser.",
                    "RESTRICTED_SPECIFIC_USER_MISSING");
                evaluation.IsAvailable = false;
                evaluation.Reasons = DistinctInOrder(reasons);
                evaluation.Diagnostics = diagnostics.ToList();
                return evaluation;
            }

            if (userContext.UserId == null)
            {
                reasons.Add($"الإتاحة مقيدة على مستخدم محدد ({selectedUserId}) لكن user context غير متوفر.");
                diagnostics.AddConflict(
                    "تعذر مطابقة SpecificUser بسبب غياب UserId الحالي.",
                    "RESTRICTED_SPECIFIC_USER_CONTEXT_MISSING");
                evaluation.IsAvailable = false;
                evaluation.Reasons = DistinctInOrder(reasons);
                evaluation.Diagnostics = diagnostics.ToList();
                return evaluation;
            }

            if (string.Equals(userContext.UserId, selectedUserId, StringComparison.OrdinalIgnoreCase))
            {
                reasons.Add($"Available لأن المستخدم الحالي يطابق SpecificUser ({selectedUserId}).");
                diagnostics.AddInfo(
                    $"Available لأن المستخدم الحالي يطابق SpecificUser ({selectedUserId}).",
                    "RESTRICTED_SPECIFIC_USER_MATCH");
                evaluation.IsAvailable = true;
                evaluation.Reasons = DistinctInOrder(reasons);
                evaluation.Diagnostics = diagnostics.ToList();
                return evaluation;
            }

            reasons.Add($"Unavailable لأن المستخدم الحالي ({userContext.UserId}) لا يطابق SpecificUser ({selectedUserId}).");
            diagnostics.AddInfo(
                $"Unavailable لأن المستخدم الحالي ({userContext.UserId}) لا يطابق SpecificUser ({selectedUserId}).",
                "RESTRICTED_SPECIFIC_USER_NO_MATCH");
            evaluation.IsAvailable = false;
            evaluation.Reasons = DistinctInOrder(reasons);
            evaluation.Diagnostics = diagnostics.ToList();
            return evaluation;
        }

        if (!availability.SelectedNodeNumericId.HasValue || availability.SelectedNodeNumericId.Value <= 0)
        {
            reasons.Add("الإتاحة المقيّدة غير مكتملة لأن SelectedNodeNumericId غير صالح.");
            diagnostics.AddConflict(
                $"SelectedNodeNumericId مطلوب لنوع العقدة {selectedNodeType}.",
                "RESTRICTED_NODE_ID_INVALID");
            evaluation.IsAvailable = false;
            evaluation.Reasons = DistinctInOrder(reasons);
            evaluation.Diagnostics = diagnostics.ToList();
            return evaluation;
        }

        var requiredNodeId = availability.SelectedNodeNumericId.Value;

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

        if (!userContext.IsResolved)
        {
            reasons.Add("Unavailable لأن سياق المستخدم الحالي غير متاح لتقييم Restricted availability.");
            diagnostics.AddConflict(
                "Unavailable لأن سياق المستخدم الحالي غير متاح لتقييم Restricted availability.",
                "RESTRICTED_CONTEXT_UNRESOLVED");
            evaluation.IsAvailable = false;
            evaluation.Reasons = DistinctInOrder(reasons);
            evaluation.Diagnostics = diagnostics.ToList();
            return evaluation;
        }

        if (string.Equals(selectedNodeType, "OrgUnit", StringComparison.OrdinalIgnoreCase))
        {
            if (userContext.UnitIds.Contains(requiredNodeId))
            {
                reasons.Add($"Available لأن المستخدم الحالي عضو في الوحدة المسموح بها ({requiredNodeId}).");
                diagnostics.AddInfo(
                    $"Available لأن المستخدم الحالي عضو في الوحدة المسموح بها ({requiredNodeId}).",
                    "RESTRICTED_ORG_UNIT_MATCH");
                evaluation.IsAvailable = true;
                evaluation.Reasons = DistinctInOrder(reasons);
                evaluation.Diagnostics = diagnostics.ToList();
                return evaluation;
            }

            reasons.Add($"Unavailable لأن المستخدم الحالي ليس عضوًا في الوحدة المطلوبة ({requiredNodeId}).");
            diagnostics.AddInfo(
                $"Unavailable لأن المستخدم الحالي ليس عضوًا في الوحدة المطلوبة ({requiredNodeId}).",
                "RESTRICTED_ORG_UNIT_NO_MATCH");
            evaluation.IsAvailable = false;
            evaluation.Reasons = DistinctInOrder(reasons);
            evaluation.Diagnostics = diagnostics.ToList();
            return evaluation;
        }

        if (string.Equals(selectedNodeType, "Position", StringComparison.OrdinalIgnoreCase))
        {
            if (userContext.PositionIds.Contains(requiredNodeId))
            {
                reasons.Add($"Available لأن المستخدم الحالي يشغل المنصب المطلوب ({requiredNodeId}).");
                diagnostics.AddInfo(
                    $"Available لأن المستخدم الحالي يشغل المنصب المطلوب ({requiredNodeId}).",
                    "RESTRICTED_POSITION_MATCH");
                evaluation.IsAvailable = true;
                evaluation.Reasons = DistinctInOrder(reasons);
                evaluation.Diagnostics = diagnostics.ToList();
                return evaluation;
            }

            reasons.Add($"Unavailable لأن المستخدم الحالي لا يشغل المنصب المطلوب ({requiredNodeId}).");
            diagnostics.AddInfo(
                $"Unavailable لأن المستخدم الحالي لا يشغل المنصب المطلوب ({requiredNodeId}).",
                "RESTRICTED_POSITION_NO_MATCH");
            evaluation.IsAvailable = false;
            evaluation.Reasons = DistinctInOrder(reasons);
            evaluation.Diagnostics = diagnostics.ToList();
            return evaluation;
        }

        reasons.Add("Unavailable لأن نوع العقدة المقيّدة غير مدعوم في runtime evaluation.");
        diagnostics.AddConflict(
            $"نوع العقدة المقيّدة غير مدعوم في runtime evaluation: {selectedNodeType}.",
            "RESTRICTED_NODE_TYPE_UNSUPPORTED_RUNTIME");
        evaluation.IsAvailable = false;
        evaluation.Reasons = DistinctInOrder(reasons);
        evaluation.Diagnostics = diagnostics.ToList();
        return evaluation;
    }

    private static AdminControlCenterDiagnosticsSummaryDto BuildDiagnosticsSummary(
        IReadOnlyCollection<AdminControlCenterDiagnosticMessageDto> requestDiagnostics,
        IReadOnlyCollection<AdminControlCenterRequestPreviewFieldDto> fields)
    {
        var infoCount = 0;
        var warningCount = 0;
        var conflictCount = 0;
        var requestLevelCount = requestDiagnostics?.Count ?? 0;
        var fieldLevelCount = 0;

        foreach (var message in requestDiagnostics ?? Array.Empty<AdminControlCenterDiagnosticMessageDto>())
        {
            CountSeverity(message?.Severity, ref infoCount, ref warningCount, ref conflictCount);
        }

        foreach (var field in fields ?? Array.Empty<AdminControlCenterRequestPreviewFieldDto>())
        {
            foreach (var message in field.Diagnostics ?? new List<AdminControlCenterDiagnosticMessageDto>())
            {
                CountSeverity(message?.Severity, ref infoCount, ref warningCount, ref conflictCount);
                fieldLevelCount++;
            }
        }

        return new AdminControlCenterDiagnosticsSummaryDto
        {
            TotalCount = infoCount + warningCount + conflictCount,
            InfoCount = infoCount,
            WarningCount = warningCount,
            ConflictCount = conflictCount,
            RequestLevelCount = requestLevelCount,
            FieldLevelCount = fieldLevelCount
        };
    }

    private static void AddTraceConflictDiagnostics(
        IReadOnlyCollection<FieldAccessAppliedTrace> traces,
        DiagnosticsCollector diagnostics)
    {
        var normalizedTraces = traces ?? Array.Empty<FieldAccessAppliedTrace>();
        if (HasRequirementEffectConflict(normalizedTraces))
        {
            diagnostics.AddConflict(
                "تم اكتشاف Requirement traces متضاربة (Allow/Deny) على نفس الحقل؛ تم اختيار الحالة النهائية حسب الأولوية.",
                "FIELD_REQUIREMENT_TRACE_CONFLICT");
        }

        if (HasVisibilityConflict(normalizedTraces))
        {
            diagnostics.AddConflict(
                "تم اكتشاف Visibility traces متداخلة (Hidden مقابل Editable/ReadOnly) على نفس الحقل؛ تم تطبيق أولوية الحسم.",
                "FIELD_VISIBILITY_TRACE_CONFLICT");
        }
    }

    private static bool HasRequirementEffectConflict(IReadOnlyCollection<FieldAccessAppliedTrace> traces)
    {
        var hasRequired = false;
        var hasOptional = false;

        foreach (var trace in traces ?? Array.Empty<FieldAccessAppliedTrace>())
        {
            if (!string.Equals(NormalizeNullable(trace.PermissionKind), "requirement", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            if (!string.Equals(NormalizePermission(trace.PermissionType), "requiredinput", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            var normalizedEffect = NormalizeEffect(trace.Effect);
            if (string.Equals(normalizedEffect, "deny", StringComparison.OrdinalIgnoreCase))
            {
                hasOptional = true;
            }
            else
            {
                hasRequired = true;
            }
        }

        return hasRequired && hasOptional;
    }

    private static bool HasVisibilityConflict(IReadOnlyCollection<FieldAccessAppliedTrace> traces)
    {
        var outcomes = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var trace in traces ?? Array.Empty<FieldAccessAppliedTrace>())
        {
            if (!string.Equals(NormalizeNullable(trace.PermissionKind), "visibility", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            var outcome = ResolveVisibilityOutcomeKey(trace.PermissionType, trace.Effect);
            if (outcome != null)
            {
                outcomes.Add(outcome);
            }
        }

        return outcomes.Contains("hidden")
            && (outcomes.Contains("editable") || outcomes.Contains("readonly"));
    }

    private static string? ResolveVisibilityOutcomeKey(string? permissionType, string? effect)
    {
        var normalizedPermission = NormalizePermission(permissionType);
        if (normalizedPermission.Length == 0)
        {
            return null;
        }

        var normalizedEffect = NormalizeEffect(effect);
        if (string.Equals(normalizedEffect, "deny", StringComparison.OrdinalIgnoreCase))
        {
            normalizedPermission = normalizedPermission switch
            {
                "editable" => "readonly",
                "readonly" => "hidden",
                _ => normalizedPermission
            };
        }

        return normalizedPermission switch
        {
            "hidden" => "hidden",
            "readonly" => "readonly",
            "editable" => "editable",
            _ => null
        };
    }

    private async Task<UserRuntimeContext> ResolveUserRuntimeContextAsync(
        string normalizedUserId,
        CancellationToken cancellationToken)
    {
        var context = new UserRuntimeContext
        {
            UserId = normalizedUserId,
            IsResolved = true
        };

        try
        {
            var today = DateTime.Today;
            var positions = await _gpaContext.UserPositions
                .AsNoTracking()
                .Where(position => position.UserId == normalizedUserId
                    && position.IsActive != false
                    && (!position.StartDate.HasValue || position.StartDate.Value <= today)
                    && (!position.EndDate.HasValue || position.EndDate.Value >= today))
                .ToListAsync(cancellationToken);

            context.UnitIds = positions
                .Select(item => item.UnitId)
                .Distinct()
                .OrderBy(item => item)
                .ToHashSet();

            context.PositionIds = positions
                .Select(item => item.PositionId)
                .Distinct()
                .OrderBy(item => item)
                .ToHashSet();
        }
        catch
        {
            context.IsResolved = false;
            context.UnitIds = new HashSet<decimal>();
            context.PositionIds = new HashSet<decimal>();
        }

        return context;
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

    private static void CountSeverity(
        string? severity,
        ref int infoCount,
        ref int warningCount,
        ref int conflictCount)
    {
        var normalized = NormalizeNullable(severity);
        if (string.Equals(normalized, "Warning", StringComparison.OrdinalIgnoreCase))
        {
            warningCount++;
            return;
        }

        if (string.Equals(normalized, "Conflict", StringComparison.OrdinalIgnoreCase))
        {
            conflictCount++;
            return;
        }

        infoCount++;
    }

    private static string NormalizePermission(string? permissionType)
    {
        var normalized = NormalizeNullable(permissionType)?.ToLowerInvariant() ?? string.Empty;
        return normalized.Replace("_", string.Empty).Replace("-", string.Empty).Replace(" ", string.Empty);
    }

    private static string NormalizeEffect(string? effect)
    {
        var normalized = NormalizeNullable(effect)?.ToLowerInvariant();
        return normalized ?? "allow";
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

    private sealed class AvailabilityEvaluation
    {
        public bool IsAvailable { get; set; }

        public List<string> Reasons { get; set; } = new();

        public List<AdminControlCenterDiagnosticMessageDto> Diagnostics { get; set; } = new();
    }

    private sealed class DiagnosticsCollector
    {
        private readonly List<AdminControlCenterDiagnosticMessageDto> _messages = new();
        private readonly HashSet<string> _seen = new(StringComparer.OrdinalIgnoreCase);

        public void AddInfo(string message, string? code = null)
        {
            Add("Info", message, code);
        }

        public void AddWarning(string message, string? code = null)
        {
            Add("Warning", message, code);
        }

        public void AddConflict(string message, string? code = null)
        {
            Add("Conflict", message, code);
        }

        public void AddRange(IEnumerable<AdminControlCenterDiagnosticMessageDto> messages)
        {
            foreach (var message in messages ?? Array.Empty<AdminControlCenterDiagnosticMessageDto>())
            {
                Add(message?.Severity, message?.Message, message?.Code);
            }
        }

        public List<string> MessagesBySeverity(string severity)
        {
            var normalizedSeverity = NormalizeNullable(severity) ?? string.Empty;
            return _messages
                .Where(message => string.Equals(
                    NormalizeNullable(message.Severity),
                    normalizedSeverity,
                    StringComparison.OrdinalIgnoreCase))
                .Select(message => message.Message)
                .ToList();
        }

        public List<AdminControlCenterDiagnosticMessageDto> ToList()
        {
            return _messages.ToList();
        }

        private void Add(string? severity, string? message, string? code)
        {
            var normalizedMessage = NormalizeNullable(message);
            if (normalizedMessage == null)
            {
                return;
            }

            var normalizedSeverity = NormalizeNullable(severity) ?? "Info";
            if (!string.Equals(normalizedSeverity, "Warning", StringComparison.OrdinalIgnoreCase)
                && !string.Equals(normalizedSeverity, "Conflict", StringComparison.OrdinalIgnoreCase))
            {
                normalizedSeverity = "Info";
            }
            else if (string.Equals(normalizedSeverity, "Warning", StringComparison.OrdinalIgnoreCase))
            {
                normalizedSeverity = "Warning";
            }
            else
            {
                normalizedSeverity = "Conflict";
            }

            var normalizedCode = NormalizeNullable(code);
            var deduplicationKey = $"{normalizedSeverity}|{normalizedCode ?? string.Empty}|{normalizedMessage}";
            if (!_seen.Add(deduplicationKey))
            {
                return;
            }

            _messages.Add(new AdminControlCenterDiagnosticMessageDto
            {
                Severity = normalizedSeverity,
                Message = normalizedMessage,
                Code = normalizedCode
            });
        }
    }

    private sealed class UserRuntimeContext
    {
        public string? UserId { get; set; }

        public bool IsResolved { get; set; }

        public HashSet<decimal> UnitIds { get; set; } = new();

        public HashSet<decimal> PositionIds { get; set; } = new();
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
