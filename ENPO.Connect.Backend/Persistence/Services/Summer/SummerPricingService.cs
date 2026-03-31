using System.Globalization;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Models.DTO.Common;
using Models.DTO.Correspondance.Summer;
using Persistence.Data;

namespace Persistence.Services.Summer
{
    public class SummerPricingService
    {
        private readonly ConnectContext _connectContext;
        private const string SummerDynamicApplicationId = SummerWorkflowDomainConstants.DynamicApplicationId;
        private const string SummerPricingCatalogMend = SummerWorkflowDomainConstants.PricingCatalogMend;
        private static readonly TimeZoneInfo CairoTimeZone = ResolveCairoTimeZone();

        public SummerPricingService(ConnectContext connectContext)
        {
            _connectContext = connectContext;
        }

        public async Task<CommonResponse<SummerPricingQuoteDto>> GetQuoteAsync(
            SummerPricingQuoteRequest request,
            string? applicationId = null,
            CancellationToken cancellationToken = default)
        {
            var response = new CommonResponse<SummerPricingQuoteDto>();
            request ??= new SummerPricingQuoteRequest();

            try
            {
                if (request.CategoryId <= 0)
                {
                    response.Errors.Add(new Error { Code = "400", Message = "المصيف مطلوب لحساب التسعير." });
                    return response;
                }

                var seasonYear = request.SeasonYear > 0
                    ? request.SeasonYear
                    : SummerWorkflowDomainConstants.DefaultSeasonYear;

                var personsCount = ResolvePersonsCount(request);
                if (personsCount <= 0)
                {
                    response.Errors.Add(new Error { Code = "400", Message = "عدد الأفراد مطلوب لحساب التسعير." });
                    return response;
                }

                var pricingRules = await LoadPricingRulesAsync(seasonYear, applicationId, cancellationToken);
                if (pricingRules.Count == 0)
                {
                    response.Errors.Add(new Error
                    {
                        Code = "404",
                        Message = "لا توجد إعدادات تسعير فعّالة لهذا الموسم. يرجى مراجعة إعدادات التسعير."
                    });
                    return response;
                }

                var normalizedWaveCode = NormalizeCodeToken(request.WaveCode);
                var waveDate = ResolveWaveDate(request, seasonYear);
                var requestedPeriodKey = NormalizePeriodKey(request.PeriodKey);
                var effectivePeriodKey = ResolvePeriodKey(requestedPeriodKey, waveDate);

                var selectedRule = SelectBestRule(
                    pricingRules,
                    request.CategoryId,
                    seasonYear,
                    normalizedWaveCode,
                    effectivePeriodKey,
                    waveDate);

                if (selectedRule == null)
                {
                    response.Errors.Add(new Error
                    {
                        Code = "404",
                        Message = "لا يوجد تسعير مفعّل للمصيف/الفوج الحالي. يرجى مراجعة إدارة التسعير."
                    });
                    return response;
                }

                var normalizedPricingMode = NormalizePricingMode(selectedRule.PricingMode);
                if (string.IsNullOrWhiteSpace(normalizedPricingMode))
                {
                    response.Errors.Add(new Error
                    {
                        Code = "400",
                        Message = "وضع التسعير غير صالح في إعدادات التسعير."
                    });
                    return response;
                }

                if (selectedRule.AccommodationPricePerPerson <= 0m)
                {
                    response.Errors.Add(new Error
                    {
                        Code = "400",
                        Message = "سعر الإقامة للفرد غير صالح في إعدادات التسعير."
                    });
                    return response;
                }

                if (selectedRule.TransportationPricePerPerson < 0m)
                {
                    response.Errors.Add(new Error
                    {
                        Code = "400",
                        Message = "سعر الانتقالات للفرد غير صالح في إعدادات التسعير."
                    });
                    return response;
                }

                var requestedStayMode = NormalizeStayMode(request.StayMode);
                if (string.IsNullOrWhiteSpace(requestedStayMode))
                {
                    requestedStayMode = SummerWorkflowDomainConstants.StayModes.ResidenceOnly;
                }

                var normalizedStayMode = requestedStayMode;
                var stayModeWasNormalized = false;
                var transportationMandatory = selectedRule.TransportationMandatory
                    || string.Equals(
                        normalizedPricingMode,
                        SummerWorkflowDomainConstants.PricingModes.TransportationMandatoryIncluded,
                        StringComparison.OrdinalIgnoreCase);

                if (string.Equals(
                    normalizedPricingMode,
                    SummerWorkflowDomainConstants.PricingModes.AccommodationOnlyAllowed,
                    StringComparison.OrdinalIgnoreCase))
                {
                    if (!string.Equals(
                        normalizedStayMode,
                        SummerWorkflowDomainConstants.StayModes.ResidenceOnly,
                        StringComparison.OrdinalIgnoreCase))
                    {
                        normalizedStayMode = SummerWorkflowDomainConstants.StayModes.ResidenceOnly;
                        stayModeWasNormalized = true;
                    }
                }
                else if (transportationMandatory
                    && !string.Equals(
                        normalizedStayMode,
                        SummerWorkflowDomainConstants.StayModes.ResidenceWithTransport,
                        StringComparison.OrdinalIgnoreCase))
                {
                    normalizedStayMode = SummerWorkflowDomainConstants.StayModes.ResidenceWithTransport;
                    stayModeWasNormalized = true;
                }

                if (string.Equals(
                    normalizedPricingMode,
                    SummerWorkflowDomainConstants.PricingModes.TransportationMandatoryIncluded,
                    StringComparison.OrdinalIgnoreCase)
                    && !string.Equals(
                        normalizedStayMode,
                        SummerWorkflowDomainConstants.StayModes.ResidenceWithTransport,
                        StringComparison.OrdinalIgnoreCase))
                {
                    normalizedStayMode = SummerWorkflowDomainConstants.StayModes.ResidenceWithTransport;
                    stayModeWasNormalized = true;
                }

                var insuranceAmount = Math.Max(0m, selectedRule.InsuranceAmount);
                var proxyInsuranceAmount = selectedRule.ProxyInsuranceAmount.HasValue
                    ? Math.Max(0m, selectedRule.ProxyInsuranceAmount.Value)
                    : (decimal?)null;
                var appliedInsuranceAmount = request.IsProxyBooking && proxyInsuranceAmount.HasValue
                    ? proxyInsuranceAmount.Value
                    : insuranceAmount;
                var accommodationTotal = personsCount * selectedRule.AccommodationPricePerPerson;
                var transportationTotal = 0m;

                if (!string.Equals(
                    normalizedPricingMode,
                    SummerWorkflowDomainConstants.PricingModes.TransportationMandatoryIncluded,
                    StringComparison.OrdinalIgnoreCase)
                    && string.Equals(
                        normalizedStayMode,
                        SummerWorkflowDomainConstants.StayModes.ResidenceWithTransport,
                        StringComparison.OrdinalIgnoreCase))
                {
                    transportationTotal = personsCount * selectedRule.TransportationPricePerPerson;
                }

                var grandTotal = accommodationTotal + transportationTotal + appliedInsuranceAmount;

                var destinationName = (request.DestinationName ?? string.Empty).Trim();
                if (destinationName.Length == 0)
                {
                    destinationName = $"المصيف رقم {request.CategoryId}";
                }

                var waveLabel = (request.WaveLabel ?? string.Empty).Trim();
                var waveCodeForDisplay = (request.WaveCode ?? string.Empty).Trim();
                var waveDisplay = waveLabel.Length > 0
                    ? waveLabel
                    : (waveCodeForDisplay.Length > 0 ? waveCodeForDisplay : "-");
                var nextDayDueDateText = ResolveNextDayDueDateText();

                var displayText = BuildDisplayText(
                    destinationName,
                    waveDisplay,
                    personsCount,
                    selectedRule.AccommodationPricePerPerson,
                    selectedRule.TransportationPricePerPerson,
                    accommodationTotal,
                    transportationTotal,
                    appliedInsuranceAmount,
                    grandTotal,
                    normalizedStayMode,
                    normalizedPricingMode,
                    transportationMandatory,
                    nextDayDueDateText);

                var smsText = BuildSmsText(
                    destinationName,
                    waveDisplay,
                    personsCount,
                    selectedRule.AccommodationPricePerPerson,
                    selectedRule.TransportationPricePerPerson,
                    accommodationTotal,
                    transportationTotal,
                    appliedInsuranceAmount,
                    grandTotal,
                    normalizedStayMode,
                    normalizedPricingMode,
                    transportationMandatory,
                    nextDayDueDateText);

                var whatsappText = displayText;
                var rulePeriodKey = selectedRule.PeriodKey;
                var effectiveRulePeriodKey = rulePeriodKey.Length > 0 ? rulePeriodKey : effectivePeriodKey;
                var pricingConfigId = selectedRule.PricingConfigId.Length > 0
                    ? selectedRule.PricingConfigId
                    : $"CAT{request.CategoryId}_{seasonYear}_{(effectiveRulePeriodKey.Length > 0 ? effectiveRulePeriodKey : "DEFAULT")}";

                response.Data = new SummerPricingQuoteDto
                {
                    PricingConfigId = pricingConfigId,
                    CategoryId = request.CategoryId,
                    SeasonYear = seasonYear,
                    WaveCode = waveCodeForDisplay,
                    WaveLabel = waveLabel,
                    PeriodKey = effectiveRulePeriodKey,
                    PricingMode = normalizedPricingMode,
                    TransportationMandatory = transportationMandatory,
                    PersonsCount = personsCount,
                    AccommodationPricePerPerson = selectedRule.AccommodationPricePerPerson,
                    TransportationPricePerPerson = selectedRule.TransportationPricePerPerson,
                    SelectedStayMode = requestedStayMode,
                    NormalizedStayMode = normalizedStayMode,
                    StayModeWasNormalized = stayModeWasNormalized,
                    AccommodationTotal = accommodationTotal,
                    TransportationTotal = transportationTotal,
                    InsuranceAmount = insuranceAmount,
                    ProxyInsuranceAmount = proxyInsuranceAmount,
                    AppliedInsuranceAmount = appliedInsuranceAmount,
                    GrandTotal = grandTotal,
                    DisplayText = displayText,
                    SmsText = smsText,
                    WhatsAppText = whatsappText
                };
            }
            catch (Exception ex)
            {
                response.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });
            }

