using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Models.Correspondance;
using Models.DTO.Common;
using Models.DTO.DynamicSubjects;
using Models.GPA.OrgStructure;
using Persistence.Data;
using Persistence.Services.DynamicSubjects.AdminAccessPolicy;
using Persistence.Services.DynamicSubjects.AdminCatalog;
using Persistence.Services.DynamicSubjects.FieldAccess;
using Xunit;

namespace Persistence.Tests;

public class FieldAccessResolutionServiceTests
{
    [Fact]
    public async Task ResolveAsync_HidesGroup26AndLocksActionField_ForUserOutsideUnit125()
    {
        await using var connectContext = CreateConnectContext();
        await using var gpaContext = CreateGpaContext();

        SeedCategory(connectContext, 124, "التظلمات");
        SeedUnifiedPolicy(connectContext, requestTypeId: 124, actionTakenFieldId: 501);
        SeedActiveUserPosition(gpaContext, userId: "84621", unitId: 120);

        await connectContext.SaveChangesAsync();
        await gpaContext.SaveChangesAsync();

        var service = new FieldAccessResolutionService(connectContext, gpaContext);
        var result = await service.ResolveAsync(new FieldAccessResolutionRequest
        {
            RequestTypeId = 124,
            UserId = "84621",
            Groups = BuildGroups(),
            Fields = BuildFields(actionTakenFieldId: 501, groupedFieldId: 502)
        });

        Assert.True(result.GroupStates.TryGetValue(26, out var group26State));
        Assert.NotNull(group26State);
        Assert.True(group26State!.IsHidden);
        Assert.False(group26State.CanView);

        Assert.True(result.FieldStatesByMendSql.TryGetValue(501, out var actionTakenState));
        Assert.NotNull(actionTakenState);
        Assert.True(actionTakenState!.CanView);
        Assert.True(actionTakenState.IsReadOnly);
        Assert.False(actionTakenState.CanEdit);

        Assert.True(result.FieldStatesByMendSql.TryGetValue(502, out var groupedFieldState));
        Assert.NotNull(groupedFieldState);
        Assert.True(groupedFieldState!.IsHidden);
        Assert.False(groupedFieldState.CanView);
    }

    [Fact]
    public async Task ResolveAsync_AllowsUnit125ToBypassGroupAndFieldLocks()
    {
        await using var connectContext = CreateConnectContext();
        await using var gpaContext = CreateGpaContext();

        SeedCategory(connectContext, 124, "التظلمات");
        SeedUnifiedPolicy(connectContext, requestTypeId: 124, actionTakenFieldId: 501);
        SeedActiveUserPosition(gpaContext, userId: "USR-125", unitId: 125);

        await connectContext.SaveChangesAsync();
        await gpaContext.SaveChangesAsync();

        var service = new FieldAccessResolutionService(connectContext, gpaContext);
        var result = await service.ResolveAsync(new FieldAccessResolutionRequest
        {
            RequestTypeId = 124,
            UserId = "USR-125",
            Groups = BuildGroups(),
            Fields = BuildFields(actionTakenFieldId: 501, groupedFieldId: 502)
        });

        Assert.True(result.GroupStates.TryGetValue(26, out var group26State));
        Assert.NotNull(group26State);
        Assert.False(group26State!.IsHidden);
        Assert.True(group26State.CanView);

        Assert.True(result.FieldStatesByMendSql.TryGetValue(501, out var actionTakenState));
        Assert.NotNull(actionTakenState);
        Assert.True(actionTakenState!.CanView);
        Assert.False(actionTakenState.IsReadOnly);
        Assert.True(actionTakenState.CanEdit);

        Assert.True(result.FieldStatesByMendSql.TryGetValue(502, out var groupedFieldState));
        Assert.NotNull(groupedFieldState);
        Assert.False(groupedFieldState!.IsHidden);
        Assert.True(groupedFieldState.CanView);
    }

