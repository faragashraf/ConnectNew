using Persistence.Services.Summer;
using Xunit;

namespace Persistence.Tests;

public class SummerMembershipPolicyTests
{
    [Fact]
    public void ResolveMembershipType_WhenOverrideIsNotAllowed_ForcesWorkerMember()
    {
        var resolved = SummerMembershipPolicy.ResolveMembershipType(
            SummerWorkflowDomainConstants.MembershipTypes.NonWorker,
            allowAdminSelection: false);

        Assert.Equal(SummerWorkflowDomainConstants.MembershipTypes.Worker, resolved);
    }

    [Fact]
    public void ResolveMembershipType_WhenOverrideIsAllowed_AcceptsNonWorkerMember()
    {
        var resolved = SummerMembershipPolicy.ResolveMembershipType(
            SummerWorkflowDomainConstants.MembershipTypes.NonWorker,
            allowAdminSelection: true);

        Assert.Equal(SummerWorkflowDomainConstants.MembershipTypes.NonWorker, resolved);
    }

    [Fact]
    public void NormalizeMembershipType_AcceptsArabicLabels()
    {
        Assert.Equal(
            SummerWorkflowDomainConstants.MembershipTypes.Worker,
            SummerMembershipPolicy.NormalizeMembershipType("عضو عامل"));
        Assert.Equal(
            SummerWorkflowDomainConstants.MembershipTypes.NonWorker,
            SummerMembershipPolicy.NormalizeMembershipType("عضو غير عامل"));
    }

    [Theory]
    [InlineData(SummerWorkflowDomainConstants.MembershipTypes.Worker, 500)]
    [InlineData(SummerWorkflowDomainConstants.MembershipTypes.NonWorker, 1000)]
    public void ResolveInsuranceAmount_ReturnsExpectedValue(string membershipType, decimal expectedInsuranceAmount)
    {
        var insuranceAmount = SummerMembershipPolicy.ResolveInsuranceAmount(membershipType);
        Assert.Equal(expectedInsuranceAmount, insuranceAmount);
    }
}
