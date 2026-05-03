using GenSteelPOS.Domain.Common;
using GenSteelPOS.Domain.Enums;

namespace GenSteelPOS.Domain.Entities;

public sealed class StockMovement : BaseEntity
{
    public int ProductId { get; set; }
    public StockMovementType MovementType { get; set; }
    public decimal QuantityChanged { get; set; }
    public decimal PreviousQuantity { get; set; }
    public decimal NewQuantity { get; set; }
    public string ReferenceNo { get; set; } = string.Empty;
    public string Remarks { get; set; } = string.Empty;
    public int? PerformedByUserId { get; set; }

    public Product? Product { get; set; }
    public User? PerformedByUser { get; set; }
}
