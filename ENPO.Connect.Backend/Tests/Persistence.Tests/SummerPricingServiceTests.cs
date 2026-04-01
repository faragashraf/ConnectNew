using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
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

    [Fact]
    public async Task Quote_AppliesBaseInsurance_ForNormalBooking()
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
                    PricingConfigId = "SUM2026-INSURANCE-NORMAL",
                    CategoryId = 147,
                    SeasonYear = 2026,
                    PeriodKey = "JUN_SEP",
                    AccommodationPricePerPerson = 700m,
                    TransportationPricePerPerson = 610m,
                    InsuranceAmount = 120m,
                    ProxyInsuranceAmount = 180m,
                    PricingMode = SummerWorkflowDomainConstants.PricingModes.AccommodationAndTransportationOptional,
                    TransportationMandatory = false,
                    IsActive = true
                }
            }
        });

        Assert.True(saveResponse.IsSuccess);

        var quoteResponse = await service.GetQuoteAsync(new SummerPricingQuoteRequest
        {
            CategoryId = 147,
            SeasonYear = 2026,
            PeriodKey = "JUN_SEP",
            PersonsCount = 2,
            StayMode = "RESIDENCE_WITH_TRANSPORT",
            IsProxyBooking = false
        });

        Assert.True(quoteResponse.IsSuccess);
        Assert.NotNull(quoteResponse.Data);
        Assert.Equal(120m, quoteResponse.Data.InsuranceAmount);
        Assert.Equal(180m, quoteResponse.Data.ProxyInsuranceAmount);
        Assert.Equal(120m, quoteResponse.Data.AppliedInsuranceAmount);
        Assert.Equal(2740m, quoteResponse.Data.GrandTotal);
    }

    [Fact]
    public async Task Quote_AppliesProxyInsurance_WhenProxyBooking()
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
                    PricingConfigId = "SUM2026-INSURANCE-PROXY",
                    CategoryId = 147,
                    SeasonYear = 2026,
                    PeriodKey = "JUN_SEP",
                    AccommodationPricePerPerson = 700m,
                    TransportationPricePerPerson = 610m,
                    InsuranceAmount = 120m,
                    ProxyInsuranceAmount = 180m,
                    PricingMode = SummerWorkflowDomainConstants.PricingModes.AccommodationAndTransportationOptional,
                    TransportationMandatory = false,
                    IsActive = true
                }
            }
        });

        Assert.True(saveResponse.IsSuccess);

        var quoteResponse = await service.GetQuoteAsync(new SummerPricingQuoteRequest
        {
            CategoryId = 147,
            SeasonYear = 2026,
            PeriodKey = "JUN_SEP",
            PersonsCount = 2,
            StayMode = "RESIDENCE_WITH_TRANSPORT",
            IsProxyBooking = true
        });

        Assert.True(quoteResponse.IsSuccess);
        Assert.NotNull(quoteResponse.Data);
        Assert.Equal(180m, quoteResponse.Data.AppliedInsuranceAmount);
        Assert.Equal(2800m, quoteResponse.Data.GrandTotal);
    }

    [Fact]
    public async Task SaveCatalog_PersistsInsuranceAmountsInMetadataPayload_AndGetCatalogReturnsThem()
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
                    PricingConfigId = "SUM2026-MATROUH-UPDATED",
                    CategoryId = 147,
                    SeasonYear = 2026,
                    PeriodKey = "JUN_SEP",
                    AccommodationPricePerPerson = 700m,
                    TransportationPricePerPerson = 600m,
                    InsuranceAmount = 333m,
                    ProxyInsuranceAmount = 444m,
                    PricingMode = SummerWorkflowDomainConstants.PricingModes.AccommodationAndTransportationOptional,
                    TransportationMandatory = false,
                    IsActive = true
                }
            }
        });

        Assert.True(saveResponse.IsSuccess);

        var metadataRow = await context.Cdmends
            .AsNoTracking()
            .Where(item => item.ApplicationId == SummerWorkflowDomainConstants.DynamicApplicationId
                           && item.CdmendTxt == SummerWorkflowDomainConstants.PricingCatalogMend)
            .FirstAsync();

        Assert.False(string.IsNullOrWhiteSpace(metadataRow.CdmendTbl));
        using (var catalogDoc = JsonDocument.Parse(metadataRow.CdmendTbl!))
        {
            var persistedRecord = catalogDoc.RootElement.GetProperty("pricingRecords")[0];
            Assert.Equal(333m, persistedRecord.GetProperty("insuranceAmount").GetDecimal());
            Assert.Equal(444m, persistedRecord.GetProperty("proxyInsuranceAmount").GetDecimal());
        }

        var getCatalogResponse = await service.GetCatalogAsync(2026);
        Assert.True(getCatalogResponse.IsSuccess);
        Assert.NotNull(getCatalogResponse.Data);
        var savedRecord = Assert.Single(getCatalogResponse.Data.Records);
        Assert.Equal(333m, savedRecord.InsuranceAmount);
        Assert.Equal(444m, savedRecord.ProxyInsuranceAmount);
    }

    [Fact]
    public async Task SaveCatalog_WhenUpdatingExistingRecord_PersistsInsuranceAmounts()
    {
        await using var context = CreateContext();
        SeedDefaultCatalog(context);
        var service = new SummerPricingService(context);

        var initialCatalogResponse = await service.GetCatalogAsync(2026);
        Assert.True(initialCatalogResponse.IsSuccess);
        Assert.NotNull(initialCatalogResponse.Data);
        Assert.NotEmpty(initialCatalogResponse.Data.Records);

        var recordsToSave = initialCatalogResponse.Data.Records
            .Select(item => new SummerPricingCatalogRecordDto
            {
                PricingConfigId = item.PricingConfigId,
                CategoryId = item.CategoryId,
                SeasonYear = item.SeasonYear,
                WaveCode = item.WaveCode,
                PeriodKey = item.PeriodKey,
                DateFrom = item.DateFrom,
                DateTo = item.DateTo,
                AccommodationPricePerPerson = item.AccommodationPricePerPerson,
                TransportationPricePerPerson = item.TransportationPricePerPerson,
                InsuranceAmount = item.InsuranceAmount,
                ProxyInsuranceAmount = item.ProxyInsuranceAmount,
                PricingMode = item.PricingMode,
                TransportationMandatory = item.TransportationMandatory,
                IsActive = item.IsActive,
                DisplayLabel = item.DisplayLabel,
                Notes = item.Notes
            })
            .ToList();

        var targetRecord = recordsToSave
            .First(item => item.CategoryId == 147 && item.PeriodKey == "JUN_SEP");
        targetRecord.InsuranceAmount = 555m;
        targetRecord.ProxyInsuranceAmount = 666m;

        var saveResponse = await service.SaveCatalogAsync(new SummerPricingCatalogUpsertRequest
        {
            SeasonYear = 2026,
            Records = recordsToSave
        });

        Assert.True(saveResponse.IsSuccess);

        var refreshedCatalogResponse = await service.GetCatalogAsync(2026);
        Assert.True(refreshedCatalogResponse.IsSuccess);
        Assert.NotNull(refreshedCatalogResponse.Data);

        var updatedRecord = refreshedCatalogResponse.Data.Records
            .Single(item => item.PricingConfigId == targetRecord.PricingConfigId);
        Assert.Equal(555m, updatedRecord.InsuranceAmount);
        Assert.Equal(666m, updatedRecord.ProxyInsuranceAmount);
    }

    [Fact]
    public async Task SaveCatalog_AcceptsLegacyPricingRecordsPayload_AndPersistsInsurance()
    {
        await using var context = CreateContext();
        SeedDefaultCatalog(context);
        var service = new SummerPricingService(context);

        const string legacyPayload = @"
{
  ""seasonYear"": 2026,
  ""pricingRecords"": [
    {
      ""pricingConfigId"": ""SUM2026-MATROUH-JUN-SEP"",
      ""categoryId"": 147,
      ""seasonYear"": 2026,
      ""waveCode"": """",
      ""periodKey"": ""JUN_SEP"",
      ""accommodationPricePerPerson"": 5000,
      ""transportationPricePerPerson"": 600,
      ""insuranceAmount"": 175,
      ""proxyInsuranceAmount"": 225,
      ""pricingMode"": ""AccommodationAndTransportationOptional"",
      ""transportationMandatory"": false,
      ""isActive"": true,
      ""displayLabel"": ""مرسى مطروح يونيو/سبتمبر"",
      ""notes"": ""سعر استرشادي""
    }
  ]
}";

        var request = JsonSerializer.Deserialize<SummerPricingCatalogUpsertRequest>(
            legacyPayload,
            new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });

        Assert.NotNull(request);
        Assert.Empty(request!.Records);
        Assert.NotNull(request.PricingRecords);
        Assert.Single(request.PricingRecords);

        var saveResponse = await service.SaveCatalogAsync(request);
        Assert.True(saveResponse.IsSuccess);

        var getCatalogResponse = await service.GetCatalogAsync(2026);
        Assert.True(getCatalogResponse.IsSuccess);
        Assert.NotNull(getCatalogResponse.Data);
        var savedRecord = Assert.Single(getCatalogResponse.Data.Records);
        Assert.Equal(175m, savedRecord.InsuranceAmount);
        Assert.Equal(225m, savedRecord.ProxyInsuranceAmount);
    }

    [Fact]
    public async Task SaveCatalog_LegacyPayloadWithoutInsuranceFields_DefaultsInsuranceToZero()
    {
        await using var context = CreateContext();
        SeedDefaultCatalog(context);
        var service = new SummerPricingService(context);

        const string legacyPayloadWithoutInsurance = @"
{
  ""seasonYear"": 2026,
  ""pricingRecords"": [
    {
      ""pricingConfigId"": ""SUM2026-MATROUH-JUN-SEP"",
      ""categoryId"": 147,
      ""seasonYear"": 2026,
      ""waveCode"": """",
      ""periodKey"": ""JUN_SEP"",
      ""accommodationPricePerPerson"": 5000,
      ""transportationPricePerPerson"": 600,
      ""pricingMode"": ""AccommodationAndTransportationOptional"",
      ""transportationMandatory"": false,
      ""isActive"": true,
      ""displayLabel"": ""مرسى مطروح يونيو/سبتمبر"",
      ""notes"": ""سعر استرشادي""
    }
  ]
}";

        var request = JsonSerializer.Deserialize<SummerPricingCatalogUpsertRequest>(
            legacyPayloadWithoutInsurance,
            new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });

        Assert.NotNull(request);

        var saveResponse = await service.SaveCatalogAsync(request!);
        Assert.True(saveResponse.IsSuccess);

        var getCatalogResponse = await service.GetCatalogAsync(2026);
        Assert.True(getCatalogResponse.IsSuccess);
        Assert.NotNull(getCatalogResponse.Data);
        var savedRecord = Assert.Single(getCatalogResponse.Data.Records);
        Assert.Equal(0m, savedRecord.InsuranceAmount);
        Assert.Null(savedRecord.ProxyInsuranceAmount);
    }

    [Fact]
    public async Task GetCatalog_SerializedResponse_IncludesInsuranceFields()
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
                    PricingConfigId = "SUM2026-MATROUH-JUN-SEP",
                    CategoryId = 147,
                    SeasonYear = 2026,
                    PeriodKey = "JUN_SEP",
                    AccommodationPricePerPerson = 5000m,
                    TransportationPricePerPerson = 600m,
                    InsuranceAmount = 1500m,
                    ProxyInsuranceAmount = null,
                    PricingMode = SummerWorkflowDomainConstants.PricingModes.AccommodationAndTransportationOptional,
                    TransportationMandatory = false,
                    IsActive = true,
                    DisplayLabel = "مرسى مطروح يونيو/سبتمبر",
                    Notes = "سعر استرشادي قابل للتعديل بعد اعتماد اللجنة"
                }
            }
        });

        Assert.True(saveResponse.IsSuccess);

        var getCatalogResponse = await service.GetCatalogAsync(2026);
        Assert.True(getCatalogResponse.IsSuccess);
        Assert.NotNull(getCatalogResponse.Data);

        var serialized = JsonSerializer.Serialize(
            getCatalogResponse.Data,
            new JsonSerializerOptions(JsonSerializerDefaults.Web));

        Assert.Contains("\"insuranceAmount\":1500", serialized);
        Assert.Contains("\"proxyInsuranceAmount\":null", serialized);
    }

    [Fact]
    public async Task GetCatalog_WhenMetadataUsesRecordsKey_LoadsInsuranceFieldsCorrectly()
    {
        await using var context = CreateContext();
        context.Cdmends.Add(new Cdmend
        {
            CdmendSql = 100,
            CdmendType = "Textarea",
            CdmendTxt = SummerWorkflowDomainConstants.PricingCatalogMend,
            CDMendLbl = "إعدادات تسعير المصايف",
            Placeholder = string.Empty,
            DefaultValue = string.Empty,
            CdmendTbl = @"
{
  ""seasonYear"": 2026,
  ""records"": [
    {
      ""pricingConfigId"": ""SUM2026-MATROUH-JUN-SEP"",
      ""categoryId"": 147,
      ""seasonYear"": 2026,
      ""waveCode"": """",
      ""periodKey"": ""JUN_SEP"",
      ""dateFrom"": null,
      ""dateTo"": null,
      ""accommodationPricePerPerson"": 5000,
      ""transportationPricePerPerson"": 600,
      ""insuranceAmount"": 175,
      ""proxyInsuranceAmount"": 225,
      ""pricingMode"": ""AccommodationAndTransportationOptional"",
      ""transportationMandatory"": false,
      ""isActive"": true,
      ""displayLabel"": ""مرسى مطروح يونيو/سبتمبر"",
      ""notes"": ""سعر استرشادي قابل للتعديل بعد اعتماد اللجنة""
    }
  ]
}",
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
        await context.SaveChangesAsync();

        var service = new SummerPricingService(context);
        var response = await service.GetCatalogAsync(2026);

        Assert.True(response.IsSuccess);
        Assert.NotNull(response.Data);
        var record = Assert.Single(response.Data.Records);
        Assert.Equal(175m, record.InsuranceAmount);
        Assert.Equal(225m, record.ProxyInsuranceAmount);
    }

    [Fact]
    public async Task SaveCatalog_WhenExistingMetadataUsesRecordsKey_ConvertsAndPersistsInsurance()
    {
        await using var context = CreateContext();

        context.Cdmends.Add(new Cdmend
        {
            CdmendSql = 20,
            CdmendType = "Textarea",
            CdmendTxt = SummerWorkflowDomainConstants.PricingCatalogMend,
            CDMendLbl = "إعدادات تسعير المصايف",
            Placeholder = string.Empty,
            DefaultValue = string.Empty,
            CdmendTbl = @"
{
  ""seasonYear"": 2026,
  ""records"": [
    {
      ""pricingConfigId"": ""SUM2026-LEGACY"",
      ""categoryId"": 147,
      ""seasonYear"": 2026,
      ""periodKey"": ""JUN_SEP"",
      ""accommodationPricePerPerson"": 1000,
      ""transportationPricePerPerson"": 100,
      ""insuranceAmount"": 10,
      ""proxyInsuranceAmount"": 20,
      ""pricingMode"": ""AccommodationAndTransportationOptional"",
      ""transportationMandatory"": false,
      ""isActive"": true
    }
  ]
}",
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
        await context.SaveChangesAsync();
        var service = new SummerPricingService(context);

        var saveResponse = await service.SaveCatalogAsync(new SummerPricingCatalogUpsertRequest
        {
            SeasonYear = 2026,
            Records = new List<SummerPricingCatalogRecordDto>
            {
                new()
                {
                    PricingConfigId = "SUM2026-UPDATED",
                    CategoryId = 147,
                    SeasonYear = 2026,
                    PeriodKey = "JUN_SEP",
                    AccommodationPricePerPerson = 5000m,
                    TransportationPricePerPerson = 600m,
                    InsuranceAmount = 777m,
                    ProxyInsuranceAmount = 888m,
                    PricingMode = SummerWorkflowDomainConstants.PricingModes.AccommodationAndTransportationOptional,
                    TransportationMandatory = false,
                    IsActive = true
                }
            }
        });

        Assert.True(saveResponse.IsSuccess);

        var row = await context.Cdmends
            .AsNoTracking()
            .Where(item => item.ApplicationId == SummerWorkflowDomainConstants.DynamicApplicationId
                           && item.CdmendTxt == SummerWorkflowDomainConstants.PricingCatalogMend)
            .SingleAsync();

        using (var rowDoc = JsonDocument.Parse(row.CdmendTbl!))
        {
            Assert.True(rowDoc.RootElement.TryGetProperty("pricingRecords", out var pricingRecords));
            var latestInsurance = pricingRecords[0].GetProperty("insuranceAmount").GetDecimal();
            var latestProxyInsurance = pricingRecords[0].GetProperty("proxyInsuranceAmount").GetDecimal();
            Assert.Equal(777m, latestInsurance);
            Assert.Equal(888m, latestProxyInsurance);
        }

        var getCatalogResponse = await service.GetCatalogAsync(2026);
        Assert.True(getCatalogResponse.IsSuccess);
        Assert.NotNull(getCatalogResponse.Data);
        var savedRecord = Assert.Single(getCatalogResponse.Data.Records);
        Assert.Equal(777m, savedRecord.InsuranceAmount);
        Assert.Equal(888m, savedRecord.ProxyInsuranceAmount);
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
