using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Models.Correspondance;
using Models.DTO.Correspondance.Enums;
using Persistence.Data;
using Persistence.Services.Summer;
using Xunit;

namespace Persistence.Tests;

public class SummerUnitFreezeServiceTests
{
    [Fact]
    public async Task CalculatePublicAvailableUnits_SubtractsUsedAndFrozenAvailable()
    {
        await using var context = CreateContext();

        context.Messages.AddRange(
            new Message { MessageId = 1001, CategoryCd = 147, Status = MessageStatus.New, Priority = Priority.Medium, CreatedDate = DateTime.UtcNow },
            new Message { MessageId = 1002, CategoryCd = 147, Status = MessageStatus.New, Priority = Priority.Medium, CreatedDate = DateTime.UtcNow });

        context.TkmendFields.AddRange(
            new TkmendField { FildSql = 1, FildRelted = 1001, FildKind = "SummerCamp", FildTxt = "W1" },
            new TkmendField { FildSql = 2, FildRelted = 1001, FildKind = "FamilyCount", FildTxt = "5" },
            new TkmendField { FildSql = 3, FildRelted = 1002, FildKind = "SummerCamp", FildTxt = "W1" },
            new TkmendField { FildSql = 4, FildRelted = 1002, FildKind = "FamilyCount", FildTxt = "5" });

        context.SummerUnitFreezeBatches.Add(new SummerUnitFreezeBatch
        {
            FreezeId = 501,
            CategoryId = 147,
            WaveCode = "W1",
            FamilyCount = 5,
            RequestedUnitsCount = 1,
            FreezeType = "GENERAL",
            CreatedBy = "admin",
            CreatedAtUtc = DateTime.UtcNow,
            IsActive = true
        });

        context.SummerUnitFreezeDetails.Add(new SummerUnitFreezeDetail
        {
            FreezeDetailId = 7001,
            FreezeId = 501,
            SlotNumber = 1,
            Status = SummerUnitFreezeStatuses.FrozenAvailable,
            LastStatusChangedAtUtc = DateTime.UtcNow
        });

        await context.SaveChangesAsync();

        var service = new SummerUnitFreezeService(context);
        var available = await service.CalculatePublicAvailableUnitsAsync(147, "W1", 5, totalUnits: 5);

        Assert.Equal(2, available);
    }

    [Fact]
    public async Task TryAssignFrozenUnit_AssignsAvailableSlot()
    {
        await using var context = CreateContext();
        SeedSingleActiveFrozenSlot(context, status: SummerUnitFreezeStatuses.FrozenAvailable, assignedMessageId: null);
        await context.SaveChangesAsync();

        var service = new SummerUnitFreezeService(context);
        var assigned = await service.TryAssignFrozenUnitAsync(147, "W2", 6, 9001, "admin");

        Assert.True(assigned);

        var detail = await context.SummerUnitFreezeDetails.FirstAsync();
        Assert.Equal(SummerUnitFreezeStatuses.Booked, detail.Status);
        Assert.Equal(9001, detail.AssignedMessageId);
    }

    [Fact]
    public async Task ReleaseAssignments_ReturnsToFrozenWhenBatchStillActive()
    {
        await using var context = CreateContext();
        SeedSingleActiveFrozenSlot(context, status: SummerUnitFreezeStatuses.Booked, assignedMessageId: 9100);
        await context.SaveChangesAsync();

        var service = new SummerUnitFreezeService(context);
        var releasedCount = await service.ReleaseAssignmentsForMessageAsync(9100, "admin");
        await context.SaveChangesAsync();

        Assert.Equal(1, releasedCount);
        var detail = await context.SummerUnitFreezeDetails.FirstAsync();
        Assert.Equal(SummerUnitFreezeStatuses.FrozenAvailable, detail.Status);
        Assert.Null(detail.AssignedMessageId);
    }

