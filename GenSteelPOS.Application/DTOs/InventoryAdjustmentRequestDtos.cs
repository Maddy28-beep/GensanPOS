using System.ComponentModel.DataAnnotations;

namespace GenSteelPOS.Application.DTOs;

public sealed class CreateInventoryAdjustmentRequest
{
    [Range(1, int.MaxValue)]
    public int ProductId { get; set; }

    [Required]
    [MaxLength(30)]
    public string RequestType { get; set; } = string.Empty;

    [Range(-999999999, 999999999)]
    public decimal QuantityChange { get; set; }

    [MaxLength(500)]
    public string Reason { get; set; } = string.Empty;
}

public sealed class ReviewInventoryAdjustmentRequest
{
    [MaxLength(500)]
    public string Notes { get; set; } = string.Empty;
}

public sealed class InventoryAdjustmentRequestDto
{
    public int Id { get; set; }
    public int ProductId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public string Sku { get; set; } = string.Empty;
    public string RequestType { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public decimal QuantityChange { get; set; }
    public decimal PreviousQuantity { get; set; }
    public decimal RequestedQuantity { get; set; }
    public string RequestedByName { get; set; } = string.Empty;
    public string Reason { get; set; } = string.Empty;
    public string ReviewedByName { get; set; } = string.Empty;
    public string ReviewNotes { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; }
    public DateTime? ReviewedAtUtc { get; set; }
}
