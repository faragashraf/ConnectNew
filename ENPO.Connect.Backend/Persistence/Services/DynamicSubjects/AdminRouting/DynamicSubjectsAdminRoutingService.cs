using Models.Correspondance;
using Models.DTO.Common;
using Models.DTO.DynamicSubjects;
using Models.GPA;
using Models.GPA.OrgStructure;

namespace Persistence.Services.DynamicSubjects.AdminRouting;

public sealed class DynamicSubjectsAdminRoutingService : IDynamicSubjectsAdminRoutingService
{
    private const int ProfileNameMaxLength = 200;
    private const int ProfileDescriptionMaxLength = 2000;
    private const int StepCodeMaxLength = 50;
    private const int StepNameMaxLength = 200;
    private const int StepTypeMaxLength = 30;
    private const int TargetModeMaxLength = 30;
    private const int ActionCodeMaxLength = 50;
    private const int ActionNameMaxLength = 200;
    private const int ConditionExpressionMaxLength = 2000;
    private const int NotesMaxLength = 1000;
    private const int PositionCodeMaxLength = 64;
    private const int AvailabilityModeMaxLength = 20;
    private const int SelectedNodeTypeMaxLength = 20;
    private const int SelectedNodeUserIdMaxLength = 20;
    private const int SelectionLabelMaxLength = 300;
    private const int SelectionPathMaxLength = 1000;
    private const int AudienceResolutionModeMaxLength = 40;
    private const int WorkDistributionModeMaxLength = 40;

