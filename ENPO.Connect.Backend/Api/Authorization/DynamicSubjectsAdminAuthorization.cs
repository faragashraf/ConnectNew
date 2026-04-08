using System.Security.Claims;
using Persistence.Services.DynamicSubjects;

namespace Api.Authorization
{
    public static class DynamicSubjectsAdminAuthorization
    {
        public const string PolicyName = "DynamicSubjectsAdminSuperAdmin";
        public const string RequiredRoleId = DynamicSubjectsAdminClaimGuard.RequiredRoleId;
        public const string RequiredFunction = DynamicSubjectsAdminClaimGuard.RequiredFunction;

        public static bool HasRequiredRoleClaim(ClaimsPrincipal? user)
        {
            return DynamicSubjectsAdminClaimGuard.HasRequiredRoleClaim(user);
        }
    }
}
