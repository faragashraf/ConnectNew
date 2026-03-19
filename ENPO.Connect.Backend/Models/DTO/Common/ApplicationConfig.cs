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
    public class TokenOptions
    {

        public string Issuer { get; set; }
        public string Audience { get; set; }
        public string Key { get; set; }
        public string RefreshTokenMinutes { get; set; }
    }
}