    private static readonly IReadOnlyDictionary<string, string> SupportedDirectionModes =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["none"] = "None",
            ["inbound"] = "InboundOnly",
            ["inboundonly"] = "InboundOnly",
            ["outbound"] = "OutboundOnly",
            ["outboundonly"] = "OutboundOnly",
            ["both"] = "Both"
        };

    private static readonly HashSet<string> SupportedStepTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "Start",
        "Review",
        "Approval",
        "Assignment",
        "Completion",
        "Return",
        "Rejection",
        "Escalation"
    };

    private static readonly HashSet<string> SupportedTargetModes = new(StringComparer.OrdinalIgnoreCase)
    {
        "UnitType",
        "SpecificUnit",
        "UnitLeader",
        "Position",
        "CommitteeMembers",
        "ParentUnitLeader",
        "ChildUnitByType"
    };

    private static readonly IReadOnlyDictionary<string, string> SupportedSelectedNodeTypes =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["orgunit"] = "OrgUnit",
            ["unit"] = "OrgUnit",
            ["position"] = "Position",
            ["specificuser"] = "SpecificUser",
            ["user"] = "SpecificUser"
        };

    private static readonly IReadOnlyDictionary<string, string> SupportedAvailabilityModes =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["public"] = "Public",
            ["restricted"] = "Restricted"
        };

    private static readonly IReadOnlyDictionary<string, string> SupportedAudienceModes =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["orgunitallmembers"] = "OrgUnitAllMembers",
            ["allmembers"] = "OrgUnitAllMembers",
            ["orgunitleaderonly"] = "OrgUnitLeaderOnly",
            ["leaderonly"] = "OrgUnitLeaderOnly",
            ["positionoccupants"] = "PositionOccupants",
            ["occupants"] = "PositionOccupants",
            ["specificuseronly"] = "SpecificUserOnly",
            ["useronly"] = "SpecificUserOnly"
        };

    private static readonly IReadOnlyDictionary<string, string> SupportedWorkDistributionModes =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["sharedinbox"] = "SharedInbox",
            ["shared"] = "SharedInbox",
            ["autodistributeactive"] = "AutoDistributeActive",
            ["auto"] = "AutoDistributeActive",
            ["manualassignment"] = "ManualAssignment",
            ["manual"] = "ManualAssignment"
        };

    private readonly IDynamicSubjectsAdminRoutingRepository _repository;

    public DynamicSubjectsAdminRoutingService(IDynamicSubjectsAdminRoutingRepository repository)
    {
        _repository = repository;
    }

    public async Task<CommonResponse<IEnumerable<SubjectRoutingProfileDto>>> GetProfilesByRequestTypeAsync(
        int subjectTypeId,
        string userId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<IEnumerable<SubjectRoutingProfileDto>>();
        try
        {
            var normalizedUser = NormalizeUser(userId);
            if (normalizedUser.Length == 0)
            {
                AddUnauthorized(response);
                return response;
            }

            if (subjectTypeId <= 0)
            {
                response.Errors.Add(new Error { Code = "400", Message = "نوع الطلب مطلوب." });
                return response;
            }

            if (!await _repository.SubjectTypeExistsAsync(subjectTypeId, cancellationToken))
            {
                response.Errors.Add(new Error { Code = "404", Message = "نوع الطلب غير موجود." });
                return response;
            }

            var profiles = await _repository.ListProfilesBySubjectTypeAsync(subjectTypeId, cancellationToken);
            response.Data = profiles.Select(MapProfile).ToList();
        }
        catch (Exception)
        {
            AddUnhandledError(response);
        }

        return response;
    }

    public async Task<CommonResponse<SubjectRoutingProfileWorkspaceDto>> GetProfileByRequestTypeAsync(
        int subjectTypeId,
        string? direction,
        string userId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<SubjectRoutingProfileWorkspaceDto>();
        try
        {
            var normalizedUser = NormalizeUser(userId);
            if (normalizedUser.Length == 0)
            {
                AddUnauthorized(response);
                return response;
            }

            if (subjectTypeId <= 0)
            {
                response.Errors.Add(new Error { Code = "400", Message = "نوع الطلب مطلوب." });
                return response;
            }

            if (!await _repository.SubjectTypeExistsAsync(subjectTypeId, cancellationToken))
            {
                response.Errors.Add(new Error { Code = "404", Message = "نوع الطلب غير موجود." });
                return response;
            }

            var directionFilter = NormalizeDirectionFilter(direction);
            if (directionFilter == "__invalid__")
            {
                response.Errors.Add(new Error { Code = "400", Message = "اتجاه التوجيه غير صالح." });
                return response;
            }

            var bindings = await _repository.ListBindingsBySubjectTypeAsync(subjectTypeId, cancellationToken);
            var profiles = await _repository.ListProfilesBySubjectTypeAsync(subjectTypeId, cancellationToken);
            var profilesById = profiles.ToDictionary(item => item.Id);

            var selectedBinding = bindings
                .Where(binding => binding.IsActive)
                .Where(binding => profilesById.ContainsKey(binding.RoutingProfileId))
                .Where(binding => directionFilter == null || BindingMatchesDirection(binding, directionFilter))
                .Where(binding =>
                {
                    if (!profilesById.TryGetValue(binding.RoutingProfileId, out var profile))
                    {
                        return false;
                    }

                    return profile.IsActive && ProfileMatchesDirection(profile.DirectionMode, directionFilter);
                })
                .OrderByDescending(binding => binding.IsDefault)
                .ThenByDescending(binding => binding.Id)
                .FirstOrDefault();

            if (selectedBinding == null)
            {
                response.Data = new SubjectRoutingProfileWorkspaceDto();
                return response;
            }

            response.Data = await BuildWorkspaceAsync(
                selectedBinding.RoutingProfileId,
                selectedBinding.Id,
                cancellationToken)
                ?? new SubjectRoutingProfileWorkspaceDto();
        }
        catch (Exception)
        {
            AddUnhandledError(response);
        }

        return response;
    }

    public async Task<CommonResponse<SubjectRoutingProfileWorkspaceDto>> GetProfileWorkspaceAsync(
        int profileId,
        string userId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<SubjectRoutingProfileWorkspaceDto>();
        try
        {
            var normalizedUser = NormalizeUser(userId);
            if (normalizedUser.Length == 0)
            {
                AddUnauthorized(response);
                return response;
            }

            if (profileId <= 0)
            {
                response.Errors.Add(new Error { Code = "400", Message = "معرف المسار مطلوب." });
                return response;
            }

            var workspace = await BuildWorkspaceAsync(profileId, null, cancellationToken);
            if (workspace == null || workspace.Profile == null)
            {
                response.Errors.Add(new Error { Code = "404", Message = "ملف التوجيه غير موجود." });
                return response;
            }

            response.Data = workspace;
        }
        catch (Exception)
        {
            AddUnhandledError(response);
        }

        return response;
    }

    public async Task<CommonResponse<SubjectRoutingProfileDto>> CreateProfileAsync(
        SubjectRoutingProfileUpsertRequestDto request,
        string userId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<SubjectRoutingProfileDto>();
        try
        {
            var normalizedUser = NormalizeUser(userId);
            if (normalizedUser.Length == 0)
            {
                AddUnauthorized(response);
                return response;
            }

            var safeRequest = request ?? new SubjectRoutingProfileUpsertRequestDto();
            var validated = await ValidateAndNormalizeProfileRequestAsync(
                safeRequest,
                excludedProfileId: null,
                response,
                cancellationToken);
            if (validated == null)
            {
                return response;
            }

            var profile = new SubjectRoutingProfile
            {
                SubjectTypeId = validated.SubjectTypeId,
                NameAr = validated.NameAr,
                DescriptionAr = validated.DescriptionAr,
                IsActive = validated.IsActive,
                DirectionMode = validated.DirectionMode,
                StartStepId = null,
                VersionNo = validated.VersionNo,
                CreatedBy = normalizedUser,
                CreatedDate = DateTime.UtcNow,
                LastModifiedBy = normalizedUser,
                LastModifiedDate = DateTime.UtcNow
            };

            await _repository.AddProfileAsync(profile, cancellationToken);
            await _repository.SaveChangesAsync(cancellationToken);

            response.Data = MapProfile(profile);
        }
        catch (Exception)
        {
            AddUnhandledError(response);
        }

        return response;
    }

    public async Task<CommonResponse<SubjectRoutingProfileDto>> UpdateProfileAsync(
        int profileId,
        SubjectRoutingProfileUpsertRequestDto request,
        string userId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<SubjectRoutingProfileDto>();
        try
        {
            var normalizedUser = NormalizeUser(userId);
            if (normalizedUser.Length == 0)
            {
                AddUnauthorized(response);
                return response;
            }

            var profile = await _repository.FindProfileAsync(profileId, cancellationToken);
            if (profile == null)
            {
                response.Errors.Add(new Error { Code = "404", Message = "ملف التوجيه غير موجود." });
                return response;
            }

            var safeRequest = request ?? new SubjectRoutingProfileUpsertRequestDto();
            var validated = await ValidateAndNormalizeProfileRequestAsync(
                safeRequest,
                excludedProfileId: profileId,
                response,
                cancellationToken);
            if (validated == null)
            {
                return response;
            }

            if (validated.SubjectTypeId != profile.SubjectTypeId)
            {
                var existingBindings = await _repository.ListBindingsByProfileAsync(profileId, cancellationToken);
                if (existingBindings.Count > 0)
                {
                    response.Errors.Add(new Error
                    {
                        Code = "400",
                        Message = "لا يمكن تغيير نوع الطلب لملف مرتبط بالفعل بربط/Bindings. عدّل الربط أولًا."
                    });
                    return response;
                }
            }

            int? normalizedStartStepId = null;
            if (safeRequest.StartStepId.HasValue && safeRequest.StartStepId.Value > 0)
            {
                var startStep = await _repository.FindStepAsync(safeRequest.StartStepId.Value, cancellationToken);
                if (startStep == null || startStep.RoutingProfileId != profileId)
                {
                    response.Errors.Add(new Error { Code = "400", Message = "خطوة البداية المحددة غير صالحة لهذا المسار." });
                    return response;
                }

                normalizedStartStepId = startStep.Id;
            }
            else if (profile.StartStepId.HasValue)
            {
                normalizedStartStepId = profile.StartStepId;
            }
            profile.SubjectTypeId = validated.SubjectTypeId;
            profile.NameAr = validated.NameAr;
            profile.DescriptionAr = validated.DescriptionAr;
            profile.IsActive = validated.IsActive;
            profile.DirectionMode = validated.DirectionMode;
            profile.StartStepId = normalizedStartStepId;
            profile.VersionNo = validated.VersionNo;
            profile.LastModifiedBy = normalizedUser;
            profile.LastModifiedDate = DateTime.UtcNow;

            await _repository.SaveChangesAsync(cancellationToken);
            response.Data = MapProfile(profile);
        }
        catch (Exception)
        {
            AddUnhandledError(response);
        }

        return response;
    }

    public async Task<CommonResponse<SubjectRoutingStepDto>> AddStepAsync(
        SubjectRoutingStepUpsertRequestDto request,
        string userId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<SubjectRoutingStepDto>();
        try
        {
            var normalizedUser = NormalizeUser(userId);
            if (normalizedUser.Length == 0)
            {
                AddUnauthorized(response);
                return response;
            }

            var safeRequest = request ?? new SubjectRoutingStepUpsertRequestDto();
            var validated = await ValidateAndNormalizeStepRequestAsync(
                safeRequest,
                excludedStepId: null,
                response,
                cancellationToken);
            if (validated == null)
            {
                return response;
            }

            var step = new SubjectRoutingStep
            {
                RoutingProfileId = validated.RoutingProfileId,
                StepCode = validated.StepCode,
                StepNameAr = validated.StepNameAr,
                StepType = validated.StepType,
                StepOrder = validated.StepOrder,
                IsStart = validated.IsStart,
                IsEnd = validated.IsEnd,
                SlaHours = validated.SlaHours,
                IsActive = validated.IsActive,
                NotesAr = validated.NotesAr,
                CreatedBy = normalizedUser,
                CreatedDate = DateTime.UtcNow,
                LastModifiedBy = normalizedUser,
                LastModifiedDate = DateTime.UtcNow
            };

            await _repository.AddStepAsync(step, cancellationToken);
            await _repository.SaveChangesAsync(cancellationToken);

            if (step.IsStart)
            {
                var profile = await _repository.FindProfileAsync(step.RoutingProfileId, cancellationToken);
                if (profile != null)
                {
                    profile.StartStepId = step.Id;
                    profile.LastModifiedBy = normalizedUser;
                    profile.LastModifiedDate = DateTime.UtcNow;
                    await _repository.SaveChangesAsync(cancellationToken);
                }
            }

            response.Data = MapStep(step);
        }
        catch (Exception)
        {
            AddUnhandledError(response);
        }

        return response;
    }

    public async Task<CommonResponse<SubjectRoutingStepDto>> UpdateStepAsync(
        int stepId,
        SubjectRoutingStepUpsertRequestDto request,
        string userId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<SubjectRoutingStepDto>();
        try
        {
            var normalizedUser = NormalizeUser(userId);
            if (normalizedUser.Length == 0)
            {
                AddUnauthorized(response);
                return response;
            }

            var step = await _repository.FindStepAsync(stepId, cancellationToken);
            if (step == null)
            {
                response.Errors.Add(new Error { Code = "404", Message = "الخطوة غير موجودة." });
                return response;
            }

            var safeRequest = request ?? new SubjectRoutingStepUpsertRequestDto();
            if (safeRequest.RoutingProfileId > 0 && safeRequest.RoutingProfileId != step.RoutingProfileId)
            {
                response.Errors.Add(new Error { Code = "400", Message = "لا يمكن نقل الخطوة إلى مسار آخر عبر هذا الإجراء." });
                return response;
            }

            safeRequest.RoutingProfileId = step.RoutingProfileId;
            var validated = await ValidateAndNormalizeStepRequestAsync(
                safeRequest,
                excludedStepId: stepId,
                response,
                cancellationToken);
            if (validated == null)
            {
                return response;
            }

            step.StepCode = validated.StepCode;
            step.StepNameAr = validated.StepNameAr;
            step.StepType = validated.StepType;
            step.StepOrder = validated.StepOrder;
            step.IsStart = validated.IsStart;
            step.IsEnd = validated.IsEnd;
            step.SlaHours = validated.SlaHours;
            step.IsActive = validated.IsActive;
            step.NotesAr = validated.NotesAr;
            step.LastModifiedBy = normalizedUser;
            step.LastModifiedDate = DateTime.UtcNow;

            var profile = await _repository.FindProfileAsync(step.RoutingProfileId, cancellationToken);
            if (profile != null)
            {
                if (step.IsStart)
                {
                    profile.StartStepId = step.Id;
                }
                else if (profile.StartStepId == step.Id)
                {
                    profile.StartStepId = null;
                }

                profile.LastModifiedBy = normalizedUser;
                profile.LastModifiedDate = DateTime.UtcNow;
            }

            await _repository.SaveChangesAsync(cancellationToken);
            response.Data = MapStep(step);
        }
        catch (Exception)
        {
            AddUnhandledError(response);
        }

        return response;
    }

    public async Task<CommonResponse<bool>> DeleteStepAsync(
        int stepId,
        string userId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<bool>();
        try
        {
            var normalizedUser = NormalizeUser(userId);
            if (normalizedUser.Length == 0)
            {
                AddUnauthorized(response);
                return response;
            }

            var step = await _repository.FindStepAsync(stepId, cancellationToken);
            if (step == null)
            {
                response.Errors.Add(new Error { Code = "404", Message = "الخطوة غير موجودة." });
                return response;
            }

            var transitions = await _repository.ListTransitionsByProfileAsync(step.RoutingProfileId, cancellationToken);
            foreach (var transition in transitions.Where(item => item.FromStepId == stepId || item.ToStepId == stepId))
            {
                var trackedTransition = await _repository.FindTransitionAsync(transition.Id, cancellationToken);
                if (trackedTransition != null)
                {
                    _repository.RemoveTransition(trackedTransition);
                }
            }

            var profile = await _repository.FindProfileAsync(step.RoutingProfileId, cancellationToken);
            if (profile != null && profile.StartStepId == stepId)
            {
                profile.StartStepId = null;
                profile.LastModifiedBy = normalizedUser;
                profile.LastModifiedDate = DateTime.UtcNow;
            }

            _repository.RemoveStep(step);
            await _repository.SaveChangesAsync(cancellationToken);
            response.Data = true;
        }
        catch (Exception)
        {
            AddUnhandledError(response);
        }

        return response;
    }

    public async Task<CommonResponse<SubjectRoutingTargetDto>> AddTargetAsync(
        SubjectRoutingTargetUpsertRequestDto request,
        string userId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<SubjectRoutingTargetDto>();
        try
        {
            var normalizedUser = NormalizeUser(userId);
            if (normalizedUser.Length == 0)
            {
                AddUnauthorized(response);
                return response;
            }

            var safeRequest = request ?? new SubjectRoutingTargetUpsertRequestDto();
            var validated = await ValidateAndNormalizeTargetRequestAsync(
                safeRequest,
                response,
                cancellationToken);
            if (validated == null)
            {
                return response;
            }

            var target = new SubjectRoutingTarget
            {
                RoutingStepId = validated.RoutingStepId,
                TargetMode = validated.TargetMode,
                OracleUnitTypeId = validated.OracleUnitTypeId,
                OracleOrgUnitId = validated.OracleOrgUnitId,
                PositionId = validated.PositionId,
                PositionCode = validated.PositionCode,
                SelectedNodeType = validated.SelectedNodeType,
                SelectedNodeNumericId = validated.SelectedNodeNumericId,
                SelectedNodeUserId = validated.SelectedNodeUserId,
                AudienceResolutionMode = validated.AudienceResolutionMode,
                WorkDistributionMode = validated.WorkDistributionMode,
                AllowMultipleReceivers = validated.AllowMultipleReceivers,
                SendToLeaderOnly = validated.SendToLeaderOnly,
                IsActive = validated.IsActive,
                NotesAr = validated.NotesAr,
                CreatedBy = normalizedUser,
                CreatedDate = DateTime.UtcNow,
                LastModifiedBy = normalizedUser,
                LastModifiedDate = DateTime.UtcNow
            };

            await _repository.AddTargetAsync(target, cancellationToken);
            await _repository.SaveChangesAsync(cancellationToken);

            response.Data = MapTarget(target);
        }
        catch (Exception)
        {
            AddUnhandledError(response);
        }

        return response;
    }

    public async Task<CommonResponse<SubjectRoutingTargetDto>> UpdateTargetAsync(
        int targetId,
        SubjectRoutingTargetUpsertRequestDto request,
        string userId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<SubjectRoutingTargetDto>();
        try
        {
            var normalizedUser = NormalizeUser(userId);
            if (normalizedUser.Length == 0)
            {
                AddUnauthorized(response);
                return response;
            }

            var target = await _repository.FindTargetAsync(targetId, cancellationToken);
            if (target == null)
            {
                response.Errors.Add(new Error { Code = "404", Message = "الجهة المستهدفة غير موجودة." });
                return response;
            }

            var safeRequest = request ?? new SubjectRoutingTargetUpsertRequestDto();
            if (safeRequest.RoutingStepId <= 0)
            {
                safeRequest.RoutingStepId = target.RoutingStepId;
            }

            var validated = await ValidateAndNormalizeTargetRequestAsync(
                safeRequest,
                response,
                cancellationToken);
            if (validated == null)
            {
                return response;
            }

            target.RoutingStepId = validated.RoutingStepId;
            target.TargetMode = validated.TargetMode;
            target.OracleUnitTypeId = validated.OracleUnitTypeId;
            target.OracleOrgUnitId = validated.OracleOrgUnitId;
            target.PositionId = validated.PositionId;
            target.PositionCode = validated.PositionCode;
            target.SelectedNodeType = validated.SelectedNodeType;
            target.SelectedNodeNumericId = validated.SelectedNodeNumericId;
            target.SelectedNodeUserId = validated.SelectedNodeUserId;
            target.AudienceResolutionMode = validated.AudienceResolutionMode;
            target.WorkDistributionMode = validated.WorkDistributionMode;
            target.AllowMultipleReceivers = validated.AllowMultipleReceivers;
            target.SendToLeaderOnly = validated.SendToLeaderOnly;
            target.IsActive = validated.IsActive;
            target.NotesAr = validated.NotesAr;
            target.LastModifiedBy = normalizedUser;
            target.LastModifiedDate = DateTime.UtcNow;

            await _repository.SaveChangesAsync(cancellationToken);
            response.Data = MapTarget(target);
        }
        catch (Exception)
        {
            AddUnhandledError(response);
        }

        return response;
    }

    public async Task<CommonResponse<bool>> DeleteTargetAsync(
        int targetId,
        string userId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<bool>();
        try
        {
            var normalizedUser = NormalizeUser(userId);
            if (normalizedUser.Length == 0)
            {
                AddUnauthorized(response);
                return response;
            }

            var target = await _repository.FindTargetAsync(targetId, cancellationToken);
            if (target == null)
            {
                response.Errors.Add(new Error { Code = "404", Message = "الجهة المستهدفة غير موجودة." });
                return response;
            }

            _repository.RemoveTarget(target);
            await _repository.SaveChangesAsync(cancellationToken);
            response.Data = true;
        }
        catch (Exception)
        {
            AddUnhandledError(response);
        }

        return response;
    }

    public async Task<CommonResponse<SubjectRoutingTransitionDto>> AddTransitionAsync(
        SubjectRoutingTransitionUpsertRequestDto request,
        string userId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<SubjectRoutingTransitionDto>();
        try
        {
            var normalizedUser = NormalizeUser(userId);
            if (normalizedUser.Length == 0)
            {
                AddUnauthorized(response);
                return response;
            }

            var safeRequest = request ?? new SubjectRoutingTransitionUpsertRequestDto();
            var validated = await ValidateAndNormalizeTransitionRequestAsync(
                safeRequest,
                excludedTransitionId: null,
                response,
                cancellationToken);
            if (validated == null)
            {
                return response;
            }

            var transition = new SubjectRoutingTransition
            {
                RoutingProfileId = validated.RoutingProfileId,
                FromStepId = validated.FromStepId,
                ToStepId = validated.ToStepId,
                ActionCode = validated.ActionCode,
                ActionNameAr = validated.ActionNameAr,
                DisplayOrder = validated.DisplayOrder,
                RequiresComment = validated.RequiresComment,
                RequiresMandatoryFieldsCompletion = validated.RequiresMandatoryFieldsCompletion,
                IsRejectPath = validated.IsRejectPath,
                IsReturnPath = validated.IsReturnPath,
                IsEscalationPath = validated.IsEscalationPath,
                ConditionExpression = validated.ConditionExpression,
                IsActive = validated.IsActive,
                CreatedBy = normalizedUser,
                CreatedDate = DateTime.UtcNow,
                LastModifiedBy = normalizedUser,
                LastModifiedDate = DateTime.UtcNow
            };

            await _repository.AddTransitionAsync(transition, cancellationToken);
            await _repository.SaveChangesAsync(cancellationToken);
            response.Data = MapTransition(transition);
        }
        catch (Exception)
        {
            AddUnhandledError(response);
        }

        return response;
    }

    public async Task<CommonResponse<SubjectRoutingTransitionDto>> UpdateTransitionAsync(
        int transitionId,
        SubjectRoutingTransitionUpsertRequestDto request,
        string userId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<SubjectRoutingTransitionDto>();
        try
        {
            var normalizedUser = NormalizeUser(userId);
            if (normalizedUser.Length == 0)
            {
                AddUnauthorized(response);
                return response;
            }

            var transition = await _repository.FindTransitionAsync(transitionId, cancellationToken);
            if (transition == null)
            {
                response.Errors.Add(new Error { Code = "404", Message = "الانتقال غير موجود." });
                return response;
            }

            var safeRequest = request ?? new SubjectRoutingTransitionUpsertRequestDto();
            if (safeRequest.RoutingProfileId > 0 && safeRequest.RoutingProfileId != transition.RoutingProfileId)
            {
                response.Errors.Add(new Error { Code = "400", Message = "لا يمكن نقل الانتقال إلى مسار آخر عبر هذا الإجراء." });
                return response;
            }

            safeRequest.RoutingProfileId = transition.RoutingProfileId;
            var validated = await ValidateAndNormalizeTransitionRequestAsync(
                safeRequest,
                excludedTransitionId: transitionId,
                response,
                cancellationToken);
            if (validated == null)
            {
                return response;
            }

            transition.FromStepId = validated.FromStepId;
            transition.ToStepId = validated.ToStepId;
            transition.ActionCode = validated.ActionCode;
            transition.ActionNameAr = validated.ActionNameAr;
            transition.DisplayOrder = validated.DisplayOrder;
            transition.RequiresComment = validated.RequiresComment;
            transition.RequiresMandatoryFieldsCompletion = validated.RequiresMandatoryFieldsCompletion;
            transition.IsRejectPath = validated.IsRejectPath;
            transition.IsReturnPath = validated.IsReturnPath;
            transition.IsEscalationPath = validated.IsEscalationPath;
            transition.ConditionExpression = validated.ConditionExpression;
            transition.IsActive = validated.IsActive;
            transition.LastModifiedBy = normalizedUser;
            transition.LastModifiedDate = DateTime.UtcNow;

            await _repository.SaveChangesAsync(cancellationToken);
            response.Data = MapTransition(transition);
        }
        catch (Exception)
        {
            AddUnhandledError(response);
        }

        return response;
    }

    public async Task<CommonResponse<bool>> DeleteTransitionAsync(
        int transitionId,
        string userId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<bool>();
        try
        {
            var normalizedUser = NormalizeUser(userId);
            if (normalizedUser.Length == 0)
            {
                AddUnauthorized(response);
                return response;
            }

            var transition = await _repository.FindTransitionAsync(transitionId, cancellationToken);
            if (transition == null)
            {
                response.Errors.Add(new Error { Code = "404", Message = "الانتقال غير موجود." });
                return response;
            }

            _repository.RemoveTransition(transition);
            await _repository.SaveChangesAsync(cancellationToken);
            response.Data = true;
        }
        catch (Exception)
        {
            AddUnhandledError(response);
        }

        return response;
    }

    public async Task<CommonResponse<SubjectTypeRoutingBindingDto>> BindProfileToRequestTypeAsync(
        SubjectTypeRoutingBindingUpsertRequestDto request,
        string userId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<SubjectTypeRoutingBindingDto>();
        try
        {
            var normalizedUser = NormalizeUser(userId);
            if (normalizedUser.Length == 0)
            {
                AddUnauthorized(response);
                return response;
            }

            var safeRequest = request ?? new SubjectTypeRoutingBindingUpsertRequestDto();
            if (safeRequest.SubjectTypeId <= 0)
            {
                response.Errors.Add(new Error { Code = "400", Message = "نوع الطلب مطلوب." });
                return response;
            }

            if (safeRequest.RoutingProfileId <= 0)
            {
                response.Errors.Add(new Error { Code = "400", Message = "معرف المسار مطلوب." });
                return response;
            }

            if (!safeRequest.AppliesToInbound && !safeRequest.AppliesToOutbound)
            {
                response.Errors.Add(new Error { Code = "400", Message = "يجب تحديد اتجاه واحد على الأقل للربط." });
                return response;
            }

            if (!await _repository.SubjectTypeExistsAsync(safeRequest.SubjectTypeId, cancellationToken))
            {
                response.Errors.Add(new Error { Code = "404", Message = "نوع الطلب غير موجود." });
                return response;
            }

            var profile = await _repository.FindProfileAsync(safeRequest.RoutingProfileId, cancellationToken);
            if (profile == null)
            {
                response.Errors.Add(new Error { Code = "404", Message = "ملف التوجيه غير موجود." });
                return response;
            }

            if (profile.SubjectTypeId != safeRequest.SubjectTypeId)
            {
                response.Errors.Add(new Error { Code = "400", Message = "لا يمكن ربط مسار بنوع طلب مختلف." });
                return response;
            }

            var binding = await _repository.FindBindingBySubjectAndProfileAsync(
                safeRequest.SubjectTypeId,
                safeRequest.RoutingProfileId,
                cancellationToken);

            if (safeRequest.IsDefault)
            {
                var existingBindings = await _repository.ListBindingsBySubjectTypeAsync(
                    safeRequest.SubjectTypeId,
                    cancellationToken);
                foreach (var existing in existingBindings.Where(item =>
                             item.IsDefault
                             && item.IsActive
                             && (binding == null || item.Id != binding.Id)))
                {
                    var tracked = await _repository.FindBindingAsync(existing.Id, cancellationToken);
                    if (tracked == null)
                    {
                        continue;
                    }

                    tracked.IsDefault = false;
                    tracked.LastModifiedBy = normalizedUser;
                    tracked.LastModifiedDate = DateTime.UtcNow;
                }
            }

            if (binding == null)
            {
                binding = new SubjectTypeRoutingBinding
                {
                    SubjectTypeId = safeRequest.SubjectTypeId,
                    RoutingProfileId = safeRequest.RoutingProfileId,
                    IsDefault = safeRequest.IsDefault,
                    AppliesToInbound = safeRequest.AppliesToInbound,
                    AppliesToOutbound = safeRequest.AppliesToOutbound,
                    IsActive = safeRequest.IsActive,
                    CreatedBy = normalizedUser,
                    CreatedDate = DateTime.UtcNow,
                    LastModifiedBy = normalizedUser,
                    LastModifiedDate = DateTime.UtcNow
                };

                await _repository.AddBindingAsync(binding, cancellationToken);
            }
            else
            {
                binding.IsDefault = safeRequest.IsDefault;
                binding.AppliesToInbound = safeRequest.AppliesToInbound;
                binding.AppliesToOutbound = safeRequest.AppliesToOutbound;
                binding.IsActive = safeRequest.IsActive;
                binding.LastModifiedBy = normalizedUser;
                binding.LastModifiedDate = DateTime.UtcNow;
            }

            await _repository.SaveChangesAsync(cancellationToken);
            response.Data = MapBinding(binding);
        }
        catch (Exception)
        {
            AddUnhandledError(response);
        }

        return response;
    }

    public async Task<CommonResponse<SubjectRoutingPreviewDto>> GetRoutingPreviewAsync(
        int profileId,
        string userId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<SubjectRoutingPreviewDto>();
        try
        {
            var normalizedUser = NormalizeUser(userId);
            if (normalizedUser.Length == 0)
            {
                AddUnauthorized(response);
                return response;
            }

            var workspace = await BuildWorkspaceAsync(profileId, null, cancellationToken);
            if (workspace?.Profile == null)
            {
                response.Errors.Add(new Error { Code = "404", Message = "ملف التوجيه غير موجود." });
                return response;
            }

            var steps = workspace.Steps;
            var transitions = workspace.Transitions.Where(item => item.IsActive).ToList();
            var targets = workspace.Targets.Where(item => item.IsActive).ToList();
            var stepsById = steps.ToDictionary(item => item.Id);

            var nodes = steps
                .OrderBy(item => item.StepOrder)
                .ThenBy(item => item.Id)
                .Select(step => new SubjectRoutingPreviewNodeDto
                {
                    StepId = step.Id,
                    StepCode = step.StepCode,
                    StepNameAr = step.StepNameAr,
                    StepType = step.StepType,
                    StepOrder = step.StepOrder,
                    IsStart = step.IsStart,
                    IsEnd = step.IsEnd,
                    IsRejectStep = transitions.Any(transition => transition.ToStepId == step.Id && transition.IsRejectPath)
                        || string.Equals(step.StepType, "Rejection", StringComparison.OrdinalIgnoreCase),
                    IsReturnStep = transitions.Any(transition => transition.ToStepId == step.Id && transition.IsReturnPath)
                        || string.Equals(step.StepType, "Return", StringComparison.OrdinalIgnoreCase),
                    IsEscalationStep = transitions.Any(transition => transition.ToStepId == step.Id && transition.IsEscalationPath)
                        || string.Equals(step.StepType, "Escalation", StringComparison.OrdinalIgnoreCase),
                    TargetsSummaryAr = BuildStepTargetsSummary(step.Id, targets)
                })
                .ToList();

            var edges = transitions
                .OrderBy(item => item.DisplayOrder)
                .ThenBy(item => item.Id)
                .Select(item => new SubjectRoutingPreviewEdgeDto
                {
                    TransitionId = item.Id,
                    FromStepId = item.FromStepId,
                    ToStepId = item.ToStepId,
                    ActionCode = item.ActionCode,
                    ActionNameAr = item.ActionNameAr,
                    DisplayOrder = item.DisplayOrder,
                    IsRejectPath = item.IsRejectPath,
                    IsReturnPath = item.IsReturnPath,
                    IsEscalationPath = item.IsEscalationPath
                })
                .ToList();

            var startStep = steps.FirstOrDefault(item => item.IsStart)
                ?? (workspace.Profile.StartStepId.HasValue && stepsById.TryGetValue(workspace.Profile.StartStepId.Value, out var configuredStart)
                    ? configuredStart
                    : steps.OrderBy(item => item.StepOrder).ThenBy(item => item.Id).FirstOrDefault());

            response.Data = new SubjectRoutingPreviewDto
            {
                RoutingProfileId = workspace.Profile.Id,
                ProfileNameAr = workspace.Profile.NameAr,
                StartStepId = startStep?.Id,
                Nodes = nodes,
                Edges = edges,
                SummaryAr = BuildPreviewSummary(workspace.Profile, steps, transitions, targets, startStep)
            };
        }
        catch (Exception)
        {
            AddUnhandledError(response);
        }

        return response;
    }

    public async Task<CommonResponse<SubjectRoutingValidationResultDto>> ValidateRoutingProfileAsync(
        int profileId,
        string userId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<SubjectRoutingValidationResultDto>();
        try
        {
            var normalizedUser = NormalizeUser(userId);
            if (normalizedUser.Length == 0)
            {
                AddUnauthorized(response);
                return response;
            }

            var workspace = await BuildWorkspaceAsync(profileId, null, cancellationToken);
            if (workspace?.Profile == null)
            {
                response.Errors.Add(new Error { Code = "404", Message = "ملف التوجيه غير موجود." });
                return response;
            }

            response.Data = await ValidateWorkspaceAsync(workspace, cancellationToken);
        }
        catch (Exception)
        {
            AddUnhandledError(response);
        }

        return response;
    }

    public async Task<CommonResponse<SubjectTypeRequestAvailabilityDto>> GetRequestAvailabilityAsync(
        int subjectTypeId,
        string userId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<SubjectTypeRequestAvailabilityDto>();
        try
        {
            var normalizedUser = NormalizeUser(userId);
            if (normalizedUser.Length == 0)
            {
                AddUnauthorized(response);
                return response;
            }

            if (subjectTypeId <= 0)
            {
                response.Errors.Add(new Error { Code = "400", Message = "نوع الطلب مطلوب." });
                return response;
            }

            if (!await _repository.SubjectTypeExistsAsync(subjectTypeId, cancellationToken))
            {
                response.Errors.Add(new Error { Code = "404", Message = "نوع الطلب غير موجود." });
                return response;
            }

            var availability = await _repository.FindRequestAvailabilityBySubjectTypeAsync(subjectTypeId, cancellationToken);
            response.Data = await BuildAvailabilityDtoAsync(subjectTypeId, availability, cancellationToken);
        }
        catch (Exception)
        {
            AddUnhandledError(response);
        }

        return response;
    }

    public async Task<CommonResponse<SubjectTypeRequestAvailabilityDto>> UpsertRequestAvailabilityAsync(
        int subjectTypeId,
        SubjectTypeRequestAvailabilityUpsertRequestDto request,
        string userId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<SubjectTypeRequestAvailabilityDto>();
        try
        {
            var normalizedUser = NormalizeUser(userId);
            if (normalizedUser.Length == 0)
            {
                AddUnauthorized(response);
                return response;
            }

            if (subjectTypeId <= 0)
            {
                response.Errors.Add(new Error { Code = "400", Message = "نوع الطلب مطلوب." });
                return response;
            }

            if (!await _repository.SubjectTypeExistsAsync(subjectTypeId, cancellationToken))
            {
                response.Errors.Add(new Error { Code = "404", Message = "نوع الطلب غير موجود." });
                return response;
            }

            var safeRequest = request ?? new SubjectTypeRequestAvailabilityUpsertRequestDto();
            var rawAvailabilityMode = NormalizeNullable(safeRequest.AvailabilityMode) ?? "Public";
            if (rawAvailabilityMode.Length > AvailabilityModeMaxLength)
            {
                response.Errors.Add(new Error { Code = "400", Message = $"نمط الإتاحة يجب ألا يزيد عن {AvailabilityModeMaxLength} حرفًا." });
                return response;
            }

            if (!TryNormalizeAvailabilityMode(rawAvailabilityMode, out var normalizedAvailabilityMode))
            {
                response.Errors.Add(new Error { Code = "400", Message = "نمط الإتاحة غير مدعوم. القيم المتاحة: Public أو Restricted." });
                return response;
            }

            var selectedNodeTypeRaw = NormalizeNullable(safeRequest.SelectedNodeType);
            var selectedNodeNumericId = safeRequest.SelectedNodeNumericId;
            var selectedNodeUserId = NormalizeNullable(safeRequest.SelectedNodeUserId);

            if (selectedNodeUserId != null && selectedNodeUserId.Length > SelectedNodeUserIdMaxLength)
            {
                response.Errors.Add(new Error { Code = "400", Message = $"معرف المستخدم المحدد يجب ألا يزيد عن {SelectedNodeUserIdMaxLength} حرفًا." });
                return response;
            }

            AvailabilityNodeResolutionResult? resolvedNode = null;
            string? normalizedSelectedNodeType = null;
            if (string.Equals(normalizedAvailabilityMode, "Public", StringComparison.OrdinalIgnoreCase))
            {
                if (selectedNodeTypeRaw != null || selectedNodeNumericId.HasValue || selectedNodeUserId != null)
                {
                    response.Errors.Add(new Error
                    {
                        Code = "400",
                        Message = "عند اختيار الإتاحة العامة لا يجوز إرسال SelectedNodeType أو SelectedNodeNumericId أو SelectedNodeUserId."
                    });
                    return response;
                }

                selectedNodeNumericId = null;
                selectedNodeUserId = null;
            }
            else
            {
                if (selectedNodeTypeRaw == null)
                {
                    response.Errors.Add(new Error { Code = "400", Message = "نوع العقدة مطلوب عند الإتاحة المحددة." });
                    return response;
                }

                if (selectedNodeTypeRaw.Length > SelectedNodeTypeMaxLength)
                {
                    response.Errors.Add(new Error { Code = "400", Message = $"نوع العقدة يجب ألا يزيد عن {SelectedNodeTypeMaxLength} حرفًا." });
                    return response;
                }

                if (!TryNormalizeSelectedNodeType(selectedNodeTypeRaw, out var normalizedNodeType))
                {
                    response.Errors.Add(new Error { Code = "400", Message = "نوع العقدة المحددة غير مدعوم." });
                    return response;
                }

                normalizedSelectedNodeType = normalizedNodeType;
                if (string.Equals(normalizedNodeType, "SpecificUser", StringComparison.OrdinalIgnoreCase))
                {
                    if (selectedNodeNumericId.HasValue)
                    {
                        response.Errors.Add(new Error { Code = "400", Message = "SelectedNodeNumericId غير مسموح مع نوع العقدة SpecificUser." });
                        return response;
                    }

                    if (selectedNodeUserId == null)
                    {
                        response.Errors.Add(new Error { Code = "400", Message = "SelectedNodeUserId مطلوب مع نوع العقدة SpecificUser." });
                        return response;
                    }
                }
                else
                {
                    if (!selectedNodeNumericId.HasValue || selectedNodeNumericId.Value <= 0)
                    {
                        response.Errors.Add(new Error { Code = "400", Message = "SelectedNodeNumericId مطلوب ويجب أن يكون أكبر من صفر." });
                        return response;
                    }

                    if (selectedNodeUserId != null)
                    {
                        response.Errors.Add(new Error { Code = "400", Message = "SelectedNodeUserId غير مسموح مع نوع العقدة OrgUnit أو Position." });
                        return response;
                    }
                }

                resolvedNode = await ValidateAndResolveAvailabilityNodeAsync(
                    normalizedNodeType,
                    selectedNodeNumericId,
                    selectedNodeUserId,
                    response.Errors,
                    cancellationToken);
                if (resolvedNode == null)
                {
                    return response;
                }

                normalizedSelectedNodeType = resolvedNode.SelectedNodeType;
                selectedNodeNumericId = resolvedNode.SelectedNodeNumericId;
                selectedNodeUserId = resolvedNode.SelectedNodeUserId;
            }

            var entity = await _repository.FindRequestAvailabilityBySubjectTypeAsync(subjectTypeId, cancellationToken);
            if (entity == null)
            {
                entity = new SubjectTypeRequestAvailability
                {
                    CategoryId = subjectTypeId
                };
                await _repository.AddRequestAvailabilityAsync(entity, cancellationToken);
            }

            entity.AvailabilityMode = normalizedAvailabilityMode;
            entity.SelectedNodeType = normalizedAvailabilityMode == "Restricted" ? normalizedSelectedNodeType : null;
            entity.SelectedNodeNumericId = normalizedAvailabilityMode == "Restricted" ? selectedNodeNumericId : null;
            entity.SelectedNodeUserId = normalizedAvailabilityMode == "Restricted" ? selectedNodeUserId : null;
            entity.SelectionLabelAr = normalizedAvailabilityMode == "Restricted"
                ? TruncateNullable(resolvedNode?.SelectedNodeLabelAr, SelectionLabelMaxLength)
                : null;
            entity.SelectionPathAr = normalizedAvailabilityMode == "Restricted"
                ? TruncateNullable(resolvedNode?.SelectedNodePathAr, SelectionPathMaxLength)
                : null;
            entity.LastModifiedBy = normalizedUser;
            entity.LastModifiedAtUtc = DateTime.UtcNow;

            await _repository.SaveChangesAsync(cancellationToken);

            response.Data = new SubjectTypeRequestAvailabilityDto
            {
                SubjectTypeId = subjectTypeId,
                AvailabilityMode = normalizedAvailabilityMode,
                SelectedNodeType = entity.SelectedNodeType,
                SelectedNodeNumericId = entity.SelectedNodeNumericId,
                SelectedNodeUserId = entity.SelectedNodeUserId,
                SelectedNodeLabelAr = resolvedNode?.SelectedNodeLabelAr ?? entity.SelectionLabelAr,
                SelectedNodeSecondaryLabelAr = resolvedNode?.SelectedNodeSecondaryLabelAr,
                SelectedNodePathAr = resolvedNode?.SelectedNodePathAr ?? entity.SelectionPathAr,
                AvailabilitySummaryAr = ResolveAvailabilitySummaryAr(normalizedAvailabilityMode, entity.SelectedNodeType),
                LastModifiedBy = entity.LastModifiedBy,
                LastModifiedAtUtc = entity.LastModifiedAtUtc
            };
        }
        catch (Exception)
        {
            AddUnhandledError(response);
        }

        return response;
    }

    public async Task<CommonResponse<SubjectAvailabilityNodeValidationResultDto>> ValidateRequestAvailabilityNodeAsync(
        int subjectTypeId,
        SubjectAvailabilityNodeValidationRequestDto request,
        string userId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<SubjectAvailabilityNodeValidationResultDto>
        {
            Data = new SubjectAvailabilityNodeValidationResultDto
            {
                IsValid = false
            }
        };

        try
        {
            var normalizedUser = NormalizeUser(userId);
            if (normalizedUser.Length == 0)
            {
                AddUnauthorized(response);
                return response;
            }

            if (subjectTypeId <= 0)
            {
                response.Errors.Add(new Error { Code = "400", Message = "نوع الطلب مطلوب." });
                return response;
            }

            if (!await _repository.SubjectTypeExistsAsync(subjectTypeId, cancellationToken))
            {
                response.Errors.Add(new Error { Code = "404", Message = "نوع الطلب غير موجود." });
                return response;
            }

            var safeRequest = request ?? new SubjectAvailabilityNodeValidationRequestDto();
            var selectedNodeTypeRaw = NormalizeNullable(safeRequest.SelectedNodeType);
            var selectedNodeNumericId = safeRequest.SelectedNodeNumericId;
            var selectedNodeUserId = NormalizeNullable(safeRequest.SelectedNodeUserId);

            if (selectedNodeTypeRaw == null)
            {
                response.Errors.Add(new Error { Code = "400", Message = "نوع العقدة مطلوب." });
                return response;
            }

            if (selectedNodeTypeRaw.Length > SelectedNodeTypeMaxLength)
            {
                response.Errors.Add(new Error { Code = "400", Message = $"نوع العقدة يجب ألا يزيد عن {SelectedNodeTypeMaxLength} حرفًا." });
                return response;
            }

            if (!TryNormalizeSelectedNodeType(selectedNodeTypeRaw, out var normalizedNodeType))
            {
                response.Errors.Add(new Error { Code = "400", Message = "نوع العقدة غير مدعوم." });
                return response;
            }

            if (selectedNodeUserId != null && selectedNodeUserId.Length > SelectedNodeUserIdMaxLength)
            {
                response.Errors.Add(new Error { Code = "400", Message = $"معرف المستخدم المحدد يجب ألا يزيد عن {SelectedNodeUserIdMaxLength} حرفًا." });
                return response;
            }

            if (string.Equals(normalizedNodeType, "SpecificUser", StringComparison.OrdinalIgnoreCase))
            {
                if (selectedNodeNumericId.HasValue)
                {
                    response.Errors.Add(new Error { Code = "400", Message = "SelectedNodeNumericId غير مسموح مع العقدة SpecificUser." });
                    return response;
                }
            }
            else if (!selectedNodeNumericId.HasValue || selectedNodeNumericId.Value <= 0)
            {
                response.Errors.Add(new Error { Code = "400", Message = "SelectedNodeNumericId مطلوب ويجب أن يكون أكبر من صفر." });
                return response;
            }

            var resolvedNode = await ValidateAndResolveAvailabilityNodeAsync(
                normalizedNodeType,
                selectedNodeNumericId,
                selectedNodeUserId,
                response.Errors,
                cancellationToken);
            if (resolvedNode == null)
            {
                return response;
            }

            response.Data = new SubjectAvailabilityNodeValidationResultDto
            {
                IsValid = true,
                SelectedNodeType = resolvedNode.SelectedNodeType,
                SelectedNodeNumericId = resolvedNode.SelectedNodeNumericId,
                SelectedNodeUserId = resolvedNode.SelectedNodeUserId,
                SelectedNodeLabelAr = resolvedNode.SelectedNodeLabelAr,
                SelectedNodeSecondaryLabelAr = resolvedNode.SelectedNodeSecondaryLabelAr,
                SelectedNodePathAr = resolvedNode.SelectedNodePathAr,
                AvailabilitySummaryAr = ResolveAvailabilitySummaryAr("Restricted", resolvedNode.SelectedNodeType)
            };
        }
        catch (Exception)
        {
            AddUnhandledError(response);
        }

        return response;
    }

    public async Task<CommonResponse<IEnumerable<SubjectRoutingOrgTreeNodeDto>>> GetAvailabilityTreeNodesAsync(
        int subjectTypeId,
        string userId,
        string? parentNodeType,
        decimal? parentNodeNumericId,
        string? parentNodeUserId,
        string? search,
        bool activeOnly,
        bool includeUsers,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<IEnumerable<SubjectRoutingOrgTreeNodeDto>>();
        try
        {
            var normalizedUser = NormalizeUser(userId);
            if (normalizedUser.Length == 0)
            {
                AddUnauthorized(response);
                return response;
            }

            if (subjectTypeId <= 0)
            {
                response.Errors.Add(new Error { Code = "400", Message = "نوع الطلب مطلوب." });
                return response;
            }

            if (!await _repository.SubjectTypeExistsAsync(subjectTypeId, cancellationToken))
            {
                response.Errors.Add(new Error { Code = "404", Message = "نوع الطلب غير موجود." });
                return response;
            }

            return await GetOracleTreeNodesAsync(
                normalizedUser,
                parentNodeType,
                parentNodeNumericId,
                parentNodeUserId,
                search,
                activeOnly,
                includeUsers,
                cancellationToken);
        }
        catch (Exception)
        {
            AddUnhandledError(response);
        }

        return response;
    }

    public async Task<CommonResponse<IEnumerable<SubjectRoutingOrgUnitTypeLookupDto>>> GetOracleUnitTypesAsync(
        string userId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<IEnumerable<SubjectRoutingOrgUnitTypeLookupDto>>();
        try
        {
            var normalizedUser = NormalizeUser(userId);
            if (normalizedUser.Length == 0)
            {
                AddUnauthorized(response);
                return response;
            }

            var unitTypes = await _repository.ListOracleUnitTypesAsync(cancellationToken);
            response.Data = unitTypes.Select(item => new SubjectRoutingOrgUnitTypeLookupDto
            {
                UnitTypeId = item.UnitTypeId,
                TypeName = item.TypeName ?? string.Empty,
                LeaderTitle = item.LeaderTitle,
                IsActive = item.Status != false
            }).ToList();
        }
        catch (Exception)
        {
            AddUnhandledError(response);
        }

        return response;
    }

    public async Task<CommonResponse<IEnumerable<SubjectRoutingOrgUnitLookupDto>>> GetOracleUnitsAsync(
        string userId,
        decimal? unitTypeId,
        decimal? parentId,
        string? search,
        bool activeOnly,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<IEnumerable<SubjectRoutingOrgUnitLookupDto>>();
        try
        {
            var normalizedUser = NormalizeUser(userId);
            if (normalizedUser.Length == 0)
            {
                AddUnauthorized(response);
                return response;
            }

            var units = await _repository.ListOracleUnitsAsync(unitTypeId, parentId, search, activeOnly, cancellationToken);
            response.Data = units.Select(item => new SubjectRoutingOrgUnitLookupDto
            {
                UnitId = item.UnitId,
                UnitName = item.UnitName ?? string.Empty,
                UnitTypeId = item.UnitTypeId,
                UnitTypeName = item.UnitType?.TypeName ?? string.Empty,
                ParentId = item.ParentId,
                IsActive = item.Status != false
            }).ToList();
        }
        catch (Exception)
        {
            AddUnhandledError(response);
        }

        return response;
    }

    public async Task<CommonResponse<IEnumerable<SubjectRoutingOrgPositionLookupDto>>> GetOraclePositionsAsync(
        string userId,
        string? targetUserId,
        decimal? unitId,
        bool activeOnly,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<IEnumerable<SubjectRoutingOrgPositionLookupDto>>();
        try
        {
            var normalizedUser = NormalizeUser(userId);
            if (normalizedUser.Length == 0)
            {
                AddUnauthorized(response);
                return response;
            }

            var positions = await _repository.ListOraclePositionsAsync(targetUserId, unitId, activeOnly, cancellationToken);
            var usersById = await BuildUsersLookupAsync(
                positions.Select(item => item.UserId),
                cancellationToken);

            response.Data = positions.Select(item =>
            {
                usersById.TryGetValue(item.UserId ?? string.Empty, out var userRecord);
                return new SubjectRoutingOrgPositionLookupDto
                {
                    PositionId = item.PositionId,
                    UserId = item.UserId ?? string.Empty,
                    UserDisplayNameAr = BuildUserDisplayNameAr(userRecord),
                    UserDisplayNameEn = BuildUserDisplayNameEn(userRecord),
                    UnitId = item.UnitId,
                    UnitName = item.Unit?.UnitName ?? string.Empty,
                    IsManager = item.IsManager == true,
                    IsActive = item.IsActive != false,
                    StartDate = item.StartDate,
                    EndDate = item.EndDate
                };
            }).ToList();
        }
        catch (Exception)
        {
            AddUnhandledError(response);
        }

        return response;
    }

    public async Task<CommonResponse<IEnumerable<SubjectRoutingOrgUserLookupDto>>> GetOracleUsersAsync(
        string userId,
        bool activeOnly,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<IEnumerable<SubjectRoutingOrgUserLookupDto>>();
        try
        {
            var normalizedUser = NormalizeUser(userId);
            if (normalizedUser.Length == 0)
            {
                AddUnauthorized(response);
                return response;
            }

            var positions = await _repository.ListOraclePositionsAsync(
                userId: null,
                unitId: null,
                activeOnly: activeOnly,
                cancellationToken: cancellationToken);

            var groupedUsers = positions
                .Where(item => !string.IsNullOrWhiteSpace(item.UserId))
                .GroupBy(item => item.UserId.Trim(), StringComparer.OrdinalIgnoreCase)
                .ToList();
            var usersById = await BuildUsersLookupAsync(groupedUsers.Select(item => item.Key), cancellationToken);

            response.Data = groupedUsers
                .Select(group =>
                {
                    usersById.TryGetValue(group.Key, out var userRecord);
                    return new SubjectRoutingOrgUserLookupDto
                    {
                        UserId = group.Key,
                        DisplayNameAr = BuildUserDisplayNameAr(userRecord),
                        DisplayNameEn = BuildUserDisplayNameEn(userRecord),
                        ActivePositionsCount = group.Count()
                    };
                })
                .OrderBy(item => item.UserId)
                .ToList();
        }
        catch (Exception)
        {
            AddUnhandledError(response);
        }

        return response;
    }

    public async Task<CommonResponse<IEnumerable<SubjectRoutingOrgTreeNodeDto>>> GetOracleTreeNodesAsync(
        string userId,
        string? parentNodeType,
        decimal? parentNodeNumericId,
        string? parentNodeUserId,
        string? search,
        bool activeOnly,
        bool includeUsers,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<IEnumerable<SubjectRoutingOrgTreeNodeDto>>();
        try
        {
            var normalizedUser = NormalizeUser(userId);
            if (normalizedUser.Length == 0)
            {
                AddUnauthorized(response);
                return response;
            }

            var normalizedParentNodeType = NormalizeTreeNodeType(parentNodeType);
            if (normalizedParentNodeType == "__invalid__")
            {
                response.Errors.Add(new Error { Code = "400", Message = "نوع عقدة الأب غير صالح." });
                return response;
            }

            var normalizedSearch = NormalizeNullable(search);
            if (normalizedSearch != null)
            {
                response.Data = await SearchTreeNodesAsync(normalizedSearch, activeOnly, includeUsers, cancellationToken);
                return response;
            }

            if (normalizedParentNodeType == null)
            {
                var rootUnits = (await _repository.ListOracleUnitsAsync(
                        unitTypeId: null,
                        parentId: null,
                        search: null,
                        activeOnly: activeOnly,
                        cancellationToken: cancellationToken))
                    .Where(item => !item.ParentId.HasValue || item.ParentId.Value <= 0)
                    .OrderBy(item => item.UnitName)
                    .ThenBy(item => item.UnitId)
                    .ToList();

                response.Data = rootUnits.Select(item => new SubjectRoutingOrgTreeNodeDto
                {
                    NodeType = "OrgUnit",
                    NodeNumericId = item.UnitId,
                    LabelAr = item.UnitName ?? string.Empty,
                    SecondaryLabelAr = $"نوع الوحدة: {item.UnitType?.TypeName ?? "-"}",
                    ParentNodeType = null,
                    ParentNodeNumericId = null,
                    IsSelectable = true,
                    HasChildren = true,
                    IsActive = item.Status != false
                }).ToList();
                return response;
            }

            if (string.Equals(normalizedParentNodeType, "OrgUnit", StringComparison.OrdinalIgnoreCase))
            {
                if (!parentNodeNumericId.HasValue || parentNodeNumericId.Value <= 0)
                {
                    response.Errors.Add(new Error { Code = "400", Message = "معرف عقدة الأب للوحدة مطلوب." });
                    return response;
                }

                var parentUnitId = parentNodeNumericId.Value;
                var childUnits = await _repository.ListOracleUnitsAsync(
                    unitTypeId: null,
                    parentId: parentUnitId,
                    search: null,
                    activeOnly: activeOnly,
                    cancellationToken: cancellationToken);
                var positions = await _repository.ListOraclePositionsAsync(
                    userId: null,
                    unitId: parentUnitId,
                    activeOnly: activeOnly,
                    cancellationToken: cancellationToken);
                var usersById = await BuildUsersLookupAsync(positions.Select(item => item.UserId), cancellationToken);

                var nodes = new List<SubjectRoutingOrgTreeNodeDto>();
                nodes.AddRange(childUnits.Select(item => new SubjectRoutingOrgTreeNodeDto
                {
                    NodeType = "OrgUnit",
                    NodeNumericId = item.UnitId,
                    LabelAr = item.UnitName ?? string.Empty,
                    SecondaryLabelAr = $"نوع الوحدة: {item.UnitType?.TypeName ?? "-"}",
                    ParentNodeType = "OrgUnit",
                    ParentNodeNumericId = item.ParentId,
                    IsSelectable = true,
                    HasChildren = true,
                    IsActive = item.Status != false
                }));

                nodes.AddRange(positions.Select(item =>
                {
                    usersById.TryGetValue(item.UserId ?? string.Empty, out var userRecord);
                    return new SubjectRoutingOrgTreeNodeDto
                    {
                        NodeType = "Position",
                        NodeNumericId = item.PositionId,
                        LabelAr = $"منصب #{item.PositionId}",
                        SecondaryLabelAr = BuildPositionSecondaryLabel(item.UserId, userRecord),
                        ParentNodeType = "OrgUnit",
                        ParentNodeNumericId = item.UnitId,
                        IsSelectable = true,
                        HasChildren = includeUsers && !string.IsNullOrWhiteSpace(item.UserId),
                        IsActive = item.IsActive != false
                    };
                }));

                response.Data = nodes
                    .OrderBy(item => item.NodeType == "OrgUnit" ? 0 : 1)
                    .ThenBy(item => item.LabelAr)
                    .ThenBy(item => item.NodeNumericId ?? 0)
                    .ToList();
                return response;
            }

            if (string.Equals(normalizedParentNodeType, "Position", StringComparison.OrdinalIgnoreCase))
            {
                if (!includeUsers)
                {
                    response.Data = Array.Empty<SubjectRoutingOrgTreeNodeDto>();
                    return response;
                }

                if (!parentNodeNumericId.HasValue || parentNodeNumericId.Value <= 0)
                {
                    response.Errors.Add(new Error { Code = "400", Message = "معرف عقدة الأب للمنصب مطلوب." });
                    return response;
                }

                var position = await _repository.FindOraclePositionAsync(parentNodeNumericId.Value, activeOnly, cancellationToken);
                if (position == null || string.IsNullOrWhiteSpace(position.UserId))
                {
                    response.Data = Array.Empty<SubjectRoutingOrgTreeNodeDto>();
                    return response;
                }

                var userRecord = await _repository.FindOracleUserAsync(position.UserId, activeOnly, cancellationToken);
                response.Data = new List<SubjectRoutingOrgTreeNodeDto>
                {
                    new()
                    {
                        NodeType = "SpecificUser",
                        NodeUserId = position.UserId,
                        LabelAr = BuildTreeUserLabel(position.UserId, userRecord),
                        SecondaryLabelAr = BuildUserSecondaryLabel(userRecord),
                        ParentNodeType = "Position",
                        ParentNodeNumericId = position.PositionId,
                        IsSelectable = true,
                        HasChildren = false,
                        IsActive = position.IsActive != false
                    }
                };
                return response;
            }

            if (string.Equals(normalizedParentNodeType, "SpecificUser", StringComparison.OrdinalIgnoreCase)
                || (parentNodeUserId != null && NormalizeNullable(parentNodeUserId) != null))
            {
                response.Data = Array.Empty<SubjectRoutingOrgTreeNodeDto>();
                return response;
            }

            response.Data = Array.Empty<SubjectRoutingOrgTreeNodeDto>();
        }
        catch (Exception)
        {
            AddUnhandledError(response);
        }

        return response;
    }

    private async Task<SubjectTypeRequestAvailabilityDto> BuildAvailabilityDtoAsync(
        int subjectTypeId,
        SubjectTypeRequestAvailability? availability,
        CancellationToken cancellationToken)
    {
        var dto = new SubjectTypeRequestAvailabilityDto
        {
            SubjectTypeId = subjectTypeId,
            AvailabilityMode = "Public",
            AvailabilitySummaryAr = ResolveAvailabilitySummaryAr("Public", null)
        };

        if (availability == null)
        {
            return dto;
        }

        dto.LastModifiedBy = NormalizeNullable(availability.LastModifiedBy);
        dto.LastModifiedAtUtc = availability.LastModifiedAtUtc;

        var rawAvailabilityMode = NormalizeNullable(availability.AvailabilityMode) ?? "Public";
        if (!TryNormalizeAvailabilityMode(rawAvailabilityMode, out var normalizedAvailabilityMode))
        {
            normalizedAvailabilityMode = "Public";
        }

        dto.AvailabilityMode = normalizedAvailabilityMode;
        if (!string.Equals(normalizedAvailabilityMode, "Restricted", StringComparison.OrdinalIgnoreCase))
        {
            dto.AvailabilitySummaryAr = ResolveAvailabilitySummaryAr("Public", null);
            return dto;
        }

        var selectedNodeTypeRaw = NormalizeNullable(availability.SelectedNodeType);
        if (selectedNodeTypeRaw == null
            || !TryNormalizeSelectedNodeType(selectedNodeTypeRaw, out var normalizedNodeType))
        {
            dto.SelectedNodeLabelAr = TruncateNullable(availability.SelectionLabelAr, SelectionLabelMaxLength);
            dto.SelectedNodePathAr = TruncateNullable(availability.SelectionPathAr, SelectionPathMaxLength);
            dto.AvailabilitySummaryAr = ResolveAvailabilitySummaryAr("Restricted", null);
            return dto;
        }

        dto.SelectedNodeType = normalizedNodeType;
        if (string.Equals(normalizedNodeType, "SpecificUser", StringComparison.OrdinalIgnoreCase))
        {
            dto.SelectedNodeUserId = NormalizeNullable(availability.SelectedNodeUserId);
            dto.SelectedNodeNumericId = null;
        }
        else
        {
            dto.SelectedNodeNumericId = availability.SelectedNodeNumericId;
            dto.SelectedNodeUserId = null;
        }

        var resolutionErrors = new List<Error>();
        var resolvedNode = await ValidateAndResolveAvailabilityNodeAsync(
            normalizedNodeType,
            dto.SelectedNodeNumericId,
            dto.SelectedNodeUserId,
            resolutionErrors,
            cancellationToken);

        if (resolvedNode != null)
        {
            dto.SelectedNodeType = resolvedNode.SelectedNodeType;
            dto.SelectedNodeNumericId = resolvedNode.SelectedNodeNumericId;
            dto.SelectedNodeUserId = resolvedNode.SelectedNodeUserId;
            dto.SelectedNodeLabelAr = TruncateNullable(resolvedNode.SelectedNodeLabelAr, SelectionLabelMaxLength);
            dto.SelectedNodeSecondaryLabelAr = resolvedNode.SelectedNodeSecondaryLabelAr;
            dto.SelectedNodePathAr = TruncateNullable(resolvedNode.SelectedNodePathAr, SelectionPathMaxLength);
        }
        else
        {
            dto.SelectedNodeLabelAr = TruncateNullable(availability.SelectionLabelAr, SelectionLabelMaxLength);
            dto.SelectedNodePathAr = TruncateNullable(availability.SelectionPathAr, SelectionPathMaxLength);
        }

        dto.AvailabilitySummaryAr = ResolveAvailabilitySummaryAr(dto.AvailabilityMode, dto.SelectedNodeType);
        return dto;
    }

    private async Task<AvailabilityNodeResolutionResult?> ValidateAndResolveAvailabilityNodeAsync(
        string selectedNodeType,
        decimal? selectedNodeNumericId,
        string? selectedNodeUserId,
        ICollection<Error> errors,
        CancellationToken cancellationToken)
    {
        if (!TryNormalizeSelectedNodeType(selectedNodeType, out var normalizedNodeType))
        {
            errors.Add(new Error { Code = "400", Message = "نوع العقدة المحددة غير مدعوم." });
            return null;
        }

        if (string.Equals(normalizedNodeType, "OrgUnit", StringComparison.OrdinalIgnoreCase))
        {
            if (!selectedNodeNumericId.HasValue || selectedNodeNumericId.Value <= 0)
            {
                errors.Add(new Error { Code = "400", Message = "SelectedNodeNumericId مطلوب عند اختيار العقدة OrgUnit." });
                return null;
            }

            if (NormalizeNullable(selectedNodeUserId) != null)
            {
                errors.Add(new Error { Code = "400", Message = "SelectedNodeUserId غير مسموح مع نوع العقدة OrgUnit." });
                return null;
            }

            var orgUnit = await _repository.FindOracleUnitAsync(selectedNodeNumericId.Value, activeOnly: false, cancellationToken);
            if (orgUnit == null)
            {
                errors.Add(new Error { Code = "400", Message = "العقدة المحددة لا تشير إلى وحدة تنظيمية موجودة في Oracle." });
                return null;
            }

            var path = await BuildOrgUnitPathArAsync(orgUnit, cancellationToken);
            return new AvailabilityNodeResolutionResult
            {
                SelectedNodeType = "OrgUnit",
                SelectedNodeNumericId = orgUnit.UnitId,
                SelectedNodeUserId = null,
                SelectedNodeLabelAr = NormalizeNullable(orgUnit.UnitName) ?? $"وحدة #{orgUnit.UnitId}",
                SelectedNodeSecondaryLabelAr = $"نوع الوحدة: {orgUnit.UnitType?.TypeName ?? "-"}",
                SelectedNodePathAr = path
            };
        }

        if (string.Equals(normalizedNodeType, "Position", StringComparison.OrdinalIgnoreCase))
        {
            if (!selectedNodeNumericId.HasValue || selectedNodeNumericId.Value <= 0)
            {
                errors.Add(new Error { Code = "400", Message = "SelectedNodeNumericId مطلوب عند اختيار العقدة Position." });
                return null;
            }

            if (NormalizeNullable(selectedNodeUserId) != null)
            {
                errors.Add(new Error { Code = "400", Message = "SelectedNodeUserId غير مسموح مع نوع العقدة Position." });
                return null;
            }

            var position = await _repository.FindOraclePositionAsync(selectedNodeNumericId.Value, activeOnly: false, cancellationToken);
            if (position == null)
            {
                errors.Add(new Error { Code = "400", Message = "العقدة المحددة لا تشير إلى منصب موجود في Oracle." });
                return null;
            }

            var userRecord = NormalizeNullable(position.UserId) == null
                ? null
                : await _repository.FindOracleUserAsync(position.UserId, activeOnly: false, cancellationToken);
            var unitPath = await BuildOrgUnitPathByIdAsync(position.UnitId, cancellationToken);
            var positionLabel = $"منصب #{position.PositionId}";

            return new AvailabilityNodeResolutionResult
            {
                SelectedNodeType = "Position",
                SelectedNodeNumericId = position.PositionId,
                SelectedNodeUserId = null,
                SelectedNodeLabelAr = positionLabel,
                SelectedNodeSecondaryLabelAr = BuildPositionSecondaryLabel(position.UserId, userRecord),
                SelectedNodePathAr = unitPath == null ? positionLabel : $"{unitPath} / {positionLabel}"
            };
        }

        var normalizedSelectedUserId = NormalizeNullable(selectedNodeUserId);
        if (normalizedSelectedUserId == null)
        {
            errors.Add(new Error { Code = "400", Message = "SelectedNodeUserId مطلوب عند اختيار العقدة SpecificUser." });
            return null;
        }

        if (selectedNodeNumericId.HasValue)
        {
            errors.Add(new Error { Code = "400", Message = "SelectedNodeNumericId غير مسموح مع نوع العقدة SpecificUser." });
            return null;
        }

        var user = await _repository.FindOracleUserAsync(normalizedSelectedUserId, activeOnly: false, cancellationToken);
        var userPositions = await _repository.ListOraclePositionsAsync(
            normalizedSelectedUserId,
            unitId: null,
            activeOnly: false,
            cancellationToken: cancellationToken);
        if (user == null && userPositions.Count == 0)
        {
            errors.Add(new Error { Code = "400", Message = "العقدة المحددة لا تشير إلى مستخدم موجود في Oracle." });
            return null;
        }

        var firstPosition = userPositions
            .OrderBy(item => item.UnitId)
            .ThenBy(item => item.PositionId)
            .FirstOrDefault();
        var userPath = await BuildOrgUnitPathByIdAsync(firstPosition?.UnitId, cancellationToken);
        var userLabel = BuildTreeUserLabel(normalizedSelectedUserId, user);

        return new AvailabilityNodeResolutionResult
        {
            SelectedNodeType = "SpecificUser",
            SelectedNodeNumericId = null,
            SelectedNodeUserId = normalizedSelectedUserId,
            SelectedNodeLabelAr = userLabel,
            SelectedNodeSecondaryLabelAr = BuildUserSecondaryLabel(user),
            SelectedNodePathAr = userPath == null ? userLabel : $"{userPath} / {userLabel}"
        };
    }

    private async Task<string?> BuildOrgUnitPathByIdAsync(
        decimal? unitId,
        CancellationToken cancellationToken)
    {
        if (!unitId.HasValue || unitId.Value <= 0)
        {
            return null;
        }

        var unit = await _repository.FindOracleUnitAsync(unitId.Value, activeOnly: false, cancellationToken);
        return await BuildOrgUnitPathArAsync(unit, cancellationToken);
    }

    private async Task<string?> BuildOrgUnitPathArAsync(
        OrgUnit? unit,
        CancellationToken cancellationToken)
    {
        if (unit == null)
        {
            return null;
        }

        var pathParts = new List<string>();
        var visited = new HashSet<decimal>();
        OrgUnit? current = unit;

        while (current != null && visited.Add(current.UnitId) && pathParts.Count < 25)
        {
            pathParts.Add(NormalizeNullable(current.UnitName) ?? $"وحدة #{current.UnitId}");
            if (!current.ParentId.HasValue || current.ParentId.Value <= 0)
            {
                break;
            }

            current = await _repository.FindOracleUnitAsync(current.ParentId.Value, activeOnly: false, cancellationToken);
        }

        pathParts.Reverse();
        return pathParts.Count == 0 ? null : string.Join(" / ", pathParts);
    }

    private static bool TryNormalizeAvailabilityMode(string? value, out string normalized)
    {
        var key = NormalizeNullable(value);
        if (key == null)
        {
            normalized = string.Empty;
            return false;
        }

        if (!SupportedAvailabilityModes.TryGetValue(key, out var resolved) || string.IsNullOrWhiteSpace(resolved))
        {
            normalized = string.Empty;
            return false;
        }

        normalized = resolved;
        return true;
    }

    private static string ResolveAvailabilitySummaryAr(
        string availabilityMode,
        string? selectedNodeType)
    {
        if (string.Equals(availabilityMode, "Public", StringComparison.OrdinalIgnoreCase))
        {
            return "متاح لجميع المستخدمين المسجلين.";
        }

        if (!string.Equals(availabilityMode, "Restricted", StringComparison.OrdinalIgnoreCase))
        {
            return "نمط الإتاحة غير معروف.";
        }

        if (TryNormalizeSelectedNodeType(selectedNodeType, out var normalizedNodeType))
        {
            if (string.Equals(normalizedNodeType, "OrgUnit", StringComparison.OrdinalIgnoreCase))
            {
                return "متاح لأعضاء الوحدة المحددة.";
            }

            if (string.Equals(normalizedNodeType, "Position", StringComparison.OrdinalIgnoreCase))
            {
                return "متاح لحاملي الوظيفة المحددة.";
            }

            if (string.Equals(normalizedNodeType, "SpecificUser", StringComparison.OrdinalIgnoreCase))
            {
                return "متاح للمستخدم المحدد.";
            }
        }

        return "متاح لفئة محددة وفق العقدة التنظيمية المختارة.";
    }

    private static string? TruncateNullable(string? value, int maxLength)
    {
        var normalized = NormalizeNullable(value);
        if (normalized == null || maxLength <= 0)
        {
            return null;
        }

        return normalized.Length <= maxLength
            ? normalized
            : normalized.Substring(0, maxLength);
    }

    private async Task<ProfileRequestValidationResult?> ValidateAndNormalizeProfileRequestAsync(
        SubjectRoutingProfileUpsertRequestDto request,
        int? excludedProfileId,
        CommonResponse<SubjectRoutingProfileDto> response,
        CancellationToken cancellationToken)
    {
        if (request.SubjectTypeId <= 0)
        {
            response.Errors.Add(new Error { Code = "400", Message = "نوع الطلب مطلوب." });
            return null;
        }

        if (!await _repository.SubjectTypeExistsAsync(request.SubjectTypeId, cancellationToken))
        {
            response.Errors.Add(new Error { Code = "404", Message = "نوع الطلب غير موجود." });
            return null;
        }

        var nameAr = NormalizeNullable(request.NameAr);
        if (nameAr == null)
        {
            response.Errors.Add(new Error { Code = "400", Message = "اسم المسار مطلوب." });
            return null;
        }

        if (nameAr.Length > ProfileNameMaxLength)
        {
            response.Errors.Add(new Error { Code = "400", Message = $"اسم المسار يجب ألا يزيد عن {ProfileNameMaxLength} حرفًا." });
            return null;
        }

        var descriptionAr = NormalizeNullable(request.DescriptionAr);
        if (descriptionAr != null && descriptionAr.Length > ProfileDescriptionMaxLength)
        {
            response.Errors.Add(new Error { Code = "400", Message = $"وصف المسار يجب ألا يزيد عن {ProfileDescriptionMaxLength} حرفًا." });
            return null;
        }

        if (!TryNormalizeDirectionMode(request.DirectionMode, out var directionMode))
        {
            response.Errors.Add(new Error { Code = "400", Message = "اتجاه التوجيه غير صالح." });
            return null;
        }

        var versionNo = request.VersionNo <= 0 ? 1 : request.VersionNo;
        var profilesBySubject = await _repository.ListProfilesBySubjectTypeAsync(request.SubjectTypeId, cancellationToken);
        var hasConflict = profilesBySubject.Any(item =>
            item.Id != (excludedProfileId ?? 0)
            && string.Equals(item.NameAr?.Trim(), nameAr, StringComparison.OrdinalIgnoreCase));
        if (hasConflict)
        {
            response.Errors.Add(new Error { Code = "409", Message = "يوجد مسار آخر بنفس الاسم لنوع الطلب الحالي." });
            return null;
        }

        return new ProfileRequestValidationResult
        {
            SubjectTypeId = request.SubjectTypeId,
            NameAr = nameAr,
            DescriptionAr = descriptionAr,
            IsActive = request.IsActive,
            DirectionMode = directionMode,
            VersionNo = versionNo
        };
    }

    private async Task<StepRequestValidationResult?> ValidateAndNormalizeStepRequestAsync(
        SubjectRoutingStepUpsertRequestDto request,
        int? excludedStepId,
        CommonResponse<SubjectRoutingStepDto> response,
        CancellationToken cancellationToken)
    {
        if (request.RoutingProfileId <= 0)
        {
            response.Errors.Add(new Error { Code = "400", Message = "معرف المسار مطلوب." });
            return null;
        }

        var profile = await _repository.FindProfileAsync(request.RoutingProfileId, cancellationToken);
        if (profile == null)
        {
            response.Errors.Add(new Error { Code = "404", Message = "ملف التوجيه غير موجود." });
            return null;
        }

        var stepCode = NormalizeNullable(request.StepCode);
        if (stepCode == null)
        {
            response.Errors.Add(new Error { Code = "400", Message = "رمز الخطوة مطلوب." });
            return null;
        }

        if (stepCode.Length > StepCodeMaxLength)
        {
            response.Errors.Add(new Error { Code = "400", Message = $"رمز الخطوة يجب ألا يزيد عن {StepCodeMaxLength} حرفًا." });
            return null;
        }

        var stepNameAr = NormalizeNullable(request.StepNameAr);
        if (stepNameAr == null)
        {
            response.Errors.Add(new Error { Code = "400", Message = "اسم الخطوة مطلوب." });
            return null;
        }

        if (stepNameAr.Length > StepNameMaxLength)
        {
            response.Errors.Add(new Error { Code = "400", Message = $"اسم الخطوة يجب ألا يزيد عن {StepNameMaxLength} حرفًا." });
            return null;
        }

        var stepType = NormalizeNullable(request.StepType);
        if (stepType == null)
        {
            response.Errors.Add(new Error { Code = "400", Message = "نوع الخطوة مطلوب." });
            return null;
        }

        if (stepType.Length > StepTypeMaxLength)
        {
            response.Errors.Add(new Error { Code = "400", Message = $"نوع الخطوة يجب ألا يزيد عن {StepTypeMaxLength} حرفًا." });
            return null;
        }

        if (!SupportedStepTypes.Contains(stepType))
        {
            response.Errors.Add(new Error { Code = "400", Message = "نوع الخطوة غير مدعوم." });
            return null;
        }

        if (await _repository.StepCodeExistsInProfileAsync(
                request.RoutingProfileId,
                stepCode,
                excludedStepId,
                cancellationToken))
        {
            response.Errors.Add(new Error { Code = "409", Message = "رمز الخطوة مكرر داخل نفس المسار." });
            return null;
        }

        if (request.IsStart
            && await _repository.HasAnotherStartStepAsync(request.RoutingProfileId, excludedStepId, cancellationToken))
        {
            response.Errors.Add(new Error { Code = "400", Message = "يوجد بالفعل خطوة بداية في هذا المسار." });
            return null;
        }

        if (request.SlaHours.HasValue && request.SlaHours.Value < 0)
        {
            response.Errors.Add(new Error { Code = "400", Message = "قيمة SLA يجب أن تكون صفرًا أو أكبر." });
            return null;
        }

        var notesAr = NormalizeNullable(request.NotesAr);
        if (notesAr != null && notesAr.Length > NotesMaxLength)
        {
            response.Errors.Add(new Error { Code = "400", Message = $"ملاحظات الخطوة يجب ألا تزيد عن {NotesMaxLength} حرفًا." });
            return null;
        }

        return new StepRequestValidationResult
        {
            RoutingProfileId = request.RoutingProfileId,
            StepCode = stepCode,
            StepNameAr = stepNameAr,
            StepType = stepType,
            StepOrder = request.StepOrder,
            IsStart = request.IsStart,
            IsEnd = request.IsEnd,
            SlaHours = request.SlaHours,
            IsActive = request.IsActive,
            NotesAr = notesAr
        };
    }

    private async Task<TargetRequestValidationResult?> ValidateAndNormalizeTargetRequestAsync(
        SubjectRoutingTargetUpsertRequestDto request,
        CommonResponse<SubjectRoutingTargetDto> response,
        CancellationToken cancellationToken)
    {
        if (request.RoutingStepId <= 0)
        {
            response.Errors.Add(new Error { Code = "400", Message = "معرف الخطوة مطلوب." });
            return null;
        }

        var step = await _repository.FindStepAsync(request.RoutingStepId, cancellationToken);
        if (step == null)
        {
            response.Errors.Add(new Error { Code = "404", Message = "الخطوة غير موجودة." });
            return null;
        }

        var notesAr = NormalizeNullable(request.NotesAr);
        if (notesAr != null && notesAr.Length > NotesMaxLength)
        {
            response.Errors.Add(new Error { Code = "400", Message = $"ملاحظات الجهة المستهدفة يجب ألا تزيد عن {NotesMaxLength} حرفًا." });
            return null;
        }

        var positionCode = NormalizeNullable(request.PositionCode);
        if (positionCode != null && positionCode.Length > PositionCodeMaxLength)
        {
            response.Errors.Add(new Error { Code = "400", Message = $"كود المنصب يجب ألا يزيد عن {PositionCodeMaxLength} حرفًا." });
            return null;
        }

        var selectedNodeUserId = NormalizeNullable(request.SelectedNodeUserId);
        if (selectedNodeUserId != null && selectedNodeUserId.Length > SelectedNodeUserIdMaxLength)
        {
            response.Errors.Add(new Error { Code = "400", Message = $"معرف المستخدم المحدد يجب ألا يزيد عن {SelectedNodeUserIdMaxLength} حرفًا." });
            return null;
        }

        var requestedTargetMode = NormalizeNullable(request.TargetMode);
        if (requestedTargetMode != null)
        {
            if (requestedTargetMode.Length > TargetModeMaxLength)
            {
                response.Errors.Add(new Error { Code = "400", Message = $"وضع الجهة المستهدفة يجب ألا يزيد عن {TargetModeMaxLength} حرفًا." });
                return null;
            }

            if (!SupportedTargetModes.Contains(requestedTargetMode))
            {
                response.Errors.Add(new Error { Code = "400", Message = "وضع الجهة المستهدفة غير مدعوم." });
                return null;
            }
        }

        var hasNewModelInput =
            NormalizeNullable(request.SelectedNodeType) != null
            || request.SelectedNodeNumericId.HasValue
            || selectedNodeUserId != null
            || NormalizeNullable(request.AudienceResolutionMode) != null
            || NormalizeNullable(request.WorkDistributionMode) != null;

        string? selectedNodeType = null;
        decimal? selectedNodeNumericId = request.SelectedNodeNumericId;
        string? audienceResolutionMode = null;
        string? workDistributionMode = null;

        if (hasNewModelInput)
        {
            var requestedNodeTypeRaw = NormalizeNullable(request.SelectedNodeType);
            if (requestedNodeTypeRaw == null)
            {
                response.Errors.Add(new Error { Code = "400", Message = "نوع العقدة المستهدفة مطلوب." });
                return null;
            }

            if (requestedNodeTypeRaw.Length > SelectedNodeTypeMaxLength)
            {
                response.Errors.Add(new Error { Code = "400", Message = $"نوع العقدة يجب ألا يزيد عن {SelectedNodeTypeMaxLength} حرفًا." });
                return null;
            }

            if (!TryNormalizeSelectedNodeType(requestedNodeTypeRaw, out var normalizedNodeType))
            {
                response.Errors.Add(new Error { Code = "400", Message = "نوع العقدة المستهدفة غير مدعوم." });
                return null;
            }

            selectedNodeType = normalizedNodeType;

            var requestedAudienceRaw = NormalizeNullable(request.AudienceResolutionMode);
            if (requestedAudienceRaw != null)
            {
                if (requestedAudienceRaw.Length > AudienceResolutionModeMaxLength)
                {
                    response.Errors.Add(new Error { Code = "400", Message = $"نمط تحديد المؤهلين يجب ألا يزيد عن {AudienceResolutionModeMaxLength} حرفًا." });
                    return null;
                }

                if (!TryNormalizeAudienceMode(requestedAudienceRaw, out var normalizedAudience))
                {
                    response.Errors.Add(new Error { Code = "400", Message = "نمط تحديد المؤهلين غير مدعوم." });
                    return null;
                }

                audienceResolutionMode = normalizedAudience;
            }

            var requestedDistributionRaw = NormalizeNullable(request.WorkDistributionMode);
            if (requestedDistributionRaw != null)
            {
                if (requestedDistributionRaw.Length > WorkDistributionModeMaxLength)
                {
                    response.Errors.Add(new Error { Code = "400", Message = $"نمط توزيع العمل يجب ألا يزيد عن {WorkDistributionModeMaxLength} حرفًا." });
                    return null;
                }

                if (!TryNormalizeWorkDistributionMode(requestedDistributionRaw, out var normalizedDistribution))
                {
                    response.Errors.Add(new Error { Code = "400", Message = "نمط توزيع العمل غير مدعوم." });
                    return null;
                }

                workDistributionMode = normalizedDistribution;
            }
        }
        else
        {
            var targetMode = requestedTargetMode;
            if (targetMode == null)
            {
                response.Errors.Add(new Error { Code = "400", Message = "وضع الجهة المستهدفة مطلوب." });
                return null;
            }

            if ((string.Equals(targetMode, "UnitType", StringComparison.OrdinalIgnoreCase)
                 || string.Equals(targetMode, "ChildUnitByType", StringComparison.OrdinalIgnoreCase))
                && !request.OracleUnitTypeId.HasValue)
            {
                response.Errors.Add(new Error { Code = "400", Message = "نوع الوحدة مطلوب لوضع الاستهداف المحدد." });
                return null;
            }

            if (string.Equals(targetMode, "SpecificUnit", StringComparison.OrdinalIgnoreCase)
                && !request.OracleOrgUnitId.HasValue)
            {
                response.Errors.Add(new Error { Code = "400", Message = "الوحدة التنظيمية مطلوبة لوضع SpecificUnit." });
                return null;
            }

            if (string.Equals(targetMode, "Position", StringComparison.OrdinalIgnoreCase)
                && !request.PositionId.HasValue
                && positionCode == null)
            {
                response.Errors.Add(new Error { Code = "400", Message = "يجب تحديد المنصب (PositionId أو PositionCode)." });
                return null;
            }

            if (string.Equals(targetMode, "SpecificUnit", StringComparison.OrdinalIgnoreCase))
            {
                selectedNodeType = "OrgUnit";
                selectedNodeNumericId = request.OracleOrgUnitId;
                audienceResolutionMode = request.SendToLeaderOnly ? "OrgUnitLeaderOnly" : "OrgUnitAllMembers";
            }
            else if (string.Equals(targetMode, "Position", StringComparison.OrdinalIgnoreCase))
            {
                selectedNodeType = "Position";
                selectedNodeNumericId = request.PositionId;
                audienceResolutionMode = "PositionOccupants";
            }
            else if (string.Equals(targetMode, "CommitteeMembers", StringComparison.OrdinalIgnoreCase))
            {
                selectedNodeType = "SpecificUser";
                selectedNodeUserId ??= positionCode;
                audienceResolutionMode = "SpecificUserOnly";
            }

            workDistributionMode = request.AllowMultipleReceivers ? "SharedInbox" : "ManualAssignment";
            if (IsSingleRecipientAudience(audienceResolutionMode))
            {
                workDistributionMode = "SharedInbox";
            }
        }

        OrgUnit? selectedOrgUnit = null;
        UserPosition? selectedPosition = null;
        PosUser? selectedUser = null;

        if (selectedNodeType != null)
        {
            if (string.Equals(selectedNodeType, "OrgUnit", StringComparison.OrdinalIgnoreCase))
            {
                if (!selectedNodeNumericId.HasValue || selectedNodeNumericId.Value <= 0)
                {
                    response.Errors.Add(new Error { Code = "400", Message = "معرف الوحدة التنظيمية المستهدفة مطلوب." });
                    return null;
                }

                selectedOrgUnit = await _repository.FindOracleUnitAsync(selectedNodeNumericId.Value, activeOnly: false, cancellationToken);
                if (selectedOrgUnit == null)
                {
                    response.Errors.Add(new Error { Code = "400", Message = "الوحدة التنظيمية المستهدفة غير موجودة في Oracle." });
                    return null;
                }

                audienceResolutionMode ??= "OrgUnitAllMembers";
                if (!string.Equals(audienceResolutionMode, "OrgUnitAllMembers", StringComparison.OrdinalIgnoreCase)
                    && !string.Equals(audienceResolutionMode, "OrgUnitLeaderOnly", StringComparison.OrdinalIgnoreCase))
                {
                    response.Errors.Add(new Error { Code = "400", Message = "AudienceResolutionMode غير متوافق مع نوع العقدة OrgUnit." });
                    return null;
                }

                selectedNodeUserId = null;
            }
            else if (string.Equals(selectedNodeType, "Position", StringComparison.OrdinalIgnoreCase))
            {
                if ((!selectedNodeNumericId.HasValue || selectedNodeNumericId.Value <= 0) && request.PositionId.HasValue)
                {
                    selectedNodeNumericId = request.PositionId.Value;
                }

                if (!selectedNodeNumericId.HasValue || selectedNodeNumericId.Value <= 0)
                {
                    response.Errors.Add(new Error { Code = "400", Message = "معرف المنصب المستهدف مطلوب." });
                    return null;
                }

                selectedPosition = await _repository.FindOraclePositionAsync(selectedNodeNumericId.Value, activeOnly: false, cancellationToken);
                if (selectedPosition == null)
                {
                    response.Errors.Add(new Error { Code = "400", Message = "المنصب المستهدف غير موجود في Oracle." });
                    return null;
                }

                audienceResolutionMode ??= "PositionOccupants";
                if (!string.Equals(audienceResolutionMode, "PositionOccupants", StringComparison.OrdinalIgnoreCase))
                {
                    response.Errors.Add(new Error { Code = "400", Message = "AudienceResolutionMode غير متوافق مع نوع العقدة Position." });
                    return null;
                }

                selectedNodeUserId = null;
            }
            else if (string.Equals(selectedNodeType, "SpecificUser", StringComparison.OrdinalIgnoreCase))
            {
                selectedNodeNumericId = null;
                selectedNodeUserId ??= positionCode;
                if (selectedNodeUserId == null)
                {
                    response.Errors.Add(new Error { Code = "400", Message = "معرف المستخدم المحدد مطلوب." });
                    return null;
                }

                selectedUser = await _repository.FindOracleUserAsync(selectedNodeUserId, activeOnly: false, cancellationToken);
                if (selectedUser == null)
                {
                    response.Errors.Add(new Error { Code = "400", Message = "المستخدم المحدد غير موجود في Oracle." });
                    return null;
                }

                audienceResolutionMode ??= "SpecificUserOnly";
                if (!string.Equals(audienceResolutionMode, "SpecificUserOnly", StringComparison.OrdinalIgnoreCase))
                {
                    response.Errors.Add(new Error { Code = "400", Message = "AudienceResolutionMode غير متوافق مع نوع العقدة SpecificUser." });
                    return null;
                }
            }
        }

        workDistributionMode ??= IsSingleRecipientAudience(audienceResolutionMode)
            ? "SharedInbox"
            : "ManualAssignment";

        if (!TryNormalizeWorkDistributionMode(workDistributionMode, out var normalizedWorkDistributionMode))
        {
            response.Errors.Add(new Error { Code = "400", Message = "نمط توزيع العمل غير مدعوم." });
            return null;
        }

        if (IsSingleRecipientAudience(audienceResolutionMode)
            && !string.Equals(normalizedWorkDistributionMode, "SharedInbox", StringComparison.OrdinalIgnoreCase))
        {
            response.Errors.Add(new Error { Code = "400", Message = "نمط توزيع العمل لا يتوافق مع دائرة مؤهلين أحادية." });
            return null;
        }

        string resolvedTargetMode;
        decimal? resolvedOracleUnitTypeId = request.OracleUnitTypeId;
        decimal? resolvedOracleOrgUnitId = request.OracleOrgUnitId;
        decimal? resolvedPositionId = request.PositionId;
        string? resolvedPositionCode = positionCode;
        bool resolvedSendToLeaderOnly = request.SendToLeaderOnly;
        bool resolvedAllowMultipleReceivers = request.AllowMultipleReceivers;

        if (selectedNodeType == null)
        {
            resolvedTargetMode = requestedTargetMode ?? "SpecificUnit";
        }
        else if (string.Equals(selectedNodeType, "OrgUnit", StringComparison.OrdinalIgnoreCase))
        {
            resolvedTargetMode = "SpecificUnit";
            resolvedOracleOrgUnitId = selectedNodeNumericId;
            resolvedOracleUnitTypeId = selectedOrgUnit?.UnitTypeId;
            resolvedPositionId = null;
            resolvedPositionCode = null;
            resolvedSendToLeaderOnly = string.Equals(audienceResolutionMode, "OrgUnitLeaderOnly", StringComparison.OrdinalIgnoreCase);
            resolvedAllowMultipleReceivers =
                string.Equals(audienceResolutionMode, "OrgUnitAllMembers", StringComparison.OrdinalIgnoreCase)
                && string.Equals(normalizedWorkDistributionMode, "SharedInbox", StringComparison.OrdinalIgnoreCase);
        }
        else if (string.Equals(selectedNodeType, "Position", StringComparison.OrdinalIgnoreCase))
        {
            resolvedTargetMode = "Position";
            resolvedPositionId = selectedNodeNumericId;
            resolvedOracleOrgUnitId = selectedPosition?.UnitId;
            resolvedOracleUnitTypeId = selectedOrgUnit?.UnitTypeId ?? request.OracleUnitTypeId;
            resolvedSendToLeaderOnly = false;
            resolvedAllowMultipleReceivers = string.Equals(normalizedWorkDistributionMode, "SharedInbox", StringComparison.OrdinalIgnoreCase);
        }
        else
        {
            resolvedTargetMode = "CommitteeMembers";
            resolvedPositionId = null;
            resolvedPositionCode = selectedNodeUserId;
            resolvedOracleOrgUnitId = null;
            resolvedOracleUnitTypeId = null;
            resolvedSendToLeaderOnly = false;
            resolvedAllowMultipleReceivers = false;
        }

        return new TargetRequestValidationResult
        {
            RoutingStepId = request.RoutingStepId,
            TargetMode = resolvedTargetMode,
            OracleUnitTypeId = resolvedOracleUnitTypeId,
            OracleOrgUnitId = resolvedOracleOrgUnitId,
            PositionId = resolvedPositionId,
            PositionCode = resolvedPositionCode,
            SelectedNodeType = selectedNodeType,
            SelectedNodeNumericId = selectedNodeNumericId,
            SelectedNodeUserId = selectedNodeUserId,
            AudienceResolutionMode = audienceResolutionMode,
            WorkDistributionMode = normalizedWorkDistributionMode,
            AllowMultipleReceivers = resolvedAllowMultipleReceivers,
            SendToLeaderOnly = resolvedSendToLeaderOnly,
            IsActive = request.IsActive,
            NotesAr = notesAr
        };
    }

    private async Task<TransitionRequestValidationResult?> ValidateAndNormalizeTransitionRequestAsync(
        SubjectRoutingTransitionUpsertRequestDto request,
        int? excludedTransitionId,
        CommonResponse<SubjectRoutingTransitionDto> response,
        CancellationToken cancellationToken)
    {
        if (request.RoutingProfileId <= 0)
        {
            response.Errors.Add(new Error { Code = "400", Message = "معرف المسار مطلوب." });
            return null;
        }

        var profile = await _repository.FindProfileAsync(request.RoutingProfileId, cancellationToken);
        if (profile == null)
        {
            response.Errors.Add(new Error { Code = "404", Message = "ملف التوجيه غير موجود." });
            return null;
        }

        if (request.FromStepId <= 0 || request.ToStepId <= 0)
        {
            response.Errors.Add(new Error { Code = "400", Message = "خطوتا FromStep و ToStep مطلوبتان." });
            return null;
        }

        if (request.FromStepId == request.ToStepId)
        {
            response.Errors.Add(new Error { Code = "400", Message = "لا يمكن إنشاء انتقال من الخطوة إلى نفسها." });
            return null;
        }

        var fromStep = await _repository.FindStepAsync(request.FromStepId, cancellationToken);
        var toStep = await _repository.FindStepAsync(request.ToStepId, cancellationToken);
        if (fromStep == null || toStep == null)
        {
            response.Errors.Add(new Error { Code = "400", Message = "خطوات الانتقال غير موجودة." });
            return null;
        }

        if (fromStep.RoutingProfileId != request.RoutingProfileId || toStep.RoutingProfileId != request.RoutingProfileId)
        {
            response.Errors.Add(new Error { Code = "400", Message = "خطوات الانتقال يجب أن تنتمي لنفس المسار." });
            return null;
        }

        var actionCode = NormalizeNullable(request.ActionCode);
        if (actionCode == null)
        {
            response.Errors.Add(new Error { Code = "400", Message = "ActionCode مطلوب." });
            return null;
        }

        if (actionCode.Length > ActionCodeMaxLength)
        {
            response.Errors.Add(new Error { Code = "400", Message = $"ActionCode يجب ألا يزيد عن {ActionCodeMaxLength} حرفًا." });
            return null;
        }

        var actionNameAr = NormalizeNullable(request.ActionNameAr);
        if (actionNameAr == null)
        {
            response.Errors.Add(new Error { Code = "400", Message = "اسم الإجراء مطلوب." });
            return null;
        }

        if (actionNameAr.Length > ActionNameMaxLength)
        {
            response.Errors.Add(new Error { Code = "400", Message = $"اسم الإجراء يجب ألا يزيد عن {ActionNameMaxLength} حرفًا." });
            return null;
        }

        var conditionExpression = NormalizeNullable(request.ConditionExpression);
        if (conditionExpression != null && conditionExpression.Length > ConditionExpressionMaxLength)
        {
            response.Errors.Add(new Error { Code = "400", Message = $"شرط الانتقال يجب ألا يزيد عن {ConditionExpressionMaxLength} حرفًا." });
            return null;
        }

        if (await _repository.TransitionExistsAsync(
                request.RoutingProfileId,
                request.FromStepId,
                request.ToStepId,
                actionCode,
                excludedTransitionId,
                cancellationToken))
        {
            response.Errors.Add(new Error { Code = "409", Message = "الانتقال مكرر داخل نفس المسار." });
            return null;
        }

        return new TransitionRequestValidationResult
        {
            RoutingProfileId = request.RoutingProfileId,
            FromStepId = request.FromStepId,
            ToStepId = request.ToStepId,
            ActionCode = actionCode,
            ActionNameAr = actionNameAr,
            DisplayOrder = request.DisplayOrder,
            RequiresComment = request.RequiresComment,
            RequiresMandatoryFieldsCompletion = request.RequiresMandatoryFieldsCompletion,
            IsRejectPath = request.IsRejectPath,
            IsReturnPath = request.IsReturnPath,
            IsEscalationPath = request.IsEscalationPath,
            ConditionExpression = conditionExpression,
            IsActive = request.IsActive
        };
    }

    private async Task<SubjectRoutingProfileWorkspaceDto?> BuildWorkspaceAsync(
        int profileId,
        int? preferredBindingId,
        CancellationToken cancellationToken)
    {
        if (profileId <= 0)
        {
            return null;
        }

        var profile = await _repository.FindProfileAsync(profileId, cancellationToken);
        if (profile == null)
        {
            return null;
        }

        var steps = await _repository.ListStepsByProfileAsync(profileId, cancellationToken);
        var targets = await _repository.ListTargetsByProfileAsync(profileId, cancellationToken);
        var transitions = await _repository.ListTransitionsByProfileAsync(profileId, cancellationToken);
        var bindings = await _repository.ListBindingsByProfileAsync(profileId, cancellationToken);
        var selectedBinding = preferredBindingId.HasValue
            ? bindings.FirstOrDefault(item => item.Id == preferredBindingId.Value)
            : bindings.FirstOrDefault(item => item.IsDefault && item.IsActive) ?? bindings.FirstOrDefault();

        return new SubjectRoutingProfileWorkspaceDto
        {
            Profile = MapProfile(profile),
            Binding = selectedBinding == null ? null : MapBinding(selectedBinding),
            Steps = steps.Select(MapStep).ToList(),
            Targets = targets.Select(MapTarget).ToList(),
            Transitions = transitions.Select(MapTransition).ToList()
        };
    }

    private async Task<SubjectRoutingValidationResultDto> ValidateWorkspaceAsync(
        SubjectRoutingProfileWorkspaceDto workspace,
        CancellationToken cancellationToken)
    {
        var errors = new List<SubjectRoutingValidationMessageDto>();
        var warnings = new List<SubjectRoutingValidationMessageDto>();

        var profile = workspace.Profile ?? new SubjectRoutingProfileDto();
        var steps = workspace.Steps.Where(item => item.IsActive).ToList();
        var targets = workspace.Targets.Where(item => item.IsActive).ToList();
        var transitions = workspace.Transitions.Where(item => item.IsActive).ToList();
        var stepIds = steps.Select(item => item.Id).ToHashSet();
        var stepsById = steps.ToDictionary(item => item.Id, item => item);
        var targetsByStepId = targets
            .GroupBy(item => item.RoutingStepId)
            .ToDictionary(group => group.Key, group => group.ToList());
        var orgUnitCache = new Dictionary<decimal, OrgUnit?>();
        var positionCache = new Dictionary<decimal, UserPosition?>();
        var userCache = new Dictionary<string, PosUser?>(StringComparer.OrdinalIgnoreCase);

        if (steps.Count == 0)
        {
            errors.Add(new SubjectRoutingValidationMessageDto
            {
                Code = "NO_STEPS",
                Severity = "Error",
                IsBlocking = true,
                MessageAr = "لا توجد خطوات ضمن المسار.",
                RelatedEntityType = "Profile",
                RelatedEntityId = profile.Id
            });
        }

        var startSteps = steps.Where(item => item.IsStart).ToList();
        if (startSteps.Count == 0)
        {
            errors.Add(new SubjectRoutingValidationMessageDto
            {
                Code = "NO_START_STEP",
                Severity = "Error",
                IsBlocking = true,
                MessageAr = "لا توجد خطوة بداية.",
                RelatedEntityType = "Profile",
                RelatedEntityId = profile.Id
            });
        }
        else if (startSteps.Count > 1)
        {
            errors.Add(new SubjectRoutingValidationMessageDto
            {
                Code = "MULTIPLE_START_STEPS",
                Severity = "Error",
                IsBlocking = true,
                MessageAr = "توجد أكثر من خطوة بداية.",
                RelatedEntityType = "Profile",
                RelatedEntityId = profile.Id
            });
        }

        var endSteps = steps.Where(item => item.IsEnd).ToList();
        if (endSteps.Count == 0)
        {
            errors.Add(new SubjectRoutingValidationMessageDto
            {
                Code = "NO_END_STEP",
                Severity = "Error",
                IsBlocking = true,
                MessageAr = "لا توجد خطوة نهاية.",
                RelatedEntityType = "Profile",
                RelatedEntityId = profile.Id
            });
        }

        foreach (var step in steps)
        {
            var stepDisplayName = string.IsNullOrWhiteSpace(step.StepNameAr)
                ? $"#{step.Id}"
                : step.StepNameAr;

            if (string.IsNullOrWhiteSpace(step.StepCode)
                || string.IsNullOrWhiteSpace(step.StepNameAr)
                || string.IsNullOrWhiteSpace(step.StepType))
            {
                errors.Add(new SubjectRoutingValidationMessageDto
                {
                    Code = "STEP_MISSING_MANDATORY_FIELDS",
                    Severity = "Error",
                    IsBlocking = true,
                    MessageAr = $"الخطوة '{stepDisplayName}' بها بيانات إلزامية ناقصة.",
                    RelatedEntityType = "Step",
                    RelatedEntityId = step.Id
                });
            }

            if (!targetsByStepId.ContainsKey(step.Id))
            {
                errors.Add(new SubjectRoutingValidationMessageDto
                {
                    Code = "STEP_WITHOUT_TARGET",
                    Severity = "Error",
                    IsBlocking = true,
                    MessageAr = $"الخطوة '{stepDisplayName}' لا تحتوي على جهة مستهدفة.",
                    RelatedEntityType = "Step",
                    RelatedEntityId = step.Id
                });
            }
        }

        foreach (var target in targets)
        {
            if (!stepIds.Contains(target.RoutingStepId))
            {
                errors.Add(new SubjectRoutingValidationMessageDto
                {
                    Code = "TARGET_INVALID_STEP_LINK",
                    Severity = "Error",
                    IsBlocking = true,
                    MessageAr = "الجهة المستهدفة مرتبطة بخطوة غير صالحة أو غير فعالة.",
                    RelatedEntityType = "Target",
                    RelatedEntityId = target.Id
                });
                continue;
            }

            if (!TryResolveTargetModel(target, out var resolvedModel))
            {
                errors.Add(new SubjectRoutingValidationMessageDto
                {
                    Code = "TARGET_MODEL_INVALID",
                    Severity = "Error",
                    IsBlocking = true,
                    MessageAr = "تعريف الجهة المستهدفة غير مكتمل أو غير قابل للتحليل.",
                    RelatedEntityType = "Target",
                    RelatedEntityId = target.Id
                });
                continue;
            }

            if (string.Equals(resolvedModel.SelectedNodeType, "OrgUnit", StringComparison.OrdinalIgnoreCase))
            {
                if (!resolvedModel.SelectedNodeNumericId.HasValue || resolvedModel.SelectedNodeNumericId.Value <= 0)
                {
                    errors.Add(new SubjectRoutingValidationMessageDto
                    {
                        Code = "TARGET_ORGUNIT_ID_REQUIRED",
                        Severity = "Error",
                        IsBlocking = true,
                        MessageAr = "الجهة المستهدفة من نوع وحدة تنظيمية لكن معرف الوحدة غير صالح.",
                        RelatedEntityType = "Target",
                        RelatedEntityId = target.Id
                    });
                    continue;
                }

                var unitId = resolvedModel.SelectedNodeNumericId.Value;
                if (!orgUnitCache.TryGetValue(unitId, out var orgUnit))
                {
                    orgUnit = await _repository.FindOracleUnitAsync(unitId, activeOnly: false, cancellationToken);
                    orgUnitCache[unitId] = orgUnit;
                }

                if (orgUnit == null)
                {
                    errors.Add(new SubjectRoutingValidationMessageDto
                    {
                        Code = "TARGET_ORGUNIT_NOT_FOUND",
                        Severity = "Error",
                        IsBlocking = true,
                        MessageAr = "الوحدة التنظيمية المحددة في الجهة المستهدفة غير موجودة في Oracle.",
                        RelatedEntityType = "Target",
                        RelatedEntityId = target.Id
                    });
                    continue;
                }

                if (orgUnit.Status == false)
                {
                    warnings.Add(new SubjectRoutingValidationMessageDto
                    {
                        Code = "TARGET_ORGUNIT_INACTIVE",
                        Severity = "Warning",
                        IsBlocking = false,
                        MessageAr = "الوحدة التنظيمية المحددة غير نشطة في Oracle.",
                        RelatedEntityType = "Target",
                        RelatedEntityId = target.Id
                    });
                }

                if (!string.Equals(resolvedModel.AudienceResolutionMode, "OrgUnitAllMembers", StringComparison.OrdinalIgnoreCase)
                    && !string.Equals(resolvedModel.AudienceResolutionMode, "OrgUnitLeaderOnly", StringComparison.OrdinalIgnoreCase))
                {
                    errors.Add(new SubjectRoutingValidationMessageDto
                    {
                        Code = "TARGET_AUDIENCE_MISMATCH",
                        Severity = "Error",
                        IsBlocking = true,
                        MessageAr = "نمط المؤهلين غير متوافق مع اختيار وحدة تنظيمية.",
                        RelatedEntityType = "Target",
                        RelatedEntityId = target.Id
                    });
                }
            }
            else if (string.Equals(resolvedModel.SelectedNodeType, "Position", StringComparison.OrdinalIgnoreCase))
            {
                if (!resolvedModel.SelectedNodeNumericId.HasValue || resolvedModel.SelectedNodeNumericId.Value <= 0)
                {
                    errors.Add(new SubjectRoutingValidationMessageDto
                    {
                        Code = "TARGET_POSITION_ID_REQUIRED",
                        Severity = "Error",
                        IsBlocking = true,
                        MessageAr = "الجهة المستهدفة من نوع منصب لكن معرف المنصب غير صالح.",
                        RelatedEntityType = "Target",
                        RelatedEntityId = target.Id
                    });
                    continue;
                }

                var positionId = resolvedModel.SelectedNodeNumericId.Value;
                if (!positionCache.TryGetValue(positionId, out var position))
                {
                    position = await _repository.FindOraclePositionAsync(positionId, activeOnly: false, cancellationToken);
                    positionCache[positionId] = position;
                }

                if (position == null)
                {
                    errors.Add(new SubjectRoutingValidationMessageDto
                    {
                        Code = "TARGET_POSITION_NOT_FOUND",
                        Severity = "Error",
                        IsBlocking = true,
                        MessageAr = "المنصب المحدد في الجهة المستهدفة غير موجود في Oracle.",
                        RelatedEntityType = "Target",
                        RelatedEntityId = target.Id
                    });
                    continue;
                }

                var today = DateTime.Today;
                var isPositionActive =
                    position.IsActive != false
                    && (!position.StartDate.HasValue || position.StartDate.Value.Date <= today)
                    && (!position.EndDate.HasValue || position.EndDate.Value.Date >= today);
                if (!isPositionActive)
                {
                    warnings.Add(new SubjectRoutingValidationMessageDto
                    {
                        Code = "TARGET_POSITION_INACTIVE",
                        Severity = "Warning",
                        IsBlocking = false,
                        MessageAr = "المنصب المحدد غير نشط ضمن التاريخ الحالي.",
                        RelatedEntityType = "Target",
                        RelatedEntityId = target.Id
                    });
                }

                if (!string.Equals(resolvedModel.AudienceResolutionMode, "PositionOccupants", StringComparison.OrdinalIgnoreCase))
                {
                    errors.Add(new SubjectRoutingValidationMessageDto
                    {
                        Code = "TARGET_AUDIENCE_MISMATCH",
                        Severity = "Error",
                        IsBlocking = true,
                        MessageAr = "نمط المؤهلين غير متوافق مع اختيار منصب.",
                        RelatedEntityType = "Target",
                        RelatedEntityId = target.Id
                    });
                }
            }
            else if (string.Equals(resolvedModel.SelectedNodeType, "SpecificUser", StringComparison.OrdinalIgnoreCase))
            {
                var userId = NormalizeNullable(resolvedModel.SelectedNodeUserId);
                if (userId == null)
                {
                    errors.Add(new SubjectRoutingValidationMessageDto
                    {
                        Code = "TARGET_USER_ID_REQUIRED",
                        Severity = "Error",
                        IsBlocking = true,
                        MessageAr = "الجهة المستهدفة من نوع مستخدم محدد لكن معرف المستخدم غير موجود.",
                        RelatedEntityType = "Target",
                        RelatedEntityId = target.Id
                    });
                    continue;
                }

                if (!userCache.TryGetValue(userId, out var user))
                {
                    user = await _repository.FindOracleUserAsync(userId, activeOnly: false, cancellationToken);
                    userCache[userId] = user;
                }

                if (user == null)
                {
                    errors.Add(new SubjectRoutingValidationMessageDto
                    {
                        Code = "TARGET_USER_NOT_FOUND",
                        Severity = "Error",
                        IsBlocking = true,
                        MessageAr = "المستخدم المحدد في الجهة المستهدفة غير موجود في Oracle.",
                        RelatedEntityType = "Target",
                        RelatedEntityId = target.Id
                    });
                    continue;
                }

                if (user.Status.HasValue && user.Status.Value <= 0)
                {
                    warnings.Add(new SubjectRoutingValidationMessageDto
                    {
                        Code = "TARGET_USER_INACTIVE",
                        Severity = "Warning",
                        IsBlocking = false,
                        MessageAr = "المستخدم المحدد غير نشط في Oracle.",
                        RelatedEntityType = "Target",
                        RelatedEntityId = target.Id
                    });
                }

                if (!string.Equals(resolvedModel.AudienceResolutionMode, "SpecificUserOnly", StringComparison.OrdinalIgnoreCase))
                {
                    errors.Add(new SubjectRoutingValidationMessageDto
                    {
                        Code = "TARGET_AUDIENCE_MISMATCH",
                        Severity = "Error",
                        IsBlocking = true,
                        MessageAr = "نمط المؤهلين غير متوافق مع اختيار مستخدم محدد.",
                        RelatedEntityType = "Target",
                        RelatedEntityId = target.Id
                    });
                }
            }
            else
            {
                errors.Add(new SubjectRoutingValidationMessageDto
                {
                    Code = "TARGET_NODE_TYPE_UNSUPPORTED",
                    Severity = "Error",
                    IsBlocking = true,
                    MessageAr = "نوع العقدة في الجهة المستهدفة غير مدعوم.",
                    RelatedEntityType = "Target",
                    RelatedEntityId = target.Id
                });
                continue;
            }

            if (IsSingleRecipientAudience(resolvedModel.AudienceResolutionMode)
                && !string.Equals(resolvedModel.WorkDistributionMode, "SharedInbox", StringComparison.OrdinalIgnoreCase))
            {
                errors.Add(new SubjectRoutingValidationMessageDto
                {
                    Code = "TARGET_DISTRIBUTION_MISMATCH",
                    Severity = "Error",
                    IsBlocking = true,
                    MessageAr = "نمط توزيع العمل غير متوافق مع دائرة مؤهلين أحادية.",
                    RelatedEntityType = "Target",
                    RelatedEntityId = target.Id
                });
            }
        }

        foreach (var transition in transitions)
        {
            var transitionDisplayName = string.IsNullOrWhiteSpace(transition.ActionNameAr)
                ? $"#{transition.Id}"
                : transition.ActionNameAr;

            if (!stepIds.Contains(transition.FromStepId) || !stepIds.Contains(transition.ToStepId))
            {
                errors.Add(new SubjectRoutingValidationMessageDto
                {
                    Code = "TRANSITION_INVALID_STEP_LINK",
                    Severity = "Error",
                    IsBlocking = true,
                    MessageAr = "يوجد انتقال مرتبط بخطوات غير صالحة داخل المسار.",
                    RelatedEntityType = "Transition",
                    RelatedEntityId = transition.Id
                });
            }

            if (transition.FromStepId == transition.ToStepId)
            {
                errors.Add(new SubjectRoutingValidationMessageDto
                {
                    Code = "TRANSITION_SELF_LOOP",
                    Severity = "Error",
                    IsBlocking = true,
                    MessageAr = $"الانتقال '{transitionDisplayName}' يربط الخطوة بنفسها بشكل غير منطقي.",
                    RelatedEntityType = "Transition",
                    RelatedEntityId = transition.Id
                });
            }
        }

        if (startSteps.Count == 1)
        {
            var reachable = ComputeReachableSteps(startSteps[0].Id, transitions);
            var unreachableSteps = steps
                .Where(step => !reachable.Contains(step.Id))
                .OrderBy(step => step.StepOrder)
                .ThenBy(step => step.Id)
                .ToList();

            foreach (var unreachable in unreachableSteps)
            {
                var unreachableName = string.IsNullOrWhiteSpace(unreachable.StepNameAr)
                    ? $"#{unreachable.Id}"
                    : unreachable.StepNameAr;

                warnings.Add(new SubjectRoutingValidationMessageDto
                {
                    Code = "UNREACHABLE_STEP",
                    Severity = "Warning",
                    IsBlocking = false,
                    MessageAr = $"الخطوة '{unreachableName}' غير قابلة للوصول من خطوة البداية.",
                    RelatedEntityType = "Step",
                    RelatedEntityId = unreachable.Id
                });
            }
        }

        if (HasCycle(stepsById.Keys.ToHashSet(), transitions))
        {
            warnings.Add(new SubjectRoutingValidationMessageDto
            {
                Code = "POSSIBLE_LOOP",
                Severity = "Warning",
                IsBlocking = false,
                MessageAr = "تم اكتشاف حلقة داخل المسار. تأكد أنها مقصودة.",
                RelatedEntityType = "Profile",
                RelatedEntityId = profile.Id
            });
        }

        foreach (var endStep in endSteps)
        {
            var endOutgoing = transitions
                .Where(item => item.FromStepId == endStep.Id)
                .Where(item => !item.IsRejectPath && !item.IsReturnPath && !item.IsEscalationPath)
                .ToList();
            if (endOutgoing.Count == 0)
            {
                continue;
            }

            warnings.Add(new SubjectRoutingValidationMessageDto
            {
                Code = "END_STEP_HAS_OUTGOING",
                Severity = "Warning",
                IsBlocking = false,
                MessageAr = $"خطوة النهاية '{(string.IsNullOrWhiteSpace(endStep.StepNameAr) ? $"#{endStep.Id}" : endStep.StepNameAr)}' لها انتقالات خروج غير منطقية.",
                RelatedEntityType = "Step",
                RelatedEntityId = endStep.Id
            });
        }

        if (workspace.Binding == null)
        {
            warnings.Add(new SubjectRoutingValidationMessageDto
            {
                Code = "PROFILE_NOT_BOUND",
                Severity = "Warning",
                IsBlocking = false,
                MessageAr = "ملف التوجيه غير مرتبط بنوع الطلب كربط فعال.",
                RelatedEntityType = "Profile",
                RelatedEntityId = profile.Id
            });
        }

        if (profile.StartStepId.HasValue && !stepIds.Contains(profile.StartStepId.Value))
        {
            warnings.Add(new SubjectRoutingValidationMessageDto
            {
                Code = "PROFILE_START_STEP_MISMATCH",
                Severity = "Warning",
                IsBlocking = false,
                MessageAr = "معرف خطوة البداية في الملف لا يشير إلى خطوة فعالة صالحة.",
                RelatedEntityType = "Profile",
                RelatedEntityId = profile.Id
            });
        }

        return new SubjectRoutingValidationResultDto
        {
            RoutingProfileId = profile.Id,
            IsValid = errors.Count == 0,
            Errors = errors,
            Warnings = warnings
        };
    }

    private static HashSet<int> ComputeReachableSteps(
        int startStepId,
        IReadOnlyCollection<SubjectRoutingTransitionDto> transitions)
    {
        var graph = transitions
            .GroupBy(item => item.FromStepId)
            .ToDictionary(
                group => group.Key,
                group => group.Select(item => item.ToStepId).ToList());

        var visited = new HashSet<int>();
        var queue = new Queue<int>();
        queue.Enqueue(startStepId);
        visited.Add(startStepId);

        while (queue.Count > 0)
        {
            var current = queue.Dequeue();
            if (!graph.TryGetValue(current, out var neighbors))
            {
                continue;
            }

            foreach (var next in neighbors)
            {
                if (!visited.Add(next))
                {
                    continue;
                }

                queue.Enqueue(next);
            }
        }

        return visited;
    }

    private static bool HasCycle(
        IReadOnlySet<int> stepIds,
        IReadOnlyCollection<SubjectRoutingTransitionDto> transitions)
    {
        var graph = transitions
            .Where(item => stepIds.Contains(item.FromStepId) && stepIds.Contains(item.ToStepId))
            .GroupBy(item => item.FromStepId)
            .ToDictionary(
                group => group.Key,
                group => group.Select(item => item.ToStepId).ToList());

        var visiting = new HashSet<int>();
        var visited = new HashSet<int>();

        foreach (var stepId in stepIds)
        {
            if (visited.Contains(stepId))
            {
                continue;
            }

            if (HasCycleDfs(stepId, graph, visiting, visited))
            {
                return true;
            }
        }

        return false;
    }

    private static bool HasCycleDfs(
        int current,
        IReadOnlyDictionary<int, List<int>> graph,
        ISet<int> visiting,
        ISet<int> visited)
    {
        if (visiting.Contains(current))
        {
            return true;
        }

        if (visited.Contains(current))
        {
            return false;
        }

        visiting.Add(current);
        if (graph.TryGetValue(current, out var neighbors))
        {
            foreach (var next in neighbors)
            {
                if (HasCycleDfs(next, graph, visiting, visited))
                {
                    return true;
                }
            }
        }

        visiting.Remove(current);
        visited.Add(current);
        return false;
    }

    private static SubjectRoutingProfileDto MapProfile(SubjectRoutingProfile profile)
    {
        return new SubjectRoutingProfileDto
        {
            Id = profile.Id,
            SubjectTypeId = profile.SubjectTypeId,
            NameAr = profile.NameAr,
            DescriptionAr = profile.DescriptionAr,
            IsActive = profile.IsActive,
            DirectionMode = profile.DirectionMode,
            StartStepId = profile.StartStepId,
            VersionNo = profile.VersionNo,
            CreatedBy = profile.CreatedBy,
            CreatedDate = profile.CreatedDate,
            LastModifiedBy = profile.LastModifiedBy,
            LastModifiedDate = profile.LastModifiedDate
        };
    }

    private static SubjectRoutingStepDto MapStep(SubjectRoutingStep step)
    {
        return new SubjectRoutingStepDto
        {
            Id = step.Id,
            RoutingProfileId = step.RoutingProfileId,
            StepCode = step.StepCode,
            StepNameAr = step.StepNameAr,
            StepType = step.StepType,
            StepOrder = step.StepOrder,
            IsStart = step.IsStart,
            IsEnd = step.IsEnd,
            SlaHours = step.SlaHours,
            IsActive = step.IsActive,
            NotesAr = step.NotesAr
        };
    }

    private static SubjectRoutingTargetDto MapTarget(SubjectRoutingTarget target)
    {
        return new SubjectRoutingTargetDto
        {
            Id = target.Id,
            RoutingStepId = target.RoutingStepId,
            TargetMode = target.TargetMode,
            OracleUnitTypeId = target.OracleUnitTypeId,
            OracleOrgUnitId = target.OracleOrgUnitId,
            PositionId = target.PositionId,
            PositionCode = target.PositionCode,
            SelectedNodeType = target.SelectedNodeType,
            SelectedNodeNumericId = target.SelectedNodeNumericId,
            SelectedNodeUserId = target.SelectedNodeUserId,
            AudienceResolutionMode = target.AudienceResolutionMode,
            WorkDistributionMode = target.WorkDistributionMode,
            AllowMultipleReceivers = target.AllowMultipleReceivers,
            SendToLeaderOnly = target.SendToLeaderOnly,
            IsActive = target.IsActive,
            NotesAr = target.NotesAr
        };
    }

    private static SubjectRoutingTransitionDto MapTransition(SubjectRoutingTransition transition)
    {
        return new SubjectRoutingTransitionDto
        {
            Id = transition.Id,
            RoutingProfileId = transition.RoutingProfileId,
            FromStepId = transition.FromStepId,
            ToStepId = transition.ToStepId,
            ActionCode = transition.ActionCode,
            ActionNameAr = transition.ActionNameAr,
            DisplayOrder = transition.DisplayOrder,
            RequiresComment = transition.RequiresComment,
            RequiresMandatoryFieldsCompletion = transition.RequiresMandatoryFieldsCompletion,
            IsRejectPath = transition.IsRejectPath,
            IsReturnPath = transition.IsReturnPath,
            IsEscalationPath = transition.IsEscalationPath,
            ConditionExpression = transition.ConditionExpression,
            IsActive = transition.IsActive
        };
    }

    private static SubjectTypeRoutingBindingDto MapBinding(SubjectTypeRoutingBinding binding)
    {
        return new SubjectTypeRoutingBindingDto
        {
            Id = binding.Id,
            SubjectTypeId = binding.SubjectTypeId,
            RoutingProfileId = binding.RoutingProfileId,
            IsDefault = binding.IsDefault,
            AppliesToInbound = binding.AppliesToInbound,
            AppliesToOutbound = binding.AppliesToOutbound,
            IsActive = binding.IsActive
        };
    }

    private static bool TryNormalizeDirectionMode(string? value, out string normalized)
    {
        var key = NormalizeNullable(value);
        if (key == null)
        {
            normalized = "Both";
            return true;
        }

        if (!SupportedDirectionModes.TryGetValue(key, out var resolved) || string.IsNullOrWhiteSpace(resolved))
        {
            normalized = string.Empty;
            return false;
        }

        normalized = resolved;
        return true;
    }

    private static string? NormalizeDirectionFilter(string? direction)
    {
        var normalized = NormalizeNullable(direction);
        if (normalized == null || string.Equals(normalized, "both", StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        if (string.Equals(normalized, "inbound", StringComparison.OrdinalIgnoreCase)
            || string.Equals(normalized, "inboundonly", StringComparison.OrdinalIgnoreCase))
        {
            return "Inbound";
        }

        if (string.Equals(normalized, "outbound", StringComparison.OrdinalIgnoreCase)
            || string.Equals(normalized, "outboundonly", StringComparison.OrdinalIgnoreCase))
        {
            return "Outbound";
        }

        return "__invalid__";
    }

    private static bool ProfileMatchesDirection(string profileDirectionMode, string? directionFilter)
    {
        if (directionFilter == null)
        {
            return true;
        }

        if (!TryNormalizeDirectionMode(profileDirectionMode, out var normalizedProfileMode))
        {
            return false;
        }

        if (directionFilter == "Inbound")
        {
            return normalizedProfileMode == "InboundOnly" || normalizedProfileMode == "Both";
        }

        if (directionFilter == "Outbound")
        {
            return normalizedProfileMode == "OutboundOnly" || normalizedProfileMode == "Both";
        }

        return false;
    }

    private static bool BindingMatchesDirection(SubjectTypeRoutingBinding binding, string? directionFilter)
    {
        if (directionFilter == null)
        {
            return true;
        }

        if (directionFilter == "Inbound")
        {
            return binding.AppliesToInbound;
        }

        if (directionFilter == "Outbound")
        {
            return binding.AppliesToOutbound;
        }

        return false;
    }

    private async Task<Dictionary<string, PosUser>> BuildUsersLookupAsync(
        IEnumerable<string?> userIds,
        CancellationToken cancellationToken)
    {
        var normalizedIds = (userIds ?? Array.Empty<string?>())
            .Select(NormalizeNullable)
            .Where(item => item != null)
            .Cast<string>()
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (normalizedIds.Count == 0)
        {
            return new Dictionary<string, PosUser>(StringComparer.OrdinalIgnoreCase);
        }

        var users = await _repository.ListOracleUsersByIdsAsync(normalizedIds, cancellationToken);
        return users
            .Where(item => NormalizeNullable(item.UserId) != null)
            .GroupBy(item => item.UserId.Trim(), StringComparer.OrdinalIgnoreCase)
            .ToDictionary(group => group.Key, group => group.First(), StringComparer.OrdinalIgnoreCase);
    }

    private async Task<IReadOnlyList<SubjectRoutingOrgTreeNodeDto>> SearchTreeNodesAsync(
        string searchTerm,
        bool activeOnly,
        bool includeUsers,
        CancellationToken cancellationToken)
    {
        var units = await _repository.ListOracleUnitsAsync(
            unitTypeId: null,
            parentId: null,
            search: searchTerm,
            activeOnly: activeOnly,
            cancellationToken: cancellationToken);

        var positions = await _repository.ListOraclePositionsAsync(
            userId: null,
            unitId: null,
            activeOnly: activeOnly,
            cancellationToken: cancellationToken);

        var filteredPositions = positions
            .Where(item =>
                ContainsInsensitive(item.UserId, searchTerm)
                || ContainsInsensitive(item.Unit?.UnitName, searchTerm)
                || ContainsInsensitive(item.PositionId.ToString(), searchTerm))
            .Take(250)
            .ToList();

        var usersById = await BuildUsersLookupAsync(filteredPositions.Select(item => item.UserId), cancellationToken);
        var nodes = new List<SubjectRoutingOrgTreeNodeDto>();

        nodes.AddRange(units
            .Take(250)
            .Select(item => new SubjectRoutingOrgTreeNodeDto
            {
                NodeType = "OrgUnit",
                NodeNumericId = item.UnitId,
                LabelAr = item.UnitName ?? string.Empty,
                SecondaryLabelAr = $"نوع الوحدة: {item.UnitType?.TypeName ?? "-"}",
                ParentNodeType = item.ParentId.HasValue ? "OrgUnit" : null,
                ParentNodeNumericId = item.ParentId,
                IsSelectable = true,
                HasChildren = true,
                IsActive = item.Status != false
            }));

        nodes.AddRange(filteredPositions.Select(item =>
        {
            usersById.TryGetValue(item.UserId ?? string.Empty, out var userRecord);
            return new SubjectRoutingOrgTreeNodeDto
            {
                NodeType = "Position",
                NodeNumericId = item.PositionId,
                LabelAr = $"منصب #{item.PositionId}",
                SecondaryLabelAr = BuildPositionSecondaryLabel(item.UserId, userRecord),
                ParentNodeType = "OrgUnit",
                ParentNodeNumericId = item.UnitId,
                IsSelectable = true,
                HasChildren = includeUsers && !string.IsNullOrWhiteSpace(item.UserId),
                IsActive = item.IsActive != false
            };
        }));

        if (includeUsers)
        {
            nodes.AddRange(filteredPositions
                .Where(item => !string.IsNullOrWhiteSpace(item.UserId))
                .Select(item => item.UserId.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Select(userId =>
                {
                    usersById.TryGetValue(userId, out var userRecord);
                    return new SubjectRoutingOrgTreeNodeDto
                    {
                        NodeType = "SpecificUser",
                        NodeUserId = userId,
                        LabelAr = BuildTreeUserLabel(userId, userRecord),
                        SecondaryLabelAr = BuildUserSecondaryLabel(userRecord),
                        ParentNodeType = null,
                        ParentNodeNumericId = null,
                        IsSelectable = true,
                        HasChildren = false,
                        IsActive = true
                    };
                }));
        }

        return nodes
            .OrderBy(item => item.NodeType == "OrgUnit" ? 0 : item.NodeType == "Position" ? 1 : 2)
            .ThenBy(item => item.LabelAr)
            .ToList();
    }

    private static bool ContainsInsensitive(string? source, string? term)
    {
        var normalizedSource = NormalizeNullable(source);
        var normalizedTerm = NormalizeNullable(term);
        if (normalizedSource == null || normalizedTerm == null)
        {
            return false;
        }

        return normalizedSource.Contains(normalizedTerm, StringComparison.OrdinalIgnoreCase);
    }

    private static string? NormalizeTreeNodeType(string? value)
    {
        var normalized = NormalizeNullable(value);
        if (normalized == null)
        {
            return null;
        }

        return TryNormalizeSelectedNodeType(normalized, out var resolved)
            ? resolved
            : "__invalid__";
    }

    private static bool TryNormalizeSelectedNodeType(string? value, out string normalized)
    {
        var key = NormalizeNullable(value);
        if (key == null)
        {
            normalized = string.Empty;
            return false;
        }

        if (!SupportedSelectedNodeTypes.TryGetValue(key, out var resolved) || string.IsNullOrWhiteSpace(resolved))
        {
            normalized = string.Empty;
            return false;
        }

        normalized = resolved;
        return true;
    }

    private static bool TryNormalizeAudienceMode(string? value, out string normalized)
    {
        var key = NormalizeNullable(value);
        if (key == null)
        {
            normalized = string.Empty;
            return false;
        }

        if (!SupportedAudienceModes.TryGetValue(key, out var resolved) || string.IsNullOrWhiteSpace(resolved))
        {
            normalized = string.Empty;
            return false;
        }

        normalized = resolved;
        return true;
    }

    private static bool TryNormalizeWorkDistributionMode(string? value, out string normalized)
    {
        var key = NormalizeNullable(value);
        if (key == null)
        {
            normalized = string.Empty;
            return false;
        }

        if (!SupportedWorkDistributionModes.TryGetValue(key, out var resolved) || string.IsNullOrWhiteSpace(resolved))
        {
            normalized = string.Empty;
            return false;
        }

        normalized = resolved;
        return true;
    }

    private static bool IsSingleRecipientAudience(string? audienceResolutionMode)
    {
        return string.Equals(audienceResolutionMode, "OrgUnitLeaderOnly", StringComparison.OrdinalIgnoreCase)
            || string.Equals(audienceResolutionMode, "SpecificUserOnly", StringComparison.OrdinalIgnoreCase);
    }

    private static string? BuildUserDisplayNameAr(PosUser? user)
    {
        return NormalizeNullable(user?.ArabicName);
    }

    private static string? BuildUserDisplayNameEn(PosUser? user)
    {
        var firstName = NormalizeNullable(user?.FirstName);
        var lastName = NormalizeNullable(user?.LastName);
        if (firstName == null && lastName == null)
        {
            return null;
        }

        return $"{firstName ?? string.Empty} {lastName ?? string.Empty}".Trim();
    }

    private static string BuildTreeUserLabel(string? userId, PosUser? user)
    {
        var normalizedUserId = NormalizeNullable(userId) ?? "-";
        var displayNameAr = BuildUserDisplayNameAr(user);
        return displayNameAr == null
            ? $"مستخدم ({normalizedUserId})"
            : $"{displayNameAr} ({normalizedUserId})";
    }

    private static string? BuildUserSecondaryLabel(PosUser? user)
    {
        var displayNameEn = BuildUserDisplayNameEn(user);
        return displayNameEn == null ? null : $"الاسم الإنجليزي: {displayNameEn}";
    }

    private static string BuildPositionSecondaryLabel(string? userId, PosUser? user)
    {
        var normalizedUserId = NormalizeNullable(userId);
        var displayNameAr = BuildUserDisplayNameAr(user);
        if (displayNameAr != null && normalizedUserId != null)
        {
            return $"{displayNameAr} ({normalizedUserId})";
        }

        if (displayNameAr != null)
        {
            return displayNameAr;
        }

        return normalizedUserId == null ? "بدون مستخدم" : $"المستخدم: {normalizedUserId}";
    }

    private static bool TryResolveTargetModel(SubjectRoutingTargetDto target, out ResolvedTargetModel resolved)
    {
        string? selectedNodeType = null;
        decimal? selectedNodeNumericId = null;
        string? selectedNodeUserId = null;

        var nodeTypeRaw = NormalizeNullable(target.SelectedNodeType);
        if (nodeTypeRaw != null && TryNormalizeSelectedNodeType(nodeTypeRaw, out var normalizedNodeType))
        {
            selectedNodeType = normalizedNodeType;
            selectedNodeNumericId = target.SelectedNodeNumericId;
            selectedNodeUserId = NormalizeNullable(target.SelectedNodeUserId);
        }
        else if (string.Equals(target.TargetMode, "SpecificUnit", StringComparison.OrdinalIgnoreCase))
        {
            selectedNodeType = "OrgUnit";
            selectedNodeNumericId = target.OracleOrgUnitId;
        }
        else if (string.Equals(target.TargetMode, "Position", StringComparison.OrdinalIgnoreCase))
        {
            selectedNodeType = "Position";
            selectedNodeNumericId = target.PositionId;
        }
        else if (string.Equals(target.TargetMode, "CommitteeMembers", StringComparison.OrdinalIgnoreCase))
        {
            selectedNodeType = "SpecificUser";
            selectedNodeUserId = NormalizeNullable(target.PositionCode);
        }

        if (selectedNodeType == null)
        {
            resolved = new ResolvedTargetModel();
            return false;
        }

        string audienceResolutionMode;
        if (TryNormalizeAudienceMode(target.AudienceResolutionMode, out var normalizedAudience))
        {
            audienceResolutionMode = normalizedAudience;
        }
        else if (string.Equals(selectedNodeType, "OrgUnit", StringComparison.OrdinalIgnoreCase))
        {
            audienceResolutionMode = target.SendToLeaderOnly ? "OrgUnitLeaderOnly" : "OrgUnitAllMembers";
        }
        else if (string.Equals(selectedNodeType, "Position", StringComparison.OrdinalIgnoreCase))
        {
            audienceResolutionMode = "PositionOccupants";
        }
        else
        {
            audienceResolutionMode = "SpecificUserOnly";
        }

        string workDistributionMode;
        if (TryNormalizeWorkDistributionMode(target.WorkDistributionMode, out var normalizedWorkMode))
        {
            workDistributionMode = normalizedWorkMode;
        }
        else if (IsSingleRecipientAudience(audienceResolutionMode))
        {
            workDistributionMode = "SharedInbox";
        }
        else
        {
            workDistributionMode = target.AllowMultipleReceivers ? "SharedInbox" : "ManualAssignment";
        }

        resolved = new ResolvedTargetModel
        {
            SelectedNodeType = selectedNodeType,
            SelectedNodeNumericId = selectedNodeNumericId,
            SelectedNodeUserId = selectedNodeUserId,
            AudienceResolutionMode = audienceResolutionMode,
            WorkDistributionMode = workDistributionMode
        };

        return true;
    }

    private static string BuildTargetNodeLabelAr(
        string selectedNodeType,
        decimal? selectedNodeNumericId,
        string? selectedNodeUserId)
    {
        if (string.Equals(selectedNodeType, "OrgUnit", StringComparison.OrdinalIgnoreCase))
        {
            return $"وحدة تنظيمية ({selectedNodeNumericId?.ToString() ?? "-"})";
        }

        if (string.Equals(selectedNodeType, "Position", StringComparison.OrdinalIgnoreCase))
        {
            return $"منصب ({selectedNodeNumericId?.ToString() ?? "-"})";
        }

        return $"مستخدم ({selectedNodeUserId ?? "-"})";
    }

    private static string BuildAudienceLabelAr(string audienceResolutionMode)
    {
        return audienceResolutionMode switch
        {
            "OrgUnitAllMembers" => "جميع أعضاء الوحدة",
            "OrgUnitLeaderOnly" => "قائد الوحدة فقط",
            "PositionOccupants" => "جميع شاغلي المنصب",
            "SpecificUserOnly" => "مستخدم محدد فقط",
            _ => audienceResolutionMode
        };
    }

    private static string BuildWorkDistributionLabelAr(string workDistributionMode)
    {
        return workDistributionMode switch
        {
            "SharedInbox" => "عرض مشترك للجميع",
            "AutoDistributeActive" => "توزيع تلقائي على عضو نشط",
            "ManualAssignment" => "تحويل يدوي لأعضاء الفريق",
            _ => workDistributionMode
        };
    }

    private static string BuildStepTargetsSummary(
        int stepId,
        IReadOnlyCollection<SubjectRoutingTargetDto> targets)
    {
        var stepTargets = targets.Where(item => item.RoutingStepId == stepId).ToList();
        if (stepTargets.Count == 0)
        {
            return "لا توجد جهة مستهدفة.";
        }

        var parts = new List<string>();
        foreach (var target in stepTargets)
        {
            if (TryResolveTargetModel(target, out var resolvedModel))
            {
                var nodeLabel = BuildTargetNodeLabelAr(
                    resolvedModel.SelectedNodeType,
                    resolvedModel.SelectedNodeNumericId,
                    resolvedModel.SelectedNodeUserId);
                var audienceLabel = BuildAudienceLabelAr(resolvedModel.AudienceResolutionMode);
                var distributionLabel = BuildWorkDistributionLabelAr(resolvedModel.WorkDistributionMode);
                parts.Add($"{nodeLabel} | المؤهلون: {audienceLabel} | التوزيع: {distributionLabel}");
                continue;
            }

            var legacyLabel = target.TargetMode switch
            {
                "UnitType" => $"نوع وحدة ({target.OracleUnitTypeId?.ToString() ?? "-"})",
                "SpecificUnit" => $"وحدة محددة ({target.OracleOrgUnitId?.ToString() ?? "-"})",
                "UnitLeader" => "قائد الوحدة",
                "Position" => $"منصب ({target.PositionId?.ToString() ?? target.PositionCode ?? "-"})",
                "CommitteeMembers" => "أعضاء لجنة",
                "ParentUnitLeader" => "قائد الوحدة الأب",
                "ChildUnitByType" => $"وحدة فرعية حسب النوع ({target.OracleUnitTypeId?.ToString() ?? "-"})",
                _ => target.TargetMode
            };

            parts.Add(legacyLabel);
        }

        return string.Join("، ", parts.Distinct(StringComparer.OrdinalIgnoreCase));
    }

    private static string BuildPreviewSummary(
        SubjectRoutingProfileDto profile,
        IReadOnlyList<SubjectRoutingStepDto> steps,
        IReadOnlyList<SubjectRoutingTransitionDto> transitions,
        IReadOnlyList<SubjectRoutingTargetDto> targets,
        SubjectRoutingStepDto? startStep)
    {
        if (steps.Count == 0)
        {
            return "المسار لا يحتوي على خطوات بعد، يرجى إضافة خطوات وانتقالات للحصول على معاينة كاملة.";
        }

        var endSteps = steps.Where(item => item.IsEnd).Select(item => item.StepNameAr).Where(item => !string.IsNullOrWhiteSpace(item)).ToList();
        var startName = startStep?.StepNameAr ?? "غير محددة";
        var firstTarget = startStep == null
            ? "لا توجد جهة بداية"
            : BuildStepTargetsSummary(startStep.Id, targets);
        var firstActions = startStep == null
            ? new List<string>()
            : transitions
                .Where(item => item.FromStepId == startStep.Id)
                .OrderBy(item => item.DisplayOrder)
                .Select(item => item.ActionNameAr)
                .Where(item => !string.IsNullOrWhiteSpace(item))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
        var rejectTargets = transitions
            .Where(item => item.IsRejectPath)
            .Select(item => item.ToStepId)
            .Distinct()
            .ToList();
        var returnTargets = transitions
            .Where(item => item.IsReturnPath)
            .Select(item => item.ToStepId)
            .Distinct()
            .ToList();

        var stepsById = steps.ToDictionary(item => item.Id, item => item.StepNameAr);
        var rejectNames = rejectTargets
            .Select(stepId => stepsById.TryGetValue(stepId, out var name) ? name : null)
            .Where(name => !string.IsNullOrWhiteSpace(name))
            .ToList();
        var returnNames = returnTargets
            .Select(stepId => stepsById.TryGetValue(stepId, out var name) ? name : null)
            .Where(name => !string.IsNullOrWhiteSpace(name))
            .ToList();

        var actionsSummary = firstActions.Count == 0 ? "لا توجد إجراءات معرفة من خطوة البداية" : string.Join("، ", firstActions);
        var endSummary = endSteps.Count == 0 ? "لم تُحدد خطوة نهاية بعد" : string.Join("، ", endSteps);
        var rejectSummary = rejectNames.Count == 0 ? "لا توجد مسارات رفض" : string.Join("، ", rejectNames);
        var returnSummary = returnNames.Count == 0 ? "لا توجد مسارات إعادة" : string.Join("، ", returnNames);

        return $"يبدأ المسار من '{startName}' ويتجه أولًا إلى: {firstTarget}. الإجراءات المتاحة من البداية: {actionsSummary}. ينتهي المسار عند: {endSummary}. مسارات الرفض: {rejectSummary}. مسارات الإعادة: {returnSummary}.";
    }

    private static void AddUnauthorized<T>(CommonResponse<T> response)
    {
        response.Errors.Add(new Error { Code = "401", Message = "المستخدم غير مصرح له." });
    }

    private static void AddUnhandledError<T>(CommonResponse<T> response)
    {
        response.Errors.Add(new Error { Code = "500", Message = "حدث خطأ غير متوقع أثناء معالجة الطلب." });
    }

    private static string NormalizeUser(string? userId)
    {
        return (userId ?? string.Empty).Trim();
    }

    private static string? NormalizeNullable(string? value)
    {
        var normalized = (value ?? string.Empty).Trim();
        return normalized.Length == 0 ? null : normalized;
    }

    private sealed class ProfileRequestValidationResult
    {
        public int SubjectTypeId { get; set; }

        public string NameAr { get; set; } = string.Empty;

        public string? DescriptionAr { get; set; }

        public bool IsActive { get; set; }

        public string DirectionMode { get; set; } = "Both";

        public int VersionNo { get; set; }
    }

    private sealed class StepRequestValidationResult
    {
        public int RoutingProfileId { get; set; }

        public string StepCode { get; set; } = string.Empty;

        public string StepNameAr { get; set; } = string.Empty;

        public string StepType { get; set; } = string.Empty;

        public int StepOrder { get; set; }

        public bool IsStart { get; set; }

        public bool IsEnd { get; set; }

        public int? SlaHours { get; set; }

        public bool IsActive { get; set; }

        public string? NotesAr { get; set; }
    }

    private sealed class TargetRequestValidationResult
    {
        public int RoutingStepId { get; set; }

        public string TargetMode { get; set; } = string.Empty;

        public decimal? OracleUnitTypeId { get; set; }

        public decimal? OracleOrgUnitId { get; set; }

        public decimal? PositionId { get; set; }

        public string? PositionCode { get; set; }

        public string? SelectedNodeType { get; set; }

        public decimal? SelectedNodeNumericId { get; set; }

        public string? SelectedNodeUserId { get; set; }

        public string? AudienceResolutionMode { get; set; }

        public string? WorkDistributionMode { get; set; }

        public bool AllowMultipleReceivers { get; set; }

        public bool SendToLeaderOnly { get; set; }

        public bool IsActive { get; set; }

        public string? NotesAr { get; set; }
    }

    private sealed class AvailabilityNodeResolutionResult
    {
        public string SelectedNodeType { get; set; } = string.Empty;

        public decimal? SelectedNodeNumericId { get; set; }

        public string? SelectedNodeUserId { get; set; }

        public string SelectedNodeLabelAr { get; set; } = string.Empty;

        public string? SelectedNodeSecondaryLabelAr { get; set; }

        public string? SelectedNodePathAr { get; set; }
    }

    private sealed class ResolvedTargetModel
    {
        public string SelectedNodeType { get; set; } = string.Empty;

        public decimal? SelectedNodeNumericId { get; set; }

        public string? SelectedNodeUserId { get; set; }

        public string AudienceResolutionMode { get; set; } = string.Empty;

        public string WorkDistributionMode { get; set; } = string.Empty;
    }

    private sealed class TransitionRequestValidationResult
    {
        public int RoutingProfileId { get; set; }

        public int FromStepId { get; set; }

        public int ToStepId { get; set; }

        public string ActionCode { get; set; } = string.Empty;

        public string ActionNameAr { get; set; } = string.Empty;

        public int DisplayOrder { get; set; }

        public bool RequiresComment { get; set; }

        public bool RequiresMandatoryFieldsCompletion { get; set; }

        public bool IsRejectPath { get; set; }

        public bool IsReturnPath { get; set; }

        public bool IsEscalationPath { get; set; }

        public string? ConditionExpression { get; set; }

        public bool IsActive { get; set; }
    }
}
