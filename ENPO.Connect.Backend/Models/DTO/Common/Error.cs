using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Models.DTO.Common
{
    public class Error
    {
        public Error()
        {

        }

        public string Code { get; set; }
        public string Message { get; set; }
    }
}
