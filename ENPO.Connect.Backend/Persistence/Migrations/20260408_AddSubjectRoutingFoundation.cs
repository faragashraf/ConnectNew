using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Persistence.Data;

namespace Persistence.Migrations
{
    [DbContext(typeof(ConnectContext))]
    [Migration("20260408_AddSubjectRoutingFoundation")]
    public partial class AddSubjectRoutingFoundation : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[SubjectRoutingProfiles]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[SubjectRoutingProfiles](
        [Id] [int] IDENTITY(1,1) NOT NULL,
        [SubjectTypeID] [int] NOT NULL,
        [NameAr] [nvarchar](200) NOT NULL,
        [DescriptionAr] [nvarchar](2000) NULL,
        [IsActive] [bit] NOT NULL CONSTRAINT [DF_SubjectRoutingProfiles_IsActive] DEFAULT ((1)),
        [DirectionMode] [nvarchar](20) NOT NULL CONSTRAINT [DF_SubjectRoutingProfiles_DirectionMode] DEFAULT (N'Both'),
        [StartStepID] [int] NULL,
        [VersionNo] [int] NOT NULL CONSTRAINT [DF_SubjectRoutingProfiles_VersionNo] DEFAULT ((1)),
        [CreatedBy] [nvarchar](64) NOT NULL CONSTRAINT [DF_SubjectRoutingProfiles_CreatedBy] DEFAULT (N'SYSTEM'),
        [CreatedDate] [datetime2](7) NOT NULL CONSTRAINT [DF_SubjectRoutingProfiles_CreatedDate] DEFAULT (GETUTCDATE()),
        [LastModifiedBy] [nvarchar](64) NULL,
        [LastModifiedDate] [datetime2](7) NULL,
        CONSTRAINT [PK_SubjectRoutingProfiles] PRIMARY KEY CLUSTERED ([Id] ASC)
    );
END
");

            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[SubjectRoutingSteps]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[SubjectRoutingSteps](
        [Id] [int] IDENTITY(1,1) NOT NULL,
        [RoutingProfileID] [int] NOT NULL,
        [StepCode] [nvarchar](50) NOT NULL,
        [StepNameAr] [nvarchar](200) NOT NULL,
        [StepType] [nvarchar](30) NOT NULL,
        [StepOrder] [int] NOT NULL CONSTRAINT [DF_SubjectRoutingSteps_StepOrder] DEFAULT ((0)),
        [IsStart] [bit] NOT NULL CONSTRAINT [DF_SubjectRoutingSteps_IsStart] DEFAULT ((0)),
        [IsEnd] [bit] NOT NULL CONSTRAINT [DF_SubjectRoutingSteps_IsEnd] DEFAULT ((0)),
        [SlaHours] [int] NULL,
        [IsActive] [bit] NOT NULL CONSTRAINT [DF_SubjectRoutingSteps_IsActive] DEFAULT ((1)),
        [NotesAr] [nvarchar](1000) NULL,
        [CreatedBy] [nvarchar](64) NOT NULL CONSTRAINT [DF_SubjectRoutingSteps_CreatedBy] DEFAULT (N'SYSTEM'),
        [CreatedDate] [datetime2](7) NOT NULL CONSTRAINT [DF_SubjectRoutingSteps_CreatedDate] DEFAULT (GETUTCDATE()),
        [LastModifiedBy] [nvarchar](64) NULL,
        [LastModifiedDate] [datetime2](7) NULL,
        CONSTRAINT [PK_SubjectRoutingSteps] PRIMARY KEY CLUSTERED ([Id] ASC)
    );
END
");

            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[SubjectRoutingTargets]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[SubjectRoutingTargets](
        [Id] [int] IDENTITY(1,1) NOT NULL,
        [RoutingStepID] [int] NOT NULL,
        [TargetMode] [nvarchar](30) NOT NULL,
        [OracleUnitTypeID] [decimal](18,0) NULL,
        [OracleOrgUnitID] [decimal](18,0) NULL,
        [PositionID] [decimal](18,0) NULL,
        [PositionCode] [nvarchar](64) NULL,
        [AllowMultipleReceivers] [bit] NOT NULL CONSTRAINT [DF_SubjectRoutingTargets_AllowMultipleReceivers] DEFAULT ((0)),
        [SendToLeaderOnly] [bit] NOT NULL CONSTRAINT [DF_SubjectRoutingTargets_SendToLeaderOnly] DEFAULT ((0)),
        [IsActive] [bit] NOT NULL CONSTRAINT [DF_SubjectRoutingTargets_IsActive] DEFAULT ((1)),
        [NotesAr] [nvarchar](1000) NULL,
        [CreatedBy] [nvarchar](64) NOT NULL CONSTRAINT [DF_SubjectRoutingTargets_CreatedBy] DEFAULT (N'SYSTEM'),
        [CreatedDate] [datetime2](7) NOT NULL CONSTRAINT [DF_SubjectRoutingTargets_CreatedDate] DEFAULT (GETUTCDATE()),
        [LastModifiedBy] [nvarchar](64) NULL,
        [LastModifiedDate] [datetime2](7) NULL,
        CONSTRAINT [PK_SubjectRoutingTargets] PRIMARY KEY CLUSTERED ([Id] ASC)
    );
END
");

            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[SubjectRoutingTransitions]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[SubjectRoutingTransitions](
        [Id] [int] IDENTITY(1,1) NOT NULL,
        [RoutingProfileID] [int] NOT NULL,
        [FromStepID] [int] NOT NULL,
        [ToStepID] [int] NOT NULL,
        [ActionCode] [nvarchar](50) NOT NULL,
        [ActionNameAr] [nvarchar](200) NOT NULL,
        [DisplayOrder] [int] NOT NULL CONSTRAINT [DF_SubjectRoutingTransitions_DisplayOrder] DEFAULT ((0)),
        [RequiresComment] [bit] NOT NULL CONSTRAINT [DF_SubjectRoutingTransitions_RequiresComment] DEFAULT ((0)),
        [RequiresMandatoryFieldsCompletion] [bit] NOT NULL CONSTRAINT [DF_SubjectRoutingTransitions_RequiresMandatoryFieldsCompletion] DEFAULT ((0)),
        [IsRejectPath] [bit] NOT NULL CONSTRAINT [DF_SubjectRoutingTransitions_IsRejectPath] DEFAULT ((0)),
        [IsReturnPath] [bit] NOT NULL CONSTRAINT [DF_SubjectRoutingTransitions_IsReturnPath] DEFAULT ((0)),
        [IsEscalationPath] [bit] NOT NULL CONSTRAINT [DF_SubjectRoutingTransitions_IsEscalationPath] DEFAULT ((0)),
        [ConditionExpression] [nvarchar](2000) NULL,
        [IsActive] [bit] NOT NULL CONSTRAINT [DF_SubjectRoutingTransitions_IsActive] DEFAULT ((1)),
        [CreatedBy] [nvarchar](64) NOT NULL CONSTRAINT [DF_SubjectRoutingTransitions_CreatedBy] DEFAULT (N'SYSTEM'),
        [CreatedDate] [datetime2](7) NOT NULL CONSTRAINT [DF_SubjectRoutingTransitions_CreatedDate] DEFAULT (GETUTCDATE()),
        [LastModifiedBy] [nvarchar](64) NULL,
        [LastModifiedDate] [datetime2](7) NULL,
        CONSTRAINT [PK_SubjectRoutingTransitions] PRIMARY KEY CLUSTERED ([Id] ASC)
    );
END
");

            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[SubjectTypeRoutingBindings]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[SubjectTypeRoutingBindings](
        [Id] [int] IDENTITY(1,1) NOT NULL,
        [SubjectTypeID] [int] NOT NULL,
        [RoutingProfileID] [int] NOT NULL,
        [IsDefault] [bit] NOT NULL CONSTRAINT [DF_SubjectTypeRoutingBindings_IsDefault] DEFAULT ((0)),
        [AppliesToInbound] [bit] NOT NULL CONSTRAINT [DF_SubjectTypeRoutingBindings_AppliesToInbound] DEFAULT ((1)),
        [AppliesToOutbound] [bit] NOT NULL CONSTRAINT [DF_SubjectTypeRoutingBindings_AppliesToOutbound] DEFAULT ((1)),
        [IsActive] [bit] NOT NULL CONSTRAINT [DF_SubjectTypeRoutingBindings_IsActive] DEFAULT ((1)),
        [CreatedBy] [nvarchar](64) NOT NULL CONSTRAINT [DF_SubjectTypeRoutingBindings_CreatedBy] DEFAULT (N'SYSTEM'),
        [CreatedDate] [datetime2](7) NOT NULL CONSTRAINT [DF_SubjectTypeRoutingBindings_CreatedDate] DEFAULT (GETUTCDATE()),
        [LastModifiedBy] [nvarchar](64) NULL,
        [LastModifiedDate] [datetime2](7) NULL,
        CONSTRAINT [PK_SubjectTypeRoutingBindings] PRIMARY KEY CLUSTERED ([Id] ASC)
    );
END
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE [name] = N'FK_SubjectRoutingProfiles_CDCategory'
      AND [parent_object_id] = OBJECT_ID(N'[dbo].[SubjectRoutingProfiles]')
)
BEGIN
    ALTER TABLE [dbo].[SubjectRoutingProfiles]
    ADD CONSTRAINT [FK_SubjectRoutingProfiles_CDCategory]
        FOREIGN KEY ([SubjectTypeID]) REFERENCES [dbo].[CDCategory] ([CatId]);
