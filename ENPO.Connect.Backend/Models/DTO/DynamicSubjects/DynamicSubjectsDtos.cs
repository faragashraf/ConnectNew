using Microsoft.AspNetCore.Http;
using System;
using System.Collections.Generic;

namespace Models.DTO.DynamicSubjects;

public sealed class SubjectCategoryTreeNodeDto
{
    public int CategoryId { get; set; }

    public int ParentCategoryId { get; set; }

    public string CategoryName { get; set; } = string.Empty;

    public bool IsActive { get; set; }

    public string? ApplicationId { get; set; }

    public bool HasDynamicFields { get; set; }

    public bool CanCreate { get; set; }

    public int DisplayOrder { get; set; }

    public List<SubjectCategoryTreeNodeDto> Children { get; set; } = new();
}

public sealed class SubjectGroupDefinitionDto
{
    public int GroupId { get; set; }

    public string GroupName { get; set; } = string.Empty;

    public string? GroupDescription { get; set; }

    public bool IsExtendable { get; set; }

    public short? GroupWithInRow { get; set; }
}

public sealed class SubjectFieldDefinitionDto
{
    public int MendSql { get; set; }

    public int CategoryId { get; set; }

    public int MendGroup { get; set; }

    public string FieldKey { get; set; } = string.Empty;

    public string FieldType { get; set; } = string.Empty;

    public string? FieldLabel { get; set; }

    public string? Placeholder { get; set; }

    public string? DefaultValue { get; set; }

    public string? OptionsPayload { get; set; }

    public string? DataType { get; set; }

    public bool Required { get; set; }

    public bool RequiredTrue { get; set; }

    public bool Email { get; set; }

    public bool Pattern { get; set; }

    public string? MinValue { get; set; }

    public string? MaxValue { get; set; }

    public string? Mask { get; set; }

    public bool IsDisabledInit { get; set; }

    public bool IsSearchable { get; set; }

    public int Width { get; set; }

    public int Height { get; set; }

    public string? ApplicationId { get; set; }

    public int DisplayOrder { get; set; }

    public bool IsVisible { get; set; } = true;

    public string? DisplaySettingsJson { get; set; }

    public SubjectGroupDefinitionDto? Group { get; set; }
}

public sealed class SubjectFormDefinitionDto
{
    public int CategoryId { get; set; }

    public string CategoryName { get; set; } = string.Empty;

    public int ParentCategoryId { get; set; }

    public string? ApplicationId { get; set; }

    public List<SubjectGroupDefinitionDto> Groups { get; set; } = new();

    public List<SubjectFieldDefinitionDto> Fields { get; set; } = new();
}

public sealed class SubjectFieldValueDto
{
    public int? FildSql { get; set; }

    public string FieldKey { get; set; } = string.Empty;

    public string? Value { get; set; }

    public int? InstanceGroupId { get; set; }
}

public sealed class SubjectStakeholderUpsertDto
{
    public int StockholderId { get; set; }

    public string PartyType { get; set; } = "Viewer";

    public bool RequiredResponse { get; set; }

    public byte? Status { get; set; }

    public DateTime? DueDate { get; set; }

    public string? Notes { get; set; }
}

public sealed class SubjectTaskUpsertDto
{
    public string ActionTitle { get; set; } = string.Empty;

    public string? ActionDescription { get; set; }

    public string? AssignedToUserId { get; set; }

    public string? AssignedUnitId { get; set; }

    public DateTime? DueDateUtc { get; set; }

    public byte Status { get; set; }
}

public sealed class SubjectUpsertRequestDto
{
    public int CategoryId { get; set; }

    public string? Subject { get; set; }

    public string? Description { get; set; }

    public bool SaveAsDraft { get; set; } = true;

    public bool Submit { get; set; }

    public int? EnvelopeId { get; set; }

    public List<SubjectFieldValueDto> DynamicFields { get; set; } = new();

