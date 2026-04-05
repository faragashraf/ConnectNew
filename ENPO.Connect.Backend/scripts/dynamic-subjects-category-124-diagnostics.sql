/*
  Dynamic Subjects diagnostics for category 124 (التظلمات)
  Purpose:
  - Verify legacy links in CdCategoryMand
  - Verify matching metadata in Cdmend
  - Detect status-flag mismatches
  - Validate effective field selection count for DynamicSubjects
*/

SET NOCOUNT ON;

DECLARE @CategoryId INT = 124;
DECLARE @RequestedAppId NVARCHAR(50) = N'60';

PRINT '1) Category info';
SELECT CatId, CatName, CatParent, ApplicationId, CatStatus
FROM Cdcategory
WHERE CatId = @CategoryId;

PRINT '2) Active links by category';
SELECT MendSQL, MendCategory, MendField, MendStat, MendGroup
FROM CdCategoryMand
WHERE MendCategory = @CategoryId
ORDER BY MendGroup, MendSQL;

PRINT '3) Link status distribution';
SELECT MendStat, COUNT(*) AS Cnt
FROM CdCategoryMand
WHERE MendCategory = @CategoryId
GROUP BY MendStat;

PRINT '4) Matching metadata (normalized match)';
SELECT md.CdmendSql, md.CdmendTxt, md.CdmendStat, md.CdmendType, md.CDMendLbl, md.ApplicationId
FROM Cdmend md
WHERE LTRIM(RTRIM(LOWER(md.CdmendTxt))) IN (
    SELECT LTRIM(RTRIM(LOWER(cm.MendField)))
    FROM CdCategoryMand cm
    WHERE cm.MendCategory = @CategoryId
)
ORDER BY md.CdmendTxt, md.ApplicationId;

PRINT '5) Metadata status distribution for matched rows';
SELECT md.CdmendStat, COUNT(*) AS Cnt
FROM Cdmend md
WHERE LTRIM(RTRIM(LOWER(md.CdmendTxt))) IN (
    SELECT LTRIM(RTRIM(LOWER(cm.MendField)))
    FROM CdCategoryMand cm
    WHERE cm.MendCategory = @CategoryId
)
GROUP BY md.CdmendStat;

PRINT '6) Links without metadata (normalized)';
SELECT cm.MendSQL, cm.MendField
FROM CdCategoryMand cm
LEFT JOIN Cdmend md
    ON LTRIM(RTRIM(LOWER(md.CdmendTxt))) = LTRIM(RTRIM(LOWER(cm.MendField)))
WHERE cm.MendCategory = @CategoryId
  AND md.CdmendTxt IS NULL
ORDER BY cm.MendSQL;

PRINT '7) Current DynamicSubjects filtering count (legacy strict status)';
SELECT COUNT(*) AS StrictCount
FROM CdCategoryMand link
JOIN Cdmend mend
    ON link.MendField = mend.CdmendTxt
LEFT JOIN SubjectCategoryFieldSettings fieldSetting
    ON link.MendSql = fieldSetting.MendSql
WHERE link.MendCategory = @CategoryId
  AND link.MendStat = 0
  AND mend.CdmendStat = 0
  AND (fieldSetting.MendSql IS NULL OR fieldSetting.IsVisible = 1);

PRINT '8) Compatibility selection count (app-ranked + legacy status fallback)';
;WITH Links AS (
  SELECT l.MendSql, l.MendField
  FROM CdCategoryMand l
  LEFT JOIN SubjectCategoryFieldSettings fs ON fs.MendSql = l.MendSql
  WHERE l.MendCategory = @CategoryId
    AND l.MendStat = 0
    AND (fs.MendSql IS NULL OR fs.IsVisible = 1)
),
Cat AS (
  SELECT CatId, ApplicationId FROM Cdcategory WHERE CatId = @CategoryId
),
Candidates AS (
  SELECT l.MendSql AS LinkMendSql,
         m.CdmendSql,
         m.CdmendTxt,
         m.ApplicationId,
         m.CdmendStat,
         CASE
           WHEN LTRIM(RTRIM(ISNULL(m.ApplicationId,''))) = LTRIM(RTRIM(@RequestedAppId)) THEN 0
           WHEN LTRIM(RTRIM(ISNULL(m.ApplicationId,''))) = LTRIM(RTRIM(ISNULL(c.ApplicationId,''))) THEN 1
           WHEN LTRIM(RTRIM(ISNULL(m.ApplicationId,''))) = '' THEN 2
           ELSE 3
         END AS AppRank
  FROM Links l
  CROSS JOIN Cat c
  JOIN Cdmend m
    ON LOWER(LTRIM(RTRIM(m.CdmendTxt))) = LOWER(LTRIM(RTRIM(l.MendField)))
),
StatusPrepared AS (
  SELECT *,
         MIN(CASE WHEN CdmendStat = 0 THEN 0 ELSE 1 END) OVER (PARTITION BY LinkMendSql, AppRank) AS MinStatusInRank
  FROM Candidates
),
Chosen AS (
  SELECT *,
         ROW_NUMBER() OVER (
           PARTITION BY LinkMendSql
           ORDER BY AppRank,
                    CASE WHEN MinStatusInRank = 0 THEN CASE WHEN CdmendStat = 0 THEN 0 ELSE 1 END ELSE 0 END,
                    CdmendSql
         ) AS rn
  FROM StatusPrepared
)
SELECT COUNT(*) AS CompatibilityCount
FROM Chosen
WHERE rn = 1;

/*
Optional data-normalization template (NOT executed by default):
--------------------------------------------------------------
This can be used only if you choose to normalize legacy status semantics.

BEGIN TRAN;

UPDATE md
SET md.CdmendStat = 0
FROM Cdmend md
JOIN CdCategoryMand cm
  ON LTRIM(RTRIM(LOWER(md.CdmendTxt))) = LTRIM(RTRIM(LOWER(cm.MendField)))
WHERE cm.MendCategory = @CategoryId
  AND cm.MendStat = 0
  AND md.ApplicationId = @RequestedAppId
  AND md.CdmendStat = 1;

-- Verify
SELECT @@ROWCOUNT AS RowsUpdated;

-- COMMIT TRAN;
-- ROLLBACK TRAN;
*/
