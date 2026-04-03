using Microsoft.EntityFrameworkCore;
using Models.Correspondance;
using Persistence.Data;
using Persistence.HelperServices;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;

namespace Persistence.Services.DynamicSubjects;

public sealed class SubjectReferenceGenerator : ISubjectReferenceGenerator
{
    private static readonly Regex SplitRegex = new("[,;|]", RegexOptions.Compiled);

    private readonly ConnectContext _connectContext;
    private readonly helperService _helperService;

    public SubjectReferenceGenerator(ConnectContext connectContext, helperService helperService)
    {
        _connectContext = connectContext;
        _helperService = helperService;
    }

    public async Task<string> GenerateAsync(
        int categoryId,
        int messageId,
        IReadOnlyDictionary<string, string?> dynamicFields,
        CancellationToken cancellationToken = default)
    {
        var policy = await _connectContext.SubjectReferencePolicies
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.CategoryId == categoryId && item.IsActive, cancellationToken);

        var components = new List<string>();
        var map = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);
        if (dynamicFields != null)
        {
            foreach (var pair in dynamicFields)
            {
                map[pair.Key] = pair.Value;
            }
        }

        var separator = (policy?.Separator ?? "-").Trim();
        if (separator.Length == 0)
        {
            separator = "-";
        }

        var prefix = (policy?.Prefix ?? $"SUBJ{categoryId}").Trim();
        if (prefix.Length > 0)
        {
            components.Add(Sanitize(prefix, 30));
        }

        var configuredKeys = ParseSourceKeys(policy?.SourceFieldKeys);
        foreach (var sourceKey in configuredKeys)
        {
            if (!map.TryGetValue(sourceKey, out var rawValue))
            {
                continue;
            }

            var normalized = Sanitize(rawValue, 25);
            if (normalized.Length > 0)
            {
                components.Add(normalized);
            }
        }

        if (policy?.IncludeYear != false)
        {
            components.Add(DateTime.UtcNow.ToString("yyyy", CultureInfo.InvariantCulture));
        }

        if (policy?.UseSequence != false)
        {
            var sequenceValue = messageId;
            var sequenceName = (policy?.SequenceName ?? string.Empty).Trim();
            if (sequenceName.Length > 0
                && !string.Equals(sequenceName, "Seq_Tickets", StringComparison.OrdinalIgnoreCase))
            {
                try
                {
                    sequenceValue = _helperService.GetSequenceNextValue(sequenceName);
                }
                catch
                {
                    sequenceValue = messageId;
                }
            }

            components.Add(sequenceValue.ToString(CultureInfo.InvariantCulture));
        }

        if (components.Count == 0)
        {
            components.Add($"SUBJ{categoryId}");
            components.Add(DateTime.UtcNow.ToString("yyyy", CultureInfo.InvariantCulture));
            components.Add(messageId.ToString(CultureInfo.InvariantCulture));
        }

        var candidate = string.Join(separator, components.Where(item => item.Length > 0));
        if (candidate.Length > 100)
        {
            candidate = candidate[..100];
        }

        var exists = await _connectContext.Messages
            .AsNoTracking()
            .AnyAsync(message => message.RequestRef == candidate && message.MessageId != messageId, cancellationToken);

        if (exists)
        {
            var suffix = messageId.ToString(CultureInfo.InvariantCulture);
            var maxHeadLength = Math.Max(1, 100 - suffix.Length - separator.Length);
            var head = candidate.Length > maxHeadLength
                ? candidate[..maxHeadLength]
                : candidate;
            candidate = string.Concat(head, separator, suffix);
        }

        return candidate;
    }

    private static List<string> ParseSourceKeys(string? sourceFieldKeys)
    {
        if (string.IsNullOrWhiteSpace(sourceFieldKeys))
        {
            return new List<string>();
        }

        return SplitRegex.Split(sourceFieldKeys)
            .Select(key => (key ?? string.Empty).Trim())
            .Where(key => key.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    private static string Sanitize(string? input, int maxLength)
    {
        var source = (input ?? string.Empty).Trim();
        if (source.Length == 0)
        {
            return string.Empty;
        }

        var builder = new StringBuilder(source.Length);
        foreach (var ch in source)
        {
            if (char.IsLetterOrDigit(ch))
            {
                builder.Append(ch);
                continue;
            }

            if (ch == '-' || ch == '_' || ch == '/')
            {
                builder.Append(ch);
            }
        }

        var result = builder.ToString().Trim('-', '_', '/');
        if (result.Length > maxLength)
        {
            result = result[..maxLength];
        }

        return result;
    }
}
