using Models.DTO.DynamicSubjects;

namespace Persistence.Services.DynamicSubjects.FieldAccess;

public interface IFieldAccessResolutionService
{
    Task<FieldAccessResolutionResult> ResolveAsync(
        FieldAccessResolutionRequest request,
        CancellationToken cancellationToken = default);
}