    [Fact]
    public async Task ReleaseAssignments_MarksReleasedWhenBatchInactive()
    {
        await using var context = CreateContext();
        context.SummerUnitFreezeBatches.Add(new SummerUnitFreezeBatch
        {
            FreezeId = 601,
            CategoryId = 147,
            WaveCode = "W3",
            FamilyCount = 4,
            RequestedUnitsCount = 1,
            FreezeType = "GENERAL",
            CreatedBy = "admin",
            CreatedAtUtc = DateTime.UtcNow,
            IsActive = false,
            ReleasedAtUtc = DateTime.UtcNow,
            ReleasedBy = "admin"
        });
        context.SummerUnitFreezeDetails.Add(new SummerUnitFreezeDetail
        {
            FreezeDetailId = 8001,
            FreezeId = 601,
            SlotNumber = 1,
            Status = SummerUnitFreezeStatuses.Booked,
            AssignedMessageId = 9200,
            AssignedAtUtc = DateTime.UtcNow,
            LastStatusChangedAtUtc = DateTime.UtcNow
        });
        await context.SaveChangesAsync();

        var service = new SummerUnitFreezeService(context);
        var releasedCount = await service.ReleaseAssignmentsForMessageAsync(9200, "admin");
        await context.SaveChangesAsync();

        Assert.Equal(1, releasedCount);
        var detail = await context.SummerUnitFreezeDetails.FirstAsync();
        Assert.Equal(SummerUnitFreezeStatuses.Released, detail.Status);
        Assert.Null(detail.AssignedMessageId);
        Assert.NotNull(detail.ReleasedAtUtc);
    }

    [Fact]
    public async Task CreateFreezeBatch_FailsWithoutPartialInsert_WhenRequestedExceedsPublicAvailability()
    {
        await using var context = CreateContext();
        context.Messages.Add(new Message
        {
            MessageId = 1100,
            CategoryCd = 147,
            Status = MessageStatus.New,
            Priority = Priority.Medium,
            CreatedDate = DateTime.UtcNow
        });
        context.TkmendFields.AddRange(
            new TkmendField { FildSql = 11, FildRelted = 1100, FildKind = "SummerCamp", FildTxt = "W4" },
            new TkmendField { FildSql = 12, FildRelted = 1100, FildKind = "FamilyCount", FildTxt = "5" });
        await context.SaveChangesAsync();

        var service = new SummerUnitFreezeService(context);
        var result = await service.CreateFreezeBatchAsync(
            categoryId: 147,
            waveCode: "W4",
            familyCount: 5,
            requestedUnitsCount: 1,
            totalUnits: 1,
            freezeType: "GENERAL",
            reason: "test",
            notes: null,
            createdBy: "admin");

        Assert.False(result.Success);
        Assert.Equal("409", result.ErrorCode);
        Assert.Equal(0, await context.SummerUnitFreezeBatches.CountAsync());
        Assert.Equal(0, await context.SummerUnitFreezeDetails.CountAsync());
    }

    [Fact]
    public async Task CreateFreezeBatch_CreatesBatchAndDetails_WhenCapacityAvailable()
    {
        await using var context = CreateContext();
        var service = new SummerUnitFreezeService(context);

        var result = await service.CreateFreezeBatchAsync(
            categoryId: 147,
            waveCode: "W5",
            familyCount: 4,
            requestedUnitsCount: 2,
            totalUnits: 5,
            freezeType: "GENERAL",
            reason: "admin hold",
            notes: "manual test",
            createdBy: "admin");

        Assert.True(result.Success);
        Assert.NotNull(result.Batch);

        var batch = await context.SummerUnitFreezeBatches
            .Include(item => item.Details)
            .FirstOrDefaultAsync();
        Assert.NotNull(batch);
        Assert.True(batch!.IsActive);
        Assert.Equal(2, batch.Details.Count);
        Assert.All(batch.Details, detail => Assert.Equal(SummerUnitFreezeStatuses.FrozenAvailable, detail.Status));
    }

