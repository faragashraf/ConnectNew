using Models.DTO.Correspondance.AdminCertificates;
using Models.DTO.Correspondance.Enums;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Models.DTO.Correspondance
{
    public class ListRequestModel
    {
        public int pageNumber { get; set; }
        public int pageSize { get; set; }
        public int Status { get; set; }
        public int CategoryCd { get; set; }
        public byte Type { get; set; }
        public RequestedData? requestedData { get; set; }
        public Search? Search { get; set; }
    }
    public enum RequestedData
    {
        MyRequest = 0,
        Inbox = 1,
        Outbox = 2,
        Global = 3,
    }
    public enum SearchKind
    {
        NoSearch = 0,
        NormalSearch = 1,
        LimitedSearch = 2,
        GlobalSearch = 3,
    }
    public class Search
    {
        public bool IsSearch { get; set; } = false;
        public SearchKind SearchKind { get; set; } = SearchKind.NoSearch;
        public string searchField { get; set; } = string.Empty;
        public string searchText { get; set; } = string.Empty;
        public string searchType { get; set; } = string.Empty;
    }
}