END
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE [name] = N'FK_SubjectRoutingSteps_SubjectRoutingProfiles'
      AND [parent_object_id] = OBJECT_ID(N'[dbo].[SubjectRoutingSteps]')
)
BEGIN
    ALTER TABLE [dbo].[SubjectRoutingSteps]
    ADD CONSTRAINT [FK_SubjectRoutingSteps_SubjectRoutingProfiles]
        FOREIGN KEY ([RoutingProfileID]) REFERENCES [dbo].[SubjectRoutingProfiles] ([Id])
        ON DELETE CASCADE;
END
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE [name] = N'FK_SubjectRoutingTargets_SubjectRoutingSteps'
      AND [parent_object_id] = OBJECT_ID(N'[dbo].[SubjectRoutingTargets]')
)
BEGIN
    ALTER TABLE [dbo].[SubjectRoutingTargets]
    ADD CONSTRAINT [FK_SubjectRoutingTargets_SubjectRoutingSteps]
        FOREIGN KEY ([RoutingStepID]) REFERENCES [dbo].[SubjectRoutingSteps] ([Id])
        ON DELETE CASCADE;
END
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE [name] = N'FK_SubjectRoutingTransitions_SubjectRoutingProfiles'
      AND [parent_object_id] = OBJECT_ID(N'[dbo].[SubjectRoutingTransitions]')
)
BEGIN
    ALTER TABLE [dbo].[SubjectRoutingTransitions]
    ADD CONSTRAINT [FK_SubjectRoutingTransitions_SubjectRoutingProfiles]
        FOREIGN KEY ([RoutingProfileID]) REFERENCES [dbo].[SubjectRoutingProfiles] ([Id])
        ON DELETE CASCADE;
