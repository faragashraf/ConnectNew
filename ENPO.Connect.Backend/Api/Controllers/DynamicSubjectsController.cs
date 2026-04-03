using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Http;
using Models.DTO.Common;
using Models.DTO.DynamicSubjects;
using Persistence.Services.DynamicSubjects;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Claims;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
public class DynamicSubjectsController : ControllerBase
{
        private const string SuperAdminRoleId = "2003";

        private static readonly JsonSerializerOptions SerializerOptions = new(JsonSerializerDefaults.Web)
        {
            PropertyNameCaseInsensitive = true
        };

        private readonly IDynamicSubjectsService _dynamicSubjectsService;

        public DynamicSubjectsController(IDynamicSubjectsService dynamicSubjectsService)
        {
            _dynamicSubjectsService = dynamicSubjectsService;
        }

        [HttpGet("CategoryTree")]
        public Task<CommonResponse<IEnumerable<SubjectCategoryTreeNodeDto>>> GetCategoryTree(
            string? appId,
            CancellationToken cancellationToken = default)
        {
            return _dynamicSubjectsService.GetCategoryTreeAsync(GetCurrentUserId(), appId, cancellationToken);
        }

        [HttpGet("FormDefinition/{categoryId:int}")]
        public Task<CommonResponse<SubjectFormDefinitionDto>> GetFormDefinition(
            int categoryId,
            string? appId,
            CancellationToken cancellationToken = default)
        {
            return _dynamicSubjectsService.GetFormDefinitionAsync(categoryId, GetCurrentUserId(), appId, cancellationToken);
        }

        [HttpGet("Subjects")]
        public Task<CommonResponse<PagedSubjectListDto>> ListSubjects(
            [FromQuery] SubjectListQueryDto query,
            CancellationToken cancellationToken = default)
        {
            return _dynamicSubjectsService.ListSubjectsAsync(query, GetCurrentUserId(), cancellationToken);
        }

        [HttpGet("Subjects/{messageId:int}")]
        public Task<CommonResponse<SubjectDetailDto>> GetSubject(
            int messageId,
            CancellationToken cancellationToken = default)
        {
            return _dynamicSubjectsService.GetSubjectAsync(messageId, GetCurrentUserId(), cancellationToken);
        }

        [HttpPost("Subjects")]
        [Consumes("multipart/form-data")]
        public async Task<ActionResult<CommonResponse<SubjectDetailDto>>> CreateSubject(
            [FromForm] SubjectUpsertFormRequestDto form,
            CancellationToken cancellationToken = default)
        {
            var request = ParseUpsertRequest(form);
            var attachments = await ConvertFilesAsync(form.Files, cancellationToken);
            var response = await _dynamicSubjectsService.CreateSubjectAsync(
                request,
                attachments,
                GetCurrentUserId(),
                cancellationToken);

            return response;
        }

        [HttpPut("Subjects/{messageId:int}")]
        [Consumes("multipart/form-data")]
        public async Task<ActionResult<CommonResponse<SubjectDetailDto>>> UpdateSubject(
            int messageId,
            [FromForm] SubjectUpsertFormRequestDto form,
            CancellationToken cancellationToken = default)
        {
            var request = ParseUpsertRequest(form);
            var attachments = await ConvertFilesAsync(form.Files, cancellationToken);
            var response = await _dynamicSubjectsService.UpdateSubjectAsync(
                messageId,
                request,
                attachments,
                GetCurrentUserId(),
                cancellationToken);

            return response;
        }

        [HttpPost("Subjects/{messageId:int}/Status")]
        public Task<CommonResponse<SubjectStatusChangeResponseDto>> ChangeStatus(
            int messageId,
            [FromBody] SubjectStatusChangeRequestDto request,
            CancellationToken cancellationToken = default)
        {
            return _dynamicSubjectsService.ChangeStatusAsync(messageId, request, GetCurrentUserId(), cancellationToken);
        }

