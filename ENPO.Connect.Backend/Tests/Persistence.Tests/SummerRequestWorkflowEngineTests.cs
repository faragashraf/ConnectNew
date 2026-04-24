using Models.DTO.Correspondance.Enums;
using Persistence.Services.Summer;
using Xunit;

namespace Persistence.Tests;

public class SummerRequestWorkflowEngineTests
{
    private readonly SummerRequestWorkflowEngine _engine = new();

    [Theory]
    [InlineData(MessageStatus.New)]
    [InlineData(MessageStatus.InProgress)]
    [InlineData(MessageStatus.Replied)]
    [InlineData(MessageStatus.Rejected)]
    [InlineData(MessageStatus.Printed)]
    [InlineData(MessageStatus.All)]
    public void Resolve_Always_Allows_CommentLike_Actions_In_All_States(MessageStatus currentState)
    {
        var commentResult = _engine.Resolve(currentState, "COMMENT");
        var replyResult = _engine.Resolve(currentState, "reply");
        var noteResult = _engine.Resolve(currentState, "note");

        Assert.True(commentResult.IsAllowed);
        Assert.True(replyResult.IsAllowed);
        Assert.True(noteResult.IsAllowed);

        Assert.False(commentResult.ChangesState);
        Assert.False(replyResult.ChangesState);
        Assert.False(noteResult.ChangesState);
        Assert.True(commentResult.IsBypassAction);
        Assert.True(replyResult.IsBypassAction);
        Assert.True(noteResult.IsBypassAction);
    }

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

    [Theory]
    [InlineData(MessageStatus.Printed, SummerAdminActionCatalog.Codes.FinalApprove)]
    [InlineData(MessageStatus.Printed, SummerAdminActionCatalog.Codes.ManualCancel)]
    [InlineData(MessageStatus.All, SummerAdminActionCatalog.Codes.FinalApprove)]
    [InlineData(MessageStatus.All, SummerAdminActionCatalog.Codes.ManualCancel)]
    public void Resolve_Blocks_StateChanging_AdminActions_For_CompletedLike_States(
        MessageStatus currentState,
        string actionCode)
    {
        var result = _engine.Resolve(currentState, actionCode);

        Assert.False(result.IsAllowed);
        Assert.Equal(SummerRequestWorkflowEngine.InvalidTransitionMessage, result.ErrorMessage);
        Assert.False(result.ChangesState);
    }

    [Theory]
    [InlineData(MessageStatus.New)]
    [InlineData(MessageStatus.InProgress)]
    [InlineData(MessageStatus.Replied)]
    public void Resolve_Allows_MarkUnpaid_For_Open_States(MessageStatus currentState)
    {
        var result = _engine.Resolve(currentState, SummerAdminActionCatalog.Codes.MarkUnpaid);

        Assert.True(result.IsAllowed);
        Assert.False(result.ChangesState);
        Assert.Null(result.TargetState);
        Assert.False(result.IsBypassAction);
    }

    [Theory]
    [InlineData(MessageStatus.Rejected)]
    [InlineData(MessageStatus.Printed)]
    [InlineData(MessageStatus.All)]
    public void Resolve_Blocks_MarkUnpaid_For_NonOpen_States(MessageStatus currentState)
    {
        var result = _engine.Resolve(currentState, SummerAdminActionCatalog.Codes.MarkUnpaid);

        Assert.False(result.IsAllowed);
        Assert.Equal(SummerRequestWorkflowEngine.InvalidTransitionMessage, result.ErrorMessage);
        Assert.False(result.ChangesState);
    }

    [Theory]
    [InlineData(MessageStatus.New)]
    [InlineData(MessageStatus.InProgress)]
    [InlineData(MessageStatus.Replied)]
    [InlineData(MessageStatus.Rejected)]
    [InlineData(MessageStatus.Printed)]
    [InlineData(MessageStatus.All)]
    public void Resolve_Allows_InternalAdminAction_For_All_States(MessageStatus currentState)
    {
        var result = _engine.Resolve(currentState, SummerAdminActionCatalog.Codes.InternalAdminAction);

        Assert.True(result.IsAllowed);
        Assert.False(result.ChangesState);
        Assert.Equal(currentState, result.TargetState);
        Assert.True(result.IsBypassAction);
    }

    [Fact]
    public void Resolve_Blocks_Unknown_Action_Code()
    {
        var result = _engine.Resolve(MessageStatus.New, "COMPLETE");

        Assert.False(result.IsAllowed);
        Assert.Equal(SummerRequestWorkflowEngine.InvalidTransitionMessage, result.ErrorMessage);
        Assert.False(result.ChangesState);
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
