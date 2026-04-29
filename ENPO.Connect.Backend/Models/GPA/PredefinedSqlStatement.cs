using System;

namespace Models.GPA;

public partial class PredefinedSqlStatement
{
    public int StatementId { get; set; }

    public string? ApplicationId { get; set; }

    public string? SchemaName { get; set; }

    public string? SqlType { get; set; }

    public string? SqlStatement { get; set; }

    public string? Parameters { get; set; }

    public string? Description { get; set; }

    public DateTime? CreatedAt { get; set; }

    public string? DatabaseName { get; set; }
}