    public List<SubjectStakeholderUpsertDto> Stakeholders { get; set; } = new();

    public List<SubjectTaskUpsertDto> Tasks { get; set; } = new();
}

public sealed class SubjectUpsertFormRequestDto
{
    public int CategoryId { get; set; }

    public string? Subject { get; set; }

    public string? Description { get; set; }

    public bool SaveAsDraft { get; set; } = true;

    public bool Submit { get; set; }

    public int? EnvelopeId { get; set; }

    public string? DynamicFieldsJson { get; set; }

    public string? StakeholdersJson { get; set; }

    public string? TasksJson { get; set; }

    public List<IFormFile> Files { get; set; } = new();
}

public sealed class SubjectAttachmentsFormRequestDto
{
    public List<IFormFile> Files { get; set; } = new();
}

public sealed class SubjectStatusChangeRequestDto
{
    public byte NewStatus { get; set; }

    public string? Notes { get; set; }
}

public sealed class SubjectStatusChangeResponseDto
{
    public int MessageId { get; set; }

    public byte OldStatus { get; set; }

    public byte NewStatus { get; set; }

    public DateTime ChangedAtUtc { get; set; }

    public string ChangedBy { get; set; } = string.Empty;
}

public sealed class SubjectAttachmentDto
{
    public int AttachmentId { get; set; }

    public string FileName { get; set; } = string.Empty;

    public string? FileExtension { get; set; }

    public long? FileSize { get; set; }

    public DateTime? UploadedAtUtc { get; set; }
}

public sealed class SubjectStakeholderDto
{
    public int MessageStockholderId { get; set; }

    public int StockholderId { get; set; }

    public string PartyType { get; set; } = string.Empty;

    public bool RequiredResponse { get; set; }

    public byte? Status { get; set; }

    public DateTime? DueDate { get; set; }

    public string? Notes { get; set; }
}

public sealed class SubjectTaskDto
{
    public long TaskId { get; set; }

    public string ActionTitle { get; set; } = string.Empty;

    public string? ActionDescription { get; set; }

    public string? AssignedToUserId { get; set; }

    public string? AssignedUnitId { get; set; }

    public byte Status { get; set; }

    public DateTime? DueDateUtc { get; set; }

    public DateTime? CompletedAtUtc { get; set; }

    public DateTime CreatedAtUtc { get; set; }
}

public sealed class SubjectTimelineEventDto
{
    public long TimelineEventId { get; set; }

    public string EventType { get; set; } = string.Empty;

    public string EventTitle { get; set; } = string.Empty;

    public string? EventPayloadJson { get; set; }

    public byte? StatusFrom { get; set; }

    public byte? StatusTo { get; set; }

    public string CreatedBy { get; set; } = string.Empty;

    public DateTime CreatedAtUtc { get; set; }
}

public sealed class EnvelopeSummaryDto
{
    public int EnvelopeId { get; set; }

    public string EnvelopeRef { get; set; } = string.Empty;

    public DateTime IncomingDate { get; set; }

    public string? SourceEntity { get; set; }

    public string? DeliveryDelegate { get; set; }

    public int LinkedSubjectsCount { get; set; }
}

public sealed class EnvelopeLinkedSubjectDto
{
    public int MessageId { get; set; }

    public string? RequestRef { get; set; }

    public string? Subject { get; set; }

    public byte Status { get; set; }

    public int CategoryId { get; set; }
}

public sealed class EnvelopeDetailDto
{
    public int EnvelopeId { get; set; }

    public string EnvelopeRef { get; set; } = string.Empty;

    public DateTime IncomingDate { get; set; }

    public string? SourceEntity { get; set; }

    public string? DeliveryDelegate { get; set; }

    public string? Notes { get; set; }

    public string CreatedBy { get; set; } = string.Empty;

    public DateTime CreatedAtUtc { get; set; }

    public List<EnvelopeLinkedSubjectDto> LinkedSubjects { get; set; } = new();
}

