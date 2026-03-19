using Microsoft.AspNetCore.Http;
using Models.Correspondance;

namespace Models.DTO.Correspondance.AdminCertificates
{
    public class CompleteRequestDto
    {
        public List<TkmendField> Fields { get; set; } = new List<TkmendField>();
        public List<IFormFile>? files { get; set; } = new List<IFormFile>();
    }
}
