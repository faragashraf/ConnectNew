using Core;
using Microsoft.AspNetCore.Mvc;
using Models.DTO.Common;
using Models.GPA.LTRA;

namespace Api.Controllers
{
    [Route("api/[controller]")]
    [ApiController]

    public class LandTransportController : ControllerBase
    {
        private readonly IUnitOfWork _unitOfWork;
        public LandTransportController(IUnitOfWork unitOfWork)
        {
            _unitOfWork = unitOfWork;
        }

        [HttpGet]
        [Route(nameof(GetTransportationRequestsToPrint))]
        public ActionResult<CommonResponse<IEnumerable<VwLtraTransTraficPrint>>> GetTransportationRequestsToPrint(int pageNumber, int pageSize)
        {
            string userId = HttpContext.User.Claims.First(f => f.Type == "UserId").Value;
            //var userIp = HttpContext.Connection.RemoteIpAddress?.MapToIPv4().ToString() ?? "Unknown";

            return  _unitOfWork.landTransport.GetTransportationRequestsToPrint(pageNumber, pageSize);
        }

        [HttpGet]
        [Route(nameof(UpdateRequestToPrintStatus))]
        public CommonResponse<string> UpdateRequestToPrintStatus(string barcode, string plateNumber)
        {
            string userId = HttpContext.User.Claims.First(f => f.Type == "UserId").Value;
            return  _unitOfWork.landTransport.UpdateRequestToPrintStatus(barcode, plateNumber, userId);
        }

        [HttpGet]
        [Route(nameof(GetLLTR_request))]
        public CommonResponse<List<VwLtraTransTraficPrint>> GetLLTR_request(string barcode)
        {
            return _unitOfWork.landTransport.GetLLTR_request(barcode);
        }

        [HttpPost]
        [Route(nameof(UploadData))]
        public async Task<ActionResult<CommonResponse<string>>> UploadData(IFormFile file)
        {
            string userId = HttpContext.User.Claims.First(f => f.Type == "UserId").Value;
            var userIp = HttpContext.Connection.RemoteIpAddress?.MapToIPv4().ToString() ?? "Unknown";
            return await _unitOfWork.landTransport.UploadData(file, "userId", userIp);
        }
    }
}
