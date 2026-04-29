using Models.DTO.Correspondance.Summer;
using Persistence.Services.Summer;
using Xunit;

namespace Persistence.Tests;

public class SummerPricingServiceRegressionTests
{
    public static IEnumerable<object[]> QuoteMatrixCases()
    {
        yield return new object[]
        {
            147, "W01", "الفوج الأول - الخميس 4/6/2026", 4, 0,
            SummerWorkflowDomainConstants.StayModes.ResidenceOnly, false,
            "SUM2026-MATROUH-JUN", 3300m, "JUN_SEP", SummerWorkflowDomainConstants.StayModes.ResidenceOnly
        };

        yield return new object[]
        {
            147, "W08", "الفوج الثامن - الخميس 23/7/2026", 4, 0,
            SummerWorkflowDomainConstants.StayModes.ResidenceWithTransport, false,
            "SUM2026-MATROUH-JULAUG", 4500m, "JUL_AUG", SummerWorkflowDomainConstants.StayModes.ResidenceWithTransport
        };

        yield return new object[]
        {
            148, "W14", "الفوج الرابع عشر - الأحد 6/9/2026", 2, 0,
            SummerWorkflowDomainConstants.StayModes.ResidenceOnly, false,
            "SUM2026-RASELBAR-SEP-LEGACY", 2400m, "JUN_SEP", SummerWorkflowDomainConstants.StayModes.ResidenceWithTransport
        };

        yield return new object[]
        {
            148, "W14", "الفوج الرابع عشر - الأحد 6/9/2026", 2, 0,
            SummerWorkflowDomainConstants.StayModes.ResidenceOnly, true,
            "SUM2026-RASELBAR-SEP-LEGACY", 2400m, "JUN_SEP", SummerWorkflowDomainConstants.StayModes.ResidenceWithTransport
        };

        yield return new object[]
        {
            149, "W14", "الفوج الرابع عشر - الأحد 6/9/2026", 3, 0,
            SummerWorkflowDomainConstants.StayModes.ResidenceWithTransport, false,
            "SUM2026-PORTFOUAD-SEP-LEGACY", 3620m, "JUN_SEP", SummerWorkflowDomainConstants.StayModes.ResidenceWithTransport
        };

        yield return new object[]
        {
            149, "W01", "الفوج الأول - الأحد 7/6/2026", 2, 0,
            SummerWorkflowDomainConstants.StayModes.ResidenceOnly, false,
            "SUM2026-PORTFOUAD-JUN", 1780m, "JUN_SEP", SummerWorkflowDomainConstants.StayModes.ResidenceOnly
        };
    }

    [Theory]
    [MemberData(nameof(QuoteMatrixCases))]
    public async Task Quote_MatrixCoverage_AppliesExpectedRuleAndTotals(
        int categoryId,
        string waveCode,
        string waveLabel,
        int familyCount,
        int extraCount,
        string stayMode,
        bool isProxyBooking,
        string expectedPricingConfigId,
        decimal expectedGrandTotal,
        string expectedPeriodKey,
        string expectedNormalizedStayMode)
    {
        await using var context = SummerPricingTestDataFactory.CreateContext();
        SummerPricingTestDataFactory.SeedCatalog(context, BuildBaselineCatalogRecords());
        var service = new SummerPricingService(context);

        var quoteResponse = await service.GetQuoteAsync(SummerPricingTestDataFactory.BuildQuote(
            categoryId: categoryId,
            waveCode: waveCode,
            waveLabel: waveLabel,
            familyCount: familyCount,
            extraCount: extraCount,
            stayMode: stayMode,
            isProxyBooking: isProxyBooking));

        Assert.True(quoteResponse.IsSuccess);
        Assert.NotNull(quoteResponse.Data);
        Assert.Equal(expectedPricingConfigId, quoteResponse.Data!.PricingConfigId);
        Assert.Equal(expectedPeriodKey, quoteResponse.Data.PeriodKey);
        Assert.Equal(expectedGrandTotal, quoteResponse.Data.GrandTotal);
        Assert.Equal(expectedNormalizedStayMode, quoteResponse.Data.NormalizedStayMode);
    }

