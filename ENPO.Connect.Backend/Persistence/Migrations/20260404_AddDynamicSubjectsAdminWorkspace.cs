using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Persistence.Data;

namespace Persistence.Migrations
{
    [DbContext(typeof(ConnectContext))]
    [Migration("20260404_AddDynamicSubjectsAdminWorkspace")]
    public partial class AddDynamicSubjectsAdminWorkspace : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[SubjectTypeAdminSettings]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[SubjectTypeAdminSettings](
        [CategoryID] [int] NOT NULL,
        [DisplayOrder] [int] NOT NULL CONSTRAINT [DF_SubjectTypeAdminSettings_DisplayOrder] DEFAULT ((0)),
        [SettingsJson] [nvarchar](max) NULL,
        [LastModifiedBy] [nvarchar](64) NOT NULL CONSTRAINT [DF_SubjectTypeAdminSettings_LastModifiedBy] DEFAULT (N'SYSTEM'),
        [LastModifiedAtUtc] [datetime2](7) NOT NULL CONSTRAINT [DF_SubjectTypeAdminSettings_LastModifiedAtUtc] DEFAULT (GETUTCDATE()),
        CONSTRAINT [PK_SubjectTypeAdminSettings] PRIMARY KEY CLUSTERED ([CategoryID] ASC)
    );
END
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_SubjectTypeAdminSettings_DisplayOrder'
      AND object_id = OBJECT_ID(N'[dbo].[SubjectTypeAdminSettings]')
)
BEGIN
    CREATE NONCLUSTERED INDEX [IX_SubjectTypeAdminSettings_DisplayOrder]
        ON [dbo].[SubjectTypeAdminSettings] ([DisplayOrder]);
END
");

            migrationBuilder.Sql(@"
;WITH OrderedCategories AS
(
    SELECT
        C.[CatId] AS CategoryID,
        ROW_NUMBER() OVER (PARTITION BY C.[CatParent] ORDER BY C.[CatId]) AS DisplayOrder
    FROM [dbo].[CDCategory] C
)
INSERT INTO [dbo].[SubjectTypeAdminSettings]
(
    [CategoryID],
    [DisplayOrder],
    [SettingsJson],
    [LastModifiedBy],
    [LastModifiedAtUtc]
)
SELECT
    O.CategoryID,
    O.DisplayOrder,
    NULL,
    N'SYSTEM',
    GETUTCDATE()
FROM OrderedCategories O
WHERE NOT EXISTS
(
    SELECT 1
    FROM [dbo].[SubjectTypeAdminSettings] S
    WHERE S.[CategoryID] = O.CategoryID
);
");

            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[SubjectCategoryFieldSettings]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[SubjectCategoryFieldSettings](
        [MendSQL] [int] NOT NULL,
        [DisplayOrder] [int] NOT NULL CONSTRAINT [DF_SubjectCategoryFieldSettings_DisplayOrder] DEFAULT ((0)),
        [IsVisible] [bit] NOT NULL CONSTRAINT [DF_SubjectCategoryFieldSettings_IsVisible] DEFAULT ((1)),
        [DisplaySettingsJson] [nvarchar](max) NULL,
        [LastModifiedBy] [nvarchar](64) NOT NULL CONSTRAINT [DF_SubjectCategoryFieldSettings_LastModifiedBy] DEFAULT (N'SYSTEM'),
        [LastModifiedAtUtc] [datetime2](7) NOT NULL CONSTRAINT [DF_SubjectCategoryFieldSettings_LastModifiedAtUtc] DEFAULT (GETUTCDATE()),
        CONSTRAINT [PK_SubjectCategoryFieldSettings] PRIMARY KEY CLUSTERED ([MendSQL] ASC)
    );
END
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_SubjectCategoryFieldSettings_DisplayOrder'
      AND object_id = OBJECT_ID(N'[dbo].[SubjectCategoryFieldSettings]')
)
BEGIN
    CREATE NONCLUSTERED INDEX [IX_SubjectCategoryFieldSettings_DisplayOrder]
        ON [dbo].[SubjectCategoryFieldSettings] ([DisplayOrder]);
END
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_SubjectCategoryFieldSettings_IsVisible'
      AND object_id = OBJECT_ID(N'[dbo].[SubjectCategoryFieldSettings]')
)
BEGIN
    CREATE NONCLUSTERED INDEX [IX_SubjectCategoryFieldSettings_IsVisible]
        ON [dbo].[SubjectCategoryFieldSettings] ([IsVisible]);
END
");

            migrationBuilder.Sql(@"
;WITH OrderedLinks AS
(
    SELECT
        L.[MendSQL],
        ROW_NUMBER() OVER (PARTITION BY L.[MendCategory], L.[MendGroup] ORDER BY L.[MendSQL]) AS DisplayOrder
    FROM [dbo].[CdCategoryMand] L
)
INSERT INTO [dbo].[SubjectCategoryFieldSettings]
(
    [MendSQL],
    [DisplayOrder],
    [IsVisible],
    [DisplaySettingsJson],
    [LastModifiedBy],
    [LastModifiedAtUtc]
)
SELECT
    O.[MendSQL],
    O.[DisplayOrder],
    1,
    NULL,
    N'SYSTEM',
    GETUTCDATE()
FROM OrderedLinks O
WHERE NOT EXISTS
(
    SELECT 1
    FROM [dbo].[SubjectCategoryFieldSettings] S
    WHERE S.[MendSQL] = O.[MendSQL]
);
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[SubjectCategoryFieldSettings]', N'U') IS NOT NULL
BEGIN
    DROP TABLE [dbo].[SubjectCategoryFieldSettings];
END
");

            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[SubjectTypeAdminSettings]', N'U') IS NOT NULL
BEGIN
    DROP TABLE [dbo].[SubjectTypeAdminSettings];
END
");
        }
    }
}
