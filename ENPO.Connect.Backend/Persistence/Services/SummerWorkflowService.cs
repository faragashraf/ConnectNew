using ENPO.Dto.HubSync;
using Microsoft.EntityFrameworkCore;
using Models.Attachment;
using Models.Correspondance;
using Models.DTO.Common;
using Models.DTO.Correspondance.Enums;
using Models.DTO.Correspondance.Summer;
using Persistence.Data;
using Persistence.HelperServices;
using SignalR.Notification;

namespace Persistence.Services
{
    public class SummerWorkflowService
    {
        private readonly ConnectContext _connectContext;
        private readonly Attach_HeldContext _attachHeldContext;
        private readonly helperService _helperService;
        private readonly SignalRConnectionManager _signalRConnectionManager;

        private static readonly Dictionary<int, (int maxFamily, int maxExtra, int[] allowedFamily)> SummerRules = new()
        {
            { 147, (9, 2, new[] { 5, 6, 8, 9 }) },
            { 148, (6, 1, new[] { 2, 4, 6 }) },
            { 149, (7, 2, new[] { 4, 6, 7 }) }
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
                    response.Errors.Add(new Error { Code = "400", Message = "User id is required." });
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
                    var employeeId = GetFieldValue(messageFields, "Emp_Id") ?? string.Empty;
                    var createdByUser = string.Equals(message.CreatedBy, userId, StringComparison.OrdinalIgnoreCase);
                    var forEmployee = string.Equals(employeeId, userId, StringComparison.OrdinalIgnoreCase);
                    if (!createdByUser && !forEmployee)
                    {
                        continue;
                    }

                    var paymentDue = ParseDate(GetFieldValue(messageFields, "Summer_PaymentDueAtUtc"));
                    if (paymentDue.HasValue && paymentDue.Value.Year != seasonYear)
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
                        Status = message.Status.ToString(),
                        CreatedAt = message.CreatedDate,
                        PaymentDueAtUtc = paymentDue,
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

        public async Task<CommonResponse<SummerRequestSummaryDto>> CancelAsync(SummerCancelRequest request, string userId, string ip)
        {
            var response = new CommonResponse<SummerRequestSummaryDto>();
            request ??= new SummerCancelRequest();
            try
            {
                if (request.MessageId <= 0)
                {
                    response.Errors.Add(new Error { Code = "400", Message = "MessageId is required." });
                    return response;
                }

                if (!_helperService.ValidateFileSizes(request.files, response))
                {
                    return response;
                }

                var message = await _connectContext.Messages.FirstOrDefaultAsync(m => m.MessageId == request.MessageId);
                if (message == null)
                {
                    response.Errors.Add(new Error { Code = "404", Message = "Request not found." });
                    return response;
                }

                using var connectTx = _connectContext.Database.BeginTransaction();
                using var attachTx = _attachHeldContext.Database.BeginTransaction();
                try
                {
                    message.Status = MessageStatus.Rejected;

                    var fields = await _connectContext.TkmendFields.Where(f => f.FildRelted == message.MessageId).ToListAsync();
                    UpsertField(fields, message.MessageId, "Summer_ActionType", "CANCEL");
                    UpsertField(fields, message.MessageId, "Summer_CancelReason", (request.Reason ?? string.Empty).Trim());
                    UpsertField(fields, message.MessageId, "Summer_CancelledAtUtc", DateTime.UtcNow.ToString("o"));
                    UpsertField(fields, message.MessageId, "Summer_PaymentStatus", "CANCELLED");

                    await AddReplyWithAttachmentsAsync(
                        message.MessageId,
                        $"?? ????? ???????? ?? ?????. {(string.IsNullOrWhiteSpace(request.Reason) ? string.Empty : "?????: " + request.Reason)}",
                        userId,
                        ip,
                        request.files);

                    await _attachHeldContext.SaveChangesAsync();
                    await _connectContext.SaveChangesAsync();
                    attachTx.Commit();
                    connectTx.Commit();
                }
                catch
                {
                    attachTx.Rollback();
                    connectTx.Rollback();
                    throw;
                }

                var summary = await BuildSummaryAsync(message.MessageId);
                response.Data = summary;

                if (!string.IsNullOrWhiteSpace(summary.EmployeeId))
                {
                    await _signalRConnectionManager.SendNotificationToUser(summary.EmployeeId, new NotificationDto
                    {
                        Notification = "?? ????? ???????? ?? ????? ??????.",
                        type = NotificationType.info,
                        Title = "?????? ?????",
                        time = DateTime.Now,
                        sender = "Connect",
                        Category = NotificationCategory.Business
                    });
                }
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
                    response.Errors.Add(new Error { Code = "400", Message = "MessageId is required." });
                    return response;
                }

                if (!_helperService.ValidateFileSizes(request.files, response))
                {
                    return response;
                }

                var message = await _connectContext.Messages.FirstOrDefaultAsync(m => m.MessageId == request.MessageId);
                if (message == null)
                {
                    response.Errors.Add(new Error { Code = "404", Message = "Request not found." });
                    return response;
                }

                if (message.Status == MessageStatus.Rejected)
                {
                    response.Errors.Add(new Error { Code = "400", Message = "Rejected request cannot be paid." });
                    return response;
                }

                var fields = await _connectContext.TkmendFields.Where(f => f.FildRelted == message.MessageId).ToListAsync();
                var dueAt = ParseDate(GetFieldValue(fields, "Summer_PaymentDueAtUtc")) ?? message.CreatedDate.ToUniversalTime().AddDays(1);
                var paidAt = request.PaidAtUtc?.ToUniversalTime() ?? DateTime.UtcNow;

                if (!request.ForceOverride && paidAt > dueAt)
                {
                    response.Errors.Add(new Error
                    {
                        Code = "400",
                        Message = $"Payment due date has passed. Due at: {dueAt:yyyy-MM-dd HH:mm} UTC"
                    });
                    return response;
                }

                using var connectTx = _connectContext.Database.BeginTransaction();
                using var attachTx = _attachHeldContext.Database.BeginTransaction();
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
                        $"?? ????? ?????? ?????. {(string.IsNullOrWhiteSpace(request.Notes) ? string.Empty : "???????: " + request.Notes)}",
                        userId,
                        ip,
                        request.files);

                    await _attachHeldContext.SaveChangesAsync();
                    await _connectContext.SaveChangesAsync();
                    attachTx.Commit();
                    connectTx.Commit();
                }
                catch
                {
                    attachTx.Rollback();
                    connectTx.Rollback();
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
                    response.Errors.Add(new Error { Code = "400", Message = "MessageId, target destination and target wave are required." });
                    return response;
                }

