using Models.DTO.Correspondance.Enums;

namespace Persistence.Services.Summer
{
    internal static class SummerAdminActionStateGuard
    {
        private static readonly SummerRequestWorkflowEngine WorkflowEngine = new();
        internal const string DuplicateStateTransitionMessage = SummerRequestWorkflowEngine.DuplicateStateTransitionMessage;

        internal static bool IsBypassAction(string? normalizedActionCode)
        {
            return SummerRequestWorkflowEngine.IsCommentLikeAction(normalizedActionCode);
        }

        internal static MessageStatus? ResolveTargetStatus(string? normalizedActionCode)
        {
            return SummerRequestWorkflowEngine.ResolveDeterministicTargetState(normalizedActionCode);
        }

        internal static bool ShouldBlockDuplicateStateTransition(string? normalizedActionCode, MessageStatus currentStatus)
        {
            var resolution = WorkflowEngine.Resolve(currentStatus, normalizedActionCode);
            return !resolution.IsAllowed
                && string.Equals(
                    resolution.ErrorMessage,
                    DuplicateStateTransitionMessage,
                    StringComparison.Ordinal);
        }
    }
}
