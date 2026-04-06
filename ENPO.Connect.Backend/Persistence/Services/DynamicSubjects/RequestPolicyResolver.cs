using Models.DTO.Common;
using Models.DTO.DynamicSubjects;
using System;
using System.Collections.Generic;
using System.Linq;

namespace Persistence.Services.DynamicSubjects;

internal sealed class ResolvedRequestAccessPolicy
{
    public string CreateMode { get; set; } = "single";

    public HashSet<string> CreateUnitIds { get; set; } = new(StringComparer.OrdinalIgnoreCase);

    public HashSet<string> ReadUnitIds { get; set; } = new(StringComparer.OrdinalIgnoreCase);

    public HashSet<string> WorkUnitIds { get; set; } = new(StringComparer.OrdinalIgnoreCase);

    public bool InheritLegacyAccess { get; set; } = true;
}

internal sealed class ResolvedRequestWorkflowPolicy
{
    public string Mode { get; set; } = "manual";

    public List<string> StaticTargetUnitIds { get; set; } = new();

    public bool AllowManualSelection { get; set; } = true;

    public string? ManualTargetFieldKey { get; set; }

    public bool ManualSelectionRequired { get; set; } = true;

    public string? DefaultTargetUnitId { get; set; }
}

internal static class RequestPolicyResolver
{
    private static readonly string[] SupportedConditionOperators = new[]
    {
        "eq", "neq", "in", "notin", "contains", "exists", "empty"
    };

    private static readonly string[] SupportedWorkflowModes = new[]
    {
        "static", "manual", "hybrid"
    };

    private static readonly string[] SupportedCreateModes = new[]
    {
        "single", "multi"
    };

    public static RequestPolicyDefinitionDto Normalize(RequestPolicyDefinitionDto? input)
    {
        var policy = input ?? new RequestPolicyDefinitionDto();
        var normalized = new RequestPolicyDefinitionDto
        {
            Version = policy.Version <= 0 ? 1 : policy.Version,
            AccessPolicy = NormalizeAccessPolicy(policy.AccessPolicy),
            WorkflowPolicy = NormalizeWorkflowPolicy(policy.WorkflowPolicy)
        };

        var sortedRules = (policy.PresentationRules ?? new List<RequestPolicyPresentationRuleDto>())
            .Where(rule => rule != null)
            .OrderBy(rule => rule.Priority)
            .ThenBy(rule => rule.RuleId ?? string.Empty, StringComparer.OrdinalIgnoreCase)
            .ToList();

        foreach (var rule in sortedRules)
        {
            var normalizedRule = new RequestPolicyPresentationRuleDto
            {
                RuleId = NormalizeNullable(rule.RuleId) ?? string.Empty,
                IsEnabled = rule.IsEnabled,
                Priority = rule.Priority,
                Conditions = NormalizeConditions(rule.Conditions),
                FieldPatches = NormalizeFieldPatches(rule.FieldPatches)
            };

            normalized.PresentationRules.Add(normalizedRule);
        }

        return normalized;
    }

