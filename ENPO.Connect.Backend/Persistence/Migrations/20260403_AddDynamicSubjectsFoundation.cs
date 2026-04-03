using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Persistence.Data;

namespace Persistence.Migrations
{
    [DbContext(typeof(ConnectContext))]
    [Migration("20260403_AddDynamicSubjectsFoundation")]
    public partial class AddDynamicSubjectsFoundation : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[SubjectEnvelopes]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[SubjectEnvelopes](
        [EnvelopeID] [int] IDENTITY(1,1) NOT NULL,
        [EnvelopeRef] [nvarchar](100) NOT NULL,
        [IncomingDate] [datetime2](7) NOT NULL,
        [SourceEntity] [nvarchar](250) NULL,
        [DeliveryDelegate] [nvarchar](250) NULL,
        [Notes] [nvarchar](2000) NULL,
        [CreatedBy] [nvarchar](64) NOT NULL,
        [CreatedAtUtc] [datetime2](7) NOT NULL CONSTRAINT [DF_SubjectEnvelopes_CreatedAtUtc] DEFAULT (GETUTCDATE()),
        [LastModifiedBy] [nvarchar](64) NULL,
        [LastModifiedAtUtc] [datetime2](7) NULL,
        CONSTRAINT [PK_SubjectEnvelopes] PRIMARY KEY CLUSTERED ([EnvelopeID] ASC)
    );
END
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'UX_SubjectEnvelopes_EnvelopeRef'
      AND object_id = OBJECT_ID(N'[dbo].[SubjectEnvelopes]')
)
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX [UX_SubjectEnvelopes_EnvelopeRef]
        ON [dbo].[SubjectEnvelopes] ([EnvelopeRef]);
END
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_SubjectEnvelopes_IncomingDate'
      AND object_id = OBJECT_ID(N'[dbo].[SubjectEnvelopes]')
)
BEGIN
    CREATE NONCLUSTERED INDEX [IX_SubjectEnvelopes_IncomingDate]
        ON [dbo].[SubjectEnvelopes] ([IncomingDate]);
END
");

            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[SubjectEnvelopeLinks]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[SubjectEnvelopeLinks](
        [EnvelopeLinkID] [int] IDENTITY(1,1) NOT NULL,
        [EnvelopeID] [int] NOT NULL,
        [MessageID] [int] NOT NULL,
        [LinkedBy] [nvarchar](64) NOT NULL,
        [LinkedAtUtc] [datetime2](7) NOT NULL CONSTRAINT [DF_SubjectEnvelopeLinks_LinkedAtUtc] DEFAULT (GETUTCDATE()),
        CONSTRAINT [PK_SubjectEnvelopeLinks] PRIMARY KEY CLUSTERED ([EnvelopeLinkID] ASC),
        CONSTRAINT [FK_SubjectEnvelopeLinks_SubjectEnvelopes] FOREIGN KEY ([EnvelopeID])
            REFERENCES [dbo].[SubjectEnvelopes] ([EnvelopeID])
            ON DELETE CASCADE
    );
END
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_SubjectEnvelopeLinks_EnvelopeID'
      AND object_id = OBJECT_ID(N'[dbo].[SubjectEnvelopeLinks]')
)
BEGIN
    CREATE NONCLUSTERED INDEX [IX_SubjectEnvelopeLinks_EnvelopeID]
        ON [dbo].[SubjectEnvelopeLinks] ([EnvelopeID]);
END
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_SubjectEnvelopeLinks_MessageID'
      AND object_id = OBJECT_ID(N'[dbo].[SubjectEnvelopeLinks]')
)
BEGIN
    CREATE NONCLUSTERED INDEX [IX_SubjectEnvelopeLinks_MessageID]
        ON [dbo].[SubjectEnvelopeLinks] ([MessageID]);
END
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'UX_SubjectEnvelopeLinks_Envelope_Message'
      AND object_id = OBJECT_ID(N'[dbo].[SubjectEnvelopeLinks]')
)
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX [UX_SubjectEnvelopeLinks_Envelope_Message]
        ON [dbo].[SubjectEnvelopeLinks] ([EnvelopeID], [MessageID]);
