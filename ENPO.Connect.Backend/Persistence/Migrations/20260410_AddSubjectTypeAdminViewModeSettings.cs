using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Persistence.Data;

namespace Persistence.Migrations
{
    [DbContext(typeof(ConnectContext))]
    [Migration("20260410_AddSubjectTypeAdminViewModeSettings")]
    public partial class AddSubjectTypeAdminViewModeSettings : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[SubjectTypeAdminSettings]', N'U') IS NOT NULL
BEGIN
    IF COL_LENGTH(N'[dbo].[SubjectTypeAdminSettings]', N'DefaultViewMode') IS NULL
    BEGIN
        ALTER TABLE [dbo].[SubjectTypeAdminSettings]
        ADD [DefaultViewMode] [nvarchar](20) NOT NULL
            CONSTRAINT [DF_SubjectTypeAdminSettings_DefaultViewMode] DEFAULT (N'standard');
    END;

    IF COL_LENGTH(N'[dbo].[SubjectTypeAdminSettings]', N'AllowRequesterOverride') IS NULL
    BEGIN
        ALTER TABLE [dbo].[SubjectTypeAdminSettings]
        ADD [AllowRequesterOverride] [bit] NOT NULL
            CONSTRAINT [DF_SubjectTypeAdminSettings_AllowRequesterOverride] DEFAULT ((0));
    END;
END
");

            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[SubjectTypeAdminSettings]', N'U') IS NOT NULL
BEGIN
    UPDATE [dbo].[SubjectTypeAdminSettings]
    SET [DefaultViewMode] = CASE
        WHEN LOWER(LTRIM(RTRIM(COALESCE(
            JSON_VALUE([SettingsJson], '$.defaultViewMode'),
            JSON_VALUE([SettingsJson], '$.defaultDisplayMode'),
            JSON_VALUE([SettingsJson], '$.presentationSettings.defaultViewMode'),
            JSON_VALUE([SettingsJson], '$.presentationSettings.defaultDisplayMode'),
            N'standard'
        )))) = N'tabbed'
            THEN N'tabbed'
        ELSE N'standard'
    END
    WHERE [SettingsJson] IS NOT NULL
      AND ISJSON([SettingsJson]) = 1;

    UPDATE [dbo].[SubjectTypeAdminSettings]
    SET [AllowRequesterOverride] = CASE
        WHEN LOWER(LTRIM(RTRIM(COALESCE(
            JSON_VALUE([SettingsJson], '$.allowRequesterOverride'),
            JSON_VALUE([SettingsJson], '$.allowUserToChangeDisplayMode'),
            JSON_VALUE([SettingsJson], '$.presentationSettings.allowRequesterOverride'),
            JSON_VALUE([SettingsJson], '$.presentationSettings.allowUserToChangeDisplayMode'),
            N'false'
        )))) IN (N'true', N'1', N'yes', N'y')
            THEN 1
        ELSE 0
    END
    WHERE [SettingsJson] IS NOT NULL
      AND ISJSON([SettingsJson]) = 1;
END
");

            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[SubjectTypeAdminSettings]', N'U') IS NOT NULL
   AND NOT EXISTS (
       SELECT 1
       FROM sys.check_constraints
       WHERE [name] = N'CK_SubjectTypeAdminSettings_DefaultViewMode'
         AND [parent_object_id] = OBJECT_ID(N'[dbo].[SubjectTypeAdminSettings]')
   )
BEGIN
    ALTER TABLE [dbo].[SubjectTypeAdminSettings]
    ADD CONSTRAINT [CK_SubjectTypeAdminSettings_DefaultViewMode]
    CHECK ([DefaultViewMode] IN (N'standard', N'tabbed'));
END
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[SubjectTypeAdminSettings]', N'U') IS NOT NULL
BEGIN
    IF EXISTS (
        SELECT 1
        FROM sys.check_constraints
        WHERE [name] = N'CK_SubjectTypeAdminSettings_DefaultViewMode'
          AND [parent_object_id] = OBJECT_ID(N'[dbo].[SubjectTypeAdminSettings]')
    )
    BEGIN
        ALTER TABLE [dbo].[SubjectTypeAdminSettings]
        DROP CONSTRAINT [CK_SubjectTypeAdminSettings_DefaultViewMode];
    END;

    IF COL_LENGTH(N'[dbo].[SubjectTypeAdminSettings]', N'DefaultViewMode') IS NOT NULL
    BEGIN
        DECLARE @DefaultViewModeConstraintName nvarchar(128);
        SELECT @DefaultViewModeConstraintName = dc.[name]
        FROM sys.default_constraints dc
        INNER JOIN sys.columns c
            ON dc.[parent_object_id] = c.[object_id]
           AND dc.[parent_column_id] = c.[column_id]
        WHERE dc.[parent_object_id] = OBJECT_ID(N'[dbo].[SubjectTypeAdminSettings]')
          AND c.[name] = N'DefaultViewMode';

        IF @DefaultViewModeConstraintName IS NOT NULL
        BEGIN
            EXEC(N'ALTER TABLE [dbo].[SubjectTypeAdminSettings] DROP CONSTRAINT [' + @DefaultViewModeConstraintName + N']');
        END;

        ALTER TABLE [dbo].[SubjectTypeAdminSettings]
        DROP COLUMN [DefaultViewMode];
    END;

    IF COL_LENGTH(N'[dbo].[SubjectTypeAdminSettings]', N'AllowRequesterOverride') IS NOT NULL
    BEGIN
        DECLARE @AllowRequesterOverrideConstraintName nvarchar(128);
        SELECT @AllowRequesterOverrideConstraintName = dc.[name]
        FROM sys.default_constraints dc
        INNER JOIN sys.columns c
            ON dc.[parent_object_id] = c.[object_id]
           AND dc.[parent_column_id] = c.[column_id]
        WHERE dc.[parent_object_id] = OBJECT_ID(N'[dbo].[SubjectTypeAdminSettings]')
          AND c.[name] = N'AllowRequesterOverride';

        IF @AllowRequesterOverrideConstraintName IS NOT NULL
        BEGIN
            EXEC(N'ALTER TABLE [dbo].[SubjectTypeAdminSettings] DROP CONSTRAINT [' + @AllowRequesterOverrideConstraintName + N']');
        END;

        ALTER TABLE [dbo].[SubjectTypeAdminSettings]
        DROP COLUMN [AllowRequesterOverride];
    END;
END
");
        }
    }
}