    public static List<Error> Validate(RequestPolicyDefinitionDto? input)
    {
        var errors = new List<Error>();
        var policy = Normalize(input);

        var createMode = NormalizeNullable(policy.AccessPolicy.CreateMode) ?? "single";
        if (!SupportedCreateModes.Contains(createMode, StringComparer.OrdinalIgnoreCase))
        {
            errors.Add(new Error
            {
                Code = "400",
                Message = "قيمة وضع الإنشاء غير مدعومة. القيم المتاحة: جهة واحدة أو متعدد الجهات."
            });
        }

        var workflowMode = NormalizeNullable(policy.WorkflowPolicy.Mode) ?? "manual";
        if (!SupportedWorkflowModes.Contains(workflowMode, StringComparer.OrdinalIgnoreCase))
        {
            errors.Add(new Error
            {
                Code = "400",
                Message = "قيمة وضع التوجيه غير مدعومة. القيم المتاحة: ثابت أو يدوي أو هجين."
            });
        }

        if (string.Equals(workflowMode, "static", StringComparison.OrdinalIgnoreCase)
            && policy.WorkflowPolicy.StaticTargetUnitIds.Count == 0)
        {
            errors.Add(new Error
            {
                Code = "400",
                Message = "تم اختيار وضع التوجيه الثابت، لذلك يجب تحديد جهة واحدة على الأقل ضمن الجهات الثابتة."
            });
        }

        var isManualWorkflow = string.Equals(workflowMode, "manual", StringComparison.OrdinalIgnoreCase);
        var isHybridWorkflow = string.Equals(workflowMode, "hybrid", StringComparison.OrdinalIgnoreCase);
        var allowManualSelection = policy.WorkflowPolicy.AllowManualSelection;
        var manualSelectionRequired = policy.WorkflowPolicy.ManualSelectionRequired;
        var hasManualTargetField = !string.IsNullOrWhiteSpace(policy.WorkflowPolicy.ManualTargetFieldKey);
        var hasDefaultTarget = !string.IsNullOrWhiteSpace(policy.WorkflowPolicy.DefaultTargetUnitId);
        var hasStaticTargets = policy.WorkflowPolicy.StaticTargetUnitIds.Count > 0;

        if (isManualWorkflow && !allowManualSelection)
        {
            errors.Add(new Error
            {
                Code = "400",
                Message = "وضع التوجيه اليدوي يتطلب تفعيل السماح بالاختيار اليدوي. إذا لم ترغب بذلك استخدم وضع هجين أو ثابت."
            });
        }

        if ((isManualWorkflow || (isHybridWorkflow && allowManualSelection))
            && !hasManualTargetField)
        {
            errors.Add(new Error
            {
                Code = "400",
                Message = "تم اختيار وضع يتضمن التوجيه اليدوي، لذلك يجب تحديد الحقل الذي سيستخدم لاختيار جهة التوجيه."
            });
        }

        if (isManualWorkflow
            && !manualSelectionRequired
            && !hasDefaultTarget)
        {
            errors.Add(new Error
            {
                Code = "400",
                Message = "عند جعل الاختيار اليدوي غير إلزامي في الوضع اليدوي، يجب تحديد الجهة الافتراضية."
            });
        }

        if (isHybridWorkflow
            && !allowManualSelection
            && !hasStaticTargets
            && !hasDefaultTarget)
        {
            errors.Add(new Error
            {
                Code = "400",
                Message = "في الوضع الهجين مع إيقاف الاختيار اليدوي، يجب تحديد جهة ثابتة أو جهة افتراضية."
            });
        }

        if (isHybridWorkflow
            && allowManualSelection
            && !manualSelectionRequired
            && !hasStaticTargets
            && !hasDefaultTarget)
        {
            errors.Add(new Error
            {
                Code = "400",
                Message = "في الوضع الهجين مع اختيار يدوي غير إلزامي، يجب تحديد مسار بديل (جهة ثابتة أو افتراضية)."
            });
        }

        if (string.Equals(createMode, "single", StringComparison.OrdinalIgnoreCase)
            && policy.AccessPolicy.CreateScope.UnitIds.Count > 1)
        {
            errors.Add(new Error
            {
                Code = "400",
                Message = "عند اختيار وضع إنشاء جهة واحدة، يجب تحديد جهة واحدة فقط ضمن نطاق الإنشاء."
            });
        }

        for (var ruleIndex = 0; ruleIndex < policy.PresentationRules.Count; ruleIndex++)
        {
            var rule = policy.PresentationRules[ruleIndex];
            if (rule.FieldPatches.Count == 0)
            {
                errors.Add(new Error
                {
                    Code = "400",
                    Message = $"PresentationRules[{ruleIndex}] لا يحتوي على أي FieldPatches."
                });
            }

            for (var patchIndex = 0; patchIndex < rule.FieldPatches.Count; patchIndex++)
            {
                var patch = rule.FieldPatches[patchIndex];
                if (string.IsNullOrWhiteSpace(patch.FieldKey))
                {
                    errors.Add(new Error
                    {
                        Code = "400",
                        Message = $"PresentationRules[{ruleIndex}].FieldPatches[{patchIndex}] يجب أن يحتوي FieldKey صالح."
                    });
                }

                if (!HasAnyPatchOperation(patch))
                {
                    errors.Add(new Error
                    {
                        Code = "400",
                        Message = $"PresentationRules[{ruleIndex}].FieldPatches[{patchIndex}] لا يحتوي أي تحديث فعلي للخصائص."
                    });
                }
            }

            if (rule.Conditions.Count == 0)
            {
                errors.Add(new Error
                {
                    Code = "400",
                    Message = $"PresentationRules[{ruleIndex}] يجب أن يحتوي شرطًا واحدًا على الأقل."
                });
            }

            for (var conditionIndex = 0; conditionIndex < rule.Conditions.Count; conditionIndex++)
            {
                var condition = rule.Conditions[conditionIndex];
                if (string.IsNullOrWhiteSpace(condition.Variable))
                {
                    errors.Add(new Error
                    {
                        Code = "400",
                        Message = $"PresentationRules[{ruleIndex}].Conditions[{conditionIndex}] يجب أن يحتوي Variable صالح."
                    });
                    continue;
                }

                var conditionOperator = NormalizeNullable(condition.Operator) ?? "eq";
                if (!SupportedConditionOperators.Contains(conditionOperator, StringComparer.OrdinalIgnoreCase))
                {
                    errors.Add(new Error
                    {
                        Code = "400",
                        Message = $"المعامل '{condition.Operator}' في PresentationRules[{ruleIndex}].Conditions[{conditionIndex}] غير مدعوم."
                    });
                }
            }
        }

        return errors;
    }

