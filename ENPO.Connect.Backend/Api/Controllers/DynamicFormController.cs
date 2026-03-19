using Core;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Models.DTO.Common;
using Models.DTO.Correspondance;
using System.Runtime.InteropServices;

namespace Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]

    public class DynamicFormController : ControllerBase
    {
        private readonly IUnitOfWork _unitOfWork;
        public DynamicFormController(IUnitOfWork unitOfWork)
        {
            _unitOfWork = unitOfWork;
        }

        [HttpGet]
        [Route(nameof(GetMandatoryMetaDate))]
        [AllowAnonymous]
        public ActionResult<CommonResponse<IEnumerable<CdmendDto>>> GetMandatoryMetaDate([Optional]string? appId)
        {
            return _unitOfWork.dynamicFormRepository.GetMandatoryMetaDate(appId);
        }

        [HttpGet]
        [Route(nameof(GetMandatoryAll))]
        [AllowAnonymous]
        public ActionResult<CommonResponse<IEnumerable<CdCategoryMandDto>>> GetMandatoryAll([Optional] string? appId)
        {
            return _unitOfWork.dynamicFormRepository.GetMandatoryAll(appId);
        }

        [HttpGet]
        [AllowAnonymous]
        [Route(nameof(GetAllCategories))]
        public ActionResult<CommonResponse<IEnumerable<CdcategoryDto>>> GetAllCategories([Optional] string? appId)
        {
            return _unitOfWork.dynamicFormRepository.GetAllCategories(appId);
        }

        [HttpPost]
        [Route(nameof(CreateRequest))]
        [Consumes("multipart/form-data")]
        public Task<CommonResponse<MessageDto>> CreateRequest([FromForm] MessageRequest messageRequest)
        {
            string userId = HttpContext.User.Claims.First(f => f.Type == "UserId").Value;
            string UserEmail = HttpContext.User.Claims.First(f => f.Type == "UserEmail").Value;
            var ipv4 = HttpContext.Connection.RemoteIpAddress!.MapToIPv4().ToString();
            return _unitOfWork.dynamicFormRepository.CreateRequest(messageRequest, userId, UserEmail, ipv4);
        }

        [HttpGet]
        [Route(nameof(GetRequestById))]
        public Task<CommonResponse<MessageDto>> GetRequestById(int messageId)
        {
            return _unitOfWork.dynamicFormRepository.GetRequestById(messageId);
        }

    }
}
