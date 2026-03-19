using System;
using System.Collections.Generic;

namespace Models.GPA;

public partial class PosUser
{
    public string UserId { get; set; } = null!;

    public DateTime? EffectiveDateFrom { get; set; }

    public DateTime? EffectiveDateTo { get; set; }

    public string? LastName { get; set; }

    public string? FirstName { get; set; }

    public string? PreferedLanguage { get; set; }

    public string? Password { get; set; }

    public int? Status { get; set; }

    public DateTime? CreatedOn { get; set; }

    public string? CreatedBy { get; set; }

    public DateTime? LastUpdated { get; set; }

    public string? LastUpdatedBy { get; set; }

    public bool? ResetPassword { get; set; }

    public DateTime? LastPasswordDate { get; set; }

    public DateTime? NextPasswordDate { get; set; }

    public string? LoginStatus { get; set; }

    public string? NationalId { get; set; }

    public string? ArabicName { get; set; }

    public string? MobileNumber { get; set; }

    public string? EmailAddress { get; set; }
}
