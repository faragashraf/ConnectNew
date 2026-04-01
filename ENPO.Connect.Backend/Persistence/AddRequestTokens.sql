-- SQL script to create RequestTokens table
IF OBJECT_ID('dbo.RequestTokens', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.RequestTokens (
        Token NVARCHAR(200) NOT NULL PRIMARY KEY,
        Id BIGINT IDENTITY(1,1) NOT NULL,
        TokenHash NVARCHAR(128) NULL,
        MessageID INT NOT NULL,
        TokenPurpose NVARCHAR(100) NULL,
        IsUsed BIT NOT NULL DEFAULT((0)),
        IsOneTimeUse BIT NOT NULL DEFAULT((0)),
        UsedAt DATETIME NULL,
        CreatedAt DATETIME NOT NULL DEFAULT(GETUTCDATE()),
        CreatedBy NVARCHAR(64) NULL,
        UserId NVARCHAR(64) NULL,
        ExpiresAt DATETIME NULL,
        RevokedAt DATETIME NULL,
        RevokedBy NVARCHAR(64) NULL
    );

    CREATE UNIQUE NONCLUSTERED INDEX UX_RequestTokens_TokenHash
        ON dbo.RequestTokens(TokenHash)
        WHERE TokenHash IS NOT NULL;

    CREATE UNIQUE NONCLUSTERED INDEX IX_RequestTokens_Id
        ON dbo.RequestTokens(Id);

    CREATE NONCLUSTERED INDEX IX_RequestTokens_MessagePurposeUserActive
        ON dbo.RequestTokens(MessageID, TokenPurpose, UserId, RevokedAt);
END
ELSE
BEGIN
    PRINT 'Table dbo.RequestTokens already exists.';
END
