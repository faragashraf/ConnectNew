using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Models.Correspondance;
using Persistence.Data;
using System;
using System.Collections.Generic;
using System.Data;
using System.Globalization;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace Persistence.Services.DynamicSubjects;

public sealed class ReferenceNumberGeneratorService : ISubjectReferenceGenerator
{
    private const int RequestReferenceMaxLength = 50;

    private static readonly JsonSerializerOptions SerializerOptions = new(JsonSerializerDefaults.Web)
    {
        PropertyNameCaseInsensitive = true
    };

    private readonly ConnectContext _connectContext;

    public ReferenceNumberGeneratorService(ConnectContext connectContext)
    {
        _connectContext = connectContext;
    }

    public async Task<string> GenerateAsync(
        int categoryId,
        int messageId,
        IReadOnlyDictionary<string, string?> dynamicFields,
        CancellationToken cancellationToken = default)
    {
        _ = messageId;
        if (categoryId <= 0)
        {
            throw new ReferenceNumberGenerationException("تعذر توليد الرقم المرجعي: النوع غير صالح.");
        }

        var policy = await _connectContext.SubjectReferencePolicies
            .AsNoTracking()
            .FirstOrDefaultAsync(item => item.CategoryId == categoryId, cancellationToken);
        if (policy?.IsActive == false)
        {
            policy = null;
        }
        var resolvedPolicy = ResolvePolicy(categoryId, policy);
        var utcNow = DateTime.UtcNow;
        var separator = NormalizeSeparator(resolvedPolicy.Separator);
        var sequenceKey = BuildSequenceKey(categoryId, resolvedPolicy.ResetPolicy, utcNow);
        var sequenceValue = await GetNextSequenceValueAsync(
            categoryId,
            sequenceKey,
            resolvedPolicy.StartingValue,
            resolvedPolicy.ResetPolicy,
            cancellationToken);
        var formattedSequence = FormatSequence(sequenceValue, resolvedPolicy.SequenceLength);

        var components = new List<string>();
        if (string.Equals(resolvedPolicy.Mode, "custom", StringComparison.Ordinal))
        {
            foreach (var component in resolvedPolicy.Components)
            {
                if (component.Type == "sequence")
                {
                    components.Add(formattedSequence);
                    continue;
                }

                if (component.Type == "year")
                {
                    components.Add(utcNow.ToString("yyyy", CultureInfo.InvariantCulture));
                    continue;
                }

                if (component.Type == "month")
                {
                    components.Add(utcNow.ToString("MM", CultureInfo.InvariantCulture));
                    continue;
                }

                if (component.Type == "day")
                {
                    components.Add(utcNow.ToString("dd", CultureInfo.InvariantCulture));
                    continue;
                }

                if (component.Type == "static_text")
                {
                    var staticValue = Sanitize(component.Value);
                    if (staticValue.Length == 0)
                    {
                        throw new ReferenceNumberGenerationException("سياسة الرقم المرجعي تحتوي نصًا ثابتًا فارغًا.");
                    }

                    components.Add(staticValue);
                    continue;
                }

                if (component.Type == "field")
                {
                    var fieldKey = NormalizeFieldKey(component.FieldKey);
                    if (fieldKey.Length == 0)
                    {
                        throw new ReferenceNumberGenerationException("سياسة الرقم المرجعي تحتوي مكوّن حقل بدون مفتاح.");
                    }

                    if (dynamicFields == null
                        || !dynamicFields.TryGetValue(fieldKey, out var fieldValue)
                        || string.IsNullOrWhiteSpace(fieldValue))
                    {
                        throw new ReferenceNumberGenerationException($"الحقل '{fieldKey}' مطلوب لتوليد الرقم المرجعي ولا يحتوي قيمة.");
                    }

                    var resolvedFieldValue = Sanitize(fieldValue);
                    if (resolvedFieldValue.Length == 0)
                    {
                        throw new ReferenceNumberGenerationException($"قيمة الحقل '{fieldKey}' غير صالحة للاستخدام داخل الرقم المرجعي.");
                    }

                    components.Add(resolvedFieldValue);
                }
            }
        }
        else
        {
            var prefix = Sanitize(resolvedPolicy.Prefix);
            if (prefix.Length > 0)
            {
                components.Add(prefix);
            }

            components.Add(formattedSequence);
        }

        var candidate = string.Join(separator, components.Where(item => item.Length > 0));
        if (candidate.Length == 0)
        {
            throw new ReferenceNumberGenerationException("فشل توليد الرقم المرجعي لأن السياسة الحالية لا تنتج قيمة.");
        }

        if (candidate.Length > RequestReferenceMaxLength)
        {
            throw new ReferenceNumberGenerationException(
                $"القيمة المتوقعة للرقم المرجعي تتجاوز الحد الأقصى ({RequestReferenceMaxLength}) حرفًا. يرجى تعديل السياسة.");
        }

        return candidate;
    }

