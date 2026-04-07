using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Persistence.Data;

namespace Persistence.Migrations
{
    [DbContext(typeof(ConnectContext))]
    [Migration("20260407_AddNotificationRules")]
    public partial class AddNotificationRules : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[NotificationRules]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[NotificationRules](
        [Id] [int] IDENTITY(1,1) NOT NULL,
        [SubjectTypeID] [int] NOT NULL,
        [EventType] [nvarchar](20) NOT NULL,
        [RecipientType] [nvarchar](20) NOT NULL,
        [RecipientValue] [nvarchar](200) NOT NULL,
        [Template] [nvarchar](2000) NOT NULL,
        [IsActive] [bit] NOT NULL CONSTRAINT [DF_NotificationRules_IsActive] DEFAULT ((1)),
        [CreatedBy] [nvarchar](64) NOT NULL,
        [CreatedAtUtc] [datetime2](7) NOT NULL CONSTRAINT [DF_NotificationRules_CreatedAtUtc] DEFAULT (GETUTCDATE()),
        [LastModifiedBy] [nvarchar](64) NULL,
        [LastModifiedAtUtc] [datetime2](7) NULL,
        CONSTRAINT [PK_NotificationRules] PRIMARY KEY CLUSTERED ([Id] ASC)
    );
END
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_NotificationRules_SubjectType_EventType'
      AND object_id = OBJECT_ID(N'[dbo].[NotificationRules]')
)
BEGIN
    CREATE NONCLUSTERED INDEX [IX_NotificationRules_SubjectType_EventType]
        ON [dbo].[NotificationRules] ([SubjectTypeID], [EventType]);
END
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_NotificationRules_IsActive'
      AND object_id = OBJECT_ID(N'[dbo].[NotificationRules]')
)
BEGIN
    CREATE NONCLUSTERED INDEX [IX_NotificationRules_IsActive]
        ON [dbo].[NotificationRules] ([IsActive]);
END
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'UX_NotificationRules_SubjectType_EventType_Recipient'
      AND object_id = OBJECT_ID(N'[dbo].[NotificationRules]')
)
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX [UX_NotificationRules_SubjectType_EventType_Recipient]
        ON [dbo].[NotificationRules] ([SubjectTypeID], [EventType], [RecipientType], [RecipientValue]);
END
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[NotificationRules]', N'U') IS NOT NULL
BEGIN
    DROP TABLE [dbo].[NotificationRules];
END
");
        }
    }
}
