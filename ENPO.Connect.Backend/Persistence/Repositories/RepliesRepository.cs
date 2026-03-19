using AutoMapper;
using ENPO.CreateLogFile;
using ENPO.Dto.HubSync;
using ENPO.Dto.Utilities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Models.Attachment;
using Models.Correspondance;
using Models.DTO;
using Models.DTO.Common;
using Models.DTO.Correspondance.Enums;
using Models.DTO.Correspondance.Replies;
using Persistence.Data;
using Persistence.HelperServices;
using Repositories;
using SignalR.Notification;

namespace Persistence.Repositories
{
    public class RepliesRepository : IRepliesRepository
    {
        Attach_HeldContext _attach_HeldContext;
        private readonly ENPOCreateLogFile _logger;
        private readonly ApplicationConfig _option;
        private IMapper _mapper;
        private readonly ConnectContext _connectContext;
        private readonly GPAContext _gPAContext;
        private readonly helperService _helperService;
        private readonly SignalRConnectionManager _signalRConnectionManager;

        public RepliesRepository(ConnectContext connectContext, GPAContext gPAContext, IMapper mapper, Attach_HeldContext attach_HeldContext, IOptions<ApplicationConfig> option, helperService helperService,
            SignalRConnectionManager signalRConnectionManager)
        {
            _attach_HeldContext = attach_HeldContext;
            _option = option.Value;
            _connectContext = connectContext;
            _gPAContext = gPAContext;
            _mapper = mapper;
            _helperService = helperService;
            _logger = new ENPOCreateLogFile("C:\\Connect_Log", "RepliesRepository_Log" + DateTime.Today.ToString("dd-MMM-yyyy"), FileExtension.txt);
            _signalRConnectionManager = signalRConnectionManager;
        }

        public async Task<CommonResponse<Reply>> CreateReplyAsync(ReplyCreateRequest dto, string userId, string ip)
        {
            var response = new CommonResponse<Reply>();

            if (string.IsNullOrWhiteSpace(dto.Message))
            {
                response.Errors.Add(new Error { Code = "400", Message = "Reply message is required" });
                return response;
            }

            try
            {
                var message = await _connectContext.Messages.FindAsync(dto.messageId);
                if (message == null)
                {
                    response.Errors.Add(new Error { Code = "404", Message = "Parent message not found" });
                    return response;
                }

                var _NextResposible = dto.NextResponsibleSectorID.Split('@')[0];
                int ReplySql = _helperService.GetSequenceNextValue("Seq_Replies");

                var reply = new Reply
                {
                    ReplyId = ReplySql,
                    MessageId = dto.messageId,
                    Message = dto.Message,
                    AuthorId = userId,
                    CreatedDate = DateTime.Now,
                    NextResponsibleSectorId = _NextResposible,
                    Ip = ip
                };

                await _connectContext.Replies.AddAsync(reply);
                await _connectContext.SaveChangesAsync();

                if (message.Status.Equals(MessageStatus.New))
                {
                    // Update message status if needed
                    message.Status = MessageStatus.InProgress;
                }
                else
                {
                    // Update message status if needed
                    message.Status = MessageStatus.Replied;
                }
                message.CurrentResponsibleSectorId = _NextResposible;
                //message.LastModifiedDate = DateTime.Now;
                await _connectContext.SaveChangesAsync();

                response.Data = reply;
            }
            catch (Exception ex)
            {
                _logger.AppendLine($"[ERROR] Failed to create reply: {ex.Message}");
                response.Errors.Add(new Error { Code = "500", Message = ex.Message });
            }

            return response;
        }

        public async Task<CommonResponse<IEnumerable<ReplyDto>>> GetMessageRepliesAsync(int messageId)
        {
            var response = new CommonResponse<IEnumerable<ReplyDto>>();
            try
            {
                var replies = _connectContext.Replies.Where(x => x.MessageId == messageId).OrderByDescending(o => o.ReplyId).ToList();
                if (!replies.Any())
                {
                    response.Errors.Add(new Error { Code = "404", Message = "لا يوجد مسار لهذه المراسلة حتى تاريخة" });
                    return response;
                }

                var Replyusers = await GetUserNameList(replies.Select(s => s.AuthorId).ToList());

                var replysIds = replies.Select(s => s.ReplyId).ToList();

                if (!Replyusers.IsSuccess)
                {
                    response.Errors.Add(new Error { Code = "404", Message = "خطأ في الاتصال بقواعد البيات للعثور عن أسماء المستخدمين" });
                    return response;
                }

                var userDictionary = Replyusers.Data.ToDictionary(u => u.UserId, u => u.ArabicName);

                var replyDtos = _mapper.Map<IEnumerable<ReplyDto>>(replies);

                var _ittachments = await _attach_HeldContext.AttchShipments
                    .Where(x => replysIds.Contains(x.AttchId) && x.ApplicationName == "Correspondance")
                    .ToArrayAsync();
                var _ittachmentsDtos = _mapper.Map<List<AttchShipmentDto>>(_ittachments);


                foreach (var replyDto in replyDtos)
                {
                    if (userDictionary.TryGetValue(replyDto.AuthorId, out var ReplyUserarabicName))
                    {
                        replyDto.AuthorName = ReplyUserarabicName;
                    }
                    else
                    {
                        replyDto.AuthorName = string.Empty; // or a default value
                    }
                    var replyAttchment = _ittachmentsDtos.Where(x => x.AttchId == replyDto.ReplyId).ToList();
                    if (replyAttchment.Any())
                    {
                        replyDto.AttchShipmentDtos = replyAttchment;
                    }
                }
                response.Data = replyDtos;
            }
            catch (Exception ex)
            {
                _logger.AppendLine($"[ERROR] Failed to Get replies: {ex.Message}");
                response.Errors.Add(new Error { Code = "500", Message = ex.Message });
            }

            return response;
        }

