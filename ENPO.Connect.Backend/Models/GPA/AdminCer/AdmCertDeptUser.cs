using System;
using System.Collections.Generic;

namespace Models.GPA.AdminCer;

public partial class AdmCertDeptUser
{
    public int DepartmentId { get; set; }

    public string UserId { get; set; } = null!;
}