public sealed class EnvelopeUpsertRequestDto
{
    public string EnvelopeRef { get; set; } = string.Empty;

    public DateTime IncomingDate { get; set; }

    public string? SourceEntity { get; set; }

    public string? DeliveryDelegate { get; set; }

    public string? Notes { get; set; }

    public List<int> LinkedSubjectIds { get; set; } = new();
}

public sealed class EnvelopeListQueryDto
{
    public string? SearchText { get; set; }

    public DateTime? IncomingDateFrom { get; set; }

    public DateTime? IncomingDateTo { get; set; }

    public int PageNumber { get; set; } = 1;

    public int PageSize { get; set; } = 20;
}

public sealed class PagedEnvelopeListDto
{
    public int TotalCount { get; set; }

    public int PageNumber { get; set; }

    public int PageSize { get; set; }

    public List<EnvelopeSummaryDto> Items { get; set; } = new();
}

public sealed class SubjectListQueryDto
{
    public string? SearchText { get; set; }

    public int? CategoryId { get; set; }

    public byte? Status { get; set; }

    public int? AssignedUnitId { get; set; }

    public DateTime? CreatedFrom { get; set; }

    public DateTime? CreatedTo { get; set; }

    public bool OnlyMyItems { get; set; }

    public int PageNumber { get; set; } = 1;

    public int PageSize { get; set; } = 20;
}

public sealed class SubjectListItemDto
{
    public int MessageId { get; set; }

    public string? RequestRef { get; set; }

    public string? Subject { get; set; }

    public string? Description { get; set; }

    public int CategoryId { get; set; }

    public byte Status { get; set; }

    public string StatusLabel { get; set; } = string.Empty;

    public string? CreatedBy { get; set; }

    public string? AssignedUnitId { get; set; }

    public DateTime CreatedDate { get; set; }

    public DateTime? LastModifiedDate { get; set; }

    public int AttachmentsCount { get; set; }

    public int StakeholdersCount { get; set; }

    public int TasksCount { get; set; }

    public int EnvelopesCount { get; set; }
}

public sealed class PagedSubjectListDto
{
    public int TotalCount { get; set; }

    public int PageNumber { get; set; }

    public int PageSize { get; set; }

    public List<SubjectListItemDto> Items { get; set; } = new();
}

public sealed class SubjectDetailDto
{
    public int MessageId { get; set; }

    public int CategoryId { get; set; }

    public string? Subject { get; set; }

    public string? Description { get; set; }

    public string? RequestRef { get; set; }

    public byte Status { get; set; }

    public string StatusLabel { get; set; } = string.Empty;

    public string? CreatedBy { get; set; }

    public string? AssignedUnitId { get; set; }

    public string? CurrentResponsibleUnitId { get; set; }

    public DateTime CreatedDate { get; set; }

    public DateTime? LastModifiedDate { get; set; }

    public List<SubjectFieldValueDto> DynamicFields { get; set; } = new();

    public List<SubjectAttachmentDto> Attachments { get; set; } = new();

    public List<SubjectStakeholderDto> Stakeholders { get; set; } = new();

    public List<SubjectTaskDto> Tasks { get; set; } = new();

    public List<SubjectTimelineEventDto> Timeline { get; set; } = new();

    public List<EnvelopeSummaryDto> LinkedEnvelopes { get; set; } = new();
}

public sealed class SubjectDashboardQueryDto
{
    public int? CategoryId { get; set; }

    public int? UnitId { get; set; }

    public bool OnlyMyItems { get; set; }
}

public sealed class SubjectDashboardCardDto
{
    public string Key { get; set; } = string.Empty;

    public string Label { get; set; } = string.Empty;

    public int Count { get; set; }
}

public sealed class SubjectDashboardDto
{
    public int TotalSubjects { get; set; }

    public int DraftCount { get; set; }

    public int SubmittedCount { get; set; }

    public int UnderReviewCount { get; set; }

    public int PendingCompletionCount { get; set; }

