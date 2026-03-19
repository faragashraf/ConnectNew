using System;
using System.Collections.Generic;

namespace Models.GPA.LTRA;

public partial class VwLtraTransTraficPrint
{
    public string TransId { get; set; } = null!;

    public string Barcode { get; set; } = null!;
    
    public string? RlttBarcode { get; set; } = null!;

    public string? PlateNumber { get; set; }

    public DateTime? TransDate { get; set; }

    public string? CompanyName { get; set; }

    public string? PlateNumberPrint { get; set; }

    public decimal? LicenseDuration { get; set; }

    public string? ReplyLicenseFrom { get; set; }

    public string? VehicleBrand { get; set; }

    public string? YearOfManufacture { get; set; }

    public string? ChassisNumber { get; set; }

    public string? EngineNumber { get; set; }

    public string? ModelBody { get; set; }

    public string? NumberOfSeats { get; set; }

    public string? LicensesNum { get; set; }

    public string? TrafficUnitId { get; set; }

    public string? GovernorateId { get; set; }

    public string? CarActivity { get; set; }

    public bool IsPrint { get; set; }
}