                if (!_helperService.ValidateFileSizes(request.files, response))
                {
                    return response;
                }

                var message = await _connectContext.Messages.FirstOrDefaultAsync(m => m.MessageId == request.MessageId);
                if (message == null)
                {
                    response.Errors.Add(new Error { Code = "404", Message = "Request not found." });
                    return response;
                }

                if (message.Status == MessageStatus.Rejected)
                {
                    response.Errors.Add(new Error { Code = "400", Message = "Rejected request cannot be transferred." });
                    return response;
                }

                var fields = await _connectContext.TkmendFields.Where(f => f.FildRelted == message.MessageId).ToListAsync();
                var transferCount = ParseInt(GetFieldValue(fields, "Summer_TransferCount"), 0);
                if (transferCount > 0)
                {
                    response.Errors.Add(new Error { Code = "400", Message = "Transfer is allowed once per season only." });
                    return response;
                }

                var employeeId = GetFieldValue(fields, "Emp_Id") ?? string.Empty;
                var newFamilyCount = request.NewFamilyCount ?? ParseInt(GetFieldValue(fields, "FamilyCount"), 0);
                var newExtraCount = request.NewExtraCount ?? ParseInt(GetFieldValue(fields, "Over_Count"), 0);

                if (!SummerRules.TryGetValue(request.ToCategoryId, out var rule))
                {
                    response.Errors.Add(new Error { Code = "400", Message = "Target destination is not configured." });
                    return response;
                }

                if (newFamilyCount <= 0 || !rule.allowedFamily.Contains(newFamilyCount))
                {
                    response.Errors.Add(new Error { Code = "400", Message = "Family count is not allowed for target destination." });
                    return response;
                }

                if (newExtraCount < 0 || newExtraCount > rule.maxExtra)
                {
                    response.Errors.Add(new Error { Code = "400", Message = $"Extra members exceed allowed limit ({rule.maxExtra})." });
                    return response;
                }

                var existsSameWave = await ExistsEmployeeBookingInWaveAsync(request.ToCategoryId, request.ToWaveCode.Trim(), employeeId, message.MessageId);
                if (existsSameWave)
                {
                    response.Errors.Add(new Error { Code = "400", Message = "Employee already has booking in the same destination and wave." });
                    return response;
                }

