using System;
using System.Collections.Generic;

namespace Models.DTO.DynamicSubjects;

public sealed class RequestRuntimeCatalogDto
{
    public DateTime GeneratedAtUtc { get; set; } = DateTime.UtcNow;

    public int TotalAvailableRequests { get; set; }

    public List<RequestRuntimeCatalogApplicationDto> Applications { get; set; } = new();
}

public sealed class RequestRuntimeCatalogApplicationDto
{
    public string ApplicationId { get; set; } = string.Empty;

    public string ApplicationName { get; set; } = string.Empty;

    public int TotalAvailableRequests { get; set; }

    public List<RequestRuntimeCatalogNodeDto> Categories { get; set; } = new();
}

public sealed class RequestRuntimeCatalogNodeDto
{
    public int CategoryId { get; set; }

    public int ParentCategoryId { get; set; }

    public string CategoryName { get; set; } = string.Empty;

    public string? ApplicationId { get; set; }

    public bool IsRequestType { get; set; }

    public bool CanStart { get; set; }

    public int DisplayOrder { get; set; }

    public RequestRuntimeStartStageDto? StartStage { get; set; }

    public RequestRuntimeOrganizationalUnitScopeDto OrganizationalUnitScope { get; set; } = new();

    public List<string> AvailabilityReasons { get; set; } = new();

    public List<string> RuntimeWarnings { get; set; } = new();

    public List<RequestRuntimeCatalogNodeDto> Children { get; set; } = new();
}

public sealed class RequestRuntimeStartStageDto
{
    public int? StageId { get; set; }

    public string? StageName { get; set; }

    public int? RoutingProfileId { get; set; }

    public string? RoutingProfileName { get; set; }
}

public sealed class RequestRuntimeOrganizationalUnitScopeDto
{
    public string ScopeMode { get; set; } = "Legacy";

    public List<string> UnitIds { get; set; } = new();

    public string? ScopeLabel { get; set; }
}
