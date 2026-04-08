using Api.Authorization;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Xunit;

namespace Persistence.Tests;

public class SummerFunctionClaimGuardTests
{
    private const string RequiredFunction = "SummerAdminFunc";
    private const string SummerPricingFunction = "SummerPricingFunc";
    private const string SummerPricingRoleId = "2021";
    private const string SigningKey = "SummerAuthGuardTests_SigningKey_AtLeast_32_Bytes";

    [Fact]
    public void HasRequiredFunction_FromUserClaims_SupportsFuncsClaimType()
    {
        var principal = CreateAuthenticatedPrincipal(
            new Claim("UserId", "emp-100"),
            new Claim("funcs", "OtherFunc|SummerAdminFunc"));

        var result = SummerFunctionClaimGuard.HasRequiredFunction(principal, RequiredFunction);

        Assert.True(result);
    }

    [Fact]
    public void HasRequiredFunction_FromFunctionsHeaderToken_AllowsWhenUserMatches()
    {
        var principal = CreateAuthenticatedPrincipal(new Claim("UserId", "emp-100"));
        var validationParameters = SummerFunctionClaimGuard.BuildTokenValidationParameters(SigningKey)!;
        var functionsToken = CreateSignedToken(SigningKey, new[]
        {
            new Claim("UserId", "emp-100"),
            new Claim("functions", "[\"SummerAdminFunc\",\"AnotherFunc\"]")
        });

        var result = SummerFunctionClaimGuard.HasRequiredFunction(
            principal,
            RequiredFunction,
            functionsToken,
            validationParameters);

        Assert.True(result);
    }

    [Fact]
    public void HasRequiredFunction_FromFunctionsHeaderToken_RejectsWhenUserMismatch()
    {
        var principal = CreateAuthenticatedPrincipal(new Claim("UserId", "emp-100"));
        var validationParameters = SummerFunctionClaimGuard.BuildTokenValidationParameters(SigningKey)!;
        var functionsToken = CreateSignedToken(SigningKey, new[]
        {
            new Claim("UserId", "emp-200"),
            new Claim("functions", "SummerAdminFunc")
        });

        var result = SummerFunctionClaimGuard.HasRequiredFunction(
            principal,
            RequiredFunction,
            functionsToken,
            validationParameters);

        Assert.False(result);
    }

    [Fact]
    public void HasRequiredFunction_FromFunctionsHeaderToken_RejectsWhenSignatureInvalid()
    {
        var principal = CreateAuthenticatedPrincipal(new Claim("UserId", "emp-100"));
        var validationParameters = SummerFunctionClaimGuard.BuildTokenValidationParameters(SigningKey)!;
        var forgedToken = CreateSignedToken("DifferentSigningKey_AtLeast_32_Bytes_123456", new[]
        {
            new Claim("UserId", "emp-100"),
            new Claim("functions", "SummerAdminFunc")
        });

        var result = SummerFunctionClaimGuard.HasRequiredFunction(
            principal,
            RequiredFunction,
            forgedToken,
            validationParameters);

        Assert.False(result);
    }

    [Fact]
    public void HasRequiredFunction_SummerPricingFunc_AllowsRoleFallback_2021()
    {
        var principal = CreateAuthenticatedPrincipal(
            new Claim("UserId", "emp-100"),
            new Claim("RoleId", SummerPricingRoleId));

        var result = SummerFunctionClaimGuard.HasRequiredFunction(principal, SummerPricingFunction);

        Assert.True(result);
    }

    [Fact]
    public void HasRequiredFunction_SummerAdminFunc_DoesNotAllowRole2021WithoutFunctionClaim()
    {
        var principal = CreateAuthenticatedPrincipal(
            new Claim("UserId", "emp-100"),
            new Claim("RoleId", SummerPricingRoleId));

        var result = SummerFunctionClaimGuard.HasRequiredFunction(principal, RequiredFunction);

        Assert.False(result);
    }

    private static ClaimsPrincipal CreateAuthenticatedPrincipal(params Claim[] claims)
    {
        var identity = new ClaimsIdentity(claims, authenticationType: "unit-test");
        return new ClaimsPrincipal(identity);
    }

    private static string CreateSignedToken(string signingKey, IEnumerable<Claim> claims)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(signingKey));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var descriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            Expires = DateTime.UtcNow.AddMinutes(30),
            SigningCredentials = credentials
        };

        var token = new JwtSecurityTokenHandler().CreateToken(descriptor);
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
