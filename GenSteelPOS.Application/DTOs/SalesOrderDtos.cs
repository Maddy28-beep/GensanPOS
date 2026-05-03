using System.ComponentModel.DataAnnotations;

namespace GenSteelPOS.Application.DTOs;

public sealed class CreateSalesOrderRequest
{
    [Required, MaxLength(150)]
    public string CustomerName { get; set; } = string.Empty;

    [MaxLength(100)]
    public string CustomerContact { get; set; } = string.Empty;

    [MaxLength(250)]
    public string CustomerAddress { get; set; } = string.Empty;

    [MaxLength(250)]
    public string Remarks { get; set; } = string.Empty;

    [MinLength(1)]
    public List<CreateSalesOrderItemRequest> Items { get; set; } = new();

    [Range(0, 999999999)]
    public decimal DiscountAmount { get; set; }

    [Range(0, 999999999)]
    public decimal TaxAmount { get; set; }
}

public sealed class CreateSalesOrderItemRequest
{
    [Range(1, int.MaxValue)]
    public int ProductId { get; set; }

    [Range(0.01, 999999999)]
    public decimal Quantity { get; set; }
}

public sealed class UpdateSalesOrderStatusRequest
{
    [Required, MaxLength(250)]
    public string Reason { get; set; } = string.Empty;
}

public sealed class ConvertSalesOrderRequest
{
    [MinLength(1)]
    public List<PaymentRequest> Payments { get; set; } = new();
}

public sealed class SalesOrderDto
{
    public int Id { get; set; }
    public string OrderNumber { get; set; } = string.Empty;
    public string CustomerName { get; set; } = string.Empty;
    public string CustomerContact { get; set; } = string.Empty;
    public string CustomerAddress { get; set; } = string.Empty;
    public string Remarks { get; set; } = string.Empty;
    public string CreatedByName { get; set; } = string.Empty;
    public decimal Subtotal { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal TaxAmount { get; set; }
    public decimal TotalAmount { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; }
    public int? ConvertedSaleId { get; set; }
    public string ConvertedSaleNumber { get; set; } = string.Empty;
    public List<SalesOrderItemDto> Items { get; set; } = new();
}

public sealed class SalesOrderItemDto
{
    public int ProductId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal LineTotal { get; set; }
}
