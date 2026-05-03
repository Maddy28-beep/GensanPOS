namespace GenSteelPOS.Application.DTOs;

public sealed class DashboardReportDto
{
    public decimal TotalSalesToday { get; set; }
    public decimal TotalReturnsToday { get; set; }
    public decimal NetSalesToday { get; set; }
    public int TotalTransactionsToday { get; set; }
    public int LowStockCount { get; set; }
    public int ActiveProductsCount { get; set; }
    public decimal TotalInventoryValue { get; set; }
    public decimal TotalSalesThisMonth { get; set; }
    public decimal TotalReturnsThisMonth { get; set; }
    public decimal NetSalesThisMonth { get; set; }
}

public sealed class SalesSummaryDto
{
    public decimal GrossSales { get; set; }
    public decimal ReturnsAmount { get; set; }
    public decimal NetSales { get; set; }
    public decimal TotalDiscount { get; set; }
    public decimal TotalTax { get; set; }
    public decimal NetSalesExcludingTax { get; set; }
    public decimal CostOfGoodsSold { get; set; }
    public decimal GrossProfit { get; set; }
    public decimal ProfitMarginPercent { get; set; }
    public int TransactionCount { get; set; }
    public decimal TotalInventoryValue { get; set; }
}

public sealed class ProductSalesProfitReportRowDto
{
    public int ProductId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public decimal TotalQuantitySold { get; set; }
    public decimal TotalSales { get; set; }
    public decimal TotalCost { get; set; }
    public decimal Profit { get; set; }
}

public sealed class InventoryValueReportRowDto
{
    public int ProductId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public string CategoryName { get; set; } = string.Empty;
    public decimal CurrentStock { get; set; }
    public decimal CostPrice { get; set; }
    public decimal SellingPrice { get; set; }
    public decimal InventoryValue { get; set; }
}

public sealed class SalesTransactionReportRowDto
{
    public int SaleId { get; set; }
    public string SaleNumber { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; }
    public string CashierName { get; set; } = string.Empty;
    public string PaymentMethods { get; set; } = string.Empty;
    public decimal TotalAmount { get; set; }
    public decimal ReturnsAmount { get; set; }
    public decimal NetAmount { get; set; }
    public decimal CostOfGoodsSold { get; set; }
    public decimal Profit { get; set; }
    public string Status { get; set; } = string.Empty;
}

public sealed class SalesReportPdfRequest
{
    public DateTime? FromUtc { get; set; }
    public DateTime? ToUtc { get; set; }
    public string? Category { get; set; }
    public string? Status { get; set; }
    public string? Cashier { get; set; }
    public string? PaymentMethod { get; set; }
}

public sealed class InventoryReportPdfRequest
{
    public string? Search { get; set; }
    public string? Category { get; set; }
    public string? Status { get; set; }
    public string? Location { get; set; }
    public string? SortBy { get; set; }
    public string? SortOrder { get; set; }
}

public sealed class StockMovementReportPdfRequest
{
    public DateTime? FromUtc { get; set; }
    public DateTime? ToUtc { get; set; }
    public string? Search { get; set; }
    public string? MovementType { get; set; }
}