END
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE [name] = N'FK_SubjectRoutingTransitions_FromStep'
      AND [parent_object_id] = OBJECT_ID(N'[dbo].[SubjectRoutingTransitions]')
)
BEGIN
    ALTER TABLE [dbo].[SubjectRoutingTransitions]
    ADD CONSTRAINT [FK_SubjectRoutingTransitions_FromStep]
        FOREIGN KEY ([FromStepID]) REFERENCES [dbo].[SubjectRoutingSteps] ([Id]);
END
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE [name] = N'FK_SubjectRoutingTransitions_ToStep'
      AND [parent_object_id] = OBJECT_ID(N'[dbo].[SubjectRoutingTransitions]')
)
BEGIN
    ALTER TABLE [dbo].[SubjectRoutingTransitions]
    ADD CONSTRAINT [FK_SubjectRoutingTransitions_ToStep]
        FOREIGN KEY ([ToStepID]) REFERENCES [dbo].[SubjectRoutingSteps] ([Id]);
END
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE [name] = N'FK_SubjectTypeRoutingBindings_SubjectRoutingProfiles'
      AND [parent_object_id] = OBJECT_ID(N'[dbo].[SubjectTypeRoutingBindings]')
)
BEGIN
    ALTER TABLE [dbo].[SubjectTypeRoutingBindings]
    ADD CONSTRAINT [FK_SubjectTypeRoutingBindings_SubjectRoutingProfiles]
        FOREIGN KEY ([RoutingProfileID]) REFERENCES [dbo].[SubjectRoutingProfiles] ([Id])
        ON DELETE CASCADE;
END
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE [name] = N'FK_SubjectTypeRoutingBindings_CDCategory'
      AND [parent_object_id] = OBJECT_ID(N'[dbo].[SubjectTypeRoutingBindings]')
)
BEGIN
    ALTER TABLE [dbo].[SubjectTypeRoutingBindings]
    ADD CONSTRAINT [FK_SubjectTypeRoutingBindings_CDCategory]
        FOREIGN KEY ([SubjectTypeID]) REFERENCES [dbo].[CDCategory] ([CatId]);