    private ReferencePolicyState ResolvePolicy(int categoryId, SubjectReferencePolicy? policy)
    {
        var mode = NormalizeMode(policy?.Mode);
        var separator = NormalizeSeparator(policy?.Separator);
        var sequenceLength = policy != null && policy.SequencePaddingLength > 0
            ? Math.Min(policy.SequencePaddingLength, 12)
            : 6;
        var startingValue = policy != null && policy.StartingValue > 0
            ? policy.StartingValue
            : 1;
        var resetPolicy = NormalizeResetPolicy(policy?.SequenceResetScope);
        var prefix = policy?.Prefix ?? $"SUBJ{categoryId}";

        if (!string.Equals(mode, "custom", StringComparison.Ordinal))
        {
            return new ReferencePolicyState
            {
                Mode = "default",
                Prefix = prefix,
                Separator = separator,
                SequenceLength = sequenceLength,
                StartingValue = startingValue,
                ResetPolicy = resetPolicy,
                Components = new List<ReferencePolicyComponent>()
            };
        }

        var customComponents = ParseCustomComponents(policy?.ComponentsJson);
        ValidateCustomComponents(customComponents);
        return new ReferencePolicyState
        {
            Mode = "custom",
            Prefix = prefix,
            Separator = separator,
            SequenceLength = sequenceLength,
            StartingValue = startingValue,
            ResetPolicy = resetPolicy,
            Components = customComponents
        };
    }

    private async Task<long> GetNextSequenceValueAsync(
        int subjectId,
        string sequenceKey,
        long startingValue,
        string resetPolicy,
        CancellationToken cancellationToken)
    {
        var connection = _connectContext.Database.GetDbConnection();
        if (connection.State != ConnectionState.Open)
        {
            await connection.OpenAsync(cancellationToken);
        }

        await using var command = connection.CreateCommand();
        command.CommandText = @"
SET NOCOUNT ON;
DECLARE @Result TABLE ([NextValue] BIGINT);
MERGE [dbo].[ReferenceSequences] WITH (HOLDLOCK) AS target
USING (SELECT @SubjectId AS [SubjectId], @SequenceKey AS [SequenceKey]) AS source
ON target.[SubjectID] = source.[SubjectId]
   AND target.[SequenceKey] = source.[SequenceKey]
WHEN MATCHED THEN
    UPDATE SET
        [CurrentValue] = target.[CurrentValue] + 1,
        [LastModifiedAtUtc] = @UtcNow
WHEN NOT MATCHED THEN
    INSERT
    (
        [SubjectID],
        [SequenceKey],
        [CurrentValue],
        [ResetPolicy],
        [LastResetAtUtc],
        [CreatedAtUtc],
        [LastModifiedAtUtc]
    )
    VALUES
    (
        @SubjectId,
        @SequenceKey,
        @StartingValue,
        @ResetPolicy,
        @UtcNow,
        @UtcNow,
        @UtcNow
    )
OUTPUT inserted.[CurrentValue] INTO @Result([NextValue]);
SELECT TOP (1) [NextValue] FROM @Result;";

        var currentTransaction = _connectContext.Database.CurrentTransaction?.GetDbTransaction();
        if (currentTransaction != null)
        {
            command.Transaction = currentTransaction;
        }

        AddParameter(command, "@SubjectId", DbType.Int32, subjectId);
        AddParameter(command, "@SequenceKey", DbType.String, sequenceKey);
        AddParameter(command, "@StartingValue", DbType.Int64, startingValue);
        AddParameter(command, "@ResetPolicy", DbType.String, resetPolicy);
        AddParameter(command, "@UtcNow", DbType.DateTime2, DateTime.UtcNow);

        var result = await command.ExecuteScalarAsync(cancellationToken);
        if (result == null || result == DBNull.Value)
        {
            throw new ReferenceNumberGenerationException("تعذر الحصول على قيمة مسلسل صالحة لتوليد الرقم المرجعي.");
        }

        return Convert.ToInt64(result, CultureInfo.InvariantCulture);
    }

    private static void AddParameter(IDbCommand command, string name, DbType dbType, object value)
    {
        var parameter = command.CreateParameter();
        parameter.ParameterName = name;
        parameter.DbType = dbType;
        parameter.Value = value;
        command.Parameters.Add(parameter);
    }

    private static string BuildSequenceKey(int categoryId, string resetPolicy, DateTime utcNow)
    {
        if (string.Equals(resetPolicy, "yearly", StringComparison.Ordinal))
        {
            return $"subject-{categoryId}-{utcNow:yyyy}";
        }

        if (string.Equals(resetPolicy, "monthly", StringComparison.Ordinal))
        {
            return $"subject-{categoryId}-{utcNow:yyyy-MM}";
        }

        if (string.Equals(resetPolicy, "daily", StringComparison.Ordinal))
        {
            return $"subject-{categoryId}-{utcNow:yyyy-MM-dd}";
        }

        return $"subject-{categoryId}";
    }

