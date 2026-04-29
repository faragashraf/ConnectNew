using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Persistence.Data;

namespace Persistence.Migrations
{
    [DbContext(typeof(ConnectContext))]
    [Migration("20260404_AddGrievanceReferencePolicy")]
    public partial class AddGrievanceReferencePolicy : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[SubjectReferencePolicies]', N'U') IS NULL
    RETURN;

IF NOT EXISTS (
    SELECT 1
    FROM [dbo].[CDCategory]
    WHERE [CatId] = 124
      AND COALESCE(NULLIF([ApplicationId], N''), N'60') = N'60'
)
    RETURN;

IF EXISTS (SELECT 1 FROM [dbo].[SubjectReferencePolicies] WHERE [CategoryID] = 124)
BEGIN
    UPDATE [dbo].[SubjectReferencePolicies]
       SET [Prefix] = N'GRV',
           [Separator] = N'-',
           [SourceFieldKeys] = N'$ApplicationId,$TopParentId',
           [IncludeYear] = 1,
           [UseSequence] = 1,
           [SequenceName] = N'Seq_GRV_{ApplicationId}_{TopParentId}',
           [IsActive] = 1,
           [LastModifiedBy] = N'SYSTEM',
           [LastModifiedAtUtc] = GETUTCDATE()
     WHERE [CategoryID] = 124;
END
ELSE
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
        124,
        N'GRV',
        N'-',
        N'$ApplicationId,$TopParentId',
        1,
        1,
        N'Seq_GRV_{ApplicationId}_{TopParentId}',
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
IF OBJECT_ID(N'[dbo].[SubjectReferencePolicies]', N'U') IS NULL
    RETURN;

IF EXISTS (SELECT 1 FROM [dbo].[SubjectReferencePolicies] WHERE [CategoryID] = 124)
BEGIN
    UPDATE [dbo].[SubjectReferencePolicies]
       SET [Prefix] = N'SUBJ124',
           [Separator] = N'-',
           [SourceFieldKeys] = NULL,
           [IncludeYear] = 1,
           [UseSequence] = 1,
           [SequenceName] = N'Seq_Tickets',
           [LastModifiedBy] = N'SYSTEM',
           [LastModifiedAtUtc] = GETUTCDATE()
     WHERE [CategoryID] = 124;
END
");
        }
    }
}
