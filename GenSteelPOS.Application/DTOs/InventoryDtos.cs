using System.ComponentModel.DataAnnotations;

namespace GenSteelPOS.Application.DTOs;

public sealed class StockAdjustmentRequest
{
    [Range(1, int.MaxValue)]
    public int ProductId { get; set; }

    [Range(-999999999, 999999999)]
    public decimal QuantityChange { get; set; }

    [MaxLength(250)]
    public string Remarks { get; set; } = string.Empty;
}

public sealed class InventoryDto
{
    public int ProductId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public string Sku { get; set; } = string.Empty;
    public string CategoryName { get; set; } = string.Empty;
    public decimal QuantityOnHand { get; set; }
    public decimal ReorderLevel { get; set; }
    public string Location { get; set; } = string.Empty;
    public bool IsActiveProduct { get; set; }
    public string StockStatus { get; set; } = string.Empty;
}

public sealed class InventoryQueryRequest
{
    [Range(1, int.MaxValue)]
    public int Page { get; set; } = 1;

    [Range(1, 200)]
    public int PageSize { get; set; } = 25;

    [MaxLength(100)]
    public string? Search { get; set; }

    [MaxLength(100)]
    public string? Category { get; set; }

    [MaxLength(50)]
    public string? Status { get; set; }

    [MaxLength(100)]
    public string? Location { get; set; }

    [MaxLength(50)]
    public string? SortBy { get; set; } = "productName";

    [MaxLength(4)]
    public string? SortOrder { get; set; } = "asc";
}

public sealed class InventorySummaryDto
{
    public int TotalProducts { get; set; }
    public int InStockCount { get; set; }
    public int LowStockCount { get; set; }
    public int OutOfStockCount { get; set; }
}

public sealed class InventoryListResponseDto
{
    public IReadOnlyCollection<InventoryDto> Items { get; set; } = Array.Empty<InventoryDto>();
    public int TotalCount { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalPages { get; set; }
    public InventorySummaryDto Summary { get; set; } = new();
    public IReadOnlyCollection<string> AvailableCategories { get; set; } = Array.Empty<string>();
    public IReadOnlyCollection<string> AvailableLocations { get; set; } = Array.Empty<string>();
}
