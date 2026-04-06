using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LoanService.Migrations
{
    /// <inheritdoc />
    public partial class EnhancedLoanOrigination : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Amount",
                table: "LoanApplications");




            migrationBuilder.AlterColumn<string>(
                name: "Status",
                table: "LoanApplications",
                type: "character varying(30)",
                maxLength: 30,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AlterColumn<string>(
                name: "ProductType",
                table: "LoanApplications",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AlterColumn<decimal>(
                name: "InterestRate",
                table: "LoanApplications",
                type: "numeric(6,4)",
                nullable: true,
                oldClrType: typeof(decimal),
                oldType: "numeric",
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "CustomerId",
                table: "LoanApplications",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AddColumn<string>(
                name: "AadhaarLast4",
                table: "LoanApplications",
                type: "character varying(4)",
                maxLength: 4,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ApplicantName",
                table: "LoanApplications",
                type: "character varying(150)",
                maxLength: 150,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ApplicationNumber",
                table: "LoanApplications",
                type: "character varying(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "AssignedTo",
                table: "LoanApplications",
                type: "character varying(150)",
                maxLength: 150,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CibilBand",
                table: "LoanApplications",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "CibilScore",
                table: "LoanApplications",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CoApplicantJson",
                table: "LoanApplications",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CollateralDescription",
                table: "LoanApplications",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CollateralType",
                table: "LoanApplications",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "CollateralValue",
                table: "LoanApplications",
                type: "numeric(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CreatedBy",
                table: "LoanApplications",
                type: "character varying(150)",
                maxLength: 150,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CreditOfficer",
                table: "LoanApplications",
                type: "character varying(150)",
                maxLength: 150,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CurrentAddressLine1",
                table: "LoanApplications",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CurrentAddressLine2",
                table: "LoanApplications",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CurrentCity",
                table: "LoanApplications",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CurrentPinCode",
                table: "LoanApplications",
                type: "character varying(10)",
                maxLength: 10,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CurrentState",
                table: "LoanApplications",
                type: "character varying(60)",
                maxLength: 60,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "DateOfBirth",
                table: "LoanApplications",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Designation",
                table: "LoanApplications",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "DisbursedAt",
                table: "LoanApplications",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DisbursementAccountNumber",
                table: "LoanApplications",
                type: "character varying(30)",
                maxLength: 30,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DisbursementIFSC",
                table: "LoanApplications",
                type: "character varying(11)",
                maxLength: 11,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Email",
                table: "LoanApplications",
                type: "character varying(150)",
                maxLength: 150,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "EmployerName",
                table: "LoanApplications",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "EmploymentType",
                table: "LoanApplications",
                type: "character varying(30)",
                maxLength: 30,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ExistingMonthlyEMI",
                table: "LoanApplications",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "FOIRPercent",
                table: "LoanApplications",
                type: "numeric(6,4)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Gender",
                table: "LoanApplications",
                type: "character varying(1)",
                maxLength: 1,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "GrossMonthlyIncome",
                table: "LoanApplications",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<bool>(
                name: "HasCoApplicant",
                table: "LoanApplications",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<decimal>(
                name: "LTVPercent",
                table: "LoanApplications",
                type: "numeric(6,4)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "MaritalStatus",
                table: "LoanApplications",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "MobileNumber",
                table: "LoanApplications",
                type: "character varying(15)",
                maxLength: 15,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "MonthlyObligations",
                table: "LoanApplications",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "NetMonthlyIncome",
                table: "LoanApplications",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "OfficePhone",
                table: "LoanApplications",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "OtherMonthlyIncome",
                table: "LoanApplications",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "PanNumber",
                table: "LoanApplications",
                type: "character varying(10)",
                maxLength: 10,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PermanentAddressLine1",
                table: "LoanApplications",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PermanentAddressLine2",
                table: "LoanApplications",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PermanentCity",
                table: "LoanApplications",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PermanentPinCode",
                table: "LoanApplications",
                type: "character varying(10)",
                maxLength: 10,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PermanentState",
                table: "LoanApplications",
                type: "character varying(60)",
                maxLength: 60,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PurposeOfLoan",
                table: "LoanApplications",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RejectionReason",
                table: "LoanApplications",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "RequestedAmount",
                table: "LoanApplications",
                type: "numeric(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "ResidenceType",
                table: "LoanApplications",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RiskGrade",
                table: "LoanApplications",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "SameAsCurrent",
                table: "LoanApplications",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "SanctionRemarks",
                table: "LoanApplications",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "SanctionedAmount",
                table: "LoanApplications",
                type: "numeric(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "TotalWorkExperienceYears",
                table: "LoanApplications",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "YearsAtCurrentJob",
                table: "LoanApplications",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "LoanApprovalActions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    LoanApplicationId = table.Column<Guid>(type: "uuid", nullable: false),
                    Action = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    ActionDescription = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    ActionBy = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    Role = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    Comments = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    FromStatus = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    ToStatus = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    MetadataJson = table.Column<string>(type: "text", nullable: true),
                    ActionAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LoanApprovalActions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LoanApprovalActions_LoanApplications_LoanApplicationId",
                        column: x => x.LoanApplicationId,
                        principalSchema: "public",
                        principalTable: "LoanApplications",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "LoanDocuments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    LoanApplicationId = table.Column<Guid>(type: "uuid", nullable: false),
                    DocumentType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    DocumentLabel = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    IsMandatory = table.Column<bool>(type: "boolean", nullable: false),
                    IsUploaded = table.Column<bool>(type: "boolean", nullable: false),
                    FileName = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    ContentType = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    StoragePath = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    FileSizeBytes = table.Column<long>(type: "bigint", nullable: true),
                    UploadedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    UploadedBy = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    IsVerified = table.Column<bool>(type: "boolean", nullable: false),
                    VerifiedBy = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    VerifiedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    VerificationRemarks = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LoanDocuments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LoanDocuments_LoanApplications_LoanApplicationId",
                        column: x => x.LoanApplicationId,
                        principalSchema: "public",
                        principalTable: "LoanApplications",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "LoanProducts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ProductCode = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Category = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    MinAmount = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    MaxAmount = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    MinTenureMonths = table.Column<int>(type: "integer", nullable: false),
                    MaxTenureMonths = table.Column<int>(type: "integer", nullable: false),
                    BaseRatePercent = table.Column<decimal>(type: "numeric(6,4)", nullable: false),
                    MaxRatePercent = table.Column<decimal>(type: "numeric(6,4)", nullable: false),
                    ProcessingFeePercent = table.Column<decimal>(type: "numeric(6,4)", nullable: false),
                    MinCibilScore = table.Column<int>(type: "integer", nullable: false),
                    MinAgeYears = table.Column<int>(type: "integer", nullable: false),
                    MaxAgeYears = table.Column<int>(type: "integer", nullable: false),
                    MinMonthlyIncome = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    MaxFoirPercent = table.Column<decimal>(type: "numeric(6,4)", nullable: false),
                    MaxLtvPercent = table.Column<decimal>(type: "numeric(6,4)", nullable: false),
                    RequiresCollateral = table.Column<bool>(type: "boolean", nullable: false),
                    AllowsCoApplicant = table.Column<bool>(type: "boolean", nullable: false),
                    RequiresGuarantor = table.Column<bool>(type: "boolean", nullable: false),
                    DocumentChecklistJson = table.Column<string>(type: "text", nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LoanProducts", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_LoanApplications_ApplicationNumber",
                table: "LoanApplications",
                column: "ApplicationNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_LoanApplications_CreatedAt",
                table: "LoanApplications",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_LoanApplications_ProductType",
                table: "LoanApplications",
                column: "ProductType");

            migrationBuilder.CreateIndex(
                name: "IX_LoanApplications_Status",
                table: "LoanApplications",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_LoanApprovalActions_LoanApplicationId",
                table: "LoanApprovalActions",
                column: "LoanApplicationId");

            migrationBuilder.CreateIndex(
                name: "IX_LoanDocuments_LoanApplicationId",
                table: "LoanDocuments",
                column: "LoanApplicationId");

            migrationBuilder.CreateIndex(
                name: "IX_LoanProducts_ProductCode",
                table: "LoanProducts",
                column: "ProductCode",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "LoanApprovalActions",
                schema: "public");

            migrationBuilder.DropTable(
                name: "LoanDocuments",
                schema: "public");

            migrationBuilder.DropTable(
                name: "LoanProducts",
                schema: "public");

            migrationBuilder.DropIndex(
                name: "IX_LoanApplications_ApplicationNumber",
                table: "LoanApplications");

            migrationBuilder.DropIndex(
                name: "IX_LoanApplications_CreatedAt",
                table: "LoanApplications");

            migrationBuilder.DropIndex(
                name: "IX_LoanApplications_ProductType",
                table: "LoanApplications");

            migrationBuilder.DropIndex(
                name: "IX_LoanApplications_Status",
                table: "LoanApplications");

            migrationBuilder.DropColumn(
                name: "AadhaarLast4",
                table: "LoanApplications");

            migrationBuilder.DropColumn(
                name: "ApplicantName",
                table: "LoanApplications");

            migrationBuilder.DropColumn(
                name: "ApplicationNumber",
                table: "LoanApplications");

            migrationBuilder.DropColumn(
                name: "AssignedTo",
                table: "LoanApplications");

            migrationBuilder.DropColumn(
                name: "CibilBand",
                table: "LoanApplications");

            migrationBuilder.DropColumn(
                name: "CibilScore",
                table: "LoanApplications");

            migrationBuilder.DropColumn(
                name: "CoApplicantJson",
                table: "LoanApplications");

            migrationBuilder.DropColumn(
                name: "CollateralDescription",
                table: "LoanApplications");

            migrationBuilder.DropColumn(
                name: "CollateralType",
                table: "LoanApplications");

            migrationBuilder.DropColumn(
                name: "CollateralValue",
                table: "LoanApplications");

            migrationBuilder.DropColumn(
                name: "CreatedBy",
                table: "LoanApplications");

            migrationBuilder.DropColumn(
                name: "CreditOfficer",
                table: "LoanApplications");

            migrationBuilder.DropColumn(
                name: "CurrentAddressLine1",
                table: "LoanApplications");

            migrationBuilder.DropColumn(
                name: "CurrentAddressLine2",
                table: "LoanApplications");

            migrationBuilder.DropColumn(
                name: "CurrentCity",
                table: "LoanApplications");

            migrationBuilder.DropColumn(
                name: "CurrentPinCode",
                table: "LoanApplications");

            migrationBuilder.DropColumn(
                name: "CurrentState",
                table: "LoanApplications");

            migrationBuilder.DropColumn(
                name: "DateOfBirth",
                table: "LoanApplications");

            migrationBuilder.DropColumn(
                name: "Designation",
                table: "LoanApplications");

            migrationBuilder.DropColumn(
                name: "DisbursedAt",
                table: "LoanApplications");

            migrationBuilder.DropColumn(
                name: "DisbursementAccountNumber",
                table: "LoanApplications");

            migrationBuilder.DropColumn(
                name: "DisbursementIFSC",
                table: "LoanApplications");

            migrationBuilder.DropColumn(
                name: "Email",
                table: "LoanApplications");

            migrationBuilder.DropColumn(
                name: "EmployerName",
                table: "LoanApplications");

            migrationBuilder.DropColumn(
                name: "EmploymentType",
                table: "LoanApplications");

            migrationBuilder.DropColumn(
                name: "ExistingMonthlyEMI",
                table: "LoanApplications");

            migrationBuilder.DropColumn(
                name: "FOIRPercent",
                table: "LoanApplications");

            migrationBuilder.DropColumn(
                name: "Gender",
                table: "LoanApplications");

            migrationBuilder.DropColumn(
                name: "GrossMonthlyIncome",
                table: "LoanApplications");

            migrationBuilder.DropColumn(
                name: "HasCoApplicant",
                table: "LoanApplications");

            migrationBuilder.DropColumn(
                name: "LTVPercent",
                table: "LoanApplications");

            migrationBuilder.DropColumn(
                name: "MaritalStatus",
                table: "LoanApplications");

            migrationBuilder.DropColumn(
                name: "MobileNumber",
                table: "LoanApplications");

            migrationBuilder.DropColumn(
                name: "MonthlyObligations",
                table: "LoanApplications");

            migrationBuilder.DropColumn(
                name: "NetMonthlyIncome",
                table: "LoanApplications");

            migrationBuilder.DropColumn(
                name: "OfficePhone",
                table: "LoanApplications");

            migrationBuilder.DropColumn(
                name: "OtherMonthlyIncome",
                table: "LoanApplications");

            migrationBuilder.DropColumn(
                name: "PanNumber",
                table: "LoanApplications");

            migrationBuilder.DropColumn(
                name: "PermanentAddressLine1",
                table: "LoanApplications");

            migrationBuilder.DropColumn(
                name: "PermanentAddressLine2",
                table: "LoanApplications");

            migrationBuilder.DropColumn(
                name: "PermanentCity",
                table: "LoanApplications");

            migrationBuilder.DropColumn(
                name: "PermanentPinCode",
                table: "LoanApplications");

            migrationBuilder.DropColumn(
                name: "PermanentState",
                table: "LoanApplications");

            migrationBuilder.DropColumn(
                name: "PurposeOfLoan",
                table: "LoanApplications");

            migrationBuilder.DropColumn(
                name: "RejectionReason",
                table: "LoanApplications");

            migrationBuilder.DropColumn(
                name: "RequestedAmount",
                table: "LoanApplications");

            migrationBuilder.DropColumn(
                name: "ResidenceType",
                table: "LoanApplications");

            migrationBuilder.DropColumn(
                name: "RiskGrade",
                table: "LoanApplications");

            migrationBuilder.DropColumn(
                name: "SameAsCurrent",
                table: "LoanApplications");

            migrationBuilder.DropColumn(
                name: "SanctionRemarks",
                table: "LoanApplications");

            migrationBuilder.DropColumn(
                name: "SanctionedAmount",
                table: "LoanApplications");

            migrationBuilder.DropColumn(
                name: "TotalWorkExperienceYears",
                table: "LoanApplications");

            migrationBuilder.DropColumn(
                name: "YearsAtCurrentJob",
                table: "LoanApplications");



            migrationBuilder.AlterColumn<string>(
                name: "Status",
                table: "LoanApplications",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(30)",
                oldMaxLength: 30);

            migrationBuilder.AlterColumn<string>(
                name: "ProductType",
                table: "LoanApplications",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(50)",
                oldMaxLength: 50);

            migrationBuilder.AlterColumn<decimal>(
                name: "InterestRate",
                table: "LoanApplications",
                type: "numeric",
                nullable: true,
                oldClrType: typeof(decimal),
                oldType: "numeric(6,4)",
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "CustomerId",
                table: "LoanApplications",
                type: "text",
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "character varying(100)",
                oldMaxLength: 100,
                oldNullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "Amount",
                table: "LoanApplications",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);
        }
    }
}
