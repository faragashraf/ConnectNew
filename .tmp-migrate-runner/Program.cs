using System.Data.Common;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Persistence.Data;

if (args.Length == 0 || string.IsNullOrWhiteSpace(args[0]))
{
    Console.Error.WriteLine("Usage: dotnet run -- <connection-string>");
    return 2;
}

var connectionString = args[0].Trim();

var options = new DbContextOptionsBuilder<ConnectContext>()
    .UseSqlServer(connectionString, sql =>
    {
        sql.MigrationsAssembly(typeof(ConnectContext).Assembly.GetName().Name);
        sql.CommandTimeout(300);
    })
    .Options;

await using var context = new ConnectContext(options, new HttpContextAccessor());

try
{
    var pendingBefore = await context.Database.GetPendingMigrationsAsync();
    Console.WriteLine($"PendingBefore={string.Join(',', pendingBefore)}");

    await context.Database.MigrateAsync();

    var pendingAfter = await context.Database.GetPendingMigrationsAsync();
    Console.WriteLine($"PendingAfter={string.Join(',', pendingAfter)}");

    var tokenPurposeExists = await ColumnExistsAsync(context.Database.GetDbConnection(), "dbo", "RequestTokens", "TokenPurpose");
    var tokenHashExists = await ColumnExistsAsync(context.Database.GetDbConnection(), "dbo", "RequestTokens", "TokenHash");
    var idExists = await ColumnExistsAsync(context.Database.GetDbConnection(), "dbo", "RequestTokens", "Id");
    Console.WriteLine($"RequestTokensColumns: Id={idExists}, TokenHash={tokenHashExists}, TokenPurpose={tokenPurposeExists}");

    Console.WriteLine("MigrateAsync completed successfully.");
    return 0;
}
catch (Exception ex)
{
    Console.Error.WriteLine("MigrateAsync failed:");
    Console.Error.WriteLine(ex.ToString());
    return 1;
}

static async Task<bool> ColumnExistsAsync(DbConnection connection, string schema, string table, string column)
{
    if (connection.State != System.Data.ConnectionState.Open)
    {
        await connection.OpenAsync();
    }

    await using var command = connection.CreateCommand();
    command.CommandText = @"
SELECT CASE WHEN EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @schema
      AND TABLE_NAME = @table
      AND COLUMN_NAME = @column
) THEN 1 ELSE 0 END;";

    var p1 = command.CreateParameter();
    p1.ParameterName = "@schema";
    p1.Value = schema;
    command.Parameters.Add(p1);

    var p2 = command.CreateParameter();
    p2.ParameterName = "@table";
    p2.Value = table;
    command.Parameters.Add(p2);

    var p3 = command.CreateParameter();
    p3.ParameterName = "@column";
    p3.Value = column;
    command.Parameters.Add(p3);

    var result = await command.ExecuteScalarAsync();
    return Convert.ToInt32(result ?? 0) == 1;
}
