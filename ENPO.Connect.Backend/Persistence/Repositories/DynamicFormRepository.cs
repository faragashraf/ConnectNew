using AutoMapper;
using ENPO.CreateLogFile;
using ENPO.Dto.HubSync;
using ENPO.Dto.Utilities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Options;
using Models.Attachment;
using Models.Correspondance;
using Models.DTO.Correspondance;
using Models.DTO.Common;
using Models.DTO.Correspondance.AdminCertificates;
using Models.DTO.DynamicSubjects;
using Persistence.Data;
using Persistence.HelperServices;
using Persistence.Services.Notifications;
using Repositories;
using SignalR.Notification;
using System;
using System.Globalization;
using Persistence.Services;
using Persistence.Services.Summer;

namespace Persistence.Repositories
{
    public class DynamicFormRepository : IDynamicFormRepository
    {
        private readonly ApplicationConfig _option;
        private readonly ENPOCreateLogFile _logger;
        private readonly IConfiguration _config;
        private IMapper _mapper;
        private readonly ConnectContext _connectContext;
        Attach_HeldContext _attach_HeldContext;
        private readonly GPAContext _gPAContext;
        private readonly helperService _helperService;
        private readonly RedisConnectionManager _redisManager;
        private readonly SignalRConnectionManager _signalRConnectionManager;
        private readonly MessageRequestService _messageRequestService;
        private readonly IConnectNotificationService _notificationService;
        private readonly ISubjectNotificationService _subjectNotificationService;
        private readonly SummerPricingService _summerPricingService;
        private readonly SummerBookingBlacklistService _summerBookingBlacklistService;
        private readonly SummerUnitFreezeService _summerUnitFreezeService;

