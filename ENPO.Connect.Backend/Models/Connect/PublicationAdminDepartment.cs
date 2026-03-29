using System;

namespace Models.Correspondance;

public partial class PublicationAdminDepartment
{
    public int PublicationAdminDepartmentId { get; set; }
    public decimal DepartmentUnitId { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