    [Fact]
    public async Task Quote_RasElBar_September_LegacyPeriodMismatch_DoesNotReturnMissingPricing()
    {
        await using var context = SummerPricingTestDataFactory.CreateContext();
        SummerPricingTestDataFactory.SeedCatalog(context, BuildBaselineCatalogRecords());
        var service = new SummerPricingService(context);

        var quoteResponse = await service.GetQuoteAsync(SummerPricingTestDataFactory.BuildQuote(
            categoryId: 148,
            waveCode: "W14",
            waveLabel: "الفوج الرابع عشر - الأحد 6/9/2026",
            familyCount: 2,
            stayMode: SummerWorkflowDomainConstants.StayModes.ResidenceOnly));

        Assert.True(quoteResponse.IsSuccess);
        Assert.NotNull(quoteResponse.Data);
        Assert.Equal("SUM2026-RASELBAR-SEP-LEGACY", quoteResponse.Data!.PricingConfigId);
        Assert.Equal("JUN_SEP", quoteResponse.Data.PeriodKey);
        Assert.DoesNotContain("لا يوجد تسعير", quoteResponse.Data.DisplayText);
    }

    [Fact]
    public async Task SaveCatalog_AutoCorrects_PeriodKey_FromDateRange()
    {
        await using var context = SummerPricingTestDataFactory.CreateContext();
        var service = new SummerPricingService(context);

        var saveResponse = await service.SaveCatalogAsync(new SummerPricingCatalogUpsertRequest
        {
            SeasonYear = 2026,
            Records = new List<SummerPricingCatalogRecordDto>
            {
                SummerPricingTestDataFactory.BuildRecord(
                    categoryId: 148,
                    pricingConfigId: "SUM2026-RASELBAR-JUN",
                    periodKey: "JUN_SEP",
                    dateFrom: "2026-06-01",
                    dateTo: "2026-06-30",
                    accommodationPricePerPerson: 900m,
                    transportationPricePerPerson: 0m,
                    insuranceAmount: 200m,
                    pricingMode: SummerWorkflowDomainConstants.PricingModes.TransportationMandatoryIncluded,
                    transportationMandatory: true),
                SummerPricingTestDataFactory.BuildRecord(
                    categoryId: 148,
                    pricingConfigId: "SUM2026-RASELBAR-SEP-LEGACY",
                    periodKey: "JUL_AUG",
                    dateFrom: "2026-09-01",
                    dateTo: "2026-09-30",
                    accommodationPricePerPerson: 950m,
                    transportationPricePerPerson: 0m,
                    insuranceAmount: 200m,
                    pricingMode: SummerWorkflowDomainConstants.PricingModes.TransportationMandatoryIncluded,
                    transportationMandatory: true),
                SummerPricingTestDataFactory.BuildRecord(
                    categoryId: 148,
                    pricingConfigId: "SUM2026-RASELBAR-JULAUG",
                    periodKey: "JUL_AUG",
                    dateFrom: "2026-07-01",
                    dateTo: "2026-08-31",
                    accommodationPricePerPerson: 930m,
                    transportationPricePerPerson: 0m,
                    insuranceAmount: 200m,
                    pricingMode: SummerWorkflowDomainConstants.PricingModes.TransportationMandatoryIncluded,
                    transportationMandatory: true)
            }
        });

        Assert.True(saveResponse.IsSuccess);
        Assert.NotNull(saveResponse.Data);

        var septemberRow = saveResponse.Data!.Records.Single(item =>
            item.CategoryId == 148
            && item.DateFrom == "2026-09-01"
            && item.DateTo == "2026-09-30");
        Assert.Equal("JUN_SEP", septemberRow.PeriodKey);
    }

    [Fact]
    public async Task SaveCatalog_WhenActiveDateRangesOverlap_RejectsPayload()
    {
        await using var context = SummerPricingTestDataFactory.CreateContext();
        var service = new SummerPricingService(context);

        var saveResponse = await service.SaveCatalogAsync(new SummerPricingCatalogUpsertRequest
        {
            SeasonYear = 2026,
            Records = new List<SummerPricingCatalogRecordDto>
            {
                SummerPricingTestDataFactory.BuildRecord(
                    categoryId: 147,
                    pricingConfigId: "SUM2026-MATROUH-R1",
                    periodKey: "JUN_SEP",
                    dateFrom: "2026-06-01",
                    dateTo: "2026-06-30",
                    accommodationPricePerPerson: 700m,
                    transportationPricePerPerson: 200m),
                SummerPricingTestDataFactory.BuildRecord(
                    categoryId: 147,
                    pricingConfigId: "SUM2026-MATROUH-R2",
                    periodKey: "JUN_SEP",
                    dateFrom: "2026-06-15",
                    dateTo: "2026-07-15",
                    accommodationPricePerPerson: 710m,
                    transportationPricePerPerson: 200m)
            }
        });

        Assert.False(saveResponse.IsSuccess);
        Assert.Contains(saveResponse.Errors, error => error.Message.Contains("تداخل في نطاقات التاريخ", StringComparison.Ordinal));
    }

