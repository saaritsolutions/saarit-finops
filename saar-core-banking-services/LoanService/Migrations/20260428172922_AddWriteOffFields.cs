using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LoanService.Migrations
{
    /// <inheritdoc />
    public partial class AddWriteOffFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "WriteOffAuthorizedBy",
                table: "LoanApplications",
                type: "character varying(150)",
                maxLength: 150,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "WriteOffDate",
                table: "LoanApplications",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "WriteOffJournalNumber",
                table: "LoanApplications",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "WriteOffReason",
                table: "LoanApplications",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "WriteOffAuthorizedBy",
                table: "LoanApplications");

            migrationBuilder.DropColumn(
                name: "WriteOffDate",
                table: "LoanApplications");

            migrationBuilder.DropColumn(
                name: "WriteOffJournalNumber",
                table: "LoanApplications");

            migrationBuilder.DropColumn(
                name: "WriteOffReason",
                table: "LoanApplications");
        }
    }
}
