
using Microsoft.AspNetCore.Http;
using Models.DTO;
using Models.DTO.Common;

namespace Repositories
{
    public interface IAttachMentsRepositories
    {
        public Task<CommonResponse<IEnumerable<AttchShipmentDto>>> getShipmentAttachment(List<int> ids);
        public Task<CommonResponse<string>> papperRecieve(string id, IFormFile file, string usr, string ip);
        public Task<CommonResponse<byte[]>> DownloadDocument(int id);
    }
}
