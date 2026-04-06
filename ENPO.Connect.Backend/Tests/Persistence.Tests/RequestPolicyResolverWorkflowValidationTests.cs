using Models.DTO.DynamicSubjects;
using Persistence.Services.DynamicSubjects;
using Xunit;

namespace Persistence.Tests;

public class RequestPolicyResolverWorkflowValidationTests
{
    [Fact]
    public void ManualMode_Rejects_WhenAllowManualSelectionIsDisabled()
    {
        var policy = BuildPolicy(workflow =>
        {
            workflow.Mode = "manual";
            workflow.AllowManualSelection = false;
            workflow.ManualTargetFieldKey = "StockholderID";
        });

        var errors = RequestPolicyResolver.Validate(policy);

        Assert.Contains(errors, error => (error.Message ?? string.Empty).Contains("يتطلب تفعيل السماح بالاختيار اليدوي"));
    }

    [Fact]
    public void ManualMode_Rejects_WhenManualTargetFieldKeyIsMissing()
    {
        var policy = BuildPolicy(workflow =>
        {
            workflow.Mode = "manual";
            workflow.AllowManualSelection = true;
            workflow.ManualTargetFieldKey = null;
        });

        var errors = RequestPolicyResolver.Validate(policy);

        Assert.Contains(errors, error => (error.Message ?? string.Empty).Contains("يجب تحديد الحقل الذي سيستخدم لاختيار جهة التوجيه"));
    }

    [Fact]
    public void ManualMode_Rejects_WhenManualSelectionIsOptionalWithoutDefaultTarget()
    {
        var policy = BuildPolicy(workflow =>
        {
            workflow.Mode = "manual";
            workflow.AllowManualSelection = true;
            workflow.ManualTargetFieldKey = "StockholderID";
            workflow.ManualSelectionRequired = false;
            workflow.DefaultTargetUnitId = null;
        });

        var errors = RequestPolicyResolver.Validate(policy);

        Assert.Contains(errors, error => (error.Message ?? string.Empty).Contains("يجب تحديد الجهة الافتراضية"));
    }

    [Fact]
    public void HybridMode_Rejects_WhenManualDisabledAndNoFallback()
    {
        var policy = BuildPolicy(workflow =>
        {
            workflow.Mode = "hybrid";
            workflow.AllowManualSelection = false;
            workflow.StaticTargetUnitIds.Clear();
            workflow.DefaultTargetUnitId = null;
        });

        var errors = RequestPolicyResolver.Validate(policy);

        Assert.Contains(errors, error => (error.Message ?? string.Empty).Contains("يجب تحديد جهة ثابتة أو جهة افتراضية"));
    }

    [Fact]
    public void HybridMode_Rejects_WhenManualOptionalAndNoFallback()
    {
        var policy = BuildPolicy(workflow =>
        {
            workflow.Mode = "hybrid";
            workflow.AllowManualSelection = true;
            workflow.ManualTargetFieldKey = "StockholderID";
            workflow.ManualSelectionRequired = false;
            workflow.StaticTargetUnitIds.Clear();
            workflow.DefaultTargetUnitId = null;
        });

        var errors = RequestPolicyResolver.Validate(policy);

        Assert.Contains(errors, error => (error.Message ?? string.Empty).Contains("يجب تحديد مسار بديل"));
    }

    [Fact]
    public void ManualMode_Passes_WhenManualTargetAndBehaviorAreValid()
    {
        var policy = BuildPolicy(workflow =>
        {
            workflow.Mode = "manual";
            workflow.AllowManualSelection = true;
            workflow.ManualTargetFieldKey = "StockholderID";
            workflow.ManualSelectionRequired = true;
            workflow.DefaultTargetUnitId = null;
        });

        var errors = RequestPolicyResolver.Validate(policy);

        Assert.DoesNotContain(errors, error => (error.Message ?? string.Empty).Contains("الحقل الذي سيستخدم لاختيار جهة التوجيه"));
        Assert.DoesNotContain(errors, error => (error.Message ?? string.Empty).Contains("يتطلب تفعيل السماح بالاختيار اليدوي"));
    }

    private static RequestPolicyDefinitionDto BuildPolicy(System.Action<RequestWorkflowPolicyDto> configureWorkflow)
    {
        var workflow = new RequestWorkflowPolicyDto();
        configureWorkflow(workflow);

        return new RequestPolicyDefinitionDto
        {
            Version = 1,
            AccessPolicy = new RequestAccessPolicyDto
            {
                CreateMode = "single"
            },
            WorkflowPolicy = workflow,
            PresentationRules = new()
        };
    }
}
