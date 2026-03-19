using Core;
using Microsoft.AspNetCore.Mvc;
using Models.Correspondance;
using Models.DTO.Correspondance.Replies;
using Models.DTO.Common;

namespace Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]

    public class RepliesController : ControllerBase
    {
        private readonly IUnitOfWork _unitOfWork;
        public RepliesController(IUnitOfWork unitOfWork)
        {
            _unitOfWork = unitOfWork;
        }

        [HttpPost]
        [Route(nameof(CreateReplyAsync))]
        public async Task<ActionResult<CommonResponse<Reply>>> CreateReplyAsync(ReplyCreateRequest replyCreateRequest)
        {
            string userId = HttpContext.User.Claims.First(f => f.Type == "UserId").Value;
            var userIp = HttpContext.Connection.RemoteIpAddress?.MapToIPv4().ToString() ?? "Unknown";

            return await _unitOfWork.RepliesRepository.CreateReplyAsync(replyCreateRequest, userId, userIp);
        }

        [HttpPost]
        [Route(nameof(ReplyWithAttchment))]
        [Consumes("multipart/form-data")]
        public async Task<ActionResult<CommonResponse<Reply>>> ReplyWithAttchment([FromForm] ReplyCreateRequest  replyCreateRequest )
        {
            string userId = HttpContext.User.Claims.First(f => f.Type == "UserId").Value;
            var userIp = HttpContext.Connection.RemoteIpAddress?.MapToIPv4().ToString() ?? "Unknown";

            return await _unitOfWork.RepliesRepository.ReplyWithAttchment(replyCreateRequest, userId, userIp);
        }

        [HttpPost]
        [Route(nameof(GetMessageRepliesAsync))]
        public async Task<ActionResult<CommonResponse<IEnumerable<ReplyDto>>>> GetMessageRepliesAsync(int messageId)
        {
            return await _unitOfWork.RepliesRepository.GetMessageRepliesAsync(messageId);
        }
    }
}
