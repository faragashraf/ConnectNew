using AutoMapper;
using Dapper;
using DocumentFormat.OpenXml.Wordprocessing;
using ENPO.CreateLogFile;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Internal;
using Models.Attachment;
using Models.Correspondance;
using Models.DTO;
using Models.DTO.Common;
using Models.DTO.Correspondance;
using Models.DTO.Correspondance.AdminCertificates;
using Models.DTO.Correspondance.Enums;
using Models.DTO.Correspondance.Replies;
using Newtonsoft.Json;
using NPOI.SS.Formula.Functions;
using Persistence.Data;
using System.Collections.Generic;
//using System.Data.Entity;
using System.Data.SqlClient;
using System.Globalization;
using System.Linq;
using System.Linq.Expressions;
using static Org.BouncyCastle.Asn1.Cmp.Challenge;

namespace Persistence.HelperServices
{
    public record CategoryWithParent(Cdcategory Category, Cdcategory? ParentCategory);

    public class helperService
    {
        private readonly GPAContext _gPAContext;
        private readonly ConnectContext _connectContext;
        private readonly Attach_HeldContext _attach_HeldContext;
        private readonly ApplicationConfig _option;
        private readonly ENPOCreateLogFile _logger;
        private IMapper _mapper;
        private readonly RedisConnectionManager _redisManager;
        public helperService(GPAContext gPAContext, ConnectContext connectContext, Attach_HeldContext attach_HeldContext, ApplicationConfig options, ENPOCreateLogFile logger, IMapper mapper, RedisConnectionManager redisManager)
        {
            _gPAContext = gPAContext;
            _connectContext = connectContext;
            _attach_HeldContext = attach_HeldContext;
            _option = options;
            _logger = logger;
            _mapper = mapper;
            _redisManager = redisManager;
        }

        public bool ValidateFileSizes<T>(List<IFormFile>? files, CommonResponse<T> response)
        {
            _logger.AppendLine("Starting ValidateFileSizes method.");
            if (files != null)
            {
                foreach (var file in files)
                {
                    if (file.Length > _option.ApiOptions.fileMaxSize)
                    {
                        response.Errors.Add(new Error
                        {
                            Code = "-1",
                            Message = $"حجم {file.FileName} اكبر من {_option.ApiOptions.fileMaxSize / 1024 / 1024} ميجا بايت" + Environment.NewLine + "يرجى تقليل مساحة الملف وإعادة المحاولة"
                        });
                        _logger.AppendLine($"File size validation failed for file: {file.FileName}");
                        return false;
                    }
                }
            }
            _logger.AppendLine("ValidateFileSizes method completed.");
            return true;
        }

        public Reply CreateReply(int messageId, string msg, string userId, string parentSectorId, string ip)
        {
            _logger.AppendLine("Starting CreateReply method.");
            int replyId = GetSequenceNextValue("Seq_Replies");
            _logger.AppendLine($"Generated replyId: {replyId}");
            var reply = new Reply
            {
                ReplyId = replyId,
                MessageId = messageId,
                Message = msg,
                AuthorId = userId,
                CreatedDate = DateTime.Now,
                NextResponsibleSectorId = parentSectorId,
                Ip = ip
            };
            _logger.AppendLine("CreateReply method completed.");
            return reply;
        }

        public async Task SaveAttachments(List<IFormFile> files, int messageId, List<AttchShipment> attchShipments)
        {
            _logger.AppendLine("Starting SaveAttachments method.");
            foreach (var file in files)
            {
                var attchShipment = new AttchShipment();
                using (var memoryStream = new MemoryStream())
                {
                    await file.CopyToAsync(memoryStream);
                    attchShipment.AttchId = messageId;
                    attchShipment.AttchNm = file.FileName;
                    attchShipment.AttchImg = memoryStream.ToArray();
                    attchShipment.AttchSize = file.Length;
                    attchShipment.AttcExt = Path.GetExtension(file.FileName);
                    attchShipments.Add(attchShipment);
                    _logger.AppendLine($"Attachment saved: {file.FileName}");
                }
            }
            _logger.AppendLine("SaveAttachments method completed.");
        }

        public void HandleException(CommonResponse<MessageDto> response, Exception ex)
        {
            _logger.AppendLine($"[ERROR] Exception occurred: {ex.Message}");
            response.Errors.Add(new Error { Code = "-1", Message = ex.Message });
            _logger.AppendLine($"[ERROR] Failed to create reply: {ex.Message}");
            response.Errors.Add(new Error { Code = "500", Message = ex.Message });
        }

        public string GetParent(string userId, CommonResponse<MessageDto> response)
        {
            _logger.AppendLine("Starting GetParent method.");
            string _parent = "";
            var userCat = _gPAContext.PosUserTeams.FirstOrDefault(x => x.UserId == userId);

            if (userCat == null)
            {
                response.Errors.Add(new Error
                {
                    Code = "-1",
                    Message = "لم يتم العثور على وظيفتك الحالية"
                });
                response.Errors.Add(new Error
                {
                    Code = "-1",
                    Message = "برجاء مراجعة مدير النظام"
                });
                _logger.AppendLine("User not found in GetParent.");
            }

            var userManagerTittle = _gPAContext.EnpoTeamStructures.FirstOrDefault(x => x.Id == userCat.TeamId);

            if (userManagerTittle == null)
            {
                response.Errors.Add(new Error
                {
                    Code = "-1",
                    Message = "لم يتم العثور على وظيفة مديرك المباشر"
                });
                response.Errors.Add(new Error
                {
                    Code = "-1",
                    Message = "برجاء مراجعة مدير النظام"
                });
                _logger.AppendLine("Manager title not found in GetParent.");
            }

            var ManagerCat = _gPAContext.PosUserTeams.FirstOrDefault(x => x.TeamId == userManagerTittle.ParentId);

            if (ManagerCat == null)
            {
                response.Errors.Add(new Error
                {
                    Code = "-1",
                    Message = "لم يتم العثور على وظيفتك الحالية"
                });
                response.Errors.Add(new Error
                {
                    Code = "-1",
                    Message = "برجاء مراجعة مدير النظام"
                });
                _logger.AppendLine("Manager not found in GetParent.");
            }
            else
            {
                _parent = ManagerCat.UserId;
            }
            _logger.AppendLine("GetParent method completed.");
            return _parent;
        }