    public static RequestPolicyFieldPatchDto? ResolvePresentationMetadata(
        string? fieldKey,
        RequestPolicyDefinitionDto? policy,
        IReadOnlyDictionary<string, string?> context)
    {
        var normalizedFieldKey = NormalizeFieldKey(fieldKey);
        if (normalizedFieldKey.Length == 0)
        {
            return null;
        }

        var normalizedPolicy = Normalize(policy);
        RequestPolicyFieldPatchDto? resolved = null;

        foreach (var rule in normalizedPolicy.PresentationRules
                     .Where(item => item.IsEnabled)
                     .OrderBy(item => item.Priority))
        {
            if (!MatchesConditions(rule.Conditions, context))
            {
                continue;
            }

            foreach (var patch in rule.FieldPatches)
            {
                if (!string.Equals(NormalizeFieldKey(patch.FieldKey), normalizedFieldKey, StringComparison.Ordinal))
                {
                    continue;
                }

                resolved ??= new RequestPolicyFieldPatchDto { FieldKey = fieldKey ?? string.Empty };
                resolved.Label = patch.Label ?? resolved.Label;
                resolved.Visible = patch.Visible ?? resolved.Visible;
                resolved.Required = patch.Required ?? resolved.Required;
                resolved.Readonly = patch.Readonly ?? resolved.Readonly;
                resolved.Placeholder = patch.Placeholder ?? resolved.Placeholder;
                resolved.HelpText = patch.HelpText ?? resolved.HelpText;
            }
        }

        return resolved;
    }

    public static ResolvedRequestAccessPolicy ResolveAccessPolicy(RequestPolicyDefinitionDto? policy)
    {
        var normalizedPolicy = Normalize(policy);
        return new ResolvedRequestAccessPolicy
        {
            CreateMode = NormalizeNullable(normalizedPolicy.AccessPolicy.CreateMode) ?? "single",
            CreateUnitIds = normalizedPolicy.AccessPolicy.CreateScope.UnitIds.ToHashSet(StringComparer.OrdinalIgnoreCase),
            ReadUnitIds = normalizedPolicy.AccessPolicy.ReadScope.UnitIds.ToHashSet(StringComparer.OrdinalIgnoreCase),
            WorkUnitIds = normalizedPolicy.AccessPolicy.WorkScope.UnitIds.ToHashSet(StringComparer.OrdinalIgnoreCase),
            InheritLegacyAccess = normalizedPolicy.AccessPolicy.InheritLegacyAccess
        };
    }

    public static ResolvedRequestWorkflowPolicy ResolveWorkflowPolicy(RequestPolicyDefinitionDto? policy)
    {
        var normalized = Normalize(policy).WorkflowPolicy;
        var mode = NormalizeNullable(normalized.Mode) ?? "manual";
        if (!SupportedWorkflowModes.Contains(mode, StringComparer.OrdinalIgnoreCase))
        {
            mode = "manual";
        }

        return new ResolvedRequestWorkflowPolicy
        {
            Mode = mode,
            StaticTargetUnitIds = normalized.StaticTargetUnitIds
                .Select(NormalizeNullable)
                .Where(item => item != null)
                .Cast<string>()
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList(),
            AllowManualSelection = normalized.AllowManualSelection,
            ManualTargetFieldKey = NormalizeNullable(normalized.ManualTargetFieldKey),
            ManualSelectionRequired = normalized.ManualSelectionRequired,
            DefaultTargetUnitId = NormalizeNullable(normalized.DefaultTargetUnitId)
        };
    }

