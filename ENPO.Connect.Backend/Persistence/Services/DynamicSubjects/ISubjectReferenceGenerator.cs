using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace Persistence.Services.DynamicSubjects;

public interface ISubjectReferenceGenerator
{
    Task<string> GenerateAsync(
        int categoryId,
        int messageId,
        IReadOnlyDictionary<string, string?> dynamicFields,
        CancellationToken cancellationToken = default);
}