END
");

            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[SubjectReferencePolicies]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[SubjectReferencePolicies](
        [PolicyID] [int] IDENTITY(1,1) NOT NULL,
        [CategoryID] [int] NOT NULL,
        [Prefix] [nvarchar](40) NOT NULL,
        [Separator] [nvarchar](10) NOT NULL CONSTRAINT [DF_SubjectReferencePolicies_Separator] DEFAULT (N'-'),
        [SourceFieldKeys] [nvarchar](500) NULL,
        [IncludeYear] [bit] NOT NULL CONSTRAINT [DF_SubjectReferencePolicies_IncludeYear] DEFAULT ((1)),
        [UseSequence] [bit] NOT NULL CONSTRAINT [DF_SubjectReferencePolicies_UseSequence] DEFAULT ((1)),
        [SequenceName] [nvarchar](80) NULL,
        [IsActive] [bit] NOT NULL CONSTRAINT [DF_SubjectReferencePolicies_IsActive] DEFAULT ((1)),
        [CreatedBy] [nvarchar](64) NOT NULL,
        [CreatedAtUtc] [datetime2](7) NOT NULL CONSTRAINT [DF_SubjectReferencePolicies_CreatedAtUtc] DEFAULT (GETUTCDATE()),
        [LastModifiedBy] [nvarchar](64) NULL,
        [LastModifiedAtUtc] [datetime2](7) NULL,
        CONSTRAINT [PK_SubjectReferencePolicies] PRIMARY KEY CLUSTERED ([PolicyID] ASC)
    );
END
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'UX_SubjectReferencePolicies_CategoryID'
      AND object_id = OBJECT_ID(N'[dbo].[SubjectReferencePolicies]')
)
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX [UX_SubjectReferencePolicies_CategoryID]
        ON [dbo].[SubjectReferencePolicies] ([CategoryID]);
END
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_SubjectReferencePolicies_IsActive'
      AND object_id = OBJECT_ID(N'[dbo].[SubjectReferencePolicies]')
)
BEGIN
    CREATE NONCLUSTERED INDEX [IX_SubjectReferencePolicies_IsActive]
        ON [dbo].[SubjectReferencePolicies] ([IsActive]);
END
");

            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[SubjectStatusHistory]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[SubjectStatusHistory](
        [StatusHistoryID] [int] IDENTITY(1,1) NOT NULL,
        [MessageID] [int] NOT NULL,
        [OldStatus] [tinyint] NULL,
        [NewStatus] [tinyint] NOT NULL,
        [Notes] [nvarchar](1000) NULL,
        [ChangedBy] [nvarchar](64) NOT NULL,
        [ChangedAtUtc] [datetime2](7) NOT NULL CONSTRAINT [DF_SubjectStatusHistory_ChangedAtUtc] DEFAULT (GETUTCDATE()),
        CONSTRAINT [PK_SubjectStatusHistory] PRIMARY KEY CLUSTERED ([StatusHistoryID] ASC)
    );
END
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_SubjectStatusHistory_MessageID'
      AND object_id = OBJECT_ID(N'[dbo].[SubjectStatusHistory]')
)
BEGIN
    CREATE NONCLUSTERED INDEX [IX_SubjectStatusHistory_MessageID]
        ON [dbo].[SubjectStatusHistory] ([MessageID]);
END
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_SubjectStatusHistory_ChangedAtUtc'
      AND object_id = OBJECT_ID(N'[dbo].[SubjectStatusHistory]')
)
BEGIN
    CREATE NONCLUSTERED INDEX [IX_SubjectStatusHistory_ChangedAtUtc]
        ON [dbo].[SubjectStatusHistory] ([ChangedAtUtc]);
END
");

            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[SubjectTimelineEvents]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[SubjectTimelineEvents](
        [TimelineEventID] [bigint] IDENTITY(1,1) NOT NULL,
        [MessageID] [int] NOT NULL,
        [EventType] [nvarchar](80) NOT NULL,
        [EventTitle] [nvarchar](250) NOT NULL,
        [EventPayloadJson] [nvarchar](max) NULL,
        [StatusFrom] [tinyint] NULL,
        [StatusTo] [tinyint] NULL,
        [CreatedBy] [nvarchar](64) NOT NULL,
        [CreatedAtUtc] [datetime2](7) NOT NULL CONSTRAINT [DF_SubjectTimelineEvents_CreatedAtUtc] DEFAULT (GETUTCDATE()),
        CONSTRAINT [PK_SubjectTimelineEvents] PRIMARY KEY CLUSTERED ([TimelineEventID] ASC)
    );
END
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_SubjectTimelineEvents_MessageID'
      AND object_id = OBJECT_ID(N'[dbo].[SubjectTimelineEvents]')
)
BEGIN
    CREATE NONCLUSTERED INDEX [IX_SubjectTimelineEvents_MessageID]
        ON [dbo].[SubjectTimelineEvents] ([MessageID]);
END
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_SubjectTimelineEvents_CreatedAtUtc'
      AND object_id = OBJECT_ID(N'[dbo].[SubjectTimelineEvents]')
)
BEGIN
    CREATE NONCLUSTERED INDEX [IX_SubjectTimelineEvents_CreatedAtUtc]
        ON [dbo].[SubjectTimelineEvents] ([CreatedAtUtc]);
