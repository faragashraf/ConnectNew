using Models.Correspondance;
using Models.DTO.Common;
using Models.DTO.Correspondance;

namespace Repositories
{
    public interface IDynamicFormRepository
    {
        public CommonResponse<IEnumerable<CdCategoryMandDto>> GetMandatoryAll(string? appId);
        public CommonResponse<IEnumerable<CdcategoryDto>> GetAllCategories(string? appId);
        public CommonResponse<IEnumerable<CdmendDto>> GetMandatoryMetaDate(string? appId);
        public Task<CommonResponse<MessageDto>> CreateRequest(
            MessageRequest messageRequest,
            string userId,
            string UserEmail,
            string ip,
            bool hasSummerAdminPermission = false,
            bool hasSummerGeneralManagerPermission = false);
        public Task<CommonResponse<MessageDto>> GetRequestById(int messageId, string userId);

    }
}
