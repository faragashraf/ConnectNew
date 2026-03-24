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
using NPOI.SS.Formula.Functions;
using Persistence.Data;
using Persistence.HelperServices;
using Persistence.Services.Notifications;
using Persistence.Services.Summer;
using SignalR.Notification;
using System;
using System.Data;
using System.IO;
using System.Linq;
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
        private readonly SignalRConnectionManager _signalRConnectionManager;
        private readonly IConnectNotificationService _notificationService;
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
            "Summer_ActionType",
            "Summer_PaymentDueAtUtc",
            "Summer_PaymentStatus",
            "Summer_PaidAtUtc",
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
            "Summer_AdminComment"
        };

        public HandleEmployeeCategories(ConnectContext connectContext, Attach_HeldContext attach_HeldContext, GPAContext gPAContext, helperService helperService, IMapper mapper, ENPOCreateLogFile logger, MessageRequestService messageRequestService, SignalRConnectionManager signalRConnectionManager, IConnectNotificationService notificationService)
        {
            _connectContext = connectContext;
            _attach_HeldContext = attach_HeldContext;
            _gPAContext = gPAContext;
            _helperService = helper_service_check(helperService);
            _mapper = mapper;
            _logger = logger ?? new ENPOCreateLogFile("C:\\Connect_Log", "HandleEmployeeCategories_Log" + DateTime.Today.ToString("dd-MMM-yyyy"), FileExtension.txt);
            _messageRequestService = messageRequestService ?? throw new ArgumentNullException(nameof(messageRequestService));
            _signalRConnectionManager = signalRConnectionManager ?? throw new ArgumentNullException(nameof(signalRConnectionManager));
            _notificationService = notificationService ?? throw new ArgumentNullException(nameof(notificationService));
        }

        private helperService helper_service_check(helperService svc)
        {
            if (svc == null) throw new ArgumentNullException(nameof(svc));
            return svc;
        }

        // SummerRequests: creates message + reply and persists with retry and basic unique-requestRef handling to reduce overwrite collisions
        public async Task SummerRequests(MessageRequest messageRequest, CategoryWithParent categoryInfo, CommonResponse<MessageDto> response)
        {
            if (messageRequest == null) throw new ArgumentNullException(nameof(messageRequest));
            if (response == null) throw new ArgumentNullException(nameof(response));

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

            var employeeId = GetFieldValue(messageRequest.Fields, "Emp_Id");
            if (string.IsNullOrWhiteSpace(employeeId))
            {
                response.Errors.Add(new Error { Code = "400", Message = "رقم ملف الموظف مطلوب." });
                return;
            }

            var summerCamp = GetFieldValue(messageRequest.Fields, "SummerCamp");
            if (string.IsNullOrWhiteSpace(summerCamp))
            {
                response.Errors.Add(new Error { Code = "400", Message = "الفوج مطلوب." });
                return;
            }

            var familyCount = ParseInt(GetFieldValue(messageRequest.Fields, "FamilyCount"), 0);
            if (familyCount <= 0)
            {
                response.Errors.Add(new Error { Code = "400", Message = "عدد الأفراد مطلوب." });
                return;
            }

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
                            var seasonYear = ParseInt(GetFieldValue(messageRequest.Fields, "SummerSeasonYear"), DateTime.UtcNow.Year);
                            var sequenceName = GetSummerSequenceName(categoryInfo.Category.CatId);
                            var requestRefSeq = _helperService.GetSequenceNextValue(sequenceName);
                            requestRef = BuildSummerRequestReference(categoryInfo.Category.CatId, seasonYear, requestRefSeq);
                        }

                        messageRequest.MessageId = messageId;
                        messageRequest.RequestRef = requestRef;
                        messageRequest.AssignedSectorId = parentCategory.Stockholder.ToString();
                        UpsertRequestField(messageRequest.Fields, "RequestRef", requestRef);

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
                        var seasonYear = ParseInt(GetFieldValue(messageRequest.Fields, "SummerSeasonYear"), DateTime.UtcNow.Year);
                        var sequenceName = GetSummerSequenceName(categoryInfo.Category.CatId);
                        var requestRefSeq = _helperService.GetSequenceNextValue(sequenceName);
                        var requestReference = BuildSummerRequestReference(categoryInfo.Category.CatId, seasonYear, requestRefSeq);

                        messageRequest.MessageId = messageId;
                        messageRequest.RequestRef = requestReference;
                        messageRequest.AssignedSectorId = parentCategory.Stockholder.ToString();
                        var requestRefField = messageRequest.Fields.FirstOrDefault(x => x.FildKind == "RequestRef");
                        if (requestRefField != null)
                        {
                            requestRefField.FildTxt = messageRequest.RequestRef;
                        }

                        var paymentDueAtUtc = SummerCalendarRules.CalculatePaymentDueUtc(DateTime.UtcNow);
                        UpsertRequestField(messageRequest.Fields, "Summer_PaymentDueAtUtc", paymentDueAtUtc.ToString("o"));
                        UpsertRequestField(messageRequest.Fields, "Summer_PaymentStatus", "PENDING_PAYMENT");
                        UpsertRequestField(messageRequest.Fields, "Summer_TransferCount", "0");

                        replyText = "تم إنشاء طلب المصيف.";
                        capacityAction = "CREATE";
                    }

                    var assignedSector = messageRequest.AssignedSectorId ?? messageRequest.CreatedBy;
                    var reply = _helperService.CreateReply(messageId, replyText, messageRequest.CreatedBy, assignedSector, "0.0.0.0");

                    if (isEditOperation)
                    {
                        await _connectContext.Replies.AddAsync(reply);
                        await SaveRequestAttachmentsAsync(messageRequest.files, reply.ReplyId);
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

                    await _helperService.GetMessageRequestById(messageId, response);

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

            var userId = messageRequest?.CreatedBy;
            if (string.IsNullOrEmpty(userId))
            {
                _logger.AppendLine("PostCommitActionsAsync: CreatedBy is null or empty; skipping notification.");
                return;
            }

            var requestRef = messageRequest?.RequestRef ?? string.Empty;
            var catName = category?.CatName ?? string.Empty;
            var isEditOperation = !string.IsNullOrWhiteSpace(reply?.Message)
                && reply.Message.Contains("تعديل", StringComparison.OrdinalIgnoreCase);

            var notificationText = isEditOperation
                ? $"تم حفظ تعديل طلب المصيف '{catName}' برقم مرجع {requestRef}."
                : $"تم إنشاء طلب المصيف '{catName}' برقم مرجع {requestRef} وإرساله للتنفيذ.";
            var notificationTitle = isEditOperation ? "تم تعديل طلب مصيف" : "تم إنشاء طلب مصيف";

            await _signalRConnectionManager.SendNotificationToUser(userId, new NotificationDto
            {
                Notification = notificationText,
                type = NotificationType.info,
                Title = notificationTitle,
                time = DateTime.Now,
                sender = "Connect",
                Category = NotificationCategory.Business
            });

            var targetAdminGroup = ResolveResponsibleAdminGroupName(messageRequest);
            if (!string.IsNullOrWhiteSpace(targetAdminGroup))
            {
                await _notificationService.SendSignalRToGroupAsync(new SignalRGroupDispatchRequest
                {
                    GroupName = targetAdminGroup,
                    Notification = isEditOperation
                        ? $"تم تعديل طلب المصيف رقم #{reply?.MessageId ?? 0} بواسطة صاحب الطلب (مرجع: {requestRef})."
                        : $"تم إنشاء طلب مصيف جديد رقم #{reply?.MessageId ?? 0} بواسطة صاحب الطلب (مرجع: {requestRef}).",
                    Title = "إدارة طلبات المصايف",
                    Type = NotificationType.info,
                    Category = NotificationCategory.Business,
                    Sender = "Connect",
                    Time = DateTime.Now
                });
            }
            else
            {
                _logger.AppendLine($"PostCommitActionsAsync: no responsible admin group found for message #{reply?.MessageId ?? 0}.");
            }
            _logger.AppendLine("Transactions committed.");
        }

        private static string? ResolveResponsibleAdminGroupName(MessageRequest? messageRequest)
        {
            if (messageRequest == null)
            {
                return null;
            }

            var responsible = (messageRequest.CurrentResponsibleSectorId ?? string.Empty).Trim();
            if (!string.IsNullOrWhiteSpace(responsible))
            {
                return responsible;
            }

            var assigned = (messageRequest.AssignedSectorId ?? string.Empty).Trim();
            return string.IsNullOrWhiteSpace(assigned) ? null : assigned;
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

            var sameCampReservationMessageIds = await _connectContext.TkmendFields
                .AsNoTracking()
                .Where(x => x.FildKind == "SummerCamp" && x.FildTxt == summerCamp)
                .Select(x => x.FildRelted)
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

            var familyCountFields = await _connectContext.TkmendFields
                .AsNoTracking()
                .Where(x => sameCategoryMessageIds.Contains(x.FildRelted) && x.FildKind == "FamilyCount")
                .ToListAsync();

            var usedUnits = familyCountFields
                .Where(x => ParseInt(x.FildTxt, 0) == familyCount)
                .Select(x => x.FildRelted)
                .Distinct()
                .Count();

            if (usedUnits >= totalUnits)
            {
                response.Errors.Add(new Error
                {
                    Code = "429",
                    Message = $"لا توجد وحدات متاحة لعدد الأفراد '{familyCount}' في الفوج '{summerCamp}' بمصيف '{category.CatName}'."
                });
                return false;
            }

            return true;
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

        private static string? GetFieldValue(IEnumerable<TkmendField>? fields, string fieldKind)
        {
            return fields?
                .FirstOrDefault(x => x.FildKind == fieldKind)?
                .FildTxt?
                .Trim();
        }

        private static int ParseInt(string? value, int fallback = 0)
        {
            return int.TryParse((value ?? string.Empty).Trim(), out var parsed) ? parsed : fallback;
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

            var hasDateMetadata = await _connectContext.Cdmends
                .AsNoTracking()
                .AnyAsync(x => x.CdmendType != null && x.CdmendType.ToLower() == "date");

            if (hasDateMetadata)
            {
                nextFields.ForEach(field =>
                {
                    if (!string.IsNullOrWhiteSpace(field.FildTxt))
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



