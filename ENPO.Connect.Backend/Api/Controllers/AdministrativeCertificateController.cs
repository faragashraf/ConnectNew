using Core;
using Microsoft.AspNetCore.Mvc;
using Models.Correspondance;
using Models.DTO.Correspondance;
using Models.DTO.Correspondance.Enums;
using Models.DTO.Common;
using Models.DTO.Correspondance.AdminCertificates;

namespace Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]

    public class AdministrativeCertificateController : ControllerBase
    {
        private readonly IUnitOfWork _unitOfWork;
        public AdministrativeCertificateController(IUnitOfWork unitOfWork)
        {
            _unitOfWork = unitOfWork;
        }

        [HttpPost]
        [Route(nameof(CreateRequestToken))]
        public async Task<CommonResponse<string>> CreateRequestToken([FromBody] int messageId)
        {
            // create a short-lived token that maps to a messageId
            return await _unitOfWork.administrativeCertificateRepository.CreateRequestTokenAsync(messageId);
        }

        [HttpGet]
        [Route(nameof(GetRequestByToken))]
        public async Task<CommonResponse<MessageDto>> GetRequestByToken(string token)
        {
            return await _unitOfWork.administrativeCertificateRepository.GetRequestByTokenAsync(token);
        }

        [HttpPost]
        [Route(nameof(GetAllRequests))]
        public Task<CommonResponse<IEnumerable<MessageDto>>> GetAllRequests(ListRequestModel RequestModel)
        {
            string userId = HttpContext.User.Claims.First(f => f.Type == "UserId").Value;
            //string userEmail = HttpContext.User.Claims.First(f => f.Type == "UserEmail").Value;
            return _unitOfWork.administrativeCertificateRepository.GetAllRequestsAsync(userId, RequestModel);
        }

        [HttpPost]
        [Route(nameof(SearshAsync))]
        public Task<CommonResponse<IEnumerable<MessageDto>>> SearshAsync(ListRequestModel RequestModel)
        {
            string userId = HttpContext.User.Claims.First(f => f.Type == "UserId").Value;
            return _unitOfWork.administrativeCertificateRepository.SearshAsync(RequestModel,userId);
        }

        [HttpPost]
        [Route(nameof(CreateNewFileds))]
        public Task<CommonResponse<IEnumerable<TkmendField>>> CreateNewFileds(List<TkmendField> fields)
        {
            string userId = HttpContext.User.Claims.First(f => f.Type == "UserId").Value;
            var userIp = HttpContext.Connection.RemoteIpAddress?.MapToIPv4().ToString() ?? "Unknown";
            return _unitOfWork.administrativeCertificateRepository.CreateNewFileds(fields, userId, userIp);
        }

        [HttpPost]
        [Route(nameof(CompleteRequest))]
        [Consumes("multipart/form-data")]
        public Task<CommonResponse<MessageDto>> CompleteRequest([FromForm] CompleteRequestDto completeRequest)
        {
            string userId = HttpContext.User.Claims.First(f => f.Type == "UserId").Value;
            var userIp = HttpContext.Connection.RemoteIpAddress?.MapToIPv4().ToString() ?? "Unknown";
            return _unitOfWork.administrativeCertificateRepository.CompleteRequestAsync(completeRequest, userId, userIp);
        }

        [HttpPost]
        [Route(nameof(EditFieldsAsync))]
        public async Task<CommonResponse<IEnumerable<TkmendField>>> EditFieldsAsync(List<TkmendField> fields)
        {
            string userId = HttpContext.User.Claims.First(f => f.Type == "UserId").Value;
            var userIp = HttpContext.Connection.RemoteIpAddress?.MapToIPv4().ToString() ?? "Unknown";
            return await _unitOfWork.administrativeCertificateRepository.EditFieldsAsync(fields, userId, userIp);
        }

        [HttpGet]
        [Route(nameof(UpdateStatus))]
        public Task<CommonResponse<MessageDto>> UpdateStatus(int messageId, MessageStatus msgStatus)
        {
            string userId = HttpContext.User.Claims.First(f => f.Type == "UserId").Value;
            var userIp = HttpContext.Connection.RemoteIpAddress?.MapToIPv4().ToString() ?? "Unknown";
            return _unitOfWork.administrativeCertificateRepository.UpdateStatus(messageId, msgStatus, userId, userIp);
        }

        [HttpGet]
        [Route(nameof(GetAreaDepartments))]
        public async Task<CommonResponse<IEnumerable<AdmCertDeptDto>>> GetAreaDepartments(string areaName)
        {
            return await _unitOfWork.administrativeCertificateRepository.GetAreaDepartments(areaName);
        }
    }
}
