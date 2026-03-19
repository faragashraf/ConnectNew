using Models.DTO.Common;
using Newtonsoft.Json;

namespace Models.DTO
{


    public class ApiResponse
    {
        [JsonProperty("isSuccess")]
        public bool IsSuccess { get; set; }

        [JsonProperty("errors")]
        public List<Error> Errors { get; set; } = new List<Error>();

        [JsonProperty("data")]
        public Data Data { get; set; }

        [JsonProperty("totalCount")]
        public int TotalCount { get; set; }

        [JsonProperty("pageNumber")]
        public int PageNumber { get; set; }

        [JsonProperty("pageSize")]
        public int PageSize { get; set; }

        [JsonProperty("totalPages")]
        public int TotalPages { get; set; }
    }

    public class Data
    {
        [JsonProperty("userEmail")]
        public string UserEmail { get; set; }

        [JsonProperty("userDisplayName")]
        public string UserDisplayName { get; set; }

        [JsonProperty("userTitle")]
        public string UserTitle { get; set; }

        [JsonProperty("mobilePhone")]
        public string MobilePhone { get; set; }

        [JsonProperty("userPicture")]
        public string UserPicture { get; set; } // Base64 encoded image

        [JsonProperty("registrationStatus")]
        public bool RegistrationStatus { get; set; }

        [JsonProperty("userId")]
        public string UserId { get; set; }

        [JsonProperty("isGroup")]
        public bool IsGroup { get; set; }

        [JsonProperty("groupMembers")]
        public List<object> GroupMembers { get; set; } = new List<object>();

        [JsonProperty("userGroups")]
        public List<string> UserGroups { get; set; } = new List<string>();

        [JsonIgnore]
        public List<string> SplitUserGroups =>
       UserGroups.Select(g => g.Split('@')[0]).ToList();
    }
    [JsonArray]
    public class PrivateGroupsResponse : List<string>
    {
    }
}