        [HttpPost("Subjects/{messageId:int}/Attachments")]
        [Consumes("multipart/form-data")]
        public async Task<ActionResult<CommonResponse<IEnumerable<SubjectAttachmentDto>>>> AddAttachments(
            int messageId,
            [FromForm] SubjectAttachmentsFormRequestDto request,
            CancellationToken cancellationToken = default)
        {
            var attachments = await ConvertFilesAsync(request.Files, cancellationToken);
            var response = await _dynamicSubjectsService.AddAttachmentsAsync(
                messageId,
                attachments,
                GetCurrentUserId(),
                cancellationToken);

            return response;
        }

        [HttpDelete("Subjects/{messageId:int}/Attachments/{attachmentId:int}")]
        public Task<CommonResponse<bool>> RemoveAttachment(
            int messageId,
            int attachmentId,
            CancellationToken cancellationToken = default)
        {
            return _dynamicSubjectsService.RemoveAttachmentAsync(messageId, attachmentId, GetCurrentUserId(), cancellationToken);
        }

        [HttpPut("Subjects/{messageId:int}/Stakeholders")]
        public Task<CommonResponse<IEnumerable<SubjectStakeholderDto>>> UpsertStakeholders(
            int messageId,
            [FromBody] List<SubjectStakeholderUpsertDto> stakeholders,
            CancellationToken cancellationToken = default)
        {
            return _dynamicSubjectsService.UpsertStakeholdersAsync(
                messageId,
                stakeholders ?? new List<SubjectStakeholderUpsertDto>(),
                GetCurrentUserId(),
                cancellationToken);
        }

        [HttpPost("Subjects/{messageId:int}/Tasks")]
        public Task<CommonResponse<SubjectTaskDto>> UpsertTask(
            int messageId,
            [FromBody] SubjectTaskUpsertDto request,
            CancellationToken cancellationToken = default)
        {
            return _dynamicSubjectsService.UpsertTaskAsync(
                messageId,
                request,
                GetCurrentUserId(),
                cancellationToken);
        }

        [HttpGet("Envelopes")]
        public Task<CommonResponse<PagedEnvelopeListDto>> ListEnvelopes(
            [FromQuery] EnvelopeListQueryDto query,
            CancellationToken cancellationToken = default)
        {
            return _dynamicSubjectsService.ListEnvelopesAsync(query, GetCurrentUserId(), cancellationToken);
        }

        [HttpGet("Envelopes/{envelopeId:int}")]
        public Task<CommonResponse<EnvelopeDetailDto>> GetEnvelope(
            int envelopeId,
            CancellationToken cancellationToken = default)
        {
            return _dynamicSubjectsService.GetEnvelopeAsync(envelopeId, GetCurrentUserId(), cancellationToken);
        }

        [HttpPost("Envelopes")]
        public Task<CommonResponse<EnvelopeDetailDto>> CreateEnvelope(
            [FromBody] EnvelopeUpsertRequestDto request,
            CancellationToken cancellationToken = default)
        {
            return _dynamicSubjectsService.CreateEnvelopeAsync(request, GetCurrentUserId(), cancellationToken);
        }

        [HttpPut("Envelopes/{envelopeId:int}")]
        public Task<CommonResponse<EnvelopeDetailDto>> UpdateEnvelope(
            int envelopeId,
            [FromBody] EnvelopeUpsertRequestDto request,
            CancellationToken cancellationToken = default)
        {
            return _dynamicSubjectsService.UpdateEnvelopeAsync(envelopeId, request, GetCurrentUserId(), cancellationToken);
        }

        [HttpPost("Envelopes/{envelopeId:int}/Subjects/{messageId:int}")]
        public Task<CommonResponse<bool>> LinkSubjectToEnvelope(
            int envelopeId,
            int messageId,
            CancellationToken cancellationToken = default)
        {
            return _dynamicSubjectsService.LinkSubjectToEnvelopeAsync(envelopeId, messageId, GetCurrentUserId(), cancellationToken);
        }

