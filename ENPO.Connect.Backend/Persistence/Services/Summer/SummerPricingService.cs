using System.Globalization;
using System.Text.Encodings.Web;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Models.Correspondance;
using Models.DTO.Common;
using Models.DTO.Correspondance.Summer;
using Persistence.Data;

namespace Persistence.Services.Summer
{
    public class SummerPricingService
    {
        private readonly ConnectContext _connectContext;
        private readonly ILogger<SummerPricingService> _logger;
        private const string SummerDynamicApplicationId = SummerWorkflowDomainConstants.DynamicApplicationId;
        private const string SummerPricingCatalogMend = SummerWorkflowDomainConstants.PricingCatalogMend;
        private const string NoPricingPolicyForSelectedWaveMessage = "لا توجد سياسة تسعير معتمدة للفوج المختار.";
        private static readonly TimeZoneInfo CairoTimeZone = ResolveCairoTimeZone();
        private static readonly JsonSerializerOptions CatalogJsonSerializerOptions = new()
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            WriteIndented = true,
            Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping
        };

        public SummerPricingService(
            ConnectContext connectContext,
            ILogger<SummerPricingService>? logger = null)
        {
            _connectContext = connectContext;
            _logger = logger ?? NullLogger<SummerPricingService>.Instance;
        }

