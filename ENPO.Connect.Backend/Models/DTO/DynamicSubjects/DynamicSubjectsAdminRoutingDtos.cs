using System;
using System.Collections.Generic;

namespace Models.DTO.DynamicSubjects;

public sealed class SubjectRoutingProfileDto
{
    public int Id { get; set; }

    public int SubjectTypeId { get; set; }

    public string NameAr { get; set; } = string.Empty;

    public string? DescriptionAr { get; set; }

    public bool IsActive { get; set; }

    public string DirectionMode { get; set; } = "Both";

    public int? StartStepId { get; set; }

    public int VersionNo { get; set; }

    public string CreatedBy { get; set; } = string.Empty;

    public DateTime CreatedDate { get; set; }

    public string? LastModifiedBy { get; set; }

    public DateTime? LastModifiedDate { get; set; }
}

public sealed class SubjectRoutingProfileUpsertRequestDto
{
    public int SubjectTypeId { get; set; }

    public string NameAr { get; set; } = string.Empty;

    public string? DescriptionAr { get; set; }

    public bool IsActive { get; set; } = true;

    public string DirectionMode { get; set; } = "Both";

    public int? StartStepId { get; set; }

    public int VersionNo { get; set; } = 1;
}

public sealed class SubjectRoutingStepDto
{
    public int Id { get; set; }

    public int RoutingProfileId { get; set; }

    public string StepCode { get; set; } = string.Empty;

    public string StepNameAr { get; set; } = string.Empty;

    public string StepType { get; set; } = string.Empty;

    public int StepOrder { get; set; }

    public bool IsStart { get; set; }

    public bool IsEnd { get; set; }

    public int? SlaHours { get; set; }

    public bool IsActive { get; set; }

    public string? NotesAr { get; set; }
}

public sealed class SubjectRoutingStepUpsertRequestDto
{
    public int RoutingProfileId { get; set; }

    public string StepCode { get; set; } = string.Empty;

    public string StepNameAr { get; set; } = string.Empty;

    public string StepType { get; set; } = string.Empty;

    public int StepOrder { get; set; }

    public bool IsStart { get; set; }

    public bool IsEnd { get; set; }

    public int? SlaHours { get; set; }

    public bool IsActive { get; set; } = true;

    public string? NotesAr { get; set; }
}

public sealed class SubjectRoutingTargetDto
{
    public int Id { get; set; }

    public int RoutingStepId { get; set; }

    public string TargetMode { get; set; } = string.Empty;

    public decimal? OracleUnitTypeId { get; set; }

    public decimal? OracleOrgUnitId { get; set; }

    public decimal? PositionId { get; set; }

    public string? PositionCode { get; set; }

    public string? SelectedNodeType { get; set; }

    public decimal? SelectedNodeNumericId { get; set; }

    public string? SelectedNodeUserId { get; set; }

    public string? AudienceResolutionMode { get; set; }

    public string? WorkDistributionMode { get; set; }

    public bool AllowMultipleReceivers { get; set; }

    public bool SendToLeaderOnly { get; set; }

    public bool IsActive { get; set; }

    public string? NotesAr { get; set; }
}

public sealed class SubjectRoutingTargetUpsertRequestDto
{
    public int RoutingStepId { get; set; }

    public string TargetMode { get; set; } = string.Empty;

    public decimal? OracleUnitTypeId { get; set; }

    public decimal? OracleOrgUnitId { get; set; }

    public decimal? PositionId { get; set; }

    public string? PositionCode { get; set; }

    public string? SelectedNodeType { get; set; }

    public decimal? SelectedNodeNumericId { get; set; }

    public string? SelectedNodeUserId { get; set; }

    public string? AudienceResolutionMode { get; set; }

    public string? WorkDistributionMode { get; set; }

    public bool AllowMultipleReceivers { get; set; }

    public bool SendToLeaderOnly { get; set; }

    public bool IsActive { get; set; } = true;

    public string? NotesAr { get; set; }
}

public sealed class SubjectRoutingTransitionDto
{
    public int Id { get; set; }

    public int RoutingProfileId { get; set; }

    public int FromStepId { get; set; }

    public int ToStepId { get; set; }

    public string ActionCode { get; set; } = string.Empty;

    public string ActionNameAr { get; set; } = string.Empty;

    public int DisplayOrder { get; set; }

    public bool RequiresComment { get; set; }

    public bool RequiresMandatoryFieldsCompletion { get; set; }

    public bool IsRejectPath { get; set; }

    public bool IsReturnPath { get; set; }

    public bool IsEscalationPath { get; set; }

    public string? ConditionExpression { get; set; }

    public bool IsActive { get; set; }
}

public sealed class SubjectRoutingTransitionUpsertRequestDto
{
    public int RoutingProfileId { get; set; }

