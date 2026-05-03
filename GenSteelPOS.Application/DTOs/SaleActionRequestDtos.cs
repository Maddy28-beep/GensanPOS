using System.ComponentModel.DataAnnotations;
using GenSteelPOS.Domain.Enums;

namespace GenSteelPOS.Application.DTOs;

public sealed class CreateSaleActionRequestRequest
{
    [Range(1, int.MaxValue)]
    public int SaleId { get; set; }

    [Required]
    public string RequestType { get; set; } = string.Empty;

    [Required, MaxLength(500)]
    public string Reason { get; set; } = string.Empty;

    public List<SaleActionRequestedReturnItemRequest> RequestedReturnItems { get; set; } = new();
}

public sealed class SaleActionRequestedReturnItemRequest
{
    [Range(1, int.MaxValue)]
    public int SaleItemId { get; set; }

    [Range(0.01, 999999999)]
    public decimal Quantity { get; set; }

    [Required]
    public ReturnItemCondition Condition { get; set; }

    [MaxLength(250)]
    public string Remarks { get; set; } = string.Empty;
}

public sealed class ReviewSaleActionRequestRequest
{
    [MaxLength(500)]
    public string Notes { get; set; } = string.Empty;
}

public sealed class SaleActionRequestDto
{
    public int Id { get; set; }
    public int SaleId { get; set; }
    public string SaleNumber { get; set; } = string.Empty;
    public string CashierName { get; set; } = string.Empty;
    public decimal SaleTotalAmount { get; set; }
    public string SaleStatus { get; set; } = string.Empty;
    public string RequestType { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string RequestReason { get; set; } = string.Empty;
    public string ReviewNotes { get; set; } = string.Empty;
    public string RequestedByName { get; set; } = string.Empty;
    public string ReviewedByName { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; }
    public DateTime? ReviewedAtUtc { get; set; }
    public List<SaleActionRequestedReturnItemDto> RequestedReturnItems { get; set; } = new();
}

public sealed class SaleActionRequestedReturnItemDto
{
    public int SaleItemId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
    public decimal MaxQuantity { get; set; }
    public string Condition { get; set; } = string.Empty;
    public string Remarks { get; set; } = string.Empty;
}
