using System.Data;
using ENPO.Dto.HubSync;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Models.Attachment;
using Models.Correspondance;
using Models.DTO.Common;
using Models.DTO.Correspondance.Enums;
using Models.DTO.Correspondance.Summer;
using Persistence.Data;
using Persistence.HelperServices;
using Persistence.Services.Summer;
using SignalR.Notification;

namespace Persistence.Services
{
    public class SummerWorkflowService
    {
        private readonly ConnectContext _connectContext;
        private readonly Attach_HeldContext _attachHeldContext;
        private readonly helperService _helperService;
        private readonly SignalRConnectionManager _signalRConnectionManager;

        private const int CapacityLockTimeoutMs = 15000;
        private static readonly string[] SummerNotificationGroups = { "CONNECT", "CONNECT - TEST" };
        private static readonly HashSet<string> AllowedAttachmentExtensions = new(StringComparer.OrdinalIgnoreCase)
        {
            ".pdf", ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"
        };

        private static readonly Dictionary<int, SummerRule> SummerRules = new()
        {
            { 147, new SummerRule(maxExtra: 2, capacityByFamily: new Dictionary<int, int> { { 5, 5 }, { 6, 5 }, { 8, 8 }, { 9, 5 } }) },
            { 148, new SummerRule(maxExtra: 1, capacityByFamily: new Dictionary<int, int> { { 2, 2 }, { 4, 6 }, { 6, 2 } }) },
            { 149, new SummerRule(maxExtra: 2, capacityByFamily: new Dictionary<int, int> { { 4, 24 }, { 6, 23 }, { 7, 24 } }) }
        };

        public SummerWorkflowService(
            ConnectContext connectContext,
            Attach_HeldContext attachHeldContext,
            helperService helperService,
            SignalRConnectionManager signalRConnectionManager)
        {
            _connectContext = connectContext;
            _attachHeldContext = attachHeldContext;
            _helperService = helperService;
            _signalRConnectionManager = signalRConnectionManager;
        }

