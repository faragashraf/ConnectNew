using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Persistence.Data;

namespace Persistence.Migrations
{
    [DbContext(typeof(ConnectContext))]
    [Migration("20260408_AddSubjectRoutingTargetingModel")]
    public partial class AddSubjectRoutingTargetingModel : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[SubjectRoutingTargets]', N'U') IS NOT NULL
BEGIN
    IF COL_LENGTH(N'[dbo].[SubjectRoutingTargets]', N'SelectedNodeType') IS NULL
    BEGIN
        ALTER TABLE [dbo].[SubjectRoutingTargets]
        ADD [SelectedNodeType] [nvarchar](30) NULL;
    END

    IF COL_LENGTH(N'[dbo].[SubjectRoutingTargets]', N'SelectedNodeNumericId') IS NULL
    BEGIN
        ALTER TABLE [dbo].[SubjectRoutingTargets]
        ADD [SelectedNodeNumericId] [decimal](18,0) NULL;
    END

    IF COL_LENGTH(N'[dbo].[SubjectRoutingTargets]', N'SelectedNodeUserId') IS NULL
    BEGIN
        ALTER TABLE [dbo].[SubjectRoutingTargets]
        ADD [SelectedNodeUserId] [nvarchar](20) NULL;
    END

    IF COL_LENGTH(N'[dbo].[SubjectRoutingTargets]', N'AudienceResolutionMode') IS NULL
    BEGIN
        ALTER TABLE [dbo].[SubjectRoutingTargets]
        ADD [AudienceResolutionMode] [nvarchar](40) NULL;
    END

    IF COL_LENGTH(N'[dbo].[SubjectRoutingTargets]', N'WorkDistributionMode') IS NULL
    BEGIN
        ALTER TABLE [dbo].[SubjectRoutingTargets]
        ADD [WorkDistributionMode] [nvarchar](40) NULL;
    END
END
");

            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[SubjectRoutingTargets]', N'U') IS NOT NULL
BEGIN
    UPDATE target
    SET
        [SelectedNodeType] = COALESCE(
            [SelectedNodeType],
            CASE
                WHEN [TargetMode] = N'SpecificUnit' THEN N'OrgUnit'
                WHEN [TargetMode] = N'Position' THEN N'Position'
                WHEN [TargetMode] = N'CommitteeMembers' THEN N'SpecificUser'
                ELSE NULL
            END),
        [SelectedNodeNumericId] = COALESCE(
            [SelectedNodeNumericId],
            CASE
                WHEN [TargetMode] = N'SpecificUnit' THEN [OracleOrgUnitID]
                WHEN [TargetMode] = N'Position' THEN [PositionID]
                ELSE NULL
            END),
        [SelectedNodeUserId] = COALESCE(
            [SelectedNodeUserId],
            CASE
                WHEN [TargetMode] = N'CommitteeMembers' THEN [PositionCode]
                ELSE NULL
            END),
        [AudienceResolutionMode] = COALESCE(
            [AudienceResolutionMode],
            CASE
                WHEN [TargetMode] = N'SpecificUnit' AND [SendToLeaderOnly] = 1 THEN N'OrgUnitLeaderOnly'
                WHEN [TargetMode] = N'SpecificUnit' THEN N'OrgUnitAllMembers'
                WHEN [TargetMode] = N'Position' THEN N'PositionOccupants'
                WHEN [TargetMode] = N'CommitteeMembers' THEN N'SpecificUserOnly'
                ELSE NULL
            END),
        [WorkDistributionMode] = COALESCE(
            [WorkDistributionMode],
            CASE
                WHEN [TargetMode] = N'CommitteeMembers' THEN N'SharedInbox'
                WHEN [TargetMode] = N'SpecificUnit' AND [SendToLeaderOnly] = 1 THEN N'SharedInbox'
                WHEN [AllowMultipleReceivers] = 1 THEN N'SharedInbox'
                ELSE N'ManualAssignment'
            END)
    FROM [dbo].[SubjectRoutingTargets] target;
END
");

            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[SubjectRoutingTargets]', N'U') IS NOT NULL
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM sys.check_constraints
        WHERE [name] = N'CK_SubjectRoutingTargets_SelectedNodeType'
          AND [parent_object_id] = OBJECT_ID(N'[dbo].[SubjectRoutingTargets]')
    )
    BEGIN
        ALTER TABLE [dbo].[SubjectRoutingTargets]
        ADD CONSTRAINT [CK_SubjectRoutingTargets_SelectedNodeType]
        CHECK ([SelectedNodeType] IS NULL OR [SelectedNodeType] IN (N'OrgUnit', N'Position', N'SpecificUser'));
    END

    IF NOT EXISTS (
        SELECT 1
        FROM sys.check_constraints
        WHERE [name] = N'CK_SubjectRoutingTargets_AudienceResolutionMode'
          AND [parent_object_id] = OBJECT_ID(N'[dbo].[SubjectRoutingTargets]')
    )
    BEGIN
        ALTER TABLE [dbo].[SubjectRoutingTargets]
        ADD CONSTRAINT [CK_SubjectRoutingTargets_AudienceResolutionMode]
        CHECK ([AudienceResolutionMode] IS NULL OR [AudienceResolutionMode] IN (N'OrgUnitAllMembers', N'OrgUnitLeaderOnly', N'PositionOccupants', N'SpecificUserOnly'));
    END

    IF NOT EXISTS (
        SELECT 1
        FROM sys.check_constraints
        WHERE [name] = N'CK_SubjectRoutingTargets_WorkDistributionMode'
          AND [parent_object_id] = OBJECT_ID(N'[dbo].[SubjectRoutingTargets]')
    )
    BEGIN
        ALTER TABLE [dbo].[SubjectRoutingTargets]
        ADD CONSTRAINT [CK_SubjectRoutingTargets_WorkDistributionMode]
        CHECK ([WorkDistributionMode] IS NULL OR [WorkDistributionMode] IN (N'SharedInbox', N'AutoDistributeActive', N'ManualAssignment'));
    END
