using ENPO.Dto.HubSync;
using Models.DTO.DynamicSubjects;
using Persistence.Services.Notifications;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace Persistence.Services.DynamicSubjects;

public sealed class DynamicSubjectsRealtimePublisher : IDynamicSubjectsRealtimePublisher
{
    private const string EventTitle = "Dynamic Subjects";
    private const string EventSender = "Connect";

    private readonly IConnectNotificationService _notificationService;

    public DynamicSubjectsRealtimePublisher(IConnectNotificationService notificationService)
    {
        _notificationService = notificationService;
    }

    public async Task PublishAsync(
        DynamicSubjectRealtimeEventDto eventPayload,
        DynamicSubjectRealtimeScope scope,
        CancellationToken cancellationToken = default)
    {
        if (eventPayload == null)
        {
            return;
        }

        var safeScope = scope ?? new DynamicSubjectRealtimeScope();
        eventPayload.TimestampUtc = eventPayload.TimestampUtc == default ? DateTime.UtcNow : eventPayload.TimestampUtc;
        eventPayload.EventId = string.IsNullOrWhiteSpace(eventPayload.EventId)
            ? Guid.NewGuid().ToString("N")
            : eventPayload.EventId;

        var jsonPayload = JsonSerializer.Serialize(eventPayload);
        var groupNames = BuildGroupNames(safeScope);

        if (groupNames.Count > 0)
        {
            await _notificationService.SendSignalRToGroupsAsync(new SignalRGroupsDispatchRequest
            {
                GroupNames = groupNames,
                Notification = jsonPayload,
                Title = EventTitle,
                Type = NotificationType.info,
                Category = NotificationCategory.Business,
                Sender = EventSender,
                Time = DateTime.Now
            }, cancellationToken);
        }

        var users = (safeScope.UserIds ?? new List<string>())
            .Select(user => (user ?? string.Empty).Trim())
            .Where(user => user.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        foreach (var user in users)
        {
            await _notificationService.SendSignalRToUserAsync(new SignalRDispatchRequest
            {
                UserId = user,
                Notification = jsonPayload,
                Title = EventTitle,
                Type = NotificationType.info,
                Category = NotificationCategory.Business,
                Sender = EventSender,
                Time = DateTime.Now
            }, cancellationToken);
        }
    }

    private static List<string> BuildGroupNames(DynamicSubjectRealtimeScope scope)
    {
        var groups = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var unitId in scope.UnitGroupIds ?? new List<string>())
        {
            var normalized = (unitId ?? string.Empty).Trim();
            if (normalized.Length > 0)
            {
                groups.Add(normalized);
            }
        }

        foreach (var subjectId in scope.SubjectIds ?? new List<int>())
        {
            if (subjectId > 0)
            {
                groups.Add($"SUBJECT:{subjectId}");
            }
        }

        foreach (var envelopeId in scope.EnvelopeIds ?? new List<int>())
        {
            if (envelopeId > 0)
            {
                groups.Add($"ENVELOPE:{envelopeId}");
            }
        }

        foreach (var categoryId in scope.CategoryIds ?? new List<int>())
        {
            if (categoryId > 0)
            {
                groups.Add($"SUBJECT_CATEGORY:{categoryId}");
            }
        }

        return groups.ToList();
    }
}
