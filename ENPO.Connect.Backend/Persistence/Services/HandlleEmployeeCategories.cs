using AutoMapper;
using DocumentFormat.OpenXml.Office2010.Excel;
using DocumentFormat.OpenXml.Spreadsheet;
using ENPO.CreateLogFile;
using ENPO.Dto.HubSync;
using ENPO.Dto.Utilities;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Models.Attachment;
using Models.Correspondance;
using Models.DTO.Common;
using Models.DTO.Correspondance;
using Models.DTO.Correspondance.Enums;
using Models.DTO.Correspondance.Summer;
using NPOI.SS.Formula.Functions;
using Persistence.Data;
using Persistence.HelperServices;
using Persistence.Services.Notifications;
using Persistence.Services.Summer;
using SignalR.Notification;
using System;
using System.Data;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;

namespace Persistence.Services
{
    public class HandleEmployeeCategories
    {
        private readonly ConnectContext _connectContext;
        private readonly Attach_HeldContext _attach_HeldContext;
        private readonly GPAContext _gPAContext;
        private readonly helperService _helperService;
        private readonly IMapper _mapper;
        private readonly ENPOCreateLogFile _logger;
        private readonly MessageRequestService _messageRequestService;
        private readonly IConnectNotificationService _notificationService;
        private readonly SummerPricingService _summerPricingService;
        private readonly SummerBookingBlacklistService _summerBookingBlacklistService;
        private readonly SummerUnitFreezeService _summerUnitFreezeService;
        private const int CapacityLockTimeoutMs = 15000;
        private static readonly string[] SummerNotificationGroups = { "CONNECT", "CONNECT - TEST" };
        private static readonly HashSet<string> AllowedAttachmentExtensions = new(StringComparer.OrdinalIgnoreCase)
        {
            ".pdf", ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"
        };
        private static readonly Dictionary<int, Dictionary<int, int>> SummerCapacityRules = new()
        {
            { 147, new Dictionary<int, int> { { 5, 5 }, { 6, 5 }, { 8, 8 }, { 9, 5 } } },
            { 148, new Dictionary<int, int> { { 2, 2 }, { 4, 6 }, { 6, 2 } } },
            { 149, new Dictionary<int, int> { { 4, 24 }, { 6, 23 }, { 7, 24 } } }
        };
        private static readonly Dictionary<int, int> SummerMaxExtraMembersRules = new()
        {
            { 147, 2 },
            { 148, 1 },
            { 149, 2 }
        };
        private static readonly HashSet<string> SystemManagedSummerFieldKinds = new(StringComparer.OrdinalIgnoreCase)
        {
            SummerWorkflowDomainConstants.ActionTypeFieldKind,
            SummerWorkflowDomainConstants.PaymentDueAtUtcFieldKind,
            SummerWorkflowDomainConstants.PaymentStatusFieldKind,
            SummerWorkflowDomainConstants.PaidAtUtcFieldKind,
            SummerWorkflowDomainConstants.RequestCreatedAtUtcFieldKind,
            "Summer_PaymentNotes",
            "Summer_TransferCount",
            "Summer_TransferFromCategory",
            "Summer_TransferFromWave",
            "Summer_TransferToCategory",
            "Summer_TransferToWave",
            "Summer_TransferApprovedAtUtc",
            "Summer_TransferredAtUtc",
            "Summer_CancelReason",
            "Summer_CancelledAtUtc",
            "Summer_AdminLastAction",
            "Summer_AdminActionAtUtc",
            "Summer_AdminComment",
            SummerWorkflowDomainConstants.PricingFieldKinds.ConfigId,
            SummerWorkflowDomainConstants.PricingFieldKinds.PolicyId,
            SummerWorkflowDomainConstants.PricingFieldKinds.PricingMode,
            SummerWorkflowDomainConstants.PricingFieldKinds.MembershipType,
            SummerWorkflowDomainConstants.PricingFieldKinds.TransportationMandatory,
            SummerWorkflowDomainConstants.PricingFieldKinds.SelectedStayMode,
            SummerWorkflowDomainConstants.PricingFieldKinds.PersonsCount,
            SummerWorkflowDomainConstants.PricingFieldKinds.PeriodKey,
            SummerWorkflowDomainConstants.PricingFieldKinds.WaveDate,
            SummerWorkflowDomainConstants.PricingFieldKinds.AccommodationPricePerPerson,
            SummerWorkflowDomainConstants.PricingFieldKinds.TransportationPricePerPerson,
            SummerWorkflowDomainConstants.PricingFieldKinds.AccommodationTotal,
            SummerWorkflowDomainConstants.PricingFieldKinds.TransportationTotal,
            SummerWorkflowDomainConstants.PricingFieldKinds.InsuranceAmount,
            SummerWorkflowDomainConstants.PricingFieldKinds.ProxyInsuranceAmount,
            SummerWorkflowDomainConstants.PricingFieldKinds.AppliedInsuranceAmount,
            SummerWorkflowDomainConstants.PricingFieldKinds.GrandTotal,
            SummerWorkflowDomainConstants.PricingFieldKinds.DisplayText,
            SummerWorkflowDomainConstants.PricingFieldKinds.SmsText,
            SummerWorkflowDomainConstants.PricingFieldKinds.WhatsAppText,
            "Summer_PaymentMode",
            "SUM2026_PaymentMode",
            "PaymentMode",
            "Summer_PaymentInstallmentCount",
            "SUM2026_PaymentInstallmentCount",
            "Summer_PaymentInstallmentsTotal",
            "SUM2026_PaymentInstallmentsTotal",
            "Summer_PaymentInstallment1Amount",
            "Summer_PaymentInstallment2Amount",
            "Summer_PaymentInstallment3Amount",
            "Summer_PaymentInstallment4Amount",
            "Summer_PaymentInstallment5Amount",
            "Summer_PaymentInstallment6Amount",
            "SUM2026_PaymentInstallment1Amount",
            "SUM2026_PaymentInstallment2Amount",
            "SUM2026_PaymentInstallment3Amount",
            "SUM2026_PaymentInstallment4Amount",
            "SUM2026_PaymentInstallment5Amount",
            "SUM2026_PaymentInstallment6Amount",
            "Summer_PaymentInstallment1Paid",
            "Summer_PaymentInstallment2Paid",
            "Summer_PaymentInstallment3Paid",
            "Summer_PaymentInstallment4Paid",
            "Summer_PaymentInstallment5Paid",
            "Summer_PaymentInstallment6Paid",
            "SUM2026_PaymentInstallment1Paid",
            "SUM2026_PaymentInstallment2Paid",
            "SUM2026_PaymentInstallment3Paid",
            "SUM2026_PaymentInstallment4Paid",
            "SUM2026_PaymentInstallment5Paid",
            "SUM2026_PaymentInstallment6Paid",
            "Summer_PaymentInstallment1PaidAtUtc",
            "Summer_PaymentInstallment2PaidAtUtc",
            "Summer_PaymentInstallment3PaidAtUtc",
            "Summer_PaymentInstallment4PaidAtUtc",
            "Summer_PaymentInstallment5PaidAtUtc",
            "Summer_PaymentInstallment6PaidAtUtc",
            "SUM2026_PaymentInstallment1PaidAtUtc",
            "SUM2026_PaymentInstallment2PaidAtUtc",
            "SUM2026_PaymentInstallment3PaidAtUtc",
            "SUM2026_PaymentInstallment4PaidAtUtc",
            "SUM2026_PaymentInstallment5PaidAtUtc",
            "SUM2026_PaymentInstallment6PaidAtUtc"
        };
        private static readonly Dictionary<string, string> SummerAuditAliasMap = BuildSummerAuditAliasMap();
        private static readonly Dictionary<string, string> SummerAuditFallbackFieldLabelByAlias = new(StringComparer.OrdinalIgnoreCase)
        {
            ["OWNER_NAME"] = "اسم صاحب الطلب",
            ["OWNER_FILE_NUMBER"] = "رقم ملف صاحب الطلب",
            ["OWNER_PHONE"] = "رقم هاتف صاحب الطلب",
            ["OWNER_EXTRA_PHONE"] = "هاتف إضافي",
            ["FAMILY_COUNT"] = "عدد الأفراد",
            ["EXTRA_COUNT"] = "أفراد إضافيون",
            ["COMPANION_NAME"] = "اسم المرافق",
            ["COMPANION_AGE"] = "سن (للأطفال)",
            ["COMPANION_RELATION"] = "صلة القرابة"
        };
        private static readonly Dictionary<string, string> SummerAuditFallbackGroupByAlias = new(StringComparer.OrdinalIgnoreCase)
        {
            ["OWNER_NAME"] = "بيانات صاحب الطلب",
            ["OWNER_FILE_NUMBER"] = "بيانات صاحب الطلب",
            ["OWNER_PHONE"] = "بيانات صاحب الطلب",
            ["OWNER_EXTRA_PHONE"] = "بيانات صاحب الطلب",
            ["FAMILY_COUNT"] = "بيانات الحجز",
            ["EXTRA_COUNT"] = "بيانات الحجز",
            ["COMPANION_NAME"] = "بيانات المرافقين",
            ["COMPANION_AGE"] = "بيانات المرافقين",
            ["COMPANION_RELATION"] = "بيانات المرافقين"
        };

        public HandleEmployeeCategories(
            ConnectContext connectContext,
            Attach_HeldContext attach_HeldContext,
            GPAContext gPAContext,
            helperService helperService,
            IMapper mapper,
            ENPOCreateLogFile logger,
            MessageRequestService messageRequestService,
            IConnectNotificationService notificationService,
            SummerPricingService summerPricingService,
            SummerBookingBlacklistService summerBookingBlacklistService,
            SummerUnitFreezeService summerUnitFreezeService)
        {
            _connectContext = connectContext;
            _attach_HeldContext = attach_HeldContext;
            _gPAContext = gPAContext;
            _helperService = helper_service_check(helperService);
            _mapper = mapper;
            _logger = logger ?? new ENPOCreateLogFile("C:\\Connect_Log", "HandleEmployeeCategories_Log" + DateTime.Today.ToString("dd-MMM-yyyy"), FileExtension.txt);
            _messageRequestService = messageRequestService ?? throw new ArgumentNullException(nameof(messageRequestService));
            _notificationService = notificationService ?? throw new ArgumentNullException(nameof(notificationService));
            _summerPricingService = summerPricingService ?? throw new ArgumentNullException(nameof(summerPricingService));
            _summerBookingBlacklistService = summerBookingBlacklistService ?? throw new ArgumentNullException(nameof(summerBookingBlacklistService));
            _summerUnitFreezeService = summerUnitFreezeService ?? throw new ArgumentNullException(nameof(summerUnitFreezeService));
        }

        private helperService helper_service_check(helperService svc)
        {
            if (svc == null) throw new ArgumentNullException(nameof(svc));
            return svc;
        }

