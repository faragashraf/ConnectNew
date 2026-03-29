using System.Data;
using System.Globalization;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Models.Attachment;
using Models.Correspondance;
using Models.DTO.Common;
using Models.DTO.Correspondance;
using Models.DTO.Correspondance.Enums;
using Models.DTO.Correspondance.Publications;
using Persistence.Data;
using Persistence.HelperServices;

namespace Persistence.Services;

public class PublicationsWorkflowService
{
    private const string PublicationDynamicApplicationId = "PUBL";

    private readonly ConnectContext _connectContext;
    private readonly Attach_HeldContext _attachHeldContext;
    private readonly GPAContext _gpaContext;
    private readonly helperService _helperService;

    public PublicationsWorkflowService(
        ConnectContext connectContext,
        Attach_HeldContext attachHeldContext,
        GPAContext gpaContext,
        helperService helperService)
    {
        _connectContext = connectContext;
        _attachHeldContext = attachHeldContext;
        _gpaContext = gpaContext;
        _helperService = helperService;
    }

    public async Task<CommonResponse<IEnumerable<PublicationRequestTypeDto>>> GetAllowedRequestTypesAsync(string userId)
    {
        var response = new CommonResponse<IEnumerable<PublicationRequestTypeDto>>();

        try
        {
            var userUnitIds = await GetActiveUserUnitIdsAsync(userId);
            if (!userUnitIds.Any())
            {
                response.Data = Array.Empty<PublicationRequestTypeDto>();
                return response;
            }

            response.Data = await (
                from map in _connectContext.PublicationDepartmentRequestTypes.AsNoTracking()
                join requestType in _connectContext.PublicationRequestTypes.AsNoTracking()
                    on map.PublicationRequestTypeId equals requestType.PublicationRequestTypeId
                where map.IsActive
                    && map.CanCreate
                    && requestType.IsActive
                    && userUnitIds.Contains(map.DepartmentUnitId)
                orderby requestType.DisplayOrder, requestType.PublicationRequestTypeId
                select new PublicationRequestTypeDto
                {
                    PublicationRequestTypeId = requestType.PublicationRequestTypeId,
                    Code = requestType.Code,
                    NameAr = requestType.NameAr,
                    NameEn = requestType.NameEn,
                    CategoryId = requestType.CategoryId,
                    DisplayOrder = requestType.DisplayOrder
                })
                .Distinct()
                .ToListAsync();
        }
        catch (Exception ex)
        {
            response.Errors.Add(new Error { Code = ex.HResult.ToString(CultureInfo.InvariantCulture), Message = ex.Message });
        }

        return response;
    }

    public async Task<CommonResponse<IEnumerable<PublicationSearchableFieldDto>>> GetSearchableFieldsAsync(
        string userId,
        int? publicationRequestTypeId = null,
        bool adminView = false)
    {
        var response = new CommonResponse<IEnumerable<PublicationSearchableFieldDto>>();

        try
        {
            var fields = new List<PublicationSearchableFieldDto>
            {
                new() { FieldKey = "MessageId", FieldLabel = "رقم الطلب", IsDynamic = false },
                new() { FieldKey = "RequestRef", FieldLabel = "المرجع الداخلي", IsDynamic = false },
                new() { FieldKey = "Subject", FieldLabel = "الموضوع", IsDynamic = false },
                new() { FieldKey = "PublicationNumber", FieldLabel = "رقم النشر", IsDynamic = false },
                new() { FieldKey = "WorkflowStatus", FieldLabel = "حالة الطلب", IsDynamic = false },
                new() { FieldKey = "CreatedBy", FieldLabel = "مقدم الطلب", IsDynamic = false }
            };

            var categoryIds = new HashSet<int>();
            if (publicationRequestTypeId.HasValue && publicationRequestTypeId.Value > 0)
            {
                var categoryId = await _connectContext.PublicationRequestTypes
                    .AsNoTracking()
                    .Where(x => x.PublicationRequestTypeId == publicationRequestTypeId.Value && x.IsActive)
                    .Select(x => x.CategoryId)
                    .FirstOrDefaultAsync();

                if (categoryId > 0)
                {
                    categoryIds.Add(categoryId);
                }
            }
            else if (adminView && await IsPublicationAdminAsync(userId))
            {
                var adminCategories = await _connectContext.PublicationRequestTypes
                    .AsNoTracking()
                    .Where(x => x.IsActive)
                    .Select(x => x.CategoryId)
                    .Distinct()
                    .ToListAsync();

                foreach (var category in adminCategories)
                {
                    categoryIds.Add(category);
                }
            }
            else
            {
                var userUnitIds = await GetActiveUserUnitIdsAsync(userId);
                var allowedCategories = await (
                    from map in _connectContext.PublicationDepartmentRequestTypes.AsNoTracking()
                    join requestType in _connectContext.PublicationRequestTypes.AsNoTracking()
                        on map.PublicationRequestTypeId equals requestType.PublicationRequestTypeId
                    where map.IsActive
                        && map.CanCreate
                        && requestType.IsActive
                        && userUnitIds.Contains(map.DepartmentUnitId)
                    select requestType.CategoryId)
                    .Distinct()
                    .ToListAsync();

                foreach (var category in allowedCategories)
                {
                    categoryIds.Add(category);
                }
            }

            var categoryIdsList = categoryIds.ToList();
            var searchableDynamic = await (
                from cdmend in _connectContext.Cdmends.AsNoTracking()
                join categoryMand in _connectContext.CdCategoryMands.AsNoTracking()
                    on cdmend.CdmendTxt equals categoryMand.MendField
                where cdmend.ApplicationId == PublicationDynamicApplicationId
                    && cdmend.CdmendStat == false
                    && cdmend.IsSearchable
                    && (categoryIdsList.Count == 0 || categoryIdsList.Contains(categoryMand.MendCategory))
                select new PublicationSearchableFieldDto
                {
                    FieldKey = cdmend.CdmendTxt,
                    FieldLabel = cdmend.CDMendLbl ?? cdmend.CdmendTxt,
                    IsDynamic = true
                })
                .Distinct()
                .OrderBy(x => x.FieldLabel)
                .ToListAsync();

            fields.AddRange(searchableDynamic);
            response.Data = fields
                .GroupBy(x => x.FieldKey, StringComparer.OrdinalIgnoreCase)
                .Select(x => x.First())
                .ToList();
        }
        catch (Exception ex)
        {
            response.Errors.Add(new Error { Code = ex.HResult.ToString(CultureInfo.InvariantCulture), Message = ex.Message });
        }

        return response;
    }

    public async Task<CommonResponse<IEnumerable<PublicationRequestTypeDto>>> GetPublicationTypeListAsync(int pageNumber, int pageSize)
    {
        var response = new CommonResponse<IEnumerable<PublicationRequestTypeDto>>();

        try
        {
            var safePageNumber = pageNumber <= 0 ? 1 : pageNumber;
            var safePageSize = pageSize <= 0 ? 20 : pageSize;

            var query = _connectContext.PublicationRequestTypes
                .AsNoTracking()
                .Where(x => x.IsActive)
                .OrderBy(x => x.DisplayOrder)
                .ThenBy(x => x.PublicationRequestTypeId);

            response.TotalCount = await query.CountAsync();
            response.PageNumber = safePageNumber;
            response.PageSize = safePageSize;

            response.Data = await query
                .Skip((safePageNumber - 1) * safePageSize)
                .Take(safePageSize)
                .Select(x => new PublicationRequestTypeDto
                {
                    PublicationRequestTypeId = x.PublicationRequestTypeId,
                    Code = x.Code,
                    NameAr = x.NameAr,
                    NameEn = x.NameEn,
                    CategoryId = x.CategoryId,
                    DisplayOrder = x.DisplayOrder
                })
                .ToListAsync();
        }
        catch (Exception ex)
        {
            response.Errors.Add(new Error { Code = ex.HResult.ToString(CultureInfo.InvariantCulture), Message = ex.Message });
        }

        return response;
    }

