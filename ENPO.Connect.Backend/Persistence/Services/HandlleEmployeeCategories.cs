using AutoMapper;
using DocumentFormat.OpenXml.Office2010.Excel;
using DocumentFormat.OpenXml.Spreadsheet;
using ENPO.CreateLogFile;
using ENPO.Dto.HubSync;
using ENPO.Dto.Utilities;
using Microsoft.EntityFrameworkCore;
using Models.Attachment;
using Models.Correspondance;
using Models.DTO.Common;
using Models.DTO.Correspondance;
using NPOI.SS.Formula.Functions;
using Persistence.Data;
using Persistence.HelperServices;
using SignalR.Notification;
using System;
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

        public HandleEmployeeCategories(ConnectContext connectContext, Attach_HeldContext attach_HeldContext, GPAContext gPAContext, helperService helperService, IMapper mapper, ENPOCreateLogFile logger, MessageRequestService messageRequestService, SignalRConnectionManager signalRConnectionManager)
        {
            _connectContext = connectContext;
            _attach_HeldContext = attach_HeldContext;
            _gPAContext = gPAContext;
            _helperService = helper_service_check(helperService);
            _mapper = mapper;
            _logger = logger ?? new ENPOCreateLogFile("C:\\Connect_Log", "HandleEmployeeCategories_Log" + DateTime.Today.ToString("dd-MMM-yyyy"), FileExtension.txt);
            _messageRequestService = messageRequestService ?? throw new ArgumentNullException(nameof(messageRequestService));
            _signalRConnectionManager = signalRConnectionManager ?? throw new ArgumentNullException(nameof(signalRConnectionManager));
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

            if (messageRequest.CreatedBy == null)
            {
                response.Errors.Add(new Error { Code = "400", Message = "CreatedBy is required." });
                return;
            }

            if (messageRequest.Fields!.Where(x => x.FildKind == "Emp_Id").FirstOrDefault()!.FildTxt == null)
            {
                response.Errors.Add(new Error { Code = "400", Message = "Emp Id is required." });
                return;
            }

            if (categoryInfo == null)
            {
                response.Errors.Add(new Error { Code = "404", Message = "Category not found" });
                return;
            }

            var parentCategory = categoryInfo.ParentCategory;

            if (parentCategory == null)
            {
                response.Errors.Add(new Error { Code = "404", Message = "Parent category information is missing." });
                return;
            }

            messageRequest.Type = (byte)parentCategory.CatId;


            var allowed = await IsWithinCategoryIntervalLimitAsync(categoryInfo.Category, response, parentCategory.CatName, messageRequest.Fields);
            if (!allowed)
            {
                // error already added inside IsWithinCategoryIntervalLimitAsync
                return;
            }

            // Validate file sizes first
            if (!_helperService.ValidateFileSizes(messageRequest.files, response))
            {
                _logger.AppendLine("File size validation failed in SummerRequests.");
                return;
            }

            var baseRequestRef = messageRequest.RequestRef ?? string.Empty;

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
                using var trxConnect = _connectContext.Database.BeginTransaction();
                using var trxAttach = _attach_HeldContext.Database.BeginTransaction();
                try
                {
                    List<(int id, string code)> resortCd = new List<(int id, string code)>
                    {
                        (147, "M"),
                        (148, "R"),
                        (149, "B")
                                            };
                    var cd = resortCd.Where(x=> x.id == categoryInfo.Category.CatId).FirstOrDefault().code;
                    // Generate ids using DB-backed sequences (helperService expected to use atomic DB operations)
                    var messageId = _helperService.GetSequenceNextValue("Seq_Tickets");
                    var requestRefSec = _helperService.GetSequenceNextValue("Seq_Summer2026");

                    messageRequest.MessageId = messageId;
                    messageRequest.RequestRef = string.IsNullOrWhiteSpace(baseRequestRef)
                        ? requestRefSec.ToString()
                        : $"{baseRequestRef}-{cd}-{requestRefSec}";
                    messageRequest.AssignedSectorId = parentCategory.Stockholder.ToString();
                    messageRequest.Fields.Where(x => x.FildKind == "RequestRef").FirstOrDefault().FildTxt = messageRequest.RequestRef;
                    // Create initial reply
                    var assignedSector = messageRequest.AssignedSectorId ?? messageRequest.CreatedBy;

                    var reply = _helperService.CreateReply(messageId, "تم إنشاء الطلب", messageRequest.CreatedBy, assignedSector, "0.0.0.0");

                    await _messageRequestService.PersistEntitiesAsync(messageRequest, reply);
                    await _connectContext.SaveChangesAsync();
                    await _attach_HeldContext.SaveChangesAsync();
                    trxAttach.Commit();
                    trxConnect.Commit();

                    _logger.AppendLine($"SummerRequests: created message {messageId} with RequestRef {messageRequest.RequestRef}");

                    // Post commit actions (notifications, etc.) and fetch created message
                    try
                    {
                        await PostCommitActionsAsync(messageRequest, reply, categoryInfo);
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
                        response.Errors.Add(new Error { Code = "409", Message = "Concurrency conflict � please retry." });
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
                        _logger.AppendLine("Unique constraint violation detected for RequestRef � regenerating suffix and retrying.");
                        continue;
                    }

                    // Other DB update errors: add to response and stop
                    response.Errors.Add(new Error { Code = dbEx.HResult.ToString(), Message = dbEx.Message });
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
            response.Errors.Add(new Error { Code = "409", Message = "Failed to create request after multiple attempts due to concurrency or duplicate keys." });
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

            await _signalRConnectionManager.SendNotificationToUser(userId, new NotificationDto
            {
                Notification = $"تم إنشاء طلب '{catName}' برقم {requestRef} وتم إرساله للمعالجة",
                type = NotificationType.info,
                Title = "إشعار إنشاء طلب",
                time = DateTime.Now,
                sender = "Connect",
                Category = NotificationCategory.Business
            });
            _logger.AppendLine("Transactions committed.");
        }

        private static bool IsUniqueConstraintViolation(string message)
        {
            if (string.IsNullOrEmpty(message)) return false;
            var lower = message.ToLowerInvariant();
            return lower.Contains("unique") || lower.Contains("duplicate") || lower.Contains("uk_") || lower.Contains("ix_") || lower.Contains("violation of unique");
        }

        // Checks whether the given user has not exceeded the allowed number of messages
        // for the specified category within the current interval (year, month, week).
        private async Task<bool> IsWithinCategoryIntervalLimitAsync(Cdcategory category, CommonResponse<MessageDto> response, string parentCategoryName, List<TkmendField>? fields = null)
        {
            var _user = fields.Where(x => x.FildKind == "Emp_Id").FirstOrDefault()!.FildTxt;
            var _camp = fields.Where(x => x.FildKind.Contains("SummerCamp")).FirstOrDefault()!.FildTxt;

            var previousReservation = await _connectContext.TkmendFields.Where(x => x.FildTxt == _camp)
                .Select(s => s.FildRelted)
                .ToListAsync();

            if (previousReservation.Any())
            {
                var users = await _connectContext.TkmendFields.Where(x => previousReservation.Contains(x.FildRelted) && x.FildKind == "Emp_Id")
                             .Select(s => s.FildTxt)
                             .ToListAsync();
                if (!users.Any()) return true;
                if (users.Any() && users.Contains(_user))
                {
                    response.Errors.Add(new Error
                    {
                        Code = "429",
                        Message = $"لقد وصلت إلى الحد الأقصى المسموح به لعدد الحجوزات في '{category.CatName}' في ({_camp})."
                    });
                    return false;
                }
                else return true;
            }
            else return true;
        }
    }
}
