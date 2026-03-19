using System;
using System.Collections.Generic;

namespace Models.Correspondance;

public partial class Reply
{
    public int ReplyId { get; set; }

    public int MessageId { get; set; }

    public string Message { get; set; } = null!;

    public string AuthorId { get; set; } = null!;

    public string? NextResponsibleSectorId { get; set; }

    public DateTime CreatedDate { get; set; }

    public string Ip { get; set; } = null!;
}
