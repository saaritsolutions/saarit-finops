using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace AccountService.Migrations
{
    /// <inheritdoc />
    public partial class AddAccountServiceSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AccountType",
                table: "Accounts");

            migrationBuilder.RenameColumn(
                name: "OpenedOn",
                table: "Accounts",
                newName: "DateOpened");

            migrationBuilder.AlterColumn<string>(
                name: "AccountNumber",
                table: "Accounts",
                type: "text",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AddColumn<decimal>("AccruedInterest",    "Accounts", type: "numeric",                    nullable: false, defaultValue: 0m);
            migrationBuilder.AddColumn<decimal>("AccruedTDS",         "Accounts", type: "numeric",                    nullable: false, defaultValue: 0m);
            migrationBuilder.AddColumn<string> ("ApprovalStatus",     "Accounts", type: "text",                       nullable: true);
            migrationBuilder.AddColumn<DateTime>("ApprovedAt",        "Accounts", type: "timestamp with time zone",   nullable: true);
            migrationBuilder.AddColumn<string> ("ApprovedBy",         "Accounts", type: "text",                       nullable: true);
            migrationBuilder.AddColumn<int>    ("BranchId",           "Accounts", type: "integer",                    nullable: false, defaultValue: 0);
            migrationBuilder.AddColumn<string> ("CompanyDocuments",   "Accounts", type: "text",                       nullable: true);
            migrationBuilder.AddColumn<DateTime>("CreatedAt",         "Accounts", type: "timestamp with time zone",   nullable: false, defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));
            migrationBuilder.AddColumn<string> ("CreatedBy",          "Accounts", type: "text",                       nullable: true);
            migrationBuilder.AddColumn<decimal>("DailyTransactionLimit", "Accounts", type: "numeric",                 nullable: true);
            migrationBuilder.AddColumn<DateTime>("DateClosed",        "Accounts", type: "timestamp with time zone",   nullable: true);
            migrationBuilder.AddColumn<string> ("InitialDepositMode", "Accounts", type: "text",                       nullable: true);
            migrationBuilder.AddColumn<bool>   ("IsBSBD",            "Accounts", type: "boolean",                    nullable: false, defaultValue: false);
            migrationBuilder.AddColumn<bool>   ("IsDeceased",        "Accounts", type: "boolean",                    nullable: false, defaultValue: false);
            migrationBuilder.AddColumn<bool>   ("IsMinor",           "Accounts", type: "boolean",                    nullable: false, defaultValue: false);
            migrationBuilder.AddColumn<bool>   ("IsSimplifiedKYC",   "Accounts", type: "boolean",                    nullable: false, defaultValue: false);
            migrationBuilder.AddColumn<bool>   ("IsSpecialScheme",   "Accounts", type: "boolean",                    nullable: false, defaultValue: false);
            migrationBuilder.AddColumn<bool>   ("IsTDSExempt",       "Accounts", type: "boolean",                    nullable: false, defaultValue: false);
            migrationBuilder.AddColumn<int[]>  ("JointCustomers",    "Accounts", type: "integer[]",                  nullable: true);
            migrationBuilder.AddColumn<string> ("LegalGuardianName", "Accounts", type: "text",                       nullable: true);
            migrationBuilder.AddColumn<decimal>("MinorAccountLimit", "Accounts", type: "numeric",                    nullable: true);
            migrationBuilder.AddColumn<string> ("ModeOfOperation",   "Accounts", type: "text",                       nullable: true);
            migrationBuilder.AddColumn<string> ("OldAccountNumber",  "Accounts", type: "text",                       nullable: true);
            migrationBuilder.AddColumn<DateTime>("OldAccountOpenedDate", "Accounts", type: "timestamp with time zone", nullable: true);
            migrationBuilder.AddColumn<int>    ("ProductTypeId",     "Accounts", type: "integer",                    nullable: false, defaultValue: 0);
            migrationBuilder.AddColumn<string> ("SpecialSchemeName", "Accounts", type: "text",                       nullable: true);
            migrationBuilder.AddColumn<string> ("Status",           "Accounts", type: "text",                       nullable: true);
            migrationBuilder.AddColumn<decimal>("TransactionLimit",  "Accounts", type: "numeric",                    nullable: true);

            migrationBuilder.CreateTable(
                name: "AccountHistories",
                columns: table => new
                {
                    AccountHistoryId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    AccountId    = table.Column<int>(type: "integer", nullable: false),
                    ChangeType   = table.Column<string>(type: "text", nullable: false),
                    OldValue     = table.Column<string>(type: "text", nullable: false),
                    NewValue     = table.Column<string>(type: "text", nullable: false),
                    ChangeDate   = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AccountHistories", x => x.AccountHistoryId);
                    table.ForeignKey("FK_AccountHistories_Accounts_AccountId",
                        column: x => x.AccountId,
                        principalTable: "Accounts",
                        principalColumn: "AccountId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AccountProductTypes",
                columns: table => new
                {
                    AccountProductTypeId     = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name                     = table.Column<string>(type: "text", nullable: true),
                    Description              = table.Column<string>(type: "text", nullable: true),
                    MinimumAge               = table.Column<int>(type: "integer", nullable: true),
                    AllowedCustomerTypes     = table.Column<string>(type: "text", nullable: true),
                    MinimumOpeningAmount     = table.Column<decimal>(type: "numeric", nullable: true),
                    IsActive                 = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AccountProductTypes", x => x.AccountProductTypeId);
                });

            migrationBuilder.CreateTable(
                name: "AccountRestrictions",
                columns: table => new
                {
                    AccountRestrictionId = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    AccountId       = table.Column<int>(type: "integer", nullable: false),
                    RestrictionType = table.Column<string>(type: "text", nullable: false),
                    Reason          = table.Column<string>(type: "text", nullable: false),
                    StartDate       = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    EndDate         = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    IsActive        = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AccountRestrictions", x => x.AccountRestrictionId);
                    table.ForeignKey("FK_AccountRestrictions_Accounts_AccountId",
                        column: x => x.AccountId,
                        principalTable: "Accounts",
                        principalColumn: "AccountId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Nominees",
                columns: table => new
                {
                    NomineeId          = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    AccountId          = table.Column<int>(type: "integer", nullable: false),
                    CustomerId         = table.Column<int>(type: "integer", nullable: false),
                    Name               = table.Column<string>(type: "text", nullable: true),
                    Address            = table.Column<string>(type: "text", nullable: true),
                    Relationship       = table.Column<string>(type: "text", nullable: true),
                    DateOfBirth        = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    AuthorizedReceiver = table.Column<string>(type: "text", nullable: true),
                    Signature          = table.Column<string>(type: "text", nullable: true),
                    PercentageShare    = table.Column<decimal>(type: "numeric", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Nominees", x => x.NomineeId);
                    table.ForeignKey("FK_Nominees_Accounts_AccountId",
                        column: x => x.AccountId,
                        principalTable: "Accounts",
                        principalColumn: "AccountId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Passbooks",
                columns: table => new
                {
                    PassbookId     = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    AccountId      = table.Column<int>(type: "integer", nullable: false),
                    PassbookNumber = table.Column<string>(type: "text", nullable: true),
                    IssuedDate     = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    IssuedBy       = table.Column<string>(type: "text", nullable: true),
                    Remarks        = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Passbooks", x => x.PassbookId);
                });

            migrationBuilder.CreateIndex("IX_Accounts_ProductTypeId",      "Accounts",          "ProductTypeId");
            migrationBuilder.CreateIndex("IX_AccountHistories_AccountId",   "AccountHistories",  "AccountId");
            migrationBuilder.CreateIndex("IX_AccountRestrictions_AccountId","AccountRestrictions","AccountId");
            migrationBuilder.CreateIndex("IX_Nominees_AccountId",           "Nominees",          "AccountId");

            migrationBuilder.AddForeignKey(
                name: "FK_Accounts_AccountProductTypes_ProductTypeId",
                table: "Accounts",
                column: "ProductTypeId",
                principalTable: "AccountProductTypes",
                principalColumn: "AccountProductTypeId",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey("FK_Accounts_AccountProductTypes_ProductTypeId", "Accounts");
            migrationBuilder.DropTable("AccountHistories");
            migrationBuilder.DropTable("AccountProductTypes");
            migrationBuilder.DropTable("AccountRestrictions");
            migrationBuilder.DropTable("Nominees");
            migrationBuilder.DropTable("Passbooks");
            migrationBuilder.DropIndex("IX_Accounts_ProductTypeId", "Accounts");

            migrationBuilder.DropColumn("AccruedInterest",      "Accounts");
            migrationBuilder.DropColumn("AccruedTDS",           "Accounts");
            migrationBuilder.DropColumn("ApprovalStatus",       "Accounts");
            migrationBuilder.DropColumn("ApprovedAt",           "Accounts");
            migrationBuilder.DropColumn("ApprovedBy",           "Accounts");
            migrationBuilder.DropColumn("BranchId",             "Accounts");
            migrationBuilder.DropColumn("CompanyDocuments",     "Accounts");
            migrationBuilder.DropColumn("CreatedAt",            "Accounts");
            migrationBuilder.DropColumn("CreatedBy",            "Accounts");
            migrationBuilder.DropColumn("DailyTransactionLimit","Accounts");
            migrationBuilder.DropColumn("DateClosed",           "Accounts");
            migrationBuilder.DropColumn("InitialDepositMode",   "Accounts");
            migrationBuilder.DropColumn("IsBSBD",               "Accounts");
            migrationBuilder.DropColumn("IsDeceased",           "Accounts");
            migrationBuilder.DropColumn("IsMinor",              "Accounts");
            migrationBuilder.DropColumn("IsSimplifiedKYC",      "Accounts");
            migrationBuilder.DropColumn("IsSpecialScheme",      "Accounts");
            migrationBuilder.DropColumn("IsTDSExempt",          "Accounts");
            migrationBuilder.DropColumn("JointCustomers",       "Accounts");
            migrationBuilder.DropColumn("LegalGuardianName",    "Accounts");
            migrationBuilder.DropColumn("MinorAccountLimit",    "Accounts");
            migrationBuilder.DropColumn("ModeOfOperation",      "Accounts");
            migrationBuilder.DropColumn("OldAccountNumber",     "Accounts");
            migrationBuilder.DropColumn("OldAccountOpenedDate", "Accounts");
            migrationBuilder.DropColumn("ProductTypeId",        "Accounts");
            migrationBuilder.DropColumn("SpecialSchemeName",    "Accounts");
            migrationBuilder.DropColumn("Status",               "Accounts");
            migrationBuilder.DropColumn("TransactionLimit",     "Accounts");

            migrationBuilder.RenameColumn(name: "DateOpened", table: "Accounts", newName: "OpenedOn");

            migrationBuilder.AlterColumn<string>(
                name: "AccountNumber",
                table: "Accounts",
                type: "text",
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "text",
                oldNullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AccountType",
                table: "Accounts",
                type: "text",
                nullable: false,
                defaultValue: "");
        }
    }
}