    [Fact]
    public async Task ResolveAsync_StageScopedNoInputStaysInactive_WhenWorkflowContextIsMissingAndAutoResolveIsDisabled()
    {
        await using var connectContext = CreateConnectContext();
        await using var gpaContext = CreateGpaContext();

        SeedCategory(connectContext, 124, "التظلمات");
        SeedWorkflowContext(connectContext, requestTypeId: 124, stageId: 1, actionId: 1);
        SeedStageScopedNoInputLock(
            connectContext,
            requestTypeId: 124,
            fieldId: 155,
            stageId: 1,
            actionId: 1,
            allowedOrgUnitId: "126");
        SeedActiveUserPosition(gpaContext, userId: "USR-OUTSIDE-126", unitId: 120);

        await connectContext.SaveChangesAsync();
        await gpaContext.SaveChangesAsync();

        var service = new FieldAccessResolutionService(connectContext, gpaContext);
        var result = await service.ResolveAsync(new FieldAccessResolutionRequest
        {
            RequestTypeId = 124,
            UserId = "USR-OUTSIDE-126",
            Groups = BuildGroups(),
            Fields = BuildFields(actionTakenFieldId: 155, groupedFieldId: 502),
            ResolveMissingStageActionFromWorkflowStart = false
        });

        Assert.True(result.FieldStatesByMendSql.TryGetValue(155, out var fieldState));
        Assert.NotNull(fieldState);
        Assert.False(fieldState!.IsLocked);
        Assert.False(fieldState.IsReadOnly);
        Assert.True(fieldState.CanEdit);
    }

    [Fact]
    public async Task ResolveAsync_StageScopedNoInputLocksField_ForUserOutsideAllowedUnit_WhenWorkflowContextAutoResolves()
    {
        await using var connectContext = CreateConnectContext();
        await using var gpaContext = CreateGpaContext();

        SeedCategory(connectContext, 124, "التظلمات");
        SeedWorkflowContext(connectContext, requestTypeId: 124, stageId: 1, actionId: 1);
        SeedStageScopedNoInputLock(
            connectContext,
            requestTypeId: 124,
            fieldId: 155,
            stageId: 1,
            actionId: 1,
            allowedOrgUnitId: "126");
        SeedActiveUserPosition(gpaContext, userId: "USR-OUTSIDE-126", unitId: 120);

        await connectContext.SaveChangesAsync();
        await gpaContext.SaveChangesAsync();

        var service = new FieldAccessResolutionService(connectContext, gpaContext);
        var result = await service.ResolveAsync(new FieldAccessResolutionRequest
        {
            RequestTypeId = 124,
            UserId = "USR-OUTSIDE-126",
            Groups = BuildGroups(),
            Fields = BuildFields(actionTakenFieldId: 155, groupedFieldId: 502),
            ResolveMissingStageActionFromWorkflowStart = true
        });

        Assert.True(result.FieldStatesByMendSql.TryGetValue(155, out var fieldState));
        Assert.NotNull(fieldState);
        Assert.True(fieldState!.IsLocked);
        Assert.True(fieldState.IsReadOnly);
        Assert.False(fieldState.CanEdit);
    }

    [Fact]
    public async Task ResolveAsync_StageScopedNoInputAllowsUnit126Bypass_WhenWorkflowContextAutoResolves()
    {
        await using var connectContext = CreateConnectContext();
        await using var gpaContext = CreateGpaContext();

        SeedCategory(connectContext, 124, "التظلمات");
        SeedWorkflowContext(connectContext, requestTypeId: 124, stageId: 1, actionId: 1);
        SeedStageScopedNoInputLock(
            connectContext,
            requestTypeId: 124,
            fieldId: 155,
            stageId: 1,
            actionId: 1,
            allowedOrgUnitId: "126");
        SeedActiveUserPosition(gpaContext, userId: "USR-INSIDE-126", unitId: 126);

        await connectContext.SaveChangesAsync();
        await gpaContext.SaveChangesAsync();

        var service = new FieldAccessResolutionService(connectContext, gpaContext);
        var result = await service.ResolveAsync(new FieldAccessResolutionRequest
        {
            RequestTypeId = 124,
            UserId = "USR-INSIDE-126",
            Groups = BuildGroups(),
            Fields = BuildFields(actionTakenFieldId: 155, groupedFieldId: 502),
            ResolveMissingStageActionFromWorkflowStart = true
        });

        Assert.True(result.FieldStatesByMendSql.TryGetValue(155, out var fieldState));
        Assert.NotNull(fieldState);
        Assert.False(fieldState!.IsLocked);
        Assert.False(fieldState.IsReadOnly);
        Assert.True(fieldState.CanEdit);
    }

