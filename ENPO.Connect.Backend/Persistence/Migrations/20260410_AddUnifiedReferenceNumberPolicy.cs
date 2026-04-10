using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Persistence.Data;

namespace Persistence.Migrations
{
    [DbContext(typeof(ConnectContext))]
    [Migration("20260410_AddUnifiedReferenceNumberPolicy")]
    public partial class AddUnifiedReferenceNumberPolicy : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[SubjectReferencePolicies]', N'U') IS NULL
    RETURN;

IF COL_LENGTH(N'[dbo].[SubjectReferencePolicies]', N'Mode') IS NULL
BEGIN
    ALTER TABLE [dbo].[SubjectReferencePolicies]
        ADD [Mode] [nvarchar](20) NOT NULL
            CONSTRAINT [DF_SubjectReferencePolicies_Mode] DEFAULT (N'default');
END

IF COL_LENGTH(N'[dbo].[SubjectReferencePolicies]', N'StartingValue') IS NULL
BEGIN
    ALTER TABLE [dbo].[SubjectReferencePolicies]
        ADD [StartingValue] [bigint] NOT NULL
            CONSTRAINT [DF_SubjectReferencePolicies_StartingValue] DEFAULT ((1));
END

IF COL_LENGTH(N'[dbo].[SubjectReferencePolicies]', N'ComponentsJson') IS NULL
BEGIN
    ALTER TABLE [dbo].[SubjectReferencePolicies]
        ADD [ComponentsJson] [nvarchar](max) NULL;
END

IF COL_LENGTH(N'[dbo].[SubjectReferencePolicies]', N'Mode') IS NOT NULL
BEGIN
    EXEC(N'
        UPDATE [dbo].[SubjectReferencePolicies]
           SET [Mode] = N''default''
         WHERE [Mode] IS NULL
            OR LTRIM(RTRIM([Mode])) = N'''';
    ');
END

IF COL_LENGTH(N'[dbo].[SubjectReferencePolicies]', N'StartingValue') IS NOT NULL
BEGIN
    EXEC(N'
        UPDATE [dbo].[SubjectReferencePolicies]
           SET [StartingValue] = 1
         WHERE [StartingValue] IS NULL
            OR [StartingValue] <= 0;
    ');
END

IF COL_LENGTH(N'[dbo].[SubjectReferencePolicies]', N'SequencePaddingLength') IS NOT NULL
BEGIN
    EXEC(N'
        UPDATE [dbo].[SubjectReferencePolicies]
           SET [SequencePaddingLength] = 6
         WHERE [SequencePaddingLength] IS NULL
            OR [SequencePaddingLength] <= 0;
    ');
END

IF COL_LENGTH(N'[dbo].[SubjectReferencePolicies]', N'UseSequence') IS NOT NULL
BEGIN
    EXEC(N'
        UPDATE [dbo].[SubjectReferencePolicies]
           SET [UseSequence] = 1
         WHERE [UseSequence] IS NULL
            OR [UseSequence] = 0;
    ');
END

DECLARE @DropSequencePaddingDfSql nvarchar(max) = N'';
SELECT @DropSequencePaddingDfSql = N'ALTER TABLE [dbo].[SubjectReferencePolicies] DROP CONSTRAINT [' + dc.[name] + N']'
  FROM sys.default_constraints dc
  JOIN sys.columns c
    ON c.[object_id] = dc.parent_object_id
   AND c.[column_id] = dc.parent_column_id
 WHERE dc.parent_object_id = OBJECT_ID(N'[dbo].[SubjectReferencePolicies]')
   AND c.[name] = N'SequencePaddingLength';

IF (@DropSequencePaddingDfSql <> N'')
    EXEC(@DropSequencePaddingDfSql);

IF COL_LENGTH(N'[dbo].[SubjectReferencePolicies]', N'SequencePaddingLength') IS NOT NULL
AND NOT EXISTS
(
    SELECT 1
    FROM sys.default_constraints dc
    JOIN sys.columns c
      ON c.[object_id] = dc.parent_object_id
     AND c.[column_id] = dc.parent_column_id
   WHERE dc.parent_object_id = OBJECT_ID(N'[dbo].[SubjectReferencePolicies]')
     AND c.[name] = N'SequencePaddingLength'
)
BEGIN
    ALTER TABLE [dbo].[SubjectReferencePolicies]
        ADD CONSTRAINT [DF_SubjectReferencePolicies_SequencePaddingLength]
            DEFAULT ((6)) FOR [SequencePaddingLength];
END
");

            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[ReferenceSequences]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[ReferenceSequences]
    (
        [SequenceID] [int] IDENTITY(1,1) NOT NULL,
        [SubjectID] [int] NOT NULL,
        [SequenceKey] [nvarchar](120) NOT NULL,
        [CurrentValue] [bigint] NOT NULL CONSTRAINT [DF_ReferenceSequences_CurrentValue] DEFAULT ((0)),
        [ResetPolicy] [nvarchar](16) NOT NULL CONSTRAINT [DF_ReferenceSequences_ResetPolicy] DEFAULT (N'none'),
        [LastResetAtUtc] [datetime2](7) NULL,
        [CreatedAtUtc] [datetime2](7) NOT NULL CONSTRAINT [DF_ReferenceSequences_CreatedAtUtc] DEFAULT (GETUTCDATE()),
        [LastModifiedAtUtc] [datetime2](7) NOT NULL CONSTRAINT [DF_ReferenceSequences_LastModifiedAtUtc] DEFAULT (GETUTCDATE()),
        CONSTRAINT [PK_ReferenceSequences] PRIMARY KEY CLUSTERED ([SequenceID] ASC)
    );
END
");

            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[ReferenceSequences]', N'U') IS NOT NULL
AND NOT EXISTS
(
    SELECT 1
    FROM sys.indexes
    WHERE [name] = N'UX_ReferenceSequences_Subject_SequenceKey'
      AND [object_id] = OBJECT_ID(N'[dbo].[ReferenceSequences]')
)
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX [UX_ReferenceSequences_Subject_SequenceKey]
        ON [dbo].[ReferenceSequences] ([SubjectID], [SequenceKey]);
END
");

            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[ReferenceSequences]', N'U') IS NOT NULL
AND NOT EXISTS
(
    SELECT 1
    FROM sys.indexes
    WHERE [name] = N'IX_ReferenceSequences_LastModifiedAtUtc'
      AND [object_id] = OBJECT_ID(N'[dbo].[ReferenceSequences]')
)
BEGIN
    CREATE NONCLUSTERED INDEX [IX_ReferenceSequences_LastModifiedAtUtc]
        ON [dbo].[ReferenceSequences] ([LastModifiedAtUtc]);
END
");

            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[Messages]', N'U') IS NULL
    RETURN;

UPDATE [dbo].[Messages]
   SET [RequestRef] = NULLIF(LTRIM(RTRIM([RequestRef])), N'')
 WHERE [RequestRef] IS NOT NULL;

;WITH Duplicates AS
(
    SELECT
        [MessageID],
        [RequestRef],
        ROW_NUMBER() OVER (PARTITION BY [RequestRef] ORDER BY [MessageID]) AS [RowNo]
    FROM [dbo].[Messages]
    WHERE [RequestRef] IS NOT NULL
)
UPDATE messageItem
   SET [RequestRef] = LEFT(
       CONCAT(
           messageItem.[RequestRef],
           N'-',
           CONVERT(nvarchar(20), messageItem.[MessageID])
       ),
       50
   )
FROM [dbo].[Messages] AS messageItem
INNER JOIN Duplicates AS duplicateItem
    ON duplicateItem.[MessageID] = messageItem.[MessageID]
WHERE duplicateItem.[RowNo] > 1;
");

            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[Messages]', N'U') IS NOT NULL
AND NOT EXISTS
(
    SELECT 1
    FROM sys.indexes
    WHERE [name] = N'UX_Messages_RequestRef'
      AND [object_id] = OBJECT_ID(N'[dbo].[Messages]')
)
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX [UX_Messages_RequestRef]
        ON [dbo].[Messages] ([RequestRef])
        WHERE [RequestRef] IS NOT NULL;
END
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[Messages]', N'U') IS NOT NULL
AND EXISTS
(
    SELECT 1
    FROM sys.indexes
    WHERE [name] = N'UX_Messages_RequestRef'
      AND [object_id] = OBJECT_ID(N'[dbo].[Messages]')
)
BEGIN
    DROP INDEX [UX_Messages_RequestRef] ON [dbo].[Messages];
END
");

            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[ReferenceSequences]', N'U') IS NOT NULL
BEGIN
    DROP TABLE [dbo].[ReferenceSequences];
END
");

            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[SubjectReferencePolicies]', N'U') IS NULL
    RETURN;

IF COL_LENGTH(N'[dbo].[SubjectReferencePolicies]', N'ComponentsJson') IS NOT NULL
BEGIN
    ALTER TABLE [dbo].[SubjectReferencePolicies]
        DROP COLUMN [ComponentsJson];
END

IF COL_LENGTH(N'[dbo].[SubjectReferencePolicies]', N'StartingValue') IS NOT NULL
BEGIN
    DECLARE @DropStartingValueDfSql nvarchar(max) = N'';
    SELECT @DropStartingValueDfSql = N'ALTER TABLE [dbo].[SubjectReferencePolicies] DROP CONSTRAINT [' + dc.[name] + N']'
      FROM sys.default_constraints dc
      JOIN sys.columns c
        ON c.[object_id] = dc.parent_object_id
       AND c.[column_id] = dc.parent_column_id
     WHERE dc.parent_object_id = OBJECT_ID(N'[dbo].[SubjectReferencePolicies]')
       AND c.[name] = N'StartingValue';

    IF (@DropStartingValueDfSql <> N'')
        EXEC(@DropStartingValueDfSql);

    ALTER TABLE [dbo].[SubjectReferencePolicies]
        DROP COLUMN [StartingValue];
END

IF COL_LENGTH(N'[dbo].[SubjectReferencePolicies]', N'Mode') IS NOT NULL
BEGIN
    DECLARE @DropModeDfSql nvarchar(max) = N'';
    SELECT @DropModeDfSql = N'ALTER TABLE [dbo].[SubjectReferencePolicies] DROP CONSTRAINT [' + dc.[name] + N']'
      FROM sys.default_constraints dc
      JOIN sys.columns c
        ON c.[object_id] = dc.parent_object_id
       AND c.[column_id] = dc.parent_column_id
     WHERE dc.parent_object_id = OBJECT_ID(N'[dbo].[SubjectReferencePolicies]')
       AND c.[name] = N'Mode';

    IF (@DropModeDfSql <> N'')
        EXEC(@DropModeDfSql);

    ALTER TABLE [dbo].[SubjectReferencePolicies]
        DROP COLUMN [Mode];
END
");
        }
    }
}
