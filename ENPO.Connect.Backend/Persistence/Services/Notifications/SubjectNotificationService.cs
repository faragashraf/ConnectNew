using ENPO.Dto.HubSync;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Models.Correspondance;
using Models.DTO.Common;
using Models.DTO.DynamicSubjects;
using Persistence.Data;
using System.Globalization;

namespace Persistence.Services.Notifications;

public sealed class SubjectNotificationService : ISubjectNotificationService
{
    private static readonly HashSet<string> SupportedEventTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "CREATE",
        "UPDATE",
        "FORWARD"
    };

    private static readonly HashSet<string> SupportedRecipientTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "USER",
        "ROLE",
        "UNIT",
        "GROUP"
    };

    private readonly ConnectContext _connectContext;
    private readonly GPAContext _gpaContext;
    private readonly IConnectNotificationService _connectNotificationService;
    private readonly ILogger<SubjectNotificationService> _logger;

    public SubjectNotificationService(
        ConnectContext connectContext,
        GPAContext gpaContext,
        IConnectNotificationService connectNotificationService,
        ILogger<SubjectNotificationService> logger)
    {
        _connectContext = connectContext;
        _gpaContext = gpaContext;
        _connectNotificationService = connectNotificationService;
        _logger = logger;
    }

    public async Task<CommonResponse<IEnumerable<SubjectNotificationRuleDto>>> GetRulesAsync(
        int subjectTypeId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<IEnumerable<SubjectNotificationRuleDto>>();
        if (subjectTypeId <= 0)
        {
            response.Errors.Add(new Error
            {
                Code = "400",
                Message = "SubjectTypeId is required."
            });
            return response;
        }

        var rules = await _connectContext.NotificationRules
            .AsNoTracking()
            .Where(item => item.SubjectTypeId == subjectTypeId)
            .OrderBy(item => item.EventType)
            .ThenBy(item => item.Id)
            .ToListAsync(cancellationToken);

        response.Data = rules.Select(MapToDto).ToList();
        return response;
    }

    public async Task<CommonResponse<IEnumerable<SubjectNotificationRuleDto>>> UpsertRulesAsync(
        int subjectTypeId,
        SubjectNotificationRulesUpsertRequestDto request,
        string actorUserId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<IEnumerable<SubjectNotificationRuleDto>>();
        if (subjectTypeId <= 0)
        {
            response.Errors.Add(new Error
            {
                Code = "400",
                Message = "SubjectTypeId is required."
            });
            return response;
        }

        var normalizedActor = NormalizeActor(actorUserId);
        var incomingRules = request?.Rules ?? new List<SubjectNotificationRuleUpsertDto>();
        var normalizedRules = new List<SubjectNotificationRuleUpsertDto>();

        foreach (var incoming in incomingRules)
        {
            var isActive = incoming?.IsActive ?? true;
            if (!isActive)
            {
                // Disabled rules are treated as removed rules.
                continue;
            }

            var eventType = NormalizeEventType(incoming?.EventType);
            if (eventType == null)
            {
                response.Errors.Add(new Error
                {
                    Code = "400",
                    Message = "Unsupported event type. Allowed values: CREATE, UPDATE, FORWARD."
                });
                continue;
            }

            var recipientType = NormalizeRecipientType(incoming?.RecipientType);
            if (recipientType == null)
            {
                response.Errors.Add(new Error
                {
                    Code = "400",
                    Message = "Unsupported recipient type. Allowed values: USER, ROLE, UNIT, GROUP."
                });
                continue;
            }

            var recipientValue = NormalizeRecipientValue(incoming?.RecipientValue);
            if (recipientValue == null)
            {
                response.Errors.Add(new Error
                {
                    Code = "400",
                    Message = $"Recipient value is required for {recipientType}."
                });
                continue;
            }

            var template = (incoming?.Template ?? string.Empty).Trim();
            if (template.Length > 2000)
            {
                response.Errors.Add(new Error
                {
                    Code = "400",
                    Message = "Template length cannot exceed 2000 characters."
                });
                continue;
            }

            normalizedRules.Add(new SubjectNotificationRuleUpsertDto
            {
                EventType = eventType,
                RecipientType = recipientType,
                RecipientValue = recipientValue,
                Template = template,
                IsActive = true
            });
        }

        if (response.Errors.Count > 0)
        {
            return response;
        }

        var existing = await _connectContext.NotificationRules
            .Where(item => item.SubjectTypeId == subjectTypeId)
            .ToListAsync(cancellationToken);

        if (existing.Count > 0)
        {
            _connectContext.NotificationRules.RemoveRange(existing);
        }

        var utcNow = DateTime.UtcNow;
        foreach (var item in normalizedRules)
        {
            await _connectContext.NotificationRules.AddAsync(new NotificationRule
            {
                SubjectTypeId = subjectTypeId,
                EventType = item.EventType,
                RecipientType = item.RecipientType,
                RecipientValue = item.RecipientValue,
                Template = item.Template ?? string.Empty,
                IsActive = item.IsActive,
                CreatedBy = normalizedActor,
                CreatedAtUtc = utcNow,
                LastModifiedBy = normalizedActor,
                LastModifiedAtUtc = utcNow
            }, cancellationToken);
        }

        await _connectContext.SaveChangesAsync(cancellationToken);

        var savedRules = await _connectContext.NotificationRules
            .AsNoTracking()
            .Where(item => item.SubjectTypeId == subjectTypeId)
            .OrderBy(item => item.EventType)
            .ThenBy(item => item.Id)
            .ToListAsync(cancellationToken);

        response.Data = savedRules.Select(MapToDto).ToList();
        return response;
    }

    public async Task<CommonResponse<bool>> SendNotificationAsync(
        SubjectNotificationDispatchRequestDto request,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<bool>();
        if (request == null)
        {
            response.Errors.Add(new Error
            {
                Code = "400",
                Message = "Notification request is required."
            });
            return response;
        }

        var eventType = NormalizeEventType(request.EventType);
        if (eventType == null)
        {
            response.Errors.Add(new Error
            {
                Code = "400",
                Message = "Unsupported event type."
            });
            return response;
        }

        if (request.SubjectTypeId <= 0)
        {
            response.Errors.Add(new Error
            {
                Code = "400",
                Message = "SubjectTypeId is required."
            });
            return response;
        }

        var rules = await _connectContext.NotificationRules
            .AsNoTracking()
            .Where(item =>
                item.SubjectTypeId == request.SubjectTypeId
                && item.IsActive
                && item.EventType == eventType)
            .ToListAsync(cancellationToken);

        if (rules.Count == 0)
        {
            response.Data = true;
            return response;
        }

        var placeholders = BuildPlaceholders(request, eventType);
        foreach (var rule in rules)
        {
            var recipientType = NormalizeRecipientType(rule.RecipientType);
            if (recipientType == null)
            {
                continue;
            }

            var message = _connectNotificationService.RenderTemplate(rule.Template, placeholders);
            if (string.IsNullOrWhiteSpace(message))
            {
                message = ResolveDefaultMessage(eventType, request.Payload);
            }

            try
            {
                var sendResult = await DispatchByRecipientTypeAsync(
                    recipientType,
                    rule.RecipientValue,
                    message,
                    ResolveEventTitle(eventType),
                    cancellationToken);

                AppendErrors(response, sendResult.Errors);
            }
            catch (Exception ex)
            {
                _logger.LogError(
                    ex,
                    "Failed to dispatch subject notification. SubjectTypeId={SubjectTypeId}, EventType={EventType}, RecipientType={RecipientType}, RecipientValue={RecipientValue}",
                    request.SubjectTypeId,
                    eventType,
                    recipientType,
                    rule.RecipientValue);
                response.Errors.Add(new Error
                {
                    Code = "500",
                    Message = "Failed to dispatch one of the notifications."
                });
            }
        }

        response.Data = response.Errors.Count == 0;
        return response;
    }

    private async Task<CommonResponse<bool>> DispatchByRecipientTypeAsync(
        string recipientType,
        string recipientValue,
        string message,
        string title,
        CancellationToken cancellationToken)
    {
        if (recipientType == "USER")
        {
            return await DispatchToUsersAsync(ParseRecipientValues(recipientValue), message, title, cancellationToken);
        }

        if (recipientType == "UNIT" || recipientType == "GROUP")
        {
            return await DispatchToGroupsAsync(ParseRecipientValues(recipientValue), message, title, cancellationToken);
        }

        return await DispatchToRolesAsync(ParseRecipientValues(recipientValue), message, title, cancellationToken);
    }

    private async Task<CommonResponse<bool>> DispatchToUsersAsync(
        IReadOnlyCollection<string> userIds,
        string message,
        string title,
        CancellationToken cancellationToken)
    {
        var response = new CommonResponse<bool>();
        if (userIds.Count == 0)
        {
            response.Data = true;
            return response;
        }

        foreach (var userId in userIds)
        {
            var sendResponse = await _connectNotificationService.SendSignalRToUserAsync(new SignalRDispatchRequest
            {
                UserId = userId,
                Notification = message,
                Title = title,
                Type = NotificationType.info,
                Category = NotificationCategory.Business,
                Sender = "Connect",
                Time = DateTime.Now
            }, cancellationToken);

            AppendErrors(response, sendResponse.Errors);
        }

        response.Data = response.Errors.Count == 0;
        return response;
    }

    private async Task<CommonResponse<bool>> DispatchToGroupsAsync(
        IReadOnlyCollection<string> groups,
        string message,
        string title,
        CancellationToken cancellationToken)
    {
        if (groups.Count == 0)
        {
            return new CommonResponse<bool> { Data = true };
        }

        return await _connectNotificationService.SendSignalRToGroupsAsync(new SignalRGroupsDispatchRequest
        {
            GroupNames = groups,
            Notification = message,
            Title = title,
            Type = NotificationType.info,
            Category = NotificationCategory.Business,
            Sender = "Connect",
            Time = DateTime.Now
        }, cancellationToken);
    }

    private async Task<CommonResponse<bool>> DispatchToRolesAsync(
        IReadOnlyCollection<string> roleTokens,
        string message,
        string title,
        CancellationToken cancellationToken)
    {
        var response = new CommonResponse<bool>();
        if (roleTokens.Count == 0)
        {
            response.Data = true;
            return response;
        }

        var roleIds = roleTokens
            .Select(token => decimal.TryParse(token, NumberStyles.Any, CultureInfo.InvariantCulture, out var parsed) ? parsed : (decimal?)null)
            .Where(value => value.HasValue)
            .Select(value => value!.Value)
            .Distinct()
            .ToList();

        if (roleIds.Count > 0)
        {
            var userIds = await _gpaContext.PosUserTeams
                .AsNoTracking()
                .Where(team =>
                    roleIds.Contains(team.TeamId)
                    && (!team.IsActive.HasValue || team.IsActive.Value > 0))
                .Select(team => team.UserId)
                .Distinct()
                .ToListAsync(cancellationToken);

            var usersDispatch = await DispatchToUsersAsync(userIds, message, title, cancellationToken);
            AppendErrors(response, usersDispatch.Errors);
        }

        var textRoleTokens = roleTokens
            .Where(token => !decimal.TryParse(token, NumberStyles.Any, CultureInfo.InvariantCulture, out _))
            .Select(token => $"ROLE:{token}")
            .ToList();

        if (textRoleTokens.Count > 0)
        {
            var groupsDispatch = await DispatchToGroupsAsync(textRoleTokens, message, title, cancellationToken);
            AppendErrors(response, groupsDispatch.Errors);
        }

        response.Data = response.Errors.Count == 0;
        return response;
    }

    private static string NormalizeActor(string? actorUserId)
    {
        var normalized = (actorUserId ?? string.Empty).Trim();
        return normalized.Length > 0 ? normalized : "SYSTEM";
    }

    private static SubjectNotificationRuleDto MapToDto(NotificationRule entity)
    {
        return new SubjectNotificationRuleDto
        {
            Id = entity.Id,
            SubjectTypeId = entity.SubjectTypeId,
            EventType = entity.EventType,
            RecipientType = entity.RecipientType,
            RecipientValue = entity.RecipientValue,
            Template = entity.Template,
            IsActive = entity.IsActive
        };
    }

    private static string? NormalizeEventType(string? eventType)
    {
        var normalized = (eventType ?? string.Empty).Trim().ToUpperInvariant();
        return SupportedEventTypes.Contains(normalized) ? normalized : null;
    }

    private static string? NormalizeRecipientType(string? recipientType)
    {
        var normalized = (recipientType ?? string.Empty).Trim().ToUpperInvariant();
        return SupportedRecipientTypes.Contains(normalized) ? normalized : null;
    }

    private static string? NormalizeRecipientValue(string? value)
    {
        var tokens = ParseRecipientValues(value);
        if (tokens.Count == 0)
        {
            return null;
        }

        return string.Join(",", tokens);
    }

    private static IReadOnlyCollection<string> ParseRecipientValues(string? rawValue)
    {
        return (rawValue ?? string.Empty)
            .Split(new[] { ',', ';', '\n', '\r', '|' }, StringSplitOptions.RemoveEmptyEntries)
            .Select(item => item.Trim())
            .Where(item => item.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    private static Dictionary<string, string?> BuildPlaceholders(
        SubjectNotificationDispatchRequestDto request,
        string eventType)
    {
        var payload = request.Payload ?? new SubjectNotificationPayloadDto();
        return new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase)
        {
            ["requestId"] = payload.RequestId > 0 ? payload.RequestId.ToString(CultureInfo.InvariantCulture) : null,
            ["requestTitle"] = payload.RequestTitle,
            ["createdBy"] = payload.CreatedBy,
            ["unitName"] = payload.UnitName,
            ["eventType"] = eventType,
            ["subjectTypeId"] = request.SubjectTypeId.ToString(CultureInfo.InvariantCulture)
        };
    }

    private static string ResolveDefaultMessage(
        string eventType,
        SubjectNotificationPayloadDto? payload)
    {
        var safePayload = payload ?? new SubjectNotificationPayloadDto();
        var requestIdText = safePayload.RequestId > 0
            ? safePayload.RequestId.ToString(CultureInfo.InvariantCulture)
            : "-";
        var titleText = string.IsNullOrWhiteSpace(safePayload.RequestTitle)
            ? "بدون عنوان"
            : safePayload.RequestTitle!.Trim();

        if (eventType == "CREATE")
        {
            return $"تم إنشاء طلب جديد رقم {requestIdText} بعنوان \"{titleText}\".";
        }

        if (eventType == "UPDATE")
        {
            return $"تم تحديث الطلب رقم {requestIdText} بعنوان \"{titleText}\".";
        }

        var unitName = string.IsNullOrWhiteSpace(safePayload.UnitName)
            ? "جهة أخرى"
            : safePayload.UnitName!.Trim();
        return $"تم تحويل الطلب رقم {requestIdText} بعنوان \"{titleText}\" إلى {unitName}.";
    }

    private static string ResolveEventTitle(string eventType)
    {
        if (eventType == "CREATE")
        {
            return "إشعار إنشاء طلب";
        }

        if (eventType == "UPDATE")
        {
            return "إشعار تحديث طلب";
        }

        return "إشعار تحويل طلب";
    }

    private static void AppendErrors(CommonResponse<bool> destination, IEnumerable<Error>? sourceErrors)
    {
        if (sourceErrors == null)
        {
            return;
        }

        foreach (var error in sourceErrors)
        {
            if (error == null)
            {
                continue;
            }

            destination.Errors.Add(new Error
            {
                Code = string.IsNullOrWhiteSpace(error.Code) ? "500" : error.Code,
                Message = string.IsNullOrWhiteSpace(error.Message) ? "Notification dispatch failed." : error.Message
            });
        }
    }
}
