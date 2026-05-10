using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LoanService.Migrations
{
    /// <inheritdoc />
    public partial class AddLoanOriginalTermsFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "OriginalInterestRate",
                table: "LoanApplications",
                type: "numeric(6,4)",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "OriginalTenureMonths",
                table: "LoanApplications",
                type: "integer",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "OriginalInterestRate",
                table: "LoanApplications");

            migrationBuilder.DropColumn(
                name: "OriginalTenureMonths",
                table: "LoanApplications");
        }
    }
}
