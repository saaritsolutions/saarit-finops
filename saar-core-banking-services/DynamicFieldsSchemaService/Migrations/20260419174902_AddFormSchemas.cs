using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace DynamicFieldsSchemaService.Migrations
{
    /// <inheritdoc />
    public partial class AddFormSchemas : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "FormSchemaHistories",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    FormSchemaId = table.Column<Guid>(type: "uuid", nullable: false),
                    FormType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    TenantId = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    SchemaJson = table.Column<string>(type: "text", nullable: false),
                    SavedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    SavedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Notes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FormSchemaHistories", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "FormSchemas",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    FormType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    TenantId = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Version = table.Column<int>(type: "integer", nullable: false),
                    SchemaJson = table.Column<string>(type: "text", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    IsDefault = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedBy = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Notes = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FormSchemas", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_FormSchemaHistory_SchemaId_Version",
                table: "FormSchemaHistories",
                columns: new[] { "FormSchemaId", "Version" });

            migrationBuilder.CreateIndex(
                name: "IX_FormSchemas_FormType_TenantId",
                table: "FormSchemas",
                columns: new[] { "FormType", "TenantId" });

            migrationBuilder.CreateIndex(
                name: "IX_FormSchemas_FormType_TenantId_Active",
                table: "FormSchemas",
                columns: new[] { "FormType", "TenantId", "IsActive" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "FormSchemaHistories");

            migrationBuilder.DropTable(
                name: "FormSchemas");
        }
    }
}
