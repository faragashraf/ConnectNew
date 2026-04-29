using System;

namespace Models.Correspondance;

public partial class SubjectRoutingTarget
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

    public string CreatedBy { get; set; } = "SYSTEM";

    public DateTime CreatedDate { get; set; }

    public string? LastModifiedBy { get; set; }

    public DateTime? LastModifiedDate { get; set; }

    public virtual SubjectRoutingStep RoutingStep { get; set; } = null!;
}
