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

public class SummerWorkflowServicePricingAuthorizationTests
{
    [Fact]
    public async Task GetPricingCatalogAsync_AdminWithoutSummerPricingFunc_Returns403()
    {
        await using var connectContext = CreateConnectContext();
        await using var gpaContext = CreateGpaContext();

        SeedSummerDestinationCatalog(connectContext);
        SeedCategory(connectContext, categoryId: 147, stockholder: 101);
        SeedActiveUserPosition(gpaContext, userId: "summer-admin", unitId: 101);

        await connectContext.SaveChangesAsync();
        await gpaContext.SaveChangesAsync();

        var service = CreateService(connectContext, gpaContext);
        var response = await service.GetPricingCatalogAsync(
            SummerWorkflowDomainConstants.DefaultSeasonYear,
            "summer-admin",
            hasSummerPricingPermission: false);

        Assert.False(response.IsSuccess);
        Assert.Contains(response.Errors, error => error.Code == "403");
    }

    [Fact]
    public async Task SavePricingCatalogAsync_AdminWithoutSummerPricingFunc_Returns403()
    {
        await using var connectContext = CreateConnectContext();
        await using var gpaContext = CreateGpaContext();

        SeedSummerDestinationCatalog(connectContext);
        SeedCategory(connectContext, categoryId: 147, stockholder: 101);
        SeedActiveUserPosition(gpaContext, userId: "summer-admin", unitId: 101);

        await connectContext.SaveChangesAsync();
        await gpaContext.SaveChangesAsync();

        var service = CreateService(connectContext, gpaContext);
        var response = await service.SavePricingCatalogAsync(
            new SummerPricingCatalogUpsertRequest
            {
                SeasonYear = SummerWorkflowDomainConstants.DefaultSeasonYear,
                Records = new List<SummerPricingCatalogRecordDto>()
            },
            "summer-admin",
            hasSummerPricingPermission: false);

        Assert.False(response.IsSuccess);
        Assert.Contains(response.Errors, error => error.Code == "403");
    }

    [Fact]
    public async Task GetPricingCatalogAsync_AdminWithSummerPricingFunc_ReturnsCatalog()
    {
        await using var connectContext = CreateConnectContext();
        await using var gpaContext = CreateGpaContext();

        SeedSummerDestinationCatalog(connectContext);
        SeedCategory(connectContext, categoryId: 147, stockholder: 101);
        SeedActiveUserPosition(gpaContext, userId: "summer-admin", unitId: 101);

        await connectContext.SaveChangesAsync();
        await gpaContext.SaveChangesAsync();

        var service = CreateService(connectContext, gpaContext);
        var response = await service.GetPricingCatalogAsync(
            SummerWorkflowDomainConstants.DefaultSeasonYear,
            "summer-admin",
            hasSummerPricingPermission: true);

        Assert.True(response.IsSuccess);
        Assert.NotNull(response.Data);
        Assert.Equal(SummerWorkflowDomainConstants.DefaultSeasonYear, response.Data!.SeasonYear);
    }

