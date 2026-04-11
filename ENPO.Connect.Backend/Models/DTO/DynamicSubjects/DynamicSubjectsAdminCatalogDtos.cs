using System;
using System.Collections.Generic;

namespace Models.DTO.DynamicSubjects;

public sealed class AdminCatalogApplicationDto
{
    public string ApplicationId { get; set; } = string.Empty;

    public string ApplicationName { get; set; } = string.Empty;

    public bool IsActive { get; set; }
}

public sealed class AdminCatalogApplicationCreateRequestDto
{
    public string ApplicationId { get; set; } = string.Empty;

    public string ApplicationName { get; set; } = string.Empty;

    public bool IsActive { get; set; } = true;
}

public sealed class AdminCatalogApplicationUpdateRequestDto
{
    public string ApplicationName { get; set; } = string.Empty;

    public bool IsActive { get; set; }
}

public sealed class AdminCatalogCategoryDto
{
    public int CategoryId { get; set; }

    public int ParentCategoryId { get; set; }

    public string CategoryName { get; set; } = string.Empty;

    public string? ApplicationId { get; set; }

    public bool IsActive { get; set; }

    public string DefaultViewMode { get; set; } = "standard";

    public bool AllowRequesterOverride { get; set; }

    public string EnvelopeDisplayName { get; set; } = "حزمة طلبات جديدة";
}

public sealed class AdminCatalogCategoryTreeNodeDto
{
    public int CategoryId { get; set; }

    public int ParentCategoryId { get; set; }

    public string CategoryName { get; set; } = string.Empty;

    public string? ApplicationId { get; set; }

    public bool IsActive { get; set; }

    public string DefaultViewMode { get; set; } = "standard";

    public bool AllowRequesterOverride { get; set; }

    public string EnvelopeDisplayName { get; set; } = "حزمة طلبات جديدة";

    public IReadOnlyList<AdminCatalogCategoryTreeNodeDto> Children { get; set; }
        = new List<AdminCatalogCategoryTreeNodeDto>();
}

public sealed class AdminCatalogCategoryCreateRequestDto
{
    public string ApplicationId { get; set; } = string.Empty;

    public string CategoryName { get; set; } = string.Empty;

    public int ParentCategoryId { get; set; }

    public bool IsActive { get; set; } = true;

    public string? DefaultViewMode { get; set; }

    public bool? AllowRequesterOverride { get; set; }

    public string? EnvelopeDisplayName { get; set; }
}

public sealed class AdminCatalogCategoryUpdateRequestDto
{
    public string CategoryName { get; set; } = string.Empty;

    public int ParentCategoryId { get; set; }

    public bool IsActive { get; set; }

    public string? DefaultViewMode { get; set; }

    public bool? AllowRequesterOverride { get; set; }

    public string? EnvelopeDisplayName { get; set; }
}

public sealed class AdminCatalogCategoryDisplaySettingsDto
{
    public int CategoryId { get; set; }

    public string DefaultViewMode { get; set; } = "standard";

    public bool AllowRequesterOverride { get; set; }

    public string EnvelopeDisplayName { get; set; } = "حزمة طلبات جديدة";

    public string? LastModifiedBy { get; set; }

    public DateTime? LastModifiedAtUtc { get; set; }
}

public sealed class AdminCatalogCategoryDisplaySettingsUpsertRequestDto
{
    public string? DefaultViewMode { get; set; }

    public bool? AllowRequesterOverride { get; set; }

    public string? EnvelopeDisplayName { get; set; }
}

public sealed class AdminCatalogApplicationDeleteDiagnosticsDto
{
    public string ApplicationId { get; set; } = string.Empty;

    public int LinkedCategoriesCount { get; set; }

    public int LinkedFieldsCount { get; set; }

    public int LinkedGroupsCount { get; set; }

    public bool CanHardDelete { get; set; }

    public bool WillUseSoftDelete { get; set; }

