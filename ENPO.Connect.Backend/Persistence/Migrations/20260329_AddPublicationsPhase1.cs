using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Persistence.Data;

namespace Persistence.Migrations
{
    [DbContext(typeof(ConnectContext))]
    [Migration("20260329_AddPublicationsPhase1")]
    public partial class AddPublicationsPhase1 : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF NOT EXISTS (SELECT 1 FROM [dbo].[Applications] WHERE [ApplicationID] = N'PUBL')
BEGIN
    INSERT INTO [dbo].[Applications]([ApplicationID], [ApplicationName], [IsActive])
    VALUES (N'PUBL', N'Publications', 1);
END

IF OBJECT_ID(N'[dbo].[PUB_RequestType]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[PUB_RequestType]
    (
        [PublicationRequestTypeID] INT IDENTITY(1,1) NOT NULL,
        [Code] NVARCHAR(50) NOT NULL,
        [NameAr] NVARCHAR(200) NOT NULL,
        [NameEn] NVARCHAR(200) NULL,
        [CategoryID] INT NOT NULL,
        [ApplicationId] NVARCHAR(10) NOT NULL CONSTRAINT [DF_PUB_RequestType_ApplicationId] DEFAULT (N'PUBL'),
        [IsActive] BIT NOT NULL CONSTRAINT [DF_PUB_RequestType_IsActive] DEFAULT ((1)),
        [DisplayOrder] INT NOT NULL CONSTRAINT [DF_PUB_RequestType_DisplayOrder] DEFAULT ((0)),
        [CreatedAtUtc] DATETIME NOT NULL CONSTRAINT [DF_PUB_RequestType_CreatedAtUtc] DEFAULT (GETUTCDATE()),
        CONSTRAINT [PK_PUB_RequestType] PRIMARY KEY CLUSTERED ([PublicationRequestTypeID] ASC)
    );
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name] = N'UX_PUB_RequestType_Code' AND object_id = OBJECT_ID(N'[dbo].[PUB_RequestType]'))
BEGIN
    CREATE UNIQUE INDEX [UX_PUB_RequestType_Code]
        ON [dbo].[PUB_RequestType]([Code]);
END

IF OBJECT_ID(N'[dbo].[PUB_DepartmentRequestType]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[PUB_DepartmentRequestType]
    (
        [PublicationDepartmentRequestTypeID] INT IDENTITY(1,1) NOT NULL,
        [DepartmentUnitID] DECIMAL(18,0) NOT NULL,
        [PublicationRequestTypeID] INT NOT NULL,
        [CanCreate] BIT NOT NULL CONSTRAINT [DF_PUB_DepartmentRequestType_CanCreate] DEFAULT ((1)),
        [IsActive] BIT NOT NULL CONSTRAINT [DF_PUB_DepartmentRequestType_IsActive] DEFAULT ((1)),
        [CreatedAtUtc] DATETIME NOT NULL CONSTRAINT [DF_PUB_DepartmentRequestType_CreatedAtUtc] DEFAULT (GETUTCDATE()),
        CONSTRAINT [PK_PUB_DepartmentRequestType] PRIMARY KEY CLUSTERED ([PublicationDepartmentRequestTypeID] ASC),
        CONSTRAINT [FK_PUB_DepartmentRequestType_PUB_RequestType]
            FOREIGN KEY ([PublicationRequestTypeID]) REFERENCES [dbo].[PUB_RequestType]([PublicationRequestTypeID])
    );
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name] = N'UX_PUB_DepartmentRequestType_Unit_Type' AND object_id = OBJECT_ID(N'[dbo].[PUB_DepartmentRequestType]'))
BEGIN
    CREATE UNIQUE INDEX [UX_PUB_DepartmentRequestType_Unit_Type]
        ON [dbo].[PUB_DepartmentRequestType]([DepartmentUnitID], [PublicationRequestTypeID]);
END

IF OBJECT_ID(N'[dbo].[PUB_AdminDepartment]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[PUB_AdminDepartment]
    (
        [PublicationAdminDepartmentID] INT IDENTITY(1,1) NOT NULL,
        [DepartmentUnitID] DECIMAL(18,0) NOT NULL,
        [IsActive] BIT NOT NULL CONSTRAINT [DF_PUB_AdminDepartment_IsActive] DEFAULT ((1)),
        [CreatedAtUtc] DATETIME NOT NULL CONSTRAINT [DF_PUB_AdminDepartment_CreatedAtUtc] DEFAULT (GETUTCDATE()),
        CONSTRAINT [PK_PUB_AdminDepartment] PRIMARY KEY CLUSTERED ([PublicationAdminDepartmentID] ASC)
    );
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name] = N'UX_PUB_AdminDepartment_Unit' AND object_id = OBJECT_ID(N'[dbo].[PUB_AdminDepartment]'))
BEGIN
    CREATE UNIQUE INDEX [UX_PUB_AdminDepartment_Unit]
        ON [dbo].[PUB_AdminDepartment]([DepartmentUnitID]);
