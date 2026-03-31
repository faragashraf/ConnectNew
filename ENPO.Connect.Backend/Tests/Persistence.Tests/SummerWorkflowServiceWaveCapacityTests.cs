using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Models.Correspondance;
using Models.DTO.Common;
using Models.DTO.Correspondance.Enums;
using Models.GPA.OrgStructure;
using Persistence.Data;
using Persistence.Services;
using Persistence.Services.Notifications;
using Persistence.Services.Summer;
using Xunit;

namespace Persistence.Tests;

public class SummerWorkflowServiceWaveCapacityTests
{
    [Fact]
    public async Task GetWaveCapacityAsync_NormalUser_HidesFrozenStockAndCounts()
    {
        await using var connectContext = CreateConnectContext();
        await using var gpaContext = CreateGpaContext();

        SeedWaveCapacityFixture(connectContext);
        SeedActiveUserPosition(gpaContext, "employee-1", 999);

        await connectContext.SaveChangesAsync();
        await gpaContext.SaveChangesAsync();

        var service = CreateService(connectContext, gpaContext);

        var response = await service.GetWaveCapacityAsync(147, "W01", "employee-1", includeFrozenUnits: false);

        Assert.True(response.IsSuccess);
        Assert.NotNull(response.Data);
        var row = Assert.Single(response.Data!);
        Assert.Equal(6, row.AvailableUnits);
        Assert.Equal(4, row.UsedUnits);
        Assert.Equal(0, row.FrozenAvailableUnits);
        Assert.Equal(0, row.FrozenAssignedUnits);
    }

    [Fact]
    public async Task GetWaveCapacityAsync_NormalUser_CannotRequestFrozenStock()
    {
        await using var connectContext = CreateConnectContext();
        await using var gpaContext = CreateGpaContext();

        SeedWaveCapacityFixture(connectContext);
        SeedActiveUserPosition(gpaContext, "employee-2", 999);

        await connectContext.SaveChangesAsync();
        await gpaContext.SaveChangesAsync();

        var service = CreateService(connectContext, gpaContext);

        var response = await service.GetWaveCapacityAsync(147, "W01", "employee-2", includeFrozenUnits: true);

        Assert.False(response.IsSuccess);
        Assert.Contains(response.Errors, error => error.Code == "403");
    }

    [Fact]
    public async Task GetWaveCapacityAsync_AdminUser_CanIncludeFrozenStock()
    {
        await using var connectContext = CreateConnectContext();
        await using var gpaContext = CreateGpaContext();

        SeedWaveCapacityFixture(connectContext);
        SeedActiveUserPosition(gpaContext, "summer-admin", 101);

        await connectContext.SaveChangesAsync();
        await gpaContext.SaveChangesAsync();

        var service = CreateService(connectContext, gpaContext);

        var response = await service.GetWaveCapacityAsync(147, "W01", "summer-admin", includeFrozenUnits: true);

        Assert.True(response.IsSuccess);
        Assert.NotNull(response.Data);
        var row = Assert.Single(response.Data!);
        Assert.Equal(8, row.AvailableUnits);
        Assert.Equal(2, row.UsedUnits);
        Assert.Equal(2, row.FrozenAvailableUnits);
        Assert.Equal(0, row.FrozenAssignedUnits);
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
            .UseInMemoryDatabase($"summer-wave-capacity-tests-{Guid.NewGuid():N}")
            .ConfigureWarnings(builder => builder.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;

        return new ConnectContext(options, new HttpContextAccessor());
    }

    private static GPAContext CreateGpaContext()
    {
        var options = new DbContextOptionsBuilder<GPAContext>()
            .UseInMemoryDatabase($"summer-wave-capacity-gpa-tests-{Guid.NewGuid():N}")
            .Options;

        return new GPAContext(options);
    }

    private static void SeedWaveCapacityFixture(ConnectContext context)
    {
        SeedSummerDestinationCatalog(context);

        context.Cdcategories.Add(new Cdcategory
        {
            CatId = 147,
            CatParent = 0,
            CatName = "مرسى مطروح",
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
            Stockholder = 101
        });

        context.Messages.AddRange(
            new Message { MessageId = 1101, CategoryCd = 147, Status = MessageStatus.New, Priority = Priority.Medium, CreatedDate = DateTime.UtcNow },
            new Message { MessageId = 1102, CategoryCd = 147, Status = MessageStatus.New, Priority = Priority.Medium, CreatedDate = DateTime.UtcNow });

        context.TkmendFields.AddRange(
            new TkmendField { FildSql = 1, FildRelted = 1101, FildKind = "SUM2026_WaveCode", FildTxt = "W01" },
            new TkmendField { FildSql = 2, FildRelted = 1101, FildKind = "SUM2026_FamilyCount", FildTxt = "5" },
            new TkmendField { FildSql = 3, FildRelted = 1102, FildKind = "SUM2026_WaveCode", FildTxt = "W01" },
            new TkmendField { FildSql = 4, FildRelted = 1102, FildKind = "SUM2026_FamilyCount", FildTxt = "5" });

        context.SummerUnitFreezeBatches.Add(new SummerUnitFreezeBatch
        {
            FreezeId = 900,
            CategoryId = 147,
            WaveCode = "W01",
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
                FreezeDetailId = 901,
                FreezeId = 900,
                SlotNumber = 1,
                Status = SummerUnitFreezeStatuses.FrozenAvailable,
                LastStatusChangedAtUtc = DateTime.UtcNow
            },
            new SummerUnitFreezeDetail
            {
                FreezeDetailId = 902,
                FreezeId = 900,
                SlotNumber = 2,
                Status = SummerUnitFreezeStatuses.FrozenAvailable,
                LastStatusChangedAtUtc = DateTime.UtcNow
            });
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
            CdmendSql = 920001,
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
