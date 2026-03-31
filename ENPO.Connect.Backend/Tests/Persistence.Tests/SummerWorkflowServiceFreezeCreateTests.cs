using System.Diagnostics;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Models.Correspondance;
using Models.DTO.Common;
using Models.DTO.Correspondance.Summer;
using Models.GPA.OrgStructure;
using Persistence.Data;
using Persistence.Services;
using Persistence.Services.Notifications;
using Persistence.Services.Summer;
using Xunit;

namespace Persistence.Tests;

public class SummerWorkflowServiceFreezeCreateTests
{
    [Fact]
    public async Task CreateUnitFreezeAsync_DoesNotHang_WhenSignalRDispatchNeverCompletes()
    {
        await using var connectContext = CreateConnectContext();
        await using var gpaContext = CreateGpaContext();
        var notificationService = new HangingNotificationService();
        var appConfig = new ApplicationConfig
        {
            ApiOptions = new ApiOptions
            {
                SummerCapacitySignalRTimeoutMs = 200
            }
        };

        SeedSummerDestinationCatalog(connectContext);
        SeedCategory(connectContext, categoryId: 147, categoryName: "مرسى مطروح", stockholder: 101);
        SeedActiveUserPosition(gpaContext, userId: "admin-freeze", unitId: 101);

        await connectContext.SaveChangesAsync();
        await gpaContext.SaveChangesAsync();

        var service = new SummerWorkflowService(
            connectContext,
            attachHeldContext: null!,
            gpaContext,
            helperService: null!,
            notificationService,
            Options.Create(appConfig),
            new StaticOptionsMonitor<ResortBookingBlacklistOptions>(new ResortBookingBlacklistOptions()),
            NullLogger<SummerWorkflowService>.Instance);

        var request = new SummerUnitFreezeCreateRequest
        {
            CategoryId = 147,
            WaveCode = "W01",
            FamilyCount = 5,
            RequestedUnitsCount = 1,
            FreezeType = "GENERAL",
            Reason = "test",
            Notes = "integration-like test"
        };

        var sw = Stopwatch.StartNew();
        var createTask = service.CreateUnitFreezeAsync(request, "admin-freeze");
        var completed = await Task.WhenAny(createTask, Task.Delay(TimeSpan.FromSeconds(3)));
        sw.Stop();

        Assert.Same(createTask, completed);

        var response = await createTask;
        Assert.True(response.IsSuccess);
        Assert.NotNull(response.Data);
        Assert.Equal(1, response.Data!.RequestedUnitsCount);
        Assert.Equal(1, notificationService.SendSignalRToGroupsCalls);
        Assert.InRange(sw.ElapsedMilliseconds, 0, 2500);

        Assert.Equal(1, await connectContext.SummerUnitFreezeBatches.CountAsync());
        Assert.Equal(1, await connectContext.SummerUnitFreezeDetails.CountAsync());
    }

    private static ConnectContext CreateConnectContext()
    {
        var options = new DbContextOptionsBuilder<ConnectContext>()
            .UseInMemoryDatabase($"summer-workflow-freeze-tests-{Guid.NewGuid():N}")
            .ConfigureWarnings(builder => builder.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;

        return new ConnectContext(options, new HttpContextAccessor());
    }

    private static GPAContext CreateGpaContext()
    {
        var options = new DbContextOptionsBuilder<GPAContext>()
            .UseInMemoryDatabase($"summer-workflow-freeze-gpa-tests-{Guid.NewGuid():N}")
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
            CdmendSql = 910001,
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
            PositionId = 5001,
            UserId = userId,
            UnitId = unitId,
            StartDate = DateTime.Today.AddDays(-5),
            EndDate = DateTime.Today.AddDays(5),
            IsActive = true,
            IsManager = true
        });
    }

    private sealed class HangingNotificationService : IConnectNotificationService
    {
        private readonly TaskCompletionSource<CommonResponse<bool>> _neverCompletes =
            new(TaskCreationOptions.RunContinuationsAsynchronously);

        public int SendSignalRToGroupsCalls { get; private set; }

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
        {
            SendSignalRToGroupsCalls++;
            return _neverCompletes.Task;
        }

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

        public IDisposable OnChange(Action<T, string?> listener)
        {
            return new NoopDisposable();
        }
    }
}
