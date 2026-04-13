using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Persistence.Data;

namespace Persistence.Migrations
{
    [DbContext(typeof(Attach_HeldContext))]
    [Migration("20260413_AddAttachmentValidationFoundation")]
    public partial class AddAttachmentValidationFoundation : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[AttachmentValidationDocumentTypes]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[AttachmentValidationDocumentTypes](
        [Id] [int] IDENTITY(1,1) NOT NULL,
        [DocumentTypeCode] [nvarchar](100) NOT NULL,
        [DocumentTypeNameAr] [nvarchar](200) NOT NULL,
        [DescriptionAr] [nvarchar](1000) NULL,
        [ValidationMode] [nvarchar](30) NOT NULL CONSTRAINT [DF_AttachmentValidationDocumentTypes_ValidationMode] DEFAULT (N'UploadOnly'),
        [IsValidationRequired] [bit] NOT NULL CONSTRAINT [DF_AttachmentValidationDocumentTypes_IsValidationRequired] DEFAULT ((0)),
        [IsActive] [bit] NOT NULL CONSTRAINT [DF_AttachmentValidationDocumentTypes_IsActive] DEFAULT ((1)),
        [CreatedBy] [nvarchar](64) NOT NULL CONSTRAINT [DF_AttachmentValidationDocumentTypes_CreatedBy] DEFAULT (N'SYSTEM'),
        [CreatedDate] [datetime2](7) NOT NULL CONSTRAINT [DF_AttachmentValidationDocumentTypes_CreatedDate] DEFAULT (GETUTCDATE()),
        [LastModifiedBy] [nvarchar](64) NULL,
        [LastModifiedDate] [datetime2](7) NULL,
        CONSTRAINT [PK_AttachmentValidationDocumentTypes] PRIMARY KEY CLUSTERED ([Id] ASC)
    );
END
");

            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[AttachmentValidationRules]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[AttachmentValidationRules](
        [Id] [int] IDENTITY(1,1) NOT NULL,
        [RuleCode] [nvarchar](100) NOT NULL,
        [RuleNameAr] [nvarchar](200) NOT NULL,
        [DescriptionAr] [nvarchar](1000) NULL,
        [ParameterSchemaJson] [nvarchar](max) NULL,
        [IsSystemRule] [bit] NOT NULL CONSTRAINT [DF_AttachmentValidationRules_IsSystemRule] DEFAULT ((1)),
        [IsActive] [bit] NOT NULL CONSTRAINT [DF_AttachmentValidationRules_IsActive] DEFAULT ((1)),
        [CreatedBy] [nvarchar](64) NOT NULL CONSTRAINT [DF_AttachmentValidationRules_CreatedBy] DEFAULT (N'SYSTEM'),
        [CreatedDate] [datetime2](7) NOT NULL CONSTRAINT [DF_AttachmentValidationRules_CreatedDate] DEFAULT (GETUTCDATE()),
        [LastModifiedBy] [nvarchar](64) NULL,
        [LastModifiedDate] [datetime2](7) NULL,
        CONSTRAINT [PK_AttachmentValidationRules] PRIMARY KEY CLUSTERED ([Id] ASC)
    );
END
");

            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[AttachmentValidationDocumentTypeRules]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[AttachmentValidationDocumentTypeRules](
        [Id] [int] IDENTITY(1,1) NOT NULL,
        [DocumentTypeID] [int] NOT NULL,
        [RuleID] [int] NOT NULL,
        [RuleOrder] [int] NOT NULL CONSTRAINT [DF_AttachmentValidationDocumentTypeRules_RuleOrder] DEFAULT ((100)),
        [IsActive] [bit] NOT NULL CONSTRAINT [DF_AttachmentValidationDocumentTypeRules_IsActive] DEFAULT ((1)),
        [IsRequired] [bit] NOT NULL CONSTRAINT [DF_AttachmentValidationDocumentTypeRules_IsRequired] DEFAULT ((1)),
        [StopOnFailure] [bit] NOT NULL CONSTRAINT [DF_AttachmentValidationDocumentTypeRules_StopOnFailure] DEFAULT ((1)),
        [FailureMessageAr] [nvarchar](500) NULL,
        [ParametersJson] [nvarchar](max) NULL,
        [CreatedBy] [nvarchar](64) NOT NULL CONSTRAINT [DF_AttachmentValidationDocumentTypeRules_CreatedBy] DEFAULT (N'SYSTEM'),
        [CreatedDate] [datetime2](7) NOT NULL CONSTRAINT [DF_AttachmentValidationDocumentTypeRules_CreatedDate] DEFAULT (GETUTCDATE()),
        [LastModifiedBy] [nvarchar](64) NULL,
        [LastModifiedDate] [datetime2](7) NULL,
        CONSTRAINT [PK_AttachmentValidationDocumentTypeRules] PRIMARY KEY CLUSTERED ([Id] ASC)
    );
END
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE [name] = N'FK_AttachmentValidationDocumentTypeRules_DocumentTypes'
      AND [parent_object_id] = OBJECT_ID(N'[dbo].[AttachmentValidationDocumentTypeRules]')
)
BEGIN
    ALTER TABLE [dbo].[AttachmentValidationDocumentTypeRules]
    ADD CONSTRAINT [FK_AttachmentValidationDocumentTypeRules_DocumentTypes]
        FOREIGN KEY ([DocumentTypeID]) REFERENCES [dbo].[AttachmentValidationDocumentTypes] ([Id])
        ON DELETE CASCADE;
