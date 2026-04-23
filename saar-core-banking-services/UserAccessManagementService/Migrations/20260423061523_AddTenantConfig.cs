using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace UserAccessManagementService.Migrations
{
    /// <inheritdoc />
    public partial class AddTenantConfig : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "BankAddress",
                table: "Tenants",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BankEmail",
                table: "Tenants",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "BankPhone",
                table: "Tenants",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ConfigUpdatedAt",
                table: "Tenants",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ConfigUpdatedBy",
                table: "Tenants",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "FeatureApprovalChain",
                table: "Tenants",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "FeatureComplianceAlerts",
                table: "Tenants",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "FeatureDynamicForms",
                table: "Tenants",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "FeatureExpressions",
                table: "Tenants",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "FeatureFdRd",
                table: "Tenants",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "FeatureGoldLoan",
                table: "Tenants",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<string>(
                name: "RbiLicenseNumber",
                table: "Tenants",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "WebsiteUrl",
                table: "Tenants",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BankAddress",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "BankEmail",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "BankPhone",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "ConfigUpdatedAt",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "ConfigUpdatedBy",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "FeatureApprovalChain",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "FeatureComplianceAlerts",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "FeatureDynamicForms",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "FeatureExpressions",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "FeatureFdRd",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "FeatureGoldLoan",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "RbiLicenseNumber",
                table: "Tenants");

            migrationBuilder.DropColumn(
                name: "WebsiteUrl",
                table: "Tenants");
        }
    }
}