    private static string FormatSequence(long value, int length)
    {
        var safeLength = length < 1 ? 1 : Math.Min(length, 12);
        return value.ToString($"D{safeLength}", CultureInfo.InvariantCulture);
    }

    private static List<ReferencePolicyComponent> ParseCustomComponents(string? rawComponentsJson)
    {
        var payload = (rawComponentsJson ?? string.Empty).Trim();
        if (payload.Length == 0)
        {
            return new List<ReferencePolicyComponent>();
        }

        try
        {
            var parsed = JsonSerializer.Deserialize<List<ReferencePolicyComponentPayload>>(payload, SerializerOptions)
                ?? new List<ReferencePolicyComponentPayload>();
            return parsed.Select(component => new ReferencePolicyComponent
            {
                Type = NormalizeComponentType(component.Type),
                Value = component.Value,
                FieldKey = component.FieldKey ?? component.Value
            }).ToList();
        }
        catch (JsonException)
        {
            throw new ReferenceNumberGenerationException("تنسيق مكونات الرقم المرجعي غير صالح.");
        }
    }

    private static void ValidateCustomComponents(IReadOnlyCollection<ReferencePolicyComponent> components)
    {
        if (components == null || components.Count == 0)
        {
            throw new ReferenceNumberGenerationException("سياسة الرقم المرجعي المخصص لا تحتوي مكونات قابلة للتوليد.");
        }

        if (components.Any(component => string.Equals(component.Type, "invalid", StringComparison.Ordinal)))
        {
            throw new ReferenceNumberGenerationException("سياسة الرقم المرجعي تحتوي نوع مكوّن غير مدعوم.");
        }

        var sequenceCount = components.Count(component => string.Equals(component.Type, "sequence", StringComparison.Ordinal));
        if (sequenceCount == 0)
        {
            throw new ReferenceNumberGenerationException("سياسة الرقم المرجعي المخصص يجب أن تحتوي على مسلسل.");
        }

        if (sequenceCount > 1)
        {
            throw new ReferenceNumberGenerationException("لا يُسمح بتكرار مكوّن المسلسل داخل السياسة المخصصة.");
        }

        var lastComponent = components.Last();
        if (!string.Equals(lastComponent.Type, "sequence", StringComparison.Ordinal))
        {
            throw new ReferenceNumberGenerationException("يجب أن يكون المسلسل آخر مكوّن في السياسة المخصصة.");
        }
    }

    private static string NormalizeMode(string? value)
    {
        var normalized = (value ?? string.Empty).Trim().ToLowerInvariant();
        return normalized == "custom" ? "custom" : "default";
    }

    private static string NormalizeResetPolicy(string? value)
    {
        var normalized = (value ?? string.Empty).Trim().ToLowerInvariant();
        return normalized switch
        {
            "yearly" or "annual" or "year" => "yearly",
            "monthly" or "month" => "monthly",
            "daily" or "day" => "daily",
            _ => "none"
        };
    }

    private static string NormalizeSeparator(string? value)
    {
        if (value == null)
        {
            return "-";
        }

        var normalized = value.Trim();
        if (normalized.Length == 0)
        {
            return string.Empty;
        }

        if (string.Equals(normalized, "none", StringComparison.OrdinalIgnoreCase))
        {
            return string.Empty;
        }

        return normalized switch
        {
            "-" => "-",
            "/" => "/",
            "_" => "_",
            _ => "-"
        };
    }

    private static string NormalizeComponentType(string? value)
    {
        var normalized = (value ?? string.Empty).Trim().ToLowerInvariant();
        return normalized switch
        {
            "static_text" or "static" or "text" => "static_text",
            "field" => "field",
            "year" => "year",
            "month" => "month",
            "day" => "day",
            "sequence" or "seq" => "sequence",
            _ => "invalid"
        };
    }

    private static string NormalizeFieldKey(string? value)
    {
        return (value ?? string.Empty).Trim().ToLowerInvariant();
    }

    private static string Sanitize(string? value)
    {
        var source = (value ?? string.Empty).Trim();
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

        return builder.ToString().Trim('-', '_', '/');
    }

    private sealed class ReferencePolicyState
    {
        public string Mode { get; init; } = "default";

        public string Prefix { get; init; } = string.Empty;

        public string Separator { get; init; } = "-";

        public int SequenceLength { get; init; } = 6;

        public long StartingValue { get; init; } = 1;

        public string ResetPolicy { get; init; } = "none";

        public IReadOnlyList<ReferencePolicyComponent> Components { get; init; } = Array.Empty<ReferencePolicyComponent>();
    }

    private sealed class ReferencePolicyComponent
    {
        public string Type { get; init; } = "static_text";

        public string? Value { get; init; }

        public string? FieldKey { get; init; }
    }

    private sealed class ReferencePolicyComponentPayload
    {
        public string Type { get; set; } = "static_text";

        public string? Value { get; set; }

        public string? FieldKey { get; set; }
    }
}
