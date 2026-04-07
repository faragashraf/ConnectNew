using Models.DTO.Common;
using Models.DTO.DynamicSubjects;

namespace Persistence.Services.Notifications;

public interface ISubjectNotificationService
{
    Task<CommonResponse<IEnumerable<SubjectNotificationRuleDto>>> GetRulesAsync(
        int subjectTypeId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<IEnumerable<SubjectNotificationRuleDto>>> UpsertRulesAsync(
        int subjectTypeId,
        SubjectNotificationRulesUpsertRequestDto request,
        string actorUserId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<bool>> SendNotificationAsync(
        SubjectNotificationDispatchRequestDto request,
        CancellationToken cancellationToken = default);
}
