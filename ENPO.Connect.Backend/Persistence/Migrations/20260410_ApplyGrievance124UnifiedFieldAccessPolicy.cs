using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Persistence.Data;

namespace Persistence.Migrations
{
    [DbContext(typeof(ConnectContext))]
    [Migration("20260410_ApplyGrievance124UnifiedFieldAccessPolicy")]
    public partial class ApplyGrievance124UnifiedFieldAccessPolicy : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[FieldAccessPolicies]', N'U') IS NULL
    RETURN;

IF OBJECT_ID(N'[dbo].[FieldAccessPolicyRules]', N'U') IS NULL
    RETURN;

IF OBJECT_ID(N'[dbo].[FieldAccessLocks]', N'U') IS NULL
    RETURN;

IF OBJECT_ID(N'[dbo].[FieldAccessOverrides]', N'U') IS NULL
    RETURN;

DECLARE @CategoryId INT = 124;
DECLARE @RequiredApplicationId NVARCHAR(50) = N'60';
DECLARE @AllowedOrgUnitId NVARCHAR(64) = N'125';
DECLARE @SystemUser NVARCHAR(64) = N'SYSTEM';
DECLARE @UtcNow DATETIME2 = GETUTCDATE();
DECLARE @PolicyName NVARCHAR(200) = N'سياسة الوصول - التظلمات';

IF NOT EXISTS
(
    SELECT 1
    FROM [dbo].[CDCategory]
    WHERE [CatId] = @CategoryId
      AND COALESCE(NULLIF(LTRIM(RTRIM([ApplicationId])), N''), @RequiredApplicationId) = @RequiredApplicationId
)
    RETURN;

DECLARE @PolicyId INT = NULL;
SELECT TOP (1) @PolicyId = [Id]
FROM [dbo].[FieldAccessPolicies]
WHERE [RequestTypeID] = @CategoryId
ORDER BY [Id] DESC;

IF @PolicyId IS NULL
BEGIN
    INSERT INTO [dbo].[FieldAccessPolicies]
    (
        [RequestTypeID],
        [Name],
        [IsActive],
        [DefaultAccessMode],
        [CreatedBy],
        [CreatedDate],
        [LastModifiedBy],
        [LastModifiedDate]
    )
    VALUES
    (
        @CategoryId,
        @PolicyName,
        1,
        N'Editable',
        @SystemUser,
        @UtcNow,
        @SystemUser,
        @UtcNow
    );

