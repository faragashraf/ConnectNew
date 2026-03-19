using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using Models.DTO.Common;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class LocalAuthController : ControllerBase
    {
        private static readonly string[] DefaultFunctions = new[]
        {
            "AllEnpoUsersFunc",
            "AddSubjectFunc",
            "ViewSubjectFunc",
            "SubjectDashboardFunc",
            "CORR_landTransport_PrintLetter",
            "CORR_landTransport_UploadReply",
            "PowerBiFunc",
            "ConnectSupperAdminFunc",
            "ConnectAdminFunc",
            "ServiceDashboardFunc",
            "AdminCerCSFunc",
            "AdminCerInBoxFunc",
            "AdminCerOutBoxFunc",
            "AdminCerReportsFunc"
        };

        private readonly IConfiguration _configuration;
        private readonly ApplicationConfig _applicationConfig;

        public LocalAuthController(IConfiguration configuration, ApplicationConfig applicationConfig)
        {
            _configuration = configuration;
            _applicationConfig = applicationConfig;
        }

        [HttpPost(nameof(DevLogin))]
        [AllowAnonymous]
        public ActionResult<CommonResponse<LocalAuthorizationDto>> DevLogin([FromBody] LocalLoginRequest? request)
        {
            var response = new CommonResponse<LocalAuthorizationDto>();
            var isEnabled = _configuration.GetValue<bool>("LocalDevelopment:EnableMockLogin");
            if (!isEnabled)
            {
                response.Errors.Add(new Error { Code = "403", Message = "Local mock login is disabled." });
                return response;
            }

            if (request == null || string.IsNullOrWhiteSpace(request.UserId) || string.IsNullOrWhiteSpace(request.Password))
            {
                response.Errors.Add(new Error { Code = "400", Message = "UserId and Password are required." });
                return response;
            }

            var expectedUserId = _configuration.GetValue<string>("LocalDevelopment:MockLogin:UserId") ?? "test";
            var expectedPassword = _configuration.GetValue<string>("LocalDevelopment:MockLogin:Password") ?? "test123";

            var userId = request.UserId.Trim();
            var password = request.Password.Trim();
            if (!string.Equals(userId, expectedUserId, StringComparison.OrdinalIgnoreCase) ||
                !string.Equals(password, expectedPassword, StringComparison.Ordinal))
            {
                response.Errors.Add(new Error { Code = "401", Message = "Invalid test credentials." });
                return response;
            }

            var firstName = _configuration.GetValue<string>("LocalDevelopment:MockLogin:FirstName") ?? "Test User";
            var email = _configuration.GetValue<string>("LocalDevelopment:MockLogin:Email") ?? "test@local.connect";
            var department = _configuration.GetValue<string>("LocalDevelopment:MockLogin:Department") ?? "Local Development";
            var functions = _configuration.GetSection("LocalDevelopment:MockLogin:Functions").Get<string[]>();
            functions ??= DefaultFunctions;

            var token = CreateLocalToken(userId, firstName, email, department, functions);

            response.Data = new LocalAuthorizationDto
            {
                Department = department,
                FirstName = firstName,
                UserName = userId,
                Token = token,
                Functions = token,
                ExchangeUserInfo = new LocalExchangeUserInfoDto
                {
                    UserEmail = email,
                    UserDisplayName = firstName,
                    UserTitle = "Local Developer",
                    MobilePhone = string.Empty,
                    UserPicture = null,
                    RegistrationStatus = true,
                    UserId = userId,
                    IsGroup = false,
                    GroupMembers = new List<object>(),
                    UserGroups = new List<string>()
                },
                UserOtpEnrollmentDto = null,
                PrivilageCollection = new List<object>()
            };

            return response;
        }

        private string CreateLocalToken(string userId, string firstName, string email, string department, IEnumerable<string> functions)
        {
            if (string.IsNullOrWhiteSpace(_applicationConfig.tokenOptions.Key))
            {
                throw new InvalidOperationException("Token key is missing from ApplicationConfig:TokenOptions:Key.");
            }

            var claims = new List<Claim>
            {
                new("UserId", userId),
                new("UserEmail", email),
                new("given_name", firstName),
                new("Department", department),
                new("ApplicationId", "Connect"),
                new(JwtRegisteredClaimNames.Sub, userId),
                new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
            };

            foreach (var functionName in functions.Where(f => !string.IsNullOrWhiteSpace(f)).Distinct())
            {
                claims.Add(new Claim("functions", functionName));
            }

            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_applicationConfig.tokenOptions.Key));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
            var expiresAt = DateTime.UtcNow.AddHours(8);

            var token = new JwtSecurityToken(
                issuer: _applicationConfig.tokenOptions.Issuer,
                audience: _applicationConfig.tokenOptions.Audience,
                claims: claims,
                notBefore: DateTime.UtcNow,
                expires: expiresAt,
                signingCredentials: creds);

            return new JwtSecurityTokenHandler().WriteToken(token);
        }
    }

    public class LocalLoginRequest
    {
        public string UserId { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
    }

    public class LocalAuthorizationDto
    {
        public string Department { get; set; } = string.Empty;
        public string FirstName { get; set; } = string.Empty;
        public string UserName { get; set; } = string.Empty;
        public string Token { get; set; } = string.Empty;
        public string Functions { get; set; } = string.Empty;
        public LocalExchangeUserInfoDto ExchangeUserInfo { get; set; } = new();
        public object? UserOtpEnrollmentDto { get; set; }
        public List<object> PrivilageCollection { get; set; } = new();
    }

    public class LocalExchangeUserInfoDto
    {
        public string UserEmail { get; set; } = string.Empty;
        public string UserDisplayName { get; set; } = string.Empty;
        public string UserTitle { get; set; } = string.Empty;
        public string MobilePhone { get; set; } = string.Empty;
        public string? UserPicture { get; set; }
        public bool RegistrationStatus { get; set; }
        public string UserId { get; set; } = string.Empty;
        public bool IsGroup { get; set; }
        public List<object> GroupMembers { get; set; } = new();
        public List<string> UserGroups { get; set; } = new();
    }
}
