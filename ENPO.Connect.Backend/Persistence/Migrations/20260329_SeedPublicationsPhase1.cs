using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Persistence.Data;

namespace Persistence.Migrations
{
    [DbContext(typeof(ConnectContext))]
    [Migration("20260329_SeedPublicationsPhase1")]
    public partial class SeedPublicationsPhase1 : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[PUB_RequestType]', N'U') IS NULL
    RETURN;

-- Seed request types from existing publications categories (idempotent)
;WITH PublicationCategories AS
(
    SELECT
        c.[CatId],
        c.[CatName],
        ROW_NUMBER() OVER (ORDER BY c.[CatId]) AS [SortOrder]
    FROM [dbo].[CDCategory] c
    WHERE c.[ApplicationID] = N'PUBL'
      AND c.[CatStatus] = 1
)
INSERT INTO [dbo].[PUB_RequestType]
(
    [Code],
    [NameAr],
    [NameEn],
    [CategoryID],
    [ApplicationId],
    [IsActive],
    [DisplayOrder],
    [CreatedAtUtc]
)
SELECT
    N'PUBL_CAT_' + CAST(pc.[CatId] AS NVARCHAR(20)),
    pc.[CatName],
    NULL,
    pc.[CatId],
    N'PUBL',
    1,
    pc.[SortOrder],
    GETUTCDATE()
FROM PublicationCategories pc
WHERE NOT EXISTS
(
    SELECT 1
    FROM [dbo].[PUB_RequestType] existing
    WHERE existing.[CategoryID] = pc.[CatId]
);

-- Seed department-to-request-type mappings from historical publications messages
IF OBJECT_ID(N'[dbo].[PUB_DepartmentRequestType]', N'U') IS NOT NULL
BEGIN
    ;WITH HistoricalDepartments AS
    (
        SELECT DISTINCT
            TRY_CAST(m.[AssignedSectorID] AS DECIMAL(18,0)) AS [DepartmentUnitID],
            m.[CategoryCd] AS [CategoryID]
        FROM [dbo].[Messages] m
        WHERE m.[AssignedSectorID] IS NOT NULL
          AND TRY_CAST(m.[AssignedSectorID] AS DECIMAL(18,0)) IS NOT NULL
    )
    INSERT INTO [dbo].[PUB_DepartmentRequestType]
    (
        [DepartmentUnitID],
        [PublicationRequestTypeID],
        [CanCreate],
        [IsActive],
        [CreatedAtUtc]
    )
    SELECT
        hd.[DepartmentUnitID],
        rt.[PublicationRequestTypeID],
        1,
        1,
        GETUTCDATE()
    FROM HistoricalDepartments hd
    INNER JOIN [dbo].[PUB_RequestType] rt
        ON rt.[CategoryID] = hd.[CategoryID]
    WHERE hd.[DepartmentUnitID] IS NOT NULL
      AND NOT EXISTS
      (
          SELECT 1
          FROM [dbo].[PUB_DepartmentRequestType] existing
          WHERE existing.[DepartmentUnitID] = hd.[DepartmentUnitID]
            AND existing.[PublicationRequestTypeID] = rt.[PublicationRequestTypeID]
      );
END

-- Seed admin departments from active mapped departments
IF OBJECT_ID(N'[dbo].[PUB_AdminDepartment]', N'U') IS NOT NULL
BEGIN
    INSERT INTO [dbo].[PUB_AdminDepartment]
    (
        [DepartmentUnitID],
        [IsActive],
        [CreatedAtUtc]
    )
    SELECT DISTINCT
        m.[DepartmentUnitID],
        1,
        GETUTCDATE()
    FROM [dbo].[PUB_DepartmentRequestType] m
    WHERE m.[IsActive] = 1
      AND NOT EXISTS
      (
          SELECT 1
          FROM [dbo].[PUB_AdminDepartment] existing
          WHERE existing.[DepartmentUnitID] = m.[DepartmentUnitID]
      );
END
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
-- Intentionally conservative rollback: remove only deterministic seed records.
IF OBJECT_ID(N'[dbo].[PUB_RequestType]', N'U') IS NOT NULL
BEGIN
    DELETE FROM [dbo].[PUB_RequestType]
    WHERE [Code] LIKE N'PUBL_CAT_%';
END
");
        }
    }
}
