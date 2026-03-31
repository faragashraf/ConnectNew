using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Models.Correspondance;
using Models.DTO.Correspondance.Summer;
using Persistence.Data;
using Persistence.Services.Summer;
using Xunit;

namespace Persistence.Tests;

public class SummerPricingServiceTests
{
    [Fact]
    public async Task Quote_Matrouh_JunSep_AccommodationOnly_IsCalculatedCorrectly()
    {
        await using var context = CreateContext();
        SeedDefaultCatalog(context);
        var service = new SummerPricingService(context);

        var response = await service.GetQuoteAsync(new SummerPricingQuoteRequest
        {
            CategoryId = 147,
            SeasonYear = 2026,
            PeriodKey = "JUN_SEP",
            PersonsCount = 5,
            StayMode = "RESIDENCE_ONLY",
            DestinationName = "مرسى مطروح"
        });

        Assert.True(response.IsSuccess);
        Assert.NotNull(response.Data);
        Assert.Equal(696m, response.Data.AccommodationPricePerPerson);
        Assert.Equal(600m, response.Data.TransportationPricePerPerson);
        Assert.Equal(3480m, response.Data.GrandTotal);
        Assert.Equal(0m, response.Data.TransportationTotal);
        Assert.Equal(SummerWorkflowDomainConstants.StayModes.ResidenceOnly, response.Data.NormalizedStayMode);
        Assert.DoesNotContain("تم اعتماد تسعير الحجز", response.Data.DisplayText);
        Assert.Contains("رقم الحجز: #{bookingNumber}", response.Data.DisplayText);
        Assert.Contains("المرجعي: {referenceNumber}", response.Data.DisplayText);
        Assert.Contains("الوجهة:", response.Data.DisplayText);
        Assert.Contains("تاريخ", response.Data.DisplayText);
        Assert.Contains("الموعد:", response.Data.DisplayText);
        Assert.Contains("نوع الحجز:", response.Data.DisplayText);
        Assert.Contains("عدد الأفراد:", response.Data.DisplayText);
        Assert.Contains("الإجمالي:", response.Data.DisplayText);
        Assert.Contains("يرجى السداد قبل موعد أقصاه", response.Data.DisplayText);
        Assert.Contains("رقم الحجز: #{bookingNumber}", response.Data.SmsText);
        Assert.Contains("يرجى السداد قبل موعد أقصاه", response.Data.SmsText);
    }

    [Fact]
    public async Task Quote_Matrouh_JulAug_AccommodationWithTransport_IsCalculatedCorrectly()
    {
        await using var context = CreateContext();
        SeedDefaultCatalog(context);
        var service = new SummerPricingService(context);

        var response = await service.GetQuoteAsync(new SummerPricingQuoteRequest
        {
            CategoryId = 147,
            SeasonYear = 2026,
            PeriodKey = "JUL_AUG",
            PersonsCount = 6,
            StayMode = "RESIDENCE_WITH_TRANSPORT",
            DestinationName = "مرسى مطروح"
        });

        Assert.True(response.IsSuccess);
        Assert.NotNull(response.Data);
        Assert.Equal(807m, response.Data.AccommodationPricePerPerson);
        Assert.Equal(600m, response.Data.TransportationPricePerPerson);
        Assert.Equal(4842m, response.Data.AccommodationTotal);
        Assert.Equal(3600m, response.Data.TransportationTotal);
        Assert.Equal(8442m, response.Data.GrandTotal);
    }

    [Fact]
    public async Task Quote_PortFouad_WithTransport_IsCalculatedCorrectly()
    {
        await using var context = CreateContext();
        SeedDefaultCatalog(context);
        var service = new SummerPricingService(context);

        var response = await service.GetQuoteAsync(new SummerPricingQuoteRequest
        {
            CategoryId = 149,
            SeasonYear = 2026,
            PeriodKey = "JUN_SEP",
            PersonsCount = 4,
            StayMode = "RESIDENCE_WITH_TRANSPORT",
            DestinationName = "بور فؤاد"
        });

        Assert.True(response.IsSuccess);
        Assert.NotNull(response.Data);
        Assert.Equal(696m, response.Data.AccommodationPricePerPerson);
        Assert.Equal(350m, response.Data.TransportationPricePerPerson);
        Assert.Equal(2784m, response.Data.AccommodationTotal);
        Assert.Equal(1400m, response.Data.TransportationTotal);
        Assert.Equal(4184m, response.Data.GrandTotal);
    }

    [Fact]
    public async Task Quote_RasElBar_TransportMandatoryIncluded_NormalizesStayMode()
    {
        await using var context = CreateContext();
        SeedDefaultCatalog(context);
        var service = new SummerPricingService(context);

        var response = await service.GetQuoteAsync(new SummerPricingQuoteRequest
        {
            CategoryId = 148,
            SeasonYear = 2026,
            PeriodKey = "JUN_SEP",
            PersonsCount = 3,
            StayMode = "RESIDENCE_ONLY",
            DestinationName = "رأس البر"
        });

        Assert.True(response.IsSuccess);
        Assert.NotNull(response.Data);
        Assert.True(response.Data.TransportationMandatory);
        Assert.True(response.Data.StayModeWasNormalized);
        Assert.Equal(SummerWorkflowDomainConstants.StayModes.ResidenceWithTransport, response.Data.NormalizedStayMode);
        Assert.Equal(2088m, response.Data.GrandTotal);
        Assert.Equal(0m, response.Data.TransportationTotal);
    }

