using System;

namespace Models.Correspondance
{
    public class RequestToken
    {
        public long Id { get; set; }
        public string Token { get; set; } = string.Empty;
        public string? TokenHash { get; set; }
        public int MessageId { get; set; }
        public string? TokenPurpose { get; set; }
        public bool IsUsed { get; set; }
        public bool IsOneTimeUse { get; set; }
        public DateTime? UsedAt { get; set; }
        public DateTime CreatedAt { get; set; }
        public string? CreatedBy { get; set; }
        public string? UserId { get; set; }
        public DateTime? ExpiresAt { get; set; }
        public DateTime? RevokedAt { get; set; }
        public string? RevokedBy { get; set; }
    }
}
