using System;

namespace Models.Correspondance;

public partial class PublicationDepartmentRequestType
{
    public int PublicationDepartmentRequestTypeId { get; set; }
    public decimal DepartmentUnitId { get; set; }
    public int PublicationRequestTypeId { get; set; }
    public bool CanCreate { get; set; } = true;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    public virtual PublicationRequestType PublicationRequestType { get; set; } = null!;
}
