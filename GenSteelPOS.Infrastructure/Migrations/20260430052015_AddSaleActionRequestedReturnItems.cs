using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GenSteelPOS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddSaleActionRequestedReturnItems : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "RequestedReturnItemsJson",
                table: "SaleActionRequests",
                type: "character varying(4000)",
                maxLength: 4000,
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "RequestedReturnItemsJson",
                table: "SaleActionRequests");
        }
    }
}
