using Models.Correspondance;
using Models.DTO.Common;
using Models.DTO.Correspondance.Replies;

namespace Repositories
{
    public interface IRepliesRepository
    {
        Task<CommonResponse<Reply>> CreateReplyAsync(ReplyCreateRequest dto, string userId, string ip);
        Task<CommonResponse<Reply>> ReplyWithAttchment(ReplyCreateRequest dto,  string usr, string ip);
        Task<CommonResponse<IEnumerable<ReplyDto>>> GetMessageRepliesAsync(int messageId);

    }
}