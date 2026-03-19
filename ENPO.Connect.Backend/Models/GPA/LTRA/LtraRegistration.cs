using System;
using System.Collections.Generic;

namespace Models.GPA.LTRA;

public partial class LtraRegistration
{
    public string? AreaAName { get; set; }

    public string? OfficeAName { get; set; }

    public string TransId { get; set; } = null!;

    public string Barcode { get; set; } 

    public string? RlttBarcode { get; set; } = null!;

    public string TransDate { get; set; } = null!;

    public string? ServiceId { get; set; }

    public string? RequireOperationCard { get; set; }

    public string? RequireTrafficLetter { get; set; }

    public string CommercialRegistration { get; set; } = null!;

    public string? IdentifierNumber { get; set; }

    public string? ResponsibleManager { get; set; }

    public string? PhoneNumber { get; set; }

    public string? CompanyName { get; set; }

    public string? TaxCard { get; set; }

    public string? CompanyAddress { get; set; }

    public decimal? LicenseDuration { get; set; }

    public decimal? NumberOfVehicles { get; set; }

    public string? TrafficUnitId { get; set; }

    public string? PlateNumber { get; set; }

    public string? PlateNumberLtra { get; set; }

    public string? YearOfManufacture { get; set; }

    public string? PlateType { get; set; }

    public string? VehicleBrand { get; set; }

    public string? ChassisNumber { get; set; }

    public string? EngineNumber { get; set; }

    public string? GovernorateId { get; set; }

    public string? ModelBody { get; set; }

    public string? NumberOfSeats { get; set; }

    public string ReplyDate { get; set; } = null!;

    public string? ReplyActivityTypeCar { get; set; }

    public string ReplyStatus { get; set; } = null!;

    public decimal? ReplyCollectionAmount { get; set; }

    public string? ReplyLicenseFrom { get; set; }

    public string? ReplyLicenseTo { get; set; }

    public string? ReplyActivityType { get; set; } = null!;

    public string? LicensesNum { get; set; }

    public decimal? ReplyRequestFees { get; set; }

    public string? ReplyRequestStatus { get; set; }

    public string? ReplySubject { get; set; }

    public string? Ispay { get; set; }

    public bool? IsPrint { get; set; }

    public DateTime? CreatedAt { get; set; }

    public string? CreatedBy { get; set; }

    public string? ClientIp { get; set; }
}
