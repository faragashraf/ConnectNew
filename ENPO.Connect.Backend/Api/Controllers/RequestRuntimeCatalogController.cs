using Microsoft.AspNetCore.Mvc;
using Models.DTO.Common;
using Models.DTO.DynamicSubjects;
using Persistence.Services.DynamicSubjects.RuntimeCatalog;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace Api.Controllers;

[Route("api/[controller]")]
[ApiController]
public sealed class RequestRuntimeCatalogController : ControllerBase
{
    private readonly IRequestRuntimeCatalogService _requestRuntimeCatalogService;

    public RequestRuntimeCatalogController(IRequestRuntimeCatalogService requestRuntimeCatalogService)
    {
        _requestRuntimeCatalogService = requestRuntimeCatalogService;
    }

    [HttpGet("RegistrationTree")]
    public Task<CommonResponse<RequestRuntimeCatalogDto>> GetRegistrationTree(
        string? appId,
        CancellationToken cancellationToken = default)
    {
        return _requestRuntimeCatalogService.GetAvailableRegistrationTreeAsync(
            GetCurrentUserId(),
            appId,
            cancellationToken);
    }

    private string GetCurrentUserId()
    {
        return HttpContext.User.Claims.FirstOrDefault(claim => claim.Type == "UserId")?.Value ?? string.Empty;
    }
}
