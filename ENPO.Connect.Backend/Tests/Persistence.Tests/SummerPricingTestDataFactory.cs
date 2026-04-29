using System.Text.Json;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Models.Correspondance;
using Models.DTO.Correspondance.Summer;
using Persistence.Data;
using Persistence.Services.Summer;

namespace Persistence.Tests;

internal static class SummerPricingTestDataFactory
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping
    };

    public static ConnectContext CreateContext(string prefix = "summer-pricing-regression")
    {
        var options = new DbContextOptionsBuilder<ConnectContext>()
            .UseInMemoryDatabase($"{prefix}-{Guid.NewGuid():N}")
            .Options;

        return new ConnectContext(options, new HttpContextAccessor());
    }

    public static void SeedCatalog(
        ConnectContext context,
        IEnumerable<SummerPricingCatalogRecordDto> records,
        int seasonYear = SummerWorkflowDomainConstants.DefaultSeasonYear)
    {
        var payload = JsonSerializer.Serialize(
            new
            {
                seasonYear,
                pricingRecords = records
            },
            JsonOptions);

        context.Cdmends.Add(new Cdmend
        {
            CdmendSql = 1,
            CdmendType = "Textarea",
            CdmendTxt = SummerWorkflowDomainConstants.PricingCatalogMend,
            CDMendLbl = "Summer Pricing Catalog",
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

    public static SummerPricingCatalogRecordDto BuildRecord(
        int categoryId,
        string pricingConfigId,
        string periodKey,
        string dateFrom,
        string dateTo,
        decimal accommodationPricePerPerson,
        decimal transportationPricePerPerson,
        decimal insuranceAmount = 0m,
        decimal? proxyInsuranceAmount = null,
        string pricingMode = SummerWorkflowDomainConstants.PricingModes.AccommodationAndTransportationOptional,
        bool transportationMandatory = false,
        bool isActive = true,
        int seasonYear = SummerWorkflowDomainConstants.DefaultSeasonYear,
        string waveCode = "",
        string displayLabel = "",
        string notes = "")
    {
        return new SummerPricingCatalogRecordDto
        {
            PricingConfigId = pricingConfigId,
            CategoryId = categoryId,
            SeasonYear = seasonYear,
            WaveCode = waveCode,
            PeriodKey = periodKey,
            DateFrom = dateFrom,
            DateTo = dateTo,
            AccommodationPricePerPerson = accommodationPricePerPerson,
            TransportationPricePerPerson = transportationPricePerPerson,
            InsuranceAmount = insuranceAmount,
            ProxyInsuranceAmount = proxyInsuranceAmount,
            PricingMode = pricingMode,
            TransportationMandatory = transportationMandatory,
            IsActive = isActive,
            DisplayLabel = displayLabel,
            Notes = notes
        };
    }

    public static SummerPricingQuoteRequest BuildQuote(
        int categoryId,
        string waveCode,
        string waveLabel,
        int familyCount,
        int extraCount = 0,
        string stayMode = SummerWorkflowDomainConstants.StayModes.ResidenceOnly,
        bool isProxyBooking = false,
        string membershipType = SummerWorkflowDomainConstants.MembershipTypes.Worker,
        int seasonYear = SummerWorkflowDomainConstants.DefaultSeasonYear,
        string destinationName = "")
    {
        return new SummerPricingQuoteRequest
        {
            CategoryId = categoryId,
            SeasonYear = seasonYear,
            WaveCode = waveCode,
            WaveLabel = waveLabel,
            FamilyCount = familyCount,
            ExtraCount = extraCount,
            StayMode = stayMode,
            IsProxyBooking = isProxyBooking,
            MembershipType = membershipType,
            DestinationName = destinationName
        };
    }
}
