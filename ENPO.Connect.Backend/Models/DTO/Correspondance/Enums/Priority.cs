using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Models.DTO.Correspondance.Enums
{
    public enum Priority : byte // Use byte for compact storage (matches TINYINT in SQL)
    {
        Low = 0,
        Medium = 1,
        High = 2,
        Critical = 3
    }
}