    public bool IsBlocked { get; set; }

    public string? DecisionReason { get; set; }
}

public sealed class AdminCatalogCategoryDeleteDiagnosticsDto
{
    public int CategoryId { get; set; }

    public int ChildrenCount { get; set; }

    public int LinkedFieldsCount { get; set; }

    public int LinkedMessagesCount { get; set; }

    public int LinkedGroupsCount { get; set; }

    public bool CanHardDelete { get; set; }

    public bool WillUseSoftDelete { get; set; }

    public bool IsBlocked { get; set; }

    public string? DecisionReason { get; set; }
}

public sealed class AdminCatalogDeleteResultDto
{
    public bool Deleted { get; set; }

    public string Mode { get; set; } = "none";

    public string? Message { get; set; }
}

public sealed class AdminCatalogGroupDto
{
    public int GroupId { get; set; }

    public int CategoryId { get; set; }

    public string ApplicationId { get; set; } = string.Empty;

    public string GroupName { get; set; } = string.Empty;

    public string? GroupDescription { get; set; }

    public int? ParentGroupId { get; set; }

    public int DisplayOrder { get; set; }

    public bool IsActive { get; set; }
}

public sealed class AdminCatalogGroupTreeNodeDto
{
    public int GroupId { get; set; }

    public int CategoryId { get; set; }

    public string ApplicationId { get; set; } = string.Empty;

    public string GroupName { get; set; } = string.Empty;

    public string? GroupDescription { get; set; }

    public int? ParentGroupId { get; set; }

    public int DisplayOrder { get; set; }

    public bool IsActive { get; set; }

    public IReadOnlyList<AdminCatalogGroupTreeNodeDto> Children { get; set; }
        = new List<AdminCatalogGroupTreeNodeDto>();
}

public sealed class AdminCatalogGroupCreateRequestDto
{
    public int CategoryId { get; set; }

    public string ApplicationId { get; set; } = string.Empty;

    public string GroupName { get; set; } = string.Empty;

    public string? GroupDescription { get; set; }

    public int? ParentGroupId { get; set; }

    public int DisplayOrder { get; set; }

    public bool IsActive { get; set; } = true;
}

public sealed class AdminCatalogGroupUpdateRequestDto
{
    public string GroupName { get; set; } = string.Empty;

    public string? GroupDescription { get; set; }

    public int? ParentGroupId { get; set; }

    public int DisplayOrder { get; set; }

    public bool IsActive { get; set; } = true;
}

public sealed class AdminCatalogFieldListItemDto
{
    public string ApplicationId { get; set; } = string.Empty;

    public string FieldKey { get; set; } = string.Empty;

    public int CdmendSql { get; set; }

    public string FieldLabel { get; set; } = string.Empty;

    public string FieldType { get; set; } = string.Empty;

    public string? DataType { get; set; }

    public bool Required { get; set; }

    public bool IsActive { get; set; }

    public int LinkedCategoriesCount { get; set; }

    public int LinkedSettingsCount { get; set; }

    public int LinkedHistoryCount { get; set; }

    public bool IsUsed { get; set; }
}

public sealed class AdminCatalogFieldDto
{
    public string ApplicationId { get; set; } = string.Empty;

    public string FieldKey { get; set; } = string.Empty;

    public int CdmendSql { get; set; }

    public string FieldType { get; set; } = string.Empty;

    public string FieldLabel { get; set; } = string.Empty;

    public string? Placeholder { get; set; }

    public string? DefaultValue { get; set; }

    public string? CdmendTbl { get; set; }

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

    public int LinkedCategoriesCount { get; set; }

    public int LinkedSettingsCount { get; set; }

    public int LinkedHistoryCount { get; set; }

    public bool IsUsed { get; set; }
}

public sealed class AdminCatalogFieldCreateRequestDto
{
    public string ApplicationId { get; set; } = string.Empty;

