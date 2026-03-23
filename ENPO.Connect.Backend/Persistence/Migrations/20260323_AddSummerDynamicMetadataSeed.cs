using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Persistence.Data;

namespace Persistence.Migrations
{
    [DbContext(typeof(ConnectContext))]
    [Migration("20260323_AddSummerDynamicMetadataSeed")]
    public partial class AddSummerDynamicMetadataSeed : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DECLARE @AppId NVARCHAR(10) = N'SUM2026DYN';

IF NOT EXISTS (SELECT 1 FROM [Application] WHERE [ApplicationID] = @AppId)
BEGIN
    INSERT INTO [Application] ([ApplicationID], [ApplicationName], [IsActive])
    VALUES (@AppId, N'Summer 2026 Dynamic Booking', 1);
END

IF EXISTS (SELECT 1 FROM [MandGroup] WHERE [GroupID] = 9201)
BEGIN
    UPDATE [MandGroup]
       SET [GroupName] = N'بيانات الحجز',
           [GroupDescription] = N'الحقول الأساسية لحجز المصيف',
           [IsExtendable] = 0,
           [GroupWithInRow] = 3
     WHERE [GroupID] = 9201;
END
ELSE
BEGIN
    INSERT INTO [MandGroup] ([GroupID], [GroupName], [GroupDescription], [IsExtendable], [GroupWithInRow])
    VALUES (9201, N'بيانات الحجز', N'الحقول الأساسية لحجز المصيف', 0, 3);
END

IF EXISTS (SELECT 1 FROM [MandGroup] WHERE [GroupID] = 9202)
BEGIN
    UPDATE [MandGroup]
       SET [GroupName] = N'بيانات مقدم الطلب',
           [GroupDescription] = N'بيانات الموظف صاحب الطلب',
           [IsExtendable] = 0,
           [GroupWithInRow] = 2
     WHERE [GroupID] = 9202;
END
ELSE
BEGIN
    INSERT INTO [MandGroup] ([GroupID], [GroupName], [GroupDescription], [IsExtendable], [GroupWithInRow])
    VALUES (9202, N'بيانات مقدم الطلب', N'بيانات الموظف صاحب الطلب', 0, 2);
END

IF EXISTS (SELECT 1 FROM [MandGroup] WHERE [GroupID] = 9203)
BEGIN
    UPDATE [MandGroup]
       SET [GroupName] = N'بيانات المرافقين',
           [GroupDescription] = N'بيانات المرافقين في الحجز',
           [IsExtendable] = 1,
           [GroupWithInRow] = 2
     WHERE [GroupID] = 9203;
END
ELSE
BEGIN
    INSERT INTO [MandGroup] ([GroupID], [GroupName], [GroupDescription], [IsExtendable], [GroupWithInRow])
    VALUES (9203, N'بيانات المرافقين', N'بيانات المرافقين في الحجز', 1, 2);
END

DECLARE @DestinationCatalog NVARCHAR(MAX) = N'{
  ""seasonYear"": 2026,
  ""destinations"": [
    {
      ""categoryId"": 147,
      ""slug"": ""MATROUH"",
      ""name"": ""مرسى مطروح"",
      ""stayModes"": [
        { ""code"": ""RESIDENCE_ONLY"", ""label"": ""إقامة فقط"" },
        { ""code"": ""RESIDENCE_WITH_TRANSPORT"", ""label"": ""إقامة وانتقالات"" }
      ],
      ""maxExtraMembers"": 2,
      ""apartments"": [
        { ""familyCount"": 5, ""apartments"": 5 },
        { ""familyCount"": 6, ""apartments"": 5 },
        { ""familyCount"": 8, ""apartments"": 8 },
        { ""familyCount"": 9, ""apartments"": 5 }
      ],
      ""waves"": [
        { ""code"": ""W01"", ""startsAtLabel"": ""W01 - 04/06/2026"" },
        { ""code"": ""W02"", ""startsAtLabel"": ""W02 - 11/06/2026"" },
        { ""code"": ""W03"", ""startsAtLabel"": ""W03 - 18/06/2026"" },
        { ""code"": ""W04"", ""startsAtLabel"": ""W04 - 25/06/2026"" },
        { ""code"": ""W05"", ""startsAtLabel"": ""W05 - 02/07/2026"" },
        { ""code"": ""W06"", ""startsAtLabel"": ""W06 - 09/07/2026"" },
        { ""code"": ""W07"", ""startsAtLabel"": ""W07 - 16/07/2026"" },
        { ""code"": ""W08"", ""startsAtLabel"": ""W08 - 23/07/2026"" },
        { ""code"": ""W09"", ""startsAtLabel"": ""W09 - 30/07/2026"" },
        { ""code"": ""W10"", ""startsAtLabel"": ""W10 - 06/08/2026"" },
        { ""code"": ""W11"", ""startsAtLabel"": ""W11 - 13/08/2026"" },
        { ""code"": ""W12"", ""startsAtLabel"": ""W12 - 20/08/2026"" },
        { ""code"": ""W13"", ""startsAtLabel"": ""W13 - 27/08/2026"" },
        { ""code"": ""W14"", ""startsAtLabel"": ""W14 - 03/09/2026"" },
        { ""code"": ""W15"", ""startsAtLabel"": ""W15 - 10/09/2026"" },
        { ""code"": ""W16"", ""startsAtLabel"": ""W16 - 17/09/2026"" }
      ]
    },
    {
      ""categoryId"": 148,
      ""slug"": ""RAS_EL_BAR"",
      ""name"": ""رأس البر"",
      ""stayModes"": [
        { ""code"": ""RESIDENCE_ONLY"", ""label"": ""إقامة فقط"" },
        { ""code"": ""RESIDENCE_WITH_TRANSPORT"", ""label"": ""إقامة وانتقالات"" }
      ],
      ""maxExtraMembers"": 2,
      ""apartments"": [
        { ""familyCount"": 2, ""apartments"": 2 },
        { ""familyCount"": 4, ""apartments"": 6 },
        { ""familyCount"": 6, ""apartments"": 2 }
      ],
      ""waves"": [
        { ""code"": ""W01"", ""startsAtLabel"": ""W01 - 07/06/2026"" },
        { ""code"": ""W02"", ""startsAtLabel"": ""W02 - 14/06/2026"" },
        { ""code"": ""W03"", ""startsAtLabel"": ""W03 - 21/06/2026"" },
        { ""code"": ""W04"", ""startsAtLabel"": ""W04 - 28/06/2026"" },
        { ""code"": ""W05"", ""startsAtLabel"": ""W05 - 05/07/2026"" },
        { ""code"": ""W06"", ""startsAtLabel"": ""W06 - 12/07/2026"" },
        { ""code"": ""W07"", ""startsAtLabel"": ""W07 - 19/07/2026"" },
        { ""code"": ""W08"", ""startsAtLabel"": ""W08 - 26/07/2026"" },
        { ""code"": ""W09"", ""startsAtLabel"": ""W09 - 02/08/2026"" },
        { ""code"": ""W10"", ""startsAtLabel"": ""W10 - 09/08/2026"" },
        { ""code"": ""W11"", ""startsAtLabel"": ""W11 - 16/08/2026"" },
        { ""code"": ""W12"", ""startsAtLabel"": ""W12 - 23/08/2026"" },
        { ""code"": ""W13"", ""startsAtLabel"": ""W13 - 30/08/2026"" },
        { ""code"": ""W14"", ""startsAtLabel"": ""W14 - 06/09/2026"" },
        { ""code"": ""W15"", ""startsAtLabel"": ""W15 - 13/09/2026"" },
        { ""code"": ""W16"", ""startsAtLabel"": ""W16 - 20/09/2026"" }
      ]
    },
    {
      ""categoryId"": 149,
      ""slug"": ""PORT_FOUAD"",
      ""name"": ""بور فؤاد"",
      ""stayModes"": [
        { ""code"": ""RESIDENCE_ONLY"", ""label"": ""إقامة فقط"" },
        { ""code"": ""RESIDENCE_WITH_TRANSPORT"", ""label"": ""إقامة وانتقالات"" }
      ],
      ""maxExtraMembers"": 2,
      ""apartments"": [
        { ""familyCount"": 4, ""apartments"": 24 },
        { ""familyCount"": 6, ""apartments"": 23 },
        { ""familyCount"": 7, ""apartments"": 24 }
      ],
      ""waves"": [
        { ""code"": ""W01"", ""startsAtLabel"": ""W01 - 07/06/2026"" },
        { ""code"": ""W02"", ""startsAtLabel"": ""W02 - 14/06/2026"" },
        { ""code"": ""W03"", ""startsAtLabel"": ""W03 - 21/06/2026"" },
        { ""code"": ""W04"", ""startsAtLabel"": ""W04 - 28/06/2026"" },
        { ""code"": ""W05"", ""startsAtLabel"": ""W05 - 05/07/2026"" },
        { ""code"": ""W06"", ""startsAtLabel"": ""W06 - 12/07/2026"" },
        { ""code"": ""W07"", ""startsAtLabel"": ""W07 - 19/07/2026"" },
        { ""code"": ""W08"", ""startsAtLabel"": ""W08 - 26/07/2026"" },
        { ""code"": ""W09"", ""startsAtLabel"": ""W09 - 02/08/2026"" },
        { ""code"": ""W10"", ""startsAtLabel"": ""W10 - 09/08/2026"" },
        { ""code"": ""W11"", ""startsAtLabel"": ""W11 - 16/08/2026"" },
        { ""code"": ""W12"", ""startsAtLabel"": ""W12 - 23/08/2026"" },
        { ""code"": ""W13"", ""startsAtLabel"": ""W13 - 30/08/2026"" },
        { ""code"": ""W14"", ""startsAtLabel"": ""W14 - 06/09/2026"" },
        { ""code"": ""W15"", ""startsAtLabel"": ""W15 - 13/09/2026"" },
        { ""code"": ""W16"", ""startsAtLabel"": ""W16 - 20/09/2026"" }
      ]
    }
  ]
}';