    private static List<SubjectGroupDefinitionDto> BuildGroups()
    {
        return new List<SubjectGroupDefinitionDto>
        {
            new()
            {
                GroupId = 20,
                GroupName = "البيانات الرئيسية",
                GroupWithInRow = 12,
                IsExtendable = false
            },
            new()
            {
                GroupId = 26,
                GroupName = "المجموعة 26",
                GroupWithInRow = 12,
                IsExtendable = false
            }
        };
    }

    private static List<SubjectFieldDefinitionDto> BuildFields(int actionTakenFieldId, int groupedFieldId)
    {
        return new List<SubjectFieldDefinitionDto>
        {
            new()
            {
                MendSql = actionTakenFieldId,
                CategoryId = 124,
                MendGroup = 20,
                FieldKey = "ACTION_TAKEN",
                FieldType = "InputText",
                FieldLabel = "الإجراء المتخذ",
                Required = false,
                IsVisible = true,
                IsDisabledInit = false,
                DisplayOrder = 1,
                Group = new SubjectGroupDefinitionDto
                {
                    GroupId = 20,
                    GroupName = "البيانات الرئيسية",
                    GroupWithInRow = 12,
                    IsExtendable = false
                }
            },
            new()
            {
                MendSql = groupedFieldId,
                CategoryId = 124,
                MendGroup = 26,
                FieldKey = "GROUP26_FIELD",
                FieldType = "InputText",
                FieldLabel = "حقل داخل المجموعة 26",
                Required = false,
                IsVisible = true,
                IsDisabledInit = false,
                DisplayOrder = 2,
                Group = new SubjectGroupDefinitionDto
                {
                    GroupId = 26,
                    GroupName = "المجموعة 26",
                    GroupWithInRow = 12,
                    IsExtendable = false
                }
            }
        };
    }

    private static void SeedUnifiedPolicy(ConnectContext context, int requestTypeId, int actionTakenFieldId)
    {
        var policy = new FieldAccessPolicy
        {
            RequestTypeId = requestTypeId,
            Name = "سياسة الوصول - التظلمات",
            IsActive = true,
            DefaultAccessMode = "Editable",
            CreatedBy = "SYSTEM",
            CreatedDate = DateTime.UtcNow,
            LastModifiedBy = "SYSTEM",
            LastModifiedDate = DateTime.UtcNow
        };

        context.FieldAccessPolicies.Add(policy);
        context.FieldAccessLocks.AddRange(
            new FieldAccessLock
            {
                RequestTypeId = requestTypeId,
                TargetLevel = "Group",
                TargetId = 26,
                LockMode = "FullLock",
                AllowedOverrideSubjectType = "OrgUnit",
                AllowedOverrideSubjectId = "125",
                IsActive = true,
                Notes = "المجموعة 26 مخفية افتراضيًا، ويسمح بعرضها فقط للوحدة التنظيمية 125.",
                CreatedBy = "SYSTEM",
                CreatedDate = DateTime.UtcNow,
                LastModifiedBy = "SYSTEM",
                LastModifiedDate = DateTime.UtcNow
            },
            new FieldAccessLock
            {
                RequestTypeId = requestTypeId,
                TargetLevel = "Field",
                TargetId = actionTakenFieldId,
                LockMode = "NoEdit",
                AllowedOverrideSubjectType = "OrgUnit",
                AllowedOverrideSubjectId = "125",
                IsActive = true,
                Notes = "حقل \"الإجراء المتخذ\" ظاهر للجميع، لكن التعديل مسموح فقط للوحدة التنظيمية 125.",
                CreatedBy = "SYSTEM",
                CreatedDate = DateTime.UtcNow,
                LastModifiedBy = "SYSTEM",
                LastModifiedDate = DateTime.UtcNow
            });
    }