        [HttpDelete("Envelopes/{envelopeId:int}/Subjects/{messageId:int}")]
        public Task<CommonResponse<bool>> UnlinkSubjectFromEnvelope(
            int envelopeId,
            int messageId,
            CancellationToken cancellationToken = default)
        {
            return _dynamicSubjectsService.UnlinkSubjectFromEnvelopeAsync(envelopeId, messageId, GetCurrentUserId(), cancellationToken);
        }

        [HttpGet("Dashboard")]
        public Task<CommonResponse<SubjectDashboardDto>> GetDashboard(
            [FromQuery] SubjectDashboardQueryDto query,
            CancellationToken cancellationToken = default)
        {
            return _dynamicSubjectsService.GetDashboardAsync(query, GetCurrentUserId(), cancellationToken);
        }

        [HttpGet("Admin/SubjectTypes")]
        public Task<CommonResponse<IEnumerable<SubjectTypeAdminDto>>> GetAdminSubjectTypes(
            string? appId,
            CancellationToken cancellationToken = default)
        {
            if (!HasRequiredRole(SuperAdminRoleId))
            {
                return ForbiddenAdminResponse<IEnumerable<SubjectTypeAdminDto>>();
            }

            return _dynamicSubjectsService.GetSubjectTypeAdminConfigsAsync(GetCurrentUserId(), appId, cancellationToken);
        }

        [HttpPut("Admin/SubjectTypes/{categoryId:int}")]
        public Task<CommonResponse<SubjectTypeAdminDto>> UpsertAdminSubjectType(
            int categoryId,
            [FromBody] SubjectTypeAdminUpsertRequestDto request,
            CancellationToken cancellationToken = default)
        {
            if (!HasRequiredRole(SuperAdminRoleId))
            {
                return ForbiddenAdminResponse<SubjectTypeAdminDto>();
            }

            return _dynamicSubjectsService.UpsertSubjectTypeAdminConfigAsync(categoryId, request, GetCurrentUserId(), cancellationToken);
        }

        [HttpGet("Admin/CategoryTree")]
        public Task<CommonResponse<IEnumerable<SubjectTypeAdminDto>>> GetAdminCategoryTree(
            string? appId,
            CancellationToken cancellationToken = default)
        {
            if (!HasRequiredRole(SuperAdminRoleId))
            {
                return ForbiddenAdminResponse<IEnumerable<SubjectTypeAdminDto>>();
            }

            return _dynamicSubjectsService.GetAdminCategoryTreeAsync(GetCurrentUserId(), appId, cancellationToken);
        }

        [HttpPost("Admin/CategoryTypes")]
        public Task<CommonResponse<SubjectTypeAdminDto>> CreateAdminCategory(
            [FromBody] SubjectTypeAdminCreateRequestDto request,
            CancellationToken cancellationToken = default)
        {
            if (!HasRequiredRole(SuperAdminRoleId))
            {
                return ForbiddenAdminResponse<SubjectTypeAdminDto>();
            }

            return _dynamicSubjectsService.CreateAdminCategoryAsync(request, GetCurrentUserId(), cancellationToken);
        }

        [HttpPut("Admin/CategoryTypes/{categoryId:int}")]
        public Task<CommonResponse<SubjectTypeAdminDto>> UpdateAdminCategory(
            int categoryId,
            [FromBody] SubjectTypeAdminUpdateRequestDto request,
            CancellationToken cancellationToken = default)
        {
            if (!HasRequiredRole(SuperAdminRoleId))
            {
                return ForbiddenAdminResponse<SubjectTypeAdminDto>();
            }

            return _dynamicSubjectsService.UpdateAdminCategoryAsync(categoryId, request, GetCurrentUserId(), cancellationToken);
        }

