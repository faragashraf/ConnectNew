using System;
using System.Collections.Generic;

namespace Models.GPA;

public partial class Tracking
{
    public decimal Id { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime? CreationDate { get; set; }

    public string? FileName { get; set; }

    public string? TableName { get; set; }

    public string? PostType { get; set; }

    public string? ServiceType { get; set; }

    public string? CountryId { get; set; }

    public string? DepartmentId { get; set; }

    public string? Description { get; set; }

    public string? TransId { get; set; }

    public string? ApplicationName { get; set; }
}
