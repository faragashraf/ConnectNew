
using Models.Correspondance;
using Models.DTO.Common;
using Models.DTO.Correspondance.Enums;
using Models.GPA;
using System.Linq.Expressions;

namespace Models.DTO.Correspondance.AdminCertificates
{
    public class MessagesAllDto
    {
        public int MessageId { get; set; }
        public MessageStatus Status { get; set; }
        public int CategoryCd { get; set; }
        public string AssignedSectorId { get; set; } = null!;
    }

    public class InternalCommunicationDto
    {
        public string? userId { get; set; }
        public bool? IsOutBox { get; set; } = false;
        public Search? Search { get; set; } = new Search();
        public List<string>? depatmentsList { get; set; } = new List<string>();
        public (Expression<Func<Message, bool>> Combined, Dictionary<string, Expression<Func<Message, bool>>> Filters)? expressionMessageFilters { get; set; } = (null, new Dictionary<string, Expression<Func<Message, bool>>>());
        public (Expression<Func<Reply, bool>> Combined, Dictionary<string, Expression<Func<Reply, bool>>> Filters)? expressionReplyFilters { get; set; } = (null, new Dictionary<string, Expression<Func<Reply, bool>>>());
        public CommonResponse<IEnumerable<MessageDto>>? commonResponse { get; set; } = new CommonResponse<IEnumerable<MessageDto>>();
    }

}
