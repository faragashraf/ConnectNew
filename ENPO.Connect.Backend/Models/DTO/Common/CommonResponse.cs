using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Models.DTO.Common
{
    public class CommonResponse<T>
    {
        public CommonResponse()
        {
            Errors = new List<Error>();

        }
        public bool IsSuccess { get => Errors.Count == 0; }
        public IList<Error> Errors { get; set; }
        public T? Data { get; set; }
        public int TotalCount { get; set; } = 0;
        public int PageNumber { get; set; } = 0;
        public int PageSize { get; set; } = 0;
        public int TotalPages => PageSize <= 0
            ? 0
            : (int)Math.Ceiling((double)TotalCount / PageSize);

    }
}