END
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE [name] = N'FK_SubjectRoutingProfiles_StartStep'
      AND [parent_object_id] = OBJECT_ID(N'[dbo].[SubjectRoutingProfiles]')
)
BEGIN
    ALTER TABLE [dbo].[SubjectRoutingProfiles]
    ADD CONSTRAINT [FK_SubjectRoutingProfiles_StartStep]
        FOREIGN KEY ([StartStepID]) REFERENCES [dbo].[SubjectRoutingSteps] ([Id])
        ON DELETE NO ACTION;
END
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE [name] = N'IX_SubjectRoutingProfiles_SubjectType_IsActive'
      AND [object_id] = OBJECT_ID(N'[dbo].[SubjectRoutingProfiles]')
)
BEGIN
    CREATE NONCLUSTERED INDEX [IX_SubjectRoutingProfiles_SubjectType_IsActive]
        ON [dbo].[SubjectRoutingProfiles] ([SubjectTypeID], [IsActive]);
END
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE [name] = N'UX_SubjectRoutingProfiles_SubjectType_Name'
      AND [object_id] = OBJECT_ID(N'[dbo].[SubjectRoutingProfiles]')
)
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX [UX_SubjectRoutingProfiles_SubjectType_Name]
        ON [dbo].[SubjectRoutingProfiles] ([SubjectTypeID], [NameAr]);
END
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE [name] = N'IX_SubjectRoutingSteps_RoutingProfileID'
      AND [object_id] = OBJECT_ID(N'[dbo].[SubjectRoutingSteps]')
)
BEGIN
    CREATE NONCLUSTERED INDEX [IX_SubjectRoutingSteps_RoutingProfileID]
        ON [dbo].[SubjectRoutingSteps] ([RoutingProfileID]);
END
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE [name] = N'IX_SubjectRoutingSteps_Profile_Order'
      AND [object_id] = OBJECT_ID(N'[dbo].[SubjectRoutingSteps]')
)
BEGIN
    CREATE NONCLUSTERED INDEX [IX_SubjectRoutingSteps_Profile_Order]
        ON [dbo].[SubjectRoutingSteps] ([RoutingProfileID], [StepOrder]);
END
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE [name] = N'UX_SubjectRoutingSteps_Profile_StepCode'
      AND [object_id] = OBJECT_ID(N'[dbo].[SubjectRoutingSteps]')
)
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX [UX_SubjectRoutingSteps_Profile_StepCode]
        ON [dbo].[SubjectRoutingSteps] ([RoutingProfileID], [StepCode]);
END
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE [name] = N'UX_SubjectRoutingSteps_Profile_Start'
      AND [object_id] = OBJECT_ID(N'[dbo].[SubjectRoutingSteps]')
)
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX [UX_SubjectRoutingSteps_Profile_Start]
        ON [dbo].[SubjectRoutingSteps] ([RoutingProfileID], [IsStart])
        WHERE [IsStart]=(1);
END
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE [name] = N'IX_SubjectRoutingTargets_RoutingStepID'
      AND [object_id] = OBJECT_ID(N'[dbo].[SubjectRoutingTargets]')
)
BEGIN
    CREATE NONCLUSTERED INDEX [IX_SubjectRoutingTargets_RoutingStepID]
        ON [dbo].[SubjectRoutingTargets] ([RoutingStepID]);
END
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE [name] = N'IX_SubjectRoutingTargets_OracleUnitTypeID'
      AND [object_id] = OBJECT_ID(N'[dbo].[SubjectRoutingTargets]')
)
BEGIN
    CREATE NONCLUSTERED INDEX [IX_SubjectRoutingTargets_OracleUnitTypeID]
        ON [dbo].[SubjectRoutingTargets] ([OracleUnitTypeID]);
END
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE [name] = N'IX_SubjectRoutingTargets_OracleOrgUnitID'
      AND [object_id] = OBJECT_ID(N'[dbo].[SubjectRoutingTargets]')
)
BEGIN
    CREATE NONCLUSTERED INDEX [IX_SubjectRoutingTargets_OracleOrgUnitID]
        ON [dbo].[SubjectRoutingTargets] ([OracleOrgUnitID]);
END
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE [name] = N'IX_SubjectRoutingTargets_PositionID'
      AND [object_id] = OBJECT_ID(N'[dbo].[SubjectRoutingTargets]')
)
BEGIN
    CREATE NONCLUSTERED INDEX [IX_SubjectRoutingTargets_PositionID]
        ON [dbo].[SubjectRoutingTargets] ([PositionID]);