        [HttpDelete("Admin/CategoryTypes/{categoryId:int}")]
        public Task<CommonResponse<bool>> DeleteAdminCategory(
            int categoryId,
            CancellationToken cancellationToken = default)
        {
            if (!HasRequiredRole(SuperAdminRoleId))
            {
                return ForbiddenAdminResponse<bool>();
            }

            return _dynamicSubjectsService.DeleteAdminCategoryAsync(categoryId, GetCurrentUserId(), cancellationToken);
        }

        [HttpPatch("Admin/CategoryTypes/{categoryId:int}/Status")]
        public Task<CommonResponse<SubjectTypeAdminDto>> SetAdminCategoryStatus(
            int categoryId,
            [FromBody] SubjectTypeAdminStatusRequestDto request,
            CancellationToken cancellationToken = default)
        {
            if (!HasRequiredRole(SuperAdminRoleId))
            {
                return ForbiddenAdminResponse<SubjectTypeAdminDto>();
            }

            return _dynamicSubjectsService.SetAdminCategoryStatusAsync(categoryId, request, GetCurrentUserId(), cancellationToken);
        }

        [HttpPatch("Admin/CategoryTypes/{categoryId:int}/Move")]
        public Task<CommonResponse<IEnumerable<SubjectTypeAdminDto>>> MoveAdminCategory(
            int categoryId,
            [FromBody] SubjectTypeAdminTreeMoveRequestDto request,
            CancellationToken cancellationToken = default)
        {
            if (!HasRequiredRole(SuperAdminRoleId))
            {
                return ForbiddenAdminResponse<IEnumerable<SubjectTypeAdminDto>>();
            }

            return _dynamicSubjectsService.MoveAdminCategoryAsync(categoryId, request, GetCurrentUserId(), cancellationToken);
        }

        [HttpGet("Admin/Fields")]
        public Task<CommonResponse<IEnumerable<SubjectAdminFieldDto>>> GetAdminFields(
            string? appId,
            CancellationToken cancellationToken = default)
        {
            if (!HasRequiredRole(SuperAdminRoleId))
            {
                return ForbiddenAdminResponse<IEnumerable<SubjectAdminFieldDto>>();
            }

            return _dynamicSubjectsService.GetAdminFieldsAsync(GetCurrentUserId(), appId, cancellationToken);
        }

        [HttpPost("Admin/Fields")]
        public Task<CommonResponse<SubjectAdminFieldDto>> CreateAdminField(
            [FromBody] SubjectAdminFieldUpsertRequestDto request,
            CancellationToken cancellationToken = default)
        {
            if (!HasRequiredRole(SuperAdminRoleId))
            {
                return ForbiddenAdminResponse<SubjectAdminFieldDto>();
            }

            return _dynamicSubjectsService.CreateAdminFieldAsync(request, GetCurrentUserId(), cancellationToken);
        }

        [HttpPut("Admin/Fields/{fieldKey}")]
        public Task<CommonResponse<SubjectAdminFieldDto>> UpdateAdminField(
            string fieldKey,
            [FromBody] SubjectAdminFieldUpsertRequestDto request,
            CancellationToken cancellationToken = default)
        {
            if (!HasRequiredRole(SuperAdminRoleId))
            {
                return ForbiddenAdminResponse<SubjectAdminFieldDto>();
            }

            return _dynamicSubjectsService.UpdateAdminFieldAsync(fieldKey, request, GetCurrentUserId(), cancellationToken);
        }

        [HttpDelete("Admin/Fields/{fieldKey}")]
        public Task<CommonResponse<bool>> DeleteAdminField(
            string fieldKey,
            CancellationToken cancellationToken = default)
        {
            if (!HasRequiredRole(SuperAdminRoleId))
            {
                return ForbiddenAdminResponse<bool>();
            }

            return _dynamicSubjectsService.DeleteAdminFieldAsync(fieldKey, GetCurrentUserId(), cancellationToken);
        }

