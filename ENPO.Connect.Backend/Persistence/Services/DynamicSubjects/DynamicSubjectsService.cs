using Microsoft.EntityFrameworkCore;
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

    public DynamicSubjectsService(
        ConnectContext connectContext,
        Attach_HeldContext attachContext,
        GPAContext gpaContext,
        helperService helperService,
        ISubjectReferenceGenerator referenceGenerator,
        IDynamicSubjectsRealtimePublisher realtimePublisher)
    {
        _connectContext = connectContext;
        _attachContext = attachContext;
        _gpaContext = gpaContext;
        _helperService = helperService;
        _referenceGenerator = referenceGenerator;
        _realtimePublisher = realtimePublisher;
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
                    CanCreate = !category.CatStatus && categoriesWithFieldsSet.Contains(category.CatId),
                    DisplayOrder = categorySettingsMap.TryGetValue(category.CatId, out var setting)
                        ? setting.DisplayOrder
                        : 0,
                    Children = BuildChildren(category.CatId)
                }).ToList();
            }

            response.Data = BuildChildren(0);
        }
        catch (Exception ex)
        {
            response.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });
        }

        return response;
    }

    public async Task<CommonResponse<SubjectFormDefinitionDto>> GetFormDefinitionAsync(
        int categoryId,
        string userId,
        string? appId,
        CancellationToken cancellationToken = default)
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

            if (category.CatStatus)
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

            var fieldRows = await (from link in _connectContext.CdCategoryMands.AsNoTracking()
                                   join mend in _connectContext.Cdmends.AsNoTracking()
                                        on link.MendField equals mend.CdmendTxt
                                   join mandGroup in _connectContext.MandGroups.AsNoTracking()
                                        on link.MendGroup equals mandGroup.GroupId into groupJoin
                                   from mandGroup in groupJoin.DefaultIfEmpty()
                                   join fieldSetting in _connectContext.SubjectCategoryFieldSettings.AsNoTracking()
                                        on link.MendSql equals fieldSetting.MendSql into fieldSettingJoin
                                   from fieldSetting in fieldSettingJoin.DefaultIfEmpty()
                                   where link.MendCategory == categoryId
                                         && !link.MendStat
                                         && !mend.CdmendStat
                                         && (fieldSetting == null || fieldSetting.IsVisible)
                                   orderby link.MendGroup,
                                           fieldSetting != null ? fieldSetting.DisplayOrder : link.MendSql,
                                           link.MendSql
                                   select new SubjectFieldDefinitionDto
                                   {
                                       MendSql = link.MendSql,
                                       CategoryId = link.MendCategory,
                                       MendGroup = link.MendGroup,
                                       FieldKey = mend.CdmendTxt,
                                       FieldType = mend.CdmendType,
                                       FieldLabel = mend.CDMendLbl,
                                       Placeholder = mend.Placeholder,
                                       DefaultValue = mend.DefaultValue,
                                       OptionsPayload = mend.CdmendTbl,
                                       DataType = mend.CdmendDatatype,
                                       Required = mend.Required == true,
                                       RequiredTrue = mend.RequiredTrue == true,
                                       Email = mend.Email == true,
                                       Pattern = mend.Pattern == true,
                                       MinValue = mend.MinValue,
                                       MaxValue = mend.MaxValue,
                                       Mask = mend.Cdmendmask,
                                       IsDisabledInit = mend.IsDisabledInit,
                                       IsSearchable = mend.IsSearchable,
                                       Width = mend.Width,
                                       Height = mend.Height,
                                       ApplicationId = mend.ApplicationId,
                                       DisplayOrder = fieldSetting != null ? fieldSetting.DisplayOrder : link.MendSql,
                                       IsVisible = fieldSetting == null || fieldSetting.IsVisible,
                                       DisplaySettingsJson = fieldSetting != null ? fieldSetting.DisplaySettingsJson : null,
                                       Group = new SubjectGroupDefinitionDto
                                       {
                                           GroupId = link.MendGroup,
                                           GroupName = mandGroup != null ? (mandGroup.GroupName ?? string.Empty) : string.Empty,
                                           GroupDescription = mandGroup != null ? mandGroup.GroupDescription : null,
                                           IsExtendable = mandGroup != null && mandGroup.IsExtendable == true,
                                           GroupWithInRow = mandGroup != null ? mandGroup.GroupWithInRow : null
                                       }
                                   })
                .ToListAsync(cancellationToken);

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
        catch (Exception ex)
        {
            response.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });
        }

        return response;
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
            var status = request.Submit
                ? (byte)MessageStatus.Submitted
                : (byte)MessageStatus.Draft;
            var messageId = _helperService.GetSequenceNextValue("Seq_Tickets");
            var fieldsMap = BuildFieldsMap(request.DynamicFields);
            var referenceNumber = await _referenceGenerator.GenerateAsync(category.CatId, messageId, fieldsMap, cancellationToken);

            var message = new Message
            {
                MessageId = messageId,
                CategoryCd = category.CatId,
                Type = ResolveType(category),
                Subject = string.IsNullOrWhiteSpace(request.Subject)
                    ? category.CatName
                    : request.Subject!.Trim(),
                Description = request.Description,
                CreatedBy = normalizedUserId,
                AssignedSectorId = ResolvePrimaryUnitId(await GetCurrentUserUnitIdsAsync(normalizedUserId, cancellationToken)),
                CurrentResponsibleSectorId = ResolvePrimaryUnitId(await GetCurrentUserUnitIdsAsync(normalizedUserId, cancellationToken)),
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
            response.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });
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

            message.Subject = string.IsNullOrWhiteSpace(request.Subject)
                ? message.Subject
                : request.Subject!.Trim();
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

            response.Data = await BuildSubjectDetailAsync(messageId, cancellationToken);
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
                listQuery = listQuery.Where(message => message.CreatedBy == normalizedUserId);
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
                CreatedBy = normalizedUserId,
                CreatedAtUtc = now,
                LastModifiedBy = normalizedUserId,
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
                CreatedBy = normalizedUserId,
                CreatedAtUtc = DateTime.UtcNow,
                LastModifiedBy = normalizedUserId,
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
            envelope.LastModifiedBy = normalizedUserId;
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
                subjectsQuery = subjectsQuery.Where(item => item.CreatedBy == normalizedUserId);
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
            if (!string.IsNullOrWhiteSpace(appId))
            {
                categoriesQuery = categoriesQuery.Where(category =>
                    string.Equals(category.ApplicationId ?? string.Empty, appId, StringComparison.OrdinalIgnoreCase));
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

            var prefix = (safeRequest.ReferencePrefix ?? string.Empty).Trim();
            if (prefix.Length == 0)
            {
                prefix = $"SUBJ{categoryId}";
            }

            var separator = (safeRequest.ReferenceSeparator ?? "-").Trim();
            if (separator.Length == 0)
            {
                separator = "-";
            }

            var sequenceName = NormalizeNullable(safeRequest.SequenceName);
            if (safeRequest.UseSequence && sequenceName == null)
            {
                sequenceName = "Seq_Tickets";
            }

            if (policy == null)
            {
                policy = new SubjectReferencePolicy
                {
                    CategoryId = categoryId,
                    Prefix = prefix,
                    Separator = separator,
                    SourceFieldKeys = NormalizeNullable(safeRequest.SourceFieldKeys),
                    IncludeYear = safeRequest.IncludeYear,
                    UseSequence = safeRequest.UseSequence,
                    SequenceName = sequenceName,
                    IsActive = safeRequest.ReferencePolicyEnabled,
                    CreatedBy = normalizedUserId,
                    CreatedAtUtc = DateTime.UtcNow,
                    LastModifiedBy = normalizedUserId,
                    LastModifiedAtUtc = DateTime.UtcNow
                };
                await _connectContext.SubjectReferencePolicies.AddAsync(policy, cancellationToken);
            }
            else
            {
                policy.Prefix = prefix;
                policy.Separator = separator;
                policy.SourceFieldKeys = NormalizeNullable(safeRequest.SourceFieldKeys);
                policy.IncludeYear = safeRequest.IncludeYear;
                policy.UseSequence = safeRequest.UseSequence;
                policy.SequenceName = sequenceName;
                policy.IsActive = safeRequest.ReferencePolicyEnabled;
                policy.LastModifiedBy = normalizedUserId;
                policy.LastModifiedAtUtc = DateTime.UtcNow;
            }

            await _connectContext.SaveChangesAsync(cancellationToken);

            var hasDynamicFields = await _connectContext.CdCategoryMands
                .AsNoTracking()
                .AnyAsync(link => link.MendCategory == categoryId && !link.MendStat, cancellationToken);
            var categorySetting = await _connectContext.SubjectTypeAdminSettings
                .AsNoTracking()
                .FirstOrDefaultAsync(setting => setting.CategoryId == categoryId, cancellationToken);

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
                    ["referencePrefix"] = policy.Prefix
                }
            };
            await _realtimePublisher.PublishAsync(payload, scope, cancellationToken);
        }
        catch (Exception ex)
        {
            response.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });
        }

        return response;
    }

    private async Task<(Cdcategory? Category, List<Error> Errors)> ValidateUpsertRequestAsync(
        SubjectUpsertRequestDto request,
        string userId,
        CancellationToken cancellationToken)
    {
        var errors = new List<Error>();
        var categoryId = request?.CategoryId ?? 0;
        if (categoryId <= 0)
        {
            errors.Add(new Error { Code = "400", Message = "النوع مطلوب." });
            return (null, errors);
        }

        var category = await _connectContext.Cdcategories
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.CatId == categoryId, cancellationToken);
        if (category == null)
        {
            errors.Add(new Error { Code = "404", Message = "النوع غير موجود." });
            return (null, errors);
        }

        if (category.CatStatus)
        {
            errors.Add(new Error { Code = "403", Message = "النوع غير مفعل." });
            return (category, errors);
        }

        var unitIds = await GetCurrentUserUnitIdsAsync(userId, cancellationToken);
        if (!await HasCategoryAccessAsync(category.CatId, unitIds, cancellationToken))
        {
            errors.Add(new Error { Code = "403", Message = "غير مسموح بإنشاء طلبات على هذا النوع." });
        }

        return (category, errors);
    }

    private async Task<List<Cdcategory>> LoadScopedCategoriesAsync(
        IReadOnlyCollection<string> unitIds,
        string? appId,
        CancellationToken cancellationToken)
    {
        var categories = await _connectContext.Cdcategories
            .AsNoTracking()
            .Where(category => string.IsNullOrWhiteSpace(appId)
                || string.Equals(category.ApplicationId ?? string.Empty, appId, StringComparison.OrdinalIgnoreCase))
            .OrderBy(category => category.CatParent)
            .ThenBy(category => category.CatName)
            .ToListAsync(cancellationToken);

        if (unitIds == null || unitIds.Count == 0)
        {
            return categories;
        }

        var unitNumbers = unitIds
            .Select(unit => int.TryParse(unit, out var parsed) ? parsed : 0)
            .Where(parsed => parsed > 0)
            .ToHashSet();

        if (unitNumbers.Count == 0)
        {
            return categories;
        }

        var byId = categories.ToDictionary(category => category.CatId);
        var includeIds = new HashSet<int>();

        foreach (var category in categories)
        {
            var root = ResolveRootCategoryId(category.CatId, byId);
            if (unitNumbers.Contains(root) || root == 60)
            {
                includeIds.Add(category.CatId);
                IncludeAncestors(category.CatId, byId, includeIds);
            }
        }

        if (includeIds.Count == 0)
        {
            return categories;
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
            LastModifiedAtUtc = policy?.LastModifiedAtUtc ?? policy?.CreatedAtUtc
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
                CreatedBy = userId,
                CreatedAtUtc = DateTime.UtcNow,
                LastModifiedBy = userId,
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
        await _connectContext.SubjectStatusHistories.AddAsync(new SubjectStatusHistory
        {
            MessageId = messageId,
            OldStatus = oldStatus,
            NewStatus = newStatus,
            Notes = notes,
            ChangedBy = changedBy,
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
        var json = payload == null ? null : JsonSerializer.Serialize(payload);
        await _connectContext.SubjectTimelineEvents.AddAsync(new SubjectTimelineEvent
        {
            MessageId = messageId,
            EventType = eventType,
            EventTitle = eventTitle,
            EventPayloadJson = json,
            StatusFrom = statusFrom,
            StatusTo = statusTo,
            CreatedBy = createdBy,
            CreatedAtUtc = DateTime.UtcNow
        }, cancellationToken);
    }

    private async Task LinkSubjectToEnvelopeInternalAsync(
        int envelopeId,
        int messageId,
        string linkedBy,
        CancellationToken cancellationToken)
    {
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
            LinkedBy = linkedBy,
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
            createdBy: linkedBy,
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
        var unitIds = await GetCurrentUserUnitIdsAsync(userId, cancellationToken);
        var unitNumeric = unitIds
            .Select(unit => int.TryParse(unit, out var parsed) ? parsed : 0)
            .Where(parsed => parsed > 0)
            .ToList();

        var createdIds = await _connectContext.Messages
            .AsNoTracking()
            .Where(item => item.CreatedBy == userId)
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

        return createdIds
            .Concat(assignmentIds)
            .Concat(stakeholderIds)
            .Concat(taskIds)
            .ToHashSet();
    }

    private async Task<bool> CanUserAccessSubjectAsync(string userId, Message message, CancellationToken cancellationToken)
    {
        if (message == null)
        {
            return false;
        }

        if (string.Equals(message.CreatedBy ?? string.Empty, userId, StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        var unitIds = await GetCurrentUserUnitIdsAsync(userId, cancellationToken);
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

    private async Task<bool> HasCategoryAccessAsync(
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
            return true;
        }

        var numericUnitIds = unitIds
            .Select(unit => int.TryParse(unit, out var parsed) ? parsed : 0)
            .Where(parsed => parsed > 0)
            .ToHashSet();

        if (numericUnitIds.Count == 0)
        {
            return true;
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

        return numericUnitIds.Contains(60) || numericUnitIds.Contains(cursor);
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

    private static string? NormalizeNullable(string? value)
    {
        var normalized = (value ?? string.Empty).Trim();
        return normalized.Length == 0 ? null : normalized;
    }

    private static bool HasCategoryAccess(int categoryId, IReadOnlyCollection<string> unitIds)
    {
        if (unitIds == null || unitIds.Count == 0)
        {
            return true;
        }

        var numericUnitIds = unitIds
            .Select(unit => int.TryParse(unit, out var parsed) ? parsed : 0)
            .Where(parsed => parsed > 0)
            .ToHashSet();

        if (numericUnitIds.Count == 0)
        {
            return true;
        }

        return numericUnitIds.Contains(60) || numericUnitIds.Contains(categoryId);
    }
}