        // SummerRequests: creates message + reply and persists with retry and basic unique-requestRef handling to reduce overwrite collisions
        public async Task SummerRequests(
            MessageRequest messageRequest,
            CategoryWithParent categoryInfo,
            CommonResponse<MessageDto> response,
            string? actingUserId = null,
            SummerRequestRuntimeOptions? runtimeOptions = null)
        {
            if (messageRequest == null) throw new ArgumentNullException(nameof(messageRequest));
            if (response == null) throw new ArgumentNullException(nameof(response));
            var runtime = runtimeOptions ?? SummerRequestRuntimeOptions.Default;

            if (string.IsNullOrWhiteSpace(messageRequest.CreatedBy))
            {
                response.Errors.Add(new Error { Code = "400", Message = "معرف المستخدم المنفذ للطلب مطلوب." });
                return;
            }

            if (messageRequest.Fields == null || messageRequest.Fields.Count == 0)
            {
                response.Errors.Add(new Error { Code = "400", Message = "بيانات الطلب مطلوبة." });
                return;
            }

            if (!ValidateAndNormalizeCompanionNames(messageRequest.Fields, response))
            {
                return;
            }

            var employeeId = GetFirstFieldValue(messageRequest.Fields, SummerWorkflowDomainConstants.EmployeeIdFieldKinds);
            if (string.IsNullOrWhiteSpace(employeeId))
            {
                response.Errors.Add(new Error { Code = "400", Message = "رقم ملف الموظف مطلوب." });
                return;
            }

            if (_summerBookingBlacklistService.IsBlocked(employeeId))
            {
                response.Errors.Add(new Error
                {
                    Code = "SUMMER_BLACKLIST_BLOCKED",
                    Message = "تعذر إتمام الحجز: رقم الملف مدرج ضمن قائمة الممنوعين من الحجز."
                });
                return;
            }

            var summerCamp = GetFirstFieldValue(messageRequest.Fields, SummerWorkflowDomainConstants.WaveCodeFieldKinds);
            if (string.IsNullOrWhiteSpace(summerCamp))
            {
                response.Errors.Add(new Error { Code = "400", Message = "الفوج مطلوب." });
                return;
            }

            var familyCount = ParseInt(GetFirstFieldValue(messageRequest.Fields, SummerWorkflowDomainConstants.FamilyCountFieldKinds), 0);
            if (familyCount <= 0)
            {
                response.Errors.Add(new Error { Code = "400", Message = "عدد الأفراد مطلوب." });
                return;
            }

            var extraCount = Math.Max(0, ParseInt(GetFirstFieldValue(messageRequest.Fields, SummerWorkflowDomainConstants.ExtraCountFieldKinds), 0));
            var personsCount = familyCount + extraCount;
            if (personsCount <= 0)
            {
                response.Errors.Add(new Error { Code = "400", Message = "عدد الأفراد مطلوب لحساب التسعير." });
                return;
            }

            var seasonYear = ParseInt(GetFirstFieldValue(messageRequest.Fields, SummerWorkflowDomainConstants.SeasonYearFieldKinds), DateTime.UtcNow.Year);
            var waveLabel = GetFirstFieldValue(messageRequest.Fields, SummerWorkflowDomainConstants.WaveLabelFieldKinds);
            var stayMode = GetFirstFieldValue(messageRequest.Fields, SummerWorkflowDomainConstants.StayModeFieldKinds);
            var isProxyBooking = ParseBoolean(GetFirstFieldValue(messageRequest.Fields, SummerWorkflowDomainConstants.ProxyModeFieldKinds));
            var requestedMembershipType = GetFirstFieldValue(messageRequest.Fields, SummerWorkflowDomainConstants.MembershipTypeFieldKinds);

            if (categoryInfo == null)
            {
                response.Errors.Add(new Error { Code = "404", Message = "المصيف غير موجود." });
                return;
            }

            var parentCategory = categoryInfo.ParentCategory;

            if (parentCategory == null)
            {
                response.Errors.Add(new Error { Code = "404", Message = "بيانات التصنيف الرئيسي غير متاحة." });
                return;
            }

            var isEditOperation = messageRequest.MessageId.GetValueOrDefault() > 0;
            var editMessageId = messageRequest.MessageId.GetValueOrDefault();
            if (!isEditOperation
                && !CanCreateSummerRequestForDestination(
                    categoryInfo.Category?.CatId ?? 0,
                    categoryInfo.Category?.CatName,
                    runtime.HasSummerAdminPermission))
            {
                response.Errors.Add(new Error
                {
                    Code = "403",
                    Message = SummerWorkflowDomainConstants.DestinationAccessDeniedMessage
                });
                return;
            }

            var normalizedActorUserId = string.IsNullOrWhiteSpace(actingUserId)
                ? (messageRequest.CreatedBy ?? string.Empty).Trim()
                : actingUserId.Trim();
            var canManageSummerCategory = await CanUserManageSummerCategoryAsync(normalizedActorUserId, categoryInfo.Category.CatId);
            var allowMembershipOverride = runtime.HasSummerAdminPermission || canManageSummerCategory;
            var resolvedMembershipType = SummerMembershipPolicy.ResolveMembershipType(
                requestedMembershipType,
                allowMembershipOverride);
            UpsertRequestFieldRange(
                messageRequest.Fields,
                SummerWorkflowDomainConstants.MembershipTypeFieldKinds,
                resolvedMembershipType);
            var useFrozenInventory = ParseBoolean(GetFirstFieldValue(messageRequest.Fields, SummerWorkflowDomainConstants.UseFrozenUnitFieldKinds));
            var allowAdminFrozenBooking = false;
            if (useFrozenInventory)
            {
                allowAdminFrozenBooking = canManageSummerCategory;
                if (!allowAdminFrozenBooking)
                {
                    response.Errors.Add(new Error
                    {
                        Code = "403",
                        Message = "غير مصرح لك باستخدام الوحدات المجمدة في هذا المصيف."
                    });
                    return;
                }
            }

            var destinationName = GetFirstFieldValue(messageRequest.Fields, SummerWorkflowDomainConstants.DestinationNameFieldKinds);
            if (string.IsNullOrWhiteSpace(destinationName))
            {
                destinationName = (categoryInfo.Category?.CatName ?? string.Empty).Trim();
            }

            var hasAdminEditOverride = isEditOperation && (runtime.HasSummerAdminPermission || canManageSummerCategory);
            if (!ValidateSummerExtraMembersRules(
                    categoryInfo.Category?.CatId ?? 0,
                    destinationName,
                    familyCount,
                    extraCount,
                    runtime.HasSummerAdminPermission,
                    hasAdminEditOverride,
                    response))
            {
                return;
            }

            var pricingQuoteResponse = await _summerPricingService.GetQuoteAsync(new SummerPricingQuoteRequest
            {
                CategoryId = categoryInfo.Category.CatId,
                SeasonYear = seasonYear,
                WaveCode = summerCamp,
                WaveLabel = waveLabel,
                FamilyCount = familyCount,
                ExtraCount = extraCount,
                PersonsCount = personsCount,
                StayMode = stayMode,
                IsProxyBooking = isProxyBooking,
                MembershipType = resolvedMembershipType,
                DestinationName = destinationName
            },
            allowMembershipOverride: allowMembershipOverride);

            if (!pricingQuoteResponse.IsSuccess || pricingQuoteResponse.Data == null)
            {
                if (pricingQuoteResponse.Errors.Any())
                {
                    foreach (var error in pricingQuoteResponse.Errors)
                    {
                        response.Errors.Add(new Error
                        {
                            Code = string.IsNullOrWhiteSpace(error?.Code) ? "400" : error.Code,
                            Message = string.IsNullOrWhiteSpace(error?.Message)
                                ? "تعذر حساب التسعير. يرجى مراجعة إعدادات التسعير."
                                : error.Message
                        });
                    }
                }
                else
                {
                    response.Errors.Add(new Error
                    {
                        Code = "400",
                        Message = "تعذر حساب التسعير. يرجى مراجعة إعدادات التسعير."
                    });
                }

                return;
            }

            var pricingQuote = pricingQuoteResponse.Data;
            ApplyPricingSnapshotFields(messageRequest.Fields, pricingQuote);
            UpsertRequestFieldRange(
                messageRequest.Fields,
                SummerWorkflowDomainConstants.StayModeFieldKinds,
                pricingQuote.NormalizedStayMode);
            UpsertRequestFieldRange(
                messageRequest.Fields,
                SummerWorkflowDomainConstants.UseFrozenUnitFieldKinds,
                allowAdminFrozenBooking ? "true" : "false");
            Dictionary<string, string>? existingPaymentPlanSnapshot = null;
            if (isEditOperation
                && !runtime.HasSummerGeneralManagerPermission
                && editMessageId > 0)
            {
                existingPaymentPlanSnapshot = await LoadExistingSummerPaymentPlanSnapshotAsync(editMessageId);
            }
            if (!ApplySummerPaymentPlanFields(
                    messageRequest.Fields,
                    pricingQuote.GrandTotal,
                    runtime.HasSummerGeneralManagerPermission,
                    isEditOperation,
                    existingPaymentPlanSnapshot,
                    response))
            {
                return;
            }

            messageRequest.Type = (byte)parentCategory.CatId;


            var allowed = await IsWithinCategoryIntervalLimitAsync(
                categoryInfo.Category,
                response,
                employeeId,
                summerCamp,
                isEditOperation ? editMessageId : null);
            if (!allowed)
            {
                // error already added inside IsWithinCategoryIntervalLimitAsync
                return;
            }

            var hasCapacity = await IsWithinCategoryCapacityLimitAsync(
                categoryInfo.Category,
                response,
                summerCamp,
                familyCount,
                allowFrozenReservation: allowAdminFrozenBooking,
                isEditOperation ? editMessageId : null);
            if (!hasCapacity)
            {
                return;
            }

            // Validate file sizes first
            if (!_helperService.ValidateFileSizes(messageRequest.files, response))
            {
                _logger.AppendLine("File size validation failed in SummerRequests.");
                return;
            }

            if (!ValidateAllowedAttachmentExtensions(messageRequest.files, response))
            {
                _logger.AppendLine("File extension validation failed in SummerRequests.");
                return;
            }

            const int maxAttempts = 3;
            int attempt = 0;

            void RollbackTransactions(Microsoft.EntityFrameworkCore.Storage.IDbContextTransaction trxConnect, Microsoft.EntityFrameworkCore.Storage.IDbContextTransaction trxAttach)
            {
                try
                {
                    trxAttach.Rollback();
                }
                catch (Exception rbEx)
                {
                    _logger.AppendLine($"Rollback (attach) failed: {rbEx.Message}");
                }
                try
                {
                    trxConnect.Rollback();
                }
                catch (Exception rbEx)
                {
                    _logger.AppendLine($"Rollback (connect) failed: {rbEx.Message}");
                }
            }

            while (attempt < maxAttempts)
            {
                attempt++;
                using var trxConnect = _connectContext.Database.BeginTransaction(IsolationLevel.Serializable);
                using var trxAttach = _attach_HeldContext.Database.BeginTransaction(IsolationLevel.ReadCommitted);
                try
                {
                    if (!await AcquireCapacityLockAsync(categoryInfo.Category.CatId, summerCamp))
                    {
                        response.Errors.Add(new Error
                        {
                            Code = "409",
                            Message = "تعذر حجز السعة حالياً بسبب حفظ متزامن. برجاء إعادة المحاولة بعد ثوانٍ."
                        });
                        return;
                    }

                    allowed = await IsWithinCategoryIntervalLimitAsync(
                        categoryInfo.Category,
                        response,
                        employeeId,
                        summerCamp,
                        isEditOperation ? editMessageId : null);
                    if (!allowed)
                    {
                        return;
                    }

                    hasCapacity = await IsWithinCategoryCapacityLimitAsync(
                        categoryInfo.Category,
                        response,
                        summerCamp,
                        familyCount,
                        allowFrozenReservation: allowAdminFrozenBooking,
                        isEditOperation ? editMessageId : null);
                    if (!hasCapacity)
                    {
                        return;
                    }

                    int messageId;
                    string replyText;
                    string capacityAction;
                    int previousCategoryId = categoryInfo.Category.CatId;
                    var previousWaveCode = summerCamp;

                    if (isEditOperation)
                    {
                        messageId = editMessageId;
                        var existingMessage = await _connectContext.Messages.FirstOrDefaultAsync(m => m.MessageId == messageId);
                        if (existingMessage == null)
                        {
                            response.Errors.Add(new Error { Code = "404", Message = "الطلب المطلوب تعديله غير موجود." });
                            return;
                        }

                        if (!await CanUserEditExistingSummerMessageAsync(normalizedActorUserId, existingMessage))
                        {
                            response.Errors.Add(new Error { Code = "403", Message = "غير مصرح لك بتعديل هذا الطلب." });
                            return;
                        }

                        previousCategoryId = existingMessage.CategoryCd;
                        previousWaveCode = (await _connectContext.TkmendFields
                            .AsNoTracking()
                            .Where(x => x.FildRelted == messageId && x.FildKind == "SummerCamp")
                            .Select(x => x.FildTxt)
                            .FirstOrDefaultAsync()
                        ?? string.Empty).Trim();

                        var requestRef = (existingMessage.RequestRef ?? string.Empty).Trim();
                        if (string.IsNullOrWhiteSpace(requestRef))
                        {
                            var requestSeasonYear = ParseInt(GetFieldValue(messageRequest.Fields, "SummerSeasonYear"), DateTime.UtcNow.Year);
                            var sequenceName = GetSummerSequenceName(categoryInfo.Category.CatId);
                            var requestRefSeq = _helperService.GetSequenceNextValue(sequenceName);
                            requestRef = BuildSummerRequestReference(categoryInfo.Category.CatId, requestSeasonYear, requestRefSeq);
                        }

                        messageRequest.MessageId = messageId;
                        messageRequest.RequestRef = requestRef;
                        messageRequest.AssignedSectorId = parentCategory.Stockholder.ToString();
                        UpsertRequestField(messageRequest.Fields, "RequestRef", requestRef);
                        ApplyPricingMessageIdentity(pricingQuote, messageId, requestRef);
                        ApplyPricingSnapshotFields(messageRequest.Fields, pricingQuote);

                        existingMessage.Subject = messageRequest.Subject;
                        existingMessage.Description = messageRequest.Description;
                        existingMessage.AssignedSectorId = messageRequest.AssignedSectorId;
                        existingMessage.Type = messageRequest.Type ?? existingMessage.Type;
                        existingMessage.CategoryCd = categoryInfo.Category.CatId;
                        existingMessage.RequestRef = requestRef;
                        if (!string.IsNullOrWhiteSpace(messageRequest.CurrentResponsibleSectorId))
                        {
                            existingMessage.CurrentResponsibleSectorId = messageRequest.CurrentResponsibleSectorId;
                        }
                        existingMessage.LastModifiedDate = DateTime.Now;

                        var fieldAuditEntries = await ReplaceMessageFieldsAsync(
                            messageId,
                            messageRequest.Fields,
                            categoryInfo.Category.CatId,
                            normalizedActorUserId);

                        replyText = BuildSummerEditFriendlyReplyText(fieldAuditEntries);
                        capacityAction = "EDIT";
                    }
                    else
                    {
                        // Generate ids using DB-backed sequences (helperService expected to use atomic DB operations)
                        messageId = _helperService.GetSequenceNextValue("Seq_Tickets");
                        var requestSeasonYear = ParseInt(GetFieldValue(messageRequest.Fields, "SummerSeasonYear"), DateTime.UtcNow.Year);
                        var sequenceName = GetSummerSequenceName(categoryInfo.Category.CatId);
                        var requestRefSeq = _helperService.GetSequenceNextValue(sequenceName);
                        var requestReference = BuildSummerRequestReference(categoryInfo.Category.CatId, requestSeasonYear, requestRefSeq);

                        messageRequest.MessageId = messageId;
                        messageRequest.RequestRef = requestReference;
                        messageRequest.AssignedSectorId = parentCategory.Stockholder.ToString();
                        var requestRefField = messageRequest.Fields.FirstOrDefault(x => x.FildKind == "RequestRef");
                        if (requestRefField != null)
                        {
                            requestRefField.FildTxt = messageRequest.RequestRef;
                        }
                        ApplyPricingMessageIdentity(pricingQuote, messageId, messageRequest.RequestRef);
                        ApplyPricingSnapshotFields(messageRequest.Fields, pricingQuote);

                        var requestCreatedAtUtc = TruncateToWholeSecondUtc(DateTime.UtcNow);
                        var paymentDueAtUtc = SummerCalendarRules.CalculatePaymentDueUtc(requestCreatedAtUtc);
                        UpsertRequestField(messageRequest.Fields, SummerWorkflowDomainConstants.RequestCreatedAtUtcFieldKind, requestCreatedAtUtc.ToString("o"));
                        UpsertRequestField(messageRequest.Fields, SummerWorkflowDomainConstants.PaymentDueAtUtcFieldKind, paymentDueAtUtc.ToString("o"));
                        UpsertRequestField(messageRequest.Fields, SummerWorkflowDomainConstants.PaymentStatusFieldKind, "PENDING_PAYMENT");
                        UpsertRequestField(messageRequest.Fields, "Summer_TransferCount", "0");
                        _logger.AppendLine(
                            $"SummerRequests: anchored request created time for message {messageId} at {requestCreatedAtUtc:o}; payment due at {paymentDueAtUtc:o}.");

                        replyText = "تم إنشاء طلب المصيف.";
                        capacityAction = "CREATE";
                    }

                    if (!allowAdminFrozenBooking)
                    {
                        await _summerUnitFreezeService.ReleaseAssignmentsForMessageAsync(messageId, normalizedActorUserId);
                    }
                    else
                    {
                        var frozenAssigned = await _summerUnitFreezeService.TryAssignFrozenUnitAsync(
                            categoryInfo.Category.CatId,
                            summerCamp,
                            familyCount,
                            messageId,
                            normalizedActorUserId);
                        if (!frozenAssigned)
                        {
                            response.Errors.Add(new Error
                            {
                                Code = "429",
                                Message = "لا توجد وحدات مجمدة متاحة حالياً للحجز الإداري."
                            });
                            return;
                        }
                    }

                    var assignedSector = messageRequest.AssignedSectorId ?? messageRequest.CreatedBy;
                    var reply = _helperService.CreateReply(messageId, replyText, messageRequest.CreatedBy, assignedSector, "0.0.0.0");

                    if (isEditOperation)
                    {
                        await _connectContext.Replies.AddAsync(reply);
                        await SaveRequestAttachmentsAsync(messageRequest.files, reply.ReplyId);
                        await RevokeSummerEditTokensAsync(messageId, normalizedActorUserId);
                    }
                    else
                    {
                        await _messageRequestService.PersistEntitiesAsync(messageRequest, reply);
                    }
                    await _connectContext.SaveChangesAsync();
                    await _attach_HeldContext.SaveChangesAsync();
                    trxAttach.Commit();
                    trxConnect.Commit();

                    _logger.AppendLine($"SummerRequests: {(isEditOperation ? "updated" : "created")} message {messageId} with RequestRef {messageRequest.RequestRef}");

                    // Post commit actions (notifications, etc.) and fetch created message
                    if (!runtime.SuppressNotifications)
                    {
                        try
                        {
                            await PostCommitActionsAsync(messageRequest, reply, categoryInfo);
                            await PublishCapacityUpdateAsync(categoryInfo.Category.CatId, summerCamp, capacityAction);
                            if (isEditOperation
                                && previousCategoryId > 0
                                && !string.IsNullOrWhiteSpace(previousWaveCode)
                                && (previousCategoryId != categoryInfo.Category.CatId
                                    || !string.Equals(previousWaveCode.Trim(), summerCamp.Trim(), StringComparison.OrdinalIgnoreCase)))
                            {
                                await PublishCapacityUpdateAsync(previousCategoryId, previousWaveCode, "EDIT_PREVIOUS");
                            }
                        }
                        catch (Exception postEx)
                        {
                            _logger.AppendLine($"PostCommitActions failed: {postEx.Message}");
                        }
                    }

                    if (runtime.SkipResponseHydration)
                    {
                        response.Data = new MessageDto
                        {
                            MessageId = messageId,
                            RequestRef = messageRequest.RequestRef,
                            CategoryCd = categoryInfo.Category.CatId,
                            Subject = messageRequest.Subject,
                            Description = messageRequest.Description,
                            CreatedBy = messageRequest.CreatedBy,
                            AssignedSectorId = messageRequest.AssignedSectorId ?? string.Empty,
                            CurrentResponsibleSectorId = messageRequest.CurrentResponsibleSectorId,
                            CreatedDate = DateTime.UtcNow,
                            Status = MessageStatus.New,
                            Fields = messageRequest.Fields
                        };
                    }
                    else
                    {
                        await _helperService.GetMessageRequestById(messageId, response);
                    }

                    if (!runtime.SuppressNotifications
                        && !isEditOperation
                        && response.IsSuccess
                        && response.Data != null)
                    {
                        try
                        {
                            await DispatchOwnerPricingConfirmationAsync(response.Data);
                        }
                        catch (Exception notificationEx)
                        {
                            _logger.AppendLine($"Owner pricing confirmation notification failed: {notificationEx.Message}");
                        }
                    }

                    return;
                }
                catch (DbUpdateConcurrencyException concEx)
                {
                    RollbackTransactions(trxConnect, trxAttach);

                    _logger.AppendLine($"Concurrency conflict on attempt {attempt}: {concEx.Message}");
                    if (attempt >= maxAttempts)
                    {
                        response.Errors.Add(new Error { Code = "409", Message = "حدث تعارض أثناء الحفظ. برجاء إعادة المحاولة." });
                        return;
                    }

                    continue;
                }
                catch (DbUpdateException dbEx)
                {
                    RollbackTransactions(trxConnect, trxAttach);

                    // Detect unique constraint on RequestRef (best-effort string check) and retry with new sequence
                    var innerMsg = dbEx.InnerException?.Message ?? dbEx.Message;
                    _logger.AppendLine($"DbUpdateException on attempt {attempt}: {innerMsg}");

                    if (IsUniqueConstraintViolation(innerMsg))
                    {
                        // regenerate suffix and retry
                        _logger.AppendLine("Unique constraint violation detected for RequestRef - regenerating suffix and retrying.");
                        continue;
                    }

                    // Other DB update errors: add to response and stop
                    response.Errors.Add(new Error { Code = dbEx.HResult.ToString(), Message = innerMsg });
                    return;
                }
                catch (Exception ex)
                {
                    RollbackTransactions(trxConnect, trxAttach);

                    _logger.AppendLine($"Unexpected exception in SummerRequests: {ex.Message}");
                    response.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });
                    return;
                }
            }

