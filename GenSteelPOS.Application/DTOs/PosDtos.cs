using System.ComponentModel.DataAnnotations;
using GenSteelPOS.Domain.Enums;

namespace GenSteelPOS.Application.DTOs;

public sealed class ProcessSaleRequest
{
    [MinLength(1)]
    public List<ProcessSaleItemRequest> Items { get; set; } = new();

    [MinLength(1)]
    public List<PaymentRequest> Payments { get; set; } = new();

    [Range(0, 999999999)]
    public decimal DiscountAmount { get; set; }

    [Range(-999999999, 999999999)]
    public decimal TaxAmount { get; set; }

    [MaxLength(150)]
    public string CustomerName { get; set; } = string.Empty;

    [MaxLength(250)]
    public string CustomerAddress { get; set; } = string.Empty;

    [MaxLength(50)]
    public string CustomerTin { get; set; } = string.Empty;

    [MaxLength(250)]
    public string Remarks { get; set; } = string.Empty;

    [MaxLength(100)]
    public string PoNumber { get; set; } = string.Empty;

    [MaxLength(50)]
    public string Terms { get; set; } = string.Empty;
}

public sealed class ProcessSaleItemRequest
{
    [Range(1, int.MaxValue)]
    public int ProductId { get; set; }

    [Range(0.01, 999999999)]
    public decimal Quantity { get; set; }
}

public sealed class PaymentRequest
{
    [Required]
    public PaymentMethod PaymentMethod { get; set; }

    [Range(0.01, 999999999)]
    public decimal Amount { get; set; }

    [MaxLength(100)]
    public string ReferenceNumber { get; set; } = string.Empty;

    [MaxLength(100)]
    public string BankName { get; set; } = string.Empty;

    [MaxLength(100)]
    public string BankBranch { get; set; } = string.Empty;

    [MaxLength(100)]
    public string CheckNumber { get; set; } = string.Empty;

    public DateTime? CheckDate { get; set; }

    [Range(0, 3650)]
    public int? DueDays { get; set; }

    [MaxLength(250)]
    public string Details { get; set; } = string.Empty;
}

public sealed class SaleDto
{
    public int Id { get; set; }
    public string SaleNumber { get; set; } = string.Empty;
    public string CashierName { get; set; } = string.Empty;
    public string CustomerName { get; set; } = string.Empty;
    public string CustomerAddress { get; set; } = string.Empty;
    public string CustomerTin { get; set; } = string.Empty;
    public string Remarks { get; set; } = string.Empty;
    public string PoNumber { get; set; } = string.Empty;
    public string Terms { get; set; } = string.Empty;
    public decimal Subtotal { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal TaxAmount { get; set; }
    public decimal TotalAmount { get; set; }
    public decimal AmountPaid { get; set; }
    public decimal ChangeDue { get; set; }
    public decimal CostOfGoodsSold { get; set; }
    public decimal GrossProfit { get; set; }
    public decimal ProfitMarginPercent { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; }
    public decimal TotalReturnedAmount { get; set; }
    public List<SaleItemDto> Items { get; set; } = new();
    public List<PaymentDto> Payments { get; set; } = new();
    public List<ReturnDto> Returns { get; set; } = new();
}

public sealed class UpdateSaleStatusRequest
{
    [Required, MaxLength(250)]
    public string Reason { get; set; } = string.Empty;
}

public sealed class SaleItemDto
{
    public int SaleItemId { get; set; }
    public int ProductId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal CostPrice { get; set; }
    public decimal LineTotal { get; set; }
    public decimal CostOfGoodsSold { get; set; }
    public decimal GrossProfit { get; set; }
    public decimal ReturnedQuantity { get; set; }
    public decimal RemainingReturnableQuantity { get; set; }
}

public sealed class PaymentDto
{
    public string PaymentMethod { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string ReferenceNumber { get; set; } = string.Empty;
    public string BankName { get; set; } = string.Empty;
    public string BankBranch { get; set; } = string.Empty;
    public string CheckNumber { get; set; } = string.Empty;
    public DateTime? CheckDate { get; set; }
    public int? DueDays { get; set; }
    public string Details { get; set; } = string.Empty;
}
