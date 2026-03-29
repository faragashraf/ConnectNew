using System;
using System.Collections.Generic;

namespace Models.Correspondance;

public partial class PublicationRequestType
{
    public int PublicationRequestTypeId { get; set; }
    public string Code { get; set; } = string.Empty;
    public string NameAr { get; set; } = string.Empty;
    public string? NameEn { get; set; }
    public int CategoryId { get; set; }
    public string ApplicationId { get; set; } = "PUBL";
    public bool IsActive { get; set; } = true;
    public int DisplayOrder { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    public virtual ICollection<PublicationDepartmentRequestType> DepartmentRequestTypes { get; set; } = new List<PublicationDepartmentRequestType>();
    public virtual ICollection<PublicationRequest> Requests { get; set; } = new List<PublicationRequest>();
}
