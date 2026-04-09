using Models.Correspondance;
using Models.DTO.DynamicSubjects;

namespace Persistence.Services.DynamicSubjects.FieldAccess;

public sealed class FieldAccessResolutionRequest
{
    public int RequestTypeId { get; set; }

    public int? RequestId { get; set; }

    public int? StageId { get; set; }

    public int? ActionId { get; set; }

    public string UserId { get; set; } = string.Empty;

    public Message? Message { get; set; }

    public IReadOnlyCollection<SubjectGroupDefinitionDto> Groups { get; set; } = Array.Empty<SubjectGroupDefinitionDto>();

    public IReadOnlyCollection<SubjectFieldDefinitionDto> Fields { get; set; } = Array.Empty<SubjectFieldDefinitionDto>();

    public FieldAccessSubjectContextOverride? SubjectContextOverride { get; set; }
}

public sealed class FieldAccessSubjectContextOverride
{
    public string? SubjectType { get; set; }

    public string? SubjectId { get; set; }

    public string? RequestOwnerUserId { get; set; }

    public string? CurrentCustodianUnitId { get; set; }
}

public sealed class FieldAccessResolutionResult
{
    public Dictionary<int, FieldAccessResolvedState> GroupStates { get; set; } = new();

    public Dictionary<int, FieldAccessResolvedState> FieldStatesByMendSql { get; set; } = new();

    public Dictionary<string, FieldAccessResolvedState> FieldStatesByKey { get; set; } = new(StringComparer.OrdinalIgnoreCase);
}

public sealed class FieldAccessResolvedState
{
    public bool CanView { get; set; }

    public bool CanEdit { get; set; }

    public bool CanFill { get; set; }

    public bool IsHidden { get; set; }

    public bool IsReadOnly { get; set; }

    public bool IsRequired { get; set; }

    public bool IsLocked { get; set; }

    public string? LockReason { get; set; }

    public string FinalStateCode { get; set; } = "Editable";

    public string? EffectiveSourceType { get; set; }

    public string? EffectiveReasonAr { get; set; }

    public List<FieldAccessAppliedTrace> AppliedTraces { get; set; } = new();
}

public sealed class FieldAccessAppliedTrace
{
    public string SourceType { get; set; } = string.Empty;

    public string PermissionKind { get; set; } = string.Empty;

    public string TargetLevel { get; set; } = string.Empty;

    public int TargetId { get; set; }

    public int? StageId { get; set; }

    public int? ActionId { get; set; }

    public int? RuleId { get; set; }

    public int? LockId { get; set; }

    public int? OverrideId { get; set; }

    public string? PermissionType { get; set; }

    public string? Effect { get; set; }

    public string? LockMode { get; set; }

    public string? SubjectType { get; set; }

    public string? SubjectId { get; set; }

    public string? Notes { get; set; }

    public string? DescriptionAr { get; set; }
}
