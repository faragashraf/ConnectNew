using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Models.Attachment;
using Models.Correspondance;
using Models.DTO.Common;
using Models.DTO.Correspondance.Enums;
using Models.DTO.DynamicSubjects;
using Models.GPA.OrgStructure;
using Persistence.Data;
using Persistence.HelperServices;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Threading;
using System.Threading.Tasks;

namespace Persistence.Services.DynamicSubjects;

public sealed partial class DynamicSubjectsService : IDynamicSubjectsService
{
    private static readonly JsonSerializerOptions SerializerOptions = new(JsonSerializerDefaults.Web)
    {
        PropertyNameCaseInsensitive = true
    };

    private readonly ConnectContext _connectContext;
    private readonly Attach_HeldContext _attachContext;
    private readonly GPAContext _gpaContext;
    private readonly helperService _helperService;
    private readonly ISubjectReferenceGenerator _referenceGenerator;
    private readonly IDynamicSubjectsRealtimePublisher _realtimePublisher;
    private readonly ILogger<DynamicSubjectsService>? _logger;

    public DynamicSubjectsService(
        ConnectContext connectContext,
        Attach_HeldContext attachContext,
        GPAContext gpaContext,
        helperService helperService,
        ISubjectReferenceGenerator referenceGenerator,
        IDynamicSubjectsRealtimePublisher realtimePublisher,
        ILogger<DynamicSubjectsService>? logger = null)
    {
        _connectContext = connectContext;
        _attachContext = attachContext;
        _gpaContext = gpaContext;
        _helperService = helperService;
        _referenceGenerator = referenceGenerator;
        _realtimePublisher = realtimePublisher;
        _logger = logger;
    }

    public async Task<CommonResponse<IEnumerable<SubjectCategoryTreeNodeDto>>> GetCategoryTreeAsync(
        string userId,
        string? appId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<IEnumerable<SubjectCategoryTreeNodeDto>>();
        try
        {
            var normalizedUserId = NormalizeUser(userId);
            if (normalizedUserId.Length == 0)
            {
                response.Errors.Add(new Error { Code = "401", Message = "المستخدم غير مصرح له." });
                return response;
            }

            var unitIds = await GetCurrentUserUnitIdsAsync(normalizedUserId, cancellationToken);
            var scopedCategories = await LoadScopedCategoriesAsync(unitIds, appId, cancellationToken);

            var categoryIds = scopedCategories.Select(cat => cat.CatId).ToHashSet();
            var categorySettingsMap = await _connectContext.SubjectTypeAdminSettings
                .AsNoTracking()
                .Where(setting => categoryIds.Contains(setting.CategoryId))
                .ToDictionaryAsync(setting => setting.CategoryId, cancellationToken);
            var categoriesWithFields = await _connectContext.CdCategoryMands
                .AsNoTracking()
                .Where(link => categoryIds.Contains(link.MendCategory) && !link.MendStat)
                .Select(link => link.MendCategory)
                .Distinct()
                .ToListAsync(cancellationToken);
            var categoriesWithFieldsSet = categoriesWithFields.ToHashSet();

            var lookup = scopedCategories
                .GroupBy(cat => cat.CatParent)
                .ToDictionary(
                    group => group.Key,
                    group => group
                        .OrderBy(item =>
                            categorySettingsMap.TryGetValue(item.CatId, out var setting)
                                ? setting.DisplayOrder
                                : int.MaxValue)
                        .ThenBy(item => item.CatName)
                        .ToList());
            var scopedById = scopedCategories.ToDictionary(item => item.CatId, item => item);
            var numericUserUnits = unitIds
                .Select(unit => int.TryParse(unit, out var parsed) ? parsed : 0)
                .Where(parsed => parsed > 0)
                .ToHashSet();

            bool HasLegacyCreateAccess(int categoryId)
            {
                if (numericUserUnits.Count == 0 || !scopedById.ContainsKey(categoryId))
                {
                    return false;
                }

                var cursor = categoryId;
                var safety = 0;
                while (safety++ < 150
                    && scopedById.TryGetValue(cursor, out var current)
                    && current.CatParent > 0
                    && scopedById.ContainsKey(current.CatParent))
                {
                    cursor = current.CatParent;
                }

                return numericUserUnits.Contains(cursor);
            }

            bool CanCreateByPolicy(Cdcategory category)
            {
                var hasDynamicFields = categoriesWithFieldsSet.Contains(category.CatId);
                if (!hasDynamicFields || category.CatStatus)
                {
                    return false;
                }

                if (!categorySettingsMap.TryGetValue(category.CatId, out var setting))
                {
                    return true;
                }

                var requestPolicy = TryReadRequestPolicyFromSettingsJson(setting.SettingsJson);
                if (requestPolicy == null)
                {
                    return HasLegacyCreateAccess(category.CatId);
                }

                var resolvedAccess = RequestPolicyResolver.ResolveAccessPolicy(requestPolicy);
                if (resolvedAccess.CreateUnitIds.Count > 0)
                {
                    return RequestPolicyResolver.IsCreateAllowedForUnits(requestPolicy, unitIds);
                }

                if (!resolvedAccess.InheritLegacyAccess)
                {
                    return true;
                }

                return HasLegacyCreateAccess(category.CatId);
            }

            List<SubjectCategoryTreeNodeDto> BuildChildren(int parentId)
            {
                if (!lookup.TryGetValue(parentId, out var children))
                {
                    return new List<SubjectCategoryTreeNodeDto>();
                }

                return children.Select(category => new SubjectCategoryTreeNodeDto
                {
                    CategoryId = category.CatId,
                    ParentCategoryId = category.CatParent,
                    CategoryName = category.CatName,
                    IsActive = !category.CatStatus,
                    ApplicationId = category.ApplicationId,
                    HasDynamicFields = categoriesWithFieldsSet.Contains(category.CatId),
                    CanCreate = CanCreateByPolicy(category),
                    DisplayOrder = categorySettingsMap.TryGetValue(category.CatId, out var setting)
                        ? setting.DisplayOrder
                        : 0,
                    Children = BuildChildren(category.CatId)
                }).ToList();
            }

            response.Data = BuildChildren(0);
        }
        catch (Exception)
        {
            response.Errors.Add(new Error { Code = "500", Message = "حدث خطأ غير متوقع أثناء تحميل تعريف النموذج." });
        }

        return response;
    }

    public async Task<CommonResponse<SubjectFormDefinitionDto>> GetFormDefinitionAsync(
        int categoryId,
        string userId,
        string? appId,
        CancellationToken cancellationToken = default)
    {
        return await BuildFormDefinitionAsync(categoryId, userId, appId, allowInactiveCategory: false, cancellationToken);
    }

    private async Task<CommonResponse<SubjectFormDefinitionDto>> BuildFormDefinitionAsync(
        int categoryId,
        string userId,
        string? appId,
        bool allowInactiveCategory,
        CancellationToken cancellationToken)
    {
        var response = new CommonResponse<SubjectFormDefinitionDto>();
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

            if (!allowInactiveCategory && category.CatStatus)
            {
                response.Errors.Add(new Error { Code = "403", Message = "النوع غير مفعل." });
                return response;
            }

            if (!string.IsNullOrWhiteSpace(appId)
                && !string.Equals(category.ApplicationId ?? string.Empty, appId, StringComparison.OrdinalIgnoreCase))
            {
                response.Errors.Add(new Error { Code = "404", Message = "النوع خارج نطاق التطبيق المطلوب." });
                return response;
            }

            if (!allowInactiveCategory)
            {
                var unitIds = await GetCurrentUserUnitIdsAsync(normalizedUserId, cancellationToken);
                if (!await HasCategoryAccessAsync(category.CatId, unitIds, cancellationToken))
                {
                    response.Errors.Add(new Error { Code = "403", Message = "غير مصرح بعرض هذا النوع." });
                    return response;
                }
            }

            var linkRows = await (from link in _connectContext.CdCategoryMands.AsNoTracking()
                                  join mandGroup in _connectContext.MandGroups.AsNoTracking()
                                       on link.MendGroup equals mandGroup.GroupId into groupJoin
                                  from mandGroup in groupJoin.DefaultIfEmpty()
                                  join fieldSetting in _connectContext.SubjectCategoryFieldSettings.AsNoTracking()
                                       on link.MendSql equals fieldSetting.MendSql into fieldSettingJoin
                                  from fieldSetting in fieldSettingJoin.DefaultIfEmpty()
                                  where link.MendCategory == categoryId
                                        && !link.MendStat
                                        && (fieldSetting == null || fieldSetting.IsVisible)
                                  select new FormDefinitionLinkRow
                                  {
                                      MendSql = link.MendSql,
                                      MendCategory = link.MendCategory,
                                      MendField = link.MendField,
                                      MendGroup = link.MendGroup,
                                      GroupName = mandGroup != null ? mandGroup.GroupName : null,
                                      GroupDescription = mandGroup != null ? mandGroup.GroupDescription : null,
                                      IsExtendable = mandGroup != null && mandGroup.IsExtendable == true,
                                      GroupWithInRow = mandGroup != null ? mandGroup.GroupWithInRow : null,
                                      DisplayOrder = fieldSetting != null ? fieldSetting.DisplayOrder : link.MendSql,
                                      DisplaySettingsJson = fieldSetting != null ? fieldSetting.DisplaySettingsJson : null
                                  })
                .ToListAsync(cancellationToken);

            var normalizedFieldKeys = linkRows
                .Select(item => NormalizeFieldKey(item.MendField))
                .Where(item => item.Length > 0)
                .Distinct(StringComparer.Ordinal)
                .ToHashSet(StringComparer.Ordinal);
            var allMends = await _connectContext.Cdmends
                .AsNoTracking()
                .ToListAsync(cancellationToken);
            var mendLookup = allMends
                .Where(item => normalizedFieldKeys.Contains(NormalizeFieldKey(item.CdmendTxt)))
                .GroupBy(item => NormalizeFieldKey(item.CdmendTxt))
                .ToDictionary(group => group.Key, group => group.ToList(), StringComparer.Ordinal);

            var normalizedRequestAppId = NormalizeApplicationId(appId);
            var normalizedCategoryAppId = NormalizeApplicationId(category.ApplicationId);
            var fieldRows = new List<SubjectFieldDefinitionDto>();
            var unmatchedFieldKeys = new List<string>();
            var statusFallbackCount = 0;

            foreach (var linkRow in linkRows
                         .OrderBy(item => item.MendGroup)
                         .ThenBy(item => item.DisplayOrder)
                         .ThenBy(item => item.MendSql))
            {
                var normalizedFieldKey = NormalizeFieldKey(linkRow.MendField);
                if (!mendLookup.TryGetValue(normalizedFieldKey, out var fieldCandidates) || fieldCandidates.Count == 0)
                {
                    unmatchedFieldKeys.Add(linkRow.MendField ?? string.Empty);
                    continue;
                }

                var selectedMetadata = SelectPreferredMend(
                    fieldCandidates,
                    normalizedRequestAppId,
                    normalizedCategoryAppId,
                    out var usedLegacyStatusFallback);
                if (selectedMetadata == null)
                {
                    unmatchedFieldKeys.Add(linkRow.MendField ?? string.Empty);
                    continue;
                }

                if (usedLegacyStatusFallback)
                {
                    statusFallbackCount++;
                }

                fieldRows.Add(new SubjectFieldDefinitionDto
                {
                    MendSql = linkRow.MendSql,
                    CategoryId = linkRow.MendCategory,
                    MendGroup = linkRow.MendGroup,
                    FieldKey = selectedMetadata.CdmendTxt,
                    FieldType = selectedMetadata.CdmendType,
                    FieldLabel = selectedMetadata.CDMendLbl,
                    Placeholder = selectedMetadata.Placeholder,
                    DefaultValue = selectedMetadata.DefaultValue,
                    OptionsPayload = selectedMetadata.CdmendTbl,
                    DataType = selectedMetadata.CdmendDatatype,
                    Required = selectedMetadata.Required == true,
                    RequiredTrue = selectedMetadata.RequiredTrue == true,
                    Email = selectedMetadata.Email == true,
                    Pattern = selectedMetadata.Pattern == true,
                    MinValue = selectedMetadata.MinValue,
                    MaxValue = selectedMetadata.MaxValue,
                    Mask = selectedMetadata.Cdmendmask,
                    IsDisabledInit = selectedMetadata.IsDisabledInit,
                    IsSearchable = selectedMetadata.IsSearchable,
                    Width = selectedMetadata.Width,
                    Height = selectedMetadata.Height,
                    ApplicationId = selectedMetadata.ApplicationId,
                    DisplayOrder = linkRow.DisplayOrder,
                    IsVisible = true,
                    DisplaySettingsJson = linkRow.DisplaySettingsJson,
                    Group = new SubjectGroupDefinitionDto
                    {
                        GroupId = linkRow.MendGroup,
                        GroupName = linkRow.GroupName ?? string.Empty,
                        GroupDescription = linkRow.GroupDescription,
                        IsExtendable = linkRow.IsExtendable,
                        GroupWithInRow = linkRow.GroupWithInRow
                    }
                });
            }

            _logger?.LogDebug(
                "DynamicSubjects FormDefinition diagnostics for category {CategoryId}: links={LinksCount}, mends={MendsCount}, matched={MatchedCount}, unmatched={UnmatchedCount}, legacyStatusFallback={LegacyStatusFallbackCount}, requestAppId={RequestAppId}, categoryAppId={CategoryAppId}",
                categoryId,
                linkRows.Count,
                allMends.Count,
                fieldRows.Count,
                unmatchedFieldKeys.Count,
                statusFallbackCount,
                normalizedRequestAppId,
                normalizedCategoryAppId);
            if (unmatchedFieldKeys.Count > 0)
            {
                _logger?.LogWarning(
                    "DynamicSubjects FormDefinition unmatched fields for category {CategoryId}: {UnmatchedFields}",
                    categoryId,
                    string.Join(", ", unmatchedFieldKeys.Distinct(StringComparer.OrdinalIgnoreCase).Take(20)));
            }

            response.Data = new SubjectFormDefinitionDto
            {
                CategoryId = category.CatId,
                CategoryName = category.CatName,
                ParentCategoryId = category.CatParent,
                ApplicationId = category.ApplicationId,
                Groups = fieldRows
                    .Select(field => field.Group)
                    .Where(group => group != null)
                    .GroupBy(group => group!.GroupId)
                    .Select(grouping => grouping.First()!)
                    .OrderBy(group => group.GroupId)
                    .ToList(),
                Fields = fieldRows
            };
        }
        catch (Exception)
        {
            response.Errors.Add(new Error { Code = "500", Message = "حدث خطأ غير متوقع أثناء تحميل تعريف النموذج." });
        }

