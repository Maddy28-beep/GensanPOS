using System.ComponentModel.DataAnnotations;

namespace GenSteelPOS.Application.DTOs;

public sealed class CreatePurchaseOrderRequest
{
    [Range(1, int.MaxValue)]
    public int SupplierId { get; set; }

    [MaxLength(250)]
    public string Remarks { get; set; } = string.Empty;

    [MinLength(1)]
    public List<CreatePurchaseOrderItemRequest> Items { get; set; } = new();
}

public sealed class CreatePurchaseOrderItemRequest
{
    [Range(1, int.MaxValue)]
    public int ProductId { get; set; }

    [Range(0.01, 999999999)]
    public decimal Quantity { get; set; }

    [Range(0, 999999999)]
    public decimal UnitCost { get; set; }
}

public sealed class UpdatePurchaseOrderStatusRequest
{
    [Required, MaxLength(250)]
    public string Reason { get; set; } = string.Empty;
}

public sealed class ReceivePurchaseOrderRequest
{
    [MaxLength(250)]
    public string Remarks { get; set; } = string.Empty;
}

public sealed class PurchaseOrderDto
{
    public int Id { get; set; }
    public string OrderNumber { get; set; } = string.Empty;
    public string SupplierName { get; set; } = string.Empty;
    public string CreatedByName { get; set; } = string.Empty;
    public string Remarks { get; set; } = string.Empty;
    public decimal TotalEstimatedCost { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; }
    public int? ReceivedStockInRecordId { get; set; }
    public string ReceivedStockInReferenceNumber { get; set; } = string.Empty;
    public List<PurchaseOrderItemDto> Items { get; set; } = new();
}

public sealed class PurchaseOrderItemDto
{
    public int ProductId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
    public decimal UnitCost { get; set; }
    public decimal LineTotal { get; set; }
}
