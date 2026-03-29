using Microsoft.AspNetCore.Mvc;
using Models.Correspondance;
using Models.DTO.Common;
using Models.DTO.Correspondance.Publications;
using Persistence.Services;

namespace Api.Controllers;

[Route("api/[controller]")]
[ApiController]
public class PublicationsController : ControllerBase
{
    private readonly PublicationsWorkflowService _publicationsWorkflowService;

    public PublicationsController(PublicationsWorkflowService publicationsWorkflowService)
    {
        _publicationsWorkflowService = publicationsWorkflowService;
    }

    [HttpGet(nameof(GetAllowedRequestTypes))]
    public Task<CommonResponse<IEnumerable<PublicationRequestTypeDto>>> GetAllowedRequestTypes()
    {
        var userId = HttpContext.User.Claims.First(f => f.Type == "UserId").Value;
        return _publicationsWorkflowService.GetAllowedRequestTypesAsync(userId);
    }

    [HttpGet(nameof(GetSearchableFields))]
    public Task<CommonResponse<IEnumerable<PublicationSearchableFieldDto>>> GetSearchableFields(int? publicationRequestTypeId = null, bool adminView = false)
    {
        var userId = HttpContext.User.Claims.First(f => f.Type == "UserId").Value;
        return _publicationsWorkflowService.GetSearchableFieldsAsync(userId, publicationRequestTypeId, adminView);
    }

    [HttpPost(nameof(CreateRequest))]
    [Consumes("multipart/form-data")]
    public Task<CommonResponse<PublicationRequestDetailsDto>> CreateRequest([FromForm] PublicationCreateRequest request)
    {
        var userId = HttpContext.User.Claims.First(f => f.Type == "UserId").Value;
        var ip = HttpContext.Connection.RemoteIpAddress?.MapToIPv4().ToString() ?? "0.0.0.0";
        return _publicationsWorkflowService.CreateRequestAsync(request, userId, ip);
    }

    [HttpPut(nameof(EditRequest))]
    [Consumes("multipart/form-data")]
    public Task<CommonResponse<PublicationRequestDetailsDto>> EditRequest(int messageId, [FromForm] PublicationEditRequest request)
    {
        var userId = HttpContext.User.Claims.First(f => f.Type == "UserId").Value;
        var ip = HttpContext.Connection.RemoteIpAddress?.MapToIPv4().ToString() ?? "0.0.0.0";
        return _publicationsWorkflowService.EditRequestAsync(messageId, request, userId, ip);
    }

    [HttpPost(nameof(Submit))]
    public Task<CommonResponse<PublicationRequestDetailsDto>> Submit(int messageId, string? comment = null)
    {
        var userId = HttpContext.User.Claims.First(f => f.Type == "UserId").Value;
        var ip = HttpContext.Connection.RemoteIpAddress?.MapToIPv4().ToString() ?? "0.0.0.0";
        return _publicationsWorkflowService.SubmitAsync(messageId, comment, userId, ip);
    }

    [HttpPost(nameof(SetUnderReview))]
    public Task<CommonResponse<PublicationRequestDetailsDto>> SetUnderReview(int messageId, string? comment = null)
    {
        var userId = HttpContext.User.Claims.First(f => f.Type == "UserId").Value;
        var ip = HttpContext.Connection.RemoteIpAddress?.MapToIPv4().ToString() ?? "0.0.0.0";
        return _publicationsWorkflowService.SetUnderReviewAsync(messageId, comment, userId, ip);
    }

    [HttpPost(nameof(Return))]
    [Consumes("multipart/form-data")]
    public Task<CommonResponse<PublicationRequestDetailsDto>> Return(int messageId, [FromForm] PublicationActionRequest request)
    {
        var userId = HttpContext.User.Claims.First(f => f.Type == "UserId").Value;
        var ip = HttpContext.Connection.RemoteIpAddress?.MapToIPv4().ToString() ?? "0.0.0.0";
        return _publicationsWorkflowService.ReturnAsync(messageId, request, userId, ip);
    }

