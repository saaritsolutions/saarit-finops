using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace CustomerService.Migrations
{
    /// <inheritdoc />
    public partial class AddKycStatus : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "KycRejectionReason",
                table: "Customers",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "KycStatus",
                table: "Customers",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "KycVerifiedAt",
                table: "Customers",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "KycVerifiedBy",
                table: "Customers",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "MakerCheckerStatus",
                table: "Customers",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "KycRejectionReason",
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "KycStatus",
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "KycVerifiedAt",
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "KycVerifiedBy",
                table: "Customers");

            migrationBuilder.DropColumn(
                name: "MakerCheckerStatus",
                table: "Customers");
        }
    }
}
