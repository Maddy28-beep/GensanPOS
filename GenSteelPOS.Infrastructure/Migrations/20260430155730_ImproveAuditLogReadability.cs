using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GenSteelPOS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class ImproveAuditLogReadability : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "NewValue",
                table: "AuditLogs",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "OldValue",
                table: "AuditLogs",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "NewValue",
                table: "AuditLogs");

            migrationBuilder.DropColumn(
                name: "OldValue",
                table: "AuditLogs");
        }
    }
}
