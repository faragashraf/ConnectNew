using Core;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Models.DTO.Common;
using Models.DTO.Correspondance;
using Persistence.Services.Summer;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text.Json;

namespace Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]

    public class DynamicFormController : ControllerBase
    {
        private readonly IUnitOfWork _unitOfWork;
        public DynamicFormController(IUnitOfWork unitOfWork)
        {
            _unitOfWork = unitOfWork;
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
            var result = await _unitOfWork.dynamicFormRepository.CreateRequest(
                messageRequest,
                userId,
                UserEmail,
                ipv4,
                hasSummerAdminPermission);
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
            var normalizedRequiredFunction = (requiredFunction ?? string.Empty).Trim();
            if (normalizedRequiredFunction.Length == 0)
            {
                return false;
            }

            var claims = HttpContext?.User?.Claims;
            if (claims == null)
            {
                return false;
            }

            foreach (var claim in claims)
            {
                if (!string.Equals(claim.Type, "functions", StringComparison.OrdinalIgnoreCase)
                    && !string.Equals(claim.Type, "function", StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                foreach (var functionToken in ExpandFunctionClaimValues(claim.Value))
                {
                    if (string.Equals(functionToken, normalizedRequiredFunction, StringComparison.OrdinalIgnoreCase))
                    {
                        return true;
                    }
                }
            }

            return false;
        }

        private static IEnumerable<string> ExpandFunctionClaimValues(string? claimValue)
        {
            var rawValue = (claimValue ?? string.Empty).Trim();
            if (rawValue.Length == 0)
            {
                return Array.Empty<string>();
            }

            if (rawValue.StartsWith("[", StringComparison.Ordinal))
            {
                try
                {
                    using var jsonDocument = JsonDocument.Parse(rawValue);
                    if (jsonDocument.RootElement.ValueKind == JsonValueKind.Array)
                    {
                        var parsedItems = new List<string>();
                        foreach (var element in jsonDocument.RootElement.EnumerateArray())
                        {
                            if (element.ValueKind != JsonValueKind.String)
                            {
                                continue;
                            }

                            var token = (element.GetString() ?? string.Empty).Trim();
                            if (token.Length > 0)
                            {
                                parsedItems.Add(token);
                            }
                        }

                        return parsedItems;
                    }
                }
                catch
                {
                    // Fallback to delimiter parsing.
                }
            }

            return rawValue
                .Split(new[] { ',', ';', '|' }, StringSplitOptions.RemoveEmptyEntries)
                .Select(item => item.Trim())
                .Where(item => item.Length > 0)
                .ToArray();
        }

    }
}
