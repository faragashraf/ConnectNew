using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Persistence.Data;

namespace Persistence.Migrations
{
    [DbContext(typeof(ConnectContext))]
    [Migration("20260321_AddSummerResortSequences")]
    public partial class AddSummerResortSequences : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF NOT EXISTS (SELECT 1 FROM sys.sequences WHERE name = N'Seq_Summer_M' AND schema_id = SCHEMA_ID(N'dbo'))
BEGIN
    CREATE SEQUENCE [dbo].[Seq_Summer_M]
    AS INT
    START WITH 1
    INCREMENT BY 1;
END
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (SELECT 1 FROM sys.sequences WHERE name = N'Seq_Summer_R' AND schema_id = SCHEMA_ID(N'dbo'))
BEGIN
    CREATE SEQUENCE [dbo].[Seq_Summer_R]
    AS INT
    START WITH 1
    INCREMENT BY 1;
END
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (SELECT 1 FROM sys.sequences WHERE name = N'Seq_Summer_B' AND schema_id = SCHEMA_ID(N'dbo'))
BEGIN
    CREATE SEQUENCE [dbo].[Seq_Summer_B]
    AS INT
    START WITH 1
    INCREMENT BY 1;
END
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF EXISTS (SELECT 1 FROM sys.sequences WHERE name = N'Seq_Summer_M' AND schema_id = SCHEMA_ID(N'dbo'))
BEGIN
    DROP SEQUENCE [dbo].[Seq_Summer_M];
END
");

            migrationBuilder.Sql(@"
IF EXISTS (SELECT 1 FROM sys.sequences WHERE name = N'Seq_Summer_R' AND schema_id = SCHEMA_ID(N'dbo'))
BEGIN
    DROP SEQUENCE [dbo].[Seq_Summer_R];
END
");

            migrationBuilder.Sql(@"
IF EXISTS (SELECT 1 FROM sys.sequences WHERE name = N'Seq_Summer_B' AND schema_id = SCHEMA_ID(N'dbo'))
BEGIN
    DROP SEQUENCE [dbo].[Seq_Summer_B];
END
");
        }
    }
}