    [Fact]
    public async Task Quote_WhenCategoryPricingIsInactive_ReturnsDisabledPricingMessage()
    {
        await using var context = SummerPricingTestDataFactory.CreateContext();
        SummerPricingTestDataFactory.SeedCatalog(context, new[]
        {
            SummerPricingTestDataFactory.BuildRecord(
                categoryId: 148,
                pricingConfigId: "SUM2026-RASELBAR-INACTIVE",
                periodKey: "JUN_SEP",
                dateFrom: "2026-06-01",
                dateTo: "2026-09-30",
                accommodationPricePerPerson: 900m,
                transportationPricePerPerson: 0m,
                pricingMode: SummerWorkflowDomainConstants.PricingModes.TransportationMandatoryIncluded,
                transportationMandatory: true,
                isActive: false)
        });

        var service = new SummerPricingService(context);
        var quoteResponse = await service.GetQuoteAsync(SummerPricingTestDataFactory.BuildQuote(
            categoryId: 148,
            waveCode: "W14",
            waveLabel: "الفوج الرابع عشر - الأحد 6/9/2026",
            familyCount: 2));

        Assert.False(quoteResponse.IsSuccess);
        Assert.Contains(quoteResponse.Errors, error => error.Message.Contains("غير مفعل", StringComparison.Ordinal));
    }

    [Fact]
    public async Task Quote_WhenWaveDateIsMissing_ForDateScopedRules_ReturnsIncompleteDataMessage()
    {
        await using var context = SummerPricingTestDataFactory.CreateContext();
        SummerPricingTestDataFactory.SeedCatalog(context, new[]
        {
            SummerPricingTestDataFactory.BuildRecord(
                categoryId: 147,
                pricingConfigId: "SUM2026-MATROUH-DATE-SCOPED",
                periodKey: "JUN_SEP",
                dateFrom: "2026-06-01",
                dateTo: "2026-09-30",
                accommodationPricePerPerson: 700m,
                transportationPricePerPerson: 200m)
        });

        var service = new SummerPricingService(context);
        var quoteResponse = await service.GetQuoteAsync(new SummerPricingQuoteRequest
        {
            CategoryId = 147,
            SeasonYear = 2026,
            WaveCode = string.Empty,
            WaveLabel = string.Empty,
            FamilyCount = 2,
            ExtraCount = 0,
            StayMode = SummerWorkflowDomainConstants.StayModes.ResidenceOnly
        });

        Assert.False(quoteResponse.IsSuccess);
        Assert.Contains(quoteResponse.Errors, error => error.Message.Contains("البيانات غير مكتملة", StringComparison.Ordinal));
    }

    [Fact]
    public async Task Quote_WhenCategoryHasNoPricingRows_ReturnsNoPricingMessage()
    {
        await using var context = SummerPricingTestDataFactory.CreateContext();
        SummerPricingTestDataFactory.SeedCatalog(context, new[]
        {
            SummerPricingTestDataFactory.BuildRecord(
                categoryId: 147,
                pricingConfigId: "SUM2026-MATROUH",
                periodKey: "JUN_SEP",
                dateFrom: "2026-06-01",
                dateTo: "2026-09-30",
                accommodationPricePerPerson: 700m,
                transportationPricePerPerson: 200m)
        });

        var service = new SummerPricingService(context);
        var quoteResponse = await service.GetQuoteAsync(SummerPricingTestDataFactory.BuildQuote(
            categoryId: 148,
            waveCode: "W14",
            waveLabel: "الفوج الرابع عشر - الأحد 6/9/2026",
            familyCount: 2));

        Assert.False(quoteResponse.IsSuccess);
        Assert.Contains(quoteResponse.Errors, error => error.Message.Contains("لا يوجد تسعير للمصيف", StringComparison.Ordinal));
    }