    public int InProgressCount { get; set; }

    public int CompletedCount { get; set; }

    public int RejectedCount { get; set; }

    public int ArchivedCount { get; set; }

    public int TotalEnvelopes { get; set; }

    public int OpenTasksCount { get; set; }

    public List<SubjectDashboardCardDto> StatusCards { get; set; } = new();

    public List<SubjectListItemDto> RecentSubjects { get; set; } = new();

    public List<SubjectTimelineEventDto> RecentUpdates { get; set; } = new();
}

public sealed class SubjectTypeAdminDto
{
    public int CategoryId { get; set; }

    public int ParentCategoryId { get; set; }

    public string CategoryName { get; set; } = string.Empty;

    public string? ApplicationId { get; set; }

    public string? CatMend { get; set; }

    public int CatWorkFlow { get; set; }

    public bool CatSms { get; set; }

    public bool CatMailNotification { get; set; }

    public string? To { get; set; }

    public string? Cc { get; set; }

    public bool IsActive { get; set; }

    public bool HasDynamicFields { get; set; }

    public bool CanCreate { get; set; }

    public int DisplayOrder { get; set; }

    public string? SettingsJson { get; set; }

    public int? ReferencePolicyId { get; set; }

    public bool ReferencePolicyEnabled { get; set; }

    public string? ReferencePrefix { get; set; }

    public string? ReferenceSeparator { get; set; }

    public string? SourceFieldKeys { get; set; }

    public bool IncludeYear { get; set; }

    public bool UseSequence { get; set; }

    public string? SequenceName { get; set; }

    public string? LastModifiedBy { get; set; }

    public DateTime? LastModifiedAtUtc { get; set; }
}

public sealed class SubjectTypeAdminUpsertRequestDto
{
    public bool IsActive { get; set; } = true;

    public bool ReferencePolicyEnabled { get; set; } = true;

    public string? ReferencePrefix { get; set; }

    public string? ReferenceSeparator { get; set; } = "-";

    public string? SourceFieldKeys { get; set; }

    public bool IncludeYear { get; set; } = true;

    public bool UseSequence { get; set; } = true;

    public string? SequenceName { get; set; }
}

public sealed class SubjectTypeAdminTreeMoveRequestDto
{
    public int NewParentCategoryId { get; set; }

    public int NewIndex { get; set; }
}

public sealed class SubjectTypeAdminStatusRequestDto
{
    public bool IsActive { get; set; } = true;
}

public sealed class SubjectTypeAdminCreateRequestDto
{
    public int ParentCategoryId { get; set; }

    public string CategoryName { get; set; } = string.Empty;

    public string? ApplicationId { get; set; }

    public string? CatMend { get; set; }

    public int CatWorkFlow { get; set; }

    public bool CatSms { get; set; }

    public bool CatMailNotification { get; set; }

    public string? To { get; set; }

    public string? Cc { get; set; }

    public bool IsActive { get; set; } = true;
}

public sealed class SubjectTypeAdminUpdateRequestDto
{
    public string CategoryName { get; set; } = string.Empty;

    public string? ApplicationId { get; set; }

    public string? CatMend { get; set; }

    public int CatWorkFlow { get; set; }

    public bool CatSms { get; set; }

    public bool CatMailNotification { get; set; }

    public string? To { get; set; }

    public string? Cc { get; set; }

    public bool IsActive { get; set; } = true;
}

public sealed class SubjectAdminFieldDto
{
    public int CdmendSql { get; set; }

    public string FieldKey { get; set; } = string.Empty;

    public string FieldType { get; set; } = string.Empty;

    public string? FieldLabel { get; set; }

    public string? Placeholder { get; set; }

    public string? DefaultValue { get; set; }

    public string? OptionsPayload { get; set; }

    public string? DataType { get; set; }

    public bool Required { get; set; }

    public bool RequiredTrue { get; set; }

    public bool Email { get; set; }

    public bool Pattern { get; set; }