        public int GetSequenceNextValue(string SeqName)
        {
            using (SqlConnection connection = new SqlConnection(_connectContext.Database.GetConnectionString()))
            {
                connection.Open();

                if (string.Equals(SeqName, "Seq_Tickets", StringComparison.OrdinalIgnoreCase))
                {
                    // Self-heal sequence drift to avoid PK collisions when MessageID max is ahead of sequence.
                    int nextValue;
                    using (SqlCommand nextCommand = new SqlCommand($"SELECT NEXT VALUE FOR {SeqName}", connection))
                    {
                        var nextResult = nextCommand.ExecuteScalar();
                        nextValue = Convert.ToInt32(nextResult);
                    }

                    using (SqlCommand maxCommand = new SqlCommand("SELECT ISNULL(MAX(MessageID), 0) FROM Messages", connection))
                    {
                        var maxResult = maxCommand.ExecuteScalar();
                        var maxMessageId = Convert.ToInt32(maxResult);
                        if (nextValue <= maxMessageId)
                        {
                            var restartWith = maxMessageId + 1;
                            using (SqlCommand resetCommand = new SqlCommand($"ALTER SEQUENCE {SeqName} RESTART WITH {restartWith}", connection))
                            {
                                resetCommand.ExecuteNonQuery();
                            }

                            using (SqlCommand retryCommand = new SqlCommand($"SELECT NEXT VALUE FOR {SeqName}", connection))
                            {
                                var retried = retryCommand.ExecuteScalar();
                                return Convert.ToInt32(retried);
                            }
                        }
                    }

                    return nextValue;
                }

                using (SqlCommand command = new SqlCommand($"SELECT NEXT VALUE FOR {SeqName}", connection))
                {
                    var result = command.ExecuteScalar();
                    return Convert.ToInt32(result);
                }
            }
        }

        public CategoryWithParent? GetType(int type)
        {
            _logger.AppendLine("Starting GetType method.");
            var category = _connectContext.Cdcategories.FirstOrDefault(x => x.CatId == type);
            if (category == null)
            {
                _logger.AppendLine($"Category not found for type: {type}");
                return null;
            }

            _logger.AppendLine($"Category found. CatId: {category.CatId}, CatParent: {category.CatParent}");

            // Traverse up to the top-most parent (root ancestor)
            Cdcategory? parent = null;
            var current = category;
            int safety = 0;
            while (current.CatParent != 0 && current.CatParent > 0)
            {
                if (++safety > 100)
                {
                    _logger.AppendLine("Reached safety iteration limit while traversing category parents. Breaking to avoid infinite loop.");
                    break;
                }

                parent = _connectContext.Cdcategories.FirstOrDefault(x => x.CatId == current.CatParent);
                if (parent == null)
                {
                    _logger.AppendLine($"Parent category with id {current.CatParent} was not found. Stopping traversal.");
                    break;
                }

                _logger.AppendLine($"Traversing to parent. ParentCatId: {parent.CatId}, ParentCatParent: {parent.CatParent}");
                current = parent;
            }

            if (parent == null)
                _logger.AppendLine("No parent found; returning category with null parent.");
            else
                _logger.AppendLine($"Returning category with top-most parent. TopParentCatId: {parent.CatId}");

            return new CategoryWithParent(category, parent);
        }