END
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE [name] = N'FK_AttachmentValidationDocumentTypeRules_Rules'
      AND [parent_object_id] = OBJECT_ID(N'[dbo].[AttachmentValidationDocumentTypeRules]')
)
BEGIN
    ALTER TABLE [dbo].[AttachmentValidationDocumentTypeRules]
    ADD CONSTRAINT [FK_AttachmentValidationDocumentTypeRules_Rules]
        FOREIGN KEY ([RuleID]) REFERENCES [dbo].[AttachmentValidationRules] ([Id]);
END
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE [name] = N'IX_AttachmentValidationDocumentTypes_IsActive'
      AND [object_id] = OBJECT_ID(N'[dbo].[AttachmentValidationDocumentTypes]')
)
BEGIN
    CREATE NONCLUSTERED INDEX [IX_AttachmentValidationDocumentTypes_IsActive]
        ON [dbo].[AttachmentValidationDocumentTypes] ([IsActive]);
END
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE [name] = N'UX_AttachmentValidationDocumentTypes_DocumentTypeCode'
      AND [object_id] = OBJECT_ID(N'[dbo].[AttachmentValidationDocumentTypes]')
)
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX [UX_AttachmentValidationDocumentTypes_DocumentTypeCode]
        ON [dbo].[AttachmentValidationDocumentTypes] ([DocumentTypeCode]);
END
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE [name] = N'IX_AttachmentValidationRules_IsActive'
      AND [object_id] = OBJECT_ID(N'[dbo].[AttachmentValidationRules]')
)
BEGIN
    CREATE NONCLUSTERED INDEX [IX_AttachmentValidationRules_IsActive]
        ON [dbo].[AttachmentValidationRules] ([IsActive]);
END
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE [name] = N'UX_AttachmentValidationRules_RuleCode'
      AND [object_id] = OBJECT_ID(N'[dbo].[AttachmentValidationRules]')
)
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX [UX_AttachmentValidationRules_RuleCode]
        ON [dbo].[AttachmentValidationRules] ([RuleCode]);
END
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE [name] = N'IX_AttachmentValidationDocumentTypeRules_DocumentType_IsActive'
      AND [object_id] = OBJECT_ID(N'[dbo].[AttachmentValidationDocumentTypeRules]')
)
BEGIN
    CREATE NONCLUSTERED INDEX [IX_AttachmentValidationDocumentTypeRules_DocumentType_IsActive]
        ON [dbo].[AttachmentValidationDocumentTypeRules] ([DocumentTypeID], [IsActive]);
END
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE [name] = N'IX_AttachmentValidationDocumentTypeRules_RuleID'
      AND [object_id] = OBJECT_ID(N'[dbo].[AttachmentValidationDocumentTypeRules]')
)
BEGIN
    CREATE NONCLUSTERED INDEX [IX_AttachmentValidationDocumentTypeRules_RuleID]
        ON [dbo].[AttachmentValidationDocumentTypeRules] ([RuleID]);
