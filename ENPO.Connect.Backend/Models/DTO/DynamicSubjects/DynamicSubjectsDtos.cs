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

    public bool CanView { get; set; } = true;

    public bool CanEdit { get; set; } = true;

    public bool CanFill { get; set; } = true;

    public bool IsHidden { get; set; }

    public bool IsReadOnly { get; set; }

    public bool IsRequired { get; set; }

    public bool IsLocked { get; set; }

    public string? LockReason { get; set; }
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

    public bool CanView { get; set; } = true;

    public bool CanEdit { get; set; } = true;

    public bool CanFill { get; set; } = true;

    public bool IsHidden { get; set; }

    public bool IsReadOnly { get; set; }

    public bool IsRequired { get; set; }

    public bool IsLocked { get; set; }

    public string? LockReason { get; set; }
}

public sealed class SubjectFormDefinitionDto
{
    public int CategoryId { get; set; }

    public string CategoryName { get; set; } = string.Empty;

    public int ParentCategoryId { get; set; }

    public string? ApplicationId { get; set; }

    public List<SubjectGroupDefinitionDto> Groups { get; set; } = new();

    public List<SubjectFieldDefinitionDto> Fields { get; set; } = new();

    public RequestPolicyDefinitionDto? RequestPolicy { get; set; }
}

public sealed class SubjectAdminPreviewIssueDto
{
    public string Code { get; set; } = string.Empty;

    public string Severity { get; set; } = "Warning";

    public string Message { get; set; } = string.Empty;

    public string? FieldKey { get; set; }

    public int? GroupId { get; set; }
}

public sealed class SubjectAdminPreviewReadinessDto
{
    public bool IsReady { get; set; }

    public int LinkedFieldsCount { get; set; }

    public int ActiveLinkedFieldsCount { get; set; }

    public int VisibleLinkedFieldsCount { get; set; }

    public int RenderableFieldsCount { get; set; }

    public int MissingDefinitionCount { get; set; }

    public int MissingBindingsCount { get; set; }

    public int InvalidDisplaySettingsCount { get; set; }

    public List<SubjectAdminPreviewIssueDto> Issues { get; set; } = new();
}

public sealed class SubjectAdminDirectionalReadinessDto
{
    public string Direction { get; set; } = string.Empty;

    public bool IsPublished { get; set; }

    public DateTime? LastChangedAtUtc { get; set; }

    public string? LastChangedBy { get; set; }

    public SubjectAdminPreviewReadinessDto Readiness { get; set; } = new();
}

public sealed class SubjectAdminPreviewWorkspaceDto
{
    public int CategoryId { get; set; }

    public string CategoryName { get; set; } = string.Empty;

    public int ParentCategoryId { get; set; }

    public string? ApplicationId { get; set; }

    public SubjectTypeAdminDto? SubjectType { get; set; }

    public SubjectFormDefinitionDto? FormDefinition { get; set; }

    public List<SubjectCategoryFieldLinkAdminDto> FieldLinks { get; set; } = new();

    public SubjectAdminPreviewReadinessDto Readiness { get; set; } = new();

    public string? ActiveDirection { get; set; }

    public List<SubjectAdminDirectionalReadinessDto> DirectionalReadiness { get; set; } = new();

    public bool AllDirectionsReady { get; set; }

    public DateTime GeneratedAtUtc { get; set; } = DateTime.UtcNow;
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

    public string? DocumentDirection { get; set; }

    public int? StageId { get; set; }

    public int? ActionId { get; set; }

    public string? Subject { get; set; }

    public string? Description { get; set; }

    public bool SaveAsDraft { get; set; } = true;

    public bool Submit { get; set; }

    public int? EnvelopeId { get; set; }

    public string? TargetUnitId { get; set; }

    public List<SubjectFieldValueDto> DynamicFields { get; set; } = new();

    public List<SubjectStakeholderUpsertDto> Stakeholders { get; set; } = new();

    public List<SubjectTaskUpsertDto> Tasks { get; set; } = new();
}

public sealed class SubjectUpsertFormRequestDto
{
    public int CategoryId { get; set; }

    public string? DocumentDirection { get; set; }

    public int? StageId { get; set; }

    public int? ActionId { get; set; }

    public string? Subject { get; set; }

    public string? Description { get; set; }

    public bool SaveAsDraft { get; set; } = true;

    public bool Submit { get; set; }

    public int? EnvelopeId { get; set; }

