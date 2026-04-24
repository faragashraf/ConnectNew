namespace Models.Correspondance;

public partial class SummerFixedPricingPlan
{
    public int PlanId { get; set; }

    public int SeasonYear { get; set; }

    public int CategoryId { get; set; }

    public string PeriodKey { get; set; } = string.Empty;

    public int PersonsCount { get; set; }

    public string StayMode { get; set; } = string.Empty;

    public bool TransportationIncluded { get; set; }

    public decimal CashAmount { get; set; }

    public decimal InsuranceAmount { get; set; }

    public decimal EmployeeTotalAmount { get; set; }

    public decimal DownPaymentAmount { get; set; }

    public decimal Installment2Amount { get; set; }

    public decimal Installment3Amount { get; set; }

    public decimal Installment4Amount { get; set; }

    public decimal Installment5Amount { get; set; }

    public decimal Installment6Amount { get; set; }

    public decimal Installment7Amount { get; set; }

    public bool IsActive { get; set; }

    public string? SourcePeriodLabel { get; set; }

    public DateTime CreatedAtUtc { get; set; }

    public DateTime? LastModifiedAtUtc { get; set; }
}
