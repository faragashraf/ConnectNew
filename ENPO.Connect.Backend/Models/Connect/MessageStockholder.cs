using System;
using System.Collections.Generic;

namespace Models.Correspondance;

public partial class MessageStockholder
{
    public int MessageStockholderId { get; set; }

    public int? MessageId { get; set; }

    public int? StockholderId { get; set; }

    public string? PartyType { get; set; }

    public DateTime? SendDate { get; set; }

    public DateTime? ReceivedDate { get; set; }

    public string? StockholderNotes { get; set; }

    public bool? RequiredResponse { get; set; }

    public byte? Status { get; set; }

    public DateTime? DueDate { get; set; }

    public DateTime? RepliedDate { get; set; }

    public DateTime? CreatedDate { get; set; }

    public DateTime? LastModifiedDate { get; set; }
}