        private async Task<CommonResponse<Dictionary<string, string>>> GetUserNameList(List<string> userIds)
        {
            var res = new CommonResponse<Dictionary<string, string>>();
            try
            {
                res.Data = await _gPAContext.PosUsers
                    .Where(x => userIds.Contains(x.UserId.ToUpper()))
                    .ToDictionaryAsync(c => c.UserId, c => c.ArabicName);
            }
            catch (Exception ex)
            {
                res.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });
            }
            return res;
        }

        public async Task<CommonResponse<IEnumerable<MessageDto>>> GetReplies(InternalCommunicationDto internalDto, ListRequestModel RequestModel)
        {
            try
            {
                var messageIds = internalDto.commonResponse.Data.Select(s => s.MessageId);

                //var _user = await GetUserDepartmentDictionaryAsync(new List<string> { internalDto.userId });

                var replyDtos = _mapper.Map<List<ReplyDto>>(await _connectContext.Replies
                    .Where(x => messageIds.Contains(x.MessageId)
                    && (RequestModel.requestedData == RequestedData.Inbox ? internalDto.depatmentsList.Contains(x.NextResponsibleSectorId) : true)
                    && (RequestModel.requestedData == RequestedData.Outbox ? internalDto.depatmentsList.Contains(x.NextResponsibleSectorId) || x.AuthorId == internalDto.userId : true)
                    )
                    .ToListAsync());

                // Get Department Names
                //Dictionary<string, string> departmentDictionary = await BuildDepartmentDictionaryAsync(internalDto);

                var distinctAuthorIds = replyDtos.Select(s => s.AuthorId.ToUpper()).Distinct().ToList();

                var Replyusers = await GetUserDepartmentDictionaryAsync(distinctAuthorIds);

                if (!Replyusers.IsSuccess)
                {
                    internalDto.commonResponse.Errors.Add(new Error
                    {
                        Code = "404",
                        Message = "خطأ في الاتصال بقواعد البيات للعثور عن أسماء المستخدمين"
                    });
                    return internalDto.commonResponse;
                }
                var mergedDictionary = Replyusers.Data
                    //.Concat(departmentDictionary)
                    .GroupBy(pair => pair.Key)
                    .ToDictionary(
                        group => group.Key,
                        group => group.First().Value
                    );

                var ReplyIds = replyDtos.Select(s => s.ReplyId).ToList();

                await TransformAttachmentAndReply(internalDto, replyDtos, mergedDictionary, ReplyIds);
            }
            catch (Exception ex)
            {
                internalDto.commonResponse.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });
            }
            return internalDto.commonResponse;
        }
        // New helper method to get user -> department name mapping
        private async Task<CommonResponse<Dictionary<string, string>>> GetUserDepartmentDictionaryAsync(List<string>? userIds = null)
        {
            var res = new CommonResponse<Dictionary<string, string>>();

            try
            {
                var today = DateTime.Today;

                // base positions (valid not expired)
                var basePos = _gPAContext.UserPositions
                    .Where(a => a.StartDate <= today && (a.EndDate == null || a.EndDate >= today));

                // optional filter by userIds (case-insensitive) - applied early
                if (userIds is { Count: > 0 })
                {
                    var upperIds = userIds
                        .Where(x => !string.IsNullOrWhiteSpace(x))
                        .Select(x => x.ToUpper())
                        .Distinct()
                        .ToList();

                    basePos = basePos.Where(p => upperIds.Contains(p.UserId.ToUpper()));
                }

                // Materialize to memory to allow string operations and joins
                var basePosList = await basePos.ToListAsync();

                // Build a list of user ids from base positions (upper-cased) to query PosUsers
                var baseUserIds = basePosList
                    .Select(s => (s.UserId ?? string.Empty).ToUpper())
                    .Where(s => !string.IsNullOrWhiteSpace(s))
                    .Distinct()
                    .ToList();

                var posUsers = await _gPAContext.PosUsers
                    .Where(p => baseUserIds.Contains((p.UserId ?? string.Empty).ToUpper()))
                    .ToListAsync();

                // Get org units (use all units from the view that have a name)
                var orgUnits = await _gPAContext.VwOrgUnitsWithCounts
                    .Where(d => !string.IsNullOrEmpty(d.UnitName)
                    //&& d.ParentTypeId == 13
                    )
                    .ToListAsync();

                var orgDictionary = orgUnits.Select(s => new
                {
                    UserId = s.UnitId.ToString(),
                    DepartmentName = (s.UnitName ?? string.Empty)
                }).ToList();

                // Build mappings by direct UnitId and by ParentId (if exists)
                var byUnitId = (
                    from a in basePosList
                    join u in posUsers on a.UserId equals u.UserId
                    join d in orgUnits on a.UnitId equals d.UnitId
                    select new
                    {
                        UserId = u.UserId,
                        DepartmentName = (u.ArabicName ?? string.Empty) + " - " + (d.UnitName ?? string.Empty)
                    }
                ).ToList();


                // Concatenate and make distinct per user, prefer first non-empty department name
                var list = byUnitId.Concat(orgDictionary)
                    .Where(x => !string.IsNullOrWhiteSpace(x.UserId))
                    .ToList();

                res.Data = list
                    .GroupBy(x => (x.UserId ?? string.Empty).ToUpper())
                    .ToDictionary(
                        g => g.Key.ToLower(),
                        g => g.Select(x => x.DepartmentName).FirstOrDefault(s => !string.IsNullOrWhiteSpace(s)) ?? string.Empty
                    );
            }
            catch (Exception ex)
            {
                _logger.AppendLine($"Error building department dictionary: {ex.Message}");
                res.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });
            }

            return res;
        }
        private async Task TransformAttachmentAndReply(InternalCommunicationDto internalDto, List<ReplyDto> replyDtos, Dictionary<string, string> userDictionary, List<int> ReplyIds)
        {
            var _attachments = await _attach_HeldContext.AttchShipments
                                .Where(x => ReplyIds.Contains(x.AttchId))
                                .ToListAsync();
            var categories = _connectContext.Cdcategories.ToDictionary(u => u.CatId, u => u.CatName);
            internalDto.commonResponse.Data.ToList().ForEach(message =>
            {
                message.Replies = replyDtos
                    .Where(r => r.MessageId == message.MessageId)
                    .ToList();

                if (userDictionary.TryGetValue(message.CreatedBy != null ? message.CreatedBy : "", out var ReplyUserarabicName))
                {
                    message.CreatedBy = ReplyUserarabicName;
                }
                else
                {
                    message.CreatedBy = string.Empty; // or a default userPositionId
                }

                if (userDictionary.TryGetValue(message.CurrentResponsibleSectorId != null ? message.CurrentResponsibleSectorId : "", out var CurrentResponsibleSectorName))
                {
                    message.CurrentResponsibleSectorId = $"{message.CurrentResponsibleSectorId}-{CurrentResponsibleSectorName}";
                }
                if (userDictionary.TryGetValue(message.AssignedSectorId != null ? message.AssignedSectorId : "", out var AssignedSectorName))
                {
                    message.AssignedSectorId = $"{message.AssignedSectorId}-{AssignedSectorName}";
                }


                foreach (var reply in message.Replies)
                {
                    reply.AttchShipmentDtos = _mapper.Map<List<AttchShipmentDto>>(_attachments.Where(x => x.AttchId == reply.ReplyId).ToList());

                    if (userDictionary.TryGetValue(reply.AuthorId, out ReplyUserarabicName))
                    {
                        reply.AuthorName = reply.AuthorId;
                        if (userDictionary.TryGetValue(reply.AuthorId, out var departmentarabicName_from))
                        {
                            reply.AuthorName += $" - {departmentarabicName_from}";
                            if (userDictionary.TryGetValue(reply.NextResponsibleSectorId, out var departmentarabicName_to))
                                reply.NextResponsibleSectorId = departmentarabicName_to;
                        }
                    }
                    else
                    {
                        reply.AuthorName = string.Empty; // or a default userPositionId
                    }
                }
            });
        }

        private async Task<Dictionary<string, string>> BuildDepartmentDictionaryAsync(InternalCommunicationDto internalDto)
        {
            // Get Department Names
            if (internalDto.commonResponse.Data.ToList()[0].Type == 1)
            {
                var result = await _gPAContext.AdmCertDeptUsers
                .Join(_gPAContext.AdmCertDepts, u => u.DepartmentId, d => d.DepartmentId,
                    (u, d) => new AdmCertDeptDto
                    {
                        DepartmentId = d.DepartmentId,
                        UserId = u.UserId,
                        DepartmentName = d.DepartmentName,
                        DepartmentType = d.DepartmentType
                    }).ToListAsync();

                if (result.Any())
                {
                    return result.ToDictionary(u => u.UserId, u => u.DepartmentName);
                }
            }
            else if (internalDto.commonResponse.Data.ToList()[0].Type != 1)
            {
                var currentUserID = internalDto.commonResponse.Data.Select(s => s.CurrentResponsibleSectorId).ToList();
                currentUserID.AddRange(internalDto.commonResponse.Data.Select(s => s.AssignedSectorId).ToList());
                var Replyusers = await GetUserNameList(currentUserID);

                return Replyusers.Data;
            }

            return new Dictionary<string, string>();
        }

        public async Task<CommonResponse<MessageDto>> GetMessageRequestById(int messageId, CommonResponse<MessageDto> response)
        {
            try
            {
                // Get the message
                var message = await _connectContext.Messages
                    .Where(x => x.MessageId == messageId)
                    .FirstOrDefaultAsync();

                if (message == null)
                {
                    response.Errors.Add(new Error { Code = "404", Message = "الطلب غير موجود." });
                    return response;
                }

                // Get related fields and attachments
                var fields = await _connectContext.TkmendFields
                    .Where(field => field.FildRelted == message.MessageId)
                    .ToListAsync();
                var attachments = await _attach_HeldContext.AttchShipments
                    .Where(attachment => attachment.AttchId == message.MessageId)
                    .ToListAsync();

                var replies = await _connectContext.Replies
                    .Where(reply => reply.MessageId == message.MessageId)
                    .OrderBy(reply => reply.ReplyId)
                    .ToListAsync();

                var replyIds = replies
                    .Select(reply => reply.ReplyId)
                    .ToList();

                var replyAttachments = replyIds.Count > 0
                    ? await _attach_HeldContext.AttchShipments
                        .Where(attachment => replyIds.Contains(attachment.AttchId))
                        .ToListAsync()
                    : new List<AttchShipment>();

                var authorIds = replies
                    .Select(reply => (reply.AuthorId ?? string.Empty).Trim())
                    .Where(id => !string.IsNullOrWhiteSpace(id))
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToList();

                var authorNameById = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                if (authorIds.Count > 0)
                {
                    var normalizedAuthorIds = authorIds
                        .Select(id => id.ToUpper())
                        .Distinct()
                        .ToList();

                    authorNameById = await _gPAContext.PosUsers
                        .Where(user => normalizedAuthorIds.Contains(user.UserId.ToUpper()))
                        .Where(user => !string.IsNullOrWhiteSpace(user.UserId))
                        .GroupBy(user => user.UserId.Trim())
                        .ToDictionaryAsync(
                            group => group.Key,
                            group => group.Select(user => user.ArabicName).FirstOrDefault(name => !string.IsNullOrWhiteSpace(name)) ?? group.Key,
                            StringComparer.OrdinalIgnoreCase);
                }

                var replyDtos = replies.Select(reply =>
                {
                    var authorId = (reply.AuthorId ?? string.Empty).Trim();
                    var authorName = authorId;
                    if (!string.IsNullOrWhiteSpace(authorId) && authorNameById.TryGetValue(authorId, out var resolved))
                    {
                        authorName = resolved;
                    }

                    return new ReplyDto
                    {
                        ReplyId = reply.ReplyId,
                        MessageId = reply.MessageId,
                        Message = reply.Message,
                        AuthorId = authorId,
                        AuthorName = authorName,
                        NextResponsibleSectorId = reply.NextResponsibleSectorId,
                        CreatedDate = reply.CreatedDate,
                        AttchShipmentDtos = _mapper.Map<List<AttchShipmentDto>>(
                            replyAttachments.Where(attachment => attachment.AttchId == reply.ReplyId).ToList())
                    };
                }).ToList();

                // Enrich fields with metadata from CdCategoryMand and MandGroups
                var categories = _connectContext.CdCategoryMands
                    .Where(m => m.MendCategory == message.CategoryCd)
                    .ToList();
                var mandGroups = _connectContext.MandGroups.ToList();
                var mandLookup = categories
                    .GroupBy(c => new { Field = c.MendField, Category = c.MendCategory })
                    .ToDictionary(g => g.Key, g => g.First());

                foreach (var f in fields)
                {
                    try
                    {
                        var key = new { Field = f.FildKind, Category = message.CategoryCd };
                        if (mandLookup.TryGetValue(key, out var mand))
                        {
                            f.MendSql = mand.MendSql;
                            f.MendCategory = mand.MendCategory;
                            f.MendStat = mand.MendStat;
                            f.MendGroup = mand.MendGroup;
                            f.ApplicationId = message.AssignedSectorId;
                            var grp = mandGroups.FirstOrDefault(g => g.GroupId == mand.MendGroup);
                            if (grp != null)
                            {
                                f.GroupName = grp.GroupName;
                                f.IsExtendable = grp.IsExtendable;
                                f.GroupWithInRow = grp.GroupWithInRow;
                            }
                        }
                    }
                    catch { }
                }

                // Map message to DTO
                var messageDto = new MessageDto
                {
                    MessageId = message.MessageId,
                    AssignedSectorId = message.AssignedSectorId,
                    CategoryCd = message.CategoryCd,
                    ClosedDate = message.ClosedDate,
                    CreatedBy = message.CreatedBy,
                    CreatedDate = message.CreatedDate,
                    CurrentResponsibleSectorId = message.CurrentResponsibleSectorId,
                    Description = message.Description,
                    DueDate = message.DueDate,
                    Priority = message.Priority,
                    RequestRef = message.RequestRef,
                    Status = message.Status,
                    Subject = message.Subject,
                    Type = message.Type,
                    Fields = fields,
                    Replies = replyDtos,
                    Attachments = attachments
                };

                response.Data = messageDto;
            }
            catch (Exception ex)
            {
                response.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });
            }
            return response;
        }

        public async Task GetDepartments(InternalCommunicationDto internalDto)
        {
            try
            {
                var units = await _gPAContext.OrgUnits
                                    .Where(o =>
                                        _gPAContext.UserPositions.Any(u => u.UserId == internalDto.userId
                                        && u.UnitId == o.UnitId
                                        && u.StartDate <= DateTime.Now.Date && (u.EndDate >= DateTime.Now.Date || u.EndDate == null))
                                        && _gPAContext.OrgUnits.Any(uu => uu.UnitId == o.ParentId
                                        //&& uu.UnitTypeId == 13
                                        ))
                                    .ToListAsync();

                internalDto.depatmentsList = units
                                        .Select(dept => dept.UnitId.ToString())
                                        .ToList();
            }
            catch (Exception ex)
            {
                await _redisManager.LogToRedis<object>(
                    ModelType.Error,
                    ex,
                    "ip",
                    TimeSpan.FromDays(180)
                );
                internalDto.commonResponse.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });

            }
        }
        public async Task BuildSectorIdConditionForDepartmentsAsync(string PropertyName, ListRequestModel RequestModel, InternalCommunicationDto internalDto)
        {
            List<string> _departments = new List<string>();
            await GetDepartments(internalDto);

            if (!internalDto.commonResponse.IsSuccess)
            {
                return;
            }
            await _redisManager.LogToRedis<string>(ModelType.Info, JsonConvert.SerializeObject(internalDto.depatmentsList.ToList(), Formatting.Indented), "ip", TimeSpan.FromDays(180));

            List<Expression<Func<Message, bool>>> expressions = new List<Expression<Func<Message, bool>>>();
            var filters = new Dictionary<string, Expression<Func<Message, bool>>>();


            var typeExpr = ExpressionBuilder.BuildComparisonExpression<Message, byte>("Type", RequestModel.Type, ExpressionType.Equal);
            expressions.Add(typeExpr);
            filters.Add(nameof(RequestModel.Type), typeExpr);

            if ((int)RequestModel.Status != 5)
            {
                var statusExpr = ExpressionBuilder.BuildComparisonExpression<Message, int>("Status", RequestModel.Status, ExpressionType.Equal);
                expressions.Add(statusExpr);
                filters.Add(nameof(RequestModel.Status), statusExpr);
            }

            if (RequestModel.CategoryCd != 0)
            {
                var categoryExpr = ExpressionBuilder.BuildComparisonExpression<Message, int>("CategoryCd", RequestModel.CategoryCd, ExpressionType.Equal);
                expressions.Add(categoryExpr);
                filters.Add(nameof(RequestModel.CategoryCd), categoryExpr);
            }
            await BuildTypeBasedExpressions(PropertyName, RequestModel, internalDto, expressions, filters);

            await _redisManager.LogToRedis<string>(ModelType.Info, JsonConvert.SerializeObject(expressions.Select(e => e.Body.ToString()).ToList(), Formatting.Indented), "ip", TimeSpan.FromDays(180));

            internalDto.expressionMessageFilters = (ExpressionBuilder.CombineAnd(expressions.ToArray()), filters);
        }

        private async Task BuildTypeBasedExpressions(string PropertyName, ListRequestModel RequestModel, InternalCommunicationDto internalDto, List<Expression<Func<Message, bool>>> expressions, Dictionary<string, Expression<Func<Message, bool>>> filters)
        {
            switch (RequestModel.Type)
            {
                case 1:
                    {
                        var departmentExpr = ExpressionBuilder.BuildContainsExpression<Message, string>(PropertyName, internalDto.depatmentsList, true);
                        expressions.Add(departmentExpr);
                        filters.Add("DepartmentList", departmentExpr);
                        break;
                    }

                case 2:
                    {
                        var departmentExpr = ExpressionBuilder.BuildComparisonExpression<Message, string>(PropertyName, internalDto.userId, ExpressionType.Equal);
                        expressions.Add(departmentExpr);
                        filters.Add("DepartmentList", departmentExpr);
                        break;
                    }
                case 4:
                    {
                        var userPositionId = await _gPAContext.UserPositions.FirstOrDefaultAsync(u => u.UserId == internalDto.userId);
                        var departmentExpr = ExpressionBuilder.BuildComparisonExpression<Message, decimal>(PropertyName, userPositionId.UnitId, ExpressionType.Equal);
                        expressions.Add(departmentExpr);
                        filters.Add("DepartmentList", departmentExpr);
                        break;
                    }
            }
        }

        public async Task BuildGenericExpressionAsync(string PropertyName, ListRequestModel RequestModel, InternalCommunicationDto internalDto)
        {
            List<Expression<Func<Message, bool>>> expressions = new List<Expression<Func<Message, bool>>>();
            var filters = new Dictionary<string, Expression<Func<Message, bool>>>();

            try
            {
                await GetDepartments(internalDto);

                string paramsString = BuildParameterString(RequestModel);

                int totalCount = 0;
                List<int> pagedMessageIds = new List<int>();

                if (IsNonSearch(RequestModel, internalDto))
                {
                    (totalCount, pagedMessageIds) = await GetFirstRepliesForPropertyNameAsync(PropertyName, paramsString, RequestModel, internalDto);
                }
                else
                {
                    (totalCount, pagedMessageIds) = await GetPagedFieldIdsForPropertyNameAsync(PropertyName, internalDto.Search.searchText.ToUpper(), internalDto.Search.searchType, RequestModel, internalDto);
                }

                internalDto.commonResponse.TotalCount = totalCount;
                // Build an expression to filter messages based on the retrieved MessageIds
                var ReplyExpr = ExpressionBuilder.BuildContainsExpression<Message, int>("MessageId", pagedMessageIds.Take(RequestModel.pageSize), true);
                expressions.Add(ReplyExpr);
                filters.Add("MessagesIds", ReplyExpr);

            }
            catch (Exception ex)
            {
                await _redisManager.LogToRedis<object>(ModelType.Error, ex, "ip", TimeSpan.FromDays(180));

                // Add the exception details to the response object
                internalDto.commonResponse.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });
            }

            var obj = JsonConvert.SerializeObject(expressions.Select(e => e.Body.ToString()).ToList(), Formatting.Indented);
            await _redisManager.LogToRedis<string>(ModelType.Info, obj, "ip", TimeSpan.FromDays(180));
            internalDto.expressionMessageFilters = (ExpressionBuilder.CombineAnd(expressions.ToArray()), filters);
        }

        private static bool IsNonSearch(ListRequestModel RequestModel, InternalCommunicationDto internalDto)
        {
            return internalDto.Search.SearchKind == SearchKind.NoSearch;
        }

        public async Task<CommonResponse<MessageDto>> ReturnSingleCommonResponseAsync(InternalCommunicationDto internalDto, ListRequestModel RequestModel)
        {
            var response = new CommonResponse<MessageDto>();

            List<Expression<Func<Message, bool>>> expressions = new List<Expression<Func<Message, bool>>>();
            var filters = new Dictionary<string, Expression<Func<Message, bool>>>();

            try
            {
                var existingFilters = internalDto.expressionMessageFilters.GetValueOrDefault();

                if (existingFilters.Combined != null)
                {
                    expressions.Add(existingFilters.Combined);
                }

                if (existingFilters.Filters != null)
                {
                    foreach (var filter in existingFilters.Filters)
                    {
                        if (!filters.ContainsKey(filter.Key))
                        {
                            filters.Add(filter.Key, filter.Value);
                        }
                    }
                }

                if (expressions.Any())
                {
                    internalDto.expressionMessageFilters = (ExpressionBuilder.CombineAnd(expressions.ToArray()), filters);
                }

                var completeResponse = await ReturnCompleteCommonResponseAsync(internalDto, RequestModel);

                response.Errors = completeResponse.Errors;
                response.TotalCount = completeResponse.TotalCount;
                response.PageNumber = completeResponse.PageNumber;
                response.PageSize = completeResponse.PageSize;
                response.Data = completeResponse.Data?.FirstOrDefault();
            }
            catch (Exception ex)
            {
                response.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });
            }

            return response;
        }

        public async Task<CommonResponse<IEnumerable<MessageDto>>> ReturnCompleteCommonResponseAsync(InternalCommunicationDto internalDto, ListRequestModel RequestModel)
        {
            try
            {
                var expressionFilters = internalDto.expressionMessageFilters.GetValueOrDefault();
                var query = _connectContext.Messages
                    .Where(expressionFilters.Combined)
                    .AsQueryable();

                if (expressionFilters.Combined == null)
                {
                    throw new ArgumentNullException(nameof(expressionFilters.Combined), "The predicate cannot be null.");
                }

                // Build the query dynamically
                var messagesq = await query
                    .Distinct()
                    .ToListAsync();

                var list = messagesq.Select(s => s.MessageId).ToList();
                var cat_list = messagesq.Select(s => s.CategoryCd).Distinct().ToList();

                var _fileds = await _connectContext.TkmendFields.Where(r => list.Contains(r.FildRelted)).ToListAsync();


                // Load CdCategoryMand and MandGroups for messages in this page to populate field metadata
                var messageIdsForPage = messagesq.Select(s => s.MessageId).ToList();
                var categories = _connectContext.CdCategoryMands
                    .Where(m => cat_list.Contains(m.MendCategory) || messageIdsForPage.Contains(m.MendSql))
                    .ToList();

                // Load stockholders for messages in this page
                var stockholders = await _connectContext.MessageStockholders
                    .Where(s => s.MessageId != null && messageIdsForPage.Contains(s.MessageId.Value))
                    .ToListAsync();

                var mandGroups = _connectContext.MandGroups.ToList();

                // Build a lookup by MendField and MendCategory (MendField is the field kind)
                var mandLookup = categories.GroupBy(c => new { Field = c.MendField, Category = c.MendCategory })
                    .ToDictionary(g => g.Key, g => g.First());

                var messages = messagesq
                    .Distinct()
                    .GroupJoin(_fileds,
                        message => message.MessageId,
                        field => field.FildRelted,
                        (message, fields) => new MessageDto
                        {
                            MessageId = message.MessageId,
                            AssignedSectorId = message.AssignedSectorId,
                            CategoryCd = message.CategoryCd,
                            ClosedDate = message.ClosedDate,
                            CreatedBy = message.CreatedBy,
                            CreatedDate = message.CreatedDate,
                            CurrentResponsibleSectorId = message.CurrentResponsibleSectorId,
                            Description = message.Description,
                            DueDate = message.DueDate,
                            Priority = message.Priority,
                            RequestRef = message.RequestRef,
                            Status = message.Status,
                            Subject = message.Subject,
                            Type = message.Type,
                            Fields = fields.Select(field =>
                            {
                                var f = new TkmendField
                                {
                                    FildSql = field.FildSql,
                                    FildRelted = field.FildRelted,
                                    FildKind = field.FildKind,
                                    FildTxt = field.FildTxt?.Trim(),
                                    InstanceGroupId = field.InstanceGroupId
                                };

                                try
                                {
                                    // attempt to enrich with mand data using FildKind as MendField and message.CategoryCd as MendCategory
                                    var key = new { Field = f.FildKind, Category = message.CategoryCd };
                                    if (mandLookup.TryGetValue(key, out var mand))
                                    {
                                        f.MendSql = mand.MendSql;
                                        f.MendCategory = mand.MendCategory;
                                        f.MendStat = mand.MendStat;
                                        f.MendGroup = mand.MendGroup;
                                        f.ApplicationId = message.AssignedSectorId; // best-effort fallback
                                        var grp = mandGroups.FirstOrDefault(g => g.GroupId == mand.MendGroup);
                                        if (grp != null)
                                        {
                                            f.GroupName = grp.GroupName;
                                            f.IsExtendable = grp.IsExtendable;
                                            f.GroupWithInRow = grp.GroupWithInRow;
                                        }
                                    }
                                }
                                catch
                                {
                                    // ignore enrichment errors and return basic field
                                }

                                return f;
                            }).ToList()
                        }
                    )
                    //.OrderBy(o => o.ClosedDate)
                    .ToList();
                internalDto.commonResponse.PageNumber = RequestModel.pageNumber;
                internalDto.commonResponse.PageSize = RequestModel.pageSize;
                internalDto.commonResponse.Data = messages;

                await _redisManager.LogToRedis<object>(
                ModelType.Request,
                new { messages.Count, internalDto.commonResponse.TotalCount },
                "ip",
                TimeSpan.FromDays(180)
                );

                if (internalDto.commonResponse.Data.Any())
                    await GetReplies(internalDto, RequestModel);

            }
            catch (Exception ex)
            {
                await _redisManager.LogToRedis<object>(
                    ModelType.Error,
                    ex,
                    "ip",
                    TimeSpan.FromDays(180)
                );
                internalDto.commonResponse.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });
            }
            return internalDto.commonResponse;
        }

        private async Task<(int TotalCount, List<int> PagedMessageIds)> GetFirstRepliesForPropertyNameAsync(string PropertyName, string paramsString, ListRequestModel RequestModel, InternalCommunicationDto internalDto)
        {
            List<string> propValues = GetPropertyValuesForRequest(RequestModel, internalDto);
            // Prepare parameters
            var parameters = new
            {
                Type = RequestModel.Type,
                PageSize = RequestModel.pageSize,
                PageNumber = RequestModel.pageNumber,
                PropertyValues = propValues,
                PropertyText = BuildSearchTextParameter(internalDto)
            };

            // SQL for total count

            // SQL for total count
            string countSql = $@"
            WITH FirstReplies AS (
                SELECT
                    r.MessageID,
                    r.ReplyID,
                    r.{PropertyName},
                    ROW_NUMBER() OVER (PARTITION BY r.MessageID ORDER BY r.ReplyID {(SortOption(RequestModel))} ) AS rn
                FROM Replies r
            )
            SELECT COUNT(*)
            FROM FirstReplies lr
            JOIN Connect.dbo.Messages m ON lr.MessageID = m.MessageID
             WHERE {((IsNonGlobalRequest(RequestModel)) ? $"lr.{PropertyName} IN @PropertyValues AND " : "")}
                   {paramsString} {(RequestModel.requestedData != RequestedData.Outbox ? "AND rn = 1" : "")}  ";


            string pagedSql = @$"
            WITH FirstReplies AS (
                SELECT
                    r.MessageID,
                    r.ReplyID,
                    r.{PropertyName},
                    ROW_NUMBER() OVER (PARTITION BY r.MessageID ORDER BY r.ReplyID {(SortOption(RequestModel))} ) AS rn
                FROM Replies r )
            SELECT lr.MessageID
            FROM FirstReplies lr
                 JOIN CONNECT.dbo.Messages m ON lr.MessageID = m.MessageID
             WHERE {((IsNonGlobalRequest(RequestModel)) ? $"lr.{PropertyName} IN @PropertyValues AND " : "")}
                   {paramsString} {(RequestModel.requestedData != RequestedData.Outbox ? "AND rn = 1" : "")}
                GROUP BY  lr.MessageID
                ORDER BY MessageID
                OFFSET (@PageNumber - 1) * @PageSize ROWS
                FETCH NEXT @PageSize ROWS ONLY";
            try
            {
                using var connection = new SqlConnection(_connectContext.Database.GetConnectionString());

                var totalCount = await connection.ExecuteScalarAsync<int>(countSql, parameters);
                var pagedMessageIds = (await connection.QueryAsync<int>(pagedSql, parameters)).ToList();
                return (totalCount, pagedMessageIds);
            }
            catch (Exception ex)
            {
                internalDto.commonResponse.Errors.Add(new Error { Code = "-1", Message = ex.Message });
            }


            return (0, new List<int>());
        }

        private List<string> GetPropertyValuesForRequest(ListRequestModel RequestModel, InternalCommunicationDto internalDto)
        {
            List<string> propValues = new List<string>();
            if (RequestModel.Type == 1)
            {
                if (RequestModel.requestedData != RequestedData.Outbox)
                    propValues = internalDto.depatmentsList;
                else
                    propValues = new List<string> { internalDto.userId };

            }
            else if (RequestModel.Type == 2)
            {
                if (RequestModel.requestedData != RequestedData.Outbox)
                    propValues = internalDto.depatmentsList;
                else
                    propValues = new List<string> { internalDto.userId };

            }
            else // if (!RequestModel.Type.ToString().Contains("2"))
            {
                var userPositionId = _gPAContext.UserPositions.Where(u => u.UserId == internalDto.userId).ToListAsync();
                userPositionId.GetAwaiter().GetResult().ForEach(u =>
                propValues.Add(u.UnitId.ToString()));
            }

            return propValues;
        }

        private static bool IsNonGlobalRequest(ListRequestModel RequestModel)
        {
            return RequestModel.requestedData != RequestedData.Global;
        }

        private static string BuildSearchTextParameter(InternalCommunicationDto internalDto)
        {
            return internalDto.Search.searchType == "Equal" ? $"{internalDto.Search.searchText}" : internalDto.Search.searchType == "Contains" ? $"%{internalDto.Search.searchText}%" : internalDto.Search.searchType == "Start With" ? $"{internalDto.Search.searchText}%" : $"%{internalDto.Search.searchText}";
        }

        public async Task<(int TotalCount, List<int> PagedFieldIds)> GetPagedFieldIdsForPropertyNameAsync(string PropertyName, string fileText, string searchType, ListRequestModel RequestModel, InternalCommunicationDto internalDto)
        {
            List<string> propValues = GetPropertyValuesForRequest(RequestModel, internalDto);

            var parameters = new
            {
                Type = RequestModel.Type,
                PageSize = RequestModel.pageSize,
                PageNumber = RequestModel.pageNumber,
                AssignedSectorID = internalDto.depatmentsList,
                PropertyName = propValues,
                PropertyValues = internalDto.Search.searchField,
                PropertyText = searchType == "Equal" ? $"{fileText}" : searchType == "Contains" ? $"%{fileText}%" : searchType == "Start With" ? $"{fileText}%" : $"%{fileText}"
            };

            // SQL for total count
            var _type = searchType == "Equal" ? "=" : "LIKE";

            string countSql = @$"
            SELECT COUNT(1)
                    FROM (
                        SELECT tf.FildRelted
                        FROM TkmendFields tf
                       INNER JOIN CONNECT.dbo.Messages m ON tf.FildRelted = m.MessageID 
                 {(IslimitedSearch(RequestModel, internalDto) ? " INNER JOIN CONNECT.dbo.Replies r on m.MessageID  = r.MessageID" : "")}  
                        WHERE tf.FildKind =  @PropertyValues
                          AND tf.FildTxt {_type} @PropertyText 
                     {(IslimitedSearch(RequestModel, internalDto) ? $"AND r.{PropertyName} IN @PropertyName" : "")} 
                    {OwnerCondition(RequestModel, internalDto)}
                          AND m.Type =  @Type
                        GROUP BY tf.FildRelted
                    ) AS sub";



            string pagedSql = @$"
            SELECT FildRelted
            FROM TkmendFields  
                 INNER JOIN CONNECT.dbo.Messages m ON FildRelted = m.MessageID 
                 {(IslimitedSearch(RequestModel, internalDto) ? " INNER JOIN CONNECT.dbo.Replies r on m.MessageID  = r.MessageID" : "")}  
                 WHERE FildKind = @PropertyValues  
                 AND FildTxt {_type} @PropertyText 
                 AND M.Type = @Type 
                {(IslimitedSearch(RequestModel, internalDto) ? $" AND r.{PropertyName} IN @PropertyName" : "")}
                 {OwnerCondition(RequestModel, internalDto)}
                GROUP BY  FildRelted
                ORDER BY FildRelted
                OFFSET (@PageNumber - 1) * @PageSize ROWS
                FETCH NEXT @PageSize ROWS ONLY";
            try
            {
                using var connection = new SqlConnection(_connectContext.Database.GetConnectionString());

                var totalCount = await connection.ExecuteScalarAsync<int>(countSql, parameters);
                var pagedFieldIds = (await connection.QueryAsync<int>(pagedSql, parameters)).ToList();
                return (totalCount, pagedFieldIds);
            }
            catch (Exception ex)
            {
                string jj = ex.Message;
            }


            return (0, new List<int>());
        }

        private static string OwnerCondition(ListRequestModel RequestModel, InternalCommunicationDto internalDto)
        {
            if (RequestModel.requestedData == RequestedData.MyRequest)
                return "AND (m.AssignedSectorID IN @AssignedSectorID) ";
            else return string.Empty;
        }

        private static bool IslimitedSearch(ListRequestModel RequestModel, InternalCommunicationDto internalDto)
        {
            if ((RequestModel.requestedData == RequestedData.Inbox || RequestModel.requestedData == RequestedData.Outbox) && internalDto.Search.SearchKind == SearchKind.LimitedSearch)
                return true;
            else return false;
        }
        private static string BuildParameterString(ListRequestModel RequestModel)
        {
            string paramsString = "";

            paramsString = $"Type = {RequestModel.Type}";

            // Build an expression to filter messages based on their status, if applicable
            if ((int)RequestModel.Status != 5)
            {
                paramsString += $" AND Status =  {(int)RequestModel.Status}";
            }

            // Build an expression to filter messages based on their category code, if applicable
            if (RequestModel.CategoryCd != 0)
            {
                paramsString += $" AND CategoryCd = {RequestModel.CategoryCd}";
            }

            return paramsString;
        }

        private static string? SortOption(ListRequestModel RequestModel)
        {
            return RequestModel.requestedData == RequestedData.MyRequest ? "ASC" : "DESC";
        }

        public static string NormalizeToShortDate(string input)
        {
            if (string.IsNullOrWhiteSpace(input))
                return input;

            // Try to extract a leading "Mon Dec 15 2025 02:00:00" style segment
            var m = System.Text.RegularExpressions.Regex.Match(input, @"^[A-Za-z]{3}\s+[A-Za-z]{3}\s+\d{1,2}\s+\d{4}\s+\d{2}:\d{2}:\d{2}");
            DateTime parsed;
            if (m.Success)
            {
                var part = m.Value; // e.g. "Mon Dec 15 2025 02:00:00"
                var formats = new[] { "ddd MMM d yyyy HH:mm:ss", "ddd MMM dd yyyy HH:mm:ss", "MMM d yyyy HH:mm:ss", "MMM dd yyyy HH:mm:ss" };
                if (DateTime.TryParseExact(part, formats, CultureInfo.InvariantCulture, DateTimeStyles.AssumeLocal, out parsed))
                {
                    return parsed.ToString("yyyy/MM/dd");
                }
            }

            // Fallback: try DateTimeOffset parsing which can handle the GMT+0200 part
            if (DateTimeOffset.TryParse(input, CultureInfo.InvariantCulture, DateTimeStyles.AssumeLocal, out var dto))
            {
                return dto.DateTime.ToString("yyyy/MM/dd");
            }

            // Last resort: DateTime.TryParse
            if (DateTime.TryParse(input, CultureInfo.InvariantCulture, DateTimeStyles.AssumeLocal, out parsed))
            {
                return parsed.ToString("yyyy/MM/dd");
            }

            // If parsing failed, return original input unchanged
            return input;
        }

    }
}