    [Fact]
    public async Task Quote_WhenConfigMissing_ReturnsValidationError()
    {
        await using var context = CreateContext();
        SeedDefaultCatalog(context);
        var service = new SummerPricingService(context);

        var response = await service.GetQuoteAsync(new SummerPricingQuoteRequest
        {
            CategoryId = 999,
            SeasonYear = 2026,
            PeriodKey = "JUN_SEP",
            PersonsCount = 2,
            StayMode = "RESIDENCE_ONLY"
        });

        Assert.False(response.IsSuccess);
        Assert.NotEmpty(response.Errors);
    }

    [Fact]
    public async Task SaveCatalog_AllowsAdminEdit_AndQuoteUsesSavedValues()
    {
        await using var context = CreateContext();
        SeedDefaultCatalog(context);
        var service = new SummerPricingService(context);

        var saveResponse = await service.SaveCatalogAsync(new SummerPricingCatalogUpsertRequest
        {
            SeasonYear = 2026,
            Records = new List<SummerPricingCatalogRecordDto>
            {
                new()
                {
                    PricingConfigId = "SUM2026-MATROUH-JUN-SEP-EDITED",
                    CategoryId = 147,
                    SeasonYear = 2026,
                    PeriodKey = "JUN_SEP",
                    AccommodationPricePerPerson = 700m,
                    TransportationPricePerPerson = 610m,
                    PricingMode = SummerWorkflowDomainConstants.PricingModes.AccommodationAndTransportationOptional,
                    TransportationMandatory = false,
                    IsActive = true,
                    DisplayLabel = "مطروح بعد تعديل الإدارة",
                    Notes = "تعديل اختباري"
                }
            }
        });

        Assert.True(saveResponse.IsSuccess);
        Assert.NotNull(saveResponse.Data);
        Assert.Single(saveResponse.Data.Records);
        Assert.Equal(700m, saveResponse.Data.Records[0].AccommodationPricePerPerson);
        Assert.Equal(610m, saveResponse.Data.Records[0].TransportationPricePerPerson);

        var quoteResponse = await service.GetQuoteAsync(new SummerPricingQuoteRequest
        {
            CategoryId = 147,
            SeasonYear = 2026,
            PeriodKey = "JUN_SEP",
            PersonsCount = 2,
            StayMode = "RESIDENCE_WITH_TRANSPORT"
        });

        Assert.True(quoteResponse.IsSuccess);
        Assert.NotNull(quoteResponse.Data);
        Assert.Equal(2620m, quoteResponse.Data.GrandTotal);
    }

    private static ConnectContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<ConnectContext>()
            .UseInMemoryDatabase($"summer-pricing-tests-{Guid.NewGuid():N}")
            .Options;

        return new ConnectContext(options, new HttpContextAccessor());
    }

    private static void SeedDefaultCatalog(ConnectContext context)
    {
        var payload = @"
{
  ""seasonYear"": 2026,
  ""pricingRecords"": [
    {
      ""pricingConfigId"": ""SUM2026-MATROUH-JUN-SEP"",
      ""categoryId"": 147,
      ""seasonYear"": 2026,
      ""periodKey"": ""JUN_SEP"",
      ""accommodationPricePerPerson"": 696,
      ""transportationPricePerPerson"": 600,
      ""pricingMode"": ""AccommodationAndTransportationOptional"",
      ""transportationMandatory"": false,
      ""isActive"": true
    },
    {
      ""pricingConfigId"": ""SUM2026-MATROUH-JUL-AUG"",
      ""categoryId"": 147,
      ""seasonYear"": 2026,
      ""periodKey"": ""JUL_AUG"",
      ""accommodationPricePerPerson"": 807,
      ""transportationPricePerPerson"": 600,
      ""pricingMode"": ""AccommodationAndTransportationOptional"",
      ""transportationMandatory"": false,
      ""isActive"": true
    },
    {
      ""pricingConfigId"": ""SUM2026-PORTFOUAD-JUN-SEP"",
      ""categoryId"": 149,
      ""seasonYear"": 2026,
      ""periodKey"": ""JUN_SEP"",
      ""accommodationPricePerPerson"": 696,
      ""transportationPricePerPerson"": 350,
      ""pricingMode"": ""AccommodationAndTransportationOptional"",
      ""transportationMandatory"": false,
      ""isActive"": true
    },
    {
      ""pricingConfigId"": ""SUM2026-RASELBAR-JUN-SEP"",
      ""categoryId"": 148,
      ""seasonYear"": 2026,
      ""periodKey"": ""JUN_SEP"",
      ""accommodationPricePerPerson"": 696,
      ""transportationPricePerPerson"": 0,
      ""pricingMode"": ""TransportationMandatoryIncluded"",
      ""transportationMandatory"": true,
      ""isActive"": true
    }
  ]
}";

        context.Cdmends.Add(new Cdmend
        {
            CdmendSql = 1,
            CdmendType = "Textarea",
            CdmendTxt = SummerWorkflowDomainConstants.PricingCatalogMend,
            CDMendLbl = "إعدادات تسعير المصايف",
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

        context.SaveChanges();
    }
}
