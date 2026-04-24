using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Persistence.Migrations
{
    /// <inheritdoc />
    public partial class _20260424_AddSummerFixedPricingPlans : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "SummerFixedPricingPlans",
                columns: table => new
                {
                    PlanID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SeasonYear = table.Column<int>(type: "int", nullable: false),
                    CategoryID = table.Column<int>(type: "int", nullable: false),
                    PeriodKey = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    PersonsCount = table.Column<int>(type: "int", nullable: false),
                    StayMode = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    TransportationIncluded = table.Column<bool>(type: "bit", nullable: false),
                    CashAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    InsuranceAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    EmployeeTotalAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    DownPaymentAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    Installment2Amount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    Installment3Amount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    Installment4Amount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    Installment5Amount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    Installment6Amount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    Installment7Amount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false, defaultValue: true),
                    SourcePeriodLabel = table.Column<string>(type: "nvarchar(400)", maxLength: 400, nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    LastModifiedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SummerFixedPricingPlans", x => x.PlanID);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SummerFixedPricingPlans_Lookup",
                table: "SummerFixedPricingPlans",
                columns: new[] { "SeasonYear", "CategoryID", "PeriodKey", "PersonsCount", "StayMode", "IsActive" });

            migrationBuilder.CreateIndex(
                name: "UX_SummerFixedPricingPlans_UniqueRule",
                table: "SummerFixedPricingPlans",
                columns: new[] { "SeasonYear", "CategoryID", "PeriodKey", "PersonsCount", "StayMode" },
                unique: true);

            migrationBuilder.Sql(@"
;WITH SeedData
(
    [SeasonYear],
    [CategoryID],
    [PeriodKey],
    [PersonsCount],
    [StayMode],
    [TransportationIncluded],
    [CashAmount],
    [InsuranceAmount],
    [EmployeeTotalAmount],
    [DownPaymentAmount],
    [Installment2Amount],
    [Installment3Amount],
    [Installment4Amount],
    [Installment5Amount],
    [Installment6Amount],
    [Installment7Amount],
    [IsActive],
    [SourcePeriodLabel]
)
AS
(
    SELECT *
    FROM (VALUES
    (2026, 149, N'JUN_SEP', 4, N'RESIDENCE_ONLY', 0, 1800.00, 500.00, 2300.00, 500.00, 300.00, 300.00, 300.00, 300.00, 300.00, 300.00, 1, N'يونية وسبتمبر - الأفواج: الأول والثاني والثالث والثالث عشر والرابع عشر والخامس عشر والسادس عشر'),
    (2026, 149, N'JUN_SEP', 6, N'RESIDENCE_ONLY', 0, 2700.00, 500.00, 3200.00, 500.00, 450.00, 450.00, 450.00, 450.00, 450.00, 450.00, 1, N'يونية وسبتمبر - الأفواج: الأول والثاني والثالث والثالث عشر والرابع عشر والخامس عشر والسادس عشر'),
    (2026, 149, N'JUN_SEP', 7, N'RESIDENCE_ONLY', 0, 3150.00, 500.00, 3650.00, 650.00, 500.00, 500.00, 500.00, 500.00, 500.00, 500.00, 1, N'يونية وسبتمبر - الأفواج: الأول والثاني والثالث والثالث عشر والرابع عشر والخامس عشر والسادس عشر'),
    (2026, 149, N'JUN_SEP', 4, N'RESIDENCE_WITH_TRANSPORT', 1, 4600.00, 500.00, 5100.00, 900.00, 700.00, 700.00, 700.00, 700.00, 700.00, 700.00, 1, N'يونية وسبتمبر - الأفواج: الأول والثاني والثالث والثالث عشر والرابع عشر والخامس عشر والسادس عشر'),
    (2026, 149, N'JUN_SEP', 6, N'RESIDENCE_WITH_TRANSPORT', 1, 6900.00, 500.00, 7400.00, 1400.00, 1000.00, 1000.00, 1000.00, 1000.00, 1000.00, 1000.00, 1, N'يونية وسبتمبر - الأفواج: الأول والثاني والثالث والثالث عشر والرابع عشر والخامس عشر والسادس عشر'),
    (2026, 149, N'JUN_SEP', 7, N'RESIDENCE_WITH_TRANSPORT', 1, 8050.00, 500.00, 8550.00, 1650.00, 1150.00, 1150.00, 1150.00, 1150.00, 1150.00, 1150.00, 1, N'يونية وسبتمبر - الأفواج: الأول والثاني والثالث والثالث عشر والرابع عشر والخامس عشر والسادس عشر'),
    (2026, 149, N'JUL_AUG', 4, N'RESIDENCE_ONLY', 0, 2100.00, 500.00, 2600.00, 500.00, 350.00, 350.00, 350.00, 350.00, 350.00, 350.00, 1, N'يوليو وأغسطس - الأفواج: الرابع والخامس والسادس والسابع والثامن والتاسع والعاشر والحادي عشر والثاني عشر'),
    (2026, 149, N'JUL_AUG', 6, N'RESIDENCE_ONLY', 0, 3150.00, 500.00, 3650.00, 650.00, 500.00, 500.00, 500.00, 500.00, 500.00, 500.00, 1, N'يوليو وأغسطس - الأفواج: الرابع والخامس والسادس والسابع والثامن والتاسع والعاشر والحادي عشر والثاني عشر'),
    (2026, 149, N'JUL_AUG', 7, N'RESIDENCE_ONLY', 0, 3675.00, 500.00, 4175.00, 875.00, 550.00, 550.00, 550.00, 550.00, 550.00, 550.00, 1, N'يوليو وأغسطس - الأفواج: الرابع والخامس والسادس والسابع والثامن والتاسع والعاشر والحادي عشر والثاني عشر'),
    (2026, 149, N'JUL_AUG', 4, N'RESIDENCE_WITH_TRANSPORT', 1, 4900.00, 500.00, 5400.00, 1200.00, 700.00, 700.00, 700.00, 700.00, 700.00, 700.00, 1, N'يوليو وأغسطس - الأفواج: الرابع والخامس والسادس والسابع والثامن والتاسع والعاشر والحادي عشر والثاني عشر'),
    (2026, 149, N'JUL_AUG', 6, N'RESIDENCE_WITH_TRANSPORT', 1, 7350.00, 500.00, 7850.00, 1550.00, 1050.00, 1050.00, 1050.00, 1050.00, 1050.00, 1050.00, 1, N'يوليو وأغسطس - الأفواج: الرابع والخامس والسادس والسابع والثامن والتاسع والعاشر والحادي عشر والثاني عشر'),
    (2026, 149, N'JUL_AUG', 7, N'RESIDENCE_WITH_TRANSPORT', 1, 8575.00, 500.00, 9075.00, 1875.00, 1200.00, 1200.00, 1200.00, 1200.00, 1200.00, 1200.00, 1, N'يوليو وأغسطس - الأفواج: الرابع والخامس والسادس والسابع والثامن والتاسع والعاشر والحادي عشر والثاني عشر'),
    (2026, 148, N'JUN_SEP', 2, N'RESIDENCE_WITH_TRANSPORT', 1, 2600.00, 500.00, 3100.00, 550.00, 425.00, 425.00, 425.00, 425.00, 425.00, 425.00, 1, N'يونية وسبتمبر - الأفواج: الأول والثاني والثالث والثالث عشر والرابع عشر والخامس عشر والسادس عشر'),
    (2026, 148, N'JUN_SEP', 4, N'RESIDENCE_WITH_TRANSPORT', 1, 5200.00, 500.00, 5700.00, 1200.00, 750.00, 750.00, 750.00, 750.00, 750.00, 750.00, 1, N'يونية وسبتمبر - الأفواج: الأول والثاني والثالث والثالث عشر والرابع عشر والخامس عشر والسادس عشر'),
    (2026, 148, N'JUN_SEP', 6, N'RESIDENCE_WITH_TRANSPORT', 1, 7800.00, 500.00, 8300.00, 1700.00, 1100.00, 1100.00, 1100.00, 1100.00, 1100.00, 1100.00, 1, N'يونية وسبتمبر - الأفواج: الأول والثاني والثالث والثالث عشر والرابع عشر والخامس عشر والسادس عشر'),
    (2026, 148, N'JUL_AUG', 2, N'RESIDENCE_WITH_TRANSPORT', 1, 2800.00, 500.00, 3300.00, 600.00, 450.00, 450.00, 450.00, 450.00, 450.00, 450.00, 1, N'يوليو وأغسطس - الأفواج: الرابع والخامس والسادس والسابع والثامن والتاسع والعاشر والحادي عشر والثاني عشر'),
    (2026, 148, N'JUL_AUG', 4, N'RESIDENCE_WITH_TRANSPORT', 1, 5600.00, 500.00, 6100.00, 1150.00, 825.00, 825.00, 825.00, 825.00, 825.00, 825.00, 1, N'يوليو وأغسطس - الأفواج: الرابع والخامس والسادس والسابع والثامن والتاسع والعاشر والحادي عشر والثاني عشر'),
    (2026, 148, N'JUL_AUG', 6, N'RESIDENCE_WITH_TRANSPORT', 1, 8400.00, 500.00, 8900.00, 1850.00, 1175.00, 1175.00, 1175.00, 1175.00, 1175.00, 1175.00, 1, N'يوليو وأغسطس - الأفواج: الرابع والخامس والسادس والسابع والثامن والتاسع والعاشر والحادي عشر والثاني عشر'),
    (2026, 147, N'JUN_SEP', 5, N'RESIDENCE_ONLY', 0, 3125.00, 500.00, 3625.00, 775.00, 475.00, 475.00, 475.00, 475.00, 475.00, 475.00, 1, N'يونية وسبتمبر - الأفواج: الأول والثاني والثالث والرابع والرابع عشر والخامس عشر والسادس عشر'),
    (2026, 147, N'JUN_SEP', 6, N'RESIDENCE_ONLY', 0, 3750.00, 500.00, 4250.00, 800.00, 575.00, 575.00, 575.00, 575.00, 575.00, 575.00, 1, N'يونية وسبتمبر - الأفواج: الأول والثاني والثالث والرابع والرابع عشر والخامس عشر والسادس عشر'),
    (2026, 147, N'JUN_SEP', 8, N'RESIDENCE_ONLY', 0, 5000.00, 500.00, 5500.00, 1150.00, 725.00, 725.00, 725.00, 725.00, 725.00, 725.00, 1, N'يونية وسبتمبر - الأفواج: الأول والثاني والثالث والرابع والرابع عشر والخامس عشر والسادس عشر'),
    (2026, 147, N'JUN_SEP', 9, N'RESIDENCE_ONLY', 0, 5625.00, 500.00, 6125.00, 1175.00, 825.00, 825.00, 825.00, 825.00, 825.00, 825.00, 1, N'يونية وسبتمبر - الأفواج: الأول والثاني والثالث والرابع والرابع عشر والخامس عشر والسادس عشر'),
    (2026, 147, N'JUN_SEP', 5, N'RESIDENCE_WITH_TRANSPORT', 1, 8875.00, 500.00, 9375.00, 1875.00, 1250.00, 1250.00, 1250.00, 1250.00, 1250.00, 1250.00, 1, N'يونية وسبتمبر - الأفواج: الأول والثاني والثالث والرابع والرابع عشر والخامس عشر والسادس عشر'),
    (2026, 147, N'JUN_SEP', 6, N'RESIDENCE_WITH_TRANSPORT', 1, 10650.00, 500.00, 11150.00, 2300.00, 1475.00, 1475.00, 1475.00, 1475.00, 1475.00, 1475.00, 1, N'يونية وسبتمبر - الأفواج: الأول والثاني والثالث والرابع والرابع عشر والخامس عشر والسادس عشر'),
    (2026, 147, N'JUN_SEP', 8, N'RESIDENCE_WITH_TRANSPORT', 1, 14200.00, 500.00, 14700.00, 3000.00, 1950.00, 1950.00, 1950.00, 1950.00, 1950.00, 1950.00, 1, N'يونية وسبتمبر - الأفواج: الأول والثاني والثالث والرابع والرابع عشر والخامس عشر والسادس عشر'),
    (2026, 147, N'JUN_SEP', 9, N'RESIDENCE_WITH_TRANSPORT', 1, 15975.00, 500.00, 16475.00, 3275.00, 2200.00, 2200.00, 2200.00, 2200.00, 2200.00, 2200.00, 1, N'يونية وسبتمبر - الأفواج: الأول والثاني والثالث والرابع والرابع عشر والخامس عشر والسادس عشر'),
    (2026, 147, N'JUL_AUG', 5, N'RESIDENCE_ONLY', 0, 3500.00, 500.00, 4000.00, 850.00, 525.00, 525.00, 525.00, 525.00, 525.00, 525.00, 1, N'يوليو وأغسطس - الأفواج: الخامس والسادس والسابع والثامن والتاسع والعاشر والحادي عشر والثاني عشر والثالث عشر'),
    (2026, 147, N'JUL_AUG', 6, N'RESIDENCE_ONLY', 0, 4200.00, 500.00, 4700.00, 950.00, 625.00, 625.00, 625.00, 625.00, 625.00, 625.00, 1, N'يوليو وأغسطس - الأفواج: الخامس والسادس والسابع والثامن والتاسع والعاشر والحادي عشر والثاني عشر والثالث عشر'),
    (2026, 147, N'JUL_AUG', 8, N'RESIDENCE_ONLY', 0, 5600.00, 500.00, 6100.00, 1150.00, 825.00, 825.00, 825.00, 825.00, 825.00, 825.00, 1, N'يوليو وأغسطس - الأفواج: الخامس والسادس والسابع والثامن والتاسع والعاشر والحادي عشر والثاني عشر والثالث عشر'),
    (2026, 147, N'JUL_AUG', 9, N'RESIDENCE_ONLY', 0, 6300.00, 500.00, 6800.00, 1400.00, 900.00, 900.00, 900.00, 900.00, 900.00, 900.00, 1, N'يوليو وأغسطس - الأفواج: الخامس والسادس والسابع والثامن والتاسع والعاشر والحادي عشر والثاني عشر والثالث عشر'),
    (2026, 147, N'JUL_AUG', 5, N'RESIDENCE_WITH_TRANSPORT', 1, 9250.00, 500.00, 9750.00, 1950.00, 1300.00, 1300.00, 1300.00, 1300.00, 1300.00, 1300.00, 1, N'يوليو وأغسطس - الأفواج: الخامس والسادس والسابع والثامن والتاسع والعاشر والحادي عشر والثاني عشر والثالث عشر'),
    (2026, 147, N'JUL_AUG', 6, N'RESIDENCE_WITH_TRANSPORT', 1, 11100.00, 500.00, 11600.00, 2300.00, 1550.00, 1550.00, 1550.00, 1550.00, 1550.00, 1550.00, 1, N'يوليو وأغسطس - الأفواج: الخامس والسادس والسابع والثامن والتاسع والعاشر والحادي عشر والثاني عشر والثالث عشر'),
    (2026, 147, N'JUL_AUG', 8, N'RESIDENCE_WITH_TRANSPORT', 1, 14800.00, 500.00, 15300.00, 3000.00, 2050.00, 2050.00, 2050.00, 2050.00, 2050.00, 2050.00, 1, N'يوليو وأغسطس - الأفواج: الخامس والسادس والسابع والثامن والتاسع والعاشر والحادي عشر والثاني عشر والثالث عشر'),
    (2026, 147, N'JUL_AUG', 9, N'RESIDENCE_WITH_TRANSPORT', 1, 16650.00, 500.00, 17150.00, 3500.00, 2275.00, 2275.00, 2275.00, 2275.00, 2275.00, 2275.00, 1, N'يوليو وأغسطس - الأفواج: الخامس والسادس والسابع والثامن والتاسع والعاشر والحادي عشر والثاني عشر والثالث عشر')
    ) AS V
    (
        [SeasonYear],
        [CategoryID],
        [PeriodKey],
        [PersonsCount],
        [StayMode],
        [TransportationIncluded],
        [CashAmount],
        [InsuranceAmount],
        [EmployeeTotalAmount],
        [DownPaymentAmount],
        [Installment2Amount],
        [Installment3Amount],
        [Installment4Amount],
        [Installment5Amount],
        [Installment6Amount],
        [Installment7Amount],
        [IsActive],
        [SourcePeriodLabel]
    )
)
INSERT INTO [SummerFixedPricingPlans]
(
    [SeasonYear],
    [CategoryID],
    [PeriodKey],
    [PersonsCount],
    [StayMode],
    [TransportationIncluded],
    [CashAmount],
    [InsuranceAmount],
    [EmployeeTotalAmount],
    [DownPaymentAmount],
    [Installment2Amount],
    [Installment3Amount],
    [Installment4Amount],
    [Installment5Amount],
    [Installment6Amount],
    [Installment7Amount],
    [IsActive],
    [SourcePeriodLabel]
)
SELECT
    S.[SeasonYear],
    S.[CategoryID],
    S.[PeriodKey],
    S.[PersonsCount],
    S.[StayMode],
    S.[TransportationIncluded],
    S.[CashAmount],
    S.[InsuranceAmount],
    S.[EmployeeTotalAmount],
    S.[DownPaymentAmount],
    S.[Installment2Amount],
    S.[Installment3Amount],
    S.[Installment4Amount],
    S.[Installment5Amount],
    S.[Installment6Amount],
    S.[Installment7Amount],
    S.[IsActive],
    S.[SourcePeriodLabel]
FROM SeedData S
WHERE NOT EXISTS
(
    SELECT 1
    FROM [SummerFixedPricingPlans] P
    WHERE P.[SeasonYear] = S.[SeasonYear]
      AND P.[CategoryID] = S.[CategoryID]
      AND P.[PeriodKey] = S.[PeriodKey]
      AND P.[PersonsCount] = S.[PersonsCount]
      AND P.[StayMode] = S.[StayMode]
);
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SummerFixedPricingPlans");
        }
    }
}
