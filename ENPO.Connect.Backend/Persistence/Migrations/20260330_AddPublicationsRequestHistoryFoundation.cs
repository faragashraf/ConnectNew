using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Persistence.Data;

namespace Persistence.Migrations
{
    [DbContext(typeof(ConnectContext))]
    [Migration("20260330_AddPublicationsRequestHistoryFoundation")]
    public partial class AddPublicationsRequestHistoryFoundation : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[PUB_Request]', N'U') IS NULL
    RETURN;

-- Normalize legacy status value to the Phase 1 baseline model.
UPDATE [dbo].[PUB_Request]
   SET [WorkflowStatus] = N'ReturnedForEdit'
 WHERE [WorkflowStatus] = N'Returned';

IF OBJECT_ID(N'[dbo].[PUB_RequestHistory]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[PUB_RequestHistory]
    (
        [PublicationRequestHistoryID] INT IDENTITY(1,1) NOT NULL,
        [MessageID] INT NOT NULL,
        [ActionCode] NVARCHAR(40) NOT NULL,
        [FromStatus] NVARCHAR(30) NULL,
        [ToStatus] NVARCHAR(30) NOT NULL,
        [Comment] NVARCHAR(MAX) NULL,
        [ActionBy] NVARCHAR(100) NOT NULL,
        [ActionAtUtc] DATETIME NOT NULL CONSTRAINT [DF_PUB_RequestHistory_ActionAtUtc] DEFAULT (GETUTCDATE()),
        [ReplyID] INT NULL,
        CONSTRAINT [PK_PUB_RequestHistory] PRIMARY KEY CLUSTERED ([PublicationRequestHistoryID] ASC),
        CONSTRAINT [FK_PUB_RequestHistory_PUB_Request]
            FOREIGN KEY ([MessageID]) REFERENCES [dbo].[PUB_Request]([MessageID]) ON DELETE CASCADE
    );
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name] = N'IX_PUB_RequestHistory_Message_ActionAtUtc' AND object_id = OBJECT_ID(N'[dbo].[PUB_RequestHistory]'))
BEGIN
    CREATE INDEX [IX_PUB_RequestHistory_Message_ActionAtUtc]
        ON [dbo].[PUB_RequestHistory]([MessageID], [ActionAtUtc]);
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name] = N'IX_PUB_RequestHistory_ToStatus' AND object_id = OBJECT_ID(N'[dbo].[PUB_RequestHistory]'))
BEGIN
    CREATE INDEX [IX_PUB_RequestHistory_ToStatus]
        ON [dbo].[PUB_RequestHistory]([ToStatus]);
END

-- Backfill one deterministic history row per existing request if history does not exist yet.
INSERT INTO [dbo].[PUB_RequestHistory]
(
    [MessageID],
    [ActionCode],
    [FromStatus],
    [ToStatus],
    [Comment],
    [ActionBy],
    [ActionAtUtc],
    [ReplyID]
)
SELECT
    r.[MessageID],
    N'SeedCurrentState',
    NULL,
    CASE WHEN r.[WorkflowStatus] = N'Returned' THEN N'ReturnedForEdit' ELSE r.[WorkflowStatus] END,
    N'تم ترحيل الحالة الحالية للطلب ضمن سجل الإجراءات.',
    COALESCE(NULLIF(r.[LastActionBy], N''), r.[CreatedBy], N'SYSTEM'),
    COALESCE(r.[LastActionAtUtc], r.[CreatedAtUtc], GETUTCDATE()),
    r.[FinalApprovalReplyID]
FROM [dbo].[PUB_Request] r
WHERE NOT EXISTS
(
    SELECT 1
    FROM [dbo].[PUB_RequestHistory] h
    WHERE h.[MessageID] = r.[MessageID]
);
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[PUB_RequestHistory]', N'U') IS NOT NULL
BEGIN
    DROP TABLE [dbo].[PUB_RequestHistory];
END
");
        }
    }
}
