using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Models.DTO.Correspondance.AdminCertificates
{
    public class AdmCertDeptDto
    {
        public int DepartmentId { get; set; }

        public string DepartmentName { get; set; } = null!;

        public string? AreaName { get; set; }

        public string? UserId { get; set; } = null!;

        public int DepartmentType { get; set; }
    }
}
