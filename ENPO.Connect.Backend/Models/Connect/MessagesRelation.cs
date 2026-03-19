using System;
using System.Collections.Generic;

namespace Models.Correspondance;

public partial class MessagesRelation
{
    public int Id { get; set; }

    public int MessageId { get; set; }

    public int? RelatedMessageId { get; set; }

    public string? RelationType { get; set; }
}