    [HttpPost(nameof(Reject))]
    [Consumes("multipart/form-data")]
    public Task<CommonResponse<PublicationRequestDetailsDto>> Reject(int messageId, [FromForm] PublicationActionRequest request)
    {
        var userId = HttpContext.User.Claims.First(f => f.Type == "UserId").Value;
        var ip = HttpContext.Connection.RemoteIpAddress?.MapToIPv4().ToString() ?? "0.0.0.0";
        return _publicationsWorkflowService.RejectAsync(messageId, request, userId, ip);
    }

    [HttpPost(nameof(Approve))]
    [Consumes("multipart/form-data")]
    public Task<CommonResponse<PublicationRequestDetailsDto>> Approve(int messageId, [FromForm] PublicationApproveRequest request)
    {
        var userId = HttpContext.User.Claims.First(f => f.Type == "UserId").Value;
        var ip = HttpContext.Connection.RemoteIpAddress?.MapToIPv4().ToString() ?? "0.0.0.0";
        return _publicationsWorkflowService.ApproveAsync(messageId, request, userId, ip);
    }

    [HttpPost(nameof(GetRequests))]
    public Task<CommonResponse<IEnumerable<PublicationRequestSummaryDto>>> GetRequests([FromBody] PublicationRequestsQuery query)
    {
        var userId = HttpContext.User.Claims.First(f => f.Type == "UserId").Value;
        return _publicationsWorkflowService.GetRequestsAsync(query, userId);
    }

    [HttpPost(nameof(GetDashboard))]
    public Task<CommonResponse<PublicationDashboardDto>> GetDashboard([FromBody] PublicationDashboardQuery? query = null)
    {
        var userId = HttpContext.User.Claims.First(f => f.Type == "UserId").Value;
        return _publicationsWorkflowService.GetDashboardAsync(userId, query);
    }

    [HttpGet(nameof(GetRequestDetails))]
    public Task<CommonResponse<PublicationRequestDetailsDto>> GetRequestDetails(int messageId)
    {
        var userId = HttpContext.User.Claims.First(f => f.Type == "UserId").Value;
        return _publicationsWorkflowService.GetRequestDetailsAsync(messageId, userId);
    }

    // Legacy compatibility endpoints for existing Publications UI
    [HttpPost(nameof(GetDocumentsList_user))]
    public Task<object> GetDocumentsList_user(int? pageNumber, int? pageSize, [FromBody] List<LegacyExpressionDto>? body)
    {
        var userId = HttpContext.User.Claims.First(f => f.Type == "UserId").Value;
        return GetLegacyDocumentsListInternalAsync(userId, false, pageNumber, pageSize, body);
    }

    [HttpPost(nameof(GetDocumentsList_admin))]
    public Task<object> GetDocumentsList_admin(int? pageNumber, int? pageSize, [FromBody] List<LegacyExpressionDto>? body)
    {
        var userId = HttpContext.User.Claims.First(f => f.Type == "UserId").Value;
        return GetLegacyDocumentsListInternalAsync(userId, true, pageNumber, pageSize, body);
    }

    [HttpPost(nameof(SaveDocument))]
    [Consumes("multipart/form-data")]
    public async Task<object> SaveDocument([FromForm] LegacySaveDocumentRequest request)
    {
        var userId = HttpContext.User.Claims.First(f => f.Type == "UserId").Value;
        var ip = HttpContext.Connection.RemoteIpAddress?.MapToIPv4().ToString() ?? "0.0.0.0";

        var createRequest = new PublicationCreateRequest
        {
            Subject = request.MINI_DOC,
            Description = request.ALL_TEXT_DOC,
            PublicationRequestTypeId = request.PUBLICATION_TYPE_ID ?? 0,
            DepartmentUnitId = request.DISTRICT_ID,
            Comment = request.REJECTREASON,
            Fields = BuildLegacyFields(request),
            files = request.Files ?? new List<IFormFile>()
        };

        var result = await _publicationsWorkflowService.CreateRequestAsync(createRequest, userId, ip);
        if (!result.IsSuccess)
        {
            return new
            {
                IsSuccess = false,
                ResponseDetails = result.Errors.Select(x => new { responseCode = x.Code, responseMessage = x.Message }).ToList(),
                Document_Number = string.Empty
            };
        }

        return new
        {
            IsSuccess = true,
            ResponseDetails = Array.Empty<object>(),
            Document_Number = result.Data?.Summary.PublicationNumber
                ?? result.Data?.Summary.MessageId.ToString()
                ?? string.Empty
        };
    }

