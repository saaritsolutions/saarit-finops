using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace InterestFeeService.Migrations
{
    /// <inheritdoc />
    public partial class AddTenantIdAndAccountNumber : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AccountNumber",
                table: "InterestFees",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TenantId",
                table: "InterestFees",
                type: "text",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AccountNumber",
                table: "InterestFees");

            migrationBuilder.DropColumn(
                name: "TenantId",
                table: "InterestFees");
        }
    }
}
