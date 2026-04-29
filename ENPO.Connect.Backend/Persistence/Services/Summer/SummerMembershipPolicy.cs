using System.Linq;

namespace Persistence.Services.Summer;

public static class SummerMembershipPolicy
{
    public const decimal WorkerInsuranceAmount = 500m;
    public const decimal NonWorkerInsuranceAmount = 1000m;

    public static string ResolveMembershipType(string? requestedMembershipType, bool allowAdminSelection)
    {
        if (!allowAdminSelection)
        {
            return SummerWorkflowDomainConstants.MembershipTypes.Worker;
        }

        return NormalizeMembershipType(requestedMembershipType);
    }

    public static string NormalizeMembershipType(string? rawMembershipType)
    {
        var raw = (rawMembershipType ?? string.Empty).Trim();
        if (raw.Length == 0)
        {
            return SummerWorkflowDomainConstants.MembershipTypes.Worker;
        }

        var token = string.Concat(raw
            .ToUpperInvariant()
            .Where(ch => char.IsLetterOrDigit(ch)));

        if (token is "NONWORKERMEMBER" or "NONWORKER" or "NOTWORKERMEMBER")
        {
            return SummerWorkflowDomainConstants.MembershipTypes.NonWorker;
        }

        if (token is "WORKERMEMBER" or "WORKER")
        {
            return SummerWorkflowDomainConstants.MembershipTypes.Worker;
        }

        var normalizedArabic = string.Concat(raw
            .Replace("أ", "ا", System.StringComparison.Ordinal)
            .Replace("إ", "ا", System.StringComparison.Ordinal)
            .Replace("آ", "ا", System.StringComparison.Ordinal)
            .Where(ch => !char.IsWhiteSpace(ch)));

        if (normalizedArabic.Contains("غيرعامل", System.StringComparison.Ordinal))
        {
            return SummerWorkflowDomainConstants.MembershipTypes.NonWorker;
        }

        if (normalizedArabic.Contains("عامل", System.StringComparison.Ordinal))
        {
            return SummerWorkflowDomainConstants.MembershipTypes.Worker;
        }

        return SummerWorkflowDomainConstants.MembershipTypes.Worker;
    }

    public static decimal ResolveInsuranceAmount(string membershipType)
    {
        return string.Equals(
            membershipType,
            SummerWorkflowDomainConstants.MembershipTypes.NonWorker,
            System.StringComparison.OrdinalIgnoreCase)
            ? NonWorkerInsuranceAmount
            : WorkerInsuranceAmount;
    }

    public static string ResolveMembershipLabel(string membershipType)
    {
        return string.Equals(
            membershipType,
            SummerWorkflowDomainConstants.MembershipTypes.NonWorker,
            System.StringComparison.OrdinalIgnoreCase)
            ? "عضو غير عامل"
            : "عضو عامل";
    }
}