        public async Task<CommonResponse<SummerPricingQuoteDto>> GetQuoteAsync(
            SummerPricingQuoteRequest request,
            string? applicationId = null,
            bool allowMembershipOverride = false,
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

                var normalizedWaveCode = NormalizeCodeToken(request.WaveCode);
                var waveDate = ResolveWaveDate(request, seasonYear);
                var requestedPeriodKey = NormalizePeriodKey(request.PeriodKey);
                var effectivePeriodKey = ResolvePeriodKey(requestedPeriodKey, waveDate);
                var requestedStayMode = NormalizeStayMode(request.StayMode);
                if (string.IsNullOrWhiteSpace(requestedStayMode))
                {
                    requestedStayMode = SummerWorkflowDomainConstants.StayModes.ResidenceOnly;
                }

                var fixedPlansForCategorySeason = await LoadFixedPricingPlansAsync(
                    seasonYear,
                    request.CategoryId,
                    cancellationToken);
                if (fixedPlansForCategorySeason.Count > 0)
                {
                    if (effectivePeriodKey.Length == 0)
                    {
                        response.Errors.Add(new Error
                        {
                            Code = "400",
                            Message = "البيانات غير مكتملة لحساب التسعير: فترة الفوج غير متاحة."
                        });
                        return response;
                    }

                    var periodPlans = fixedPlansForCategorySeason
                        .Where(item => NormalizePeriodKey(item.PeriodKey) == effectivePeriodKey)
                        .ToList();
                    if (periodPlans.Count == 0)
                    {
                        response.Errors.Add(new Error
                        {
                            Code = "404",
                            Message = NoPricingPolicyForSelectedWaveMessage
                        });
                        return response;
                    }

                    var personsPlans = periodPlans
                        .Where(item => item.PersonsCount == personsCount)
                        .ToList();
                    if (personsPlans.Count == 0)
                    {
                        response.Errors.Add(new Error
                        {
                            Code = "404",
                            Message = "لا توجد خطة أسعار معتمدة لعدد الأفراد المختار."
                        });
                        return response;
                    }

                    var hasResidenceOnlyPlan = personsPlans.Any(item =>
                        string.Equals(
                            NormalizeStayMode(item.StayMode),
                            SummerWorkflowDomainConstants.StayModes.ResidenceOnly,
                            StringComparison.OrdinalIgnoreCase));
                    var hasResidenceWithTransportPlan = personsPlans.Any(item =>
                        string.Equals(
                            NormalizeStayMode(item.StayMode),
                            SummerWorkflowDomainConstants.StayModes.ResidenceWithTransport,
                            StringComparison.OrdinalIgnoreCase));

                    var selectedFixedPlan = personsPlans.FirstOrDefault(item =>
                        string.Equals(
                            NormalizeStayMode(item.StayMode),
                            requestedStayMode,
                            StringComparison.OrdinalIgnoreCase));

                    var fixedNormalizedStayMode = requestedStayMode;
                    var fixedStayModeWasNormalized = false;

                    if (selectedFixedPlan == null)
                    {
                        response.Errors.Add(new Error
                        {
                            Code = "404",
                            Message = "لا توجد خطة أسعار معتمدة لنوع الإقامة المختار."
                        });
                        return response;
                    }

                    var fixedPricingMode = hasResidenceOnlyPlan && hasResidenceWithTransportPlan
                        ? SummerWorkflowDomainConstants.PricingModes.AccommodationAndTransportationOptional
                        : hasResidenceWithTransportPlan
                            ? SummerWorkflowDomainConstants.PricingModes.TransportationMandatoryIncluded
                            : SummerWorkflowDomainConstants.PricingModes.AccommodationOnlyAllowed;

                    var fixedTransportationMandatory = string.Equals(
                        fixedPricingMode,
                        SummerWorkflowDomainConstants.PricingModes.TransportationMandatoryIncluded,
                        StringComparison.OrdinalIgnoreCase);

                    var fixedResolvedMembershipType = SummerMembershipPolicy.ResolveMembershipType(
                        request.MembershipType,
                        allowMembershipOverride);
                    var fixedResolvedMembershipLabel = SummerMembershipPolicy.ResolveMembershipLabel(fixedResolvedMembershipType);
                    var fixedAppliedInsuranceAmount = SummerMembershipPolicy.ResolveInsuranceAmount(fixedResolvedMembershipType);
                    var baseInsuranceAmount = Math.Max(0m, selectedFixedPlan.InsuranceAmount);
                    var fixedInsuranceAmount = fixedAppliedInsuranceAmount;
                    decimal? fixedProxyInsuranceAmount = null;

                    var bookingAmount = Math.Max(0m, selectedFixedPlan.CashAmount);
                    if (bookingAmount <= 0m)
                    {
                        bookingAmount = Math.Max(0m, selectedFixedPlan.EmployeeTotalAmount - baseInsuranceAmount);
                    }

                    var fixedAccommodationTotal = bookingAmount;
                    var fixedTransportationTotal = 0m;
                    if (string.Equals(
                            fixedNormalizedStayMode,
                            SummerWorkflowDomainConstants.StayModes.ResidenceWithTransport,
                            StringComparison.OrdinalIgnoreCase)
                        && hasResidenceOnlyPlan)
                    {
                        var baseResidenceOnlyPlan = personsPlans.FirstOrDefault(item =>
                            string.Equals(
                                NormalizeStayMode(item.StayMode),
                                SummerWorkflowDomainConstants.StayModes.ResidenceOnly,
                                StringComparison.OrdinalIgnoreCase));
                        if (baseResidenceOnlyPlan != null)
                        {
                            var baseAccommodationTotal = Math.Max(0m, baseResidenceOnlyPlan.CashAmount);
                            if (baseAccommodationTotal <= bookingAmount)
                            {
                                fixedTransportationTotal = Math.Max(0m, bookingAmount - baseAccommodationTotal);
                                fixedAccommodationTotal = Math.Max(0m, bookingAmount - fixedTransportationTotal);
                            }
                        }
                    }

                    var fixedGrandTotal = bookingAmount + fixedAppliedInsuranceAmount;
                    var accommodationPricePerPerson = personsCount > 0
                        ? decimal.Round(fixedAccommodationTotal / personsCount, 2, MidpointRounding.AwayFromZero)
                        : 0m;
                    var transportationPricePerPerson = personsCount > 0
                        ? decimal.Round(fixedTransportationTotal / personsCount, 2, MidpointRounding.AwayFromZero)
                        : 0m;

                    var fixedInstallmentAmounts = BuildFixedInstallmentAmounts(selectedFixedPlan);
                    if (fixedInstallmentAmounts.Count > 0)
                    {
                        var insuranceDelta = NormalizeMoney(fixedAppliedInsuranceAmount - baseInsuranceAmount);
                        if (insuranceDelta != 0m)
                        {
                            fixedInstallmentAmounts[0] = NormalizeMoney(
                                Math.Max(0m, fixedInstallmentAmounts[0] + insuranceDelta));
                        }
                    }

                    var fixedDestinationName = (request.DestinationName ?? string.Empty).Trim();
                    if (fixedDestinationName.Length == 0)
                    {
                        fixedDestinationName = $"المصيف رقم {request.CategoryId}";
                    }

                    var fixedWaveLabel = (request.WaveLabel ?? string.Empty).Trim();
                    var fixedWaveCodeForDisplay = (request.WaveCode ?? string.Empty).Trim();
                    var fixedWaveDisplay = fixedWaveLabel.Length > 0
                        ? fixedWaveLabel
                        : (fixedWaveCodeForDisplay.Length > 0 ? fixedWaveCodeForDisplay : "-");
                    var fixedNextDayDueDateText = ResolveNextDayDueDateText();

                    var fixedDisplayText = BuildDisplayText(
                        fixedDestinationName,
                        fixedWaveDisplay,
                        personsCount,
                        accommodationPricePerPerson,
                        transportationPricePerPerson,
                        fixedAccommodationTotal,
                        fixedTransportationTotal,
                        fixedAppliedInsuranceAmount,
                        fixedGrandTotal,
                        fixedNormalizedStayMode,
                        fixedPricingMode,
                        fixedTransportationMandatory,
                        fixedNextDayDueDateText);

                    var fixedSmsText = BuildSmsText(
                        fixedDestinationName,
                        fixedWaveDisplay,
                        personsCount,
                        accommodationPricePerPerson,
                        transportationPricePerPerson,
                        fixedAccommodationTotal,
                        fixedTransportationTotal,
                        fixedAppliedInsuranceAmount,
                        fixedGrandTotal,
                        fixedNormalizedStayMode,
                        fixedPricingMode,
                        fixedTransportationMandatory,
                        fixedNextDayDueDateText);

                    var fixedWhatsAppText = fixedDisplayText;
                    var fixedPricingConfigId = $"FIXED-{seasonYear}-CAT{request.CategoryId}-{effectivePeriodKey}-P{personsCount}-{fixedNormalizedStayMode}";

                    response.Data = new SummerPricingQuoteDto
                    {
                        PricingConfigId = fixedPricingConfigId,
                        CategoryId = request.CategoryId,
                        SeasonYear = seasonYear,
                        WaveCode = fixedWaveCodeForDisplay,
                        WaveLabel = fixedWaveLabel,
                        PeriodKey = effectivePeriodKey,
                        PricingMode = fixedPricingMode,
                        TransportationMandatory = fixedTransportationMandatory,
                        PersonsCount = personsCount,
                        AccommodationPricePerPerson = accommodationPricePerPerson,
                        TransportationPricePerPerson = transportationPricePerPerson,
                        MembershipType = fixedResolvedMembershipType,
                        MembershipTypeLabel = fixedResolvedMembershipLabel,
                        SelectedStayMode = requestedStayMode,
                        NormalizedStayMode = fixedNormalizedStayMode,
                        StayModeWasNormalized = fixedStayModeWasNormalized,
                        AccommodationTotal = fixedAccommodationTotal,
                        TransportationTotal = fixedTransportationTotal,
                        InsuranceAmount = fixedInsuranceAmount,
                        ProxyInsuranceAmount = fixedProxyInsuranceAmount,
                        AppliedInsuranceAmount = fixedAppliedInsuranceAmount,
                        GrandTotal = fixedGrandTotal,
                        FixedInstallmentAmounts = fixedInstallmentAmounts,
                        DisplayText = fixedDisplayText,
                        SmsText = fixedSmsText,
                        WhatsAppText = fixedWhatsAppText
                    };

                    return response;
                }

                var pricingRules = await LoadPricingRulesAsync(
                    seasonYear,
                    applicationId,
                    includeInactive: false,
                    cancellationToken);
                if (pricingRules.Count == 0)
                {
                    var allCatalogRules = await LoadPricingRulesAsync(
                        seasonYear,
                        applicationId,
                        includeInactive: true,
                        cancellationToken);
                    var categoryHasConfiguredRules = allCatalogRules.Any(rule =>
                        rule.CategoryId == request.CategoryId
                        && (rule.SeasonYear <= 0 || rule.SeasonYear == seasonYear));

                    response.Errors.Add(new Error
                    {
                        Code = "404",
                        Message = categoryHasConfiguredRules
                            ? "التسعير غير مفعل لهذا المصيف في الموسم الحالي."
                            : "لا توجد إعدادات تسعير فعّالة لهذا الموسم. يرجى مراجعة إعدادات التسعير."
                    });
                    return response;
                }

                var selectedRule = SelectBestRule(
                    pricingRules,
                    request.CategoryId,
                    seasonYear,
                    normalizedWaveCode,
                    effectivePeriodKey,
                    waveDate);

                if (selectedRule == null)
                {
                    var catalogRules = await LoadPricingRulesAsync(
                        seasonYear,
                        applicationId,
                        includeInactive: true,
                        cancellationToken);

                    var noMatchMessage = ResolveNoMatchMessage(
                        catalogRules,
                        request.CategoryId,
                        seasonYear,
                        normalizedWaveCode,
                        effectivePeriodKey,
                        waveDate);

                    response.Errors.Add(new Error
                    {
                        Code = "404",
                        Message = noMatchMessage
                    });
                    _logger.LogWarning(
                        "Summer pricing quote no-match. CategoryId={CategoryId}, SeasonYear={SeasonYear}, WaveCode={WaveCode}, PeriodKey={PeriodKey}, WaveDate={WaveDate}",
                        request.CategoryId,
                        seasonYear,
                        normalizedWaveCode,
                        effectivePeriodKey,
                        waveDate?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
                    return response;
                }

                if (IsPeriodFallbackMatch(selectedRule, effectivePeriodKey, waveDate))
                {
                    _logger.LogWarning(
                        "Summer pricing quote used period fallback by date range. CategoryId={CategoryId}, RuleConfigId={RuleConfigId}, RequestedPeriodKey={RequestedPeriodKey}, RulePeriodKey={RulePeriodKey}, WaveDate={WaveDate}",
                        request.CategoryId,
                        selectedRule.PricingConfigId,
                        effectivePeriodKey,
                        selectedRule.PeriodKey,
                        waveDate?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
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

                var resolvedMembershipType = SummerMembershipPolicy.ResolveMembershipType(
                    request.MembershipType,
                    allowMembershipOverride);
                var resolvedMembershipLabel = SummerMembershipPolicy.ResolveMembershipLabel(resolvedMembershipType);
                var appliedInsuranceAmount = SummerMembershipPolicy.ResolveInsuranceAmount(resolvedMembershipType);
                var insuranceAmount = appliedInsuranceAmount;
                decimal? proxyInsuranceAmount = null;
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
                    MembershipType = resolvedMembershipType,
                    MembershipTypeLabel = resolvedMembershipLabel,
                    SelectedStayMode = requestedStayMode,
                    NormalizedStayMode = normalizedStayMode,
                    StayModeWasNormalized = stayModeWasNormalized,
                    AccommodationTotal = accommodationTotal,
                    TransportationTotal = transportationTotal,
                    InsuranceAmount = insuranceAmount,
                    ProxyInsuranceAmount = proxyInsuranceAmount,
                    AppliedInsuranceAmount = appliedInsuranceAmount,
                    GrandTotal = grandTotal,
                    FixedInstallmentAmounts = BuildLegacyInstallmentPlan(grandTotal),
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
            var normalizedAppId = NormalizeApplicationId(applicationId);

            try
            {
                var seasonYear = request.SeasonYear > 0
                    ? request.SeasonYear
                    : SummerWorkflowDomainConstants.DefaultSeasonYear;

                var requestRecords = ResolveUpsertRecords(request);
                if ((request.Records?.Count ?? 0) == 0 && (request.PricingRecords?.Count ?? 0) > 0)
                {
                    _logger.LogWarning(
                        "Summer pricing save received legacy payload key 'pricingRecords' instead of 'records'. RecordsCount={RecordsCount}",
                        request.PricingRecords?.Count ?? 0);
                }

                var validationErrors = new List<Error>();
                var normalizedRecords = NormalizeCatalogRecords(requestRecords, seasonYear, validationErrors);
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

                var overlapErrors = ValidateActiveDateRangeOverlaps(normalizedRecords);
                if (overlapErrors.Count > 0)
                {
                    foreach (var error in overlapErrors)
                    {
                        response.Errors.Add(error);
                    }

                    return response;
                }

                var catalogPayload = new SummerPricingCatalogPayload
                {
                    SeasonYear = seasonYear,
                    PricingRecords = normalizedRecords
                };

                var payload = JsonSerializer.Serialize(
                    catalogPayload,
                    CatalogJsonSerializerOptions);

                var firstInputRecord = normalizedRecords.FirstOrDefault();
                _logger.LogInformation(
                    "Summer pricing save started. ApplicationId={ApplicationId}, SeasonYear={SeasonYear}, RecordsCount={RecordsCount}, FirstInsuranceAmount={FirstInsuranceAmount}, FirstProxyInsuranceAmount={FirstProxyInsuranceAmount}",
                    normalizedAppId,
                    seasonYear,
                    normalizedRecords.Count,
                    firstInputRecord?.InsuranceAmount,
                    firstInputRecord?.ProxyInsuranceAmount);

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

                if (metadataRow != null)
                {
                    await _connectContext.Entry(metadataRow).ReloadAsync(cancellationToken);
                }

                var persistedCatalogPayload = ParseCatalogPayload((metadataRow?.CdmendTbl ?? string.Empty).Trim());
                var persistedRecords = BuildCatalogRecords(persistedCatalogPayload, seasonYear, includeInactive: true);
                var firstPersistedRecord = persistedRecords.FirstOrDefault();
                _logger.LogInformation(
                    "Summer pricing save completed. ApplicationId={ApplicationId}, SeasonYear={SeasonYear}, PersistedRecordsCount={PersistedRecordsCount}, FirstPersistedInsuranceAmount={FirstPersistedInsuranceAmount}, FirstPersistedProxyInsuranceAmount={FirstPersistedProxyInsuranceAmount}",
                    normalizedAppId,
                    seasonYear,
                    persistedRecords.Count,
                    firstPersistedRecord?.InsuranceAmount,
                    firstPersistedRecord?.ProxyInsuranceAmount);

                response.Data = new SummerPricingCatalogDto
                {
                    SeasonYear = seasonYear,
                    Records = persistedRecords.Select(MapCatalogRecordToDto).ToList()
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(
                    ex,
                    "Summer pricing save failed. SeasonYear={SeasonYear}, ApplicationId={ApplicationId}",
                    request.SeasonYear,
                    normalizedAppId);
                response.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });
            }

            return response;
        }

        private static IReadOnlyList<SummerPricingCatalogRecordDto> ResolveUpsertRecords(SummerPricingCatalogUpsertRequest request)
        {
            if (request.Records != null && request.Records.Count > 0)
            {
                return request.Records;
            }

            if (request.PricingRecords != null && request.PricingRecords.Count > 0)
            {
                return request.PricingRecords;
            }

            return request.Records ?? new List<SummerPricingCatalogRecordDto>();
        }

        private async Task<List<SummerFixedPricingPlan>> LoadFixedPricingPlansAsync(
            int seasonYear,
            int categoryId,
            CancellationToken cancellationToken)
        {
            return await _connectContext.SummerFixedPricingPlans
                .AsNoTracking()
                .Where(item =>
                    item.IsActive
                    && item.SeasonYear == seasonYear
                    && item.CategoryId == categoryId)
                .ToListAsync(cancellationToken);
        }

        private static List<decimal> BuildFixedInstallmentAmounts(SummerFixedPricingPlan plan)
        {
            return new List<decimal>
            {
                NormalizeMoney(plan.DownPaymentAmount),
                NormalizeMoney(plan.Installment2Amount),
                NormalizeMoney(plan.Installment3Amount),
                NormalizeMoney(plan.Installment4Amount),
                NormalizeMoney(plan.Installment5Amount),
                NormalizeMoney(plan.Installment6Amount),
                NormalizeMoney(plan.Installment7Amount)
            };
        }

        private static List<decimal> BuildLegacyInstallmentPlan(decimal totalAmount)
        {
            var count = SummerWorkflowDomainConstants.PaymentModes.DefaultInstallmentCount;
            var normalizedTotal = NormalizeMoney(totalAmount);
            if (normalizedTotal <= 0m)
            {
                return new List<decimal>();
            }

            var installments = BuildLegacyEqualInstallments(normalizedTotal, count);
            return installments.ToList();
        }

        private static decimal[] BuildLegacyEqualInstallments(decimal totalAmount, int installmentCount)
        {
            var count = installmentCount > 0 ? installmentCount : 1;
            var normalizedTotal = NormalizeMoney(totalAmount);
            if (count == SummerWorkflowDomainConstants.PaymentModes.DefaultInstallmentCount && normalizedTotal > 0m)
            {
                return BuildLegacyReservationInstallments(normalizedTotal);
            }

            return BuildEvenInstallmentsByCents(normalizedTotal, count);
        }

        private static decimal[] BuildLegacyReservationInstallments(decimal normalizedTotal)
        {
            const decimal downPaymentTargetPercent = 20m;
            var installmentsTailCount = SummerWorkflowDomainConstants.PaymentModes.DefaultInstallmentCount - 1;
            var bestStep = 0m;
            var bestInstallmentValue = 0m;
            var bestDownPayment = 0m;
            var bestScore = decimal.MaxValue;

            foreach (var step in new[] { 50m, 100m })
            {
                if (step <= 0m)
                {
                    continue;
                }

                var targetDownPayment = normalizedTotal * (downPaymentTargetPercent / 100m);
                var roundedTargetDownPayment = RoundToNearestStep(targetDownPayment, step);
                var installmentValue = RoundToNearestStep(
                    (normalizedTotal - roundedTargetDownPayment) / installmentsTailCount,
                    step);

                if (installmentValue < 0m)
                {
                    continue;
                }

                var downPayment = NormalizeMoney(normalizedTotal - (installmentValue * installmentsTailCount));
                if (downPayment <= 0m)
                {
                    continue;
                }

                var downPaymentPercent = (downPayment / normalizedTotal) * 100m;
                var score = Math.Abs(downPaymentPercent - downPaymentTargetPercent);
                if (score < bestScore
                    || (score == bestScore && (bestStep <= 0m || step < bestStep)))
                {
                    bestScore = score;
                    bestStep = step;
                    bestInstallmentValue = NormalizeMoney(installmentValue);
                    bestDownPayment = downPayment;
                }
            }

            if (bestStep <= 0m)
            {
                return BuildEvenInstallmentsByCents(
                    normalizedTotal,
                    SummerWorkflowDomainConstants.PaymentModes.DefaultInstallmentCount);
            }

            var result = new decimal[SummerWorkflowDomainConstants.PaymentModes.DefaultInstallmentCount];
            result[0] = bestDownPayment;
            for (var index = 1; index < result.Length; index++)
            {
                result[index] = bestInstallmentValue;
            }

            return result;
        }

        private static decimal[] BuildEvenInstallmentsByCents(decimal normalizedTotal, int count)
        {
            var safeCount = count > 0 ? count : 1;
            var totalCents = decimal.ToInt64(normalizedTotal * 100m);
            var baseCents = totalCents / safeCount;
            var remainder = totalCents % safeCount;

            var values = new decimal[safeCount];
            for (var index = 0; index < safeCount; index++)
            {
                var cents = baseCents + (index < remainder ? 1 : 0);
                values[index] = cents / 100m;
            }

            return values;
        }

        private static decimal RoundToNearestStep(decimal value, decimal step)
        {
            if (step <= 0m)
            {
                return NormalizeMoney(value);
            }

            var roundedUnits = Math.Round(value / step, 0, MidpointRounding.AwayFromZero);
            return NormalizeMoney(roundedUnits * step);
        }

        private static decimal NormalizeMoney(decimal value)
        {
            if (value <= 0m)
            {
                return 0m;
            }

            return Math.Round(value, 2, MidpointRounding.AwayFromZero);
        }

        private async Task<List<PricingRule>> LoadPricingRulesAsync(
            int seasonYear,
            string? applicationId,
            bool includeInactive,
            CancellationToken cancellationToken)
        {
            var normalizedAppId = NormalizeApplicationId(applicationId);
            var metadataRow = await GetPricingMetadataRowAsync(normalizedAppId, trackChanges: false, cancellationToken);
            var catalogPayload = ParseCatalogPayload((metadataRow?.CdmendTbl ?? string.Empty).Trim());
            return BuildCatalogRecords(catalogPayload, seasonYear, includeInactive);
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
                    .Where(item =>
                        item.ApplicationId == normalizedAppId
                        && item.CdmendTxt == SummerPricingCatalogMend
                        && item.CdmendStat == false)
                    .OrderByDescending(item => item.CdmendSql)
                    .FirstOrDefaultAsync(cancellationToken);

                if (tracked != null)
                {
                    return tracked;
                }

                tracked = await _connectContext.Cdmends
                    .Where(item =>
                        item.ApplicationId == normalizedAppId
                        && item.CdmendTxt == SummerPricingCatalogMend)
                    .OrderByDescending(item => item.CdmendSql)
                    .FirstOrDefaultAsync(cancellationToken);

                if (tracked != null)
                {
                    return tracked;
                }

                tracked = await _connectContext.Cdmends
                    .Where(item =>
                        item.CdmendTxt == SummerPricingCatalogMend
                        && item.CdmendStat == false)
                    .OrderByDescending(item => item.CdmendSql)
                    .FirstOrDefaultAsync(cancellationToken);

                if (tracked != null)
                {
                    return tracked;
                }

                return await _connectContext.Cdmends
                    .Where(item => item.CdmendTxt == SummerPricingCatalogMend)
                    .OrderByDescending(item => item.CdmendSql)
                    .FirstOrDefaultAsync(cancellationToken);
            }

            var untracked = await _connectContext.Cdmends
                .AsNoTracking()
                .Where(item =>
                    item.ApplicationId == normalizedAppId
                    && item.CdmendTxt == SummerPricingCatalogMend
                    && item.CdmendStat == false)
                .OrderByDescending(item => item.CdmendSql)
                .FirstOrDefaultAsync(cancellationToken);

            if (untracked != null)
            {
                return untracked;
            }

            untracked = await _connectContext.Cdmends
                .AsNoTracking()
                .Where(item =>
                    item.ApplicationId == normalizedAppId
                    && item.CdmendTxt == SummerPricingCatalogMend)
                .OrderByDescending(item => item.CdmendSql)
                .FirstOrDefaultAsync(cancellationToken);

            if (untracked != null)
            {
                return untracked;
            }

            untracked = await _connectContext.Cdmends
                .AsNoTracking()
                .Where(item =>
                    item.CdmendTxt == SummerPricingCatalogMend
                    && item.CdmendStat == false)
                .OrderByDescending(item => item.CdmendSql)
                .FirstOrDefaultAsync(cancellationToken);

            if (untracked != null)
            {
                return untracked;
            }

            return await _connectContext.Cdmends
                .AsNoTracking()
                .Where(item => item.CdmendTxt == SummerPricingCatalogMend)
                .OrderByDescending(item => item.CdmendSql)
                .FirstOrDefaultAsync(cancellationToken);
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
                var parsedPayload = JsonSerializer.Deserialize<SummerPricingCatalogPayload>(payload, options)
                    ?? new SummerPricingCatalogPayload();

                if ((parsedPayload.PricingRecords?.Count ?? 0) == 0
                    && TryParseLegacyRecordsKey(payload, options, out var legacyRecords))
                {
                    parsedPayload.PricingRecords = legacyRecords;
                }

                return parsedPayload;
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

        private static bool TryParseLegacyRecordsKey(
            string payload,
            JsonSerializerOptions options,
            out List<SummerPricingRecordPayload> records)
        {
            records = new List<SummerPricingRecordPayload>();
            try
            {
                using var jsonDocument = JsonDocument.Parse(payload);
                if (!jsonDocument.RootElement.TryGetProperty("records", out var recordsElement))
                {
                    return false;
                }

                if (recordsElement.ValueKind != JsonValueKind.Array)
                {
                    return false;
                }

                records = JsonSerializer.Deserialize<List<SummerPricingRecordPayload>>(
                    recordsElement.GetRawText(),
                    options) ?? new List<SummerPricingRecordPayload>();
                return true;
            }
            catch
            {
                records = new List<SummerPricingRecordPayload>();
                return false;
            }
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

                var normalizedWaveCode = NormalizeCodeToken(item.WaveCode);
                var normalizedPeriodKey = NormalizePeriodKey(item.PeriodKey);
                var derivedPeriodKeyFromRange = DerivePeriodKeyFromDateRange(parsedDateFrom, parsedDateTo);
                if (normalizedWaveCode.Length == 0 && derivedPeriodKeyFromRange.Length > 0)
                {
                    normalizedPeriodKey = derivedPeriodKeyFromRange;
                }

                rules.Add(new PricingRule
                {
                    SortOrder = index,
                    PricingConfigId = (item.PricingConfigId ?? string.Empty).Trim(),
                    CategoryId = item.CategoryId,
                    SeasonYear = effectiveSeasonYear,
                    WaveCode = normalizedWaveCode,
                    PeriodKey = normalizedPeriodKey,
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
                var derivedPeriodKeyFromRange = DerivePeriodKeyFromDateRange(dateFrom, dateTo);
                if (normalizedWaveCode.Length == 0 && derivedPeriodKeyFromRange.Length > 0)
                {
                    normalizedPeriodKey = derivedPeriodKeyFromRange;
                }

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

        private static string ResolveNoMatchMessage(
            IReadOnlyCollection<PricingRule> catalogRules,
            int categoryId,
            int seasonYear,
            string waveCode,
            string periodKey,
            DateOnly? waveDate)
        {
            var scopedByCategory = catalogRules
                .Where(rule => rule.CategoryId == categoryId)
                .Where(rule => rule.SeasonYear <= 0 || rule.SeasonYear == seasonYear)
                .ToList();

            if (scopedByCategory.Count == 0)
            {
                return "لا يوجد تسعير للمصيف المختار في الموسم الحالي.";
            }

            var activeRules = scopedByCategory
                .Where(rule => rule.IsActive)
                .ToList();

            if (activeRules.Count == 0)
            {
                return "التسعير غير مفعل للمصيف المختار.";
            }

            if (!string.IsNullOrWhiteSpace(waveCode))
            {
                var hasWaveCompatibleRule = activeRules.Any(rule =>
                    rule.WaveCode.Length == 0
                    || string.Equals(rule.WaveCode, waveCode, StringComparison.OrdinalIgnoreCase));
                if (!hasWaveCompatibleRule)
                {
                    return NoPricingPolicyForSelectedWaveMessage;
                }
            }

            if (periodKey.Length > 0)
            {
                var hasPeriodCompatibleRule = activeRules.Any(rule =>
                    rule.PeriodKey.Length == 0
                    || string.Equals(rule.PeriodKey, periodKey, StringComparison.OrdinalIgnoreCase));
                if (!hasPeriodCompatibleRule)
                {
                    return NoPricingPolicyForSelectedWaveMessage;
                }
            }

            var hasDateScopedRules = activeRules.Any(rule => rule.DateFrom.HasValue || rule.DateTo.HasValue);
            if (hasDateScopedRules && !waveDate.HasValue)
            {
                return "البيانات غير مكتملة لحساب التسعير: تاريخ الفوج غير متاح.";
            }

            if (waveDate.HasValue)
            {
                var hasDateCompatibleRule = activeRules.Any(rule =>
                    !(rule.DateFrom.HasValue || rule.DateTo.HasValue)
                    || IsWaveDateWithinRuleDateRange(rule, waveDate.Value));
                if (!hasDateCompatibleRule)
                {
                    return NoPricingPolicyForSelectedWaveMessage;
                }
            }

            return "لا توجد مطابقة مناسبة لبيانات التسعير المطلوبة. يرجى مراجعة إعدادات التسعير.";
        }

        private static List<Error> ValidateActiveDateRangeOverlaps(
            IReadOnlyCollection<SummerPricingRecordPayload> records)
        {
            var errors = new List<Error>();
            var activeRecords = records
                .Where(item => item.IsActive ?? true)
                .ToList();

            var groups = activeRecords
                .GroupBy(item => string.Join('|', new[]
                {
                    item.CategoryId.ToString(CultureInfo.InvariantCulture),
                    item.SeasonYear.ToString(CultureInfo.InvariantCulture),
                    NormalizeCodeToken(item.WaveCode),
                    NormalizePeriodKey(item.PeriodKey)
                }), StringComparer.OrdinalIgnoreCase);

            foreach (var group in groups)
            {
                var items = group.ToList();
                for (var i = 0; i < items.Count; i += 1)
                {
                    for (var j = i + 1; j < items.Count; j += 1)
                    {
                        if (!DoDateRangesOverlap(items[i], items[j]))
                        {
                            continue;
                        }

                        var firstId = NormalizeCodeToken(items[i].PricingConfigId);
                        var secondId = NormalizeCodeToken(items[j].PricingConfigId);
                        var firstRef = firstId.Length > 0 ? firstId : $"ROW{i + 1}";
                        var secondRef = secondId.Length > 0 ? secondId : $"ROW{j + 1}";

                        errors.Add(new Error
                        {
                            Code = "400",
                            Message = $"يوجد تداخل في نطاقات التاريخ بين قواعد التسعير الفعالة ({firstRef}) و({secondRef}) لنفس المصيف/الموسم/الفترة."
                        });
                    }
                }
            }

            return errors;
        }

        private static bool DoDateRangesOverlap(SummerPricingRecordPayload left, SummerPricingRecordPayload right)
        {
            var leftFrom = ParseDateOnly(left.DateFrom) ?? DateOnly.MinValue;
            var leftTo = ParseDateOnly(left.DateTo) ?? DateOnly.MaxValue;
            var rightFrom = ParseDateOnly(right.DateFrom) ?? DateOnly.MinValue;
            var rightTo = ParseDateOnly(right.DateTo) ?? DateOnly.MaxValue;

            return leftFrom <= rightTo && rightFrom <= leftTo;
        }

        private static string DerivePeriodKeyFromDateRange(DateOnly? dateFrom, DateOnly? dateTo)
        {
            if (!dateFrom.HasValue && !dateTo.HasValue)
            {
                return string.Empty;
            }

            if (dateFrom.HasValue && dateTo.HasValue)
            {
                if (dateFrom.Value > dateTo.Value)
                {
                    return string.Empty;
                }

                var months = EnumerateMonthsInRange(dateFrom.Value, dateTo.Value).Distinct().ToList();
                if (months.Count == 0)
                {
                    return string.Empty;
                }

                if (months.All(month => month == 6 || month == 9))
                {
                    return "JUN_SEP";
                }

                if (months.All(month => month == 7 || month == 8))
                {
                    return "JUL_AUG";
                }

                if (months.Count == 1)
                {
                    return $"M{months[0]:D2}";
                }

                return string.Empty;
            }

            var month = (dateFrom ?? dateTo)!.Value.Month;
            return ResolveMonthPeriodKey(month);
        }

        private static IEnumerable<int> EnumerateMonthsInRange(DateOnly from, DateOnly to)
        {
            var cursor = new DateOnly(from.Year, from.Month, 1);
            var guard = 0;
            while (cursor <= to && guard < 24)
            {
                yield return cursor.Month;
                cursor = cursor.AddMonths(1);
                guard += 1;
            }
        }

        private static string ResolveMonthPeriodKey(int month)
        {
            return month switch
            {
                6 or 9 => "JUN_SEP",
                7 or 8 => "JUL_AUG",
                >= 1 and <= 12 => $"M{month:D2}",
                _ => string.Empty
            };
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

            var hasDateRange = rule.DateFrom.HasValue || rule.DateTo.HasValue;
            if (hasDateRange)
            {
                if (!waveDate.HasValue)
                {
                    return -1;
                }

                if (!IsWaveDateWithinRuleDateRange(rule, waveDate.Value))
                {
                    return -1;
                }
            }

            var usedPeriodFallback = false;
            if (rule.PeriodKey.Length > 0
                && !string.Equals(rule.PeriodKey, periodKey, StringComparison.OrdinalIgnoreCase))
            {
                if (!hasDateRange || !waveDate.HasValue)
                {
                    return -1;
                }

                usedPeriodFallback = true;
            }

            var score = 0;
            if (rule.WaveCode.Length > 0)
            {
                score += 100;
            }

            if (rule.PeriodKey.Length > 0)
            {
                score += usedPeriodFallback ? 5 : 50;
            }

            if (hasDateRange)
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

        private static bool IsWaveDateWithinRuleDateRange(PricingRule rule, DateOnly waveDate)
        {
            if (rule.DateFrom.HasValue && waveDate < rule.DateFrom.Value)
            {
                return false;
            }

            if (rule.DateTo.HasValue && waveDate > rule.DateTo.Value)
            {
                return false;
            }

            return true;
        }

        private static bool IsPeriodFallbackMatch(PricingRule rule, string requestedPeriodKey, DateOnly? waveDate)
        {
            if (rule.PeriodKey.Length == 0 || requestedPeriodKey.Length == 0)
            {
                return false;
            }

            if (string.Equals(rule.PeriodKey, requestedPeriodKey, StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }

            if (!waveDate.HasValue)
            {
                return false;
            }

            if (!(rule.DateFrom.HasValue || rule.DateTo.HasValue))
            {
                return false;
            }

            return IsWaveDateWithinRuleDateRange(rule, waveDate.Value);
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

            return ResolveMonthPeriodKey(waveDate.Value.Month);
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

            var dateOnlyFormats = new[]
            {
                "yyyy-MM-dd",
                "yyyy/MM/dd",
                "dd/MM/yyyy",
                "d/M/yyyy",
                "MM/dd/yyyy",
                "M/d/yyyy",
                "dd-MM-yyyy",
                "d-M-yyyy",
                "MM-dd-yyyy",
                "M-d-yyyy"
            };

            if (DateOnly.TryParseExact(
                value,
                dateOnlyFormats,
                CultureInfo.InvariantCulture,
                DateTimeStyles.AllowWhiteSpaces,
                out var dateOnly))
            {
                return dateOnly;
            }

            if (DateTimeOffset.TryParse(
                value,
                CultureInfo.InvariantCulture,
                DateTimeStyles.AllowWhiteSpaces | DateTimeStyles.RoundtripKind,
                out var dto))
            {
                return ToCairoDate(dto.UtcDateTime);
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