    [Fact]
    public async Task SavePricingCatalogAsync_AdminWithSummerPricingFunc_Succeeds()
    {
        await using var connectContext = CreateConnectContext();
        await using var gpaContext = CreateGpaContext();

        SeedSummerDestinationCatalog(connectContext);
        SeedCategory(connectContext, categoryId: 147, stockholder: 101);
        SeedActiveUserPosition(gpaContext, userId: "summer-admin", unitId: 101);

        await connectContext.SaveChangesAsync();
        await gpaContext.SaveChangesAsync();

        var service = CreateService(connectContext, gpaContext);
        var response = await service.SavePricingCatalogAsync(
            new SummerPricingCatalogUpsertRequest
            {
                SeasonYear = SummerWorkflowDomainConstants.DefaultSeasonYear,
                Records = new List<SummerPricingCatalogRecordDto>
                {
                    new()
                    {
                        PricingConfigId = "SUM2026-MATROUH-W01",
                        CategoryId = 147,
                        SeasonYear = SummerWorkflowDomainConstants.DefaultSeasonYear,
                        PeriodKey = "W01",
                        AccommodationPricePerPerson = 500m,
                        TransportationPricePerPerson = 200m,
                        InsuranceAmount = 100m,
                        ProxyInsuranceAmount = 150m,
                        PricingMode = SummerWorkflowDomainConstants.PricingModes.AccommodationAndTransportationOptional,
                        TransportationMandatory = false,
                        IsActive = true,
                        DisplayLabel = "مطروح - اختبار صلاحية",
                        Notes = "seed"
                    }
                }
            },
            "summer-admin",
            hasSummerPricingPermission: true);

        Assert.True(response.IsSuccess);
        Assert.NotNull(response.Data);
        Assert.Equal(SummerWorkflowDomainConstants.DefaultSeasonYear, response.Data!.SeasonYear);
    }

    [Fact]
    public async Task GetUnitFreezesAsync_AdminWithoutSummerPricingFunc_NotBlocked()
    {
        await using var connectContext = CreateConnectContext();
        await using var gpaContext = CreateGpaContext();

        SeedSummerDestinationCatalog(connectContext);
        SeedCategory(connectContext, categoryId: 147, stockholder: 101);
        SeedActiveUserPosition(gpaContext, userId: "summer-admin", unitId: 101);

        await connectContext.SaveChangesAsync();
        await gpaContext.SaveChangesAsync();

        var service = CreateService(connectContext, gpaContext);
        var response = await service.GetUnitFreezesAsync(
            new SummerUnitFreezeQuery(),
            "summer-admin");

        Assert.True(response.IsSuccess);
        Assert.Empty(response.Errors);
    }

    [Fact]
    public async Task GetPricingQuoteAsync_NonAdmin_IgnoresNonWorkerMembershipSelection()
    {
        await using var connectContext = CreateConnectContext();
        await using var gpaContext = CreateGpaContext();

        SeedSummerDestinationCatalog(connectContext);
        SeedSummerPricingCatalog(connectContext);
        await connectContext.SaveChangesAsync();

        var service = CreateService(connectContext, gpaContext);
        var response = await service.GetPricingQuoteAsync(
            new SummerPricingQuoteRequest
            {
                CategoryId = 147,
                SeasonYear = SummerWorkflowDomainConstants.DefaultSeasonYear,
                PeriodKey = "JUN_SEP",
                PersonsCount = 2,
                StayMode = SummerWorkflowDomainConstants.StayModes.ResidenceWithTransport,
                IsProxyBooking = true,
                MembershipType = SummerWorkflowDomainConstants.MembershipTypes.NonWorker
            },
            userId: "employee-user",
            hasSummerAdminPermission: false);

        Assert.True(response.IsSuccess);
        Assert.NotNull(response.Data);
        Assert.Equal(SummerWorkflowDomainConstants.MembershipTypes.Worker, response.Data!.MembershipType);
        Assert.Equal(500m, response.Data.AppliedInsuranceAmount);
    }

    [Fact]
    public async Task GetPricingQuoteAsync_Admin_CanSelectNonWorkerMembership()
    {
        await using var connectContext = CreateConnectContext();
        await using var gpaContext = CreateGpaContext();

        SeedSummerDestinationCatalog(connectContext);
        SeedSummerPricingCatalog(connectContext);
        await connectContext.SaveChangesAsync();

        var service = CreateService(connectContext, gpaContext);
        var response = await service.GetPricingQuoteAsync(
            new SummerPricingQuoteRequest
            {
                CategoryId = 147,
                SeasonYear = SummerWorkflowDomainConstants.DefaultSeasonYear,
                PeriodKey = "JUN_SEP",
                PersonsCount = 2,
                StayMode = SummerWorkflowDomainConstants.StayModes.ResidenceWithTransport,
                MembershipType = SummerWorkflowDomainConstants.MembershipTypes.NonWorker
            },
            userId: "summer-admin",
            hasSummerAdminPermission: true);

        Assert.True(response.IsSuccess);
        Assert.NotNull(response.Data);
        Assert.Equal(SummerWorkflowDomainConstants.MembershipTypes.NonWorker, response.Data!.MembershipType);
        Assert.Equal(1000m, response.Data.AppliedInsuranceAmount);
    }