    public async Task<CommonResponse<PublicationRequestTypeDto>> SavePublicationTypeAsync(string? nameAr, string? nameEn)
    {
        var response = new CommonResponse<PublicationRequestTypeDto>();

        try
        {
            var normalizedNameAr = (nameAr ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(normalizedNameAr))
            {
                response.Errors.Add(new Error { Code = "400", Message = "الاسم العربي لنوع الطلب مطلوب." });
                return response;
            }

            var existingByName = await _connectContext.PublicationRequestTypes
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.IsActive && x.NameAr == normalizedNameAr);
            if (existingByName != null)
            {
                response.Data = new PublicationRequestTypeDto
                {
                    PublicationRequestTypeId = existingByName.PublicationRequestTypeId,
                    Code = existingByName.Code,
                    NameAr = existingByName.NameAr,
                    NameEn = existingByName.NameEn,
                    CategoryId = existingByName.CategoryId,
                    DisplayOrder = existingByName.DisplayOrder
                };
                return response;
            }

            var categoryId = await _connectContext.Cdcategories
                .AsNoTracking()
                .Where(x => x.ApplicationId == PublicationDynamicApplicationId && x.CatStatus && x.CatParent != 0)
                .OrderBy(x => x.CatId)
                .Select(x => x.CatId)
                .FirstOrDefaultAsync();

            if (categoryId <= 0)
            {
                categoryId = await _connectContext.Cdcategories
                    .AsNoTracking()
                    .Where(x => x.ApplicationId == PublicationDynamicApplicationId && x.CatStatus)
                    .OrderBy(x => x.CatId)
                    .Select(x => x.CatId)
                    .FirstOrDefaultAsync();
            }

            if (categoryId <= 0)
            {
                response.Errors.Add(new Error { Code = "404", Message = "لا توجد فئة منشورات مفعلة في النظام." });
                return response;
            }

            var nextDisplayOrder = (await _connectContext.PublicationRequestTypes
                .AsNoTracking()
                .Where(x => x.IsActive)
                .Select(x => (int?)x.DisplayOrder)
                .MaxAsync() ?? 0) + 1;

            var normalizedCodePart = Regex.Replace(normalizedNameAr.ToUpperInvariant(), "[^A-Z0-9]+", "_").Trim('_');
            if (string.IsNullOrWhiteSpace(normalizedCodePart))
            {
                normalizedCodePart = "TYPE";
            }

            var code = $"PUBL_{normalizedCodePart}";
            var codeCounter = 1;
            while (await _connectContext.PublicationRequestTypes.AsNoTracking().AnyAsync(x => x.Code == code))
            {
                codeCounter++;
                code = $"PUBL_{normalizedCodePart}_{codeCounter}";
            }

            var entity = new PublicationRequestType
            {
                Code = code,
                NameAr = normalizedNameAr,
                NameEn = string.IsNullOrWhiteSpace(nameEn) ? null : nameEn.Trim(),
                CategoryId = categoryId,
                ApplicationId = PublicationDynamicApplicationId,
                IsActive = true,
                DisplayOrder = nextDisplayOrder,
                CreatedAtUtc = DateTime.UtcNow
            };

            await _connectContext.PublicationRequestTypes.AddAsync(entity);
            await _connectContext.SaveChangesAsync();

            response.Data = new PublicationRequestTypeDto
            {
                PublicationRequestTypeId = entity.PublicationRequestTypeId,
                Code = entity.Code,
                NameAr = entity.NameAr,
                NameEn = entity.NameEn,
                CategoryId = entity.CategoryId,
                DisplayOrder = entity.DisplayOrder
            };
        }
        catch (Exception ex)
        {
            response.Errors.Add(new Error { Code = ex.HResult.ToString(CultureInfo.InvariantCulture), Message = ex.Message });
        }