    [HttpPost(nameof(EditDocument))]
    [Consumes("multipart/form-data")]
    public async Task<object> EditDocument([FromForm] LegacySaveDocumentRequest request)
    {
        var userId = HttpContext.User.Claims.First(f => f.Type == "UserId").Value;
        var ip = HttpContext.Connection.RemoteIpAddress?.MapToIPv4().ToString() ?? "0.0.0.0";
        if (!request.DOCUMENT_ID.HasValue || request.DOCUMENT_ID.Value <= 0)
        {
            return new
            {
                IsSuccess = false,
                ResponseDetails = new[] { new { responseCode = "400", responseMessage = "رقم الطلب غير صحيح." } },
                Document_Number = string.Empty
            };
        }

        var editRequest = new PublicationEditRequest
        {
            Subject = request.MINI_DOC,
            Description = request.ALL_TEXT_DOC,
            PublicationRequestTypeId = request.PUBLICATION_TYPE_ID,
            DepartmentUnitId = request.DISTRICT_ID,
            Comment = request.REJECTREASON,
            Fields = BuildLegacyFields(request),
            files = request.Files ?? new List<IFormFile>()
        };

        var result = await _publicationsWorkflowService.EditRequestAsync(request.DOCUMENT_ID!.Value, editRequest, userId, ip);
        if (!result.IsSuccess)
        {
            return new
            {
                IsSuccess = false,
                ResponseDetails = result.Errors.Select(x => new { responseCode = x.Code, responseMessage = x.Message }).ToList(),
                Document_Number = string.Empty
            };
        }

        return new
        {
            IsSuccess = true,
            ResponseDetails = Array.Empty<object>(),
            Document_Number = result.Data?.Summary.PublicationNumber
                ?? result.Data?.Summary.MessageId.ToString()
                ?? string.Empty
        };
    }

    [HttpGet(nameof(GetFileContent))]
    public async Task<object> GetFileContent(int attchmentId)
    {
        var content = await _publicationsWorkflowService.GetAttachmentContentBase64Async(attchmentId);
        if (string.IsNullOrWhiteSpace(content))
        {
            return new
            {
                IsSuccess = false,
                ResponseDetails = new[] { new { responseCode = "404", responseMessage = "المرفق غير موجود." } },
                FILE_CONTENT = string.Empty
            };
        }

        return new
        {
            IsSuccess = true,
            ResponseDetails = Array.Empty<object>(),
            FILE_CONTENT = content
        };
    }

    [HttpPost(nameof(EditActivation))]
    public async Task<object> EditActivation([FromBody] LegacyEditActiveRequest request)
    {
        var userId = HttpContext.User.Claims.First(f => f.Type == "UserId").Value;
        var ip = HttpContext.Connection.RemoteIpAddress?.MapToIPv4().ToString() ?? "0.0.0.0";
        if (request.DOCUMENT_ID <= 0)
        {
            return new
            {
                IsSuccess = false,
                ResponseDetails = new[] { new { responseCode = "400", responseMessage = "رقم الطلب غير صحيح." } },
                Document_Number = string.Empty
            };
        }

        CommonResponse<PublicationRequestDetailsDto> result;
        if (string.Equals(request.Val, "1", StringComparison.OrdinalIgnoreCase))
        {
            result = await _publicationsWorkflowService.ApproveAsync(request.DOCUMENT_ID, new PublicationApproveRequest
            {
                Comment = "تم تفعيل الطلب"
            }, userId, ip);
        }
        else
        {
            result = await _publicationsWorkflowService.RejectAsync(request.DOCUMENT_ID, new PublicationActionRequest
            {
                Comment = "تم إلغاء التفعيل"
            }, userId, ip);
        }

        if (!result.IsSuccess)
        {
            return new
            {
                IsSuccess = false,
                ResponseDetails = result.Errors.Select(x => new { responseCode = x.Code, responseMessage = x.Message }).ToList(),
                Document_Number = string.Empty
            };
        }

        return new
        {
            IsSuccess = true,
            ResponseDetails = Array.Empty<object>(),
            Document_Number = result.Data?.Summary.PublicationNumber
                ?? result.Data?.Summary.MessageId.ToString()
                ?? string.Empty
        };
    }

