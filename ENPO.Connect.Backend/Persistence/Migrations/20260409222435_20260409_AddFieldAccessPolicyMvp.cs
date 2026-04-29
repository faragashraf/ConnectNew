using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Persistence.Migrations
{
    /// <inheritdoc />
    public partial class _20260409_AddFieldAccessPolicyMvp : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "FieldAccessLocks",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    RequestTypeID = table.Column<int>(type: "int", nullable: false),
                    StageID = table.Column<int>(type: "int", nullable: true),
                    ActionID = table.Column<int>(type: "int", nullable: true),
                    TargetLevel = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    TargetId = table.Column<int>(type: "int", nullable: false),
                    LockMode = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false, defaultValue: "NoEdit"),
                    AllowedOverrideSubjectType = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    AllowedOverrideSubjectId = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false, defaultValue: true),
                    Notes = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CreatedBy = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false, defaultValue: "SYSTEM"),
                    CreatedDate = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    LastModifiedBy = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    LastModifiedDate = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FieldAccessLocks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FieldAccessLocks_CDCategory",
                        column: x => x.RequestTypeID,
                        principalTable: "CDCategory",
                        principalColumn: "CatId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "FieldAccessPolicies",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    RequestTypeID = table.Column<int>(type: "int", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false, defaultValue: true),
                    DefaultAccessMode = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false, defaultValue: "Editable"),
                    CreatedBy = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false, defaultValue: "SYSTEM"),
                    CreatedDate = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    LastModifiedBy = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    LastModifiedDate = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FieldAccessPolicies", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FieldAccessPolicies_CDCategory",
                        column: x => x.RequestTypeID,
                        principalTable: "CDCategory",
                        principalColumn: "CatId",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "FieldAccessPolicyRules",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    PolicyID = table.Column<int>(type: "int", nullable: false),
                    TargetLevel = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    TargetId = table.Column<int>(type: "int", nullable: false),
                    StageID = table.Column<int>(type: "int", nullable: true),
                    ActionID = table.Column<int>(type: "int", nullable: true),
                    PermissionType = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    SubjectType = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    SubjectId = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    Effect = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false, defaultValue: "Allow"),
                    Priority = table.Column<int>(type: "int", nullable: false, defaultValue: 100),
                    IsActive = table.Column<bool>(type: "bit", nullable: false, defaultValue: true),
                    Notes = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CreatedBy = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false, defaultValue: "SYSTEM"),
                    CreatedDate = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    LastModifiedBy = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    LastModifiedDate = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FieldAccessPolicyRules", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FieldAccessPolicyRules_FieldAccessPolicies",
                        column: x => x.PolicyID,
                        principalTable: "FieldAccessPolicies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "FieldAccessOverrides",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    RequestID = table.Column<int>(type: "int", nullable: true),
                    RequestTypeID = table.Column<int>(type: "int", nullable: true),
                    RuleID = table.Column<int>(type: "int", nullable: true),
                    TargetLevel = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    TargetId = table.Column<int>(type: "int", nullable: true),
                    SubjectType = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    SubjectId = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: true),
                    OverridePermissionType = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Reason = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    GrantedBy = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false, defaultValue: "SYSTEM"),
                    GrantedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    ExpiresAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false, defaultValue: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FieldAccessOverrides", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FieldAccessOverrides_CDCategory",
                        column: x => x.RequestTypeID,
                        principalTable: "CDCategory",
                        principalColumn: "CatId",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_FieldAccessOverrides_FieldAccessPolicyRules",
                        column: x => x.RuleID,
                        principalTable: "FieldAccessPolicyRules",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_FieldAccessLocks_StageAction",
                table: "FieldAccessLocks",
                columns: new[] { "RequestTypeID", "StageID", "ActionID", "IsActive" });

            migrationBuilder.CreateIndex(
                name: "IX_FieldAccessLocks_TargetScope",
                table: "FieldAccessLocks",
                columns: new[] { "RequestTypeID", "TargetLevel", "TargetId", "IsActive" });

            migrationBuilder.CreateIndex(
                name: "IX_FieldAccessOverrides_Request_IsActive",
                table: "FieldAccessOverrides",
                columns: new[] { "RequestID", "IsActive" });

            migrationBuilder.CreateIndex(
                name: "IX_FieldAccessOverrides_RequestType_IsActive",
                table: "FieldAccessOverrides",
                columns: new[] { "RequestTypeID", "IsActive" });

            migrationBuilder.CreateIndex(
                name: "IX_FieldAccessOverrides_RuleID",
                table: "FieldAccessOverrides",
                column: "RuleID");

            migrationBuilder.CreateIndex(
                name: "IX_FieldAccessOverrides_Target_IsActive",
                table: "FieldAccessOverrides",
                columns: new[] { "TargetLevel", "TargetId", "IsActive" });

            migrationBuilder.CreateIndex(
                name: "IX_FieldAccessPolicies_RequestType_IsActive",
                table: "FieldAccessPolicies",
                columns: new[] { "RequestTypeID", "IsActive" });

            migrationBuilder.CreateIndex(
                name: "UX_FieldAccessPolicies_RequestType",
                table: "FieldAccessPolicies",
                column: "RequestTypeID",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_FieldAccessPolicyRules_PolicyID",
                table: "FieldAccessPolicyRules",
                column: "PolicyID");

            migrationBuilder.CreateIndex(
                name: "IX_FieldAccessPolicyRules_StageAction",
                table: "FieldAccessPolicyRules",
                columns: new[] { "PolicyID", "StageID", "ActionID", "IsActive" });

            migrationBuilder.CreateIndex(
                name: "IX_FieldAccessPolicyRules_Subject",
                table: "FieldAccessPolicyRules",
                columns: new[] { "PolicyID", "SubjectType", "SubjectId" });

            migrationBuilder.CreateIndex(
                name: "IX_FieldAccessPolicyRules_TargetScope",
                table: "FieldAccessPolicyRules",
                columns: new[] { "PolicyID", "TargetLevel", "TargetId", "IsActive" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "FieldAccessLocks");

            migrationBuilder.DropTable(
                name: "FieldAccessOverrides");

            migrationBuilder.DropTable(
                name: "FieldAccessPolicyRules");

            migrationBuilder.DropTable(
                name: "FieldAccessPolicies");
        }
    }
}
