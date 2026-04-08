/*
  Admin Control Center Catalog - Phase 2 schema
  Creates a category-scoped groups table with parent-child hierarchy support.
  Safe to run multiple times.
*/
SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.AdminCatalogCategoryGroups', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.AdminCatalogCategoryGroups
    (
        GroupId int NOT NULL,
        CategoryId int NOT NULL,
        ApplicationID nvarchar(10) NOT NULL,
        GroupName nvarchar(200) NOT NULL,
        GroupDescription nvarchar(255) NULL,
        ParentGroupId int NULL,
        DisplayOrder int NOT NULL CONSTRAINT DF_AdminCatalogCategoryGroups_DisplayOrder DEFAULT ((0)),
        IsActive bit NOT NULL CONSTRAINT DF_AdminCatalogCategoryGroups_IsActive DEFAULT ((1)),
        StampDate datetime NOT NULL CONSTRAINT DF_AdminCatalogCategoryGroups_StampDate DEFAULT (getdate()),
        CreatedBy int NULL,
        CONSTRAINT PK_AdminCatalogCategoryGroups PRIMARY KEY CLUSTERED (GroupId ASC)
    );
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = N'FK_AdminCatalogCategoryGroups_CDCategory'
      AND parent_object_id = OBJECT_ID(N'dbo.AdminCatalogCategoryGroups')
)
BEGIN
    ALTER TABLE dbo.AdminCatalogCategoryGroups
    ADD CONSTRAINT FK_AdminCatalogCategoryGroups_CDCategory
    FOREIGN KEY (CategoryId) REFERENCES dbo.CDCategory(CatId);
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = N'FK_AdminCatalogCategoryGroups_Parent'
      AND parent_object_id = OBJECT_ID(N'dbo.AdminCatalogCategoryGroups')
)
BEGIN
    ALTER TABLE dbo.AdminCatalogCategoryGroups
    ADD CONSTRAINT FK_AdminCatalogCategoryGroups_Parent
    FOREIGN KEY (ParentGroupId) REFERENCES dbo.AdminCatalogCategoryGroups(GroupId);
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_AdminCatalogCategoryGroups_CategoryParentOrder'
      AND object_id = OBJECT_ID(N'dbo.AdminCatalogCategoryGroups')
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_AdminCatalogCategoryGroups_CategoryParentOrder
        ON dbo.AdminCatalogCategoryGroups(CategoryId ASC, ParentGroupId ASC, DisplayOrder ASC);
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_AdminCatalogCategoryGroups_ApplicationID'
      AND object_id = OBJECT_ID(N'dbo.AdminCatalogCategoryGroups')
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_AdminCatalogCategoryGroups_ApplicationID
        ON dbo.AdminCatalogCategoryGroups(ApplicationID ASC);
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'UX_AdminCatalogCategoryGroups_CategoryParentName'
      AND object_id = OBJECT_ID(N'dbo.AdminCatalogCategoryGroups')
)
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX UX_AdminCatalogCategoryGroups_CategoryParentName
        ON dbo.AdminCatalogCategoryGroups(CategoryId ASC, ParentGroupId ASC, GroupName ASC)
        WHERE IsActive = 1;
END;
