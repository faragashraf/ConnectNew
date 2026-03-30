using System.Data;
using System.Globalization;
using System.Text;
using System.Text.Json;
using ENPO.Dto.HubSync;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.Logging;
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

namespace Persistence.Services
{
    public class SummerWorkflowService
    {
        private readonly ConnectContext _connectContext;
        private readonly Attach_HeldContext _attachHeldContext;
        private readonly GPAContext _gPAContext;
        private readonly helperService _helperService;
        private readonly IConnectNotificationService _notificationService;
        private readonly ApplicationConfig _applicationConfig;
        private readonly ILogger<SummerWorkflowService> _logger;

        private const int CapacityLockTimeoutMs = 15000;
        private const int AdminActionGateTimeoutMs = 10000;
        private const int AdminActionLockTimeoutMs = 15000;
        private const string SummerDynamicApplicationId = SummerWorkflowDomainConstants.DynamicApplicationId;
        private const string SummerDestinationCatalogMend = SummerWorkflowDomainConstants.DestinationCatalogMend;
        private const string TransferReviewRequiredCode = SummerWorkflowDomainConstants.TransferReviewRequiredCode;
        private const string TransferReviewResolvedCode = SummerWorkflowDomainConstants.TransferReviewResolvedCode;
        private const string RequestCreatedAtUtcFieldKind = SummerWorkflowDomainConstants.RequestCreatedAtUtcFieldKind;
        private const string PaymentDueAtUtcFieldKind = SummerWorkflowDomainConstants.PaymentDueAtUtcFieldKind;
        private const string PaidAtUtcFieldKind = SummerWorkflowDomainConstants.PaidAtUtcFieldKind;
        private const string PaymentStatusFieldKind = SummerWorkflowDomainConstants.PaymentStatusFieldKind;
        private const string ActionTypeFieldKind = SummerWorkflowDomainConstants.ActionTypeFieldKind;
        private static readonly string[] WaveCodeFieldKinds = SummerWorkflowDomainConstants.WaveCodeFieldKinds;
        private static readonly string[] WaveLabelFieldKinds = SummerWorkflowDomainConstants.WaveLabelFieldKinds;
        private static readonly string[] FamilyCountFieldKinds = SummerWorkflowDomainConstants.FamilyCountFieldKinds;
        private static readonly string[] ExtraCountFieldKinds = SummerWorkflowDomainConstants.ExtraCountFieldKinds;
        private static readonly string[] DestinationIdFieldKinds = SummerWorkflowDomainConstants.DestinationIdFieldKinds;
        private static readonly string[] DestinationNameFieldKinds = SummerWorkflowDomainConstants.DestinationNameFieldKinds;
        private static readonly string[] EmployeeIdFieldKinds = SummerWorkflowDomainConstants.EmployeeIdFieldKinds;
        private static readonly string[] EmployeeNameFieldKinds = SummerWorkflowDomainConstants.EmployeeNameFieldKinds;
        private static readonly string[] EmployeeNationalIdFieldKinds = SummerWorkflowDomainConstants.EmployeeNationalIdFieldKinds;
        private static readonly string[] EmployeePhoneFieldKinds = SummerWorkflowDomainConstants.EmployeePhoneFieldKinds;
        private static readonly string[] EmployeeExtraPhoneFieldKinds = SummerWorkflowDomainConstants.EmployeeExtraPhoneFieldKinds;
        private static readonly string[] SummerNotificationGroups = { "CONNECT", "CONNECT - TEST" };
        private static readonly HashSet<string> AllowedAttachmentExtensions = new(StringComparer.OrdinalIgnoreCase)
        {
            ".pdf", ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"
        };
        private static readonly TimeZoneInfo SummerBusinessTimeZone = ResolveSummerBusinessTimeZone();
        private static readonly SummerAdminActionExecutionGate AdminActionExecutionGate = new();
        private static readonly SummerRequestWorkflowEngine AdminActionWorkflowEngine = new();
        private const string DefaultRequestUpdateSource = "SUMMER_WORKFLOW";

        public SummerWorkflowService(
            ConnectContext connectContext,
            Attach_HeldContext attachHeldContext,
            GPAContext gpaContext,
            helperService helperService,
            IConnectNotificationService notificationService,
            IOptions<ApplicationConfig> options,
            ILogger<SummerWorkflowService> logger)
        {
            _connectContext = connectContext;
            _attachHeldContext = attachHeldContext;
            _gPAContext = gpaContext;
            _helperService = helperService;
            _notificationService = notificationService;
            _applicationConfig = options?.Value ?? new ApplicationConfig();
            _logger = logger;
        }

        public async Task<CommonResponse<IEnumerable<SummerRequestSummaryDto>>> GetMyRequestsAsync(string userId, int seasonYear, int? messageId = null)
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

