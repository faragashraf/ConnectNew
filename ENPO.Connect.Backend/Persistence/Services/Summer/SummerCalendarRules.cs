using System.Globalization;
using System.Text.RegularExpressions;

namespace Persistence.Services.Summer
{
    public static class SummerCalendarRules
    {
        private const int CancellationLockDays = 14;
        private static readonly Regex WaveDateRegex = new(@"(?<!\d)(\d{1,2})/(\d{1,2})/(\d{4})(?!\d)", RegexOptions.Compiled);
        private static readonly TimeZoneInfo CairoTimeZone = ResolveCairoTimeZone();

        private static readonly Dictionary<string, DateOnly> SharedWaveDates2026 = new(StringComparer.OrdinalIgnoreCase)
        {
            { "W01", new DateOnly(2026, 6, 7) },
            { "W02", new DateOnly(2026, 6, 14) },
            { "W03", new DateOnly(2026, 6, 21) },
            { "W04", new DateOnly(2026, 6, 28) },
            { "W05", new DateOnly(2026, 7, 5) },
            { "W06", new DateOnly(2026, 7, 12) },
            { "W07", new DateOnly(2026, 7, 19) },
            { "W08", new DateOnly(2026, 7, 26) },
            { "W09", new DateOnly(2026, 8, 2) },
            { "W10", new DateOnly(2026, 8, 9) },
            { "W11", new DateOnly(2026, 8, 16) },
            { "W12", new DateOnly(2026, 8, 23) },
            { "W13", new DateOnly(2026, 8, 30) },
            { "W14", new DateOnly(2026, 9, 6) },
            { "W15", new DateOnly(2026, 9, 13) },
            { "W16", new DateOnly(2026, 9, 20) }
        };

        private static readonly Dictionary<int, Dictionary<string, DateOnly>> WaveDatesByCategory2026 = new()
        {
            {
                147,
                new Dictionary<string, DateOnly>(StringComparer.OrdinalIgnoreCase)
                {
                    { "W01", new DateOnly(2026, 6, 4) },
                    { "W02", new DateOnly(2026, 6, 11) },
                    { "W03", new DateOnly(2026, 6, 18) },
                    { "W04", new DateOnly(2026, 6, 25) },
                    { "W05", new DateOnly(2026, 7, 2) },
                    { "W06", new DateOnly(2026, 7, 9) },
                    { "W07", new DateOnly(2026, 7, 16) },
                    { "W08", new DateOnly(2026, 7, 23) },
                    { "W09", new DateOnly(2026, 7, 30) },
                    { "W10", new DateOnly(2026, 8, 6) },
                    { "W11", new DateOnly(2026, 8, 13) },
                    { "W12", new DateOnly(2026, 8, 20) },
                    { "W13", new DateOnly(2026, 8, 27) },
                    { "W14", new DateOnly(2026, 9, 3) },
                    { "W15", new DateOnly(2026, 9, 10) },
                    { "W16", new DateOnly(2026, 9, 17) }
                }
            },
            { 148, new Dictionary<string, DateOnly>(SharedWaveDates2026, StringComparer.OrdinalIgnoreCase) },
            { 149, new Dictionary<string, DateOnly>(SharedWaveDates2026, StringComparer.OrdinalIgnoreCase) }
        };

        public static DateTime CalculatePaymentDueUtc(DateTime createdAtUtc)
        {
            return AddBusinessDaysUtc(createdAtUtc, 1);
        }

        public static DateTime AddBusinessDaysUtc(DateTime sourceUtc, int businessDays)
        {
            var normalized = sourceUtc.Kind == DateTimeKind.Utc
                ? sourceUtc
                : DateTime.SpecifyKind(sourceUtc, DateTimeKind.Utc);

            if (businessDays <= 0)
            {
                return normalized;
            }

            var local = TimeZoneInfo.ConvertTimeFromUtc(normalized, CairoTimeZone);
            var result = local;
            var addedDays = 0;
            while (addedDays < businessDays)
            {
                result = result.AddDays(1);
                if (IsBusinessDay(result.DayOfWeek))
                {
                    addedDays += 1;
                }
            }

            return TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(result, DateTimeKind.Unspecified), CairoTimeZone);
        }

        public static bool CanCancel(DateTime nowUtc, DateTime waveStartUtc)
        {
            var lockDateUtc = waveStartUtc.AddDays(-CancellationLockDays);
            return nowUtc <= lockDateUtc;
        }

        public static bool TryResolveWaveStartUtc(int categoryId, int seasonYear, string waveCode, string? waveLabel, out DateTime waveStartUtc)
        {
            if (TryResolveFromCategoryCatalog(categoryId, seasonYear, waveCode, out waveStartUtc))
            {
                return true;
            }

            if (TryParseWaveLabelDateUtc(waveLabel, out waveStartUtc))
            {
                return true;
            }

            waveStartUtc = default;
            return false;
        }

        public static bool TryParseWaveLabelDateUtc(string? waveLabel, out DateTime waveStartUtc)
        {
            waveStartUtc = default;
            var label = (waveLabel ?? string.Empty).Trim();
            if (label.Length == 0)
            {
                return false;
            }

            var match = WaveDateRegex.Match(label);
            if (!match.Success)
            {
                return false;
            }

            if (!int.TryParse(match.Groups[1].Value, NumberStyles.Integer, CultureInfo.InvariantCulture, out var day))
            {
                return false;
            }

            if (!int.TryParse(match.Groups[2].Value, NumberStyles.Integer, CultureInfo.InvariantCulture, out var month))
            {
                return false;
            }

            if (!int.TryParse(match.Groups[3].Value, NumberStyles.Integer, CultureInfo.InvariantCulture, out var year))
            {
                return false;
            }

            if (!DateOnly.TryParseExact($"{day:D2}/{month:D2}/{year:D4}", "dd/MM/yyyy", CultureInfo.InvariantCulture, DateTimeStyles.None, out var date))
            {
                return false;
            }

            waveStartUtc = ToUtcStartOfDay(date);
            return true;
        }

        private static bool TryResolveFromCategoryCatalog(int categoryId, int seasonYear, string waveCode, out DateTime waveStartUtc)
        {
            waveStartUtc = default;
            if (seasonYear != 2026)
            {
                return false;
            }

            if (!WaveDatesByCategory2026.TryGetValue(categoryId, out var categoryCatalog))
            {
                return false;
            }

            if (!categoryCatalog.TryGetValue((waveCode ?? string.Empty).Trim(), out var date))
            {
                return false;
            }

            waveStartUtc = ToUtcStartOfDay(date);
            return true;
        }

        private static DateTime ToUtcStartOfDay(DateOnly localDate)
        {
            var localStart = localDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Unspecified);
            return TimeZoneInfo.ConvertTimeToUtc(localStart, CairoTimeZone);
        }

        private static bool IsBusinessDay(DayOfWeek dayOfWeek)
        {
            return dayOfWeek != DayOfWeek.Friday && dayOfWeek != DayOfWeek.Saturday;
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
    }
}
