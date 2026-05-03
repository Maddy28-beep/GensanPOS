using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GenSteelPOS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddDetailedPaymentMethods : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "BankBranch",
                table: "Payments",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "BankName",
                table: "Payments",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "CheckDate",
                table: "Payments",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CheckNumber",
                table: "Payments",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Details",
                table: "Payments",
                type: "character varying(250)",
                maxLength: 250,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "DueDays",
                table: "Payments",
                type: "integer",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "BankBranch",
                table: "Payments");

            migrationBuilder.DropColumn(
                name: "BankName",
                table: "Payments");

            migrationBuilder.DropColumn(
                name: "CheckDate",
                table: "Payments");

            migrationBuilder.DropColumn(
                name: "CheckNumber",
                table: "Payments");

            migrationBuilder.DropColumn(
                name: "Details",
                table: "Payments");

            migrationBuilder.DropColumn(
                name: "DueDays",
                table: "Payments");
        }
    }
}
