using Models;
using Models.GPA;
using Models.Correspondance;
using Models.DTO.Correspondance;
using Models.DTO.Correspondance.Enums;
using Models.DTO.Common;
using Models.DTO.Correspondance.AdminCertificates;

namespace Repositories
{
    public interface IAdministrativeCertificateRepository
    {

        public Task<CommonResponse<MessageDto>> UpdateStatus(int messageId, MessageStatus msgStatus, string userId, string ip);
        public Task<CommonResponse<IEnumerable<MessageDto>>> GetAllRequestsAsync(string userId, ListRequestModel RequestModel);
        public Task<CommonResponse<IEnumerable<MessageDto>>> SearshAsync(ListRequestModel RequestModel, string userId);
        public Task<CommonResponse<IEnumerable<TkmendField>>> CreateNewFileds(List<TkmendField> fields, string userId, string ip);
        public Task<CommonResponse<MessageDto>> CompleteRequestAsync(CompleteRequestDto completeRequest, string userId, string ip);
        public Task<CommonResponse<IEnumerable<TkmendField>>> EditFieldsAsync(List<TkmendField> fields, string userId, string ip);
        public Task<CommonResponse<IEnumerable<AdmCertDeptDto>>> GetAreaDepartments(string areaName);
        public Task<CommonResponse<string>> CreateRequestTokenAsync(
            int messageId,
            string? createdBy = null,
            string? tokenPurpose = null,
            int? expireHours = 24,
            bool isOneTimeUse = false,
            string? subjectUserId = null);
        public Task<CommonResponse<MessageDto>> GetRequestByTokenAsync(string token, string? currentUserId = null, bool consumeOneTime = false);

    }
}

