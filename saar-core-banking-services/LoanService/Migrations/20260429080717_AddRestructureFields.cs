using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LoanService.Migrations
{
    /// <inheritdoc />
    public partial class AddRestructureFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsRestructured",
                table: "LoanApplications",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "RestructuredDate",
                table: "LoanApplications",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "RestructuredNewEmi",
                table: "LoanApplications",
                type: "numeric(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "RestructuredNewInterestRate",
                table: "LoanApplications",
                type: "numeric(6,4)",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "RestructuredNewTenureMonths",
                table: "LoanApplications",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RestructuredReason",
                table: "LoanApplications",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsRestructured",
                table: "LoanApplications");

            migrationBuilder.DropColumn(
                name: "RestructuredDate",
                table: "LoanApplications");

            migrationBuilder.DropColumn(
                name: "RestructuredNewEmi",
                table: "LoanApplications");

            migrationBuilder.DropColumn(
                name: "RestructuredNewInterestRate",
                table: "LoanApplications");

            migrationBuilder.DropColumn(
                name: "RestructuredNewTenureMonths",
                table: "LoanApplications");

            migrationBuilder.DropColumn(
                name: "RestructuredReason",
                table: "LoanApplications");
        }
    }
}
