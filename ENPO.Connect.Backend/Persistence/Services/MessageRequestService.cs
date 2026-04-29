using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using AutoMapper;
using ENPO.CreateLogFile;
using Microsoft.EntityFrameworkCore;
using Models.Attachment;
using Models.Correspondance;
using Models.DTO.Common;
using Models.DTO.Correspondance;
using Persistence.Data;
using Persistence.HelperServices;
using Persistence.Services.Summer;

namespace Persistence.Services
{
    public class MessageRequestService
    {
        private readonly ConnectContext _connectContext;
        private readonly Attach_HeldContext _attach_HeldContext;
        private readonly GPAContext _gPAContext;
        private readonly helperService _helperService;
        private readonly IMapper _mapper;
        private readonly ENPOCreateLogFile _logger;

        public MessageRequestService(ConnectContext connectContext, Attach_HeldContext attach_HeldContext, GPAContext gPAContext, helperService helperService, IMapper mapper, ENPOCreateLogFile logger)
        {
            _connectContext = connectContext;
            _attach_HeldContext = attach_HeldContext;
            _gPAContext = gPAContext;
            _helperService = helperService ?? throw new ArgumentNullException(nameof(helperService));
            _mapper = mapper;
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        // Prepare the message request: set ids, type and assigned sectors. Returns false if validation fails and response contains errors
        public bool PrepareMessageRequest(MessageRequest messageRequest, string userId, CommonResponse<MessageDto> response)
        {

            var categoryInfo = _helperService.GetType(messageRequest.CategoryCd);
            if (categoryInfo != null)
            {
                messageRequest.Type = (byte)categoryInfo.ParentCategory.CatId;
            }
            else
            {
                response.Errors.Add(new Error { Code = "404", Message = "Category not found" });
                return false;
            }
            return true;
        }

        // Persist reply, message, fields and attachments to the DbContexts (does not SaveChanges)
        public async Task PersistEntitiesAsync(MessageRequest messageRequest, Reply reply)
        {
            try
            {
                await _connectContext.Replies.AddAsync(reply);
                _logger.AppendLine("Reply created and added to context.");

                var messageEntity = _mapper.Map<Message>(messageRequest);
                await _connectContext.Messages.AddAsync(messageEntity);
                _logger.AppendLine("Message created and added to context.");

                if (messageRequest.Fields != null && messageRequest.Fields.Any())
                {
                    var msgId = messageRequest.MessageId.HasValue ? messageRequest.MessageId.Value : throw new InvalidOperationException("MessageId not set");
                    var dateFieldKinds = await _connectContext.Cdmends
                        .AsNoTracking()
                        .Where(x => x.CdmendType != null
                            && x.CdmendTxt != null
                            && x.CdmendType.ToLower() == "date")
                        .Select(x => x.CdmendTxt!.Trim())
                        .Distinct()
                        .ToListAsync();
                    var dateFieldKindSet = new HashSet<string>(dateFieldKinds, StringComparer.OrdinalIgnoreCase);
                    messageRequest.Fields.ForEach(f =>
                    {
                        f.FildRelted = msgId;
                        f.FildSql = 0;
                        // Keep the client-provided instance id as-is.
                        // Frontend sends stable instance numbering and edits rely on exact matching.

                        if (ShouldNormalizeToShortDate(f.FildKind, f.FildTxt, dateFieldKindSet))
                        {
                            f.FildTxt = helperService.NormalizeToShortDate(f.FildTxt!);
                        }
                    });
                    await _connectContext.TkmendFields.AddRangeAsync(messageRequest.Fields);
                    _logger.AppendLine("Fields added to context.");
                }

                if (messageRequest.files != null && messageRequest.files.Any())
                {
                    var attchShipments = new List<AttchShipment>();
                    await _helperService.SaveAttachments(messageRequest.files, reply.ReplyId, attchShipments);
                    if (attchShipments.Any())
                    {
                        await _attach_HeldContext.AttchShipments.AddRangeAsync(attchShipments);
                        _logger.AppendLine("Attachments saved and added to context.");
                    }
                }
            }
            catch (Exception ex)
            {
                try
                {
                    _logger.AppendLine($"An error occurred while persisting entities: {ex.Message}");
                    _logger.AppendLine(ex.ToString());
                }
                catch
                {
                    // Swallow any logging exceptions to avoid masking the original exception
                }

                throw;
            }
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

            if (string.Equals(normalizedKind, SummerWorkflowDomainConstants.PaymentDueAtUtcFieldKind, StringComparison.OrdinalIgnoreCase)
                || string.Equals(normalizedKind, SummerWorkflowDomainConstants.PaidAtUtcFieldKind, StringComparison.OrdinalIgnoreCase)
                || string.Equals(normalizedKind, SummerWorkflowDomainConstants.RequestCreatedAtUtcFieldKind, StringComparison.OrdinalIgnoreCase))
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
    }
}
