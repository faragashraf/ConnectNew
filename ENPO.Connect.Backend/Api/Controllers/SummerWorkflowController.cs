using Microsoft.AspNetCore.Mvc;
using Models.DTO.Common;
using Models.DTO.Correspondance.Summer;
using Persistence.Services;
using Persistence.Services.Summer;

namespace Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class SummerWorkflowController : ControllerBase
    {
        private readonly SummerWorkflowService _summerWorkflowService;

        public SummerWorkflowController(SummerWorkflowService summerWorkflowService)
        {
            _summerWorkflowService = summerWorkflowService;
        }

        [HttpGet(nameof(GetMyRequests))]
        public Task<CommonResponse<IEnumerable<SummerRequestSummaryDto>>> GetMyRequests(int seasonYear = SummerWorkflowDomainConstants.DefaultSeasonYear, int? messageId = null)
        {
            var userId = HttpContext.User.Claims.First(f => f.Type == "UserId").Value;
            return _summerWorkflowService.GetMyRequestsAsync(userId, seasonYear, messageId);
        }

        [HttpGet(nameof(GetWaveCapacity))]
        public Task<CommonResponse<IEnumerable<SummerWaveCapacityDto>>> GetWaveCapacity(int categoryId, string waveCode)
        {
            return _summerWorkflowService.GetWaveCapacityAsync(categoryId, waveCode);
        }

        [HttpGet(nameof(GetAdminRequests))]
        public Task<CommonResponse<IEnumerable<SummerRequestSummaryDto>>> GetAdminRequests([FromQuery] SummerAdminRequestsQuery query)
        {
            var userId = HttpContext.User.Claims.First(f => f.Type == "UserId").Value;
            return _summerWorkflowService.GetAdminRequestsAsync(query, userId);
        }

        [HttpGet(nameof(GetAdminDashboard))]
        public Task<CommonResponse<SummerAdminDashboardDto>> GetAdminDashboard(int seasonYear = SummerWorkflowDomainConstants.DefaultSeasonYear, int? categoryId = null, string? waveCode = null)
        {
            var userId = HttpContext.User.Claims.First(f => f.Type == "UserId").Value;
            return _summerWorkflowService.GetAdminDashboardAsync(userId, seasonYear, categoryId, waveCode);
        }

        [HttpPost(nameof(Cancel))]
        [Consumes("multipart/form-data")]
        public Task<CommonResponse<SummerRequestSummaryDto>> Cancel([FromForm] SummerCancelRequest request)
        {
            var userId = HttpContext.User.Claims.First(f => f.Type == "UserId").Value;
            var ip = HttpContext.Connection.RemoteIpAddress?.MapToIPv4().ToString() ?? "0.0.0.0";
            return _summerWorkflowService.CancelAsync(request, userId, ip);
        }

        [HttpPost(nameof(Pay))]
        [Consumes("multipart/form-data")]
        public Task<CommonResponse<SummerRequestSummaryDto>> Pay([FromForm] SummerPayRequest request)
        {
            var userId = HttpContext.User.Claims.First(f => f.Type == "UserId").Value;
            var ip = HttpContext.Connection.RemoteIpAddress?.MapToIPv4().ToString() ?? "0.0.0.0";
            return _summerWorkflowService.PayAsync(request, userId, ip);
        }

        [HttpPost(nameof(Transfer))]
        [Consumes("multipart/form-data")]
        public Task<CommonResponse<SummerRequestSummaryDto>> Transfer([FromForm] SummerTransferRequest request)
        {
            var userId = HttpContext.User.Claims.First(f => f.Type == "UserId").Value;
            var ip = HttpContext.Connection.RemoteIpAddress?.MapToIPv4().ToString() ?? "0.0.0.0";
            return _summerWorkflowService.TransferAsync(request, userId, ip);
        }

        [HttpPost(nameof(ExecuteAdminAction))]
        [Consumes("multipart/form-data")]
        public Task<CommonResponse<SummerRequestSummaryDto>> ExecuteAdminAction([FromForm] SummerAdminActionRequest request)
        {
            var userId = HttpContext.User.Claims.First(f => f.Type == "UserId").Value;
            var ip = HttpContext.Connection.RemoteIpAddress?.MapToIPv4().ToString() ?? "0.0.0.0";
            return _summerWorkflowService.ExecuteAdminActionAsync(request, userId, ip);
        }
    }
}
