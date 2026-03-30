using Models.DTO.Correspondance.Enums;
using Persistence.Services.Summer;
using Xunit;

namespace Persistence.Tests;

public class SummerRequestWorkflowEngineTests
{
    private readonly SummerRequestWorkflowEngine _engine = new();

    [Fact]
    public void Resolve_Blocks_Duplicate_FinalApprove_When_CurrentStatus_IsReplied()
    {
        var result = _engine.Resolve(MessageStatus.Replied, SummerAdminActionCatalog.Codes.FinalApprove);

        Assert.False(result.IsAllowed);
        Assert.Equal(SummerRequestWorkflowEngine.DuplicateStateTransitionMessage, result.ErrorMessage);
        Assert.Equal(MessageStatus.Replied, result.TargetState);
    }

    [Fact]
    public void Resolve_Blocks_Duplicate_ManualCancel_When_CurrentStatus_IsRejected()
    {
        var result = _engine.Resolve(MessageStatus.Rejected, SummerAdminActionCatalog.Codes.ManualCancel);

        Assert.False(result.IsAllowed);
        Assert.Equal(SummerRequestWorkflowEngine.DuplicateStateTransitionMessage, result.ErrorMessage);
        Assert.Equal(MessageStatus.Rejected, result.TargetState);
    }

    [Fact]
    public void Resolve_Always_Allows_CommentLike_Actions()
    {
        var commentResult = _engine.Resolve(MessageStatus.Rejected, "COMMENT");
        var replyResult = _engine.Resolve(MessageStatus.Replied, "reply");
        var noteResult = _engine.Resolve(MessageStatus.Printed, "note");

        Assert.True(commentResult.IsAllowed);
        Assert.True(replyResult.IsAllowed);
        Assert.True(noteResult.IsAllowed);
        Assert.False(commentResult.ChangesState);
        Assert.True(commentResult.IsBypassAction);
    }

    [Fact]
    public void Resolve_Blocks_ApproveTransfer_For_Rejected_State()
    {
        var result = _engine.Resolve(MessageStatus.Rejected, SummerAdminActionCatalog.Codes.ApproveTransfer);

        Assert.False(result.IsAllowed);
        Assert.Equal(SummerRequestWorkflowEngine.InvalidTransitionMessage, result.ErrorMessage);
    }

    [Fact]
    public void Resolve_Supports_StatusFlow_Then_Blocks_Second_Approve()
    {
        var fromPendingApprove = _engine.Resolve(MessageStatus.New, SummerAdminActionCatalog.Codes.FinalApprove);
        Assert.True(fromPendingApprove.IsAllowed);
        Assert.Equal(MessageStatus.Replied, fromPendingApprove.TargetState);

        var fromApprovedReject = _engine.Resolve(MessageStatus.Replied, SummerAdminActionCatalog.Codes.ManualCancel);
        Assert.True(fromApprovedReject.IsAllowed);
        Assert.Equal(MessageStatus.Rejected, fromApprovedReject.TargetState);

        var fromRejectedApprove = _engine.Resolve(MessageStatus.Rejected, SummerAdminActionCatalog.Codes.FinalApprove);
        Assert.True(fromRejectedApprove.IsAllowed);
        Assert.Equal(MessageStatus.Replied, fromRejectedApprove.TargetState);

        var duplicateApprove = _engine.Resolve(MessageStatus.Replied, SummerAdminActionCatalog.Codes.FinalApprove);
        Assert.False(duplicateApprove.IsAllowed);
        Assert.Equal(SummerRequestWorkflowEngine.DuplicateStateTransitionMessage, duplicateApprove.ErrorMessage);
    }
}
