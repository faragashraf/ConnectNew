using System.Security.Claims;
using System.Text.Json;

namespace Persistence.Services.DynamicSubjects;

public static class DynamicSubjectsAdminClaimGuard
{
    public const string RequiredRoleId = "2003";
    public const string RequiredFunction = "ConnectSupperAdminFunc";

    private static readonly HashSet<string> SupportedRoleClaimTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "RoleId",
        "roleId",
        "role",
        "roles",
        ClaimTypes.Role
    };

    private static readonly HashSet<string> SupportedFunctionClaimTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "functions",
        "function",
        "func",
        "funcs"
    };

    public static bool HasRequiredRoleClaim(ClaimsPrincipal? user)
    {
        if (user?.Identity?.IsAuthenticated != true)
        {
            return false;
        }

        return HasRequiredClaimToken(user, SupportedRoleClaimTypes, RequiredRoleId)
            || HasRequiredClaimToken(user, SupportedFunctionClaimTypes, RequiredFunction);
    }

    private static bool HasRequiredClaimToken(
        ClaimsPrincipal user,
        HashSet<string> supportedClaimTypes,
        string requiredToken)
    {
        foreach (var claim in user.Claims)
        {
            if (!supportedClaimTypes.Contains(claim.Type))
            {
                continue;
            }

            foreach (var roleToken in ExpandClaimTokens(claim.Value))
            {
                if (string.Equals(roleToken, requiredToken, StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }
            }
        }

        return false;
    }

    private static IEnumerable<string> ExpandClaimTokens(string? claimValue)
    {
        var rawValue = (claimValue ?? string.Empty).Trim();
        if (rawValue.Length == 0)
        {
            return Array.Empty<string>();
        }

        if (rawValue.StartsWith("[", StringComparison.Ordinal))
        {
            try
            {
                using var jsonDocument = JsonDocument.Parse(rawValue);
                if (jsonDocument.RootElement.ValueKind == JsonValueKind.Array)
                {
                    var parsedItems = new List<string>();
                    foreach (var element in jsonDocument.RootElement.EnumerateArray())
                    {
                        var token = element.ValueKind switch
                        {
                            JsonValueKind.String => (element.GetString() ?? string.Empty).Trim(),
                            JsonValueKind.Number => element.ToString().Trim(),
                            JsonValueKind.True => "true",
                            JsonValueKind.False => "false",
                            _ => string.Empty
                        };

                        if (token.Length > 0)
                        {
                            parsedItems.Add(token);
                        }
                    }

                    return parsedItems;
                }
            }
            catch
            {
                // Fall back to delimiter parsing below.
            }
        }

        return rawValue
            .Split(new[] { ',', ';', '|' }, StringSplitOptions.RemoveEmptyEntries)
            .Select(item => item.Trim())
            .Where(item => item.Length > 0)
            .ToArray();
    }
}
