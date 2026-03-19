using Microsoft.AspNetCore.Http;
using Models.Correspondance;
using Models.DTO.Correspondance.Enums;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Models.DTO.Correspondance.Replies
{
    // Messages
    public record MessageCreateDto(
        string Subject,
        string Description,
        Priority Priority
    );

    public record MessageUpdateDto(
        string? Subject,
        string? Description,
        MessageStatus? Status
    );

    public record MessageWithReplies(
        Message Message,
        List<Reply> Replies
    );


    public class ReplyCreateRequest
    {

        public string Message { get; set; }
        public int messageId { get; set; }
        public string NextResponsibleSectorID { get; set; }
        public List<IFormFile>? files { get; set; } = new List<IFormFile>();
    }   

    public partial class ReplyDto
    {
        public int ReplyId { get; set; }

        public int MessageId { get; set; }

        public string Message { get; set; } = null!;

        public string AuthorId { get; set; } = null!;
        
        public string AuthorName { get; set; } = null!;

        public string? NextResponsibleSectorId { get; set; }

        public DateTime CreatedDate { get; set; }

        public List<AttchShipmentDto>? AttchShipmentDtos { get; set; } = new List<AttchShipmentDto>();

    }


    // Replies
    //public record ReplyCreateRequest(
    //    string Message,
    //    int messageId,
    //    string? NextResponsibleSectorID
    //);
}
