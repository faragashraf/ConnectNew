using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Models.Correspondance;
using Models.DTO.Common;
using Models.DTO.Correspondance.Enums;
using Models.DTO.Correspondance.Summer;
using Models.GPA.OrgStructure;
using Persistence.Data;
using Persistence.Services;
using Persistence.Services.Notifications;
using Persistence.Services.Summer;
using Xunit;

namespace Persistence.Tests;

public class SummerWorkflowServiceUnitFreezeAuthorizationTests
{
    [Fact]
    public async Task ReleaseUnitFreezeAsync_UnauthorizedUser_CannotReleaseBatch()
    {
        await using var connectContext = CreateConnectContext();
        await using var gpaContext = CreateGpaContext();

        SeedSummerDestinationCatalog(connectContext);
        SeedCategory(connectContext, categoryId: 147, categoryName: "مرسى مطروح", stockholder: 101);
        SeedActiveUserPosition(gpaContext, userId: "employee-no-admin", unitId: 999);
        SeedFreezeBatch(connectContext, freezeId: 5001, categoryId: 147, waveCode: "W01", familyCount: 5, active: true, includeBookedSlot: false);

        await connectContext.SaveChangesAsync();
        await gpaContext.SaveChangesAsync();

        var service = CreateService(connectContext, gpaContext);
        var response = await service.ReleaseUnitFreezeAsync(
            new SummerUnitFreezeReleaseRequest { FreezeId = 5001 },
            "employee-no-admin");

        Assert.False(response.IsSuccess);
        Assert.Contains(response.Errors, error => error.Code == "403");

        var batch = await connectContext.SummerUnitFreezeBatches
            .AsNoTracking()
            .Include(item => item.Details)
            .FirstAsync(item => item.FreezeId == 5001);
        Assert.True(batch.IsActive);
        Assert.All(batch.Details, detail => Assert.Equal(SummerUnitFreezeStatuses.FrozenAvailable, detail.Status));
    }

    [Fact]
    public async Task ReleaseUnitFreezeAsync_Admin_ReleasesUnusedAndKeepsBookedAssignments()
    {
        await using var connectContext = CreateConnectContext();
        await using var gpaContext = CreateGpaContext();

        SeedSummerDestinationCatalog(connectContext);
        SeedCategory(connectContext, categoryId: 147, categoryName: "مرسى مطروح", stockholder: 101);
        SeedActiveUserPosition(gpaContext, userId: "summer-admin", unitId: 101);
        SeedFreezeBatch(connectContext, freezeId: 5002, categoryId: 147, waveCode: "W01", familyCount: 5, active: true, includeBookedSlot: true);

        await connectContext.SaveChangesAsync();
        await gpaContext.SaveChangesAsync();

        var service = CreateService(connectContext, gpaContext);
        var response = await service.ReleaseUnitFreezeAsync(
            new SummerUnitFreezeReleaseRequest { FreezeId = 5002 },
            "summer-admin");

        Assert.True(response.IsSuccess);
        Assert.NotNull(response.Data);
        Assert.False(response.Data!.IsActive);
        Assert.Equal(0, response.Data.FrozenAvailableUnits);
        Assert.Equal(1, response.Data.FrozenAssignedUnits);

        var batch = await connectContext.SummerUnitFreezeBatches
            .AsNoTracking()
            .Include(item => item.Details)
            .FirstAsync(item => item.FreezeId == 5002);
        Assert.False(batch.IsActive);
        Assert.NotNull(batch.ReleasedAtUtc);
        Assert.Equal("summer-admin", batch.ReleasedBy);

        var releasedSlot = batch.Details.Single(item => item.SlotNumber == 1);
        Assert.Equal(SummerUnitFreezeStatuses.Released, releasedSlot.Status);

        var bookedSlot = batch.Details.Single(item => item.SlotNumber == 2);
        Assert.Equal(SummerUnitFreezeStatuses.Booked, bookedSlot.Status);
        Assert.Equal(700700, bookedSlot.AssignedMessageId);
    }

