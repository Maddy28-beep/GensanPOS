using GenSteelPOS.Domain.Common;

namespace GenSteelPOS.Domain.Entities;

public sealed class Inventory : BaseEntity
{
    public int ProductId { get; set; }
    public decimal QuantityOnHand { get; set; }
    public decimal ReorderLevel { get; set; }
    public string Location { get; set; } = string.Empty;

    public Product? Product { get; set; }
}
