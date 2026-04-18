using Models.DTO.Common;
using Models.DTO.PowerBi;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace Persistence.Services.PowerBi;

public interface IPowerBiStatementsService
{
    Task<CommonResponse<IEnumerable<PowerBiStatementDto>>> GetStatementsAsync(
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<PowerBiStatementDto>> GetStatementByIdAsync(
        int statementId,
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<PowerBiStatementLookupsDto>> GetLookupsAsync(
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<PowerBiStatementDto>> CreateStatementAsync(
        PowerBiStatementUpsertRequestDto request,
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<PowerBiStatementDto>> UpdateStatementAsync(
        int statementId,
        PowerBiStatementUpsertRequestDto request,
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<PowerBiStatementDeleteResultDto>> DeleteStatementAsync(
        int statementId,
        string userId,
        CancellationToken cancellationToken = default);
}
