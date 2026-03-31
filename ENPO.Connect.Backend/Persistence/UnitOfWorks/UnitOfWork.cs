using AutoMapper;
using Core;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Internal;
using Microsoft.Extensions.Options;
using Models.DTO.Common;
using Persistence.Data;
using Persistence.HelperServices;
using Persistence.Repositories;
using Persistence.Services.Notifications;
using Repositories;
using SignalR.Notification;

namespace Persistence.UnitOfWorks
{
    public class UnitOfWork : IUnitOfWork
    {
        private readonly IOptions<ApplicationConfig> _option; // Change type to IOptions<ApplicationConfig>
        private readonly ConnectContext _connectContext;
        private readonly GPAContext _gPAContext;
        private readonly Attach_HeldContext _attach_HeldContext;
        private IMapper _mapper;
        private readonly helperService _helperService;
        private readonly SignalRConnectionManager _signalRConnectionManager;
        private readonly IHttpContextAccessor _httpContextAccessor;
        private readonly RedisConnectionManager _redisManager;
        private readonly IConnectNotificationService _connectNotificationService;
        private readonly IOptionsMonitor<ResortBookingBlacklistOptions> _resortBookingBlacklistOptions;

        public UnitOfWork(ConnectContext connectContext,
            GPAContext gPAContext, IMapper mapper,
            Attach_HeldContext attach_HeldContext,
            IOptions<ApplicationConfig> option,
            IOptionsMonitor<ResortBookingBlacklistOptions> resortBookingBlacklistOptions,
            helperService helperService, SignalRConnectionManager signalRConnectionManager, IHttpContextAccessor httpContextAccessor, RedisConnectionManager redisManager, IConnectNotificationService connectNotificationService)
        {
            _option = option; // Assign IOptions<ApplicationConfig> directly
            _resortBookingBlacklistOptions = resortBookingBlacklistOptions;
            _connectContext = connectContext;
            _mapper = mapper;
            _gPAContext = gPAContext;
            _attach_HeldContext = attach_HeldContext;
            _helperService = helperService;
            _signalRConnectionManager = signalRConnectionManager;
            _httpContextAccessor = httpContextAccessor;
            _redisManager = redisManager;
            _connectNotificationService = connectNotificationService;

            administrativeCertificateRepository = new AdministrativeCertificateRepository(_connectContext, _gPAContext, _mapper, _option, _helperService, _attach_HeldContext, _signalRConnectionManager, _httpContextAccessor, _redisManager);
            dynamicFormRepository = new DynamicFormRepository(_connectContext, _attach_HeldContext, _gPAContext, _mapper, _option, _resortBookingBlacklistOptions, _helperService, _redisManager, _signalRConnectionManager, _connectNotificationService);
            RepliesRepository = new RepliesRepository(_connectContext, _gPAContext, _mapper, _attach_HeldContext, _option, _helperService,_signalRConnectionManager);
            landTransport = new landTransportRepository(_gPAContext, _mapper, _option);
            attachMentsRepositories = new AttachMentsRepositories(_attach_HeldContext, _connectContext, _option, _mapper);
        }

        public IAdministrativeCertificateRepository administrativeCertificateRepository { get; set; }
        public IDynamicFormRepository dynamicFormRepository { get; set; }
        public IRepliesRepository RepliesRepository { get; set; }
        public IAttachMentsRepositories attachMentsRepositories { get; }
        public ILandTransport landTransport { get; set; }

        public async Task<int> CompleteAsync()
        {
            int totalChanges = 0;

            // Save changes for connectContext
            totalChanges += await _connectContext.SaveChangesAsync();

            // Save changes for GPAContext
            totalChanges += await _gPAContext.SaveChangesAsync();

            // Save changes for Attach_HeldContext
            totalChanges += await _attach_HeldContext.SaveChangesAsync();

            return totalChanges;
        }

        public int Complete()
        {
            int totalChanges = 0;

            // Save changes for connectContext
            totalChanges += _connectContext.SaveChanges();

            // Save changes for GPAContext
            totalChanges += _gPAContext.SaveChanges();

            // Save changes for Attach_HeldContext
            totalChanges += _attach_HeldContext.SaveChanges();

            return totalChanges;
        }
        public void Dispose()
        {
            _connectContext.Dispose();
            _gPAContext.Dispose();
            _attach_HeldContext.Dispose();
        }
    }
}
