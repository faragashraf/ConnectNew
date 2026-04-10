using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Persistence.Migrations
{
    /// <inheritdoc />
    public partial class _20260410_AddAdminCatalogCategoryFieldBindings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AdminCatalogCategoryFieldBindings",
                columns: table => new
                {
                    MendSQL = table.Column<int>(type: "int", nullable: false),
                    CategoryID = table.Column<int>(type: "int", nullable: false),
                    MendField = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    MendStat = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    GroupID = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AdminCatalogCategoryFieldBindings", x => x.MendSQL);
                    table.ForeignKey(
                        name: "FK_AdminCatalogCategoryFieldBindings_AdminCatalogCategoryGroups",
                        column: x => x.GroupID,
                        principalTable: "AdminCatalogCategoryGroups",
                        principalColumn: "GroupId");
                    table.ForeignKey(
                        name: "FK_AdminCatalogCategoryFieldBindings_CDCategory",
                        column: x => x.CategoryID,
                        principalTable: "CDCategory",
                        principalColumn: "CatId");
                });

            migrationBuilder.CreateIndex(
                name: "IX_AdminCatalogCategoryFieldBindings_CategoryField",
                table: "AdminCatalogCategoryFieldBindings",
                columns: new[] { "CategoryID", "MendField" });

            migrationBuilder.CreateIndex(
                name: "IX_AdminCatalogCategoryFieldBindings_CategoryID",
                table: "AdminCatalogCategoryFieldBindings",
                column: "CategoryID");

            migrationBuilder.CreateIndex(
                name: "IX_AdminCatalogCategoryFieldBindings_CategoryStatusGroup",
                table: "AdminCatalogCategoryFieldBindings",
                columns: new[] { "CategoryID", "MendStat", "GroupID" });

            migrationBuilder.CreateIndex(
                name: "IX_AdminCatalogCategoryFieldBindings_GroupID",
                table: "AdminCatalogCategoryFieldBindings",
                column: "GroupID");

            migrationBuilder.Sql(
                @"
IF OBJECT_ID(N'[dbo].[AdminCatalogCategoryFieldBindingMigrationIssues]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[AdminCatalogCategoryFieldBindingMigrationIssues](
        [IssueId] [int] IDENTITY(1,1) NOT NULL,
        [MigrationVersion] [nvarchar](64) NOT NULL,
        [CategoryId] [int] NOT NULL,
        [MendSQL] [int] NULL,
        [LegacyGroupId] [int] NULL,
        [LegacyGroupName] [nvarchar](200) NULL,
        [IssueType] [nvarchar](40) NOT NULL,
        [Details] [nvarchar](1000) NULL,
        [ResolvedGroupId] [int] NULL,
        [LoggedAtUtc] [datetime2](7) NOT NULL CONSTRAINT [DF_AdminCatalogCategoryFieldBindingMigrationIssues_LoggedAtUtc] DEFAULT (GETUTCDATE()),
        CONSTRAINT [PK_AdminCatalogCategoryFieldBindingMigrationIssues] PRIMARY KEY CLUSTERED ([IssueId] ASC)
    );
END;
");

            migrationBuilder.Sql(
                @"
IF EXISTS (SELECT 1 FROM [CdCategoryMand])
BEGIN
    DECLARE @MigrationVersion NVARCHAR(64) = N'20260410_AddAdminCatalogCategoryFieldBindings';

    IF OBJECT_ID(N'tempdb..#GroupMapping', N'U') IS NOT NULL DROP TABLE #GroupMapping;
    IF OBJECT_ID(N'tempdb..#NameCandidateStats', N'U') IS NOT NULL DROP TABLE #NameCandidateStats;
    IF OBJECT_ID(N'tempdb..#CreatedGroupMap', N'U') IS NOT NULL DROP TABLE #CreatedGroupMap;

    SELECT DISTINCT
        link.[MendCategory] AS [CategoryID],
        link.[MendGroup] AS [LegacyGroupID],
        mg.[GroupName] AS [LegacyGroupName],
        NULLIF(UPPER(LTRIM(RTRIM(mg.[GroupName]))), N'') AS [LegacyGroupNameNormalized],
        CAST(NULL AS INT) AS [CanonicalGroupID],
        CAST(NULL AS NVARCHAR(40)) AS [MatchType],
        CAST(NULL AS INT) AS [CandidateCount],
        CAST(NULL AS NVARCHAR(1000)) AS [Details]
    INTO #GroupMapping
    FROM [CdCategoryMand] link
    LEFT JOIN [MandGroups] mg ON mg.[GroupID] = link.[MendGroup]
    WHERE link.[MendCategory] > 0;

    UPDATE gm
    SET gm.[CanonicalGroupID] = ag.[GroupId],
        gm.[MatchType] = N'DirectId'
    FROM #GroupMapping gm
    INNER JOIN [AdminCatalogCategoryGroups] ag
        ON ag.[CategoryId] = gm.[CategoryID]
        AND ag.[GroupId] = gm.[LegacyGroupID]
        AND ag.[IsActive] = 1
    WHERE gm.[CanonicalGroupID] IS NULL;

    SELECT
        gm.[CategoryID],
        gm.[LegacyGroupID],
        COUNT(*) AS [CandidateCount],
        STRING_AGG(CONVERT(NVARCHAR(20), ag.[GroupId]), N',') WITHIN GROUP (ORDER BY ag.[GroupId]) AS [CandidateIds]
    INTO #NameCandidateStats
    FROM #GroupMapping gm
    INNER JOIN [AdminCatalogCategoryGroups] ag
        ON ag.[CategoryId] = gm.[CategoryID]
        AND ag.[IsActive] = 1
        AND NULLIF(UPPER(LTRIM(RTRIM(ag.[GroupName]))), N'') = gm.[LegacyGroupNameNormalized]
    WHERE gm.[CanonicalGroupID] IS NULL
      AND gm.[LegacyGroupNameNormalized] IS NOT NULL
    GROUP BY gm.[CategoryID], gm.[LegacyGroupID];

    UPDATE gm
    SET gm.[CanonicalGroupID] = ag.[GroupId],
        gm.[MatchType] = N'UniqueName'
    FROM #GroupMapping gm
    INNER JOIN #NameCandidateStats stats
        ON stats.[CategoryID] = gm.[CategoryID]
        AND stats.[LegacyGroupID] = gm.[LegacyGroupID]
        AND stats.[CandidateCount] = 1
    INNER JOIN [AdminCatalogCategoryGroups] ag
        ON ag.[CategoryId] = gm.[CategoryID]
        AND ag.[IsActive] = 1
        AND NULLIF(UPPER(LTRIM(RTRIM(ag.[GroupName]))), N'') = gm.[LegacyGroupNameNormalized]
    WHERE gm.[CanonicalGroupID] IS NULL;

    UPDATE gm
    SET gm.[MatchType] = N'AmbiguousName',
        gm.[CandidateCount] = stats.[CandidateCount],
        gm.[Details] = CONCAT(N'Name matched multiple active AdminCatalog groups. Candidates=', stats.[CandidateIds])
    FROM #GroupMapping gm
    INNER JOIN #NameCandidateStats stats
        ON stats.[CategoryID] = gm.[CategoryID]
        AND stats.[LegacyGroupID] = gm.[LegacyGroupID]
    WHERE gm.[CanonicalGroupID] IS NULL
      AND stats.[CandidateCount] > 1;

    UPDATE gm
    SET gm.[MatchType] = N'Missing',
        gm.[Details] = COALESCE(
            gm.[Details],
            CASE
                WHEN gm.[LegacyGroupNameNormalized] IS NULL THEN N'Legacy group name is empty or null; no direct id match.'
                ELSE N'No direct id match and no unique name match.'
            END)
    FROM #GroupMapping gm
    WHERE gm.[CanonicalGroupID] IS NULL
      AND gm.[MatchType] IS NULL;

    CREATE TABLE #CreatedGroupMap(
        [GroupID] [int] NOT NULL,
        [CategoryID] [int] NOT NULL,
        [LegacyGroupID] [int] NOT NULL
    );

    IF EXISTS (SELECT 1 FROM #GroupMapping WHERE [CanonicalGroupID] IS NULL)
    BEGIN
        DECLARE @NextGroupId INT = ISNULL((SELECT MAX([GroupId]) FROM [AdminCatalogCategoryGroups]), 0);

        ;WITH Unresolved AS (
            SELECT
                gm.[CategoryID],
                gm.[LegacyGroupID],
                gm.[LegacyGroupName],
                gm.[MatchType],
                gm.[CandidateCount],
                gm.[Details],
                cat.[ApplicationID],
                COALESCE(
                    NULLIF(LTRIM(RTRIM(gm.[LegacyGroupName])), N''),
                    CONCAT(N'Legacy Group ', CONVERT(NVARCHAR(20), gm.[LegacyGroupID]))
                ) AS [BaseName]
            FROM #GroupMapping gm
            INNER JOIN [CDCategory] cat ON cat.[CatId] = gm.[CategoryID]
            WHERE gm.[CanonicalGroupID] IS NULL
        ),
        Numbered AS (
            SELECT
                u.*,
                ROW_NUMBER() OVER (ORDER BY u.[CategoryID], u.[LegacyGroupID]) AS [GlobalSeq],
                ROW_NUMBER() OVER (PARTITION BY u.[CategoryID] ORDER BY u.[LegacyGroupID]) AS [CategorySeq]
            FROM Unresolved u
        )
        INSERT INTO [AdminCatalogCategoryGroups](
            [GroupId],
            [CategoryId],
            [ApplicationID],
            [GroupName],
            [GroupDescription],
            [ParentGroupId],
            [DisplayOrder],
            [IsActive],
            [StampDate],
            [CreatedBy])
        OUTPUT inserted.[GroupId], inserted.[CategoryId], src.[LegacyGroupID]
            INTO #CreatedGroupMap([GroupID], [CategoryID], [LegacyGroupID])
        SELECT
            @NextGroupId + src.[GlobalSeq],
            src.[CategoryID],
            COALESCE(NULLIF(LTRIM(RTRIM(src.[ApplicationID])), N''), N'LEGACY'),
            LEFT(CONCAT(src.[BaseName], N' [Legacy#', CONVERT(NVARCHAR(20), src.[LegacyGroupID]), N']'), 200),
            LEFT(
                CONCAT(
                    N'Auto-migrated during ',
                    @MigrationVersion,
                    N'. LegacyGroupID=',
                    CONVERT(NVARCHAR(20), src.[LegacyGroupID]),
                    N'; Reason=',
                    src.[MatchType],
                    CASE
                        WHEN src.[CandidateCount] IS NOT NULL AND src.[CandidateCount] > 1
                            THEN CONCAT(N'; CandidateCount=', CONVERT(NVARCHAR(10), src.[CandidateCount]))
                        ELSE N''
                    END,
                    CASE
                        WHEN src.[Details] IS NOT NULL
                            THEN CONCAT(N'; ', src.[Details])
                        ELSE N''
                    END
                ),
                255),
            NULL,
            ISNULL(existing.[MaxDisplayOrder], 0) + src.[CategorySeq],
            1,
            GETDATE(),
            NULL
        FROM Numbered src
        OUTER APPLY (
            SELECT MAX(g.[DisplayOrder]) AS [MaxDisplayOrder]
            FROM [AdminCatalogCategoryGroups] g
            WHERE g.[CategoryId] = src.[CategoryID]
        ) existing;
    END;

    UPDATE gm
    SET gm.[CanonicalGroupID] = created.[GroupID],
        gm.[MatchType] = CASE
            WHEN gm.[MatchType] = N'AmbiguousName' THEN N'CreatedFromAmbiguous'
            ELSE N'CreatedFromMissing'
        END
    FROM #GroupMapping gm
    INNER JOIN #CreatedGroupMap created
        ON created.[CategoryID] = gm.[CategoryID]
        AND created.[LegacyGroupID] = gm.[LegacyGroupID]
    WHERE gm.[CanonicalGroupID] IS NULL;

    INSERT INTO [dbo].[AdminCatalogCategoryFieldBindingMigrationIssues](
        [MigrationVersion],
        [CategoryId],
        [MendSQL],
        [LegacyGroupId],
        [LegacyGroupName],
        [IssueType],
        [Details],
        [ResolvedGroupId])
    SELECT
        @MigrationVersion,
        gm.[CategoryID],
        NULL,
        gm.[LegacyGroupID],
        LEFT(gm.[LegacyGroupName], 200),
        CASE
            WHEN gm.[MatchType] = N'CreatedFromAmbiguous' THEN N'AMBIGUOUS_NAME'
            WHEN gm.[MatchType] = N'CreatedFromMissing' THEN N'MISSING_GROUP'
            ELSE N'REVIEW'
        END,
        LEFT(gm.[Details], 1000),
        gm.[CanonicalGroupID]
    FROM #GroupMapping gm
    WHERE gm.[MatchType] IN (N'CreatedFromAmbiguous', N'CreatedFromMissing');

    INSERT INTO [AdminCatalogCategoryFieldBindings](
        [MendSQL],
        [CategoryID],
        [MendField],
        [MendStat],
        [GroupID])
    SELECT
        link.[MendSQL],
        link.[MendCategory],
        link.[MendField],
        link.[MendStat],
        gm.[CanonicalGroupID]
    FROM [CdCategoryMand] link
    INNER JOIN #GroupMapping gm
        ON gm.[CategoryID] = link.[MendCategory]
        AND gm.[LegacyGroupID] = link.[MendGroup]
    WHERE gm.[CanonicalGroupID] IS NOT NULL
      AND NOT EXISTS (
            SELECT 1
            FROM [AdminCatalogCategoryFieldBindings] existing
            WHERE existing.[MendSQL] = link.[MendSQL]);

    INSERT INTO [dbo].[AdminCatalogCategoryFieldBindingMigrationIssues](
        [MigrationVersion],
        [CategoryId],
        [MendSQL],
        [LegacyGroupId],
        [LegacyGroupName],
        [IssueType],
        [Details],
        [ResolvedGroupId])
    SELECT
        @MigrationVersion,
        link.[MendCategory],
        link.[MendSQL],
        link.[MendGroup],
        LEFT(mg.[GroupName], 200),
        N'UNRESOLVED_LINK',
        LEFT(N'Binding row could not be mapped to a canonical group and was skipped during backfill.', 1000),
        NULL
    FROM [CdCategoryMand] link
    LEFT JOIN #GroupMapping gm
        ON gm.[CategoryID] = link.[MendCategory]
        AND gm.[LegacyGroupID] = link.[MendGroup]
    LEFT JOIN [MandGroups] mg ON mg.[GroupID] = link.[MendGroup]
    WHERE gm.[CanonicalGroupID] IS NULL;
END;
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AdminCatalogCategoryFieldBindings");

            migrationBuilder.Sql(
                @"
IF OBJECT_ID(N'[dbo].[AdminCatalogCategoryFieldBindingMigrationIssues]', N'U') IS NOT NULL
BEGIN
    DROP TABLE [dbo].[AdminCatalogCategoryFieldBindingMigrationIssues];
END;
");
        }
    }
}
