using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LoanService.Migrations
{
    /// <inheritdoc />
    public partial class Phase1_AddEligibilityAndKycModels : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "EligibilityCheckId",
                schema: "public",
                table: "LoanApplications",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "LastRecoveryDate",
                schema: "public",
                table: "LoanApplications",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "PreApprovalAmount",
                schema: "public",
                table: "LoanApplications",
                type: "numeric(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "PreApprovalRate",
                schema: "public",
                table: "LoanApplications",
                type: "numeric(6,4)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PreApprovalRiskGrade",
                schema: "public",
                table: "LoanApplications",
                type: "character varying(5)",
                maxLength: 5,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "PreApprovalValidUntil",
                schema: "public",
                table: "LoanApplications",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "RecoveredAmount",
                schema: "public",
                table: "LoanApplications",
                type: "numeric(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RecoveryJournalNumber",
                schema: "public",
                table: "LoanApplications",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RecoveryNotes",
                schema: "public",
                table: "LoanApplications",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "LoanApplicationKycVerifications",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ApplicationId = table.Column<Guid>(type: "uuid", nullable: false),
                    CustomerId = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    CustomerType = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    VerificationStatus = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    VerificationMethod = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    VerifiedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    VerifiedBy = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RejectionReason = table.Column<string>(type: "text", nullable: true),
                    DocumentChecklistJson = table.Column<string>(type: "text", nullable: true),
                    DocumentsUploadedCount = table.Column<int>(type: "integer", nullable: false),
                    DocumentsRequiredCount = table.Column<int>(type: "integer", nullable: false),
                    VideoKycMetadataJson = table.Column<string>(type: "text", nullable: true),
                    PepCheckStatus = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    PepCheckDetails = table.Column<string>(type: "text", nullable: true),
                    PepCheckedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedBy = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LoanApplicationKycVerifications", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "LoanEligibilityChecks",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ApplicationId = table.Column<Guid>(type: "uuid", nullable: true),
                    ApplicantName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    PanNumber = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    DateOfBirth = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ProductType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    EmploymentType = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    GrossMonthlyIncome = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    ExistingMonthlyEMI = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    MonthlyObligations = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    OtherMonthlyIncome = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    CibilScore = table.Column<int>(type: "integer", nullable: true),
                    CibilBand = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    EligibilityScore = table.Column<int>(type: "integer", nullable: false),
                    RiskGrade = table.Column<string>(type: "character varying(5)", maxLength: 5, nullable: false),
                    MaxEligibleAmount = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    RecommendedRate = table.Column<decimal>(type: "numeric(6,4)", nullable: true),
                    FOIRPercent = table.Column<decimal>(type: "numeric(6,4)", nullable: true),
                    FOIRLimit = table.Column<decimal>(type: "numeric(6,4)", nullable: false),
                    FOIRBreach = table.Column<bool>(type: "boolean", nullable: false),
                    LTVPercent = table.Column<decimal>(type: "numeric(6,4)", nullable: true),
                    LTVLimit = table.Column<decimal>(type: "numeric(6,4)", nullable: false),
                    LTVBreach = table.Column<bool>(type: "boolean", nullable: false),
                    CollateralType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    CollateralValue = table.Column<decimal>(type: "numeric(18,2)", nullable: true),
                    RejectionReasonsJson = table.Column<string>(type: "text", nullable: true),
                    Status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    ConditionsJson = table.Column<string>(type: "text", nullable: true),
                    CheckedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CheckedBy = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CheckNotes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    MetadataJson = table.Column<string>(type: "text", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LoanEligibilityChecks", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_LoanApplicationKycVerifications_ApplicationId_CustomerId",
                schema: "public",
                table: "LoanApplicationKycVerifications",
                columns: new[] { "ApplicationId", "CustomerId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_LoanApplicationKycVerifications_ExpiresAt",
                schema: "public",
                table: "LoanApplicationKycVerifications",
                column: "ExpiresAt");

            migrationBuilder.CreateIndex(
                name: "IX_LoanApplicationKycVerifications_PepCheckStatus",
                schema: "public",
                table: "LoanApplicationKycVerifications",
                column: "PepCheckStatus");

            migrationBuilder.CreateIndex(
                name: "IX_LoanApplicationKycVerifications_VerificationStatus",
                schema: "public",
                table: "LoanApplicationKycVerifications",
                column: "VerificationStatus");

            migrationBuilder.CreateIndex(
                name: "IX_LoanEligibilityChecks_ApplicationId",
                schema: "public",
                table: "LoanEligibilityChecks",
                column: "ApplicationId");

            migrationBuilder.CreateIndex(
                name: "IX_LoanEligibilityChecks_ExpiresAt",
                schema: "public",
                table: "LoanEligibilityChecks",
                column: "ExpiresAt");

            migrationBuilder.CreateIndex(
                name: "IX_LoanEligibilityChecks_PanNumber_CheckedAt",
                schema: "public",
                table: "LoanEligibilityChecks",
                columns: new[] { "PanNumber", "CheckedAt" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_LoanEligibilityChecks_Status",
                schema: "public",
                table: "LoanEligibilityChecks",
                column: "Status");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "LoanApplicationKycVerifications",
                schema: "public");

            migrationBuilder.DropTable(
                name: "LoanEligibilityChecks",
                schema: "public");

            migrationBuilder.DropColumn(
                name: "EligibilityCheckId",
                schema: "public",
                table: "LoanApplications");

            migrationBuilder.DropColumn(
                name: "LastRecoveryDate",
                schema: "public",
                table: "LoanApplications");

            migrationBuilder.DropColumn(
                name: "PreApprovalAmount",
                schema: "public",
                table: "LoanApplications");

            migrationBuilder.DropColumn(
                name: "PreApprovalRate",
                schema: "public",
                table: "LoanApplications");

            migrationBuilder.DropColumn(
                name: "PreApprovalRiskGrade",
                schema: "public",
                table: "LoanApplications");

            migrationBuilder.DropColumn(
                name: "PreApprovalValidUntil",
                schema: "public",
                table: "LoanApplications");

            migrationBuilder.DropColumn(
                name: "RecoveredAmount",
                schema: "public",
                table: "LoanApplications");

            migrationBuilder.DropColumn(
                name: "RecoveryJournalNumber",
                schema: "public",
                table: "LoanApplications");

            migrationBuilder.DropColumn(
                name: "RecoveryNotes",
                schema: "public",
                table: "LoanApplications");
        }
    }
}