    private static void SeedWorkflowContext(ConnectContext context, int requestTypeId, int stageId, int actionId)
    {
        var now = DateTime.UtcNow;
        var profile = new SubjectRoutingProfile
        {
            Id = 3001,
            SubjectTypeId = requestTypeId,
            NameAr = "مسار اختبار",
            DescriptionAr = "مسار لاختبار Stage/Action في صلاحيات الحقول.",
            IsActive = true,
            DirectionMode = "Both",
            StartStepId = stageId,
            VersionNo = 1,
            CreatedBy = "SYSTEM",
            CreatedDate = now,
            LastModifiedBy = "SYSTEM",
            LastModifiedDate = now
        };

        context.SubjectRoutingProfiles.Add(profile);
        context.SubjectTypeRoutingBindings.Add(new SubjectTypeRoutingBinding
        {
            Id = 4001,
            SubjectTypeId = requestTypeId,
            RoutingProfileId = profile.Id,
            IsDefault = true,
            AppliesToInbound = true,
            AppliesToOutbound = true,
            IsActive = true,
            CreatedBy = "SYSTEM",
            CreatedDate = now,
            LastModifiedBy = "SYSTEM",
            LastModifiedDate = now
        });

        context.SubjectRoutingSteps.AddRange(
            new SubjectRoutingStep
            {
                Id = stageId,
                RoutingProfileId = profile.Id,
                StepCode = "STAGE_1",
                StepNameAr = "المرحلة الأولى",
                StepType = "Approval",
                StepOrder = 1,
                IsStart = true,
                IsEnd = false,
                SlaHours = null,
                IsActive = true,
                NotesAr = null,
                CreatedBy = "SYSTEM",
                CreatedDate = now,
                LastModifiedBy = "SYSTEM",
                LastModifiedDate = now
            },
            new SubjectRoutingStep
            {
                Id = stageId + 100,
                RoutingProfileId = profile.Id,
                StepCode = "STAGE_2",
                StepNameAr = "المرحلة الثانية",
                StepType = "Approval",
                StepOrder = 2,
                IsStart = false,
                IsEnd = true,
                SlaHours = null,
                IsActive = true,
                NotesAr = null,
                CreatedBy = "SYSTEM",
                CreatedDate = now,
                LastModifiedBy = "SYSTEM",
                LastModifiedDate = now
            });

        context.SubjectRoutingTransitions.Add(new SubjectRoutingTransition
        {
            Id = actionId,
            RoutingProfileId = profile.Id,
            FromStepId = stageId,
            ToStepId = stageId + 100,
            ActionCode = "ACTION_1",
            ActionNameAr = "الإجراء الأول",
            DisplayOrder = 1,
            RequiresComment = false,
            RequiresMandatoryFieldsCompletion = false,
            IsRejectPath = false,
            IsReturnPath = false,
            IsEscalationPath = false,
            ConditionExpression = null,
            IsActive = true,
            CreatedBy = "SYSTEM",
            CreatedDate = now,
            LastModifiedBy = "SYSTEM",
            LastModifiedDate = now
        });
    }

    private static void SeedStageScopedNoInputLock(
        ConnectContext context,
        int requestTypeId,
        int fieldId,
        int stageId,
        int actionId,
        string allowedOrgUnitId)
    {
        context.FieldAccessPolicies.Add(new FieldAccessPolicy
        {
            RequestTypeId = requestTypeId,
            Name = "سياسة اختبار سياق المرحلة/الإجراء",
            IsActive = true,
            DefaultAccessMode = "Editable",
            CreatedBy = "SYSTEM",
            CreatedDate = DateTime.UtcNow,
            LastModifiedBy = "SYSTEM",
            LastModifiedDate = DateTime.UtcNow
        });

        context.FieldAccessLocks.Add(new FieldAccessLock
        {
            RequestTypeId = requestTypeId,
            StageId = stageId,
            ActionId = actionId,
            TargetLevel = "Field",
            TargetId = fieldId,
            LockMode = "NoInput",
            AllowedOverrideSubjectType = "OrgUnit",
            AllowedOverrideSubjectId = allowedOrgUnitId,
            IsActive = true,
            Notes = $"الحقل #{fieldId} مقفل في {stageId}/{actionId} إلا للوحدة {allowedOrgUnitId}.",
            CreatedBy = "SYSTEM",
            CreatedDate = DateTime.UtcNow,
            LastModifiedBy = "SYSTEM",
            LastModifiedDate = DateTime.UtcNow
        });
    }

    private static void SeedCategory(ConnectContext context, int categoryId, string categoryName)
    {
        context.Cdcategories.Add(new Cdcategory
        {
            CatId = categoryId,
            CatParent = 0,
            CatName = categoryName,
            CatStatus = false,
            CatMend = null,
            CatWorkFlow = 0,
            CatSms = false,
            CatMailNotification = false,
            To = null,
            Cc = null,
            StampDate = DateTime.UtcNow,
            CatCreatedBy = null,
            ApplicationId = "60",
            Stockholder = 0
        });
    }

