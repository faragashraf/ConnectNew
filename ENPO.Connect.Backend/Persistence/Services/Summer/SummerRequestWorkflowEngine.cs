using Models.DTO.Correspondance.Enums;

namespace Persistence.Services.Summer
{
    internal readonly record struct SummerRequestWorkflowResolution(
        string ActionCode,
        MessageStatus CurrentState,
        bool IsAllowed,
        MessageStatus? TargetState,
        bool ChangesState,
        bool IsBypassAction,
        string ErrorMessage);

    internal sealed class SummerRequestWorkflowEngine
    {
        internal const string InvalidTransitionMessage = "لا يمكن تنفيذ هذا الإجراء لأن حالة الطلب الحالية لا تسمح بذلك.";
        internal const string DuplicateStateTransitionMessage = "لا يمكن تنفيذ نفس الإجراء مرة أخرى لأن الطلب بالفعل في هذه الحالة.";

        private static readonly HashSet<string> CommentLikeActions = new(StringComparer.OrdinalIgnoreCase)
        {
            SummerAdminActionCatalog.Codes.Comment,
            SummerAdminActionCatalog.Codes.InternalAdminAction
        };

        private static readonly HashSet<string> StateActions = new(StringComparer.OrdinalIgnoreCase)
        {
            SummerAdminActionCatalog.Codes.FinalApprove,
            SummerAdminActionCatalog.Codes.ManualCancel,
            SummerAdminActionCatalog.Codes.RejectRequest
        };

        private static readonly IReadOnlyDictionary<MessageStatus, HashSet<string>> AllowedActionsByState =
            new Dictionary<MessageStatus, HashSet<string>>
            {
                [MessageStatus.New] = BuildOpenStateActions(),
                [MessageStatus.InProgress] = BuildOpenStateActions(),
                [MessageStatus.Replied] = BuildOpenStateActions(),
                [MessageStatus.Rejected] = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
                {
                    SummerAdminActionCatalog.Codes.FinalApprove,
                    SummerAdminActionCatalog.Codes.ManualCancel,
                    SummerAdminActionCatalog.Codes.RejectRequest,
                    SummerAdminActionCatalog.Codes.Comment,
                    SummerAdminActionCatalog.Codes.InternalAdminAction
                },
                [MessageStatus.Printed] = new HashSet<string>(CommentLikeActions, StringComparer.OrdinalIgnoreCase),
                [MessageStatus.All] = new HashSet<string>(CommentLikeActions, StringComparer.OrdinalIgnoreCase)
            };

        public SummerRequestWorkflowResolution Resolve(MessageStatus currentState, string? actionCode)
        {
            var normalizedAction = SummerAdminActionCatalog.Normalize(actionCode);
            if (string.IsNullOrWhiteSpace(normalizedAction))
            {
                return Deny(currentState, normalizedAction, InvalidTransitionMessage);
            }

            if (IsCommentLikeAction(normalizedAction))
            {
                return Allow(
                    currentState,
                    normalizedAction,
                    targetState: currentState,
                    changesState: false,
                    isBypassAction: true);
            }

            if (!IsKnownAction(normalizedAction))
            {
                return Deny(currentState, normalizedAction, InvalidTransitionMessage);
            }

            if (!AllowedActionsByState.TryGetValue(currentState, out var allowedActions)
                || !allowedActions.Contains(normalizedAction))
            {
                return Deny(currentState, normalizedAction, InvalidTransitionMessage);
            }

            var targetState = ResolveDeterministicTargetState(normalizedAction);
            if (targetState.HasValue && targetState.Value == currentState)
            {
                return Deny(currentState, normalizedAction, DuplicateStateTransitionMessage, targetState);
            }

            if (targetState.HasValue)
            {
                return Allow(
                    currentState,
                    normalizedAction,
                    targetState: targetState.Value,
                    changesState: true,
                    isBypassAction: false);
            }

            return Allow(
                currentState,
                normalizedAction,
                targetState: null,
                changesState: false,
                isBypassAction: false);
        }

        internal static bool IsCommentLikeAction(string? actionCode)
        {
            var normalizedAction = SummerAdminActionCatalog.Normalize(actionCode);
            return CommentLikeActions.Contains(normalizedAction);
        }

        internal static MessageStatus? ResolveDeterministicTargetState(string? actionCode)
        {
            var normalizedAction = SummerAdminActionCatalog.Normalize(actionCode);
            return normalizedAction switch
            {
                SummerAdminActionCatalog.Codes.FinalApprove => MessageStatus.Replied,
                SummerAdminActionCatalog.Codes.ManualCancel => MessageStatus.Rejected,
                SummerAdminActionCatalog.Codes.RejectRequest => MessageStatus.Rejected,
                _ => null
            };
        }

        private static bool IsKnownAction(string normalizedAction)
        {
            return StateActions.Contains(normalizedAction) || CommentLikeActions.Contains(normalizedAction);
        }

        private static HashSet<string> BuildOpenStateActions()
        {
            return new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                SummerAdminActionCatalog.Codes.FinalApprove,
                SummerAdminActionCatalog.Codes.ManualCancel,
                SummerAdminActionCatalog.Codes.RejectRequest,
                SummerAdminActionCatalog.Codes.Comment,
                SummerAdminActionCatalog.Codes.InternalAdminAction
            };
        }

        private static SummerRequestWorkflowResolution Allow(
            MessageStatus currentState,
            string actionCode,
            MessageStatus? targetState,
            bool changesState,
            bool isBypassAction)
        {
            return new SummerRequestWorkflowResolution(
                ActionCode: actionCode,
                CurrentState: currentState,
                IsAllowed: true,
                TargetState: targetState,
                ChangesState: changesState,
                IsBypassAction: isBypassAction,
                ErrorMessage: string.Empty);
        }

        private static SummerRequestWorkflowResolution Deny(
            MessageStatus currentState,
            string actionCode,
            string errorMessage,
            MessageStatus? targetState = null)
        {
            return new SummerRequestWorkflowResolution(
                ActionCode: actionCode,
                CurrentState: currentState,
                IsAllowed: false,
                TargetState: targetState,
                ChangesState: false,
                IsBypassAction: false,
                ErrorMessage: errorMessage);
        }
    }
}
