using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Persistence.Data;

namespace Persistence.Migrations
{
    [DbContext(typeof(ConnectContext))]
    [Migration("20260330_AddSummerPricingCatalogSeed")]
    public partial class AddSummerPricingCatalogSeed : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DECLARE @AppId NVARCHAR(10) = N'SUM2026DYN';
DECLARE @PricingFieldKey NVARCHAR(60) = N'SUM2026_PricingCatalog';
DECLARE @PricingLabel NVARCHAR(100) = N'إعدادات تسعير المصايف 2026';

DECLARE @PricingCatalog NVARCHAR(MAX) = N'{
  ""seasonYear"": 2026,
  ""pricingRecords"": [
    {
      ""pricingConfigId"": ""SUM2026-MATROUH-JUN-SEP"",
      ""categoryId"": 147,
      ""seasonYear"": 2026,
      ""periodKey"": ""JUN_SEP"",
      ""accommodationPricePerPerson"": 696,
      ""transportationPricePerPerson"": 600,
      ""pricingMode"": ""AccommodationAndTransportationOptional"",
      ""transportationMandatory"": false,
      ""isActive"": true,
      ""displayLabel"": ""مرسى مطروح يونيو/سبتمبر"",
      ""notes"": ""سعر استرشادي قابل للتعديل بعد اعتماد اللجنة""
    },
    {
      ""pricingConfigId"": ""SUM2026-MATROUH-JUL-AUG"",
      ""categoryId"": 147,
      ""seasonYear"": 2026,
      ""periodKey"": ""JUL_AUG"",
      ""accommodationPricePerPerson"": 807,
      ""transportationPricePerPerson"": 600,
      ""pricingMode"": ""AccommodationAndTransportationOptional"",
      ""transportationMandatory"": false,
      ""isActive"": true,
      ""displayLabel"": ""مرسى مطروح يوليو/أغسطس"",
      ""notes"": ""سعر استرشادي قابل للتعديل بعد اعتماد اللجنة""
    },
    {
      ""pricingConfigId"": ""SUM2026-PORTFOUAD-JUN-SEP"",
      ""categoryId"": 149,
      ""seasonYear"": 2026,
      ""periodKey"": ""JUN_SEP"",
      ""accommodationPricePerPerson"": 696,
      ""transportationPricePerPerson"": 350,
      ""pricingMode"": ""AccommodationAndTransportationOptional"",
      ""transportationMandatory"": false,
      ""isActive"": true,
      ""displayLabel"": ""بور فؤاد يونيو/سبتمبر"",
      ""notes"": ""سعر استرشادي قابل للتعديل بعد اعتماد اللجنة""
    },
    {
      ""pricingConfigId"": ""SUM2026-PORTFOUAD-JUL-AUG"",
      ""categoryId"": 149,
      ""seasonYear"": 2026,
      ""periodKey"": ""JUL_AUG"",
      ""accommodationPricePerPerson"": 807,
      ""transportationPricePerPerson"": 350,
      ""pricingMode"": ""AccommodationAndTransportationOptional"",
      ""transportationMandatory"": false,
      ""isActive"": true,
      ""displayLabel"": ""بور فؤاد يوليو/أغسطس"",
      ""notes"": ""سعر استرشادي قابل للتعديل بعد اعتماد اللجنة""
    },
    {
      ""pricingConfigId"": ""SUM2026-RASELBAR-JUN-SEP"",
      ""categoryId"": 148,
      ""seasonYear"": 2026,
      ""periodKey"": ""JUN_SEP"",
      ""accommodationPricePerPerson"": 696,
      ""transportationPricePerPerson"": 0,
      ""pricingMode"": ""TransportationMandatoryIncluded"",
      ""transportationMandatory"": true,
      ""isActive"": true,
      ""displayLabel"": ""رأس البر يونيو/سبتمبر (الانتقالات مضمنة)"",
      ""notes"": ""سعر استرشادي قابل للتعديل بعد اعتماد اللجنة""
    },
    {
      ""pricingConfigId"": ""SUM2026-RASELBAR-JUL-AUG"",
      ""categoryId"": 148,
      ""seasonYear"": 2026,
      ""periodKey"": ""JUL_AUG"",
      ""accommodationPricePerPerson"": 807,
      ""transportationPricePerPerson"": 0,
      ""pricingMode"": ""TransportationMandatoryIncluded"",
      ""transportationMandatory"": true,
      ""isActive"": true,
      ""displayLabel"": ""رأس البر يوليو/أغسطس (الانتقالات مضمنة)"",
      ""notes"": ""سعر استرشادي قابل للتعديل بعد اعتماد اللجنة""
    }
  ]
}';

IF EXISTS (SELECT 1 FROM [CDMend] WHERE [CDMendTxt] = @PricingFieldKey)
BEGIN
    UPDATE [CDMend]
       SET [CDMendType] = N'Textarea',
           [CDMendLbl] = @PricingLabel,
           [Placeholder] = N'',
           [DefaultValue] = N'',
           [CDMendTbl] = @PricingCatalog,
           [CDMendDatatype] = N'json',
           [Required] = 0,
           [RequiredTrue] = 0,
           [email] = 0,
           [Pattern] = 0,
           [MinValue] = NULL,
           [MaxValue] = NULL,
           [CDMendmask] = NULL,
           [CDMendStat] = 0,
           [Width] = 0,
           [Height] = 0,
           [IsDisabledInit] = 0,
           [IsSearchable] = 0,
           [ApplicationId] = @AppId
     WHERE [CDMendTxt] = @PricingFieldKey;
END
ELSE
BEGIN
    INSERT INTO [CDMend]
    (
        [CDMendSQL], [CDMendType], [CDMendTxt], [CDMendLbl], [Placeholder], [DefaultValue],
        [CDMendTbl], [CDMendDatatype], [Required], [RequiredTrue], [email], [Pattern],
        [MinValue], [MaxValue], [CDMendmask], [CDMendStat], [Width], [Height],
        [IsDisabledInit], [IsSearchable], [ApplicationId]
    )
    SELECT ISNULL(MAX([CDMendSQL]), 0) + 1,
           N'Textarea',
           @PricingFieldKey,
           @PricingLabel,
           N'',
           N'',
           @PricingCatalog,
           N'json',
           0, 0, 0, 0,
           NULL, NULL, NULL,
           0, 0, 0, 0, 0, @AppId
      FROM [CDMend];
END
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // no-op: seeded catalog should stay for operational continuity.
        }
    }
}
