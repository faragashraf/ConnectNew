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
using Persistence.Data;
using Persistence.HelperServices;
using Repositories;
using SignalR.Notification;
using System;
using System.Globalization;
using Persistence.Services;

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
        public DynamicFormRepository(ConnectContext connectContext, Attach_HeldContext attach_HeldContext, GPAContext gPAContext, IMapper mapper, IOptions<ApplicationConfig> options, helperService helperService, RedisConnectionManager redisManager, SignalRConnectionManager signalRConnectionManager)
        {
            _signalRConnectionManager = signalRConnectionManager;
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
        public async Task<CommonResponse<MessageDto>> CreateRequest(MessageRequest messageRequest, string userId, string UserEmail, string ip)
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
                    && x.MendField == "SummerCamp"
                    && x.MendStat == false);

            // instantiate handler and dispatch accordingly
            var categoryHandler = new HandleEmployeeCategories(_connectContext, _attach_HeldContext, _gPAContext, _helperService, _mapper, _logger, _messageRequestService, _signalRConnectionManager);
            if (isSummerCategory)
            {
                await categoryHandler.SummerRequests(messageRequest, categoryInfo, response);
                _logger.AppendLine("CreateRequest: Handled by SummerRequests path.");
                return response;
            }
            else
            {
                var managementService = new HandleManagementService(_connectContext, _attach_HeldContext, _gPAContext, _helperService, _mapper, _logger, _messageRequestService, _signalRConnectionManager);
                await managementService.SupportiveActivitySector(messageRequest, categoryInfo, userId, UserEmail, ip, response);
                _logger.AppendLine("CreateRequest: Handled by SupportiveActivitySector path.");
                return response;
            }

            _logger.AppendLine("CreateRequest method completed. ---------------------------------------");
            return response;
        }
        public async Task<CommonResponse<MessageDto>> GetRequestById(int messageId)
        {
            var response = new CommonResponse<MessageDto>();
            await _helperService.GetMessageRequestById(messageId, response);
            return response;
        }    }
}