    [Fact]
    public async Task GetUnitFreezeDetailsAsync_UnauthorizedUser_CannotViewDetails()
    {
        await using var connectContext = CreateConnectContext();
        await using var gpaContext = CreateGpaContext();

        SeedSummerDestinationCatalog(connectContext);
        SeedCategory(connectContext, categoryId: 147, categoryName: "مرسى مطروح", stockholder: 101);
        SeedActiveUserPosition(gpaContext, userId: "employee-no-admin", unitId: 999);
        SeedFreezeBatch(connectContext, freezeId: 5003, categoryId: 147, waveCode: "W01", familyCount: 5, active: true, includeBookedSlot: false);

        await connectContext.SaveChangesAsync();
        await gpaContext.SaveChangesAsync();

        var service = CreateService(connectContext, gpaContext);
        var response = await service.GetUnitFreezeDetailsAsync(5003, "employee-no-admin");

        Assert.False(response.IsSuccess);
        Assert.Contains(response.Errors, error => error.Code == "403");
        Assert.Null(response.Data);
    }

    [Fact]
    public async Task GetUnitFreezesAsync_UnauthorizedUser_CannotListBatches()
    {
        await using var connectContext = CreateConnectContext();
        await using var gpaContext = CreateGpaContext();

        SeedSummerDestinationCatalog(connectContext);
        SeedCategory(connectContext, categoryId: 147, categoryName: "مرسى مطروح", stockholder: 101);
        SeedActiveUserPosition(gpaContext, userId: "employee-no-admin", unitId: 999);
        SeedFreezeBatch(connectContext, freezeId: 5004, categoryId: 147, waveCode: "W01", familyCount: 5, active: true, includeBookedSlot: false);

        await connectContext.SaveChangesAsync();
        await gpaContext.SaveChangesAsync();

        var service = CreateService(connectContext, gpaContext);
        var response = await service.GetUnitFreezesAsync(new SummerUnitFreezeQuery(), "employee-no-admin");

        Assert.False(response.IsSuccess);
        Assert.Contains(response.Errors, error => error.Code == "403");
        Assert.Null(response.Data);
    }

    private static SummerWorkflowService CreateService(ConnectContext connectContext, GPAContext gpaContext)
    {
        return new SummerWorkflowService(
            connectContext,
            attachHeldContext: null!,
            gpaContext,
            helperService: null!,
            new NoopNotificationService(),
            Options.Create(new ApplicationConfig()),
            new StaticOptionsMonitor<ResortBookingBlacklistOptions>(new ResortBookingBlacklistOptions()),
            NullLogger<SummerWorkflowService>.Instance);
    }

    private static ConnectContext CreateConnectContext()
    {
        var options = new DbContextOptionsBuilder<ConnectContext>()
            .UseInMemoryDatabase($"summer-freeze-auth-tests-{Guid.NewGuid():N}")
            .ConfigureWarnings(builder => builder.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;

        return new ConnectContext(options, new HttpContextAccessor());
    }

    private static GPAContext CreateGpaContext()
    {
        var options = new DbContextOptionsBuilder<GPAContext>()
            .UseInMemoryDatabase($"summer-freeze-auth-gpa-tests-{Guid.NewGuid():N}")
            .Options;

        return new GPAContext(options);
    }

    private static void SeedCategory(ConnectContext context, int categoryId, string categoryName, int stockholder)
    {
        context.Cdcategories.Add(new Cdcategory
        {
            CatId = categoryId,
            CatParent = 0,
            CatName = categoryName,
            CatStatus = true,
            CatMend = null,
            CatWorkFlow = 0,
            CatSms = false,
            CatMailNotification = false,
            To = null,
            Cc = null,
            StampDate = DateTime.UtcNow,
            CatCreatedBy = null,
            ApplicationId = SummerWorkflowDomainConstants.DynamicApplicationId,
            Stockholder = stockholder
        });
    }

    private static void SeedFreezeBatch(
        ConnectContext context,
        int freezeId,
        int categoryId,
        string waveCode,
        int familyCount,
        bool active,
        bool includeBookedSlot)
    {
        context.SummerUnitFreezeBatches.Add(new SummerUnitFreezeBatch
        {
            FreezeId = freezeId,
            CategoryId = categoryId,
            WaveCode = waveCode,
            FamilyCount = familyCount,
            RequestedUnitsCount = includeBookedSlot ? 2 : 1,
            FreezeType = "GENERAL",
            CreatedBy = "admin",
            CreatedAtUtc = DateTime.UtcNow,
            IsActive = active
        });

        context.SummerUnitFreezeDetails.Add(new SummerUnitFreezeDetail
        {
            FreezeDetailId = freezeId * 10 + 1,
            FreezeId = freezeId,
            SlotNumber = 1,
            Status = SummerUnitFreezeStatuses.FrozenAvailable,
            AssignedMessageId = null,
            LastStatusChangedAtUtc = DateTime.UtcNow
        });

        if (includeBookedSlot)
        {
            context.SummerUnitFreezeDetails.Add(new SummerUnitFreezeDetail
            {
                FreezeDetailId = freezeId * 10 + 2,
                FreezeId = freezeId,
                SlotNumber = 2,
                Status = SummerUnitFreezeStatuses.Booked,
                AssignedMessageId = 700700,
                AssignedAtUtc = DateTime.UtcNow,
                LastStatusChangedAtUtc = DateTime.UtcNow
            });
        }
    }

    private static void SeedSummerDestinationCatalog(ConnectContext context)
    {
        var payload = @"{
  ""seasonYear"": 2026,
  ""destinations"": [
    {
      ""categoryId"": 147,
      ""slug"": ""matrouh"",
      ""name"": ""مرسى مطروح"",
      ""maxExtraMembers"": 2,
      ""apartments"": [
        { ""familyCount"": 5, ""apartments"": 10 }
      ],
      ""waves"": [
        { ""code"": ""W01"", ""startsAtLabel"": ""4/6/2026 - الخميس"" }
      ]
    }
  ]
}";

        context.Cdmends.Add(new Cdmend
        {
            CdmendSql = 930001,
            CdmendType = "Textarea",
            CdmendTxt = SummerWorkflowDomainConstants.DestinationCatalogMend,
            CDMendLbl = "Destination Catalog",
            Placeholder = string.Empty,
            DefaultValue = string.Empty,
            CdmendTbl = payload,
            CdmendDatatype = "json",
            Required = false,
            RequiredTrue = false,
            Email = false,
            Pattern = false,
            MinValue = null,
            MaxValue = null,
            Cdmendmask = null,
            CdmendStat = false,
            Width = 0,
            Height = 0,
            IsDisabledInit = false,
            IsSearchable = false,
            ApplicationId = SummerWorkflowDomainConstants.DynamicApplicationId
        });
    }