    public string FieldKey { get; set; } = string.Empty;

    public int? CdmendSql { get; set; }

    public string FieldType { get; set; } = string.Empty;

    public string? FieldLabel { get; set; }

    public string? Placeholder { get; set; }

    public string? DefaultValue { get; set; }

    public string? CdmendTbl { get; set; }

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
}

public sealed class AdminCatalogFieldUpdateRequestDto
{
    public int? CdmendSql { get; set; }

    public string FieldType { get; set; } = string.Empty;

    public string? FieldLabel { get; set; }

    public string? Placeholder { get; set; }

    public string? DefaultValue { get; set; }

    public string? CdmendTbl { get; set; }

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
}

public sealed class AdminCatalogFieldDeleteDiagnosticsDto
{
    public string ApplicationId { get; set; } = string.Empty;

    public string FieldKey { get; set; } = string.Empty;

    public int CdmendSql { get; set; }

    public int LinkedCategoriesCount { get; set; }

    public int LinkedActiveCategoriesCount { get; set; }

    public int LinkedSettingsCount { get; set; }

    public int LinkedHistoryByKeyCount { get; set; }

    public int LinkedHistoryBySqlCount { get; set; }

    public bool CanHardDelete { get; set; }

    public bool WillUseSoftDelete { get; set; }

    public bool IsBlocked { get; set; }

    public string? DecisionReason { get; set; }
}

public sealed class AdminCatalogFieldLookupsDto
{
    public IReadOnlyList<string> FieldTypes { get; set; } = new List<string>();

    public IReadOnlyList<string> DataTypes { get; set; } = new List<string>();

    public IReadOnlyList<AdminCatalogFieldStatusOptionDto> StatusOptions { get; set; } = new List<AdminCatalogFieldStatusOptionDto>();
}

public sealed class AdminCatalogFieldStatusOptionDto
{
    public string Key { get; set; } = string.Empty;

    public string Label { get; set; } = string.Empty;
}

public sealed class AdminControlCenterRequestPreviewDto
{
    public int RequestTypeId { get; set; }

    public string RequestTypeName { get; set; } = string.Empty;

    public string EvaluatedForUserId { get; set; } = string.Empty;

    public bool IsUserContextResolved { get; set; }

    public List<string> UserUnitIds { get; set; } = new();

    public List<string> UserPositionIds { get; set; } = new();

    public bool IsAvailable { get; set; }

    public List<string> AvailabilityReasons { get; set; } = new();

    public List<AdminControlCenterRequestPreviewFieldDto> Fields { get; set; } = new();

    public List<string> Warnings { get; set; } = new();

    public List<string> Conflicts { get; set; } = new();

    public AdminControlCenterDiagnosticsSummaryDto DiagnosticsSummary { get; set; } = new();

    public List<AdminControlCenterDiagnosticMessageDto> Diagnostics { get; set; } = new();
}

public sealed class AdminControlCenterRequestPreviewFieldDto
{
    public int FieldId { get; set; }

    public string FieldName { get; set; } = string.Empty;

    public bool IsVisible { get; set; }

    public bool IsRequired { get; set; }

    public List<string> Reasons { get; set; } = new();

    public List<string> Warnings { get; set; } = new();

    public List<string> Conflicts { get; set; } = new();

    public List<AdminControlCenterDiagnosticMessageDto> Diagnostics { get; set; } = new();
}

public sealed class AdminControlCenterDiagnosticsSummaryDto
{
    public int TotalCount { get; set; }

    public int InfoCount { get; set; }

    public int WarningCount { get; set; }

    public int ConflictCount { get; set; }

    public int RequestLevelCount { get; set; }

    public int FieldLevelCount { get; set; }
}

public sealed class AdminControlCenterDiagnosticMessageDto
{
    public string Severity { get; set; } = "Info";

    public string Message { get; set; } = string.Empty;

    public string? Code { get; set; }
}
