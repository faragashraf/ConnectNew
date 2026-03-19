-- CheckRequestTokens.sql
-- Run this on the Connect database to show server, database, migrations history, and RequestTokens existence.
SELECT SERVERPROPERTY('MachineName') AS ServerMachine, @@SERVERNAME AS SqlServerName, DB_NAME() AS DatabaseName;

PRINT '--- __EFMigrationsHistory ---';
IF OBJECT_ID('__EFMigrationsHistory') IS NOT NULL
BEGIN
    SELECT [MigrationId], [ProductVersion] FROM [dbo].[__EFMigrationsHistory] ORDER BY [MigrationId];
END
ELSE
BEGIN
    PRINT '__EFMigrationsHistory not found.';
END

PRINT '--- RequestTokens existence ---';
SELECT OBJECT_ID('dbo.RequestTokens') AS RequestTokens_ObjectId;

PRINT '--- Table columns if exists ---';
IF OBJECT_ID('dbo.RequestTokens') IS NOT NULL
BEGIN
    SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'RequestTokens' ORDER BY ORDINAL_POSITION;
END
ELSE
BEGIN
    PRINT 'RequestTokens table does not exist.';
END

PRINT '--- END ---';
