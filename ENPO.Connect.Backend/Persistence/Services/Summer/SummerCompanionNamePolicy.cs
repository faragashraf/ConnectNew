using System;
using System.Collections.Generic;
using System.Linq;

namespace Persistence.Services.Summer
{
    public static class SummerCompanionNamePolicy
    {
        public const int MinimumNameParts = 3;

        private static readonly HashSet<string> CompanionNameFieldKinds = new(StringComparer.OrdinalIgnoreCase)
        {
            "SUM2026_CompanionName",
            "FamilyMember_Name",
            "CompanionName"
        };

        public static bool IsCompanionNameFieldKind(string? fieldKind)
        {
            if (string.IsNullOrWhiteSpace(fieldKind))
            {
                return false;
            }

            if (CompanionNameFieldKinds.Contains(fieldKind.Trim()))
            {
                return true;
            }

            var normalizedFieldKind = NormalizeFieldKind(fieldKind);
            return normalizedFieldKind.Contains("name")
                && (normalizedFieldKind.Contains("familymember") || normalizedFieldKind.Contains("companion"));
        }

        public static string NormalizeCompanionName(string? value)
        {
            var parts = (value ?? string.Empty)
                .Trim()
                .Split(new[] { ' ', '\t', '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);

            return parts.Length == 0
                ? string.Empty
                : string.Join(' ', parts);
        }

        public static int CountNameParts(string? value)
        {
            var normalized = NormalizeCompanionName(value);
            if (string.IsNullOrWhiteSpace(normalized))
            {
                return 0;
            }

            return normalized.Split(' ', StringSplitOptions.RemoveEmptyEntries).Length;
        }

        public static bool HasMinimumNameParts(string? value)
        {
            return CountNameParts(value) >= MinimumNameParts;
        }

        private static string NormalizeFieldKind(string? fieldKind)
        {
            if (string.IsNullOrWhiteSpace(fieldKind))
            {
                return string.Empty;
            }

            return string.Concat((fieldKind ?? string.Empty)
                .Trim()
                .ToLowerInvariant()
                .Where(ch => char.IsLetterOrDigit(ch) || (ch >= '\u0600' && ch <= '\u06FF')));
        }
    }
}