    SET @PolicyId = SCOPE_IDENTITY();
END
ELSE
BEGIN
    UPDATE [dbo].[FieldAccessPolicies]
    SET [Name] = @PolicyName,
        [IsActive] = 1,
        [DefaultAccessMode] = N'Editable',
        [LastModifiedBy] = @SystemUser,
        [LastModifiedDate] = @UtcNow
    WHERE [Id] = @PolicyId;
END

DELETE ruleItem
FROM [dbo].[FieldAccessPolicyRules] AS ruleItem
INNER JOIN [dbo].[FieldAccessPolicies] AS policyItem
    ON policyItem.[Id] = ruleItem.[PolicyID]
WHERE policyItem.[RequestTypeID] = @CategoryId;

DELETE FROM [dbo].[FieldAccessLocks]
WHERE [RequestTypeID] = @CategoryId;

DELETE overrideItem
FROM [dbo].[FieldAccessOverrides] AS overrideItem
LEFT JOIN [dbo].[Messages] AS messageItem
    ON messageItem.[MessageId] = overrideItem.[RequestID]
WHERE overrideItem.[RequestTypeID] = @CategoryId
   OR (overrideItem.[RequestID] IS NOT NULL AND messageItem.[CategoryCd] = @CategoryId);

DECLARE @ActionTakenFieldMendSql INT = NULL;

SELECT TOP (1)
    @ActionTakenFieldMendSql = binding.[MendSql]
FROM [dbo].[AdminCatalogCategoryFieldBindings] AS binding
LEFT JOIN [dbo].[CDMend] AS mend
    ON LOWER(LTRIM(RTRIM(mend.[CDMendTxt]))) = LOWER(LTRIM(RTRIM(binding.[MendField])))
WHERE binding.[CategoryId] = @CategoryId
  AND binding.[MendStat] = 0
  AND (
       LTRIM(RTRIM(COALESCE(mend.[CDMendLbl], N''))) = N'الإجراء المتخذ'
       OR LTRIM(RTRIM(COALESCE(binding.[MendField], N''))) = N'الإجراء المتخذ'
       OR REPLACE(REPLACE(REPLACE(LOWER(COALESCE(mend.[CDMendLbl], N'')), N' ', N''), N'-', N''), N'_', N'') LIKE N'%الإجراءالمتخذ%'
       OR REPLACE(REPLACE(REPLACE(LOWER(COALESCE(mend.[CDMendTxt], binding.[MendField], N'')), N' ', N''), N'-', N''), N'_', N'') IN (N'actiontaken', N'adminlastaction', N'actiontype')
  )
ORDER BY
    CASE
        WHEN LTRIM(RTRIM(COALESCE(mend.[CDMendLbl], N''))) = N'الإجراء المتخذ' THEN 0
        WHEN LTRIM(RTRIM(COALESCE(binding.[MendField], N''))) = N'الإجراء المتخذ' THEN 1
        ELSE 2
    END,
    binding.[MendSql];

INSERT INTO [dbo].[FieldAccessLocks]
(
    [RequestTypeID],
    [StageID],
    [ActionID],
    [TargetLevel],
    [TargetId],
    [LockMode],
    [AllowedOverrideSubjectType],
    [AllowedOverrideSubjectId],
    [IsActive],
    [Notes],
    [CreatedBy],
    [CreatedDate],
    [LastModifiedBy],
    [LastModifiedDate]
)
VALUES
(
    @CategoryId,
    NULL,
    NULL,
    N'Group',
    26,
    N'FullLock',
    N'OrgUnit',
    @AllowedOrgUnitId,
    1,
    N'المجموعة 26 مخفية افتراضيًا، ويسمح بعرضها فقط للوحدة التنظيمية 125.',
    @SystemUser,
    @UtcNow,
    @SystemUser,
    @UtcNow
);

IF @ActionTakenFieldMendSql IS NOT NULL AND @ActionTakenFieldMendSql > 0
BEGIN
    INSERT INTO [dbo].[FieldAccessLocks]
    (
        [RequestTypeID],
        [StageID],
        [ActionID],
        [TargetLevel],
        [TargetId],
        [LockMode],
        [AllowedOverrideSubjectType],
        [AllowedOverrideSubjectId],
        [IsActive],
        [Notes],
        [CreatedBy],
        [CreatedDate],
        [LastModifiedBy],
        [LastModifiedDate]
    )
    VALUES
    (
        @CategoryId,
        NULL,
        NULL,
        N'Field',
        @ActionTakenFieldMendSql,
        N'NoEdit',
        N'OrgUnit',
        @AllowedOrgUnitId,
        1,
        N'حقل ""الإجراء المتخذ"" ظاهر للجميع، لكن التعديل مسموح فقط للوحدة التنظيمية 125.',
        @SystemUser,
        @UtcNow,
        @SystemUser,
        @UtcNow
    );
END
ELSE
BEGIN
    PRINT N'تحذير: لم يتم العثور على الحقل ""الإجراء المتخذ"" في روابط النوع 124؛ تم تطبيق قفل المجموعة فقط.';
END
");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[FieldAccessLocks]', N'U') IS NULL
    RETURN;

DECLARE @CategoryId INT = 124;

DELETE FROM [dbo].[FieldAccessLocks]
WHERE [RequestTypeID] = @CategoryId
  AND [TargetLevel] = N'Group'
  AND [TargetId] = 26
  AND [LockMode] = N'FullLock'
  AND COALESCE([AllowedOverrideSubjectType], N'') = N'OrgUnit'
  AND COALESCE([AllowedOverrideSubjectId], N'') = N'125';

DELETE FROM [dbo].[FieldAccessLocks]
WHERE [RequestTypeID] = @CategoryId
  AND [TargetLevel] = N'Field'
  AND [LockMode] = N'NoEdit'
  AND COALESCE([AllowedOverrideSubjectType], N'') = N'OrgUnit'
  AND COALESCE([AllowedOverrideSubjectId], N'') = N'125'
  AND COALESCE([Notes], N'') LIKE N'حقل ""الإجراء المتخذ""%';
");
        }
    }
}
