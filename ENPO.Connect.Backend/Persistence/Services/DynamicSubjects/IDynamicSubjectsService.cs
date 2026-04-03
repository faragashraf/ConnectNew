using Models.DTO.Common;
using Models.DTO.DynamicSubjects;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;

namespace Persistence.Services.DynamicSubjects;

public interface IDynamicSubjectsService
{
    Task<CommonResponse<IEnumerable<SubjectCategoryTreeNodeDto>>> GetCategoryTreeAsync(
        string userId,
        string? appId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<SubjectFormDefinitionDto>> GetFormDefinitionAsync(
        int categoryId,
        string userId,
        string? appId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<SubjectDetailDto>> CreateSubjectAsync(
        SubjectUpsertRequestDto request,
        IEnumerable<(string FileName, byte[] Content, string Extension, long Size)> attachments,
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<SubjectDetailDto>> UpdateSubjectAsync(
        int messageId,
        SubjectUpsertRequestDto request,
        IEnumerable<(string FileName, byte[] Content, string Extension, long Size)> attachments,
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<SubjectDetailDto>> GetSubjectAsync(
        int messageId,
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<PagedSubjectListDto>> ListSubjectsAsync(
        SubjectListQueryDto query,
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<SubjectStatusChangeResponseDto>> ChangeStatusAsync(
        int messageId,
        SubjectStatusChangeRequestDto request,
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<IEnumerable<SubjectAttachmentDto>>> AddAttachmentsAsync(
        int messageId,
        IEnumerable<(string FileName, byte[] Content, string Extension, long Size)> attachments,
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<bool>> RemoveAttachmentAsync(
        int messageId,
        int attachmentId,
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<IEnumerable<SubjectStakeholderDto>>> UpsertStakeholdersAsync(
        int messageId,
        IReadOnlyCollection<SubjectStakeholderUpsertDto> stakeholders,
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<SubjectTaskDto>> UpsertTaskAsync(
        int messageId,
        SubjectTaskUpsertDto request,
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<PagedEnvelopeListDto>> ListEnvelopesAsync(
        EnvelopeListQueryDto query,
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<EnvelopeDetailDto>> CreateEnvelopeAsync(
        EnvelopeUpsertRequestDto request,
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<EnvelopeDetailDto>> UpdateEnvelopeAsync(
        int envelopeId,
        EnvelopeUpsertRequestDto request,
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<EnvelopeDetailDto>> GetEnvelopeAsync(
        int envelopeId,
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<bool>> LinkSubjectToEnvelopeAsync(
        int envelopeId,
        int messageId,
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<bool>> UnlinkSubjectFromEnvelopeAsync(
        int envelopeId,
        int messageId,
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<SubjectDashboardDto>> GetDashboardAsync(
        SubjectDashboardQueryDto query,
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<IEnumerable<SubjectTypeAdminDto>>> GetSubjectTypeAdminConfigsAsync(
        string userId,
        string? appId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<SubjectTypeAdminDto>> UpsertSubjectTypeAdminConfigAsync(
        int categoryId,
        SubjectTypeAdminUpsertRequestDto request,
        string userId,
        CancellationToken cancellationToken = default);
}
