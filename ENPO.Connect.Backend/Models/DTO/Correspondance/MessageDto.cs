using Microsoft.AspNetCore.Http;
using Models.Attachment;
using Models.Correspondance;
using Models.DTO.Correspondance.Enums;
using Models.DTO.Correspondance.Replies;

namespace Models.DTO.Correspondance
{
    public class MessageRequest
    {
        public int? MessageId { get; set; }

        public string? RequestRef { get; set; }

        public string? Subject { get; set; } = null!;

        public string? Description { get; set; } = null!;

        public string? CreatedBy { get; set; } = null!;

        public string? AssignedSectorId { get; set; } = null!;

        public int? UnitId { get; set; } = 0;

        public string? CurrentResponsibleSectorId { get; set; } = null!;

        public byte? Type { get; set; } = 0!;

        public int CategoryCd { get; set; }

        public List<TkmendField>? Fields { get; set; } = new List<TkmendField>();

        //public List<MessageStockholder>? Stockholders { get; set; } = new List<MessageStockholder>();

        public List<IFormFile>? files { get; set; } = new List<IFormFile>();
    }
    public class MessageDto
    {
        public int MessageId { get; set; }

        public string? Subject { get; set; } = null!;

        public string? Description { get; set; } = null!;

        public MessageStatus Status { get; set; }

        public Priority Priority { get; set; }

        public string? CreatedBy { get; set; } = null!;

        public string AssignedSectorId { get; set; } = null!;

        public string? CurrentResponsibleSectorId { get; set; } = null!;

        public DateTime CreatedDate { get; set; }

        public DateTime? DueDate { get; set; }

        public DateTime? ClosedDate { get; set; }

        public string? RequestRef { get; set; }

        public byte Type { get; set; }

        public int CategoryCd { get; set; }

        public List<TkmendField>? Fields { get; set; } = new List<TkmendField>();
        public List<ReplyDto>? Replies { get; set; } = new List<ReplyDto>();
        public List<MessageStockholder>? Stockholders { get; set; } = new List<MessageStockholder>();

        public List<AttchShipment>? Attachments { get; set; } = new List<AttchShipment>();
    }
    public class ExchangeUserInfo
    {
        public string? UserEmail { get; set; }
        public string? UserDisplayName { get; set; }
        public string? UserTitle { get; set; }
        public string? MobilePhone { get; set; }
        public byte[]? UserPicture { get; set; }
        public bool? RegistrationStatus { get; set; } = false;
        public string? UserId { get; set; }
        public bool IsGroup { get; set; }
        public List<ExchangeUserInfo> GroupMembers { get; set; } = new List<ExchangeUserInfo>();
        public List<string> UserGroups { get; set; } = new List<string>();
    }
}