END
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE [name] = N'UX_AttachmentValidationDocumentTypeRules_DocumentType_Rule'
      AND [object_id] = OBJECT_ID(N'[dbo].[AttachmentValidationDocumentTypeRules]')
)
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX [UX_AttachmentValidationDocumentTypeRules_DocumentType_Rule]
        ON [dbo].[AttachmentValidationDocumentTypeRules] ([DocumentTypeID], [RuleID]);
END
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (SELECT 1 FROM [dbo].[AttachmentValidationRules] WHERE [RuleCode] = N'MIN_FILE_COUNT')
BEGIN
    INSERT INTO [dbo].[AttachmentValidationRules]
        ([RuleCode], [RuleNameAr], [DescriptionAr], [ParameterSchemaJson], [IsSystemRule], [IsActive], [CreatedBy])
    VALUES
        (N'MIN_FILE_COUNT', N'الحد الأدنى لعدد الملفات', N'يتحقق من أقل عدد ملفات مطلوب.', N'{""min"":1}', 1, 1, N'SYSTEM');
END
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (SELECT 1 FROM [dbo].[AttachmentValidationRules] WHERE [RuleCode] = N'MAX_FILE_COUNT')
BEGIN
    INSERT INTO [dbo].[AttachmentValidationRules]
        ([RuleCode], [RuleNameAr], [DescriptionAr], [ParameterSchemaJson], [IsSystemRule], [IsActive], [CreatedBy])
    VALUES
        (N'MAX_FILE_COUNT', N'الحد الأقصى لعدد الملفات', N'يتحقق من أكبر عدد ملفات مسموح.', N'{""max"":10}', 1, 1, N'SYSTEM');
END
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (SELECT 1 FROM [dbo].[AttachmentValidationRules] WHERE [RuleCode] = N'ALLOWED_EXTENSIONS')
BEGIN
    INSERT INTO [dbo].[AttachmentValidationRules]
        ([RuleCode], [RuleNameAr], [DescriptionAr], [ParameterSchemaJson], [IsSystemRule], [IsActive], [CreatedBy])
    VALUES
        (N'ALLOWED_EXTENSIONS', N'الامتدادات المسموحة', N'يتحقق من امتدادات الملفات المرفوعة.', N'{""extensions"":["".pdf"","".jpg"","".jpeg"","".png"","".gif"","".bmp"","".webp""]}', 1, 1, N'SYSTEM');
END
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (SELECT 1 FROM [dbo].[AttachmentValidationRules] WHERE [RuleCode] = N'MAX_FILE_SIZE_MB')
BEGIN
    INSERT INTO [dbo].[AttachmentValidationRules]
        ([RuleCode], [RuleNameAr], [DescriptionAr], [ParameterSchemaJson], [IsSystemRule], [IsActive], [CreatedBy])
    VALUES
        (N'MAX_FILE_SIZE_MB', N'أقصى حجم للملف (ميجابايت)', N'يتحقق من الحد الأقصى لحجم كل ملف.', N'{""maxMb"":10}', 1, 1, N'SYSTEM');