    public static bool MatchesConditions(
        IReadOnlyCollection<RequestPolicyConditionDto>? conditions,
        IReadOnlyDictionary<string, string?> context)
    {
        var safeConditions = conditions ?? Array.Empty<RequestPolicyConditionDto>();
        foreach (var condition in safeConditions)
        {
            if (!MatchesCondition(condition, context))
            {
                return false;
            }
        }

        return true;
    }

    public static bool IsCreateAllowedForUnits(RequestPolicyDefinitionDto? policy, IReadOnlyCollection<string> userUnitIds)
    {
        var resolved = ResolveAccessPolicy(policy);
        if (resolved.CreateUnitIds.Count == 0)
        {
            return true;
        }

        return Intersects(resolved.CreateUnitIds, userUnitIds);
    }

    public static bool IsReadAllowedForUnits(RequestPolicyDefinitionDto? policy, IReadOnlyCollection<string> userUnitIds)
    {
        var resolved = ResolveAccessPolicy(policy);
        if (resolved.ReadUnitIds.Count == 0)
        {
            return true;
        }

        return Intersects(resolved.ReadUnitIds, userUnitIds);
    }

    public static bool IsWorkAllowedForUnits(RequestPolicyDefinitionDto? policy, IReadOnlyCollection<string> userUnitIds)
    {
        var resolved = ResolveAccessPolicy(policy);
        if (resolved.WorkUnitIds.Count == 0)
        {
            return true;
        }

        return Intersects(resolved.WorkUnitIds, userUnitIds);
    }

    private static bool Intersects(HashSet<string> targetUnits, IReadOnlyCollection<string> userUnitIds)
    {
        if (userUnitIds == null || userUnitIds.Count == 0)
        {
            return false;
        }

        foreach (var unit in userUnitIds)
        {
            var normalized = NormalizeNullable(unit);
            if (normalized == null)
            {
                continue;
            }

            if (targetUnits.Contains(normalized))
            {
                return true;
            }
        }

        return false;
    }

    private static bool MatchesCondition(RequestPolicyConditionDto? condition, IReadOnlyDictionary<string, string?> context)
    {
        if (condition == null)
        {
            return true;
        }

        var variableKey = NormalizeVariable(condition.Variable);
        if (variableKey.Length == 0)
        {
            return false;
        }

        var conditionOperator = NormalizeNullable(condition.Operator) ?? "eq";
        var targetValue = ResolveContextValue(context, variableKey);

        var normalizedSingleValue = NormalizeNullable(condition.Value);
        var normalizedValues = (condition.Values ?? new List<string>())
            .Select(NormalizeNullable)
            .Where(item => item != null)
            .Cast<string>()
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        if (normalizedSingleValue != null && !normalizedValues.Contains(normalizedSingleValue, StringComparer.OrdinalIgnoreCase))
        {
            normalizedValues.Add(normalizedSingleValue);
        }

        return conditionOperator.ToLowerInvariant() switch
        {
            "eq" => normalizedSingleValue != null
                && string.Equals(targetValue ?? string.Empty, normalizedSingleValue, StringComparison.OrdinalIgnoreCase),
            "neq" => normalizedSingleValue == null
                || !string.Equals(targetValue ?? string.Empty, normalizedSingleValue, StringComparison.OrdinalIgnoreCase),
            "in" => targetValue != null
                && normalizedValues.Contains(targetValue, StringComparer.OrdinalIgnoreCase),
            "notin" => targetValue == null
                || !normalizedValues.Contains(targetValue, StringComparer.OrdinalIgnoreCase),
            "contains" => targetValue != null
                && normalizedSingleValue != null
                && targetValue.Contains(normalizedSingleValue, StringComparison.OrdinalIgnoreCase),
            "exists" => targetValue != null,
            "empty" => targetValue == null,
            _ => false
        };
    }

    private static string? ResolveContextValue(IReadOnlyDictionary<string, string?> context, string key)
    {
        if (context == null || context.Count == 0)
        {
            return null;
        }

        if (context.TryGetValue(key, out var value))
        {
            return NormalizeNullable(value);
        }

        var pair = context.FirstOrDefault(item =>
            string.Equals(NormalizeVariable(item.Key), key, StringComparison.OrdinalIgnoreCase));
        return NormalizeNullable(pair.Value);
    }

