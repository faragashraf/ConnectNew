namespace Persistence.Services.Summer
{
    internal static class SummerAdminActionCatalog
    {
        internal static class Codes
        {
            public const string FinalApprove = "FINAL_APPROVE";
            public const string ManualCancel = "MANUAL_CANCEL";
            public const string RejectRequest = "REJECT_REQUEST";
            public const string Comment = "COMMENT";
            public const string InternalAdminAction = "INTERNAL_ADMIN_ACTION";
            public const string ApproveTransfer = "APPROVE_TRANSFER";
            public const string MarkUnpaid = "MARK_UNPAID";
            public const string MarkPaidAdmin = "MARK_PAID_ADMIN";
        }

        public static string ResolveLabel(string? actionCode)
        {
            return Normalize(actionCode) switch
            {
                Codes.FinalApprove => "اعتماد نهائي",
                Codes.ManualCancel => "إلغاء إداري",
                Codes.RejectRequest => "رفض الطلب",
                Codes.Comment => "تعليق إداري",
                Codes.InternalAdminAction => "إجراء إداري داخلي",
                Codes.ApproveTransfer => "اعتماد التحويل",
                Codes.MarkUnpaid => "تحويل إلى غير مسدد",
                Codes.MarkPaidAdmin => "سداد إداري",
                _ => (actionCode ?? string.Empty).Trim()
            };
        }

        public static string Normalize(string? actionCode)
        {
            var token = NormalizeSearchToken(actionCode);
            return token switch
            {
                "finalapprove" or "approve" or "اعتمادنهائي" or "اعتماد" or "final_approve" => Codes.FinalApprove,
                "manual_cancel" or "manualcancel" or "cancel" or "الغاءيدوي" or "الغاء" => Codes.ManualCancel,
                "reject" or "rejection" or "رفض" => Codes.RejectRequest,
                "comment" or "reply" or "note" or "admin_note" or "administrative_note" or "تعليق" or "رد" or "ملاحظة" or "ملاحظه" or "ملاحظةادارية" => Codes.Comment,
                "internal_admin_action" or "internaladminaction" or "internalaction" or "internal_action" or "اجراءاداريداخلي" or "اجراءاداريداخلى" or "اجراءداخلي" => Codes.InternalAdminAction,
                "approvetransfer" or "approve_transfer" or "transferapprove" or "اعتمادالتحويل" => Codes.ApproveTransfer,
                "markunpaid" or "mark_unpaid" or "setunpaid" or "set_unpaid" or "markasunpaid" or "غيرمسدد" or "تحويللغيرمسدد" or "تحويلإلىغيرمسدد" or "تحويلاليغيرمسدد" or "تحويلالىغيرمسدد" => Codes.MarkUnpaid,
                "markpaidadmin" or "mark_paid_admin" or "adminmarkpaid" or "admin_paid" or "سداداداري" or "سدادإداري" => Codes.MarkPaidAdmin,
                _ => string.Empty
            };
        }

        private static string NormalizeSearchToken(string? value)
        {
            return string.Concat((value ?? string.Empty)
                .Trim()
                .ToLowerInvariant()
                .Where(ch => !char.IsWhiteSpace(ch)));
        }
    }
}