    public int FromStepId { get; set; }

    public int ToStepId { get; set; }

    public string ActionCode { get; set; } = string.Empty;

    public string ActionNameAr { get; set; } = string.Empty;

    public int DisplayOrder { get; set; }

    public bool RequiresComment { get; set; }

    public bool RequiresMandatoryFieldsCompletion { get; set; }

    public bool IsRejectPath { get; set; }

    public bool IsReturnPath { get; set; }

    public bool IsEscalationPath { get; set; }

    public string? ConditionExpression { get; set; }

    public bool IsActive { get; set; } = true;
}

public sealed class SubjectTypeRoutingBindingDto
{
    public int Id { get; set; }

    public int SubjectTypeId { get; set; }

    public int RoutingProfileId { get; set; }

    public bool IsDefault { get; set; }

    public bool AppliesToInbound { get; set; }

    public bool AppliesToOutbound { get; set; }

    public bool IsActive { get; set; }
}

public sealed class SubjectTypeRoutingBindingUpsertRequestDto
{
    public int SubjectTypeId { get; set; }

    public int RoutingProfileId { get; set; }

    public bool IsDefault { get; set; }

    public bool AppliesToInbound { get; set; } = true;

    public bool AppliesToOutbound { get; set; } = true;

    public bool IsActive { get; set; } = true;
}

public sealed class SubjectRoutingProfileWorkspaceDto
{
    public SubjectRoutingProfileDto? Profile { get; set; }

    public SubjectTypeRoutingBindingDto? Binding { get; set; }

    public IReadOnlyList<SubjectRoutingStepDto> Steps { get; set; }
        = new List<SubjectRoutingStepDto>();

    public IReadOnlyList<SubjectRoutingTargetDto> Targets { get; set; }
        = new List<SubjectRoutingTargetDto>();

    public IReadOnlyList<SubjectRoutingTransitionDto> Transitions { get; set; }
        = new List<SubjectRoutingTransitionDto>();
}

public sealed class SubjectRoutingPreviewNodeDto
{
    public int StepId { get; set; }

    public string StepCode { get; set; } = string.Empty;

    public string StepNameAr { get; set; } = string.Empty;

    public string StepType { get; set; } = string.Empty;

    public int StepOrder { get; set; }

    public bool IsStart { get; set; }

    public bool IsEnd { get; set; }

    public bool IsRejectStep { get; set; }

    public bool IsReturnStep { get; set; }

    public bool IsEscalationStep { get; set; }

    public string TargetsSummaryAr { get; set; } = string.Empty;
}

public sealed class SubjectRoutingPreviewEdgeDto
{
    public int TransitionId { get; set; }

    public int FromStepId { get; set; }

    public int ToStepId { get; set; }

    public string ActionCode { get; set; } = string.Empty;

    public string ActionNameAr { get; set; } = string.Empty;

    public int DisplayOrder { get; set; }

    public bool IsRejectPath { get; set; }

    public bool IsReturnPath { get; set; }

    public bool IsEscalationPath { get; set; }
}

public sealed class SubjectRoutingPreviewDto
{
    public int RoutingProfileId { get; set; }

    public string ProfileNameAr { get; set; } = string.Empty;

    public int? StartStepId { get; set; }

    public IReadOnlyList<SubjectRoutingPreviewNodeDto> Nodes { get; set; }
        = new List<SubjectRoutingPreviewNodeDto>();

    public IReadOnlyList<SubjectRoutingPreviewEdgeDto> Edges { get; set; }
        = new List<SubjectRoutingPreviewEdgeDto>();

    public string SummaryAr { get; set; } = string.Empty;
}

public sealed class SubjectRoutingValidationMessageDto
{
    public string Code { get; set; } = string.Empty;

    public string Severity { get; set; } = "Error";

    public bool IsBlocking { get; set; }

    public string MessageAr { get; set; } = string.Empty;

    public string? RelatedEntityType { get; set; }

    public int? RelatedEntityId { get; set; }
}

public sealed class SubjectRoutingValidationResultDto
{
    public int RoutingProfileId { get; set; }

    public bool IsValid { get; set; }

    public IReadOnlyList<SubjectRoutingValidationMessageDto> Errors { get; set; }
        = new List<SubjectRoutingValidationMessageDto>();

    public IReadOnlyList<SubjectRoutingValidationMessageDto> Warnings { get; set; }
        = new List<SubjectRoutingValidationMessageDto>();
}

public sealed class SubjectRoutingOrgUnitTypeLookupDto
{
    public decimal UnitTypeId { get; set; }

    public string TypeName { get; set; } = string.Empty;

    public string? LeaderTitle { get; set; }