    [Fact]
    public async Task GetPricingQuoteAsync_ManagedCategoryUser_CanSelectNonWorkerMembership_WhenClaimFlagUnavailable()
    {
        await using var connectContext = CreateConnectContext();
        await using var gpaContext = CreateGpaContext();

        SeedSummerDestinationCatalog(connectContext);
        SeedSummerPricingCatalog(connectContext);
        SeedCategory(connectContext, categoryId: 147, stockholder: 101);
        SeedActiveUserPosition(gpaContext, userId: "summer-manager", unitId: 101);
        await connectContext.SaveChangesAsync();
        await gpaContext.SaveChangesAsync();

        var service = CreateService(connectContext, gpaContext);
        var response = await service.GetPricingQuoteAsync(
            new SummerPricingQuoteRequest
            {
                CategoryId = 147,
                SeasonYear = SummerWorkflowDomainConstants.DefaultSeasonYear,
                PeriodKey = "JUN_SEP",
                PersonsCount = 2,
                StayMode = SummerWorkflowDomainConstants.StayModes.ResidenceWithTransport,
                MembershipType = SummerWorkflowDomainConstants.MembershipTypes.NonWorker
            },
            userId: "summer-manager",
            hasSummerAdminPermission: false);

        Assert.True(response.IsSuccess);
        Assert.NotNull(response.Data);
        Assert.Equal(SummerWorkflowDomainConstants.MembershipTypes.NonWorker, response.Data!.MembershipType);
        Assert.Equal(1000m, response.Data.AppliedInsuranceAmount);
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
            .UseInMemoryDatabase($"summer-pricing-auth-tests-{Guid.NewGuid():N}")
            .ConfigureWarnings(builder => builder.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;

        return new ConnectContext(options, new HttpContextAccessor());
    }

    private static GPAContext CreateGpaContext()
    {
        var options = new DbContextOptionsBuilder<GPAContext>()
            .UseInMemoryDatabase($"summer-pricing-auth-gpa-tests-{Guid.NewGuid():N}")
            .Options;

        return new GPAContext(options);
    }

    private static void SeedCategory(ConnectContext context, int categoryId, int stockholder)
    {
        context.Cdcategories.Add(new Cdcategory
        {
            CatId = categoryId,
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
            CdmendSql = 925001,
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

    private static void SeedSummerPricingCatalog(ConnectContext context)
    {
        var payload = @"{
  ""seasonYear"": 2026,
  ""pricingRecords"": [
    {
      ""pricingConfigId"": ""SUM2026-MATROUH-JUN-SEP"",
      ""categoryId"": 147,
      ""seasonYear"": 2026,
      ""periodKey"": ""JUN_SEP"",
      ""accommodationPricePerPerson"": 700,
      ""transportationPricePerPerson"": 200,
      ""pricingMode"": ""AccommodationAndTransportationOptional"",
      ""transportationMandatory"": false,
      ""isActive"": true
    }
  ]
}";

        context.Cdmends.Add(new Cdmend
        {
            CdmendSql = 925002,
            CdmendType = "Textarea",
            CdmendTxt = SummerWorkflowDomainConstants.PricingCatalogMend,
            CDMendLbl = "Pricing Catalog",
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
            StartDate = DateTime.Today.AddDays(-1),
            EndDate = DateTime.Today.AddDays(1),
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