        return response;
    }

    public async Task<string?> GetAttachmentContentBase64Async(int attachmentId)
    {
        var attachment = await _attachHeldContext.AttchShipments
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == attachmentId);

        if (attachment?.AttchImg == null || attachment.AttchImg.Length == 0)
        {
            return null;
        }

        return Convert.ToBase64String(attachment.AttchImg);
    }

    public async Task<CommonResponse<PublicationRequestDetailsDto>> CreateRequestAsync(
        PublicationCreateRequest request,
        string userId,
        string ip)
    {
        var response = new CommonResponse<PublicationRequestDetailsDto>();
        IDbContextTransaction? connectTrx = null;
        IDbContextTransaction? attachTrx = null;

        try
        {
            if (request.PublicationRequestTypeId <= 0)
            {
                response.Errors.Add(new Error { Code = "400", Message = "نوع الطلب مطلوب." });
                return response;
            }

            var userUnitIds = await GetActiveUserUnitIdsAsync(userId);
            if (!userUnitIds.Any())
            {
                response.Errors.Add(new Error { Code = "403", Message = "لا توجد إدارة مفعلة للمستخدم." });
                return response;
            }

            var selectedDepartmentUnitId = await ResolveDepartmentUnitIdAsync(request.DepartmentUnitId, userUnitIds, response);
            if (!response.IsSuccess)
            {
                return response;
            }

            var requestType = await _connectContext.PublicationRequestTypes
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.PublicationRequestTypeId == request.PublicationRequestTypeId && x.IsActive);
            if (requestType == null)
            {
                response.Errors.Add(new Error { Code = "404", Message = "نوع الطلب غير موجود." });
                return response;
            }

            var typeAllowed = await _connectContext.PublicationDepartmentRequestTypes
                .AsNoTracking()
                .AnyAsync(x =>
                    x.PublicationRequestTypeId == request.PublicationRequestTypeId
                    && x.DepartmentUnitId == selectedDepartmentUnitId
                    && x.IsActive
                    && x.CanCreate);
            if (!typeAllowed)
            {
                response.Errors.Add(new Error { Code = "403", Message = "نوع الطلب غير متاح للإدارة المختارة." });
                return response;
            }

            await ValidateDynamicFieldsAsync(requestType.CategoryId, request.Fields, response);
            if (!response.IsSuccess)
            {
                return response;
            }

            if (!_helperService.ValidateFileSizes(request.files, response))
            {
                return response;
            }

            connectTrx = await _connectContext.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted);
            attachTrx = await _attachHeldContext.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted);

            var nowUtc = DateTime.UtcNow;
            var messageId = _helperService.GetSequenceNextValue("Seq_Tickets");
            var categoryInfo = _helperService.GetType(requestType.CategoryId);
            var messageType = categoryInfo?.ParentCategory?.CatId ?? 1;

            var message = new Message
            {
                MessageId = messageId,
                Subject = request.Subject?.Trim(),
                Description = request.Description?.Trim(),
                Status = MessageStatus.New,
                Priority = Priority.Medium,
                CreatedBy = userId,
                AssignedSectorId = selectedDepartmentUnitId.ToString(CultureInfo.InvariantCulture),
                CurrentResponsibleSectorId = selectedDepartmentUnitId.ToString(CultureInfo.InvariantCulture),
                CreatedDate = nowUtc,
                RequestRef = BuildInternalReference(messageId),
                Type = Convert.ToByte(Math.Clamp(messageType, byte.MinValue, byte.MaxValue), CultureInfo.InvariantCulture),
                CategoryCd = requestType.CategoryId
            };
            await _connectContext.Messages.AddAsync(message);

            var replyText = string.IsNullOrWhiteSpace(request.Comment)
                ? "تم إنشاء طلب النشر كمسودة."
                : request.Comment.Trim();
            var reply = _helperService.CreateReply(
                messageId,
                replyText,
                userId,
                selectedDepartmentUnitId.ToString(CultureInfo.InvariantCulture),
                ip);
            await _connectContext.Replies.AddAsync(reply);

            if (request.Fields is { Count: > 0 })
            {
                var sanitizedFields = request.Fields
                    .Where(x => !string.IsNullOrWhiteSpace(x.FildKind))
                    .Select(x => new TkmendField
                    {
                        FildSql = 0,
                        FildRelted = messageId,
                        FildKind = x.FildKind!.Trim(),
                        FildTxt = string.IsNullOrWhiteSpace(x.FildTxt) ? null : helperService.NormalizeToShortDate(x.FildTxt.Trim()),
                        InstanceGroupId = x.InstanceGroupId ?? 1
                    })
                    .ToList();

                if (sanitizedFields.Any())
                {
                    await _connectContext.TkmendFields.AddRangeAsync(sanitizedFields);
                }
            }

            if (request.files is { Count: > 0 })
            {
                var attachments = new List<AttchShipment>();
                await _helperService.SaveAttachments(request.files, reply.ReplyId, attachments);
                if (attachments.Any())
                {
                    await _attachHeldContext.AttchShipments.AddRangeAsync(attachments);
                }
            }

            var publicationRequest = new PublicationRequest
            {
                MessageId = messageId,
                PublicationRequestTypeId = requestType.PublicationRequestTypeId,
                DepartmentUnitId = selectedDepartmentUnitId,
                WorkflowStatus = PublicationWorkflowStatuses.Draft,
                CreatedAtUtc = nowUtc,
                CreatedBy = userId,
                LastActionBy = userId,
                LastActionAtUtc = nowUtc
            };
            await _connectContext.PublicationRequests.AddAsync(publicationRequest);

            await RecordHistoryAsync(
                messageId,
                PublicationHistoryActions.CreateDraft,
                fromStatus: null,
                toStatus: PublicationWorkflowStatuses.Draft,
                comment: replyText,
                actionBy: userId,
                actionAtUtc: nowUtc,
                replyId: reply.ReplyId);

            await _connectContext.SaveChangesAsync();
            await _attachHeldContext.SaveChangesAsync();
            await connectTrx.CommitAsync();
            await attachTrx.CommitAsync();

            response.Data = await BuildRequestDetailsAsync(messageId, userId);
        }
        catch (Exception ex)
        {
            if (attachTrx != null)
            {
                await attachTrx.RollbackAsync();
            }

            if (connectTrx != null)
            {
                await connectTrx.RollbackAsync();
            }

            response.Errors.Add(new Error { Code = ex.HResult.ToString(CultureInfo.InvariantCulture), Message = ex.Message });
        }

        return response;
    }

    public async Task<CommonResponse<PublicationRequestDetailsDto>> EditRequestAsync(
        int messageId,
        PublicationEditRequest request,
        string userId,
        string ip)
    {
        var response = new CommonResponse<PublicationRequestDetailsDto>();
        IDbContextTransaction? connectTrx = null;
        IDbContextTransaction? attachTrx = null;

        try
        {
            if (messageId <= 0)
            {
                response.Errors.Add(new Error { Code = "400", Message = "رقم الطلب غير صحيح." });
                return response;
            }

            var publicationRequest = await _connectContext.PublicationRequests
                .FirstOrDefaultAsync(x => x.MessageId == messageId);
            if (publicationRequest == null)
            {
                response.Errors.Add(new Error { Code = "404", Message = "طلب النشر غير موجود." });
                return response;
            }

            var message = await _connectContext.Messages
                .FirstOrDefaultAsync(x => x.MessageId == messageId);
            if (message == null)
            {
                response.Errors.Add(new Error { Code = "404", Message = "الطلب غير موجود." });
                return response;
            }

            if (!string.Equals(publicationRequest.CreatedBy, userId, StringComparison.OrdinalIgnoreCase))
            {
                response.Errors.Add(new Error { Code = "403", Message = "غير مسموح بتعديل هذا الطلب." });
                return response;
            }

            var currentStatus = NormalizeWorkflowStatus(publicationRequest.WorkflowStatus);
            if (!CanEditStatus(currentStatus))
            {
                response.Errors.Add(new Error { Code = "409", Message = "لا يمكن تعديل الطلب في الحالة الحالية." });
                return response;
            }

            var requestTypeId = request.PublicationRequestTypeId.GetValueOrDefault(publicationRequest.PublicationRequestTypeId);
            var requestType = await _connectContext.PublicationRequestTypes
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.PublicationRequestTypeId == requestTypeId && x.IsActive);
            if (requestType == null)
            {
                response.Errors.Add(new Error { Code = "404", Message = "نوع الطلب غير موجود." });
                return response;
            }

            var userUnitIds = await GetActiveUserUnitIdsAsync(userId);
            var selectedDepartmentUnitId = await ResolveDepartmentUnitIdAsync(
                request.DepartmentUnitId ?? publicationRequest.DepartmentUnitId,
                userUnitIds,
                response);
            if (!response.IsSuccess)
            {
                return response;
            }

            var typeAllowed = await _connectContext.PublicationDepartmentRequestTypes
                .AsNoTracking()
                .AnyAsync(x =>
                    x.PublicationRequestTypeId == requestType.PublicationRequestTypeId
                    && x.DepartmentUnitId == selectedDepartmentUnitId
                    && x.IsActive
                    && x.CanCreate);
            if (!typeAllowed)
            {
                response.Errors.Add(new Error { Code = "403", Message = "نوع الطلب غير متاح للإدارة المختارة." });
                return response;
            }

            await ValidateDynamicFieldsAsync(requestType.CategoryId, request.Fields, response);
            if (!response.IsSuccess)
            {
                return response;
            }

            if (!_helperService.ValidateFileSizes(request.files, response))
            {
                return response;
            }

            connectTrx = await _connectContext.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted);
            attachTrx = await _attachHeldContext.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted);

            var nowUtc = DateTime.UtcNow;

            message.Subject = request.Subject?.Trim();
            message.Description = request.Description?.Trim();
            message.CategoryCd = requestType.CategoryId;
            message.AssignedSectorId = selectedDepartmentUnitId.ToString(CultureInfo.InvariantCulture);
            message.CurrentResponsibleSectorId = selectedDepartmentUnitId.ToString(CultureInfo.InvariantCulture);
            message.LastModifiedDate = nowUtc;

            publicationRequest.PublicationRequestTypeId = requestType.PublicationRequestTypeId;
            publicationRequest.DepartmentUnitId = selectedDepartmentUnitId;
            publicationRequest.WorkflowStatus = currentStatus;
            publicationRequest.LastActionBy = userId;
            publicationRequest.LastActionAtUtc = nowUtc;

            var existingFields = await _connectContext.TkmendFields
                .Where(x => x.FildRelted == messageId)
                .ToListAsync();
            if (existingFields.Any())
            {
                _connectContext.TkmendFields.RemoveRange(existingFields);
            }

            if (request.Fields is { Count: > 0 })
            {
                var updatedFields = request.Fields
                    .Where(x => !string.IsNullOrWhiteSpace(x.FildKind))
                    .Select(x => new TkmendField
                    {
                        FildSql = 0,
                        FildRelted = messageId,
                        FildKind = x.FildKind!.Trim(),
                        FildTxt = string.IsNullOrWhiteSpace(x.FildTxt) ? null : helperService.NormalizeToShortDate(x.FildTxt.Trim()),
                        InstanceGroupId = x.InstanceGroupId ?? 1
                    })
                    .ToList();

                if (updatedFields.Any())
                {
                    await _connectContext.TkmendFields.AddRangeAsync(updatedFields);
                }
            }

            var replyText = string.IsNullOrWhiteSpace(request.Comment)
                ? "تم تعديل طلب النشر."
                : request.Comment.Trim();
            var reply = _helperService.CreateReply(
                messageId,
                replyText,
                userId,
                selectedDepartmentUnitId.ToString(CultureInfo.InvariantCulture),
                ip);
            await _connectContext.Replies.AddAsync(reply);

            if (request.files is { Count: > 0 })
            {
                var attachments = new List<AttchShipment>();
                await _helperService.SaveAttachments(request.files, reply.ReplyId, attachments);
                if (attachments.Any())
                {
                    await _attachHeldContext.AttchShipments.AddRangeAsync(attachments);
                }
            }

            await RecordHistoryAsync(
                messageId,
                currentStatus == PublicationWorkflowStatuses.Draft
                    ? PublicationHistoryActions.EditDraft
                    : PublicationHistoryActions.EditReturnedRequest,
                fromStatus: currentStatus,
                toStatus: currentStatus,
                comment: replyText,
                actionBy: userId,
                actionAtUtc: nowUtc,
                replyId: reply.ReplyId);

            await _connectContext.SaveChangesAsync();
            await _attachHeldContext.SaveChangesAsync();
            await connectTrx.CommitAsync();
            await attachTrx.CommitAsync();

            response.Data = await BuildRequestDetailsAsync(messageId, userId);
        }
        catch (Exception ex)
        {
            if (attachTrx != null)
            {
                await attachTrx.RollbackAsync();
            }

            if (connectTrx != null)
            {
                await connectTrx.RollbackAsync();
            }

            response.Errors.Add(new Error { Code = ex.HResult.ToString(CultureInfo.InvariantCulture), Message = ex.Message });
        }

        return response;
    }

    public Task<CommonResponse<PublicationRequestDetailsDto>> SubmitAsync(int messageId, string? comment, string userId, string ip)
    {
        return TransitionAsync(
            messageId,
            userId,
            ip,
            targetStatus: PublicationWorkflowStatuses.Submitted,
            defaultReplyMessage: comment ?? "تم إرسال طلب النشر.",
            actionCode: PublicationHistoryActions.Submit,
            adminOnly: false,
            validateCreator: true);
    }

    public Task<CommonResponse<PublicationRequestDetailsDto>> SetUnderReviewAsync(int messageId, string? comment, string userId, string ip)
    {
        return TransitionAsync(
            messageId,
            userId,
            ip,
            targetStatus: PublicationWorkflowStatuses.UnderReview,
            defaultReplyMessage: comment ?? "تم بدء مراجعة طلب النشر.",
            actionCode: PublicationHistoryActions.StartReview,
            adminOnly: true,
            validateCreator: false);
    }

    public Task<CommonResponse<PublicationRequestDetailsDto>> ReturnAsync(
        int messageId,
        PublicationActionRequest request,
        string userId,
        string ip)
    {
        return TransitionAsync(
            messageId,
            userId,
            ip,
            targetStatus: PublicationWorkflowStatuses.ReturnedForEdit,
            defaultReplyMessage: request.Comment ?? "تم إرجاع طلب النشر للتعديل.",
            actionCode: PublicationHistoryActions.ReturnForEdit,
            adminOnly: true,
            validateCreator: false,
            attachments: request.files);
    }

    public Task<CommonResponse<PublicationRequestDetailsDto>> RejectAsync(
        int messageId,
        PublicationActionRequest request,
        string userId,
        string ip)
    {
        return TransitionAsync(
            messageId,
            userId,
            ip,
            targetStatus: PublicationWorkflowStatuses.Rejected,
            defaultReplyMessage: request.Comment ?? "تم رفض طلب النشر.",
            actionCode: PublicationHistoryActions.Reject,
            adminOnly: true,
            validateCreator: false,
            attachments: request.files);
    }

    public async Task<CommonResponse<PublicationRequestDetailsDto>> ApproveAsync(
        int messageId,
        PublicationApproveRequest request,
        string userId,
        string ip)
    {
        var response = new CommonResponse<PublicationRequestDetailsDto>();
        IDbContextTransaction? connectTrx = null;
        IDbContextTransaction? attachTrx = null;

        try
        {
            var isAdmin = await IsPublicationAdminAsync(userId);
            if (!isAdmin)
            {
                response.Errors.Add(new Error { Code = "403", Message = "غير مصرح بتنفيذ هذا الإجراء." });
                return response;
            }

            var publicationRequest = await _connectContext.PublicationRequests
                .FirstOrDefaultAsync(x => x.MessageId == messageId);
            if (publicationRequest == null)
            {
                response.Errors.Add(new Error { Code = "404", Message = "طلب النشر غير موجود." });
                return response;
            }

            var message = await _connectContext.Messages
                .FirstOrDefaultAsync(x => x.MessageId == messageId);
            if (message == null)
            {
                response.Errors.Add(new Error { Code = "404", Message = "الطلب غير موجود." });
                return response;
            }

            var currentStatus = NormalizeWorkflowStatus(publicationRequest.WorkflowStatus);
            if (currentStatus == PublicationWorkflowStatuses.Approved
                && !string.IsNullOrWhiteSpace(publicationRequest.PublicationNumber))
            {
                response.Data = await BuildRequestDetailsAsync(messageId, userId);
                return response;
            }

            if (!CanTransition(currentStatus, PublicationWorkflowStatuses.Approved))
            {
                response.Errors.Add(new Error { Code = "409", Message = "لا يمكن اعتماد الطلب من الحالة الحالية." });
                return response;
            }

            if (!_helperService.ValidateFileSizes(request.files, response))
            {
                return response;
            }

            connectTrx = await _connectContext.Database.BeginTransactionAsync(IsolationLevel.Serializable);
            attachTrx = await _attachHeldContext.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted);

            var nowUtc = DateTime.UtcNow;
            if (string.IsNullOrWhiteSpace(publicationRequest.PublicationNumber))
            {
                var numberInfo = await AllocatePublicationNumberAsync(nowUtc);
                publicationRequest.PublicationYear = numberInfo.publicationYear;
                publicationRequest.PublicationSerial = numberInfo.publicationSerial;
                publicationRequest.PublicationNumber = numberInfo.publicationNumber;
            }

            publicationRequest.WorkflowStatus = PublicationWorkflowStatuses.Approved;
            publicationRequest.ApprovedAtUtc = nowUtc;
            publicationRequest.LastActionAtUtc = nowUtc;
            publicationRequest.LastActionBy = userId;

            message.Status = MessageStatus.Printed;
            message.LastModifiedDate = nowUtc;

            var replyText = string.IsNullOrWhiteSpace(request.Comment)
                ? "تم اعتماد طلب النشر."
                : request.Comment.Trim();
            var reply = _helperService.CreateReply(
                messageId,
                replyText,
                userId,
                publicationRequest.DepartmentUnitId.ToString(CultureInfo.InvariantCulture),
                ip);
            await _connectContext.Replies.AddAsync(reply);

            if (request.files is { Count: > 0 })
            {
                var attachments = new List<AttchShipment>();
                await _helperService.SaveAttachments(request.files, reply.ReplyId, attachments);
                if (attachments.Any())
                {
                    await _attachHeldContext.AttchShipments.AddRangeAsync(attachments);
                }
            }

            publicationRequest.FinalApprovalReplyId = reply.ReplyId;

            await RecordHistoryAsync(
                messageId,
                PublicationHistoryActions.Approve,
                fromStatus: currentStatus,
                toStatus: PublicationWorkflowStatuses.Approved,
                comment: replyText,
                actionBy: userId,
                actionAtUtc: nowUtc,
                replyId: reply.ReplyId);

            await _connectContext.SaveChangesAsync();
            await _attachHeldContext.SaveChangesAsync();
            await connectTrx.CommitAsync();
            await attachTrx.CommitAsync();

            response.Data = await BuildRequestDetailsAsync(messageId, userId);
        }
        catch (Exception ex)
        {
            if (attachTrx != null)
            {
                await attachTrx.RollbackAsync();
            }

            if (connectTrx != null)
            {
                await connectTrx.RollbackAsync();
            }

            response.Errors.Add(new Error { Code = ex.HResult.ToString(CultureInfo.InvariantCulture), Message = ex.Message });
        }

        return response;
    }

    public async Task<CommonResponse<IEnumerable<PublicationRequestSummaryDto>>> GetRequestsAsync(
        PublicationRequestsQuery query,
        string userId)
    {
        var response = new CommonResponse<IEnumerable<PublicationRequestSummaryDto>>();
        query ??= new PublicationRequestsQuery();

        try
        {
            var pageNumber = query.PageNumber <= 0 ? 1 : query.PageNumber;
            var pageSize = query.PageSize <= 0 ? 20 : query.PageSize;
            var normalizedUserId = (userId ?? string.Empty).Trim();
            var isAdmin = await IsPublicationAdminAsync(normalizedUserId);

            var requestQuery =
                from publication in _connectContext.PublicationRequests.AsNoTracking()
                join message in _connectContext.Messages.AsNoTracking()
                    on publication.MessageId equals message.MessageId
                join requestType in _connectContext.PublicationRequestTypes.AsNoTracking()
                    on publication.PublicationRequestTypeId equals requestType.PublicationRequestTypeId
                where requestType.IsActive
                select new
                {
                    Publication = publication,
                    Message = message,
                    RequestType = requestType
                };

            if (!query.AdminView || !isAdmin)
            {
                requestQuery = requestQuery.Where(x => x.Publication.CreatedBy.ToUpper() == normalizedUserId.ToUpper());
            }

            if (query.PublicationRequestTypeId.HasValue && query.PublicationRequestTypeId.Value > 0)
            {
                requestQuery = requestQuery.Where(x => x.Publication.PublicationRequestTypeId == query.PublicationRequestTypeId.Value);
            }

            if (query.DepartmentUnitId.HasValue && query.DepartmentUnitId.Value > 0)
            {
                requestQuery = requestQuery.Where(x => x.Publication.DepartmentUnitId == query.DepartmentUnitId.Value);
            }

            if (!string.IsNullOrWhiteSpace(query.WorkflowStatus))
            {
                var targetStatus = NormalizeWorkflowStatus(query.WorkflowStatus);
                if (targetStatus == PublicationWorkflowStatuses.ReturnedForEdit)
                {
                    requestQuery = requestQuery.Where(x =>
                        x.Publication.WorkflowStatus == PublicationWorkflowStatuses.ReturnedForEdit
                        || x.Publication.WorkflowStatus == PublicationWorkflowStatuses.LegacyReturned);
                }
                else
                {
                    requestQuery = requestQuery.Where(x => x.Publication.WorkflowStatus == targetStatus);
                }
            }

            if (query.CreatedFromUtc.HasValue)
            {
                requestQuery = requestQuery.Where(x => x.Publication.CreatedAtUtc >= query.CreatedFromUtc.Value);
            }

            if (query.CreatedToUtc.HasValue)
            {
                requestQuery = requestQuery.Where(x => x.Publication.CreatedAtUtc <= query.CreatedToUtc.Value);
            }

            if (!string.IsNullOrWhiteSpace(query.SearchField) && !string.IsNullOrWhiteSpace(query.SearchText))
            {
                var fieldKey = query.SearchField.Trim();
                var searchText = query.SearchText.Trim();
                var searchType = (query.SearchType ?? "Contains").Trim();
                var normalizedSearchText = searchText.ToUpper();

                if (string.Equals(fieldKey, "MessageId", StringComparison.OrdinalIgnoreCase))
                {
                    if (int.TryParse(searchText, out var messageIdSearch))
                    {
                        requestQuery = requestQuery.Where(x => x.Publication.MessageId == messageIdSearch);
                    }
                }
                else if (string.Equals(fieldKey, "RequestRef", StringComparison.OrdinalIgnoreCase))
                {
                    requestQuery = searchType switch
                    {
                        "Equal" => requestQuery.Where(x => (x.Message.RequestRef ?? string.Empty).ToUpper() == normalizedSearchText),
                        "Start With" => requestQuery.Where(x => (x.Message.RequestRef ?? string.Empty).ToUpper().StartsWith(normalizedSearchText)),
                        _ => requestQuery.Where(x => (x.Message.RequestRef ?? string.Empty).ToUpper().Contains(normalizedSearchText))
                    };
                }
                else if (string.Equals(fieldKey, "Subject", StringComparison.OrdinalIgnoreCase))
                {
                    requestQuery = searchType switch
                    {
                        "Equal" => requestQuery.Where(x => (x.Message.Subject ?? string.Empty).ToUpper() == normalizedSearchText),
                        "Start With" => requestQuery.Where(x => (x.Message.Subject ?? string.Empty).ToUpper().StartsWith(normalizedSearchText)),
                        _ => requestQuery.Where(x => (x.Message.Subject ?? string.Empty).ToUpper().Contains(normalizedSearchText))
                    };
                }
                else if (string.Equals(fieldKey, "PublicationNumber", StringComparison.OrdinalIgnoreCase))
                {
                    requestQuery = searchType switch
                    {
                        "Equal" => requestQuery.Where(x => (x.Publication.PublicationNumber ?? string.Empty).ToUpper() == normalizedSearchText),
                        "Start With" => requestQuery.Where(x => (x.Publication.PublicationNumber ?? string.Empty).ToUpper().StartsWith(normalizedSearchText)),
                        _ => requestQuery.Where(x => (x.Publication.PublicationNumber ?? string.Empty).ToUpper().Contains(normalizedSearchText))
                    };
                }
                else if (string.Equals(fieldKey, "WorkflowStatus", StringComparison.OrdinalIgnoreCase))
                {
                    var workflowStatusSearch = NormalizeWorkflowStatus(searchText);
                    if (workflowStatusSearch == PublicationWorkflowStatuses.ReturnedForEdit)
                    {
                        requestQuery = requestQuery.Where(x =>
                            x.Publication.WorkflowStatus == PublicationWorkflowStatuses.ReturnedForEdit
                            || x.Publication.WorkflowStatus == PublicationWorkflowStatuses.LegacyReturned);
                    }
                    else
                    {
                        requestQuery = requestQuery.Where(x => x.Publication.WorkflowStatus == workflowStatusSearch);
                    }
                }
                else if (string.Equals(fieldKey, "CreatedBy", StringComparison.OrdinalIgnoreCase))
                {
                    requestQuery = searchType switch
                    {
                        "Equal" => requestQuery.Where(x => (x.Publication.CreatedBy ?? string.Empty).ToUpper() == normalizedSearchText),
                        "Start With" => requestQuery.Where(x => (x.Publication.CreatedBy ?? string.Empty).ToUpper().StartsWith(normalizedSearchText)),
                        _ => requestQuery.Where(x => (x.Publication.CreatedBy ?? string.Empty).ToUpper().Contains(normalizedSearchText))
                    };
                }
                else
                {
                    var isDynamicSearchable = await _connectContext.Cdmends
                        .AsNoTracking()
                        .AnyAsync(x =>
                            x.CdmendTxt == fieldKey
                            && x.IsSearchable
                            && x.ApplicationId == PublicationDynamicApplicationId);

                    if (isDynamicSearchable)
                    {
                        var fieldsQuery = _connectContext.TkmendFields
                            .AsNoTracking()
                            .Where(x => x.FildKind == fieldKey && x.FildTxt != null);

                        fieldsQuery = searchType switch
                        {
                            "Equal" => fieldsQuery.Where(x => x.FildTxt!.ToUpper() == normalizedSearchText),
                            "Start With" => fieldsQuery.Where(x => x.FildTxt!.ToUpper().StartsWith(normalizedSearchText)),
                            _ => fieldsQuery.Where(x => x.FildTxt!.ToUpper().Contains(normalizedSearchText))
                        };

                        var messageIdsQuery = fieldsQuery.Select(x => x.FildRelted);
                        requestQuery = requestQuery.Where(x => messageIdsQuery.Contains(x.Publication.MessageId));
                    }
                }
            }

            response.TotalCount = await requestQuery.CountAsync();
            response.PageNumber = pageNumber;
            response.PageSize = pageSize;

            var page = await requestQuery
                .OrderByDescending(x => x.Publication.LastActionAtUtc ?? x.Publication.CreatedAtUtc)
                .ThenByDescending(x => x.Publication.MessageId)
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            var messageIds = page.Select(x => x.Publication.MessageId).ToList();
            var departmentIds = page.Select(x => x.Publication.DepartmentUnitId).Distinct().ToList();
            var creatorIds = page
                .Select(x => x.Publication.CreatedBy)
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .Distinct()
                .ToList();

            var departments = await _gpaContext.VwOrgUnitsWithCounts
                .AsNoTracking()
                .Where(x => departmentIds.Contains(x.UnitId))
                .Select(x => new { x.UnitId, x.UnitName })
                .ToListAsync();
            var departmentNameById = departments
                .GroupBy(x => x.UnitId)
                .ToDictionary(x => x.Key, x => x.First().UnitName ?? string.Empty);

            var creators = await _gpaContext.PosUsers
                .AsNoTracking()
                .Where(x => creatorIds.Contains(x.UserId))
                .Select(x => new { x.UserId, x.ArabicName })
                .ToListAsync();
            var creatorNameById = creators
                .GroupBy(x => x.UserId, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(
                    x => x.Key,
                    x => x.First().ArabicName ?? x.Key,
                    StringComparer.OrdinalIgnoreCase);

            Dictionary<int, List<TkmendField>> dynamicFieldsByMessageId = new();
            if (query.IncludeDynamicFields && messageIds.Any())
            {
                var fields = await _connectContext.TkmendFields
                    .AsNoTracking()
                    .Where(x => messageIds.Contains(x.FildRelted))
                    .ToListAsync();

                dynamicFieldsByMessageId = fields
                    .GroupBy(x => x.FildRelted)
                    .ToDictionary(x => x.Key, x => x.ToList());
            }

            response.Data = page.Select(x =>
            {
                var normalizedStatus = NormalizeWorkflowStatus(x.Publication.WorkflowStatus);
                var summary = new PublicationRequestSummaryDto
                {
                    MessageId = x.Publication.MessageId,
                    Subject = x.Message.Subject,
                    Description = x.Message.Description,
                    CreatedBy = creatorNameById.TryGetValue(x.Publication.CreatedBy ?? string.Empty, out var creatorName)
                        ? creatorName
                        : (x.Publication.CreatedBy ?? string.Empty),
                    CreatedAtUtc = x.Publication.CreatedAtUtc,
                    WorkflowStatus = normalizedStatus,
                    PublicationNumber = x.Publication.PublicationNumber,
                    PublicationRequestTypeId = x.Publication.PublicationRequestTypeId,
                    PublicationRequestTypeNameAr = x.RequestType.NameAr,
                    DepartmentUnitId = x.Publication.DepartmentUnitId,
                    DepartmentUnitName = departmentNameById.TryGetValue(x.Publication.DepartmentUnitId, out var unitName)
                        ? unitName
                        : x.Publication.DepartmentUnitId.ToString(CultureInfo.InvariantCulture),
                    CategoryId = x.RequestType.CategoryId,
                    CanEdit = string.Equals(x.Publication.CreatedBy, normalizedUserId, StringComparison.OrdinalIgnoreCase)
                        && CanEditStatus(normalizedStatus),
                    CanReview = query.AdminView
                        && isAdmin
                        && (normalizedStatus == PublicationWorkflowStatuses.Submitted
                            || normalizedStatus == PublicationWorkflowStatuses.UnderReview)
                };

                if (query.IncludeDynamicFields
                    && dynamicFieldsByMessageId.TryGetValue(x.Publication.MessageId, out var fields))
                {
                    summary.Fields = fields;
                }

                return summary;
            }).ToList();
        }
        catch (Exception ex)
        {
            response.Errors.Add(new Error { Code = ex.HResult.ToString(CultureInfo.InvariantCulture), Message = ex.Message });
        }

        return response;
    }

    public async Task<CommonResponse<PublicationDashboardDto>> GetDashboardAsync(string userId, PublicationDashboardQuery? query)
    {
        var response = new CommonResponse<PublicationDashboardDto>();
        query ??= new PublicationDashboardQuery();

        try
        {
            var isAdmin = await IsPublicationAdminAsync(userId);
            if (!isAdmin)
            {
                response.Errors.Add(new Error { Code = "403", Message = "غير مصرح بعرض لوحة المتابعة." });
                return response;
            }

            var dashboardQuery = _connectContext.PublicationRequests
                .AsNoTracking()
                .AsQueryable();

            if (query.PublicationRequestTypeId.HasValue && query.PublicationRequestTypeId.Value > 0)
            {
                dashboardQuery = dashboardQuery.Where(x => x.PublicationRequestTypeId == query.PublicationRequestTypeId.Value);
            }

            if (query.DepartmentUnitId.HasValue && query.DepartmentUnitId.Value > 0)
            {
                dashboardQuery = dashboardQuery.Where(x => x.DepartmentUnitId == query.DepartmentUnitId.Value);
            }

            if (query.CreatedFromUtc.HasValue)
            {
                dashboardQuery = dashboardQuery.Where(x => x.CreatedAtUtc >= query.CreatedFromUtc.Value);
            }

            if (query.CreatedToUtc.HasValue)
            {
                dashboardQuery = dashboardQuery.Where(x => x.CreatedAtUtc <= query.CreatedToUtc.Value);
            }

            var allItems = await dashboardQuery.ToListAsync();
            var requestTypeNameById = await _connectContext.PublicationRequestTypes
                .AsNoTracking()
                .ToDictionaryAsync(x => x.PublicationRequestTypeId, x => x.NameAr);
            var unitNameById = await _gpaContext.VwOrgUnitsWithCounts
                .AsNoTracking()
                .ToDictionaryAsync(x => x.UnitId, x => x.UnitName ?? string.Empty);

            var approvedDurations = allItems
                .Where(x => x.SubmittedAtUtc.HasValue && x.ApprovedAtUtc.HasValue && x.ApprovedAtUtc >= x.SubmittedAtUtc)
                .Select(x => (x.ApprovedAtUtc!.Value - x.SubmittedAtUtc!.Value).TotalHours)
                .ToList();

            var draftCount = allItems.Count(x => NormalizeWorkflowStatus(x.WorkflowStatus) == PublicationWorkflowStatuses.Draft);
            var submittedCount = allItems.Count(x => NormalizeWorkflowStatus(x.WorkflowStatus) == PublicationWorkflowStatuses.Submitted);
            var underReviewCount = allItems.Count(x => NormalizeWorkflowStatus(x.WorkflowStatus) == PublicationWorkflowStatuses.UnderReview);
            var returnedCount = allItems.Count(x => NormalizeWorkflowStatus(x.WorkflowStatus) == PublicationWorkflowStatuses.ReturnedForEdit);
            var rejectedCount = allItems.Count(x => NormalizeWorkflowStatus(x.WorkflowStatus) == PublicationWorkflowStatuses.Rejected);
            var approvedCount = allItems.Count(x => NormalizeWorkflowStatus(x.WorkflowStatus) == PublicationWorkflowStatuses.Approved);

            response.Data = new PublicationDashboardDto
            {
                TotalCount = allItems.Count,
                DraftCount = draftCount,
                SubmittedCount = submittedCount,
                UnderReviewCount = underReviewCount,
                PendingReviewCount = submittedCount + underReviewCount,
                ReturnedCount = returnedCount,
                RejectedCount = rejectedCount,
                ApprovedCount = approvedCount,
                AvgApprovalHours = approvedDurations.Count == 0 ? 0 : Math.Round(approvedDurations.Average(), 2),
                ByDepartment = allItems
                    .GroupBy(x => x.DepartmentUnitId)
                    .OrderByDescending(x => x.Count())
                    .Select(x => new PublicationDashboardBucketDto
                    {
                        Key = unitNameById.TryGetValue(x.Key, out var unitName)
                            ? unitName
                            : x.Key.ToString(CultureInfo.InvariantCulture),
                        Count = x.Count()
                    })
                    .ToList(),
                ByRequestType = allItems
                    .GroupBy(x => x.PublicationRequestTypeId)
                    .OrderByDescending(x => x.Count())
                    .Select(x => new PublicationDashboardBucketDto
                    {
                        Key = requestTypeNameById.TryGetValue(x.Key, out var requestTypeName)
                            ? requestTypeName
                            : x.Key.ToString(CultureInfo.InvariantCulture),
                        Count = x.Count()
                    })
                    .ToList()
            };
        }
        catch (Exception ex)
        {
            response.Errors.Add(new Error { Code = ex.HResult.ToString(CultureInfo.InvariantCulture), Message = ex.Message });
        }

        return response;
    }

    public async Task<CommonResponse<PublicationRequestDetailsDto>> GetRequestDetailsAsync(int messageId, string userId)
    {
        var response = new CommonResponse<PublicationRequestDetailsDto>();

        try
        {
            var details = await BuildRequestDetailsAsync(messageId, userId);
            if (details == null)
            {
                response.Errors.Add(new Error { Code = "404", Message = "طلب النشر غير موجود." });
                return response;
            }

            response.Data = details;
        }
        catch (Exception ex)
        {
            response.Errors.Add(new Error { Code = ex.HResult.ToString(CultureInfo.InvariantCulture), Message = ex.Message });
        }

        return response;
    }

    private async Task<CommonResponse<PublicationRequestDetailsDto>> TransitionAsync(
        int messageId,
        string userId,
        string ip,
        string targetStatus,
        string defaultReplyMessage,
        string actionCode,
        bool adminOnly,
        bool validateCreator,
        List<IFormFile>? attachments = null)
    {
        var response = new CommonResponse<PublicationRequestDetailsDto>();
        IDbContextTransaction? connectTrx = null;
        IDbContextTransaction? attachTrx = null;

        try
        {
            if (adminOnly)
            {
                var isAdmin = await IsPublicationAdminAsync(userId);
                if (!isAdmin)
                {
                    response.Errors.Add(new Error { Code = "403", Message = "غير مصرح بتنفيذ هذا الإجراء." });
                    return response;
                }
            }

            var publicationRequest = await _connectContext.PublicationRequests
                .FirstOrDefaultAsync(x => x.MessageId == messageId);
            if (publicationRequest == null)
            {
                response.Errors.Add(new Error { Code = "404", Message = "طلب النشر غير موجود." });
                return response;
            }

            var message = await _connectContext.Messages
                .FirstOrDefaultAsync(x => x.MessageId == messageId);
            if (message == null)
            {
                response.Errors.Add(new Error { Code = "404", Message = "الطلب غير موجود." });
                return response;
            }

            if (validateCreator && !string.Equals(publicationRequest.CreatedBy, userId, StringComparison.OrdinalIgnoreCase))
            {
                response.Errors.Add(new Error { Code = "403", Message = "غير مصرح بتنفيذ هذا الإجراء." });
                return response;
            }

            var currentStatus = NormalizeWorkflowStatus(publicationRequest.WorkflowStatus);
            var normalizedTarget = NormalizeWorkflowStatus(targetStatus);
            if (!CanTransition(currentStatus, normalizedTarget))
            {
                response.Errors.Add(new Error { Code = "409", Message = "الانتقال بين الحالات غير مسموح." });
                return response;
            }

            if (!_helperService.ValidateFileSizes(attachments, response))
            {
                return response;
            }

            connectTrx = await _connectContext.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted);
            attachTrx = await _attachHeldContext.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted);

            var nowUtc = DateTime.UtcNow;
            publicationRequest.WorkflowStatus = normalizedTarget;
            publicationRequest.LastActionBy = userId;
            publicationRequest.LastActionAtUtc = nowUtc;

            switch (normalizedTarget)
            {
                case PublicationWorkflowStatuses.Submitted:
                    publicationRequest.SubmittedAtUtc = nowUtc;
                    break;
                case PublicationWorkflowStatuses.UnderReview:
                    publicationRequest.ReviewedAtUtc = nowUtc;
                    break;
                case PublicationWorkflowStatuses.ReturnedForEdit:
                    publicationRequest.ReturnedAtUtc = nowUtc;
                    break;
                case PublicationWorkflowStatuses.Rejected:
                    publicationRequest.RejectedAtUtc = nowUtc;
                    break;
            }

            message.Status = ToMessageStatus(normalizedTarget);
            message.LastModifiedDate = nowUtc;

            var reply = _helperService.CreateReply(
                messageId,
                defaultReplyMessage,
                userId,
                publicationRequest.DepartmentUnitId.ToString(CultureInfo.InvariantCulture),
                ip);
            await _connectContext.Replies.AddAsync(reply);

            if (attachments is { Count: > 0 })
            {
                var attachmentEntities = new List<AttchShipment>();
                await _helperService.SaveAttachments(attachments, reply.ReplyId, attachmentEntities);
                if (attachmentEntities.Any())
                {
                    await _attachHeldContext.AttchShipments.AddRangeAsync(attachmentEntities);
                }
            }

            await RecordHistoryAsync(
                messageId,
                actionCode,
                fromStatus: currentStatus,
                toStatus: normalizedTarget,
                comment: defaultReplyMessage,
                actionBy: userId,
                actionAtUtc: nowUtc,
                replyId: reply.ReplyId);

            await _connectContext.SaveChangesAsync();
            await _attachHeldContext.SaveChangesAsync();
            await connectTrx.CommitAsync();
            await attachTrx.CommitAsync();

            response.Data = await BuildRequestDetailsAsync(messageId, userId);
        }
        catch (Exception ex)
        {
            if (attachTrx != null)
            {
                await attachTrx.RollbackAsync();
            }

            if (connectTrx != null)
            {
                await connectTrx.RollbackAsync();
            }

            response.Errors.Add(new Error { Code = ex.HResult.ToString(CultureInfo.InvariantCulture), Message = ex.Message });
        }

        return response;
    }

    private async Task<PublicationRequestDetailsDto?> BuildRequestDetailsAsync(int messageId, string userId)
    {
        var publicationProjection = await (
            from publication in _connectContext.PublicationRequests.AsNoTracking()
            join message in _connectContext.Messages.AsNoTracking()
                on publication.MessageId equals message.MessageId
            join requestType in _connectContext.PublicationRequestTypes.AsNoTracking()
                on publication.PublicationRequestTypeId equals requestType.PublicationRequestTypeId
            where publication.MessageId == messageId
            select new
            {
                Publication = publication,
                Message = message,
                RequestType = requestType
            })
            .FirstOrDefaultAsync();

        if (publicationProjection == null)
        {
            return null;
        }

        var isAdmin = await IsPublicationAdminAsync(userId);
        var canView = isAdmin
            || string.Equals(publicationProjection.Publication.CreatedBy, userId, StringComparison.OrdinalIgnoreCase);
        if (!canView)
        {
            return null;
        }

        var departmentName = await _gpaContext.VwOrgUnitsWithCounts
            .AsNoTracking()
            .Where(x => x.UnitId == publicationProjection.Publication.DepartmentUnitId)
            .Select(x => x.UnitName)
            .FirstOrDefaultAsync()
            ?? publicationProjection.Publication.DepartmentUnitId.ToString(CultureInfo.InvariantCulture);

        var messageResponse = new CommonResponse<MessageDto>();
        await _helperService.GetMessageRequestById(messageId, messageResponse);

        var normalizedStatus = NormalizeWorkflowStatus(publicationProjection.Publication.WorkflowStatus);
        var summary = new PublicationRequestSummaryDto
        {
            MessageId = publicationProjection.Publication.MessageId,
            Subject = publicationProjection.Message.Subject,
            Description = publicationProjection.Message.Description,
            CreatedBy = publicationProjection.Publication.CreatedBy,
            CreatedAtUtc = publicationProjection.Publication.CreatedAtUtc,
            WorkflowStatus = normalizedStatus,
            PublicationNumber = publicationProjection.Publication.PublicationNumber,
            PublicationRequestTypeId = publicationProjection.Publication.PublicationRequestTypeId,
            PublicationRequestTypeNameAr = publicationProjection.RequestType.NameAr,
            DepartmentUnitId = publicationProjection.Publication.DepartmentUnitId,
            DepartmentUnitName = departmentName,
            CategoryId = publicationProjection.RequestType.CategoryId,
            CanEdit = string.Equals(publicationProjection.Publication.CreatedBy, userId, StringComparison.OrdinalIgnoreCase)
                && CanEditStatus(normalizedStatus),
            CanReview = isAdmin
        };

        var history = await _connectContext.PublicationRequestHistories
            .AsNoTracking()
            .Where(x => x.MessageId == messageId)
            .OrderBy(x => x.ActionAtUtc)
            .ThenBy(x => x.PublicationRequestHistoryId)
            .Select(x => new PublicationRequestHistoryDto
            {
                PublicationRequestHistoryId = x.PublicationRequestHistoryId,
                MessageId = x.MessageId,
                ActionCode = x.ActionCode,
                FromStatus = NormalizeWorkflowStatus(x.FromStatus),
                ToStatus = NormalizeWorkflowStatus(x.ToStatus),
                Comment = x.Comment,
                ActionBy = x.ActionBy,
                ActionAtUtc = x.ActionAtUtc,
                ReplyId = x.ReplyId
            })
            .ToListAsync();

        return new PublicationRequestDetailsDto
        {
            Summary = summary,
            MessageDetails = messageResponse.Data,
            History = history
        };
    }

    private async Task<decimal> ResolveDepartmentUnitIdAsync(
        decimal? requestedDepartmentUnitId,
        List<decimal> userUnitIds,
        CommonResponse<PublicationRequestDetailsDto> response)
    {
        if (!requestedDepartmentUnitId.HasValue || requestedDepartmentUnitId.Value <= 0)
        {
            if (userUnitIds.Count == 1)
            {
                return userUnitIds[0];
            }

            response.Errors.Add(new Error { Code = "400", Message = "الرجاء اختيار الإدارة." });
            return 0;
        }

        if (!userUnitIds.Contains(requestedDepartmentUnitId.Value))
        {
            response.Errors.Add(new Error { Code = "403", Message = "الإدارة المختارة غير مرتبطة بالمستخدم." });
            return 0;
        }

        return requestedDepartmentUnitId.Value;
    }

    private async Task ValidateDynamicFieldsAsync(
        int categoryId,
        List<TkmendField>? fields,
        CommonResponse<PublicationRequestDetailsDto> response)
    {
        fields ??= new List<TkmendField>();

        var normalizedFields = fields
            .Where(x => !string.IsNullOrWhiteSpace(x.FildKind))
            .ToDictionary(x => x.FildKind!.Trim(), x => x.FildTxt?.Trim(), StringComparer.OrdinalIgnoreCase);

        var categoryMands = await _connectContext.CdCategoryMands
            .AsNoTracking()
            .Where(x => x.MendCategory == categoryId && x.MendStat == false)
            .Select(x => x.MendField)
            .Distinct()
            .ToListAsync();
        if (!categoryMands.Any())
        {
            return;
        }

        var metadata = await _connectContext.Cdmends
            .AsNoTracking()
            .Where(x => x.ApplicationId == PublicationDynamicApplicationId && categoryMands.Contains(x.CdmendTxt))
            .ToListAsync();
        var metadataByKey = metadata
            .GroupBy(x => x.CdmendTxt, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(x => x.Key, x => x.First(), StringComparer.OrdinalIgnoreCase);

        foreach (var mendFieldKey in categoryMands)
        {
            if (!metadataByKey.TryGetValue(mendFieldKey, out var mend))
            {
                continue;
            }

            normalizedFields.TryGetValue(mendFieldKey, out var value);
            if (mend.Required == true && string.IsNullOrWhiteSpace(value))
            {
                response.Errors.Add(new Error
                {
                    Code = "400",
                    Message = $"الحقل ({mend.CDMendLbl ?? mendFieldKey}) مطلوب."
                });
                continue;
            }

            if (string.IsNullOrWhiteSpace(value))
            {
                continue;
            }

            ValidateMinMaxByDataType(mend, value!, response);
        }
    }

    private static void ValidateMinMaxByDataType(
        Cdmend mend,
        string value,
        CommonResponse<PublicationRequestDetailsDto> response)
    {
        var dataType = (mend.CdmendDatatype ?? string.Empty).Trim().ToLowerInvariant();
        var label = mend.CDMendLbl ?? mend.CdmendTxt;
        var minRaw = (mend.MinValue ?? string.Empty).Trim();
        var maxRaw = (mend.MaxValue ?? string.Empty).Trim();

        var isNumeric = dataType is "number" or "numeric" or "int" or "integer" or "decimal" or "float";
        if (isNumeric)
        {
            if (!decimal.TryParse(value, NumberStyles.Any, CultureInfo.InvariantCulture, out var numericValue)
                && !decimal.TryParse(value, NumberStyles.Any, CultureInfo.CurrentCulture, out numericValue))
            {
                response.Errors.Add(new Error
                {
                    Code = "400",
                    Message = $"قيمة الحقل ({label}) غير رقمية."
                });
                return;
            }

            if (decimal.TryParse(minRaw, NumberStyles.Any, CultureInfo.InvariantCulture, out var minNumeric)
                && numericValue < minNumeric)
            {
                response.Errors.Add(new Error
                {
                    Code = "400",
                    Message = $"قيمة الحقل ({label}) يجب ألا تقل عن {minNumeric}."
                });
            }

            if (decimal.TryParse(maxRaw, NumberStyles.Any, CultureInfo.InvariantCulture, out var maxNumeric)
                && numericValue > maxNumeric)
            {
                response.Errors.Add(new Error
                {
                    Code = "400",
                    Message = $"قيمة الحقل ({label}) يجب ألا تزيد عن {maxNumeric}."
                });
            }

            return;
        }

        var minLengthParsed = int.TryParse(minRaw, NumberStyles.Any, CultureInfo.InvariantCulture, out var minLength);
        var maxLengthParsed = int.TryParse(maxRaw, NumberStyles.Any, CultureInfo.InvariantCulture, out var maxLength);

        if (minLengthParsed && value.Length < minLength)
        {
            response.Errors.Add(new Error
            {
                Code = "400",
                Message = $"عدد حروف الحقل ({label}) يجب ألا يقل عن {minLength}."
            });
        }

        if (maxLengthParsed && value.Length > maxLength)
        {
            response.Errors.Add(new Error
            {
                Code = "400",
                Message = $"عدد حروف الحقل ({label}) يجب ألا يزيد عن {maxLength}."
            });
        }
    }

    private async Task<List<decimal>> GetActiveUserUnitIdsAsync(string userId)
    {
        var today = DateTime.Today;
        return await _gpaContext.UserPositions
            .AsNoTracking()
            .Where(x =>
                x.UserId.ToUpper() == userId.ToUpper()
                && (x.IsActive == null || x.IsActive == true)
                && (!x.StartDate.HasValue || x.StartDate.Value.Date <= today)
                && (!x.EndDate.HasValue || x.EndDate.Value.Date >= today))
            .Select(x => x.UnitId)
            .Distinct()
            .ToListAsync();
    }

    private async Task<bool> IsPublicationAdminAsync(string userId)
    {
        var userUnitIds = await GetActiveUserUnitIdsAsync(userId);
        if (!userUnitIds.Any())
        {
            return false;
        }

        return await _connectContext.PublicationAdminDepartments
            .AsNoTracking()
            .AnyAsync(x => x.IsActive && userUnitIds.Contains(x.DepartmentUnitId));
    }

    private async Task<(int publicationYear, int publicationSerial, string publicationNumber)> AllocatePublicationNumberAsync(DateTime nowUtc)
    {
        var publicationYear = nowUtc.Year;
        var sql = @"
SET NOCOUNT ON;
IF EXISTS (SELECT 1 FROM [dbo].[PUB_SerialCounter] WITH (UPDLOCK, HOLDLOCK) WHERE [CounterYear] = @year)
BEGIN
    UPDATE [dbo].[PUB_SerialCounter]
       SET [LastSerial] = [LastSerial] + 1
     OUTPUT INSERTED.[LastSerial]
     WHERE [CounterYear] = @year;
END
ELSE
BEGIN
    INSERT INTO [dbo].[PUB_SerialCounter]([CounterYear], [LastSerial]) VALUES (@year, 1);
    SELECT CAST(1 AS INT) AS [LastSerial];
END";

        var connection = _connectContext.Database.GetDbConnection();
        var openedHere = false;
        if (connection.State != ConnectionState.Open)
        {
            await connection.OpenAsync();
            openedHere = true;
        }

        try
        {
            await using var command = connection.CreateCommand();
            command.CommandText = sql;
            if (_connectContext.Database.CurrentTransaction != null)
            {
                command.Transaction = _connectContext.Database.CurrentTransaction.GetDbTransaction();
            }

            var parameter = command.CreateParameter();
            parameter.ParameterName = "@year";
            parameter.Value = publicationYear;
            command.Parameters.Add(parameter);

            var rawSerial = await command.ExecuteScalarAsync();
            var publicationSerial = rawSerial == null || rawSerial == DBNull.Value
                ? 1
                : Convert.ToInt32(rawSerial, CultureInfo.InvariantCulture);

            return (publicationYear, publicationSerial, $"{publicationYear}/{publicationSerial}");
        }
        finally
        {
            if (openedHere)
            {
                await connection.CloseAsync();
            }
        }
    }

    private async Task RecordHistoryAsync(
        int messageId,
        string actionCode,
        string? fromStatus,
        string toStatus,
        string? comment,
        string actionBy,
        DateTime actionAtUtc,
        int? replyId)
    {
        await _connectContext.PublicationRequestHistories.AddAsync(new PublicationRequestHistory
        {
            MessageId = messageId,
            ActionCode = actionCode,
            FromStatus = NormalizeWorkflowStatus(fromStatus),
            ToStatus = NormalizeWorkflowStatus(toStatus),
            Comment = string.IsNullOrWhiteSpace(comment) ? null : comment.Trim(),
            ActionBy = actionBy,
            ActionAtUtc = actionAtUtc,
            ReplyId = replyId
        });
    }

    private static string ToMessageStatusToken(string? workflowStatus)
    {
        return NormalizeWorkflowStatus(workflowStatus);
    }

    private static MessageStatus ToMessageStatus(string? workflowStatus)
    {
        return ToMessageStatusToken(workflowStatus) switch
        {
            PublicationWorkflowStatuses.Draft => MessageStatus.New,
            PublicationWorkflowStatuses.Submitted => MessageStatus.InProgress,
            PublicationWorkflowStatuses.UnderReview => MessageStatus.InProgress,
            PublicationWorkflowStatuses.ReturnedForEdit => MessageStatus.Replied,
            PublicationWorkflowStatuses.Rejected => MessageStatus.Rejected,
            PublicationWorkflowStatuses.Approved => MessageStatus.Printed,
            _ => MessageStatus.InProgress
        };
    }

    private static bool CanEditStatus(string? workflowStatus)
    {
        var normalized = NormalizeWorkflowStatus(workflowStatus);
        return normalized == PublicationWorkflowStatuses.Draft
               || normalized == PublicationWorkflowStatuses.ReturnedForEdit;
    }

    private static bool CanTransition(string? currentStatus, string? targetStatus)
    {
        var current = NormalizeWorkflowStatus(currentStatus);
        var target = NormalizeWorkflowStatus(targetStatus);

        if (string.Equals(current, target, StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        return current switch
        {
            PublicationWorkflowStatuses.Draft => target == PublicationWorkflowStatuses.Submitted,
            PublicationWorkflowStatuses.Submitted => target == PublicationWorkflowStatuses.UnderReview
                                                     || target == PublicationWorkflowStatuses.ReturnedForEdit
                                                     || target == PublicationWorkflowStatuses.Rejected
                                                     || target == PublicationWorkflowStatuses.Approved,
            PublicationWorkflowStatuses.UnderReview => target == PublicationWorkflowStatuses.ReturnedForEdit
                                                       || target == PublicationWorkflowStatuses.Rejected
                                                       || target == PublicationWorkflowStatuses.Approved,
            PublicationWorkflowStatuses.ReturnedForEdit => target == PublicationWorkflowStatuses.Submitted
                                                           || target == PublicationWorkflowStatuses.Rejected,
            PublicationWorkflowStatuses.Rejected => false,
            PublicationWorkflowStatuses.Approved => target == PublicationWorkflowStatuses.Approved,
            _ => false
        };
    }

    private static string NormalizeWorkflowStatus(string? workflowStatus)
    {
        var status = (workflowStatus ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(status))
        {
            return PublicationWorkflowStatuses.Draft;
        }

        if (string.Equals(status, PublicationWorkflowStatuses.LegacyReturned, StringComparison.OrdinalIgnoreCase)
            || string.Equals(status, PublicationWorkflowStatuses.ReturnedForEdit, StringComparison.OrdinalIgnoreCase))
        {
            return PublicationWorkflowStatuses.ReturnedForEdit;
        }

        if (string.Equals(status, PublicationWorkflowStatuses.Draft, StringComparison.OrdinalIgnoreCase))
        {
            return PublicationWorkflowStatuses.Draft;
        }

        if (string.Equals(status, PublicationWorkflowStatuses.Submitted, StringComparison.OrdinalIgnoreCase))
        {
            return PublicationWorkflowStatuses.Submitted;
        }

        if (string.Equals(status, PublicationWorkflowStatuses.UnderReview, StringComparison.OrdinalIgnoreCase))
        {
            return PublicationWorkflowStatuses.UnderReview;
        }

        if (string.Equals(status, PublicationWorkflowStatuses.Rejected, StringComparison.OrdinalIgnoreCase))
        {
            return PublicationWorkflowStatuses.Rejected;
        }

        if (string.Equals(status, PublicationWorkflowStatuses.Approved, StringComparison.OrdinalIgnoreCase))
        {
            return PublicationWorkflowStatuses.Approved;
        }

        return status;
    }

    private static string BuildInternalReference(int messageId)
    {
        var now = DateTime.UtcNow;
        return $"PUBL-{now:yyyyMMdd}-{messageId}";
    }

    private static class PublicationHistoryActions
    {
        public const string CreateDraft = "CreateDraft";
        public const string EditDraft = "EditDraft";
        public const string EditReturnedRequest = "EditReturnedRequest";
        public const string Submit = "Submit";
        public const string StartReview = "StartReview";
        public const string ReturnForEdit = "ReturnForEdit";
        public const string Reject = "Reject";
        public const string Approve = "Approve";
    }
}