    private static void SeedActiveUserPosition(GPAContext context, string userId, decimal unitId)
    {
        context.UserPositions.Add(new UserPosition
        {
            PositionId = Math.Abs(userId.GetHashCode()),
            UserId = userId,
            UnitId = unitId,
            StartDate = DateTime.Today.AddDays(-1),
            EndDate = DateTime.Today.AddDays(1),
            IsActive = true,
            IsManager = false
        });
    }

    private static ConnectContext CreateConnectContext()
    {
        var options = new DbContextOptionsBuilder<ConnectContext>()
            .UseInMemoryDatabase($"field-access-resolution-tests-{Guid.NewGuid():N}")
            .ConfigureWarnings(builder => builder.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;

        return new ConnectContext(options, new HttpContextAccessor());
    }

    private static GPAContext CreateGpaContext()
    {
        var options = new DbContextOptionsBuilder<GPAContext>()
            .UseInMemoryDatabase($"field-access-resolution-gpa-tests-{Guid.NewGuid():N}")
            .Options;

        return new GPAContext(options);
    }
}

public class DynamicSubjectsAdminAccessPolicyServiceTests
{
    [Fact]
    public async Task UpsertWorkspace_RemovesConflictingTypeLevelOverrides()
    {
        await using var connectContext = CreateConnectContext();
        await using var gpaContext = CreateGpaContext();

        SeedCategory(connectContext, 124, "التظلمات");
        SeedAccessMetadata(connectContext, categoryId: 124, fieldMendSql: 500, fieldKey: "ACTION_TAKEN", fieldLabel: "الإجراء المتخذ");

        var existingPolicy = new FieldAccessPolicy
        {
            RequestTypeId = 124,
            Name = "سياسة قديمة",
            IsActive = true,
            DefaultAccessMode = "ReadOnly",
            CreatedBy = "SYSTEM",
            CreatedDate = DateTime.UtcNow,
            LastModifiedBy = "SYSTEM",
            LastModifiedDate = DateTime.UtcNow
        };
        connectContext.FieldAccessPolicies.Add(existingPolicy);
        await connectContext.SaveChangesAsync();

        var existingRule = new FieldAccessPolicyRule
        {
            PolicyId = existingPolicy.Id,
            TargetLevel = "Field",
            TargetId = 500,
            PermissionType = "Hidden",
            SubjectType = "OrgUnit",
            SubjectId = "120",
            Effect = "Allow",
            Priority = 900,
            IsActive = true,
            CreatedBy = "SYSTEM",
            CreatedDate = DateTime.UtcNow,
            LastModifiedBy = "SYSTEM",
            LastModifiedDate = DateTime.UtcNow
        };
        connectContext.FieldAccessPolicyRules.Add(existingRule);
        await connectContext.SaveChangesAsync();

        connectContext.FieldAccessOverrides.AddRange(
            new FieldAccessOverride
            {
                RequestTypeId = 124,
                TargetLevel = "Field",
                TargetId = 500,
                SubjectType = "OrgUnit",
                SubjectId = "120",
                OverridePermissionType = "Hidden",
                Reason = "override by request type",
                GrantedBy = "SYSTEM",
                GrantedAt = DateTime.UtcNow,
                IsActive = true
            },
            new FieldAccessOverride
            {
                RuleId = existingRule.Id,
                TargetLevel = "Field",
                TargetId = 500,
                SubjectType = "OrgUnit",
                SubjectId = "120",
                OverridePermissionType = "Hidden",
                Reason = "override by old rule",
                GrantedBy = "SYSTEM",
                GrantedAt = DateTime.UtcNow,
                IsActive = true
            });
        await connectContext.SaveChangesAsync();

        var service = new DynamicSubjectsAdminAccessPolicyService(
            connectContext,
            new NoopFieldAccessResolutionService(),
            new NoopPreviewCache());

        var response = await service.UpsertWorkspaceAsync(
            requestTypeId: 124,
            request: new FieldAccessPolicyWorkspaceUpsertRequestDto
            {
                PolicyName = "سياسة الوصول - التظلمات",
                IsPolicyActive = true,
                DefaultAccessMode = "Editable",
                Rules = new List<FieldAccessPolicyRuleDto>
                {
                    new()
                    {
                        TargetLevel = "Group",
                        TargetId = 26,
                        PermissionType = "Editable",
                        SubjectType = "OrgUnit",
                        SubjectId = "125",
                        Effect = "Allow",
                        Priority = 500,
                        IsActive = true
                    }
                },
                Locks = new List<FieldAccessLockDto>
                {
                    new()
                    {
                        TargetLevel = "Field",
                        TargetId = 500,
                        LockMode = "NoEdit",
                        AllowedOverrideSubjectType = "OrgUnit",
                        AllowedOverrideSubjectId = "125",
                        IsActive = true
                    }
                }
            },
            userId: "admin");

        Assert.True(response.IsSuccess);

        var remainingConflictingOverrides = await connectContext.FieldAccessOverrides
            .Where(item => item.IsActive && (item.RequestTypeId == 124 || item.RuleId.HasValue))
            .ToListAsync();

        Assert.Empty(remainingConflictingOverrides);
    }

