using System;
using System.Collections.Generic;

namespace Models.Attachment
{
    public partial class AttchShipment
    {
        public int Id { get; set; }
        public int AttchId { get; set; }
        public byte[]? AttchImg { get; set; }
        public string AttchNm { get; set; }
        public string? ApplicationName { get; set; } = "Connect";
        public string AttcExt { get; set; }
        public long? AttchSize { get; set; }
    }
}
