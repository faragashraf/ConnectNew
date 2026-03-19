using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.Tasks;

namespace Models.DTO.Common
{

    public class Email
    {
        public Email()
        {
            attachs = new List<attachment>();
        }

        public string to { get; set; } = "";
        public string cc { get; set; } = "";
        public string _Subject { get; set; } = "";
        public string _Body { get; set; } = "";
        public List<attachment> attachs { get; set; }
    }

    public class attachment
    {
        public byte[] arr { get; set; } = null;
        public string name { get; set; } = "";
    }
}