END
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_SubjectTimelineEvents_EventType'
      AND object_id = OBJECT_ID(N'[dbo].[SubjectTimelineEvents]')
)
BEGIN
    CREATE NONCLUSTERED INDEX [IX_SubjectTimelineEvents_EventType]
        ON [dbo].[SubjectTimelineEvents] ([EventType]);
END
");

            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[SubjectTasks]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[SubjectTasks](
        [TaskID] [bigint] IDENTITY(1,1) NOT NULL,
        [MessageID] [int] NOT NULL,
        [ActionTitle] [nvarchar](250) NOT NULL,
        [ActionDescription] [nvarchar](2000) NULL,
        [AssignedToUserID] [nvarchar](64) NULL,
        [AssignedUnitID] [nvarchar](50) NULL,
        [Status] [tinyint] NOT NULL CONSTRAINT [DF_SubjectTasks_Status] DEFAULT ((0)),
        [DueDateUtc] [datetime2](7) NULL,
        [CompletedAtUtc] [datetime2](7) NULL,
        [CreatedBy] [nvarchar](64) NOT NULL,
        [CreatedAtUtc] [datetime2](7) NOT NULL CONSTRAINT [DF_SubjectTasks_CreatedAtUtc] DEFAULT (GETUTCDATE()),
        [LastModifiedBy] [nvarchar](64) NULL,
        [LastModifiedAtUtc] [datetime2](7) NULL,
        CONSTRAINT [PK_SubjectTasks] PRIMARY KEY CLUSTERED ([TaskID] ASC)
    );
END
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_SubjectTasks_MessageID'
      AND object_id = OBJECT_ID(N'[dbo].[SubjectTasks]')
)
BEGIN
    CREATE NONCLUSTERED INDEX [IX_SubjectTasks_MessageID]
        ON [dbo].[SubjectTasks] ([MessageID]);
END
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_SubjectTasks_AssignedUnitID'
      AND object_id = OBJECT_ID(N'[dbo].[SubjectTasks]')
)
BEGIN
    CREATE NONCLUSTERED INDEX [IX_SubjectTasks_AssignedUnitID]
        ON [dbo].[SubjectTasks] ([AssignedUnitID]);
END
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_SubjectTasks_AssignedUserID'
      AND object_id = OBJECT_ID(N'[dbo].[SubjectTasks]')
)
BEGIN
    CREATE NONCLUSTERED INDEX [IX_SubjectTasks_AssignedUserID]
        ON [dbo].[SubjectTasks] ([AssignedToUserID]);
END
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_SubjectTasks_Status'
      AND object_id = OBJECT_ID(N'[dbo].[SubjectTasks]')
)
BEGIN
    CREATE NONCLUSTERED INDEX [IX_SubjectTasks_Status]
        ON [dbo].[SubjectTasks] ([Status]);
END
");

            migrationBuilder.Sql(@"
IF EXISTS (SELECT 1 FROM [dbo].[CDCategory] WHERE [CatId] = 60)
   AND NOT EXISTS (SELECT 1 FROM [dbo].[SubjectReferencePolicies] WHERE [CategoryID] = 60)
BEGIN
    INSERT INTO [dbo].[SubjectReferencePolicies]
    (
        [CategoryID],
        [Prefix],
        [Separator],
        [SourceFieldKeys],
        [IncludeYear],
        [UseSequence],
        [SequenceName],
        [IsActive],
        [CreatedBy],
        [CreatedAtUtc],
        [LastModifiedBy],
        [LastModifiedAtUtc]
    )
    VALUES
    (
        60,
        N'SUBJ60',
        N'-',
        NULL,
        1,
        1,
        N'Seq_Tickets',
        1,
        N'SYSTEM',
        GETUTCDATE(),
        N'SYSTEM',
        GETUTCDATE()
    );
END
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[SubjectTasks]', N'U') IS NOT NULL
BEGIN
    DROP TABLE [dbo].[SubjectTasks];
END
");

            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[SubjectTimelineEvents]', N'U') IS NOT NULL
BEGIN
    DROP TABLE [dbo].[SubjectTimelineEvents];
END
");

            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[SubjectStatusHistory]', N'U') IS NOT NULL
BEGIN
    DROP TABLE [dbo].[SubjectStatusHistory];
END
");

            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[SubjectReferencePolicies]', N'U') IS NOT NULL
BEGIN
    DROP TABLE [dbo].[SubjectReferencePolicies];
END
");

            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[SubjectEnvelopeLinks]', N'U') IS NOT NULL
BEGIN
    DROP TABLE [dbo].[SubjectEnvelopeLinks];
END
");

            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[SubjectEnvelopes]', N'U') IS NOT NULL
BEGIN
    DROP TABLE [dbo].[SubjectEnvelopes];
END
");
        }
    }
}