    public string? MinValue { get; set; }

    public string? MaxValue { get; set; }

    public string? Mask { get; set; }

    public bool IsActive { get; set; }

    public int Width { get; set; }

    public int Height { get; set; }

    public bool IsDisabledInit { get; set; }

    public bool IsSearchable { get; set; }

    public string? ApplicationId { get; set; }

    public int LinkedCategoriesCount { get; set; }
}

public sealed class SubjectAdminFieldUpsertRequestDto
{
    public int? CdmendSql { get; set; }

    public string FieldKey { get; set; } = string.Empty;

    public string FieldType { get; set; } = string.Empty;

    public string? FieldLabel { get; set; }

    public string? Placeholder { get; set; }

    public string? DefaultValue { get; set; }

    public string? OptionsPayload { get; set; }

    public string? DataType { get; set; }

    public bool Required { get; set; }

    public bool RequiredTrue { get; set; }

    public bool Email { get; set; }

    public bool Pattern { get; set; }

    public string? MinValue { get; set; }

    public string? MaxValue { get; set; }

    public string? Mask { get; set; }

    public bool IsActive { get; set; } = true;

    public int Width { get; set; }

    public int Height { get; set; }

    public bool IsDisabledInit { get; set; }

    public bool IsSearchable { get; set; }

    public string? ApplicationId { get; set; }
}

public sealed class SubjectAdminGroupDto
{
    public int GroupId { get; set; }

    public string? GroupName { get; set; }

    public string? GroupDescription { get; set; }

    public bool IsExtendable { get; set; }

    public short? GroupWithInRow { get; set; }

    public int LinkedFieldsCount { get; set; }
}

public sealed class SubjectAdminGroupUpsertRequestDto
{
    public string? GroupName { get; set; }

    public string? GroupDescription { get; set; }

    public bool IsExtendable { get; set; }

    public short? GroupWithInRow { get; set; }
}

public sealed class SubjectCategoryFieldLinkAdminDto
{
    public int MendSql { get; set; }

    public int CategoryId { get; set; }

    public string FieldKey { get; set; } = string.Empty;

    public string? FieldLabel { get; set; }

    public string? FieldType { get; set; }

    public int GroupId { get; set; }

    public string? GroupName { get; set; }

    public bool IsActive { get; set; }

    public int DisplayOrder { get; set; }

    public bool IsVisible { get; set; } = true;

    public string? DisplaySettingsJson { get; set; }

    public string? ApplicationId { get; set; }
}

public sealed class SubjectCategoryFieldLinkUpsertItemDto
{
    public int? MendSql { get; set; }

    public string FieldKey { get; set; } = string.Empty;

    public int GroupId { get; set; }

    public bool IsActive { get; set; } = true;

    public int DisplayOrder { get; set; }

    public bool IsVisible { get; set; } = true;

    public string? DisplaySettingsJson { get; set; }
}

public sealed class SubjectCategoryFieldLinksUpsertRequestDto
{
    public List<SubjectCategoryFieldLinkUpsertItemDto> Links { get; set; } = new();
}

public sealed class DynamicSubjectRealtimeEventDto
{
    public string Kind { get; set; } = "DYNAMIC_SUBJECT_EVENT";

    public string EventId { get; set; } = Guid.NewGuid().ToString("N");

    public string EventType { get; set; } = string.Empty;

    public string EntityType { get; set; } = string.Empty;

    public int EntityId { get; set; }

    public int? MessageId { get; set; }

    public int? EnvelopeId { get; set; }

    public int? CategoryId { get; set; }

    public byte? Status { get; set; }

    public string? StatusLabel { get; set; }

    public string? ReferenceNumber { get; set; }

    public string? Summary { get; set; }

    public DateTime TimestampUtc { get; set; }

    public string? ActorUserId { get; set; }

    public Dictionary<string, string?> Data { get; set; } = new(StringComparer.OrdinalIgnoreCase);
}