    private static List<SummerPricingCatalogRecordDto> BuildBaselineCatalogRecords()
    {
        return new List<SummerPricingCatalogRecordDto>
        {
            SummerPricingTestDataFactory.BuildRecord(
                categoryId: 147,
                pricingConfigId: "SUM2026-MATROUH-JUN",
                periodKey: "JUN_SEP",
                dateFrom: "2026-06-01",
                dateTo: "2026-06-30",
                accommodationPricePerPerson: 700m,
                transportationPricePerPerson: 200m,
                insuranceAmount: 100m,
                proxyInsuranceAmount: 150m,
                pricingMode: SummerWorkflowDomainConstants.PricingModes.AccommodationAndTransportationOptional),
            SummerPricingTestDataFactory.BuildRecord(
                categoryId: 147,
                pricingConfigId: "SUM2026-MATROUH-SEP",
                periodKey: "JUN_SEP",
                dateFrom: "2026-09-01",
                dateTo: "2026-09-30",
                accommodationPricePerPerson: 750m,
                transportationPricePerPerson: 200m,
                insuranceAmount: 100m,
                proxyInsuranceAmount: 150m,
                pricingMode: SummerWorkflowDomainConstants.PricingModes.AccommodationAndTransportationOptional),
            SummerPricingTestDataFactory.BuildRecord(
                categoryId: 147,
                pricingConfigId: "SUM2026-MATROUH-JULAUG",
                periodKey: "JUL_AUG",
                dateFrom: "2026-07-01",
                dateTo: "2026-08-31",
                accommodationPricePerPerson: 800m,
                transportationPricePerPerson: 200m,
                insuranceAmount: 100m,
                proxyInsuranceAmount: 150m,
                pricingMode: SummerWorkflowDomainConstants.PricingModes.AccommodationAndTransportationOptional),
            SummerPricingTestDataFactory.BuildRecord(
                categoryId: 148,
                pricingConfigId: "SUM2026-RASELBAR-JUN",
                periodKey: "JUN_SEP",
                dateFrom: "2026-06-01",
                dateTo: "2026-06-30",
                accommodationPricePerPerson: 900m,
                transportationPricePerPerson: 0m,
                insuranceAmount: 200m,
                proxyInsuranceAmount: 300m,
                pricingMode: SummerWorkflowDomainConstants.PricingModes.TransportationMandatoryIncluded,
                transportationMandatory: true),
            SummerPricingTestDataFactory.BuildRecord(
                categoryId: 148,
                pricingConfigId: "SUM2026-RASELBAR-SEP-LEGACY",
                periodKey: "JUL_AUG",
                dateFrom: "2026-09-01",
                dateTo: "2026-09-30",
                accommodationPricePerPerson: 950m,
                transportationPricePerPerson: 0m,
                insuranceAmount: 200m,
                proxyInsuranceAmount: 300m,
                pricingMode: SummerWorkflowDomainConstants.PricingModes.TransportationMandatoryIncluded,
                transportationMandatory: true),
            SummerPricingTestDataFactory.BuildRecord(
                categoryId: 148,
                pricingConfigId: "SUM2026-RASELBAR-JULAUG",
                periodKey: "JUL_AUG",
                dateFrom: "2026-07-01",
                dateTo: "2026-08-31",
                accommodationPricePerPerson: 930m,
                transportationPricePerPerson: 0m,
                insuranceAmount: 200m,
                proxyInsuranceAmount: 300m,
                pricingMode: SummerWorkflowDomainConstants.PricingModes.TransportationMandatoryIncluded,
                transportationMandatory: true),
            SummerPricingTestDataFactory.BuildRecord(
                categoryId: 149,
                pricingConfigId: "SUM2026-PORTFOUAD-JUN",
                periodKey: "JUN_SEP",
                dateFrom: "2026-06-01",
                dateTo: "2026-06-30",
                accommodationPricePerPerson: 640m,
                transportationPricePerPerson: 350m,
                insuranceAmount: 50m,
                pricingMode: SummerWorkflowDomainConstants.PricingModes.AccommodationAndTransportationOptional),
            SummerPricingTestDataFactory.BuildRecord(
                categoryId: 149,
                pricingConfigId: "SUM2026-PORTFOUAD-SEP-LEGACY",
                periodKey: "JUL_AUG",
                dateFrom: "2026-09-01",
                dateTo: "2026-09-30",
                accommodationPricePerPerson: 690m,
                transportationPricePerPerson: 350m,
                insuranceAmount: 50m,
                pricingMode: SummerWorkflowDomainConstants.PricingModes.AccommodationAndTransportationOptional),
            SummerPricingTestDataFactory.BuildRecord(
                categoryId: 149,
                pricingConfigId: "SUM2026-PORTFOUAD-JULAUG",
                periodKey: "JUL_AUG",
                dateFrom: "2026-07-01",
                dateTo: "2026-08-31",
                accommodationPricePerPerson: 710m,
                transportationPricePerPerson: 350m,
                insuranceAmount: 50m,
                pricingMode: SummerWorkflowDomainConstants.PricingModes.AccommodationAndTransportationOptional)
        };
    }
}
