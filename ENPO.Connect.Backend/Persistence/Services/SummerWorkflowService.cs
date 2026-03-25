using System.Data;
using System.Text;
using System.Text.Json;
using ENPO.Dto.HubSync;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.Options;
using Models.Attachment;
using Models.Correspondance;
using Models.DTO.Common;
using Models.DTO.Correspondance.Enums;
using Models.DTO.Correspondance.Summer;
using Persistence.Data;
using Persistence.HelperServices;
using Persistence.Services.Notifications;
using Persistence.Services.Summer;
using SignalR.Notification;

namespace Persistence.Services
{
    public class SummerWorkflowService
    {
        private readonly ConnectContext _connectContext;
        private readonly Attach_HeldContext _attachHeldContext;
        private readonly GPAContext _gPAContext;
        private readonly helperService _helperService;
        private readonly SignalRConnectionManager _signalRConnectionManager;
        private readonly IConnectNotificationService _notificationService;
        private readonly ApplicationConfig _applicationConfig;

        private const int CapacityLockTimeoutMs = 15000;
        private const string SummerDynamicApplicationId = "SUM2026DYN";
        private const string SummerDestinationCatalogMend = "SUM2026_DestinationCatalog";
        private const string TransferReviewRequiredCode = "TRANSFER_REVIEW_REQUIRED";
        private const string TransferReviewResolvedCode = "TRANSFER_REVIEW_RESOLVED";
        private static readonly string[] WaveCodeFieldKinds = { "SummerCamp", "SUM2026_WaveCode", "WaveCode" };
        private static readonly string[] WaveLabelFieldKinds = { "SummerCampLabel", "SUM2026_WaveLabel", "WaveLabel" };
        private static readonly string[] FamilyCountFieldKinds = { "FamilyCount", "SUM2026_FamilyCount" };
        private static readonly string[] ExtraCountFieldKinds = { "Over_Count", "SUM2026_ExtraCount", "ExtraCount" };
        private static readonly string[] DestinationIdFieldKinds = { "SummerDestinationId", "SUM2026_DestinationId" };
        private static readonly string[] DestinationNameFieldKinds = { "SummerDestinationName", "SUM2026_DestinationName" };
        private static readonly string[] SummerNotificationGroups = { "CONNECT", "CONNECT - TEST" };
        private static readonly HashSet<string> AllowedAttachmentExtensions = new(StringComparer.OrdinalIgnoreCase)
        {
            ".pdf", ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"
        };

        public SummerWorkflowService(
            ConnectContext connectContext,
            Attach_HeldContext attachHeldContext,
            GPAContext gpaContext,
            helperService helperService,
            SignalRConnectionManager signalRConnectionManager,
            IConnectNotificationService notificationService,
            IOptions<ApplicationConfig> options)
        {
            _connectContext = connectContext;
            _attachHeldContext = attachHeldContext;
            _gPAContext = gpaContext;
            _helperService = helperService;
            _signalRConnectionManager = signalRConnectionManager;
            _notificationService = notificationService;
            _applicationConfig = options?.Value ?? new ApplicationConfig();
        }

        public async Task<CommonResponse<IEnumerable<SummerRequestSummaryDto>>> GetMyRequestsAsync(string userId, int seasonYear)
        {
            var response = new CommonResponse<IEnumerable<SummerRequestSummaryDto>>();
            try
            {
                if (string.IsNullOrWhiteSpace(userId))
                {
                    response.Errors.Add(new Error { Code = "400", Message = "معرف المستخدم مطلوب." });
                    return response;
                }

                if (seasonYear <= 0)
                {
                    seasonYear = DateTime.UtcNow.Year;
                }

                var summerRules = await GetSummerRulesAsync(seasonYear);
                var summerCategoryIds = summerRules.Keys.ToList();
                if (!summerCategoryIds.Any())
                {
                    response.Data = Array.Empty<SummerRequestSummaryDto>();
                    return response;
                }

                var messages = await _connectContext.Messages
                    .AsNoTracking()
                    .Where(m => summerCategoryIds.Contains(m.CategoryCd))
                    .OrderByDescending(m => m.CreatedDate)
                    .ToListAsync();

                if (!messages.Any())
                {
                    response.Data = Array.Empty<SummerRequestSummaryDto>();
                    return response;
                }

                var messageIds = messages.Select(m => m.MessageId).ToList();
                var fields = await _connectContext.TkmendFields
                    .AsNoTracking()
                    .Where(f => messageIds.Contains(f.FildRelted))
                    .ToListAsync();

                var categories = await _connectContext.Cdcategories
                    .AsNoTracking()
                    .Where(c => summerCategoryIds.Contains(c.CatId))
                    .ToDictionaryAsync(c => c.CatId, c => c.CatName);

                var summaries = new List<SummerRequestSummaryDto>();
                foreach (var message in messages)
                {
                    var messageFields = fields.Where(f => f.FildRelted == message.MessageId).ToList();
                    var employeeId = GetFirstFieldValue(messageFields, "Emp_Id", "EmployeeFileNumber", "FileNumber", "EmployeeId");
                    var createdByUser = string.Equals(message.CreatedBy, userId, StringComparison.OrdinalIgnoreCase);
                    var forEmployee = string.Equals(employeeId, userId, StringComparison.OrdinalIgnoreCase);
                    if (!createdByUser && !forEmployee)
                    {
                        continue;
                    }

                    var seasonFromField = ParseInt(GetFieldValue(messageFields, "SummerSeasonYear"), 0);
                    if (seasonFromField > 0 && seasonFromField != seasonYear)
                    {
                        continue;
                    }

                    var workflowStateCode = GetFieldValue(messageFields, "Summer_WorkflowState") ?? string.Empty;
                    var workflowStateLabel = ResolveWorkflowStateLabel(workflowStateCode);
                    var needsTransferReview = string.Equals(
                        workflowStateCode,
                        TransferReviewRequiredCode,
                        StringComparison.OrdinalIgnoreCase);

                    summaries.Add(new SummerRequestSummaryDto
                    {
                        MessageId = message.MessageId,
                        RequestRef = message.RequestRef ?? string.Empty,
                        CategoryId = message.CategoryCd,
                        CategoryName = categories.TryGetValue(message.CategoryCd, out var categoryName) ? categoryName : string.Empty,
                        WaveCode = GetFieldValue(messageFields, "SummerCamp") ?? string.Empty,
                        EmployeeId = employeeId,
                        EmployeeName = GetFirstFieldValue(messageFields, "Emp_Name", "EmployeeName", "Name", "ArabicName", "DisplayName"),
                        EmployeeNationalId = GetFirstFieldValue(messageFields, "NationalId", "NationalID", "NATIONAL_ID", "national_id", "NID", "IDNumber"),
                        EmployeePhone = GetFirstFieldValue(messageFields, "PhoneNumber", "MobileNumber", "PhoneNo", "Phone_No", "MobilePhone", "phone"),
                        EmployeeExtraPhone = GetFirstFieldValue(messageFields, "ExtraPhoneNumber", "SecondaryPhone", "AlternatePhone"),
                        Status = message.Status.ToString(),
                        StatusLabel = ResolveSummaryStatusLabel(message.Status, messageFields, needsTransferReview, workflowStateLabel),
                        WorkflowStateCode = workflowStateCode,
                        WorkflowStateLabel = workflowStateLabel,
                        NeedsTransferReview = needsTransferReview,
                        CreatedAt = message.CreatedDate,
                        PaymentDueAtUtc = ParseDate(GetFieldValue(messageFields, "Summer_PaymentDueAtUtc")),
                        PaidAtUtc = ParseDate(GetFieldValue(messageFields, "Summer_PaidAtUtc")),
                        TransferUsed = ParseInt(GetFieldValue(messageFields, "Summer_TransferCount"), 0) > 0
                    });
                }

                response.Data = summaries;
            }
            catch (Exception ex)
            {
                response.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });
            }