END
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE [name] = N'IX_SubjectRoutingTransitions_RoutingProfileID'
      AND [object_id] = OBJECT_ID(N'[dbo].[SubjectRoutingTransitions]')
)
BEGIN
    CREATE NONCLUSTERED INDEX [IX_SubjectRoutingTransitions_RoutingProfileID]
        ON [dbo].[SubjectRoutingTransitions] ([RoutingProfileID]);
END
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE [name] = N'IX_SubjectRoutingTransitions_FromStepID'
      AND [object_id] = OBJECT_ID(N'[dbo].[SubjectRoutingTransitions]')
)
BEGIN
    CREATE NONCLUSTERED INDEX [IX_SubjectRoutingTransitions_FromStepID]
        ON [dbo].[SubjectRoutingTransitions] ([FromStepID]);
END
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE [name] = N'IX_SubjectRoutingTransitions_ToStepID'
      AND [object_id] = OBJECT_ID(N'[dbo].[SubjectRoutingTransitions]')
)
BEGIN
    CREATE NONCLUSTERED INDEX [IX_SubjectRoutingTransitions_ToStepID]
        ON [dbo].[SubjectRoutingTransitions] ([ToStepID]);
END
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE [name] = N'UX_SubjectRoutingTransitions_Profile_From_To_Action'
      AND [object_id] = OBJECT_ID(N'[dbo].[SubjectRoutingTransitions]')
)
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX [UX_SubjectRoutingTransitions_Profile_From_To_Action]
        ON [dbo].[SubjectRoutingTransitions] ([RoutingProfileID], [FromStepID], [ToStepID], [ActionCode]);
END
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE [name] = N'IX_SubjectTypeRoutingBindings_RoutingProfileID'
      AND [object_id] = OBJECT_ID(N'[dbo].[SubjectTypeRoutingBindings]')
)
BEGIN
    CREATE NONCLUSTERED INDEX [IX_SubjectTypeRoutingBindings_RoutingProfileID]
        ON [dbo].[SubjectTypeRoutingBindings] ([RoutingProfileID]);
END
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE [name] = N'IX_SubjectTypeRoutingBindings_SubjectType_IsActive'
      AND [object_id] = OBJECT_ID(N'[dbo].[SubjectTypeRoutingBindings]')
)
BEGIN
    CREATE NONCLUSTERED INDEX [IX_SubjectTypeRoutingBindings_SubjectType_IsActive]
        ON [dbo].[SubjectTypeRoutingBindings] ([SubjectTypeID], [IsActive]);
END
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE [name] = N'UX_SubjectTypeRoutingBindings_SubjectType_Profile'
      AND [object_id] = OBJECT_ID(N'[dbo].[SubjectTypeRoutingBindings]')
)
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX [UX_SubjectTypeRoutingBindings_SubjectType_Profile]
        ON [dbo].[SubjectTypeRoutingBindings] ([SubjectTypeID], [RoutingProfileID]);
END
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE [name] = N'UX_SubjectTypeRoutingBindings_SubjectType_Default'
      AND [object_id] = OBJECT_ID(N'[dbo].[SubjectTypeRoutingBindings]')
)
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX [UX_SubjectTypeRoutingBindings_SubjectType_Default]
        ON [dbo].[SubjectTypeRoutingBindings] ([SubjectTypeID], [IsDefault])
        WHERE [IsDefault]=(1) AND [IsActive]=(1);
END
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[SubjectTypeRoutingBindings]', N'U') IS NOT NULL
BEGIN
    DROP TABLE [dbo].[SubjectTypeRoutingBindings];
END
");

            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[SubjectRoutingTransitions]', N'U') IS NOT NULL
BEGIN
    DROP TABLE [dbo].[SubjectRoutingTransitions];
END
");

            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[SubjectRoutingTargets]', N'U') IS NOT NULL
BEGIN
    DROP TABLE [dbo].[SubjectRoutingTargets];
END
");

            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[SubjectRoutingSteps]', N'U') IS NOT NULL
BEGIN
    DROP TABLE [dbo].[SubjectRoutingSteps];
END
");

            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[SubjectRoutingProfiles]', N'U') IS NOT NULL
BEGIN
    DROP TABLE [dbo].[SubjectRoutingProfiles];
END
");
        }
    }
}
