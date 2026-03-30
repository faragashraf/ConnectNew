using Models.DTO.Correspondance.Enums;

namespace Persistence.Services.Summer
{
    internal static class SummerAdminActionStateGuard
    {
        internal const string DuplicateStateTransitionMessage = "لا يمكن تنفيذ نفس الإجراء مرة أخرى لأن الطلب بالفعل في هذه الحالة.";

        internal static bool IsBypassAction(string? normalizedActionCode)
        {
            return string.Equals(
                SummerAdminActionCatalog.Normalize(normalizedActionCode),
                SummerAdminActionCatalog.Codes.Comment,
                StringComparison.OrdinalIgnoreCase);
        }

        internal static MessageStatus? ResolveTargetStatus(string? normalizedActionCode)
        {
            return SummerAdminActionCatalog.Normalize(normalizedActionCode) switch
            {
                SummerAdminActionCatalog.Codes.FinalApprove => MessageStatus.Replied,
                SummerAdminActionCatalog.Codes.ManualCancel => MessageStatus.Rejected,
                _ => null
            };
        }

        internal static bool ShouldBlockDuplicateStateTransition(string? normalizedActionCode, MessageStatus currentStatus)
        {
            if (IsBypassAction(normalizedActionCode))
            {
                return false;
            }

            var targetStatus = ResolveTargetStatus(normalizedActionCode);
            if (!targetStatus.HasValue)
            {
                return false;
            }

            return targetStatus.Value == currentStatus;
        }
    }
}
