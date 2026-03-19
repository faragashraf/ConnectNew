using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Reflection;
using System.Text;
using System.Threading.Tasks;

namespace Models.DTO.Correspondance.Enums
{
    // status.enum.ts

    public enum MessageStatus : byte
    {
        [Description("جديد")]
        New = 0,

        [Description("جاري التنفيذ")]
        InProgress = 1,

        [Description("تم الرد")]
        Replied = 2,

        [Description("مرفوض")]
        Rejected = 3,

        [Description("تم")]
        Printed = 4,

        [Description("الكل")]
        All = 5
    }

    public static class EnumExtensions
    {
        public static string GetDescription(this Enum value)
        {
            if (value == null) return string.Empty;
            var fi = value.GetType().GetField(value.ToString());
            var attr = fi?.GetCustomAttribute<DescriptionAttribute>();
            return attr?.Description ?? value.ToString();
        }
    }
}