END

IF OBJECT_ID(N'[dbo].[PUB_SerialCounter]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[PUB_SerialCounter]
    (
        [CounterYear] INT NOT NULL,
        [LastSerial] INT NOT NULL CONSTRAINT [DF_PUB_SerialCounter_LastSerial] DEFAULT ((0)),
        [RowVersion] ROWVERSION NOT NULL,
        CONSTRAINT [PK_PUB_SerialCounter] PRIMARY KEY CLUSTERED ([CounterYear] ASC)
    );
END

IF OBJECT_ID(N'[dbo].[PUB_Request]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[PUB_Request]
    (
        [MessageID] INT NOT NULL,
        [PublicationRequestTypeID] INT NOT NULL,
        [DepartmentUnitID] DECIMAL(18,0) NOT NULL,
        [WorkflowStatus] NVARCHAR(30) NOT NULL,
        [CreatedAtUtc] DATETIME NOT NULL CONSTRAINT [DF_PUB_Request_CreatedAtUtc] DEFAULT (GETUTCDATE()),
        [SubmittedAtUtc] DATETIME NULL,
        [ReviewedAtUtc] DATETIME NULL,
        [ReturnedAtUtc] DATETIME NULL,
        [RejectedAtUtc] DATETIME NULL,
        [ApprovedAtUtc] DATETIME NULL,
        [PublicationYear] INT NULL,
        [PublicationSerial] INT NULL,
        [PublicationNumber] NVARCHAR(20) NULL,
        [FinalApprovalReplyID] INT NULL,
        [CreatedBy] NVARCHAR(100) NOT NULL,
        [LastActionBy] NVARCHAR(100) NULL,
        [LastActionAtUtc] DATETIME NULL,
        [RowVersion] ROWVERSION NOT NULL,
        CONSTRAINT [PK_PUB_Request] PRIMARY KEY CLUSTERED ([MessageID] ASC),
        CONSTRAINT [FK_PUB_Request_Messages]
            FOREIGN KEY ([MessageID]) REFERENCES [dbo].[Messages]([MessageID]) ON DELETE CASCADE,
        CONSTRAINT [FK_PUB_Request_PUB_RequestType]
            FOREIGN KEY ([PublicationRequestTypeID]) REFERENCES [dbo].[PUB_RequestType]([PublicationRequestTypeID])
    );
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name] = N'IX_PUB_Request_WorkflowStatus' AND object_id = OBJECT_ID(N'[dbo].[PUB_Request]'))
BEGIN
    CREATE INDEX [IX_PUB_Request_WorkflowStatus]
        ON [dbo].[PUB_Request]([WorkflowStatus]);
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name] = N'IX_PUB_Request_Department_Status' AND object_id = OBJECT_ID(N'[dbo].[PUB_Request]'))
BEGIN
    CREATE INDEX [IX_PUB_Request_Department_Status]
        ON [dbo].[PUB_Request]([DepartmentUnitID], [WorkflowStatus]);
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name] = N'UX_PUB_Request_PublicationYearSerial' AND object_id = OBJECT_ID(N'[dbo].[PUB_Request]'))
BEGIN
    CREATE UNIQUE INDEX [UX_PUB_Request_PublicationYearSerial]
        ON [dbo].[PUB_Request]([PublicationYear], [PublicationSerial])
        WHERE [PublicationYear] IS NOT NULL AND [PublicationSerial] IS NOT NULL;
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE [name] = N'UX_PUB_Request_PublicationNumber' AND object_id = OBJECT_ID(N'[dbo].[PUB_Request]'))
BEGIN
    CREATE UNIQUE INDEX [UX_PUB_Request_PublicationNumber]
        ON [dbo].[PUB_Request]([PublicationNumber])
        WHERE [PublicationNumber] IS NOT NULL;
END
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[PUB_Request]', N'U') IS NOT NULL
BEGIN
    DROP TABLE [dbo].[PUB_Request];
END

IF OBJECT_ID(N'[dbo].[PUB_SerialCounter]', N'U') IS NOT NULL
BEGIN
    DROP TABLE [dbo].[PUB_SerialCounter];
END

IF OBJECT_ID(N'[dbo].[PUB_AdminDepartment]', N'U') IS NOT NULL
BEGIN
    DROP TABLE [dbo].[PUB_AdminDepartment];
END

IF OBJECT_ID(N'[dbo].[PUB_DepartmentRequestType]', N'U') IS NOT NULL
BEGIN
    DROP TABLE [dbo].[PUB_DepartmentRequestType];
END

IF OBJECT_ID(N'[dbo].[PUB_RequestType]', N'U') IS NOT NULL
BEGIN
    DROP TABLE [dbo].[PUB_RequestType];
END
");
        }
    }
}
