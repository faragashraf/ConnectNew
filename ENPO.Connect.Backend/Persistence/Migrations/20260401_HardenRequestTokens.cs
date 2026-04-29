using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Persistence.Data;

namespace Persistence.Migrations
{
    [DbContext(typeof(ConnectContext))]
    [Migration("20260401_HardenRequestTokens")]
    public partial class HardenRequestTokens : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[RequestTokens]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[RequestTokens](
        [Token] [nvarchar](200) NOT NULL,
        [MessageID] [int] NOT NULL,
        [CreatedAt] [datetime] NOT NULL CONSTRAINT [DF_RequestTokens_CreatedAt] DEFAULT (GETUTCDATE()),
        [ExpiresAt] [datetime] NULL,
        CONSTRAINT [PK_RequestTokens] PRIMARY KEY CLUSTERED ([Token] ASC)
    );
END
");

            migrationBuilder.Sql(@"
IF COL_LENGTH('dbo.RequestTokens', 'Id') IS NULL
BEGIN
    ALTER TABLE [dbo].[RequestTokens]
    ADD [Id] BIGINT IDENTITY(1,1) NOT NULL;
END
");

            migrationBuilder.Sql(@"
IF COL_LENGTH('dbo.RequestTokens', 'TokenHash') IS NULL
BEGIN
    ALTER TABLE [dbo].[RequestTokens]
    ADD [TokenHash] NVARCHAR(128) NULL;
END
");

            migrationBuilder.Sql(@"
IF COL_LENGTH('dbo.RequestTokens', 'TokenPurpose') IS NULL
BEGIN
    ALTER TABLE [dbo].[RequestTokens]
    ADD [TokenPurpose] NVARCHAR(100) NULL;
END
");

            migrationBuilder.Sql(@"
IF COL_LENGTH('dbo.RequestTokens', 'TokenPurpose') IS NOT NULL
BEGIN
    UPDATE [dbo].[RequestTokens]
    SET [TokenPurpose] = N'GENERIC_REQUEST_LINK'
    WHERE [TokenPurpose] IS NULL;
END
");

            migrationBuilder.Sql(@"
IF COL_LENGTH('dbo.RequestTokens', 'IsUsed') IS NULL
BEGIN
    ALTER TABLE [dbo].[RequestTokens]
    ADD [IsUsed] BIT NOT NULL CONSTRAINT [DF_RequestTokens_IsUsed] DEFAULT ((0));
END
");

            migrationBuilder.Sql(@"
IF COL_LENGTH('dbo.RequestTokens', 'IsOneTimeUse') IS NULL
BEGIN
    ALTER TABLE [dbo].[RequestTokens]
    ADD [IsOneTimeUse] BIT NOT NULL CONSTRAINT [DF_RequestTokens_IsOneTimeUse] DEFAULT ((0));
END
");

            migrationBuilder.Sql(@"
IF COL_LENGTH('dbo.RequestTokens', 'UsedAt') IS NULL
BEGIN
    ALTER TABLE [dbo].[RequestTokens]
    ADD [UsedAt] DATETIME NULL;
END
");

            migrationBuilder.Sql(@"
IF COL_LENGTH('dbo.RequestTokens', 'CreatedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[RequestTokens]
    ADD [CreatedBy] NVARCHAR(64) NULL;
END
");

            migrationBuilder.Sql(@"
IF COL_LENGTH('dbo.RequestTokens', 'UserId') IS NULL
BEGIN
    ALTER TABLE [dbo].[RequestTokens]
    ADD [UserId] NVARCHAR(64) NULL;
END
");

            migrationBuilder.Sql(@"
IF COL_LENGTH('dbo.RequestTokens', 'RevokedAt') IS NULL
BEGIN
    ALTER TABLE [dbo].[RequestTokens]
    ADD [RevokedAt] DATETIME NULL;
END
");

            migrationBuilder.Sql(@"
IF COL_LENGTH('dbo.RequestTokens', 'RevokedBy') IS NULL
BEGIN
    ALTER TABLE [dbo].[RequestTokens]
    ADD [RevokedBy] NVARCHAR(64) NULL;
END
");

            migrationBuilder.Sql(@"
UPDATE [dbo].[RequestTokens]
SET [TokenHash] = LOWER(CONVERT(VARCHAR(64), HASHBYTES('SHA2_256', CAST([Token] AS NVARCHAR(4000))), 2))
WHERE [TokenHash] IS NULL
  AND [Token] IS NOT NULL;
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'UX_RequestTokens_TokenHash'
      AND object_id = OBJECT_ID(N'[dbo].[RequestTokens]')
)
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX [UX_RequestTokens_TokenHash]
        ON [dbo].[RequestTokens]([TokenHash])
        WHERE [TokenHash] IS NOT NULL;
END
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_RequestTokens_Id'
      AND object_id = OBJECT_ID(N'[dbo].[RequestTokens]')
)
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX [IX_RequestTokens_Id]
        ON [dbo].[RequestTokens]([Id]);
END
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_RequestTokens_MessagePurposeUserActive'
      AND object_id = OBJECT_ID(N'[dbo].[RequestTokens]')
)
BEGIN
    CREATE NONCLUSTERED INDEX [IX_RequestTokens_MessagePurposeUserActive]
        ON [dbo].[RequestTokens]([MessageID], [TokenPurpose], [UserId], [RevokedAt]);
END
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_RequestTokens_MessagePurposeUserActive'
      AND object_id = OBJECT_ID(N'[dbo].[RequestTokens]')
)
BEGIN
    DROP INDEX [IX_RequestTokens_MessagePurposeUserActive] ON [dbo].[RequestTokens];
END
");

            migrationBuilder.Sql(@"
IF EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_RequestTokens_Id'
      AND object_id = OBJECT_ID(N'[dbo].[RequestTokens]')
)
BEGIN
    DROP INDEX [IX_RequestTokens_Id] ON [dbo].[RequestTokens];
END
");

            migrationBuilder.Sql(@"
IF EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'UX_RequestTokens_TokenHash'
      AND object_id = OBJECT_ID(N'[dbo].[RequestTokens]')
)
BEGIN
    DROP INDEX [UX_RequestTokens_TokenHash] ON [dbo].[RequestTokens];
END
");

            migrationBuilder.Sql(@"
IF COL_LENGTH('dbo.RequestTokens', 'RevokedBy') IS NOT NULL
BEGIN
    ALTER TABLE [dbo].[RequestTokens] DROP COLUMN [RevokedBy];
END
");

            migrationBuilder.Sql(@"
IF COL_LENGTH('dbo.RequestTokens', 'RevokedAt') IS NOT NULL
BEGIN
    ALTER TABLE [dbo].[RequestTokens] DROP COLUMN [RevokedAt];
END
");

            migrationBuilder.Sql(@"
IF COL_LENGTH('dbo.RequestTokens', 'UserId') IS NOT NULL
BEGIN
    ALTER TABLE [dbo].[RequestTokens] DROP COLUMN [UserId];
END
");

            migrationBuilder.Sql(@"
IF COL_LENGTH('dbo.RequestTokens', 'CreatedBy') IS NOT NULL
BEGIN
    ALTER TABLE [dbo].[RequestTokens] DROP COLUMN [CreatedBy];
END
");

            migrationBuilder.Sql(@"
IF COL_LENGTH('dbo.RequestTokens', 'UsedAt') IS NOT NULL
BEGIN
    ALTER TABLE [dbo].[RequestTokens] DROP COLUMN [UsedAt];
END
");

            migrationBuilder.Sql(@"
IF COL_LENGTH('dbo.RequestTokens', 'IsOneTimeUse') IS NOT NULL
BEGIN
    ALTER TABLE [dbo].[RequestTokens] DROP COLUMN [IsOneTimeUse];
END
");

            migrationBuilder.Sql(@"
IF COL_LENGTH('dbo.RequestTokens', 'IsUsed') IS NOT NULL
BEGIN
    ALTER TABLE [dbo].[RequestTokens] DROP COLUMN [IsUsed];
END
");

            migrationBuilder.Sql(@"
IF COL_LENGTH('dbo.RequestTokens', 'TokenPurpose') IS NOT NULL
BEGIN
    ALTER TABLE [dbo].[RequestTokens] DROP COLUMN [TokenPurpose];
END
");

            migrationBuilder.Sql(@"
IF COL_LENGTH('dbo.RequestTokens', 'TokenHash') IS NOT NULL
BEGIN
    ALTER TABLE [dbo].[RequestTokens] DROP COLUMN [TokenHash];
END
");

            migrationBuilder.Sql(@"
IF COL_LENGTH('dbo.RequestTokens', 'Id') IS NOT NULL
BEGIN
    ALTER TABLE [dbo].[RequestTokens] DROP COLUMN [Id];
END
");
        }
    }
}
