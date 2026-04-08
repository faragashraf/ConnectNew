using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Persistence.Data;

namespace Persistence.Migrations
{
    [DbContext(typeof(ConnectContext))]
    [Migration("20260408_AddSubjectTypeRequestAvailability")]
    public partial class AddSubjectTypeRequestAvailability : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[SubjectTypeRequestAvailability]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[SubjectTypeRequestAvailability](
        [CategoryID] [int] NOT NULL,
        [AvailabilityMode] [nvarchar](20) NOT NULL CONSTRAINT [DF_SubjectTypeRequestAvailability_AvailabilityMode] DEFAULT (N'Public'),
        [SelectedNodeType] [nvarchar](20) NULL,
        [SelectedNodeNumericId] [decimal](18,0) NULL,
        [SelectedNodeUserId] [nvarchar](20) NULL,
        [SelectionLabelAr] [nvarchar](300) NULL,
        [SelectionPathAr] [nvarchar](1000) NULL,
        [LastModifiedBy] [nvarchar](64) NOT NULL CONSTRAINT [DF_SubjectTypeRequestAvailability_LastModifiedBy] DEFAULT (N'SYSTEM'),
        [LastModifiedAtUtc] [datetime2](7) NOT NULL CONSTRAINT [DF_SubjectTypeRequestAvailability_LastModifiedAtUtc] DEFAULT (GETUTCDATE()),
        CONSTRAINT [PK_SubjectTypeRequestAvailability] PRIMARY KEY CLUSTERED ([CategoryID] ASC)
    );
END
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE [name] = N'FK_SubjectTypeRequestAvailability_CDCategory'
      AND [parent_object_id] = OBJECT_ID(N'[dbo].[SubjectTypeRequestAvailability]')
)
BEGIN
    ALTER TABLE [dbo].[SubjectTypeRequestAvailability]
    ADD CONSTRAINT [FK_SubjectTypeRequestAvailability_CDCategory]
        FOREIGN KEY ([CategoryID]) REFERENCES [dbo].[CDCategory] ([CatId])
        ON DELETE CASCADE;
END
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE [name] = N'CK_SubjectTypeRequestAvailability_AvailabilityMode'
      AND [parent_object_id] = OBJECT_ID(N'[dbo].[SubjectTypeRequestAvailability]')
)
BEGIN
    ALTER TABLE [dbo].[SubjectTypeRequestAvailability]
    ADD CONSTRAINT [CK_SubjectTypeRequestAvailability_AvailabilityMode]
    CHECK ([AvailabilityMode] IN (N'Public', N'Restricted'));
END
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE [name] = N'CK_SubjectTypeRequestAvailability_SelectedNodeType'
      AND [parent_object_id] = OBJECT_ID(N'[dbo].[SubjectTypeRequestAvailability]')
)
BEGIN
    ALTER TABLE [dbo].[SubjectTypeRequestAvailability]
    ADD CONSTRAINT [CK_SubjectTypeRequestAvailability_SelectedNodeType]
    CHECK (
        [SelectedNodeType] IS NULL
        OR [SelectedNodeType] IN (N'OrgUnit', N'Position', N'SpecificUser')
    );
END
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE [name] = N'CK_SubjectTypeRequestAvailability_PublicShape'
      AND [parent_object_id] = OBJECT_ID(N'[dbo].[SubjectTypeRequestAvailability]')
)
BEGIN
    ALTER TABLE [dbo].[SubjectTypeRequestAvailability]
    ADD CONSTRAINT [CK_SubjectTypeRequestAvailability_PublicShape]
    CHECK (
        [AvailabilityMode] <> N'Public'
        OR (
            [SelectedNodeType] IS NULL
            AND [SelectedNodeNumericId] IS NULL
            AND [SelectedNodeUserId] IS NULL
        )
    );
END
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE [name] = N'CK_SubjectTypeRequestAvailability_RestrictedShape'
      AND [parent_object_id] = OBJECT_ID(N'[dbo].[SubjectTypeRequestAvailability]')
)
BEGIN
    ALTER TABLE [dbo].[SubjectTypeRequestAvailability]
    ADD CONSTRAINT [CK_SubjectTypeRequestAvailability_RestrictedShape]
    CHECK (
        [AvailabilityMode] <> N'Restricted'
        OR (
            [SelectedNodeType] IS NOT NULL
            AND (
                (
                    [SelectedNodeType] IN (N'OrgUnit', N'Position')
                    AND [SelectedNodeNumericId] IS NOT NULL
                    AND [SelectedNodeNumericId] > 0
                    AND [SelectedNodeUserId] IS NULL
                )
                OR (
                    [SelectedNodeType] = N'SpecificUser'
                    AND [SelectedNodeNumericId] IS NULL
                    AND [SelectedNodeUserId] IS NOT NULL
                    AND LEN(LTRIM(RTRIM([SelectedNodeUserId]))) > 0
                )
            )
        )
    );
END
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE [name] = N'IX_SubjectTypeRequestAvailability_AvailabilityMode'
      AND [object_id] = OBJECT_ID(N'[dbo].[SubjectTypeRequestAvailability]')
)
BEGIN
    CREATE NONCLUSTERED INDEX [IX_SubjectTypeRequestAvailability_AvailabilityMode]
        ON [dbo].[SubjectTypeRequestAvailability] ([AvailabilityMode]);
END
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE [name] = N'IX_SubjectTypeRequestAvailability_SelectedNodeType_SelectedNodeNumericId'
      AND [object_id] = OBJECT_ID(N'[dbo].[SubjectTypeRequestAvailability]')
)
BEGIN
    CREATE NONCLUSTERED INDEX [IX_SubjectTypeRequestAvailability_SelectedNodeType_SelectedNodeNumericId]
        ON [dbo].[SubjectTypeRequestAvailability] ([SelectedNodeType], [SelectedNodeNumericId]);
END
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE [name] = N'IX_SubjectTypeRequestAvailability_SelectedNodeUserId'
      AND [object_id] = OBJECT_ID(N'[dbo].[SubjectTypeRequestAvailability]')
)
BEGIN
    CREATE NONCLUSTERED INDEX [IX_SubjectTypeRequestAvailability_SelectedNodeUserId]
        ON [dbo].[SubjectTypeRequestAvailability] ([SelectedNodeUserId]);
END
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[SubjectTypeRequestAvailability]', N'U') IS NOT NULL
BEGIN
    DROP TABLE [dbo].[SubjectTypeRequestAvailability];
END
");
        }
    }
}
