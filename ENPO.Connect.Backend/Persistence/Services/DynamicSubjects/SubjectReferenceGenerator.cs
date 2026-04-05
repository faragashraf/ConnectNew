using Microsoft.EntityFrameworkCore;
using Models.Correspondance;
using Persistence.Data;
using Persistence.HelperServices;
using System;
using System.Collections.Concurrent;
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
    private const int RequestReferenceMaxLength = 50;

    private static readonly Regex SplitRegex = new("[,;|]", RegexOptions.Compiled);
    private static readonly ConcurrentDictionary<string, byte> EnsuredSequences = new(StringComparer.OrdinalIgnoreCase);
    private static readonly SemaphoreSlim EnsureSequenceLock = new(1, 1);

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
        var contextTokens = await BuildContextTokensAsync(categoryId, cancellationToken);

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

        var prefix = ResolveTemplateTokens((policy?.Prefix ?? $"SUBJ{categoryId}").Trim(), contextTokens);
        if (prefix.Length > 0)
        {
            components.Add(Sanitize(prefix, 30));
        }

        var configuredKeys = ParseSourceKeys(policy?.SourceFieldKeys);
        foreach (var sourceKey in configuredKeys)
        {
            if (!TryResolveComponentValue(sourceKey, map, contextTokens, out var rawValue))
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
            var sequenceName = NormalizeSequenceName(
                ResolveTemplateTokens((policy?.SequenceName ?? string.Empty).Trim(), contextTokens));

            if (sequenceName.Length > 0
                && !string.Equals(sequenceName, "Seq_Tickets", StringComparison.OrdinalIgnoreCase))
            {
                try
                {
                    await EnsureSequenceExistsAsync(sequenceName, cancellationToken);
                    sequenceValue = _helperService.GetSequenceNextValue(sequenceName);
                }
                catch
                {
                    // Fail-safe to keep request creation alive even if sequence DDL/DML is restricted.
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
        if (candidate.Length > RequestReferenceMaxLength)
        {
            candidate = candidate[..RequestReferenceMaxLength];
        }

        var exists = await _connectContext.Messages
            .AsNoTracking()
            .AnyAsync(message => message.RequestRef == candidate && message.MessageId != messageId, cancellationToken);

        if (exists)
        {
            var suffix = messageId.ToString(CultureInfo.InvariantCulture);
            var maxHeadLength = Math.Max(1, RequestReferenceMaxLength - suffix.Length - separator.Length);
            var head = candidate.Length > maxHeadLength
                ? candidate[..maxHeadLength]
                : candidate;
            candidate = string.Concat(head, separator, suffix);
        }

        return candidate;
    }

    private static bool TryResolveComponentValue(
        string key,
        IReadOnlyDictionary<string, string?> dynamicFields,
        IReadOnlyDictionary<string, string> contextTokens,
        out string? value)
    {
        if (dynamicFields.TryGetValue(key, out value))
        {
            return true;
        }

        return contextTokens.TryGetValue(key, out value);
    }

    private async Task<Dictionary<string, string>> BuildContextTokensAsync(int categoryId, CancellationToken cancellationToken)
    {
        var categoryRows = await _connectContext.Cdcategories
            .AsNoTracking()
            .Select(item => new { item.CatId, item.CatParent, item.ApplicationId })
            .ToListAsync(cancellationToken);
        var categoryMap = categoryRows.ToDictionary(item => item.CatId, item => (item.CatParent, item.ApplicationId));
        categoryMap.TryGetValue(categoryId, out var category);

        var topParentId = ResolveTopParentId(categoryId, categoryMap);
        var applicationId = (category.ApplicationId ?? string.Empty).Trim();
        if (applicationId.Length == 0)
        {
            applicationId = "60";
        }

        return new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["ApplicationId"] = applicationId,
            ["TopParentId"] = topParentId.ToString(CultureInfo.InvariantCulture),
            ["$ApplicationId"] = applicationId,
            ["$TopParentId"] = topParentId.ToString(CultureInfo.InvariantCulture)
        };
    }

    private static int ResolveTopParentId(
        int categoryId,
        IReadOnlyDictionary<int, (int CatParent, string? ApplicationId)> categoryMap)
    {
        var cursor = categoryId;
        var safety = 0;
        while (safety++ < 150 && categoryMap.TryGetValue(cursor, out var row))
        {
            if (row.CatParent <= 0 || !categoryMap.ContainsKey(row.CatParent))
            {
                return cursor;
            }

            cursor = row.CatParent;
        }

        return categoryId;
    }

    private static string ResolveTemplateTokens(string template, IReadOnlyDictionary<string, string> tokens)
    {
        var result = template;
        foreach (var token in tokens)
        {
            result = result.Replace($"{{{token.Key.TrimStart('$')}}}", token.Value ?? string.Empty, StringComparison.OrdinalIgnoreCase);
        }

        return result;
    }

    private static string NormalizeSequenceName(string sequenceName)
    {
        var source = (sequenceName ?? string.Empty).Trim();
        if (source.Length == 0)
        {
            return string.Empty;
        }

        var builder = new StringBuilder(source.Length);
        foreach (var ch in source)
        {
            if (char.IsLetterOrDigit(ch) || ch == '_')
            {
                builder.Append(ch);
            }
        }

        var normalized = builder.ToString();
        if (normalized.Length == 0)
        {
            return string.Empty;
        }

        if (!(char.IsLetter(normalized[0]) || normalized[0] == '_'))
        {
            normalized = $"Seq_{normalized}";
        }

        return normalized.Length > 80 ? normalized[..80] : normalized;
    }

    private async Task EnsureSequenceExistsAsync(string sequenceName, CancellationToken cancellationToken)
    {
        if (EnsuredSequences.ContainsKey(sequenceName))
        {
            return;
        }

        await EnsureSequenceLock.WaitAsync(cancellationToken);
        try
        {
            if (EnsuredSequences.ContainsKey(sequenceName))
            {
                return;
            }

            await _connectContext.Database.ExecuteSqlInterpolatedAsync($@"
DECLARE @SequenceName sysname = {sequenceName};
IF @SequenceName IS NOT NULL AND LTRIM(RTRIM(@SequenceName)) <> N''
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM sys.sequences
        WHERE [name] = @SequenceName
          AND [schema_id] = SCHEMA_ID(N'dbo')
    )
    BEGIN
        DECLARE @Sql nvarchar(max) = N'CREATE SEQUENCE [dbo].[' + REPLACE(@SequenceName, N']', N']]') + N'] AS BIGINT START WITH 1 INCREMENT BY 1';
        BEGIN TRY
            EXEC (@Sql);
        END TRY
        BEGIN CATCH
            IF ERROR_NUMBER() <> 2714
                THROW;
        END CATCH
    END
END", cancellationToken);

            EnsuredSequences.TryAdd(sequenceName, 0);
        }
        finally
        {
            EnsureSequenceLock.Release();
        }
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
