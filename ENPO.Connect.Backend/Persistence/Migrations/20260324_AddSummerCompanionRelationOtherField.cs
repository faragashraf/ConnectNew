using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Persistence.Data;

namespace Persistence.Migrations
{
    [DbContext(typeof(ConnectContext))]
    [Migration("20260324_AddSummerCompanionRelationOtherField")]
    public partial class AddSummerCompanionRelationOtherField : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DECLARE @AppId NVARCHAR(10) = N'SUM2026DYN';
DECLARE @RelationOptions NVARCHAR(MAX) = N'[
    {""key"":""زوج"",""name"":""زوج""},
    {""key"":""زوجة"",""name"":""زوجة""},
    {""key"":""ابن"",""name"":""ابن""},
    {""key"":""ابنة"",""name"":""ابنة""},
    {""key"":""أب"",""name"":""أب""},
    {""key"":""أم"",""name"":""أم""},
    {""key"":""أخ"",""name"":""أخ""},
    {""key"":""أخت"",""name"":""أخت""},
    {""key"":""أخرى"",""name"":""أخرى""}
]';
DECLARE @RelationOtherFieldKey NVARCHAR(60) = N'SUM2026_CompanionRelationOther';
DECLARE @RelationOtherLabel NVARCHAR(50) =
    NCHAR(1575) + NCHAR(1587) + NCHAR(1605) + NCHAR(32) +
    NCHAR(1575) + NCHAR(1604) + NCHAR(1602) + NCHAR(1585) + NCHAR(1575) + NCHAR(1576) + NCHAR(1577);
DECLARE @RelationOtherPlaceholder NVARCHAR(100) =
    NCHAR(1575) + NCHAR(1603) + NCHAR(1578) + NCHAR(1576) + NCHAR(32) +
    NCHAR(1575) + NCHAR(1587) + NCHAR(1605) + NCHAR(32) +
    NCHAR(1575) + NCHAR(1604) + NCHAR(1602) + NCHAR(1585) + NCHAR(1575) + NCHAR(1576) + NCHAR(1577);

UPDATE [CDMend]
   SET [CDMendTbl] = @RelationOptions,
       [CDMendStat] = 0,
       [ApplicationId] = COALESCE(NULLIF([ApplicationId], N''), @AppId)
 WHERE [CDMendTxt] = N'SUM2026_CompanionRelation';

IF EXISTS (SELECT 1 FROM [CDMend] WHERE [CDMendTxt] = @RelationOtherFieldKey)
BEGIN
    UPDATE [CDMend]
       SET [CDMendType] = N'InputText',
           [CDMendLbl] = @RelationOtherLabel,
           [Placeholder] = @RelationOtherPlaceholder,
           [DefaultValue] = N'',
           [CDMendTbl] = NULL,
           [CDMendDatatype] = N'string',
           [Required] = 0,
           [RequiredTrue] = 0,
           [email] = 0,
           [Pattern] = 0,
           [MinValue] = NULL,
           [MaxValue] = N'100',
           [CDMendmask] = NULL,
           [CDMendStat] = 0,
           [Width] = 12,
           [Height] = 0,
           [IsDisabledInit] = 0,
           [IsSearchable] = 0,
           [ApplicationId] = @AppId
     WHERE [CDMendTxt] = @RelationOtherFieldKey;
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
           N'InputText',
           @RelationOtherFieldKey,
           @RelationOtherLabel,
           @RelationOtherPlaceholder,
           N'',
           NULL,
           N'string',
           0, 0, 0, 0,
           NULL, N'100', NULL,
           0, 12, 0, 0, 0, @AppId
      FROM [CDMend];
END

DECLARE @SummerCategories TABLE ([CategoryId] INT PRIMARY KEY);
INSERT INTO @SummerCategories ([CategoryId])
SELECT [CatId]
  FROM [CDCategory]
 WHERE [CatId] IN (147, 148, 149);

DECLARE @TargetMendGroup INT = NULL;

IF EXISTS (SELECT 1 FROM [MandGroups] WHERE [GroupID] = 9203)
BEGIN
    SET @TargetMendGroup = 9203;
END

IF @TargetMendGroup IS NULL
BEGIN
    SELECT TOP (1) @TargetMendGroup = existing.[MendGroup]
      FROM [CdCategoryMand] AS existing
     INNER JOIN @SummerCategories AS categoryIds
        ON categoryIds.[CategoryId] = existing.[MendCategory]
     WHERE existing.[MendField] = N'SUM2026_CompanionRelation'
     ORDER BY existing.[MendCategory];
END

IF @TargetMendGroup IS NULL
BEGIN
    SELECT TOP (1) @TargetMendGroup = [GroupID]
      FROM [MandGroups]
     ORDER BY [GroupID];
END

IF @TargetMendGroup IS NULL
BEGIN
    THROW 50001, N'Unable to resolve a valid MendGroup for summer companion relation metadata.', 1;
END

DECLARE @CdCategoryMandMendSqlIsIdentity BIT = CASE
    WHEN COALESCE(
        COLUMNPROPERTY(OBJECT_ID(N'[dbo].[CdCategoryMand]'), N'MendSQL', N'IsIdentity'),
        COLUMNPROPERTY(OBJECT_ID(N'[CdCategoryMand]'), N'MendSQL', N'IsIdentity'),
        0
    ) = 1 THEN 1
    ELSE 0
END;

IF @CdCategoryMandMendSqlIsIdentity = 1
BEGIN
    SET IDENTITY_INSERT [CdCategoryMand] ON;
END

UPDATE existing
   SET existing.[MendGroup] = @TargetMendGroup,
       existing.[MendStat] = 0
  FROM [CdCategoryMand] AS existing
 INNER JOIN @SummerCategories AS categoryIds
    ON categoryIds.[CategoryId] = existing.[MendCategory]
 WHERE existing.[MendField] = @RelationOtherFieldKey;

;WITH MissingMap AS
(
    SELECT categoryIds.[CategoryId],
           ROW_NUMBER() OVER (ORDER BY categoryIds.[CategoryId]) AS [RowNum]
      FROM @SummerCategories AS categoryIds
     WHERE NOT EXISTS
           (
               SELECT 1
                 FROM [CdCategoryMand] AS existing
                WHERE existing.[MendCategory] = categoryIds.[CategoryId]
                  AND existing.[MendField] = @RelationOtherFieldKey
           )
)
INSERT INTO [CdCategoryMand] ([MendSQL], [MendCategory], [MendField], [MendStat], [MendGroup])
SELECT seed.[BaseSql] + missing.[RowNum],
       missing.[CategoryId],
       @RelationOtherFieldKey,
       0,
       @TargetMendGroup
  FROM MissingMap AS missing
 CROSS JOIN (SELECT ISNULL(MAX([MendSQL]), 0) AS [BaseSql] FROM [CdCategoryMand]) AS seed;

IF @CdCategoryMandMendSqlIsIdentity = 1
BEGIN
    SET IDENTITY_INSERT [CdCategoryMand] OFF;
END
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Intentionally no-op to avoid deleting seeded metadata in production environments.
        }
    }
}