        public DynamicFormRepository(
            ConnectContext connectContext,
            Attach_HeldContext attach_HeldContext,
            GPAContext gPAContext,
            IMapper mapper,
            IOptions<ApplicationConfig> options,
            IOptionsMonitor<ResortBookingBlacklistOptions> resortBookingBlacklistOptions,
            helperService helperService,
            RedisConnectionManager redisManager,
            SignalRConnectionManager signalRConnectionManager,
            IConnectNotificationService notificationService,
            ISubjectNotificationService subjectNotificationService)
        {
            _signalRConnectionManager = signalRConnectionManager;
            _notificationService = notificationService;
            _subjectNotificationService = subjectNotificationService;
            _option = options.Value;
            _connectContext = connectContext;
            _attach_HeldContext = attach_HeldContext;
            _gPAContext = gPAContext;
            _mapper = mapper;
            _redisManager = redisManager;
            _logger = new ENPOCreateLogFile("C:\\Connect_Log", "DynamicForm_Log" + DateTime.Today.ToString("dd-MMM-yyyy"), FileExtension.txt);
            _helperService = new helperService(_gPAContext, _connectContext, _attach_HeldContext, _option, _logger, _mapper, _redisManager);
            // instantiate the message request service for shared prepare/persist logic
            _messageRequestService = new MessageRequestService(_connectContext, _attach_HeldContext, _gPAContext, _helperService, _mapper, _logger);
            _summerPricingService = new SummerPricingService(_connectContext);
            _summerBookingBlacklistService = new SummerBookingBlacklistService(resortBookingBlacklistOptions);
            _summerUnitFreezeService = new SummerUnitFreezeService(_connectContext);
        }
        public CommonResponse<IEnumerable<CdmendDto>> GetMandatoryMetaDate(string? appId)
        {
            var res = new CommonResponse<IEnumerable<CdmendDto>>();

            try
            {
                IQueryable<Cdmend> query = _connectContext.Cdmends;
                if (!string.IsNullOrEmpty(appId))
                {
                    query = query.Where(x => x.ApplicationId == appId);
                }
                var _result = query.ToList();
                res.Data = _mapper.Map<IEnumerable<CdmendDto>>(_result);
            }
            catch (Exception ex)
            {
                res.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });
            }
            return res;
        }
        public CommonResponse<IEnumerable<CdCategoryMandDto>> GetMandatoryAll(string? appId)
        {
            var response = new CommonResponse<IEnumerable<CdCategoryMandDto>>();
            try
            {
                IQueryable<Cdcategory> cats = _connectContext.Cdcategories;
                if (!string.IsNullOrEmpty(appId))
                {
                    cats = cats.Where(x => x.ApplicationId == appId);
                }

                response.Data = (from mand in _connectContext.CdCategoryMands.Where(t => t.MendStat == false)
                                 join cat in cats
                                   on mand.MendCategory equals cat.CatId
                                 join g in _connectContext.MandGroups on mand.MendGroup equals g.GroupId into mg
                                 from g in mg.DefaultIfEmpty()
                                 select new CdCategoryMandDto
                                 {
                                     MendSql = mand.MendSql,
                                     MendCategory = mand.MendCategory,
                                     MendField = mand.MendField,
                                     MendStat = mand.MendStat,
                                     MendGroup = mand.MendGroup,
                                     ApplicationId = cat.ApplicationId,
                                     GroupName = g != null ? g.GroupName : null,
                                     IsExtendable = g != null ? g.IsExtendable : null,
                                     GroupWithInRow = g != null ? g.GroupWithInRow : null
                                 })
                              .OrderBy(o => o.MendSql)
                              .ToList();
            }
            catch (Exception ex)
            {
                response.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });
                //_logger.LogError(ex, "Failed to retrieve mandatory fields");
            }
            return response;
        }
        public CommonResponse<IEnumerable<CdcategoryDto>> GetAllCategories(string? appId)
        {
            var res = new CommonResponse<IEnumerable<CdcategoryDto>>();
            try
            {
                IQueryable<Cdcategory> query = _connectContext.Cdcategories;
                if (!string.IsNullOrEmpty(appId))
                {
                    query = query.Where(x => x.ApplicationId == appId);
                }
                var _result = query.ToList();
                res.Data = _mapper.Map<IEnumerable<CdcategoryDto>>(_result);
            }
            catch (Exception ex)
            {
                res.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });
            }
            return res;
        }
        public async Task<CommonResponse<MessageDto>> CreateRequest(
            MessageRequest messageRequest,
            string userId,
            string UserEmail,
            string ip,
            bool hasSummerAdminPermission = false)
        {
            var response = new CommonResponse<MessageDto>();

            _logger.AppendLine("Starting CreateRequest method. ---------------------------------------");

            // Early category-based handling:
            // route to SummerRequests only for categories that actually contain summer fields.
            var categoryInfo = _helperService.GetType(messageRequest.CategoryCd);
            if (categoryInfo == null)
            {
                response.Errors.Add(new Error { Code = "404", Message = "Category not found" });
                return response;
            }

            var isSummerCategory = _connectContext.CdCategoryMands
                .AsNoTracking()
                .Any(x => x.MendCategory == messageRequest.CategoryCd
                    && x.MendField.Contains("SUM2026")
                    && x.MendStat == false);

            // instantiate handler and dispatch accordingly
            var categoryHandler = new HandleEmployeeCategories(
                _connectContext,
                _attach_HeldContext,
                _gPAContext,
                _helperService,
                _mapper,
                _logger,
                _messageRequestService,
                _notificationService,
                _summerPricingService,
                _summerBookingBlacklistService,
                _summerUnitFreezeService);
            if (isSummerCategory)
            {
                await categoryHandler.SummerRequests(
                    messageRequest,
                    categoryInfo,
                    response,
                    userId,
                    new SummerRequestRuntimeOptions
                    {
                        HasSummerAdminPermission = hasSummerAdminPermission
                    });
                await TrySendCreateNotificationAsync(response?.Data);
                _logger.AppendLine("CreateRequest: Handled by SummerRequests path.");
                return response;
            }
            else
            {
                var managementService = new HandleManagementService(_connectContext, _attach_HeldContext, _gPAContext, _helperService, _mapper, _logger, _messageRequestService, _signalRConnectionManager);
                await managementService.SupportiveActivitySector(messageRequest, categoryInfo, userId, UserEmail, ip, response);
                await TrySendCreateNotificationAsync(response?.Data);
                _logger.AppendLine("CreateRequest: Handled by SupportiveActivitySector path.");
                return response;
            }

            _logger.AppendLine("CreateRequest method completed. ---------------------------------------");
            return response;
        }
        public async Task<CommonResponse<MessageDto>> GetRequestById(int messageId, string userId)
        {
            var response = new CommonResponse<MessageDto>();

            if (messageId <= 0)
            {
                response.Errors.Add(new Error { Code = "400", Message = "رقم الطلب مطلوب." });
                return response;
            }

            var normalizedUserId = (userId ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(normalizedUserId))
            {
                response.Errors.Add(new Error { Code = "401", Message = "المستخدم غير مصرح." });
                return response;
            }

            var message = await _connectContext.Messages
                .AsNoTracking()
                .FirstOrDefaultAsync(m => m.MessageId == messageId);
            if (message == null)
            {
                response.Errors.Add(new Error { Code = "404", Message = "الطلب غير موجود." });
                return response;
            }

            if (await IsSummerCategoryAsync(message.CategoryCd)
                && !await CanUserAccessSummerMessageAsync(normalizedUserId, message))
            {
                response.Errors.Add(new Error { Code = "404", Message = "الطلب غير موجود." });
                return response;
            }

            await _helperService.GetMessageRequestById(messageId, response);
            return response;
        }

        private async Task<bool> IsSummerCategoryAsync(int categoryId)
        {
            if (categoryId <= 0)
            {
                return false;
            }

            return await _connectContext.CdCategoryMands
                .AsNoTracking()
                .AnyAsync(item =>
                    item.MendCategory == categoryId
                    && item.MendStat == false
                    && item.MendField.Contains("SUM2026"));
        }

        private async Task<bool> CanUserAccessSummerMessageAsync(string userId, Message message)
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

            var userUnitIds = await GetActiveUserUnitIdsAsync(normalizedUserId);
            if (userUnitIds.Count > 0)
            {
                var assignedSectorId = (message.AssignedSectorId ?? string.Empty).Trim();
                var currentResponsibleSectorId = (message.CurrentResponsibleSectorId ?? string.Empty).Trim();
                if (userUnitIds.Contains(assignedSectorId, StringComparer.OrdinalIgnoreCase)
                    || userUnitIds.Contains(currentResponsibleSectorId, StringComparer.OrdinalIgnoreCase))
                {
                    return true;
                }
            }

            var ownerEmployeeId = await _connectContext.TkmendFields
                .AsNoTracking()
                .Where(field => field.FildRelted == message.MessageId
                    && SummerWorkflowDomainConstants.EmployeeIdFieldKinds.Contains(field.FildKind))
                .Select(field => field.FildTxt)
                .FirstOrDefaultAsync();

            return string.Equals(
                (ownerEmployeeId ?? string.Empty).Trim(),
                normalizedUserId,
                StringComparison.OrdinalIgnoreCase);
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

        private async Task TrySendCreateNotificationAsync(MessageDto? message)
        {
            if (message == null || message.MessageId <= 0 || message.CategoryCd <= 0)
            {
                return;
            }

            await _subjectNotificationService.SendNotificationAsync(new SubjectNotificationDispatchRequestDto
            {
                EventType = "CREATE",
                SubjectTypeId = message.CategoryCd,
                Payload = new SubjectNotificationPayloadDto
                {
                    RequestId = message.MessageId,
                    RequestTitle = message.Subject,
                    CreatedBy = message.CreatedBy,
                    UnitName = message.AssignedSectorId
                }
            });
        }
    }
}