END
");

            migrationBuilder.Sql(@"
IF NOT EXISTS (SELECT 1 FROM [dbo].[AttachmentValidationDocumentTypes] WHERE [DocumentTypeCode] = N'SUMMER_PAYMENT_RECEIPT')
BEGIN
    INSERT INTO [dbo].[AttachmentValidationDocumentTypes]
        ([DocumentTypeCode], [DocumentTypeNameAr], [DescriptionAr], [ValidationMode], [IsValidationRequired], [IsActive], [CreatedBy])
    VALUES
        (N'SUMMER_PAYMENT_RECEIPT', N'مرفق سداد المصايف', N'إعدادات التحقق لمستندات سداد المصايف.', N'UploadAndValidate', 1, 1, N'SYSTEM');
END
");

            migrationBuilder.Sql(@"
DECLARE @DocumentTypeId int = (
    SELECT TOP (1) [Id]
    FROM [dbo].[AttachmentValidationDocumentTypes]
    WHERE [DocumentTypeCode] = N'SUMMER_PAYMENT_RECEIPT'
);

DECLARE @RuleMinCountId int = (
    SELECT TOP (1) [Id]
    FROM [dbo].[AttachmentValidationRules]
    WHERE [RuleCode] = N'MIN_FILE_COUNT'
);

DECLARE @RuleAllowedExtensionsId int = (
    SELECT TOP (1) [Id]
    FROM [dbo].[AttachmentValidationRules]
    WHERE [RuleCode] = N'ALLOWED_EXTENSIONS'
);

DECLARE @RuleMaxFileSizeId int = (
    SELECT TOP (1) [Id]
    FROM [dbo].[AttachmentValidationRules]
    WHERE [RuleCode] = N'MAX_FILE_SIZE_MB'
);

IF @DocumentTypeId IS NOT NULL AND @RuleMinCountId IS NOT NULL
   AND NOT EXISTS (
       SELECT 1 FROM [dbo].[AttachmentValidationDocumentTypeRules]
       WHERE [DocumentTypeID] = @DocumentTypeId AND [RuleID] = @RuleMinCountId
   )
BEGIN
    INSERT INTO [dbo].[AttachmentValidationDocumentTypeRules]
        ([DocumentTypeID], [RuleID], [RuleOrder], [IsActive], [IsRequired], [StopOnFailure], [FailureMessageAr], [ParametersJson], [CreatedBy])
    VALUES
        (@DocumentTypeId, @RuleMinCountId, 10, 1, 1, 1, N'يجب إرفاق مستند سداد واحد على الأقل.', N'{""min"":1}', N'SYSTEM');
END

IF @DocumentTypeId IS NOT NULL AND @RuleAllowedExtensionsId IS NOT NULL
   AND NOT EXISTS (
       SELECT 1 FROM [dbo].[AttachmentValidationDocumentTypeRules]
       WHERE [DocumentTypeID] = @DocumentTypeId AND [RuleID] = @RuleAllowedExtensionsId
   )
BEGIN
    INSERT INTO [dbo].[AttachmentValidationDocumentTypeRules]
        ([DocumentTypeID], [RuleID], [RuleOrder], [IsActive], [IsRequired], [StopOnFailure], [FailureMessageAr], [ParametersJson], [CreatedBy])
    VALUES
        (
            @DocumentTypeId,
            @RuleAllowedExtensionsId,
            20,
            1,
            1,
            1,
            N'نوع المرفق غير مسموح. المسموح فقط PDF والصور.',
            N'{""extensions"":["".pdf"","".jpg"","".jpeg"","".png"","".gif"","".bmp"","".webp""]}',
            N'SYSTEM'
        );
END

IF @DocumentTypeId IS NOT NULL AND @RuleMaxFileSizeId IS NOT NULL
   AND NOT EXISTS (
       SELECT 1 FROM [dbo].[AttachmentValidationDocumentTypeRules]
       WHERE [DocumentTypeID] = @DocumentTypeId AND [RuleID] = @RuleMaxFileSizeId
   )
BEGIN
    INSERT INTO [dbo].[AttachmentValidationDocumentTypeRules]
        ([DocumentTypeID], [RuleID], [RuleOrder], [IsActive], [IsRequired], [StopOnFailure], [FailureMessageAr], [ParametersJson], [CreatedBy])
    VALUES
        (@DocumentTypeId, @RuleMaxFileSizeId, 30, 1, 1, 1, N'حجم المرفق يتجاوز الحد المسموح.', N'{""maxMb"":10}', N'SYSTEM');
END
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[AttachmentValidationDocumentTypeRules]', N'U') IS NOT NULL
BEGIN
    DROP TABLE [dbo].[AttachmentValidationDocumentTypeRules];
END
");

            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[AttachmentValidationRules]', N'U') IS NOT NULL
BEGIN
    DROP TABLE [dbo].[AttachmentValidationRules];
END
");

            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[AttachmentValidationDocumentTypes]', N'U') IS NOT NULL
BEGIN
    DROP TABLE [dbo].[AttachmentValidationDocumentTypes];
END
");
        }
    }
}
