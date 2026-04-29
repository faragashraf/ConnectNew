using Microsoft.AspNetCore.Mvc;
using Models.DTO.Common;
using Models.DTO.PowerBi;
using Persistence.Services.PowerBi;

namespace Api.Controllers;

[Route("api/[controller]")]
[ApiController]
public sealed class PowerBiController : ControllerBase
{
    private readonly IPowerBiStatementsService _powerBiStatementsService;

    public PowerBiController(IPowerBiStatementsService powerBiStatementsService)
    {
        _powerBiStatementsService = powerBiStatementsService;
    }

    [HttpGet("PredefinedStatements")]
    public Task<CommonResponse<IEnumerable<PowerBiStatementDto>>> GetPredefinedStatements(
        CancellationToken cancellationToken = default)
    {
        return _powerBiStatementsService.GetStatementsAsync(GetCurrentUserId(), cancellationToken);
    }

    [HttpGet("PredefinedStatements/{statementId:int}")]
    public Task<CommonResponse<PowerBiStatementDto>> GetPredefinedStatementById(
        int statementId,
        CancellationToken cancellationToken = default)
    {
        return _powerBiStatementsService.GetStatementByIdAsync(statementId, GetCurrentUserId(), cancellationToken);
    }

    [HttpGet("PredefinedStatements/Lookups")]
    public Task<CommonResponse<PowerBiStatementLookupsDto>> GetPredefinedStatementsLookups(
        CancellationToken cancellationToken = default)
    {
        return _powerBiStatementsService.GetLookupsAsync(GetCurrentUserId(), cancellationToken);
    }

    [HttpPost("PredefinedStatements")]
    public Task<CommonResponse<PowerBiStatementDto>> CreatePredefinedStatement(
        [FromBody] PowerBiStatementUpsertRequestDto request,
        CancellationToken cancellationToken = default)
    {
        return _powerBiStatementsService.CreateStatementAsync(request, GetCurrentUserId(), cancellationToken);
    }

    [HttpPut("PredefinedStatements/{statementId:int}")]
    public Task<CommonResponse<PowerBiStatementDto>> UpdatePredefinedStatement(
        int statementId,
        [FromBody] PowerBiStatementUpsertRequestDto request,
        CancellationToken cancellationToken = default)
    {
        return _powerBiStatementsService.UpdateStatementAsync(statementId, request, GetCurrentUserId(), cancellationToken);
    }

    [HttpDelete("PredefinedStatements/{statementId:int}")]
    public Task<CommonResponse<PowerBiStatementDeleteResultDto>> DeletePredefinedStatement(
        int statementId,
        CancellationToken cancellationToken = default)
    {
        return _powerBiStatementsService.DeleteStatementAsync(statementId, GetCurrentUserId(), cancellationToken);
    }

    private string GetCurrentUserId()
    {
        return HttpContext.User.Claims.FirstOrDefault(claim => claim.Type == "UserId")?.Value ?? string.Empty;
    }
}
