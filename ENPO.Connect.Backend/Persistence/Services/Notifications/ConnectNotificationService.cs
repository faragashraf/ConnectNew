using ENPO.Dto.HubSync;
using ENPO.Dto.Notifications;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Models.DTO.Common;
using Persistence.Data;
using SignalR.Notification;
using System.Text.RegularExpressions;

namespace Persistence.Services.Notifications
{
    public class ConnectNotificationService : IConnectNotificationService
    {
        private static readonly Regex PlaceholderRegex = new(@"\{([A-Za-z0-9_]+)\}", RegexOptions.Compiled);

        private readonly GPAContext _gpaContext;
        private readonly SignalRConnectionManager _signalRConnectionManager;
        private readonly ApplicationConfig _applicationConfig;
        private readonly ILogger<ConnectNotificationService> _logger;

        public ConnectNotificationService(
            GPAContext gpaContext,
            SignalRConnectionManager signalRConnectionManager,
            IOptions<ApplicationConfig> options,
            ILogger<ConnectNotificationService> logger)
        {
            _gpaContext = gpaContext;
            _signalRConnectionManager = signalRConnectionManager;
            _applicationConfig = options?.Value ?? new ApplicationConfig();
            _logger = logger;
        }

        public string RenderTemplate(string? template, IReadOnlyDictionary<string, string?> placeholders)
        {
            if (string.IsNullOrWhiteSpace(template))
            {
                return string.Empty;
            }

            var map = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);
            if (placeholders != null)
            {
                foreach (var item in placeholders)
                {
                    map[item.Key] = item.Value;
                }
            }

            var rendered = PlaceholderRegex.Replace(template, match =>
            {
                var token = match.Groups[1].Value;
                if (map.TryGetValue(token, out var value))
                {
                    return value ?? string.Empty;
                }
                return string.Empty;
            });

            return Regex.Replace(rendered, @"\s{2,}", " ").Trim();
        }

        public Task<CommonResponse<bool>> SendSmsAsync(SmsDispatchRequest request, CancellationToken cancellationToken = default)
        {
            var smsOptions = _applicationConfig.NotificationChannels?.Sms ?? new SmsChannelOptions();
            var provider = NormalizeSmsProvider(smsOptions.Provider);
            if (provider == "MULTI_MESSAGES")
            {
                return SendSmsByMultiMessagesAsync(request, cancellationToken);
            }

            return SendSmsByEnqueueAsync(request, cancellationToken);
        }

