using System;
using System.Collections.Generic;

namespace Models
{
    public partial class EmailSendQueue
    {
        public decimal EmailId { get; set; }

        public string? MailObjectString { get; set; }

        public string? ServiceName { get; set; }

        public bool? Status { get; set; }

        public string? ErrorMessage { get; set; }

        public DateTime? CreatedDate { get; set; }

        public DateTime? LastSentDate { get; set; }

        public string? ReferenceNo { get; set; }

        public byte? NoOfTries { get; set; }
    }
}