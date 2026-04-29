/*
  Pre-check for MendGroup remap (Category 124 only)
  - Identifies broken links in CdCategoryMand
  - Builds name-based mapping candidates from AdminCatalogCategoryGroups
  - Flags AUTO_FIXABLE / AMBIGUOUS / UNMAPPED rows
*/

SET NOCOUNT ON;

DECLARE @CategoryId INT = 124;

IF OBJECT_ID('tempdb..#CategoryGroups') IS NOT NULL DROP TABLE #CategoryGroups;
IF OBJECT_ID('tempdb..#BrokenLinks') IS NOT NULL DROP TABLE #BrokenLinks;
IF OBJECT_ID('tempdb..#Preview') IS NOT NULL DROP TABLE #Preview;

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
    cm.MendCategory,
    cm.MendField,
    cm.MendStat,
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

SELECT GroupId, CategoryId, GroupName, ParentGroupId, DisplayOrder, IsActive
FROM #CategoryGroups
ORDER BY IsActive DESC, DisplayOrder, GroupId;

SELECT
    MendSQL,
    MendField,
    OldMendGroup,
    OldGroupName,
    OldGroupNameSource,
    OldGroupCategoryId,
    CandidateCount,
    NewGroupId,
    NewGroupName,
    MappingStatus
FROM #Preview
ORDER BY MappingStatus, OldMendGroup, MendSQL;

SELECT
    TotalLinksInCategory = (SELECT COUNT(*) FROM dbo.CdCategoryMand WHERE MendCategory = @CategoryId),
    BrokenLinks = (SELECT COUNT(*) FROM #BrokenLinks),
    AutoFixable = (SELECT COUNT(*) FROM #Preview WHERE MappingStatus = N'AUTO_FIXABLE'),
    Ambiguous = (SELECT COUNT(*) FROM #Preview WHERE MappingStatus = N'AMBIGUOUS'),
    UnmappedNoNameMatch = (SELECT COUNT(*) FROM #Preview WHERE MappingStatus = N'UNMAPPED_NO_NAME_MATCH'),
    UnmappedNoOldName = (SELECT COUNT(*) FROM #Preview WHERE MappingStatus = N'UNMAPPED_NO_OLD_NAME');
