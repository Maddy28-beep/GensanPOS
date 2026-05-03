using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GenSteelPOS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddStockReceivingApproval : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_StockInRecords_Users_ReceivedByUserId",
                table: "StockInRecords");

            migrationBuilder.AddColumn<string>(
                name: "ContainerNumber",
                table: "StockInRecords",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ProductReferenceNumber",
                table: "StockInRecords",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ReviewNotes",
                table: "StockInRecords",
                type: "character varying(250)",
                maxLength: 250,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "ReviewedAtUtc",
                table: "StockInRecords",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ReviewedByUserId",
                table: "StockInRecords",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Status",
                table: "StockInRecords",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "StockNumber",
                table: "StockInRecords",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "IX_StockInRecords_ReviewedByUserId",
                table: "StockInRecords",
                column: "ReviewedByUserId");

            migrationBuilder.AddForeignKey(
                name: "FK_StockInRecords_Users_ReceivedByUserId",
                table: "StockInRecords",
                column: "ReceivedByUserId",
                principalTable: "Users",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_StockInRecords_Users_ReviewedByUserId",
                table: "StockInRecords",
                column: "ReviewedByUserId",
                principalTable: "Users",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_StockInRecords_Users_ReceivedByUserId",
                table: "StockInRecords");

            migrationBuilder.DropForeignKey(
                name: "FK_StockInRecords_Users_ReviewedByUserId",
                table: "StockInRecords");

            migrationBuilder.DropIndex(
                name: "IX_StockInRecords_ReviewedByUserId",
                table: "StockInRecords");

            migrationBuilder.DropColumn(
                name: "ContainerNumber",
                table: "StockInRecords");

            migrationBuilder.DropColumn(
                name: "ProductReferenceNumber",
                table: "StockInRecords");

            migrationBuilder.DropColumn(
                name: "ReviewNotes",
                table: "StockInRecords");

            migrationBuilder.DropColumn(
                name: "ReviewedAtUtc",
                table: "StockInRecords");

            migrationBuilder.DropColumn(
                name: "ReviewedByUserId",
                table: "StockInRecords");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "StockInRecords");

            migrationBuilder.DropColumn(
                name: "StockNumber",
                table: "StockInRecords");

            migrationBuilder.AddForeignKey(
                name: "FK_StockInRecords_Users_ReceivedByUserId",
                table: "StockInRecords",
                column: "ReceivedByUserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
