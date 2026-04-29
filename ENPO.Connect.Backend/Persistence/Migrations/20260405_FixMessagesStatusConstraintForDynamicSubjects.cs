using Microsoft.EntityFrameworkCore.Migrations;

namespace Persistence.Migrations
{
    [Migration("20260405_FixMessagesStatusConstraintForDynamicSubjects")]
    public partial class FixMessagesStatusConstraintForDynamicSubjects : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DECLARE @sql NVARCHAR(MAX) = N'';

SELECT @sql = @sql + N'ALTER TABLE [dbo].[Messages] DROP CONSTRAINT [' + cc.name + N'];' + CHAR(10)
FROM sys.check_constraints cc
JOIN sys.tables t ON cc.parent_object_id = t.object_id
WHERE t.name = N'Messages'
  AND (cc.name LIKE N'%Status%' OR cc.definition LIKE N'%Status%');

IF (LEN(@sql) > 0)
BEGIN
    EXEC sp_executesql @sql;
END
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1
    FROM sys.check_constraints cc
    JOIN sys.tables t ON cc.parent_object_id = t.object_id
    WHERE t.name = N'Messages'
      AND cc.name = N'CK_Messages_Status'
)
BEGIN
    ALTER TABLE [dbo].[Messages] WITH CHECK ADD CONSTRAINT [CK_Messages_Status]
    CHECK ([Status] IN (0,1,2,3,4,10,11,12,13,14,15,16,17));
END
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF EXISTS (
    SELECT 1 FROM sys.check_constraints cc
    JOIN sys.tables t ON cc.parent_object_id = t.object_id
    WHERE t.name = N'Messages'
      AND (cc.name LIKE N'%Status%' OR cc.definition LIKE N'%Status%')
)
BEGIN
    DECLARE @dropSql NVARCHAR(MAX) = N'';
    SELECT @dropSql = @dropSql + N'ALTER TABLE [dbo].[Messages] DROP CONSTRAINT [' + cc.name + N'];' + CHAR(10)
    FROM sys.check_constraints cc
    JOIN sys.tables t ON cc.parent_object_id = t.object_id
    WHERE t.name = N'Messages'
      AND (cc.name LIKE N'%Status%' OR cc.definition LIKE N'%Status%');

    IF (LEN(@dropSql) > 0)
    BEGIN
        EXEC sp_executesql @dropSql;
    END
END
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1
    FROM sys.check_constraints cc
    JOIN sys.tables t ON cc.parent_object_id = t.object_id
    WHERE t.name = N'Messages'
      AND cc.name = N'CK_Messages_Status_Legacy'
)
BEGIN
    ALTER TABLE [dbo].[Messages] WITH CHECK ADD CONSTRAINT [CK_Messages_Status_Legacy]
    CHECK ([Status] IN (0,1,2,3,4));
END
");
        }
    }
}