                using var connectTx = _connectContext.Database.BeginTransaction();
                using var attachTx = _attachHeldContext.Database.BeginTransaction();
                try
                {
                    var fromCategory = message.CategoryCd;
                    var fromWave = GetFieldValue(fields, "SummerCamp") ?? string.Empty;

                    message.CategoryCd = request.ToCategoryId;

                    UpsertField(fields, message.MessageId, "SummerCamp", request.ToWaveCode.Trim());
                    UpsertField(fields, message.MessageId, "FamilyCount", newFamilyCount.ToString());
                    UpsertField(fields, message.MessageId, "Over_Count", newExtraCount.ToString());
                    UpsertField(fields, message.MessageId, "Summer_ActionType", "TRANSFER");
                    UpsertField(fields, message.MessageId, "Summer_TransferCount", "1");
                    UpsertField(fields, message.MessageId, "Summer_TransferFromCategory", fromCategory.ToString());
                    UpsertField(fields, message.MessageId, "Summer_TransferFromWave", fromWave);
                    UpsertField(fields, message.MessageId, "Summer_TransferToCategory", request.ToCategoryId.ToString());
                    UpsertField(fields, message.MessageId, "Summer_TransferToWave", request.ToWaveCode.Trim());
                    UpsertField(fields, message.MessageId, "Summer_TransferredAtUtc", DateTime.UtcNow.ToString("o"));

                    await AddReplyWithAttachmentsAsync(
                        message.MessageId,
                        $"?? ????? ????? ??? ?????? {request.ToCategoryId} ?????? {request.ToWaveCode}. {(string.IsNullOrWhiteSpace(request.Notes) ? string.Empty : "???????: " + request.Notes)}",
                        userId,
                        ip,
                        request.files);

                    await _attachHeldContext.SaveChangesAsync();
                    await _connectContext.SaveChangesAsync();
                    attachTx.Commit();
                    connectTx.Commit();
                }
                catch
                {
                    attachTx.Rollback();
                    connectTx.Rollback();
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

        private async Task<bool> ExistsEmployeeBookingInWaveAsync(int categoryId, string waveCode, string employeeId, int excludedMessageId)
        {
            if (string.IsNullOrWhiteSpace(employeeId) || string.IsNullOrWhiteSpace(waveCode))
            {
                return false;
            }

            var matchingWaveMessageIds = await _connectContext.TkmendFields
                .AsNoTracking()
                .Where(f => f.FildKind == "SummerCamp" && f.FildTxt == waveCode)
                .Select(f => f.FildRelted)
                .Distinct()
                .ToListAsync();

            if (!matchingWaveMessageIds.Any())
            {
                return false;
            }

            var activeMessageIds = await _connectContext.Messages
                .AsNoTracking()
                .Where(m => matchingWaveMessageIds.Contains(m.MessageId)
                            && m.CategoryCd == categoryId
                            && m.MessageId != excludedMessageId
                            && m.Status != MessageStatus.Rejected)
                .Select(m => m.MessageId)
                .ToListAsync();

            if (!activeMessageIds.Any())
            {
                return false;
            }

            return await _connectContext.TkmendFields
                .AsNoTracking()
                .AnyAsync(f => activeMessageIds.Contains(f.FildRelted) && f.FildKind == "Emp_Id" && f.FildTxt == employeeId);
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
                EmployeeId = GetFieldValue(fields, "Emp_Id") ?? string.Empty,
                Status = message.Status.ToString(),
                CreatedAt = message.CreatedDate,
                PaymentDueAtUtc = ParseDate(GetFieldValue(fields, "Summer_PaymentDueAtUtc")),
                PaidAtUtc = ParseDate(GetFieldValue(fields, "Summer_PaidAtUtc")),
                TransferUsed = ParseInt(GetFieldValue(fields, "Summer_TransferCount"), 0) > 0
            };
        }

        private static void UpsertField(List<TkmendField> fields, int messageId, string kind, string value)
        {
            var existing = fields.FirstOrDefault(f => string.Equals(f.FildKind, kind, StringComparison.OrdinalIgnoreCase));
            if (existing == null)
            {
                fields.Add(new TkmendField
                {
                    FildRelted = messageId,
                    FildKind = kind,
                    FildTxt = value,
                    InstanceGroupId = 1
                });
            }
            else
            {
                existing.FildTxt = value;
            }
        }

        private static string? GetFieldValue(IEnumerable<TkmendField> fields, string kind)
        {
            return fields.FirstOrDefault(f => string.Equals(f.FildKind, kind, StringComparison.OrdinalIgnoreCase))?.FildTxt?.Trim();
        }

        private static int ParseInt(string? value, int fallback = 0)
        {
            return int.TryParse((value ?? string.Empty).Trim(), out var parsed) ? parsed : fallback;
        }

        private static DateTime? ParseDate(string? value)
        {
            if (string.IsNullOrWhiteSpace(value)) return null;
            return DateTime.TryParse(value, out var parsed) ? DateTime.SpecifyKind(parsed, DateTimeKind.Utc).ToUniversalTime() : null;
        }
     }
 }
