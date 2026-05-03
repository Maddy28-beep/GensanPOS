using GenSteelPOS.Application.DTOs;
using GenSteelPOS.Application.Services;
using GenSteelPOS.Domain.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GenSteelPOS.Api.Controllers;

[ApiController]
[Authorize(Roles = $"{AppRoles.Admin},{AppRoles.SuperAdmin}")]
[Route("api/reports")]
public sealed class ReportsController(IReportsService reportsService, IAuditLogService auditLogService) : ControllerBase
{
    [HttpGet("dashboard")]
    public async Task<ActionResult<DashboardReportDto>> GetDashboard(CancellationToken cancellationToken) =>
        Ok(await reportsService.GetDashboardAsync(cancellationToken));

    [HttpGet("sales-summary")]
    public async Task<ActionResult<SalesSummaryDto>> GetSalesSummary([FromQuery] DateTime? fromUtc, [FromQuery] DateTime? toUtc, CancellationToken cancellationToken) =>
        Ok(await reportsService.GetSalesSummaryAsync(fromUtc, toUtc, cancellationToken));

    [HttpGet("sales/products-profit")]
    public async Task<ActionResult<List<ProductSalesProfitReportRowDto>>> GetProductSalesProfit([FromQuery] DateTime? fromUtc, [FromQuery] DateTime? toUtc, CancellationToken cancellationToken) =>
        Ok(await reportsService.GetProductSalesProfitAsync(fromUtc, toUtc, cancellationToken));

    [HttpGet("sales/transactions")]
    public async Task<ActionResult<List<SalesTransactionReportRowDto>>> GetSalesTransactions([FromQuery] DateTime? fromUtc, [FromQuery] DateTime? toUtc, CancellationToken cancellationToken) =>
        Ok(await reportsService.GetSalesTransactionsAsync(fromUtc, toUtc, cancellationToken));

    [HttpGet("inventory/value")]
    [Authorize(Roles = AppRoles.SuperAdmin)]
    public async Task<ActionResult<List<InventoryValueReportRowDto>>> GetInventoryValue(CancellationToken cancellationToken) =>
        Ok(await reportsService.GetInventoryValueAsync(cancellationToken));

    [HttpGet("sales/pdf")]
    public async Task<IActionResult> GetSalesPdf([FromQuery] SalesReportPdfRequest request, CancellationToken cancellationToken)
    {
        var pdf = await reportsService.GetSalesPdfAsync(request, cancellationToken);
        await auditLogService.CreateAsync("DownloadSalesPdf", "Report", "sales", "Downloaded sales PDF report.", cancellationToken);
        var fileName = $"sales-report-{DateTime.UtcNow:yyyyMMddHHmmss}.pdf";
        return File(pdf, "application/pdf", fileName);
    }

    [HttpGet("inventory/pdf")]
    [Authorize(Roles = AppRoles.SuperAdmin)]
    public async Task<IActionResult> GetInventoryPdf([FromQuery] InventoryReportPdfRequest request, CancellationToken cancellationToken)
    {
        var pdf = await reportsService.GetInventoryPdfAsync(request, cancellationToken);
        await auditLogService.CreateAsync("DownloadInventoryPdf", "Report", "inventory", "Downloaded inventory PDF report.", cancellationToken);
        var fileName = $"inventory-report-{DateTime.UtcNow:yyyyMMddHHmmss}.pdf";
        return File(pdf, "application/pdf", fileName);
    }

    [HttpGet("stock-movements/pdf")]
    public async Task<IActionResult> GetStockMovementsPdf([FromQuery] StockMovementReportPdfRequest request, CancellationToken cancellationToken)
    {
        var pdf = await reportsService.GetStockMovementsPdfAsync(request, cancellationToken);
        await auditLogService.CreateAsync("DownloadStockMovementsPdf", "Report", "stock-movements", "Downloaded stock movements PDF report.", cancellationToken);
        var fileName = $"stock-movements-report-{DateTime.UtcNow:yyyyMMddHHmmss}.pdf";
        return File(pdf, "application/pdf", fileName);
    }
}