        [HttpGet("Admin/Groups")]
        public Task<CommonResponse<IEnumerable<SubjectAdminGroupDto>>> GetAdminGroups(
            CancellationToken cancellationToken = default)
        {
            if (!HasRequiredRole(SuperAdminRoleId))
            {
                return ForbiddenAdminResponse<IEnumerable<SubjectAdminGroupDto>>();
            }

            return _dynamicSubjectsService.GetAdminGroupsAsync(GetCurrentUserId(), cancellationToken);
        }

        [HttpPost("Admin/Groups")]
        public Task<CommonResponse<SubjectAdminGroupDto>> CreateAdminGroup(
            [FromBody] SubjectAdminGroupUpsertRequestDto request,
            CancellationToken cancellationToken = default)
        {
            if (!HasRequiredRole(SuperAdminRoleId))
            {
                return ForbiddenAdminResponse<SubjectAdminGroupDto>();
            }

            return _dynamicSubjectsService.CreateAdminGroupAsync(request, GetCurrentUserId(), cancellationToken);
        }

        [HttpPut("Admin/Groups/{groupId:int}")]
        public Task<CommonResponse<SubjectAdminGroupDto>> UpdateAdminGroup(
            int groupId,
            [FromBody] SubjectAdminGroupUpsertRequestDto request,
            CancellationToken cancellationToken = default)
        {
            if (!HasRequiredRole(SuperAdminRoleId))
            {
                return ForbiddenAdminResponse<SubjectAdminGroupDto>();
            }

            return _dynamicSubjectsService.UpdateAdminGroupAsync(groupId, request, GetCurrentUserId(), cancellationToken);
        }

        [HttpDelete("Admin/Groups/{groupId:int}")]
        public Task<CommonResponse<bool>> DeleteAdminGroup(
            int groupId,
            CancellationToken cancellationToken = default)
        {
            if (!HasRequiredRole(SuperAdminRoleId))
            {
                return ForbiddenAdminResponse<bool>();
            }

            return _dynamicSubjectsService.DeleteAdminGroupAsync(groupId, GetCurrentUserId(), cancellationToken);
        }

        [HttpGet("Admin/CategoryTypes/{categoryId:int}/FieldLinks")]
        public Task<CommonResponse<IEnumerable<SubjectCategoryFieldLinkAdminDto>>> GetAdminCategoryFieldLinks(
            int categoryId,
            CancellationToken cancellationToken = default)
        {
            if (!HasRequiredRole(SuperAdminRoleId))
            {
                return ForbiddenAdminResponse<IEnumerable<SubjectCategoryFieldLinkAdminDto>>();
            }

            return _dynamicSubjectsService.GetAdminCategoryFieldLinksAsync(categoryId, GetCurrentUserId(), cancellationToken);
        }

        [HttpPut("Admin/CategoryTypes/{categoryId:int}/FieldLinks")]
        public Task<CommonResponse<IEnumerable<SubjectCategoryFieldLinkAdminDto>>> UpsertAdminCategoryFieldLinks(
            int categoryId,
            [FromBody] SubjectCategoryFieldLinksUpsertRequestDto request,
            CancellationToken cancellationToken = default)
        {
            if (!HasRequiredRole(SuperAdminRoleId))
            {
                return ForbiddenAdminResponse<IEnumerable<SubjectCategoryFieldLinkAdminDto>>();
            }

            return _dynamicSubjectsService.UpsertAdminCategoryFieldLinksAsync(categoryId, request, GetCurrentUserId(), cancellationToken);
        }

        [HttpGet("Admin/CategoryTypes/{categoryId:int}/Preview")]
        public Task<CommonResponse<SubjectFormDefinitionDto>> GetAdminCategoryPreview(
            int categoryId,
            string? appId,
            CancellationToken cancellationToken = default)
        {
            if (!HasRequiredRole(SuperAdminRoleId))
            {
                return ForbiddenAdminResponse<SubjectFormDefinitionDto>();
            }

            return _dynamicSubjectsService.GetAdminPreviewAsync(categoryId, GetCurrentUserId(), appId, cancellationToken);
        }