        return response;
    }

    private static string NormalizeFieldKey(string? fieldKey)
    {
        return (fieldKey ?? string.Empty).Trim().ToLowerInvariant();
    }

    private static string NormalizeApplicationId(string? applicationId)
    {
        return (applicationId ?? string.Empty).Trim();
    }

    private static Cdmend? SelectPreferredMend(
        IReadOnlyCollection<Cdmend> candidates,
        string normalizedRequestAppId,
        string normalizedCategoryAppId,
        out bool usedLegacyStatusFallback)
    {
        usedLegacyStatusFallback = false;
        if (candidates == null || candidates.Count == 0)
        {
            return null;
        }

        var rankedPool = candidates
            .OrderBy(item => GetApplicationRank(item, normalizedRequestAppId, normalizedCategoryAppId))
            .ThenBy(item => item.CdmendSql)
            .ToList();
        if (rankedPool.Count == 0)
        {
            return null;
        }

        var bestRank = GetApplicationRank(rankedPool[0], normalizedRequestAppId, normalizedCategoryAppId);
        var sameRankPool = rankedPool
            .Where(item => GetApplicationRank(item, normalizedRequestAppId, normalizedCategoryAppId) == bestRank)
            .ToList();
        if (sameRankPool.Count == 0)
        {
            return null;
        }

        var activePool = sameRankPool
            .Where(item => !item.CdmendStat)
            .OrderBy(item => item.CdmendSql)
            .ToList();
        if (activePool.Count > 0)
        {
            return activePool[0];
        }

        usedLegacyStatusFallback = true;
        return sameRankPool
            .OrderBy(item => item.CdmendSql)
            .FirstOrDefault();
    }

    private static int GetApplicationRank(Cdmend metadata, string normalizedRequestAppId, string normalizedCategoryAppId)
    {
        var metadataAppId = NormalizeApplicationId(metadata.ApplicationId);
        if (normalizedRequestAppId.Length > 0
            && string.Equals(metadataAppId, normalizedRequestAppId, StringComparison.OrdinalIgnoreCase))
        {
            return 0;
        }

        if (normalizedCategoryAppId.Length > 0
            && string.Equals(metadataAppId, normalizedCategoryAppId, StringComparison.OrdinalIgnoreCase))
        {
            return 1;
        }

        if (metadataAppId.Length == 0)
        {
            return 2;
        }

        return 3;
    }

    private sealed class FormDefinitionLinkRow
    {
        public int MendSql { get; set; }
        public int MendCategory { get; set; }
        public string MendField { get; set; } = string.Empty;
        public int MendGroup { get; set; }
        public string? GroupName { get; set; }
        public string? GroupDescription { get; set; }
        public bool IsExtendable { get; set; }
        public short? GroupWithInRow { get; set; }
        public int DisplayOrder { get; set; }
        public string? DisplaySettingsJson { get; set; }
    }

    public async Task<CommonResponse<SubjectDetailDto>> CreateSubjectAsync(
        SubjectUpsertRequestDto request,
        IEnumerable<(string FileName, byte[] Content, string Extension, long Size)> attachments,
        string userId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<SubjectDetailDto>();
        try
        {
            var normalizedUserId = NormalizeUser(userId);
            if (normalizedUserId.Length == 0)
            {
                response.Errors.Add(new Error { Code = "401", Message = "المستخدم غير مصرح له." });
                return response;
            }

            var validation = await ValidateUpsertRequestAsync(request, normalizedUserId, cancellationToken);
            if (validation.Errors.Count > 0)
            {
                foreach (var error in validation.Errors)
                {
                    response.Errors.Add(error);
                }
                return response;
            }

            var category = validation.Category!;
            var messageActorId = NormalizeMessageActorId(normalizedUserId);
            var status = request.Submit
                ? (byte)MessageStatus.Submitted
                : (byte)MessageStatus.Draft;
            var messageId = _helperService.GetSequenceNextValue("Seq_Tickets");
            var fieldsMap = BuildFieldsMap(request.DynamicFields);
            var referenceNumber = await _referenceGenerator.GenerateAsync(category.CatId, messageId, fieldsMap, cancellationToken);
            var requestPolicy = await LoadCategoryRequestPolicyAsync(category.CatId, cancellationToken);
            var resolvedWorkflowPolicy = RequestPolicyResolver.ResolveWorkflowPolicy(requestPolicy);
            var primaryAssignedUnit = ResolvePrimaryUnitId(validation.UnitIds);
            var requestedTargetUnitId = NormalizeNullable(request.TargetUnitId);
            var workflowMode = NormalizeNullable(resolvedWorkflowPolicy.Mode)?.ToLowerInvariant() ?? "manual";
            var requiresManualTargetSelection = requestPolicy != null
                && (workflowMode == "manual" || workflowMode == "hybrid")
                && resolvedWorkflowPolicy.AllowManualSelection
                && resolvedWorkflowPolicy.ManualSelectionRequired
                && NormalizeNullable(resolvedWorkflowPolicy.ManualTargetFieldKey) != null;
            if (requiresManualTargetSelection && requestedTargetUnitId == null)
            {
                response.Errors.Add(new Error
                {
                    Code = "400",
                    Message = "سياسة التوجيه الحالية تتطلب اختيار جهة التوجيه يدويًا قبل إنشاء الطلب."
                });
                return response;
            }
            var assignedUnitId = ResolveWorkflowAssignedUnit(
                resolvedWorkflowPolicy,
                requestedTargetUnitId,
                primaryAssignedUnit);

            var subjectText = string.IsNullOrWhiteSpace(request.Subject)
                ? category.CatName
                : request.Subject!.Trim();
            if (subjectText.Length > 255)
            {
                subjectText = subjectText[..255];
            }

            var message = new Message
            {
                MessageId = messageId,
                CategoryCd = category.CatId,
                Type = ResolveType(category),
                Subject = subjectText,
                Description = request.Description,
                CreatedBy = messageActorId,
                AssignedSectorId = assignedUnitId,
                CurrentResponsibleSectorId = assignedUnitId,
                CreatedDate = DateTime.Now,
                LastModifiedDate = DateTime.Now,
                Status = (MessageStatus)status,
                Priority = Priority.Medium,
                RequestRef = referenceNumber
            };

            await _connectContext.Messages.AddAsync(message, cancellationToken);
            await _connectContext.SaveChangesAsync(cancellationToken);

            await UpsertDynamicFieldsInternalAsync(messageId, request.DynamicFields, cancellationToken);
            await UpsertStakeholdersInternalAsync(messageId, request.Stakeholders, cancellationToken);
            await UpsertTasksInternalAsync(messageId, request.Tasks, normalizedUserId, cancellationToken);
            await SaveAttachmentsInternalAsync(messageId, attachments, cancellationToken);

            await AddStatusHistoryInternalAsync(
                messageId,
                oldStatus: null,
                newStatus: status,
                notes: request.Submit ? "Subject submitted." : "Subject saved as draft.",
                changedBy: normalizedUserId,
                cancellationToken: cancellationToken);

            await AddTimelineInternalAsync(
                messageId,
                eventType: "SubjectCreated",
                eventTitle: "Subject created",
                payload: new Dictionary<string, object?>
                {
                    ["categoryId"] = category.CatId,
                    ["requestRef"] = referenceNumber,
                    ["status"] = status,
                    ["submit"] = request.Submit
                },
                statusFrom: null,
                statusTo: status,
                createdBy: normalizedUserId,
                cancellationToken: cancellationToken);

            if (request.EnvelopeId.HasValue && request.EnvelopeId.Value > 0)
            {
                await LinkSubjectToEnvelopeInternalAsync(request.EnvelopeId.Value, messageId, normalizedUserId, cancellationToken);
            }

            await _connectContext.SaveChangesAsync(cancellationToken);
            var detail = await BuildSubjectDetailAsync(messageId, cancellationToken);
            if (detail == null)
            {
                response.Errors.Add(new Error { Code = "500", Message = "Subject was created but could not be loaded." });
                return response;
            }

            response.Data = detail;

            await PublishSubjectEventAsync(
                "SubjectCreated",
                "subject",
                messageId,
                detail,
                normalizedUserId,
                cancellationToken);
        }
        catch (Exception ex)
        {
            var details = ex.InnerException?.Message ?? ex.Message;
            response.Errors.Add(new Error { Code = "500", Message = $"حدث خطأ غير متوقع أثناء إنشاء الموضوع. {details}" });
        }

        return response;
    }

    public async Task<CommonResponse<SubjectDetailDto>> UpdateSubjectAsync(
        int messageId,
        SubjectUpsertRequestDto request,
        IEnumerable<(string FileName, byte[] Content, string Extension, long Size)> attachments,
        string userId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<SubjectDetailDto>();
        try
        {
            var normalizedUserId = NormalizeUser(userId);
            if (normalizedUserId.Length == 0)
            {
                response.Errors.Add(new Error { Code = "401", Message = "المستخدم غير مصرح له." });
                return response;
            }

            var message = await _connectContext.Messages
                .FirstOrDefaultAsync(item => item.MessageId == messageId, cancellationToken);
            if (message == null)
            {
                response.Errors.Add(new Error { Code = "404", Message = "Subject not found." });
                return response;
            }

            if (!await CanUserAccessSubjectAsync(normalizedUserId, message, cancellationToken))
            {
                response.Errors.Add(new Error { Code = "403", Message = "Not allowed." });
                return response;
            }

            var validation = await ValidateUpsertRequestAsync(request, normalizedUserId, cancellationToken);
            if (validation.Errors.Count > 0)
            {
                foreach (var error in validation.Errors)
                {
                    response.Errors.Add(error);
                }
                return response;
            }

            var category = validation.Category!;
            if (category.CatId != message.CategoryCd)
            {
                response.Errors.Add(new Error { Code = "400", Message = "Category cannot be changed for existing subject." });
                return response;
            }

            var oldStatus = (byte)message.Status;
            var requestedStatus = request.Submit
                ? (byte)MessageStatus.Submitted
                : oldStatus;
            if (!SubjectWorkflowStatusCatalog.CanTransition(oldStatus, requestedStatus)
                && requestedStatus != oldStatus)
            {
                response.Errors.Add(new Error
                {
                    Code = "400",
                    Message = $"Invalid status transition from {SubjectWorkflowStatusCatalog.Label(oldStatus)} to {SubjectWorkflowStatusCatalog.Label(requestedStatus)}."
                });
                return response;
            }

            if (!string.IsNullOrWhiteSpace(request.Subject))
            {
                var subjectText = request.Subject.Trim();
                message.Subject = subjectText.Length > 255
                    ? subjectText[..255]
                    : subjectText;
            }
            message.Description = request.Description;
            message.LastModifiedDate = DateTime.Now;
            message.Status = (MessageStatus)requestedStatus;
            if (message.Status == MessageStatus.Completed || message.Status == MessageStatus.Archived)
            {
                message.ClosedDate = DateTime.Now;
            }

            await UpsertDynamicFieldsInternalAsync(messageId, request.DynamicFields, cancellationToken);
            await UpsertStakeholdersInternalAsync(messageId, request.Stakeholders, cancellationToken);
            await UpsertTasksInternalAsync(messageId, request.Tasks, normalizedUserId, cancellationToken);
            await SaveAttachmentsInternalAsync(messageId, attachments, cancellationToken);

            if (request.EnvelopeId.HasValue && request.EnvelopeId.Value > 0)
            {
                await LinkSubjectToEnvelopeInternalAsync(request.EnvelopeId.Value, messageId, normalizedUserId, cancellationToken);
            }

            if (oldStatus != requestedStatus)
            {
                await AddStatusHistoryInternalAsync(
                    messageId,
                    oldStatus,
                    requestedStatus,
                    "Status changed while updating subject.",
                    normalizedUserId,
                    cancellationToken);
            }

            await AddTimelineInternalAsync(
                messageId,
                eventType: "SubjectUpdated",
                eventTitle: "Subject updated",
                payload: new Dictionary<string, object?>
                {
                    ["subject"] = message.Subject,
                    ["hasAttachments"] = attachments != null && attachments.Any(),
                    ["status"] = requestedStatus
                },
                statusFrom: oldStatus,
                statusTo: requestedStatus,
                createdBy: normalizedUserId,
                cancellationToken: cancellationToken);

            await _connectContext.SaveChangesAsync(cancellationToken);

            var detail = await BuildSubjectDetailAsync(messageId, cancellationToken);
            if (detail == null)
            {
                response.Errors.Add(new Error { Code = "500", Message = "Subject was updated but could not be loaded." });
                return response;
            }

            response.Data = detail;

            await PublishSubjectEventAsync(
                oldStatus == requestedStatus ? "SubjectUpdated" : "SubjectStatusChanged",
                "subject",
                messageId,
                detail,
                normalizedUserId,
                cancellationToken);
        }
        catch (Exception ex)
        {
            response.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });
        }

        return response;
    }

    public async Task<CommonResponse<SubjectDetailDto>> GetSubjectAsync(
        int messageId,
        string userId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<SubjectDetailDto>();
        try
        {
            var normalizedUserId = NormalizeUser(userId);
            if (normalizedUserId.Length == 0)
            {
                response.Errors.Add(new Error { Code = "401", Message = "المستخدم غير مصرح له." });
                return response;
            }

            var message = await _connectContext.Messages
                .AsNoTracking()
                .FirstOrDefaultAsync(item => item.MessageId == messageId, cancellationToken);
            if (message == null)
            {
                response.Errors.Add(new Error { Code = "404", Message = "Subject not found." });
                return response;
            }

            if (!await CanUserAccessSubjectAsync(normalizedUserId, message, cancellationToken))
            {
                response.Errors.Add(new Error { Code = "403", Message = "Not allowed." });
                return response;
            }

            response.Data = await BuildSubjectDetailAsync(message, cancellationToken);
        }
        catch (Exception ex)
        {
            response.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });
        }

        return response;
    }

    public async Task<CommonResponse<PagedSubjectListDto>> ListSubjectsAsync(
        SubjectListQueryDto query,
        string userId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<PagedSubjectListDto>();
        try
        {
            var normalizedUserId = NormalizeUser(userId);
            if (normalizedUserId.Length == 0)
            {
                response.Errors.Add(new Error { Code = "401", Message = "المستخدم غير مصرح له." });
                return response;
            }

            var safeQuery = query ?? new SubjectListQueryDto();
            var pageNumber = safeQuery.PageNumber <= 0 ? 1 : safeQuery.PageNumber;
            var pageSize = safeQuery.PageSize <= 0 ? 20 : Math.Min(200, safeQuery.PageSize);

            var accessibleMessageIds = await GetAccessibleMessageIdsAsync(normalizedUserId, cancellationToken);
            var listQuery = _connectContext.Messages
                .AsNoTracking()
                .Where(message => accessibleMessageIds.Contains(message.MessageId));

            if (safeQuery.OnlyMyItems)
            {
                var messageActorId = NormalizeMessageActorId(normalizedUserId);
                listQuery = listQuery.Where(message => message.CreatedBy == normalizedUserId || message.CreatedBy == messageActorId);
            }

            if (safeQuery.CategoryId.HasValue && safeQuery.CategoryId.Value > 0)
            {
                listQuery = listQuery.Where(message => message.CategoryCd == safeQuery.CategoryId.Value);
            }

            if (safeQuery.Status.HasValue)
            {
                var statusValue = safeQuery.Status.Value;
                listQuery = listQuery.Where(message => (byte)message.Status == statusValue);
            }

            if (safeQuery.AssignedUnitId.HasValue && safeQuery.AssignedUnitId.Value > 0)
            {
                var assignedUnit = safeQuery.AssignedUnitId.Value.ToString(CultureInfo.InvariantCulture);
                listQuery = listQuery.Where(message => message.AssignedSectorId == assignedUnit || message.CurrentResponsibleSectorId == assignedUnit);
            }

            if (safeQuery.CreatedFrom.HasValue)
            {
                var from = safeQuery.CreatedFrom.Value.Date;
                listQuery = listQuery.Where(message => message.CreatedDate >= from);
            }

            if (safeQuery.CreatedTo.HasValue)
            {
                var toExclusive = safeQuery.CreatedTo.Value.Date.AddDays(1);
                listQuery = listQuery.Where(message => message.CreatedDate < toExclusive);
            }

            var searchText = (safeQuery.SearchText ?? string.Empty).Trim();
            if (searchText.Length > 0)
            {
                listQuery = listQuery.Where(message =>
                    (message.RequestRef ?? string.Empty).Contains(searchText)
                    || (message.Subject ?? string.Empty).Contains(searchText)
                    || (message.Description ?? string.Empty).Contains(searchText));
            }

            var totalCount = await listQuery.CountAsync(cancellationToken);
            var pageItems = await listQuery
                .OrderByDescending(message => message.LastModifiedDate ?? message.CreatedDate)
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync(cancellationToken);

            var pageIds = pageItems.Select(item => item.MessageId).ToList();
            var attachmentCounts = await _attachContext.AttchShipments
                .AsNoTracking()
                .Where(item => pageIds.Contains(item.AttchId) && (item.ApplicationName == "Connect" || item.ApplicationName == "Connect - Test" || item.ApplicationName == "Correspondance"))
                .GroupBy(item => item.AttchId)
                .Select(group => new { MessageId = group.Key, Count = group.Count() })
                .ToDictionaryAsync(item => item.MessageId, item => item.Count, cancellationToken);

            var stakeholderCounts = await _connectContext.MessageStockholders
                .AsNoTracking()
                .Where(item => item.MessageId.HasValue && pageIds.Contains(item.MessageId.Value))
                .GroupBy(item => item.MessageId!.Value)
                .Select(group => new { MessageId = group.Key, Count = group.Count() })
                .ToDictionaryAsync(item => item.MessageId, item => item.Count, cancellationToken);

            var taskCounts = await _connectContext.SubjectTasks
                .AsNoTracking()
                .Where(item => pageIds.Contains(item.MessageId))
                .GroupBy(item => item.MessageId)
                .Select(group => new { MessageId = group.Key, Count = group.Count() })
                .ToDictionaryAsync(item => item.MessageId, item => item.Count, cancellationToken);

            var envelopeCounts = await _connectContext.SubjectEnvelopeLinks
                .AsNoTracking()
                .Where(item => pageIds.Contains(item.MessageId))
                .GroupBy(item => item.MessageId)
                .Select(group => new { MessageId = group.Key, Count = group.Count() })
                .ToDictionaryAsync(item => item.MessageId, item => item.Count, cancellationToken);

            response.Data = new PagedSubjectListDto
            {
                TotalCount = totalCount,
                PageNumber = pageNumber,
                PageSize = pageSize,
                Items = pageItems.Select(item => new SubjectListItemDto
                {
                    MessageId = item.MessageId,
                    RequestRef = item.RequestRef,
                    Subject = item.Subject,
                    Description = item.Description,
                    CategoryId = item.CategoryCd,
                    Status = (byte)item.Status,
                    StatusLabel = SubjectWorkflowStatusCatalog.Label((byte)item.Status),
                    CreatedBy = item.CreatedBy,
                    AssignedUnitId = item.AssignedSectorId,
                    CreatedDate = item.CreatedDate,
                    LastModifiedDate = item.LastModifiedDate,
                    AttachmentsCount = attachmentCounts.TryGetValue(item.MessageId, out var attachmentCount) ? attachmentCount : 0,
                    StakeholdersCount = stakeholderCounts.TryGetValue(item.MessageId, out var stakeholderCount) ? stakeholderCount : 0,
                    TasksCount = taskCounts.TryGetValue(item.MessageId, out var taskCount) ? taskCount : 0,
                    EnvelopesCount = envelopeCounts.TryGetValue(item.MessageId, out var envelopeCount) ? envelopeCount : 0
                }).ToList()
            };
        }
        catch (Exception ex)
        {
            response.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });
        }

        return response;
    }

    public async Task<CommonResponse<SubjectStatusChangeResponseDto>> ChangeStatusAsync(
        int messageId,
        SubjectStatusChangeRequestDto request,
        string userId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<SubjectStatusChangeResponseDto>();
        try
        {
            var normalizedUserId = NormalizeUser(userId);
            if (normalizedUserId.Length == 0)
            {
                response.Errors.Add(new Error { Code = "401", Message = "المستخدم غير مصرح له." });
                return response;
            }

            var message = await _connectContext.Messages
                .FirstOrDefaultAsync(item => item.MessageId == messageId, cancellationToken);
            if (message == null)
            {
                response.Errors.Add(new Error { Code = "404", Message = "Subject not found." });
                return response;
            }

            if (!await CanUserAccessSubjectAsync(normalizedUserId, message, cancellationToken))
            {
                response.Errors.Add(new Error { Code = "403", Message = "Not allowed." });
                return response;
            }

            var oldStatus = (byte)message.Status;
            var newStatus = request.NewStatus;
            if (!SubjectWorkflowStatusCatalog.CanTransition(oldStatus, newStatus))
            {
                response.Errors.Add(new Error
                {
                    Code = "400",
                    Message = $"Invalid status transition from {SubjectWorkflowStatusCatalog.Label(oldStatus)} to {SubjectWorkflowStatusCatalog.Label(newStatus)}."
                });
                return response;
            }

            message.Status = (MessageStatus)newStatus;
            message.LastModifiedDate = DateTime.Now;
            if (newStatus == (byte)MessageStatus.Completed || newStatus == (byte)MessageStatus.Archived)
            {
                message.ClosedDate = DateTime.Now;
            }

            await AddStatusHistoryInternalAsync(
                messageId,
                oldStatus,
                newStatus,
                request.Notes,
                normalizedUserId,
                cancellationToken);

            await AddTimelineInternalAsync(
                messageId,
                eventType: "SubjectStatusChanged",
                eventTitle: $"Status changed to {SubjectWorkflowStatusCatalog.Label(newStatus)}",
                payload: new Dictionary<string, object?>
                {
                    ["oldStatus"] = oldStatus,
                    ["newStatus"] = newStatus,
                    ["notes"] = request.Notes
                },
                statusFrom: oldStatus,
                statusTo: newStatus,
                createdBy: normalizedUserId,
                cancellationToken: cancellationToken);

            await _connectContext.SaveChangesAsync(cancellationToken);

            response.Data = new SubjectStatusChangeResponseDto
            {
                MessageId = messageId,
                OldStatus = oldStatus,
                NewStatus = newStatus,
                ChangedAtUtc = DateTime.UtcNow,
                ChangedBy = normalizedUserId
            };

            var detail = await BuildSubjectDetailAsync(messageId, cancellationToken);
            if (detail != null)
            {
                await PublishSubjectEventAsync(
                    "SubjectStatusChanged",
                    "subject",
                    messageId,
                    detail,
                    normalizedUserId,
                    cancellationToken);
            }
        }
        catch (Exception ex)
        {
            response.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });
        }

        return response;
    }

    public async Task<CommonResponse<IEnumerable<SubjectAttachmentDto>>> AddAttachmentsAsync(
        int messageId,
        IEnumerable<(string FileName, byte[] Content, string Extension, long Size)> attachments,
        string userId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<IEnumerable<SubjectAttachmentDto>>();
        try
        {
            var normalizedUserId = NormalizeUser(userId);
            if (normalizedUserId.Length == 0)
            {
                response.Errors.Add(new Error { Code = "401", Message = "المستخدم غير مصرح له." });
                return response;
            }

            var message = await _connectContext.Messages
                .AsNoTracking()
                .FirstOrDefaultAsync(item => item.MessageId == messageId, cancellationToken);
            if (message == null)
            {
                response.Errors.Add(new Error { Code = "404", Message = "Subject not found." });
                return response;
            }

            if (!await CanUserAccessSubjectAsync(normalizedUserId, message, cancellationToken))
            {
                response.Errors.Add(new Error { Code = "403", Message = "Not allowed." });
                return response;
            }

            await SaveAttachmentsInternalAsync(messageId, attachments, cancellationToken);
            await AddTimelineInternalAsync(
                messageId,
                eventType: "AttachmentAdded",
                eventTitle: "Attachment added",
                payload: new Dictionary<string, object?>
                {
                    ["files"] = attachments?.Select(item => item.FileName).ToArray() ?? Array.Empty<string>()
                },
                statusFrom: null,
                statusTo: null,
                createdBy: normalizedUserId,
                cancellationToken: cancellationToken);
            await _connectContext.SaveChangesAsync(cancellationToken);

            var attachmentDtos = await LoadAttachmentsAsync(messageId, cancellationToken);
            response.Data = attachmentDtos;

            var detail = await BuildSubjectDetailAsync(messageId, cancellationToken);
            if (detail != null)
            {
                await PublishSubjectEventAsync(
                    "AttachmentAdded",
                    "subject",
                    messageId,
                    detail,
                    normalizedUserId,
                    cancellationToken);
            }
        }
        catch (Exception ex)
        {
            response.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });
        }

        return response;
    }

    public async Task<CommonResponse<bool>> RemoveAttachmentAsync(
        int messageId,
        int attachmentId,
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

            var message = await _connectContext.Messages
                .AsNoTracking()
                .FirstOrDefaultAsync(item => item.MessageId == messageId, cancellationToken);
            if (message == null)
            {
                response.Errors.Add(new Error { Code = "404", Message = "Subject not found." });
                return response;
            }

            if (!await CanUserAccessSubjectAsync(normalizedUserId, message, cancellationToken))
            {
                response.Errors.Add(new Error { Code = "403", Message = "Not allowed." });
                return response;
            }

            var attachment = await _attachContext.AttchShipments
                .FirstOrDefaultAsync(item => item.Id == attachmentId && item.AttchId == messageId, cancellationToken);
            if (attachment == null)
            {
                response.Errors.Add(new Error { Code = "404", Message = "Attachment not found." });
                return response;
            }

            _attachContext.AttchShipments.Remove(attachment);
            await _attachContext.SaveChangesAsync(cancellationToken);

            await AddTimelineInternalAsync(
                messageId,
                eventType: "AttachmentRemoved",
                eventTitle: "Attachment removed",
                payload: new Dictionary<string, object?>
                {
                    ["attachmentId"] = attachmentId,
                    ["fileName"] = attachment.AttchNm
                },
                statusFrom: null,
                statusTo: null,
                createdBy: normalizedUserId,
                cancellationToken: cancellationToken);
            await _connectContext.SaveChangesAsync(cancellationToken);

            response.Data = true;

            var detail = await BuildSubjectDetailAsync(messageId, cancellationToken);
            if (detail != null)
            {
                await PublishSubjectEventAsync(
                    "AttachmentRemoved",
                    "subject",
                    messageId,
                    detail,
                    normalizedUserId,
                    cancellationToken);
            }
        }
        catch (Exception ex)
        {
            response.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });
        }

        return response;
    }

    public async Task<CommonResponse<IEnumerable<SubjectStakeholderDto>>> UpsertStakeholdersAsync(
        int messageId,
        IReadOnlyCollection<SubjectStakeholderUpsertDto> stakeholders,
        string userId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<IEnumerable<SubjectStakeholderDto>>();
        try
        {
            var normalizedUserId = NormalizeUser(userId);
            if (normalizedUserId.Length == 0)
            {
                response.Errors.Add(new Error { Code = "401", Message = "المستخدم غير مصرح له." });
                return response;
            }

            var message = await _connectContext.Messages
                .AsNoTracking()
                .FirstOrDefaultAsync(item => item.MessageId == messageId, cancellationToken);
            if (message == null)
            {
                response.Errors.Add(new Error { Code = "404", Message = "Subject not found." });
                return response;
            }

            if (!await CanUserAccessSubjectAsync(normalizedUserId, message, cancellationToken))
            {
                response.Errors.Add(new Error { Code = "403", Message = "Not allowed." });
                return response;
            }

            await UpsertStakeholdersInternalAsync(messageId, stakeholders ?? Array.Empty<SubjectStakeholderUpsertDto>(), cancellationToken);

            await AddTimelineInternalAsync(
                messageId,
                eventType: "StakeholderAssigned",
                eventTitle: "Stakeholders updated",
                payload: new Dictionary<string, object?>
                {
                    ["count"] = stakeholders?.Count ?? 0
                },
                statusFrom: null,
                statusTo: null,
                createdBy: normalizedUserId,
                cancellationToken: cancellationToken);

            await _connectContext.SaveChangesAsync(cancellationToken);

            response.Data = await LoadStakeholdersAsync(messageId, cancellationToken);

            var detail = await BuildSubjectDetailAsync(messageId, cancellationToken);
            if (detail != null)
            {
                await PublishSubjectEventAsync(
                    "StakeholderAssigned",
                    "subject",
                    messageId,
                    detail,
                    normalizedUserId,
                    cancellationToken);
            }
        }
        catch (Exception ex)
        {
            response.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });
        }

        return response;
    }

    public async Task<CommonResponse<SubjectTaskDto>> UpsertTaskAsync(
        int messageId,
        SubjectTaskUpsertDto request,
        string userId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<SubjectTaskDto>();
        try
        {
            var normalizedUserId = NormalizeUser(userId);
            var auditActorId = NormalizeAuditActorId(normalizedUserId);
            if (normalizedUserId.Length == 0)
            {
                response.Errors.Add(new Error { Code = "401", Message = "المستخدم غير مصرح له." });
                return response;
            }

            var message = await _connectContext.Messages
                .AsNoTracking()
                .FirstOrDefaultAsync(item => item.MessageId == messageId, cancellationToken);
            if (message == null)
            {
                response.Errors.Add(new Error { Code = "404", Message = "Subject not found." });
                return response;
            }

            if (!await CanUserAccessSubjectAsync(normalizedUserId, message, cancellationToken))
            {
                response.Errors.Add(new Error { Code = "403", Message = "Not allowed." });
                return response;
            }

            if (string.IsNullOrWhiteSpace(request.ActionTitle))
            {
                response.Errors.Add(new Error { Code = "400", Message = "Action title is required." });
                return response;
            }

            var now = DateTime.UtcNow;
            var task = new SubjectTask
            {
                MessageId = messageId,
                ActionTitle = request.ActionTitle.Trim(),
                ActionDescription = request.ActionDescription,
                AssignedToUserId = NormalizeNullable(request.AssignedToUserId),
                AssignedUnitId = NormalizeNullable(request.AssignedUnitId),
                Status = request.Status,
                DueDateUtc = request.DueDateUtc,
                CreatedBy = auditActorId,
                CreatedAtUtc = now,
                LastModifiedBy = auditActorId,
                LastModifiedAtUtc = now
            };

            await _connectContext.SubjectTasks.AddAsync(task, cancellationToken);

            await AddTimelineInternalAsync(
                messageId,
                eventType: "TaskUpdated",
                eventTitle: "Task assigned/updated",
                payload: new Dictionary<string, object?>
                {
                    ["title"] = task.ActionTitle,
                    ["assignedToUserId"] = task.AssignedToUserId,
                    ["assignedUnitId"] = task.AssignedUnitId,
                    ["status"] = task.Status
                },
                statusFrom: null,
                statusTo: null,
                createdBy: normalizedUserId,
                cancellationToken: cancellationToken);

            await _connectContext.SaveChangesAsync(cancellationToken);

            response.Data = new SubjectTaskDto
            {
                TaskId = task.TaskId,
                ActionTitle = task.ActionTitle,
                ActionDescription = task.ActionDescription,
                AssignedToUserId = task.AssignedToUserId,
                AssignedUnitId = task.AssignedUnitId,
                Status = task.Status,
                DueDateUtc = task.DueDateUtc,
                CompletedAtUtc = task.CompletedAtUtc,
                CreatedAtUtc = task.CreatedAtUtc
            };

            var detail = await BuildSubjectDetailAsync(messageId, cancellationToken);
            if (detail != null)
            {
                await PublishSubjectEventAsync(
                    "TaskUpdated",
                    "subject",
                    messageId,
                    detail,
                    normalizedUserId,
                    cancellationToken);
            }
        }
        catch (Exception ex)
        {
            response.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });
        }

        return response;
    }

    public async Task<CommonResponse<PagedEnvelopeListDto>> ListEnvelopesAsync(
        EnvelopeListQueryDto query,
        string userId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<PagedEnvelopeListDto>();
        try
        {
            var normalizedUserId = NormalizeUser(userId);
            if (normalizedUserId.Length == 0)
            {
                response.Errors.Add(new Error { Code = "401", Message = "المستخدم غير مصرح له." });
                return response;
            }

            var safeQuery = query ?? new EnvelopeListQueryDto();
            var pageNumber = safeQuery.PageNumber <= 0 ? 1 : safeQuery.PageNumber;
            var pageSize = safeQuery.PageSize <= 0 ? 20 : Math.Min(200, safeQuery.PageSize);

            var envelopeQuery = _connectContext.SubjectEnvelopes.AsNoTracking().AsQueryable();
            if (safeQuery.IncomingDateFrom.HasValue)
            {
                envelopeQuery = envelopeQuery.Where(item => item.IncomingDate >= safeQuery.IncomingDateFrom.Value.Date);
            }

            if (safeQuery.IncomingDateTo.HasValue)
            {
                var toExclusive = safeQuery.IncomingDateTo.Value.Date.AddDays(1);
                envelopeQuery = envelopeQuery.Where(item => item.IncomingDate < toExclusive);
            }

            var search = (safeQuery.SearchText ?? string.Empty).Trim();
            if (search.Length > 0)
            {
                envelopeQuery = envelopeQuery.Where(item =>
                    (item.EnvelopeRef ?? string.Empty).Contains(search)
                    || (item.SourceEntity ?? string.Empty).Contains(search)
                    || (item.DeliveryDelegate ?? string.Empty).Contains(search));
            }

            var totalCount = await envelopeQuery.CountAsync(cancellationToken);
            var pageItems = await envelopeQuery
                .OrderByDescending(item => item.IncomingDate)
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync(cancellationToken);

            var envelopeIds = pageItems.Select(item => item.EnvelopeId).ToList();
            var linksCount = await _connectContext.SubjectEnvelopeLinks
                .AsNoTracking()
                .Where(link => envelopeIds.Contains(link.EnvelopeId))
                .GroupBy(link => link.EnvelopeId)
                .Select(group => new { EnvelopeId = group.Key, Count = group.Count() })
                .ToDictionaryAsync(item => item.EnvelopeId, item => item.Count, cancellationToken);

            response.Data = new PagedEnvelopeListDto
            {
                TotalCount = totalCount,
                PageNumber = pageNumber,
                PageSize = pageSize,
                Items = pageItems.Select(item => new EnvelopeSummaryDto
                {
                    EnvelopeId = item.EnvelopeId,
                    EnvelopeRef = item.EnvelopeRef,
                    IncomingDate = item.IncomingDate,
                    SourceEntity = item.SourceEntity,
                    DeliveryDelegate = item.DeliveryDelegate,
                    LinkedSubjectsCount = linksCount.TryGetValue(item.EnvelopeId, out var count) ? count : 0
                }).ToList()
            };
        }
        catch (Exception ex)
        {
            response.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });
        }

        return response;
    }

    public async Task<CommonResponse<EnvelopeDetailDto>> CreateEnvelopeAsync(
        EnvelopeUpsertRequestDto request,
        string userId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<EnvelopeDetailDto>();
        try
        {
            var normalizedUserId = NormalizeUser(userId);
            var auditActorId = NormalizeAuditActorId(normalizedUserId);
            if (normalizedUserId.Length == 0)
            {
                response.Errors.Add(new Error { Code = "401", Message = "المستخدم غير مصرح له." });
                return response;
            }

            var envelopeRef = (request.EnvelopeRef ?? string.Empty).Trim();
            if (envelopeRef.Length == 0)
            {
                response.Errors.Add(new Error { Code = "400", Message = "Envelope reference is required." });
                return response;
            }

            var exists = await _connectContext.SubjectEnvelopes
                .AsNoTracking()
                .AnyAsync(item => item.EnvelopeRef == envelopeRef, cancellationToken);
            if (exists)
            {
                response.Errors.Add(new Error { Code = "409", Message = "Envelope reference already exists." });
                return response;
            }

            var envelope = new SubjectEnvelope
            {
                EnvelopeRef = envelopeRef,
                IncomingDate = request.IncomingDate == default ? DateTime.UtcNow.Date : request.IncomingDate,
                SourceEntity = request.SourceEntity,
                DeliveryDelegate = request.DeliveryDelegate,
                Notes = request.Notes,
                CreatedBy = auditActorId,
                CreatedAtUtc = DateTime.UtcNow,
                LastModifiedBy = auditActorId,
                LastModifiedAtUtc = DateTime.UtcNow
            };

            await _connectContext.SubjectEnvelopes.AddAsync(envelope, cancellationToken);
            await _connectContext.SaveChangesAsync(cancellationToken);

            if (request.LinkedSubjectIds != null && request.LinkedSubjectIds.Count > 0)
            {
                foreach (var messageId in request.LinkedSubjectIds.Distinct().Where(item => item > 0))
                {
                    await LinkSubjectToEnvelopeInternalAsync(envelope.EnvelopeId, messageId, normalizedUserId, cancellationToken);
                }
            }

            await _connectContext.SaveChangesAsync(cancellationToken);

            var detail = await BuildEnvelopeDetailAsync(envelope.EnvelopeId, cancellationToken);
            if (detail == null)
            {
                response.Errors.Add(new Error { Code = "500", Message = "Envelope was created but could not be loaded." });
                return response;
            }

            response.Data = detail;

            await PublishEnvelopeEventAsync(
                "EnvelopeCreated",
                envelope.EnvelopeId,
                null,
                normalizedUserId,
                cancellationToken);
        }
        catch (Exception ex)
        {
            response.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });
        }

        return response;
    }

    public async Task<CommonResponse<EnvelopeDetailDto>> UpdateEnvelopeAsync(
        int envelopeId,
        EnvelopeUpsertRequestDto request,
        string userId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<EnvelopeDetailDto>();
        try
        {
            var normalizedUserId = NormalizeUser(userId);
            var auditActorId = NormalizeAuditActorId(normalizedUserId);
            if (normalizedUserId.Length == 0)
            {
                response.Errors.Add(new Error { Code = "401", Message = "المستخدم غير مصرح له." });
                return response;
            }

            var envelope = await _connectContext.SubjectEnvelopes
                .FirstOrDefaultAsync(item => item.EnvelopeId == envelopeId, cancellationToken);
            if (envelope == null)
            {
                response.Errors.Add(new Error { Code = "404", Message = "Envelope not found." });
                return response;
            }

            var envelopeRef = (request.EnvelopeRef ?? string.Empty).Trim();
            if (envelopeRef.Length == 0)
            {
                response.Errors.Add(new Error { Code = "400", Message = "Envelope reference is required." });
                return response;
            }

            var exists = await _connectContext.SubjectEnvelopes
                .AsNoTracking()
                .AnyAsync(item => item.EnvelopeId != envelopeId && item.EnvelopeRef == envelopeRef, cancellationToken);
            if (exists)
            {
                response.Errors.Add(new Error { Code = "409", Message = "Envelope reference already exists." });
                return response;
            }

            envelope.EnvelopeRef = envelopeRef;
            envelope.IncomingDate = request.IncomingDate == default ? envelope.IncomingDate : request.IncomingDate;
            envelope.SourceEntity = request.SourceEntity;
            envelope.DeliveryDelegate = request.DeliveryDelegate;
            envelope.Notes = request.Notes;
            envelope.LastModifiedBy = auditActorId;
            envelope.LastModifiedAtUtc = DateTime.UtcNow;

            var existingLinks = await _connectContext.SubjectEnvelopeLinks
                .Where(link => link.EnvelopeId == envelopeId)
                .ToListAsync(cancellationToken);
            var incomingIds = (request.LinkedSubjectIds ?? new List<int>())
                .Where(item => item > 0)
                .Distinct()
                .ToHashSet();

            foreach (var link in existingLinks)
            {
                if (!incomingIds.Contains(link.MessageId))
                {
                    _connectContext.SubjectEnvelopeLinks.Remove(link);
                    await AddTimelineInternalAsync(
                        link.MessageId,
                        eventType: "EnvelopeUnlinked",
                        eventTitle: "Envelope unlinked",
                        payload: new Dictionary<string, object?>
                        {
                            ["envelopeId"] = envelopeId,
                            ["envelopeRef"] = envelope.EnvelopeRef
                        },
                        statusFrom: null,
                        statusTo: null,
                        createdBy: normalizedUserId,
                        cancellationToken: cancellationToken);
                }
            }

            foreach (var subjectId in incomingIds)
            {
                if (!existingLinks.Any(link => link.MessageId == subjectId))
                {
                    await LinkSubjectToEnvelopeInternalAsync(envelopeId, subjectId, normalizedUserId, cancellationToken);
                }
            }

            await _connectContext.SaveChangesAsync(cancellationToken);

            var detail = await BuildEnvelopeDetailAsync(envelopeId, cancellationToken);
            if (detail == null)
            {
                response.Errors.Add(new Error { Code = "500", Message = "Envelope was updated but could not be loaded." });
                return response;
            }

            response.Data = detail;
            await PublishEnvelopeEventAsync(
                "EnvelopeUpdated",
                envelopeId,
                null,
                normalizedUserId,
                cancellationToken);
        }
        catch (Exception ex)
        {
            response.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });
        }

        return response;
    }

    public async Task<CommonResponse<EnvelopeDetailDto>> GetEnvelopeAsync(
        int envelopeId,
        string userId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<EnvelopeDetailDto>();
        try
        {
            var normalizedUserId = NormalizeUser(userId);
            if (normalizedUserId.Length == 0)
            {
                response.Errors.Add(new Error { Code = "401", Message = "المستخدم غير مصرح له." });
                return response;
            }

            var detail = await BuildEnvelopeDetailAsync(envelopeId, cancellationToken);
            if (detail == null)
            {
                response.Errors.Add(new Error { Code = "404", Message = "Envelope not found." });
                return response;
            }

            response.Data = detail;
        }
        catch (Exception ex)
        {
            response.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });
        }

        return response;
    }

    public async Task<CommonResponse<bool>> LinkSubjectToEnvelopeAsync(
        int envelopeId,
        int messageId,
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

            await LinkSubjectToEnvelopeInternalAsync(envelopeId, messageId, normalizedUserId, cancellationToken);
            await _connectContext.SaveChangesAsync(cancellationToken);

            response.Data = true;

            await PublishEnvelopeEventAsync(
                "EnvelopeLinked",
                envelopeId,
                messageId,
                normalizedUserId,
                cancellationToken);
        }
        catch (Exception ex)
        {
            response.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });
        }

        return response;
    }

    public async Task<CommonResponse<bool>> UnlinkSubjectFromEnvelopeAsync(
        int envelopeId,
        int messageId,
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

            var link = await _connectContext.SubjectEnvelopeLinks
                .FirstOrDefaultAsync(item => item.EnvelopeId == envelopeId && item.MessageId == messageId, cancellationToken);
            if (link == null)
            {
                response.Errors.Add(new Error { Code = "404", Message = "Link not found." });
                return response;
            }

            _connectContext.SubjectEnvelopeLinks.Remove(link);
            await AddTimelineInternalAsync(
                messageId,
                eventType: "EnvelopeUnlinked",
                eventTitle: "Envelope unlinked",
                payload: new Dictionary<string, object?>
                {
                    ["envelopeId"] = envelopeId
                },
                statusFrom: null,
                statusTo: null,
                createdBy: normalizedUserId,
                cancellationToken: cancellationToken);
            await _connectContext.SaveChangesAsync(cancellationToken);

            response.Data = true;

            await PublishEnvelopeEventAsync(
                "EnvelopeUnlinked",
                envelopeId,
                messageId,
                normalizedUserId,
                cancellationToken);
        }
        catch (Exception ex)
        {
            response.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });
        }

        return response;
    }

    public async Task<CommonResponse<SubjectDashboardDto>> GetDashboardAsync(
        SubjectDashboardQueryDto query,
        string userId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<SubjectDashboardDto>();
        try
        {
            var normalizedUserId = NormalizeUser(userId);
            if (normalizedUserId.Length == 0)
            {
                response.Errors.Add(new Error { Code = "401", Message = "المستخدم غير مصرح له." });
                return response;
            }

            var accessibleMessageIds = await GetAccessibleMessageIdsAsync(normalizedUserId, cancellationToken);
            var subjectsQuery = _connectContext.Messages
                .AsNoTracking()
                .Where(item => accessibleMessageIds.Contains(item.MessageId));

            if (query?.OnlyMyItems == true)
            {
                var messageActorId = NormalizeMessageActorId(normalizedUserId);
                subjectsQuery = subjectsQuery.Where(item => item.CreatedBy == normalizedUserId || item.CreatedBy == messageActorId);
            }

            if (query?.CategoryId.HasValue == true && query.CategoryId.Value > 0)
            {
                subjectsQuery = subjectsQuery.Where(item => item.CategoryCd == query.CategoryId.Value);
            }

            if (query?.UnitId.HasValue == true && query.UnitId.Value > 0)
            {
                var unitText = query.UnitId.Value.ToString(CultureInfo.InvariantCulture);
                subjectsQuery = subjectsQuery.Where(item => item.AssignedSectorId == unitText || item.CurrentResponsibleSectorId == unitText);
            }

            var items = await subjectsQuery.ToListAsync(cancellationToken);
            var subjectIds = items.Select(item => item.MessageId).ToList();

            var openTasksCount = await _connectContext.SubjectTasks
                .AsNoTracking()
                .Where(task => subjectIds.Contains(task.MessageId) && task.Status != (byte)1)
                .CountAsync(cancellationToken);

            var envelopesCount = await _connectContext.SubjectEnvelopeLinks
                .AsNoTracking()
                .Where(link => subjectIds.Contains(link.MessageId))
                .Select(link => link.EnvelopeId)
                .Distinct()
                .CountAsync(cancellationToken);

            var recentUpdates = await _connectContext.SubjectTimelineEvents
                .AsNoTracking()
                .Where(eventItem => subjectIds.Contains(eventItem.MessageId))
                .OrderByDescending(eventItem => eventItem.CreatedAtUtc)
                .Take(20)
                .Select(eventItem => new SubjectTimelineEventDto
                {
                    TimelineEventId = eventItem.TimelineEventId,
                    EventType = eventItem.EventType,
                    EventTitle = eventItem.EventTitle,
                    EventPayloadJson = eventItem.EventPayloadJson,
                    StatusFrom = eventItem.StatusFrom,
                    StatusTo = eventItem.StatusTo,
                    CreatedBy = eventItem.CreatedBy,
                    CreatedAtUtc = eventItem.CreatedAtUtc
                })
                .ToListAsync(cancellationToken);

            var recentSubjects = items
                .OrderByDescending(item => item.LastModifiedDate ?? item.CreatedDate)
                .Take(15)
                .Select(item => new SubjectListItemDto
                {
                    MessageId = item.MessageId,
                    RequestRef = item.RequestRef,
                    Subject = item.Subject,
                    Description = item.Description,
                    CategoryId = item.CategoryCd,
                    Status = (byte)item.Status,
                    StatusLabel = SubjectWorkflowStatusCatalog.Label((byte)item.Status),
                    CreatedBy = item.CreatedBy,
                    AssignedUnitId = item.AssignedSectorId,
                    CreatedDate = item.CreatedDate,
                    LastModifiedDate = item.LastModifiedDate,
                    AttachmentsCount = 0,
                    StakeholdersCount = 0,
                    TasksCount = 0,
                    EnvelopesCount = 0
                })
                .ToList();

            var groupedStatus = items
                .GroupBy(item => (byte)item.Status)
                .ToDictionary(group => group.Key, group => group.Count());

            var dashboard = new SubjectDashboardDto
            {
                TotalSubjects = items.Count,
                DraftCount = groupedStatus.TryGetValue((byte)MessageStatus.Draft, out var draftCount) ? draftCount : 0,
                SubmittedCount = groupedStatus.TryGetValue((byte)MessageStatus.Submitted, out var submittedCount) ? submittedCount : 0,
                UnderReviewCount = groupedStatus.TryGetValue((byte)MessageStatus.UnderReview, out var reviewCount) ? reviewCount : 0,
                PendingCompletionCount = groupedStatus.TryGetValue((byte)MessageStatus.PendingCompletion, out var pendingCount) ? pendingCount : 0,
                InProgressCount = groupedStatus.TryGetValue((byte)MessageStatus.WorkflowInProgress, out var inProgressCount) ? inProgressCount : 0,
                CompletedCount = groupedStatus.TryGetValue((byte)MessageStatus.Completed, out var completedCount) ? completedCount : 0,
                RejectedCount = groupedStatus.TryGetValue((byte)MessageStatus.WorkflowRejected, out var rejectedCount) ? rejectedCount : 0,
                ArchivedCount = groupedStatus.TryGetValue((byte)MessageStatus.Archived, out var archivedCount) ? archivedCount : 0,
                TotalEnvelopes = envelopesCount,
                OpenTasksCount = openTasksCount,
                RecentSubjects = recentSubjects,
                RecentUpdates = recentUpdates
            };

            dashboard.StatusCards = new List<SubjectDashboardCardDto>
            {
                new() { Key = "draft", Label = "Draft", Count = dashboard.DraftCount },
                new() { Key = "submitted", Label = "Submitted", Count = dashboard.SubmittedCount },
                new() { Key = "underReview", Label = "Under Review", Count = dashboard.UnderReviewCount },
                new() { Key = "pending", Label = "Pending Completion", Count = dashboard.PendingCompletionCount },
                new() { Key = "inProgress", Label = "In Progress", Count = dashboard.InProgressCount },
                new() { Key = "completed", Label = "Completed", Count = dashboard.CompletedCount },
                new() { Key = "rejected", Label = "Rejected", Count = dashboard.RejectedCount },
                new() { Key = "archived", Label = "Archived", Count = dashboard.ArchivedCount }
            };

            response.Data = dashboard;
        }
        catch (Exception ex)
        {
            response.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });
        }

        return response;
    }

    public async Task<CommonResponse<IEnumerable<SubjectTypeAdminDto>>> GetSubjectTypeAdminConfigsAsync(
        string userId,
        string? appId,
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

            IQueryable<Cdcategory> categoriesQuery = _connectContext.Cdcategories.AsNoTracking();
            var normalizedAppId = NormalizeNullable(appId);
            if (normalizedAppId != null)
            {
                categoriesQuery = categoriesQuery.Where(category =>
                    (category.ApplicationId ?? string.Empty) == normalizedAppId);
            }

            var categories = await categoriesQuery
                .OrderBy(category => category.CatParent)
                .ThenBy(category => category.CatName)
                .ToListAsync(cancellationToken);
            var categoryIds = categories.Select(item => item.CatId).ToList();

            var categoriesWithFields = await _connectContext.CdCategoryMands
                .AsNoTracking()
                .Where(link => categoryIds.Contains(link.MendCategory) && !link.MendStat)
                .Select(link => link.MendCategory)
                .Distinct()
                .ToListAsync(cancellationToken);
            var categoriesWithFieldsSet = categoriesWithFields.ToHashSet();

            var policyMap = await _connectContext.SubjectReferencePolicies
                .AsNoTracking()
                .Where(policy => categoryIds.Contains(policy.CategoryId))
                .ToDictionaryAsync(policy => policy.CategoryId, cancellationToken);
            var settingsMap = await _connectContext.SubjectTypeAdminSettings
                .AsNoTracking()
                .Where(setting => categoryIds.Contains(setting.CategoryId))
                .ToDictionaryAsync(setting => setting.CategoryId, cancellationToken);

            response.Data = categories
                .OrderBy(category => category.CatParent)
                .ThenBy(category =>
                    settingsMap.TryGetValue(category.CatId, out var setting)
                        ? setting.DisplayOrder
                        : int.MaxValue)
                .ThenBy(category => category.CatName)
                .Select(category =>
                {
                    policyMap.TryGetValue(category.CatId, out var policy);
                    settingsMap.TryGetValue(category.CatId, out var settings);
                    return BuildSubjectTypeAdminDto(category, categoriesWithFieldsSet.Contains(category.CatId), policy, settings);
                })
                .ToList();
        }
        catch (Exception ex)
        {
            response.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });
        }

        return response;
    }

    public async Task<CommonResponse<SubjectTypeAdminDto>> UpsertSubjectTypeAdminConfigAsync(
        int categoryId,
        SubjectTypeAdminUpsertRequestDto request,
        string userId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<SubjectTypeAdminDto>();
        try
        {
            var normalizedUserId = NormalizeUser(userId);
            var auditActorId = NormalizeAuditActorId(normalizedUserId);
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

            var safeRequest = request ?? new SubjectTypeAdminUpsertRequestDto();
            var normalizedRequestPolicy = safeRequest.RequestPolicy == null
                ? null
                : RequestPolicyResolver.Normalize(safeRequest.RequestPolicy);
            var policyValidationErrors = RequestPolicyResolver.Validate(normalizedRequestPolicy);
            if (policyValidationErrors.Count > 0)
            {
                foreach (var validationError in policyValidationErrors)
                {
                    response.Errors.Add(validationError);
                }

                return response;
            }

            var category = await _connectContext.Cdcategories
                .FirstOrDefaultAsync(item => item.CatId == categoryId, cancellationToken);
            if (category == null)
            {
                response.Errors.Add(new Error { Code = "404", Message = "النوع غير موجود." });
                return response;
            }

            category.CatStatus = !safeRequest.IsActive;

            var policy = await _connectContext.SubjectReferencePolicies
                .FirstOrDefaultAsync(item => item.CategoryId == categoryId, cancellationToken);
            var categorySetting = await _connectContext.SubjectTypeAdminSettings
                .FirstOrDefaultAsync(setting => setting.CategoryId == categoryId, cancellationToken);
            if (categorySetting == null)
            {
                categorySetting = new SubjectTypeAdminSetting
                {
                    CategoryId = categoryId,
                    DisplayOrder = await ResolveNextCategoryDisplayOrderAsync(category.CatParent, cancellationToken),
                    SettingsJson = null,
                    LastModifiedBy = normalizedUserId,
                    LastModifiedAtUtc = DateTime.UtcNow
                };
                await _connectContext.SubjectTypeAdminSettings.AddAsync(categorySetting, cancellationToken);
            }

            var prefix = (safeRequest.ReferencePrefix ?? string.Empty).Trim();
            if (prefix.Length == 0)
            {
                prefix = $"SUBJ{categoryId}";
            }

            if (prefix.Length > 40)
            {
                response.Errors.Add(new Error { Code = "400", Message = "بادئة المرجع يجب ألا تزيد عن 40 حرفًا." });
                return response;
            }

            var separator = (safeRequest.ReferenceSeparator ?? "-").Trim();
            if (separator.Length == 0)
            {
                separator = "-";
            }

            if (separator.Length > 10)
            {
                response.Errors.Add(new Error { Code = "400", Message = "فاصل المرجع يجب ألا يزيد عن 10 أحرف." });
                return response;
            }

            var sourceFieldKeys = NormalizeNullable(safeRequest.SourceFieldKeys);
            if (sourceFieldKeys != null && sourceFieldKeys.Length > 500)
            {
                response.Errors.Add(new Error { Code = "400", Message = "حقول المصدر يجب ألا تزيد عن 500 حرف." });
                return response;
            }

            var sequenceName = NormalizeNullable(safeRequest.SequenceName);
            if (safeRequest.UseSequence && sequenceName == null)
            {
                sequenceName = "Seq_Tickets";
            }

            if (sequenceName != null && sequenceName.Length > 80)
            {
                response.Errors.Add(new Error { Code = "400", Message = "اسم التسلسل يجب ألا يزيد عن 80 حرفًا." });
                return response;
            }

            if (policy == null)
            {
                policy = new SubjectReferencePolicy
                {
                    CategoryId = categoryId,
                    Prefix = prefix,
                    Separator = separator,
                    SourceFieldKeys = sourceFieldKeys,
                    IncludeYear = safeRequest.IncludeYear,
                    UseSequence = safeRequest.UseSequence,
                    SequenceName = sequenceName,
                    IsActive = safeRequest.ReferencePolicyEnabled,
                    CreatedBy = auditActorId,
                    CreatedAtUtc = DateTime.UtcNow,
                    LastModifiedBy = auditActorId,
                    LastModifiedAtUtc = DateTime.UtcNow
                };
                await _connectContext.SubjectReferencePolicies.AddAsync(policy, cancellationToken);
            }
            else
            {
                policy.Prefix = prefix;
                policy.Separator = separator;
                policy.SourceFieldKeys = sourceFieldKeys;
                policy.IncludeYear = safeRequest.IncludeYear;
                policy.UseSequence = safeRequest.UseSequence;
                policy.SequenceName = sequenceName;
                policy.IsActive = safeRequest.ReferencePolicyEnabled;
                policy.LastModifiedBy = auditActorId;
                policy.LastModifiedAtUtc = DateTime.UtcNow;
            }

            if (safeRequest.RequestPolicy != null)
            {
                categorySetting.SettingsJson = MergeRequestPolicyIntoSettingsJson(
                    categorySetting.SettingsJson,
                    normalizedRequestPolicy);
            }
            categorySetting.LastModifiedBy = normalizedUserId;
            categorySetting.LastModifiedAtUtc = DateTime.UtcNow;

            await _connectContext.SaveChangesAsync(cancellationToken);

            var hasDynamicFields = await _connectContext.CdCategoryMands
                .AsNoTracking()
                .AnyAsync(link => link.MendCategory == categoryId && !link.MendStat, cancellationToken);

            response.Data = BuildSubjectTypeAdminDto(category, hasDynamicFields, policy, categorySetting);

            var scope = new DynamicSubjectRealtimeScope
            {
                CategoryIds = new List<int> { categoryId },
                UserIds = new List<string> { normalizedUserId },
                UnitGroupIds = new List<string>()
            };
            var payload = new DynamicSubjectRealtimeEventDto
            {
                EventType = "SubjectTypeConfigUpdated",
                EntityType = "subjectType",
                EntityId = categoryId,
                CategoryId = categoryId,
                Summary = category.CatName,
                ActorUserId = normalizedUserId,
                TimestampUtc = DateTime.UtcNow,
                Data = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase)
                {
                    ["categoryName"] = category.CatName,
                    ["isActive"] = safeRequest.IsActive ? "true" : "false",
                    ["referencePolicyEnabled"] = safeRequest.ReferencePolicyEnabled ? "true" : "false",
                    ["referencePrefix"] = policy.Prefix,
                    ["requestPolicyVersion"] = normalizedRequestPolicy?.Version.ToString(CultureInfo.InvariantCulture),
                    ["workflowMode"] = normalizedRequestPolicy?.WorkflowPolicy?.Mode,
                    ["accessCreateMode"] = normalizedRequestPolicy?.AccessPolicy?.CreateMode
                }
            };
            await _realtimePublisher.PublishAsync(payload, scope, cancellationToken);
        }
        catch (Exception)
        {
            response.Errors.Add(new Error { Code = "500", Message = "حدث خطأ غير متوقع أثناء حفظ إعدادات النوع." });
        }

        return response;
    }

    private async Task<(Cdcategory? Category, List<Error> Errors, List<string> UnitIds)> ValidateUpsertRequestAsync(
        SubjectUpsertRequestDto request,
        string userId,
        CancellationToken cancellationToken)
    {
        var errors = new List<Error>();
        var categoryId = request?.CategoryId ?? 0;
        if (categoryId <= 0)
        {
            errors.Add(new Error { Code = "400", Message = "النوع مطلوب." });
            return (null, errors, new List<string>());
        }

        var category = await _connectContext.Cdcategories
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.CatId == categoryId, cancellationToken);
        if (category == null)
        {
            errors.Add(new Error { Code = "404", Message = "النوع غير موجود." });
            return (null, errors, new List<string>());
        }

        if (category.CatStatus)
        {
            errors.Add(new Error { Code = "403", Message = "النوع غير مفعل." });
            return (category, errors, new List<string>());
        }

        var unitIds = await GetCurrentUserUnitIdsAsync(userId, cancellationToken);
        if (!await HasCategoryCreateAccessAsync(category.CatId, unitIds, cancellationToken))
        {
            errors.Add(new Error { Code = "403", Message = "غير مسموح بإنشاء طلبات على هذا النوع." });
        }

        return (category, errors, unitIds);
    }

    private async Task<List<Cdcategory>> LoadScopedCategoriesAsync(
        IReadOnlyCollection<string> unitIds,
        string? appId,
        CancellationToken cancellationToken)
    {
        var normalizedAppId = NormalizeNullable(appId);
        IQueryable<Cdcategory> categoriesQuery = _connectContext.Cdcategories.AsNoTracking();
        if (normalizedAppId != null)
        {
            categoriesQuery = categoriesQuery.Where(category =>
                (category.ApplicationId ?? string.Empty) == normalizedAppId);
        }

        var categories = await categoriesQuery
            .OrderBy(category => category.CatParent)
            .ThenBy(category => category.CatName)
            .ToListAsync(cancellationToken);

        if (unitIds == null || unitIds.Count == 0)
        {
            return new List<Cdcategory>();
        }

        var unitNumbers = unitIds
            .Select(unit => int.TryParse(unit, out var parsed) ? parsed : 0)
            .Where(parsed => parsed > 0)
            .ToHashSet();

        if (unitNumbers.Count == 0)
        {
            return new List<Cdcategory>();
        }

        var byId = categories.ToDictionary(category => category.CatId);
        var includeIds = new HashSet<int>();

        foreach (var category in categories)
        {
            var root = ResolveRootCategoryId(category.CatId, byId);
            if (unitNumbers.Contains(root))
            {
                includeIds.Add(category.CatId);
                IncludeAncestors(category.CatId, byId, includeIds);
            }
        }

        if (unitIds != null && unitIds.Count > 0)
        {
            var normalizedUnitSet = unitIds
                .Select(unit => NormalizeNullable(unit))
                .Where(unit => unit != null)
                .Cast<string>()
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

            if (normalizedUnitSet.Count > 0)
            {
                var categoryIds = categories.Select(item => item.CatId).ToHashSet();
                var settingsRows = await _connectContext.SubjectTypeAdminSettings
                    .AsNoTracking()
                    .Where(item => categoryIds.Contains(item.CategoryId))
                    .Select(item => new { item.CategoryId, item.SettingsJson })
                    .ToListAsync(cancellationToken);

                foreach (var row in settingsRows)
                {
                    var policy = TryReadRequestPolicyFromSettingsJson(row.SettingsJson);
                    if (policy == null)
                    {
                        continue;
                    }

                    var resolvedAccess = RequestPolicyResolver.ResolveAccessPolicy(policy);
                    var includeByPolicy =
                        resolvedAccess.CreateUnitIds.Overlaps(normalizedUnitSet)
                        || resolvedAccess.ReadUnitIds.Overlaps(normalizedUnitSet)
                        || resolvedAccess.WorkUnitIds.Overlaps(normalizedUnitSet);
                    if (!includeByPolicy)
                    {
                        continue;
                    }

                    includeIds.Add(row.CategoryId);
                    IncludeAncestors(row.CategoryId, byId, includeIds);
                }
            }
        }

        if (includeIds.Count == 0)
        {
            return new List<Cdcategory>();
        }

        return categories.Where(category => includeIds.Contains(category.CatId)).ToList();
    }

    private static void IncludeAncestors(int categoryId, IReadOnlyDictionary<int, Cdcategory> byId, HashSet<int> includeIds)
    {
        var cursor = categoryId;
        var safety = 0;
        while (safety++ < 150 && byId.TryGetValue(cursor, out var category))
        {
            includeIds.Add(category.CatId);
            if (category.CatParent <= 0)
            {
                break;
            }

            cursor = category.CatParent;
        }
    }

    private static int ResolveRootCategoryId(int categoryId, IReadOnlyDictionary<int, Cdcategory> byId)
    {
        var cursor = categoryId;
        var safety = 0;
        while (safety++ < 150 && byId.TryGetValue(cursor, out var category))
        {
            if (category.CatParent <= 0 || !byId.ContainsKey(category.CatParent))
            {
                return category.CatId;
            }

            cursor = category.CatParent;
        }

        return categoryId;
    }

    private static byte ResolveType(Cdcategory category)
    {
        if (category.CatParent > 0)
        {
            return (byte)Math.Min(255, category.CatParent);
        }

        return (byte)Math.Min(255, category.CatId);
    }

    private static string ResolvePrimaryUnitId(IReadOnlyCollection<string> unitIds)
    {
        return unitIds.FirstOrDefault() ?? "60";
    }

    private static string ResolveWorkflowAssignedUnit(
        ResolvedRequestWorkflowPolicy workflowPolicy,
        string? requestedTargetUnitId,
        string fallbackUnitId)
    {
        var mode = (workflowPolicy?.Mode ?? "manual").Trim().ToLowerInvariant();
        var allowManualSelection = workflowPolicy?.AllowManualSelection ?? true;
        var staticTargets = workflowPolicy?.StaticTargetUnitIds ?? new List<string>();
        var staticTarget = staticTargets.FirstOrDefault();
        var normalizedRequestedTarget = NormalizeNullable(requestedTargetUnitId);

        if (mode == "static")
        {
            return NormalizeNullable(staticTarget)
                ?? NormalizeNullable(workflowPolicy?.DefaultTargetUnitId)
                ?? fallbackUnitId;
        }

        if (mode == "hybrid")
        {
            return (allowManualSelection ? normalizedRequestedTarget : null)
                ?? NormalizeNullable(staticTarget)
                ?? NormalizeNullable(workflowPolicy?.DefaultTargetUnitId)
                ?? fallbackUnitId;
        }

        if (mode == "manual")
        {
            return (allowManualSelection ? normalizedRequestedTarget : null)
                ?? NormalizeNullable(workflowPolicy?.DefaultTargetUnitId)
                ?? fallbackUnitId;
        }

        return (allowManualSelection ? normalizedRequestedTarget : null)
            ?? NormalizeNullable(staticTarget)
            ?? NormalizeNullable(workflowPolicy?.DefaultTargetUnitId)
            ?? fallbackUnitId;
    }

    private static Dictionary<string, string?> BuildFieldsMap(IEnumerable<SubjectFieldValueDto> fields)
    {
        var map = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);
        foreach (var field in fields ?? Enumerable.Empty<SubjectFieldValueDto>())
        {
            var key = (field.FieldKey ?? string.Empty).Trim();
            if (key.Length == 0)
            {
                continue;
            }

            map[key] = field.Value;
        }

        return map;
    }

    private static SubjectTypeAdminDto BuildSubjectTypeAdminDto(
        Cdcategory category,
        bool hasDynamicFields,
        SubjectReferencePolicy? policy,
        SubjectTypeAdminSetting? settings)
    {
        var requestPolicy = TryReadRequestPolicyFromSettingsJson(settings?.SettingsJson);
        return new SubjectTypeAdminDto
        {
            CategoryId = category.CatId,
            ParentCategoryId = category.CatParent,
            CategoryName = category.CatName,
            ApplicationId = category.ApplicationId,
            CatMend = category.CatMend,
            CatWorkFlow = category.CatWorkFlow,
            CatSms = category.CatSms,
            CatMailNotification = category.CatMailNotification,
            To = category.To,
            Cc = category.Cc,
            IsActive = !category.CatStatus,
            HasDynamicFields = hasDynamicFields,
            CanCreate = hasDynamicFields && !category.CatStatus,
            DisplayOrder = settings?.DisplayOrder ?? 0,
            SettingsJson = settings?.SettingsJson,
            ReferencePolicyId = policy?.PolicyId,
            ReferencePolicyEnabled = policy?.IsActive == true,
            ReferencePrefix = policy?.Prefix,
            ReferenceSeparator = policy?.Separator,
            SourceFieldKeys = policy?.SourceFieldKeys,
            IncludeYear = policy?.IncludeYear ?? true,
            UseSequence = policy?.UseSequence ?? true,
            SequenceName = policy?.SequenceName,
            LastModifiedBy = policy?.LastModifiedBy ?? policy?.CreatedBy,
            LastModifiedAtUtc = policy?.LastModifiedAtUtc ?? policy?.CreatedAtUtc,
            RequestPolicy = requestPolicy
        };
    }

    private async Task UpsertDynamicFieldsInternalAsync(
        int messageId,
        IEnumerable<SubjectFieldValueDto> fields,
        CancellationToken cancellationToken)
    {
        var requested = fields?.ToList() ?? new List<SubjectFieldValueDto>();
        if (!requested.Any())
        {
            return;
        }

        var existing = await _connectContext.TkmendFields
            .Where(item => item.FildRelted == messageId)
            .ToListAsync(cancellationToken);

        foreach (var field in requested)
        {
            var key = (field.FieldKey ?? string.Empty).Trim();
            if (key.Length == 0)
            {
                continue;
            }

            var instanceGroupId = field.InstanceGroupId ?? 1;
            var match = existing.FirstOrDefault(item =>
                string.Equals(item.FildKind ?? string.Empty, key, StringComparison.OrdinalIgnoreCase)
                && (item.InstanceGroupId ?? 1) == instanceGroupId);

            var safeValue = field.Value;
            if (safeValue != null && safeValue.Length > 100)
            {
                safeValue = safeValue[..100];
            }

            if (match == null)
            {
                await _connectContext.TkmendFields.AddAsync(new TkmendField
                {
                    FildRelted = messageId,
                    FildKind = key,
                    FildTxt = safeValue,
                    InstanceGroupId = instanceGroupId
                }, cancellationToken);
                continue;
            }

            match.FildTxt = safeValue;
        }
    }

    private async Task UpsertStakeholdersInternalAsync(
        int messageId,
        IEnumerable<SubjectStakeholderUpsertDto> stakeholders,
        CancellationToken cancellationToken)
    {
        var requested = (stakeholders ?? Enumerable.Empty<SubjectStakeholderUpsertDto>())
            .Where(item => item.StockholderId > 0)
            .GroupBy(item => item.StockholderId)
            .Select(group => group.Last())
            .ToList();

        var existing = await _connectContext.MessageStockholders
            .Where(item => item.MessageId == messageId)
            .ToListAsync(cancellationToken);

        foreach (var stakeholder in requested)
        {
            var match = existing.FirstOrDefault(item => item.StockholderId == stakeholder.StockholderId);
            if (match == null)
            {
                await _connectContext.MessageStockholders.AddAsync(new MessageStockholder
                {
                    MessageId = messageId,
                    StockholderId = stakeholder.StockholderId,
                    PartyType = NormalizeNullable(stakeholder.PartyType) ?? "Viewer",
                    RequiredResponse = stakeholder.RequiredResponse,
                    Status = stakeholder.Status,
                    DueDate = stakeholder.DueDate,
                    StockholderNotes = stakeholder.Notes,
                    CreatedDate = DateTime.Now,
                    LastModifiedDate = DateTime.Now
                }, cancellationToken);
                continue;
            }

            match.PartyType = NormalizeNullable(stakeholder.PartyType) ?? match.PartyType;
            match.RequiredResponse = stakeholder.RequiredResponse;
            match.Status = stakeholder.Status;
            match.DueDate = stakeholder.DueDate;
            match.StockholderNotes = stakeholder.Notes;
            match.LastModifiedDate = DateTime.Now;
        }
    }

    private async Task UpsertTasksInternalAsync(
        int messageId,
        IEnumerable<SubjectTaskUpsertDto> tasks,
        string userId,
        CancellationToken cancellationToken)
    {
        var safeActorId = NormalizeAuditActorId(userId);
        foreach (var task in tasks ?? Enumerable.Empty<SubjectTaskUpsertDto>())
        {
            if (string.IsNullOrWhiteSpace(task.ActionTitle))
            {
                continue;
            }

            await _connectContext.SubjectTasks.AddAsync(new SubjectTask
            {
                MessageId = messageId,
                ActionTitle = task.ActionTitle.Trim(),
                ActionDescription = task.ActionDescription,
                AssignedToUserId = NormalizeNullable(task.AssignedToUserId),
                AssignedUnitId = NormalizeNullable(task.AssignedUnitId),
                Status = task.Status,
                DueDateUtc = task.DueDateUtc,
                CreatedBy = safeActorId,
                CreatedAtUtc = DateTime.UtcNow,
                LastModifiedBy = safeActorId,
                LastModifiedAtUtc = DateTime.UtcNow
            }, cancellationToken);
        }
    }

    private async Task SaveAttachmentsInternalAsync(
        int messageId,
        IEnumerable<(string FileName, byte[] Content, string Extension, long Size)> attachments,
        CancellationToken cancellationToken)
    {
        var files = (attachments ?? Enumerable.Empty<(string FileName, byte[] Content, string Extension, long Size)>())
            .Where(file => file.Content != null && file.Content.Length > 0 && !string.IsNullOrWhiteSpace(file.FileName))
            .ToList();
        if (!files.Any())
        {
            return;
        }

        foreach (var file in files)
        {
            var extension = (file.Extension ?? string.Empty).Trim();
            if (extension.Length == 0)
            {
                var inferred = System.IO.Path.GetExtension(file.FileName);
                extension = string.IsNullOrWhiteSpace(inferred) ? ".bin" : inferred;
            }

            await _attachContext.AttchShipments.AddAsync(new AttchShipment
            {
                AttchId = messageId,
                AttchNm = file.FileName,
                AttchImg = file.Content,
                AttcExt = extension,
                AttchSize = file.Size,
                ApplicationName = "Connect"
            }, cancellationToken);
        }

        await _attachContext.SaveChangesAsync(cancellationToken);
    }

    private async Task<List<SubjectAttachmentDto>> LoadAttachmentsAsync(int messageId, CancellationToken cancellationToken)
    {
        return await _attachContext.AttchShipments
            .AsNoTracking()
            .Where(item => item.AttchId == messageId && (item.ApplicationName == "Connect" || item.ApplicationName == "Connect - Test" || item.ApplicationName == "Correspondance"))
            .OrderByDescending(item => item.Id)
            .Select(item => new SubjectAttachmentDto
            {
                AttachmentId = item.Id,
                FileName = item.AttchNm,
                FileExtension = item.AttcExt,
                FileSize = item.AttchSize,
                UploadedAtUtc = null
            })
            .ToListAsync(cancellationToken);
    }

    private async Task<List<SubjectStakeholderDto>> LoadStakeholdersAsync(int messageId, CancellationToken cancellationToken)
    {
        return await _connectContext.MessageStockholders
            .AsNoTracking()
            .Where(item => item.MessageId == messageId)
            .OrderBy(item => item.MessageStockholderId)
            .Select(item => new SubjectStakeholderDto
            {
                MessageStockholderId = item.MessageStockholderId,
                StockholderId = item.StockholderId ?? 0,
                PartyType = item.PartyType ?? string.Empty,
                RequiredResponse = item.RequiredResponse == true,
                Status = item.Status,
                DueDate = item.DueDate,
                Notes = item.StockholderNotes
            })
            .ToListAsync(cancellationToken);
    }

    private async Task<List<SubjectTaskDto>> LoadTasksAsync(int messageId, CancellationToken cancellationToken)
    {
        return await _connectContext.SubjectTasks
            .AsNoTracking()
            .Where(item => item.MessageId == messageId)
            .OrderByDescending(item => item.CreatedAtUtc)
            .Select(item => new SubjectTaskDto
            {
                TaskId = item.TaskId,
                ActionTitle = item.ActionTitle,
                ActionDescription = item.ActionDescription,
                AssignedToUserId = item.AssignedToUserId,
                AssignedUnitId = item.AssignedUnitId,
                Status = item.Status,
                DueDateUtc = item.DueDateUtc,
                CompletedAtUtc = item.CompletedAtUtc,
                CreatedAtUtc = item.CreatedAtUtc
            })
            .ToListAsync(cancellationToken);
    }

    private async Task<List<SubjectTimelineEventDto>> LoadTimelineAsync(int messageId, CancellationToken cancellationToken)
    {
        return await _connectContext.SubjectTimelineEvents
            .AsNoTracking()
            .Where(item => item.MessageId == messageId)
            .OrderByDescending(item => item.CreatedAtUtc)
            .Select(item => new SubjectTimelineEventDto
            {
                TimelineEventId = item.TimelineEventId,
                EventType = item.EventType,
                EventTitle = item.EventTitle,
                EventPayloadJson = item.EventPayloadJson,
                StatusFrom = item.StatusFrom,
                StatusTo = item.StatusTo,
                CreatedBy = item.CreatedBy,
                CreatedAtUtc = item.CreatedAtUtc
            })
            .ToListAsync(cancellationToken);
    }

    private async Task<List<EnvelopeSummaryDto>> LoadLinkedEnvelopesAsync(int messageId, CancellationToken cancellationToken)
    {
        return await (from link in _connectContext.SubjectEnvelopeLinks.AsNoTracking()
                      join envelope in _connectContext.SubjectEnvelopes.AsNoTracking()
                           on link.EnvelopeId equals envelope.EnvelopeId
                      where link.MessageId == messageId
                      select new EnvelopeSummaryDto
                      {
                          EnvelopeId = envelope.EnvelopeId,
                          EnvelopeRef = envelope.EnvelopeRef,
                          IncomingDate = envelope.IncomingDate,
                          SourceEntity = envelope.SourceEntity,
                          DeliveryDelegate = envelope.DeliveryDelegate,
                          LinkedSubjectsCount = 0
                      })
            .OrderByDescending(item => item.IncomingDate)
            .ToListAsync(cancellationToken);
    }

    private async Task<SubjectDetailDto?> BuildSubjectDetailAsync(int messageId, CancellationToken cancellationToken)
    {
        var message = await _connectContext.Messages
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.MessageId == messageId, cancellationToken);
        if (message == null)
        {
            return null;
        }

        return await BuildSubjectDetailAsync(message, cancellationToken);
    }

    private async Task<SubjectDetailDto> BuildSubjectDetailAsync(Message message, CancellationToken cancellationToken)
    {
        var messageId = message.MessageId;
        var dynamicFields = await _connectContext.TkmendFields
            .AsNoTracking()
            .Where(item => item.FildRelted == messageId)
            .OrderBy(item => item.FildSql)
            .Select(item => new SubjectFieldValueDto
            {
                FildSql = item.FildSql,
                FieldKey = item.FildKind ?? string.Empty,
                Value = item.FildTxt,
                InstanceGroupId = item.InstanceGroupId
            })
            .ToListAsync(cancellationToken);

        return new SubjectDetailDto
        {
            MessageId = message.MessageId,
            CategoryId = message.CategoryCd,
            Subject = message.Subject,
            Description = message.Description,
            RequestRef = message.RequestRef,
            Status = (byte)message.Status,
            StatusLabel = SubjectWorkflowStatusCatalog.Label((byte)message.Status),
            CreatedBy = message.CreatedBy,
            AssignedUnitId = message.AssignedSectorId,
            CurrentResponsibleUnitId = message.CurrentResponsibleSectorId,
            CreatedDate = message.CreatedDate,
            LastModifiedDate = message.LastModifiedDate,
            DynamicFields = dynamicFields,
            Attachments = await LoadAttachmentsAsync(messageId, cancellationToken),
            Stakeholders = await LoadStakeholdersAsync(messageId, cancellationToken),
            Tasks = await LoadTasksAsync(messageId, cancellationToken),
            Timeline = await LoadTimelineAsync(messageId, cancellationToken),
            LinkedEnvelopes = await LoadLinkedEnvelopesAsync(messageId, cancellationToken)
        };
    }

    private async Task<EnvelopeDetailDto?> BuildEnvelopeDetailAsync(int envelopeId, CancellationToken cancellationToken)
    {
        var envelope = await _connectContext.SubjectEnvelopes
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.EnvelopeId == envelopeId, cancellationToken);
        if (envelope == null)
        {
            return null;
        }

        var linkedSubjects = await (from link in _connectContext.SubjectEnvelopeLinks.AsNoTracking()
                                    join message in _connectContext.Messages.AsNoTracking()
                                        on link.MessageId equals message.MessageId
                                    where link.EnvelopeId == envelopeId
                                    select new EnvelopeLinkedSubjectDto
                                    {
                                        MessageId = message.MessageId,
                                        RequestRef = message.RequestRef,
                                        Subject = message.Subject,
                                        Status = (byte)message.Status,
                                        CategoryId = message.CategoryCd
                                    })
            .OrderByDescending(item => item.MessageId)
            .ToListAsync(cancellationToken);

        return new EnvelopeDetailDto
        {
            EnvelopeId = envelope.EnvelopeId,
            EnvelopeRef = envelope.EnvelopeRef,
            IncomingDate = envelope.IncomingDate,
            SourceEntity = envelope.SourceEntity,
            DeliveryDelegate = envelope.DeliveryDelegate,
            Notes = envelope.Notes,
            CreatedBy = envelope.CreatedBy,
            CreatedAtUtc = envelope.CreatedAtUtc,
            LinkedSubjects = linkedSubjects
        };
    }

    private async Task AddStatusHistoryInternalAsync(
        int messageId,
        byte? oldStatus,
        byte newStatus,
        string? notes,
        string changedBy,
        CancellationToken cancellationToken)
    {
        var safeActorId = NormalizeAuditActorId(changedBy);
        await _connectContext.SubjectStatusHistories.AddAsync(new SubjectStatusHistory
        {
            MessageId = messageId,
            OldStatus = oldStatus,
            NewStatus = newStatus,
            Notes = notes,
            ChangedBy = safeActorId,
            ChangedAtUtc = DateTime.UtcNow
        }, cancellationToken);
    }

    private async Task AddTimelineInternalAsync(
        int messageId,
        string eventType,
        string eventTitle,
        object? payload,
        byte? statusFrom,
        byte? statusTo,
        string createdBy,
        CancellationToken cancellationToken)
    {
        var safeActorId = NormalizeAuditActorId(createdBy);
        var json = payload == null ? null : JsonSerializer.Serialize(payload);
        await _connectContext.SubjectTimelineEvents.AddAsync(new SubjectTimelineEvent
        {
            MessageId = messageId,
            EventType = eventType,
            EventTitle = eventTitle,
            EventPayloadJson = json,
            StatusFrom = statusFrom,
            StatusTo = statusTo,
            CreatedBy = safeActorId,
            CreatedAtUtc = DateTime.UtcNow
        }, cancellationToken);
    }

    private async Task LinkSubjectToEnvelopeInternalAsync(
        int envelopeId,
        int messageId,
        string linkedBy,
        CancellationToken cancellationToken)
    {
        var safeActorId = NormalizeAuditActorId(linkedBy);
        var envelopeExists = await _connectContext.SubjectEnvelopes
            .AsNoTracking()
            .AnyAsync(item => item.EnvelopeId == envelopeId, cancellationToken);
        if (!envelopeExists)
        {
            throw new InvalidOperationException("Envelope not found.");
        }

        var subjectExists = await _connectContext.Messages
            .AsNoTracking()
            .AnyAsync(item => item.MessageId == messageId, cancellationToken);
        if (!subjectExists)
        {
            throw new InvalidOperationException("Subject not found.");
        }

        var exists = await _connectContext.SubjectEnvelopeLinks
            .AsNoTracking()
            .AnyAsync(item => item.EnvelopeId == envelopeId && item.MessageId == messageId, cancellationToken);
        if (exists)
        {
            return;
        }

        await _connectContext.SubjectEnvelopeLinks.AddAsync(new SubjectEnvelopeLink
        {
            EnvelopeId = envelopeId,
            MessageId = messageId,
            LinkedBy = safeActorId,
            LinkedAtUtc = DateTime.UtcNow
        }, cancellationToken);

        await AddTimelineInternalAsync(
            messageId,
            eventType: "EnvelopeLinked",
            eventTitle: "Envelope linked",
            payload: new Dictionary<string, object?>
            {
                ["envelopeId"] = envelopeId
            },
            statusFrom: null,
            statusTo: null,
            createdBy: safeActorId,
            cancellationToken: cancellationToken);
    }

    private async Task PublishSubjectEventAsync(
        string eventType,
        string entityType,
        int entityId,
        SubjectDetailDto detail,
        string actorUserId,
        CancellationToken cancellationToken)
    {
        var scope = await BuildRealtimeScopeForSubjectAsync(detail, cancellationToken);
        var payload = new DynamicSubjectRealtimeEventDto
        {
            EventType = eventType,
            EntityType = entityType,
            EntityId = entityId,
            MessageId = detail.MessageId,
            CategoryId = detail.CategoryId,
            Status = detail.Status,
            StatusLabel = detail.StatusLabel,
            ReferenceNumber = detail.RequestRef,
            Summary = detail.Subject,
            ActorUserId = actorUserId,
            TimestampUtc = DateTime.UtcNow,
            Data = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase)
            {
                ["subject"] = detail.Subject,
                ["assignedUnitId"] = detail.AssignedUnitId,
                ["envelopesCount"] = detail.LinkedEnvelopes.Count.ToString(CultureInfo.InvariantCulture),
                ["attachmentsCount"] = detail.Attachments.Count.ToString(CultureInfo.InvariantCulture)
            }
        };

        await _realtimePublisher.PublishAsync(payload, scope, cancellationToken);
    }

    private async Task PublishEnvelopeEventAsync(
        string eventType,
        int envelopeId,
        int? messageId,
        string actorUserId,
        CancellationToken cancellationToken)
    {
        var scope = new DynamicSubjectRealtimeScope
        {
            EnvelopeIds = new List<int> { envelopeId }
        };

        if (messageId.HasValue && messageId.Value > 0)
        {
            var detail = await BuildSubjectDetailAsync(messageId.Value, cancellationToken);
            if (detail != null)
            {
                var subjectScope = await BuildRealtimeScopeForSubjectAsync(detail, cancellationToken);
                scope.UnitGroupIds.AddRange(subjectScope.UnitGroupIds);
                scope.SubjectIds.AddRange(subjectScope.SubjectIds);
                scope.CategoryIds.AddRange(subjectScope.CategoryIds);
                scope.UserIds.AddRange(subjectScope.UserIds);
            }
        }

        var payload = new DynamicSubjectRealtimeEventDto
        {
            EventType = eventType,
            EntityType = "envelope",
            EntityId = envelopeId,
            EnvelopeId = envelopeId,
            MessageId = messageId,
            ActorUserId = actorUserId,
            TimestampUtc = DateTime.UtcNow,
            Summary = $"Envelope {envelopeId}",
            Data = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase)
            {
                ["envelopeId"] = envelopeId.ToString(CultureInfo.InvariantCulture),
                ["messageId"] = messageId?.ToString(CultureInfo.InvariantCulture)
            }
        };

        await _realtimePublisher.PublishAsync(payload, scope, cancellationToken);
    }

    private async Task<DynamicSubjectRealtimeScope> BuildRealtimeScopeForSubjectAsync(
        SubjectDetailDto detail,
        CancellationToken cancellationToken)
    {
        var scope = new DynamicSubjectRealtimeScope();

        scope.SubjectIds.Add(detail.MessageId);
        if (detail.CategoryId > 0)
        {
            scope.CategoryIds.Add(detail.CategoryId);
        }

        if (!string.IsNullOrWhiteSpace(detail.AssignedUnitId))
        {
            scope.UnitGroupIds.Add(detail.AssignedUnitId.Trim());
        }

        if (!string.IsNullOrWhiteSpace(detail.CurrentResponsibleUnitId))
        {
            scope.UnitGroupIds.Add(detail.CurrentResponsibleUnitId.Trim());
        }

        if (!string.IsNullOrWhiteSpace(detail.CreatedBy))
        {
            scope.UserIds.Add(detail.CreatedBy.Trim());
        }

        foreach (var stakeholder in detail.Stakeholders)
        {
            if (stakeholder.StockholderId > 0)
            {
                scope.UnitGroupIds.Add(stakeholder.StockholderId.ToString(CultureInfo.InvariantCulture));
            }
        }

        foreach (var task in detail.Tasks)
        {
            if (!string.IsNullOrWhiteSpace(task.AssignedUnitId))
            {
                scope.UnitGroupIds.Add(task.AssignedUnitId.Trim());
            }

            if (!string.IsNullOrWhiteSpace(task.AssignedToUserId))
            {
                scope.UserIds.Add(task.AssignedToUserId.Trim());
            }
        }

        foreach (var envelope in detail.LinkedEnvelopes)
        {
            if (envelope.EnvelopeId > 0)
            {
                scope.EnvelopeIds.Add(envelope.EnvelopeId);
            }
        }

        var unitIds = await GetCurrentUserUnitIdsAsync(detail.CreatedBy ?? string.Empty, cancellationToken);
        scope.UnitGroupIds.AddRange(unitIds);

        scope.UnitGroupIds = scope.UnitGroupIds
            .Select(unit => (unit ?? string.Empty).Trim())
            .Where(unit => unit.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        scope.UserIds = scope.UserIds
            .Select(user => (user ?? string.Empty).Trim())
            .Where(user => user.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        scope.SubjectIds = scope.SubjectIds.Distinct().Where(item => item > 0).ToList();
        scope.EnvelopeIds = scope.EnvelopeIds.Distinct().Where(item => item > 0).ToList();
        scope.CategoryIds = scope.CategoryIds.Distinct().Where(item => item > 0).ToList();

        return scope;
    }

    private async Task<HashSet<int>> GetAccessibleMessageIdsAsync(string userId, CancellationToken cancellationToken)
    {
        var messageActorId = NormalizeMessageActorId(userId);
        var unitIds = await GetCurrentUserUnitIdsAsync(userId, cancellationToken);
        var accessibleCategoryIds = await GetAccessibleCategoryIdsAsync(unitIds, cancellationToken);
        if (accessibleCategoryIds.Count == 0)
        {
            return new HashSet<int>();
        }

        var unitNumeric = unitIds
            .Select(unit => int.TryParse(unit, out var parsed) ? parsed : 0)
            .Where(parsed => parsed > 0)
            .ToList();

        var createdIds = await _connectContext.Messages
            .AsNoTracking()
            .Where(item => item.CreatedBy == userId || item.CreatedBy == messageActorId)
            .Select(item => item.MessageId)
            .ToListAsync(cancellationToken);

        var assignmentIds = await _connectContext.Messages
            .AsNoTracking()
            .Where(item => unitIds.Contains(item.AssignedSectorId ?? string.Empty)
                || unitIds.Contains(item.CurrentResponsibleSectorId ?? string.Empty))
            .Select(item => item.MessageId)
            .ToListAsync(cancellationToken);

        var stakeholderIds = unitNumeric.Count == 0
            ? new List<int>()
            : await _connectContext.MessageStockholders
                .AsNoTracking()
                .Where(item => item.MessageId.HasValue && item.StockholderId.HasValue && unitNumeric.Contains(item.StockholderId.Value))
                .Select(item => item.MessageId!.Value)
                .ToListAsync(cancellationToken);

        var taskIds = await _connectContext.SubjectTasks
            .AsNoTracking()
            .Where(item => item.AssignedToUserId == userId || unitIds.Contains(item.AssignedUnitId ?? string.Empty))
            .Select(item => item.MessageId)
            .ToListAsync(cancellationToken);

        var candidateMessageIds = createdIds
            .Concat(assignmentIds)
            .Concat(stakeholderIds)
            .Concat(taskIds)
            .ToHashSet();

        if (candidateMessageIds.Count == 0)
        {
            return candidateMessageIds;
        }

        var filteredIds = await _connectContext.Messages
            .AsNoTracking()
            .Where(item => candidateMessageIds.Contains(item.MessageId) && accessibleCategoryIds.Contains(item.CategoryCd))
            .Select(item => item.MessageId)
            .ToListAsync(cancellationToken);

        return filteredIds.ToHashSet();
    }

    private async Task<bool> CanUserAccessSubjectAsync(string userId, Message message, CancellationToken cancellationToken)
    {
        if (message == null)
        {
            return false;
        }

        var unitIds = await GetCurrentUserUnitIdsAsync(userId, cancellationToken);
        if (!await HasCategoryAccessAsync(message.CategoryCd, unitIds, cancellationToken))
        {
            return false;
        }

        var categoryPolicy = await LoadCategoryRequestPolicyAsync(message.CategoryCd, cancellationToken);
        var resolvedAccessPolicy = RequestPolicyResolver.ResolveAccessPolicy(categoryPolicy);
        if (resolvedAccessPolicy.WorkUnitIds.Count > 0
            && RequestPolicyResolver.IsWorkAllowedForUnits(categoryPolicy, unitIds))
        {
            return true;
        }

        var messageActorId = NormalizeMessageActorId(userId);
        if (string.Equals(message.CreatedBy ?? string.Empty, userId, StringComparison.OrdinalIgnoreCase)
            || string.Equals(message.CreatedBy ?? string.Empty, messageActorId, StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        if (unitIds.Contains(message.AssignedSectorId ?? string.Empty, StringComparer.OrdinalIgnoreCase)
            || unitIds.Contains(message.CurrentResponsibleSectorId ?? string.Empty, StringComparer.OrdinalIgnoreCase))
        {
            return true;
        }

        var unitNumeric = unitIds
            .Select(unit => int.TryParse(unit, out var parsed) ? parsed : 0)
            .Where(parsed => parsed > 0)
            .ToList();

        if (unitNumeric.Count > 0)
        {
            var stakeholderAccess = await _connectContext.MessageStockholders
                .AsNoTracking()
                .AnyAsync(item =>
                    item.MessageId == message.MessageId
                    && item.StockholderId.HasValue
                    && unitNumeric.Contains(item.StockholderId.Value), cancellationToken);
            if (stakeholderAccess)
            {
                return true;
            }
        }

        var taskAccess = await _connectContext.SubjectTasks
            .AsNoTracking()
            .AnyAsync(item =>
                item.MessageId == message.MessageId
                && (item.AssignedToUserId == userId
                    || unitIds.Contains(item.AssignedUnitId ?? string.Empty)), cancellationToken);
        if (taskAccess)
        {
            return true;
        }

        return false;
    }

    private async Task<RequestPolicyDefinitionDto?> LoadCategoryRequestPolicyAsync(
        int categoryId,
        CancellationToken cancellationToken)
    {
        if (categoryId <= 0)
        {
            return null;
        }

        var settingsJson = await _connectContext.SubjectTypeAdminSettings
            .AsNoTracking()
            .Where(item => item.CategoryId == categoryId)
            .Select(item => item.SettingsJson)
            .FirstOrDefaultAsync(cancellationToken);
        return TryReadRequestPolicyFromSettingsJson(settingsJson);
    }

    private async Task<bool> HasCategoryAccessAsync(
        int categoryId,
        IReadOnlyCollection<string> unitIds,
        CancellationToken cancellationToken)
    {
        var requestPolicy = await LoadCategoryRequestPolicyAsync(categoryId, cancellationToken);
        var resolvedAccess = RequestPolicyResolver.ResolveAccessPolicy(requestPolicy);
        if (resolvedAccess.ReadUnitIds.Count > 0)
        {
            return RequestPolicyResolver.IsReadAllowedForUnits(requestPolicy, unitIds);
        }

        if (!resolvedAccess.InheritLegacyAccess)
        {
            return true;
        }

        return await HasCategoryAccessLegacyAsync(categoryId, unitIds, cancellationToken);
    }

    private async Task<bool> HasCategoryCreateAccessAsync(
        int categoryId,
        IReadOnlyCollection<string> unitIds,
        CancellationToken cancellationToken)
    {
        var requestPolicy = await LoadCategoryRequestPolicyAsync(categoryId, cancellationToken);
        var resolvedAccess = RequestPolicyResolver.ResolveAccessPolicy(requestPolicy);
        if (resolvedAccess.CreateUnitIds.Count > 0)
        {
            return RequestPolicyResolver.IsCreateAllowedForUnits(requestPolicy, unitIds);
        }

        if (!resolvedAccess.InheritLegacyAccess)
        {
            return true;
        }

        return await HasCategoryAccessLegacyAsync(categoryId, unitIds, cancellationToken);
    }

    private async Task<bool> HasCategoryAccessLegacyAsync(
        int categoryId,
        IReadOnlyCollection<string> unitIds,
        CancellationToken cancellationToken)
    {
        if (HasCategoryAccess(categoryId, unitIds))
        {
            return true;
        }

        if (unitIds == null || unitIds.Count == 0)
        {
            return false;
        }

        var numericUnitIds = unitIds
            .Select(unit => int.TryParse(unit, out var parsed) ? parsed : 0)
            .Where(parsed => parsed > 0)
            .ToHashSet();

        if (numericUnitIds.Count == 0)
        {
            return false;
        }

        var parentMap = await _connectContext.Cdcategories
            .AsNoTracking()
            .Select(category => new { category.CatId, category.CatParent })
            .ToDictionaryAsync(category => category.CatId, category => category.CatParent, cancellationToken);

        if (parentMap.Count == 0 || !parentMap.ContainsKey(categoryId))
        {
            return false;
        }

        var cursor = categoryId;
        var safety = 0;
        while (safety++ < 150
            && parentMap.TryGetValue(cursor, out var parentId)
            && parentId > 0
            && parentMap.ContainsKey(parentId))
        {
            cursor = parentId;
        }

        return numericUnitIds.Contains(cursor);
    }

    private async Task<List<string>> GetCurrentUserUnitIdsAsync(string userId, CancellationToken cancellationToken)
    {
        var normalized = NormalizeUser(userId);
        if (normalized.Length == 0)
        {
            return new List<string>();
        }

        var today = DateTime.Today;
        var unitIds = await _gpaContext.UserPositions
            .AsNoTracking()
            .Where(position => position.UserId == normalized
                && position.IsActive != false
                && (!position.StartDate.HasValue || position.StartDate.Value <= today)
                && (!position.EndDate.HasValue || position.EndDate.Value >= today))
            .Select(position => position.UnitId)
            .Distinct()
            .ToListAsync(cancellationToken);

        return unitIds
            .Select(unitId => unitId.ToString(CultureInfo.InvariantCulture))
            .Select(unitId => (unitId ?? string.Empty).Trim())
            .Where(unitId => unitId.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    private static string NormalizeUser(string? userId)
    {
        return (userId ?? string.Empty).Trim();
    }

    private static string NormalizeMessageActorId(string? userId)
    {
        var normalized = NormalizeUser(userId);
        if (normalized.Length <= 20)
        {
            return normalized;
        }

        return normalized[..20];
    }

    private static string NormalizeAuditActorId(string? userId)
    {
        var normalized = NormalizeUser(userId);
        if (normalized.Length == 0)
        {
            return "SYSTEM";
        }

        if (normalized.Length <= 64)
        {
            return normalized;
        }

        return normalized[..64];
    }

    private static RequestPolicyDefinitionDto? TryReadRequestPolicyFromSettingsJson(string? settingsJson)
    {
        var payload = (settingsJson ?? string.Empty).Trim();
        if (payload.Length == 0)
        {
            return null;
        }

        try
        {
            var rootNode = JsonNode.Parse(payload);
            if (rootNode is JsonObject rootObject)
            {
                if (rootObject.TryGetPropertyValue("requestPolicy", out var policyNode) && policyNode != null)
                {
                    var nestedPolicy = policyNode.Deserialize<RequestPolicyDefinitionDto>(SerializerOptions);
                    return nestedPolicy == null ? null : RequestPolicyResolver.Normalize(nestedPolicy);
                }

                var directPolicy = rootObject.Deserialize<RequestPolicyDefinitionDto>(SerializerOptions);
                var hasPolicyShape =
                    rootObject.TryGetPropertyValue("presentationRules", out _)
                    || rootObject.TryGetPropertyValue("accessPolicy", out _)
                    || rootObject.TryGetPropertyValue("workflowPolicy", out _);
                if (directPolicy != null
                    && hasPolicyShape)
                {
                    return RequestPolicyResolver.Normalize(directPolicy);
                }
            }
        }
        catch
        {
            return null;
        }

        return null;
    }

    private static string? MergeRequestPolicyIntoSettingsJson(
        string? existingSettingsJson,
        RequestPolicyDefinitionDto? requestPolicy)
    {
        JsonObject root;
        var existingPayload = (existingSettingsJson ?? string.Empty).Trim();
        if (existingPayload.Length == 0)
        {
            root = new JsonObject();
        }
        else
        {
            try
            {
                root = JsonNode.Parse(existingPayload) as JsonObject ?? new JsonObject();
            }
            catch
            {
                root = new JsonObject();
            }
        }

        if (requestPolicy == null)
        {
            root.Remove("requestPolicy");
        }
        else
        {
            root["requestPolicy"] = JsonSerializer.SerializeToNode(
                RequestPolicyResolver.Normalize(requestPolicy),
                SerializerOptions);
        }

        if (root.Count == 0)
        {
            return null;
        }

        return root.ToJsonString(SerializerOptions);
    }

    private static string? NormalizeNullable(string? value)
    {
        var normalized = (value ?? string.Empty).Trim();
        return normalized.Length == 0 ? null : normalized;
    }

    private static bool HasCategoryAccess(int categoryId, IReadOnlyCollection<string> unitIds)
    {
        if (unitIds == null || unitIds.Count == 0)
        {
            return false;
        }

        var numericUnitIds = unitIds
            .Select(unit => int.TryParse(unit, out var parsed) ? parsed : 0)
            .Where(parsed => parsed > 0)
            .ToHashSet();

        if (numericUnitIds.Count == 0)
        {
            return false;
        }

        return numericUnitIds.Contains(categoryId);
    }

    private async Task<HashSet<int>> GetAccessibleCategoryIdsAsync(
        IReadOnlyCollection<string> unitIds,
        CancellationToken cancellationToken)
    {
        var allCategoryIds = await _connectContext.Cdcategories
            .AsNoTracking()
            .Select(item => item.CatId)
            .ToListAsync(cancellationToken);
        var accessible = new HashSet<int>();

        foreach (var categoryId in allCategoryIds)
        {
            if (await HasCategoryAccessAsync(categoryId, unitIds, cancellationToken))
            {
                accessible.Add(categoryId);
            }
        }

        return accessible;
    }
}
