/*
  Post-check for MendGroup remap (Category 124 only)
  - Ensures all CdCategoryMand links point to AdminCatalogCategoryGroups within same category
*/

SET NOCOUNT ON;

DECLARE @CategoryId INT = 124;

IF OBJECT_ID('tempdb..#CategoryGroups') IS NOT NULL DROP TABLE #CategoryGroups;

SELECT
    g.GroupId,
    g.CategoryId,
    g.GroupName,
    g.ParentGroupId,
    g.DisplayOrder,
    g.IsActive
INTO #CategoryGroups
FROM dbo.AdminCatalogCategoryGroups g
WHERE g.CategoryId = @CategoryId;

SELECT GroupId, CategoryId, GroupName, ParentGroupId, DisplayOrder, IsActive
FROM #CategoryGroups
ORDER BY IsActive DESC, DisplayOrder, GroupId;

SELECT
    cm.MendSQL,
    cm.MendCategory,
    cm.MendField,
    cm.MendStat,
    cm.MendGroup,
    CategoryGroupName = cg.GroupName,
    IsMappedToCategoryGroup = CASE WHEN cg.GroupId IS NULL THEN 0 ELSE 1 END
FROM dbo.CdCategoryMand cm
LEFT JOIN #CategoryGroups cg
  ON cg.GroupId = cm.MendGroup
WHERE cm.MendCategory = @CategoryId
ORDER BY cm.MendGroup, cm.MendSQL;

SELECT
    BrokenLinks = COUNT(*)
FROM dbo.CdCategoryMand cm
LEFT JOIN #CategoryGroups cg
  ON cg.GroupId = cm.MendGroup
WHERE cm.MendCategory = @CategoryId
  AND cg.GroupId IS NULL;