        public async Task<CommonResponse<IEnumerable<SummerRequestSummaryDto>>> GetMyRequestsAsync(string userId, int seasonYear)
        {
            var response = new CommonResponse<IEnumerable<SummerRequestSummaryDto>>();
            try
            {
                if (string.IsNullOrWhiteSpace(userId))
                {
                    response.Errors.Add(new Error { Code = "400", Message = "Ù…Ø¹Ø±Ù Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù… Ù…Ø·Ù„ÙˆØ¨." });
                    return response;
                }

                if (seasonYear <= 0)
                {
                    seasonYear = DateTime.UtcNow.Year;
                }

                var summerCategoryIds = SummerRules.Keys.ToList();

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
                        StatusLabel = message.Status.GetDescription(),
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

        public async Task<CommonResponse<IEnumerable<SummerRequestSummaryDto>>> GetAdminRequestsAsync(SummerAdminRequestsQuery query)
        {
            var response = new CommonResponse<IEnumerable<SummerRequestSummaryDto>>();
            query ??= new SummerAdminRequestsQuery();
            try
            {
                var seasonYear = query.SeasonYear <= 0 ? DateTime.UtcNow.Year : query.SeasonYear;
                var pageNumber = query.PageNumber <= 0 ? 1 : query.PageNumber;
                var pageSize = query.PageSize <= 0 ? 50 : query.PageSize;

                var summerCategoryIds = SummerRules.Keys.ToList();
                var messages = await _connectContext.Messages
                    .AsNoTracking()
                    .Where(m => summerCategoryIds.Contains(m.CategoryCd))
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
                        StatusLabel = message.Status.GetDescription(),
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
                            if (!statusToken.Contains(normalizedStatus) && !statusLabelToken.Contains(normalizedStatus))
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

                        if (normalizedPaymentState is "paid" && !isPaid)
                        {
                            return false;
                        }

                        if (normalizedPaymentState is "unpaid" && isPaid)
                        {
                            return false;
                        }

                        if (normalizedPaymentState is "overdue" or "overdueunpaid" && !isOverdueUnpaid)
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

        public async Task<CommonResponse<SummerAdminDashboardDto>> GetAdminDashboardAsync(int seasonYear, int? categoryId = null, string? waveCode = null)
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
                });

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
                        .GroupBy(r => ResolveMessageStatus(r.Status))
                        .Select(g => new SummerDashboardStatusBucketDto
                        {
                            StatusCode = g.Key.ToString(),
                            StatusLabel = g.Key.GetDescription(),
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
                    response.Errors.Add(new Error { Code = "400", Message = "Ø±Ù‚Ù… Ø§Ù„Ø·Ù„Ø¨ Ù…Ø·Ù„ÙˆØ¨." });
                    return response;
                }

                var actionCode = NormalizeActionCode(request.ActionCode);
                if (string.IsNullOrWhiteSpace(actionCode))
                {
                    response.Errors.Add(new Error { Code = "400", Message = "Ù†ÙˆØ¹ Ø§Ù„Ø¥Ø¬Ø±Ø§Ø¡ Ø§Ù„Ø¥Ø¯Ø§Ø±ÙŠ Ù…Ø·Ù„ÙˆØ¨." });
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

                if (actionCode == "APPROVE_TRANSFER")
                {
                    if (!request.ToCategoryId.HasValue || string.IsNullOrWhiteSpace(request.ToWaveCode))
                    {
                        response.Errors.Add(new Error { Code = "400", Message = "Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„ØªØ­ÙˆÙŠÙ„ ØºÙŠØ± Ù…ÙƒØªÙ…Ù„Ø© (Ø§Ù„Ù…ØµÙŠÙ ÙˆØ§Ù„ÙÙˆØ¬ Ø§Ù„Ù…Ø³ØªÙ‡Ø¯ÙØ§Ù† Ù…Ø·Ù„ÙˆØ¨Ø§Ù†)." });
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
                    return response;
                }

                var message = await _connectContext.Messages.FirstOrDefaultAsync(m => m.MessageId == request.MessageId);
                if (message == null || !SummerRules.ContainsKey(message.CategoryCd))
                {
                    response.Errors.Add(new Error { Code = "404", Message = "Ø·Ù„Ø¨ Ø§Ù„Ù…ØµÙŠÙ ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯." });
                    return response;
                }

                var fields = await _connectContext.TkmendFields.Where(f => f.FildRelted == message.MessageId).ToListAsync();
                var comment = (request.Comment ?? string.Empty).Trim();

                await using var connectTx = await _connectContext.Database.BeginTransactionAsync(IsolationLevel.Serializable);
                await using var attachTx = await _attachHeldContext.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted);
                try
                {
                    var replyMessage = string.Empty;
                    if (actionCode == "FINAL_APPROVE")
                    {
                        if (message.Status == MessageStatus.Rejected && !request.Force)
                        {
                            response.Errors.Add(new Error { Code = "400", Message = "Ø§Ù„Ø·Ù„Ø¨ Ù…Ø±ÙÙˆØ¶ Ø¨Ø§Ù„ÙØ¹Ù„. Ø§Ø³ØªØ®Ø¯Ù… Ø®ÙŠØ§Ø± Ø§Ù„Ù‚ÙˆØ© Ø¥Ø°Ø§ Ù„Ø²Ù…." });
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

                        replyMessage = string.IsNullOrWhiteSpace(comment)
                            ? "ØªÙ… Ø§Ø¹ØªÙ…Ø§Ø¯ Ø§Ù„Ø·Ù„Ø¨ Ù†Ù‡Ø§Ø¦ÙŠØ§Ù‹ Ù…Ù† Ø¥Ø¯Ø§Ø±Ø© Ø§Ù„Ù…ØµØ§ÙŠÙ."
                            : $"ØªÙ… Ø§Ø¹ØªÙ…Ø§Ø¯ Ø§Ù„Ø·Ù„Ø¨ Ù†Ù‡Ø§Ø¦ÙŠØ§Ù‹ Ù…Ù† Ø¥Ø¯Ø§Ø±Ø© Ø§Ù„Ù…ØµØ§ÙŠÙ. ØªØ¹Ù„ÙŠÙ‚ Ø§Ù„Ø¥Ø¯Ø§Ø±Ø©: {comment}";
                    }
                    else if (actionCode == "MANUAL_CANCEL")
                    {
                        message.Status = MessageStatus.Rejected;
                        UpsertField(fields, message.MessageId, "Summer_AdminLastAction", "MANUAL_CANCEL");
                        UpsertField(fields, message.MessageId, "Summer_AdminActionAtUtc", DateTime.UtcNow.ToString("o"));
                        UpsertField(fields, message.MessageId, "Summer_CancelReason", string.IsNullOrWhiteSpace(comment) ? "Ø¥Ù„ØºØ§Ø¡ ÙŠØ¯ÙˆÙŠ Ù…Ù† Ø¥Ø¯Ø§Ø±Ø© Ø§Ù„Ù…ØµØ§ÙŠÙ." : comment);
                        UpsertField(fields, message.MessageId, "Summer_CancelledAtUtc", DateTime.UtcNow.ToString("o"));
                        UpsertField(fields, message.MessageId, "Summer_PaymentStatus", "CANCELLED_ADMIN");

                        replyMessage = string.IsNullOrWhiteSpace(comment)
                            ? "ØªÙ… Ø¥Ù„ØºØ§Ø¡ Ø§Ù„Ø·Ù„Ø¨ ÙŠØ¯ÙˆÙŠÙ‹Ø§ Ù…Ù† Ø¥Ø¯Ø§Ø±Ø© Ø§Ù„Ù…ØµØ§ÙŠÙ."
                            : $"ØªÙ… Ø¥Ù„ØºØ§Ø¡ Ø§Ù„Ø·Ù„Ø¨ ÙŠØ¯ÙˆÙŠÙ‹Ø§ Ù…Ù† Ø¥Ø¯Ø§Ø±Ø© Ø§Ù„Ù…ØµØ§ÙŠÙ. Ø§Ù„Ø³Ø¨Ø¨: {comment}";
                    }
                    else if (actionCode == "COMMENT")
                    {
                        UpsertField(fields, message.MessageId, "Summer_AdminLastAction", "COMMENT");
                        UpsertField(fields, message.MessageId, "Summer_AdminActionAtUtc", DateTime.UtcNow.ToString("o"));
                        replyMessage = string.IsNullOrWhiteSpace(comment)
                            ? "ØªÙ… ØªØ³Ø¬ÙŠÙ„ ØªØ¹Ù„ÙŠÙ‚ Ø¥Ø¯Ø§Ø±ÙŠ Ø¹Ù„Ù‰ Ø§Ù„Ø·Ù„Ø¨."
                            : comment;
                    }
                    else
                    {
                        response.Errors.Add(new Error { Code = "400", Message = "Ù†ÙˆØ¹ Ø§Ù„Ø¥Ø¬Ø±Ø§Ø¡ ØºÙŠØ± Ù…Ø¯Ø¹ÙˆÙ…." });
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

                var employeeId = response.Data.EmployeeId;
                if (!string.IsNullOrWhiteSpace(employeeId))
                {
                    await _signalRConnectionManager.SendNotificationToUser(employeeId, new NotificationDto
                    {
                        Notification = "ØªÙ… ØªÙ†ÙÙŠØ° Ø¥Ø¬Ø±Ø§Ø¡ Ø¥Ø¯Ø§Ø±ÙŠ Ø¹Ù„Ù‰ Ø·Ù„Ø¨ Ø§Ù„Ù…ØµÙŠÙ Ø§Ù„Ø®Ø§Øµ Ø¨Ùƒ.",
                        type = NotificationType.info,
                        Title = "Ø¥Ø¯Ø§Ø±Ø© Ø·Ù„Ø¨Ø§Øª Ø§Ù„Ù…ØµØ§ÙŠÙ",
                        time = DateTime.Now,
                        sender = "Connect",
                        Category = NotificationCategory.Business
                    });
                }

                if (actionCode == "MANUAL_CANCEL")
                {
                    await PublishCapacityUpdateAsync(response.Data.CategoryId, response.Data.WaveCode, "ADMIN_CANCEL");
                }
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
                    response.Errors.Add(new Error { Code = "400", Message = "Ø§Ù„Ù…ØµÙŠÙ ÙˆØ§Ù„ÙÙˆØ¬ Ù…Ø·Ù„ÙˆØ¨Ø§Ù†." });
                    return response;
                }

                if (!SummerRules.TryGetValue(categoryId, out var rule))
                {
                    response.Errors.Add(new Error { Code = "400", Message = "Ø§Ù„Ù…ØµÙŠÙ ØºÙŠØ± Ù…ÙØ¹Ø¯ ÙÙŠ Ø§Ù„Ù†Ø¸Ø§Ù…." });
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
                    response.Errors.Add(new Error { Code = "400", Message = "Ø±Ù‚Ù… Ø§Ù„Ø·Ù„Ø¨ Ù…Ø·Ù„ÙˆØ¨." });
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
                    response.Errors.Add(new Error { Code = "404", Message = "Ø§Ù„Ø·Ù„Ø¨ ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯." });
                    return response;
                }

                var fields = await _connectContext.TkmendFields.Where(f => f.FildRelted == message.MessageId).ToListAsync();
                if (message.Status == MessageStatus.Rejected || ParseDate(GetFieldValue(fields, "Summer_CancelledAtUtc")).HasValue)
                {
                    response.Errors.Add(new Error { Code = "400", Message = "ØªÙ… ØªØ³Ø¬ÙŠÙ„ Ø§Ø¹ØªØ°Ø§Ø± Ø³Ø§Ø¨Ù‚ Ø¹Ù„Ù‰ Ù‡Ø°Ø§ Ø§Ù„Ø­Ø¬Ø²." });
                    return response;
                }

                var waveCode = GetFieldValue(fields, "SummerCamp") ?? string.Empty;
                var waveLabel = GetFieldValue(fields, "SummerCampLabel");
                var seasonYear = ParseInt(GetFieldValue(fields, "SummerSeasonYear"), DateTime.UtcNow.Year);
                if (SummerCalendarRules.TryResolveWaveStartUtc(message.CategoryCd, seasonYear, waveCode, waveLabel, out var waveStartUtc)
                    && !SummerCalendarRules.CanCancel(DateTime.UtcNow, waveStartUtc))
                {
                    var lastAllowedUtc = waveStartUtc.AddDays(-14);
                    response.Errors.Add(new Error
                    {
                        Code = "400",
                        Message = $"Ù„Ø§ ÙŠÙ…ÙƒÙ† ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø§Ø¹ØªØ°Ø§Ø± Ù‚Ø¨Ù„ Ù…ÙˆØ¹Ø¯ Ø§Ù„ÙÙˆØ¬ Ø¨Ø£Ù‚Ù„ Ù…Ù† 14 ÙŠÙˆÙ…. Ø¢Ø®Ø± Ù…ÙˆØ¹Ø¯ Ù…ØªØ§Ø­ Ù„Ù„Ø§Ø¹ØªØ°Ø§Ø± Ù‡Ùˆ {lastAllowedUtc:yyyy-MM-dd HH:mm} (UTC)."
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
                            ? "ØªÙ… ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø§Ø¹ØªØ°Ø§Ø± Ø¹Ù† Ø§Ù„Ø­Ø¬Ø²."
                            : $"ØªÙ… ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø§Ø¹ØªØ°Ø§Ø± Ø¹Ù† Ø§Ù„Ø­Ø¬Ø². Ø§Ù„Ø³Ø¨Ø¨: {request.Reason.Trim()}",
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
                        Notification = "ØªÙ… ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø§Ø¹ØªØ°Ø§Ø± Ø¹Ù† Ø§Ù„Ø­Ø¬Ø² Ø¨Ù†Ø¬Ø§Ø­.",
                        type = NotificationType.info,
                        Title = "ØªØ­Ø¯ÙŠØ« Ø·Ù„Ø¨ Ø§Ù„Ù…ØµÙŠÙ",
                        time = DateTime.Now,
                        sender = "Connect",
                        Category = NotificationCategory.Business
                    });
                }

                await PublishCapacityUpdateAsync(summary.CategoryId, summary.WaveCode, "CANCEL");
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
                    response.Errors.Add(new Error { Code = "400", Message = "Ø±Ù‚Ù… Ø§Ù„Ø·Ù„Ø¨ Ù…Ø·Ù„ÙˆØ¨." });
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
                    response.Errors.Add(new Error { Code = "400", Message = "Ù„Ø§ ÙŠÙ…ÙƒÙ† ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø³Ø¯Ø§Ø¯ Ø¨Ø¯ÙˆÙ† Ù…Ø±ÙÙ‚Ø§Øª. ÙŠØ¬Ø¨ Ø¥Ø±ÙØ§Ù‚ Ù…Ø³ØªÙ†Ø¯ ÙˆØ§Ø­Ø¯ Ø¹Ù„Ù‰ Ø§Ù„Ø£Ù‚Ù„." });
                    return response;
                }

                if (request.ForceOverride)
                {
                    response.Errors.Add(new Error { Code = "400", Message = "ØºÙŠØ± Ù…Ø³Ù…ÙˆØ­ Ø¨Ø§Ù„Ø³Ø¯Ø§Ø¯ Ø¨Ø¹Ø¯ Ø§Ù†ØªÙ‡Ø§Ø¡ Ù…Ù‡Ù„Ø© Ø§Ù„ÙŠÙˆÙ… Ø§Ù„ÙˆØ§Ø­Ø¯." });
                    return response;
                }

                var message = await _connectContext.Messages.FirstOrDefaultAsync(m => m.MessageId == request.MessageId);
                if (message == null)
                {
                    response.Errors.Add(new Error { Code = "404", Message = "Ø§Ù„Ø·Ù„Ø¨ ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯." });
                    return response;
                }

                if (message.Status == MessageStatus.Rejected)
                {
                    response.Errors.Add(new Error { Code = "400", Message = "Ù„Ø§ ÙŠÙ…ÙƒÙ† ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø³Ø¯Ø§Ø¯ Ù„Ø·Ù„Ø¨ ØªÙ… Ø§Ù„Ø§Ø¹ØªØ°Ø§Ø± Ø¹Ù†Ù‡." });
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
                        Message = $"Ø§Ù†ØªÙ‡Øª Ù…Ù‡Ù„Ø© Ø§Ù„Ø³Ø¯Ø§Ø¯. ÙƒØ§Ù† Ø§Ù„Ù…ÙˆØ¹Ø¯ Ø§Ù„Ù†Ù‡Ø§Ø¦ÙŠ {dueAt:yyyy-MM-dd HH:mm} (UTC)."
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
                    if (!string.IsNullOrWhiteSpace(request.Notes))
                    {
                        UpsertField(fields, message.MessageId, "Summer_PaymentNotes", request.Notes.Trim());
                    }

                    await AddReplyWithAttachmentsAsync(
                        message.MessageId,
                        string.IsNullOrWhiteSpace(request.Notes)
                            ? "ØªÙ… ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø³Ø¯Ø§Ø¯ Ø¨Ù†Ø¬Ø§Ø­."
                            : $"ØªÙ… ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø³Ø¯Ø§Ø¯ Ø¨Ù†Ø¬Ø§Ø­. Ø§Ù„Ù…Ù„Ø§Ø­Ø¸Ø§Øª: {request.Notes.Trim()}",
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
                    response.Errors.Add(new Error { Code = "400", Message = "Ø±Ù‚Ù… Ø§Ù„Ø·Ù„Ø¨ ÙˆØ§Ù„Ù…ØµÙŠÙ Ø§Ù„Ù…Ø³ØªÙ‡Ø¯Ù ÙˆØ§Ù„ÙÙˆØ¬ Ø§Ù„Ù…Ø³ØªÙ‡Ø¯Ù Ø­Ù‚ÙˆÙ„ Ù…Ø·Ù„ÙˆØ¨Ø©." });
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
                    response.Errors.Add(new Error { Code = "404", Message = "Ø§Ù„Ø·Ù„Ø¨ ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯." });
                    return response;
                }

                if (message.Status == MessageStatus.Rejected)
                {
                    response.Errors.Add(new Error { Code = "400", Message = "Ù„Ø§ ÙŠÙ…ÙƒÙ† ØªØ­ÙˆÙŠÙ„ Ø·Ù„Ø¨ ØªÙ… Ø§Ù„Ø§Ø¹ØªØ°Ø§Ø± Ø¹Ù†Ù‡." });
                    return response;
                }

                var normalizedTargetWave = request.ToWaveCode.Trim();

                var fields = await _connectContext.TkmendFields.Where(f => f.FildRelted == message.MessageId).ToListAsync();
                var transferCount = ParseInt(GetFieldValue(fields, "Summer_TransferCount"), 0);
                if (transferCount > 0)
                {
                    response.Errors.Add(new Error { Code = "400", Message = "Ø§Ù„ØªØ­ÙˆÙŠÙ„ Ù…Ø³Ù…ÙˆØ­ Ù…Ø±Ø© ÙˆØ§Ø­Ø¯Ø© ÙÙ‚Ø· Ø®Ù„Ø§Ù„ Ø§Ù„Ù…ÙˆØ³Ù…." });
                    return response;
                }

                var employeeId = GetFieldValue(fields, "Emp_Id") ?? string.Empty;
                if (string.IsNullOrWhiteSpace(employeeId))
                {
                    response.Errors.Add(new Error { Code = "400", Message = "Ø±Ù‚Ù… Ù…Ù„Ù Ø§Ù„Ù…ÙˆØ¸Ù Ù…Ø·Ù„ÙˆØ¨." });
                    return response;
                }

                var seasonYear = ParseInt(GetFieldValue(fields, "SummerSeasonYear"), DateTime.UtcNow.Year);
                if (await HasEmployeeUsedTransferInSeasonAsync(employeeId, seasonYear, message.MessageId))
                {
                    response.Errors.Add(new Error { Code = "400", Message = "ØªÙ… Ø§Ø³ØªØ®Ø¯Ø§Ù… Ø§Ù„ØªØ­ÙˆÙŠÙ„ Ø¨Ø§Ù„ÙØ¹Ù„ Ø®Ù„Ø§Ù„ Ù‡Ø°Ø§ Ø§Ù„Ù…ÙˆØ³Ù…." });
                    return response;
                }

                var newFamilyCount = request.NewFamilyCount ?? ParseInt(GetFieldValue(fields, "FamilyCount"), 0);
                var newExtraCount = request.NewExtraCount ?? ParseInt(GetFieldValue(fields, "Over_Count"), 0);

                if (!SummerRules.TryGetValue(request.ToCategoryId, out var rule))
                {
                    response.Errors.Add(new Error { Code = "400", Message = "Ø§Ù„Ù…ØµÙŠÙ Ø§Ù„Ù…Ø³ØªÙ‡Ø¯Ù ØºÙŠØ± Ù…ÙØ¹Ø¯ ÙÙŠ Ø§Ù„Ù†Ø¸Ø§Ù…." });
                    return response;
                }

                if (newFamilyCount <= 0 || !rule.CapacityByFamily.ContainsKey(newFamilyCount))
                {
                    response.Errors.Add(new Error { Code = "400", Message = "Ø¹Ø¯Ø¯ Ø§Ù„Ø£ÙØ±Ø§Ø¯ ØºÙŠØ± Ù…ØªØ§Ø­ Ù„Ù„Ø­Ø¬Ø² ÙÙŠ Ø§Ù„Ù…ØµÙŠÙ Ø§Ù„Ù…Ø³ØªÙ‡Ø¯Ù." });
                    return response;
                }

                if (newExtraCount < 0 || newExtraCount > rule.MaxExtra)
                {
                    response.Errors.Add(new Error { Code = "400", Message = $"Ø¹Ø¯Ø¯ Ø§Ù„Ø£ÙØ±Ø§Ø¯ Ø§Ù„Ø¥Ø¶Ø§ÙÙŠÙŠÙ† ØªØ¬Ø§ÙˆØ² Ø§Ù„Ø­Ø¯ Ø§Ù„Ù…Ø³Ù…ÙˆØ­ ({rule.MaxExtra})." });
                    return response;
                }

                var maxFamily = rule.CapacityByFamily.Keys.Max();
                if (newFamilyCount != maxFamily && newExtraCount > 0)
                {
                    response.Errors.Add(new Error { Code = "400", Message = "Ø§Ù„Ø£ÙØ±Ø§Ø¯ Ø§Ù„Ø¥Ø¶Ø§ÙÙŠÙˆÙ† Ù…Ø³Ù…ÙˆØ­ Ø¨Ù‡Ù… ÙÙ‚Ø· Ø¹Ù†Ø¯ Ø§Ø®ØªÙŠØ§Ø± Ø£ÙƒØ¨Ø± Ø³Ø¹Ø© Ø´Ù‚Ø©." });
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
                            Message = "ØªØ¹Ø°Ø± Ø­Ø¬Ø² Ø§Ù„Ø³Ø¹Ø© Ø­Ø§Ù„ÙŠØ§Ù‹ Ø¨Ø³Ø¨Ø¨ Ø­ÙØ¸ Ù…ØªØ²Ø§Ù…Ù†. Ø¨Ø±Ø¬Ø§Ø¡ Ø¥Ø¹Ø§Ø¯Ø© Ø§Ù„Ù…Ø­Ø§ÙˆÙ„Ø© Ø¨Ø¹Ø¯ Ø«ÙˆØ§Ù†Ù."
                        });
                        await attachTx.RollbackAsync();
                        await connectTx.RollbackAsync();
                        return response;
                    }

                    var existsSameWave = await ExistsEmployeeBookingInWaveAsync(request.ToCategoryId, normalizedTargetWave, employeeId, message.MessageId);
                    if (existsSameWave)
                    {
                        response.Errors.Add(new Error { Code = "400", Message = "Ù„Ø§ ÙŠÙ…ÙƒÙ† Ø§Ù„Ø­Ø¬Ø² Ù„Ù†ÙØ³ Ø§Ù„Ù…ÙˆØ¸Ù Ø£ÙƒØ«Ø± Ù…Ù† Ù…Ø±Ø© ÙÙŠ Ù†ÙØ³ Ø§Ù„Ù…ØµÙŠÙ ÙˆÙ†ÙØ³ Ø§Ù„ÙÙˆØ¬." });
                        await attachTx.RollbackAsync();
                        await connectTx.RollbackAsync();
                        return response;
                    }

                    var hasCapacity = await HasCapacityAsync(request.ToCategoryId, normalizedTargetWave, newFamilyCount, message.MessageId);
                    if (!hasCapacity)
                    {
                        response.Errors.Add(new Error { Code = "429", Message = "Ù„Ø§ ØªÙˆØ¬Ø¯ ÙˆØ­Ø¯Ø§Øª Ù…ØªØ§Ø­Ø© Ø­Ø§Ù„ÙŠØ§Ù‹ Ù„Ù„Ø¹Ø¯Ø¯ Ø§Ù„Ù…Ø®ØªØ§Ø± ÙÙŠ Ø§Ù„ÙÙˆØ¬ Ø§Ù„Ù…Ø­Ø¯Ø¯." });
                        await attachTx.RollbackAsync();
                        await connectTx.RollbackAsync();
                        return response;
                    }

                    var fromCategory = message.CategoryCd;
                    var fromWave = GetFieldValue(fields, "SummerCamp") ?? string.Empty;

                    message.CategoryCd = request.ToCategoryId;

                    UpsertField(fields, message.MessageId, "SummerCamp", normalizedTargetWave);
                    UpsertField(fields, message.MessageId, "FamilyCount", newFamilyCount.ToString());
                    UpsertField(fields, message.MessageId, "Over_Count", newExtraCount.ToString());
                    UpsertField(fields, message.MessageId, "Summer_ActionType", "TRANSFER");
                    UpsertField(fields, message.MessageId, "Summer_TransferCount", "1");
                    UpsertField(fields, message.MessageId, "Summer_TransferFromCategory", fromCategory.ToString());
                    UpsertField(fields, message.MessageId, "Summer_TransferFromWave", fromWave);
                    UpsertField(fields, message.MessageId, "Summer_TransferToCategory", request.ToCategoryId.ToString());
                    UpsertField(fields, message.MessageId, "Summer_TransferToWave", normalizedTargetWave);
                    UpsertField(fields, message.MessageId, "Summer_TransferredAtUtc", DateTime.UtcNow.ToString("o"));

                    await AddReplyWithAttachmentsAsync(
                        message.MessageId,
                        string.IsNullOrWhiteSpace(request.Notes)
                            ? $"ØªÙ… ØªØ­ÙˆÙŠÙ„ Ø§Ù„Ø·Ù„Ø¨ Ø¥Ù„Ù‰ Ø§Ù„Ù…ØµÙŠÙ {request.ToCategoryId} ÙˆØ§Ù„ÙÙˆØ¬ {normalizedTargetWave}."
                            : $"ØªÙ… ØªØ­ÙˆÙŠÙ„ Ø§Ù„Ø·Ù„Ø¨ Ø¥Ù„Ù‰ Ø§Ù„Ù…ØµÙŠÙ {request.ToCategoryId} ÙˆØ§Ù„ÙÙˆØ¬ {normalizedTargetWave}. Ø§Ù„Ù…Ù„Ø§Ø­Ø¸Ø§Øª: {request.Notes.Trim()}",
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
            var summerCategoryIds = SummerRules.Keys.ToList();

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

                    var autoCancelReason = "ØªÙ… Ø¥Ù„ØºØ§Ø¡ Ø§Ù„Ø·Ù„Ø¨ ØªÙ„Ù‚Ø§Ø¦ÙŠØ§Ù‹ Ù„Ø¹Ø¯Ù… Ø§Ù„Ø³Ø¯Ø§Ø¯ Ø®Ù„Ø§Ù„ Ù…Ù‡Ù„Ø© ÙŠÙˆÙ… Ø§Ù„Ø¹Ù…Ù„.";
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

                if (!string.IsNullOrWhiteSpace(notifyEmployeeId))
                {
                    await _signalRConnectionManager.SendNotificationToUser(notifyEmployeeId, new NotificationDto
                    {
                        Notification = "ØªÙ… Ø¥Ù„ØºØ§Ø¡ Ø§Ù„Ø·Ù„Ø¨ ØªÙ„Ù‚Ø§Ø¦ÙŠØ§Ù‹ Ø¨Ø³Ø¨Ø¨ Ø¹Ø¯Ù… Ø§Ù„Ø³Ø¯Ø§Ø¯ Ø®Ù„Ø§Ù„ Ù…Ù‡Ù„Ø© ÙŠÙˆÙ… Ø§Ù„Ø¹Ù…Ù„.",
                        type = NotificationType.info,
                        Title = "Ø¥Ù„ØºØ§Ø¡ ØªÙ„Ù‚Ø§Ø¦ÙŠ Ù„Ø·Ù„Ø¨ Ø§Ù„Ù…ØµÙŠÙ",
                        time = DateTime.Now,
                        sender = "Connect",
                        Category = NotificationCategory.Business
                    });
                }

                await PublishCapacityUpdateAsync(notifyCategoryId, notifyWaveCode, "AUTO_CANCEL");
            }

            return autoCancelledCount;
        }

        private async Task<bool> HasEmployeeUsedTransferInSeasonAsync(string employeeId, int seasonYear, int excludedMessageId)
        {
            var summerCategoryIds = SummerRules.Keys.ToList();
            var messageIds = await _connectContext.Messages
                .AsNoTracking()
                .Where(m => summerCategoryIds.Contains(m.CategoryCd) && m.MessageId != excludedMessageId)
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

        private async Task<bool> HasCapacityAsync(int categoryId, string waveCode, int familyCount, int? excludedMessageId = null)
        {
            if (!SummerRules.TryGetValue(categoryId, out var rule))
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
                throw new InvalidOperationException("ÙŠÙ„Ø²Ù… ÙˆØ¬ÙˆØ¯ Ù…Ø¹Ø§Ù…Ù„Ø© ÙØ¹Ø§Ù„Ø© Ù‚Ø¨Ù„ Ø­Ø¬Ø² Ù‚ÙÙ„ Ø§Ù„Ø³Ø¹Ø©.");
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
                Title = "ØªØ­Ø¯ÙŠØ« Ø³Ø¹Ø§Øª Ø§Ù„Ù…ØµØ§ÙŠÙ",
                time = DateTime.Now,
                sender = "Connect",
                Category = NotificationCategory.Business
            };

            foreach (var group in SummerNotificationGroups)
            {
                try
                {
                    await _signalRConnectionManager.SendNotificationToGroup(group, notification);
                }
                catch
                {
                    // Best effort only.
                }
            }
        }

        private async Task AddReplyWithAttachmentsAsync(int messageId, string message, string userId, string ip, List<IFormFile>? files)
        {
            var reply = _helperService.CreateReply(messageId, message, userId, userId, ip);
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
                StatusLabel = message.Status.GetDescription(),
                CreatedAt = message.CreatedDate,
                PaymentDueAtUtc = ParseDate(GetFieldValue(fields, "Summer_PaymentDueAtUtc")),
                PaidAtUtc = ParseDate(GetFieldValue(fields, "Summer_PaidAtUtc")),
                TransferUsed = ParseInt(GetFieldValue(fields, "Summer_TransferCount"), 0) > 0
            };
        }

        private void UpsertField(List<TkmendField> fields, int messageId, string kind, string value)
        {
            var existing = fields.FirstOrDefault(f => string.Equals(f.FildKind, kind, StringComparison.OrdinalIgnoreCase));
            if (existing == null)
            {
                var field = new TkmendField
                {
                    FildRelted = messageId,
                    FildKind = kind,
                    FildTxt = value,
                    InstanceGroupId = 1
                };
                fields.Add(field);
                _connectContext.TkmendFields.Add(field);
            }
            else
            {
                existing.FildTxt = value;
            }
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
                Message = $"Ù†ÙˆØ¹ Ù…Ø±ÙÙ‚ ØºÙŠØ± Ù…Ø¯Ø¹ÙˆÙ…: {string.Join("ØŒ ", invalidFiles)}. Ø§Ù„Ù…Ø³Ù…ÙˆØ­ ÙÙ‚Ø·: PDF ÙˆØ§Ù„ØµÙˆØ±."
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

        private static string NormalizeActionCode(string? actionCode)
        {
            var token = NormalizeSearchToken(actionCode);
            return token switch
            {
                "finalapprove" or "approve" or "Ø§Ø¹ØªÙ…Ø§Ø¯Ù†Ù‡Ø§Ø¦ÙŠ" or "Ø§Ø¹ØªÙ…Ø§Ø¯" => "FINAL_APPROVE",
                "manualcancel" or "cancel" or "Ø§Ù„ØºØ§Ø¡ÙŠØ¯ÙˆÙŠ" or "Ø§Ù„ØºØ§Ø¡" => "MANUAL_CANCEL",
                "comment" or "reply" or "ØªØ¹Ù„ÙŠÙ‚" or "Ø±Ø¯" => "COMMENT",
                "approvetransfer" or "transferapprove" or "Ø§Ø¹ØªÙ…Ø§Ø¯Ø§Ù„ØªØ­ÙˆÙŠÙ„" => "APPROVE_TRANSFER",
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

        private sealed class SummerRule
        {
            public SummerRule(int maxExtra, Dictionary<int, int> capacityByFamily)
            {
                MaxExtra = maxExtra;
                CapacityByFamily = capacityByFamily;
            }

            public int MaxExtra { get; }
            public Dictionary<int, int> CapacityByFamily { get; }
        }
    }
}


