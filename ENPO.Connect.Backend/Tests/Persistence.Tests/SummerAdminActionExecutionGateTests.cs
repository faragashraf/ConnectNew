using Persistence.Services.Summer;
using Xunit;

namespace Persistence.Tests;

public class SummerAdminActionExecutionGateTests
{
    [Fact]
    public async Task AllowsOnlyOneConcurrentHolder_ForSameMessageId()
    {
        var gate = new SummerAdminActionExecutionGate();

        await using var first = await gate.TryEnterAsync(42, timeoutMs: 50);
        Assert.NotNull(first);

        var second = await gate.TryEnterAsync(42, timeoutMs: 0);

        Assert.Null(second);
    }

    [Fact]
    public async Task AllowsSecondHolder_AfterFirstIsReleased()
    {
        var gate = new SummerAdminActionExecutionGate();

        var first = await gate.TryEnterAsync(42, timeoutMs: 50);
        Assert.NotNull(first);

        if (first != null)
        {
            await first.DisposeAsync();
        }

        var second = await gate.TryEnterAsync(42, timeoutMs: 50);

        Assert.NotNull(second);
        if (second != null)
        {
            await second.DisposeAsync();
        }
    }

    [Fact]
    public async Task AllowsParallelHolders_ForDifferentMessageIds()
    {
        var gate = new SummerAdminActionExecutionGate();

        await using var first = await gate.TryEnterAsync(100, timeoutMs: 50);
        await using var second = await gate.TryEnterAsync(200, timeoutMs: 50);

        Assert.NotNull(first);
        Assert.NotNull(second);
    }
}
