using System.Text;
using Microsoft.Extensions.Options;
using Models.DTO.Common;

namespace Persistence.Services.Summer;

public class SummerBookingBlacklistService
{
    private readonly IOptionsMonitor<ResortBookingBlacklistOptions> _optionsMonitor;

    public SummerBookingBlacklistService(IOptionsMonitor<ResortBookingBlacklistOptions> optionsMonitor)
    {
        _optionsMonitor = optionsMonitor;
    }

    public bool IsBlocked(string? fileNumber)
    {
        var normalizedCandidate = NormalizeFileNumber(fileNumber);
        if (normalizedCandidate.Length == 0)
        {
            return false;
        }

        return GetNormalizedBlockedSet().Contains(normalizedCandidate);
    }

    public IReadOnlyCollection<string> GetNormalizedBlockedFileNumbers()
    {
        return GetNormalizedBlockedSet().ToList();
    }

    public static string NormalizeFileNumber(string? fileNumber)
    {
        if (string.IsNullOrWhiteSpace(fileNumber))
        {
            return string.Empty;
        }

        var trimmed = fileNumber.Trim();
        if (trimmed.Length == 0)
        {
            return string.Empty;
        }

        var builder = new StringBuilder(trimmed.Length);
        foreach (var value in trimmed)
        {
            if (char.IsWhiteSpace(value))
            {
                continue;
            }

            builder.Append(NormalizeDigit(value));
        }

        return builder
            .ToString()
            .Trim()
            .ToUpperInvariant();
    }

    private HashSet<string> GetNormalizedBlockedSet()
    {
        var set = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var blockedFileNumbers = _optionsMonitor.CurrentValue?.BlockedFileNumbers ?? new List<string>();
        foreach (var blockedFileNumber in blockedFileNumbers)
        {
            var normalized = NormalizeFileNumber(blockedFileNumber);
            if (normalized.Length > 0)
            {
                set.Add(normalized);
            }
        }

        return set;
    }

    private static char NormalizeDigit(char value)
    {
        if (value >= '\u0660' && value <= '\u0669')
        {
            return (char)('0' + (value - '\u0660'));
        }

        if (value >= '\u06F0' && value <= '\u06F9')
        {
            return (char)('0' + (value - '\u06F0'));
        }

        return value;
    }
}
