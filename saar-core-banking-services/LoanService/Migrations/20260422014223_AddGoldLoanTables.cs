using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LoanService.Migrations
{
    /// <inheritdoc />
    public partial class AddGoldLoanTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "GoldLoanDetails",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    LoanApplicationId = table.Column<Guid>(type: "uuid", nullable: false),
                    GoldLoanStatus = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    RepaymentScheme = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    TenureMonths = table.Column<int>(type: "integer", nullable: false),
                    MaturityDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    SanctionedAmount = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    InterestRatePercent = table.Column<decimal>(type: "numeric(6,4)", nullable: false),
                    TotalInterestAmount = table.Column<decimal>(type: "numeric(18,2)", nullable: true),
                    TotalAmountDue = table.Column<decimal>(type: "numeric(18,2)", nullable: true),
                    TotalNetWeightGrams = table.Column<decimal>(type: "numeric(10,3)", nullable: false),
                    TotalValuedAmount = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    LtvPercent = table.Column<decimal>(type: "numeric(6,4)", nullable: false),
                    GoldRateAtAppraisal = table.Column<decimal>(type: "numeric(10,2)", nullable: false),
                    AppraiserName = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: true),
                    AppraiserEmployeeId = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    VaultLocation = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    PledgeReceiptNumber = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    AppraisedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    SanctionedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DisbursedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ClosedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    GoldReleasedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    ClosureJournalNumber = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GoldLoanDetails", x => x.Id);
                    table.ForeignKey(
                        name: "FK_GoldLoanDetails_LoanApplications_LoanApplicationId",
                        column: x => x.LoanApplicationId,
                        principalTable: "LoanApplications",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "GoldRateMasters",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    RateDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    RatePerGramFor22K = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    Source = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    EnteredBy = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GoldRateMasters", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "GoldPledgeItems",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    GoldLoanDetailsId = table.Column<Guid>(type: "uuid", nullable: false),
                    ItemType = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    Description = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    GrossWeightGrams = table.Column<decimal>(type: "numeric(10,3)", nullable: false),
                    StoneDeductionGrams = table.Column<decimal>(type: "numeric(10,3)", nullable: false),
                    NetWeightGrams = table.Column<decimal>(type: "numeric(10,3)", nullable: false),
                    PurityCarats = table.Column<int>(type: "integer", nullable: false),
                    PurityFactor = table.Column<decimal>(type: "numeric(6,4)", nullable: false),
                    GoldRatePerGram = table.Column<decimal>(type: "numeric(10,2)", nullable: false),
                    ValuedAmount = table.Column<decimal>(type: "numeric(18,2)", nullable: false),
                    PacketNumber = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    IsReleased = table.Column<bool>(type: "boolean", nullable: false),
                    ReleasedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GoldPledgeItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_GoldPledgeItems_GoldLoanDetails_GoldLoanDetailsId",
                        column: x => x.GoldLoanDetailsId,
                        principalTable: "GoldLoanDetails",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_GoldLoanDetails_GoldLoanStatus",
                table: "GoldLoanDetails",
                column: "GoldLoanStatus");

            migrationBuilder.CreateIndex(
                name: "IX_GoldLoanDetails_LoanApplicationId",
                table: "GoldLoanDetails",
                column: "LoanApplicationId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_GoldPledgeItems_GoldLoanDetailsId",
                table: "GoldPledgeItems",
                column: "GoldLoanDetailsId");

            migrationBuilder.CreateIndex(
                name: "IX_GoldRateMasters_RateDate",
                table: "GoldRateMasters",
                column: "RateDate",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "GoldPledgeItems");
            migrationBuilder.DropTable(name: "GoldRateMasters");
            migrationBuilder.DropTable(name: "GoldLoanDetails");
        }
    }
}