DECLARE @SummerFields TABLE
(
    [FieldKey] NVARCHAR(50) NOT NULL,
    [FieldType] NVARCHAR(50) NOT NULL,
    [FieldLabel] NVARCHAR(50) NOT NULL,
    [Placeholder] NVARCHAR(200) NULL,
    [DefaultValue] NVARCHAR(200) NULL,
    [FieldOptions] NVARCHAR(MAX) NULL,
    [DataType] NVARCHAR(50) NULL,
    [IsRequired] BIT NOT NULL,
    [UsePattern] BIT NOT NULL,
    [MinValue] NVARCHAR(30) NULL,
    [MaxValue] NVARCHAR(30) NULL,
    [Mask] NVARCHAR(30) NULL,
    [Width] INT NOT NULL,
    [Height] INT NOT NULL,
    [IsDisabledInit] BIT NOT NULL,
    [IsSearchable] BIT NOT NULL,
    [IncludeInCategory] BIT NOT NULL,
    [GroupId] INT NULL,
    [SortOrder] INT NOT NULL
);

INSERT INTO @SummerFields
(
    [FieldKey], [FieldType], [FieldLabel], [Placeholder], [DefaultValue], [FieldOptions],
    [DataType], [IsRequired], [UsePattern], [MinValue], [MaxValue], [Mask],
    [Width], [Height], [IsDisabledInit], [IsSearchable], [IncludeInCategory], [GroupId], [SortOrder]
)
VALUES
(N'SUM2026_SeasonYear', N'InputText-integeronly', N'موسم الحجز', N'', N'2026', NULL, N'number', 0, 0, N'2026', N'2026', NULL, 8, 0, 1, 0, 1, 9201, 10),
(N'SUM2026_DestinationId', N'InputText-integeronly', N'كود المصيف', N'', N'', NULL, N'number', 0, 0, NULL, NULL, NULL, 8, 0, 1, 0, 1, 9201, 20),
(N'SUM2026_DestinationName', N'InputText', N'اسم المصيف', N'', N'', NULL, N'string', 0, 0, NULL, NULL, NULL, 14, 0, 1, 0, 1, 9201, 30),
(N'SUM2026_WaveCode', N'Dropdown', N'الفوج', N'', N'', N'[]', N'string', 1, 0, NULL, NULL, NULL, 10, 0, 0, 0, 1, 9201, 40),
(N'SUM2026_WaveLabel', N'InputText', N'بيان الفوج', N'', N'', NULL, N'string', 0, 0, NULL, NULL, NULL, 14, 0, 1, 0, 1, 9201, 50),
(N'SUM2026_StayMode', N'Dropdown', N'نوع الحجز', N'', N'', N'[]', N'string', 1, 0, NULL, NULL, NULL, 12, 0, 0, 0, 1, 9201, 60),
(N'SUM2026_FamilyCount', N'Dropdown', N'عدد الأفراد', N'', N'', N'[]', N'number', 1, 0, NULL, NULL, NULL, 8, 0, 0, 0, 1, 9201, 70),
(N'SUM2026_ExtraCount', N'InputText-integeronly', N'أفراد إضافيون', N'', N'0', NULL, N'number', 0, 0, N'0', N'9', NULL, 8, 0, 0, 0, 1, 9201, 80),
(N'SUM2026_ProxyMode', N'ToggleSwitch', N'تسجيل بالنيابة', N'', N'false', NULL, N'boolean', 0, 0, NULL, NULL, NULL, 8, 0, 0, 0, 1, 9201, 90),
(N'SUM2026_Notes', N'Textarea', N'ملاحظات', N'', N'', NULL, N'string', 0, 0, NULL, N'500', NULL, 24, 4, 0, 0, 1, 9201, 100),
(N'SUM2026_OwnerName', N'InputText', N'اسم الموظف', N'', N'', NULL, N'string', 1, 0, NULL, N'100', NULL, 16, 0, 0, 0, 1, 9202, 110),
(N'SUM2026_OwnerFileNumber', N'InputText', N'رقم الملف', N'', N'', NULL, N'string', 1, 0, NULL, N'50', NULL, 12, 0, 0, 1, 1, 9202, 120),
(N'SUM2026_OwnerNationalId', N'InputText', N'الرقم القومي', N'', N'', NULL, N'string', 1, 0, NULL, N'20', NULL, 14, 0, 0, 1, 1, 9202, 130),
(N'SUM2026_OwnerPhone', N'InputText', N'رقم الهاتف', N'', N'', NULL, N'string', 1, 0, NULL, N'20', NULL, 12, 0, 0, 1, 1, 9202, 140),
(N'SUM2026_OwnerExtraPhone', N'InputText', N'هاتف إضافي', N'', N'', NULL, N'string', 0, 0, NULL, N'20', NULL, 12, 0, 0, 0, 1, 9202, 150),
(N'SUM2026_CompanionName', N'InputText', N'اسم المرافق', N'', N'', NULL, N'string', 1, 0, NULL, N'100', NULL, 16, 0, 0, 0, 1, 9203, 210),
(N'SUM2026_CompanionRelation', N'Dropdown', N'درجة القرابة', N'', N'', N'[{""key"":""زوج"",""name"":""زوج""},{""key"":""زوجة"",""name"":""زوجة""},{""key"":""ابن"",""name"":""ابن""},{""key"":""ابنة"",""name"":""ابنة""},{""key"":""أب"",""name"":""أب""},{""key"":""أم"",""name"":""أم""},{""key"":""أخ"",""name"":""أخ""},{""key"":""أخت"",""name"":""أخت""}]', N'string', 1, 0, NULL, NULL, NULL, 12, 0, 0, 0, 1, 9203, 220),
(N'SUM2026_CompanionNationalId', N'InputText', N'رقم قومي للمرافق', N'', N'', NULL, N'string', 0, 0, NULL, N'20', NULL, 14, 0, 0, 0, 1, 9203, 230),
(N'SUM2026_CompanionAge', N'InputText-integeronly', N'سن المرافق', N'', N'', NULL, N'number', 0, 0, N'0', N'120', NULL, 8, 0, 0, 0, 1, 9203, 240),
(N'SUM2026_DestinationCatalog', N'Textarea', N'إعدادات المصايف 2026', N'', N'', @DestinationCatalog, N'json', 0, 0, NULL, NULL, NULL, 0, 0, 0, 0, 0, NULL, 900);