            // If we exit loop without success
            response.Errors.Add(new Error { Code = "409", Message = "تعذر حفظ الطلب بعد عدة محاولات بسبب تعارض الحفظ أو تكرار المفتاح." });
        }

        private async Task PostCommitActionsAsync(MessageRequest messageRequest, Reply reply, CategoryWithParent categoryInfo)
        {
            var category = categoryInfo?.ParentCategory;
            var requestRef = messageRequest?.RequestRef ?? string.Empty;
            var catName = category?.CatName ?? string.Empty;
            var isEditOperation = !string.IsNullOrWhiteSpace(reply?.Message)
                && reply.Message.Contains("تعديل", StringComparison.OrdinalIgnoreCase);

            var targetAdminGroups = ResolveResponsibleAdminGroups(messageRequest);
            var updatedMessageId = reply?.MessageId ?? 0;
            var requestUpdatePayload = BuildSummerRequestUpdatedPayload(updatedMessageId, isEditOperation ? "EDIT" : "CREATE");

            _logger.AppendLine(
                $"PostCommitActionsAsync: summer request update prepared. MessageId={updatedMessageId}, Action={(isEditOperation ? "EDIT" : "CREATE")}, CreatedBy={messageRequest?.CreatedBy}, AdminGroups={(targetAdminGroups.Count > 0 ? string.Join(",", targetAdminGroups) : "NONE")}, RequestRef={requestRef}, Category={catName}.");

            if (targetAdminGroups.Count > 0 && !string.IsNullOrWhiteSpace(requestUpdatePayload))
            {
                var dispatchResponse = await _notificationService.SendSignalRToGroupsAsync(new SignalRGroupsDispatchRequest
                {
                    GroupNames = targetAdminGroups,
                    Notification = requestUpdatePayload,
                    Title = "تحديث طلبات المصايف",
                    Type = NotificationType.info,
                    Category = NotificationCategory.Business,
                    Sender = "Connect",
                    Time = DateTime.Now
                });

                if (!dispatchResponse.IsSuccess)
                {
                    var errors = string.Join(" | ", dispatchResponse.Errors.Select(error => $"{error.Code}:{error.Message}"));
                    _logger.AppendLine(
                        $"PostCommitActionsAsync: failed to dispatch summer admin update. MessageId={updatedMessageId}, Groups={string.Join(",", targetAdminGroups)}, Errors={errors}.");
                }
                else
                {
                    _logger.AppendLine(
                        $"PostCommitActionsAsync: dispatched summer admin update. MessageId={updatedMessageId}, Groups={string.Join(",", targetAdminGroups)}.");
                }
            }
            else
            {
                _logger.AppendLine($"PostCommitActionsAsync: no valid admin group/message id for message #{updatedMessageId}.");
            }
            _logger.AppendLine("Transactions committed.");
        }

        private static string BuildSummerRequestUpdatedPayload(int messageId, string action)
        {
            if (messageId <= 0)
            {
                return string.Empty;
            }

            var normalizedAction = string.IsNullOrWhiteSpace(action)
                ? "UPDATE"
                : action.Trim().ToUpperInvariant();

            return $"SUMMER_REQUEST_UPDATED|{messageId}|{normalizedAction}|{DateTime.UtcNow:o}";
        }

        private static List<string> ResolveResponsibleAdminGroups(MessageRequest? messageRequest)
        {
            if (messageRequest == null)
            {
                return new List<string>();
            }

            return new[] { messageRequest.CurrentResponsibleSectorId, messageRequest.AssignedSectorId }
                .Select(sector => (sector ?? string.Empty).Trim())
                .Where(sector => sector.Length > 0)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
        }

        private static bool IsUniqueConstraintViolation(string message)
        {
            if (string.IsNullOrEmpty(message)) return false;
            var lower = message.ToLowerInvariant();
            return lower.Contains("unique") || lower.Contains("duplicate") || lower.Contains("uk_") || lower.Contains("ix_") || lower.Contains("violation of unique");
        }

        // Checks whether the same employee already has a reservation in the same
        // summer destination (category) and same wave.
        private async Task<bool> IsWithinCategoryIntervalLimitAsync(
            Cdcategory category,
            CommonResponse<MessageDto> response,
            string employeeId,
            string summerCamp,
            int? excludedMessageId = null)
        {
            var sameCampReservationMessageIds = await _connectContext.TkmendFields
                .AsNoTracking()
                .Where(x => x.FildKind == "SummerCamp" && x.FildTxt == summerCamp)
                .Select(s => s.FildRelted)
                .Distinct()
                .ToListAsync();

            if (!sameCampReservationMessageIds.Any())
            {
                return true;
            }

            var sameCategoryQuery = _connectContext.Messages
                .AsNoTracking()
                .Where(m => sameCampReservationMessageIds.Contains(m.MessageId)
                            && m.CategoryCd == category.CatId
                            && m.Status != MessageStatus.Rejected);
            if (excludedMessageId.HasValue)
            {
                sameCategoryQuery = sameCategoryQuery.Where(m => m.MessageId != excludedMessageId.Value);
            }
            var sameCategoryMessageIds = await sameCategoryQuery
                .Select(m => m.MessageId)
                .ToListAsync();

            if (!sameCategoryMessageIds.Any())
            {
                return true;
            }

            var hasPreviousReservation = await _connectContext.TkmendFields
                .AsNoTracking()
                .AnyAsync(x =>
                    sameCategoryMessageIds.Contains(x.FildRelted)
                    && x.FildKind == "Emp_Id"
                    && x.FildTxt == employeeId);

            if (hasPreviousReservation)
            {
                response.Errors.Add(new Error
                {
                    Code = "429",
                    Message = $"لا يمكن الحجز لنفس الموظف أكثر من مرة في نفس المصيف '{category.CatName}' ونفس الفوج."
                });
                return false;
            }

            return true;
        }

        private async Task<bool> IsWithinCategoryCapacityLimitAsync(
            Cdcategory category,
            CommonResponse<MessageDto> response,
            string summerCamp,
            int familyCount,
            bool allowFrozenReservation = false,
            int? excludedMessageId = null)
        {
            if (!SummerCapacityRules.TryGetValue(category.CatId, out var capacityByFamily))
            {
                return true;
            }

            if (!capacityByFamily.TryGetValue(familyCount, out var totalUnits))
            {
                response.Errors.Add(new Error
                {
                    Code = "400",
                    Message = $"عدد الأفراد '{familyCount}' غير متاح للحجز في المصيف '{category.CatName}'."
                });
                return false;
            }

            var hasPublicCapacity = await _summerUnitFreezeService.HasPublicCapacityAsync(
                category.CatId,
                summerCamp,
                familyCount,
                totalUnits,
                excludedMessageId);
            if (hasPublicCapacity)
            {
                return true;
            }

            if (allowFrozenReservation)
            {
                var hasFrozenAvailability = await _summerUnitFreezeService.HasAssignableFrozenUnitAsync(
                    category.CatId,
                    summerCamp,
                    familyCount);
                if (hasFrozenAvailability)
                {
                    return true;
                }
            }

            var frozenAvailableUnits = await _summerUnitFreezeService.CountActiveFrozenAvailableUnitsAsync(
                category.CatId,
                summerCamp,
                familyCount);
            if (frozenAvailableUnits > 0)
            {
                response.Errors.Add(new Error
                {
                    Code = "429",
                    Message = $"لا توجد وحدات متاحة لعدد الأفراد '{familyCount}' في الفوج '{summerCamp}' بمصيف '{category.CatName}'."
                });
                return false;
            }

            response.Errors.Add(new Error
            {
                Code = "429",
                Message = $"لا توجد وحدات متاحة لعدد الأفراد '{familyCount}' في الفوج '{summerCamp}' بمصيف '{category.CatName}'."
            });
            return false;
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

        private async Task DispatchOwnerPricingConfirmationAsync(MessageDto message)
        {
            if (message == null)
            {
                return;
            }

            var fields = message.Fields ?? new List<TkmendField>();
            if (fields.Count == 0)
            {
                return;
            }

            var smsText = GetFirstFieldValue(fields, new[] { SummerWorkflowDomainConstants.PricingFieldKinds.SmsText });
            var whatsappText = GetFirstFieldValue(fields, new[] { SummerWorkflowDomainConstants.PricingFieldKinds.WhatsAppText });
            if (string.IsNullOrWhiteSpace(whatsappText))
            {
                whatsappText = smsText;
            }

            if (string.IsNullOrWhiteSpace(smsText) && string.IsNullOrWhiteSpace(whatsappText))
            {
                return;
            }

            var mobile = GetFirstFieldValue(fields, SummerWorkflowDomainConstants.EmployeePhoneFieldKinds);
            if (string.IsNullOrWhiteSpace(mobile))
            {
                mobile = GetFirstFieldValue(fields, SummerWorkflowDomainConstants.EmployeeExtraPhoneFieldKinds);
            }

            if (string.IsNullOrWhiteSpace(mobile))
            {
                _logger.AppendLine($"Owner pricing confirmation skipped for MessageId={message.MessageId}: mobile is missing.");
                return;
            }

            var ownerId = GetFirstFieldValue(fields, SummerWorkflowDomainConstants.EmployeeIdFieldKinds);
            if (string.IsNullOrWhiteSpace(ownerId))
            {
                ownerId = (message.CreatedBy ?? string.Empty).Trim();
            }

            var referenceNo = string.IsNullOrWhiteSpace(message.RequestRef)
                ? $"SUMMER-{message.MessageId}"
                : message.RequestRef.Trim();

            if (!string.IsNullOrWhiteSpace(smsText))
            {
                var smsResponse = await _notificationService.SendSmsAsync(new SmsDispatchRequest
                {
                    MobileNumber = mobile,
                    Message = smsText.Trim(),
                    UserId = string.IsNullOrWhiteSpace(ownerId) ? "SYSTEM" : ownerId,
                    ReferenceNo = referenceNo
                });

                if (!smsResponse.IsSuccess)
                {
                    var smsErrors = string.Join(" | ", smsResponse.Errors.Select(error => $"{error.Code}:{error.Message}"));
                    _logger.AppendLine($"Owner pricing SMS notification failed for MessageId={message.MessageId}. Errors={smsErrors}");
                }
            }

            if (!string.IsNullOrWhiteSpace(whatsappText))
            {
                var whatsappResponse = await _notificationService.SendWhatsAppAsync(new WhatsAppDispatchRequest
                {
                    MobileNumber = mobile,
                    Message = whatsappText.Trim()
                });

                if (!whatsappResponse.IsSuccess)
                {
                    var whatsappErrors = string.Join(" | ", whatsappResponse.Errors.Select(error => $"{error.Code}:{error.Message}"));
                    _logger.AppendLine($"Owner pricing WhatsApp notification failed for MessageId={message.MessageId}. Errors={whatsappErrors}");
                }
            }
        }

        private static void ApplyPricingSnapshotFields(List<TkmendField>? fields, SummerPricingQuoteDto quote)
        {
            if (fields == null || quote == null)
            {
                return;
            }

            var waveDateValue = string.Empty;
            if (SummerCalendarRules.TryParseWaveLabelDateUtc(quote.WaveLabel, out var waveStartUtc))
            {
                waveDateValue = waveStartUtc.ToString("o");
            }

            var snapshot = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                [SummerWorkflowDomainConstants.PricingFieldKinds.ConfigId] = quote.PricingConfigId,
                [SummerWorkflowDomainConstants.PricingFieldKinds.PolicyId] = quote.PricingConfigId,
                [SummerWorkflowDomainConstants.PricingFieldKinds.PricingMode] = quote.PricingMode,
                [SummerWorkflowDomainConstants.PricingFieldKinds.MembershipType] = quote.MembershipType,
                [SummerWorkflowDomainConstants.PricingFieldKinds.TransportationMandatory] = quote.TransportationMandatory ? "true" : "false",
                [SummerWorkflowDomainConstants.PricingFieldKinds.SelectedStayMode] = quote.NormalizedStayMode,
                [SummerWorkflowDomainConstants.PricingFieldKinds.PersonsCount] = quote.PersonsCount.ToString(CultureInfo.InvariantCulture),
                [SummerWorkflowDomainConstants.PricingFieldKinds.PeriodKey] = quote.PeriodKey,
                [SummerWorkflowDomainConstants.PricingFieldKinds.WaveDate] = waveDateValue,
                [SummerWorkflowDomainConstants.PricingFieldKinds.AccommodationPricePerPerson] = FormatDecimalValue(quote.AccommodationPricePerPerson),
                [SummerWorkflowDomainConstants.PricingFieldKinds.TransportationPricePerPerson] = FormatDecimalValue(quote.TransportationPricePerPerson),
                [SummerWorkflowDomainConstants.PricingFieldKinds.AccommodationTotal] = FormatDecimalValue(quote.AccommodationTotal),
                [SummerWorkflowDomainConstants.PricingFieldKinds.TransportationTotal] = FormatDecimalValue(quote.TransportationTotal),
                [SummerWorkflowDomainConstants.PricingFieldKinds.InsuranceAmount] = FormatDecimalValue(quote.InsuranceAmount),
                [SummerWorkflowDomainConstants.PricingFieldKinds.ProxyInsuranceAmount] = quote.ProxyInsuranceAmount.HasValue
                    ? FormatDecimalValue(quote.ProxyInsuranceAmount.Value)
                    : string.Empty,
                [SummerWorkflowDomainConstants.PricingFieldKinds.AppliedInsuranceAmount] = FormatDecimalValue(quote.AppliedInsuranceAmount),
                [SummerWorkflowDomainConstants.PricingFieldKinds.GrandTotal] = FormatDecimalValue(quote.GrandTotal),
                [SummerWorkflowDomainConstants.PricingFieldKinds.DisplayText] = quote.DisplayText,
                [SummerWorkflowDomainConstants.PricingFieldKinds.SmsText] = quote.SmsText,
                [SummerWorkflowDomainConstants.PricingFieldKinds.WhatsAppText] = quote.WhatsAppText
            };

            foreach (var item in snapshot)
            {
                UpsertRequestField(fields, item.Key, item.Value);
            }
        }

        private static void ApplyPricingMessageIdentity(SummerPricingQuoteDto quote, int messageId, string? requestRef)
        {
            if (quote == null)
            {
                return;
            }

            var bookingNumber = string.IsNullOrWhiteSpace(requestRef)
                ? $"SUMMER-{messageId}"
                : requestRef.Trim();
            var referenceNumber = messageId > 0
                ? messageId.ToString(CultureInfo.InvariantCulture)
                : bookingNumber;

            quote.DisplayText = ReplacePricingMessageTokens(quote.DisplayText, bookingNumber, referenceNumber);
            quote.SmsText = ReplacePricingMessageTokens(quote.SmsText, bookingNumber, referenceNumber);
            quote.WhatsAppText = ReplacePricingMessageTokens(quote.WhatsAppText, bookingNumber, referenceNumber);
        }

        private static string ReplacePricingMessageTokens(string? template, string bookingNumber, string referenceNumber)
        {
            var text = (template ?? string.Empty).Trim();
            if (text.Length == 0)
            {
                return string.Empty;
            }

            return text
                .Replace("{bookingNumber}", bookingNumber, StringComparison.Ordinal)
                .Replace("{referenceNumber}", referenceNumber, StringComparison.Ordinal);
        }

        private static string FormatDecimalValue(decimal value)
        {
            return value % 1m == 0m
                ? decimal.Truncate(value).ToString("0", CultureInfo.InvariantCulture)
                : value.ToString("0.##", CultureInfo.InvariantCulture);
        }

        private static string? GetFieldValue(IEnumerable<TkmendField>? fields, string fieldKind)
        {
            return fields?
                .FirstOrDefault(x => string.Equals(x.FildKind, fieldKind, StringComparison.OrdinalIgnoreCase))?
                .FildTxt?
                .Trim();
        }

        private static string GetFirstFieldValue(IEnumerable<TkmendField>? fields, IEnumerable<string> fieldKinds)
        {
            if (fields == null || fieldKinds == null)
            {
                return string.Empty;
            }

            foreach (var fieldKind in fieldKinds)
            {
                if (string.IsNullOrWhiteSpace(fieldKind))
                {
                    continue;
                }

                var value = GetFieldValue(fields, fieldKind.Trim());
                if (!string.IsNullOrWhiteSpace(value))
                {
                    return value;
                }
            }

            return string.Empty;
        }

        private static bool ParseBoolean(string? value)
        {
            var normalized = (value ?? string.Empty).Trim();
            if (normalized.Length == 0)
            {
                return false;
            }

            return normalized.Equals("true", StringComparison.OrdinalIgnoreCase)
                || normalized.Equals("1", StringComparison.OrdinalIgnoreCase)
                || normalized.Equals("yes", StringComparison.OrdinalIgnoreCase)
                || normalized.Equals("y", StringComparison.OrdinalIgnoreCase)
                || normalized.Equals("نعم", StringComparison.OrdinalIgnoreCase);
        }

        private static int ParseInt(string? value, int fallback = 0)
        {
            return int.TryParse((value ?? string.Empty).Trim(), out var parsed) ? parsed : fallback;
        }

        private static decimal ParseDecimal(string? value, decimal fallback = 0m)
        {
            var normalized = (value ?? string.Empty).Trim();
            if (normalized.Length == 0)
            {
                return fallback;
            }

            if (decimal.TryParse(normalized, NumberStyles.Number, CultureInfo.InvariantCulture, out var invariantParsed))
            {
                return invariantParsed;
            }

            if (decimal.TryParse(normalized, NumberStyles.Number, new CultureInfo("ar-EG"), out var arabicParsed))
            {
                return arabicParsed;
            }

            return fallback;
        }

        private async Task<Dictionary<string, string>> LoadExistingSummerPaymentPlanSnapshotAsync(int messageId)
        {
            if (messageId <= 0)
            {
                return new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            }

            var fieldKinds = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            fieldKinds.UnionWith(SummerWorkflowDomainConstants.PaymentModeFieldKinds);
            fieldKinds.UnionWith(SummerWorkflowDomainConstants.InstallmentCountFieldKinds);
            fieldKinds.UnionWith(SummerWorkflowDomainConstants.InstallmentsTotalFieldKinds);
            for (var installmentNo = 1; installmentNo <= SummerWorkflowDomainConstants.PaymentModes.MaxInstallmentCount; installmentNo++)
            {
                fieldKinds.UnionWith(SummerWorkflowDomainConstants.GetInstallmentAmountFieldKinds(installmentNo));
                fieldKinds.UnionWith(SummerWorkflowDomainConstants.GetInstallmentPaidFieldKinds(installmentNo));
                fieldKinds.UnionWith(SummerWorkflowDomainConstants.GetInstallmentPaidAtFieldKinds(installmentNo));
            }

            var rows = await _connectContext.TkmendFields
                .AsNoTracking()
                .Where(field =>
                    field.FildRelted == messageId
                    && fieldKinds.Contains(field.FildKind ?? string.Empty))
                .Select(field => new
                {
                    Key = (field.FildKind ?? string.Empty).Trim(),
                    Value = (field.FildTxt ?? string.Empty).Trim()
                })
                .ToListAsync();

            var snapshot = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            foreach (var row in rows)
            {
                if (row.Key.Length == 0 || snapshot.ContainsKey(row.Key))
                {
                    continue;
                }

                snapshot[row.Key] = row.Value;
            }

            return snapshot;
        }

        private static bool ApplySummerPaymentPlanFields(
            List<TkmendField>? fields,
            decimal grandTotal,
            bool hasSummerGeneralManagerPermission,
            bool isEditOperation,
            Dictionary<string, string>? existingSnapshot,
            CommonResponse<MessageDto> response)
        {
            if (response == null)
            {
                return false;
            }

            if (fields == null)
            {
                response.Errors.Add(new Error
                {
                    Code = "400",
                    Message = "بيانات السداد غير متاحة."
                });
                return false;
            }

            var normalizedGrandTotal = NormalizeMoney(grandTotal);
            var incomingPaymentModeRaw = GetFirstFieldValue(fields, SummerWorkflowDomainConstants.PaymentModeFieldKinds);
            var incomingPaymentMode = NormalizePaymentModeToken(incomingPaymentModeRaw);

            var resolvedPaymentMode = incomingPaymentMode;
            if (!hasSummerGeneralManagerPermission
                && isEditOperation
                && existingSnapshot != null
                && existingSnapshot.Count > 0
                && string.IsNullOrWhiteSpace(incomingPaymentModeRaw))
            {
                resolvedPaymentMode = NormalizePaymentModeToken(
                    GetFirstSnapshotValue(existingSnapshot, SummerWorkflowDomainConstants.PaymentModeFieldKinds));
            }

            UpsertRequestFieldRange(
                fields,
                SummerWorkflowDomainConstants.PaymentModeFieldKinds,
                resolvedPaymentMode);

            if (!string.Equals(
                    resolvedPaymentMode,
                    SummerWorkflowDomainConstants.PaymentModes.Installment,
                    StringComparison.OrdinalIgnoreCase))
            {
                UpsertRequestFieldRange(fields, SummerWorkflowDomainConstants.InstallmentCountFieldKinds, "0");
                UpsertRequestFieldRange(fields, SummerWorkflowDomainConstants.InstallmentsTotalFieldKinds, "0");
                for (var installmentNo = 1; installmentNo <= SummerWorkflowDomainConstants.PaymentModes.MaxInstallmentCount; installmentNo++)
                {
                    UpsertRequestFieldRange(
                        fields,
                        SummerWorkflowDomainConstants.GetInstallmentAmountFieldKinds(installmentNo),
                        "0");
                    UpsertRequestFieldRange(
                        fields,
                        SummerWorkflowDomainConstants.GetInstallmentPaidFieldKinds(installmentNo),
                        "false");
                    UpsertRequestFieldRange(
                        fields,
                        SummerWorkflowDomainConstants.GetInstallmentPaidAtFieldKinds(installmentNo),
                        string.Empty);
                }

                return true;
            }

            var maxInstallmentCount = SummerWorkflowDomainConstants.PaymentModes.MaxInstallmentCount;
            var defaultInstallmentCount = SummerWorkflowDomainConstants.PaymentModes.DefaultInstallmentCount;
            var minInstallmentCount = SummerWorkflowDomainConstants.PaymentModes.MinInstallmentCount;
            var hasExistingSnapshot = existingSnapshot != null && existingSnapshot.Count > 0;

            var incomingInstallmentCountRaw = GetFirstFieldValue(fields, SummerWorkflowDomainConstants.InstallmentCountFieldKinds);
            if (!TryResolveInstallmentCount(
                    incomingInstallmentCountRaw,
                    defaultInstallmentCount,
                    response,
                    out var incomingInstallmentCount))
            {
                return false;
            }

            var existingInstallmentCount = defaultInstallmentCount;
            if (hasExistingSnapshot
                && !TryResolveInstallmentCount(
                    GetFirstSnapshotValue(existingSnapshot, SummerWorkflowDomainConstants.InstallmentCountFieldKinds),
                    defaultInstallmentCount,
                    response,
                    out existingInstallmentCount))
            {
                return false;
            }

            var resolvedInstallmentCount = incomingInstallmentCount;
            if (!hasSummerGeneralManagerPermission
                && isEditOperation
                && hasExistingSnapshot)
            {
                resolvedInstallmentCount = string.IsNullOrWhiteSpace(incomingInstallmentCountRaw)
                    ? existingInstallmentCount
                    : incomingInstallmentCount;
            }

            if (resolvedInstallmentCount < minInstallmentCount || resolvedInstallmentCount > maxInstallmentCount)
            {
                response.Errors.Add(new Error
                {
                    Code = "400",
                    Message = $"عدد الأقساط يجب أن يكون بين {minInstallmentCount} و {maxInstallmentCount}."
                });
                return false;
            }

            var defaultInstallments = BuildEqualInstallments(normalizedGrandTotal, resolvedInstallmentCount);
            var resolvedInstallments = new decimal[resolvedInstallmentCount];
            var resolvedPaid = new bool[resolvedInstallmentCount];
            var resolvedPaidAt = new string[resolvedInstallmentCount];
            var canPreserveExistingInstallments = !hasSummerGeneralManagerPermission
                && isEditOperation
                && hasExistingSnapshot
                && resolvedInstallmentCount == existingInstallmentCount;

            for (var index = 0; index < resolvedInstallmentCount; index++)
            {
                var installmentNo = index + 1;
                var amountFieldKinds = SummerWorkflowDomainConstants.GetInstallmentAmountFieldKinds(installmentNo);
                var paidFieldKinds = SummerWorkflowDomainConstants.GetInstallmentPaidFieldKinds(installmentNo);
                var paidAtFieldKinds = SummerWorkflowDomainConstants.GetInstallmentPaidAtFieldKinds(installmentNo);

                decimal amount;
                bool isPaid;
                string paidAtValue;

                if (hasSummerGeneralManagerPermission)
                {
                    amount = NormalizeMoney(ParseDecimal(GetFirstFieldValue(fields, amountFieldKinds), defaultInstallments[index]));
                    isPaid = ParseBoolean(GetFirstFieldValue(fields, paidFieldKinds));
                    paidAtValue = NormalizeUtcValue(GetFirstFieldValue(fields, paidAtFieldKinds), response, installmentNo);
                    if (response.Errors.Count > 0)
                    {
                        return false;
                    }
                }
                else if (canPreserveExistingInstallments)
                {
                    amount = NormalizeMoney(ParseDecimal(GetFirstSnapshotValue(existingSnapshot, amountFieldKinds), defaultInstallments[index]));
                    isPaid = ParseBoolean(GetFirstSnapshotValue(existingSnapshot, paidFieldKinds));
                    paidAtValue = NormalizeSnapshotUtcValue(GetFirstSnapshotValue(existingSnapshot, paidAtFieldKinds));
                }
                else
                {
                    amount = defaultInstallments[index];
                    isPaid = false;
                    paidAtValue = string.Empty;
                }

                resolvedInstallments[index] = amount;
                resolvedPaid[index] = isPaid && amount > 0m;
                resolvedPaidAt[index] = resolvedPaid[index] ? paidAtValue : string.Empty;
            }

            var installmentsTotal = NormalizeMoney(resolvedInstallments.Sum());
            if (installmentsTotal > normalizedGrandTotal)
            {
                if (!hasSummerGeneralManagerPermission)
                {
                    var normalizedDefaults = BuildEqualInstallments(normalizedGrandTotal, resolvedInstallmentCount);
                    for (var index = 0; index < resolvedInstallmentCount; index++)
                    {
                        resolvedInstallments[index] = normalizedDefaults[index];
                        resolvedPaid[index] = false;
                        resolvedPaidAt[index] = string.Empty;
                    }
                    installmentsTotal = NormalizeMoney(resolvedInstallments.Sum());
                }
                else
                {
                    response.Errors.Add(new Error
                    {
                        Code = "400",
                        Message = $"إجمالي الأقساط ({FormatDecimalValue(installmentsTotal)}) لا يجب أن يتجاوز إجمالي الحجز ({FormatDecimalValue(normalizedGrandTotal)})."
                    });
                    return false;
                }
            }

            UpsertRequestFieldRange(
                fields,
                SummerWorkflowDomainConstants.InstallmentCountFieldKinds,
                resolvedInstallmentCount.ToString(CultureInfo.InvariantCulture));
            UpsertRequestFieldRange(
                fields,
                SummerWorkflowDomainConstants.InstallmentsTotalFieldKinds,
                FormatDecimalValue(installmentsTotal));

            for (var installmentNo = 1; installmentNo <= maxInstallmentCount; installmentNo++)
            {
                var index = installmentNo - 1;
                var isActiveInstallment = installmentNo <= resolvedInstallmentCount;
                var amountValue = isActiveInstallment ? FormatDecimalValue(resolvedInstallments[index]) : "0";
                var isPaidValue = isActiveInstallment && resolvedPaid[index] ? "true" : "false";
                var paidAtValue = isActiveInstallment ? resolvedPaidAt[index] : string.Empty;

                UpsertRequestFieldRange(
                    fields,
                    SummerWorkflowDomainConstants.GetInstallmentAmountFieldKinds(installmentNo),
                    amountValue);
                UpsertRequestFieldRange(
                    fields,
                    SummerWorkflowDomainConstants.GetInstallmentPaidFieldKinds(installmentNo),
                    isPaidValue);
                UpsertRequestFieldRange(
                    fields,
                    SummerWorkflowDomainConstants.GetInstallmentPaidAtFieldKinds(installmentNo),
                    paidAtValue);
            }

            return true;
        }

        private static string NormalizePaymentModeToken(string? value)
        {
            var token = (value ?? string.Empty).Trim().ToUpperInvariant();
            return token == SummerWorkflowDomainConstants.PaymentModes.Installment
                ? SummerWorkflowDomainConstants.PaymentModes.Installment
                : SummerWorkflowDomainConstants.PaymentModes.Cash;
        }

        private static bool TryResolveInstallmentCount(
            string? value,
            int fallback,
            CommonResponse<MessageDto> response,
            out int installmentCount)
        {
            installmentCount = fallback;
            var minCount = SummerWorkflowDomainConstants.PaymentModes.MinInstallmentCount;
            var maxCount = SummerWorkflowDomainConstants.PaymentModes.MaxInstallmentCount;
            var normalized = (value ?? string.Empty).Trim();

            if (normalized.Length == 0)
            {
                installmentCount = Math.Clamp(fallback, minCount, maxCount);
                return true;
            }

            if (!int.TryParse(normalized, NumberStyles.Integer, CultureInfo.InvariantCulture, out var parsed))
            {
                response.Errors.Add(new Error
                {
                    Code = "400",
                    Message = "عدد الأقساط غير صالح."
                });
                installmentCount = Math.Clamp(fallback, minCount, maxCount);
                return false;
            }

            if (parsed < minCount || parsed > maxCount)
            {
                response.Errors.Add(new Error
                {
                    Code = "400",
                    Message = $"عدد الأقساط يجب أن يكون بين {minCount} و {maxCount}."
                });
                installmentCount = Math.Clamp(fallback, minCount, maxCount);
                return false;
            }

            installmentCount = parsed;
            return true;
        }

        private static decimal NormalizeMoney(decimal value)
        {
            if (value <= 0m)
            {
                return 0m;
            }

            return Math.Round(value, 2, MidpointRounding.AwayFromZero);
        }

        private static decimal[] BuildEqualInstallments(decimal totalAmount, int installmentCount)
        {
            var count = installmentCount > 0 ? installmentCount : 1;
            var normalizedTotal = NormalizeMoney(totalAmount);
            var totalCents = decimal.ToInt64(normalizedTotal * 100m);
            var baseCents = totalCents / count;
            var remainder = totalCents % count;

            var values = new decimal[count];
            for (var index = 0; index < count; index++)
            {
                var cents = baseCents + (index < remainder ? 1 : 0);
                values[index] = cents / 100m;
            }

            return values;
        }

        private static string GetFirstSnapshotValue(
            IReadOnlyDictionary<string, string>? snapshot,
            IEnumerable<string> fieldKinds)
        {
            if (snapshot == null || snapshot.Count == 0 || fieldKinds == null)
            {
                return string.Empty;
            }

            foreach (var fieldKind in fieldKinds)
            {
                var key = (fieldKind ?? string.Empty).Trim();
                if (key.Length == 0)
                {
                    continue;
                }

                if (snapshot.TryGetValue(key, out var value)
                    && !string.IsNullOrWhiteSpace(value))
                {
                    return value.Trim();
                }
            }

            return string.Empty;
        }

        private static string NormalizeSnapshotUtcValue(string? value)
        {
            var normalized = (value ?? string.Empty).Trim();
            if (normalized.Length == 0)
            {
                return string.Empty;
            }

            return DateTimeOffset.TryParse(normalized, out var parsed)
                ? parsed.UtcDateTime.ToString("o")
                : string.Empty;
        }

        private static string NormalizeUtcValue(string? value, CommonResponse<MessageDto> response, int installmentNo)
        {
            var normalized = (value ?? string.Empty).Trim();
            if (normalized.Length == 0)
            {
                return string.Empty;
            }

            if (!DateTimeOffset.TryParse(normalized, out var parsed))
            {
                response.Errors.Add(new Error
                {
                    Code = "400",
                    Message = $"تاريخ سداد القسط رقم {installmentNo} غير صالح."
                });
                return string.Empty;
            }

            return parsed.UtcDateTime.ToString("o");
        }

        private static bool ValidateSummerExtraMembersRules(
            int categoryId,
            string? destinationName,
            int familyCount,
            int extraCount,
            bool hasSummerAdminPermission,
            bool hasAdminEditOverride,
            CommonResponse<MessageDto> response)
        {
            if (!TryResolveSummerMaxExtraMembers(categoryId, out var maxExtraMembers))
            {
                return true;
            }

            if (hasAdminEditOverride)
            {
                return true;
            }

            var normalizedDestinationName = string.IsNullOrWhiteSpace(destinationName)
                ? $"المصيف رقم {categoryId}"
                : destinationName.Trim();
            var maxFamilyCount = ResolveSummerMaxFamilyCount(categoryId);
            var isAdminExceedingDestinationLimit = hasSummerAdminPermission && extraCount > maxExtraMembers;

            if (maxFamilyCount > 0
                && familyCount != maxFamilyCount
                && extraCount > 0
                && !isAdminExceedingDestinationLimit)
            {
                response.Errors.Add(new Error
                {
                    Code = "400",
                    Message = $"الأفراد الإضافيون متاحون فقط عند اختيار السعة القصوى ({maxFamilyCount})."
                });
                return false;
            }

            if (!hasSummerAdminPermission && extraCount > maxExtraMembers)
            {
                response.Errors.Add(new Error
                {
                    Code = "400",
                    Message = $"الحد الأقصى للأفراد الإضافيين في {normalizedDestinationName} هو {maxExtraMembers}."
                });
                return false;
            }

            return true;
        }

        private static bool TryResolveSummerMaxExtraMembers(int categoryId, out int maxExtraMembers)
        {
            if (SummerMaxExtraMembersRules.TryGetValue(categoryId, out var configuredMaxExtra))
            {
                maxExtraMembers = Math.Max(0, configuredMaxExtra);
                return true;
            }

            maxExtraMembers = 0;
            return false;
        }

        private static int ResolveSummerMaxFamilyCount(int categoryId)
        {
            if (!SummerCapacityRules.TryGetValue(categoryId, out var capacityByFamily)
                || capacityByFamily == null
                || capacityByFamily.Count == 0)
            {
                return 0;
            }

            return capacityByFamily.Keys.Max();
        }

        private static bool CanCreateSummerRequestForDestination(
            int categoryId,
            string? categoryName,
            bool hasSummerAdminPermission)
        {
            if (!IsSummerDestinationRestrictedToSummerAdmin(categoryId, categoryName))
            {
                return true;
            }

            return hasSummerAdminPermission;
        }

        private static bool IsSummerDestinationRestrictedToSummerAdmin(int categoryId, string? categoryName)
        {
            if (categoryId == SummerWorkflowDomainConstants.DestinationCategoryIds.Matrouh
                || categoryId == SummerWorkflowDomainConstants.DestinationCategoryIds.RasElBar)
            {
                return true;
            }

            if (categoryId == SummerWorkflowDomainConstants.DestinationCategoryIds.PortFouad)
            {
                return false;
            }

            var normalizedName = NormalizeArabicLookup(categoryName);
            if (normalizedName.Contains("مرسي مطروح", StringComparison.Ordinal))
            {
                return true;
            }

            if (normalizedName.Contains("راس البر", StringComparison.Ordinal))
            {
                return true;
            }

            if (normalizedName.Contains("بور فواد", StringComparison.Ordinal))
            {
                return false;
            }

            return false;
        }

        private static string NormalizeArabicLookup(string? value)
        {
            return (value ?? string.Empty)
                .Trim()
                .Replace("أ", "ا", StringComparison.Ordinal)
                .Replace("إ", "ا", StringComparison.Ordinal)
                .Replace("آ", "ا", StringComparison.Ordinal)
                .Replace("ى", "ي", StringComparison.Ordinal)
                .Replace("ؤ", "و", StringComparison.Ordinal)
                .Replace("ئ", "ي", StringComparison.Ordinal)
                .ToLowerInvariant();
        }

        private async Task<bool> CanUserManageSummerCategoryAsync(string userId, int categoryId)
        {
            var normalizedUserId = (userId ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(normalizedUserId) || categoryId <= 0)
            {
                return false;
            }

            var userUnitIds = await GetActiveUserUnitIdsAsync(normalizedUserId);
            if (userUnitIds.Count == 0)
            {
                return false;
            }

            var categoryProjection = await _connectContext.Cdcategories
                .AsNoTracking()
                .Where(category => category.CatId == categoryId)
                .Select(category => new { category.CatId, category.CatParent, category.Stockholder })
                .FirstOrDefaultAsync();
            if (categoryProjection == null)
            {
                return false;
            }

            var allowedUnitIds = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            if (categoryProjection.Stockholder.HasValue)
            {
                allowedUnitIds.Add(categoryProjection.Stockholder.Value.ToString());
            }

            if (categoryProjection.CatParent > 0)
            {
                var parentStockholder = await _connectContext.Cdcategories
                    .AsNoTracking()
                    .Where(parent => parent.CatId == categoryProjection.CatParent)
                    .Select(parent => parent.Stockholder)
                    .FirstOrDefaultAsync();
                if (parentStockholder.HasValue)
                {
                    allowedUnitIds.Add(parentStockholder.Value.ToString());
                }
            }

            if (allowedUnitIds.Count == 0)
            {
                return false;
            }

            return userUnitIds.Any(unitId => allowedUnitIds.Contains(unitId));
        }

        private async Task<bool> CanUserEditExistingSummerMessageAsync(string userId, Message existingMessage)
        {
            if (existingMessage == null)
            {
                return false;
            }

            var normalizedUserId = (userId ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(normalizedUserId))
            {
                return false;
            }

            if (string.Equals(
                    (existingMessage.CreatedBy ?? string.Empty).Trim(),
                    normalizedUserId,
                    StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }

            if (await CanUserManageSummerCategoryAsync(normalizedUserId, existingMessage.CategoryCd))
            {
                return true;
            }

            var ownerEmployeeId = await _connectContext.TkmendFields
                .AsNoTracking()
                .Where(field =>
                    field.FildRelted == existingMessage.MessageId
                    && SummerWorkflowDomainConstants.EmployeeIdFieldKinds.Contains(field.FildKind))
                .Select(field => field.FildTxt)
                .FirstOrDefaultAsync();

            return string.Equals(
                (ownerEmployeeId ?? string.Empty).Trim(),
                normalizedUserId,
                StringComparison.OrdinalIgnoreCase);
        }

        private async Task RevokeSummerEditTokensAsync(int messageId, string revokedBy)
        {
            if (messageId <= 0)
            {
                return;
            }

            var normalizedRevokedBy = (revokedBy ?? string.Empty).Trim();
            var now = DateTime.UtcNow;
            var activeTokens = await _connectContext.RequestTokens
                .Where(tokenRow =>
                    tokenRow.MessageId == messageId
                    && tokenRow.TokenPurpose == SummerWorkflowDomainConstants.RequestTokenPurposes.SummerEdit
                    && tokenRow.RevokedAt == null
                    && (!tokenRow.ExpiresAt.HasValue || tokenRow.ExpiresAt > now)
                    && (!tokenRow.IsOneTimeUse || !tokenRow.IsUsed))
                .ToListAsync();

            if (activeTokens.Count == 0)
            {
                return;
            }

            foreach (var tokenRow in activeTokens)
            {
                tokenRow.RevokedAt = now;
                tokenRow.RevokedBy = normalizedRevokedBy.Length == 0 ? "SYSTEM" : normalizedRevokedBy;
            }
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

        private static bool ValidateAndNormalizeCompanionNames(List<TkmendField>? fields, CommonResponse<MessageDto> response)
        {
            if (fields == null || fields.Count == 0)
            {
                return true;
            }

            var invalidCompanionFound = false;

            foreach (var field in fields.Where(field => field != null && SummerCompanionNamePolicy.IsCompanionNameFieldKind(field.FildKind)))
            {
                var normalizedName = SummerCompanionNamePolicy.NormalizeCompanionName(field.FildTxt);
                field.FildTxt = normalizedName;

                if (string.IsNullOrWhiteSpace(normalizedName))
                {
                    continue;
                }

                if (!SummerCompanionNamePolicy.HasMinimumNameParts(normalizedName))
                {
                    invalidCompanionFound = true;
                    break;
                }
            }

            if (!invalidCompanionFound)
            {
                return true;
            }

            response.Errors.Add(new Error
            {
                Code = "400",
                Message = "يجب إدخال اسم المرافق ثلاثي على الأقل."
            });
            return false;
        }

        private static string GetSummerSequenceName(int categoryId)
        {
            return categoryId switch
            {
                147 => "Seq_Summer_M",
                148 => "Seq_Summer_R",
                149 => "Seq_Summer_B",
                _ => "Seq_Summer_M"
            };
        }

        private static string BuildSummerRequestReference(int categoryId, int seasonYear, int sequenceValue)
        {
            var resortCode = categoryId switch
            {
                147 => "M",
                148 => "R",
                149 => "B",
                _ => "S"
            };
            return $"Summer{seasonYear}-{resortCode}-{sequenceValue}";
        }

        private static void UpsertRequestField(List<TkmendField>? fields, string kind, string value)
        {
            if (fields == null)
            {
                return;
            }

            var existing = fields.FirstOrDefault(f => string.Equals(f.FildKind, kind, StringComparison.OrdinalIgnoreCase));
            if (existing == null)
            {
                fields.Add(new TkmendField
                {
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

        private static void UpsertRequestFieldRange(List<TkmendField>? fields, IEnumerable<string> kinds, string value)
        {
            if (fields == null || kinds == null)
            {
                return;
            }

            foreach (var kind in kinds)
            {
                if (string.IsNullOrWhiteSpace(kind))
                {
                    continue;
                }

                UpsertRequestField(fields, kind.Trim(), value);
            }
        }

        private async Task<List<SummerFieldAuditEntry>> ReplaceMessageFieldsAsync(
            int messageId,
            List<TkmendField>? incomingFields,
            int? categoryId = null,
            string? changedBy = null)
        {
            var existingFields = await _connectContext.TkmendFields
                .Where(x => x.FildRelted == messageId)
                .ToListAsync();

            var nextFields = (incomingFields ?? new List<TkmendField>())
                .Where(x => !string.IsNullOrWhiteSpace(x.FildKind))
                .Select(x => new TkmendField
                {
                    FildSql = 0,
                    FildRelted = messageId,
                    FildKind = x.FildKind?.Trim(),
                    FildTxt = string.IsNullOrWhiteSpace(x.FildTxt) ? x.FildTxt : x.FildTxt.Trim(),
                    InstanceGroupId = x.InstanceGroupId.HasValue && x.InstanceGroupId.Value > 0
                        ? x.InstanceGroupId
                        : 1
                })
                .ToList();

            var dateFieldKinds = await _connectContext.Cdmends
                .AsNoTracking()
                .Where(x => x.CdmendType != null
                    && x.CdmendTxt != null
                    && x.CdmendType.ToLower() == "date")
                .Select(x => x.CdmendTxt!.Trim())
                .Distinct()
                .ToListAsync();

            var dateFieldKindSet = new HashSet<string>(dateFieldKinds, StringComparer.OrdinalIgnoreCase);
            if (dateFieldKindSet.Count > 0)
            {
                nextFields.ForEach(field =>
                {
                    if (ShouldNormalizeToShortDate(field.FildKind, field.FildTxt, dateFieldKindSet))
                    {
                        field.FildTxt = helperService.NormalizeToShortDate(field.FildTxt);
                    }
                });
            }

            var nextKeys = new HashSet<string>(
                nextFields.Select(BuildFieldInstanceKey),
                StringComparer.OrdinalIgnoreCase);

            var preservedSystemFields = existingFields
                .Where(field => IsSystemManagedSummerField(field.FildKind) && !nextKeys.Contains(BuildFieldInstanceKey(field)))
                .Select(field => new TkmendField
                {
                    FildSql = 0,
                    FildRelted = messageId,
                    FildKind = field.FildKind,
                    FildTxt = field.FildTxt,
                    InstanceGroupId = field.InstanceGroupId ?? 1
                })
                .ToList();

            var mergedFields = nextFields
                .Concat(preservedSystemFields)
                .GroupBy(BuildFieldInstanceKey, StringComparer.OrdinalIgnoreCase)
                .Select(group => group.First())
                .ToList();

            var auditEntries = await LogSummerFieldDeltaAsync(
                messageId,
                categoryId,
                changedBy,
                existingFields,
                mergedFields);

            if (existingFields.Count > 0)
            {
                _connectContext.TkmendFields.RemoveRange(existingFields);
            }

            if (mergedFields.Count > 0)
            {
                await _connectContext.TkmendFields.AddRangeAsync(mergedFields);
            }

            return auditEntries;
        }

        private async Task<List<SummerFieldAuditEntry>> LogSummerFieldDeltaAsync(
            int messageId,
            int? categoryId,
            string? changedBy,
            IReadOnlyCollection<TkmendField> existingFields,
            IReadOnlyCollection<TkmendField> mergedFields)
        {
            var auditEntries = new List<SummerFieldAuditEntry>();
            if (messageId <= 0)
            {
                return auditEntries;
            }

            var existingByKey = existingFields
                .Where(field => field != null && IsAuditableSummerField(field.FildKind))
                .GroupBy(BuildFieldInstanceKey, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(group => group.Key, group => group.First(), StringComparer.OrdinalIgnoreCase);
            var mergedByKey = mergedFields
                .Where(field => field != null && IsAuditableSummerField(field.FildKind))
                .GroupBy(BuildFieldInstanceKey, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(group => group.Key, group => group.First(), StringComparer.OrdinalIgnoreCase);

            var allKeys = new HashSet<string>(existingByKey.Keys, StringComparer.OrdinalIgnoreCase);
            allKeys.UnionWith(mergedByKey.Keys);
            if (allKeys.Count == 0)
            {
                return auditEntries;
            }

            Dictionary<string, SummerFieldAuditMetadata> metadataByFieldKind;
            if (categoryId.HasValue && categoryId.Value > 0)
            {
                metadataByFieldKind = await BuildSummerFieldMetadataByKindAsync(categoryId.Value);
            }
            else
            {
                metadataByFieldKind = new Dictionary<string, SummerFieldAuditMetadata>(StringComparer.OrdinalIgnoreCase);
            }

            var normalizedActor = TruncateAuditValue(NormalizeAuditText(changedBy) ?? "SYSTEM", 20);

            foreach (var key in allKeys.OrderBy(item => item, StringComparer.OrdinalIgnoreCase))
            {
                existingByKey.TryGetValue(key, out var oldField);
                mergedByKey.TryGetValue(key, out var newField);

                var oldValue = NormalizeAuditText(oldField?.FildTxt);
                var newValue = NormalizeAuditText(newField?.FildTxt);

                if (oldField != null
                    && newField != null
                    && string.Equals(oldValue, newValue, StringComparison.Ordinal))
                {
                    continue;
                }

                var fieldKind = NormalizeAuditText(newField?.FildKind)
                    ?? NormalizeAuditText(oldField?.FildKind);
                if (string.IsNullOrWhiteSpace(fieldKind))
                {
                    continue;
                }

                metadataByFieldKind.TryGetValue(fieldKind, out var metadata);
                var groupName = metadata?.GroupName ?? "بدون مجموعة";
                var fieldName = metadata?.FieldLabel ?? fieldKind;
                var operation = GetAuditOperationArabic(oldField, newField);
                var instanceGroupId = newField?.InstanceGroupId ?? oldField?.InstanceGroupId ?? 1;
                var beforeValue = FormatAuditValue(oldValue);
                var afterValue = FormatAuditValue(newValue);

                auditEntries.Add(new SummerFieldAuditEntry
                {
                    Operation = operation,
                    GroupName = groupName,
                    FieldName = fieldName,
                    FieldKey = fieldKind,
                    InstanceGroupId = instanceGroupId,
                    BeforeValue = beforeValue,
                    AfterValue = afterValue
                });

                _logger.AppendLine(
                    $"SummerRequests FieldAudit | MessageId={messageId} | Operation={operation} | Group={groupName} | Field={fieldName} | FieldKey={fieldKind} | InstanceGroupId={instanceGroupId} | Before={beforeValue} | After={afterValue} | ChangedBy={normalizedActor}");
            }

            return auditEntries;
        }

        private async Task<Dictionary<string, SummerFieldAuditMetadata>> BuildSummerFieldMetadataByKindAsync(int categoryId)
        {
            var rows = await (
                from categoryMand in _connectContext.CdCategoryMands.AsNoTracking()
                join mend in _connectContext.Cdmends.AsNoTracking()
                    on categoryMand.MendField equals mend.CdmendTxt into mendJoin
                from mend in mendJoin.DefaultIfEmpty()
                join mandGroup in _connectContext.MandGroups.AsNoTracking()
                    on categoryMand.MendGroup equals mandGroup.GroupId into mandGroupJoin
                from mandGroup in mandGroupJoin.DefaultIfEmpty()
                where categoryMand.MendCategory == categoryId
                select new
                {
                    categoryMand.MendField,
                    GroupName = mandGroup != null ? mandGroup.GroupName : null,
                    FieldLabel = mend != null ? mend.CDMendLbl : null
                }).ToListAsync();

            var result = new Dictionary<string, SummerFieldAuditMetadata>(StringComparer.OrdinalIgnoreCase);
            foreach (var row in rows)
            {
                var fieldKind = NormalizeAuditText(row.MendField);
                if (string.IsNullOrWhiteSpace(fieldKind) || result.ContainsKey(fieldKind))
                {
                    continue;
                }

                result[fieldKind] = new SummerFieldAuditMetadata
                {
                    GroupName = NormalizeAuditText(row.GroupName),
                    FieldLabel = NormalizeAuditText(row.FieldLabel)
                };
            }

            return result;
        }

        private static bool IsAuditableSummerField(string? fieldKind)
        {
            if (string.IsNullOrWhiteSpace(fieldKind))
            {
                return false;
            }

            return !IsSystemManagedSummerField(fieldKind);
        }

        private static string GetAuditOperationArabic(TkmendField? oldField, TkmendField? newField)
        {
            if (oldField == null && newField != null)
            {
                return "إضافة";
            }

            if (oldField != null && newField == null)
            {
                return "حذف";
            }

            return "تعديل";
        }

        private static string? NormalizeAuditText(string? value)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return null;
            }

            return value
                .Replace("\r", " ", StringComparison.Ordinal)
                .Replace("\n", " ", StringComparison.Ordinal)
                .Trim();
        }

        private static string FormatAuditValue(string? value)
        {
            var normalized = NormalizeAuditText(value);
            return string.IsNullOrWhiteSpace(normalized) ? "(فارغ)" : normalized;
        }

        private static string TruncateAuditValue(string? value, int maxLength)
        {
            if (string.IsNullOrEmpty(value))
            {
                return string.Empty;
            }

            return value.Length <= maxLength ? value : value[..maxLength];
        }

        private static string BuildSummerEditFriendlyReplyText(IReadOnlyCollection<SummerFieldAuditEntry>? auditEntries)
        {
            var entries = (auditEntries ?? Array.Empty<SummerFieldAuditEntry>())
                .Where(item => item != null)
                .ToList();

            var distinctEntries = NormalizeAndDeduplicateAuditEntries(entries);

            if (distinctEntries.Count == 0)
            {
                return "تم تعديل طلب المصيف.";
            }

            const int maxVisibleEntries = 20;
            var lines = new List<string> { "تم تعديل طلب المصيف." };

            foreach (var entry in distinctEntries.Take(maxVisibleEntries))
            {
                lines.Add($"- {BuildSummerFriendlyAuditLine(entry)}");
            }

            if (distinctEntries.Count > maxVisibleEntries)
            {
                var hiddenCount = distinctEntries.Count - maxVisibleEntries;
                lines.Add($"- تم إجراء {ConvertToArabicIndicDigits(hiddenCount.ToString(CultureInfo.InvariantCulture))} تعديلات إضافية.");
            }

            return string.Join(Environment.NewLine, lines);
        }

        private static string BuildSummerFriendlyAuditLine(SummerFieldAuditEntry entry)
        {
            var groupContext = BuildSummerGroupContext(entry.GroupName, entry.InstanceGroupId);
            var fieldLabel = NormalizeAuditText(entry.FieldName) ?? "الحقل";
            var beforeValue = FormatAuditValueForReply(entry.BeforeValue);
            var afterValue = FormatAuditValueForReply(entry.AfterValue);

            return entry.Operation switch
            {
                "إضافة" => $"تمت إضافة {groupContext} في حقل {fieldLabel} بالقيمة {afterValue}.",
                "حذف" => $"تم حذف قيمة {beforeValue} من حقل {fieldLabel} في {groupContext}.",
                _ => $"تم تعديل {groupContext} في حقل {fieldLabel} من {beforeValue} إلى {afterValue}."
            };
        }

        private static List<SummerFieldAuditEntry> NormalizeAndDeduplicateAuditEntries(IReadOnlyCollection<SummerFieldAuditEntry> entries)
        {
            var orderedKeys = new List<string>();
            var mergedEntries = new Dictionary<string, SummerFieldAuditEntry>(StringComparer.OrdinalIgnoreCase);

            foreach (var entry in entries.Where(item => item != null))
            {
                var canonicalAlias = ResolveSummerAuditAlias(entry.FieldKey);
                var normalizedEntry = new SummerFieldAuditEntry
                {
                    Operation = NormalizeAuditText(entry.Operation) ?? "تعديل",
                    GroupName = ResolvePreferredAuditGroupName(entry.GroupName, canonicalAlias),
                    FieldName = ResolvePreferredAuditFieldLabel(entry.FieldName, entry.FieldKey, canonicalAlias),
                    FieldKey = NormalizeAuditText(entry.FieldKey) ?? string.Empty,
                    InstanceGroupId = entry.InstanceGroupId,
                    BeforeValue = FormatAuditValue(entry.BeforeValue),
                    AfterValue = FormatAuditValue(entry.AfterValue)
                };

                var semanticKey = BuildSummerAuditSemanticKey(normalizedEntry, canonicalAlias);
                if (!mergedEntries.TryGetValue(semanticKey, out var currentEntry))
                {
                    mergedEntries[semanticKey] = normalizedEntry;
                    orderedKeys.Add(semanticKey);
                    continue;
                }

                if (GetAuditEntryQualityScore(normalizedEntry) > GetAuditEntryQualityScore(currentEntry))
                {
                    mergedEntries[semanticKey] = normalizedEntry;
                }
            }

            return orderedKeys
                .Where(key => mergedEntries.ContainsKey(key))
                .Select(key => mergedEntries[key])
                .ToList();
        }

        private static string BuildSummerAuditSemanticKey(SummerFieldAuditEntry entry, string canonicalAlias)
        {
            var operation = NormalizeAuditText(entry.Operation) ?? "تعديل";
            var instanceGroup = entry.InstanceGroupId > 0 ? entry.InstanceGroupId : 1;
            var beforeValue = NormalizeAuditText(entry.BeforeValue) ?? "(فارغ)";
            var afterValue = NormalizeAuditText(entry.AfterValue) ?? "(فارغ)";
            return $"{operation}|{canonicalAlias}|{instanceGroup}|{beforeValue}|{afterValue}";
        }

        private static int GetAuditEntryQualityScore(SummerFieldAuditEntry entry)
        {
            var score = 0;

            var normalizedGroup = NormalizeAuditText(entry.GroupName);
            if (!string.IsNullOrWhiteSpace(normalizedGroup)
                && !string.Equals(normalizedGroup, "بدون مجموعة", StringComparison.OrdinalIgnoreCase)
                && !string.Equals(normalizedGroup, "البيانات", StringComparison.OrdinalIgnoreCase))
            {
                score += 2;
            }

            if (!IsTechnicalAuditFieldLabel(entry.FieldName, entry.FieldKey))
            {
                score += 3;
            }

            if (!string.Equals(
                NormalizeAuditText(entry.FieldName),
                NormalizeAuditText(entry.FieldKey),
                StringComparison.OrdinalIgnoreCase))
            {
                score += 1;
            }

            return score;
        }

        private static string ResolvePreferredAuditFieldLabel(string? fieldName, string? fieldKey, string canonicalAlias)
        {
            var normalizedFieldName = NormalizeAuditText(fieldName);
            var normalizedFieldKey = NormalizeAuditText(fieldKey);

            if (!IsTechnicalAuditFieldLabel(normalizedFieldName, normalizedFieldKey))
            {
                return normalizedFieldName!;
            }

            if (SummerAuditFallbackFieldLabelByAlias.TryGetValue(canonicalAlias, out var fallbackLabel)
                && !string.IsNullOrWhiteSpace(fallbackLabel))
            {
                return fallbackLabel;
            }

            return normalizedFieldName
                ?? normalizedFieldKey
                ?? "الحقل";
        }

        private static string ResolvePreferredAuditGroupName(string? groupName, string canonicalAlias)
        {
            var normalizedGroup = NormalizeAuditText(groupName);
            if (!string.IsNullOrWhiteSpace(normalizedGroup)
                && !string.Equals(normalizedGroup, "بدون مجموعة", StringComparison.OrdinalIgnoreCase))
            {
                return normalizedGroup;
            }

            if (SummerAuditFallbackGroupByAlias.TryGetValue(canonicalAlias, out var fallbackGroup)
                && !string.IsNullOrWhiteSpace(fallbackGroup))
            {
                return fallbackGroup;
            }

            return normalizedGroup ?? "بدون مجموعة";
        }

        private static bool IsTechnicalAuditFieldLabel(string? label, string? fieldKey)
        {
            var normalizedLabel = NormalizeAuditText(label);
            if (string.IsNullOrWhiteSpace(normalizedLabel))
            {
                return true;
            }

            var normalizedFieldKey = NormalizeAuditText(fieldKey);
            if (!string.IsNullOrWhiteSpace(normalizedFieldKey)
                && string.Equals(normalizedLabel, normalizedFieldKey, StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }

            if (normalizedLabel.StartsWith("SUM2026_", StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }

            var hasArabicCharacters = normalizedLabel.Any(ch => ch >= '\u0600' && ch <= '\u06FF');
            if (hasArabicCharacters)
            {
                return false;
            }

            var hasWhiteSpace = normalizedLabel.Any(char.IsWhiteSpace);
            if (hasWhiteSpace)
            {
                return false;
            }

            return normalizedLabel.All(ch => char.IsLetterOrDigit(ch) || ch == '_' || ch == '-');
        }

        private static string ResolveSummerAuditAlias(string? fieldKey)
        {
            var normalizedFieldKey = NormalizeAuditText(fieldKey);
            if (string.IsNullOrWhiteSpace(normalizedFieldKey))
            {
                return string.Empty;
            }

            return SummerAuditAliasMap.TryGetValue(normalizedFieldKey, out var alias)
                ? alias
                : normalizedFieldKey;
        }

        private static Dictionary<string, string> BuildSummerAuditAliasMap()
        {
            var map = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

            AddSummerAuditAliasRange(map, "OWNER_NAME", SummerWorkflowDomainConstants.EmployeeNameFieldKinds);
            AddSummerAuditAliasRange(map, "OWNER_FILE_NUMBER", SummerWorkflowDomainConstants.EmployeeIdFieldKinds);
            AddSummerAuditAliasRange(map, "OWNER_PHONE", SummerWorkflowDomainConstants.EmployeePhoneFieldKinds);
            AddSummerAuditAliasRange(map, "OWNER_EXTRA_PHONE", SummerWorkflowDomainConstants.EmployeeExtraPhoneFieldKinds);
            AddSummerAuditAliasRange(map, "FAMILY_COUNT", SummerWorkflowDomainConstants.FamilyCountFieldKinds);
            AddSummerAuditAliasRange(map, "EXTRA_COUNT", SummerWorkflowDomainConstants.ExtraCountFieldKinds);

            AddSummerAuditAliasRange(map, "COMPANION_NAME", new[] { "SUM2026_CompanionName", "CompanionName", "Companion_Name", "CompanionNameAr" });
            AddSummerAuditAliasRange(map, "COMPANION_AGE", new[] { "SUM2026_CompanionAge", "CompanionAge", "Companion_Age" });
            AddSummerAuditAliasRange(map, "COMPANION_RELATION", new[] { "SUM2026_CompanionRelation", "CompanionRelation", "Companion_Relation" });

            return map;
        }

        private static void AddSummerAuditAliasRange(
            Dictionary<string, string> map,
            string alias,
            IEnumerable<string> keys)
        {
            if (map == null || string.IsNullOrWhiteSpace(alias) || keys == null)
            {
                return;
            }

            foreach (var key in keys)
            {
                var normalizedKey = NormalizeAuditText(key);
                if (string.IsNullOrWhiteSpace(normalizedKey))
                {
                    continue;
                }

                if (!map.ContainsKey(normalizedKey))
                {
                    map[normalizedKey] = alias;
                }
            }
        }

        private static string BuildSummerGroupContext(string? groupName, int instanceGroupId)
        {
            var normalizedGroup = NormalizeAuditText(groupName);
            var groupLabel = string.IsNullOrWhiteSpace(normalizedGroup)
                || string.Equals(normalizedGroup, "بدون مجموعة", StringComparison.OrdinalIgnoreCase)
                    ? "البيانات"
                    : normalizedGroup;
            var instanceContext = BuildSummerInstanceContext(normalizedGroup, instanceGroupId);
            return string.IsNullOrWhiteSpace(instanceContext)
                ? groupLabel
                : $"{groupLabel} {instanceContext}";
        }

        private static string BuildSummerInstanceContext(string? groupName, int instanceGroupId)
        {
            if (instanceGroupId <= 0)
            {
                return string.Empty;
            }

            var isCompanionGroup = !string.IsNullOrWhiteSpace(groupName)
                && groupName.Contains("مرافق", StringComparison.OrdinalIgnoreCase);
            var shouldShowInstance = instanceGroupId > 1 || isCompanionGroup;
            if (!shouldShowInstance)
            {
                return string.Empty;
            }

            var ordinal = ResolveArabicOrdinalText(instanceGroupId);
            if (isCompanionGroup)
            {
                return $"للمرافق {ordinal}";
            }

            return $"للعنصر {ordinal}";
        }

        private static string ResolveArabicOrdinalText(int number)
        {
            return number switch
            {
                1 => "الأول",
                2 => "الثاني",
                3 => "الثالث",
                4 => "الرابع",
                5 => "الخامس",
                6 => "السادس",
                7 => "السابع",
                8 => "الثامن",
                9 => "التاسع",
                10 => "العاشر",
                _ => $"رقم {ConvertToArabicIndicDigits(number.ToString(CultureInfo.InvariantCulture))}"
            };
        }

        private static string FormatAuditValueForReply(string? value)
        {
            return ConvertToArabicIndicDigits(FormatAuditValue(value));
        }

        private static string ConvertToArabicIndicDigits(string value)
        {
            if (string.IsNullOrEmpty(value))
            {
                return value;
            }

            var buffer = value.ToCharArray();
            for (var index = 0; index < buffer.Length; index++)
            {
                var current = buffer[index];
                if (current >= '0' && current <= '9')
                {
                    buffer[index] = (char)('٠' + (current - '0'));
                }
            }

            return new string(buffer);
        }

        private sealed class SummerFieldAuditMetadata
        {
            public string? GroupName { get; set; }
            public string? FieldLabel { get; set; }
        }

        private sealed class SummerFieldAuditEntry
        {
            public string Operation { get; set; } = "تعديل";
            public string GroupName { get; set; } = "بدون مجموعة";
            public string FieldName { get; set; } = string.Empty;
            public string FieldKey { get; set; } = string.Empty;
            public int InstanceGroupId { get; set; }
            public string BeforeValue { get; set; } = "(فارغ)";
            public string AfterValue { get; set; } = "(فارغ)";
        }

        private async Task SaveRequestAttachmentsAsync(List<IFormFile>? files, int replyId)
        {
            if (files == null || files.Count == 0)
            {
                return;
            }

            var attchShipments = new List<AttchShipment>();
            await _helperService.SaveAttachments(files, replyId, attchShipments);
            if (attchShipments.Count > 0)
            {
                await _attach_HeldContext.AttchShipments.AddRangeAsync(attchShipments);
            }
        }

        private static string BuildFieldInstanceKey(TkmendField field)
        {
            var kind = (field?.FildKind ?? string.Empty).Trim();
            var instanceGroupId = field?.InstanceGroupId ?? 1;
            return $"{kind}|{instanceGroupId}";
        }

        private static bool IsSystemManagedSummerField(string? fieldKind)
        {
            if (string.IsNullOrWhiteSpace(fieldKind))
            {
                return false;
            }

            return SystemManagedSummerFieldKinds.Contains(fieldKind.Trim());
        }

        private static bool ShouldNormalizeToShortDate(
            string? fieldKind,
            string? fieldValue,
            HashSet<string> dateFieldKinds)
        {
            if (string.IsNullOrWhiteSpace(fieldKind)
                || string.IsNullOrWhiteSpace(fieldValue)
                || dateFieldKinds == null
                || dateFieldKinds.Count == 0)
            {
                return false;
            }

            var normalizedKind = fieldKind.Trim();
            if (!dateFieldKinds.Contains(normalizedKind))
            {
                return false;
            }

            if (SystemManagedSummerFieldKinds.Contains(normalizedKind))
            {
                return false;
            }

            return !ContainsTimePortion(fieldValue);
        }

        private static bool ContainsTimePortion(string? fieldValue)
        {
            var value = (fieldValue ?? string.Empty).Trim();
            if (value.Length == 0)
            {
                return false;
            }

            return value.Contains('T', StringComparison.Ordinal)
                || value.Contains(':', StringComparison.Ordinal)
                || value.EndsWith("Z", StringComparison.OrdinalIgnoreCase);
        }

        private static DateTime TruncateToWholeSecondUtc(DateTime dateTimeUtc)
        {
            var utc = dateTimeUtc.Kind == DateTimeKind.Utc
                ? dateTimeUtc
                : dateTimeUtc.ToUniversalTime();

            var ticks = utc.Ticks - (utc.Ticks % TimeSpan.TicksPerSecond);
            return new DateTime(ticks, DateTimeKind.Utc);
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
    }
}
