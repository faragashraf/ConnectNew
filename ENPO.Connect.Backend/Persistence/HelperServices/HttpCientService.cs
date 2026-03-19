using Models.DTO.Correspondance;
using Models.DTO;
using Newtonsoft.Json;

namespace Persistence.HelperServices
{
    public static class HttpCientService
    {
        const string baseUrl = "http://10.10.31.155/sso/api/DomainAuthorization";
        //private static readonly HttpClient _httpClient = new HttpClient();

        public static async Task<ApiResponse> GetEmailInfoResponse(string userEmail)
        {
            try
            {
                HttpClient _httpClient = new HttpClient();
                var response = await _httpClient.GetAsync($"{baseUrl}/IsEmailExistInExchange?targetEmail={Uri.EscapeDataString(userEmail)}");
                //response.EnsureSuccessStatusCode();

                var content = await response.Content.ReadAsStringAsync();
                return JsonConvert.DeserializeObject<ApiResponse>(content) ;
            }
            catch (HttpRequestException ex)
            {
                // Log the exception
                throw new InvalidOperationException("HTTP request failed.", ex);
            }
        }

        public static async Task<PrivateGroupsResponse> GetPrivateGroups(string userEmail)
        {
            try
            {
                HttpClient _httpClient = new HttpClient();
                var response = await _httpClient.GetAsync($"{baseUrl}/GetPrivateGroups?currentEmail={Uri.EscapeDataString(userEmail)}");
                //response.EnsureSuccessStatusCode();

                var content = await response.Content.ReadAsStringAsync();
                var contenat = content;

                var kk = JsonConvert.DeserializeObject<PrivateGroupsResponse>(content);
                return kk;
            }
            catch (JsonSerializationException ex)
            {
                // Log or handle the exception as needed
                throw new InvalidOperationException("Failed to deserialize the response into a list of strings.", ex);
            }
        }
    }
}
