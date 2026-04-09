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
        int? stageId = null,
        int? actionId = null,
        int? requestId = null,
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

    Task<CommonResponse<IEnumerable<SubjectTypeAdminDto>>> GetAdminCategoryTreeAsync(
        string userId,
        string? appId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<SubjectTypeAdminDto>> CreateAdminCategoryAsync(
        SubjectTypeAdminCreateRequestDto request,
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<SubjectTypeAdminDto>> UpdateAdminCategoryAsync(
        int categoryId,
        SubjectTypeAdminUpdateRequestDto request,
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<bool>> DeleteAdminCategoryAsync(
        int categoryId,
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<SubjectTypeAdminDto>> SetAdminCategoryStatusAsync(
        int categoryId,
        SubjectTypeAdminStatusRequestDto request,
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<SubjectAdminDirectionalReadinessDto>> SetAdminCategoryDirectionStatusAsync(
        int categoryId,
        string documentDirection,
        SubjectTypeAdminDirectionStatusRequestDto request,
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<IEnumerable<SubjectTypeAdminDto>>> MoveAdminCategoryAsync(
        int categoryId,
        SubjectTypeAdminTreeMoveRequestDto request,
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<IEnumerable<SubjectAdminFieldDto>>> GetAdminFieldsAsync(
        string userId,
        string? appId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<SubjectAdminFieldDto>> CreateAdminFieldAsync(
        SubjectAdminFieldUpsertRequestDto request,
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<SubjectAdminFieldDto>> UpdateAdminFieldAsync(
        string fieldKey,
        SubjectAdminFieldUpsertRequestDto request,
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<bool>> DeleteAdminFieldAsync(
        string fieldKey,
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<IEnumerable<SubjectAdminGroupDto>>> GetAdminGroupsAsync(
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<SubjectAdminGroupDto>> CreateAdminGroupAsync(
        SubjectAdminGroupUpsertRequestDto request,
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<SubjectAdminGroupDto>> UpdateAdminGroupAsync(
        int groupId,
        SubjectAdminGroupUpsertRequestDto request,
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<bool>> DeleteAdminGroupAsync(
        int groupId,
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<IEnumerable<SubjectCategoryFieldLinkAdminDto>>> GetAdminCategoryFieldLinksAsync(
        int categoryId,
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<IEnumerable<SubjectCategoryFieldLinkAdminDto>>> UpsertAdminCategoryFieldLinksAsync(
        int categoryId,
        SubjectCategoryFieldLinksUpsertRequestDto request,
        string userId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<SubjectFormDefinitionDto>> GetAdminPreviewAsync(
        int categoryId,
        string userId,
        string? appId,
        CancellationToken cancellationToken = default);

    Task<CommonResponse<SubjectAdminPreviewWorkspaceDto>> GetAdminPreviewWorkspaceAsync(
        int categoryId,
        string userId,
        string? appId,
        string? documentDirection,
        CancellationToken cancellationToken = default);
}
