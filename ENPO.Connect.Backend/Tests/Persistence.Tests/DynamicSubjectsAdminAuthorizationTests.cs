using Persistence.Services.DynamicSubjects;
using System.Security.Claims;
using Xunit;

namespace Persistence.Tests;

public class DynamicSubjectsAdminAuthorizationTests
{
    [Fact]
    public void Rejects_WhenUserIsNull()
    {
        var result = DynamicSubjectsAdminClaimGuard.HasRequiredRoleClaim(null);

        Assert.False(result);
    }

    [Fact]
    public void Rejects_WhenIdentityIsUnauthenticated()
    {
        var principal = new ClaimsPrincipal(new ClaimsIdentity(new[]
        {
            new Claim("RoleId", DynamicSubjectsAdminClaimGuard.RequiredRoleId)
        }));

        var result = DynamicSubjectsAdminClaimGuard.HasRequiredRoleClaim(principal);

        Assert.False(result);
    }

    [Theory]
    [InlineData("RoleId")]
    [InlineData("roleId")]
    [InlineData("role")]
    [InlineData("roles")]
    public void Allows_WhenRequiredRoleExistsAsSingleToken(string claimType)
    {
        var principal = AuthenticatedPrincipal(new Claim(claimType, DynamicSubjectsAdminClaimGuard.RequiredRoleId));

        var result = DynamicSubjectsAdminClaimGuard.HasRequiredRoleClaim(principal);

        Assert.True(result);
    }

    [Theory]
    [InlineData("RoleId", "1001,2003")]
    [InlineData("roles", "1001; 2003")]
    [InlineData("role", "1001|2003")]
    [InlineData("roleId", "1001, 1002, 2003")]
    public void Allows_WhenRequiredRoleExistsInDelimitedClaim(string claimType, string claimValue)
    {
        var principal = AuthenticatedPrincipal(new Claim(claimType, claimValue));

        var result = DynamicSubjectsAdminClaimGuard.HasRequiredRoleClaim(principal);

        Assert.True(result);
    }

    [Theory]
    [InlineData("[\"1001\", \"2003\"]")]
    [InlineData("[1001, 2003]")]
    public void Allows_WhenRequiredRoleExistsInJsonArrayClaim(string claimValue)
    {
        var principal = AuthenticatedPrincipal(new Claim("roles", claimValue));

        var result = DynamicSubjectsAdminClaimGuard.HasRequiredRoleClaim(principal);

        Assert.True(result);
    }

    [Fact]
    public void Rejects_WhenRequiredRoleIsAbsent()
    {
        var principal = AuthenticatedPrincipal(
            new Claim("RoleId", "1001"),
            new Claim("roles", "[\"1002\", \"1004\"]"));

        var result = DynamicSubjectsAdminClaimGuard.HasRequiredRoleClaim(principal);

        Assert.False(result);
    }

    private static ClaimsPrincipal AuthenticatedPrincipal(params Claim[] claims)
    {
        var identity = new ClaimsIdentity(claims, authenticationType: "unit-test");
        return new ClaimsPrincipal(identity);
    }
}
