using Microsoft.AspNetCore.Http;
using Models.DTO.Common;
using Models.GPA.LTRA;

namespace Persistence.UnitOfWorks
{
    public interface ILandTransport
    {
        public CommonResponse<IEnumerable<VwLtraTransTraficPrint>> GetTransportationRequestsToPrint(int pageNumber, int pageSize);
        public CommonResponse<string> UpdateRequestToPrintStatus(string barcode, string plateNumber, string userId);
        public CommonResponse<List<VwLtraTransTraficPrint>> GetLLTR_request(string barcode);
        public Task<CommonResponse<string>> UploadData(IFormFile file, string userId,string ip);
    }
}