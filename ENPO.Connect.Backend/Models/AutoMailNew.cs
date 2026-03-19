using System;
using System.Collections.Generic;

namespace Models
{
    public partial class AutoMailNew
    {
        public int MailSql { get; set; }
        public string MailStr { get; set; } = null!;
        public string MailTo { get; set; } = null!;
        public string? MailCc { get; set; }
        public string MailSub { get; set; } = null!;
        public string MailBody { get; set; } = null!;
        public DateTime MailTime { get; set; }
        public bool MailRun { get; set; }
        public string MailRule { get; set; } = null!;
        public bool? Hourly { get; set; }
        public bool? OnlyWday { get; set; }
        public bool? Monthly { get; set; }
        public bool? Saturday { get; set; }
        public bool? Sunday { get; set; }
        public bool? Monday { get; set; }
        public bool? Tuesday { get; set; }
        public bool? Wednesday { get; set; }
        public bool? Thursday { get; set; }
        public bool? Friday { get; set; }
    }
}
