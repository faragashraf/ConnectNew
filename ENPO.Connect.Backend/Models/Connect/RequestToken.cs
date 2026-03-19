using System;

namespace Models.Correspondance
{
    public class RequestToken
    {
        public string Token { get; set; } = string.Empty;
        public int MessageId { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? ExpiresAt { get; set; }
    }
}
