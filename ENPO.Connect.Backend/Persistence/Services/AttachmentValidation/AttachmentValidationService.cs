using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Models.Correspondance;
using Models.DTO.Common;
using Models.DTO.Correspondance.AttachmentValidation;
using Persistence.Data;

namespace Persistence.Services.AttachmentValidation;

public class AttachmentValidationService : IAttachmentValidationService
{
    private const string ValidationModeUploadOnly = "UploadOnly";
    private const string ValidationModeUploadAndValidate = "UploadAndValidate";

    private static readonly string[] DefaultAllowedExtensions =
    {
        ".pdf", ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"
    };

    private readonly Attach_HeldContext _attachHeldContext;
    private readonly ILogger<AttachmentValidationService>? _logger;

    public AttachmentValidationService(
        Attach_HeldContext attachHeldContext,
        ILogger<AttachmentValidationService>? logger = null)
    {
        _attachHeldContext = attachHeldContext;
        _logger = logger;
    }

    public async Task<CommonResponse<AttachmentValidationWorkspaceDto>> GetWorkspaceAsync(
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<AttachmentValidationWorkspaceDto>();
        try
        {
            var workspace = new AttachmentValidationWorkspaceDto
            {
                DocumentTypes = await _attachHeldContext.AttachmentValidationDocumentTypes
                    .AsNoTracking()
                    .OrderBy(item => item.DocumentTypeNameAr)
                    .ThenBy(item => item.DocumentTypeCode)
                    .Select(item => MapDocumentType(item))
                    .ToListAsync(cancellationToken),
                Rules = await _attachHeldContext.AttachmentValidationRules
                    .AsNoTracking()
                    .OrderBy(item => item.RuleNameAr)
                    .ThenBy(item => item.RuleCode)
                    .Select(item => MapRule(item))
                    .ToListAsync(cancellationToken),
                DocumentTypeRules = await (
                    from binding in _attachHeldContext.AttachmentValidationDocumentTypeRules.AsNoTracking()
                    join documentType in _attachHeldContext.AttachmentValidationDocumentTypes.AsNoTracking()
                        on binding.DocumentTypeId equals documentType.Id
                    join rule in _attachHeldContext.AttachmentValidationRules.AsNoTracking()
                        on binding.RuleId equals rule.Id
                    orderby documentType.DocumentTypeNameAr, binding.RuleOrder, binding.Id
                    select new AttachmentValidationDocumentTypeRuleDto
                    {
                        Id = binding.Id,
                        DocumentTypeId = binding.DocumentTypeId,
                        RuleId = binding.RuleId,
                        RuleOrder = binding.RuleOrder,
                        IsActive = binding.IsActive,
                        IsRequired = binding.IsRequired,
                        StopOnFailure = binding.StopOnFailure,
                        FailureMessageAr = binding.FailureMessageAr,
                        ParametersJson = binding.ParametersJson,
                        DocumentTypeCode = documentType.DocumentTypeCode,
                        DocumentTypeNameAr = documentType.DocumentTypeNameAr,
                        RuleCode = rule.RuleCode,
                        RuleNameAr = rule.RuleNameAr,
                        CreatedBy = binding.CreatedBy,
                        CreatedDate = binding.CreatedDate,
                        LastModifiedBy = binding.LastModifiedBy,
                        LastModifiedDate = binding.LastModifiedDate
                    })
                    .ToListAsync(cancellationToken)
            };

            response.Data = workspace;
        }
        catch (Exception ex)
        {
            _logger?.LogError(ex, "Attachment validation workspace load failed.");
            response.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });
        }

        return response;
    }

    public async Task<CommonResponse<AttachmentValidationDocumentTypeDto>> UpsertDocumentTypeAsync(
        AttachmentValidationDocumentTypeUpsertRequest request,
        string userId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<AttachmentValidationDocumentTypeDto>();
        request ??= new AttachmentValidationDocumentTypeUpsertRequest();
        try
        {
            var code = (request.DocumentTypeCode ?? string.Empty).Trim();
            var name = (request.DocumentTypeNameAr ?? string.Empty).Trim();
            var actor = NormalizeActor(userId);

            if (string.IsNullOrWhiteSpace(code))
            {
                response.Errors.Add(new Error { Code = "400", Message = "كود نوع المستند مطلوب." });
                return response;
            }

            if (string.IsNullOrWhiteSpace(name))
            {
                response.Errors.Add(new Error { Code = "400", Message = "اسم نوع المستند مطلوب." });
                return response;
            }

            var duplicateExists = await _attachHeldContext.AttachmentValidationDocumentTypes
                .AsNoTracking()
                .AnyAsync(item => item.Id != request.Id && item.DocumentTypeCode == code, cancellationToken);
            if (duplicateExists)
            {
                response.Errors.Add(new Error { Code = "409", Message = "كود نوع المستند مستخدم بالفعل." });
                return response;
            }

            var entity = request.Id > 0
                ? await _attachHeldContext.AttachmentValidationDocumentTypes.FirstOrDefaultAsync(item => item.Id == request.Id, cancellationToken)
                : null;

            if (entity == null)
            {
                entity = new AttachmentValidationDocumentType
                {
                    CreatedBy = actor,
                    CreatedDate = DateTime.UtcNow
                };
                _attachHeldContext.AttachmentValidationDocumentTypes.Add(entity);
            }

            entity.DocumentTypeCode = code;
            entity.DocumentTypeNameAr = name;
            entity.DescriptionAr = NullIfWhiteSpace(request.DescriptionAr);
            entity.ValidationMode = NormalizeValidationMode(request.ValidationMode);
            entity.IsValidationRequired = request.IsValidationRequired;
            entity.IsActive = request.IsActive;
            entity.LastModifiedBy = actor;
            entity.LastModifiedDate = DateTime.UtcNow;

            await _attachHeldContext.SaveChangesAsync(cancellationToken);
            response.Data = MapDocumentType(entity);
        }
        catch (Exception ex)
        {
            _logger?.LogError(ex, "Attachment validation document type upsert failed. RequestId={RequestId}", request?.Id);
            response.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });
        }

        return response;
    }

    public async Task<CommonResponse<AttachmentValidationRuleDto>> UpsertRuleAsync(
        AttachmentValidationRuleUpsertRequest request,
        string userId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<AttachmentValidationRuleDto>();
        request ??= new AttachmentValidationRuleUpsertRequest();
        try
        {
            var code = NormalizeRuleCode(request.RuleCode);
            var name = (request.RuleNameAr ?? string.Empty).Trim();
            var actor = NormalizeActor(userId);

            if (string.IsNullOrWhiteSpace(code))
            {
                response.Errors.Add(new Error { Code = "400", Message = "كود القاعدة مطلوب." });
                return response;
            }

            if (string.IsNullOrWhiteSpace(name))
            {
                response.Errors.Add(new Error { Code = "400", Message = "اسم القاعدة مطلوب." });
                return response;
            }

            var duplicateExists = await _attachHeldContext.AttachmentValidationRules
                .AsNoTracking()
                .AnyAsync(item => item.Id != request.Id && item.RuleCode == code, cancellationToken);
            if (duplicateExists)
            {
                response.Errors.Add(new Error { Code = "409", Message = "كود القاعدة مستخدم بالفعل." });
                return response;
            }

            var entity = request.Id > 0
                ? await _attachHeldContext.AttachmentValidationRules.FirstOrDefaultAsync(item => item.Id == request.Id, cancellationToken)
                : null;

            if (entity == null)
            {
                entity = new AttachmentValidationRule
                {
                    CreatedBy = actor,
                    CreatedDate = DateTime.UtcNow
                };
                _attachHeldContext.AttachmentValidationRules.Add(entity);
            }

            entity.RuleCode = code;
            entity.RuleNameAr = name;
            entity.DescriptionAr = NullIfWhiteSpace(request.DescriptionAr);
            entity.ParameterSchemaJson = NullIfWhiteSpace(request.ParameterSchemaJson);
            entity.IsSystemRule = request.IsSystemRule;
            entity.IsActive = request.IsActive;
            entity.LastModifiedBy = actor;
            entity.LastModifiedDate = DateTime.UtcNow;

            await _attachHeldContext.SaveChangesAsync(cancellationToken);
            response.Data = MapRule(entity);
        }
        catch (Exception ex)
        {
            _logger?.LogError(ex, "Attachment validation rule upsert failed. RequestId={RequestId}", request?.Id);
            response.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });
        }

        return response;
    }

    public async Task<CommonResponse<AttachmentValidationDocumentTypeRuleDto>> UpsertDocumentTypeRuleAsync(
        AttachmentValidationDocumentTypeRuleUpsertRequest request,
        string userId,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<AttachmentValidationDocumentTypeRuleDto>();
        request ??= new AttachmentValidationDocumentTypeRuleUpsertRequest();
        try
        {
            var actor = NormalizeActor(userId);

            if (request.DocumentTypeId <= 0 || request.RuleId <= 0)
            {
                response.Errors.Add(new Error { Code = "400", Message = "نوع المستند والقاعدة حقول مطلوبة." });
                return response;
            }

            var documentType = await _attachHeldContext.AttachmentValidationDocumentTypes
                .FirstOrDefaultAsync(item => item.Id == request.DocumentTypeId, cancellationToken);
            if (documentType == null)
            {
                response.Errors.Add(new Error { Code = "404", Message = "نوع المستند غير موجود." });
                return response;
            }

            var rule = await _attachHeldContext.AttachmentValidationRules
                .FirstOrDefaultAsync(item => item.Id == request.RuleId, cancellationToken);
            if (rule == null)
            {
                response.Errors.Add(new Error { Code = "404", Message = "قاعدة التحقق غير موجودة." });
                return response;
            }

            var duplicateExists = await _attachHeldContext.AttachmentValidationDocumentTypeRules
                .AsNoTracking()
                .AnyAsync(
                    item => item.Id != request.Id && item.DocumentTypeId == request.DocumentTypeId && item.RuleId == request.RuleId,
                    cancellationToken);
            if (duplicateExists)
            {
                response.Errors.Add(new Error { Code = "409", Message = "هذه القاعدة مرتبطة بالفعل بنفس نوع المستند." });
                return response;
            }

            var entity = request.Id > 0
                ? await _attachHeldContext.AttachmentValidationDocumentTypeRules.FirstOrDefaultAsync(item => item.Id == request.Id, cancellationToken)
                : null;

            if (entity == null)
            {
                entity = new AttachmentValidationDocumentTypeRule
                {
                    CreatedBy = actor,
                    CreatedDate = DateTime.UtcNow
                };
                _attachHeldContext.AttachmentValidationDocumentTypeRules.Add(entity);
            }

            entity.DocumentTypeId = request.DocumentTypeId;
            entity.RuleId = request.RuleId;
            entity.RuleOrder = request.RuleOrder <= 0 ? 100 : request.RuleOrder;
            entity.IsActive = request.IsActive;
            entity.IsRequired = request.IsRequired;
            entity.StopOnFailure = request.StopOnFailure;
            entity.FailureMessageAr = NullIfWhiteSpace(request.FailureMessageAr);
            entity.ParametersJson = NullIfWhiteSpace(request.ParametersJson);
            entity.LastModifiedBy = actor;
            entity.LastModifiedDate = DateTime.UtcNow;

            await _attachHeldContext.SaveChangesAsync(cancellationToken);
            response.Data = await BuildDocumentTypeRuleDtoAsync(entity.Id, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger?.LogError(ex, "Attachment validation type-rule upsert failed. RequestId={RequestId}", request?.Id);
            response.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });
        }

        return response;
    }

    public Task<CommonResponse<bool>> DeactivateDocumentTypeAsync(int id, string userId, CancellationToken cancellationToken = default)
    {
        return DeactivateAsync(
            id,
            userId,
            loadEntity: ct => _attachHeldContext.AttachmentValidationDocumentTypes.FirstOrDefaultAsync(item => item.Id == id, ct),
            applyChanges: (entity, actor) =>
            {
                entity.IsActive = false;
                entity.LastModifiedBy = actor;
                entity.LastModifiedDate = DateTime.UtcNow;
            },
            notFoundMessage: "نوع المستند غير موجود.",
            cancellationToken: cancellationToken);
    }

    public Task<CommonResponse<bool>> DeactivateRuleAsync(int id, string userId, CancellationToken cancellationToken = default)
    {
        return DeactivateAsync(
            id,
            userId,
            loadEntity: ct => _attachHeldContext.AttachmentValidationRules.FirstOrDefaultAsync(item => item.Id == id, ct),
            applyChanges: (entity, actor) =>
            {
                entity.IsActive = false;
                entity.LastModifiedBy = actor;
                entity.LastModifiedDate = DateTime.UtcNow;
            },
            notFoundMessage: "قاعدة التحقق غير موجودة.",
            cancellationToken: cancellationToken);
    }

    public Task<CommonResponse<bool>> DeactivateDocumentTypeRuleAsync(int id, string userId, CancellationToken cancellationToken = default)
    {
        return DeactivateAsync(
            id,
            userId,
            loadEntity: ct => _attachHeldContext.AttachmentValidationDocumentTypeRules.FirstOrDefaultAsync(item => item.Id == id, ct),
            applyChanges: (entity, actor) =>
            {
                entity.IsActive = false;
                entity.LastModifiedBy = actor;
                entity.LastModifiedDate = DateTime.UtcNow;
            },
            notFoundMessage: "ربط القاعدة بنوع المستند غير موجود.",
            cancellationToken: cancellationToken);
    }

    public async Task<CommonResponse<AttachmentValidationSettingsDto>> GetSettingsAsync(
        string documentTypeCode,
        CancellationToken cancellationToken = default)
    {
        var response = new CommonResponse<AttachmentValidationSettingsDto>();
        try
        {
            var normalizedCode = (documentTypeCode ?? string.Empty).Trim();
            if (normalizedCode.Length == 0)
            {
                response.Errors.Add(new Error { Code = "400", Message = "كود نوع المستند مطلوب." });
                return response;
            }

            var loaded = await LoadSettingsAsync(normalizedCode, cancellationToken);
            if (loaded == null)
            {
                response.Errors.Add(new Error { Code = "404", Message = "نوع المستند غير معرف ضمن إعدادات التحقق." });
                return response;
            }

            response.Data = MapSettings(loaded);
        }
        catch (Exception ex)
        {
            _logger?.LogError(ex, "Attachment validation settings load failed. DocumentTypeCode={DocumentTypeCode}", documentTypeCode);
            response.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });
        }

        return response;
    }

    public async Task<CommonResponse<AttachmentValidationExecutionResultDto>> ValidateAsync(
        AttachmentValidationExecuteRequest request,
        string userId,
        CancellationToken cancellationToken = default)
    {
        _ = userId;
        var response = new CommonResponse<AttachmentValidationExecutionResultDto>();
        request ??= new AttachmentValidationExecuteRequest();

        try
        {
            var normalizedCode = (request.DocumentTypeCode ?? string.Empty).Trim();
            if (normalizedCode.Length == 0)
            {
                response.Errors.Add(new Error { Code = "400", Message = "كود نوع المستند مطلوب." });
                return response;
            }

            var loaded = await LoadSettingsAsync(normalizedCode, cancellationToken);
            if (loaded == null)
            {
                response.Errors.Add(new Error { Code = "404", Message = "نوع المستند غير معرف ضمن إعدادات التحقق." });
                return response;
            }

            var files = request.files ?? new List<IFormFile>();
            var result = new AttachmentValidationExecutionResultDto
            {
                DocumentTypeId = loaded.DocumentType.Id,
                DocumentTypeCode = loaded.DocumentType.DocumentTypeCode,
                DocumentTypeNameAr = loaded.DocumentType.DocumentTypeNameAr,
                ValidationMode = NormalizeValidationMode(loaded.DocumentType.ValidationMode),
                IsValidationRequired = loaded.DocumentType.IsValidationRequired,
                FilesCount = files.Count,
                IsValid = true
            };

            if (loaded.DocumentType.IsValidationRequired && files.Count == 0)
            {
                result.Errors.Add("يلزم إرفاق ملف واحد على الأقل لهذا النوع من المستندات.");
            }

            var shouldValidateRules = string.Equals(
                NormalizeValidationMode(loaded.DocumentType.ValidationMode),
                ValidationModeUploadAndValidate,
                StringComparison.Ordinal);

            if (!shouldValidateRules)
            {
                result.IsValid = result.Errors.Count == 0;
                response.Data = result;
                return response;
            }

            if (loaded.Bindings.Count == 0)
            {
                result.Warnings.Add("لا توجد قواعد تحقق مفعلة لهذا النوع من المستندات.");
                result.IsValid = result.Errors.Count == 0;
                response.Data = result;
                return response;
            }

            foreach (var binding in loaded.Bindings)
            {
                var evaluation = EvaluateRule(binding, files);
                result.RuleResults.Add(evaluation);
                if (evaluation.Passed)
                {
                    continue;
                }

                if (binding.IsRequired)
                {
                    result.Errors.Add(evaluation.MessageAr);
                    if (binding.StopOnFailure)
                    {
                        break;
                    }
                }
                else
                {
                    result.Warnings.Add(evaluation.MessageAr);
                }
            }

            result.IsValid = result.Errors.Count == 0;
            response.Data = result;
        }
        catch (Exception ex)
        {
            _logger?.LogError(ex, "Attachment validation execution failed. DocumentTypeCode={DocumentTypeCode}", request?.DocumentTypeCode);
            response.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });
        }

        return response;
    }

    private async Task<AttachmentValidationDocumentTypeRuleDto> BuildDocumentTypeRuleDtoAsync(int id, CancellationToken cancellationToken)
    {
        return await (
            from binding in _attachHeldContext.AttachmentValidationDocumentTypeRules.AsNoTracking()
            join documentType in _attachHeldContext.AttachmentValidationDocumentTypes.AsNoTracking()
                on binding.DocumentTypeId equals documentType.Id
            join rule in _attachHeldContext.AttachmentValidationRules.AsNoTracking()
                on binding.RuleId equals rule.Id
            where binding.Id == id
            select new AttachmentValidationDocumentTypeRuleDto
            {
                Id = binding.Id,
                DocumentTypeId = binding.DocumentTypeId,
                RuleId = binding.RuleId,
                RuleOrder = binding.RuleOrder,
                IsActive = binding.IsActive,
                IsRequired = binding.IsRequired,
                StopOnFailure = binding.StopOnFailure,
                FailureMessageAr = binding.FailureMessageAr,
                ParametersJson = binding.ParametersJson,
                DocumentTypeCode = documentType.DocumentTypeCode,
                DocumentTypeNameAr = documentType.DocumentTypeNameAr,
                RuleCode = rule.RuleCode,
                RuleNameAr = rule.RuleNameAr,
                CreatedBy = binding.CreatedBy,
                CreatedDate = binding.CreatedDate,
                LastModifiedBy = binding.LastModifiedBy,
                LastModifiedDate = binding.LastModifiedDate
            })
            .FirstAsync(cancellationToken);
    }

    private async Task<LoadedSettings?> LoadSettingsAsync(string documentTypeCode, CancellationToken cancellationToken)
    {
        var documentType = await _attachHeldContext.AttachmentValidationDocumentTypes
            .AsNoTracking()
            .FirstOrDefaultAsync(
                item => item.IsActive && item.DocumentTypeCode == documentTypeCode,
                cancellationToken);
        if (documentType == null)
        {
            return null;
        }

        var bindings = await (
            from binding in _attachHeldContext.AttachmentValidationDocumentTypeRules.AsNoTracking()
            join rule in _attachHeldContext.AttachmentValidationRules.AsNoTracking()
                on binding.RuleId equals rule.Id
            where binding.IsActive
                  && rule.IsActive
                  && binding.DocumentTypeId == documentType.Id
            orderby binding.RuleOrder, binding.Id
            select new LoadedRuleBinding
            {
                BindingId = binding.Id,
                RuleId = binding.RuleId,
                RuleCode = rule.RuleCode,
                RuleNameAr = rule.RuleNameAr,
                RuleOrder = binding.RuleOrder,
                IsRequired = binding.IsRequired,
                StopOnFailure = binding.StopOnFailure,
                FailureMessageAr = binding.FailureMessageAr,
                ParametersJson = binding.ParametersJson
            })
            .ToListAsync(cancellationToken);

        return new LoadedSettings
        {
            DocumentType = documentType,
            Bindings = bindings
        };
    }

    private static AttachmentValidationSettingsDto MapSettings(LoadedSettings loaded)
    {
        return new AttachmentValidationSettingsDto
        {
            DocumentTypeId = loaded.DocumentType.Id,
            DocumentTypeCode = loaded.DocumentType.DocumentTypeCode,
            DocumentTypeNameAr = loaded.DocumentType.DocumentTypeNameAr,
            ValidationMode = NormalizeValidationMode(loaded.DocumentType.ValidationMode),
            IsValidationRequired = loaded.DocumentType.IsValidationRequired,
            Rules = loaded.Bindings
                .OrderBy(item => item.RuleOrder)
                .ThenBy(item => item.BindingId)
                .Select(item => new AttachmentValidationResolvedRuleDto
                {
                    BindingId = item.BindingId,
                    RuleId = item.RuleId,
                    RuleCode = item.RuleCode,
                    RuleNameAr = item.RuleNameAr,
                    RuleOrder = item.RuleOrder,
                    IsRequired = item.IsRequired,
                    StopOnFailure = item.StopOnFailure,
                    FailureMessageAr = item.FailureMessageAr,
                    ParametersJson = item.ParametersJson
                })
                .ToList()
        };
    }

    private static AttachmentValidationDocumentTypeDto MapDocumentType(AttachmentValidationDocumentType entity)
    {
        return new AttachmentValidationDocumentTypeDto
        {
            Id = entity.Id,
            DocumentTypeCode = entity.DocumentTypeCode,
            DocumentTypeNameAr = entity.DocumentTypeNameAr,
            DescriptionAr = entity.DescriptionAr,
            ValidationMode = NormalizeValidationMode(entity.ValidationMode),
            IsValidationRequired = entity.IsValidationRequired,
            IsActive = entity.IsActive,
            CreatedBy = entity.CreatedBy,
            CreatedDate = entity.CreatedDate,
            LastModifiedBy = entity.LastModifiedBy,
            LastModifiedDate = entity.LastModifiedDate
        };
    }

    private static AttachmentValidationRuleDto MapRule(AttachmentValidationRule entity)
    {
        return new AttachmentValidationRuleDto
        {
            Id = entity.Id,
            RuleCode = entity.RuleCode,
            RuleNameAr = entity.RuleNameAr,
            DescriptionAr = entity.DescriptionAr,
            ParameterSchemaJson = entity.ParameterSchemaJson,
            IsSystemRule = entity.IsSystemRule,
            IsActive = entity.IsActive,
            CreatedBy = entity.CreatedBy,
            CreatedDate = entity.CreatedDate,
            LastModifiedBy = entity.LastModifiedBy,
            LastModifiedDate = entity.LastModifiedDate
        };
    }

    private static string NormalizeValidationMode(string? raw)
    {
        if (string.Equals(raw?.Trim(), ValidationModeUploadAndValidate, StringComparison.OrdinalIgnoreCase))
        {
            return ValidationModeUploadAndValidate;
        }

        return ValidationModeUploadOnly;
    }

    private static string NormalizeRuleCode(string? raw)
    {
        return (raw ?? string.Empty).Trim().ToUpperInvariant();
    }

    private static string NormalizeActor(string? userId)
    {
        var normalized = (userId ?? string.Empty).Trim();
        return normalized.Length > 0 ? normalized : "SYSTEM";
    }

    private static string? NullIfWhiteSpace(string? value)
    {
        var normalized = (value ?? string.Empty).Trim();
        return normalized.Length == 0 ? null : normalized;
    }

    private AttachmentValidationRuleResultDto EvaluateRule(LoadedRuleBinding binding, IReadOnlyCollection<IFormFile> files)
    {
        var message = string.Empty;
        var passed = true;

        switch (NormalizeRuleCode(binding.RuleCode))
        {
            case "MIN_FILE_COUNT":
                {
                    var minimum = ReadIntParameter(binding.ParametersJson, 1, "min", "minimum", "minCount");
                    passed = files.Count >= Math.Max(0, minimum);
                    message = passed
                        ? "تم اجتياز الحد الأدنى لعدد الملفات."
                        : $"يجب إرفاق {Math.Max(0, minimum)} ملف على الأقل.";
                    break;
                }
            case "MAX_FILE_COUNT":
                {
                    var maximum = ReadIntParameter(binding.ParametersJson, 10, "max", "maximum", "maxCount");
                    maximum = Math.Max(1, maximum);
                    passed = files.Count <= maximum;
                    message = passed
                        ? "عدد الملفات ضمن الحد المسموح."
                        : $"الحد الأقصى لعدد الملفات هو {maximum}.";
                    break;
                }
            case "ALLOWED_EXTENSIONS":
                {
                    var allowedExtensions = ReadStringListParameter(
                        binding.ParametersJson,
                        new[] { "extensions", "allowedExtensions" },
                        DefaultAllowedExtensions);
                    var normalizedAllowed = new HashSet<string>(
                        allowedExtensions
                            .Select(item => NormalizeExtension(item))
                            .Where(item => item.Length > 0),
                        StringComparer.OrdinalIgnoreCase);

                    var invalidFiles = files
                        .Where(file => !normalizedAllowed.Contains(NormalizeExtension(Path.GetExtension(file.FileName ?? string.Empty))))
                        .Select(file => file.FileName)
                        .Where(item => !string.IsNullOrWhiteSpace(item))
                        .ToList();

                    passed = invalidFiles.Count == 0;
                    message = passed
                        ? "امتدادات الملفات مقبولة."
                        : $"امتداد الملف غير مسموح: {string.Join("، ", invalidFiles)}.";
                    break;
                }
            case "MAX_FILE_SIZE_MB":
                {
                    var maxMb = ReadDecimalParameter(binding.ParametersJson, 10m, "maxMb", "maxSizeMb", "maximumFileSizeMb");
                    maxMb = Math.Max(0.1m, maxMb);
                    var maxSizeBytes = maxMb * 1024m * 1024m;

                    var invalidFiles = files
                        .Where(file => file.Length > (long)Math.Ceiling(maxSizeBytes))
                        .Select(file => file.FileName)
                        .Where(item => !string.IsNullOrWhiteSpace(item))
                        .ToList();

                    passed = invalidFiles.Count == 0;
                    message = passed
                        ? "أحجام الملفات ضمن الحد المسموح."
                        : $"حجم الملف يتجاوز {maxMb:0.##} ميجابايت: {string.Join("، ", invalidFiles)}.";
                    break;
                }
            default:
                {
                    passed = true;
                    message = "قاعدة غير معرفة بالمحرك الحالي؛ تم تجاهلها.";
                    break;
                }
        }

        var finalMessage = string.IsNullOrWhiteSpace(binding.FailureMessageAr)
            ? message
            : binding.FailureMessageAr;

        return new AttachmentValidationRuleResultDto
        {
            BindingId = binding.BindingId,
            RuleId = binding.RuleId,
            RuleCode = binding.RuleCode,
            RuleNameAr = binding.RuleNameAr,
            IsRequired = binding.IsRequired,
            Passed = passed,
            MessageAr = finalMessage
        };
    }

    private static int ReadIntParameter(string? json, int defaultValue, params string[] propertyNames)
    {
        if (!TryGetJsonProperty(json, propertyNames, out var element))
        {
            return defaultValue;
        }

        if (element.ValueKind == JsonValueKind.Number && element.TryGetInt32(out var intValue))
        {
            return intValue;
        }

        if (element.ValueKind == JsonValueKind.String && int.TryParse(element.GetString(), out intValue))
        {
            return intValue;
        }

        return defaultValue;
    }

    private static decimal ReadDecimalParameter(string? json, decimal defaultValue, params string[] propertyNames)
    {
        if (!TryGetJsonProperty(json, propertyNames, out var element))
        {
            return defaultValue;
        }

        if (element.ValueKind == JsonValueKind.Number && element.TryGetDecimal(out var decimalValue))
        {
            return decimalValue;
        }

        if (element.ValueKind == JsonValueKind.String && decimal.TryParse(element.GetString(), out decimalValue))
        {
            return decimalValue;
        }

        return defaultValue;
    }

    private static IReadOnlyCollection<string> ReadStringListParameter(
        string? json,
        IEnumerable<string> propertyNames,
        IEnumerable<string> fallback)
    {
        if (!TryGetJsonProperty(json, propertyNames, out var element))
        {
            return fallback.ToList();
        }

        if (element.ValueKind != JsonValueKind.Array)
        {
            return fallback.ToList();
        }

        var items = element
            .EnumerateArray()
            .Where(item => item.ValueKind == JsonValueKind.String)
            .Select(item => (item.GetString() ?? string.Empty).Trim())
            .Where(item => item.Length > 0)
            .ToList();

        return items.Count > 0 ? items : fallback.ToList();
    }

    private static bool TryGetJsonProperty(string? json, IEnumerable<string> propertyNames, out JsonElement element)
    {
        element = default;

        if (string.IsNullOrWhiteSpace(json))
        {
            return false;
        }

        try
        {
            using var document = JsonDocument.Parse(json);
            if (document.RootElement.ValueKind != JsonValueKind.Object)
            {
                return false;
            }

            var requestedNames = propertyNames.ToList();
            foreach (var property in document.RootElement.EnumerateObject())
            {
                if (!requestedNames.Any(name => string.Equals(name, property.Name, StringComparison.OrdinalIgnoreCase)))
                {
                    continue;
                }

                element = property.Value.Clone();
                return true;
            }
        }
        catch
        {
            return false;
        }

        return false;
    }

    private static string NormalizeExtension(string? extension)
    {
        var normalized = (extension ?? string.Empty).Trim();
        if (normalized.Length == 0)
        {
            return string.Empty;
        }

        if (!normalized.StartsWith('.'))
        {
            normalized = $".{normalized}";
        }

        return normalized.ToLowerInvariant();
    }

    private async Task<CommonResponse<bool>> DeactivateAsync<TEntity>(
        int id,
        string userId,
        Func<CancellationToken, Task<TEntity?>> loadEntity,
        Action<TEntity, string> applyChanges,
        string notFoundMessage,
        CancellationToken cancellationToken)
        where TEntity : class
    {
        var response = new CommonResponse<bool>();
        try
        {
            if (id <= 0)
            {
                response.Errors.Add(new Error { Code = "400", Message = "المعرف غير صالح." });
                return response;
            }

            var entity = await loadEntity(cancellationToken);
            if (entity == null)
            {
                response.Errors.Add(new Error { Code = "404", Message = notFoundMessage });
                return response;
            }

            applyChanges(entity, NormalizeActor(userId));
            await _attachHeldContext.SaveChangesAsync(cancellationToken);
            response.Data = true;
        }
        catch (Exception ex)
        {
            _logger?.LogError(ex, "Attachment validation deactivate failed. Entity={EntityName}, Id={EntityId}", typeof(TEntity).Name, id);
            response.Errors.Add(new Error { Code = ex.HResult.ToString(), Message = ex.Message });
        }

        return response;
    }

    private sealed class LoadedSettings
    {
        public AttachmentValidationDocumentType DocumentType { get; set; } = null!;
        public List<LoadedRuleBinding> Bindings { get; set; } = new();
    }

    private sealed class LoadedRuleBinding
    {
        public int BindingId { get; set; }
        public int RuleId { get; set; }
        public string RuleCode { get; set; } = string.Empty;
        public string RuleNameAr { get; set; } = string.Empty;
        public int RuleOrder { get; set; }
        public bool IsRequired { get; set; }
        public bool StopOnFailure { get; set; }
        public string? FailureMessageAr { get; set; }
        public string? ParametersJson { get; set; }
    }
}
