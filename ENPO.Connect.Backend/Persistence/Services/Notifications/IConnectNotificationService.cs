using ENPO.Dto.HubSync;
using Models.DTO.Common;

namespace Persistence.Services.Notifications
{
    public interface IConnectNotificationService
    {
        string RenderTemplate(string? template, IReadOnlyDictionary<string, string?> placeholders);

        Task<CommonResponse<bool>> SendSmsAsync(SmsDispatchRequest request, CancellationToken cancellationToken = default);
        Task<CommonResponse<bool>> SendSmsByMultiMessagesAsync(SmsDispatchRequest request, CancellationToken cancellationToken = default);
        Task<CommonResponse<bool>> SendSignalRToUserAsync(SignalRDispatchRequest request, CancellationToken cancellationToken = default);

        Task<CommonResponse<bool>> SendWhatsAppAsync(WhatsAppDispatchRequest request, CancellationToken cancellationToken = default);
        Task<CommonResponse<bool>> SendEmailAsync(EmailDispatchRequest request, CancellationToken cancellationToken = default);
    }

    public sealed class SmsDispatchRequest
    {
        public string Message { get; set; } = string.Empty;
        public string MobileNumber { get; set; } = string.Empty;
        public string? ServiceName { get; set; }
        public string? ReferenceNo { get; set; }
        public string UserId { get; set; } = "SYSTEM";
        public int Status { get; set; } = 0;
    }

    public sealed class SignalRDispatchRequest
    {
        public string UserId { get; set; } = string.Empty;
        public string Notification { get; set; } = string.Empty;
        public string Title { get; set; } = "Connect";
        public NotificationType Type { get; set; } = NotificationType.info;
        public NotificationCategory Category { get; set; } = NotificationCategory.Business;
        public string Sender { get; set; } = "Connect";
        public DateTime? Time { get; set; }
    }

    public sealed class WhatsAppDispatchRequest
    {
        public string MobileNumber { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
    }

    public sealed class EmailDispatchRequest
    {
        public string To { get; set; } = string.Empty;
        public string Subject { get; set; } = string.Empty;
        public string Body { get; set; } = string.Empty;
    }
}
