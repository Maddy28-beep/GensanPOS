using GenSteelPOS.Domain.Common;
using GenSteelPOS.Domain.Enums;

namespace GenSteelPOS.Domain.Entities;

public sealed class InventoryAdjustmentRequest : BaseEntity
{
    public int ProductId { get; set; }
    public InventoryAdjustmentRequestType RequestType { get; set; }
    public SaleActionRequestStatus Status { get; set; } = SaleActionRequestStatus.Pending;
    public decimal QuantityChange { get; set; }
    public decimal PreviousQuantity { get; set; }
    public decimal RequestedQuantity { get; set; }
    public int RequestedByUserId { get; set; }
    public string Reason { get; set; } = string.Empty;
    public int? ReviewedByUserId { get; set; }
    public string ReviewNotes { get; set; } = string.Empty;
    public DateTime? ReviewedAtUtc { get; set; }

    public Product? Product { get; set; }
    public User? RequestedByUser { get; set; }
    public User? ReviewedByUser { get; set; }
}