    [HttpGet(nameof(GetPublicationTypeList))]
    public async Task<object> GetPublicationTypeList(int? pageNumber, int? pageSize)
    {
        var list = await _publicationsWorkflowService.GetPublicationTypeListAsync(pageNumber ?? 1, pageSize ?? 20);
        if (!list.IsSuccess)
        {
            return new
            {
                IsSuccess = false,
                Errors = list.Errors,
                Data = Array.Empty<object>(),
                TotalCount = 0,
                PageNumber = pageNumber ?? 1,
                PageSize = pageSize ?? 20
            };
        }

        var data = (list.Data ?? Enumerable.Empty<PublicationRequestTypeDto>())
            .Select(x => (object)new
            {
                PublicationTypeId = x.PublicationRequestTypeId,
                PublicationTypeNameAr = x.NameAr,
                PublicationTypeEng = x.NameEn
            })
            .ToList();

        return new
        {
            IsSuccess = true,
            Errors = Array.Empty<object>(),
            Data = data,
            TotalCount = list.TotalCount,
            PageNumber = list.PageNumber,
            PageSize = list.PageSize
        };
    }

    [HttpPost(nameof(SavePublicationType))]
    public async Task<object> SavePublicationType([FromBody] LegacyPublicationTypeRequest request)
    {
        var result = await _publicationsWorkflowService.SavePublicationTypeAsync(request.NameAr, request.NameEng);
        if (!result.IsSuccess)
        {
            return new
            {
                IsSuccess = false,
                ResponseDetails = result.Errors.Select(x => new { responseCode = x.Code, responseMessage = x.Message }).ToList()
            };
        }

        return new
        {
            IsSuccess = true,
            ResponseDetails = new[] { new { responseCode = 200, responseMessage = "تم حفظ نوع الطلب بنجاح." } }
        };
    }

    [HttpPost(nameof(SaveDistrict))]
    public object SaveDistrict([FromBody] LegacyDistrictRequest request)
    {
        return new
        {
            IsSuccess = true,
            ResponseDetails = new[] { new { responseCode = 200, responseMessage = "تم استلام البيانات." } }
        };
    }

    private async Task<object> GetLegacyDocumentsListInternalAsync(
        string userId,
        bool adminView,
        int? pageNumber,
        int? pageSize,
        List<LegacyExpressionDto>? expressions)
    {
        var query = new PublicationRequestsQuery
        {
            PageNumber = pageNumber.GetValueOrDefault(1) <= 0 ? 1 : pageNumber.GetValueOrDefault(1),
            PageSize = pageSize.GetValueOrDefault(20) <= 0 ? 20 : pageSize.GetValueOrDefault(20),
            AdminView = adminView,
            IncludeDynamicFields = false
        };

        var firstExpression = expressions?.FirstOrDefault();
        if (firstExpression != null && !string.IsNullOrWhiteSpace(firstExpression.PropertyName))
        {
            var key = firstExpression.PropertyName.Trim();
            var hasString = !string.IsNullOrWhiteSpace(firstExpression.PropertyStringValue);
            var hasInt = firstExpression.PropertyIntValue.HasValue && firstExpression.PropertyIntValue.Value > 0;

            if (string.Equals(key, "PUBLICATION_TYPE_ID", StringComparison.OrdinalIgnoreCase) && hasInt)
            {
                query.PublicationRequestTypeId = firstExpression.PropertyIntValue;
            }
            else if (string.Equals(key, "DISTRICT_ID", StringComparison.OrdinalIgnoreCase) && hasInt)
            {
                query.DepartmentUnitId = firstExpression.PropertyIntValue;
            }
            else if (string.Equals(key, "VAL", StringComparison.OrdinalIgnoreCase))
            {
                query.WorkflowStatus = hasString && firstExpression.PropertyStringValue == "1"
                    ? PublicationWorkflowStatuses.Approved
                    : PublicationWorkflowStatuses.Rejected;
            }
            else
            {
                query.SearchField = key;
                query.SearchText = hasString
                    ? firstExpression.PropertyStringValue
                    : hasInt
                        ? firstExpression.PropertyIntValue!.Value.ToString()
                        : string.Empty;
                query.SearchType = "Contains";
            }
        }

        var result = await _publicationsWorkflowService.GetRequestsAsync(query, userId);
        if (!result.IsSuccess)
        {
            return new
            {
                IsSuccess = false,
                ResponseDetails = result.Errors.Select(x => new { responseCode = x.Code, responseMessage = x.Message }).ToList(),
                TotalCount = 0,
                Data = Array.Empty<object>()
            };
        }

        var mapped = (result.Data ?? Array.Empty<PublicationRequestSummaryDto>())
            .Select(x => new
            {
                DocumentId = x.MessageId,
                DOCUMENT_NUMBER = x.PublicationNumber ?? x.MessageId.ToString(),
                MINI_DOC = x.Subject ?? string.Empty,
                ALL_TEXT_DOC = x.Description ?? string.Empty,
                SectorName = x.DepartmentUnitName,
                DistrictName = x.DepartmentUnitName,
                DocumentType = x.PublicationRequestTypeNameAr,
                VAL = x.WorkflowStatus == PublicationWorkflowStatuses.Approved ? "1" : "0",
                Application = "Connect",
                WORKING_START_DATE = x.CreatedAtUtc,
                DISTRICT_ID = Convert.ToInt32(x.DepartmentUnitId),
                PUBLICATION_TYPE_ID = x.PublicationRequestTypeId,
                DOCUMENT_PARENT_ID = string.Empty,
                MENUITEMID = 0,
                CREATED_DATE = x.CreatedAtUtc,
                LastModifiedDate = x.CreatedAtUtc,
                PublicationTypeName = x.PublicationRequestTypeNameAr,
                AttachmentList = new List<object>()
            })
            .ToList();

        return new
        {
            IsSuccess = true,
            ResponseDetails = Array.Empty<object>(),
            TotalCount = result.TotalCount,
            Data = mapped
        };
    }