    public bool IsActive { get; set; }
}

public sealed class SubjectRoutingOrgUnitTypeUpsertRequestDto
{
    public string TypeName { get; set; } = string.Empty;

    public string? LeaderTitle { get; set; }

    public bool IsSingleOccupancy { get; set; }

    public bool IsActive { get; set; } = true;
}

public sealed class SubjectRoutingOrgUnitLookupDto
{
    public decimal UnitId { get; set; }

    public string UnitName { get; set; } = string.Empty;

    public decimal UnitTypeId { get; set; }

    public string UnitTypeName { get; set; } = string.Empty;

    public decimal? ParentId { get; set; }

    public bool IsActive { get; set; }
}

public sealed class SubjectRoutingOrgUnitUpsertRequestDto
{
    public string UnitName { get; set; } = string.Empty;

    public decimal UnitTypeId { get; set; }

    public decimal? ParentId { get; set; }

    public bool IsActive { get; set; } = true;
}

public sealed class SubjectRoutingOrgPositionLookupDto
{
    public decimal PositionId { get; set; }

    public string UserId { get; set; } = string.Empty;

    public string? UserDisplayNameAr { get; set; }

    public string? UserDisplayNameEn { get; set; }

    public decimal UnitId { get; set; }

    public string UnitName { get; set; } = string.Empty;

    public bool IsManager { get; set; }

    public bool IsActive { get; set; }

    public DateTime? StartDate { get; set; }

    public DateTime? EndDate { get; set; }
}

public sealed class SubjectRoutingOrgPositionUpsertRequestDto
{
    public string UserId { get; set; } = string.Empty;

    public decimal UnitId { get; set; }

    public bool IsManager { get; set; }

    public bool IsActive { get; set; } = true;

    public DateTime? StartDate { get; set; }

    public DateTime? EndDate { get; set; }
}

public sealed class SubjectRoutingOrgUserLookupDto
{
    public string UserId { get; set; } = string.Empty;

    public string? DisplayNameAr { get; set; }

    public string? DisplayNameEn { get; set; }

    public int ActivePositionsCount { get; set; }
}

public sealed class SubjectRoutingOrgTreeNodeDto
{
    public string NodeType { get; set; } = string.Empty;

    public decimal? NodeNumericId { get; set; }

    public string? NodeUserId { get; set; }

    public string LabelAr { get; set; } = string.Empty;

    public string? SecondaryLabelAr { get; set; }

    public string? ParentNodeType { get; set; }

    public decimal? ParentNodeNumericId { get; set; }

    public string? ParentNodeUserId { get; set; }

    public bool IsSelectable { get; set; }

    public bool HasChildren { get; set; }

    public bool IsActive { get; set; }
}

public sealed class SubjectRoutingOrgUnitWithCountTreeNodeDto
{
    public decimal UnitId { get; set; }

    public string UnitName { get; set; } = string.Empty;

    public decimal? ParentId { get; set; }
}

public sealed class SubjectTypeRequestAvailabilityDto
{
    public int SubjectTypeId { get; set; }

    public string AvailabilityMode { get; set; } = "Public";

    public string? SelectedNodeType { get; set; }

    public decimal? SelectedNodeNumericId { get; set; }

    public string? SelectedNodeUserId { get; set; }

    public string? SelectedNodeLabelAr { get; set; }

    public string? SelectedNodeSecondaryLabelAr { get; set; }

    public string? SelectedNodePathAr { get; set; }

    public string AvailabilitySummaryAr { get; set; } = "متاح لجميع المستخدمين المسجلين.";

    public string? LastModifiedBy { get; set; }

    public DateTime? LastModifiedAtUtc { get; set; }
}

public sealed class SubjectTypeRequestAvailabilityUpsertRequestDto
{
    public string AvailabilityMode { get; set; } = "Public";

    public string? SelectedNodeType { get; set; }

    public decimal? SelectedNodeNumericId { get; set; }

    public string? SelectedNodeUserId { get; set; }
}

public sealed class SubjectAvailabilityNodeValidationRequestDto
{
    public string? SelectedNodeType { get; set; }

    public decimal? SelectedNodeNumericId { get; set; }

    public string? SelectedNodeUserId { get; set; }
}

public sealed class SubjectAvailabilityNodeValidationResultDto
{
    public bool IsValid { get; set; }

    public string? SelectedNodeType { get; set; }

    public decimal? SelectedNodeNumericId { get; set; }

    public string? SelectedNodeUserId { get; set; }

    public string? SelectedNodeLabelAr { get; set; }

    public string? SelectedNodeSecondaryLabelAr { get; set; }

    public string? SelectedNodePathAr { get; set; }

    public string AvailabilitySummaryAr { get; set; } = string.Empty;
}
