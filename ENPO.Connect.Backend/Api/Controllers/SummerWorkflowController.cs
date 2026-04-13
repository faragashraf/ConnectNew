using Api.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
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
        private const string FunctionsHeaderName = "ConnectFunctions";
        private const string LegacyFunctionsHeaderName = "X-Connect-Functions";
        private readonly SummerWorkflowService _summerWorkflowService;
        private readonly ILogger<SummerWorkflowController> _logger;
        private readonly TokenValidationParameters? _summerFunctionsTokenValidationParameters;

        public SummerWorkflowController(
            SummerWorkflowService summerWorkflowService,
            ILogger<SummerWorkflowController> logger,
            IOptions<ApplicationConfig> applicationConfigOptions)
        {
            _summerWorkflowService = summerWorkflowService;
            _logger = logger;
            var tokenOptions = applicationConfigOptions?.Value?.tokenOptions;
            _summerFunctionsTokenValidationParameters = SummerFunctionClaimGuard.BuildTokenValidationParameters(
                tokenOptions?.Key,
                tokenOptions?.Issuer,
                tokenOptions?.Audience);
        }

        [HttpGet(nameof(GetMyRequests))]
        public Task<CommonResponse<IEnumerable<SummerRequestSummaryDto>>> GetMyRequests(int seasonYear = SummerWorkflowDomainConstants.DefaultSeasonYear, int? messageId = null)
        {
            var userId = HttpContext.User.Claims.First(f => f.Type == "UserId").Value;
            return _summerWorkflowService.GetMyRequestsAsync(userId, seasonYear, messageId);
        }

        [HttpPost(nameof(CreateEditToken))]
        public Task<CommonResponse<string>> CreateEditToken([FromBody] SummerCreateEditTokenRequest request)
        {
            var userId = HttpContext.User.Claims.First(f => f.Type == "UserId").Value;
            var ip = HttpContext.Connection.RemoteIpAddress?.MapToIPv4().ToString() ?? "0.0.0.0";
            var hasSummerAdminPermission = HasRequiredFunction(SummerWorkflowDomainConstants.AuthorizationFunctions.SummerAdmin);
            return _summerWorkflowService.CreateEditTokenAsync(request, userId, ip, hasSummerAdminPermission);
        }

        [HttpGet(nameof(ResolveEditToken))]
        public Task<CommonResponse<SummerEditTokenResolutionDto>> ResolveEditToken(string token)
        {
            var userId = HttpContext.User.Claims.First(f => f.Type == "UserId").Value;
            var ip = HttpContext.Connection.RemoteIpAddress?.MapToIPv4().ToString() ?? "0.0.0.0";
            var hasSummerAdminPermission = HasRequiredFunction(SummerWorkflowDomainConstants.AuthorizationFunctions.SummerAdmin);
            return _summerWorkflowService.ResolveEditTokenAsync(token, userId, ip, hasSummerAdminPermission);
        }

        [HttpGet(nameof(GetWaveCapacity))]
        public Task<CommonResponse<IEnumerable<SummerWaveCapacityDto>>> GetWaveCapacity(int categoryId, string waveCode, bool includeFrozenUnits = false)
        {
            var userId = HttpContext.User.Claims.First(f => f.Type == "UserId").Value;
            var hasSummerAdminPermission = HasRequiredFunction(SummerWorkflowDomainConstants.AuthorizationFunctions.SummerAdmin);
            return _summerWorkflowService.GetWaveCapacityAsync(
                categoryId,
                waveCode,
                userId,
                includeFrozenUnits,
                hasSummerAdminPermission);
        }

        [HttpGet(nameof(GetWaveBookingsPrintReport))]
        public Task<CommonResponse<SummerWaveBookingsPrintReportDto>> GetWaveBookingsPrintReport(
            int categoryId,
            string waveCode,
            int seasonYear = SummerWorkflowDomainConstants.DefaultSeasonYear,
            bool includeFinancials = false)
        {
            var userId = HttpContext.User.Claims.First(f => f.Type == "UserId").Value;
            return _summerWorkflowService.GetWaveBookingsPrintReportAsync(categoryId, waveCode, seasonYear, userId, includeFinancials);
        }

        [HttpPost(nameof(GetPricingQuote))]
        public Task<CommonResponse<SummerPricingQuoteDto>> GetPricingQuote([FromBody] SummerPricingQuoteRequest request)
        {
            var hasSummerGeneralManagerRole = HasRequiredRole(SummerWorkflowDomainConstants.AuthorizationRoles.SummerGeneralManager);
            var userId = HttpContext.User.Claims.First(f => f.Type == "UserId").Value;
            return _summerWorkflowService.GetPricingQuoteAsync(request, userId, hasSummerGeneralManagerRole);
        }

        [HttpGet(nameof(GetPricingCatalog))]
        [ResponseCache(Location = ResponseCacheLocation.None, NoStore = true)]
        public Task<CommonResponse<SummerPricingCatalogDto>> GetPricingCatalog(int seasonYear = SummerWorkflowDomainConstants.DefaultSeasonYear)
        {
            var userId = HttpContext.User.Claims.First(f => f.Type == "UserId").Value;
            var hasSummerGeneralManagerRole = HasRequiredRole(SummerWorkflowDomainConstants.AuthorizationRoles.SummerGeneralManager);
            return _summerWorkflowService.GetPricingCatalogAsync(seasonYear, userId, hasSummerGeneralManagerRole);
        }

        [HttpPost(nameof(SavePricingCatalog))]
        public Task<CommonResponse<SummerPricingCatalogDto>> SavePricingCatalog([FromBody] SummerPricingCatalogUpsertRequest request)
        {
            var userId = HttpContext.User.Claims.First(f => f.Type == "UserId").Value;
            var hasSummerGeneralManagerRole = HasRequiredRole(SummerWorkflowDomainConstants.AuthorizationRoles.SummerGeneralManager);
            return _summerWorkflowService.SavePricingCatalogAsync(request, userId, hasSummerGeneralManagerRole);
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
            var hasSummerAdminPermission = HasRequiredFunction(SummerWorkflowDomainConstants.AuthorizationFunctions.SummerAdmin);
            return _summerWorkflowService.PayAsync(request, userId, ip, hasSummerAdminPermission);
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
            var hasSummerGeneralManagerRole = HasRequiredRole(SummerWorkflowDomainConstants.AuthorizationRoles.SummerGeneralManager);
            return _summerWorkflowService.GetUnitFreezesAsync(query, userId, hasSummerGeneralManagerRole);
        }

        [HttpPost(nameof(CreateUnitFreeze))]
        public Task<CommonResponse<SummerUnitFreezeDto>> CreateUnitFreeze([FromBody] SummerUnitFreezeCreateRequest request)
        {
            var userId = HttpContext.User.Claims.First(f => f.Type == "UserId").Value;
            var hasSummerGeneralManagerRole = HasRequiredRole(SummerWorkflowDomainConstants.AuthorizationRoles.SummerGeneralManager);
            return _summerWorkflowService.CreateUnitFreezeAsync(request, userId, hasSummerGeneralManagerRole);
        }

        [HttpPost(nameof(ReleaseUnitFreeze))]
        public Task<CommonResponse<SummerUnitFreezeDto>> ReleaseUnitFreeze([FromBody] SummerUnitFreezeReleaseRequest request)
        {
            var userId = HttpContext.User.Claims.First(f => f.Type == "UserId").Value;
            var hasSummerGeneralManagerRole = HasRequiredRole(SummerWorkflowDomainConstants.AuthorizationRoles.SummerGeneralManager);
            return _summerWorkflowService.ReleaseUnitFreezeAsync(request, userId, hasSummerGeneralManagerRole);
        }

        [HttpGet(nameof(GetUnitFreezeDetails))]
        public Task<CommonResponse<SummerUnitFreezeDetailsDto>> GetUnitFreezeDetails(int freezeId)
        {
            var userId = HttpContext.User.Claims.First(f => f.Type == "UserId").Value;
            var hasSummerGeneralManagerRole = HasRequiredRole(SummerWorkflowDomainConstants.AuthorizationRoles.SummerGeneralManager);
            return _summerWorkflowService.GetUnitFreezeDetailsAsync(freezeId, userId, hasSummerGeneralManagerRole);
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
            var hasSummerGeneralManagerRole = HasRequiredRole(SummerWorkflowDomainConstants.AuthorizationRoles.SummerGeneralManager);
            return _summerWorkflowService.GetUnitFreezesAsync(new SummerUnitFreezeQuery
            {
                CategoryId = query?.ResortId,
                WaveCode = query?.WaveId,
                FamilyCount = query?.Capacity,
                IsActive = query?.IsActive
            }, userId, hasSummerGeneralManagerRole);
        }

        [HttpPost("/api/admin/unit-freeze")]
        public async Task<CommonResponse<SummerUnitFreezeDto>> CreateAdminUnitFreeze([FromBody] AdminUnitFreezeCreateRequest request)
        {
            var userId = HttpContext.User.Claims.First(f => f.Type == "UserId").Value;
            var hasSummerGeneralManagerRole = HasRequiredRole(SummerWorkflowDomainConstants.AuthorizationRoles.SummerGeneralManager);
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
                }, userId, hasSummerGeneralManagerRole);

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
            var hasSummerGeneralManagerRole = HasRequiredRole(SummerWorkflowDomainConstants.AuthorizationRoles.SummerGeneralManager);
            return _summerWorkflowService.GetUnitFreezeDetailsAsync(freezeId, userId, hasSummerGeneralManagerRole);
        }

        [HttpPost("/api/admin/unit-freeze/{freezeId:int}/release")]
        public Task<CommonResponse<SummerUnitFreezeDto>> ReleaseAdminUnitFreeze(int freezeId)
        {
            var userId = HttpContext.User.Claims.First(f => f.Type == "UserId").Value;
            var hasSummerGeneralManagerRole = HasRequiredRole(SummerWorkflowDomainConstants.AuthorizationRoles.SummerGeneralManager);
            return _summerWorkflowService.ReleaseUnitFreezeAsync(new SummerUnitFreezeReleaseRequest
            {
                FreezeId = freezeId
            }, userId, hasSummerGeneralManagerRole);
        }

        private bool HasRequiredFunction(string requiredFunction)
        {
            return SummerFunctionClaimGuard.HasRequiredFunction(
                HttpContext?.User,
                requiredFunction,
                ResolveFunctionsTokenFromHeaders(),
                _summerFunctionsTokenValidationParameters);
        }

        private bool HasRequiredRole(string requiredRoleId)
        {
            return SummerFunctionClaimGuard.HasRequiredRole(HttpContext?.User, requiredRoleId);
        }

        private string? ResolveFunctionsTokenFromHeaders()
        {
            if (Request?.Headers == null)
            {
                return null;
            }

            if (Request.Headers.TryGetValue(FunctionsHeaderName, out var directHeaderValues))
            {
                var directValue = directHeaderValues.FirstOrDefault();
                if (!string.IsNullOrWhiteSpace(directValue))
                {
                    return directValue;
                }
            }

            if (Request.Headers.TryGetValue(LegacyFunctionsHeaderName, out var legacyHeaderValues))
            {
                var legacyValue = legacyHeaderValues.FirstOrDefault();
                if (!string.IsNullOrWhiteSpace(legacyValue))
                {
                    return legacyValue;
                }
            }

            return null;
        }
    }
}
