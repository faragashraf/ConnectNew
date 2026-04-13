using Api.Authorization;
using Core;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Models.DTO.Common;
using Models.DTO.Correspondance;
using Persistence.Services.Summer;
using System.Linq;
using System.Runtime.InteropServices;

namespace Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]

    public class DynamicFormController : ControllerBase
    {
        private const string FunctionsHeaderName = "ConnectFunctions";
        private const string LegacyFunctionsHeaderName = "X-Connect-Functions";
        private readonly IUnitOfWork _unitOfWork;
        private readonly TokenValidationParameters? _summerFunctionsTokenValidationParameters;

        public DynamicFormController(
            IUnitOfWork unitOfWork,
            IOptions<ApplicationConfig> applicationConfigOptions)
        {
            _unitOfWork = unitOfWork;
            var tokenOptions = applicationConfigOptions?.Value?.tokenOptions;
            _summerFunctionsTokenValidationParameters = SummerFunctionClaimGuard.BuildTokenValidationParameters(
                tokenOptions?.Key,
                tokenOptions?.Issuer,
                tokenOptions?.Audience);
        }

        [HttpGet]
        [Route(nameof(GetMandatoryMetaDate))]
        [AllowAnonymous]
        public ActionResult<CommonResponse<IEnumerable<CdmendDto>>> GetMandatoryMetaDate([Optional]string? appId)
        {
            return _unitOfWork.dynamicFormRepository.GetMandatoryMetaDate(appId);
        }

        [HttpGet]
        [Route(nameof(GetMandatoryAll))]
        [AllowAnonymous]
        public ActionResult<CommonResponse<IEnumerable<CdCategoryMandDto>>> GetMandatoryAll([Optional] string? appId)
        {
            return _unitOfWork.dynamicFormRepository.GetMandatoryAll(appId);
        }

        [HttpGet]
        [AllowAnonymous]
        [Route(nameof(GetAllCategories))]
        public ActionResult<CommonResponse<IEnumerable<CdcategoryDto>>> GetAllCategories([Optional] string? appId)
        {
            return _unitOfWork.dynamicFormRepository.GetAllCategories(appId);
        }

        [HttpPost]
        [Route(nameof(CreateRequest))]
        [Consumes("multipart/form-data")]
        public async Task<ActionResult<CommonResponse<MessageDto>>> CreateRequest([FromForm] MessageRequest messageRequest)
        {
            string userId = HttpContext.User.Claims.First(f => f.Type == "UserId").Value;
            string UserEmail = HttpContext.User.Claims.First(f => f.Type == "UserEmail").Value;
            var ipv4 = HttpContext.Connection.RemoteIpAddress!.MapToIPv4().ToString();
            var hasSummerAdminPermission = HasRequiredFunction(SummerWorkflowDomainConstants.AuthorizationFunctions.SummerAdmin);
            var hasSummerGeneralManagerPermission = HasRequiredRole(SummerWorkflowDomainConstants.AuthorizationRoles.SummerGeneralManager);
            var result = await _unitOfWork.dynamicFormRepository.CreateRequest(
                messageRequest,
                userId,
                UserEmail,
                ipv4,
                hasSummerAdminPermission,
                hasSummerGeneralManagerPermission);
            var hasBlacklistBlock = result?.Errors?.Any(error =>
                string.Equals(error?.Code, "SUMMER_BLACKLIST_BLOCKED", StringComparison.OrdinalIgnoreCase)) == true;
            if (hasBlacklistBlock)
            {
                return StatusCode(StatusCodes.Status403Forbidden, result);
            }

            return result;
        }

        [HttpGet]
        [Route(nameof(GetRequestById))]
        public Task<CommonResponse<MessageDto>> GetRequestById(int messageId)
        {
            var userId = HttpContext.User.Claims.First(f => f.Type == "UserId").Value;
            return _unitOfWork.dynamicFormRepository.GetRequestById(messageId, userId);
        }

        private bool HasRequiredFunction(string requiredFunction)
        {
            return SummerFunctionClaimGuard.HasRequiredFunction(
                HttpContext?.User,
                requiredFunction,
                ResolveFunctionsTokenFromHeaders(),
                _summerFunctionsTokenValidationParameters);
        }

        private bool HasRequiredRole(string requiredRole)
        {
            return SummerFunctionClaimGuard.HasRequiredRole(HttpContext?.User, requiredRole);
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
