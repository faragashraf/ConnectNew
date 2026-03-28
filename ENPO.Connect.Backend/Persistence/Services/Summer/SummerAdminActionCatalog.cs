namespace Persistence.Services.Summer
{
    internal static class SummerAdminActionCatalog
    {
        internal static class Codes
        {
            public const string FinalApprove = "FINAL_APPROVE";
            public const string ManualCancel = "MANUAL_CANCEL";
            public const string Comment = "COMMENT";
            public const string ApproveTransfer = "APPROVE_TRANSFER";
        }

        public static string ResolveLabel(string? actionCode)
        {
            return Normalize(actionCode) switch
            {
                Codes.FinalApprove => "اعتماد نهائي",
                Codes.ManualCancel => "إلغاء إداري",
                Codes.Comment => "تعليق إداري",
                Codes.ApproveTransfer => "اعتماد التحويل",
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
                "comment" or "reply" or "تعليق" or "رد" => Codes.Comment,
                "approvetransfer" or "transferapprove" or "اعتمادالتحويل" => Codes.ApproveTransfer,
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

