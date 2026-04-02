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
            SummerWorkflowDomainConstants.PricingFieldKinds.WhatsAppText
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

            var normalizedActorUserId = string.IsNullOrWhiteSpace(actingUserId)
                ? (messageRequest.CreatedBy ?? string.Empty).Trim()
                : actingUserId.Trim();
            var useFrozenInventory = ParseBoolean(GetFirstFieldValue(messageRequest.Fields, SummerWorkflowDomainConstants.UseFrozenUnitFieldKinds));
            var allowAdminFrozenBooking = false;
            if (useFrozenInventory)
            {
                allowAdminFrozenBooking = await CanUserManageSummerCategoryAsync(normalizedActorUserId, categoryInfo.Category.CatId);
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
                DestinationName = destinationName
            });

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

            messageRequest.Type = (byte)parentCategory.CatId;
            var editMessageId = messageRequest.MessageId.GetValueOrDefault();
            var isEditOperation = editMessageId > 0;


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

                        await ReplaceMessageFieldsAsync(messageId, messageRequest.Fields);

                        replyText = "تم تعديل طلب المصيف.";
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

        private async Task ReplaceMessageFieldsAsync(int messageId, List<TkmendField>? incomingFields)
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

            if (existingFields.Count > 0)
            {
                _connectContext.TkmendFields.RemoveRange(existingFields);
            }

            if (mergedFields.Count > 0)
            {
                await _connectContext.TkmendFields.AddRangeAsync(mergedFields);
            }
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
