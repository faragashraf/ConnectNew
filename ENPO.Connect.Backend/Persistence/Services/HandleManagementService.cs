using System;
using System.Threading.Tasks;
using AutoMapper;
using Microsoft.EntityFrameworkCore;
using ENPO.CreateLogFile;
using Models.DTO.Correspondance;
using Models.DTO.Common;
using Persistence.Data;
using Persistence.HelperServices;
using Models.Correspondance;
using System.Linq;
using ENPO.Dto.Utilities;
using SignalR.Notification;
using ENPO.Dto.HubSync;

namespace Persistence.Services
{
    public class HandleManagementService
    {
        private readonly ConnectContext _connectContext;
        private readonly Attach_HeldContext _attach_HeldContext;
        private readonly GPAContext _gPAContext;
        private readonly helperService _helperService;
        private readonly IMapper _mapper;
        private readonly ENPOCreateLogFile _logger;
        private readonly MessageRequestService _messageRequestService;
        private readonly SignalRConnectionManager _signalRConnectionManager;

        public HandleManagementService(ConnectContext connectContext, Attach_HeldContext attach_HeldContext, GPAContext gPAContext, helperService helperService, IMapper mapper, ENPOCreateLogFile logger, MessageRequestService messageRequestService, SignalRConnectionManager signalRConnectionManager)
        {
            _connectContext = connectContext;
            _attach_HeldContext = attach_HeldContext;
            _gPAContext = gPAContext;
            _helperService = helper_service_check(helperService);
            _mapper = mapper;
            _logger = logger ?? new ENPOCreateLogFile("C:\\Connect_Log", "HandleManagementService_Log" + DateTime.Today.ToString("dd-MMM-yyyy"), FileExtension.txt);
            _messageRequestService = messageRequestService ?? throw new ArgumentNullException(nameof(messageRequestService));
            _signalRConnectionManager = signalRConnectionManager ?? throw new ArgumentNullException(nameof(signalRConnectionManager));
        }

        private helperService helper_service_check(helperService svc)
        {
            if (svc == null) throw new ArgumentNullException(nameof(svc));
            return svc;
        }

        // Handling for categories other than ENPO. Implements distinct flow: prepare request, persist and return created message in response.
        public async Task SupportiveActivitySector(MessageRequest messageRequest, CategoryWithParent categoryInfo, string userId, string userEmail, string ip, CommonResponse<MessageDto> response)
        {
            if (messageRequest == null) throw new ArgumentNullException(nameof(messageRequest));
            if (response == null) throw new ArgumentNullException(nameof(response));

            // Validate file sizes
            if (!_helperService.ValidateFileSizes(messageRequest.files, response))
            {
                _logger.AppendLine("File size validation failed in SupportiveActivitySector.");
                return;
            }

            var attchShipments = new System.Collections.Generic.List<Models.Attachment.AttchShipment>();

            using (var correspondence = _connectContext.Database.BeginTransaction())
            using (var attachHeldTransaction = _attach_HeldContext.Database.BeginTransaction())
            {
                try
                {
                    // Prepare using shared service
                    var prepResult = _messageRequestService.PrepareMessageRequest(messageRequest, userId, response);
                    if (!prepResult)
                    {
                        return;
                    }

                    // Create reply and persist entities via shared service
                    var reply = _helperService.CreateReply(messageRequest.MessageId.HasValue ? messageRequest.MessageId.Value : throw new InvalidOperationException("MessageId not set"), " „ «‰‘«¡ «·ÿ·» »‰Ã«Õ", userId, messageRequest.AssignedSectorId, ip);
                    await _messageRequestService.PersistEntitiesAsync(messageRequest, reply);

                    // Save and commit
                    await _attach_HeldContext.SaveChangesAsync();
                    await _connectContext.SaveChangesAsync();
                    correspondence.Commit();
                    attachHeldTransaction.Commit();

                    _logger.AppendLine($"SupportiveActivitySector: created message {messageRequest.MessageId} with RequestRef {messageRequest.RequestRef}");

                    // Post commit actions and fetch created message
                    try
                    {
                        await PostCommitActionsAsync(messageRequest, reply, categoryInfo);
                    }
                    catch (Exception postEx)
                    {
                        _logger.AppendLine($"PostCommitActions failed: {postEx.Message}");
                    }

                    await _helperService.GetMessageRequestById(messageRequest.MessageId.HasValue ? messageRequest.MessageId.Value : throw new InvalidOperationException("MessageId not set"),  response);
                }
                catch (Exception ex)
                {
                    attachHeldTransaction.Rollback();
                    correspondence.Rollback();
                    _helperService.HandleException(response, ex);
                }
            }
        }

        private async Task PostCommitActionsAsync(MessageRequest messageRequest, Reply reply, CategoryWithParent categoryInfo)
        {
            var category = categoryInfo?.ParentCategory;
            await _signalRConnectionManager.SendNotificationToUser(messageRequest.CreatedBy, new NotificationDto
            {
                Notification = $" „  ”ÃÌ· „Ê÷Ê⁄ {category?.CatName} ÃœÌœ »—ﬁ„ {messageRequest.RequestRef}",
                type = NotificationType.info,
                Title = " „  ”ÃÌ· „Ê÷Ê⁄ ÃœÌœ",
                time = DateTime.Now,
                sender = "Connect",
                Category = NotificationCategory.Business
            });
            _logger.AppendLine("Transactions committed.");
        }
    }
}
