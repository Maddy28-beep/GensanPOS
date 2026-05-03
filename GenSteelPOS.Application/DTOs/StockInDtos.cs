using System.ComponentModel.DataAnnotations;

namespace GenSteelPOS.Application.DTOs;

public sealed class CreateStockInRequest
{
    [Range(1, int.MaxValue)]
    public int SupplierId { get; set; }

    [MaxLength(100)]
    public string ReferenceNumber { get; set; } = string.Empty;

    [MaxLength(100)]
    public string ContainerNumber { get; set; } = string.Empty;

    [MaxLength(100)]
    public string StockNumber { get; set; } = string.Empty;

    [MaxLength(100)]
    public string ProductReferenceNumber { get; set; } = string.Empty;

    public DateTime? ReceivedDateUtc { get; set; }

    [MaxLength(250)]
    public string Remarks { get; set; } = string.Empty;

    [MinLength(1)]
    public List<CreateStockInItemRequest> Items { get; set; } = new();
}

public sealed class CreateStockInItemRequest
{
    [Range(1, int.MaxValue)]
    public int ProductId { get; set; }

    [Range(0.01, 999999999)]
    public decimal Quantity { get; set; }

    [Range(0, 999999999)]
    public decimal UnitCost { get; set; }
}

public sealed class ReviewStockInRequest
{
    [MaxLength(250)]
    public string Notes { get; set; } = string.Empty;
}

public sealed class StockInRecordDto
{
    public int Id { get; set; }
    public string ReferenceNumber { get; set; } = string.Empty;
    public string ContainerNumber { get; set; } = string.Empty;
    public string StockNumber { get; set; } = string.Empty;
    public string ProductReferenceNumber { get; set; } = string.Empty;
    public string SupplierName { get; set; } = string.Empty;
    public string ReceivedByName { get; set; } = string.Empty;
    public string ReviewedByName { get; set; } = string.Empty;
    public DateTime ReceivedDateUtc { get; set; }
    public DateTime? ReviewedAtUtc { get; set; }
    public string Status { get; set; } = string.Empty;
    public string Remarks { get; set; } = string.Empty;
    public string ReviewNotes { get; set; } = string.Empty;
    public List<StockInItemDto> Items { get; set; } = new();
}

public sealed class StockInItemDto
{
    public int ProductId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
    public decimal UnitCost { get; set; }
}