    public string? TargetUnitId { get; set; }

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

    public string? DocumentDirection { get; set; }

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

    public string? DocumentDirection { get; set; }

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

public sealed class RequestPolicyDefinitionDto
{
    public int Version { get; set; } = 1;

    public List<RequestPolicyPresentationRuleDto> PresentationRules { get; set; } = new();

    public RequestAccessPolicyDto AccessPolicy { get; set; } = new();

    public RequestWorkflowPolicyDto WorkflowPolicy { get; set; } = new();
}

public sealed class RequestPolicyConditionDto
{
    public string Variable { get; set; } = string.Empty;

    public string Operator { get; set; } = "eq";

    public string? Value { get; set; }

    public List<string> Values { get; set; } = new();
}

public sealed class RequestPolicyFieldPatchDto
{
    public string FieldKey { get; set; } = string.Empty;

    public string? Label { get; set; }

    public bool? Visible { get; set; }

    public bool? Required { get; set; }

    public bool? Readonly { get; set; }

    public string? Placeholder { get; set; }

    public string? HelpText { get; set; }
}

public sealed class RequestPolicyPresentationRuleDto
{
    public string RuleId { get; set; } = string.Empty;

    public bool IsEnabled { get; set; } = true;

    public int Priority { get; set; } = 100;

    public List<RequestPolicyConditionDto> Conditions { get; set; } = new();

    public List<RequestPolicyFieldPatchDto> FieldPatches { get; set; } = new();
}

public sealed class RequestPolicyPrincipalScopeDto
{
    public List<string> UnitIds { get; set; } = new();

    public List<string> RoleIds { get; set; } = new();

    public List<string> GroupIds { get; set; } = new();
}

public sealed class RequestAccessPolicyDto
{
    public string CreateMode { get; set; } = "single";

    public RequestPolicyPrincipalScopeDto CreateScope { get; set; } = new();

    public RequestPolicyPrincipalScopeDto ReadScope { get; set; } = new();

    public RequestPolicyPrincipalScopeDto WorkScope { get; set; } = new();

    public bool InheritLegacyAccess { get; set; } = true;
}

public sealed class RequestWorkflowPolicyDto
{
    public string Mode { get; set; } = "manual";

    public string DirectionMode { get; set; } = "selectable";

    public string? FixedDirection { get; set; }

    public List<string> StaticTargetUnitIds { get; set; } = new();

    public bool AllowManualSelection { get; set; } = true;

    public string? ManualTargetFieldKey { get; set; }

    public bool ManualSelectionRequired { get; set; } = true;

    public string? DefaultTargetUnitId { get; set; }
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

    public int SequencePaddingLength { get; set; }

    public string SequenceResetScope { get; set; } = "none";

    public string? LastModifiedBy { get; set; }

    public DateTime? LastModifiedAtUtc { get; set; }

    public RequestPolicyDefinitionDto? RequestPolicy { get; set; }
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

    public int SequencePaddingLength { get; set; }

    public string SequenceResetScope { get; set; } = "none";

    public RequestPolicyDefinitionDto? RequestPolicy { get; set; }
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

public sealed class SubjectTypeAdminDirectionStatusRequestDto
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

public sealed class SubjectNotificationRuleDto
{
    public int Id { get; set; }

    public int SubjectTypeId { get; set; }

    public string EventType { get; set; } = string.Empty;

    public string RecipientType { get; set; } = string.Empty;

    public string RecipientValue { get; set; } = string.Empty;

    public string Template { get; set; } = string.Empty;

    public bool IsActive { get; set; } = true;
}

public sealed class SubjectNotificationRuleUpsertDto
{
    public int? Id { get; set; }

    public string EventType { get; set; } = string.Empty;

    public string RecipientType { get; set; } = string.Empty;

    public string RecipientValue { get; set; } = string.Empty;

    public string Template { get; set; } = string.Empty;

    public bool IsActive { get; set; } = true;
}

public sealed class SubjectNotificationRulesUpsertRequestDto
{
    public List<SubjectNotificationRuleUpsertDto> Rules { get; set; } = new();
}

public sealed class SubjectNotificationPayloadDto
{
    public int RequestId { get; set; }

    public string? RequestTitle { get; set; }

    public string? CreatedBy { get; set; }

    public string? UnitName { get; set; }
}

public sealed class SubjectNotificationDispatchRequestDto
{
    public string EventType { get; set; } = string.Empty;

