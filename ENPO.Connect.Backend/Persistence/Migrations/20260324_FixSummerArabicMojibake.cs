using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Persistence.Data;

namespace Persistence.Migrations
{
    [DbContext(typeof(ConnectContext))]
    [Migration("20260324_FixSummerArabicMojibake")]
    public partial class FixSummerArabicMojibake : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DECLARE @AutoCancelReason NVARCHAR(200) =
    NCHAR(1578) + NCHAR(1605) + NCHAR(32) +
    NCHAR(1573) + NCHAR(1604) + NCHAR(1594) + NCHAR(1575) + NCHAR(1569) + NCHAR(32) +
    NCHAR(1575) + NCHAR(1604) + NCHAR(1591) + NCHAR(1604) + NCHAR(1576) + NCHAR(32) +
    NCHAR(1578) + NCHAR(1604) + NCHAR(1602) + NCHAR(1575) + NCHAR(1574) + NCHAR(1610) + NCHAR(1575) + NCHAR(1611) + NCHAR(32) +
    NCHAR(1604) + NCHAR(1593) + NCHAR(1583) + NCHAR(1605) + NCHAR(32) +
    NCHAR(1575) + NCHAR(1604) + NCHAR(1587) + NCHAR(1583) + NCHAR(1575) + NCHAR(1583) + NCHAR(32) +
    NCHAR(1582) + NCHAR(1604) + NCHAR(1575) + NCHAR(1604) + NCHAR(32) +
    NCHAR(1605) + NCHAR(1607) + NCHAR(1604) + NCHAR(1577) + NCHAR(32) +
    NCHAR(1610) + NCHAR(1608) + NCHAR(1605) + NCHAR(32) +
    NCHAR(1575) + NCHAR(1604) + NCHAR(1593) + NCHAR(1605) + NCHAR(1604) + NCHAR(46);

UPDATE [TKMendFields]
   SET [FildTxt] = @AutoCancelReason
 WHERE [FildKind] = N'Summer_CancelReason'
   AND (
        [FildTxt] COLLATE Latin1_General_100_BIN2 LIKE N'%Ø%'
        OR [FildTxt] COLLATE Latin1_General_100_BIN2 LIKE N'%Ù%'
        OR [FildTxt] COLLATE Latin1_General_100_BIN2 LIKE N'%Ã%'
        OR [FildTxt] COLLATE Latin1_General_100_BIN2 LIKE N'%Ð%'
        OR [FildTxt] COLLATE Latin1_General_100_BIN2 LIKE N'%�%'
   );

UPDATE replyRows
   SET replyRows.[Message] = @AutoCancelReason
  FROM [Replies] AS replyRows
 WHERE EXISTS
       (
           SELECT 1
             FROM [TKMendFields] AS fields
            WHERE fields.[FildRelted] = replyRows.[MessageId]
              AND fields.[FildKind] = N'Summer_CancelReason'
       )
   AND replyRows.[AuthorId] = N'SYSTEM'
   AND (
        [Message] COLLATE Latin1_General_100_BIN2 LIKE N'%Ø%'
        OR [Message] COLLATE Latin1_General_100_BIN2 LIKE N'%Ù%'
        OR [Message] COLLATE Latin1_General_100_BIN2 LIKE N'%Ã%'
        OR [Message] COLLATE Latin1_General_100_BIN2 LIKE N'%Ð%'
        OR [Message] COLLATE Latin1_General_100_BIN2 LIKE N'%�%'
   );
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // no-op: data repair should not be rolled back
        }
    }
}