                var scopedMessageId = messageId.HasValue && messageId.Value > 0 ? messageId.Value : 0;
                var messages = await _connectContext.Messages
                    .AsNoTracking()
                    .Where(m => summerCategoryIds.Contains(m.CategoryCd)
                        && (scopedMessageId <= 0 || m.MessageId == scopedMessageId))
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
                    var employeeId = GetFirstFieldValue(messageFields, EmployeeIdFieldKinds);
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
                        WaveCode = GetFirstFieldValue(messageFields, WaveCodeFieldKinds),
                        EmployeeId = employeeId,
                        EmployeeName = GetFirstFieldValue(messageFields, EmployeeNameFieldKinds),
                        EmployeeNationalId = GetFirstFieldValue(messageFields, EmployeeNationalIdFieldKinds),
                        EmployeePhone = GetFirstFieldValue(messageFields, EmployeePhoneFieldKinds),
                        EmployeeExtraPhone = GetFirstFieldValue(messageFields, EmployeeExtraPhoneFieldKinds),
                        Status = message.Status.ToString(),
                        StatusLabel = ResolveSummaryStatusLabel(message.Status, messageFields, needsTransferReview, workflowStateLabel),
                        WorkflowStateCode = workflowStateCode,
                        WorkflowStateLabel = workflowStateLabel,
                        NeedsTransferReview = needsTransferReview,
                        CreatedAt = ResolveRequestCreatedAtUtc(message, messageFields),
                        PaymentDueAtUtc = ParseDate(GetFieldValue(messageFields, PaymentDueAtUtcFieldKind)),
                        PaidAtUtc = ParseDate(GetFieldValue(messageFields, PaidAtUtcFieldKind)),
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
                var scopedMessageId = query.MessageId.HasValue && query.MessageId.Value > 0
                    ? query.MessageId.Value
                    : 0;
                var messages = await _connectContext.Messages
                    .AsNoTracking()
                    .Where(m => summerCategoryIds.Contains(m.CategoryCd)
                        && (scopedMessageId <= 0 || m.MessageId == scopedMessageId)
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
                        WaveCode = GetFirstFieldValue(messageFields, WaveCodeFieldKinds),
                        EmployeeId = GetFirstFieldValue(messageFields, EmployeeIdFieldKinds),
                        EmployeeName = GetFirstFieldValue(messageFields, EmployeeNameFieldKinds),
                        EmployeeNationalId = GetFirstFieldValue(messageFields, EmployeeNationalIdFieldKinds),
                        EmployeePhone = GetFirstFieldValue(messageFields, EmployeePhoneFieldKinds),
                        EmployeeExtraPhone = GetFirstFieldValue(messageFields, EmployeeExtraPhoneFieldKinds),
                        Status = message.Status.ToString(),
                        StatusLabel = ResolveSummaryStatusLabel(message.Status, messageFields, needsTransferReview, workflowStateLabel),
                        WorkflowStateCode = workflowStateCode,
                        WorkflowStateLabel = workflowStateLabel,
                        NeedsTransferReview = needsTransferReview,
                        CreatedAt = ResolveRequestCreatedAtUtc(message, messageFields),
                        PaymentDueAtUtc = ParseDate(GetFieldValue(messageFields, PaymentDueAtUtcFieldKind)),
                        PaidAtUtc = ParseDate(GetFieldValue(messageFields, PaidAtUtcFieldKind)),
                        TransferUsed = ParseInt(GetFieldValue(messageFields, "Summer_TransferCount"), 0) > 0
                    });
                }

                var normalizedWaveCode = (query.WaveCode ?? string.Empty).Trim();
                var normalizedEmployeeId = (query.EmployeeId ?? string.Empty).Trim();
                var requestedStatusRaw = (query.Status ?? string.Empty).Trim();
                var normalizedStatus = NormalizeSearchToken(query.Status);
                var requestedMessageStatus = ResolveRequestedStatusMessageStatus(requestedStatusRaw);
                var requestedStatusCode = ResolveDashboardStatusCode(requestedStatusRaw);
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
                        if (byte.TryParse(requestedStatusRaw, out var statusByte))
                        {
                            if ((byte)ResolveMessageStatus(item.Status) != statusByte)
                            {
                                return false;
                            }
                        }
                        else
                        {
                            var itemMessageStatus = ResolveMessageStatus(item.Status);
                            var itemStatusCode = ResolveDashboardStatusCode(ResolveDashboardStatusLabel(item));
                            var matchedByCanonicalStatus =
                                (requestedMessageStatus.HasValue && itemMessageStatus == requestedMessageStatus.Value)
                                || (!string.IsNullOrWhiteSpace(requestedStatusCode)
                                    && string.Equals(itemStatusCode, requestedStatusCode, StringComparison.OrdinalIgnoreCase));

                            if (!matchedByCanonicalStatus)
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
                    }

                    if (!string.IsNullOrWhiteSpace(normalizedPaymentState))
                    {
                        var isPaid = item.PaidAtUtc.HasValue;
                        var isOverdueUnpaid = !isPaid
                            && item.PaymentDueAtUtc.HasValue
                            && item.PaymentDueAtUtc.Value < nowUtc;

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
                            $"{item.MessageId} {item.RequestRef} {item.EmployeeName} {item.EmployeeId} {item.EmployeeNationalId} {item.EmployeePhone} {item.CategoryName} {item.WaveCode}");
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
                    RejectedCount = requests.Count(r =>
                        string.Equals(
                            ResolveDashboardStatusCode(ResolveDashboardStatusLabel(r)),
                            "REJECTED",
                            StringComparison.OrdinalIgnoreCase)),
                    PaidCount = requests.Count(r => r.PaidAtUtc.HasValue),
                    UnpaidCount = requests.Count(r => !r.PaidAtUtc.HasValue),
                    OverdueUnpaidCount = requests.Count(r =>
                        !r.PaidAtUtc.HasValue
                        && r.PaymentDueAtUtc.HasValue
                        && r.PaymentDueAtUtc.Value < nowUtc),
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

                _logger.LogInformation(
                    "Summer admin dashboard computed. UserId={UserId}, SeasonYear={SeasonYear}, ScopeCategoryId={ScopeCategoryId}, ScopeWaveCode={ScopeWaveCode}, Total={Total}, Unpaid={Unpaid}, OverdueUnpaid={OverdueUnpaid}",
                    userId,
                    seasonYear,
                    categoryId,
                    normalizedWaveCode,
                    dashboard.TotalRequests,
                    dashboard.UnpaidCount,
                    dashboard.OverdueUnpaidCount);

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

                _logger.LogInformation(
                    "Summer admin action started. MessageId={MessageId}, ActionCode={ActionCode}, AdminUserId={AdminUserId}",
                    request.MessageId,
                    actionCode,
                    userId);

                if (!_helperService.ValidateFileSizes(request.files, response))
                {
                    return response;
                }

                if (!ValidateAllowedAttachmentExtensions(request.files, response))
                {
                    return response;
                }

                var summerRules = await GetSummerRulesAsync();
                var message = await _connectContext.Messages
                    .AsNoTracking()
                    .FirstOrDefaultAsync(m => m.MessageId == request.MessageId);
                if (message == null || !summerRules.ContainsKey(message.CategoryCd))
                {
                    response.Errors.Add(new Error { Code = "404", Message = "طلب المصيف غير موجود." });
                    return response;
                }

                if (!await CanUserManageMessageAsync(userId, message))
                {
                    _logger.LogWarning(
                        "Summer admin action rejected due to missing admin scope. MessageId={MessageId}, ActionCode={ActionCode}, UserId={UserId}, AssignedSectorId={AssignedSectorId}, CurrentResponsibleSectorId={CurrentResponsibleSectorId}",
                        message.MessageId,
                        actionCode,
                        userId,
                        message.AssignedSectorId,
                        message.CurrentResponsibleSectorId);
                    response.Errors.Add(new Error { Code = "403", Message = "غير مصرح لك بتنفيذ هذا الإجراء على الطلب." });
                    return response;
                }

                var comment = (request.Comment ?? string.Empty).Trim();
                var attemptedAtUtc = DateTime.UtcNow;

                await using var adminActionGateLease = await AdminActionExecutionGate.TryEnterAsync(request.MessageId, AdminActionGateTimeoutMs);
                if (adminActionGateLease == null)
                {
                    _logger.LogWarning(
                        "Summer admin action blocked by in-process concurrency gate. MessageId={MessageId}, UserId={UserId}, AttemptedAction={AttemptedAction}, CurrentStatus={CurrentStatus}, AttemptedAtUtc={AttemptedAtUtc}",
                        request.MessageId,
                        userId,
                        actionCode,
                        message.Status,
                        attemptedAtUtc);
                    response.Errors.Add(new Error
                    {
                        Code = "409",
                        Message = "تعذر تنفيذ الإجراء حالياً لوجود عملية متزامنة على نفس الطلب. برجاء المحاولة بعد ثوانٍ."
                    });
                    return response;
                }

                if (!await AcquireAdminActionLockAsync(request.MessageId))
                {
                    _logger.LogWarning(
                        "Summer admin action blocked by database lock timeout. MessageId={MessageId}, UserId={UserId}, AttemptedAction={AttemptedAction}, CurrentStatus={CurrentStatus}, AttemptedAtUtc={AttemptedAtUtc}",
                        request.MessageId,
                        userId,
                        actionCode,
                        message.Status,
                        attemptedAtUtc);
                    response.Errors.Add(new Error
                    {
                        Code = "409",
                        Message = "تعذر تنفيذ الإجراء حالياً لوجود عملية متزامنة على نفس الطلب. برجاء المحاولة بعد ثوانٍ."
                    });
                    return response;
                }

                var messageToProcess = await _connectContext.Messages.FirstOrDefaultAsync(m => m.MessageId == request.MessageId);
                if (messageToProcess == null)
                {
                    response.Errors.Add(new Error { Code = "404", Message = "طلب المصيف غير موجود." });
                    return response;
                }

                var workflowResolution = AdminActionWorkflowEngine.Resolve(messageToProcess.Status, actionCode);
                if (!workflowResolution.IsAllowed)
                {
                    _logger.LogWarning(
                        "Summer admin action blocked by workflow engine. MessageId={MessageId}, UserId={UserId}, AttemptedAction={AttemptedAction}, CurrentStatus={CurrentStatus}, TargetState={TargetState}, AttemptedAtUtc={AttemptedAtUtc}, Reason={Reason}",
                        request.MessageId,
                        userId,
                        actionCode,
                        messageToProcess.Status,
                        workflowResolution.TargetState,
                        attemptedAtUtc,
                        workflowResolution.ErrorMessage);
                    response.Errors.Add(new Error
                    {
                        Code = "409",
                        Message = workflowResolution.ErrorMessage
                    });
                    return response;
                }

                message = messageToProcess;
                if (actionCode == SummerAdminActionCatalog.Codes.ApproveTransfer)
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
                    },
                    userId,
                    ip,
                    notifyResponsibleAdmins: false,
                    notifyOwner: true,
                    initiatedAdminActionCode: actionCode,
                    initiatedByUserId: userId,
                    previousStatusForAdminAction: messageToProcess.Status,
                    adminActionComment: comment,
                    adminActionAtUtc: attemptedAtUtc);

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
                        await NotifyEmployeeOnAdminActionAsync(transferResponse.Data, actionCode, comment, includeSignalR: false);
                    }

                    _logger.LogInformation(
                        "Summer admin transfer action completed. MessageId={MessageId}, ActionCode={ActionCode}, NotifiedOwnerOnly={NotifiedOwnerOnly}",
                        request.MessageId,
                        actionCode,
                        true);
                    return response;
                }

                var fields = await _connectContext.TkmendFields.Where(f => f.FildRelted == message.MessageId).ToListAsync();

                await using var connectTx = await _connectContext.Database.BeginTransactionAsync(IsolationLevel.Serializable);
                await using var attachTx = await _attachHeldContext.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted);
                try
                {
                    var previousState = message.Status;
                    var replyMessage = string.Empty;
                    if (actionCode == SummerAdminActionCatalog.Codes.FinalApprove)
                    {
                        message.Status = workflowResolution.TargetState ?? MessageStatus.Replied;

                        var paymentStatusToken = NormalizeSearchToken(GetFieldValue(fields, PaymentStatusFieldKind));
                        var needsRePaymentToken = NormalizeSearchToken(GetFieldValue(fields, "Summer_TransferRequiresRePayment"));
                        var shouldRestorePaidState = paymentStatusToken == "pendingpayment"
                            || needsRePaymentToken == "true"
                            || needsRePaymentToken == "1";
                        var restorePaidNote = string.Empty;
                        if (shouldRestorePaidState)
                        {
                            var paidAt = ParseDate(GetFieldValue(fields, PaidAtUtcFieldKind)) ?? DateTime.UtcNow;
                            UpsertField(fields, message.MessageId, PaymentStatusFieldKind, "PAID");
                            UpsertField(fields, message.MessageId, PaidAtUtcFieldKind, paidAt.ToString("o"));
                            UpsertField(fields, message.MessageId, "Summer_TransferRequiresRePayment", "false");
                            UpsertField(fields, message.MessageId, "Summer_TransferRePaymentReason", "تم اعتماد الطلب نهائيًا من الإدارة، وتمت إعادة حالة السداد إلى مسدد.");
                            restorePaidNote = " وتمت إعادة حالة السداد إلى مسدد تلقائياً.";
                        }

                        if (IsTransferReviewRequired(fields))
                        {
                            UpsertField(fields, message.MessageId, "Summer_WorkflowState", TransferReviewResolvedCode);
                            UpsertField(fields, message.MessageId, "Summer_WorkflowStateLabel", ResolveWorkflowStateLabel(TransferReviewResolvedCode));
                            UpsertField(fields, message.MessageId, "Summer_WorkflowStateAtUtc", DateTime.UtcNow.ToString("o"));
                        }

                        replyMessage = string.IsNullOrWhiteSpace(comment)
                            ? $"تم اعتماد الطلب نهائياً من إدارة المصايف.{restorePaidNote}"
                            : $"تم اعتماد الطلب نهائياً من إدارة المصايف.{restorePaidNote} تعليق الإدارة: {comment}";
                    }
                    else if (actionCode == SummerAdminActionCatalog.Codes.ManualCancel)
                    {
                        message.Status = workflowResolution.TargetState ?? MessageStatus.Rejected;
                        UpsertField(fields, message.MessageId, "Summer_CancelReason", string.IsNullOrWhiteSpace(comment) ? "إلغاء يدوي من إدارة المصايف." : comment);
                        UpsertField(fields, message.MessageId, "Summer_CancelledAtUtc", DateTime.UtcNow.ToString("o"));
                        UpsertField(fields, message.MessageId, PaymentStatusFieldKind, "CANCELLED_ADMIN");
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
                    else if (actionCode == SummerAdminActionCatalog.Codes.Comment)
                    {
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

                    ApplyAdminActionAuditFields(
                        fields,
                        message.MessageId,
                        actionCode,
                        previousState,
                        message.Status,
                        userId,
                        DateTime.UtcNow,
                        comment);

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

                if (actionCode == SummerAdminActionCatalog.Codes.ManualCancel && response.Data != null)
                {
                    await PublishCapacityUpdateAsync(response.Data.CategoryId, response.Data.WaveCode, "ADMIN_CANCEL");
                }

                await PublishRequestUpdateAsync(
                    request.MessageId,
                    actionCode,
                    notifyResponsibleAdmins: false,
                    notifyOwner: true,
                    source: "ADMIN_ACTION");
            }
            catch (Exception ex)
            {
                response.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });
            }

            return response;
        }

        private async Task<bool> CanUserManageMessageAsync(string userId, Message message)
        {
            if (message == null)
            {
                return false;
            }

            var normalizedUserId = (userId ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(normalizedUserId))
            {
                return false;
            }

            var userUnitIds = await GetActiveUserUnitIdsAsync(normalizedUserId);
            if (!userUnitIds.Any())
            {
                return false;
            }

            var assignedSectorId = (message.AssignedSectorId ?? string.Empty).Trim();
            var currentResponsibleSectorId = (message.CurrentResponsibleSectorId ?? string.Empty).Trim();

            return userUnitIds.Contains(assignedSectorId, StringComparer.OrdinalIgnoreCase)
                || userUnitIds.Contains(currentResponsibleSectorId, StringComparer.OrdinalIgnoreCase);
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
                    UpsertField(fields, message.MessageId, ActionTypeFieldKind, "CANCEL");
                    UpsertField(fields, message.MessageId, "Summer_CancelReason", (request.Reason ?? string.Empty).Trim());
                    UpsertField(fields, message.MessageId, "Summer_CancelledAtUtc", DateTime.UtcNow.ToString("o"));
                    UpsertField(fields, message.MessageId, PaymentStatusFieldKind, "CANCELLED");

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

                await PublishCapacityUpdateAsync(summary.CategoryId, summary.WaveCode, "CANCEL");
                await PublishRequestUpdateAsync(summary.MessageId, "CANCEL", source: "OWNER_CANCEL");
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
                var rawCreatedAtField = GetFieldValue(fields, RequestCreatedAtUtcFieldKind);
                var requestCreatedAtRawUtc = ResolveRequestCreatedAtUtc(message, fields);
                var requestCreatedAtUtc = TruncateToWholeSecondUtc(requestCreatedAtRawUtc);
                var dueAtRawUtc = ResolvePaymentDueAtUtc(message, fields);
                var dueAtUtc = TruncateToWholeSecondUtc(dueAtRawUtc);
                var paidAtRawUtc = request.PaidAtUtc?.UtcDateTime ?? DateTime.UtcNow;
                var paidAtUtc = TruncateToWholeSecondUtc(paidAtRawUtc);
                var nowUtc = TruncateToWholeSecondUtc(DateTime.UtcNow);
                var hasCreatedAtAnchor = ParseDate(rawCreatedAtField).HasValue;

                _logger.LogInformation(
                    "Summer payment validation start. MessageId={MessageId}, PaidAtInputRaw={PaidAtInputRaw}, PaidAtRawUtc={PaidAtRawUtc:o}, PaidAtUtc={PaidAtUtc:o}, CreatedAtAnchorRaw={CreatedAtAnchorRaw}, CreatedAtAnchorFound={CreatedAtAnchorFound}, ResolvedCreatedAtRawUtc={ResolvedCreatedAtRawUtc:o}, ResolvedCreatedAtUtc={ResolvedCreatedAtUtc:o}, DueAtRawUtc={DueAtRawUtc:o}, DueAtUtc={DueAtUtc:o}, PaidAtOffset={PaidAtOffset}, PaidAtProvided={PaidAtProvided}",
                    message.MessageId,
                    request.PaidAtUtc?.ToString("o"),
                    paidAtRawUtc,
                    paidAtUtc,
                    rawCreatedAtField,
                    hasCreatedAtAnchor,
                    requestCreatedAtRawUtc,
                    requestCreatedAtUtc,
                    dueAtRawUtc,
                    dueAtUtc,
                    request.PaidAtUtc?.Offset.ToString(),
                    request.PaidAtUtc.HasValue);

                if (paidAtUtc > nowUtc)
                {
                    _logger.LogWarning(
                        "Summer payment rejected: paid date in future. MessageId={MessageId}, PaidAtUtc={PaidAtUtc:o}, NowUtc={NowUtc:o}",
                        message.MessageId,
                        paidAtUtc,
                        nowUtc);
                    response.Errors.Add(new Error
                    {
                        Code = "400",
                        Message = "لا يمكن إدخال تاريخ سداد في المستقبل."
                    });
                    return response;
                }

                if (paidAtUtc > dueAtUtc)
                {
                    _logger.LogWarning(
                        "Summer payment rejected: payment window expired. MessageId={MessageId}, PaidAtUtc={PaidAtUtc:o}, DueAtUtc={DueAtUtc:o}, DueAtRawUtc={DueAtRawUtc:o}",
                        message.MessageId,
                        paidAtUtc,
                        dueAtUtc,
                        dueAtRawUtc);
                    response.Errors.Add(new Error
                    {
                        Code = "400",
                        Message = $"انتهت مهلة السداد. كان الموعد النهائي {dueAtUtc:yyyy-MM-dd HH:mm} (UTC)."
                    });
                    return response;
                }

                using var connectTx = await _connectContext.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted);
                using var attachTx = await _attachHeldContext.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted);
                try
                {
                    UpsertField(fields, message.MessageId, ActionTypeFieldKind, "PAY");
                    UpsertField(fields, message.MessageId, PaymentStatusFieldKind, "PAID");
                    UpsertField(fields, message.MessageId, RequestCreatedAtUtcFieldKind, requestCreatedAtUtc.ToString("o"));
                    UpsertField(fields, message.MessageId, PaidAtUtcFieldKind, paidAtUtc.ToString("o"));
                    UpsertField(fields, message.MessageId, PaymentDueAtUtcFieldKind, dueAtUtc.ToString("o"));
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
                    _logger.LogInformation(
                        "Summer payment accepted. MessageId={MessageId}, PaidAtUtc={PaidAtUtc:o}, CreatedAtUtc={CreatedAtUtc:o}, DueAtUtc={DueAtUtc:o}",
                        message.MessageId,
                        paidAtUtc,
                        requestCreatedAtUtc,
                        dueAtUtc);
                }
                catch
                {
                    await attachTx.RollbackAsync();
                    await connectTx.RollbackAsync();
                    throw;
                }

                response.Data = await BuildSummaryAsync(message.MessageId);
                await PublishRequestUpdateAsync(message.MessageId, "PAY", source: "OWNER_PAY");
            }
            catch (Exception ex)
            {
                response.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });
            }

            return response;
        }

        public async Task<CommonResponse<SummerRequestSummaryDto>> TransferAsync(
            SummerTransferRequest request,
            string userId,
            string ip,
            bool notifyResponsibleAdmins = true,
            bool notifyOwner = true,
            string? initiatedAdminActionCode = null,
            string? initiatedByUserId = null,
            MessageStatus? previousStatusForAdminAction = null,
            string? adminActionComment = null,
            DateTime? adminActionAtUtc = null)
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
                var normalizedAdminActionCode = NormalizeActionCode(initiatedAdminActionCode);
                var shouldRecordAdminAction = !string.IsNullOrWhiteSpace(normalizedAdminActionCode)
                    && !string.IsNullOrWhiteSpace(initiatedByUserId);

                var fields = await _connectContext.TkmendFields.Where(f => f.FildRelted == message.MessageId).ToListAsync();
                var paymentStatus = (GetFieldValue(fields, PaymentStatusFieldKind) ?? string.Empty).Trim();
                var paidAtUtc = ParseDate(GetFieldValue(fields, PaidAtUtcFieldKind));
                var adminLastAction = (GetFieldValue(fields, "Summer_AdminLastAction") ?? string.Empty).Trim();
                var wasPaid = paidAtUtc.HasValue || string.Equals(paymentStatus, "PAID", StringComparison.OrdinalIgnoreCase);
                var wasFinalApproved = string.Equals(adminLastAction, SummerAdminActionCatalog.Codes.FinalApprove, StringComparison.OrdinalIgnoreCase)
                    || message.Status == MessageStatus.Replied;
                var requiresTransferReview = wasPaid || wasFinalApproved;
                var transferCount = ParseInt(GetFieldValue(fields, "Summer_TransferCount"), 0);
                if (transferCount > 0)
                {
                    response.Errors.Add(new Error { Code = "400", Message = "التحويل مسموح مرة واحدة فقط خلال الموسم." });
                    return response;
                }

                var employeeId = GetFirstFieldValue(fields, EmployeeIdFieldKinds);
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
                    UpsertField(fields, message.MessageId, ActionTypeFieldKind, "TRANSFER");
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
                        UpsertField(fields, message.MessageId, PaymentStatusFieldKind, "PENDING_PAYMENT");
                        UpsertField(fields, message.MessageId, PaidAtUtcFieldKind, string.Empty);
                        UpsertField(fields, message.MessageId, PaymentDueAtUtcFieldKind, reopenedDueAt.ToString("o"));
                        UpsertField(fields, message.MessageId, "Summer_TransferRequiresRePayment", "true");
                        UpsertField(fields, message.MessageId, "Summer_TransferRePaymentReason", "تم تغيير عدد الأفراد بعد السداد، ويلزم إعادة السداد.");
                    }

                    if (shouldRecordAdminAction)
                    {
                        var previousState = previousStatusForAdminAction ?? message.Status;
                        var actorUserId = string.IsNullOrWhiteSpace(initiatedByUserId) ? userId : initiatedByUserId.Trim();
                        ApplyAdminActionAuditFields(
                            fields,
                            message.MessageId,
                            normalizedAdminActionCode,
                            previousState,
                            message.Status,
                            actorUserId,
                            adminActionAtUtc ?? DateTime.UtcNow,
                            adminActionComment);
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
                    await PublishCapacityUpdateAsync(fromCategory, fromWave, "TRANSFER_FROM");
                    await PublishCapacityUpdateAsync(request.ToCategoryId, normalizedTargetWave, "TRANSFER_TO");
                    await PublishRequestUpdateAsync(
                        message.MessageId,
                        "TRANSFER",
                        notifyResponsibleAdmins: notifyResponsibleAdmins,
                        notifyOwner: notifyOwner,
                        source: "TRANSFER");
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

                    if (ParseDate(GetFieldValue(fields, PaidAtUtcFieldKind)).HasValue)
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
                    UpsertField(fields, message.MessageId, ActionTypeFieldKind, "AUTO_CANCEL_PAYMENT_TIMEOUT");
                    UpsertField(fields, message.MessageId, "Summer_CancelReason", autoCancelReason);
                    UpsertField(fields, message.MessageId, "Summer_CancelledAtUtc", nowUtc.ToString("o"));
                    UpsertField(fields, message.MessageId, PaymentStatusFieldKind, "CANCELLED_AUTO");
                    UpsertField(fields, message.MessageId, PaymentDueAtUtcFieldKind, dueAt.ToString("o"));

                    await AddReplyWithAttachmentsAsync(
                        message.MessageId,
                        autoCancelReason,
                        "SYSTEM",
                        "127.0.0.1",
                        null);

                    await _connectContext.SaveChangesAsync(cancellationToken);
                    await connectTx.CommitAsync(cancellationToken);

                    notifyEmployeeId = GetFirstFieldValue(fields, EmployeeIdFieldKinds);
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

                await PublishCapacityUpdateAsync(notifyCategoryId, notifyWaveCode, "AUTO_CANCEL");
                await PublishRequestUpdateAsync(cancelledMessageId, "AUTO_CANCEL", source: "AUTO_CANCEL");
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

            _logger.LogInformation(
                "Summer admin-action notification prepared. MessageId={MessageId}, ActionCode={ActionCode}, EmployeeId={EmployeeId}, IncludeSignalR={IncludeSignalR}",
                summary.MessageId,
                actionCode,
                summary.EmployeeId,
                includeSignalR);
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
                _logger.LogInformation(
                    "Summer SMS notification dispatch. MessageId={MessageId}, EmployeeId={EmployeeId}, Mobile={Mobile}",
                    summary.MessageId,
                    summary.EmployeeId,
                    mobile);
                await _notificationService.SendSmsAsync(new SmsDispatchRequest
                {
                    MobileNumber = mobile,
                    Message = smsMessage,
                    UserId = string.IsNullOrWhiteSpace(summary.EmployeeId) ? "SYSTEM" : summary.EmployeeId.Trim(),
                    ReferenceNo = string.IsNullOrWhiteSpace(summary.RequestRef) ? $"SUMMER-{summary.MessageId}" : summary.RequestRef.Trim()
                });
            }
            else
            {
                _logger.LogInformation(
                    "Summer SMS notification skipped. MessageId={MessageId}, EmployeeId={EmployeeId}, HasMobile={HasMobile}, HasSmsMessage={HasSmsMessage}",
                    summary.MessageId,
                    summary.EmployeeId,
                    !string.IsNullOrWhiteSpace(mobile),
                    !string.IsNullOrWhiteSpace(smsMessage));
            }

            if (!includeSignalR || string.IsNullOrWhiteSpace(summary.EmployeeId) || string.IsNullOrWhiteSpace(signalRMessage))
            {
                _logger.LogInformation(
                    "Summer SignalR notification skipped. MessageId={MessageId}, EmployeeId={EmployeeId}, IncludeSignalR={IncludeSignalR}, HasSignalRMessage={HasSignalRMessage}",
                    summary.MessageId,
                    summary.EmployeeId,
                    includeSignalR,
                    !string.IsNullOrWhiteSpace(signalRMessage));
                return;
            }

            _logger.LogInformation(
                "Summer SignalR notification dispatch to owner. MessageId={MessageId}, EmployeeId={EmployeeId}, Title={Title}",
                summary.MessageId,
                summary.EmployeeId,
                signalRTitle);
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
            return SummerAdminActionCatalog.ResolveLabel(actionCode);
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
                var employee = GetFirstFieldValue(messageFields, EmployeeIdFieldKinds);
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
                .AnyAsync(f => activeMessageIds.Contains(f.FildRelted)
                               && (f.FildKind == "Emp_Id" || f.FildKind == "SUM2026_OwnerFileNumber")
                               && f.FildTxt == employeeId);
        }

        private async Task<List<int>> GetActiveMessageIdsForWaveAsync(int categoryId, string waveCode, int? excludedMessageId = null)
        {
            var matchingWaveMessageIds = await _connectContext.TkmendFields
                .AsNoTracking()
                .Where(f => (f.FildKind == "SummerCamp" || f.FildKind == "SUM2026_WaveCode" || f.FildKind == "WaveCode")
                            && f.FildTxt == waveCode)
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
                .Where(f => activeMessageIds.Contains(f.FildRelted)
                            && (f.FildKind == "FamilyCount" || f.FildKind == "SUM2026_FamilyCount"))
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

        private async Task<bool> AcquireAdminActionLockAsync(int messageId)
        {
            if (messageId <= 0)
            {
                return false;
            }

            var connection = _connectContext.Database.GetDbConnection();
            if (connection.State != ConnectionState.Open)
            {
                await connection.OpenAsync();
            }

            await using var command = connection.CreateCommand();
            command.CommandText = @"
DECLARE @result int;
EXEC @result = sp_getapplock
    @Resource = @resource,
    @LockMode = 'Exclusive',
    @LockOwner = 'Session',
    @LockTimeout = @timeout;
SELECT @result;
";

            var resourceParam = command.CreateParameter();
            resourceParam.ParameterName = "@resource";
            resourceParam.Value = $"SUMMER_ADMIN_ACTION_{messageId}";
            command.Parameters.Add(resourceParam);

            var timeoutParam = command.CreateParameter();
            timeoutParam.ParameterName = "@timeout";
            timeoutParam.Value = AdminActionLockTimeoutMs;
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

            var normalizedWaveCode = waveCode.Trim();
            var normalizedAction = string.IsNullOrWhiteSpace(action)
                ? "UPDATE"
                : action.Trim().ToUpperInvariant();
            var emittedAtUtc = DateTime.UtcNow;
            var destinationName = await ResolveSummerDestinationNameAsync(categoryId);
            var batchNumber = ResolveSummerBatchNumber(normalizedWaveCode);

            var messageText = JsonSerializer.Serialize(new Dictionary<string, object?>
            {
                ["event"] = "SUMMER_CAPACITY_UPDATED",
                ["destinationId"] = categoryId,
                ["destinationName"] = destinationName,
                ["waveCode"] = normalizedWaveCode,
                ["batchNumber"] = batchNumber,
                ["action"] = normalizedAction,
                ["emittedAt"] = emittedAtUtc,
                ["sender"] = "Connect",
                ["title"] = "إدارة طلبات المصايف"
            });
            var notification = new NotificationDto
            {
                Notification = messageText,
                type = NotificationType.info,
                Title = "إدارة طلبات المصايف",
                time = emittedAtUtc,
                sender = "Connect",
                Category = NotificationCategory.Business
            };

            var dispatchResponse = await _notificationService.SendSignalRToGroupsAsync(new SignalRGroupsDispatchRequest
            {
                GroupNames = SummerNotificationGroups,
                Notification = notification.Notification,
                Type = notification.type,
                Title = notification.Title,
                Time = notification.time,
                Sender = notification.sender,
                Category = notification.Category ?? NotificationCategory.Business
            });

            if (!dispatchResponse.IsSuccess)
            {
                var errors = string.Join(" | ", dispatchResponse.Errors.Select(error => $"{error.Code}:{error.Message}"));
                _logger.LogWarning(
                    "Summer capacity update publish encountered errors. CategoryId={CategoryId}, WaveCode={WaveCode}, Action={Action}, Errors={Errors}",
                    categoryId,
                    waveCode,
                    action,
                    errors);
                return;
            }

            _logger.LogInformation(
                "Summer capacity update published. CategoryId={CategoryId}, WaveCode={WaveCode}, Action={Action}, Groups={Groups}",
                categoryId,
                waveCode,
                action,
                string.Join(",", SummerNotificationGroups));
        }

        private async Task<string> ResolveSummerDestinationNameAsync(int categoryId)
        {
            var destinationName = await _connectContext.Cdcategories
                .AsNoTracking()
                .Where(category => category.CatId == categoryId)
                .Select(category => category.CatName)
                .FirstOrDefaultAsync();

            destinationName = Convert.ToString(destinationName ?? string.Empty).Trim();
            return destinationName.Length > 0
                ? destinationName
                : $"المصيف رقم {categoryId}";
        }

        private static string ResolveSummerBatchNumber(string waveCode)
        {
            var normalized = Convert.ToString(waveCode ?? string.Empty).Trim();
            if (normalized.Length == 0)
            {
                return "-";
            }

            var digitsOnly = new string(normalized.Where(char.IsDigit).ToArray());
            return digitsOnly.Length > 0 ? digitsOnly : normalized;
        }

        private async Task PublishRequestUpdateAsync(
            int messageId,
            string action,
            bool notifyResponsibleAdmins = true,
            bool notifyOwner = true,
            string? source = null)
        {
            if (messageId <= 0)
            {
                return;
            }

            if (!notifyResponsibleAdmins && !notifyOwner)
            {
                _logger.LogWarning(
                    "Summer request update skipped because no recipients were selected. MessageId={MessageId}, Action={Action}, Source={Source}",
                    messageId,
                    action,
                    source ?? DefaultRequestUpdateSource);
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

            var effectiveSource = string.IsNullOrWhiteSpace(source) ? DefaultRequestUpdateSource : source.Trim();
            var responsibleGroups = new List<string>();
            if (notifyResponsibleAdmins)
            {
                responsibleGroups = await ResolveResponsibleAdminGroupsAsync(messageId);
            }

            if (notifyResponsibleAdmins && responsibleGroups.Count > 0)
            {
                var groupsDispatchResponse = await _notificationService.SendSignalRToGroupsAsync(new SignalRGroupsDispatchRequest
                {
                    GroupNames = responsibleGroups,
                    Notification = notification.Notification,
                    Type = notification.type,
                    Title = notification.Title,
                    Time = notification.time,
                    Sender = notification.sender,
                    Category = notification.Category ?? NotificationCategory.Business
                });

                if (!groupsDispatchResponse.IsSuccess)
                {
                    var errors = string.Join(" | ", groupsDispatchResponse.Errors.Select(error => $"{error.Code}:{error.Message}"));
                    _logger.LogWarning(
                        "Summer request update publish to admin groups failed. MessageId={MessageId}, Action={Action}, Source={Source}, Groups={Groups}, Errors={Errors}",
                        messageId,
                        normalizedAction,
                        effectiveSource,
                        string.Join(",", responsibleGroups),
                        errors);
                }
            }
            else if (notifyResponsibleAdmins)
            {
                _logger.LogWarning(
                    "Summer request update publish found no responsible admin groups. MessageId={MessageId}, Action={Action}, Source={Source}",
                    messageId,
                    normalizedAction,
                    effectiveSource);
            }

            var ownerEmployeeId = string.Empty;
            if (notifyOwner)
            {
                ownerEmployeeId = await ResolveRequestOwnerEmployeeIdAsync(messageId);
            }

            if (notifyOwner && !string.IsNullOrWhiteSpace(ownerEmployeeId))
            {
                var ownerDispatchResponse = await _notificationService.SendSignalRToUserAsync(new SignalRDispatchRequest
                {
                    UserId = ownerEmployeeId,
                    Notification = notification.Notification,
                    Title = notification.Title,
                    Type = notification.type,
                    Time = notification.time,
                    Sender = notification.sender,
                    Category = notification.Category ?? NotificationCategory.Business
                });

                if (!ownerDispatchResponse.IsSuccess)
                {
                    var errors = string.Join(" | ", ownerDispatchResponse.Errors.Select(error => $"{error.Code}:{error.Message}"));
                    _logger.LogWarning(
                        "Summer request update publish to owner failed. MessageId={MessageId}, Action={Action}, Source={Source}, OwnerEmployeeId={OwnerEmployeeId}, Errors={Errors}",
                        messageId,
                        normalizedAction,
                        effectiveSource,
                        ownerEmployeeId,
                        errors);
                }
            }
            else if (notifyOwner)
            {
                _logger.LogWarning(
                    "Summer request update publish skipped owner because owner employee id is missing. MessageId={MessageId}, Action={Action}, Source={Source}",
                    messageId,
                    normalizedAction,
                    effectiveSource);
            }

            _logger.LogInformation(
                "Summer request update published. MessageId={MessageId}, Action={Action}, Source={Source}, NotifyResponsibleAdmins={NotifyResponsibleAdmins}, AdminGroups={AdminGroups}, NotifyOwner={NotifyOwner}, OwnerEmployeeId={OwnerEmployeeId}",
                messageId,
                normalizedAction,
                effectiveSource,
                notifyResponsibleAdmins,
                responsibleGroups.Count > 0 ? string.Join(",", responsibleGroups) : string.Empty,
                notifyOwner,
                ownerEmployeeId);
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

        private async Task<string> ResolveRequestOwnerEmployeeIdAsync(int messageId)
        {
            if (messageId <= 0)
            {
                return string.Empty;
            }

            var fields = await _connectContext.TkmendFields
                .AsNoTracking()
                .Where(field => field.FildRelted == messageId)
                .ToListAsync();

            return GetFirstFieldValue(fields, EmployeeIdFieldKinds).Trim();
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
                WaveCode = GetFirstFieldValue(fields, WaveCodeFieldKinds),
                EmployeeId = GetFirstFieldValue(fields, EmployeeIdFieldKinds),
                EmployeeName = GetFirstFieldValue(fields, EmployeeNameFieldKinds),
                EmployeeNationalId = GetFirstFieldValue(fields, EmployeeNationalIdFieldKinds),
                EmployeePhone = GetFirstFieldValue(fields, EmployeePhoneFieldKinds),
                EmployeeExtraPhone = GetFirstFieldValue(fields, EmployeeExtraPhoneFieldKinds),
                Status = message.Status.ToString(),
                StatusLabel = ResolveSummaryStatusLabel(message.Status, fields, needsTransferReview, workflowStateLabel),
                WorkflowStateCode = workflowStateCode,
                WorkflowStateLabel = workflowStateLabel,
                NeedsTransferReview = needsTransferReview,
                CreatedAt = ResolveRequestCreatedAtUtc(message, fields),
                PaymentDueAtUtc = ParseDate(GetFieldValue(fields, PaymentDueAtUtcFieldKind)),
                PaidAtUtc = ParseDate(GetFieldValue(fields, PaidAtUtcFieldKind)),
                TransferUsed = ParseInt(GetFieldValue(fields, "Summer_TransferCount"), 0) > 0
            };
        }

        private async Task<Dictionary<int, SummerRule>> GetSummerRulesAsync(int seasonYear = SummerWorkflowDomainConstants.DefaultSeasonYear, string? applicationId = null)
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

        private void ApplyAdminActionAuditFields(
            List<TkmendField> fields,
            int messageId,
            string actionCode,
            MessageStatus previousState,
            MessageStatus newState,
            string performedByUserId,
            DateTime actionAtUtc,
            string? comment)
        {
            var normalizedAction = NormalizeActionCode(actionCode);
            if (string.IsNullOrWhiteSpace(normalizedAction))
            {
                return;
            }

            UpsertField(fields, messageId, ActionTypeFieldKind, normalizedAction);
            UpsertField(fields, messageId, "Summer_AdminLastAction", normalizedAction);
            UpsertField(fields, messageId, "Summer_AdminActionAtUtc", actionAtUtc.ToString("o"));
            UpsertField(fields, messageId, "Summer_AdminPreviousState", previousState.ToString());
            UpsertField(fields, messageId, "Summer_AdminNewState", newState.ToString());
            UpsertField(fields, messageId, "Summer_AdminActionBy", (performedByUserId ?? string.Empty).Trim());

            if (!string.IsNullOrWhiteSpace(comment))
            {
                UpsertField(fields, messageId, "Summer_AdminComment", comment.Trim());
            }
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
                SummerAdminActionCatalog.Codes.FinalApprove => "اعتماد نهائي",
                SummerAdminActionCatalog.Codes.Comment => "رد إداري",
                SummerAdminActionCatalog.Codes.ManualCancel => "إلغاء يدوي",
                SummerAdminActionCatalog.Codes.ApproveTransfer => "اعتماد تحويل",
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

        private static MessageStatus? ResolveRequestedStatusMessageStatus(string? requestedStatus)
        {
            var raw = (requestedStatus ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(raw))
            {
                return null;
            }

            if (Enum.TryParse<MessageStatus>(raw, true, out var parsedStatus))
            {
                return parsedStatus;
            }

            if (byte.TryParse(raw, out var statusByte)
                && Enum.IsDefined(typeof(MessageStatus), statusByte))
            {
                return (MessageStatus)statusByte;
            }

            var token = NormalizeSearchToken(raw);
            return token switch
            {
                "new" or "جديد" => MessageStatus.New,
                "inprogress" or "in_progress" or "جاريالتنفيذ" => MessageStatus.InProgress,
                "replied" or "تمالرد" => MessageStatus.Replied,
                _ => null
            };
        }

        private static string ResolveDashboardStatusCode(string label)
        {
            var token = NormalizeSearchToken(label);
            return token switch
            {
                "new" or "جديد" => "NEW",
                "inprogress" or "in_progress" or "جاريالتنفيذ" => "IN_PROGRESS",
                "adminreply" or "admin_reply" or "reply" or "ردإداري" or "رداداري" => "ADMIN_REPLY",
                "replied" or "تمالرد" => "REPLIED",
                "finalapprove" or "final_approve" or "اعتمادنهائي" => SummerAdminActionCatalog.Codes.FinalApprove,
                "approvetransfer" or "approve_transfer" or "اعتمادتحويل" => SummerAdminActionCatalog.Codes.ApproveTransfer,
                "manualcancel" or "manual_cancel" or "الغاءيدوي" or "إلغاءيدوي" => SummerAdminActionCatalog.Codes.ManualCancel,
                "rejected" or "مرفوض" or "ملغي" or "مرفوض/ملغي" => "REJECTED",
                "يتطلبمراجعةبعدالتحويل" or "transferreviewrequired" or "transfer_review_required" => TransferReviewRequiredCode,
                "تمتمراجعةالتحويل" or "transferreviewresolved" or "transfer_review_resolved" => TransferReviewResolvedCode,
                _ => token.ToUpperInvariant()
            };
        }

        private static string NormalizeActionCode(string? actionCode)
        {
            return SummerAdminActionCatalog.Normalize(actionCode);
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
            var rawDueAtValue = GetFieldValue(fields, PaymentDueAtUtcFieldKind);
            var fromField = ParseDate(rawDueAtValue);
            if (fromField.HasValue && HasExplicitTimeComponent(rawDueAtValue))
            {
                return fromField.Value;
            }

            var createdAtUtc = ResolveRequestCreatedAtUtc(message, fields);
            return SummerCalendarRules.CalculatePaymentDueUtc(createdAtUtc);
        }

        private static DateTime ResolveRequestCreatedAtUtc(Message message, IEnumerable<TkmendField> fields)
        {
            var anchoredFieldValue = GetFieldValue(fields, RequestCreatedAtUtcFieldKind);
            var anchoredCreatedAtUtc = ParseDate(anchoredFieldValue);
            if (anchoredCreatedAtUtc.HasValue)
            {
                return anchoredCreatedAtUtc.Value;
            }

            return ResolveLegacyMessageCreatedAtUtc(message);
        }

        private static DateTime ResolveLegacyMessageCreatedAtUtc(Message message)
        {
            return NormalizeToUtc(message.CreatedDate);
        }

        private static DateTime NormalizeToUtc(DateTime value)
        {
            if (value.Kind == DateTimeKind.Utc)
            {
                return value;
            }

            if (value.Kind == DateTimeKind.Local)
            {
                return value.ToUniversalTime();
            }

            var unspecified = DateTime.SpecifyKind(value, DateTimeKind.Unspecified);
            return TimeZoneInfo.ConvertTimeToUtc(unspecified, SummerBusinessTimeZone);
        }

        private static DateTime TruncateToWholeSecondUtc(DateTime valueUtc)
        {
            var utc = NormalizeToUtc(valueUtc);
            var ticks = utc.Ticks - (utc.Ticks % TimeSpan.TicksPerSecond);
            return new DateTime(ticks, DateTimeKind.Utc);
        }

        private static DateTime? ParseDate(string? value)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return null;
            }

            var normalized = value.Trim();
            if (DateTimeOffset.TryParse(
                normalized,
                CultureInfo.InvariantCulture,
                DateTimeStyles.AllowWhiteSpaces | DateTimeStyles.RoundtripKind,
                out var dto))
            {
                return dto.UtcDateTime;
            }

            if (!DateTime.TryParse(
                normalized,
                CultureInfo.InvariantCulture,
                DateTimeStyles.AllowWhiteSpaces | DateTimeStyles.RoundtripKind,
                out var parsed))
            {
                return null;
            }

            return NormalizeToUtc(parsed);
        }

        private static bool HasExplicitTimeComponent(string? value)
        {
            var normalized = (value ?? string.Empty).Trim();
            if (normalized.Length == 0)
            {
                return false;
            }

            return normalized.Contains('T', StringComparison.Ordinal)
                || normalized.Contains(':', StringComparison.Ordinal);
        }

        private static TimeZoneInfo ResolveSummerBusinessTimeZone()
        {
            try
            {
                return TimeZoneInfo.FindSystemTimeZoneById("Africa/Cairo");
            }
            catch
            {
                try
                {
                    return TimeZoneInfo.FindSystemTimeZoneById("Egypt Standard Time");
                }
                catch
                {
                    return TimeZoneInfo.Utc;
                }
            }
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
