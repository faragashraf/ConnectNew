using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Models.DTO.Common
{

    public class ApplicationConfig
    {
        public string AdminIps { get; set; } = "";
        public string HubServerIP { get; set; } = "";
        public FtpOptions FtpOptions { get; set; } = new FtpOptions();
        public MailAccountOptions MailOptions { get; set; } = new MailAccountOptions();
        public SLAConfiguration SLAConfiguration { get; set; } = new SLAConfiguration();
        public ApiOptions ApiOptions { get; set; } = new ApiOptions();
        public NotificationChannelsOptions NotificationChannels { get; set; } = new NotificationChannelsOptions();
        public TokenOptions tokenOptions { get; set; } = new TokenOptions();
    }

    public class FtpOptions
    {
        public string FtpServer { get; set; } = "";
        public string FtpDirectory { get; set; } = "";
        public string FtpUserName { get; set; } = "";
        public string FtpPassword { get; set; } = "";

    }
    public class MailAccountOptions
    {
        public string user { get; set; } = "";
        public string password { get; set; } = "";

    }

    public class SLAConfiguration
    {
        public int CriticalPriorityHours { get; set; }
        public int HighPriorityHours { get; set; }
        public int MediumPriorityHours { get; set; }
        public int LowPriorityHours { get; set; }
    }
    public class ApiOptions
    {
        public int fileMaxSize { get; set; }
        public string EventSMSAccepted { get; set; }
        public string EventSMSARejected { get; set; }
        public List<string> LtraExcelColumns { get; set; }
    }

    public class NotificationChannelsOptions
    {
        public SmsChannelOptions Sms { get; set; } = new SmsChannelOptions();
        public SummerNotificationTemplates Summer { get; set; } = new SummerNotificationTemplates();
    }

    public class SmsChannelOptions
    {
        public bool Enabled { get; set; } = true;
        public string ServiceName { get; set; } = "CONNECT SUMMER REQUESTS";
        public string DefaultReferenceNo { get; set; } = "SUMMER";
        public string Provider { get; set; } = "ENQUEUE";
        public string MultiMessagesUserName { get; set; } = "";
        public string MultiMessagesPassword { get; set; } = "";
    }

    public class SummerNotificationTemplates
    {
        public string AdminActionSmsTemplate { get; set; } =
            "Dear {FirstName}, your summer request {RequestRef} was updated. Action: {ActionLabel}. Resort: {CategoryName}, wave: {WaveCode}. {AdminCommentLine}";

        public string AutoCancelSmsTemplate { get; set; } =
            "Dear {FirstName}, your summer request {RequestRef} was auto-cancelled because payment was not completed before {PaymentDueAtUtc}.";

        public string AdminActionSignalRTemplate { get; set; } =
            "Your summer request {RequestRef} was updated by administration. Action: {ActionLabel}.";

        public string AutoCancelSignalRTemplate { get; set; } =
            "Your summer request {RequestRef} was auto-cancelled due to payment timeout.";

        public string AdminActionSignalRTitle { get; set; } = "Summer Requests Management";
        public string AutoCancelSignalRTitle { get; set; } = "Summer Request Auto Cancellation";
    }

    public class TokenOptions
    {

        public string Issuer { get; set; }
        public string Audience { get; set; }
        public string Key { get; set; }
        public string RefreshTokenMinutes { get; set; }
    }
}
