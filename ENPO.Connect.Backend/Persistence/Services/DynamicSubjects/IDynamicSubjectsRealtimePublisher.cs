using Models.DTO.DynamicSubjects;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace Persistence.Services.DynamicSubjects;

public sealed class DynamicSubjectRealtimeScope
{
    public List<string> UnitGroupIds { get; set; } = new();

    public List<string> UserIds { get; set; } = new();

    public List<int> SubjectIds { get; set; } = new();

    public List<int> EnvelopeIds { get; set; } = new();

    public List<int> CategoryIds { get; set; } = new();
}

public interface IDynamicSubjectsRealtimePublisher
{
    Task PublishAsync(
        DynamicSubjectRealtimeEventDto eventPayload,
        DynamicSubjectRealtimeScope scope,
        CancellationToken cancellationToken = default);
}