    public int SubjectTypeId { get; set; }

    public SubjectNotificationPayloadDto Payload { get; set; } = new();
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

public sealed class FieldAccessPolicyWorkspaceDto
{
    public int RequestTypeId { get; set; }

    public string RequestTypeName { get; set; } = string.Empty;

    public FieldAccessPolicyDto Policy { get; set; } = new();

    public List<FieldAccessPolicyRuleDto> Rules { get; set; } = new();

    public List<FieldAccessLockDto> Locks { get; set; } = new();

    public List<FieldAccessLookupItemDto> Groups { get; set; } = new();

    public List<FieldAccessLookupItemDto> Fields { get; set; } = new();

    public List<FieldAccessStageLookupDto> Stages { get; set; } = new();

    public List<FieldAccessActionLookupDto> Actions { get; set; } = new();

    public DateTime GeneratedAtUtc { get; set; } = DateTime.UtcNow;
}

public sealed class FieldAccessPolicyDto
{
    public int? Id { get; set; }

    public string Name { get; set; } = string.Empty;

    public bool IsActive { get; set; } = true;

    public string DefaultAccessMode { get; set; } = "Editable";
}

public sealed class FieldAccessPolicyRuleDto
{
    public int? Id { get; set; }

    public string TargetLevel { get; set; } = "Field";

    public int TargetId { get; set; }

    public int? StageId { get; set; }

    public int? ActionId { get; set; }

    public string PermissionType { get; set; } = "Editable";

    public string SubjectType { get; set; } = "OrgUnit";

    public string? SubjectId { get; set; }

    public string Effect { get; set; } = "Allow";

    public int Priority { get; set; } = 100;

    public bool IsActive { get; set; } = true;

    public string? Notes { get; set; }
}

public sealed class FieldAccessLockDto
{
    public int? Id { get; set; }

    public int? StageId { get; set; }

    public int? ActionId { get; set; }

    public string TargetLevel { get; set; } = "Field";

    public int TargetId { get; set; }

    public string LockMode { get; set; } = "NoEdit";

    public string? AllowedOverrideSubjectType { get; set; }

    public string? AllowedOverrideSubjectId { get; set; }

    public bool IsActive { get; set; } = true;

    public string? Notes { get; set; }
}

public sealed class FieldAccessLookupItemDto
{
    public int Id { get; set; }

    public string Code { get; set; } = string.Empty;

    public string Label { get; set; } = string.Empty;

    public int? GroupId { get; set; }
}

public sealed class FieldAccessStageLookupDto
{
    public int Id { get; set; }

    public string Code { get; set; } = string.Empty;

    public string Label { get; set; } = string.Empty;

    public int StepOrder { get; set; }
}

public sealed class FieldAccessActionLookupDto
{
    public int Id { get; set; }

    public int StageId { get; set; }

    public string Code { get; set; } = string.Empty;

    public string Label { get; set; } = string.Empty;

    public int DisplayOrder { get; set; }
}

public sealed class FieldAccessPolicyWorkspaceUpsertRequestDto
{
    public string? PolicyName { get; set; }

    public bool IsPolicyActive { get; set; } = true;

    public string DefaultAccessMode { get; set; } = "Editable";

    public List<FieldAccessPolicyRuleDto> Rules { get; set; } = new();

    public List<FieldAccessLockDto> Locks { get; set; } = new();
}

public sealed class FieldAccessPreviewRequestDto
{
    public int? StageId { get; set; }

    public int? ActionId { get; set; }

    public int? RequestId { get; set; }

    public string? SubjectType { get; set; }

    public string? SubjectId { get; set; }

    public string? RequestOwnerUserId { get; set; }

    public string? CurrentCustodianUnitId { get; set; }
}

public sealed class FieldAccessPreviewResponseDto
{
    public int RequestTypeId { get; set; }

    public int? StageId { get; set; }

    public int? ActionId { get; set; }

    public string? SubjectType { get; set; }

    public string? SubjectId { get; set; }

    public List<SubjectGroupDefinitionDto> Groups { get; set; } = new();

    public List<SubjectFieldDefinitionDto> Fields { get; set; } = new();

    public int HiddenGroupsCount { get; set; }

    public int HiddenFieldsCount { get; set; }

    public int ReadOnlyFieldsCount { get; set; }

    public int RequiredFieldsCount { get; set; }

    public int LockedFieldsCount { get; set; }
}