    [Fact]
    public async Task ReleaseFreezeBatch_ConvertsOnlyUnusedSlotsToReleased()
    {
        await using var context = CreateContext();
        context.SummerUnitFreezeBatches.Add(new SummerUnitFreezeBatch
        {
            FreezeId = 700,
            CategoryId = 147,
            WaveCode = "W6",
            FamilyCount = 5,
            RequestedUnitsCount = 2,
            FreezeType = "GENERAL",
            CreatedBy = "admin",
            CreatedAtUtc = DateTime.UtcNow,
            IsActive = true
        });
        context.SummerUnitFreezeDetails.AddRange(
            new SummerUnitFreezeDetail
            {
                FreezeDetailId = 9001,
                FreezeId = 700,
                SlotNumber = 1,
                Status = SummerUnitFreezeStatuses.FrozenAvailable,
                LastStatusChangedAtUtc = DateTime.UtcNow
            },
            new SummerUnitFreezeDetail
            {
                FreezeDetailId = 9002,
                FreezeId = 700,
                SlotNumber = 2,
                Status = SummerUnitFreezeStatuses.Booked,
                AssignedMessageId = 9300,
                AssignedAtUtc = DateTime.UtcNow,
                LastStatusChangedAtUtc = DateTime.UtcNow
            });
        await context.SaveChangesAsync();

        var service = new SummerUnitFreezeService(context);
        var result = await service.ReleaseFreezeBatchAsync(700, "admin");
        await context.SaveChangesAsync();

        Assert.True(result.Success);

        var batch = await context.SummerUnitFreezeBatches
            .Include(item => item.Details)
            .FirstAsync(item => item.FreezeId == 700);
        Assert.False(batch.IsActive);

        var releasedDetail = batch.Details.Single(item => item.SlotNumber == 1);
        Assert.Equal(SummerUnitFreezeStatuses.Released, releasedDetail.Status);

        var bookedDetail = batch.Details.Single(item => item.SlotNumber == 2);
        Assert.Equal(SummerUnitFreezeStatuses.Booked, bookedDetail.Status);
        Assert.Equal(9300, bookedDetail.AssignedMessageId);
    }

    [Fact]
    public async Task CreateFreezeBatch_AllowsRefreezeAfterRelease_WhenCapacityStillEligible()
    {
        await using var context = CreateContext();
        var service = new SummerUnitFreezeService(context);

        var firstFreeze = await service.CreateFreezeBatchAsync(
            categoryId: 147,
            waveCode: "W7",
            familyCount: 5,
            requestedUnitsCount: 1,
            totalUnits: 2,
            freezeType: "GENERAL",
            reason: "first freeze",
            notes: null,
            createdBy: "admin");
        Assert.True(firstFreeze.Success);
        Assert.NotNull(firstFreeze.Batch);

        var release = await service.ReleaseFreezeBatchAsync(firstFreeze.Batch!.FreezeId, "admin");
        Assert.True(release.Success);

        var secondFreeze = await service.CreateFreezeBatchAsync(
            categoryId: 147,
            waveCode: "W7",
            familyCount: 5,
            requestedUnitsCount: 1,
            totalUnits: 2,
            freezeType: "GENERAL",
            reason: "re-freeze",
            notes: null,
            createdBy: "admin");

        Assert.True(secondFreeze.Success);
        Assert.NotNull(secondFreeze.Batch);
        Assert.NotEqual(firstFreeze.Batch!.FreezeId, secondFreeze.Batch!.FreezeId);

        var activeBatches = await context.SummerUnitFreezeBatches.CountAsync(batch => batch.IsActive);
        Assert.Equal(1, activeBatches);
    }

