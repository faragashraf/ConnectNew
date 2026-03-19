using System;
using System.Collections.Generic;

namespace Models.GPA.AdminCer;

public partial class AdmCertDept
{
    public int DepartmentId { get; set; }

    public string DepartmentName { get; set; } = null!;

    public string? AreaId { get; set; }

    public int DepartmentType { get; set; }

}