        private static SubjectUpsertRequestDto ParseUpsertRequest(SubjectUpsertFormRequestDto form)
        {
            return new SubjectUpsertRequestDto
            {
                CategoryId = form.CategoryId,
                Subject = form.Subject,
                Description = form.Description,
                SaveAsDraft = form.SaveAsDraft,
                Submit = form.Submit,
                EnvelopeId = form.EnvelopeId,
                DynamicFields = DeserializeList<SubjectFieldValueDto>(form.DynamicFieldsJson),
                Stakeholders = DeserializeList<SubjectStakeholderUpsertDto>(form.StakeholdersJson),
                Tasks = DeserializeList<SubjectTaskUpsertDto>(form.TasksJson)
            };
        }

        private static List<T> DeserializeList<T>(string? json)
        {
            if (string.IsNullOrWhiteSpace(json))
            {
                return new List<T>();
            }

            try
            {
                return JsonSerializer.Deserialize<List<T>>(json, SerializerOptions) ?? new List<T>();
            }
            catch
            {
                return new List<T>();
            }
        }

        private static async Task<List<(string FileName, byte[] Content, string Extension, long Size)>> ConvertFilesAsync(
            IEnumerable<IFormFile>? files,
            CancellationToken cancellationToken)
        {
            var result = new List<(string FileName, byte[] Content, string Extension, long Size)>();
            foreach (var file in files ?? Enumerable.Empty<IFormFile>())
            {
                if (file == null || file.Length <= 0)
                {
                    continue;
                }

                await using var stream = new MemoryStream();
                await file.CopyToAsync(stream, cancellationToken);
                result.Add((file.FileName, stream.ToArray(), Path.GetExtension(file.FileName), file.Length));
            }

            return result;
        }

        private string GetCurrentUserId()
        {
            return HttpContext.User.Claims.FirstOrDefault(claim => claim.Type == "UserId")?.Value ?? string.Empty;
        }

        private static Task<CommonResponse<T>> ForbiddenAdminResponse<T>()
        {
            var response = new CommonResponse<T>();
            response.Errors.Add(new Error
            {
                Code = "403",
                Message = "هذه الشاشة متاحة فقط للمستخدمين الذين يحملون الدور 2003."
            });
            return Task.FromResult(response);
        }

        private bool HasRequiredRole(string requiredRoleId)
        {
            var normalizedRequiredRole = (requiredRoleId ?? string.Empty).Trim();
            if (normalizedRequiredRole.Length == 0)
            {
                return false;
            }

            var claims = HttpContext?.User?.Claims;
            if (claims == null)
            {
                return false;
            }

            foreach (var claim in claims)
            {
                if (!string.Equals(claim.Type, "RoleId", StringComparison.OrdinalIgnoreCase)
                    && !string.Equals(claim.Type, "roleId", StringComparison.OrdinalIgnoreCase)
                    && !string.Equals(claim.Type, "role", StringComparison.OrdinalIgnoreCase)
                    && !string.Equals(claim.Type, "roles", StringComparison.OrdinalIgnoreCase)
                    && !string.Equals(claim.Type, ClaimTypes.Role, StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                foreach (var roleToken in ExpandClaimTokens(claim.Value))
                {
                    if (string.Equals(roleToken, normalizedRequiredRole, StringComparison.OrdinalIgnoreCase))
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
                    // Fallback to delimiter parsing below.
                }
            }

            return rawValue
                .Split(new[] { ',', ';', '|' }, StringSplitOptions.RemoveEmptyEntries)
                .Select(item => item.Trim())
                .Where(item => item.Length > 0)
                .ToArray();
        }
    }
}