UPDATE target
   SET target.[CDMendType] = source.[FieldType],
       target.[CDMendLbl] = source.[FieldLabel],
       target.[Placeholder] = source.[Placeholder],
       target.[DefaultValue] = source.[DefaultValue],
       target.[CDMendTbl] = source.[FieldOptions],
       target.[CDMendDatatype] = source.[DataType],
       target.[Required] = source.[IsRequired],
       target.[RequiredTrue] = 0,
       target.[email] = 0,
       target.[Pattern] = source.[UsePattern],
       target.[MinValue] = source.[MinValue],
       target.[MaxValue] = source.[MaxValue],
       target.[CDMendmask] = source.[Mask],
       target.[CDMendStat] = 0,
       target.[Width] = source.[Width],
       target.[Height] = source.[Height],
       target.[IsDisabledInit] = source.[IsDisabledInit],
       target.[IsSearchable] = source.[IsSearchable],
       target.[ApplicationId] = @AppId
  FROM [CDMend] AS target
 INNER JOIN @SummerFields AS source
    ON target.[CDMendTxt] = source.[FieldKey];

;WITH MissingFields AS
(
    SELECT source.*,
           ROW_NUMBER() OVER (ORDER BY source.[SortOrder], source.[FieldKey]) AS [RowNum]
      FROM @SummerFields AS source
     WHERE NOT EXISTS
           (
               SELECT 1
                 FROM [CDMend] AS existing
                WHERE existing.[CDMendTxt] = source.[FieldKey]
           )
)
INSERT INTO [CDMend]
(
    [CDMendSQL], [CDMendType], [CDMendTxt], [CDMendLbl], [Placeholder], [DefaultValue],
    [CDMendTbl], [CDMendDatatype], [Required], [RequiredTrue], [email], [Pattern],
    [MinValue], [MaxValue], [CDMendmask], [CDMendStat], [Width], [Height],
    [IsDisabledInit], [IsSearchable], [ApplicationId]
)
SELECT seed.[BaseSql] + missing.[RowNum],
       missing.[FieldType],
       missing.[FieldKey],
       missing.[FieldLabel],
       missing.[Placeholder],
       missing.[DefaultValue],
       missing.[FieldOptions],
       missing.[DataType],
       missing.[IsRequired],
       0,
       0,
       missing.[UsePattern],
       missing.[MinValue],
       missing.[MaxValue],
       missing.[Mask],
       0,
       missing.[Width],
       missing.[Height],
       missing.[IsDisabledInit],
       missing.[IsSearchable],
       @AppId
  FROM MissingFields AS missing
 CROSS JOIN (SELECT ISNULL(MAX([CDMendSQL]), 0) AS [BaseSql] FROM [CDMend]) AS seed;

