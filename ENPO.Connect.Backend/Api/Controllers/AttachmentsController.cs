using Core;
using Microsoft.AspNetCore.Mvc;
using Models.DTO;
using Models.DTO.Common;

namespace Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]


    public class AttachmentsController : ControllerBase
    {
        private readonly IUnitOfWork _unitOfWork;
        public AttachmentsController(IUnitOfWork unitOfWork)
        {
            _unitOfWork = unitOfWork;
        }
        /// <summary>
        ///  استلام مستندات  - استلام المرفقات
        /// </summary>
        [HttpPost]
        [Route(nameof(DocumentRecieve))]
        public Task<CommonResponse<string>> DocumentRecieve(string id, IFormFile file)
        {
            string userId = HttpContext.User.Claims.First(f => f.Type == "UserId").Value;
            var ipv4 = HttpContext.Connection.RemoteIpAddress!.MapToIPv4().ToString();
            return _unitOfWork.attachMentsRepositories.papperRecieve(id, file, userId, ipv4);
        }
        /// <summary>
        ///  استلام مستندات - عرض المرفقات
        /// </summary>
        [HttpPost]
        [Route(nameof(GetShipmentAttachment))]
        public Task<CommonResponse<IEnumerable<AttchShipmentDto>>> GetShipmentAttachment(List<int> ids)
        {
            return _unitOfWork.attachMentsRepositories.getShipmentAttachment(ids);
        }

        /// <summary>
        ///  استلام مستندات - عرض المرفقات
        /// </summary>
        [HttpPost]
        [Route(nameof(DownloadDocument))]
        public Task<CommonResponse<byte[]>> DownloadDocument(int id)
        {
            return _unitOfWork.attachMentsRepositories.DownloadDocument(id);
        }
    }
}
