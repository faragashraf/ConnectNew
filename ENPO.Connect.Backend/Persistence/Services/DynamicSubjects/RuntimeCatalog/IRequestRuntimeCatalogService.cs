using Models.DTO.Common;
using Models.DTO.DynamicSubjects;
using System.Threading;
using System.Threading.Tasks;

namespace Persistence.Services.DynamicSubjects.RuntimeCatalog;

public interface IRequestRuntimeCatalogService
{
    Task<CommonResponse<RequestRuntimeCatalogDto>> GetAvailableRegistrationTreeAsync(
        string userId,
        string? appId,
        CancellationToken cancellationToken = default);
}
