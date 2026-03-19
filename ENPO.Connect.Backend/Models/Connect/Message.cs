using Models.DTO.Correspondance.Enums;
using System;
using System.Collections.Generic;
using System.ComponentModel;

namespace Models.Correspondance;

public partial class Message
{

    public int MessageId { get; set; }

    public string? Subject { get; set; } = null!;

    public string? Description { get; set; } = null!;

    public MessageStatus Status { get; set; }

    public Priority Priority { get; set; }

    public string? CreatedBy { get; set; } = null!;

    public string? AssignedSectorId { get; set; } = null!;

    public string? CurrentResponsibleSectorId { get; set; } = null!;

    public DateTime CreatedDate { get; set; }

    public DateTime? DueDate { get; set; }

    public DateTime? ClosedDate { get; set; }

    public string? RequestRef { get; set; }

    public byte Type { get; set; }

    public int CategoryCd { get; set; }
    
    public DateTime? LastModifiedDate { get; set; }

}