        public Task<CommonResponse<bool>> SendSmsByMultiMessagesAsync(SmsDispatchRequest request, CancellationToken cancellationToken = default)
        {
            var response = new CommonResponse<bool>();

            try
            {
                var smsOptions = _applicationConfig.NotificationChannels?.Sms ?? new SmsChannelOptions();
                if (!smsOptions.Enabled)
                {
                    response.Data = true;
                    return Task.FromResult(response);
                }

                if (request == null || string.IsNullOrWhiteSpace(request.MobileNumber) || string.IsNullOrWhiteSpace(request.Message))
                {
                    response.Errors.Add(new Error
                    {
                        Code = "400",
                        Message = "SMS payload is invalid."
                    });
                    return Task.FromResult(response);
                }

                var userName = (smsOptions.MultiMessagesUserName ?? string.Empty).Trim();
                var password = (smsOptions.MultiMessagesPassword ?? string.Empty).Trim();
                if (string.IsNullOrWhiteSpace(userName) || string.IsNullOrWhiteSpace(password))
                {
                    response.Errors.Add(new Error
                    {
                        Code = "400",
                        Message = "SMS multi-messages credentials are missing."
                    });
                    return Task.FromResult(response);
                }

                var payload = new List<MessageModel>
                {
                    new MessageModel
                    {
                        SMSText = request.Message.Trim(),
                        MobileNo = request.MobileNumber.Trim()
                    }
                };

                var smsResponse = ENPO.Notifications.ENPONotifications
                    .SendSMSListWithMultiMessages(payload, userName, password);

                if (smsResponse?.IsSuccess == true)
                {
                    var failedItems = (smsResponse.Data ?? new List<SMSResponseModel>())
                        .Where(item => item != null && !item.SMSIsSuccess)
                        .ToList();

                    if (!failedItems.Any())
                    {
                        response.Data = true;
                        return Task.FromResult(response);
                    }

                    foreach (var item in failedItems)
                    {
                        response.Errors.Add(new Error
                        {
                            Code = "SMS_MULTI_SEND_FAILED",
                            Message = $"Failed to send SMS to {item.MobileNo}: {item.SMSResult}"
                        });
                    }
                    return Task.FromResult(response);
                }

                AppendNotificationErrors(response, smsResponse?.Errors);
                if (!response.Errors.Any())
                {
                    response.Errors.Add(new Error
                    {
                        Code = "SMS_MULTI_SEND_FAILED",
                        Message = "Failed to send SMS by multi-messages provider."
                    });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Unexpected error while sending SMS notification by multi-messages.");
                response.Errors.Add(new Error
                {
                    Code = ex.HResult.ToString(),
                    Message = ex.Message
                });
            }

            return Task.FromResult(response);
        }

        private Task<CommonResponse<bool>> SendSmsByEnqueueAsync(SmsDispatchRequest request, CancellationToken cancellationToken = default)
        {
            var response = new CommonResponse<bool>();

            try
            {
                var smsOptions = _applicationConfig.NotificationChannels?.Sms ?? new SmsChannelOptions();
                if (!smsOptions.Enabled)
                {
                    response.Data = true;
                    return Task.FromResult(response);
                }

                if (request == null || string.IsNullOrWhiteSpace(request.MobileNumber) || string.IsNullOrWhiteSpace(request.Message))
                {
                    response.Errors.Add(new Error
                    {
                        Code = "400",
                        Message = "SMS payload is invalid."
                    });
                    return Task.FromResult(response);
                }

                var connectionString = _gpaContext.Database.GetConnectionString();
                if (string.IsNullOrWhiteSpace(connectionString))
                {
                    response.Errors.Add(new Error
                    {
                        Code = "500",
                        Message = "SMS connection string is not configured."
                    });
                    return Task.FromResult(response);
                }

                var smsResponse = ENPO.Notifications.ENPONotifications.EnqueueSms(new SmsSendQueue
                {
                    Message = request.Message.Trim(),
                    MobileNumber = request.MobileNumber.Trim(),
                    ServiceName = string.IsNullOrWhiteSpace(request.ServiceName) ? smsOptions.ServiceName : request.ServiceName!,
                    ReferenceNo = string.IsNullOrWhiteSpace(request.ReferenceNo) ? smsOptions.DefaultReferenceNo : request.ReferenceNo!,
                    UserId = string.IsNullOrWhiteSpace(request.UserId) ? "SYSTEM" : request.UserId.Trim(),
                    Status = request.Status
                }, connectionString);

                if (smsResponse?.IsSuccess == true)
                {
                    response.Data = true;
                    return Task.FromResult(response);
                }

                AppendNotificationErrors(response, smsResponse?.Errors);

                if (!response.Errors.Any())
                {
                    response.Errors.Add(new Error
                    {
                        Code = "SMS_SEND_FAILED",
                        Message = "Failed to enqueue SMS notification."
                    });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Unexpected error while sending SMS notification.");
                response.Errors.Add(new Error
                {
                    Code = ex.HResult.ToString(),
                    Message = ex.Message
                });
            }

            return Task.FromResult(response);
        }

        private static void AppendNotificationErrors(CommonResponse<bool> response, IEnumerable<dynamic>? errors)
        {
            if (errors == null)
            {
                return;
            }

            foreach (var err in errors)
            {
                var code = string.Empty;
                var message = string.Empty;
                try
                {
                    code = Convert.ToString(err?.Code ?? string.Empty) ?? string.Empty;
                    message = Convert.ToString(err?.Message ?? string.Empty) ?? string.Empty;
                }
                catch
                {
                    // Ignore and fallback below.
                }

                response.Errors.Add(new Error
                {
                    Code = string.IsNullOrWhiteSpace(code) ? "SMS_SEND_FAILED" : code,
                    Message = string.IsNullOrWhiteSpace(message) ? "Failed to send SMS notification." : message
                });
            }
        }

        private static string NormalizeSmsProvider(string? provider)
        {
            var normalized = (provider ?? string.Empty).Trim().ToUpperInvariant();
            if (normalized is "MULTI" or "MULTI_MESSAGES" or "SENDSMSLISTWITHMULTIMESSAGES")
            {
                return "MULTI_MESSAGES";
            }

            return "ENQUEUE";
        }

        public async Task<CommonResponse<bool>> SendSignalRToUserAsync(SignalRDispatchRequest request, CancellationToken cancellationToken = default)
        {
            var response = new CommonResponse<bool>();

            try
            {
                if (request == null || string.IsNullOrWhiteSpace(request.UserId) || string.IsNullOrWhiteSpace(request.Notification))
                {
                    response.Errors.Add(new Error
                    {
                        Code = "400",
                        Message = "SignalR payload is invalid."
                    });
                    return response;
                }

                await _signalRConnectionManager.SendNotificationToUser(request.UserId.Trim(), new NotificationDto
                {
                    Notification = request.Notification.Trim(),
                    type = request.Type,
                    Title = string.IsNullOrWhiteSpace(request.Title) ? "Connect" : request.Title.Trim(),
                    time = request.Time ?? DateTime.Now,
                    sender = string.IsNullOrWhiteSpace(request.Sender) ? "Connect" : request.Sender.Trim(),
                    Category = request.Category
                });

                response.Data = true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Unexpected error while sending SignalR notification.");
                response.Errors.Add(new Error
                {
                    Code = ex.HResult.ToString(),
                    Message = ex.Message
                });
            }

            return response;
        }

        public Task<CommonResponse<bool>> SendWhatsAppAsync(WhatsAppDispatchRequest request, CancellationToken cancellationToken = default)
        {
            var response = new CommonResponse<bool>();
            response.Errors.Add(new Error
            {
                Code = "501",
                Message = "WhatsApp channel is not implemented yet."
            });
            return Task.FromResult(response);
        }

        public Task<CommonResponse<bool>> SendEmailAsync(EmailDispatchRequest request, CancellationToken cancellationToken = default)
        {
            var response = new CommonResponse<bool>();
            response.Errors.Add(new Error
            {
                Code = "501",
                Message = "Email channel is not implemented yet."
            });
            return Task.FromResult(response);
        }
    }
}
