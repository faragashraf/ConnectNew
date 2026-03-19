using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Models.DTO
{
    public class AttchShipmentDto
    {
        public int Id { get; set; }
        public int AttchId { get; set; }
        public string AttchNm { get; set; }
        public string? ApplicationName { get; set; } = "Correspondance";
        public string AttcExt { get; set; }
        public long? AttchSize { get; set; }
    }
}