IF NOT EXISTS (SELECT 1 FROM [CDMend] WHERE [CDMendTxt] = N'SummerCamp')
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
           N'SummerCamp',
           N'الفوج',
           N'',
           N'',
           N'[]',
           N'string',
           0, 0, 0, 0,
           NULL, NULL, NULL,
           0, 8, 0, 0, 0, NULL
      FROM [CDMend];
END

DECLARE @SummerCategories TABLE ([CategoryId] INT PRIMARY KEY);
INSERT INTO @SummerCategories ([CategoryId])
SELECT [CatId]
  FROM [CDCategory]
 WHERE [CatId] IN (147, 148, 149);

UPDATE existing
   SET existing.[MendGroup] = source.[GroupId],
       existing.[MendStat] = 0
  FROM [CdCategoryMand] AS existing
 INNER JOIN @SummerCategories AS categoryIds
    ON categoryIds.[CategoryId] = existing.[MendCategory]
 INNER JOIN @SummerFields AS source
    ON source.[FieldKey] = existing.[MendField]
 WHERE source.[IncludeInCategory] = 1;

;WITH TargetMap AS
(
    SELECT categoryIds.[CategoryId],
           source.[FieldKey],
           source.[GroupId],
           source.[SortOrder]
      FROM @SummerCategories AS categoryIds
 CROSS JOIN @SummerFields AS source
     WHERE source.[IncludeInCategory] = 1
       AND source.[GroupId] IS NOT NULL
),
MissingMap AS
(
    SELECT map.[CategoryId],
           map.[FieldKey],
           map.[GroupId],
           map.[SortOrder],
           ROW_NUMBER() OVER (ORDER BY map.[CategoryId], map.[SortOrder], map.[FieldKey]) AS [RowNum]
      FROM TargetMap AS map
     WHERE NOT EXISTS
           (
               SELECT 1
                 FROM [CdCategoryMand] AS existing
                WHERE existing.[MendCategory] = map.[CategoryId]
                  AND existing.[MendField] = map.[FieldKey]
           )
)
INSERT INTO [CdCategoryMand] ([MendSQL], [MendCategory], [MendField], [MendStat], [MendGroup])
SELECT seed.[BaseSql] + missing.[RowNum],
       missing.[CategoryId],
       missing.[FieldKey],
       0,
       missing.[GroupId]
  FROM MissingMap AS missing
 CROSS JOIN (SELECT ISNULL(MAX([MendSQL]), 0) AS [BaseSql] FROM [CdCategoryMand]) AS seed;

