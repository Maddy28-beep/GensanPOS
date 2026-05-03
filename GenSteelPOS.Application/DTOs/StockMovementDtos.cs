namespace GenSteelPOS.Application.DTOs;

public sealed class StockMovementDto
{
    public int Id { get; set; }
    public int ProductId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public string Sku { get; set; } = string.Empty;
    public string MovementType { get; set; } = string.Empty;
    public decimal QuantityChanged { get; set; }
    public decimal PreviousQuantity { get; set; }
    public decimal NewQuantity { get; set; }
    public string ReferenceNo { get; set; } = string.Empty;
    public string Remarks { get; set; } = string.Empty;
    public string PerformedByName { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; }
}
