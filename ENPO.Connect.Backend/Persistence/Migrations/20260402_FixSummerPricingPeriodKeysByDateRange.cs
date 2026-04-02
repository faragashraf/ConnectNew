using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Persistence.Data;

namespace Persistence.Migrations
{
    [DbContext(typeof(ConnectContext))]
    [Migration("20260402_FixSummerPricingPeriodKeysByDateRange")]
    public partial class FixSummerPricingPeriodKeysByDateRange : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DECLARE @PricingCatalogKey NVARCHAR(60) = N'SUM2026_PricingCatalog';
DECLARE @MendSql INT;
DECLARE @Payload NVARCHAR(MAX);

DECLARE pricing_cursor CURSOR LOCAL FAST_FORWARD FOR
    SELECT [CDMendSQL], [CDMendTbl]
      FROM [CDMend]
     WHERE [CDMendTxt] = @PricingCatalogKey
       AND [CDMendStat] = 0
       AND ISNULL([CDMendTbl], N'') <> N'';

OPEN pricing_cursor;
FETCH NEXT FROM pricing_cursor INTO @MendSql, @Payload;

WHILE @@FETCH_STATUS = 0
BEGIN
    DECLARE @JsonIndex NVARCHAR(20);
    DECLARE @ExpectedPeriodKey NVARCHAR(20);
    DECLARE @DisplayLabel NVARCHAR(MAX);
    DECLARE @Notes NVARCHAR(MAX);
    DECLARE @Updated BIT = 0;

    DECLARE text_cursor CURSOR LOCAL FAST_FORWARD FOR
        SELECT [key] AS JsonIndex,
               JSON_VALUE([value], '$.displayLabel') AS DisplayLabel,
               JSON_VALUE([value], '$.notes') AS Notes
          FROM OPENJSON(@Payload, '$.pricingRecords');

    OPEN text_cursor;
    FETCH NEXT FROM text_cursor INTO @JsonIndex, @DisplayLabel, @Notes;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        IF @DisplayLabel IS NOT NULL
        BEGIN
            SET @Payload = JSON_MODIFY(@Payload, '$.pricingRecords[' + @JsonIndex + '].displayLabel', @DisplayLabel);
            SET @Updated = 1;
        END

        IF @Notes IS NOT NULL
        BEGIN
            SET @Payload = JSON_MODIFY(@Payload, '$.pricingRecords[' + @JsonIndex + '].notes', @Notes);
            SET @Updated = 1;
        END

        FETCH NEXT FROM text_cursor INTO @JsonIndex, @DisplayLabel, @Notes;
    END

    CLOSE text_cursor;
    DEALLOCATE text_cursor;

    DECLARE fixes_cursor CURSOR LOCAL FAST_FORWARD FOR
        SELECT [key] AS JsonIndex,
               ExpectedPeriodKey
          FROM
          (
              SELECT j.[key],
                     UPPER(LTRIM(RTRIM(ISNULL(JSON_VALUE(j.[value], '$.periodKey'), N'')))) AS CurrentPeriodKey,
                     CASE
                         WHEN LEN(LTRIM(RTRIM(ISNULL(JSON_VALUE(j.[value], '$.waveCode'), N'')))) > 0
                             THEN NULL
                         WHEN TRY_CONVERT(date, JSON_VALUE(j.[value], '$.dateFrom')) IS NULL
                              AND TRY_CONVERT(date, JSON_VALUE(j.[value], '$.dateTo')) IS NULL
                             THEN NULL
                         WHEN MONTH(ISNULL(TRY_CONVERT(date, JSON_VALUE(j.[value], '$.dateFrom')), TRY_CONVERT(date, JSON_VALUE(j.[value], '$.dateTo')))) IN (6, 9)
                              AND MONTH(ISNULL(TRY_CONVERT(date, JSON_VALUE(j.[value], '$.dateTo')), TRY_CONVERT(date, JSON_VALUE(j.[value], '$.dateFrom')))) IN (6, 9)
                             THEN N'JUN_SEP'
                         WHEN MONTH(ISNULL(TRY_CONVERT(date, JSON_VALUE(j.[value], '$.dateFrom')), TRY_CONVERT(date, JSON_VALUE(j.[value], '$.dateTo')))) IN (7, 8)
                              AND MONTH(ISNULL(TRY_CONVERT(date, JSON_VALUE(j.[value], '$.dateTo')), TRY_CONVERT(date, JSON_VALUE(j.[value], '$.dateFrom')))) IN (7, 8)
                             THEN N'JUL_AUG'
                         WHEN MONTH(ISNULL(TRY_CONVERT(date, JSON_VALUE(j.[value], '$.dateFrom')), TRY_CONVERT(date, JSON_VALUE(j.[value], '$.dateTo'))))
                              = MONTH(ISNULL(TRY_CONVERT(date, JSON_VALUE(j.[value], '$.dateTo')), TRY_CONVERT(date, JSON_VALUE(j.[value], '$.dateFrom'))))
                             THEN N'M' + RIGHT(N'0' + CAST(MONTH(ISNULL(TRY_CONVERT(date, JSON_VALUE(j.[value], '$.dateFrom')), TRY_CONVERT(date, JSON_VALUE(j.[value], '$.dateTo')))) AS NVARCHAR(2)), 2)
                         ELSE NULL
                     END AS ExpectedPeriodKey
                FROM OPENJSON(@Payload, '$.pricingRecords') AS j
          ) AS fixes
         WHERE fixes.ExpectedPeriodKey IS NOT NULL
           AND fixes.ExpectedPeriodKey <> fixes.CurrentPeriodKey;

    OPEN fixes_cursor;
    FETCH NEXT FROM fixes_cursor INTO @JsonIndex, @ExpectedPeriodKey;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        SET @Payload = JSON_MODIFY(@Payload, '$.pricingRecords[' + @JsonIndex + '].periodKey', @ExpectedPeriodKey);
        SET @Updated = 1;
        FETCH NEXT FROM fixes_cursor INTO @JsonIndex, @ExpectedPeriodKey;
    END

    CLOSE fixes_cursor;
    DEALLOCATE fixes_cursor;

    IF @Updated = 1
    BEGIN
        UPDATE [CDMend]
           SET [CDMendTbl] = @Payload
         WHERE [CDMendSQL] = @MendSql;
    END

    FETCH NEXT FROM pricing_cursor INTO @MendSql, @Payload;
END

CLOSE pricing_cursor;
DEALLOCATE pricing_cursor;
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // no-op
        }
    }
}
