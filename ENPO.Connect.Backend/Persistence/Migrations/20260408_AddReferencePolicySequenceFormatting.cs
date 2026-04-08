using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Persistence.Data;

namespace Persistence.Migrations
{
    [DbContext(typeof(ConnectContext))]
    [Migration("20260408_AddReferencePolicySequenceFormatting")]
    public partial class AddReferencePolicySequenceFormatting : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[SubjectReferencePolicies]', N'U') IS NULL
    RETURN;

IF COL_LENGTH(N'[dbo].[SubjectReferencePolicies]', N'SequencePaddingLength') IS NULL
BEGIN
    ALTER TABLE [dbo].[SubjectReferencePolicies]
        ADD [SequencePaddingLength] [int] NOT NULL
            CONSTRAINT [DF_SubjectReferencePolicies_SequencePaddingLength] DEFAULT ((0));
END

IF COL_LENGTH(N'[dbo].[SubjectReferencePolicies]', N'SequenceResetScope') IS NULL
BEGIN
    ALTER TABLE [dbo].[SubjectReferencePolicies]
        ADD [SequenceResetScope] [nvarchar](16) NOT NULL
            CONSTRAINT [DF_SubjectReferencePolicies_SequenceResetScope] DEFAULT (N'none');
END
");

            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[SubjectReferencePolicies]', N'U') IS NULL
    RETURN;

IF COL_LENGTH(N'[dbo].[SubjectReferencePolicies]', N'SequencePaddingLength') IS NOT NULL
BEGIN
    UPDATE [dbo].[SubjectReferencePolicies]
       SET [SequencePaddingLength] = 0
     WHERE [SequencePaddingLength] < 0;
END
");

            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[SubjectReferencePolicies]', N'U') IS NULL
    RETURN;

IF COL_LENGTH(N'[dbo].[SubjectReferencePolicies]', N'SequenceResetScope') IS NOT NULL
BEGIN
    UPDATE [dbo].[SubjectReferencePolicies]
       SET [SequenceResetScope] = N'none'
     WHERE [SequenceResetScope] IS NULL
        OR LTRIM(RTRIM([SequenceResetScope])) = N'';
END
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[SubjectReferencePolicies]', N'U') IS NULL
    RETURN;

IF COL_LENGTH(N'[dbo].[SubjectReferencePolicies]', N'SequenceResetScope') IS NOT NULL
BEGIN
    DECLARE @DropResetScopeDfSql nvarchar(max) = N'';
    SELECT @DropResetScopeDfSql = N'ALTER TABLE [dbo].[SubjectReferencePolicies] DROP CONSTRAINT [' + dc.[name] + N']'
      FROM sys.default_constraints dc
      JOIN sys.columns c
        ON c.[object_id] = dc.parent_object_id
       AND c.[column_id] = dc.parent_column_id
     WHERE dc.parent_object_id = OBJECT_ID(N'[dbo].[SubjectReferencePolicies]')
       AND c.[name] = N'SequenceResetScope';

    IF (@DropResetScopeDfSql <> N'')
        EXEC(@DropResetScopeDfSql);

    ALTER TABLE [dbo].[SubjectReferencePolicies]
        DROP COLUMN [SequenceResetScope];
END

IF COL_LENGTH(N'[dbo].[SubjectReferencePolicies]', N'SequencePaddingLength') IS NOT NULL
BEGIN
    DECLARE @DropPaddingDfSql nvarchar(max) = N'';
    SELECT @DropPaddingDfSql = N'ALTER TABLE [dbo].[SubjectReferencePolicies] DROP CONSTRAINT [' + dc.[name] + N']'
      FROM sys.default_constraints dc
      JOIN sys.columns c
        ON c.[object_id] = dc.parent_object_id
       AND c.[column_id] = dc.parent_column_id
     WHERE dc.parent_object_id = OBJECT_ID(N'[dbo].[SubjectReferencePolicies]')
       AND c.[name] = N'SequencePaddingLength';

    IF (@DropPaddingDfSql <> N'')
        EXEC(@DropPaddingDfSql);

    ALTER TABLE [dbo].[SubjectReferencePolicies]
        DROP COLUMN [SequencePaddingLength];
END
");
        }
    }
}