    private static RequestAccessPolicyDto NormalizeAccessPolicy(RequestAccessPolicyDto? input)
    {
        var access = input ?? new RequestAccessPolicyDto();
        return new RequestAccessPolicyDto
        {
            CreateMode = NormalizeNullable(access.CreateMode) ?? "single",
            CreateScope = NormalizeScope(access.CreateScope),
            ReadScope = NormalizeScope(access.ReadScope),
            WorkScope = NormalizeScope(access.WorkScope),
            InheritLegacyAccess = access.InheritLegacyAccess
        };
    }

    private static RequestWorkflowPolicyDto NormalizeWorkflowPolicy(RequestWorkflowPolicyDto? input)
    {
        var workflow = input ?? new RequestWorkflowPolicyDto();
        return new RequestWorkflowPolicyDto
        {
            Mode = NormalizeNullable(workflow.Mode) ?? "manual",
            StaticTargetUnitIds = (workflow.StaticTargetUnitIds ?? new List<string>())
                .Select(NormalizeNullable)
                .Where(item => item != null)
                .Cast<string>()
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList(),
            AllowManualSelection = workflow.AllowManualSelection,
            ManualTargetFieldKey = NormalizeNullable(workflow.ManualTargetFieldKey),
            ManualSelectionRequired = workflow.ManualSelectionRequired,
            DefaultTargetUnitId = NormalizeNullable(workflow.DefaultTargetUnitId)
        };
    }

    private static RequestPolicyPrincipalScopeDto NormalizeScope(RequestPolicyPrincipalScopeDto? input)
    {
        var scope = input ?? new RequestPolicyPrincipalScopeDto();
        return new RequestPolicyPrincipalScopeDto
        {
            UnitIds = NormalizeStringList(scope.UnitIds),
            RoleIds = NormalizeStringList(scope.RoleIds),
            GroupIds = NormalizeStringList(scope.GroupIds)
        };
    }

    private static List<RequestPolicyConditionDto> NormalizeConditions(IReadOnlyCollection<RequestPolicyConditionDto>? conditions)
    {
        return (conditions ?? Array.Empty<RequestPolicyConditionDto>())
            .Where(condition => condition != null)
            .Select(condition => new RequestPolicyConditionDto
            {
                Variable = NormalizeVariable(condition.Variable),
                Operator = NormalizeNullable(condition.Operator) ?? "eq",
                Value = NormalizeNullable(condition.Value),
                Values = NormalizeStringList(condition.Values)
            })
            .ToList();
    }

    private static List<RequestPolicyFieldPatchDto> NormalizeFieldPatches(IReadOnlyCollection<RequestPolicyFieldPatchDto>? patches)
    {
        return (patches ?? Array.Empty<RequestPolicyFieldPatchDto>())
            .Where(patch => patch != null)
            .Select(patch => new RequestPolicyFieldPatchDto
            {
                FieldKey = NormalizeNullable(patch.FieldKey) ?? string.Empty,
                Label = NormalizeNullable(patch.Label),
                Visible = patch.Visible,
                Required = patch.Required,
                Readonly = patch.Readonly,
                Placeholder = NormalizeNullable(patch.Placeholder),
                HelpText = NormalizeNullable(patch.HelpText)
            })
            .ToList();
    }

    private static List<string> NormalizeStringList(IReadOnlyCollection<string>? values)
    {
        return (values ?? Array.Empty<string>())
            .Select(NormalizeNullable)
            .Where(item => item != null)
            .Cast<string>()
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    private static bool HasAnyPatchOperation(RequestPolicyFieldPatchDto patch)
    {
        if (patch == null)
        {
            return false;
        }

        return NormalizeNullable(patch.Label) != null
            || patch.Visible.HasValue
            || patch.Required.HasValue
            || patch.Readonly.HasValue
            || NormalizeNullable(patch.Placeholder) != null
            || NormalizeNullable(patch.HelpText) != null;
    }

    private static string NormalizeFieldKey(string? fieldKey)
    {
        var normalized = NormalizeNullable(fieldKey);
        return normalized?.ToLowerInvariant() ?? string.Empty;
    }

    private static string NormalizeVariable(string? key)
    {
        var normalized = NormalizeNullable(key);
        if (normalized == null)
        {
            return string.Empty;
        }

        return normalized
            .Replace("runtime.", string.Empty, StringComparison.OrdinalIgnoreCase)
            .Replace("context.", string.Empty, StringComparison.OrdinalIgnoreCase)
            .Trim()
            .ToLowerInvariant();
    }

    private static string? NormalizeNullable(string? value)
    {
        var normalized = (value ?? string.Empty).Trim();
        return normalized.Length == 0 ? null : normalized;
    }
}