UPDATE existing
   SET existing.[MendGroup] = 9201,
       existing.[MendStat] = 0
  FROM [CdCategoryMand] AS existing
 INNER JOIN @SummerCategories AS categoryIds
    ON categoryIds.[CategoryId] = existing.[MendCategory]
 WHERE existing.[MendField] = N'SummerCamp';

;WITH MissingSummerCamp AS
(
    SELECT categoryIds.[CategoryId],
           ROW_NUMBER() OVER (ORDER BY categoryIds.[CategoryId]) AS [RowNum]
      FROM @SummerCategories AS categoryIds
     WHERE NOT EXISTS
           (
               SELECT 1
                 FROM [CdCategoryMand] AS existing
                WHERE existing.[MendCategory] = categoryIds.[CategoryId]
                  AND existing.[MendField] = N'SummerCamp'
           )
)
INSERT INTO [CdCategoryMand] ([MendSQL], [MendCategory], [MendField], [MendStat], [MendGroup])
SELECT seed.[BaseSql] + missing.[RowNum],
       missing.[CategoryId],
       N'SummerCamp',
       0,
       9201
  FROM MissingSummerCamp AS missing
 CROSS JOIN (SELECT ISNULL(MAX([MendSQL]), 0) AS [BaseSql] FROM [CdCategoryMand]) AS seed;
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Intentionally left as no-op:
            // this migration seeds/normalizes runtime metadata in an idempotent way.
        }
    }
}
