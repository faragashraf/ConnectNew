using System;
using System.Collections.Generic;

namespace Models.GPA;

public partial class Office
{
    public string OfficeId { get; set; } = null!;

    public string? EmirateId { get; set; }

    public string AreaId { get; set; } = null!;

    public string? OfficeAName { get; set; }

    public string? OfficeEName { get; set; }

    public string? OfficeType { get; set; }

    public string? OfficeDispFlag { get; set; }

    public string? OfficeHeadFlag { get; set; }

    public string? OfficeChaId { get; set; }

    public string? ComputeriedOfficeFlag { get; set; }

    public string? EmHeadOfficeFlag { get; set; }

    public string? MainOfficeId { get; set; }

    public long? LocationCounter { get; set; }

    public long? LocationCounterCas { get; set; }

    public long? LocationCounterLarg { get; set; }

    public long? LocationCounterLoc { get; set; }

    public long? LocationCounterCasLoc { get; set; }

    public long? LocationCounterLargLoc { get; set; }

    public string? ParcelAdviceStatus { get; set; }

    public DateTime? LastModifiedDate { get; set; }

    public string? DeliveryCounterLoc { get; set; }

    public string? OfficeInterDispFlag { get; set; }

    public string? MainAccountId { get; set; }

    public string? BoxesAvailFlag { get; set; }

    public int? CreditorAccountNumber { get; set; }

    public DateTime? OfficeStartAutoDate { get; set; }

    public string? CustomsOfficeId { get; set; }

    public string? DbName { get; set; }

    public int? DefaultBoxId { get; set; }

    public long? LocationCounterLab { get; set; }

    public long? OnlinePaymentCounter { get; set; }

    public long? LocationCounterEid { get; set; }

    public string? ItemDestnOffice { get; set; }

    public long? LocationCounterEidEms { get; set; }

    public string? HoId { get; set; }

    public string? BarcodeUnitId { get; set; }

    public string? DetailedAddress { get; set; }

    public string? Centerordistrict { get; set; }
}
