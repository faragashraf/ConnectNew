using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
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
        private readonly ILogger<SummerWorkflowController> _logger;

        public SummerWorkflowController(
            SummerWorkflowService summerWorkflowService,
            ILogger<SummerWorkflowController> logger)
        {
            _summerWorkflowService = summerWorkflowService;
            _logger = logger;
        }

        [HttpGet(nameof(GetMyRequests))]
        public Task<CommonResponse<IEnumerable<SummerRequestSummaryDto>>> GetMyRequests(int seasonYear = SummerWorkflowDomainConstants.DefaultSeasonYear, int? messageId = null)
        {
            var userId = HttpContext.User.Claims.First(f => f.Type == "UserId").Value;
            return _summerWorkflowService.GetMyRequestsAsync(userId, seasonYear, messageId);
        }

        [HttpGet(nameof(GetWaveCapacity))]
        public Task<CommonResponse<IEnumerable<SummerWaveCapacityDto>>> GetWaveCapacity(int categoryId, string waveCode, bool includeFrozenUnits = false)
        {
            var userId = HttpContext.User.Claims.First(f => f.Type == "UserId").Value;
            return _summerWorkflowService.GetWaveCapacityAsync(categoryId, waveCode, userId, includeFrozenUnits);
        }

        [HttpPost(nameof(GetPricingQuote))]
        public Task<CommonResponse<SummerPricingQuoteDto>> GetPricingQuote([FromBody] SummerPricingQuoteRequest request)
        {
            return _summerWorkflowService.GetPricingQuoteAsync(request);
        }

        [HttpGet(nameof(GetPricingCatalog))]
        [ResponseCache(Location = ResponseCacheLocation.None, NoStore = true)]
        public Task<CommonResponse<SummerPricingCatalogDto>> GetPricingCatalog(int seasonYear = SummerWorkflowDomainConstants.DefaultSeasonYear)
        {
            var userId = HttpContext.User.Claims.First(f => f.Type == "UserId").Value;
            return _summerWorkflowService.GetPricingCatalogAsync(seasonYear, userId);
        }

        [HttpPost(nameof(SavePricingCatalog))]
        public Task<CommonResponse<SummerPricingCatalogDto>> SavePricingCatalog([FromBody] SummerPricingCatalogUpsertRequest request)
        {
            var userId = HttpContext.User.Claims.First(f => f.Type == "UserId").Value;
            return _summerWorkflowService.SavePricingCatalogAsync(request, userId);
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

        [HttpGet(nameof(GetUnitFreezes))]
        public Task<CommonResponse<IEnumerable<SummerUnitFreezeDto>>> GetUnitFreezes([FromQuery] SummerUnitFreezeQuery query)
        {
            var userId = HttpContext.User.Claims.First(f => f.Type == "UserId").Value;
            return _summerWorkflowService.GetUnitFreezesAsync(query, userId);
        }

        [HttpPost(nameof(CreateUnitFreeze))]
        public Task<CommonResponse<SummerUnitFreezeDto>> CreateUnitFreeze([FromBody] SummerUnitFreezeCreateRequest request)
        {
            var userId = HttpContext.User.Claims.First(f => f.Type == "UserId").Value;
            return _summerWorkflowService.CreateUnitFreezeAsync(request, userId);
        }

        [HttpPost(nameof(ReleaseUnitFreeze))]
        public Task<CommonResponse<SummerUnitFreezeDto>> ReleaseUnitFreeze([FromBody] SummerUnitFreezeReleaseRequest request)
        {
            var userId = HttpContext.User.Claims.First(f => f.Type == "UserId").Value;
            return _summerWorkflowService.ReleaseUnitFreezeAsync(request, userId);
        }

        [HttpGet(nameof(GetUnitFreezeDetails))]
        public Task<CommonResponse<SummerUnitFreezeDetailsDto>> GetUnitFreezeDetails(int freezeId)
        {
            var userId = HttpContext.User.Claims.First(f => f.Type == "UserId").Value;
            return _summerWorkflowService.GetUnitFreezeDetailsAsync(freezeId, userId);
        }

        [HttpGet("/api/admin/units/available-count")]
        public Task<CommonResponse<SummerUnitsAvailableCountDto>> GetAdminAvailableCount([FromQuery] AdminUnitsAvailableCountQuery query)
        {
            var userId = HttpContext.User.Claims.First(f => f.Type == "UserId").Value;
            return _summerWorkflowService.GetUnitsAvailableCountAsync(new SummerUnitsAvailableCountQuery
            {
                CategoryId = query?.ResortId ?? 0,
                WaveCode = query?.WaveId ?? string.Empty,
                FamilyCount = query?.Capacity ?? 0,
                IncludeFrozenUnits = query?.IncludeFrozenUnits ?? false
            }, userId);
        }

        [HttpGet("/api/admin/unit-freeze")]
        public Task<CommonResponse<IEnumerable<SummerUnitFreezeDto>>> GetAdminUnitFreezes([FromQuery] AdminUnitFreezeListQuery query)
        {
            var userId = HttpContext.User.Claims.First(f => f.Type == "UserId").Value;
            return _summerWorkflowService.GetUnitFreezesAsync(new SummerUnitFreezeQuery
            {
                CategoryId = query?.ResortId,
                WaveCode = query?.WaveId,
                FamilyCount = query?.Capacity,
                IsActive = query?.IsActive
            }, userId);
        }

        [HttpPost("/api/admin/unit-freeze")]
        public async Task<CommonResponse<SummerUnitFreezeDto>> CreateAdminUnitFreeze([FromBody] AdminUnitFreezeCreateRequest request)
        {
            var userId = HttpContext.User.Claims.First(f => f.Type == "UserId").Value;
            var traceId = Guid.NewGuid().ToString("N");
            _logger.LogInformation(
                "Admin unit-freeze create endpoint request started. TraceId={TraceId}, UserId={UserId}, ResortId={ResortId}, WaveId={WaveId}, Capacity={Capacity}, UnitsCount={UnitsCount}",
                traceId,
                userId,
                request?.ResortId,
                request?.WaveId,
                request?.Capacity,
                request?.UnitsCount);

            try
            {
                var result = await _summerWorkflowService.CreateUnitFreezeAsync(new SummerUnitFreezeCreateRequest
                {
                    CategoryId = request?.ResortId ?? 0,
                    WaveCode = request?.WaveId ?? string.Empty,
                    FamilyCount = request?.Capacity ?? 0,
                    RequestedUnitsCount = request?.UnitsCount ?? 0,
                    FreezeType = request?.FreezeType,
                    Reason = request?.Reason,
                    Notes = request?.Notes
                }, userId);

                _logger.LogInformation(
                    "Admin unit-freeze create endpoint completed service call. TraceId={TraceId}, IsSuccess={IsSuccess}, ErrorCount={ErrorCount}, FreezeId={FreezeId}",
                    traceId,
                    result.IsSuccess,
                    result.Errors.Count,
                    result.Data?.FreezeId);

                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(
                    ex,
                    "Admin unit-freeze create endpoint failed. TraceId={TraceId}",
                    traceId);
                throw;
            }
            finally
            {
                _logger.LogInformation(
                    "Admin unit-freeze create endpoint returning HTTP response. TraceId={TraceId}",
                    traceId);
            }
        }

        [HttpGet("/api/admin/unit-freeze/{freezeId:int}")]
        public Task<CommonResponse<SummerUnitFreezeDetailsDto>> GetAdminUnitFreezeDetails(int freezeId)
        {
            var userId = HttpContext.User.Claims.First(f => f.Type == "UserId").Value;
            return _summerWorkflowService.GetUnitFreezeDetailsAsync(freezeId, userId);
        }

        [HttpPost("/api/admin/unit-freeze/{freezeId:int}/release")]
        public Task<CommonResponse<SummerUnitFreezeDto>> ReleaseAdminUnitFreeze(int freezeId)
        {
            var userId = HttpContext.User.Claims.First(f => f.Type == "UserId").Value;
            return _summerWorkflowService.ReleaseUnitFreezeAsync(new SummerUnitFreezeReleaseRequest
            {
                FreezeId = freezeId
            }, userId);
        }
    }
}
