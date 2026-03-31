using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Persistence.Data;

namespace Persistence.Migrations
{
    [DbContext(typeof(ConnectContext))]
    [Migration("20260331_AddSummerUnitFreeze")]
    public partial class AddSummerUnitFreeze : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[SummerUnitFreezeBatches]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[SummerUnitFreezeBatches](
        [FreezeID] [int] IDENTITY(1,1) NOT NULL,
        [CategoryID] [int] NOT NULL,
        [WaveCode] [nvarchar](50) NOT NULL,
        [FamilyCount] [int] NOT NULL,
        [RequestedUnitsCount] [int] NOT NULL,
        [FreezeType] [nvarchar](50) NOT NULL CONSTRAINT [DF_SummerUnitFreezeBatches_FreezeType] DEFAULT (N'GENERAL'),
        [Reason] [nvarchar](200) NULL,
        [Notes] [nvarchar](1000) NULL,
        [CreatedBy] [nvarchar](50) NOT NULL,
        [CreatedAtUtc] [datetime2](7) NOT NULL CONSTRAINT [DF_SummerUnitFreezeBatches_CreatedAtUtc] DEFAULT (GETUTCDATE()),
        [IsActive] [bit] NOT NULL CONSTRAINT [DF_SummerUnitFreezeBatches_IsActive] DEFAULT ((1)),
        [ReleasedAtUtc] [datetime2](7) NULL,
        [ReleasedBy] [nvarchar](50) NULL,
        CONSTRAINT [PK_SummerUnitFreezeBatches] PRIMARY KEY CLUSTERED ([FreezeID] ASC)
    );
END
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_SummerUnitFreezeBatches_Search'
      AND object_id = OBJECT_ID(N'[dbo].[SummerUnitFreezeBatches]')
)
BEGIN
    CREATE NONCLUSTERED INDEX [IX_SummerUnitFreezeBatches_Search]
        ON [dbo].[SummerUnitFreezeBatches] ([CategoryID], [WaveCode], [FamilyCount], [IsActive]);
END
");

            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[SummerUnitFreezeDetails]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[SummerUnitFreezeDetails](
        [FreezeDetailID] [int] IDENTITY(1,1) NOT NULL,
        [FreezeID] [int] NOT NULL,
        [SlotNumber] [int] NOT NULL,
        [Status] [nvarchar](40) NOT NULL,
        [AssignedMessageID] [int] NULL,
        [AssignedAtUtc] [datetime2](7) NULL,
        [ReleasedAtUtc] [datetime2](7) NULL,
        [ReleasedBy] [nvarchar](50) NULL,
        [LastStatusChangedAtUtc] [datetime2](7) NOT NULL CONSTRAINT [DF_SummerUnitFreezeDetails_LastStatusChangedAtUtc] DEFAULT (GETUTCDATE()),
        CONSTRAINT [PK_SummerUnitFreezeDetails] PRIMARY KEY CLUSTERED ([FreezeDetailID] ASC),
        CONSTRAINT [FK_SummerUnitFreezeDetails_Batches] FOREIGN KEY ([FreezeID])
            REFERENCES [dbo].[SummerUnitFreezeBatches] ([FreezeID])
            ON DELETE CASCADE
    );
END
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_SummerUnitFreezeDetails_Freeze_Slot'
      AND object_id = OBJECT_ID(N'[dbo].[SummerUnitFreezeDetails]')
)
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX [IX_SummerUnitFreezeDetails_Freeze_Slot]
        ON [dbo].[SummerUnitFreezeDetails] ([FreezeID], [SlotNumber]);
END
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_SummerUnitFreezeDetails_AssignedMessage'
      AND object_id = OBJECT_ID(N'[dbo].[SummerUnitFreezeDetails]')
)
BEGIN
    CREATE NONCLUSTERED INDEX [IX_SummerUnitFreezeDetails_AssignedMessage]
        ON [dbo].[SummerUnitFreezeDetails] ([AssignedMessageID]);
END
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[SummerUnitFreezeDetails]', N'U') IS NOT NULL
BEGIN
    DROP TABLE [dbo].[SummerUnitFreezeDetails];
END
");

            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[SummerUnitFreezeBatches]', N'U') IS NOT NULL
BEGIN
    DROP TABLE [dbo].[SummerUnitFreezeBatches];
END
");
        }
    }
}