        private async Task<CommonResponse<List<UserDto>>> GetUserNameList(List<string> userIds)
        {
            var res = new CommonResponse<List<UserDto>>();
            try
            {

                res.Data = _gPAContext.PosUsers
                    .Where(x => userIds.Contains(x.UserId.ToLower()))
                    .Select(x => new UserDto
                    {
                        UserId = x.UserId,
                        ArabicName = x.ArabicName
                    })
                    .ToList();
            }
            catch (Exception ex)
            {
                res.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });
            }
            return res;
        }

        public async Task<CommonResponse<Reply>> ReplyWithAttchment(ReplyCreateRequest dto, string usr, string ip)
        {
            var response = new CommonResponse<Reply>();
            if (dto.files != null)
            {
                dto.files.ForEach(file =>
                {
                    if (file.Length > _option.ApiOptions.fileMaxSize)
                    {
                        response.Errors.Add(new Error
                        {
                            Code = "-1",
                            Message = $"حجم المستند اكبر من {_option.ApiOptions.fileMaxSize / 1024 / 1024} ميجا بايت" + Environment.NewLine + "يرجى تقليل مساحة الملف وإعادة المحاولة"
                        });
                    }
                });
            }



            if (response.Errors.Count > 0)
            {
                return response;
            }

            if (string.IsNullOrWhiteSpace(dto.Message))
            {
                response.Errors.Add(new Error { Code = "400", Message = "Reply message is required" });
                return response;
            }

            List<AttchShipment> attchShipments = new List<AttchShipment>();
            using (var modelTransaction = _connectContext.Database.BeginTransaction())
            using (var attachHeldTransaction = _attach_HeldContext.Database.BeginTransaction())
            {
                try
                {
                    //  Oracle DbContext Transaction 
                    var _message = _connectContext.Messages.Where(r => r.MessageId == Convert.ToInt32(dto.messageId)).SingleOrDefault();
                    if (_message == null)
                    {
                        response.Errors.Add(new Error
                        {
                            Code = "-1",
                            Message = "لم يتم العثور على الطلب"
                        });
                    }
                    int ReplySql = _helperService.GetSequenceNextValue("Seq_Replies");

                    var _NextResposible = dto.NextResponsibleSectorID.Split('-')[0];

                    var reply = new Reply
                    {
                        ReplyId = ReplySql,
                        MessageId = dto.messageId,
                        Message = dto.Message,
                        AuthorId = usr,
                        CreatedDate = DateTime.Now,
                        NextResponsibleSectorId = _NextResposible,
                        Ip = ip
                    };

                    await _connectContext.Replies.AddAsync(reply);

                    var units = await _gPAContext.OrgUnits
                                              .Where(o => o.UnitId.Equals(Convert.ToInt32(_NextResposible)))
                                              .ToListAsync();

                    var ll = units
                                            .Select(dept => dept.UnitName.ToString())
                                            .FirstOrDefault();
                    string notification = "";
                    string tittle = "";

                    if (ll.Split('-').Count() > 1 && !ll.Split('-')[1].Trim().Equals("خدمة العملاء"))
                    {
                        _message.Status = MessageStatus.InProgress;
                        tittle = "استلام طلب جديد";
                        notification = $"تم استلام طلب جديد رقم {_message.RequestRef} من {_message.AssignedSectorId}";
                    }
                    else
                    {
                        _message.Status = MessageStatus.Replied;
                        tittle = "رد على الطلب";
                        notification = $"تم الرد على الطلب رقم {_message.RequestRef}";
                    }
                    _message.CurrentResponsibleSectorId = _NextResposible;

                    if (dto.files != null && dto.files.Any())
                    {
                        dto.files.ForEach(async file =>
                        {
                            AttchShipment attchShipment = new AttchShipment();
                            using (var memoryStream = new MemoryStream())
                            {

                                await file.CopyToAsync(memoryStream);

                                attchShipment.AttchId = ReplySql;
                                attchShipment.AttchNm = file.FileName;
                                attchShipment.AttchImg = memoryStream.ToArray();
                                attchShipment.AttchSize = file.Length;
                                attchShipment.AttcExt = Path.GetExtension(file.FileName);

                                attchShipments.Add(attchShipment);
                            }
                        });
                        await _attach_HeldContext.AttchShipments.AddRangeAsync(attchShipments);
                    }

                    //  Sql DbContext Transaction 

                    await _attach_HeldContext.SaveChangesAsync();
                    await _connectContext.SaveChangesAsync();
                    // If everything went well, commit transactions
                    modelTransaction.Commit();
                    attachHeldTransaction.Commit();
                    response.Data = reply;

                    _signalRConnectionManager.SendNotificationToGroup(_NextResposible, new NotificationDto
                    {
                        Notification = notification,
                        type = NotificationType.info,
                        Title = tittle,
                        time = DateTime.Now,
                        sender = "System",
                        Category = NotificationCategory.System
                    });
                }
                catch (Exception ex)
                {
                    // If an error occurred, roll back both transactions
                    attachHeldTransaction.Rollback();
                    modelTransaction.Rollback();
                    response.Errors.Add(new Error
                    {
                        Code = "-1",
                        Message = ex.Message
                    });
                    _logger.AppendLine($"[ERROR] Failed to create reply: {ex.Message}");
                    response.Errors.Add(new Error { Code = "500", Message = ex.Message });
                }
            }
            return response;
        }

    }
}