    private static void SeedActiveUserPosition(GPAContext context, string userId, decimal unitId)
    {
        context.UserPositions.Add(new UserPosition
        {
            PositionId = Math.Abs(userId.GetHashCode()),
            UserId = userId,
            UnitId = unitId,
            StartDate = DateTime.Today.AddDays(-2),
            EndDate = DateTime.Today.AddDays(2),
            IsActive = true,
            IsManager = true
        });
    }

    private sealed class NoopNotificationService : IConnectNotificationService
    {
        public string RenderTemplate(string? template, IReadOnlyDictionary<string, string?> placeholders)
            => template ?? string.Empty;

        public Task<CommonResponse<bool>> SendSmsAsync(SmsDispatchRequest request, CancellationToken cancellationToken = default)
            => Task.FromResult(new CommonResponse<bool> { Data = true });

        public Task<CommonResponse<bool>> SendSmsByMultiMessagesAsync(SmsDispatchRequest request, CancellationToken cancellationToken = default)
            => Task.FromResult(new CommonResponse<bool> { Data = true });

        public Task<CommonResponse<bool>> SendSignalRToUserAsync(SignalRDispatchRequest request, CancellationToken cancellationToken = default)
            => Task.FromResult(new CommonResponse<bool> { Data = true });

        public Task<CommonResponse<bool>> SendSignalRToGroupAsync(SignalRGroupDispatchRequest request, CancellationToken cancellationToken = default)
            => Task.FromResult(new CommonResponse<bool> { Data = true });

        public Task<CommonResponse<bool>> SendSignalRToGroupsAsync(SignalRGroupsDispatchRequest request, CancellationToken cancellationToken = default)
            => Task.FromResult(new CommonResponse<bool> { Data = true });

        public Task<CommonResponse<bool>> SendWhatsAppAsync(WhatsAppDispatchRequest request, CancellationToken cancellationToken = default)
            => Task.FromResult(new CommonResponse<bool> { Data = true });

        public Task<CommonResponse<bool>> SendEmailAsync(EmailDispatchRequest request, CancellationToken cancellationToken = default)
            => Task.FromResult(new CommonResponse<bool> { Data = true });
    }

    private sealed class StaticOptionsMonitor<T> : IOptionsMonitor<T>
    {
        private sealed class NoopDisposable : IDisposable
        {
            public void Dispose()
            {
            }
        }

        public StaticOptionsMonitor(T value)
        {
            CurrentValue = value;
        }

        public T CurrentValue { get; }

        public T Get(string? name) => CurrentValue;

        public IDisposable OnChange(Action<T, string?> listener) => new NoopDisposable();
    }
}