            return response;
        }

        public async Task<CommonResponse<IEnumerable<SummerRequestSummaryDto>>> GetAdminRequestsAsync(SummerAdminRequestsQuery query, string userId)
        {
            var response = new CommonResponse<IEnumerable<SummerRequestSummaryDto>>();
            query ??= new SummerAdminRequestsQuery();
            try
            {
                var normalizedUserId = (userId ?? string.Empty).Trim();
                if (string.IsNullOrWhiteSpace(normalizedUserId))
                {
                    response.Errors.Add(new Error { Code = "400", Message = "معرف المستخدم مطلوب." });
                    return response;
                }

                var seasonYear = query.SeasonYear <= 0 ? DateTime.UtcNow.Year : query.SeasonYear;
                var pageNumber = query.PageNumber <= 0 ? 1 : query.PageNumber;
                var pageSize = query.PageSize <= 0 ? 50 : query.PageSize;

                var userUnitIds = await GetActiveUserUnitIdsAsync(normalizedUserId);
                if (!userUnitIds.Any())
                {
                    response.Data = Array.Empty<SummerRequestSummaryDto>();
                    response.TotalCount = 0;
                    response.PageNumber = pageNumber;
                    response.PageSize = pageSize;
                    return response;
                }

                var summerRules = await GetSummerRulesAsync(seasonYear);
                var summerCategoryIds = summerRules.Keys.ToList();
                if (!summerCategoryIds.Any())
                {
                    response.Data = Array.Empty<SummerRequestSummaryDto>();
                    response.TotalCount = 0;
                    response.PageNumber = pageNumber;
                    response.PageSize = pageSize;
                    return response;
                }
                var messages = await _connectContext.Messages
                    .AsNoTracking()
                    .Where(m => summerCategoryIds.Contains(m.CategoryCd)
                        && (userUnitIds.Contains(m.CurrentResponsibleSectorId ?? string.Empty)
                            || userUnitIds.Contains(m.AssignedSectorId ?? string.Empty)))
                    .OrderByDescending(m => m.CreatedDate)
                    .ToListAsync();

                if (!messages.Any())
                {
                    response.Data = Array.Empty<SummerRequestSummaryDto>();
                    response.TotalCount = 0;
                    response.PageNumber = pageNumber;
                    response.PageSize = pageSize;
                    return response;
                }

                var messageIds = messages.Select(m => m.MessageId).ToList();
                var fields = await _connectContext.TkmendFields
                    .AsNoTracking()
                    .Where(f => messageIds.Contains(f.FildRelted))
                    .ToListAsync();

                var categories = await _connectContext.Cdcategories
                    .AsNoTracking()
                    .Where(c => summerCategoryIds.Contains(c.CatId))
                    .ToDictionaryAsync(c => c.CatId, c => c.CatName);

                var summaries = new List<SummerRequestSummaryDto>();
                foreach (var message in messages)
                {
                    var messageFields = fields.Where(f => f.FildRelted == message.MessageId).ToList();
                    var seasonFromField = ParseInt(GetFieldValue(messageFields, "SummerSeasonYear"), 0);
                    if (seasonFromField > 0 && seasonFromField != seasonYear)
                    {
                        continue;
                    }

                    var workflowStateCode = GetFieldValue(messageFields, "Summer_WorkflowState") ?? string.Empty;
                    var workflowStateLabel = ResolveWorkflowStateLabel(workflowStateCode);
                    var needsTransferReview = string.Equals(
                        workflowStateCode,
                        TransferReviewRequiredCode,
                        StringComparison.OrdinalIgnoreCase);

                    summaries.Add(new SummerRequestSummaryDto
                    {
                        MessageId = message.MessageId,
                        RequestRef = message.RequestRef ?? string.Empty,
                        CategoryId = message.CategoryCd,
                        CategoryName = categories.TryGetValue(message.CategoryCd, out var categoryName) ? categoryName : string.Empty,
                        WaveCode = GetFieldValue(messageFields, "SummerCamp") ?? string.Empty,
                        EmployeeId = GetFirstFieldValue(messageFields, "Emp_Id", "EmployeeFileNumber", "FileNumber", "EmployeeId"),
                        EmployeeName = GetFirstFieldValue(messageFields, "Emp_Name", "EmployeeName", "Name", "ArabicName", "DisplayName"),
                        EmployeeNationalId = GetFirstFieldValue(messageFields, "NationalId", "NationalID", "NATIONAL_ID", "national_id", "NID", "IDNumber"),
                        EmployeePhone = GetFirstFieldValue(messageFields, "PhoneNumber", "MobileNumber", "PhoneNo", "Phone_No", "MobilePhone", "phone"),
                        EmployeeExtraPhone = GetFirstFieldValue(messageFields, "ExtraPhoneNumber", "SecondaryPhone", "AlternatePhone"),
                        Status = message.Status.ToString(),
                        StatusLabel = ResolveSummaryStatusLabel(message.Status, messageFields, needsTransferReview, workflowStateLabel),
                        WorkflowStateCode = workflowStateCode,
                        WorkflowStateLabel = workflowStateLabel,
                        NeedsTransferReview = needsTransferReview,
                        CreatedAt = message.CreatedDate,
                        PaymentDueAtUtc = ParseDate(GetFieldValue(messageFields, "Summer_PaymentDueAtUtc")),
                        PaidAtUtc = ParseDate(GetFieldValue(messageFields, "Summer_PaidAtUtc")),
                        TransferUsed = ParseInt(GetFieldValue(messageFields, "Summer_TransferCount"), 0) > 0
                    });
                }

                var normalizedWaveCode = (query.WaveCode ?? string.Empty).Trim();
                var normalizedEmployeeId = (query.EmployeeId ?? string.Empty).Trim();
                var normalizedStatus = NormalizeSearchToken(query.Status);
                var normalizedPaymentState = NormalizeSearchToken(query.PaymentState);
                var normalizedSearch = NormalizeSearchToken(query.Search);
                var nowUtc = DateTime.UtcNow;

                var filtered = summaries.Where(item =>
                {
                    if (query.CategoryId.HasValue && query.CategoryId.Value > 0 && item.CategoryId != query.CategoryId.Value)
                    {
                        return false;
                    }

                    if (!string.IsNullOrWhiteSpace(normalizedWaveCode)
                        && !string.Equals(item.WaveCode, normalizedWaveCode, StringComparison.OrdinalIgnoreCase))
                    {
                        return false;
                    }

                    if (!string.IsNullOrWhiteSpace(normalizedEmployeeId)
                        && !string.Equals(item.EmployeeId, normalizedEmployeeId, StringComparison.OrdinalIgnoreCase))
                    {
                        return false;
                    }

                    if (!string.IsNullOrWhiteSpace(normalizedStatus))
                    {
                        if (byte.TryParse(query.Status, out var statusByte))
                        {
                            if ((byte)ResolveMessageStatus(item.Status) != statusByte)
                            {
                                return false;
                            }
                        }
                        else
                        {
                            var statusToken = NormalizeSearchToken(item.Status);
                            var statusLabelToken = NormalizeSearchToken(item.StatusLabel);
                            var workflowStateToken = NormalizeSearchToken(item.WorkflowStateCode);
                            var workflowStateLabelToken = NormalizeSearchToken(item.WorkflowStateLabel);
                            if (!statusToken.Contains(normalizedStatus)
                                && !statusLabelToken.Contains(normalizedStatus)
                                && !workflowStateToken.Contains(normalizedStatus)
                                && !workflowStateLabelToken.Contains(normalizedStatus))
                            {
                                return false;
                            }
                        }
                    }

                    if (!string.IsNullOrWhiteSpace(normalizedPaymentState))
                    {
                        var isPaid = item.PaidAtUtc.HasValue;
                        var isOverdueUnpaid = !isPaid
                            && item.PaymentDueAtUtc.HasValue
                            && item.PaymentDueAtUtc.Value < nowUtc
                            && ResolveMessageStatus(item.Status) != MessageStatus.Rejected;

                        var isPaidFilter = normalizedPaymentState is "paid" or "مسدد";
                        var isUnpaidFilter = normalizedPaymentState is "unpaid" or "غيرمسدد";
                        var isOverdueUnpaidFilter = normalizedPaymentState is
                            "overdue"
                            or "overdueunpaid"
                            or "متاخرغيرمسدد"
                            or "متأخرغيرمسدد";

                        if (isPaidFilter && !isPaid)
                        {
                            return false;
                        }

                        if (isUnpaidFilter && isPaid)
                        {
                            return false;
                        }

                        if (isOverdueUnpaidFilter && !isOverdueUnpaid)
                        {
                            return false;
                        }
                    }

                    if (!string.IsNullOrWhiteSpace(normalizedSearch))
                    {
                        var haystack = NormalizeSearchToken(
                            $"{item.RequestRef} {item.EmployeeName} {item.EmployeeId} {item.EmployeeNationalId} {item.EmployeePhone} {item.CategoryName} {item.WaveCode}");
                        if (!haystack.Contains(normalizedSearch))
                        {
                            return false;
                        }
                    }

                    return true;
                }).ToList();

                response.TotalCount = filtered.Count;
                response.PageNumber = pageNumber;
                response.PageSize = pageSize;
                response.Data = filtered
                    .Skip((pageNumber - 1) * pageSize)
                    .Take(pageSize)
                    .ToList();
            }
            catch (Exception ex)
            {
                response.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });
            }

            return response;
        }

        private async Task<List<string>> GetActiveUserUnitIdsAsync(string userId)
        {
            var normalizedUserId = (userId ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(normalizedUserId))
            {
                return new List<string>();
            }

            var now = DateTime.Now.Date;
            var unitIds = await _gPAContext.UserPositions
                .AsNoTracking()
                .Where(position =>
                    position.UserId == normalizedUserId
                    && position.IsActive != false
                    && (!position.StartDate.HasValue || position.StartDate.Value <= now)
                    && (!position.EndDate.HasValue || position.EndDate.Value >= now))
                .Select(position => position.UnitId)
                .Distinct()
                .ToListAsync();

            return unitIds
                .Select(unitId => unitId.ToString())
                .Select(unitId => (unitId ?? string.Empty).Trim())
                .Where(unitId => unitId.Length > 0)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
        }

        public async Task<CommonResponse<SummerAdminDashboardDto>> GetAdminDashboardAsync(string userId, int seasonYear, int? categoryId = null, string? waveCode = null)
        {
            var response = new CommonResponse<SummerAdminDashboardDto>();
            try
            {
                var normalizedWaveCode = (waveCode ?? string.Empty).Trim();

                var listResponse = await GetAdminRequestsAsync(new SummerAdminRequestsQuery
                {
                    SeasonYear = seasonYear,
                    CategoryId = categoryId,
                    WaveCode = normalizedWaveCode,
                    PageNumber = 1,
                    PageSize = int.MaxValue
                }, userId);

                if (!listResponse.IsSuccess)
                {
                    foreach (var error in listResponse.Errors)
                    {
                        response.Errors.Add(error);
                    }
                    return response;
                }

                var requests = listResponse.Data?.ToList() ?? new List<SummerRequestSummaryDto>();
                var nowUtc = DateTime.UtcNow;
                var scopeCategoryName = requests
                    .Where(r => !string.IsNullOrWhiteSpace(r.CategoryName))
                    .Select(r => r.CategoryName)
                    .FirstOrDefault();

                var scopeLabel = "رؤية عامة";
                if (categoryId.HasValue && categoryId.Value > 0)
                {
                    scopeLabel = string.IsNullOrWhiteSpace(scopeCategoryName)
                        ? $"مصيف {categoryId.Value}"
                        : scopeCategoryName;

                    if (!string.IsNullOrWhiteSpace(normalizedWaveCode))
                    {
                        scopeLabel += $" - الفوج {normalizedWaveCode}";
                    }
                }

                var dashboard = new SummerAdminDashboardDto
                {
                    ScopeCategoryId = categoryId.HasValue && categoryId.Value > 0 ? categoryId : null,
                    ScopeWaveCode = normalizedWaveCode,
                    ScopeLabel = scopeLabel,
                    TotalRequests = requests.Count,
                    NewCount = requests.Count(r => ResolveMessageStatus(r.Status) == MessageStatus.New),
                    InProgressCount = requests.Count(r => ResolveMessageStatus(r.Status) == MessageStatus.InProgress),
                    RepliedCount = requests.Count(r => ResolveMessageStatus(r.Status) == MessageStatus.Replied),
                    RejectedCount = requests.Count(r => ResolveMessageStatus(r.Status) == MessageStatus.Rejected),
                    PaidCount = requests.Count(r => r.PaidAtUtc.HasValue),
                    UnpaidCount = requests.Count(r => !r.PaidAtUtc.HasValue),
                    OverdueUnpaidCount = requests.Count(r =>
                        !r.PaidAtUtc.HasValue
                        && r.PaymentDueAtUtc.HasValue
                        && r.PaymentDueAtUtc.Value < nowUtc
                        && ResolveMessageStatus(r.Status) != MessageStatus.Rejected),
                    ByDestination = requests
                        .GroupBy(r => new
                        {
                            r.CategoryId,
                            CategoryName = string.IsNullOrWhiteSpace(r.CategoryName) ? $"مصيف {r.CategoryId}" : r.CategoryName
                        })
                        .Select(g => new SummerDashboardBucketDto
                        {
                            Id = g.Key.CategoryId,
                            Key = g.Key.CategoryName,
                            Count = g.Count()
                        })
                        .OrderByDescending(g => g.Count)
                        .ToList(),
                    ByWave = requests
                        .GroupBy(r => string.IsNullOrWhiteSpace(r.WaveCode) ? "-" : r.WaveCode)
                        .Select(g => new SummerDashboardBucketDto { Key = g.Key, Count = g.Count() })
                        .OrderByDescending(g => g.Count)
                        .ToList(),
                    ByStatus = requests
                        .GroupBy(r => ResolveDashboardStatusLabel(r))
                        .Select(g => new SummerDashboardStatusBucketDto
                        {
                            StatusCode = ResolveDashboardStatusCode(g.Key),
                            StatusLabel = g.Key,
                            Count = g.Count()
                        })
                        .OrderByDescending(g => g.Count)
                        .ToList()
                };

                response.Data = dashboard;
            }
            catch (Exception ex)
            {
                response.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });
            }

            return response;
        }

        public async Task<CommonResponse<SummerRequestSummaryDto>> ExecuteAdminActionAsync(SummerAdminActionRequest request, string userId, string ip)
        {
            var response = new CommonResponse<SummerRequestSummaryDto>();
            request ??= new SummerAdminActionRequest();
            try
            {
                if (request.MessageId <= 0)
                {
                    response.Errors.Add(new Error { Code = "400", Message = "رقم الطلب مطلوب." });
                    return response;
                }

                var actionCode = NormalizeActionCode(request.ActionCode);
                if (string.IsNullOrWhiteSpace(actionCode))
                {
                    response.Errors.Add(new Error { Code = "400", Message = "نوع الإجراء الإداري مطلوب." });
                    return response;
                }

                if (!_helperService.ValidateFileSizes(request.files, response))
                {
                    return response;
                }

                if (!ValidateAllowedAttachmentExtensions(request.files, response))
                {
                    return response;
                }

                var comment = (request.Comment ?? string.Empty).Trim();
                if (actionCode == "APPROVE_TRANSFER")
                {
                    if (!request.ToCategoryId.HasValue || string.IsNullOrWhiteSpace(request.ToWaveCode))
                    {
                        response.Errors.Add(new Error { Code = "400", Message = "بيانات التحويل غير مكتملة (المصيف والفوج المستهدفان مطلوبان)." });
                        return response;
                    }

                    var transferResponse = await TransferAsync(new SummerTransferRequest
                    {
                        MessageId = request.MessageId,
                        ToCategoryId = request.ToCategoryId.Value,
                        ToWaveCode = request.ToWaveCode.Trim(),
                        NewFamilyCount = request.NewFamilyCount,
                        NewExtraCount = request.NewExtraCount,
                        Notes = request.Comment,
                        files = request.files
                    }, userId, ip);

                    if (!transferResponse.IsSuccess)
                    {
                        foreach (var error in transferResponse.Errors)
                        {
                            response.Errors.Add(error);
                        }
                        return response;
                    }

                    response.Data = transferResponse.Data;
                    if (transferResponse.Data != null)
                    {
                        await NotifyEmployeeOnAdminActionAsync(transferResponse.Data, actionCode, comment);
                    }
                    return response;
                }

                var summerRules = await GetSummerRulesAsync();
                var message = await _connectContext.Messages.FirstOrDefaultAsync(m => m.MessageId == request.MessageId);
                if (message == null || !summerRules.ContainsKey(message.CategoryCd))
                {
                    response.Errors.Add(new Error { Code = "404", Message = "طلب المصيف غير موجود." });
                    return response;
                }

                var fields = await _connectContext.TkmendFields.Where(f => f.FildRelted == message.MessageId).ToListAsync();

                await using var connectTx = await _connectContext.Database.BeginTransactionAsync(IsolationLevel.Serializable);
                await using var attachTx = await _attachHeldContext.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted);
                try
                {
                    var replyMessage = string.Empty;
                    if (actionCode == "FINAL_APPROVE")
                    {
                        if (message.Status == MessageStatus.Rejected && !request.Force)
                        {
                            response.Errors.Add(new Error { Code = "400", Message = "الطلب مرفوض بالفعل. استخدم خيار القوة إذا لزم." });
                            await attachTx.RollbackAsync();
                            await connectTx.RollbackAsync();
                            return response;
                        }

                        message.Status = MessageStatus.Replied;
                        UpsertField(fields, message.MessageId, "Summer_AdminLastAction", "FINAL_APPROVE");
                        UpsertField(fields, message.MessageId, "Summer_AdminActionAtUtc", DateTime.UtcNow.ToString("o"));
                        if (!string.IsNullOrWhiteSpace(comment))
                        {
                            UpsertField(fields, message.MessageId, "Summer_AdminComment", comment);
                        }
                        if (IsTransferReviewRequired(fields))
                        {
                            UpsertField(fields, message.MessageId, "Summer_WorkflowState", TransferReviewResolvedCode);
                            UpsertField(fields, message.MessageId, "Summer_WorkflowStateLabel", ResolveWorkflowStateLabel(TransferReviewResolvedCode));
                            UpsertField(fields, message.MessageId, "Summer_WorkflowStateAtUtc", DateTime.UtcNow.ToString("o"));
                        }

                        replyMessage = string.IsNullOrWhiteSpace(comment)
                            ? "تم اعتماد الطلب نهائياً من إدارة المصايف."
                            : $"تم اعتماد الطلب نهائياً من إدارة المصايف. تعليق الإدارة: {comment}";
                    }
                    else if (actionCode == "MANUAL_CANCEL")
                    {
                        message.Status = MessageStatus.Rejected;
                        UpsertField(fields, message.MessageId, "Summer_AdminLastAction", "MANUAL_CANCEL");
                        UpsertField(fields, message.MessageId, "Summer_AdminActionAtUtc", DateTime.UtcNow.ToString("o"));
                        UpsertField(fields, message.MessageId, "Summer_CancelReason", string.IsNullOrWhiteSpace(comment) ? "إلغاء يدوي من إدارة المصايف." : comment);
                        UpsertField(fields, message.MessageId, "Summer_CancelledAtUtc", DateTime.UtcNow.ToString("o"));
                        UpsertField(fields, message.MessageId, "Summer_PaymentStatus", "CANCELLED_ADMIN");
                        if (IsTransferReviewRequired(fields))
                        {
                            UpsertField(fields, message.MessageId, "Summer_WorkflowState", TransferReviewResolvedCode);
                            UpsertField(fields, message.MessageId, "Summer_WorkflowStateLabel", ResolveWorkflowStateLabel(TransferReviewResolvedCode));
                            UpsertField(fields, message.MessageId, "Summer_WorkflowStateAtUtc", DateTime.UtcNow.ToString("o"));
                        }

                        replyMessage = string.IsNullOrWhiteSpace(comment)
                            ? "تم إلغاء الطلب يدويًا من إدارة المصايف."
                            : $"تم إلغاء الطلب يدويًا من إدارة المصايف. السبب: {comment}";
                    }
                    else if (actionCode == "COMMENT")
                    {
                        UpsertField(fields, message.MessageId, "Summer_AdminLastAction", "COMMENT");
                        UpsertField(fields, message.MessageId, "Summer_AdminActionAtUtc", DateTime.UtcNow.ToString("o"));
                        replyMessage = string.IsNullOrWhiteSpace(comment)
                            ? "تم تسجيل تعليق إداري على الطلب."
                            : comment;
                    }
                    else
                    {
                        response.Errors.Add(new Error { Code = "400", Message = "نوع الإجراء غير مدعوم." });
                        await attachTx.RollbackAsync();
                        await connectTx.RollbackAsync();
                        return response;
                    }

                    await AddReplyWithAttachmentsAsync(message.MessageId, replyMessage, userId, ip, request.files);

                    await _attachHeldContext.SaveChangesAsync();
                    await _connectContext.SaveChangesAsync();
                    await attachTx.CommitAsync();
                    await connectTx.CommitAsync();
                }
                catch
                {
                    await attachTx.RollbackAsync();
                    await connectTx.RollbackAsync();
                    throw;
                }

                response.Data = await BuildSummaryAsync(request.MessageId);
                if (response.Data != null)
                {
                    await NotifyEmployeeOnAdminActionAsync(response.Data, actionCode, comment, includeSignalR: false);
                }

                var employeeId = response.Data?.EmployeeId;
                if (!string.IsNullOrWhiteSpace(employeeId))
                {
                    await _signalRConnectionManager.SendNotificationToUser(employeeId, new NotificationDto
                    {
                        Notification = "تم تنفيذ إجراء إداري على طلب المصيف الخاص بك.",
                        type = NotificationType.info,
                        Title = "إدارة طلبات المصايف",
                        time = DateTime.Now,
                        sender = "Connect",
                        Category = NotificationCategory.Business
                    });
                }

                if (response.Data != null)
                {
                    await NotifySummerActionGroupAsync(
                        response.Data.MessageId,
                        $"تم تنفيذ إجراء إداري '{ResolveAdminActionLabel(actionCode)}' على طلب المصيف رقم #{response.Data.MessageId}.",
                        "إدارة طلبات المصايف");
                }

                if (actionCode == "MANUAL_CANCEL" && response.Data != null)
                {
                    await PublishCapacityUpdateAsync(response.Data.CategoryId, response.Data.WaveCode, "ADMIN_CANCEL");
                }

                await PublishRequestUpdateAsync(request.MessageId, actionCode);
            }
            catch (Exception ex)
            {
                response.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });
            }

            return response;
        }

        public async Task<CommonResponse<IEnumerable<SummerWaveCapacityDto>>> GetWaveCapacityAsync(int categoryId, string waveCode)
        {
            var response = new CommonResponse<IEnumerable<SummerWaveCapacityDto>>();
            try
            {
                if (categoryId <= 0 || string.IsNullOrWhiteSpace(waveCode))
                {
                    response.Errors.Add(new Error { Code = "400", Message = "المصيف والفوج مطلوبان." });
                    return response;
                }

                var summerRules = await GetSummerRulesAsync();
                if (!summerRules.TryGetValue(categoryId, out var rule))
                {
                    response.Errors.Add(new Error { Code = "400", Message = "المصيف غير مُعد في النظام." });
                    return response;
                }

                var normalizedWave = waveCode.Trim();
                var activeMessageIds = await GetActiveMessageIdsForWaveAsync(categoryId, normalizedWave);
                var familyFields = activeMessageIds.Count == 0
                    ? new List<TkmendField>()
                    : await _connectContext.TkmendFields
                        .AsNoTracking()
                        .Where(f => activeMessageIds.Contains(f.FildRelted) && f.FildKind == "FamilyCount")
                        .ToListAsync();

                response.Data = rule.CapacityByFamily
                    .OrderBy(item => item.Key)
                    .Select(item =>
                    {
                        var familyCount = item.Key;
                        var totalUnits = item.Value;
                        var usedUnits = familyFields
                            .Where(f => ParseInt(f.FildTxt, 0) == familyCount)
                            .Select(f => f.FildRelted)
                            .Distinct()
                            .Count();

                        return new SummerWaveCapacityDto
                        {
                            CategoryId = categoryId,
                            WaveCode = normalizedWave,
                            FamilyCount = familyCount,
                            TotalUnits = totalUnits,
                            UsedUnits = usedUnits,
                            AvailableUnits = Math.Max(0, totalUnits - usedUnits)
                        };
                    })
                    .ToList();
            }
            catch (Exception ex)
            {
                response.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });
            }

            return response;
        }

        public async Task<CommonResponse<SummerRequestSummaryDto>> CancelAsync(SummerCancelRequest request, string userId, string ip)
        {
            var response = new CommonResponse<SummerRequestSummaryDto>();
            request ??= new SummerCancelRequest();
            try
            {
                if (request.MessageId <= 0)
                {
                    response.Errors.Add(new Error { Code = "400", Message = "رقم الطلب مطلوب." });
                    return response;
                }

                if (!_helperService.ValidateFileSizes(request.files, response))
                {
                    return response;
                }

                if (!ValidateAllowedAttachmentExtensions(request.files, response))
                {
                    return response;
                }

                var message = await _connectContext.Messages.FirstOrDefaultAsync(m => m.MessageId == request.MessageId);
                if (message == null)
                {
                    response.Errors.Add(new Error { Code = "404", Message = "الطلب غير موجود." });
                    return response;
                }

                var fields = await _connectContext.TkmendFields.Where(f => f.FildRelted == message.MessageId).ToListAsync();
                if (message.Status == MessageStatus.Rejected || ParseDate(GetFieldValue(fields, "Summer_CancelledAtUtc")).HasValue)
                {
                    response.Errors.Add(new Error { Code = "400", Message = "تم تسجيل اعتذار سابق على هذا الحجز." });
                    return response;
                }

                var waveCode = GetFieldValue(fields, "SummerCamp") ?? string.Empty;
                var waveLabel = GetFieldValue(fields, "SummerCampLabel");
                var seasonYear = ParseInt(GetFieldValue(fields, "SummerSeasonYear"), DateTime.UtcNow.Year);
                var summerRules = await GetSummerRulesAsync(seasonYear);
                summerRules.TryGetValue(message.CategoryCd, out var categoryRule);
                if (TryResolveWaveStartUtc(categoryRule, message.CategoryCd, seasonYear, waveCode, waveLabel, out var waveStartUtc)
                    && !SummerCalendarRules.CanCancel(DateTime.UtcNow, waveStartUtc))
                {
                    var lastAllowedUtc = waveStartUtc.AddDays(-14);
                    response.Errors.Add(new Error
                    {
                        Code = "400",
                        Message = $"لا يمكن تسجيل الاعتذار قبل موعد الفوج بأقل من 14 يوم. آخر موعد متاح للاعتذار هو {lastAllowedUtc:yyyy-MM-dd HH:mm} (UTC)."
                    });
                    return response;
                }

                using var connectTx = await _connectContext.Database.BeginTransactionAsync(IsolationLevel.Serializable);
                using var attachTx = await _attachHeldContext.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted);
                try
                {
                    message.Status = MessageStatus.Rejected;
                    UpsertField(fields, message.MessageId, "Summer_ActionType", "CANCEL");
                    UpsertField(fields, message.MessageId, "Summer_CancelReason", (request.Reason ?? string.Empty).Trim());
                    UpsertField(fields, message.MessageId, "Summer_CancelledAtUtc", DateTime.UtcNow.ToString("o"));
                    UpsertField(fields, message.MessageId, "Summer_PaymentStatus", "CANCELLED");

                    await AddReplyWithAttachmentsAsync(
                        message.MessageId,
                        string.IsNullOrWhiteSpace(request.Reason)
                            ? "تم تسجيل الاعتذار عن الحجز."
                            : $"تم تسجيل الاعتذار عن الحجز. السبب: {request.Reason.Trim()}",
                        userId,
                        ip,
                        request.files);

                    await _attachHeldContext.SaveChangesAsync();
                    await _connectContext.SaveChangesAsync();
                    await attachTx.CommitAsync();
                    await connectTx.CommitAsync();
                }
                catch
                {
                    await attachTx.RollbackAsync();
                    await connectTx.RollbackAsync();
                    throw;
                }

                var summary = await BuildSummaryAsync(message.MessageId);
                response.Data = summary;

                if (!string.IsNullOrWhiteSpace(summary.EmployeeId))
                {
                    await _signalRConnectionManager.SendNotificationToUser(summary.EmployeeId, new NotificationDto
                    {
                        Notification = "تم تسجيل الاعتذار عن الحجز بنجاح.",
                        type = NotificationType.info,
                        Title = "تحديث طلب المصيف",
                        time = DateTime.Now,
                        sender = "Connect",
                        Category = NotificationCategory.Business
                    });
                }

                await NotifySummerActionGroupAsync(
                    summary.MessageId,
                    $"تم تسجيل اعتذار صاحب الطلب عن طلب المصيف رقم #{summary.MessageId}.",
                    "إدارة طلبات المصايف");

                await PublishCapacityUpdateAsync(summary.CategoryId, summary.WaveCode, "CANCEL");
                await PublishRequestUpdateAsync(summary.MessageId, "CANCEL");
            }
            catch (Exception ex)
            {
                response.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });
            }

            return response;
        }

        public async Task<CommonResponse<SummerRequestSummaryDto>> PayAsync(SummerPayRequest request, string userId, string ip)
        {
            var response = new CommonResponse<SummerRequestSummaryDto>();
            request ??= new SummerPayRequest();
            try
            {
                if (request.MessageId <= 0)
                {
                    response.Errors.Add(new Error { Code = "400", Message = "رقم الطلب مطلوب." });
                    return response;
                }

                if (!_helperService.ValidateFileSizes(request.files, response))
                {
                    return response;
                }

                if (!ValidateAllowedAttachmentExtensions(request.files, response))
                {
                    return response;
                }

                if (request.files == null || request.files.Count == 0)
                {
                    response.Errors.Add(new Error { Code = "400", Message = "لا يمكن تسجيل السداد بدون مرفقات. يجب إرفاق مستند واحد على الأقل." });
                    return response;
                }

                if (request.ForceOverride)
                {
                    response.Errors.Add(new Error { Code = "400", Message = "غير مسموح بالسداد بعد انتهاء مهلة اليوم الواحد." });
                    return response;
                }

                var message = await _connectContext.Messages.FirstOrDefaultAsync(m => m.MessageId == request.MessageId);
                if (message == null)
                {
                    response.Errors.Add(new Error { Code = "404", Message = "الطلب غير موجود." });
                    return response;
                }

                if (message.Status == MessageStatus.Rejected)
                {
                    response.Errors.Add(new Error { Code = "400", Message = "لا يمكن تسجيل السداد لطلب تم الاعتذار عنه." });
                    return response;
                }

                var fields = await _connectContext.TkmendFields.Where(f => f.FildRelted == message.MessageId).ToListAsync();
                var dueAt = ResolvePaymentDueAtUtc(message, fields);
                var paidAt = request.PaidAtUtc?.ToUniversalTime() ?? DateTime.UtcNow;

                if (paidAt > dueAt)
                {
                    response.Errors.Add(new Error
                    {
                        Code = "400",
                        Message = $"انتهت مهلة السداد. كان الموعد النهائي {dueAt:yyyy-MM-dd HH:mm} (UTC)."
                    });
                    return response;
                }

                using var connectTx = await _connectContext.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted);
                using var attachTx = await _attachHeldContext.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted);
                try
                {
                    UpsertField(fields, message.MessageId, "Summer_ActionType", "PAY");
                    UpsertField(fields, message.MessageId, "Summer_PaymentStatus", "PAID");
                    UpsertField(fields, message.MessageId, "Summer_PaidAtUtc", paidAt.ToString("o"));
                    UpsertField(fields, message.MessageId, "Summer_PaymentDueAtUtc", dueAt.ToString("o"));
                    UpsertField(fields, message.MessageId, "Summer_TransferRequiresRePayment", "false");
                    if (!string.IsNullOrWhiteSpace(request.Notes))
                    {
                        UpsertField(fields, message.MessageId, "Summer_PaymentNotes", request.Notes.Trim());
                    }

                    await AddReplyWithAttachmentsAsync(
                        message.MessageId,
                        string.IsNullOrWhiteSpace(request.Notes)
                            ? "تم تسجيل السداد بنجاح."
                            : $"تم تسجيل السداد بنجاح. الملاحظات: {request.Notes.Trim()}",
                        userId,
                        ip,
                        request.files);

                    await _attachHeldContext.SaveChangesAsync();
                    await _connectContext.SaveChangesAsync();
                    await attachTx.CommitAsync();
                    await connectTx.CommitAsync();
                }
                catch
                {
                    await attachTx.RollbackAsync();
                    await connectTx.RollbackAsync();
                    throw;
                }

                response.Data = await BuildSummaryAsync(message.MessageId);
                if (response.Data != null)
                {
                    await NotifySummerActionGroupAsync(
                        response.Data.MessageId,
                        $"تم تسجيل السداد لطلب المصيف رقم #{response.Data.MessageId}.",
                        "إدارة طلبات المصايف");
                }

                await PublishRequestUpdateAsync(message.MessageId, "PAY");
            }
            catch (Exception ex)
            {
                response.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });
            }

            return response;
        }

        public async Task<CommonResponse<SummerRequestSummaryDto>> TransferAsync(SummerTransferRequest request, string userId, string ip)
        {
            var response = new CommonResponse<SummerRequestSummaryDto>();
            request ??= new SummerTransferRequest();
            try
            {
                if (request.MessageId <= 0 || request.ToCategoryId <= 0 || string.IsNullOrWhiteSpace(request.ToWaveCode))
                {
                    response.Errors.Add(new Error { Code = "400", Message = "رقم الطلب والمصيف المستهدف والفوج المستهدف حقول مطلوبة." });
                    return response;
                }

                if (!_helperService.ValidateFileSizes(request.files, response))
                {
                    return response;
                }

                if (!ValidateAllowedAttachmentExtensions(request.files, response))
                {
                    return response;
                }

                var message = await _connectContext.Messages.FirstOrDefaultAsync(m => m.MessageId == request.MessageId);
                if (message == null)
                {
                    response.Errors.Add(new Error { Code = "404", Message = "الطلب غير موجود." });
                    return response;
                }

                if (message.Status == MessageStatus.Rejected)
                {
                    response.Errors.Add(new Error { Code = "400", Message = "لا يمكن تحويل طلب تم الاعتذار عنه." });
                    return response;
                }

                var normalizedTargetWave = request.ToWaveCode.Trim();

                var fields = await _connectContext.TkmendFields.Where(f => f.FildRelted == message.MessageId).ToListAsync();
                var paymentStatus = (GetFieldValue(fields, "Summer_PaymentStatus") ?? string.Empty).Trim();
                var paidAtUtc = ParseDate(GetFieldValue(fields, "Summer_PaidAtUtc"));
                var adminLastAction = (GetFieldValue(fields, "Summer_AdminLastAction") ?? string.Empty).Trim();
                var wasPaid = paidAtUtc.HasValue || string.Equals(paymentStatus, "PAID", StringComparison.OrdinalIgnoreCase);
                var wasFinalApproved = string.Equals(adminLastAction, "FINAL_APPROVE", StringComparison.OrdinalIgnoreCase)
                    || message.Status == MessageStatus.Replied;
                var requiresTransferReview = wasPaid || wasFinalApproved;
                var transferCount = ParseInt(GetFieldValue(fields, "Summer_TransferCount"), 0);
                if (transferCount > 0)
                {
                    response.Errors.Add(new Error { Code = "400", Message = "التحويل مسموح مرة واحدة فقط خلال الموسم." });
                    return response;
                }

                var employeeId = GetFieldValue(fields, "Emp_Id") ?? string.Empty;
                if (string.IsNullOrWhiteSpace(employeeId))
                {
                    response.Errors.Add(new Error { Code = "400", Message = "رقم ملف الموظف مطلوب." });
                    return response;
                }

                var seasonYear = ParseInt(GetFieldValue(fields, "SummerSeasonYear"), DateTime.UtcNow.Year);
                var summerRules = await GetSummerRulesAsync(seasonYear);
                if (await HasEmployeeUsedTransferInSeasonAsync(employeeId, seasonYear, message.MessageId, summerRules.Keys))
                {
                    response.Errors.Add(new Error { Code = "400", Message = "تم استخدام التحويل بالفعل خلال هذا الموسم." });
                    return response;
                }

                var currentFamilyCount = ParseInt(GetFirstFieldValue(fields, "FamilyCount", "SUM2026_FamilyCount"), 0);
                var currentExtraCount = ParseInt(GetFirstFieldValue(fields, "Over_Count", "SUM2026_ExtraCount", "ExtraCount"), 0);
                var newFamilyCount = request.NewFamilyCount ?? currentFamilyCount;
                var newExtraCount = request.NewExtraCount ?? currentExtraCount;
                var familyCompositionChanged = newFamilyCount != currentFamilyCount || newExtraCount != currentExtraCount;
                var requiresRePayment = wasPaid && familyCompositionChanged;

                if (!summerRules.TryGetValue(request.ToCategoryId, out var rule))
                {
                    response.Errors.Add(new Error { Code = "400", Message = "المصيف المستهدف غير مُعد في النظام." });
                    return response;
                }

                var targetCategoryName = await _connectContext.Cdcategories
                    .AsNoTracking()
                    .Where(c => c.CatId == request.ToCategoryId)
                    .Select(c => c.CatName)
                    .FirstOrDefaultAsync();

                var targetCategoryDisplayName = string.IsNullOrWhiteSpace(targetCategoryName)
                    ? $"رقم {request.ToCategoryId}"
                    : targetCategoryName.Trim();
                var targetWaveLabel = normalizedTargetWave;

                if (newFamilyCount <= 0 || !rule.CapacityByFamily.ContainsKey(newFamilyCount))
                {
                    response.Errors.Add(new Error { Code = "400", Message = "عدد الأفراد غير متاح للحجز في المصيف المستهدف." });
                    return response;
                }

                if (newExtraCount < 0 || newExtraCount > rule.MaxExtra)
                {
                    response.Errors.Add(new Error { Code = "400", Message = $"عدد الأفراد الإضافيين تجاوز الحد المسموح ({rule.MaxExtra})." });
                    return response;
                }

                var maxFamily = rule.CapacityByFamily.Keys.Max();
                if (newFamilyCount != maxFamily && newExtraCount > 0)
                {
                    response.Errors.Add(new Error { Code = "400", Message = "الأفراد الإضافيون مسموح بهم فقط عند اختيار أكبر سعة شقة." });
                    return response;
                }

                using var connectTx = await _connectContext.Database.BeginTransactionAsync(IsolationLevel.Serializable);
                using var attachTx = await _attachHeldContext.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted);
                try
                {
                    if (!await AcquireCapacityLockAsync(request.ToCategoryId, normalizedTargetWave))
                    {
                        response.Errors.Add(new Error
                        {
                            Code = "409",
                            Message = "تعذر حجز السعة حالياً بسبب حفظ متزامن. برجاء إعادة المحاولة بعد ثوانٍ."
                        });
                        await attachTx.RollbackAsync();
                        await connectTx.RollbackAsync();
                        return response;
                    }

                    var existsSameWave = await ExistsEmployeeBookingInWaveAsync(request.ToCategoryId, normalizedTargetWave, employeeId, message.MessageId);
                    if (existsSameWave)
                    {
                        response.Errors.Add(new Error { Code = "400", Message = "لا يمكن الحجز لنفس الموظف أكثر من مرة في نفس المصيف ونفس الفوج." });
                        await attachTx.RollbackAsync();
                        await connectTx.RollbackAsync();
                        return response;
                    }

                    var hasCapacity = await HasCapacityAsync(request.ToCategoryId, normalizedTargetWave, newFamilyCount, rule, message.MessageId);
                    if (!hasCapacity)
                    {
                        response.Errors.Add(new Error { Code = "429", Message = "لا توجد وحدات متاحة حالياً للعدد المختار في الفوج المحدد." });
                        await attachTx.RollbackAsync();
                        await connectTx.RollbackAsync();
                        return response;
                    }

                    var fromCategory = message.CategoryCd;
                    var fromWave = GetFirstFieldValue(fields, "SummerCamp", "SUM2026_WaveCode", "WaveCode");

                    message.CategoryCd = request.ToCategoryId;

                    UpsertFieldRange(fields, message.MessageId, WaveCodeFieldKinds, normalizedTargetWave);
                    UpsertFieldRange(fields, message.MessageId, WaveLabelFieldKinds, targetWaveLabel);
                    UpsertFieldRange(fields, message.MessageId, FamilyCountFieldKinds, newFamilyCount.ToString());
                    UpsertFieldRange(fields, message.MessageId, ExtraCountFieldKinds, newExtraCount.ToString());
                    UpsertFieldRange(fields, message.MessageId, DestinationIdFieldKinds, request.ToCategoryId.ToString());
                    UpsertFieldRange(fields, message.MessageId, DestinationNameFieldKinds, targetCategoryDisplayName);
                    UpsertField(fields, message.MessageId, "Summer_ActionType", "TRANSFER");
                    UpsertField(fields, message.MessageId, "Summer_TransferCount", "1");
                    UpsertField(fields, message.MessageId, "Summer_TransferFromCategory", fromCategory.ToString());
                    UpsertField(fields, message.MessageId, "Summer_TransferFromWave", fromWave);
                    UpsertField(fields, message.MessageId, "Summer_TransferToCategory", request.ToCategoryId.ToString());
                    UpsertField(fields, message.MessageId, "Summer_TransferToWave", normalizedTargetWave);
                    UpsertField(fields, message.MessageId, "Summer_TransferredAtUtc", DateTime.UtcNow.ToString("o"));
                    if (requiresTransferReview)
                    {
                        message.Status = MessageStatus.InProgress;
                        UpsertField(fields, message.MessageId, "Summer_WorkflowState", TransferReviewRequiredCode);
                        UpsertField(fields, message.MessageId, "Summer_WorkflowStateLabel", ResolveWorkflowStateLabel(TransferReviewRequiredCode));
                        UpsertField(fields, message.MessageId, "Summer_WorkflowStateReason", ResolveTransferReviewReason(wasPaid, wasFinalApproved));
                        UpsertField(fields, message.MessageId, "Summer_WorkflowStateAtUtc", DateTime.UtcNow.ToString("o"));
                    }
                    if (requiresRePayment)
                    {
                        var reopenedDueAt = SummerCalendarRules.CalculatePaymentDueUtc(DateTime.UtcNow);
                        UpsertField(fields, message.MessageId, "Summer_PaymentStatus", "PENDING_PAYMENT");
                        UpsertField(fields, message.MessageId, "Summer_PaidAtUtc", string.Empty);
                        UpsertField(fields, message.MessageId, "Summer_PaymentDueAtUtc", reopenedDueAt.ToString("o"));
                        UpsertField(fields, message.MessageId, "Summer_TransferRequiresRePayment", "true");
                        UpsertField(fields, message.MessageId, "Summer_TransferRePaymentReason", "تم تغيير عدد الأفراد بعد السداد، ويلزم إعادة السداد.");
                    }

                    var rePaymentNote = requiresRePayment
                        ? " تم تغيير عدد الأفراد بعد السداد، وتمت إعادة فتح السداد لاستكمال الإجراءات."
                        : string.Empty;
                    await AddReplyWithAttachmentsAsync(
                        message.MessageId,
                        string.IsNullOrWhiteSpace(request.Notes)
                            ? $"تم تحويل الطلب إلى مصيف {targetCategoryDisplayName} والفوج {normalizedTargetWave}.{rePaymentNote}"
                            : $"تم تحويل الطلب إلى مصيف {targetCategoryDisplayName} والفوج {normalizedTargetWave}.{rePaymentNote} الملاحظات: {request.Notes.Trim()}",
                        userId,
                        ip,
                        request.files);

                    await _attachHeldContext.SaveChangesAsync();
                    await _connectContext.SaveChangesAsync();
                    await attachTx.CommitAsync();
                    await connectTx.CommitAsync();

                    response.Data = await BuildSummaryAsync(message.MessageId);
                    if (response.Data != null)
                    {
                        await NotifySummerActionGroupAsync(
                            response.Data.MessageId,
                            $"تم تنفيذ تحويل طلب المصيف رقم #{response.Data.MessageId}.",
                            "إدارة طلبات المصايف");
                    }
                    await PublishCapacityUpdateAsync(fromCategory, fromWave, "TRANSFER_FROM");
                    await PublishCapacityUpdateAsync(request.ToCategoryId, normalizedTargetWave, "TRANSFER_TO");
                    await PublishRequestUpdateAsync(message.MessageId, "TRANSFER");
                }
                catch
                {
                    await attachTx.RollbackAsync();
                    await connectTx.RollbackAsync();
                    throw;
                }
            }
            catch (Exception ex)
            {
                response.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });
            }

            return response;
        }

        public async Task<int> AutoCancelExpiredUnpaidRequestsAsync(CancellationToken cancellationToken = default)
        {
            var autoCancelledCount = 0;
            var nowUtc = DateTime.UtcNow;
            var summerRules = await GetSummerRulesAsync();
            var summerCategoryIds = summerRules.Keys.ToList();
            if (!summerCategoryIds.Any())
            {
                return 0;
            }

            var candidateMessages = await _connectContext.Messages
                .AsNoTracking()
                .Where(m => summerCategoryIds.Contains(m.CategoryCd) && m.Status != MessageStatus.Rejected)
                .Select(m => new { m.MessageId })
                .ToListAsync(cancellationToken);

            if (!candidateMessages.Any())
            {
                return 0;
            }

            foreach (var item in candidateMessages)
            {
                cancellationToken.ThrowIfCancellationRequested();

                var notifyEmployeeId = string.Empty;
                var notifyCategoryId = 0;
                var notifyWaveCode = string.Empty;
                var notifyDueAtUtc = (DateTime?)null;
                var cancelledMessageId = 0;
                var wasAutoCancelled = false;

                await using var connectTx = await _connectContext.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);
                try
                {
                    var message = await _connectContext.Messages
                        .FirstOrDefaultAsync(m => m.MessageId == item.MessageId, cancellationToken);

                    if (message == null || message.Status == MessageStatus.Rejected)
                    {
                        await connectTx.RollbackAsync(cancellationToken);
                        continue;
                    }

                    var fields = await _connectContext.TkmendFields
                        .Where(f => f.FildRelted == message.MessageId)
                        .ToListAsync(cancellationToken);

                    if (ParseDate(GetFieldValue(fields, "Summer_PaidAtUtc")).HasValue)
                    {
                        await connectTx.RollbackAsync(cancellationToken);
                        continue;
                    }

                    var dueAt = ResolvePaymentDueAtUtc(message, fields);
                    if (nowUtc <= dueAt)
                    {
                        await connectTx.RollbackAsync(cancellationToken);
                        continue;
                    }

                    var autoCancelReason = "تم إلغاء الطلب تلقائياً لعدم السداد خلال مهلة يوم العمل.";
                    message.Status = MessageStatus.Rejected;
                    UpsertField(fields, message.MessageId, "Summer_ActionType", "AUTO_CANCEL_PAYMENT_TIMEOUT");
                    UpsertField(fields, message.MessageId, "Summer_CancelReason", autoCancelReason);
                    UpsertField(fields, message.MessageId, "Summer_CancelledAtUtc", nowUtc.ToString("o"));
                    UpsertField(fields, message.MessageId, "Summer_PaymentStatus", "CANCELLED_AUTO");
                    UpsertField(fields, message.MessageId, "Summer_PaymentDueAtUtc", dueAt.ToString("o"));

                    await AddReplyWithAttachmentsAsync(
                        message.MessageId,
                        autoCancelReason,
                        "SYSTEM",
                        "127.0.0.1",
                        null);

                    await _connectContext.SaveChangesAsync(cancellationToken);
                    await connectTx.CommitAsync(cancellationToken);

                    notifyEmployeeId = GetFieldValue(fields, "Emp_Id") ?? string.Empty;
                    notifyCategoryId = message.CategoryCd;
                    notifyWaveCode = GetFieldValue(fields, "SummerCamp") ?? string.Empty;
                    notifyDueAtUtc = dueAt;
                    cancelledMessageId = message.MessageId;
                    wasAutoCancelled = true;
                    autoCancelledCount += 1;
                }
                catch
                {
                    await connectTx.RollbackAsync(cancellationToken);
                }

                if (!wasAutoCancelled)
                {
                    continue;
                }

                SummerRequestSummaryDto? autoCancelledSummary = null;
                if (cancelledMessageId > 0)
                {
                    try
                    {
                        autoCancelledSummary = await BuildSummaryAsync(cancelledMessageId);
                    }
                    catch
                    {
                        // Best effort only.
                    }
                }

                if (autoCancelledSummary != null)
                {
                    notifyEmployeeId = string.IsNullOrWhiteSpace(autoCancelledSummary.EmployeeId) ? notifyEmployeeId : autoCancelledSummary.EmployeeId;
                    notifyCategoryId = autoCancelledSummary.CategoryId > 0 ? autoCancelledSummary.CategoryId : notifyCategoryId;
                    notifyWaveCode = string.IsNullOrWhiteSpace(autoCancelledSummary.WaveCode) ? notifyWaveCode : autoCancelledSummary.WaveCode;
                    await NotifyEmployeeOnAutoCancelAsync(autoCancelledSummary, notifyDueAtUtc, includeSignalR: false);
                }

                if (!string.IsNullOrWhiteSpace(notifyEmployeeId))
                {
                    await _signalRConnectionManager.SendNotificationToUser(notifyEmployeeId, new NotificationDto
                    {
                        Notification = "تم إلغاء الطلب تلقائياً بسبب عدم السداد خلال مهلة يوم العمل.",
                        type = NotificationType.info,
                        Title = "إلغاء تلقائي لطلب المصيف",
                        time = DateTime.Now,
                        sender = "Connect",
                        Category = NotificationCategory.Business
                    });
                }

                if (cancelledMessageId > 0)
                {
                    await NotifySummerActionGroupAsync(
                        cancelledMessageId,
                        $"تم إلغاء طلب المصيف رقم #{cancelledMessageId} تلقائياً بسبب عدم السداد خلال المهلة.",
                        "إدارة طلبات المصايف");
                }

                await PublishCapacityUpdateAsync(notifyCategoryId, notifyWaveCode, "AUTO_CANCEL");
                await PublishRequestUpdateAsync(cancelledMessageId, "AUTO_CANCEL");
            }

            return autoCancelledCount;
        }

        private async Task NotifyEmployeeOnAdminActionAsync(
            SummerRequestSummaryDto summary,
            string actionCode,
            string? comment,
            bool includeSignalR = true)
        {
            if (summary == null)
            {
                return;
            }

            var templates = _applicationConfig.NotificationChannels?.Summer ?? new SummerNotificationTemplates();
            var placeholders = BuildNotificationPlaceholders(
                summary,
                ResolveAdminActionLabel(actionCode),
                string.IsNullOrWhiteSpace(comment) ? string.Empty : $"تعليق الإدارة: {comment.Trim()}",
                null);

            var smsTemplate = string.IsNullOrWhiteSpace(templates.AdminActionSmsTemplate)
                ? "عزيزي {FirstName}، تم تحديث طلب المصيف {RequestRef}. نوع الإجراء: {ActionLabel}. {AdminCommentLine}"
                : templates.AdminActionSmsTemplate;

            var signalRTemplate = string.IsNullOrWhiteSpace(templates.AdminActionSignalRTemplate)
                ? "تم تحديث طلب المصيف {RequestRef} من إدارة المصايف. نوع الإجراء: {ActionLabel}."
                : templates.AdminActionSignalRTemplate;

            var smsMessage = _notificationService.RenderTemplate(smsTemplate, placeholders);
            var signalRMessage = _notificationService.RenderTemplate(signalRTemplate, placeholders);
            var signalRTitle = string.IsNullOrWhiteSpace(templates.AdminActionSignalRTitle)
                ? "إدارة طلبات المصايف"
                : templates.AdminActionSignalRTitle;

            await DispatchSummerNotificationsAsync(summary, smsMessage, signalRMessage, signalRTitle, includeSignalR);
        }

        private async Task NotifyEmployeeOnAutoCancelAsync(
            SummerRequestSummaryDto summary,
            DateTime? paymentDueAtUtc,
            bool includeSignalR = true)
        {
            if (summary == null)
            {
                return;
            }

            var templates = _applicationConfig.NotificationChannels?.Summer ?? new SummerNotificationTemplates();
            var placeholders = BuildNotificationPlaceholders(summary, string.Empty, string.Empty, paymentDueAtUtc);

            var smsTemplate = string.IsNullOrWhiteSpace(templates.AutoCancelSmsTemplate)
                ? "عزيزي {FirstName}، تم إلغاء طلب المصيف {RequestRef} تلقائياً لعدم استكمال السداد قبل {PaymentDueAtUtc}."
                : templates.AutoCancelSmsTemplate;

            var signalRTemplate = string.IsNullOrWhiteSpace(templates.AutoCancelSignalRTemplate)
                ? "تم إلغاء طلب المصيف {RequestRef} تلقائياً بسبب انتهاء مهلة السداد."
                : templates.AutoCancelSignalRTemplate;

            var smsMessage = _notificationService.RenderTemplate(smsTemplate, placeholders);
            var signalRMessage = _notificationService.RenderTemplate(signalRTemplate, placeholders);
            var signalRTitle = string.IsNullOrWhiteSpace(templates.AutoCancelSignalRTitle)
                ? "إلغاء تلقائي لطلب المصيف"
                : templates.AutoCancelSignalRTitle;

            await DispatchSummerNotificationsAsync(summary, smsMessage, signalRMessage, signalRTitle, includeSignalR);
        }

        private async Task DispatchSummerNotificationsAsync(
            SummerRequestSummaryDto summary,
            string smsMessage,
            string signalRMessage,
            string signalRTitle,
            bool includeSignalR)
        {
            var mobile = ResolvePreferredMobile(summary.EmployeePhone, summary.EmployeeExtraPhone);
            if (!string.IsNullOrWhiteSpace(mobile) && !string.IsNullOrWhiteSpace(smsMessage))
            {
                await _notificationService.SendSmsAsync(new SmsDispatchRequest
                {
                    MobileNumber = mobile,
                    Message = smsMessage,
                    UserId = string.IsNullOrWhiteSpace(summary.EmployeeId) ? "SYSTEM" : summary.EmployeeId.Trim(),
                    ReferenceNo = string.IsNullOrWhiteSpace(summary.RequestRef) ? $"SUMMER-{summary.MessageId}" : summary.RequestRef.Trim()
                });
            }

            if (!includeSignalR || string.IsNullOrWhiteSpace(summary.EmployeeId) || string.IsNullOrWhiteSpace(signalRMessage))
            {
                return;
            }

            await _notificationService.SendSignalRToUserAsync(new SignalRDispatchRequest
            {
                UserId = summary.EmployeeId.Trim(),
                Notification = signalRMessage,
                Title = signalRTitle,
                Type = NotificationType.info,
                Category = NotificationCategory.Business,
                Sender = "Connect",
                Time = DateTime.Now
            });
        }

        private static IReadOnlyDictionary<string, string?> BuildNotificationPlaceholders(
            SummerRequestSummaryDto summary,
            string actionLabel,
            string adminCommentLine,
            DateTime? paymentDueAtUtc)
        {
            return new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase)
            {
                ["FirstName"] = ResolveFirstName(summary.EmployeeName),
                ["EmployeeName"] = summary.EmployeeName,
                ["EmployeeId"] = summary.EmployeeId,
                ["RequestRef"] = summary.RequestRef,
                ["MessageId"] = summary.MessageId.ToString(),
                ["CategoryName"] = summary.CategoryName,
                ["CategoryId"] = summary.CategoryId.ToString(),
                ["WaveCode"] = summary.WaveCode,
                ["ActionLabel"] = actionLabel,
                ["AdminCommentLine"] = adminCommentLine,
                ["PaymentDueAtUtc"] = paymentDueAtUtc.HasValue ? $"{paymentDueAtUtc.Value:yyyy-MM-dd HH:mm} UTC" : string.Empty
            };
        }

        private static string ResolveAdminActionLabel(string actionCode)
        {
            return actionCode switch
            {
                "FINAL_APPROVE" => "اعتماد نهائي",
                "MANUAL_CANCEL" => "إلغاء إداري",
                "COMMENT" => "تعليق إداري",
                "APPROVE_TRANSFER" => "اعتماد التحويل",
                _ => actionCode ?? string.Empty
            };
        }

        private static string ResolvePreferredMobile(string? primary, string? secondary)
        {
            var first = (primary ?? string.Empty).Trim();
            if (!string.IsNullOrWhiteSpace(first))
            {
                return first;
            }

            return (secondary ?? string.Empty).Trim();
        }

        private static string ResolveFirstName(string? fullName)
        {
            var normalized = (fullName ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(normalized))
            {
                return "عميلنا العزيز";
            }

            var parts = normalized.Split(' ', StringSplitOptions.RemoveEmptyEntries);
            return parts.Length == 0 ? normalized : parts[0];
        }

        private async Task<bool> HasEmployeeUsedTransferInSeasonAsync(
            string employeeId,
            int seasonYear,
            int excludedMessageId,
            IEnumerable<int> summerCategoryIds)
        {
            var categoryIds = (summerCategoryIds ?? Enumerable.Empty<int>())
                .Distinct()
                .ToList();
            if (!categoryIds.Any())
            {
                return false;
            }

            var messageIds = await _connectContext.Messages
                .AsNoTracking()
                .Where(m => categoryIds.Contains(m.CategoryCd) && m.MessageId != excludedMessageId)
                .Select(m => m.MessageId)
                .ToListAsync();

            if (!messageIds.Any())
            {
                return false;
            }

            var fields = await _connectContext.TkmendFields
                .AsNoTracking()
                .Where(f => messageIds.Contains(f.FildRelted)
                            && (f.FildKind == "Emp_Id" || f.FildKind == "SummerSeasonYear" || f.FildKind == "Summer_TransferCount"))
                .ToListAsync();

            var byMessage = fields.GroupBy(f => f.FildRelted);
            foreach (var group in byMessage)
            {
                var messageFields = group.ToList();
                var employee = GetFieldValue(messageFields, "Emp_Id") ?? string.Empty;
                if (!string.Equals(employee, employeeId, StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                var itemSeason = ParseInt(GetFieldValue(messageFields, "SummerSeasonYear"), 0);
                if (itemSeason != seasonYear)
                {
                    continue;
                }

                if (ParseInt(GetFieldValue(messageFields, "Summer_TransferCount"), 0) > 0)
                {
                    return true;
                }
            }

            return false;
        }

        private async Task<bool> ExistsEmployeeBookingInWaveAsync(int categoryId, string waveCode, string employeeId, int excludedMessageId)
        {
            if (string.IsNullOrWhiteSpace(employeeId) || string.IsNullOrWhiteSpace(waveCode))
            {
                return false;
            }

            var activeMessageIds = await GetActiveMessageIdsForWaveAsync(categoryId, waveCode.Trim(), excludedMessageId);

            if (!activeMessageIds.Any())
            {
                return false;
            }

            return await _connectContext.TkmendFields
                .AsNoTracking()
                .AnyAsync(f => activeMessageIds.Contains(f.FildRelted) && f.FildKind == "Emp_Id" && f.FildTxt == employeeId);
        }

        private async Task<List<int>> GetActiveMessageIdsForWaveAsync(int categoryId, string waveCode, int? excludedMessageId = null)
        {
            var matchingWaveMessageIds = await _connectContext.TkmendFields
                .AsNoTracking()
                .Where(f => f.FildKind == "SummerCamp" && f.FildTxt == waveCode)
                .Select(f => f.FildRelted)
                .Distinct()
                .ToListAsync();

            if (!matchingWaveMessageIds.Any())
            {
                return new List<int>();
            }

            var query = _connectContext.Messages
                .AsNoTracking()
                .Where(m => matchingWaveMessageIds.Contains(m.MessageId)
                            && m.CategoryCd == categoryId
                            && m.Status != MessageStatus.Rejected);

            if (excludedMessageId.HasValue)
            {
                query = query.Where(m => m.MessageId != excludedMessageId.Value);
            }

            return await query
                .Select(m => m.MessageId)
                .ToListAsync();
        }

        private async Task<bool> HasCapacityAsync(
            int categoryId,
            string waveCode,
            int familyCount,
            SummerRule? rule,
            int? excludedMessageId = null)
        {
            if (rule == null)
            {
                return true;
            }

            if (!rule.CapacityByFamily.TryGetValue(familyCount, out var totalUnits))
            {
                return false;
            }

            var activeMessageIds = await GetActiveMessageIdsForWaveAsync(categoryId, waveCode.Trim(), excludedMessageId);
            if (!activeMessageIds.Any())
            {
                return true;
            }

            var familyFields = await _connectContext.TkmendFields
                .AsNoTracking()
                .Where(f => activeMessageIds.Contains(f.FildRelted) && f.FildKind == "FamilyCount")
                .ToListAsync();

            var usedUnits = familyFields
                .Where(f => ParseInt(f.FildTxt, 0) == familyCount)
                .Select(f => f.FildRelted)
                .Distinct()
                .Count();

            return usedUnits < totalUnits;
        }

        private async Task<bool> AcquireCapacityLockAsync(int categoryId, string waveCode)
        {
            var currentTransaction = _connectContext.Database.CurrentTransaction;
            if (currentTransaction == null)
            {
                throw new InvalidOperationException("يلزم وجود معاملة فعالة قبل حجز قفل السعة.");
            }

            var connection = _connectContext.Database.GetDbConnection();
            if (connection.State != ConnectionState.Open)
            {
                await connection.OpenAsync();
            }

            await using var command = connection.CreateCommand();
            command.Transaction = currentTransaction.GetDbTransaction();
            command.CommandText = @"
DECLARE @result int;
EXEC @result = sp_getapplock
    @Resource = @resource,
    @LockMode = 'Exclusive',
    @LockOwner = 'Transaction',
    @LockTimeout = @timeout;
SELECT @result;
";

            var resourceParam = command.CreateParameter();
            resourceParam.ParameterName = "@resource";
            resourceParam.Value = $"SUMMER_CAPACITY_{categoryId}_{waveCode.Trim().ToUpperInvariant()}";
            command.Parameters.Add(resourceParam);

            var timeoutParam = command.CreateParameter();
            timeoutParam.ParameterName = "@timeout";
            timeoutParam.Value = CapacityLockTimeoutMs;
            command.Parameters.Add(timeoutParam);

            var resultObject = await command.ExecuteScalarAsync();
            var resultCode = Convert.ToInt32(resultObject ?? -999);
            return resultCode >= 0;
        }

        private async Task PublishCapacityUpdateAsync(int categoryId, string waveCode, string action)
        {
            if (categoryId <= 0 || string.IsNullOrWhiteSpace(waveCode))
            {
                return;
            }

            var messageText = $"SUMMER_CAPACITY_UPDATED|{categoryId}|{waveCode.Trim()}|{action}|{DateTime.UtcNow:o}";
            var notification = new NotificationDto
            {
                Notification = messageText,
                type = NotificationType.info,
                Title = "تحديث سعات المصايف",
                time = DateTime.Now,
                sender = "Connect",
                Category = NotificationCategory.Business
            };

            await _notificationService.SendSignalRToGroupsAsync(new SignalRGroupsDispatchRequest
            {
                GroupNames = SummerNotificationGroups,
                Notification = notification.Notification,
                Type = notification.type,
                Title = notification.Title,
                Time = notification.time,
                Sender = notification.sender,
                Category = notification.Category ?? NotificationCategory.Business
            });
        }

        private async Task PublishRequestUpdateAsync(int messageId, string action)
        {
            if (messageId <= 0)
            {
                return;
            }

            var normalizedAction = string.IsNullOrWhiteSpace(action)
                ? "UPDATE"
                : action.Trim().ToUpperInvariant();
            var messageText = $"SUMMER_REQUEST_UPDATED|{messageId}|{normalizedAction}|{DateTime.UtcNow:o}";
            var notification = new NotificationDto
            {
                Notification = messageText,
                type = NotificationType.info,
                Title = "تحديث طلبات المصايف",
                time = DateTime.Now,
                sender = "Connect",
                Category = NotificationCategory.Business
            };

            var groups = new HashSet<string>(SummerNotificationGroups, StringComparer.OrdinalIgnoreCase);
            var responsibleGroups = await ResolveResponsibleAdminGroupsAsync(messageId);
            foreach (var responsibleGroup in responsibleGroups)
            {
                groups.Add(responsibleGroup.Trim());
            }

            await _notificationService.SendSignalRToGroupsAsync(new SignalRGroupsDispatchRequest
            {
                GroupNames = groups.ToArray(),
                Notification = notification.Notification,
                Type = notification.type,
                Title = notification.Title,
                Time = notification.time,
                Sender = notification.sender,
                Category = notification.Category ?? NotificationCategory.Business
            });
        }

        private async Task NotifySummerActionGroupAsync(int messageId, string message, string title)
        {
            if (messageId <= 0 || string.IsNullOrWhiteSpace(message))
            {
                return;
            }

            var groupName = await ResolveResponsibleAdminGroupAsync(messageId);
            if (string.IsNullOrWhiteSpace(groupName))
            {
                return;
            }

            await _notificationService.SendSignalRToGroupAsync(new SignalRGroupDispatchRequest
            {
                GroupName = groupName,
                Notification = message.Trim(),
                Title = string.IsNullOrWhiteSpace(title) ? "إدارة طلبات المصايف" : title.Trim(),
                Type = NotificationType.info,
                Category = NotificationCategory.Business,
                Sender = "Connect",
                Time = DateTime.Now
            });
        }

        private async Task<string?> ResolveResponsibleAdminGroupAsync(int messageId)
        {
            var groups = await ResolveResponsibleAdminGroupsAsync(messageId);
            return groups.FirstOrDefault();
        }

        private async Task<List<string>> ResolveResponsibleAdminGroupsAsync(int messageId)
        {
            var sectorData = await _connectContext.Messages
                .AsNoTracking()
                .Where(message => message.MessageId == messageId)
                .Select(message => new
                {
                    CurrentResponsibleSectorId = message.CurrentResponsibleSectorId,
                    AssignedSectorId = message.AssignedSectorId
                })
                .FirstOrDefaultAsync();

            if (sectorData == null)
            {
                return new List<string>();
            }

            return new[] { sectorData.CurrentResponsibleSectorId, sectorData.AssignedSectorId }
                .Where(sector => !string.IsNullOrWhiteSpace(sector))
                .Select(sector => sector!.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
        }

        private async Task AddReplyWithAttachmentsAsync(int messageId, string message, string userId, string ip, List<IFormFile>? files)
        {
            var normalizedMessage = NormalizePotentialMojibake(message);
            var reply = _helperService.CreateReply(messageId, normalizedMessage, userId, userId, ip);
            await _connectContext.Replies.AddAsync(reply);

            if (files != null && files.Any())
            {
                var attachments = new List<AttchShipment>();
                await _helperService.SaveAttachments(files, reply.ReplyId, attachments);
                if (attachments.Any())
                {
                    await _attachHeldContext.AttchShipments.AddRangeAsync(attachments);
                }
            }
        }

        private async Task<SummerRequestSummaryDto> BuildSummaryAsync(int messageId)
        {
            var message = await _connectContext.Messages
                .AsNoTracking()
                .FirstAsync(m => m.MessageId == messageId);

            var fields = await _connectContext.TkmendFields
                .AsNoTracking()
                .Where(f => f.FildRelted == messageId)
                .ToListAsync();

            var categoryName = await _connectContext.Cdcategories
                .AsNoTracking()
                .Where(c => c.CatId == message.CategoryCd)
                .Select(c => c.CatName)
                .FirstOrDefaultAsync() ?? string.Empty;

            var workflowStateCode = GetFieldValue(fields, "Summer_WorkflowState") ?? string.Empty;
            var workflowStateLabel = ResolveWorkflowStateLabel(workflowStateCode);
            var needsTransferReview = string.Equals(
                workflowStateCode,
                TransferReviewRequiredCode,
                StringComparison.OrdinalIgnoreCase);

            return new SummerRequestSummaryDto
            {
                MessageId = message.MessageId,
                RequestRef = message.RequestRef ?? string.Empty,
                CategoryId = message.CategoryCd,
                CategoryName = categoryName,
                WaveCode = GetFieldValue(fields, "SummerCamp") ?? string.Empty,
                EmployeeId = GetFirstFieldValue(fields, "Emp_Id", "EmployeeFileNumber", "FileNumber", "EmployeeId"),
                EmployeeName = GetFirstFieldValue(fields, "Emp_Name", "EmployeeName", "Name", "ArabicName", "DisplayName"),
                EmployeeNationalId = GetFirstFieldValue(fields, "NationalId", "NationalID", "NATIONAL_ID", "national_id", "NID", "IDNumber"),
                EmployeePhone = GetFirstFieldValue(fields, "PhoneNumber", "MobileNumber", "PhoneNo", "Phone_No", "MobilePhone", "phone"),
                EmployeeExtraPhone = GetFirstFieldValue(fields, "ExtraPhoneNumber", "SecondaryPhone", "AlternatePhone"),
                Status = message.Status.ToString(),
                StatusLabel = ResolveSummaryStatusLabel(message.Status, fields, needsTransferReview, workflowStateLabel),
                WorkflowStateCode = workflowStateCode,
                WorkflowStateLabel = workflowStateLabel,
                NeedsTransferReview = needsTransferReview,
                CreatedAt = message.CreatedDate,
                PaymentDueAtUtc = ParseDate(GetFieldValue(fields, "Summer_PaymentDueAtUtc")),
                PaidAtUtc = ParseDate(GetFieldValue(fields, "Summer_PaidAtUtc")),
                TransferUsed = ParseInt(GetFieldValue(fields, "Summer_TransferCount"), 0) > 0
            };
        }

        private async Task<Dictionary<int, SummerRule>> GetSummerRulesAsync(int seasonYear = 2026, string? applicationId = null)
        {
            var destinations = await GetSummerDestinationConfigsAsync(seasonYear, applicationId);
            var rules = new Dictionary<int, SummerRule>();

            foreach (var destination in destinations)
            {
                if (destination.CategoryId <= 0)
                {
                    continue;
                }

                var capacityByFamily = destination.Apartments
                    .Where(item => item.FamilyCount > 0 && item.Apartments > 0)
                    .GroupBy(item => item.FamilyCount)
                    .ToDictionary(group => group.Key, group => group.Sum(item => item.Apartments));

                if (!capacityByFamily.Any())
                {
                    continue;
                }

                var waveStartByCode = new Dictionary<string, DateTime>(StringComparer.OrdinalIgnoreCase);
                foreach (var wave in destination.Waves ?? new List<SummerWaveDefinitionDto>())
                {
                    var waveCode = Convert.ToString(wave?.Code ?? string.Empty).Trim();
                    if (waveCode.Length == 0)
                    {
                        continue;
                    }

                    if (SummerCalendarRules.TryParseWaveLabelDateUtc(wave?.StartsAtLabel, out var waveStartUtc))
                    {
                        waveStartByCode[waveCode] = waveStartUtc;
                    }
                }

                rules[destination.CategoryId] = new SummerRule(
                    destination.MaxExtraMembers,
                    capacityByFamily,
                    waveStartByCode);
            }

            return rules;
        }

        private async Task<List<SummerDestinationConfigDto>> GetSummerDestinationConfigsAsync(int seasonYear, string? applicationId = null)
        {
            var normalizedAppId = string.IsNullOrWhiteSpace(applicationId)
                ? SummerDynamicApplicationId
                : applicationId.Trim();

            var metadataRow = await _connectContext.Cdmends
                .AsNoTracking()
                .FirstOrDefaultAsync(item =>
                    item.ApplicationId == normalizedAppId
                    && item.CdmendTxt == SummerDestinationCatalogMend
                    && item.CdmendStat == false);

            var payload = (metadataRow?.CdmendTbl ?? string.Empty).Trim();
            if (payload.Length == 0)
            {
                return new List<SummerDestinationConfigDto>();
            }

            var options = new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            };

            SummerDestinationCatalogPayload? catalogPayload = null;
            if (payload.StartsWith("{", StringComparison.Ordinal))
            {
                catalogPayload = JsonSerializer.Deserialize<SummerDestinationCatalogPayload>(payload, options);
            }
            else if (payload.StartsWith("[", StringComparison.Ordinal))
            {
                catalogPayload = new SummerDestinationCatalogPayload
                {
                    Destinations = JsonSerializer.Deserialize<List<SummerDestinationConfigDto>>(payload, options)
                };
            }

            if (catalogPayload == null)
            {
                return new List<SummerDestinationConfigDto>();
            }

            var destinations = catalogPayload.Destinations ?? new List<SummerDestinationConfigDto>();
            var filteredDestinations = seasonYear > 0 && catalogPayload.SeasonYear > 0 && catalogPayload.SeasonYear != seasonYear
                ? new List<SummerDestinationConfigDto>()
                : destinations;

            return filteredDestinations
                .Where(item => item.CategoryId > 0)
                .GroupBy(item => item.CategoryId)
                .Select(group =>
                {
                    var destination = group.First();
                    destination.Name = Convert.ToString(destination.Name ?? string.Empty).Trim();
                    destination.Slug = Convert.ToString(destination.Slug ?? string.Empty).Trim();

                    destination.StayModes = (destination.StayModes ?? new List<SummerStayModeDefinitionDto>())
                        .Where(mode => !string.IsNullOrWhiteSpace(mode.Code))
                        .Select(mode => new SummerStayModeDefinitionDto
                        {
                            Code = Convert.ToString(mode.Code ?? string.Empty).Trim(),
                            Label = Convert.ToString(mode.Label ?? string.Empty).Trim()
                        })
                        .GroupBy(mode => mode.Code, StringComparer.OrdinalIgnoreCase)
                        .Select(mode => mode.First())
                        .ToList();

                    destination.Apartments = (destination.Apartments ?? new List<SummerApartmentDefinitionDto>())
                        .Where(item => item.FamilyCount > 0 && item.Apartments > 0)
                        .GroupBy(item => item.FamilyCount)
                        .Select(grouped => new SummerApartmentDefinitionDto
                        {
                            FamilyCount = grouped.Key,
                            Apartments = grouped.Sum(item => item.Apartments)
                        })
                        .OrderBy(item => item.FamilyCount)
                        .ToList();

                    destination.FamilyOptions = destination.Apartments
                        .Select(item => item.FamilyCount)
                        .Distinct()
                        .OrderBy(item => item)
                        .ToList();

                    destination.Waves = (destination.Waves ?? new List<SummerWaveDefinitionDto>())
                        .Where(wave => !string.IsNullOrWhiteSpace(wave.Code))
                        .Select(wave => new SummerWaveDefinitionDto
                        {
                            Code = Convert.ToString(wave.Code ?? string.Empty).Trim(),
                            StartsAtLabel = Convert.ToString(wave.StartsAtLabel ?? string.Empty).Trim(),
                            StartsAtIso = Convert.ToString(wave.StartsAtIso ?? string.Empty).Trim()
                        })
                        .GroupBy(wave => wave.Code, StringComparer.OrdinalIgnoreCase)
                        .Select(wave => wave.First())
                        .OrderBy(wave => GetWaveOrder(wave.Code))
                        .ToList();

                    return destination;
                })
                .OrderBy(item => item.CategoryId)
                .ToList();
        }

        private static bool TryResolveWaveStartUtc(
            SummerRule? categoryRule,
            int categoryId,
            int seasonYear,
            string waveCode,
            string? waveLabel,
            out DateTime waveStartUtc)
        {
            if (categoryRule != null
                && categoryRule.TryGetWaveStartUtc(waveCode, out waveStartUtc))
            {
                return true;
            }

            return SummerCalendarRules.TryResolveWaveStartUtc(categoryId, seasonYear, waveCode, waveLabel, out waveStartUtc);
        }

        private static int GetWaveOrder(string? waveCode)
        {
            var normalized = Convert.ToString(waveCode ?? string.Empty).Trim().ToUpperInvariant();
            if (normalized.Length == 0)
            {
                return int.MaxValue;
            }

            var digits = new string(normalized.Where(char.IsDigit).ToArray());
            if (int.TryParse(digits, out var order) && order > 0)
            {
                return order;
            }

            return int.MaxValue;
        }

        private void UpsertField(List<TkmendField> fields, int messageId, string kind, string value)
        {
            var normalizedValue = NormalizePotentialMojibake(value);
            var existing = fields.FirstOrDefault(f => string.Equals(f.FildKind, kind, StringComparison.OrdinalIgnoreCase));
            if (existing == null)
            {
                var field = new TkmendField
                {
                    FildRelted = messageId,
                    FildKind = kind,
                    FildTxt = normalizedValue,
                    InstanceGroupId = 1
                };
                fields.Add(field);
                _connectContext.TkmendFields.Add(field);
            }
            else
            {
                existing.FildTxt = normalizedValue;
            }
        }

        private void UpsertFieldRange(List<TkmendField> fields, int messageId, IEnumerable<string> kinds, string value)
        {
            if (kinds == null)
            {
                return;
            }

            foreach (var kind in kinds)
            {
                if (string.IsNullOrWhiteSpace(kind))
                {
                    continue;
                }

                UpsertField(fields, messageId, kind.Trim(), value);
            }
        }

        private static string NormalizePotentialMojibake(string? value)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return value?.Trim() ?? string.Empty;
            }

            var text = value.Trim();
            if (!LooksLikeMojibake(text))
            {
                return text;
            }

            try
            {
                var latin1 = Encoding.GetEncoding("ISO-8859-1");
                var bytes = latin1.GetBytes(text);
                var decoded = Encoding.UTF8.GetString(bytes).Trim();
                if (ContainsArabicLetters(decoded) && !LooksLikeMojibake(decoded))
                {
                    return decoded;
                }
            }
            catch
            {
                // keep original text when conversion fails
            }

            return text;
        }

        private static bool LooksLikeMojibake(string text)
        {
            return text.IndexOf('Ø') >= 0
                || text.IndexOf('Ù') >= 0
                || text.IndexOf('Ã') >= 0
                || text.IndexOf('Ð') >= 0
                || text.IndexOf('�') >= 0;
        }

        private static bool ContainsArabicLetters(string text)
        {
            foreach (var ch in text)
            {
                if ((ch >= '؀' && ch <= 'ۿ')
                    || (ch >= 'ݐ' && ch <= 'ݿ')
                    || (ch >= 'ࢠ' && ch <= 'ࣿ')
                    || (ch >= 'ﭐ' && ch <= '﷿')
                    || (ch >= 'ﹰ' && ch <= '﻿'))
                {
                    return true;
                }
            }

            return false;
        }

        private static bool ValidateAllowedAttachmentExtensions<T>(List<IFormFile>? files, CommonResponse<T> response)
        {
            if (files == null || files.Count == 0)
            {
                return true;
            }

            var invalidFiles = files
                .Where(file => !AllowedAttachmentExtensions.Contains(Path.GetExtension(file.FileName ?? string.Empty) ?? string.Empty))
                .Select(file => file.FileName ?? string.Empty)
                .Where(name => !string.IsNullOrWhiteSpace(name))
                .ToList();

            if (!invalidFiles.Any())
            {
                return true;
            }

            response.Errors.Add(new Error
            {
                Code = "400",
                Message = $"نوع مرفق غير مدعوم: {string.Join("، ", invalidFiles)}. المسموح فقط: PDF والصور."
            });
            return false;
        }

        private static string? GetFieldValue(IEnumerable<TkmendField> fields, string kind)
        {
            return fields.FirstOrDefault(f => string.Equals(f.FildKind, kind, StringComparison.OrdinalIgnoreCase))?.FildTxt?.Trim();
        }

        private static string GetFirstFieldValue(IEnumerable<TkmendField> fields, params string[] kinds)
        {
            foreach (var kind in kinds)
            {
                var value = GetFieldValue(fields, kind);
                if (!string.IsNullOrWhiteSpace(value))
                {
                    return value;
                }
            }

            return string.Empty;
        }

        private static MessageStatus ResolveMessageStatus(string? rawStatus)
        {
            var value = (rawStatus ?? string.Empty).Trim();
            if (Enum.TryParse<MessageStatus>(value, true, out var parsed))
            {
                return parsed;
            }

            if (byte.TryParse(value, out var statusByte)
                && Enum.IsDefined(typeof(MessageStatus), statusByte))
            {
                return (MessageStatus)statusByte;
            }

            return MessageStatus.New;
        }

        private static bool IsTransferReviewRequired(IEnumerable<TkmendField> fields)
        {
            var workflowState = GetFieldValue(fields, "Summer_WorkflowState") ?? string.Empty;
            return string.Equals(workflowState, TransferReviewRequiredCode, StringComparison.OrdinalIgnoreCase);
        }

        private static string ResolveWorkflowStateLabel(string? workflowStateCode)
        {
            var normalized = (workflowStateCode ?? string.Empty).Trim().ToUpperInvariant();
            return normalized switch
            {
                TransferReviewRequiredCode => "يتطلب مراجعة بعد التحويل",
                TransferReviewResolvedCode => "تمت مراجعة التحويل",
                _ => string.Empty
            };
        }

        private static string ResolveTransferReviewReason(bool wasPaid, bool wasFinalApproved)
        {
            if (wasPaid && wasFinalApproved)
            {
                return "تم التحويل بعد السداد وبعد الاعتماد النهائي، ويلزم متابعة إدارية.";
            }

            if (wasPaid)
            {
                return "تم التحويل بعد سداد الطلب، ويلزم متابعة إدارية.";
            }

            if (wasFinalApproved)
            {
                return "تم التحويل بعد الاعتماد النهائي، ويلزم متابعة إدارية.";
            }

            return "تم التحويل ويلزم متابعة إدارية.";
        }

        private static string ResolveSummaryStatusLabel(
            MessageStatus messageStatus,
            IEnumerable<TkmendField> fields,
            bool needsTransferReview,
            string workflowStateLabel)
        {
            if (needsTransferReview && !string.IsNullOrWhiteSpace(workflowStateLabel))
            {
                return workflowStateLabel;
            }

            var adminAction = NormalizeActionCode(GetFieldValue(fields, "Summer_AdminLastAction"));
            return adminAction switch
            {
                "FINAL_APPROVE" => "اعتماد نهائي",
                "COMMENT" => "رد إداري",
                "MANUAL_CANCEL" => "إلغاء يدوي",
                "APPROVE_TRANSFER" => "اعتماد تحويل",
                _ => messageStatus.GetDescription()
            };
        }

        private static string ResolveDashboardStatusLabel(SummerRequestSummaryDto request)
        {
            var explicitLabel = (request?.StatusLabel ?? string.Empty).Trim();
            if (!string.IsNullOrWhiteSpace(explicitLabel))
            {
                return explicitLabel;
            }

            var status = ResolveMessageStatus(request?.Status);
            return status.GetDescription();
        }

        private static string ResolveDashboardStatusCode(string label)
        {
            var token = NormalizeSearchToken(label);
            return token switch
            {
                "جديد" => "NEW",
                "جاريالتنفيذ" => "IN_PROGRESS",
                "ردإداري" or "رداداري" => "ADMIN_REPLY",
                "تمالرد" => "REPLIED",
                "اعتمادنهائي" => "FINAL_APPROVE",
                "اعتمادتحويل" => "APPROVE_TRANSFER",
                "الغاءيدوي" => "MANUAL_CANCEL",
                "مرفوض" or "ملغي" => "REJECTED",
                "يتطلبمراجعةبعدالتحويل" => TransferReviewRequiredCode,
                "تمتمراجعةالتحويل" => TransferReviewResolvedCode,
                _ => token.ToUpperInvariant()
            };
        }

        private static string NormalizeActionCode(string? actionCode)
        {
            var token = NormalizeSearchToken(actionCode);
            return token switch
            {
                "finalapprove" or "approve" or "اعتمادنهائي" or "اعتماد" or "final_approve" => "FINAL_APPROVE",
                "manual_cancel" or "cancel" or "الغاءيدوي" or "الغاء" => "MANUAL_CANCEL",
                "comment" or "reply" or "تعليق" or "رد" => "COMMENT",
                "approvetransfer" or "transferapprove" or "اعتمادالتحويل" => "APPROVE_TRANSFER",
                _ => string.Empty
            };
        }

        private static string NormalizeSearchToken(string? value)
        {
            return string.Concat((value ?? string.Empty)
                .Trim()
                .ToLowerInvariant()
                .Where(ch => !char.IsWhiteSpace(ch)));
        }

        private static int ParseInt(string? value, int fallback = 0)
        {
            return int.TryParse((value ?? string.Empty).Trim(), out var parsed) ? parsed : fallback;
        }

        private static DateTime ResolvePaymentDueAtUtc(Message message, IEnumerable<TkmendField> fields)
        {
            var fromField = ParseDate(GetFieldValue(fields, "Summer_PaymentDueAtUtc"));
            if (fromField.HasValue)
            {
                return fromField.Value;
            }

            var createdAtUtc = message.CreatedDate.Kind == DateTimeKind.Utc
                ? message.CreatedDate
                : DateTime.SpecifyKind(message.CreatedDate, DateTimeKind.Utc);
            return SummerCalendarRules.CalculatePaymentDueUtc(createdAtUtc);
        }

        private static DateTime? ParseDate(string? value)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return null;
            }

            if (!DateTime.TryParse(value, out var parsed))
            {
                return null;
            }

            return parsed.Kind == DateTimeKind.Utc
                ? parsed
                : DateTime.SpecifyKind(parsed, DateTimeKind.Utc).ToUniversalTime();
        }

        private sealed class SummerDestinationCatalogPayload
        {
            public int SeasonYear { get; set; }
            public List<SummerDestinationConfigDto>? Destinations { get; set; }
        }

        private sealed class SummerRule
        {
            public SummerRule(
                int maxExtra,
                Dictionary<int, int> capacityByFamily,
                Dictionary<string, DateTime> waveStartByCode)
            {
                MaxExtra = maxExtra;
                CapacityByFamily = capacityByFamily;
                WaveStartByCode = waveStartByCode;
            }

            public int MaxExtra { get; }
            public Dictionary<int, int> CapacityByFamily { get; }
            public Dictionary<string, DateTime> WaveStartByCode { get; }

            public bool TryGetWaveStartUtc(string waveCode, out DateTime waveStartUtc)
            {
                return WaveStartByCode.TryGetValue((waveCode ?? string.Empty).Trim(), out waveStartUtc);
            }
        }
    }
}




