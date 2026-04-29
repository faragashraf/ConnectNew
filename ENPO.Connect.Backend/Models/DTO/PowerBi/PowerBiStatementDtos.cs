using System;
using System.Collections.Generic;

namespace Models.DTO.PowerBi;

public sealed class PowerBiStatementDto
{
    public int StatementId { get; set; }

    public string? ApplicationId { get; set; }

    public string? SchemaName { get; set; }

    public string? SqlType { get; set; }

    public string? SqlStatement { get; set; }

    public string? Parameters { get; set; }

    public string? Description { get; set; }

    public DateTime? CreatedAt { get; set; }

    public string? Database { get; set; }
}

public sealed class PowerBiStatementUpsertRequestDto
{
    public int? StatementId { get; set; }

    public string? ApplicationId { get; set; }

    public string? SchemaName { get; set; }

    public string? SqlType { get; set; }

    public string? SqlStatement { get; set; }

    public string? Parameters { get; set; }

    public string? Description { get; set; }

    public string? Database { get; set; }
}

public sealed class PowerBiStatementLookupsDto
{
    public List<string> ApplicationIds { get; set; } = new();

    public List<string> SchemaNames { get; set; } = new();

    public List<string> SqlTypes { get; set; } = new();

    public List<string> Databases { get; set; } = new();
}

public sealed class PowerBiStatementDeleteResultDto
{
    public bool Deleted { get; set; }

    public int StatementId { get; set; }
}