            return response;
        }

        public async Task<CommonResponse<SummerPricingCatalogDto>> GetCatalogAsync(
            int seasonYear = SummerWorkflowDomainConstants.DefaultSeasonYear,
            string? applicationId = null,
            CancellationToken cancellationToken = default)
        {
            var response = new CommonResponse<SummerPricingCatalogDto>();

            try
            {
                var normalizedAppId = NormalizeApplicationId(applicationId);
                var metadataRow = await GetPricingMetadataRowAsync(normalizedAppId, trackChanges: false, cancellationToken);
                var catalogPayload = ParseCatalogPayload((metadataRow?.CdmendTbl ?? string.Empty).Trim());
                var requestedSeasonYear = seasonYear > 0
                    ? seasonYear
                    : SummerWorkflowDomainConstants.DefaultSeasonYear;

                var records = BuildCatalogRecords(catalogPayload, requestedSeasonYear, includeInactive: true);

                response.Data = new SummerPricingCatalogDto
                {
                    SeasonYear = requestedSeasonYear,
                    Records = records.Select(MapCatalogRecordToDto).ToList()
                };
            }
            catch (Exception ex)
            {
                response.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });
            }

            return response;
        }

        public async Task<CommonResponse<SummerPricingCatalogDto>> SaveCatalogAsync(
            SummerPricingCatalogUpsertRequest request,
            string? applicationId = null,
            CancellationToken cancellationToken = default)
        {
            var response = new CommonResponse<SummerPricingCatalogDto>();
            request ??= new SummerPricingCatalogUpsertRequest();

            try
            {
                var seasonYear = request.SeasonYear > 0
                    ? request.SeasonYear
                    : SummerWorkflowDomainConstants.DefaultSeasonYear;

                var validationErrors = new List<Error>();
                var normalizedRecords = NormalizeCatalogRecords(request.Records, seasonYear, validationErrors);
                if (validationErrors.Count > 0)
                {
                    foreach (var error in validationErrors)
                    {
                        response.Errors.Add(error);
                    }
                    return response;
                }

                var activeSelectors = normalizedRecords
                    .Where(item => item.IsActive ?? true)
                    .GroupBy(item => BuildSelectorKey(item), StringComparer.OrdinalIgnoreCase)
                    .FirstOrDefault(group => group.Count() > 1);
                if (activeSelectors != null)
                {
                    response.Errors.Add(new Error
                    {
                        Code = "400",
                        Message = "يوجد تكرار في قواعد التسعير الفعالة لنفس المصيف/الموسم/المجال الزمني."
                    });
                    return response;
                }

                var catalogPayload = new SummerPricingCatalogPayload
                {
                    SeasonYear = seasonYear,
                    PricingRecords = normalizedRecords
                };

                var payload = JsonSerializer.Serialize(
                    catalogPayload,
                    new JsonSerializerOptions
                    {
                        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
                        WriteIndented = true
                    });

                var normalizedAppId = NormalizeApplicationId(applicationId);
                var metadataRow = await GetPricingMetadataRowAsync(normalizedAppId, trackChanges: true, cancellationToken);
                if (metadataRow == null)
                {
                    var nextSql = (await _connectContext.Cdmends
                        .AsNoTracking()
                        .MaxAsync(item => (int?)item.CdmendSql, cancellationToken) ?? 0) + 1;

                    metadataRow = new Models.Correspondance.Cdmend
                    {
                        CdmendSql = nextSql,
                        CdmendType = "Textarea",
                        CdmendTxt = SummerPricingCatalogMend,
                        CDMendLbl = "إعدادات تسعير المصايف (استرشادي - قابل للتعديل)",
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
                        ApplicationId = normalizedAppId
                    };

                    _connectContext.Cdmends.Add(metadataRow);
                }
                else
                {
                    metadataRow.CdmendType = "Textarea";
                    metadataRow.CDMendLbl = "إعدادات تسعير المصايف (استرشادي - قابل للتعديل)";
                    metadataRow.Placeholder = string.Empty;
                    metadataRow.DefaultValue = string.Empty;
                    metadataRow.CdmendTbl = payload;
                    metadataRow.CdmendDatatype = "json";
                    metadataRow.Required = false;
                    metadataRow.RequiredTrue = false;
                    metadataRow.Email = false;
                    metadataRow.Pattern = false;
                    metadataRow.MinValue = null;
                    metadataRow.MaxValue = null;
                    metadataRow.Cdmendmask = null;
                    metadataRow.CdmendStat = false;
                    metadataRow.Width = 0;
                    metadataRow.Height = 0;
                    metadataRow.IsDisabledInit = false;
                    metadataRow.IsSearchable = false;
                    metadataRow.ApplicationId = normalizedAppId;
                }

                await _connectContext.SaveChangesAsync(cancellationToken);

                response.Data = new SummerPricingCatalogDto
                {
                    SeasonYear = seasonYear,
                    Records = normalizedRecords.Select(MapCatalogPayloadRecordToDto).ToList()
                };
            }
            catch (Exception ex)
            {
                response.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });
            }

            return response;
        }

        private async Task<List<PricingRule>> LoadPricingRulesAsync(
            int seasonYear,
            string? applicationId,
            CancellationToken cancellationToken)
        {
            var normalizedAppId = NormalizeApplicationId(applicationId);
            var metadataRow = await GetPricingMetadataRowAsync(normalizedAppId, trackChanges: false, cancellationToken);
            var catalogPayload = ParseCatalogPayload((metadataRow?.CdmendTbl ?? string.Empty).Trim());
            return BuildCatalogRecords(catalogPayload, seasonYear, includeInactive: false);
        }

        private static string NormalizeApplicationId(string? applicationId)
        {
            return string.IsNullOrWhiteSpace(applicationId)
                ? SummerDynamicApplicationId
                : applicationId.Trim();
        }

        private async Task<Models.Correspondance.Cdmend?> GetPricingMetadataRowAsync(
            string normalizedAppId,
            bool trackChanges,
            CancellationToken cancellationToken)
        {
            if (trackChanges)
            {
                var tracked = await _connectContext.Cdmends
                    .FirstOrDefaultAsync(item =>
                        item.ApplicationId == normalizedAppId
                        && item.CdmendTxt == SummerPricingCatalogMend,
                        cancellationToken);

                if (tracked != null)
                {
                    return tracked;
                }

                return await _connectContext.Cdmends
                    .FirstOrDefaultAsync(item => item.CdmendTxt == SummerPricingCatalogMend, cancellationToken);
            }

            var untracked = await _connectContext.Cdmends
                .AsNoTracking()
                .FirstOrDefaultAsync(item =>
                    item.ApplicationId == normalizedAppId
                    && item.CdmendTxt == SummerPricingCatalogMend
                    && item.CdmendStat == false,
                    cancellationToken);

            if (untracked != null)
            {
                return untracked;
            }

            return await _connectContext.Cdmends
                .AsNoTracking()
                .FirstOrDefaultAsync(item =>
                    item.CdmendTxt == SummerPricingCatalogMend
                    && item.CdmendStat == false,
                    cancellationToken);
        }

        private static SummerPricingCatalogPayload ParseCatalogPayload(string payload)
        {
            if (payload.Length == 0)
            {
                return new SummerPricingCatalogPayload();
            }

            var options = new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            };

            if (payload.StartsWith("{", StringComparison.Ordinal))
            {
                return JsonSerializer.Deserialize<SummerPricingCatalogPayload>(payload, options)
                    ?? new SummerPricingCatalogPayload();
            }

            if (payload.StartsWith("[", StringComparison.Ordinal))
            {
                return new SummerPricingCatalogPayload
                {
                    PricingRecords = JsonSerializer.Deserialize<List<SummerPricingRecordPayload>>(payload, options) ?? new List<SummerPricingRecordPayload>()
                };
            }

            return new SummerPricingCatalogPayload();
        }

        private static List<PricingRule> BuildCatalogRecords(
            SummerPricingCatalogPayload catalogPayload,
            int seasonYear,
            bool includeInactive)
        {
            var payloadSeasonYear = catalogPayload.SeasonYear;
            var requestedSeasonYear = seasonYear > 0
                ? seasonYear
                : SummerWorkflowDomainConstants.DefaultSeasonYear;

            var items = catalogPayload.PricingRecords ?? new List<SummerPricingRecordPayload>();
            var rules = new List<PricingRule>();

            for (var index = 0; index < items.Count; index += 1)
            {
                var item = items[index];
                if (item == null || item.CategoryId <= 0)
                {
                    continue;
                }

                var isActive = item.IsActive ?? true;
                if (!includeInactive && !isActive)
                {
                    continue;
                }

                var effectiveSeasonYear = item.SeasonYear > 0
                    ? item.SeasonYear
                    : payloadSeasonYear;

                if (effectiveSeasonYear > 0
                    && requestedSeasonYear > 0
                    && effectiveSeasonYear != requestedSeasonYear)
                {
                    continue;
                }

                var parsedDateFrom = ParseDateOnly(item.DateFrom);
                var parsedDateTo = ParseDateOnly(item.DateTo);
                if (parsedDateFrom.HasValue && parsedDateTo.HasValue && parsedDateFrom.Value > parsedDateTo.Value)
                {
                    continue;
                }

                rules.Add(new PricingRule
                {
                    SortOrder = index,
                    PricingConfigId = (item.PricingConfigId ?? string.Empty).Trim(),
                    CategoryId = item.CategoryId,
                    SeasonYear = effectiveSeasonYear,
                    WaveCode = NormalizeCodeToken(item.WaveCode),
                    PeriodKey = NormalizePeriodKey(item.PeriodKey),
                    DateFrom = parsedDateFrom,
                    DateTo = parsedDateTo,
                    AccommodationPricePerPerson = item.AccommodationPricePerPerson,
                    TransportationPricePerPerson = item.TransportationPricePerPerson,
                    InsuranceAmount = Math.Max(0m, item.InsuranceAmount),
                    ProxyInsuranceAmount = item.ProxyInsuranceAmount.HasValue
                        ? Math.Max(0m, item.ProxyInsuranceAmount.Value)
                        : null,
                    PricingMode = (item.PricingMode ?? string.Empty).Trim(),
                    TransportationMandatory = item.TransportationMandatory ?? false,
                    DisplayLabel = (item.DisplayLabel ?? string.Empty).Trim(),
                    IsActive = isActive,
                    Notes = (item.Notes ?? string.Empty).Trim()
                });
            }

            return rules;
        }

        private static SummerPricingCatalogRecordDto MapCatalogRecordToDto(PricingRule record)
        {
            var normalizedMode = NormalizePricingMode(record.PricingMode);
            return new SummerPricingCatalogRecordDto
            {
                PricingConfigId = record.PricingConfigId,
                CategoryId = record.CategoryId,
                SeasonYear = record.SeasonYear,
                WaveCode = record.WaveCode,
                PeriodKey = record.PeriodKey,
                DateFrom = record.DateFrom?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                DateTo = record.DateTo?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                AccommodationPricePerPerson = record.AccommodationPricePerPerson,
                TransportationPricePerPerson = record.TransportationPricePerPerson,
                InsuranceAmount = record.InsuranceAmount,
                ProxyInsuranceAmount = record.ProxyInsuranceAmount,
                PricingMode = normalizedMode.Length > 0 ? normalizedMode : record.PricingMode,
                TransportationMandatory = record.TransportationMandatory,
                IsActive = record.IsActive,
                DisplayLabel = record.DisplayLabel,
                Notes = record.Notes
            };
        }

        private static SummerPricingCatalogRecordDto MapCatalogPayloadRecordToDto(SummerPricingRecordPayload record)
        {
            var normalizedMode = NormalizePricingMode(record.PricingMode);
            return new SummerPricingCatalogRecordDto
            {
                PricingConfigId = (record.PricingConfigId ?? string.Empty).Trim(),
                CategoryId = record.CategoryId,
                SeasonYear = record.SeasonYear,
                WaveCode = NormalizeCodeToken(record.WaveCode),
                PeriodKey = NormalizePeriodKey(record.PeriodKey),
                DateFrom = ParseDateOnly(record.DateFrom)?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                DateTo = ParseDateOnly(record.DateTo)?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                AccommodationPricePerPerson = record.AccommodationPricePerPerson,
                TransportationPricePerPerson = record.TransportationPricePerPerson,
                InsuranceAmount = Math.Max(0m, record.InsuranceAmount),
                ProxyInsuranceAmount = record.ProxyInsuranceAmount.HasValue
                    ? Math.Max(0m, record.ProxyInsuranceAmount.Value)
                    : null,
                PricingMode = normalizedMode.Length > 0 ? normalizedMode : (record.PricingMode ?? string.Empty).Trim(),
                TransportationMandatory = record.TransportationMandatory ?? false,
                IsActive = record.IsActive ?? true,
                DisplayLabel = (record.DisplayLabel ?? string.Empty).Trim(),
                Notes = (record.Notes ?? string.Empty).Trim()
            };
        }

        private static List<SummerPricingRecordPayload> NormalizeCatalogRecords(
            IEnumerable<SummerPricingCatalogRecordDto>? records,
            int seasonYear,
            List<Error> errors)
        {
            var source = (records ?? Array.Empty<SummerPricingCatalogRecordDto>()).ToList();
            if (source.Count == 0)
            {
                errors.Add(new Error
                {
                    Code = "400",
                    Message = "لا توجد سجلات تسعير للحفظ."
                });
                return new List<SummerPricingRecordPayload>();
            }

            var normalized = new List<SummerPricingRecordPayload>();
            for (var index = 0; index < source.Count; index += 1)
            {
                var record = source[index] ?? new SummerPricingCatalogRecordDto();
                var rowNo = index + 1;

                var rowSeasonYear = record.SeasonYear > 0 ? record.SeasonYear : seasonYear;
                if (rowSeasonYear <= 0)
                {
                    errors.Add(new Error { Code = "400", Message = $"الموسم غير صالح في السطر رقم {rowNo}." });
                    continue;
                }

                if (record.CategoryId <= 0)
                {
                    errors.Add(new Error { Code = "400", Message = $"المصيف مطلوب في السطر رقم {rowNo}." });
                    continue;
                }

                var mode = NormalizePricingMode(record.PricingMode);
                if (mode.Length == 0)
                {
                    errors.Add(new Error { Code = "400", Message = $"وضع التسعير غير صالح في السطر رقم {rowNo}." });
                    continue;
                }

                var accommodationPrice = record.AccommodationPricePerPerson;
                var transportPrice = record.TransportationPricePerPerson;
                var insuranceAmount = record.InsuranceAmount;
                var proxyInsuranceAmount = record.ProxyInsuranceAmount;
                if (accommodationPrice <= 0m)
                {
                    errors.Add(new Error { Code = "400", Message = $"سعر الإقامة للفرد يجب أن يكون أكبر من صفر في السطر رقم {rowNo}." });
                    continue;
                }

                if (transportPrice < 0m)
                {
                    errors.Add(new Error { Code = "400", Message = $"سعر الانتقالات للفرد لا يمكن أن يكون سالباً في السطر رقم {rowNo}." });
                    continue;
                }

                if (insuranceAmount < 0m)
                {
                    errors.Add(new Error { Code = "400", Message = $"قيمة التأمين لا يمكن أن تكون سالبة في السطر رقم {rowNo}." });
                    continue;
                }

                if (proxyInsuranceAmount.HasValue && proxyInsuranceAmount.Value < 0m)
                {
                    errors.Add(new Error { Code = "400", Message = $"قيمة تأمين الحجز بالنيابة لا يمكن أن تكون سالبة في السطر رقم {rowNo}." });
                    continue;
                }

                var dateFrom = ParseDateOnly(record.DateFrom);
                var dateTo = ParseDateOnly(record.DateTo);
                if (dateFrom.HasValue && dateTo.HasValue && dateFrom.Value > dateTo.Value)
                {
                    errors.Add(new Error { Code = "400", Message = $"نطاق التاريخ غير صالح في السطر رقم {rowNo}." });
                    continue;
                }

                var normalizedWaveCode = NormalizeCodeToken(record.WaveCode);
                var normalizedPeriodKey = NormalizePeriodKey(record.PeriodKey);
                var transportationMandatory = record.TransportationMandatory
                    || string.Equals(
                        mode,
                        SummerWorkflowDomainConstants.PricingModes.TransportationMandatoryIncluded,
                        StringComparison.OrdinalIgnoreCase);

                if (string.Equals(
                    mode,
                    SummerWorkflowDomainConstants.PricingModes.AccommodationOnlyAllowed,
                    StringComparison.OrdinalIgnoreCase))
                {
                    transportationMandatory = false;
                    transportPrice = 0m;
                }

                normalized.Add(new SummerPricingRecordPayload
                {
                    PricingConfigId = BuildPricingConfigId(
                        record.PricingConfigId,
                        rowSeasonYear,
                        record.CategoryId,
                        normalizedPeriodKey,
                        normalizedWaveCode,
                        rowNo),
                    CategoryId = record.CategoryId,
                    SeasonYear = rowSeasonYear,
                    WaveCode = normalizedWaveCode,
                    PeriodKey = normalizedPeriodKey,
                    DateFrom = dateFrom?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                    DateTo = dateTo?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                    AccommodationPricePerPerson = accommodationPrice,
                    TransportationPricePerPerson = transportPrice,
                    InsuranceAmount = insuranceAmount,
                    ProxyInsuranceAmount = proxyInsuranceAmount,
                    PricingMode = mode,
                    TransportationMandatory = transportationMandatory,
                    IsActive = record.IsActive,
                    DisplayLabel = (record.DisplayLabel ?? string.Empty).Trim(),
                    Notes = (record.Notes ?? string.Empty).Trim()
                });
            }

            return normalized;
        }

        private static string BuildSelectorKey(SummerPricingRecordPayload item)
        {
            return string.Join('|', new[]
            {
                item.CategoryId.ToString(CultureInfo.InvariantCulture),
                item.SeasonYear.ToString(CultureInfo.InvariantCulture),
                NormalizeCodeToken(item.WaveCode),
                NormalizePeriodKey(item.PeriodKey),
                (item.DateFrom ?? string.Empty).Trim(),
                (item.DateTo ?? string.Empty).Trim()
            });
        }

        private static string BuildPricingConfigId(
            string? rawValue,
            int seasonYear,
            int categoryId,
            string periodKey,
            string waveCode,
            int rowNo)
        {
            var normalized = NormalizeCodeToken(rawValue);
            if (normalized.Length > 0)
            {
                return normalized;
            }

            var slot = periodKey.Length > 0
                ? periodKey
                : (waveCode.Length > 0 ? waveCode : $"ROW{rowNo:D2}");

            return $"SUM{seasonYear}-CAT{categoryId}-{slot}";
        }

        private static PricingRule? SelectBestRule(
            IEnumerable<PricingRule> rules,
            int categoryId,
            int seasonYear,
            string waveCode,
            string periodKey,
            DateOnly? waveDate)
        {
            var bestMatch = rules
                .Where(rule => rule.CategoryId == categoryId)
                .Where(rule => rule.SeasonYear <= 0 || rule.SeasonYear == seasonYear)
                .Select(rule => new
                {
                    Rule = rule,
                    Score = CalculateMatchScore(rule, waveCode, periodKey, waveDate)
                })
                .Where(item => item.Score >= 0)
                .OrderByDescending(item => item.Score)
                .ThenByDescending(item => item.Rule.SeasonYear)
                .ThenBy(item => item.Rule.SortOrder)
                .FirstOrDefault();

            return bestMatch?.Rule;
        }

        private static int CalculateMatchScore(
            PricingRule rule,
            string waveCode,
            string periodKey,
            DateOnly? waveDate)
        {
            if (rule.WaveCode.Length > 0
                && !string.Equals(rule.WaveCode, waveCode, StringComparison.OrdinalIgnoreCase))
            {
                return -1;
            }

            if (rule.PeriodKey.Length > 0
                && !string.Equals(rule.PeriodKey, periodKey, StringComparison.OrdinalIgnoreCase))
            {
                return -1;
            }

            if (rule.DateFrom.HasValue || rule.DateTo.HasValue)
            {
                if (!waveDate.HasValue)
                {
                    return -1;
                }

                if (rule.DateFrom.HasValue && waveDate.Value < rule.DateFrom.Value)
                {
                    return -1;
                }

                if (rule.DateTo.HasValue && waveDate.Value > rule.DateTo.Value)
                {
                    return -1;
                }
            }

            var score = 0;
            if (rule.WaveCode.Length > 0)
            {
                score += 100;
            }

            if (rule.PeriodKey.Length > 0)
            {
                score += 50;
            }

            if (rule.DateFrom.HasValue || rule.DateTo.HasValue)
            {
                score += 40;
            }

            if (rule.SeasonYear > 0)
            {
                score += 20;
            }

            if (rule.DisplayLabel.Length > 0)
            {
                score += 1;
            }

            return score;
        }

        private static int ResolvePersonsCount(SummerPricingQuoteRequest request)
        {
            if (request.PersonsCount > 0)
            {
                return request.PersonsCount;
            }

            var familyCount = request.FamilyCount.GetValueOrDefault();
            var extraCount = request.ExtraCount.GetValueOrDefault();
            if (extraCount < 0)
            {
                extraCount = 0;
            }

            var total = familyCount + extraCount;
            return total > 0 ? total : 0;
        }

        private static DateOnly? ResolveWaveDate(SummerPricingQuoteRequest request, int seasonYear)
        {
            var fromIso = ParseDateOnly(request.WaveStartsAtIso);
            if (fromIso.HasValue)
            {
                return fromIso;
            }

            if (SummerCalendarRules.TryParseWaveLabelDateUtc(request.WaveLabel, out var waveStartFromLabel))
            {
                return ToCairoDate(waveStartFromLabel);
            }

            if (request.CategoryId > 0
                && !string.IsNullOrWhiteSpace(request.WaveCode)
                && SummerCalendarRules.TryResolveWaveStartUtc(
                    request.CategoryId,
                    seasonYear,
                    request.WaveCode,
                    request.WaveLabel,
                    out var waveStartFromCalendar))
            {
                return ToCairoDate(waveStartFromCalendar);
            }

            return null;
        }

        private static string ResolvePeriodKey(string requestedPeriodKey, DateOnly? waveDate)
        {
            if (requestedPeriodKey.Length > 0)
            {
                return requestedPeriodKey;
            }

            if (!waveDate.HasValue)
            {
                return string.Empty;
            }

            return waveDate.Value.Month switch
            {
                6 or 9 => "JUN_SEP",
                7 or 8 => "JUL_AUG",
                _ => $"M{waveDate.Value.Month:D2}"
            };
        }

        private static DateOnly ToCairoDate(DateTime valueUtc)
        {
            var utc = valueUtc.Kind == DateTimeKind.Utc
                ? valueUtc
                : valueUtc.ToUniversalTime();
            var cairoDateTime = TimeZoneInfo.ConvertTimeFromUtc(utc, CairoTimeZone);
            return DateOnly.FromDateTime(cairoDateTime);
        }

        private static DateOnly? ParseDateOnly(string? rawValue)
        {
            var value = (rawValue ?? string.Empty).Trim();
            if (value.Length == 0)
            {
                return null;
            }

            if (DateTimeOffset.TryParse(
                value,
                CultureInfo.InvariantCulture,
                DateTimeStyles.AllowWhiteSpaces | DateTimeStyles.RoundtripKind,
                out var dto))
            {
                return ToCairoDate(dto.UtcDateTime);
            }

            var supportedFormats = new[]
            {
                "yyyy-MM-dd",
                "dd/MM/yyyy",
                "d/M/yyyy",
                "MM/dd/yyyy",
                "M/d/yyyy"
            };

            if (DateOnly.TryParseExact(
                value,
                supportedFormats,
                CultureInfo.InvariantCulture,
                DateTimeStyles.AllowWhiteSpaces,
                out var dateOnly))
            {
                return dateOnly;
            }

            if (DateOnly.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.AllowWhiteSpaces, out dateOnly))
            {
                return dateOnly;
            }

            return null;
        }

        private static string NormalizePeriodKey(string? value)
        {
            return string.Concat((value ?? string.Empty)
                .Trim()
                .ToUpperInvariant()
                .Where(ch => char.IsLetterOrDigit(ch) || ch == '_'));
        }

        private static string NormalizeCodeToken(string? value)
        {
            return string.Concat((value ?? string.Empty)
                .Trim()
                .ToUpperInvariant()
                .Where(ch => char.IsLetterOrDigit(ch) || ch == '_' || ch == '-'));
        }

        private static string NormalizePricingMode(string? pricingMode)
        {
            var token = string.Concat((pricingMode ?? string.Empty)
                .Trim()
                .ToUpperInvariant()
                .Where(ch => char.IsLetterOrDigit(ch)));

            return token switch
            {
                "ACCOMMODATIONONLYALLOWED" or "ACCOMMODATIONONLY" =>
                    SummerWorkflowDomainConstants.PricingModes.AccommodationOnlyAllowed,
                "ACCOMMODATIONANDTRANSPORTATIONOPTIONAL" or "ACCOMMODATIONTRANSPORTOPTIONAL" =>
                    SummerWorkflowDomainConstants.PricingModes.AccommodationAndTransportationOptional,
                "TRANSPORTATIONMANDATORYINCLUDED" or "TRANSPORTMANDATORYINCLUDED" =>
                    SummerWorkflowDomainConstants.PricingModes.TransportationMandatoryIncluded,
                _ => string.Empty
            };
        }

        private static string NormalizeStayMode(string? stayMode)
        {
            var raw = (stayMode ?? string.Empty).Trim();
            if (raw.Length == 0)
            {
                return string.Empty;
            }

            var token = string.Concat(raw
                .ToUpperInvariant()
                .Where(ch => char.IsLetterOrDigit(ch)));

            if (token is "RESIDENCEONLY" or "ACCOMMODATIONONLY")
            {
                return SummerWorkflowDomainConstants.StayModes.ResidenceOnly;
            }

            if (token is "RESIDENCEWITHTRANSPORT" or "ACCOMMODATIONWITHTRANSPORT" or "RESIDENCEANDTRANSPORT")
            {
                return SummerWorkflowDomainConstants.StayModes.ResidenceWithTransport;
            }

            var normalizedArabic = string.Concat(raw
                .Replace("أ", "ا", StringComparison.Ordinal)
                .Replace("إ", "ا", StringComparison.Ordinal)
                .Replace("آ", "ا", StringComparison.Ordinal)
                .Where(ch => !char.IsWhiteSpace(ch)));

            if (normalizedArabic.Contains("اقامةفقط", StringComparison.OrdinalIgnoreCase))
            {
                return SummerWorkflowDomainConstants.StayModes.ResidenceOnly;
            }

            if (normalizedArabic.Contains("انتقالات", StringComparison.OrdinalIgnoreCase))
            {
                return SummerWorkflowDomainConstants.StayModes.ResidenceWithTransport;
            }

            return string.Empty;
        }

        private static string BuildDisplayText(
            string destinationName,
            string waveDisplay,
            int personsCount,
            decimal accommodationPricePerPerson,
            decimal transportationPricePerPerson,
            decimal accommodationTotal,
            decimal transportationTotal,
            decimal appliedInsuranceAmount,
            decimal grandTotal,
            string normalizedStayMode,
            string pricingMode,
            bool transportationMandatory,
            string nextDayDueDateText)
        {
            return BuildDetailedPricingMessage(
                destinationName,
                waveDisplay,
                personsCount,
                accommodationPricePerPerson,
                transportationPricePerPerson,
                accommodationTotal,
                transportationTotal,
                appliedInsuranceAmount,
                grandTotal,
                normalizedStayMode,
                pricingMode,
                transportationMandatory,
                nextDayDueDateText);
        }

        private static string BuildSmsText(
            string destinationName,
            string waveDisplay,
            int personsCount,
            decimal accommodationPricePerPerson,
            decimal transportationPricePerPerson,
            decimal accommodationTotal,
            decimal transportationTotal,
            decimal appliedInsuranceAmount,
            decimal grandTotal,
            string normalizedStayMode,
            string pricingMode,
            bool transportationMandatory,
            string nextDayDueDateText)
        {
            return BuildDetailedPricingMessage(
                destinationName,
                waveDisplay,
                personsCount,
                accommodationPricePerPerson,
                transportationPricePerPerson,
                accommodationTotal,
                transportationTotal,
                appliedInsuranceAmount,
                grandTotal,
                normalizedStayMode,
                pricingMode,
                transportationMandatory,
                nextDayDueDateText);
        }

        private static string BuildDetailedPricingMessage(
            string destinationName,
            string waveDisplay,
            int personsCount,
            decimal accommodationPricePerPerson,
            decimal transportationPricePerPerson,
            decimal accommodationTotal,
            decimal transportationTotal,
            decimal appliedInsuranceAmount,
            decimal grandTotal,
            string normalizedStayMode,
            string pricingMode,
            bool transportationMandatory,
            string nextDayDueDateText)
        {
            var stayModeLabel = string.Equals(
                normalizedStayMode,
                SummerWorkflowDomainConstants.StayModes.ResidenceWithTransport,
                StringComparison.OrdinalIgnoreCase)
                ? "إقامة وانتقالات"
                : "إقامة فقط";

            if (string.Equals(
                pricingMode,
                SummerWorkflowDomainConstants.PricingModes.TransportationMandatoryIncluded,
                StringComparison.OrdinalIgnoreCase))
            {
                stayModeLabel = "إقامة وانتقالات (الانتقالات إلزامية ومضمنة في السعر)";
            }
            else if (transportationMandatory)
            {
                stayModeLabel = $"{stayModeLabel} (الانتقالات إلزامية)";
            }

            var waveDateText = ExtractWaveDateText(waveDisplay);
            var insuranceSegment = appliedInsuranceAmount > 0m
                ? $"، التأمين: {FormatMoney(appliedInsuranceAmount)} جنيه"
                : string.Empty;

            return $"رقم الحجز: #{{bookingNumber}} | المرجعي: {{referenceNumber}}. الوجهة: {destinationName}، - تاريخ {waveDisplay}، الموعد: {waveDateText}، نوع الحجز: {stayModeLabel}، عدد الأفراد: {personsCount}{insuranceSegment}، الإجمالي: {FormatMoney(grandTotal)} جنيه. يرجى السداد قبل موعد أقصاه {nextDayDueDateText}.";
        }

        private static string ExtractWaveDateText(string waveDisplay)
        {
            var text = (waveDisplay ?? string.Empty).Trim();
            if (text.Length == 0)
            {
                return "-";
            }

            var match = System.Text.RegularExpressions.Regex.Match(text, @"(?<!\d)(\d{1,2}/\d{1,2}/\d{4})(?!\d)");
            if (!match.Success)
            {
                return "-";
            }

            var rawDate = match.Groups[1].Value;
            var formats = new[] { "dd/MM/yyyy", "d/M/yyyy", "MM/dd/yyyy", "M/d/yyyy" };
            if (DateTime.TryParseExact(
                rawDate,
                formats,
                CultureInfo.InvariantCulture,
                DateTimeStyles.AllowWhiteSpaces,
                out var parsed))
            {
                return parsed.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture);
            }

            return rawDate;
        }

        private static string ResolveNextDayDueDateText()
        {
            var nowUtc = DateTime.UtcNow;
            var cairoNow = TimeZoneInfo.ConvertTimeFromUtc(nowUtc, CairoTimeZone);
            var nextDay = cairoNow.Date.AddDays(1);
            return nextDay.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture);
        }

        private static string FormatMoney(decimal value)
        {
            return value % 1m == 0m
                ? decimal.Truncate(value).ToString("0", CultureInfo.InvariantCulture)
                : value.ToString("0.##", CultureInfo.InvariantCulture);
        }

        private static TimeZoneInfo ResolveCairoTimeZone()
        {
            try
            {
                return TimeZoneInfo.FindSystemTimeZoneById("Africa/Cairo");
            }
            catch
            {
                try
                {
                    return TimeZoneInfo.FindSystemTimeZoneById("Egypt Standard Time");
                }
                catch
                {
                    return TimeZoneInfo.Utc;
                }
            }
        }

        private sealed class SummerPricingCatalogPayload
        {
            public int SeasonYear { get; set; }
            public List<SummerPricingRecordPayload>? PricingRecords { get; set; }
        }

        private sealed class SummerPricingRecordPayload
        {
            public string? PricingConfigId { get; set; }
            public int CategoryId { get; set; }
            public int SeasonYear { get; set; }
            public string? WaveCode { get; set; }
            public string? PeriodKey { get; set; }
            public string? DateFrom { get; set; }
            public string? DateTo { get; set; }
            public decimal AccommodationPricePerPerson { get; set; }
            public decimal TransportationPricePerPerson { get; set; }
            public decimal InsuranceAmount { get; set; }
            public decimal? ProxyInsuranceAmount { get; set; }
            public string? PricingMode { get; set; }
            public bool? TransportationMandatory { get; set; }
            public bool? IsActive { get; set; }
            public string? DisplayLabel { get; set; }
            public string? Notes { get; set; }
        }

        private sealed class PricingRule
        {
            public int SortOrder { get; set; }
            public string PricingConfigId { get; set; } = string.Empty;
            public int CategoryId { get; set; }
            public int SeasonYear { get; set; }
            public string WaveCode { get; set; } = string.Empty;
            public string PeriodKey { get; set; } = string.Empty;
            public DateOnly? DateFrom { get; set; }
            public DateOnly? DateTo { get; set; }
            public decimal AccommodationPricePerPerson { get; set; }
            public decimal TransportationPricePerPerson { get; set; }
            public decimal InsuranceAmount { get; set; }
            public decimal? ProxyInsuranceAmount { get; set; }
            public string PricingMode { get; set; } = string.Empty;
            public bool TransportationMandatory { get; set; }
            public string DisplayLabel { get; set; } = string.Empty;
            public bool IsActive { get; set; } = true;
            public string Notes { get; set; } = string.Empty;
        }
    }
}
