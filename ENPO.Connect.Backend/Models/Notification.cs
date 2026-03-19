using System;
using System.Collections.Generic;

namespace Models
{
    public partial class Notification
    {
        public int NotificationId { get; set; }
        public decimal? DueAmount { get; set; }
        public decimal? DuePercentage { get; set; }
        public DateTime? DueDate { get; set; }
        public DateTime? NotificationDateTime { get; set; }
        public string? Subject { get; set; }
        public int? NotificationType { get; set; }
        public int ItemId { get; set; }
        public string? UserId { get; set; }
        public int? IsDeleted { get; set; }
        public DateTime? TimeStamp { get; set; }
    }
}