    private static void SeedAccessMetadata(ConnectContext context, int categoryId, int fieldMendSql, string fieldKey, string fieldLabel)
    {
        context.AdminCatalogCategoryGroups.Add(new AdminCatalogCategoryGroup
        {
            GroupId = 26,
            CategoryId = categoryId,
            ApplicationId = "60",
            GroupName = "المجموعة 26",
            GroupDescription = "",
            ParentGroupId = null,
            DisplayOrder = 1,
            IsActive = true,
            StampDate = DateTime.UtcNow,
            CreatedBy = null
        });

        context.AdminCatalogCategoryFieldBindings.Add(new AdminCatalogCategoryFieldBinding
        {
            MendSql = fieldMendSql,
            CategoryId = categoryId,
            MendField = fieldKey,
            MendStat = false,
            GroupId = 26
        });

        context.Cdmends.Add(new Cdmend
        {
            CdmendSql = fieldMendSql,
            CdmendType = "InputText",
            CdmendTxt = fieldKey,
            CDMendLbl = fieldLabel,
            Placeholder = string.Empty,
            DefaultValue = string.Empty,
            CdmendTbl = null,
            CdmendDatatype = "string",
            Required = false,
            RequiredTrue = false,
            Email = false,
            Pattern = false,
            MinValue = null,
            MaxValue = null,
            Cdmendmask = null,
            CdmendStat = false,
            Width = 0,
            Height = 0,
            IsDisabledInit = false,
            IsSearchable = false,
            ApplicationId = "60"
        });
    }

    private static void SeedCategory(ConnectContext context, int categoryId, string categoryName)
    {
        context.Cdcategories.Add(new Cdcategory
        {
            CatId = categoryId,
            CatParent = 0,
            CatName = categoryName,
            CatStatus = false,
            CatMend = null,
            CatWorkFlow = 0,
            CatSms = false,
            CatMailNotification = false,
            To = null,
            Cc = null,
            StampDate = DateTime.UtcNow,
            CatCreatedBy = null,
            ApplicationId = "60",
            Stockholder = 0
        });
    }

    private static ConnectContext CreateConnectContext()
    {
        var options = new DbContextOptionsBuilder<ConnectContext>()
            .UseInMemoryDatabase($"field-access-upsert-tests-{Guid.NewGuid():N}")
            .ConfigureWarnings(builder => builder.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;

        return new ConnectContext(options, new HttpContextAccessor());
    }

    private static GPAContext CreateGpaContext()
    {
        var options = new DbContextOptionsBuilder<GPAContext>()
            .UseInMemoryDatabase($"field-access-upsert-gpa-tests-{Guid.NewGuid():N}")
            .Options;

        return new GPAContext(options);
    }

    private sealed class NoopFieldAccessResolutionService : IFieldAccessResolutionService
    {
        public Task<FieldAccessResolutionResult> ResolveAsync(FieldAccessResolutionRequest request, CancellationToken cancellationToken = default)
        {
            return Task.FromResult(new FieldAccessResolutionResult());
        }
    }

    private sealed class NoopPreviewCache : IAdminControlCenterRequestPreviewCache
    {
        public Task<CommonResponse<AdminControlCenterRequestPreviewDto>?> TryGetAsync(
            int requestTypeId,
            string userId,
            CancellationToken cancellationToken = default)
        {
            return Task.FromResult<CommonResponse<AdminControlCenterRequestPreviewDto>?>(null);
        }

        public Task SetAsync(
            int requestTypeId,
            string userId,
            CommonResponse<AdminControlCenterRequestPreviewDto> value,
            TimeSpan ttl,
            CancellationToken cancellationToken = default)
        {
            return Task.CompletedTask;
        }

        public Task InvalidateAllAsync(CancellationToken cancellationToken = default)
        {
            return Task.CompletedTask;
        }
    }
}
