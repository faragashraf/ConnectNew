using Models.DTO.Correspondance.Enums;
using System;
using System.Collections.Generic;
using System.Linq;

namespace Persistence.Services.DynamicSubjects;

internal static class SubjectWorkflowStatusCatalog
{
    private static readonly IReadOnlyDictionary<byte, string> Labels = new Dictionary<byte, string>
    {
        [(byte)MessageStatus.Draft] = "Draft",
        [(byte)MessageStatus.Submitted] = "Submitted",
        [(byte)MessageStatus.UnderReview] = "Under Review",
        [(byte)MessageStatus.PendingCompletion] = "Pending Completion",
        [(byte)MessageStatus.WorkflowInProgress] = "In Progress",
        [(byte)MessageStatus.Completed] = "Completed",
        [(byte)MessageStatus.WorkflowRejected] = "Rejected",
        [(byte)MessageStatus.Archived] = "Archived",
        [(byte)MessageStatus.New] = "New",
        [(byte)MessageStatus.InProgress] = "In Progress",
        [(byte)MessageStatus.Rejected] = "Rejected",
        [(byte)MessageStatus.Printed] = "Completed"
    };

    private static readonly IReadOnlyDictionary<byte, HashSet<byte>> AllowedTransitions =
        new Dictionary<byte, HashSet<byte>>
        {
            [(byte)MessageStatus.Draft] = new HashSet<byte>
            {
                (byte)MessageStatus.Draft,
                (byte)MessageStatus.Submitted,
                (byte)MessageStatus.Archived
            },
            [(byte)MessageStatus.Submitted] = new HashSet<byte>
            {
                (byte)MessageStatus.UnderReview,
                (byte)MessageStatus.PendingCompletion,
                (byte)MessageStatus.WorkflowRejected,
                (byte)MessageStatus.Archived
            },
            [(byte)MessageStatus.UnderReview] = new HashSet<byte>
            {
                (byte)MessageStatus.WorkflowInProgress,
                (byte)MessageStatus.PendingCompletion,
                (byte)MessageStatus.Completed,
                (byte)MessageStatus.WorkflowRejected,
                (byte)MessageStatus.Archived
            },
            [(byte)MessageStatus.PendingCompletion] = new HashSet<byte>
            {
                (byte)MessageStatus.Submitted,
                (byte)MessageStatus.WorkflowInProgress,
                (byte)MessageStatus.WorkflowRejected,
                (byte)MessageStatus.Archived
            },
            [(byte)MessageStatus.WorkflowInProgress] = new HashSet<byte>
            {
                (byte)MessageStatus.PendingCompletion,
                (byte)MessageStatus.Completed,
                (byte)MessageStatus.WorkflowRejected,
                (byte)MessageStatus.Archived
            },
            [(byte)MessageStatus.Completed] = new HashSet<byte>
            {
                (byte)MessageStatus.Archived
            },
            [(byte)MessageStatus.WorkflowRejected] = new HashSet<byte>
            {
                (byte)MessageStatus.Archived
            },
            [(byte)MessageStatus.Archived] = new HashSet<byte>()
        };

    internal static string Label(byte status)
    {
        return Labels.TryGetValue(status, out var label)
            ? label
            : $"Status-{status}";
    }

    internal static bool CanTransition(byte fromStatus, byte toStatus)
    {
        if (!AllowedTransitions.TryGetValue(fromStatus, out var allowed))
        {
            return true;
        }

        return allowed.Contains(toStatus);
    }

    internal static IReadOnlyList<byte> GetAllowedTargets(byte fromStatus)
    {
        if (!AllowedTransitions.TryGetValue(fromStatus, out var allowed))
        {
            return Array.Empty<byte>();
        }

        return allowed.ToList();
    }
}