    [Fact]
    public async Task CreateFreezeBatch_RejectsRefreezeWhenCapacityConsumedByBookedRequest()
    {
        await using var context = CreateContext();
        var service = new SummerUnitFreezeService(context);

        var firstFreeze = await service.CreateFreezeBatchAsync(
            categoryId: 147,
            waveCode: "W8",
            familyCount: 6,
            requestedUnitsCount: 1,
            totalUnits: 1,
            freezeType: "GENERAL",
            reason: "initial",
            notes: null,
            createdBy: "admin");
        Assert.True(firstFreeze.Success);
        Assert.NotNull(firstFreeze.Batch);

        var release = await service.ReleaseFreezeBatchAsync(firstFreeze.Batch!.FreezeId, "admin");
        Assert.True(release.Success);

        context.Messages.Add(new Message
        {
            MessageId = 9901,
            CategoryCd = 147,
            Status = MessageStatus.New,
            Priority = Priority.Medium,
            CreatedDate = DateTime.UtcNow
        });
        context.TkmendFields.AddRange(
            new TkmendField { FildSql = 1201, FildRelted = 9901, FildKind = "SummerCamp", FildTxt = "W8" },
            new TkmendField { FildSql = 1202, FildRelted = 9901, FildKind = "FamilyCount", FildTxt = "6" });
        await context.SaveChangesAsync();

        var secondFreeze = await service.CreateFreezeBatchAsync(
            categoryId: 147,
            waveCode: "W8",
            familyCount: 6,
            requestedUnitsCount: 1,
            totalUnits: 1,
            freezeType: "GENERAL",
            reason: "re-freeze blocked by booking",
            notes: null,
            createdBy: "admin");

        Assert.False(secondFreeze.Success);
        Assert.Equal("409", secondFreeze.ErrorCode);
    }

    [Fact]
    public async Task CreateFreezeBatch_PreventsDoubleFreezeForActiveStock()
    {
        await using var context = CreateContext();
        var service = new SummerUnitFreezeService(context);

        var firstFreeze = await service.CreateFreezeBatchAsync(
            categoryId: 147,
            waveCode: "W9",
            familyCount: 4,
            requestedUnitsCount: 1,
            totalUnits: 1,
            freezeType: "GENERAL",
            reason: "first",
            notes: null,
            createdBy: "admin");
        Assert.True(firstFreeze.Success);

        var secondFreeze = await service.CreateFreezeBatchAsync(
            categoryId: 147,
            waveCode: "W9",
            familyCount: 4,
            requestedUnitsCount: 1,
            totalUnits: 1,
            freezeType: "GENERAL",
            reason: "double",
            notes: null,
            createdBy: "admin");

        Assert.False(secondFreeze.Success);
        Assert.Equal("409", secondFreeze.ErrorCode);
    }

    private static ConnectContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<ConnectContext>()
            .UseInMemoryDatabase($"summer-freeze-tests-{Guid.NewGuid():N}")
            .ConfigureWarnings(builder => builder.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;

        return new ConnectContext(options, new HttpContextAccessor());
    }

    private static void SeedSingleActiveFrozenSlot(ConnectContext context, string status, int? assignedMessageId)
    {
        context.SummerUnitFreezeBatches.Add(new SummerUnitFreezeBatch
        {
            FreezeId = 600,
            CategoryId = 147,
            WaveCode = "W2",
            FamilyCount = 6,
            RequestedUnitsCount = 1,
            FreezeType = "GENERAL",
            CreatedBy = "admin",
            CreatedAtUtc = DateTime.UtcNow,
            IsActive = true
        });
        context.SummerUnitFreezeDetails.Add(new SummerUnitFreezeDetail
        {
            FreezeDetailId = 8000,
            FreezeId = 600,
            SlotNumber = 1,
            Status = status,
            AssignedMessageId = assignedMessageId,
            AssignedAtUtc = assignedMessageId.HasValue ? DateTime.UtcNow : null,
            LastStatusChangedAtUtc = DateTime.UtcNow
        });
    }
}
