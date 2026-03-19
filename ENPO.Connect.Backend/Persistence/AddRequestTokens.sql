-- SQL script to create RequestTokens table
IF OBJECT_ID('dbo.RequestTokens', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.RequestTokens (
        Token NVARCHAR(200) NOT NULL PRIMARY KEY,
        MessageID INT NOT NULL,
        CreatedAt DATETIME NOT NULL DEFAULT(GETUTCDATE()),
        ExpiresAt DATETIME NULL
    );
END
ELSE
BEGIN
    PRINT 'Table dbo.RequestTokens already exists.';
END
