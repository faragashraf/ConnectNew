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
        All = 5,

        [Description("مسودة")]
        Draft = 10,

        [Description("تم الإرسال")]
        Submitted = 11,

        [Description("قيد المراجعة")]
        UnderReview = 12,

        [Description("معلق لاستكمال البيانات")]
        PendingCompletion = 13,

        [Description("قيد التنفيذ")]
        WorkflowInProgress = 14,

        [Description("مكتمل")]
        Completed = 15,

        [Description("مرفوض")]
        WorkflowRejected = 16,

        [Description("مؤرشف")]
        Archived = 17
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
