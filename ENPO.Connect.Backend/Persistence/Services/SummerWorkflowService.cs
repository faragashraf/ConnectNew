using System.Data;
using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
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
        private readonly SummerPricingService _summerPricingService;
        private readonly SummerBookingBlacklistService _summerBookingBlacklistService;
        private readonly SummerUnitFreezeService _summerUnitFreezeService;

        private const int CapacityLockTimeoutMs = 15000;
        private const int AdminActionGateTimeoutMs = 10000;
        private const int AdminActionLockTimeoutMs = 15000;
        private const int CapacityUpdateDispatchTimeoutMs = 4000;
        private const string SummerDynamicApplicationId = SummerWorkflowDomainConstants.DynamicApplicationId;
        private const string SummerDestinationCatalogMend = SummerWorkflowDomainConstants.DestinationCatalogMend;
        private const string TransferReviewRequiredCode = SummerWorkflowDomainConstants.TransferReviewRequiredCode;
        private const string TransferReviewResolvedCode = SummerWorkflowDomainConstants.TransferReviewResolvedCode;
        private const string PendingReviewRequiredCode = SummerWorkflowDomainConstants.PendingReviewRequiredCode;
        private const string PendingReviewResolvedCode = SummerWorkflowDomainConstants.PendingReviewResolvedCode;
        private const string RequestCreatedAtUtcFieldKind = SummerWorkflowDomainConstants.RequestCreatedAtUtcFieldKind;
        private const string PaymentDueAtUtcFieldKind = SummerWorkflowDomainConstants.PaymentDueAtUtcFieldKind;
        private const string PaidAtUtcFieldKind = SummerWorkflowDomainConstants.PaidAtUtcFieldKind;
        private const string PaymentStatusFieldKind = SummerWorkflowDomainConstants.PaymentStatusFieldKind;
        private const string ActionTypeFieldKind = SummerWorkflowDomainConstants.ActionTypeFieldKind;
        private const string RequestPaymentStatePaidCode = "PAID";
        private const string RequestPaymentStateUnpaidCode = "UNPAID";
        private const string RequestPaymentStatePartialPaidCode = "PARTIAL_PAID";
        private const int AdminActionCommentMaxLength = 300;
        private const int InternalAdminActionCommentMaxLength = 2000;
        private static readonly Regex AdminActionCommentLettersRegex = new(
            @"^[\p{L}\s]+$",
            RegexOptions.Compiled | RegexOptions.CultureInvariant);
        private static readonly string[] WaveCodeFieldKinds = SummerWorkflowDomainConstants.WaveCodeFieldKinds;
        private static readonly string[] WaveLabelFieldKinds = SummerWorkflowDomainConstants.WaveLabelFieldKinds;
        private static readonly string[] FamilyCountFieldKinds = SummerWorkflowDomainConstants.FamilyCountFieldKinds;
        private static readonly string[] ExtraCountFieldKinds = SummerWorkflowDomainConstants.ExtraCountFieldKinds;
        private static readonly string[] PaymentModeFieldKinds = SummerWorkflowDomainConstants.PaymentModeFieldKinds;
        private static readonly string[] InstallmentCountFieldKinds = SummerWorkflowDomainConstants.InstallmentCountFieldKinds;
        private static readonly string[] DestinationIdFieldKinds = SummerWorkflowDomainConstants.DestinationIdFieldKinds;
        private static readonly string[] DestinationNameFieldKinds = SummerWorkflowDomainConstants.DestinationNameFieldKinds;
        private static readonly string[] EmployeeIdFieldKinds = SummerWorkflowDomainConstants.EmployeeIdFieldKinds;
        private static readonly string[] EmployeeNameFieldKinds = SummerWorkflowDomainConstants.EmployeeNameFieldKinds;
        private static readonly string[] EmployeeNationalIdFieldKinds = SummerWorkflowDomainConstants.EmployeeNationalIdFieldKinds;
        private static readonly string[] EmployeePhoneFieldKinds = SummerWorkflowDomainConstants.EmployeePhoneFieldKinds;
        private static readonly string[] EmployeeExtraPhoneFieldKinds = SummerWorkflowDomainConstants.EmployeeExtraPhoneFieldKinds;
        private static readonly string[] WorkEntityFieldKinds =
        {
            "Department",
            "SUM2026_Department",
            "CurrPlace",
            "CurrentPlace",
            "OrgUnitName",
            "OrganizationName",
            "UnitName",
            "EntityName",
            "Job",
            "SUM2026_Job"
        };
        private static readonly string[] UnitNumberFieldKinds =
        {
            "Summer_UnitNumber",
            "SUM2026_UnitNumber",
            "UnitNumber",
            "RoomNumber",
            "ApartmentNumber",
            "ChaletNumber"
        };
        private static readonly string[] NotesFieldKinds =
        {
            "Description",
            "Notes",
            "Remark",
            "Remarks",
            "Summer_AdminComment",
            "Summer_PaymentNotes"
        };
        private static readonly string[] PricingAccommodationTotalFieldKinds =
        {
            SummerWorkflowDomainConstants.PricingFieldKinds.AccommodationTotal
        };
        private static readonly string[] PricingTransportationTotalFieldKinds =
        {
            SummerWorkflowDomainConstants.PricingFieldKinds.TransportationTotal
        };
        private static readonly string[] PricingInsuranceAmountFieldKinds =
        {
            SummerWorkflowDomainConstants.PricingFieldKinds.InsuranceAmount
        };
        private static readonly string[] PricingMembershipTypeFieldKinds =
        {
            SummerWorkflowDomainConstants.PricingFieldKinds.MembershipType
        };
        private static readonly string[] PricingAppliedInsuranceAmountFieldKinds =
        {
            SummerWorkflowDomainConstants.PricingFieldKinds.AppliedInsuranceAmount
        };
        private static readonly string[] PricingGrandTotalFieldKinds =
        {
            SummerWorkflowDomainConstants.PricingFieldKinds.GrandTotal
        };
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
            IOptionsMonitor<ResortBookingBlacklistOptions> resortBookingBlacklistOptions,
            ILogger<SummerWorkflowService> logger)
        {
            _connectContext = connectContext;
            _attachHeldContext = attachHeldContext;
            _gPAContext = gpaContext;
            _helperService = helperService;
            _notificationService = notificationService;
            _applicationConfig = options?.Value ?? new ApplicationConfig();
            _logger = logger;
            _summerPricingService = new SummerPricingService(_connectContext);
            _summerBookingBlacklistService = new SummerBookingBlacklistService(resortBookingBlacklistOptions);
            _summerUnitFreezeService = new SummerUnitFreezeService(_connectContext, _logger);
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

                    var isProxyBooking = ParseBooleanLike(GetFirstFieldValue(messageFields, SummerWorkflowDomainConstants.ProxyModeFieldKinds));
                    if (isProxyBooking == true)
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
                    var paymentState = ResolveRequestPaymentStateSnapshot(messageFields);

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
                        StatusLabel = ResolveSummaryStatusLabel(message.Status, messageFields, IsWorkflowStateLabelPreferred(workflowStateCode), workflowStateLabel),
                        WorkflowStateCode = workflowStateCode,
                        WorkflowStateLabel = workflowStateLabel,
                        NeedsTransferReview = needsTransferReview,
                        CreatedAt = ResolveRequestCreatedAtUtc(message, messageFields),
                        PaymentDueAtUtc = ParseDate(GetFieldValue(messageFields, PaymentDueAtUtcFieldKind)),
                        PaidAtUtc = paymentState.PaidAtUtc,
                        PaymentStateCode = paymentState.PaymentStateCode,
                        PaymentStateLabel = paymentState.PaymentStateLabel,
                        PaidInstallmentsCount = paymentState.PaidInstallmentsCount,
                        TotalInstallmentsCount = paymentState.TotalInstallmentsCount,
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

        public async Task<CommonResponse<string>> CreateEditTokenAsync(
            SummerCreateEditTokenRequest request,
            string userId,
            string ip,
            bool hasSummerAdminPermission = false)
        {
            var response = new CommonResponse<string>();
            request ??= new SummerCreateEditTokenRequest();
            try
            {
                var normalizedUserId = (userId ?? string.Empty).Trim();
                if (request.MessageId <= 0)
                {
                    response.Errors.Add(new Error { Code = "400", Message = "رقم الطلب مطلوب." });
                    return response;
                }

                if (string.IsNullOrWhiteSpace(normalizedUserId))
                {
                    response.Errors.Add(new Error { Code = "401", Message = "المستخدم غير مصرح." });
                    return response;
                }

                var message = await _connectContext.Messages
                    .AsNoTracking()
                    .FirstOrDefaultAsync(item => item.MessageId == request.MessageId);
                if (message == null)
                {
                    response.Errors.Add(new Error { Code = "404", Message = "الطلب غير موجود." });
                    return response;
                }

                var summerRules = await GetSummerRulesAsync();
                if (!summerRules.ContainsKey(message.CategoryCd))
                {
                    response.Errors.Add(new Error { Code = "404", Message = "طلب المصيف غير موجود." });
                    return response;
                }

                if (!await CanUserEditSummerMessageAsync(normalizedUserId, message))
                {
                    _logger.LogWarning(
                        "Summer edit token creation denied due to missing authorization. MessageId={MessageId}, UserId={UserId}, IP={IP}",
                        request.MessageId,
                        normalizedUserId,
                        ip);
                    response.Errors.Add(new Error { Code = "404", Message = "طلب المصيف غير موجود." });
                    return response;
                }

                var messageFields = await _connectContext.TkmendFields
                    .AsNoTracking()
                    .Where(field => field.FildRelted == message.MessageId)
                    .ToListAsync();
                var paymentState = ResolveRequestPaymentStateSnapshot(messageFields);
                if (!hasSummerAdminPermission && (message.Status == MessageStatus.Rejected || paymentState.PaidAtUtc.HasValue))
                {
                    response.Errors.Add(new Error { Code = "400", Message = "لا يمكن إنشاء رابط تعديل لهذا الطلب في حالته الحالية." });
                    return response;
                }

                var now = DateTime.UtcNow;
                var lifetimeMinutes = NormalizeEditTokenLifetimeMinutes(request.ExpireMinutes);
                var purpose = SummerWorkflowDomainConstants.RequestTokenPurposes.SummerEdit;

                var previouslyActiveTokens = await _connectContext.RequestTokens
                    .Where(tokenRow =>
                        tokenRow.MessageId == request.MessageId
                        && tokenRow.TokenPurpose == purpose
                        && tokenRow.RevokedAt == null
                        && (!tokenRow.ExpiresAt.HasValue || tokenRow.ExpiresAt > now)
                        && (!tokenRow.IsOneTimeUse || !tokenRow.IsUsed)
                        && (tokenRow.UserId == null || tokenRow.UserId == normalizedUserId))
                    .ToListAsync();
                if (previouslyActiveTokens.Count > 0)
                {
                    foreach (var activeToken in previouslyActiveTokens)
                    {
                        activeToken.RevokedAt = now;
                        activeToken.RevokedBy = normalizedUserId;
                    }
                }

                var rawToken = GenerateSecureToken();
                var tokenHash = ComputeTokenHash(rawToken);
                var entity = new RequestToken
                {
                    Token = Guid.NewGuid().ToString("N"),
                    TokenHash = tokenHash,
                    MessageId = request.MessageId,
                    TokenPurpose = purpose,
                    IsUsed = false,
                    IsOneTimeUse = request.OneTimeUse,
                    UsedAt = null,
                    CreatedAt = now,
                    CreatedBy = normalizedUserId,
                    UserId = normalizedUserId,
                    ExpiresAt = now.AddMinutes(lifetimeMinutes),
                    RevokedAt = null,
                    RevokedBy = null
                };

                await _connectContext.RequestTokens.AddAsync(entity);
                await _connectContext.SaveChangesAsync();

                response.Data = rawToken;
            }
            catch (Exception ex)
            {
                response.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });
            }

            return response;
        }

        public async Task<CommonResponse<SummerEditTokenResolutionDto>> ResolveEditTokenAsync(
            string token,
            string userId,
            string ip,
            bool hasSummerAdminPermission = false)
        {
            var response = new CommonResponse<SummerEditTokenResolutionDto>();
            try
            {
                var normalizedToken = (token ?? string.Empty).Trim();
                var normalizedUserId = (userId ?? string.Empty).Trim();
                if (string.IsNullOrWhiteSpace(normalizedToken))
                {
                    response.Errors.Add(new Error { Code = "400", Message = "رمز الرابط مطلوب." });
                    return response;
                }

                if (string.IsNullOrWhiteSpace(normalizedUserId))
                {
                    response.Errors.Add(new Error { Code = "401", Message = "المستخدم غير مصرح." });
                    return response;
                }

                var tokenHash = ComputeTokenHash(normalizedToken);
                var tokenRow = await _connectContext.RequestTokens
                    .OrderByDescending(item => item.CreatedAt)
                    .FirstOrDefaultAsync(item =>
                        (item.TokenHash != null && item.TokenHash == tokenHash)
                        || (item.TokenHash == null && item.Token == normalizedToken));
                if (tokenRow == null)
                {
                    _logger.LogWarning(
                        "Summer edit token lookup failed (not found). UserId={UserId}, IP={IP}, TokenPrefix={TokenPrefix}",
                        normalizedUserId,
                        ip,
                        normalizedToken.Length > 8 ? normalizedToken[..8] : normalizedToken);
                    response.Errors.Add(new Error { Code = "404", Message = "رابط التعديل غير صالح." });
                    return response;
                }

                var tokenPurpose = (tokenRow.TokenPurpose ?? string.Empty).Trim();
                if (!string.Equals(tokenPurpose, SummerWorkflowDomainConstants.RequestTokenPurposes.SummerEdit, StringComparison.OrdinalIgnoreCase))
                {
                    _logger.LogWarning(
                        "Summer edit token rejected due to invalid purpose. TokenId={TokenId}, Purpose={Purpose}, UserId={UserId}, IP={IP}",
                        tokenRow.Id,
                        tokenPurpose,
                        normalizedUserId,
                        ip);
                    response.Errors.Add(new Error { Code = "404", Message = "رابط التعديل غير صالح." });
                    return response;
                }

                var now = DateTime.UtcNow;
                if (tokenRow.RevokedAt.HasValue)
                {
                    _logger.LogWarning(
                        "Summer edit token rejected (revoked). TokenId={TokenId}, MessageId={MessageId}, RevokedAt={RevokedAt}, UserId={UserId}, IP={IP}",
                        tokenRow.Id,
                        tokenRow.MessageId,
                        tokenRow.RevokedAt,
                        normalizedUserId,
                        ip);
                    response.Errors.Add(new Error { Code = "410", Message = "انتهت صلاحية رابط التعديل." });
                    return response;
                }

                if (tokenRow.ExpiresAt.HasValue && tokenRow.ExpiresAt.Value <= now)
                {
                    _logger.LogWarning(
                        "Summer edit token rejected (expired). TokenId={TokenId}, MessageId={MessageId}, ExpiresAt={ExpiresAt}, UserId={UserId}, IP={IP}",
                        tokenRow.Id,
                        tokenRow.MessageId,
                        tokenRow.ExpiresAt,
                        normalizedUserId,
                        ip);
                    response.Errors.Add(new Error { Code = "410", Message = "انتهت صلاحية رابط التعديل." });
                    return response;
                }

                if (tokenRow.IsOneTimeUse && tokenRow.IsUsed)
                {
                    _logger.LogWarning(
                        "Summer edit token rejected (already used). TokenId={TokenId}, MessageId={MessageId}, UserId={UserId}, IP={IP}",
                        tokenRow.Id,
                        tokenRow.MessageId,
                        normalizedUserId,
                        ip);
                    response.Errors.Add(new Error { Code = "410", Message = "تم استخدام رابط التعديل مسبقاً." });
                    return response;
                }

                if (!string.IsNullOrWhiteSpace(tokenRow.UserId)
                    && !string.Equals(tokenRow.UserId.Trim(), normalizedUserId, StringComparison.OrdinalIgnoreCase))
                {
                    _logger.LogWarning(
                        "Summer edit token rejected (user mismatch). TokenId={TokenId}, MessageId={MessageId}, TokenUserId={TokenUserId}, CurrentUserId={CurrentUserId}, IP={IP}",
                        tokenRow.Id,
                        tokenRow.MessageId,
                        tokenRow.UserId,
                        normalizedUserId,
                        ip);
                    response.Errors.Add(new Error { Code = "404", Message = "رابط التعديل غير صالح." });
                    return response;
                }

                var message = await _connectContext.Messages
                    .AsNoTracking()
                    .FirstOrDefaultAsync(item => item.MessageId == tokenRow.MessageId);
                if (message == null)
                {
                    response.Errors.Add(new Error { Code = "404", Message = "الطلب غير موجود." });
                    return response;
                }

                var summerRules = await GetSummerRulesAsync();
                if (!summerRules.ContainsKey(message.CategoryCd))
                {
                    response.Errors.Add(new Error { Code = "404", Message = "طلب المصيف غير موجود." });
                    return response;
                }

                if (!await CanUserEditSummerMessageAsync(normalizedUserId, message))
                {
                    _logger.LogWarning(
                        "Summer edit token rejected due to access check. TokenId={TokenId}, MessageId={MessageId}, UserId={UserId}, IP={IP}",
                        tokenRow.Id,
                        tokenRow.MessageId,
                        normalizedUserId,
                        ip);
                    response.Errors.Add(new Error { Code = "404", Message = "رابط التعديل غير صالح." });
                    return response;
                }

                var messageFields = await _connectContext.TkmendFields
                    .AsNoTracking()
                    .Where(field => field.FildRelted == message.MessageId)
                    .ToListAsync();
                var paymentState = ResolveRequestPaymentStateSnapshot(messageFields);
                if (!hasSummerAdminPermission && (message.Status == MessageStatus.Rejected || paymentState.PaidAtUtc.HasValue))
                {
                    response.Errors.Add(new Error { Code = "400", Message = "لا يمكن تعديل الطلب في حالته الحالية." });
                    return response;
                }

                if (tokenRow.IsOneTimeUse && !tokenRow.IsUsed)
                {
                    tokenRow.IsUsed = true;
                    tokenRow.UsedAt = now;
                    await _connectContext.SaveChangesAsync();
                }

                response.Data = new SummerEditTokenResolutionDto
                {
                    MessageId = tokenRow.MessageId,
                    ExpiresAtUtc = tokenRow.ExpiresAt,
                    IsOneTimeUse = tokenRow.IsOneTimeUse
                };
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
                    var paymentState = ResolveRequestPaymentStateSnapshot(messageFields);

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
                        StatusLabel = ResolveSummaryStatusLabel(message.Status, messageFields, IsWorkflowStateLabelPreferred(workflowStateCode), workflowStateLabel),
                        WorkflowStateCode = workflowStateCode,
                        WorkflowStateLabel = workflowStateLabel,
                        NeedsTransferReview = needsTransferReview,
                        CreatedAt = ResolveRequestCreatedAtUtc(message, messageFields),
                        PaymentDueAtUtc = ParseDate(GetFieldValue(messageFields, PaymentDueAtUtcFieldKind)),
                        PaidAtUtc = paymentState.PaidAtUtc,
                        PaymentStateCode = paymentState.PaymentStateCode,
                        PaymentStateLabel = paymentState.PaymentStateLabel,
                        PaidInstallmentsCount = paymentState.PaidInstallmentsCount,
                        TotalInstallmentsCount = paymentState.TotalInstallmentsCount,
                        TransferUsed = ParseInt(GetFieldValue(messageFields, "Summer_TransferCount"), 0) > 0
                    });
                }

                var normalizedWaveCode = (query.WaveCode ?? string.Empty).Trim();
                var normalizedEmployeeId = (query.EmployeeId ?? string.Empty).Trim();
                var requestedStatusRaw = (query.Status ?? string.Empty).Trim();
                var normalizedStatus = NormalizeSearchToken(query.Status);
                var requestedMessageStatus = ResolveRequestedStatusMessageStatus(requestedStatusRaw);
                var requestedStatusCode = ResolveDashboardStatusCode(requestedStatusRaw);
                var requestedPaymentState = ResolveRequestedPaymentStateFilter(query.PaymentState);
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

                    if (requestedPaymentState != PaymentStateFilterKind.Any)
                    {
                        var paymentStateCode = NormalizeSearchToken(item.PaymentStateCode);
                        var isPaid = paymentStateCode == NormalizeSearchToken(RequestPaymentStatePaidCode);
                        var isPartialPaid = paymentStateCode == NormalizeSearchToken(RequestPaymentStatePartialPaidCode);
                        var isUnpaid = paymentStateCode == NormalizeSearchToken(RequestPaymentStateUnpaidCode);
                        var isOverdueUnpaid = !isPaid
                            && !isPartialPaid
                            && item.PaymentDueAtUtc.HasValue
                            && item.PaymentDueAtUtc.Value < nowUtc;

                        if (requestedPaymentState == PaymentStateFilterKind.Paid && !isPaid)
                        {
                            return false;
                        }

                        if (requestedPaymentState == PaymentStateFilterKind.Unpaid && !isUnpaid)
                        {
                            return false;
                        }

                        if (requestedPaymentState == PaymentStateFilterKind.PartialPaid && !isPartialPaid)
                        {
                            return false;
                        }

                        if (requestedPaymentState == PaymentStateFilterKind.OverdueUnpaid && !isOverdueUnpaid)
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
                var paidStateToken = NormalizeSearchToken(RequestPaymentStatePaidCode);
                var partialPaidStateToken = NormalizeSearchToken(RequestPaymentStatePartialPaidCode);
                var unpaidStateToken = NormalizeSearchToken(RequestPaymentStateUnpaidCode);
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
                    PaidCount = requests.Count(r => NormalizeSearchToken(r.PaymentStateCode) == paidStateToken),
                    PartialPaidCount = requests.Count(r => NormalizeSearchToken(r.PaymentStateCode) == partialPaidStateToken),
                    UnpaidCount = requests.Count(r => NormalizeSearchToken(r.PaymentStateCode) == unpaidStateToken),
                    OverdueUnpaidCount = requests.Count(r =>
                        NormalizeSearchToken(r.PaymentStateCode) == unpaidStateToken
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

        public async Task<CommonResponse<IEnumerable<SummerUnitFreezeDto>>> GetUnitFreezesAsync(
            SummerUnitFreezeQuery query,
            string userId,
            bool hasSummerPricingPermission = false)
        {
            var response = new CommonResponse<IEnumerable<SummerUnitFreezeDto>>();
            query ??= new SummerUnitFreezeQuery();
            try
            {
                if (!hasSummerPricingPermission)
                {
                    response.Errors.Add(new Error
                    {
                        Code = "403",
                        Message = "غير مصرح لك بعرض عمليات تجميد الوحدات. يتطلب دور المدير العام (RoleId 2021)."
                    });
                    return response;
                }

                var manageableCategoryIds = await GetManageableSummerCategoryIdsAsync(userId);
                if (manageableCategoryIds.Count == 0)
                {
                    var summerRules = await GetSummerRulesAsync();
                    manageableCategoryIds = summerRules.Keys.ToHashSet();
                }

                if (manageableCategoryIds.Count == 0)
                {
                    response.Data = Array.Empty<SummerUnitFreezeDto>();
                    return response;
                }

                var normalizedWaveCode = (query.WaveCode ?? string.Empty).Trim();
                var freezeQuery = _summerUnitFreezeService.BuildFreezeBatchesQuery()
                    .AsNoTracking()
                    .Where(batch => manageableCategoryIds.Contains(batch.CategoryId));

                if (query.CategoryId.HasValue && query.CategoryId.Value > 0)
                {
                    freezeQuery = freezeQuery.Where(batch => batch.CategoryId == query.CategoryId.Value);
                }

                if (!string.IsNullOrWhiteSpace(normalizedWaveCode))
                {
                    freezeQuery = freezeQuery.Where(batch => batch.WaveCode == normalizedWaveCode);
                }

                if (query.FamilyCount.HasValue && query.FamilyCount.Value > 0)
                {
                    freezeQuery = freezeQuery.Where(batch => batch.FamilyCount == query.FamilyCount.Value);
                }

                if (query.IsActive.HasValue)
                {
                    freezeQuery = freezeQuery.Where(batch => batch.IsActive == query.IsActive.Value);
                }

                var batches = await freezeQuery
                    .OrderByDescending(batch => batch.CreatedAtUtc)
                    .ToListAsync();
                if (batches.Count == 0)
                {
                    response.Data = Array.Empty<SummerUnitFreezeDto>();
                    return response;
                }

                var freezeIds = batches.Select(batch => batch.FreezeId).ToList();
                var detailCounters = await _connectContext.SummerUnitFreezeDetails
                    .AsNoTracking()
                    .Where(detail => freezeIds.Contains(detail.FreezeId))
                    .GroupBy(detail => new { detail.FreezeId, detail.Status })
                    .Select(group => new
                    {
                        group.Key.FreezeId,
                        group.Key.Status,
                        Count = group.Count()
                    })
                    .ToListAsync();

                var availableByFreeze = detailCounters
                    .Where(item => item.Status == SummerUnitFreezeStatuses.FrozenAvailable)
                    .ToDictionary(item => item.FreezeId, item => item.Count);
                var assignedByFreeze = detailCounters
                    .Where(item => item.Status == SummerUnitFreezeStatuses.Booked)
                    .ToDictionary(item => item.FreezeId, item => item.Count);

                response.Data = batches
                    .Select(batch => MapFreezeBatchToDto(
                        batch,
                        availableByFreeze.TryGetValue(batch.FreezeId, out var frozenAvailableUnits) ? frozenAvailableUnits : 0,
                        assignedByFreeze.TryGetValue(batch.FreezeId, out var frozenAssignedUnits) ? frozenAssignedUnits : 0))
                    .ToList();
            }
            catch (Exception ex)
            {
                response.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });
            }

            return response;
        }

        public async Task<CommonResponse<SummerUnitFreezeDto>> CreateUnitFreezeAsync(
            SummerUnitFreezeCreateRequest request,
            string userId,
            bool hasSummerPricingPermission = false)
        {
            var response = new CommonResponse<SummerUnitFreezeDto>();
            var traceId = Guid.NewGuid().ToString("N");
            request ??= new SummerUnitFreezeCreateRequest();
            try
            {
                if (!hasSummerPricingPermission)
                {
                    response.Errors.Add(new Error
                    {
                        Code = "403",
                        Message = "غير مصرح لك بإنشاء تجميد وحدات. يتطلب دور المدير العام (RoleId 2021)."
                    });
                    return response;
                }

                _logger.LogInformation(
                    "Unit-freeze create request started. TraceId={TraceId}, UserId={UserId}, CategoryId={CategoryId}, WaveCode={WaveCode}, FamilyCount={FamilyCount}, RequestedUnitsCount={RequestedUnitsCount}",
                    traceId,
                    userId,
                    request.CategoryId,
                    request.WaveCode,
                    request.FamilyCount,
                    request.RequestedUnitsCount);

                if (request.CategoryId <= 0 || string.IsNullOrWhiteSpace(request.WaveCode) || request.FamilyCount <= 0 || request.RequestedUnitsCount <= 0)
                {
                    response.Errors.Add(new Error { Code = "400", Message = "بيانات التجميد غير مكتملة." });
                    _logger.LogWarning(
                        "Unit-freeze create request validation failed. TraceId={TraceId}",
                        traceId);
                    return response;
                }

                var seasonYear = SummerWorkflowDomainConstants.DefaultSeasonYear;
                var summerRules = await GetSummerRulesAsync(seasonYear);
                if (!summerRules.TryGetValue(request.CategoryId, out var rule))
                {
                    response.Errors.Add(new Error { Code = "400", Message = "المصيف غير مُعد في النظام." });
                    _logger.LogWarning(
                        "Unit-freeze create failed because category is not configured in summer rules. TraceId={TraceId}, CategoryId={CategoryId}",
                        traceId,
                        request.CategoryId);
                    return response;
                }

                if (!rule.CapacityByFamily.TryGetValue(request.FamilyCount, out var totalUnits) || totalUnits <= 0)
                {
                    response.Errors.Add(new Error { Code = "400", Message = "السعة المطلوبة غير متاحة في إعدادات المصيف." });
                    _logger.LogWarning(
                        "Unit-freeze create failed because requested family capacity is not configured. TraceId={TraceId}, CategoryId={CategoryId}, FamilyCount={FamilyCount}",
                        traceId,
                        request.CategoryId,
                        request.FamilyCount);
                    return response;
                }

                _logger.LogInformation(
                    "Before creating freeze batch. TraceId={TraceId}, CategoryId={CategoryId}, WaveCode={WaveCode}, FamilyCount={FamilyCount}, RequestedUnitsCount={RequestedUnitsCount}, TotalUnits={TotalUnits}",
                    traceId,
                    request.CategoryId,
                    request.WaveCode,
                    request.FamilyCount,
                    request.RequestedUnitsCount,
                    totalUnits);

                var createResult = await _summerUnitFreezeService.CreateFreezeBatchAsync(
                    request.CategoryId,
                    request.WaveCode,
                    request.FamilyCount,
                    request.RequestedUnitsCount,
                    totalUnits,
                    request.FreezeType ?? "GENERAL",
                    request.Reason,
                    request.Notes,
                    userId,
                    requestTraceId: traceId);

                if (!createResult.Success || createResult.Batch == null)
                {
                    response.Errors.Add(new Error
                    {
                        Code = string.IsNullOrWhiteSpace(createResult.ErrorCode) ? "400" : createResult.ErrorCode!,
                        Message = string.IsNullOrWhiteSpace(createResult.ErrorMessage) ? "تعذر إنشاء التجميد." : createResult.ErrorMessage!
                    });
                    _logger.LogWarning(
                        "Unit-freeze create failed in freeze service result. TraceId={TraceId}, ErrorCode={ErrorCode}, ErrorMessage={ErrorMessage}",
                        traceId,
                        createResult.ErrorCode,
                        createResult.ErrorMessage);
                    return response;
                }

                _logger.LogInformation(
                    "Before mapping freeze response DTO. TraceId={TraceId}, FreezeId={FreezeId}",
                    traceId,
                    createResult.Batch.FreezeId);
                response.Data = MapFreezeBatchToDto(
                    createResult.Batch,
                    request.RequestedUnitsCount,
                    0);

                _logger.LogInformation(
                    "Before secondary capacity update publish (SignalR). TraceId={TraceId}, FreezeId={FreezeId}, CategoryId={CategoryId}, WaveCode={WaveCode}",
                    traceId,
                    createResult.Batch.FreezeId,
                    request.CategoryId,
                    request.WaveCode?.Trim());
                await PublishCapacityUpdateAsync(request.CategoryId, request.WaveCode.Trim(), "FREEZE_CREATE", traceId);
            }
            catch (Exception ex)
            {
                response.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });
                _logger.LogError(
                    ex,
                    "Unit-freeze create request failed with unhandled exception. TraceId={TraceId}, CategoryId={CategoryId}, WaveCode={WaveCode}, FamilyCount={FamilyCount}, RequestedUnitsCount={RequestedUnitsCount}",
                    traceId,
                    request.CategoryId,
                    request.WaveCode,
                    request.FamilyCount,
                    request.RequestedUnitsCount);
            }
            finally
            {
                _logger.LogInformation(
                    "Immediately before returning unit-freeze create response. TraceId={TraceId}, IsSuccess={IsSuccess}, ErrorCount={ErrorCount}, FreezeId={FreezeId}",
                    traceId,
                    response.IsSuccess,
                    response.Errors.Count,
                    response.Data?.FreezeId);
            }

            return response;
        }

        public async Task<CommonResponse<SummerUnitFreezeDto>> ReleaseUnitFreezeAsync(
            SummerUnitFreezeReleaseRequest request,
            string userId,
            bool hasSummerPricingPermission = false)
        {
            var response = new CommonResponse<SummerUnitFreezeDto>();
            request ??= new SummerUnitFreezeReleaseRequest();
            try
            {
                if (!hasSummerPricingPermission)
                {
                    response.Errors.Add(new Error
                    {
                        Code = "403",
                        Message = "غير مصرح لك بفك التجميد. يتطلب دور المدير العام (RoleId 2021)."
                    });
                    return response;
                }

                if (request.FreezeId <= 0)
                {
                    response.Errors.Add(new Error { Code = "400", Message = "رقم التجميد مطلوب." });
                    return response;
                }

                var batchSnapshot = await _summerUnitFreezeService.BuildFreezeBatchesQuery()
                    .AsNoTracking()
                    .FirstOrDefaultAsync(batch => batch.FreezeId == request.FreezeId);
                if (batchSnapshot == null)
                {
                    response.Errors.Add(new Error { Code = "404", Message = "عملية التجميد غير موجودة." });
                    return response;
                }

                var releaseResult = await _summerUnitFreezeService.ReleaseFreezeBatchAsync(request.FreezeId, userId);
                if (!releaseResult.Success || releaseResult.Batch == null)
                {
                    response.Errors.Add(new Error
                    {
                        Code = string.IsNullOrWhiteSpace(releaseResult.ErrorCode) ? "400" : releaseResult.ErrorCode!,
                        Message = string.IsNullOrWhiteSpace(releaseResult.ErrorMessage) ? "تعذر فك التجميد." : releaseResult.ErrorMessage!
                    });
                    return response;
                }

                var frozenAvailableUnits = releaseResult.Batch.Details.Count(detail => detail.Status == SummerUnitFreezeStatuses.FrozenAvailable);
                var frozenAssignedUnits = releaseResult.Batch.Details.Count(detail => detail.Status == SummerUnitFreezeStatuses.Booked);
                response.Data = MapFreezeBatchToDto(releaseResult.Batch, frozenAvailableUnits, frozenAssignedUnits);

                await PublishCapacityUpdateAsync(releaseResult.Batch.CategoryId, releaseResult.Batch.WaveCode, "FREEZE_RELEASE");
            }
            catch (Exception ex)
            {
                response.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });
            }

            return response;
        }

        public async Task<CommonResponse<SummerUnitFreezeDetailsDto>> GetUnitFreezeDetailsAsync(
            int freezeId,
            string userId,
            bool hasSummerPricingPermission = false)
        {
            var response = new CommonResponse<SummerUnitFreezeDetailsDto>();
            try
            {
                if (!hasSummerPricingPermission)
                {
                    response.Errors.Add(new Error
                    {
                        Code = "403",
                        Message = "غير مصرح لك بعرض تفاصيل التجميد. يتطلب دور المدير العام (RoleId 2021)."
                    });
                    return response;
                }

                if (freezeId <= 0)
                {
                    response.Errors.Add(new Error { Code = "400", Message = "رقم التجميد مطلوب." });
                    return response;
                }

                var batch = await _summerUnitFreezeService.BuildFreezeBatchesQuery()
                    .AsNoTracking()
                    .Include(item => item.Details)
                    .FirstOrDefaultAsync(item => item.FreezeId == freezeId);
                if (batch == null)
                {
                    response.Errors.Add(new Error { Code = "404", Message = "عملية التجميد غير موجودة." });
                    return response;
                }

                var frozenAvailableUnits = batch.Details.Count(detail => detail.Status == SummerUnitFreezeStatuses.FrozenAvailable);
                var frozenAssignedUnits = batch.Details.Count(detail => detail.Status == SummerUnitFreezeStatuses.Booked);

                response.Data = new SummerUnitFreezeDetailsDto
                {
                    Freeze = MapFreezeBatchToDto(batch, frozenAvailableUnits, frozenAssignedUnits),
                    Units = batch.Details
                        .OrderBy(detail => detail.SlotNumber)
                        .Select(detail => new SummerUnitFreezeDetailDto
                        {
                            FreezeDetailId = detail.FreezeDetailId,
                            SlotNumber = detail.SlotNumber,
                            Status = detail.Status,
                            AssignedMessageId = detail.AssignedMessageId,
                            AssignedAtUtc = detail.AssignedAtUtc,
                            ReleasedAtUtc = detail.ReleasedAtUtc,
                            ReleasedBy = detail.ReleasedBy,
                            LastStatusChangedAtUtc = detail.LastStatusChangedAtUtc
                        })
                        .ToList()
                };
            }
            catch (Exception ex)
            {
                response.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });
            }

            return response;
        }

        public async Task<CommonResponse<SummerUnitsAvailableCountDto>> GetUnitsAvailableCountAsync(SummerUnitsAvailableCountQuery query, string userId)
        {
            var response = new CommonResponse<SummerUnitsAvailableCountDto>();
            query ??= new SummerUnitsAvailableCountQuery();
            try
            {
                if (query.CategoryId <= 0 || query.FamilyCount <= 0 || string.IsNullOrWhiteSpace(query.WaveCode))
                {
                    response.Errors.Add(new Error { Code = "400", Message = "بيانات الإتاحة غير مكتملة." });
                    return response;
                }

                if (!await CanUserManageSummerCategoryAsync(userId, query.CategoryId))
                {
                    response.Errors.Add(new Error
                    {
                        Code = "403",
                        Message = "غير مصرح لك بعرض إتاحة الوحدات لهذا المصيف."
                    });
                    return response;
                }

                var summerRules = await GetSummerRulesAsync();
                if (!summerRules.TryGetValue(query.CategoryId, out var rule))
                {
                    response.Errors.Add(new Error { Code = "400", Message = "المصيف غير مُعد في النظام." });
                    return response;
                }

                if (!rule.CapacityByFamily.TryGetValue(query.FamilyCount, out var totalUnits) || totalUnits <= 0)
                {
                    response.Errors.Add(new Error { Code = "400", Message = "السعة المطلوبة غير متاحة في إعدادات المصيف." });
                    return response;
                }

                var normalizedWaveCode = query.WaveCode.Trim();
                var usedUnits = await _summerUnitFreezeService.CountUsedUnitsAsync(
                    query.CategoryId,
                    normalizedWaveCode,
                    query.FamilyCount);
                var frozenAvailableUnits = await _summerUnitFreezeService.CountActiveFrozenAvailableUnitsAsync(
                    query.CategoryId,
                    normalizedWaveCode,
                    query.FamilyCount);
                var frozenAssignedUnits = await _summerUnitFreezeService.CountActiveFrozenAssignedUnitsAsync(
                    query.CategoryId,
                    normalizedWaveCode,
                    query.FamilyCount);

                var publicAvailableUnits = Math.Max(0, totalUnits - usedUnits - frozenAvailableUnits);
                var availableUnits = query.IncludeFrozenUnits
                    ? Math.Max(0, publicAvailableUnits + frozenAvailableUnits)
                    : publicAvailableUnits;

                response.Data = new SummerUnitsAvailableCountDto
                {
                    CategoryId = query.CategoryId,
                    WaveCode = normalizedWaveCode,
                    FamilyCount = query.FamilyCount,
                    TotalUnits = totalUnits,
                    UsedUnits = usedUnits,
                    FrozenAvailableUnits = frozenAvailableUnits,
                    FrozenAssignedUnits = frozenAssignedUnits,
                    PublicAvailableUnits = publicAvailableUnits,
                    AvailableUnits = availableUnits,
                    IncludeFrozenUnits = query.IncludeFrozenUnits
                };
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

                if (!ValidateAttachmentFileSizes(request.files, response))
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
                if (!ValidateAdminActionComment(actionCode, comment, response))
                {
                    return response;
                }
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

                        if (IsPendingReviewRequired(fields))
                        {
                            UpsertField(fields, message.MessageId, "Summer_WorkflowState", PendingReviewResolvedCode);
                            UpsertField(fields, message.MessageId, "Summer_WorkflowStateLabel", ResolveWorkflowStateLabel(PendingReviewResolvedCode));
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
                        await _summerUnitFreezeService.ReleaseAssignmentsForMessageAsync(message.MessageId, userId);
                        if (IsTransferReviewRequired(fields))
                        {
                            UpsertField(fields, message.MessageId, "Summer_WorkflowState", TransferReviewResolvedCode);
                            UpsertField(fields, message.MessageId, "Summer_WorkflowStateLabel", ResolveWorkflowStateLabel(TransferReviewResolvedCode));
                            UpsertField(fields, message.MessageId, "Summer_WorkflowStateAtUtc", DateTime.UtcNow.ToString("o"));
                        }

                        if (IsPendingReviewRequired(fields))
                        {
                            UpsertField(fields, message.MessageId, "Summer_WorkflowState", PendingReviewResolvedCode);
                            UpsertField(fields, message.MessageId, "Summer_WorkflowStateLabel", ResolveWorkflowStateLabel(PendingReviewResolvedCode));
                            UpsertField(fields, message.MessageId, "Summer_WorkflowStateAtUtc", DateTime.UtcNow.ToString("o"));
                        }

                        replyMessage = string.IsNullOrWhiteSpace(comment)
                            ? "تم إلغاء الطلب يدويًا من إدارة المصايف."
                            : $"تم إلغاء الطلب يدويًا من إدارة المصايف. السبب: {comment}";
                    }
                    else if (actionCode == SummerAdminActionCatalog.Codes.RejectRequest)
                    {
                        message.Status = workflowResolution.TargetState ?? MessageStatus.Rejected;
                        UpsertField(fields, message.MessageId, ActionTypeFieldKind, "ADMIN_REJECT");
                        UpsertField(fields, message.MessageId, "Summer_RejectionReason", string.IsNullOrWhiteSpace(comment) ? "تم رفض الطلب من إدارة المصايف." : comment);
                        UpsertField(fields, message.MessageId, "Summer_RejectedAtUtc", DateTime.UtcNow.ToString("o"));
                        UpsertField(fields, message.MessageId, PaymentStatusFieldKind, "REJECTED_ADMIN");
                        await _summerUnitFreezeService.ReleaseAssignmentsForMessageAsync(message.MessageId, userId);
                        if (IsTransferReviewRequired(fields))
                        {
                            UpsertField(fields, message.MessageId, "Summer_WorkflowState", TransferReviewResolvedCode);
                            UpsertField(fields, message.MessageId, "Summer_WorkflowStateLabel", ResolveWorkflowStateLabel(TransferReviewResolvedCode));
                            UpsertField(fields, message.MessageId, "Summer_WorkflowStateAtUtc", DateTime.UtcNow.ToString("o"));
                        }

                        if (IsPendingReviewRequired(fields))
                        {
                            UpsertField(fields, message.MessageId, "Summer_WorkflowState", PendingReviewResolvedCode);
                            UpsertField(fields, message.MessageId, "Summer_WorkflowStateLabel", ResolveWorkflowStateLabel(PendingReviewResolvedCode));
                            UpsertField(fields, message.MessageId, "Summer_WorkflowStateAtUtc", DateTime.UtcNow.ToString("o"));
                        }

                        replyMessage = string.IsNullOrWhiteSpace(comment)
                            ? "تم رفض الطلب من إدارة المصايف."
                            : $"تم رفض الطلب من إدارة المصايف. السبب: {comment}";
                    }
                    else if (actionCode == SummerAdminActionCatalog.Codes.Comment)
                    {
                        replyMessage = string.IsNullOrWhiteSpace(comment)
                            ? "تم تسجيل تعليق إداري على الطلب."
                            : comment;
                    }
                    else if (actionCode == SummerAdminActionCatalog.Codes.InternalAdminAction)
                    {
                        replyMessage = string.IsNullOrWhiteSpace(comment)
                            ? "تم تسجيل إجراء إداري داخلي على الطلب."
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
                if (response.Data != null
                    && !string.Equals(actionCode, SummerAdminActionCatalog.Codes.InternalAdminAction, StringComparison.OrdinalIgnoreCase))
                {
                    await NotifyEmployeeOnAdminActionAsync(response.Data, actionCode, comment, includeSignalR: false);
                }

                if ((actionCode == SummerAdminActionCatalog.Codes.ManualCancel
                        || actionCode == SummerAdminActionCatalog.Codes.RejectRequest)
                    && response.Data != null)
                {
                    await PublishCapacityUpdateAsync(
                        response.Data.CategoryId,
                        response.Data.WaveCode,
                        actionCode == SummerAdminActionCatalog.Codes.RejectRequest ? "ADMIN_REJECT" : "ADMIN_CANCEL");
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

        private async Task<bool> CanUserEditSummerMessageAsync(string userId, Message message)
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

            if (string.Equals((message.CreatedBy ?? string.Empty).Trim(), normalizedUserId, StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }

            if (await CanUserManageMessageAsync(normalizedUserId, message))
            {
                return true;
            }

            var ownerEmployeeId = await ResolveRequestOwnerEmployeeIdAsync(message.MessageId);
            return string.Equals(ownerEmployeeId, normalizedUserId, StringComparison.OrdinalIgnoreCase);
        }

        private static int NormalizeEditTokenLifetimeMinutes(int? requestedMinutes)
        {
            var fallback = SummerWorkflowDomainConstants.DefaultEditTokenLifetimeMinutes;
            var raw = requestedMinutes ?? fallback;
            if (raw < SummerWorkflowDomainConstants.MinEditTokenLifetimeMinutes)
            {
                return SummerWorkflowDomainConstants.MinEditTokenLifetimeMinutes;
            }

            if (raw > SummerWorkflowDomainConstants.MaxEditTokenLifetimeMinutes)
            {
                return SummerWorkflowDomainConstants.MaxEditTokenLifetimeMinutes;
            }

            return raw;
        }

        private static string GenerateSecureToken(int bytesLength = 32)
        {
            var bytes = RandomNumberGenerator.GetBytes(bytesLength);
            return Convert.ToBase64String(bytes)
                .TrimEnd('=')
                .Replace('+', '-')
                .Replace('/', '_');
        }

        private static string ComputeTokenHash(string token)
        {
            var normalized = (token ?? string.Empty).Trim();
            if (normalized.Length == 0)
            {
                return string.Empty;
            }

            var input = Encoding.UTF8.GetBytes(normalized);
            var hash = SHA256.HashData(input);
            return Convert.ToHexString(hash).ToLowerInvariant();
        }

        private async Task<bool> CanUserManageSummerCategoryAsync(string userId, int categoryId)
        {
            if (categoryId <= 0)
            {
                return false;
            }

            var manageableCategoryIds = await GetManageableSummerCategoryIdsAsync(userId);
            return manageableCategoryIds.Contains(categoryId);
        }

        private async Task<HashSet<int>> GetManageableSummerCategoryIdsAsync(string userId)
        {
            var normalizedUserId = (userId ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(normalizedUserId))
            {
                return new HashSet<int>();
            }

            var userUnitIds = await GetActiveUserUnitIdsAsync(normalizedUserId);
            if (userUnitIds.Count == 0)
            {
                return new HashSet<int>();
            }

            var summerRules = await GetSummerRulesAsync();
            var summerCategoryIds = summerRules.Keys.ToList();
            if (summerCategoryIds.Count == 0)
            {
                return new HashSet<int>();
            }

            var categories = await _connectContext.Cdcategories
                .AsNoTracking()
                .Where(category => summerCategoryIds.Contains(category.CatId))
                .Select(category => new
                {
                    category.CatId,
                    category.CatParent,
                    category.Stockholder
                })
                .ToListAsync();
            if (categories.Count == 0)
            {
                return new HashSet<int>();
            }

            var parentIds = categories
                .Select(category => category.CatParent)
                .Where(parentId => parentId > 0)
                .Distinct()
                .ToList();
            var parentStockholders = parentIds.Count == 0
                ? new Dictionary<int, int?>()
                : await _connectContext.Cdcategories
                    .AsNoTracking()
                    .Where(parent => parentIds.Contains(parent.CatId))
                    .Select(parent => new { parent.CatId, parent.Stockholder })
                    .ToDictionaryAsync(parent => parent.CatId, parent => parent.Stockholder);

            var manageableCategoryIds = new HashSet<int>();
            foreach (var category in categories)
            {
                var categoryStockholder = category.Stockholder?.ToString();
                var parentStockholder = parentStockholders.TryGetValue(category.CatParent, out var parentStockholderValue) && parentStockholderValue.HasValue
                    ? parentStockholderValue.Value.ToString()
                    : string.Empty;

                var allowed = (!string.IsNullOrWhiteSpace(categoryStockholder)
                               && userUnitIds.Contains(categoryStockholder, StringComparer.OrdinalIgnoreCase))
                              || (!string.IsNullOrWhiteSpace(parentStockholder)
                                  && userUnitIds.Contains(parentStockholder, StringComparer.OrdinalIgnoreCase));
                if (allowed)
                {
                    manageableCategoryIds.Add(category.CatId);
                }
            }

            return manageableCategoryIds;
        }

        public async Task<CommonResponse<IEnumerable<SummerWaveCapacityDto>>> GetWaveCapacityAsync(
            int categoryId,
            string waveCode,
            string userId,
            bool includeFrozenUnits = false,
            bool hasSummerAdminPermission = false)
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

                var includeFrozenStock = false;
                if (includeFrozenUnits)
                {
                    includeFrozenStock = hasSummerAdminPermission || await CanUserManageSummerCategoryAsync(userId, categoryId);
                    if (!includeFrozenStock)
                    {
                        response.Errors.Add(new Error
                        {
                            Code = "403",
                            Message = "غير مصرح لك بعرض الوحدات المجمدة في هذا المصيف."
                        });
                        _logger.LogWarning(
                            "Rejected include-frozen wave capacity request for unauthorized user. UserId={UserId}, CategoryId={CategoryId}, WaveCode={WaveCode}",
                            userId,
                            categoryId,
                            waveCode);
                        return response;
                    }
                }

                var normalizedWave = waveCode.Trim();
                var activeMessageIds = await GetActiveMessageIdsForWaveAsync(categoryId, normalizedWave);
                var familyFields = activeMessageIds.Count == 0
                    ? new List<TkmendField>()
                    : await _connectContext.TkmendFields
                        .AsNoTracking()
                        .Where(f => activeMessageIds.Contains(f.FildRelted)
                            && (f.FildKind == "FamilyCount" || f.FildKind == "SUM2026_FamilyCount"))
                        .ToListAsync();
                var frozenAvailableByFamily = await _summerUnitFreezeService.CountActiveFrozenAvailableByFamilyAsync(categoryId, normalizedWave);
                var capacityRows = new List<SummerWaveCapacityDto>();
                foreach (var item in rule.CapacityByFamily.OrderBy(item => item.Key))
                {
                    var familyCount = item.Key;
                    var totalUnits = item.Value;
                    var usedUnits = familyFields
                        .Where(f => ParseInt(f.FildTxt, 0) == familyCount)
                        .Select(f => f.FildRelted)
                        .Distinct()
                        .Count();
                    var frozenAvailableUnits = frozenAvailableByFamily.TryGetValue(familyCount, out var frozenCount)
                        ? frozenCount
                        : 0;
                    var frozenAssignedUnits = await _summerUnitFreezeService.CountActiveFrozenAssignedUnitsAsync(
                        categoryId,
                        normalizedWave,
                        familyCount);

                    var publicAvailableUnits = Math.Max(0, totalUnits - usedUnits - frozenAvailableUnits);
                    var exposedFrozenAvailableUnits = includeFrozenStock ? frozenAvailableUnits : 0;
                    var exposedFrozenAssignedUnits = includeFrozenStock ? frozenAssignedUnits : 0;
                    var exposedUsedUnits = includeFrozenStock
                        ? usedUnits
                        : Math.Max(0, totalUnits - publicAvailableUnits);

                    var computedAvailableUnits = includeFrozenStock
                        ? Math.Max(0, publicAvailableUnits + frozenAvailableUnits)
                        : publicAvailableUnits;

                    capacityRows.Add(new SummerWaveCapacityDto
                    {
                        CategoryId = categoryId,
                        WaveCode = normalizedWave,
                        FamilyCount = familyCount,
                        TotalUnits = totalUnits,
                        UsedUnits = exposedUsedUnits,
                        AvailableUnits = computedAvailableUnits,
                        FrozenAvailableUnits = exposedFrozenAvailableUnits,
                        FrozenAssignedUnits = exposedFrozenAssignedUnits
                    });
                }

                response.Data = capacityRows;
            }
            catch (Exception ex)
            {
                response.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });
            }

            return response;
        }

        public async Task<CommonResponse<SummerWaveBookingsPrintReportDto>> GetWaveBookingsPrintReportAsync(
            int categoryId,
            string waveCode,
            int seasonYear,
            string userId,
            bool includeFinancials = false)
        {
            var response = new CommonResponse<SummerWaveBookingsPrintReportDto>();
            try
            {
                if (categoryId <= 0 || string.IsNullOrWhiteSpace(waveCode))
                {
                    response.Errors.Add(new Error { Code = "400", Message = "المصيف والفوج مطلوبان." });
                    return response;
                }

                var normalizedUserId = (userId ?? string.Empty).Trim();
                if (normalizedUserId.Length == 0)
                {
                    response.Errors.Add(new Error { Code = "400", Message = "معرف المستخدم مطلوب." });
                    return response;
                }

                var normalizedWaveCode = waveCode.Trim();
                var normalizedSeasonYear = seasonYear > 0 ? seasonYear : DateTime.UtcNow.Year;
                var summerRules = await GetSummerRulesAsync(normalizedSeasonYear);
                if (!summerRules.TryGetValue(categoryId, out var categoryRule))
                {
                    response.Errors.Add(new Error { Code = "400", Message = "المصيف غير مُعد في النظام." });
                    return response;
                }

                var categoryName = await _connectContext.Cdcategories
                    .AsNoTracking()
                    .Where(category => category.CatId == categoryId)
                    .Select(category => category.CatName)
                    .FirstOrDefaultAsync();

                var (waveStartAtUtc, waveEndAtUtc) = ResolveWaveDateRangeUtc(
                    categoryRule,
                    categoryId,
                    normalizedSeasonYear,
                    normalizedWaveCode);

                var report = new SummerWaveBookingsPrintReportDto
                {
                    CategoryId = categoryId,
                    CategoryName = ResolveDisplayText(categoryName, $"مصيف {categoryId}"),
                    WaveCode = normalizedWaveCode,
                    WaveStartAtUtc = waveStartAtUtc,
                    WaveEndAtUtc = waveEndAtUtc,
                    GeneratedAtUtc = DateTime.UtcNow,
                    GeneratedByUserId = normalizedUserId,
                    IncludeFinancials = includeFinancials,
                    TotalBookings = 0
                };

                var activeMessageIds = await GetActiveMessageIdsForWaveAsync(categoryId, normalizedWaveCode);
                if (activeMessageIds.Count == 0)
                {
                    response.Data = report;
                    return response;
                }

                var messages = await _connectContext.Messages
                    .AsNoTracking()
                    .Where(message => activeMessageIds.Contains(message.MessageId))
                    .OrderBy(message => message.CreatedDate)
                    .ThenBy(message => message.MessageId)
                    .ToListAsync();
                if (messages.Count == 0)
                {
                    response.Data = report;
                    return response;
                }

                var messageIds = messages.Select(message => message.MessageId).ToList();
                var allFields = await _connectContext.TkmendFields
                    .AsNoTracking()
                    .Where(field => messageIds.Contains(field.FildRelted))
                    .ToListAsync();
                var fieldsByMessageId = allFields
                    .GroupBy(field => field.FildRelted)
                    .ToDictionary(group => group.Key, group => group.ToList());

                var rows = new List<(int? FamilyCount, SummerWaveBookingPrintRowDto Row)>();
                foreach (var message in messages)
                {
                    var messageFields = fieldsByMessageId.TryGetValue(message.MessageId, out var resolvedFields)
                        ? resolvedFields
                        : new List<TkmendField>();

                    var familyCountValue = ParseInt(GetFirstFieldValue(messageFields, FamilyCountFieldKinds), 0);
                    var familyCount = familyCountValue > 0 ? familyCountValue : (int?)null;
                    var extraCount = Math.Max(0, ParseInt(GetFirstFieldValue(messageFields, ExtraCountFieldKinds), 0));
                    var personsCount = ResolvePersonsCount(messageFields, familyCountValue, extraCount);

                    var workflowStateCode = GetFieldValue(messageFields, "Summer_WorkflowState") ?? string.Empty;
                    var workflowStateLabel = ResolveWorkflowStateLabel(workflowStateCode);
                    var needsTransferReview = string.Equals(
                        workflowStateCode,
                        TransferReviewRequiredCode,
                        StringComparison.OrdinalIgnoreCase);
                    var statusLabel = ResolveSummaryStatusLabel(message.Status, messageFields, IsWorkflowStateLabelPreferred(workflowStateCode), workflowStateLabel);

                    var bookingTypeLabel = ResolveBookingTypeLabel(
                        GetFirstFieldValue(messageFields, SummerWorkflowDomainConstants.StayModeFieldKinds),
                        GetFieldValue(messageFields, SummerWorkflowDomainConstants.PricingFieldKinds.SelectedStayMode) ?? string.Empty,
                        GetFieldValue(messageFields, SummerWorkflowDomainConstants.PricingFieldKinds.PricingMode) ?? string.Empty,
                        GetFirstFieldValue(messageFields, SummerWorkflowDomainConstants.ProxyModeFieldKinds));

                    var (bookingAmount, insuranceAmount, finalAmount) = includeFinancials
                        ? ResolveRowFinancialAmounts(messageFields)
                        : (0m, 0m, 0m);
                    var paymentCollection = ResolvePaymentCollectionSnapshot(messageFields, finalAmount);

                    var row = new SummerWaveBookingPrintRowDto
                    {
                        MessageId = message.MessageId,
                        RequestRef = ResolveDisplayText(message.RequestRef),
                        BookerName = ResolveDisplayText(
                            GetFirstFieldValue(messageFields, EmployeeNameFieldKinds),
                            $"طلب رقم {message.MessageId}"),
                        WorkEntity = ResolveDisplayText(GetFirstFieldValue(messageFields, WorkEntityFieldKinds)),
                        BookingTypeLabel = ResolveDisplayText(bookingTypeLabel),
                        UnitNumber = ResolveDisplayText(GetFirstFieldValue(messageFields, UnitNumberFieldKinds)),
                        PersonsCount = Math.Max(0, personsCount),
                        StatusLabel = ResolveDisplayText(statusLabel),
                        Notes = ResolveDisplayText(GetFirstFieldValue(messageFields, NotesFieldKinds)),
                        PaymentMode = paymentCollection.PaymentModeCode,
                        PaymentModeLabel = paymentCollection.PaymentModeLabel,
                        CollectionStatusLabel = paymentCollection.CollectionStatusLabel,
                        BookingAmount = bookingAmount,
                        InsuranceAmount = insuranceAmount,
                        FinalAmount = finalAmount,
                        CollectedAmount = paymentCollection.CollectedAmount,
                        UncollectedAmount = paymentCollection.UncollectedAmount,
                        IsFullyCollected = paymentCollection.IsFullyCollected
                    };

                    rows.Add((familyCount, row));
                }

                report.Sections = rows
                    .GroupBy(item => item.FamilyCount)
                    .OrderBy(group => group.Key ?? int.MaxValue)
                    .Select(group =>
                    {
                        var orderedRows = group
                            .Select(item => item.Row)
                            .OrderBy(item => item.BookerName, StringComparer.OrdinalIgnoreCase)
                            .ThenBy(item => item.RequestRef, StringComparer.OrdinalIgnoreCase)
                            .ThenBy(item => item.MessageId)
                            .ToList();

                        return new SummerWaveBookingsPrintSectionDto
                        {
                            FamilyCount = group.Key,
                            SectionLabel = ResolveSectionLabel(group.Key),
                            TotalBookings = orderedRows.Count,
                            TotalBookingAmount = includeFinancials ? orderedRows.Sum(item => item.BookingAmount) : 0m,
                            TotalInsuranceAmount = includeFinancials ? orderedRows.Sum(item => item.InsuranceAmount) : 0m,
                            TotalFinalAmount = includeFinancials ? orderedRows.Sum(item => item.FinalAmount) : 0m,
                            TotalCollectedAmount = includeFinancials ? orderedRows.Sum(item => item.CollectedAmount) : 0m,
                            TotalUncollectedAmount = includeFinancials ? orderedRows.Sum(item => item.UncollectedAmount) : 0m,
                            CashBookingsCount = orderedRows.Count(item => IsCashPaymentMode(item.PaymentMode)),
                            InstallmentBookingsCount = orderedRows.Count(item => IsInstallmentPaymentMode(item.PaymentMode)),
                            CashFinalAmount = includeFinancials
                                ? orderedRows.Where(item => IsCashPaymentMode(item.PaymentMode)).Sum(item => item.FinalAmount)
                                : 0m,
                            InstallmentFinalAmount = includeFinancials
                                ? orderedRows.Where(item => IsInstallmentPaymentMode(item.PaymentMode)).Sum(item => item.FinalAmount)
                                : 0m,
                            Rows = orderedRows
                        };
                    })
                    .ToList();

                report.TotalBookings = report.Sections.Sum(section => section.TotalBookings);
                report.TotalBookingAmount = includeFinancials ? report.Sections.Sum(section => section.TotalBookingAmount) : 0m;
                report.TotalInsuranceAmount = includeFinancials ? report.Sections.Sum(section => section.TotalInsuranceAmount) : 0m;
                report.TotalFinalAmount = includeFinancials ? report.Sections.Sum(section => section.TotalFinalAmount) : 0m;
                report.TotalCollectedAmount = includeFinancials ? report.Sections.Sum(section => section.TotalCollectedAmount) : 0m;
                report.TotalUncollectedAmount = includeFinancials ? report.Sections.Sum(section => section.TotalUncollectedAmount) : 0m;
                report.CashBookingsCount = report.Sections.Sum(section => section.CashBookingsCount);
                report.InstallmentBookingsCount = report.Sections.Sum(section => section.InstallmentBookingsCount);
                report.CashFinalAmount = includeFinancials ? report.Sections.Sum(section => section.CashFinalAmount) : 0m;
                report.InstallmentFinalAmount = includeFinancials ? report.Sections.Sum(section => section.InstallmentFinalAmount) : 0m;
                response.Data = report;
            }
            catch (Exception ex)
            {
                response.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });
            }

            return response;
        }

        private static (DateTime? WaveStartAtUtc, DateTime? WaveEndAtUtc) ResolveWaveDateRangeUtc(
            SummerRule? categoryRule,
            int categoryId,
            int seasonYear,
            string waveCode)
        {
            if (!TryResolveWaveStartUtc(categoryRule, categoryId, seasonYear, waveCode, null, out var waveStartAtUtc))
            {
                return (null, null);
            }

            DateTime? waveEndAtUtc = null;
            if (categoryRule?.WaveStartByCode?.Count > 0)
            {
                var nearestNextWaveStartUtc = categoryRule.WaveStartByCode
                    .Values
                    .Where(value => value > waveStartAtUtc)
                    .OrderBy(value => value)
                    .FirstOrDefault();

                if (nearestNextWaveStartUtc != default)
                {
                    waveEndAtUtc = nearestNextWaveStartUtc.AddDays(-1);
                }
            }

            waveEndAtUtc ??= waveStartAtUtc.AddDays(6);
            return (waveStartAtUtc, waveEndAtUtc);
        }

        private static int ResolvePersonsCount(IEnumerable<TkmendField> fields, int familyCount, int extraCount)
        {
            var pricingPersonsCount = ParseInt(GetFieldValue(fields, SummerWorkflowDomainConstants.PricingFieldKinds.PersonsCount), 0);
            if (pricingPersonsCount > 0)
            {
                return pricingPersonsCount;
            }

            if (familyCount > 0)
            {
                return familyCount + Math.Max(0, extraCount);
            }

            return 0;
        }

        private static (decimal BookingAmount, decimal InsuranceAmount, decimal FinalAmount) ResolveRowFinancialAmounts(
            IEnumerable<TkmendField> fields)
        {
            var accommodationTotal = ParseDecimal(GetFirstFieldValue(fields, PricingAccommodationTotalFieldKinds), 0m);
            var transportationTotal = ParseDecimal(GetFirstFieldValue(fields, PricingTransportationTotalFieldKinds), 0m);
            var explicitBookingAmount = Math.Max(0m, accommodationTotal + transportationTotal);

            var appliedInsuranceAmount = ParseDecimalNullable(GetFirstFieldValue(fields, PricingAppliedInsuranceAmountFieldKinds));
            var membershipTypeRaw = GetFirstFieldValue(fields, PricingMembershipTypeFieldKinds);
            if (string.IsNullOrWhiteSpace(membershipTypeRaw))
            {
                membershipTypeRaw = GetFirstFieldValue(fields, SummerWorkflowDomainConstants.MembershipTypeFieldKinds);
            }
            var normalizedMembershipType = SummerMembershipPolicy.NormalizeMembershipType(membershipTypeRaw);
            var baseInsuranceAmount = ParseDecimalNullable(GetFirstFieldValue(fields, PricingInsuranceAmountFieldKinds));
            var insuranceAmount = appliedInsuranceAmount
                ?? (IsMembershipTypeDefined(membershipTypeRaw)
                    ? SummerMembershipPolicy.ResolveInsuranceAmount(normalizedMembershipType)
                    : baseInsuranceAmount ?? SummerMembershipPolicy.WorkerInsuranceAmount);
            insuranceAmount = Math.Max(0m, insuranceAmount);

            var grandTotalAmount = ParseDecimalNullable(GetFirstFieldValue(fields, PricingGrandTotalFieldKinds));
            var bookingAmount = explicitBookingAmount;
            if (bookingAmount <= 0m && grandTotalAmount.HasValue)
            {
                bookingAmount = Math.Max(0m, grandTotalAmount.Value - insuranceAmount);
            }

            var finalAmount = bookingAmount + insuranceAmount;
            if (finalAmount <= 0m && grandTotalAmount.HasValue)
            {
                var normalizedGrandTotal = Math.Max(0m, grandTotalAmount.Value);
                bookingAmount = normalizedGrandTotal;
                finalAmount = normalizedGrandTotal;
            }

            return (
                NormalizeMoneyAmount(bookingAmount),
                NormalizeMoneyAmount(insuranceAmount),
                NormalizeMoneyAmount(finalAmount));
        }

        private readonly struct PaymentCollectionSnapshot
        {
            public PaymentCollectionSnapshot(
                string paymentModeCode,
                string paymentModeLabel,
                decimal collectedAmount,
                decimal uncollectedAmount,
                bool isFullyCollected,
                string collectionStatusLabel)
            {
                PaymentModeCode = paymentModeCode;
                PaymentModeLabel = paymentModeLabel;
                CollectedAmount = collectedAmount;
                UncollectedAmount = uncollectedAmount;
                IsFullyCollected = isFullyCollected;
                CollectionStatusLabel = collectionStatusLabel;
            }

            public string PaymentModeCode { get; }
            public string PaymentModeLabel { get; }
            public decimal CollectedAmount { get; }
            public decimal UncollectedAmount { get; }
            public bool IsFullyCollected { get; }
            public string CollectionStatusLabel { get; }
        }

        private readonly struct RequestPaymentStateSnapshot
        {
            public RequestPaymentStateSnapshot(
                string paymentStateCode,
                string paymentStateLabel,
                int paidInstallmentsCount,
                int totalInstallmentsCount,
                DateTime? paidAtUtc,
                bool isFullyPaid,
                bool isPartiallyPaid)
            {
                PaymentStateCode = paymentStateCode;
                PaymentStateLabel = paymentStateLabel;
                PaidInstallmentsCount = paidInstallmentsCount;
                TotalInstallmentsCount = totalInstallmentsCount;
                PaidAtUtc = paidAtUtc;
                IsFullyPaid = isFullyPaid;
                IsPartiallyPaid = isPartiallyPaid;
            }

            public string PaymentStateCode { get; }
            public string PaymentStateLabel { get; }
            public int PaidInstallmentsCount { get; }
            public int TotalInstallmentsCount { get; }
            public DateTime? PaidAtUtc { get; }
            public bool IsFullyPaid { get; }
            public bool IsPartiallyPaid { get; }
        }

        private enum PaymentStateFilterKind
        {
            Any = 0,
            Paid = 1,
            Unpaid = 2,
            PartialPaid = 3,
            OverdueUnpaid = 4
        }

        private static RequestPaymentStateSnapshot ResolveRequestPaymentStateSnapshot(IEnumerable<TkmendField> fields)
        {
            var paymentModeCode = ResolvePaymentModeCode(fields);
            var totalInstallmentsCount = ResolveTotalInstallmentsCount(fields, paymentModeCode);
            var paidInstallmentsCount = Math.Clamp(
                ResolvePaidInstallmentsCount(fields, totalInstallmentsCount),
                0,
                Math.Max(1, totalInstallmentsCount));
            var isFullyPaid = paidInstallmentsCount >= totalInstallmentsCount;
            var isPartiallyPaid = paidInstallmentsCount > 0 && !isFullyPaid;

            string paymentStateCode;
            string paymentStateLabel;
            if (isFullyPaid)
            {
                paymentStateCode = RequestPaymentStatePaidCode;
                paymentStateLabel = "مسدد";
            }
            else if (isPartiallyPaid)
            {
                paymentStateCode = RequestPaymentStatePartialPaidCode;
                paymentStateLabel = $"مسدد عدد {paidInstallmentsCount} من {totalInstallmentsCount}";
            }
            else
            {
                paymentStateCode = RequestPaymentStateUnpaidCode;
                paymentStateLabel = "غير مسدد";
            }

            var paidAtUtc = isFullyPaid
                ? ResolveLatestPaidInstallmentAtUtc(fields, totalInstallmentsCount) ?? ParseDate(GetFieldValue(fields, PaidAtUtcFieldKind))
                : (DateTime?)null;

            return new RequestPaymentStateSnapshot(
                paymentStateCode,
                paymentStateLabel,
                paidInstallmentsCount,
                totalInstallmentsCount,
                paidAtUtc,
                isFullyPaid,
                isPartiallyPaid);
        }

        private static PaymentCollectionSnapshot ResolvePaymentCollectionSnapshot(
            IEnumerable<TkmendField> fields,
            decimal finalAmount)
        {
            var normalizedFinalAmount = NormalizeMoneyAmount(finalAmount);
            var paymentModeCode = ResolvePaymentModeCode(fields);
            var paymentModeLabel = ResolvePaymentModeLabel(paymentModeCode);
            var paymentState = ResolveRequestPaymentStateSnapshot(fields);

            var isFullyCollected = paymentState.IsFullyPaid;
            var collectedAmount = paymentState.IsFullyPaid
                ? normalizedFinalAmount
                : IsInstallmentPaymentMode(paymentModeCode)
                    ? ResolveCollectedInstallmentsAmount(fields, paymentState.TotalInstallmentsCount)
                    : 0m;

            collectedAmount = NormalizeMoneyAmount(Math.Max(0m, collectedAmount));
            if (normalizedFinalAmount > 0m)
            {
                collectedAmount = Math.Min(normalizedFinalAmount, collectedAmount);
            }

            var uncollectedAmount = NormalizeMoneyAmount(Math.Max(0m, normalizedFinalAmount - collectedAmount));
            if (normalizedFinalAmount <= 0m)
            {
                collectedAmount = 0m;
                uncollectedAmount = 0m;
                isFullyCollected = true;
            }
            else if (paymentState.IsFullyPaid)
            {
                collectedAmount = normalizedFinalAmount;
                uncollectedAmount = 0m;
                isFullyCollected = true;
            }
            else if (uncollectedAmount <= 0m)
            {
                collectedAmount = normalizedFinalAmount;
                uncollectedAmount = 0m;
                isFullyCollected = true;
            }

            var collectionStatusLabel = isFullyCollected
                ? "مسدد"
                : paymentState.IsPartiallyPaid
                    ? paymentState.PaymentStateLabel
                    : "غير مسدد";

            return new PaymentCollectionSnapshot(
                paymentModeCode,
                paymentModeLabel,
                collectedAmount,
                uncollectedAmount,
                isFullyCollected,
                collectionStatusLabel);
        }

        private static int ResolveTotalInstallmentsCount(IEnumerable<TkmendField> fields, string paymentModeCode)
        {
            if (IsCashPaymentMode(paymentModeCode))
            {
                return 1;
            }

            var explicitInstallmentCount = ParseInt(GetFirstFieldValue(fields, InstallmentCountFieldKinds), 0);
            if (explicitInstallmentCount > 0)
            {
                return Math.Clamp(explicitInstallmentCount, 1, SummerWorkflowDomainConstants.PaymentModes.MaxInstallmentCount);
            }

            var inferredInstallmentCount = ResolveInferredInstallmentsCount(fields);
            if (inferredInstallmentCount > 0)
            {
                return inferredInstallmentCount;
            }

            return Math.Max(1, SummerWorkflowDomainConstants.PaymentModes.MinInstallmentCount);
        }

        private static int ResolveInferredInstallmentsCount(IEnumerable<TkmendField> fields)
        {
            var inferredInstallments = 0;
            for (var installmentNo = 1; installmentNo <= SummerWorkflowDomainConstants.PaymentModes.MaxInstallmentCount; installmentNo++)
            {
                var hasAmount = ParseDecimal(
                    GetFirstFieldValue(fields, SummerWorkflowDomainConstants.GetInstallmentAmountFieldKinds(installmentNo)),
                    0m) > 0m;
                var hasPaidFlag = ParseBooleanLike(GetFirstFieldValue(
                    fields,
                    SummerWorkflowDomainConstants.GetInstallmentPaidFieldKinds(installmentNo))).HasValue;
                var hasPaidAt = ResolveInstallmentPaidAtUtc(fields, installmentNo).HasValue;

                if (hasAmount || hasPaidFlag || hasPaidAt)
                {
                    inferredInstallments = installmentNo;
                }
            }

            return Math.Clamp(inferredInstallments, 0, SummerWorkflowDomainConstants.PaymentModes.MaxInstallmentCount);
        }

        private static int ResolvePaidInstallmentsCount(IEnumerable<TkmendField> fields, int totalInstallmentsCount)
        {
            var normalizedTotalInstallments = Math.Clamp(
                totalInstallmentsCount,
                1,
                SummerWorkflowDomainConstants.PaymentModes.MaxInstallmentCount);
            var paidInstallmentsCount = 0;
            for (var installmentNo = 1; installmentNo <= normalizedTotalInstallments; installmentNo++)
            {
                if (IsInstallmentMarkedPaid(fields, installmentNo))
                {
                    paidInstallmentsCount += 1;
                }
            }

            return paidInstallmentsCount;
        }

        private static DateTime? ResolveLatestPaidInstallmentAtUtc(IEnumerable<TkmendField> fields, int totalInstallmentsCount)
        {
            var normalizedTotalInstallments = Math.Clamp(
                totalInstallmentsCount,
                1,
                SummerWorkflowDomainConstants.PaymentModes.MaxInstallmentCount);
            DateTime? latestPaidAtUtc = null;
            for (var installmentNo = 1; installmentNo <= normalizedTotalInstallments; installmentNo++)
            {
                if (!IsInstallmentMarkedPaid(fields, installmentNo))
                {
                    continue;
                }

                var installmentPaidAtUtc = ResolveInstallmentPaidAtUtc(fields, installmentNo);
                if (!installmentPaidAtUtc.HasValue)
                {
                    continue;
                }

                if (!latestPaidAtUtc.HasValue || installmentPaidAtUtc.Value > latestPaidAtUtc.Value)
                {
                    latestPaidAtUtc = installmentPaidAtUtc.Value;
                }
            }

            return latestPaidAtUtc;
        }

        private static DateTime? ResolveInstallmentPaidAtUtc(IEnumerable<TkmendField> fields, int installmentNo)
        {
            return ParseDate(GetFirstFieldValue(
                fields,
                SummerWorkflowDomainConstants.GetInstallmentPaidAtFieldKinds(installmentNo)));
        }

        private static bool IsInstallmentMarkedPaid(IEnumerable<TkmendField> fields, int installmentNo)
        {
            var explicitPaidFlag = ParseBooleanLike(GetFirstFieldValue(
                fields,
                SummerWorkflowDomainConstants.GetInstallmentPaidFieldKinds(installmentNo)));
            if (explicitPaidFlag.HasValue)
            {
                return explicitPaidFlag.Value;
            }

            if (ResolveInstallmentPaidAtUtc(fields, installmentNo).HasValue)
            {
                return true;
            }

            if (installmentNo == 1)
            {
                if (ParseDate(GetFieldValue(fields, PaidAtUtcFieldKind)).HasValue)
                {
                    return true;
                }
            }

            return false;
        }

        private static decimal ResolveCollectedInstallmentsAmount(IEnumerable<TkmendField> fields, int totalInstallmentsCount)
        {
            var total = 0m;
            var normalizedTotalInstallments = Math.Clamp(
                totalInstallmentsCount,
                1,
                SummerWorkflowDomainConstants.PaymentModes.MaxInstallmentCount);
            for (var installmentNo = 1; installmentNo <= normalizedTotalInstallments; installmentNo++)
            {
                if (!IsInstallmentMarkedPaid(fields, installmentNo))
                {
                    continue;
                }

                var amount = ParseDecimal(
                    GetFirstFieldValue(fields, SummerWorkflowDomainConstants.GetInstallmentAmountFieldKinds(installmentNo)),
                    0m);
                total += Math.Max(0m, amount);
            }

            return NormalizeMoneyAmount(total);
        }

        private static string ResolvePaymentModeCode(IEnumerable<TkmendField> fields)
        {
            var paymentModeRaw = GetFirstFieldValue(fields, PaymentModeFieldKinds);
            var token = NormalizeSearchToken(paymentModeRaw);
            if (token.Contains("installment", StringComparison.Ordinal))
            {
                return SummerWorkflowDomainConstants.PaymentModes.Installment;
            }

            if (token.Contains("cash", StringComparison.Ordinal))
            {
                return SummerWorkflowDomainConstants.PaymentModes.Cash;
            }

            var installmentCount = ParseInt(GetFirstFieldValue(fields, InstallmentCountFieldKinds), 0);
            if (installmentCount > 1)
            {
                return SummerWorkflowDomainConstants.PaymentModes.Installment;
            }

            for (var installmentNo = 1; installmentNo <= SummerWorkflowDomainConstants.PaymentModes.MaxInstallmentCount; installmentNo++)
            {
                var amount = ParseDecimal(
                    GetFirstFieldValue(fields, SummerWorkflowDomainConstants.GetInstallmentAmountFieldKinds(installmentNo)),
                    0m);
                if (amount > 0m)
                {
                    return SummerWorkflowDomainConstants.PaymentModes.Installment;
                }
            }

            return SummerWorkflowDomainConstants.PaymentModes.Cash;
        }

        private static string ResolvePaymentModeLabel(string paymentModeCode)
        {
            return IsInstallmentPaymentMode(paymentModeCode) ? "تقسيط" : "كاش";
        }

        private static bool IsInstallmentPaymentMode(string? paymentModeCode)
        {
            return string.Equals(
                (paymentModeCode ?? string.Empty).Trim(),
                SummerWorkflowDomainConstants.PaymentModes.Installment,
                StringComparison.OrdinalIgnoreCase);
        }

        private static bool IsCashPaymentMode(string? paymentModeCode)
        {
            return !IsInstallmentPaymentMode(paymentModeCode);
        }

        private static decimal NormalizeMoneyAmount(decimal value)
        {
            return decimal.Round(Math.Max(0m, value), 2, MidpointRounding.AwayFromZero);
        }

        private static bool IsMembershipTypeDefined(string? membershipTypeRaw)
        {
            return !string.IsNullOrWhiteSpace((membershipTypeRaw ?? string.Empty).Trim());
        }

        private static string ResolveBookingTypeLabel(
            string stayMode,
            string pricingSelectedStayMode,
            string pricingMode,
            string proxyMode)
        {
            var candidateStayMode = !string.IsNullOrWhiteSpace(pricingSelectedStayMode)
                ? pricingSelectedStayMode
                : stayMode;
            var normalizedStayMode = NormalizeSearchToken(candidateStayMode);
            var normalizedPricingMode = NormalizeSearchToken(pricingMode);
            var isProxy = ParseBooleanLike(proxyMode);

            var label = normalizedStayMode switch
            {
                "residenceonly" or "residence_only" => "إقامة فقط",
                "residencewithtransport" or "residence_with_transport" => "إقامة وانتقالات",
                _ => normalizedPricingMode switch
                {
                    "accommodationonlyallowed" => "إقامة فقط",
                    "accommodationandtransportationoptional" => "إقامة وانتقالات (اختياري)",
                    "transportationmandatoryincluded" => "إقامة وانتقالات (إلزامي)",
                    _ => ResolveDisplayText(candidateStayMode, ResolveDisplayText(pricingMode))
                }
            };

            if (isProxy == true)
            {
                label = $"{label} - بالنيابة";
            }

            return label;
        }

        private static string ResolveRequestedPaymentStatusCode(string? rawStatus)
        {
            var normalized = NormalizeSearchToken(rawStatus);
            if (string.IsNullOrWhiteSpace(normalized))
            {
                return "PAID";
            }

            var normalizedWithoutSeparators = normalized
                .Replace("_", string.Empty)
                .Replace("-", string.Empty);

            var parsedBoolean = ParseBooleanLike(normalizedWithoutSeparators);
            if (parsedBoolean.HasValue)
            {
                return parsedBoolean.Value ? "PAID" : "PENDING_PAYMENT";
            }

            return normalizedWithoutSeparators switch
            {
                "paid" or "completed" or "confirmed" or "مسدد" or "تمالسداد" => "PAID",
                "unpaid" or "notpaid" or "pending" or "pendingpayment" or "غيرمسدد" or "غيرمدفوع" => "PENDING_PAYMENT",
                _ => "PAID"
            };
        }

        private static bool? ParseBooleanLike(string? value)
        {
            var token = NormalizeSearchToken(value);
            if (string.IsNullOrWhiteSpace(token))
            {
                return null;
            }

            return token switch
            {
                "true" or "1" or "yes" or "y" or "نعم" => true,
                "false" or "0" or "no" or "n" or "لا" => false,
                _ => null
            };
        }

        private static string ResolveSectionLabel(int? familyCount)
        {
            if (familyCount.HasValue && familyCount.Value > 0)
            {
                return $"الشقة ({familyCount.Value} أفراد)";
            }

            return "وحدات غير محددة السعة";
        }

        private static string ResolveDisplayText(string? value, string fallback = "-")
        {
            var normalized = (value ?? string.Empty).Trim();
            return normalized.Length > 0 ? normalized : fallback;
        }

        public async Task<CommonResponse<SummerPricingQuoteDto>> GetPricingQuoteAsync(
            SummerPricingQuoteRequest request,
            string? userId = null,
            bool hasSummerPricingPermission = false)
        {
            request ??= new SummerPricingQuoteRequest();
            return await _summerPricingService.GetQuoteAsync(
                request,
                allowMembershipOverride: hasSummerPricingPermission);
        }

        public async Task<CommonResponse<SummerPricingCatalogDto>> GetPricingCatalogAsync(
            int seasonYear,
            string userId,
            bool hasSummerPricingPermission = false)
        {
            var response = new CommonResponse<SummerPricingCatalogDto>();
            try
            {
                _ = userId;
                if (!hasSummerPricingPermission)
                {
                    response.Errors.Add(new Error
                    {
                        Code = "403",
                        Message = "غير مصرح لك بعرض إعدادات تسعير المصايف. يتطلب دور مدير النظام بالكامل (RoleId 2003)."
                    });
                    return response;
                }

                var catalogResponse = await _summerPricingService.GetCatalogAsync(seasonYear);
                if (!catalogResponse.IsSuccess)
                {
                    foreach (var error in catalogResponse.Errors)
                    {
                        response.Errors.Add(error);
                    }
                    return response;
                }

                response.Data = catalogResponse.Data;
            }
            catch (Exception ex)
            {
                response.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });
            }

            return response;
        }

        public async Task<CommonResponse<SummerPricingCatalogDto>> SavePricingCatalogAsync(
            SummerPricingCatalogUpsertRequest request,
            string userId,
            bool hasSummerPricingPermission = false)
        {
            var response = new CommonResponse<SummerPricingCatalogDto>();
            try
            {
                _ = userId;
                if (!hasSummerPricingPermission)
                {
                    response.Errors.Add(new Error
                    {
                        Code = "403",
                        Message = "غير مصرح لك بتعديل إعدادات تسعير المصايف. يتطلب دور مدير النظام بالكامل (RoleId 2003)."
                    });
                    return response;
                }

                var saveResponse = await _summerPricingService.SaveCatalogAsync(request);
                if (!saveResponse.IsSuccess)
                {
                    foreach (var error in saveResponse.Errors)
                    {
                        response.Errors.Add(error);
                    }
                    return response;
                }

                response.Data = saveResponse.Data;
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

                if (!ValidateAttachmentFileSizes(request.files, response))
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

                if (!await CanUserEditSummerMessageAsync(userId, message))
                {
                    response.Errors.Add(new Error { Code = "403", Message = "غير مصرح لك بالتعديل على هذا الطلب." });
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
                    await _summerUnitFreezeService.ReleaseAssignmentsForMessageAsync(message.MessageId, userId);

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

        public async Task<CommonResponse<SummerRequestSummaryDto>> PayAsync(
            SummerPayRequest request,
            string userId,
            string ip,
            bool hasSummerAdminPermission = false)
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

                if (!ValidateAttachmentFileSizes(request.files, response))
                {
                    return response;
                }

                if (!ValidateAllowedAttachmentExtensions(request.files, response))
                {
                    return response;
                }

                var requestedPaymentStatusCode = ResolveRequestedPaymentStatusCode(request.PaymentStatus);
                var isPaidStatus = string.Equals(
                    requestedPaymentStatusCode,
                    "PAID",
                    StringComparison.OrdinalIgnoreCase);

                if (!hasSummerAdminPermission
                    && !isPaidStatus
                    && !string.IsNullOrWhiteSpace(request.PaymentStatus))
                {
                    response.Errors.Add(new Error
                    {
                        Code = "403",
                        Message = "تعديل حالة السداد متاح فقط لإدارة المصايف."
                    });
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

                if (!await CanUserEditSummerMessageAsync(userId, message))
                {
                    response.Errors.Add(new Error { Code = "403", Message = "غير مصرح لك بالتعديل على هذا الطلب." });
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
                    "Summer payment validation start. MessageId={MessageId}, PaidAtInputRaw={PaidAtInputRaw}, PaidAtRawUtc={PaidAtRawUtc:o}, PaidAtUtc={PaidAtUtc:o}, CreatedAtAnchorRaw={CreatedAtAnchorRaw}, CreatedAtAnchorFound={CreatedAtAnchorFound}, ResolvedCreatedAtRawUtc={ResolvedCreatedAtRawUtc:o}, ResolvedCreatedAtUtc={ResolvedCreatedAtUtc:o}, DueAtRawUtc={DueAtRawUtc:o}, DueAtUtc={DueAtUtc:o}, PaidAtOffset={PaidAtOffset}, PaidAtProvided={PaidAtProvided}, RequestedPaymentStatus={RequestedPaymentStatus}, EffectivePaidStatus={EffectivePaidStatus}, HasSummerAdminPermission={HasSummerAdminPermission}",
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
                    request.PaidAtUtc.HasValue,
                    request.PaymentStatus,
                    isPaidStatus ? "PAID" : "PENDING_PAYMENT",
                    hasSummerAdminPermission);

                if (isPaidStatus && paidAtUtc > nowUtc)
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

                if (isPaidStatus && paidAtUtc > dueAtUtc)
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
                    var effectivePaymentStatus = isPaidStatus ? "PAID" : "PENDING_PAYMENT";
                    var effectivePaidAtValue = isPaidStatus ? paidAtUtc.ToString("o") : string.Empty;

                    UpsertField(fields, message.MessageId, ActionTypeFieldKind, "PAY");
                    UpsertField(fields, message.MessageId, PaymentStatusFieldKind, effectivePaymentStatus);
                    UpsertField(fields, message.MessageId, RequestCreatedAtUtcFieldKind, requestCreatedAtUtc.ToString("o"));
                    UpsertField(fields, message.MessageId, PaidAtUtcFieldKind, effectivePaidAtValue);
                    UpsertField(fields, message.MessageId, PaymentDueAtUtcFieldKind, dueAtUtc.ToString("o"));
                    if (isPaidStatus)
                    {
                        message.Status = MessageStatus.InProgress;
                        UpsertField(fields, message.MessageId, "Summer_WorkflowState", PendingReviewRequiredCode);
                        UpsertField(fields, message.MessageId, "Summer_WorkflowStateLabel", ResolveWorkflowStateLabel(PendingReviewRequiredCode));
                        UpsertField(fields, message.MessageId, "Summer_WorkflowStateReason", "تم استلام السداد والطلب قيد المراجعة.");
                        UpsertField(fields, message.MessageId, "Summer_WorkflowStateAtUtc", DateTime.UtcNow.ToString("o"));
                        UpsertField(fields, message.MessageId, "Summer_TransferRequiresRePayment", "false");
                    }
                    else if (IsPendingReviewRequired(fields))
                    {
                        UpsertField(fields, message.MessageId, "Summer_WorkflowState", PendingReviewResolvedCode);
                        UpsertField(fields, message.MessageId, "Summer_WorkflowStateLabel", ResolveWorkflowStateLabel(PendingReviewResolvedCode));
                        UpsertField(fields, message.MessageId, "Summer_WorkflowStateAtUtc", DateTime.UtcNow.ToString("o"));
                    }
                    UpsertFieldRange(
                        fields,
                        message.MessageId,
                        SummerWorkflowDomainConstants.GetInstallmentPaidFieldKinds(1),
                        isPaidStatus ? "true" : "false");
                    UpsertFieldRange(
                        fields,
                        message.MessageId,
                        SummerWorkflowDomainConstants.GetInstallmentPaidAtFieldKinds(1),
                        effectivePaidAtValue);
                    if (!string.IsNullOrWhiteSpace(request.Notes))
                    {
                        UpsertField(fields, message.MessageId, "Summer_PaymentNotes", request.Notes.Trim());
                    }

                    var paymentReplyMessage = isPaidStatus
                        ? "تم تسجيل السداد بنجاح."
                        : "تم تحديث حالة السداد إلى غير مسدد.";
                    await AddReplyWithAttachmentsAsync(
                        message.MessageId,
                        string.IsNullOrWhiteSpace(request.Notes)
                            ? paymentReplyMessage
                            : $"{paymentReplyMessage} الملاحظات: {request.Notes.Trim()}",
                        userId,
                        ip,
                        request.files);

                    await _attachHeldContext.SaveChangesAsync();
                    await _connectContext.SaveChangesAsync();
                    await attachTx.CommitAsync();
                    await connectTx.CommitAsync();
                    _logger.LogInformation(
                        "Summer payment accepted. MessageId={MessageId}, PaidAtUtc={PaidAtUtc:o}, CreatedAtUtc={CreatedAtUtc:o}, DueAtUtc={DueAtUtc:o}, PaymentStatus={PaymentStatus}",
                        message.MessageId,
                        paidAtUtc,
                        requestCreatedAtUtc,
                        dueAtUtc,
                        effectivePaymentStatus);
                }
                catch
                {
                    await attachTx.RollbackAsync();
                    await connectTx.RollbackAsync();
                    throw;
                }

                response.Data = await BuildSummaryAsync(message.MessageId);
                if (isPaidStatus && response.Data != null)
                {
                    await NotifyEmployeeOnPaymentUnderReviewAsync(response.Data, includeSignalR: false);
                }
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
            DateTime? adminActionAtUtc = null,
            bool hasSummerAdminPermission = false)
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

                if (!ValidateAttachmentFileSizes(request.files, response))
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

                if (!await CanUserEditSummerMessageAsync(userId, message))
                {
                    response.Errors.Add(new Error { Code = "403", Message = "غير مصرح لك بالتعديل على هذا الطلب." });
                    return response;
                }

                var canTransferAcrossDestinations = hasSummerAdminPermission;
                if (!canTransferAcrossDestinations && message.CategoryCd != request.ToCategoryId)
                {
                    response.Errors.Add(new Error
                    {
                        Code = "403",
                        Message = "التحويل للمستخدم متاح بين الأفواج داخل نفس المصيف فقط."
                    });
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
                var paymentState = ResolveRequestPaymentStateSnapshot(fields);
                var adminLastAction = (GetFieldValue(fields, "Summer_AdminLastAction") ?? string.Empty).Trim();
                var wasPaid = paymentState.IsFullyPaid || paymentState.IsPartiallyPaid;
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

                if (_summerBookingBlacklistService.IsBlocked(employeeId))
                {
                    response.Errors.Add(new Error
                    {
                        Code = "SUMMER_BLACKLIST_BLOCKED",
                        Message = "تعذر إتمام الحجز: رقم الملف مدرج ضمن قائمة الممنوعين من الحجز."
                    });
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

                    await _summerUnitFreezeService.ReleaseAssignmentsForMessageAsync(message.MessageId, userId);

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
                .Select(m => new
                {
                    m.MessageId,
                    m.CategoryCd,
                    m.CreatedDate
                })
                .ToListAsync(cancellationToken);

            if (!candidateMessages.Any())
            {
                return 0;
            }

            var candidateIds = candidateMessages
                .Select(item => item.MessageId)
                .ToList();
            var precheckFields = await _connectContext.TkmendFields
                .AsNoTracking()
                .Where(field =>
                    candidateIds.Contains(field.FildRelted)
                    && (field.FildKind == PaidAtUtcFieldKind
                        || field.FildKind == PaymentDueAtUtcFieldKind
                        || field.FildKind == RequestCreatedAtUtcFieldKind))
                .ToListAsync(cancellationToken);
            var precheckFieldsByMessageId = precheckFields
                .GroupBy(field => field.FildRelted)
                .ToDictionary(group => group.Key, group => group.ToList());

            var actionableMessageIds = new List<int>();
            foreach (var candidate in candidateMessages)
            {
                cancellationToken.ThrowIfCancellationRequested();

                IReadOnlyCollection<TkmendField> fields = precheckFieldsByMessageId.TryGetValue(candidate.MessageId, out var groupedFields)
                    ? groupedFields
                    : Array.Empty<TkmendField>();
                if (ParseDate(GetFieldValue(fields, PaidAtUtcFieldKind)).HasValue)
                {
                    continue;
                }

                var dueAtProbe = new Message
                {
                    MessageId = candidate.MessageId,
                    CategoryCd = candidate.CategoryCd,
                    CreatedDate = candidate.CreatedDate
                };
                var dueAt = ResolvePaymentDueAtUtc(dueAtProbe, fields);
                if (nowUtc > dueAt)
                {
                    actionableMessageIds.Add(candidate.MessageId);
                }
            }

            if (!actionableMessageIds.Any())
            {
                return 0;
            }

            foreach (var messageId in actionableMessageIds)
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
                        .FirstOrDefaultAsync(m => m.MessageId == messageId, cancellationToken);

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
                    await _summerUnitFreezeService.ReleaseAssignmentsForMessageAsync(message.MessageId, "SYSTEM", cancellationToken);

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

            if (string.Equals(actionCode, SummerAdminActionCatalog.Codes.InternalAdminAction, StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogInformation(
                    "Summer admin-action SMS skipped for internal admin action. MessageId={MessageId}, EmployeeId={EmployeeId}",
                    summary.MessageId,
                    summary.EmployeeId);
                return;
            }

            var templates = _applicationConfig.NotificationChannels?.Summer ?? new SummerNotificationTemplates();
            var normalizedComment = string.IsNullOrWhiteSpace(comment) ? string.Empty : comment.Trim();
            var adminCommentLine = string.IsNullOrWhiteSpace(normalizedComment)
                ? string.Empty
                : $"تعليق الإدارة: {normalizedComment}";
            var placeholders = BuildNotificationPlaceholders(
                summary,
                ResolveAdminActionLabel(actionCode),
                adminCommentLine,
                null);

            var smsTemplate = string.IsNullOrWhiteSpace(templates.AdminActionSmsTemplate)
                ? "عزيزي {FirstName}، تم تحديث طلب المصيف {RequestRef}. نوع الإجراء: {ActionLabel}. {AdminCommentLine}"
                : templates.AdminActionSmsTemplate;

            var signalRTemplate = string.IsNullOrWhiteSpace(templates.AdminActionSignalRTemplate)
                ? "تم تحديث طلب المصيف {RequestRef} من إدارة المصايف. نوع الإجراء: {ActionLabel}."
                : templates.AdminActionSignalRTemplate;

            var renderedSmsMessage = _notificationService.RenderTemplate(smsTemplate, placeholders);
            var requestDetailsLine = $"بيانات الطلب: المصيف {FormatSmsValue(summary.CategoryName)} - رقم الطلب {FormatSmsValue(summary.RequestRef)} - موعد الفوج {FormatSmsValue(summary.WaveCode)}.";
            var smsMessage = string.Join(
                " ",
                new[]
                {
                    renderedSmsMessage?.Trim(),
                    requestDetailsLine,
                    adminCommentLine
                }.Where(item => !string.IsNullOrWhiteSpace(item)));
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

        private async Task NotifyEmployeeOnPaymentUnderReviewAsync(
            SummerRequestSummaryDto summary,
            bool includeSignalR = false)
        {
            if (summary == null)
            {
                return;
            }

            var templates = _applicationConfig.NotificationChannels?.Summer ?? new SummerNotificationTemplates();
            var placeholders = BuildNotificationPlaceholders(summary, "قيد المراجعة", string.Empty, summary.PaymentDueAtUtc);

            var smsTemplate = string.IsNullOrWhiteSpace(templates.PaymentUnderReviewSmsTemplate)
                ? "السيد/ة {FirstName}، تم استلام سداد طلب المصيف رقم {RequestRef} بنجاح، وحالة الطلب الآن قيد المراجعة. سيتم إفادتكم بعد مراجعة الطلب (لتأكيد حجز الوحدة المصيفية)."
                : templates.PaymentUnderReviewSmsTemplate;
            var smsMessage = _notificationService.RenderTemplate(smsTemplate, placeholders);

            await DispatchSummerNotificationsAsync(
                summary,
                smsMessage,
                signalRMessage: string.Empty,
                signalRTitle: string.Empty,
                includeSignalR: includeSignalR);
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

        private static string FormatSmsValue(string? value)
        {
            var normalized = (value ?? string.Empty).Trim();
            return string.IsNullOrWhiteSpace(normalized) ? "-" : normalized;
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
            int? excludedMessageId = null,
            bool allowFrozenReservation = false)
        {
            if (rule == null)
            {
                return true;
            }

            if (!rule.CapacityByFamily.TryGetValue(familyCount, out var totalUnits))
            {
                return false;
            }

            var hasPublicCapacity = await _summerUnitFreezeService.HasPublicCapacityAsync(
                categoryId,
                waveCode.Trim(),
                familyCount,
                totalUnits,
                excludedMessageId);
            if (hasPublicCapacity)
            {
                return true;
            }

            if (allowFrozenReservation)
            {
                return await _summerUnitFreezeService.HasAssignableFrozenUnitAsync(categoryId, waveCode.Trim(), familyCount);
            }

            return false;
        }

        private async Task<bool> AcquireCapacityLockAsync(int categoryId, string waveCode)
        {
            if (!_connectContext.Database.IsSqlServer())
            {
                return true;
            }

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

            if (!_connectContext.Database.IsSqlServer())
            {
                return true;
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

        private async Task PublishCapacityUpdateAsync(
            int categoryId,
            string waveCode,
            string action,
            string? requestTraceId = null,
            CancellationToken cancellationToken = default)
        {
            if (categoryId <= 0 || string.IsNullOrWhiteSpace(waveCode))
            {
                return;
            }

            var traceId = string.IsNullOrWhiteSpace(requestTraceId) ? Guid.NewGuid().ToString("N") : requestTraceId.Trim();
            try
            {
                var normalizedWaveCode = waveCode.Trim();
                var normalizedAction = string.IsNullOrWhiteSpace(action)
                    ? "UPDATE"
                    : action.Trim().ToUpperInvariant();
                var dispatchTimeoutMs = ResolveCapacityUpdateDispatchTimeoutMs();
                var emittedAtUtc = DateTime.UtcNow;
                var destinationName = await ResolveSummerDestinationNameAsync(categoryId, cancellationToken);
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

                _logger.LogInformation(
                    "Before capacity update SignalR dispatch. TraceId={TraceId}, CategoryId={CategoryId}, WaveCode={WaveCode}, Action={Action}, TimeoutMs={TimeoutMs}",
                    traceId,
                    categoryId,
                    normalizedWaveCode,
                    normalizedAction,
                    dispatchTimeoutMs);

                var dispatchTask = _notificationService.SendSignalRToGroupsAsync(new SignalRGroupsDispatchRequest
                {
                    GroupNames = SummerNotificationGroups,
                    Notification = notification.Notification,
                    Type = notification.type,
                    Title = notification.Title,
                    Time = notification.time,
                    Sender = notification.sender,
                    Category = notification.Category ?? NotificationCategory.Business
                }, cancellationToken);

                var timeoutTask = Task.Delay(dispatchTimeoutMs, cancellationToken);
                var completedTask = await Task.WhenAny(dispatchTask, timeoutTask);
                if (completedTask != dispatchTask)
                {
                    if (cancellationToken.IsCancellationRequested)
                    {
                        throw new OperationCanceledException(cancellationToken);
                    }

                    _logger.LogWarning(
                        "Capacity update publish timed out and will not block response. TraceId={TraceId}, CategoryId={CategoryId}, WaveCode={WaveCode}, Action={Action}, TimeoutMs={TimeoutMs}",
                        traceId,
                        categoryId,
                        normalizedWaveCode,
                        normalizedAction,
                        dispatchTimeoutMs);
                    return;
                }

                var dispatchResponse = await dispatchTask;

                if (!dispatchResponse.IsSuccess)
                {
                    var errors = string.Join(" | ", dispatchResponse.Errors.Select(error => $"{error.Code}:{error.Message}"));
                    _logger.LogWarning(
                        "Summer capacity update publish encountered errors. TraceId={TraceId}, CategoryId={CategoryId}, WaveCode={WaveCode}, Action={Action}, Errors={Errors}",
                        traceId,
                        categoryId,
                        waveCode,
                        action,
                        errors);
                    return;
                }

                _logger.LogInformation(
                    "Summer capacity update published. TraceId={TraceId}, CategoryId={CategoryId}, WaveCode={WaveCode}, Action={Action}, Groups={Groups}",
                    traceId,
                    categoryId,
                    waveCode,
                    action,
                    string.Join(",", SummerNotificationGroups));
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                _logger.LogWarning(
                    "Capacity update publish cancelled by token. TraceId={TraceId}, CategoryId={CategoryId}, WaveCode={WaveCode}, Action={Action}",
                    traceId,
                    categoryId,
                    waveCode,
                    action);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(
                    ex,
                    "Capacity update publish failed but will not block API response. TraceId={TraceId}, CategoryId={CategoryId}, WaveCode={WaveCode}, Action={Action}",
                    traceId,
                    categoryId,
                    waveCode,
                    action);
            }
        }

        private int ResolveCapacityUpdateDispatchTimeoutMs()
        {
            var configured = _applicationConfig?.ApiOptions?.SummerCapacitySignalRTimeoutMs ?? 0;
            if (configured <= 0)
            {
                return CapacityUpdateDispatchTimeoutMs;
            }

            return Math.Clamp(configured, 1000, 30000);
        }

        private async Task<string> ResolveSummerDestinationNameAsync(int categoryId, CancellationToken cancellationToken = default)
        {
            var destinationName = await _connectContext.Cdcategories
                .AsNoTracking()
                .Where(category => category.CatId == categoryId)
                .Select(category => category.CatName)
                .FirstOrDefaultAsync(cancellationToken);

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
            var reply = CreateReplyEntity(messageId, normalizedMessage, userId, userId, ip);
            await _connectContext.Replies.AddAsync(reply);

            if (files != null && files.Any())
            {
                var attachments = new List<AttchShipment>();
                await SaveReplyAttachmentsAsync(files, reply.ReplyId, attachments);
                if (attachments.Any())
                {
                    await _attachHeldContext.AttchShipments.AddRangeAsync(attachments);
                }
            }
        }

        protected virtual bool ValidateAttachmentFileSizes<T>(List<IFormFile>? files, CommonResponse<T> response)
        {
            if (_helperService == null)
            {
                throw new InvalidOperationException("Helper service is not configured.");
            }

            return _helperService.ValidateFileSizes(files, response);
        }

        private static bool ValidateAdminActionComment<T>(string actionCode, string? comment, CommonResponse<T> response)
        {
            var normalizedComment = (comment ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(normalizedComment))
            {
                return true;
            }

            var isInternalAdminAction = string.Equals(
                actionCode,
                SummerAdminActionCatalog.Codes.InternalAdminAction,
                StringComparison.OrdinalIgnoreCase);
            var maxLength = isInternalAdminAction
                ? InternalAdminActionCommentMaxLength
                : AdminActionCommentMaxLength;

            if (normalizedComment.Length > maxLength)
            {
                response.Errors.Add(new Error
                {
                    Code = "400",
                    Message = isInternalAdminAction
                        ? $"تعليق الإدارة في الإجراء الإداري الداخلي لا يجب أن يزيد عن {InternalAdminActionCommentMaxLength} حرف."
                        : $"تعليق الإدارة لا يجب أن يزيد عن {AdminActionCommentMaxLength} حرف."
                });
                return false;
            }

            if (!isInternalAdminAction && !AdminActionCommentLettersRegex.IsMatch(normalizedComment))
            {
                response.Errors.Add(new Error
                {
                    Code = "400",
                    Message = "تعليق الإدارة يقبل الأحرف فقط لجميع الإجراءات باستثناء الإجراء الإداري الداخلي."
                });
                return false;
            }

            return true;
        }

        protected virtual Reply CreateReplyEntity(int messageId, string msg, string userId, string parentSectorId, string ip)
        {
            if (_helperService == null)
            {
                throw new InvalidOperationException("Helper service is not configured.");
            }

            return _helperService.CreateReply(messageId, msg, userId, parentSectorId, ip);
        }

        protected virtual Task SaveReplyAttachmentsAsync(List<IFormFile> files, int replyId, List<AttchShipment> attachments)
        {
            if (_helperService == null)
            {
                throw new InvalidOperationException("Helper service is not configured.");
            }

            return _helperService.SaveAttachments(files, replyId, attachments);
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
            var paymentState = ResolveRequestPaymentStateSnapshot(fields);

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
                StatusLabel = ResolveSummaryStatusLabel(message.Status, fields, IsWorkflowStateLabelPreferred(workflowStateCode), workflowStateLabel),
                WorkflowStateCode = workflowStateCode,
                WorkflowStateLabel = workflowStateLabel,
                NeedsTransferReview = needsTransferReview,
                CreatedAt = ResolveRequestCreatedAtUtc(message, fields),
                PaymentDueAtUtc = ParseDate(GetFieldValue(fields, PaymentDueAtUtcFieldKind)),
                PaidAtUtc = paymentState.PaidAtUtc,
                PaymentStateCode = paymentState.PaymentStateCode,
                PaymentStateLabel = paymentState.PaymentStateLabel,
                PaidInstallmentsCount = paymentState.PaidInstallmentsCount,
                TotalInstallmentsCount = paymentState.TotalInstallmentsCount,
                TransferUsed = ParseInt(GetFieldValue(fields, "Summer_TransferCount"), 0) > 0
            };
        }

        private static SummerUnitFreezeDto MapFreezeBatchToDto(SummerUnitFreezeBatch batch, int frozenAvailableUnits, int frozenAssignedUnits)
        {
            return new SummerUnitFreezeDto
            {
                FreezeId = batch.FreezeId,
                CategoryId = batch.CategoryId,
                WaveCode = batch.WaveCode,
                FamilyCount = batch.FamilyCount,
                RequestedUnitsCount = batch.RequestedUnitsCount,
                FrozenAvailableUnits = frozenAvailableUnits,
                FrozenAssignedUnits = frozenAssignedUnits,
                FreezeType = batch.FreezeType,
                Reason = batch.Reason,
                Notes = batch.Notes,
                CreatedBy = batch.CreatedBy,
                CreatedAtUtc = batch.CreatedAtUtc,
                IsActive = batch.IsActive,
                ReleasedAtUtc = batch.ReleasedAtUtc,
                ReleasedBy = batch.ReleasedBy
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
            var matches = fields
                .Where(f => string.Equals(f.FildKind, kind, StringComparison.OrdinalIgnoreCase))
                .ToList();
            if (matches.Count == 0)
            {
                return null;
            }

            // Prefer persisted latest row when duplicates exist; fallback to last in-memory match.
            var persistedLatest = matches
                .Where(item => item.FildSql > 0)
                .OrderByDescending(item => item.FildSql)
                .FirstOrDefault();
            return (persistedLatest ?? matches[matches.Count - 1]).FildTxt?.Trim();
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

        private static bool IsPendingReviewRequired(IEnumerable<TkmendField> fields)
        {
            var workflowState = GetFieldValue(fields, "Summer_WorkflowState") ?? string.Empty;
            return string.Equals(workflowState, PendingReviewRequiredCode, StringComparison.OrdinalIgnoreCase);
        }

        private static bool IsWorkflowStateLabelPreferred(string? workflowStateCode)
        {
            var normalized = (workflowStateCode ?? string.Empty).Trim().ToUpperInvariant();
            return normalized == TransferReviewRequiredCode
                || normalized == PendingReviewRequiredCode;
        }

        private static string ResolveWorkflowStateLabel(string? workflowStateCode)
        {
            var normalized = (workflowStateCode ?? string.Empty).Trim().ToUpperInvariant();
            return normalized switch
            {
                TransferReviewRequiredCode => "يتطلب مراجعة بعد التحويل",
                TransferReviewResolvedCode => "تمت مراجعة التحويل",
                PendingReviewRequiredCode => "قيد المراجعة",
                PendingReviewResolvedCode => "تمت مراجعة الطلب",
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
            bool preferWorkflowStateLabel,
            string workflowStateLabel)
        {
            if (preferWorkflowStateLabel && !string.IsNullOrWhiteSpace(workflowStateLabel))
            {
                return workflowStateLabel;
            }

            var adminAction = NormalizeActionCode(GetFieldValue(fields, "Summer_AdminLastAction"));
            return adminAction switch
            {
                SummerAdminActionCatalog.Codes.FinalApprove => "اعتماد نهائي",
                SummerAdminActionCatalog.Codes.Comment => "رد إداري",
                SummerAdminActionCatalog.Codes.InternalAdminAction => "إجراء إداري داخلي",
                SummerAdminActionCatalog.Codes.ManualCancel => "إلغاء يدوي",
                SummerAdminActionCatalog.Codes.RejectRequest => "رفض الطلب",
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
                "internaladminaction" or "internal_admin_action" or "اجراءاداريداخلي" => SummerAdminActionCatalog.Codes.InternalAdminAction,
                "approvetransfer" or "approve_transfer" or "اعتمادتحويل" => SummerAdminActionCatalog.Codes.ApproveTransfer,
                "manualcancel" or "manual_cancel" or "الغاءيدوي" or "إلغاءيدوي" => SummerAdminActionCatalog.Codes.ManualCancel,
                "rejectrequest" or "reject_request" or "reject" or "rejection" or "رفض" => SummerAdminActionCatalog.Codes.RejectRequest,
                "rejected" or "مرفوض" or "ملغي" or "مرفوض/ملغي" => "REJECTED",
                "يتطلبمراجعةبعدالتحويل" or "transferreviewrequired" or "transfer_review_required" => TransferReviewRequiredCode,
                "تمتمراجعةالتحويل" or "transferreviewresolved" or "transfer_review_resolved" => TransferReviewResolvedCode,
                "قيدالمراجعة" or "pendingreviewrequired" or "pending_review_required" => PendingReviewRequiredCode,
                "تمتمراجعةالطلب" or "pendingreviewresolved" or "pending_review_resolved" => PendingReviewResolvedCode,
                _ => token.ToUpperInvariant()
            };
        }

        private static PaymentStateFilterKind ResolveRequestedPaymentStateFilter(string? rawPaymentState)
        {
            var token = NormalizeSearchToken(rawPaymentState);
            if (string.IsNullOrWhiteSpace(token))
            {
                return PaymentStateFilterKind.Any;
            }

            var compactToken = token
                .Replace("_", string.Empty)
                .Replace("-", string.Empty);

            return compactToken switch
            {
                "paid" or "مسدد" => PaymentStateFilterKind.Paid,
                "unpaid" or "غيرمسدد" => PaymentStateFilterKind.Unpaid,
                "partialpaid" or "partial" or "مسددجزئي" or "مسددعدد" => PaymentStateFilterKind.PartialPaid,
                "overdue" or "overdueunpaid" or "متاخرغيرمسدد" or "متأخرغيرمسدد" => PaymentStateFilterKind.OverdueUnpaid,
                _ => PaymentStateFilterKind.Any
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

        private static decimal ParseDecimal(string? value, decimal fallback = 0m)
        {
            var parsed = ParseDecimalNullable(value);
            return parsed ?? fallback;
        }

        private static decimal? ParseDecimalNullable(string? value)
        {
            var normalized = (value ?? string.Empty).Trim();
            if (normalized.Length == 0)
            {
                return null;
            }

            if (TryParseDecimalWithCulture(normalized, out var parsed))
            {
                return parsed;
            }

            var sanitized = NormalizeDecimalText(normalized);
            if (sanitized.Length == 0)
            {
                return null;
            }

            if (TryParseDecimalWithCulture(sanitized, out parsed))
            {
                return parsed;
            }

            return null;
        }

        private static bool TryParseDecimalWithCulture(string value, out decimal parsed)
        {
            var styles = NumberStyles.AllowLeadingSign
                | NumberStyles.AllowDecimalPoint
                | NumberStyles.AllowThousands
                | NumberStyles.AllowCurrencySymbol
                | NumberStyles.AllowLeadingWhite
                | NumberStyles.AllowTrailingWhite;

            return decimal.TryParse(value, styles, CultureInfo.InvariantCulture, out parsed)
                || decimal.TryParse(value, styles, CultureInfo.GetCultureInfo("ar-EG"), out parsed)
                || decimal.TryParse(value, styles, CultureInfo.CurrentCulture, out parsed);
        }

        private static string NormalizeDecimalText(string value)
        {
            var text = value
                .Replace("ج.م", string.Empty, StringComparison.OrdinalIgnoreCase)
                .Replace("EGP", string.Empty, StringComparison.OrdinalIgnoreCase)
                .Trim();

            var builder = new StringBuilder(text.Length);
            foreach (var ch in text)
            {
                builder.Append(ch switch
                {
                    '٠' => '0',
                    '١' => '1',
                    '٢' => '2',
                    '٣' => '3',
                    '٤' => '4',
                    '٥' => '5',
                    '٦' => '6',
                    '٧' => '7',
                    '٨' => '8',
                    '٩' => '9',
                    '٫' => '.',
                    '،' => '.',
                    '٬' => ',',
                    _ => ch
                });
            }

            return builder.ToString();
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
