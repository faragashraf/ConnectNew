using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Persistence.Data;

namespace Persistence.Migrations
{
    [DbContext(typeof(ConnectContext))]
    [Migration("20260408_AddSummerMembershipTypeField")]
    public partial class AddSummerMembershipTypeField : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DECLARE @AppId NVARCHAR(10) = N'SUM2026DYN';
DECLARE @FieldKey NVARCHAR(60) = N'SUM2026_MembershipType';
DECLARE @FieldLabel NVARCHAR(60) = N'نوع العضوية';
DECLARE @Placeholder NVARCHAR(100) = N'اختر نوع العضوية';
DECLARE @Options NVARCHAR(MAX) = N'[
    {""key"":""WORKER_MEMBER"",""name"":""عضو عامل""},
    {""key"":""NON_WORKER_MEMBER"",""name"":""عضو غير عامل""}
]';

IF EXISTS (SELECT 1 FROM [CDMend] WHERE [CDMendTxt] = @FieldKey)
BEGIN
    UPDATE [CDMend]
       SET [CDMendType] = N'Dropdown',
           [CDMendLbl] = @FieldLabel,
           [Placeholder] = @Placeholder,
           [DefaultValue] = N'WORKER_MEMBER',
           [CDMendTbl] = @Options,
           [CDMendDatatype] = N'string',
           [Required] = 0,
           [RequiredTrue] = 0,
           [email] = 0,
           [Pattern] = 0,
           [MinValue] = NULL,
           [MaxValue] = NULL,
           [CDMendmask] = NULL,
           [CDMendStat] = 0,
           [Width] = 10,
           [Height] = 0,
           [IsDisabledInit] = 0,
           [IsSearchable] = 0,
           [ApplicationId] = @AppId
     WHERE [CDMendTxt] = @FieldKey;
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
           N'Dropdown',
           @FieldKey,
           @FieldLabel,
           @Placeholder,
           N'WORKER_MEMBER',
           @Options,
           N'string',
           0, 0, 0, 0,
           NULL, NULL, NULL,
           0, 10, 0, 0, 0, @AppId
      FROM [CDMend];
END

DECLARE @SummerCategories TABLE ([CategoryId] INT PRIMARY KEY);
INSERT INTO @SummerCategories ([CategoryId])
SELECT [CatId]
  FROM [CDCategory]
 WHERE [CatId] IN (147, 148, 149);

DECLARE @TargetMendGroup INT = NULL;
IF EXISTS (SELECT 1 FROM [MandGroups] WHERE [GroupID] = 9201)
BEGIN
    SET @TargetMendGroup = 9201;
END

IF @TargetMendGroup IS NULL
BEGIN
    SELECT TOP (1) @TargetMendGroup = existing.[MendGroup]
      FROM [CdCategoryMand] AS existing
     INNER JOIN @SummerCategories AS categoryIds
        ON categoryIds.[CategoryId] = existing.[MendCategory]
     WHERE existing.[MendField] = N'SUM2026_ProxyMode'
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
    THROW 50001, N'Unable to resolve a valid MendGroup for summer membership metadata.', 1;
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
 WHERE existing.[MendField] = @FieldKey;

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
                  AND existing.[MendField] = @FieldKey
           )
)
INSERT INTO [CdCategoryMand] ([MendSQL], [MendCategory], [MendField], [MendStat], [MendGroup])
SELECT seed.[BaseSql] + missing.[RowNum],
       missing.[CategoryId],
       @FieldKey,
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
            // No-op: keep production metadata intact.
        }
    }
}
