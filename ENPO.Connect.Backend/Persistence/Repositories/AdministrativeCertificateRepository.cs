using AutoMapper;
using ENPO.CreateLogFile;
using ENPO.Dto.HubSync;
using ENPO.Dto.Utilities;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Exchange.WebServices.Data;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Options;
using Models.Attachment;
using Models.Correspondance;
using Models.DTO;
using Models.DTO.Common;
using Models.DTO.Correspondance;
using Models.DTO.Correspondance.AdminCertificates;
using Models.DTO.Correspondance.Enums;
using Models.GPA;
using Persistence.Data;
using Persistence.HelperServices;
using Repositories;
using SignalR.Notification;
using System.Data;
using System.Linq.Expressions;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;

namespace Persistence.Repositories
{
    public class AdministrativeCertificateRepository : IAdministrativeCertificateRepository
    {
        private readonly ENPOCreateLogFile _logger;
        private readonly ApplicationConfig _option;
        private readonly IConfiguration _config;
        private IMapper _mapper;
        private readonly ConnectContext _connectContext;
        private readonly GPAContext _gPAContext;
        private readonly helperService _helperService;
        private readonly Attach_HeldContext _attach_HeldContext;
        private readonly SignalRConnectionManager _signalRConnectionManager;
        private readonly IHttpContextAccessor _httpContextAccessor;
        private readonly RedisConnectionManager _redisManager;
        public AdministrativeCertificateRepository(ConnectContext connectContext,
            GPAContext gPAContext,
            IMapper mapper, IOptions<ApplicationConfig> option,
            helperService helperService,
            Attach_HeldContext attach_HeldContext,
            SignalRConnectionManager signalRConnectionManager,
            IHttpContextAccessor httpContextAccessor,
            RedisConnectionManager redisManager
            )
        {
            _option = option.Value; // Access the configured instance
            _connectContext = connectContext;
            _gPAContext = gPAContext;
            _mapper = mapper;
            _attach_HeldContext = attach_HeldContext;
            _signalRConnectionManager = signalRConnectionManager;
            _httpContextAccessor = httpContextAccessor;
            _logger = new ENPOCreateLogFile("C:\\Connect_Log", "AdministrativeCertificateRepository_Log" + DateTime.Today.ToString("dd-MMM-yyyy"), FileExtension.txt);
            _redisManager = redisManager;
            _helperService = new helperService(_gPAContext, _connectContext, _attach_HeldContext, _option, _logger, _mapper, _redisManager);
        }
        public async Task<CommonResponse<MessageDto>> UpdateStatus(int messageId, MessageStatus msgStatus, string userId, string ip)
        {
            var res = new CommonResponse<MessageDto>();

            try
            {
                var _message = await _connectContext.Messages.FindAsync(messageId);
                var currentStatus = _message.Status;
                _message.Status = msgStatus;
                string msg = $"تم تعديل حالة الطلب من {currentStatus.GetDescription()} إلى {msgStatus.GetDescription()}";
                var reply = _helperService.CreateReply(messageId, msg, userId, userId, ip);
                await _connectContext.Replies.AddAsync(reply);
                await _connectContext.SaveChangesAsync();


                var expressions = new List<Expression<Func<Message, bool>>>();
                var filters = new Dictionary<string, Expression<Func<Message, bool>>>();

                Expression<Func<Message, bool>> messageIdExpr = m => m.MessageId == messageId;
                expressions.Add(messageIdExpr);
                filters.Add("MessageId", messageIdExpr);

                var internalDto = new InternalCommunicationDto
                {
                    userId = userId,
                    expressionMessageFilters = (ExpressionBuilder.CombineAnd(expressions.ToArray()), filters)
                };

                var requestModel = new ListRequestModel
                {
                    pageNumber = 1,
                    pageSize = 1,
                    Search = new Search { SearchKind = SearchKind.NoSearch }
                };

                var singleResponse = await _helperService.ReturnSingleCommonResponseAsync(internalDto, requestModel);
                foreach (var error in singleResponse.Errors)
                {
                    res.Errors.Add(error);
                }
                res.Data = singleResponse.Data;
            }
            catch (Exception ex)
            {
                _redisManager.LogToRedis<object>(
                   ModelType.Error,
                   ex,
                   "ip",
                   TimeSpan.FromDays(180)
               ).GetAwaiter();
                res.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });
            }
            return res;
        }

        public async Task<CommonResponse<IEnumerable<MessageDto>>> GetAllRequestsAsync(string userId, ListRequestModel RequestModel)
        {
            await _redisManager.LogToRedis<object>(
            ModelType.Request,
            new { MethodName = nameof(GetAllRequestsAsync), RequestModel, userId },
            "ip",
            TimeSpan.FromDays(180)
            );
            var internalDto = new InternalCommunicationDto();
            internalDto.userId = userId;
            internalDto.Search = RequestModel.Search;
            string propName = GetPropertyName(RequestModel);
            await _helperService.BuildGenericExpressionAsync(propName, RequestModel, internalDto);
            return await _helperService.ReturnCompleteCommonResponseAsync(internalDto, RequestModel);
        }
        public async Task<CommonResponse<IEnumerable<MessageDto>>> SearshAsync(ListRequestModel RequestModel, string userId)
        {
            var response = new CommonResponse<IEnumerable<MessageDto>>();

            await _redisManager.LogToRedis<object>(ModelType.Request, new { MethodName = nameof(SearshAsync), RequestModel }, "ip", TimeSpan.FromDays(180));

            var internalDto = new InternalCommunicationDto();
            internalDto.userId = userId;
            RequestModel.Search.SearchKind = SearchKind.NormalSearch;
            internalDto.Search = RequestModel.Search;
            await _helperService.BuildGenericExpressionAsync(RequestModel.Search.searchField, RequestModel, internalDto);
            //await _helperService.GetFirstFieldsForPropertyNameAsync(filedName, fileText, searchType, RequestModel, internalDto);
            return await _helperService.ReturnCompleteCommonResponseAsync(internalDto, RequestModel);
        }
        public async Task<CommonResponse<IEnumerable<TkmendField>>> CreateNewFileds(List<TkmendField> fields, string userId, string ip)
        {
            var res = new CommonResponse<IEnumerable<TkmendField>>();
            try
            {
                _logger.AppendLine("Starting CreateNewFileds method.");

                var _message = await _connectContext.Messages.FindAsync(fields[0].FildRelted);
                var currentStatus = _message.Status;
                _message.Status = MessageStatus.Printed;

                // Log input fields
                _logger.AppendLine($"Input Fields Count: {fields.Count}");
                foreach (var field in fields)
                {
                    _logger.AppendLine($"Field - FildKind: {field.FildKind}, FildRelted: {field.FildRelted}, FildTxt: {field.FildTxt}");
                }

                foreach (var field in fields)
                {
                    field.FildRelted = field.FildRelted;
                    field.FildKind = field.FildKind;
                }

                _connectContext.TkmendFields.AddRange(fields);
                _logger.AppendLine("Added fields to the database context.");

                var reply = _helperService.CreateReply(fields[0].FildRelted, "تم استكمال البيانات بنجاح", userId, userId, ip);
                var reply1 = _helperService.CreateReply(fields[0].FildRelted, "تم تغيير حالة الطلب \"تم الطباعة\" بنجاح", userId, userId, ip);

                List<Reply> replies = new List<Reply>
                {
                    reply,
                    reply1
                };
                //_signalRConnectionManager.SendObjectToGroup(groupName, messageDto);
                await _connectContext.Replies.AddRangeAsync(replies);

                _connectContext.SaveChanges();
                _logger.AppendLine("Created and added reply to the database context.");
                _logger.AppendLine("Changes saved to the database.");

                res.Data = fields;
                _logger.AppendLine("CreateNewFileds method completed successfully.");
            }
            catch (Exception ex)
            {
                await _redisManager.LogToRedis<object>(
                    ModelType.Error,
                    ex,
                    "ip",
                    TimeSpan.FromDays(180)
                );
                _logger.AppendLine($"[ERROR] Exception in CreateNewFileds: {ex.Message}");
                res.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });
            }
            return res;
        }

        public async Task<CommonResponse<MessageDto>> CompleteRequestAsync(CompleteRequestDto completeRequest, string userId, string ip)
        {
            var res = new CommonResponse<MessageDto>();
            IDbContextTransaction? modelTransaction = null;
            IDbContextTransaction? attachHeldTransaction = null;

            try
            {
                _logger.AppendLine("Starting CompleteRequestAsync method.");

                if (completeRequest?.Fields == null || !completeRequest.Fields.Any())
                {
                    res.Errors.Add(new Error { Code = "400", Message = "No fields provided." });
                    return res;
                }

                if (completeRequest.files != null)
                {
                    if (!_helperService.ValidateFileSizes(completeRequest.files, res))
                    {
                        _logger.AppendLine("File size validation failed in SupportiveActivitySector.");
                        return res;
                    }
                }

                if (res.Errors.Count > 0)
                {
                    return res;
                }

                modelTransaction = _connectContext.Database.BeginTransaction();
                attachHeldTransaction = _attach_HeldContext.Database.BeginTransaction();

                var messageId = completeRequest.Fields[0].FildRelted;
                var message = await _connectContext.Messages.FindAsync(messageId);

                if (message == null)
                {
                    res.Errors.Add(new Error { Code = "404", Message = "لم يتم العثور على الطلب" });
                    return res;
                }

                message.Status = (MessageStatus)3;

                _connectContext.TkmendFields.AddRange(completeRequest.Fields);

                var reply = _helperService.CreateReply(messageId, "تم إستيفاء الطلب بنجاح", userId, userId, ip);
                //var reply1 = _helperService.CreateReply(messageId, "تم تغيير حالة الطلب \"تم الطباعة\" بنجاح", userId, userId, ip);

                await _connectContext.Replies.AddRangeAsync(new List<Reply> { reply });

                if (completeRequest.files != null && completeRequest.files.Any())
                {
                    var attchShipments = new List<AttchShipment>();
                    await _helperService.SaveAttachments(completeRequest.files, reply.ReplyId, attchShipments);
                    if (attchShipments.Any())
                    {
                        await _attach_HeldContext.AttchShipments.AddRangeAsync(attchShipments);
                    }
                }

                await _attach_HeldContext.SaveChangesAsync();
                await _connectContext.SaveChangesAsync();

                modelTransaction.Commit();
                attachHeldTransaction.Commit();

                _logger.AppendLine("CompleteRequestAsync method completed successfully.");
            }
            catch (Exception ex)
            {
                if (attachHeldTransaction != null)
                    attachHeldTransaction.Rollback();

                if (modelTransaction != null)
                    modelTransaction.Rollback();

                await _redisManager.LogToRedis<object>(
                    ModelType.Error,
                    ex,
                    ip,
                    TimeSpan.FromDays(180)
                );
                _logger.AppendLine($"[ERROR] Exception in CompleteRequestAsync: {ex.Message}");
                res.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });
            }
            var completedMessageId = completeRequest?.Fields?.FirstOrDefault()?.FildRelted;
            if (completedMessageId.HasValue && completedMessageId.Value > 0)
            {
                var expressions = new List<Expression<Func<Message, bool>>>();
                var filters = new Dictionary<string, Expression<Func<Message, bool>>>();

                Expression<Func<Message, bool>> messageIdExpr = m => m.MessageId == completedMessageId.Value;
                expressions.Add(messageIdExpr);
                filters.Add("MessageId", messageIdExpr);

                var internalDto = new InternalCommunicationDto
                {
                    userId = userId,
                    expressionMessageFilters = (ExpressionBuilder.CombineAnd(expressions.ToArray()), filters)
                };

                var requestModel = new ListRequestModel
                {
                    pageNumber = 1,
                    pageSize = 1,
                    Search = new Search { SearchKind = SearchKind.NoSearch }
                };

                var singleResponse = await _helperService.ReturnSingleCommonResponseAsync(internalDto, requestModel);
                foreach (var error in singleResponse.Errors)
                {
                    res.Errors.Add(error);
                }
                res.Data = singleResponse.Data;
            }
            else
            {
                res.Errors.Add(new Error { Code = "400", Message = "MessageId not set" });
            }

            return res;
        }
        public async Task<CommonResponse<IEnumerable<AdmCertDeptDto>>> GetAreaDepartments(string areaName)
        {
            var res = new CommonResponse<IEnumerable<AdmCertDeptDto>>();
            try
            {
                var result = await (
                    from a in _gPAContext.AreasLists
                    where a.AreaAName == areaName
                    from d in _gPAContext.AdmCertDepts
                        .Where(d =>
                            (d.DepartmentType == 2) ||                // include all type 2
                            (d.DepartmentType != 1 && d.AreaId == a.AreaId)) // otherwise match AreaId
                    select new AdmCertDeptDto
                    {
                        DepartmentId = d.DepartmentId,
                        DepartmentName = d.DepartmentName,
                        DepartmentType = d.DepartmentType,
                        AreaName = a.AreaAName
                    }
                ).ToListAsync();

                res.Data = result;
            }
            catch (Exception ex)
            {
                await _redisManager.LogToRedis<object>(
                    ModelType.Error,
                    ex,
                    "ip",
                    TimeSpan.FromDays(180)
                );
                res.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });
            }
            return res;
        }
        public async Task<CommonResponse<IEnumerable<TkmendField>>> EditFieldsAsync(List<TkmendField> fields, string userId, string ip)
        {
            var res = new CommonResponse<IEnumerable<TkmendField>>();
            try
            {
                _logger.AppendLine("Starting EditFieldsAsync method.");

                if (fields == null || fields.Count == 0)
                {
                    res.Errors.Add(new Error { Code = "400", Message = "No fields provided." });
                    return res;
                }

                int relatedId = fields[0].FildRelted;

                // Load existing fields for the related id
                var existingFields = await _connectContext.TkmendFields
                    .Where(f => f.FildRelted == relatedId)
                    .ToListAsync();

                // Build a dictionary from Cdmends to map field kind keys to display text
                // Use GroupBy to tolerate duplicate keys in the source data and pick the first label
                var cdmendItems = await _connectContext.Cdmends
                    .AsNoTracking()
                    .Select(s => new { Key = (s.CdmendTxt ?? string.Empty).Trim(), Value = (s.CDMendLbl ?? string.Empty).Trim() })
                    .ToListAsync();

                var cdmendDict = cdmendItems
                    .Where(i => !string.IsNullOrEmpty(i.Key))
                    .GroupBy(i => i.Key)
                    .ToDictionary(g => g.Key, g => g.Select(x => x.Value).FirstOrDefault());

                var updatedFields = new List<TkmendField>();
                var sb = new StringBuilder();

                // Track which existing fields were matched by the incoming payload so
                // we can detect fields that should be deleted because they are no
                // longer present in the edit payload.
                var matchedFildSql = new HashSet<int>();
                var matchedKindInstance = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

                foreach (var field in fields)
                {
                    // Try to find an existing field by kind
                    // Prefer matching by primary key when provided (FildSql). If not provided,
                    // fall back to matching by FildKind together with InstanceGroupId to disambiguate duplicates.
                    TkmendField? existing = null;
                    if (field.FildSql > 0)
                    {
                        existing = existingFields.FirstOrDefault(e => e.FildSql == field.FildSql);
                    }
                    else
                    {
                        var kindKey = (field.FildKind ?? string.Empty).Trim();
                        existing = existingFields.FirstOrDefault(e =>
                            (e.FildKind ?? string.Empty).Trim() == kindKey
                            && (e.InstanceGroupId ?? 1) == (field.InstanceGroupId ?? 1));
                    }

                    if (existing != null)
                    {
                        // mark this existing field as matched so it won't be deleted later
                        if (existing.FildSql > 0)
                        {
                            matchedFildSql.Add(existing.FildSql);
                        }
                        else
                        {
                            var existingKey = (existing.FildKind ?? string.Empty).Trim() + "|" + (existing.InstanceGroupId ?? 1).ToString();
                            matchedKindInstance.Add(existingKey);
                        }
                        var oldValue = existing.FildTxt?.Trim();
                        var newValue = field.FildTxt?.Trim();

                        bool isChanged = false;

                        // If both values are null or empty, treat as not changed
                        if (string.IsNullOrEmpty(oldValue) && string.IsNullOrEmpty(newValue))
                        {
                            isChanged = false;
                        }
                        else
                        {
                            // Only attempt date parsing when the field kind indicates a date
                            bool isDateField = (existing.FildKind?.IndexOf("DATE", StringComparison.OrdinalIgnoreCase) >= 0)
                                               || (field.FildKind?.IndexOf("DATE", StringComparison.OrdinalIgnoreCase) >= 0);

                            if (isDateField)
                            {
                                isChanged = EvaluateDateChange(oldValue, newValue, isChanged);

                                // If changed and newValue is a valid date, normalize to date-only string
                                if (isChanged && !string.IsNullOrEmpty(newValue))
                                {
                                    if (TryParseToDateOnly(newValue, out var parsedNewDate))
                                    {
                                        newValue = parsedNewDate
                                            //.AddDays(1)
                                            .ToString("yyyy-MM-dd");
                                    }
                                }
                            }
                            else
                            {
                                // Non-date fields: simple string comparison
                                if (oldValue != newValue)
                                    isChanged = true;
                            }
                        }

                        if (isChanged)
                        {
                            existing.FildTxt = newValue;
                            updatedFields.Add(existing);

                            // Replace FildKind with friendly text from dictionary when available
                            var kindDisplay = cdmendDict.TryGetValue(existing.FildKind?.Trim() ?? string.Empty, out var display) ? display : existing.FildKind;
                            sb.AppendLine($"تم تعديل {kindDisplay} من {oldValue} إلى {newValue}");
                        }
                    }
                    else
                    {
                        // If not found, add as new field
                        var newField = new TkmendField
                        {
                            FildRelted = field.FildRelted,
                            FildKind = field.FildKind,
                            FildTxt = field.FildTxt?.Trim(),
                            InstanceGroupId = field.InstanceGroupId
                        };

                        await _connectContext.TkmendFields.AddAsync(newField);
                        updatedFields.Add(newField);

                        // If the caller provided an explicit primary key for the new field,
                        // mark it as matched to avoid accidental deletion of an existing
                        // row that might share the same key (defensive).
                        if (newField.FildSql > 0)
                        {
                            matchedFildSql.Add(newField.FildSql);
                        }

                        var kindDisplay = cdmendDict.TryGetValue(newField.FildKind?.Trim() ?? string.Empty, out var displayNew) ? displayNew : newField.FildKind;
                        sb.AppendLine($"تم تعديل {kindDisplay} من  إلى {newField.FildTxt}");
                    }
                }

                // Detect deletions: any existing fields that were not matched by the
                // incoming payload should be removed from the database.
                var toDelete = existingFields.Where(e =>
                    (e.FildSql > 0 && !matchedFildSql.Contains(e.FildSql)) ||
                    (e.FildSql <= 0 && !matchedKindInstance.Contains(((e.FildKind ?? string.Empty).Trim() + "|" + (e.InstanceGroupId ?? 1).ToString())))
                ).ToList();

                if (toDelete.Any())
                {
                    foreach (var d in toDelete)
                    {
                        var kindDisplay = cdmendDict.TryGetValue(d.FildKind?.Trim() ?? string.Empty, out var displayDel) ? displayDel : d.FildKind;
                        sb.AppendLine($"تم حذف {kindDisplay} {d.FildTxt}");
                    }

                    _connectContext.TkmendFields.RemoveRange(toDelete);
                }

                // Persist all adds/updates/deletes together
                await _connectContext.SaveChangesAsync();

                // Create a reply with multiline message if there are changes
                if (sb.Length > 0)
                {
                    var messageText = sb.ToString().TrimEnd();
                    var reply = _helperService.CreateReply(relatedId, messageText, userId, userId, ip);
                    await _connectContext.Replies.AddAsync(reply);
                    await _connectContext.SaveChangesAsync();
                }

                res.Data = updatedFields;
                _logger.AppendLine("EditFieldsAsync method completed successfully.");
            }
            catch (Exception ex)
            {
                await _redisManager.LogToRedis<object>(
                    ModelType.Error,
                    ex,
                    "ip",
                    TimeSpan.FromDays(180)
                );
                _logger.AppendLine($"[ERROR] Exception in EditFieldsAsync: {ex.Message}");
                res.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });
            }

            return res;
        }

        public async Task<CommonResponse<string>> CreateRequestTokenAsync(int messageId, int? expireHours = 24)
        {
            var res = new CommonResponse<string>();
            try
            {
                // Try to find an existing token for this message
                var existing = await _connectContext.RequestTokens
                    .Where(t => t.MessageId == messageId)
                    .OrderByDescending(t => t.ExpiresAt ?? DateTime.MaxValue)
                    .FirstOrDefaultAsync();

                var now = DateTime.UtcNow;
                if (existing != null)
                {
                    // If token has no expiry (persistent) or expires later than 15 minutes from now, reuse it
                    if (!existing.ExpiresAt.HasValue || existing.ExpiresAt.Value > now.AddMinutes(15))
                    {
                        res.Data = existing.Token;
                        return res;
                    }
                    // otherwise existing token is expired or will expire within 15 minutes -> generate new one
                }

                var token = Guid.NewGuid().ToString("N");
                var entity = new Models.Correspondance.RequestToken
                {
                    Token = token,
                    MessageId = messageId,
                    CreatedAt = now,
                    ExpiresAt = expireHours.HasValue ? now.AddHours(expireHours.Value) : (DateTime?)null
                };

                await _connectContext.RequestTokens.AddAsync(entity);
                await _connectContext.SaveChangesAsync();
                res.Data = token;
            }
            catch (Exception ex)
            {
                await _redisManager.LogToRedis<object>(
                    ModelType.Error,
                    ex,
                    "ip",
                    TimeSpan.FromDays(180)
                );
                res.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });
            }
            return res;
        }

        public async Task<CommonResponse<MessageDto>> GetRequestByTokenAsync(string token)
        {
            var res = new CommonResponse<MessageDto>();
            try
            {
                var tok = await _connectContext.RequestTokens.FirstOrDefaultAsync(t => t.Token == token);
                if (tok == null)
                {
                    res.Errors.Add(new Error { Code = "404", Message = "Token not found" });
                    return res;
                }
                if (tok.ExpiresAt.HasValue && tok.ExpiresAt.Value < DateTime.UtcNow)
                {
                    res.Errors.Add(new Error { Code = "410", Message = "Token expired" });
                    return res;
                }

                var expressions = new List<Expression<Func<Message, bool>>>();
                Expression<Func<Message, bool>> messageIdExpr = m => m.MessageId == tok.MessageId;
                expressions.Add(messageIdExpr);
                var filters = new Dictionary<string, Expression<Func<Message, bool>>>();
                filters.Add("MessageId", messageIdExpr);

                var internalDto = new InternalCommunicationDto
                {
                    userId = "",
                    expressionMessageFilters = (ExpressionBuilder.CombineAnd(expressions.ToArray()), filters)
                };

                var requestModel = new ListRequestModel
                {
                    pageNumber = 1,
                    pageSize = 1,
                    Search = new Search { SearchKind = SearchKind.NoSearch }
                };

                var singleResponse = await _helperService.ReturnSingleCommonResponseAsync(internalDto, requestModel);
                return singleResponse;
            }
            catch (Exception ex)
            {
                await _redisManager.LogToRedis<object>(
                    ModelType.Error,
                    ex,
                    "ip",
                    TimeSpan.FromDays(180)
                );
                res.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });
            }
            return res;
        }

        ///////////////////////////////       Private Methods        ///////////////////////////////////////////////

        private static string GetPropertyName(ListRequestModel RequestModel)
        {
            string propName = "";
            if (RequestModel.requestedData == RequestedData.Outbox)
                propName = "AuthorID";
            else
            {
                propName = "NextResponsibleSectorID";
            }

            return propName;
        }
        private static bool EvaluateDateChange(string? oldValue, string? newValue, bool isChanged)
        {
            // Try parsing both as DateTime using expected formats first (to avoid format-only differences)
            var dateFormats = new[] {
                                    "M/d/yyyy h:mm:ss tt",    // example: 8/27/2025 11:28:45 AM
                                    "M/d/yyyy hh:mm:ss tt",
                                    "MM/dd/yyyy hh:mm:ss tt",
                                    "M/d/yyyy H:mm:ss",
                                    "yyyy-MM-ddTHH:mm:ss",
                                    "yyyy-MM-dd HH:mm:ss",
                                    "M/d/yyyy",
                                    "MM/dd/yyyy"
                                };

            var culture = System.Globalization.CultureInfo.InvariantCulture;
            var styles = System.Globalization.DateTimeStyles.AssumeLocal | System.Globalization.DateTimeStyles.AdjustToUniversal;

            bool oldParsed = false;
            bool newParsed = false;
            DateTime oldDt = default, newDt = default;

            if (!string.IsNullOrEmpty(oldValue))
            {
                oldParsed = DateTime.TryParseExact(oldValue, dateFormats, culture, styles, out oldDt);
                if (!oldParsed)
                {
                    oldParsed = DateTime.TryParse(oldValue, culture, styles, out oldDt);
                }
            }

            if (!string.IsNullOrEmpty(newValue))
            {
                newParsed = DateTime.TryParseExact(newValue, dateFormats, culture, styles, out newDt);
                if (!newParsed)
                {
                    newParsed = DateTime.TryParse(newValue, culture, styles, out newDt);
                }
            }

            if (oldParsed && newParsed)
            {
                // Compare normalized Date values only (ignore time)
                if (oldDt.ToUniversalTime().Date != newDt.ToUniversalTime().Date)
                    isChanged = true;
            }
            else
            {
                // If parsing failed for one or both, fall back to string comparison
                if (oldValue != newValue)
                    isChanged = true;
            }

            return isChanged;
        }

        // Helper to try parse a string into a DateTime and return Date-only value
        private static bool TryParseToDateOnly(string input, out DateTime dateOnly)
        {
            dateOnly = default;
            if (string.IsNullOrWhiteSpace(input))
                return false;

            var dateFormats = new[] {
                                    "M/d/yyyy h:mm:ss tt",
                                    "M/d/yyyy hh:mm:ss tt",
                                    "MM/dd/yyyy hh:mm:ss tt",
                                    "M/d/yyyy H:mm:ss",
                                    "yyyy-MM-ddTHH:mm:ss",
                                    "yyyy-MM-dd HH:mm:ss",
                                    "M/d/yyyy",
                                    "MM/dd/yyyy",
                                    "yyyy-MM-dd"
                                };

            var culture = System.Globalization.CultureInfo.InvariantCulture;
            var styles = System.Globalization.DateTimeStyles.AssumeLocal | System.Globalization.DateTimeStyles.AdjustToUniversal;

            if (DateTime.TryParseExact(input, dateFormats, culture, styles, out var parsed))
            {
                dateOnly = parsed.Date;
                return true;
            }

            if (DateTime.TryParse(input, culture, styles, out parsed))
            {
                dateOnly = parsed.Date;
                return true;
            }

            return false;
        }

        ///////////////////////////////////       Private Methods        ///////////////////////////////////////////////
    }

}