END
");

            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[SubjectRoutingTargets]', N'U') IS NOT NULL
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM sys.indexes
        WHERE [name] = N'IX_SubjectRoutingTargets_SelectedNodeType_SelectedNodeNumericId'
          AND [object_id] = OBJECT_ID(N'[dbo].[SubjectRoutingTargets]')
    )
    BEGIN
        CREATE NONCLUSTERED INDEX [IX_SubjectRoutingTargets_SelectedNodeType_SelectedNodeNumericId]
            ON [dbo].[SubjectRoutingTargets] ([SelectedNodeType], [SelectedNodeNumericId]);
    END

    IF NOT EXISTS (
        SELECT 1
        FROM sys.indexes
        WHERE [name] = N'IX_SubjectRoutingTargets_SelectedNodeUserId'
          AND [object_id] = OBJECT_ID(N'[dbo].[SubjectRoutingTargets]')
    )
    BEGIN
        CREATE NONCLUSTERED INDEX [IX_SubjectRoutingTargets_SelectedNodeUserId]
            ON [dbo].[SubjectRoutingTargets] ([SelectedNodeUserId]);
    END
END
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[SubjectRoutingTargets]', N'U') IS NOT NULL
BEGIN
    IF EXISTS (
        SELECT 1
        FROM sys.indexes
        WHERE [name] = N'IX_SubjectRoutingTargets_SelectedNodeType_SelectedNodeNumericId'
          AND [object_id] = OBJECT_ID(N'[dbo].[SubjectRoutingTargets]')
    )
    BEGIN
        DROP INDEX [IX_SubjectRoutingTargets_SelectedNodeType_SelectedNodeNumericId]
        ON [dbo].[SubjectRoutingTargets];
    END

    IF EXISTS (
        SELECT 1
        FROM sys.indexes
        WHERE [name] = N'IX_SubjectRoutingTargets_SelectedNodeUserId'
          AND [object_id] = OBJECT_ID(N'[dbo].[SubjectRoutingTargets]')
    )
    BEGIN
        DROP INDEX [IX_SubjectRoutingTargets_SelectedNodeUserId]
        ON [dbo].[SubjectRoutingTargets];
    END

    IF EXISTS (
        SELECT 1
        FROM sys.check_constraints
        WHERE [name] = N'CK_SubjectRoutingTargets_SelectedNodeType'
          AND [parent_object_id] = OBJECT_ID(N'[dbo].[SubjectRoutingTargets]')
    )
    BEGIN
        ALTER TABLE [dbo].[SubjectRoutingTargets]
        DROP CONSTRAINT [CK_SubjectRoutingTargets_SelectedNodeType];
    END

    IF EXISTS (
        SELECT 1
        FROM sys.check_constraints
        WHERE [name] = N'CK_SubjectRoutingTargets_AudienceResolutionMode'
          AND [parent_object_id] = OBJECT_ID(N'[dbo].[SubjectRoutingTargets]')
    )
    BEGIN
        ALTER TABLE [dbo].[SubjectRoutingTargets]
        DROP CONSTRAINT [CK_SubjectRoutingTargets_AudienceResolutionMode];
    END

    IF EXISTS (
        SELECT 1
        FROM sys.check_constraints
        WHERE [name] = N'CK_SubjectRoutingTargets_WorkDistributionMode'
          AND [parent_object_id] = OBJECT_ID(N'[dbo].[SubjectRoutingTargets]')
    )
    BEGIN
        ALTER TABLE [dbo].[SubjectRoutingTargets]
        DROP CONSTRAINT [CK_SubjectRoutingTargets_WorkDistributionMode];
    END

    IF COL_LENGTH(N'[dbo].[SubjectRoutingTargets]', N'SelectedNodeType') IS NOT NULL
    BEGIN
        ALTER TABLE [dbo].[SubjectRoutingTargets]
        DROP COLUMN [SelectedNodeType];
    END

    IF COL_LENGTH(N'[dbo].[SubjectRoutingTargets]', N'SelectedNodeNumericId') IS NOT NULL
    BEGIN
        ALTER TABLE [dbo].[SubjectRoutingTargets]
        DROP COLUMN [SelectedNodeNumericId];
    END

    IF COL_LENGTH(N'[dbo].[SubjectRoutingTargets]', N'SelectedNodeUserId') IS NOT NULL
    BEGIN
        ALTER TABLE [dbo].[SubjectRoutingTargets]
        DROP COLUMN [SelectedNodeUserId];
    END

    IF COL_LENGTH(N'[dbo].[SubjectRoutingTargets]', N'AudienceResolutionMode') IS NOT NULL
    BEGIN
        ALTER TABLE [dbo].[SubjectRoutingTargets]
        DROP COLUMN [AudienceResolutionMode];
    END

    IF COL_LENGTH(N'[dbo].[SubjectRoutingTargets]', N'WorkDistributionMode') IS NOT NULL
    BEGIN
        ALTER TABLE [dbo].[SubjectRoutingTargets]
        DROP COLUMN [WorkDistributionMode];
    END
END
");
        }
    }
}
