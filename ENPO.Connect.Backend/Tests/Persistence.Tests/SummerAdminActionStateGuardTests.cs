using Models.DTO.Correspondance.Enums;
using Persistence.Services.Summer;
using Xunit;

namespace Persistence.Tests;

public class SummerAdminActionStateGuardTests
{
    [Fact]
    public void Blocks_ManualCancel_When_CurrentStatus_IsRejected()
    {
        var blocked = SummerAdminActionStateGuard.ShouldBlockDuplicateStateTransition(
            SummerAdminActionCatalog.Codes.ManualCancel,
            MessageStatus.Rejected);

        Assert.True(blocked);
    }

    [Fact]
    public void Blocks_FinalApprove_When_CurrentStatus_IsReplied()
    {
        var blocked = SummerAdminActionStateGuard.ShouldBlockDuplicateStateTransition(
            SummerAdminActionCatalog.Codes.FinalApprove,
            MessageStatus.Replied);

        Assert.True(blocked);
    }

    [Fact]
    public void Allows_CommentReplyNote_Actions_Even_When_Status_IsRejected()
    {
        Assert.False(SummerAdminActionStateGuard.ShouldBlockDuplicateStateTransition("COMMENT", MessageStatus.Rejected));
        Assert.False(SummerAdminActionStateGuard.ShouldBlockDuplicateStateTransition("reply", MessageStatus.Rejected));
        Assert.False(SummerAdminActionStateGuard.ShouldBlockDuplicateStateTransition("note", MessageStatus.Rejected));
    }

    [Fact]
    public void Supports_StatusFlow_Pending_Approved_Rejected_Approved_ThenBlocks_ApproveAgain()
    {
        Assert.False(SummerAdminActionStateGuard.ShouldBlockDuplicateStateTransition("FINAL_APPROVE", MessageStatus.New));
        Assert.False(SummerAdminActionStateGuard.ShouldBlockDuplicateStateTransition("MANUAL_CANCEL", MessageStatus.Replied));
        Assert.False(SummerAdminActionStateGuard.ShouldBlockDuplicateStateTransition("FINAL_APPROVE", MessageStatus.Rejected));
        Assert.True(SummerAdminActionStateGuard.ShouldBlockDuplicateStateTransition("FINAL_APPROVE", MessageStatus.Replied));
    }
}
