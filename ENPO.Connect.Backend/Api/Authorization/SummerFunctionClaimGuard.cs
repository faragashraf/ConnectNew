using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using Microsoft.IdentityModel.Tokens;

namespace Api.Authorization
{
    public static class SummerFunctionClaimGuard
    {
        private static readonly JwtSecurityTokenHandler JwtHandler = new();
        private static readonly HashSet<string> SupportedRoleClaimTypes = new(StringComparer.OrdinalIgnoreCase)
        {
            "RoleId",
            "roleId",
            "role",
            "roles",
            "RoleIds",
            "roleIds",
            ClaimTypes.Role
        };
        private static readonly IReadOnlyDictionary<string, string[]> FunctionRoleFallbackMap =
            new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase)
            {
                // Summer pricing admins in current production authorization matrix.
                ["SummerGeneralManagerFunc"] = new[] { "2021" }
            };
        private static readonly string[] UserIdClaimTypes =
        {
            "UserId",
            "userId",
            "userid",
            ClaimTypes.NameIdentifier,
            "sub",
            "oid",
            "sid",
            "nameid",
            "unique_name",
            "preferred_username",
            "userName",
            "username",
            "UserEmail",
            "userEmail",
            "email",
            ClaimTypes.Email
        };

        public static TokenValidationParameters? BuildTokenValidationParameters(
            string? signingKey,
            string? issuer = null,
            string? audience = null)
        {
            var normalizedSigningKey = (signingKey ?? string.Empty).Trim();
            if (normalizedSigningKey.Length == 0)
            {
                return null;
            }

            return new TokenValidationParameters
            {
                ValidateIssuer = false,
                ValidateAudience = false,
                ValidateLifetime = true,
                ValidateIssuerSigningKey = true,
                ClockSkew = TimeSpan.FromSeconds(30),
                ValidIssuer = issuer,
                ValidAudience = audience,
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(normalizedSigningKey))
            };
        }

        public static bool HasRequiredFunction(
            ClaimsPrincipal? user,
            string requiredFunction,
            string? functionsToken = null,
            TokenValidationParameters? tokenValidationParameters = null)
        {
            var normalizedRequiredFunction = (requiredFunction ?? string.Empty).Trim();
            if (normalizedRequiredFunction.Length == 0)
            {
                return false;
            }

            if (HasRequiredFunction(user, normalizedRequiredFunction))
            {
                return true;
            }

            if (string.IsNullOrWhiteSpace(functionsToken)
                || tokenValidationParameters == null
                || !TryValidateFunctionsToken(functionsToken, tokenValidationParameters, out var functionsPrincipal)
                || !BelongsToSameUser(user, functionsPrincipal))
            {
                return false;
            }

            return HasRequiredFunction(functionsPrincipal, normalizedRequiredFunction);
        }

        public static bool HasRequiredFunction(ClaimsPrincipal? user, string requiredFunction)
        {
            var normalizedRequiredFunction = (requiredFunction ?? string.Empty).Trim();
            if (normalizedRequiredFunction.Length == 0 || user?.Claims == null)
            {
                return false;
            }

            foreach (var claim in user.Claims)
            {
                if (string.Equals(
                    (claim.Type ?? string.Empty).Trim(),
                    normalizedRequiredFunction,
                    StringComparison.OrdinalIgnoreCase))
                {
                    return IsTruthyValue(claim.Value);
                }

                foreach (var token in ExpandClaimTokens(claim.Value))
                {
                    if (string.Equals(token, normalizedRequiredFunction, StringComparison.OrdinalIgnoreCase))
                    {
                        return true;
                    }
                }
            }

            if (HasRequiredRoleFallback(user, normalizedRequiredFunction))
            {
                return true;
            }

            return false;
        }

        public static bool HasRequiredRole(ClaimsPrincipal? user, string requiredRoleId)
        {
            var normalizedRequiredRoleId = (requiredRoleId ?? string.Empty).Trim();
            if (normalizedRequiredRoleId.Length == 0 || user?.Claims == null)
            {
                return false;
            }

            foreach (var claim in user.Claims)
            {
                if (!SupportedRoleClaimTypes.Contains(claim.Type))
                {
                    continue;
                }

                foreach (var roleToken in ExpandClaimTokens(claim.Value))
                {
                    if (string.Equals(roleToken, normalizedRequiredRoleId, StringComparison.OrdinalIgnoreCase))
                    {
                        return true;
                    }
                }
            }

            return false;
        }

        private static bool HasRequiredRoleFallback(ClaimsPrincipal? user, string requiredFunction)
        {
            if (!FunctionRoleFallbackMap.TryGetValue(requiredFunction, out var roleIds) || roleIds.Length == 0)
            {
                return false;
            }

            return roleIds.Any(roleId => HasRequiredRole(user, roleId));
        }

        private static bool TryValidateFunctionsToken(
            string rawToken,
            TokenValidationParameters tokenValidationParameters,
            out ClaimsPrincipal principal)
        {
            principal = new ClaimsPrincipal();
            var normalizedToken = NormalizeBearerToken(rawToken);
            if (normalizedToken.Length == 0)
            {
                return false;
            }

            try
            {
                principal = JwtHandler.ValidateToken(normalizedToken, tokenValidationParameters, out _);
                return principal.Identity?.IsAuthenticated == true;
            }
            catch
            {
                return false;
            }
        }

        private static string NormalizeBearerToken(string? rawToken)
        {
            var token = (rawToken ?? string.Empty).Trim();
            const string bearerPrefix = "Bearer ";
            if (token.StartsWith(bearerPrefix, StringComparison.OrdinalIgnoreCase))
            {
                token = token.Substring(bearerPrefix.Length).Trim();
            }

            return token;
        }

        private static bool BelongsToSameUser(ClaimsPrincipal? authenticatedUser, ClaimsPrincipal functionsPrincipal)
        {
            if (authenticatedUser?.Identity?.IsAuthenticated != true)
            {
                return false;
            }

            var authenticatedUserTokens = ResolveIdentityTokens(authenticatedUser);
            if (authenticatedUserTokens.Count == 0)
            {
                return false;
            }

            var functionsTokenUserTokens = ResolveIdentityTokens(functionsPrincipal);
            if (functionsTokenUserTokens.Count == 0)
            {
                // Some legacy function tokens contain only permission claims.
                // We still trust them only after successful signature/lifetime validation.
                return true;
            }

            return authenticatedUserTokens.Overlaps(functionsTokenUserTokens);
        }

        private static HashSet<string> ResolveIdentityTokens(ClaimsPrincipal? principal)
        {
            var tokens = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            if (principal?.Claims == null)
            {
                return tokens;
            }

            foreach (var claimType in UserIdClaimTypes)
            {
                foreach (var claim in principal.Claims.Where(claim =>
                             string.Equals(claim.Type, claimType, StringComparison.OrdinalIgnoreCase)))
                {
                    foreach (var token in ExpandClaimTokens(claim.Value))
                    {
                        var normalized = NormalizeIdentityToken(token);
                        if (normalized.Length > 0)
                        {
                            tokens.Add(normalized);
                        }
                    }
                }
            }

            foreach (var claim in principal.Claims)
            {
                if (!IsLikelyIdentityClaimType(claim.Type))
                {
                    continue;
                }

                foreach (var token in ExpandClaimTokens(claim.Value))
                {
                    var normalized = NormalizeIdentityToken(token);
                    if (normalized.Length > 0)
                    {
                        tokens.Add(normalized);
                    }
                }
            }

            return tokens;
        }

        private static bool IsLikelyIdentityClaimType(string? claimType)
        {
            var normalized = (claimType ?? string.Empty).Trim().ToLowerInvariant();
            if (normalized.Length == 0)
            {
                return false;
            }

            return normalized is "sub" or "upn"
                   || normalized.Contains("userid", StringComparison.Ordinal)
                   || normalized.Contains("username", StringComparison.Ordinal)
                   || normalized.Contains("nameidentifier", StringComparison.Ordinal)
                   || normalized.Contains("email", StringComparison.Ordinal)
                   || normalized is "oid" or "sid";
        }

        private static string NormalizeIdentityToken(string? rawValue)
        {
            var value = (rawValue ?? string.Empty).Trim();
            if (value.Length == 0)
            {
                return string.Empty;
            }

            return value;
        }

        private static IEnumerable<string> ExpandClaimTokens(string? claimValue)
        {
            var rawValue = (claimValue ?? string.Empty).Trim();
            if (rawValue.Length == 0)
            {
                return Array.Empty<string>();
            }

            var tokens = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var parsedAsJson = false;
            if (rawValue.StartsWith("[", StringComparison.Ordinal)
                || rawValue.StartsWith("{", StringComparison.Ordinal))
            {
                try
                {
                    using var jsonDocument = JsonDocument.Parse(rawValue);
                    parsedAsJson = true;
                    CollectTokensFromJsonElement(jsonDocument.RootElement, tokens);
                }
                catch
                {
                    parsedAsJson = false;
                }
            }

            if (!parsedAsJson)
            {
                CollectTokensFromRawText(rawValue, tokens);
            }

            return tokens.ToArray();
        }

        private static void CollectTokensFromJsonElement(JsonElement element, HashSet<string> tokens)
        {
            switch (element.ValueKind)
            {
                case JsonValueKind.String:
                    CollectTokensFromRawText(element.GetString(), tokens);
                    return;
                case JsonValueKind.Number:
                    tokens.Add(element.ToString());
                    return;
                case JsonValueKind.True:
                    tokens.Add("true");
                    return;
                case JsonValueKind.False:
                    tokens.Add("false");
                    return;
                case JsonValueKind.Array:
                    foreach (var item in element.EnumerateArray())
                    {
                        CollectTokensFromJsonElement(item, tokens);
                    }
                    return;
                case JsonValueKind.Object:
                    foreach (var property in element.EnumerateObject())
                    {
                        if (IsTruthyElement(property.Value))
                        {
                            CollectTokensFromRawText(property.Name, tokens);
                        }

                        CollectTokensFromJsonElement(property.Value, tokens);
                    }
                    return;
            }
        }

        private static void CollectTokensFromRawText(string? rawValue, HashSet<string> tokens)
        {
            var raw = (rawValue ?? string.Empty).Trim();
            if (raw.Length == 0)
            {
                return;
            }

            var normalizedRaw = raw.Trim('"', '\'');
            if (normalizedRaw.Length > 0)
            {
                tokens.Add(normalizedRaw);
            }

            foreach (var token in normalizedRaw
                .Split(new[] { ',', ';', '|', ' ' }, StringSplitOptions.RemoveEmptyEntries)
                .Select(item => item.Trim().Trim('"', '\''))
                .Where(item => item.Length > 0))
            {
                tokens.Add(token);
            }
        }

        private static bool IsTruthyElement(JsonElement element)
        {
            return element.ValueKind switch
            {
                JsonValueKind.True => true,
                JsonValueKind.Number => element.TryGetDecimal(out var value) && value > 0m,
                JsonValueKind.String => IsTruthyValue(element.GetString()),
                JsonValueKind.Array => element.GetArrayLength() > 0,
                JsonValueKind.Object => element.EnumerateObject().Any(),
                _ => false
            };
        }

        private static bool IsTruthyValue(string? rawValue)
        {
            var token = (rawValue ?? string.Empty).Trim();
            if (token.Length == 0)
            {
                return true;
            }

            return token.Equals("1", StringComparison.OrdinalIgnoreCase)
                || token.Equals("true", StringComparison.OrdinalIgnoreCase)
                || token.Equals("yes", StringComparison.OrdinalIgnoreCase)
                || token.Equals("y", StringComparison.OrdinalIgnoreCase)
                || token.Equals("نعم", StringComparison.OrdinalIgnoreCase);
        }
    }
}