    private static List<TkmendField> BuildLegacyFields(LegacySaveDocumentRequest request)
    {
        var fields = new List<TkmendField>();
        void AddField(string kind, string? value)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return;
            }

            fields.Add(new TkmendField
            {
                FildKind = kind,
                FildTxt = value.Trim(),
                InstanceGroupId = 1
            });
        }

        AddField("MINI_DOC", request.MINI_DOC);
        AddField("ALL_TEXT_DOC", request.ALL_TEXT_DOC);
        AddField("WORKING_START_DATE", request.WORKING_START_DATE?.ToString("yyyy-MM-dd"));
        AddField("DOCUMENT_PARENT_ID", request.DOCUMENT_PARENT_ID);
        AddField("REJECTREASON", request.REJECTREASON);
        AddField("MENUITEMID", request.MENUITEMID?.ToString());
        AddField("DISTRICT_ID", request.DISTRICT_ID?.ToString());
        AddField("PUBLICATION_TYPE_ID", request.PUBLICATION_TYPE_ID?.ToString());

        return fields;
    }
}

public class LegacyExpressionDto
{
    public string? PropertyName { get; set; }
    public string? PropertyStringValue { get; set; }
    public int? PropertyIntValue { get; set; }
    public DateTime? PropertyDateValue { get; set; }
}

public class LegacySaveDocumentRequest
{
    public int? DOCUMENT_ID { get; set; }
    public DateTime? WORKING_START_DATE { get; set; }
    public string? MINI_DOC { get; set; }
    public int? DISTRICT_ID { get; set; }
    public int? PUBLICATION_TYPE_ID { get; set; }
    public string? ALL_TEXT_DOC { get; set; }
    public int? MENUITEMID { get; set; }
    public string? DOCUMENT_PARENT_ID { get; set; }
    public string? REJECTREASON { get; set; }
    public List<string>? attachmentLists { get; set; }
    public List<IFormFile>? Files { get; set; }
}

public class LegacyEditActiveRequest
{
    public int DOCUMENT_ID { get; set; }
    public string? Val { get; set; }
}

public class LegacyPublicationTypeRequest
{
    public string? NameAr { get; set; }
    public string? NameEng { get; set; }
}

public class LegacyDistrictRequest
{
    public string? NameAr { get; set; }
    public string? NameEng { get; set; }
    public int? SECTOR_ID { get; set; }
}
