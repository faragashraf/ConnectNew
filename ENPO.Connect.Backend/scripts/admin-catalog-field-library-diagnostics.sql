/*
  Admin Control Center Catalog - Field Library (CDMend)
  -----------------------------------------------------
  Non-destructive diagnostics script used before enabling delete behavior.
  Run against Connect DB.
*/

SET NOCOUNT ON;

-- 1) Inventory
SELECT 'CDMend_Total' AS Metric, COUNT(*) AS Value FROM dbo.CDMend;
SELECT 'CDMend_Active' AS Metric, COUNT(*) AS Value FROM dbo.CDMend WHERE ISNULL(CDMendStat, 0) = 0;
SELECT 'CDMend_Inactive' AS Metric, COUNT(*) AS Value FROM dbo.CDMend WHERE ISNULL(CDMendStat, 0) = 1;

-- 2) Effective usages that block hard delete
SELECT 'CdCategoryMand_Links' AS Metric, COUNT(*) AS Value FROM dbo.CdCategoryMand;
SELECT 'SubjectCategoryFieldSettings_Links' AS Metric, COUNT(*) AS Value FROM dbo.SubjectCategoryFieldSettings;
SELECT 'TKMendFields_ByFieldKey' AS Metric, COUNT(*) AS Value
FROM dbo.TKMendFields tk
INNER JOIN dbo.CDMend f ON f.CDMendTxt = tk.FildKind;

-- 3) Domain lookups discovered from production data
SELECT ISNULL(CDMendType, '<NULL>') AS CDMendType, COUNT(*) AS Cnt
FROM dbo.CDMend
GROUP BY CDMendType
ORDER BY Cnt DESC, CDMendType;

SELECT ISNULL(CDMendDatatype, '<NULL>') AS CDMendDatatype, COUNT(*) AS Cnt
FROM dbo.CDMend
GROUP BY CDMendDatatype
ORDER BY Cnt DESC, CDMendDatatype;

SELECT ISNULL(NULLIF(ApplicationID, ''), '<NULL>') AS ApplicationID, COUNT(*) AS Cnt
FROM dbo.CDMend
GROUP BY ApplicationID
ORDER BY Cnt DESC, ApplicationID;

-- 4) Duplicate key diagnostics (important for API identity strategy)
SELECT CDMendTxt, COUNT(*) AS Copies
FROM dbo.CDMend
GROUP BY CDMendTxt
HAVING COUNT(*) > 1
ORDER BY Copies DESC, CDMendTxt;

SELECT CDMendSQL, COUNT(*) AS Copies
FROM dbo.CDMend
GROUP BY CDMendSQL
HAVING COUNT(*) > 1
ORDER BY Copies DESC, CDMendSQL;
