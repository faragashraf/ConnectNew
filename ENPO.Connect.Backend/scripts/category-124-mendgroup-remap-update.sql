/*
  Safe MendGroup remap update (Category 124 only)
  - Uses AdminCatalogCategoryGroups IDs as canonical targets
  - Creates missing groups (by name) in AdminCatalogCategoryGroups when no match exists
  - Skips ambiguous names (multiple matches in same category)
  - Updates only AUTO_FIXABLE links inside MendCategory = 124
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @CategoryId INT = 124;

BEGIN TRY
    BEGIN TRAN;

    IF OBJECT_ID('tempdb..#CategoryGroups') IS NOT NULL DROP TABLE #CategoryGroups;
    IF OBJECT_ID('tempdb..#BrokenLinks') IS NOT NULL DROP TABLE #BrokenLinks;
    IF OBJECT_ID('tempdb..#Preview') IS NOT NULL DROP TABLE #Preview;
    IF OBJECT_ID('tempdb..#GroupsToCreate') IS NOT NULL DROP TABLE #GroupsToCreate;
    IF OBJECT_ID('tempdb..#CreatedGroups') IS NOT NULL DROP TABLE #CreatedGroups;
    IF OBJECT_ID('tempdb..#InsertedLegacyGroups') IS NOT NULL DROP TABLE #InsertedLegacyGroups;
    IF OBJECT_ID('tempdb..#UpdatedRows') IS NOT NULL DROP TABLE #UpdatedRows;

    SELECT
        g.GroupId,
        g.CategoryId,
        g.GroupName,
        g.ParentGroupId,
        g.DisplayOrder,
        g.IsActive,
        NormalizedGroupName = LOWER(LTRIM(RTRIM(REPLACE(REPLACE(REPLACE(ISNULL(g.GroupName, N''), CHAR(13), N''), CHAR(10), N''), NCHAR(160), N' '))))
    INTO #CategoryGroups
    FROM dbo.AdminCatalogCategoryGroups g
    WHERE g.CategoryId = @CategoryId;

    SELECT
        cm.MendSQL,
        cm.MendField,
        cm.MendGroup AS OldMendGroup,
        OldGroupName = COALESCE(mg.GroupName, agAny.GroupName),
        OldGroupNameSource = CASE
            WHEN mg.GroupName IS NOT NULL THEN 'MandGroups'
            WHEN agAny.GroupName IS NOT NULL THEN 'AdminCatalogCategoryGroups(other category)'
            ELSE 'Unknown'
        END,
        OldGroupCategoryId = agAny.CategoryId,
        OldNormalizedGroupName = LOWER(LTRIM(RTRIM(REPLACE(REPLACE(REPLACE(ISNULL(COALESCE(mg.GroupName, agAny.GroupName), N''), CHAR(13), N''), CHAR(10), N''), NCHAR(160), N' '))))
    INTO #BrokenLinks
    FROM dbo.CdCategoryMand cm
    LEFT JOIN dbo.MandGroups mg
        ON mg.GroupId = cm.MendGroup
    LEFT JOIN dbo.AdminCatalogCategoryGroups agAny
        ON agAny.GroupId = cm.MendGroup
    LEFT JOIN #CategoryGroups cg
        ON cg.GroupId = cm.MendGroup
    WHERE cm.MendCategory = @CategoryId
      AND cg.GroupId IS NULL;

    SELECT
        b.MendSQL,
        b.MendField,
        b.OldMendGroup,
        b.OldGroupName,
        b.OldGroupNameSource,
        b.OldGroupCategoryId,
        b.OldNormalizedGroupName,
        CandidateCount = COUNT(cg.GroupId),
        NewGroupId = MIN(cg.GroupId),
        NewGroupName = MIN(cg.GroupName),
        MappingStatus = CASE
            WHEN b.OldGroupName IS NULL OR b.OldNormalizedGroupName = N'' THEN N'UNMAPPED_NO_OLD_NAME'
            WHEN COUNT(cg.GroupId) = 0 THEN N'UNMAPPED_NO_NAME_MATCH'
            WHEN COUNT(cg.GroupId) = 1 THEN N'AUTO_FIXABLE'
            ELSE N'AMBIGUOUS'
        END
    INTO #Preview
    FROM #BrokenLinks b
    LEFT JOIN #CategoryGroups cg
        ON cg.NormalizedGroupName = b.OldNormalizedGroupName
    GROUP BY
        b.MendSQL,
        b.MendField,
        b.OldMendGroup,
        b.OldGroupName,
        b.OldGroupNameSource,
        b.OldGroupCategoryId,
        b.OldNormalizedGroupName;

    SELECT DISTINCT
        GroupName = p.OldGroupName,
        NormalizedGroupName = p.OldNormalizedGroupName
    INTO #GroupsToCreate
    FROM #Preview p
    WHERE p.MappingStatus = N'UNMAPPED_NO_NAME_MATCH'
      AND p.OldGroupName IS NOT NULL
      AND p.OldNormalizedGroupName <> N'';

    CREATE TABLE #CreatedGroups
    (
        GroupId int NOT NULL,
        GroupName nvarchar(200) NOT NULL
    );

    IF EXISTS (SELECT 1 FROM #GroupsToCreate)
    BEGIN
        DECLARE @ApplicationId NVARCHAR(10) =
            (SELECT TOP (1) c.ApplicationID FROM dbo.CDCategory c WHERE c.CatId = @CategoryId);
        DECLARE @NextGroupId INT = ISNULL((SELECT MAX(g.GroupId) FROM dbo.AdminCatalogCategoryGroups g), 0);
        DECLARE @NextDisplayOrder INT = ISNULL((SELECT MAX(g.DisplayOrder) FROM dbo.AdminCatalogCategoryGroups g WHERE g.CategoryId = @CategoryId), 0);

        ;WITH NewGroups AS
        (
            SELECT
                GroupName,
                NormalizedGroupName,
                rn = ROW_NUMBER() OVER (ORDER BY GroupName)
            FROM #GroupsToCreate
        )
        INSERT INTO dbo.AdminCatalogCategoryGroups
        (
            GroupId,
            CategoryId,
            ApplicationID,
            GroupName,
            GroupDescription,
            ParentGroupId,
            DisplayOrder,
            IsActive,
            StampDate,
            CreatedBy
        )
        OUTPUT INSERTED.GroupId, INSERTED.GroupName
        INTO #CreatedGroups(GroupId, GroupName)
        SELECT
            @NextGroupId + ng.rn,
            @CategoryId,
            ISNULL(@ApplicationId, N''),
            ng.GroupName,
            N'Auto-created during legacy MendGroup remap for Category 124',
            NULL,
            @NextDisplayOrder + ng.rn,
            1,
            GETDATE(),
            NULL
        FROM NewGroups ng;
    END;

    -- Rebuild category groups after optional creation.
    TRUNCATE TABLE #CategoryGroups;
    INSERT INTO #CategoryGroups (GroupId, CategoryId, GroupName, ParentGroupId, DisplayOrder, IsActive, NormalizedGroupName)
    SELECT
        g.GroupId,
        g.CategoryId,
        g.GroupName,
        g.ParentGroupId,
        g.DisplayOrder,
        g.IsActive,
        LOWER(LTRIM(RTRIM(REPLACE(REPLACE(REPLACE(ISNULL(g.GroupName, N''), CHAR(13), N''), CHAR(10), N''), NCHAR(160), N' '))))
    FROM dbo.AdminCatalogCategoryGroups g
    WHERE g.CategoryId = @CategoryId;

    TRUNCATE TABLE #Preview;
    INSERT INTO #Preview
    (
        MendSQL,
        MendField,
        OldMendGroup,
        OldGroupName,
        OldGroupNameSource,
        OldGroupCategoryId,
        OldNormalizedGroupName,
        CandidateCount,
        NewGroupId,
        NewGroupName,
        MappingStatus
    )
    SELECT
        b.MendSQL,
        b.MendField,
        b.OldMendGroup,
        b.OldGroupName,
        b.OldGroupNameSource,
        b.OldGroupCategoryId,
        b.OldNormalizedGroupName,
        CandidateCount = COUNT(cg.GroupId),
        NewGroupId = MIN(cg.GroupId),
        NewGroupName = MIN(cg.GroupName),
        MappingStatus = CASE
            WHEN b.OldGroupName IS NULL OR b.OldNormalizedGroupName = N'' THEN N'UNMAPPED_NO_OLD_NAME'
            WHEN COUNT(cg.GroupId) = 0 THEN N'UNMAPPED_NO_NAME_MATCH'
            WHEN COUNT(cg.GroupId) = 1 THEN N'AUTO_FIXABLE'
            ELSE N'AMBIGUOUS'
        END
    FROM #BrokenLinks b
    LEFT JOIN #CategoryGroups cg
        ON cg.NormalizedGroupName = b.OldNormalizedGroupName
    GROUP BY
        b.MendSQL,
        b.MendField,
        b.OldMendGroup,
        b.OldGroupName,
        b.OldGroupNameSource,
        b.OldGroupCategoryId,
        b.OldNormalizedGroupName;

    CREATE TABLE #UpdatedRows
    (
        MendSQL int NOT NULL,
        MendField nvarchar(50) NOT NULL,
        OldMendGroup int NOT NULL,
        NewMendGroup int NOT NULL
    );

    CREATE TABLE #InsertedLegacyGroups
    (
        GroupID int NOT NULL,
        GroupName nvarchar(100) NULL
    );

    /*
      Compatibility guard:
      CdCategoryMand.MendGroup still has FK to dbo.MandGroups.
      Ensure all target group IDs exist there before updating links.
    */
    INSERT INTO dbo.MandGroups
    (
        GroupID,
        GroupName,
        GroupDescription,
        GroupWithInRow,
        IsExtendable
    )
    OUTPUT INSERTED.GroupID, INSERTED.GroupName INTO #InsertedLegacyGroups(GroupID, GroupName)
    SELECT DISTINCT
        p.NewGroupId,
        LEFT(p.NewGroupName, 100),
        N'Auto-synced from AdminCatalogCategoryGroups for legacy FK compatibility (Category 124)',
        12,
        0
    FROM #Preview p
    LEFT JOIN dbo.MandGroups mg
      ON mg.GroupID = p.NewGroupId
    WHERE p.MappingStatus = N'AUTO_FIXABLE'
      AND p.NewGroupId IS NOT NULL
      AND mg.GroupID IS NULL;

    UPDATE cm
       SET cm.MendGroup = p.NewGroupId
    OUTPUT
        INSERTED.MendSQL,
        INSERTED.MendField,
        DELETED.MendGroup,
        INSERTED.MendGroup
    INTO #UpdatedRows(MendSQL, MendField, OldMendGroup, NewMendGroup)
    FROM dbo.CdCategoryMand cm
    JOIN #Preview p
      ON p.MendSQL = cm.MendSQL
    WHERE cm.MendCategory = @CategoryId
      AND p.MappingStatus = N'AUTO_FIXABLE'
      AND p.NewGroupId IS NOT NULL
      AND cm.MendGroup <> p.NewGroupId;

    SELECT GroupId, GroupName
    FROM #CreatedGroups
    ORDER BY GroupId;

    SELECT MendSQL, MendField, OldMendGroup, NewMendGroup
    FROM #UpdatedRows
    ORDER BY OldMendGroup, NewMendGroup, MendSQL;

    SELECT GroupID, GroupName
    FROM #InsertedLegacyGroups
    ORDER BY GroupID;

    SELECT
        UpdatedRows = (SELECT COUNT(*) FROM #UpdatedRows),
        CreatedGroups = (SELECT COUNT(*) FROM #CreatedGroups),
        InsertedLegacyGroups = (SELECT COUNT(*) FROM #InsertedLegacyGroups),
        RemainingAmbiguous = (SELECT COUNT(*) FROM #Preview WHERE MappingStatus = N'AMBIGUOUS'),
        RemainingUnmappedNoNameMatch = (SELECT COUNT(*) FROM #Preview WHERE MappingStatus = N'UNMAPPED_NO_NAME_MATCH'),
        RemainingUnmappedNoOldName = (SELECT COUNT(*) FROM #Preview WHERE MappingStatus = N'UNMAPPED_NO_OLD_NAME');

    COMMIT TRAN;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRAN;

    THROW;
END CATCH;
