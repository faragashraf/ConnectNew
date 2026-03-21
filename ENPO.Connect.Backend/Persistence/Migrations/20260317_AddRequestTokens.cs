using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Persistence.Data;

namespace Persistence.Migrations
{
    [DbContext(typeof(ConnectContext))]
    [Migration("20260317_AddRequestTokens")]
    public partial class AddRequestTokens : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Idempotent create to support environments where table exists but migration history is missing.
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
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[RequestTokens]', N'U') IS NOT NULL
BEGIN
    DROP TABLE [dbo].[RequestTokens];
END
");
        }
    }
}
