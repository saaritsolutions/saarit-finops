using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LoanService.Migrations
{
    /// <inheritdoc />
    public partial class AddLoanUpgradeFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsUpgraded",
                table: "LoanApplications",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "UpgradeJournalNumber",
                table: "LoanApplications",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "UpgradedDate",
                table: "LoanApplications",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "UpgradedReason",
                table: "LoanApplications",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsUpgraded",
                schema: "public",
                table: "LoanApplications");

            migrationBuilder.DropColumn(
                name: "UpgradeJournalNumber",
                schema: "public",
                table: "LoanApplications");

            migrationBuilder.DropColumn(
                name: "UpgradedDate",
                schema: "public",
                table: "LoanApplications");

            migrationBuilder.DropColumn(
                name: "UpgradedReason",
                schema: "public",
                table: "LoanApplications");
        }
    }
}
