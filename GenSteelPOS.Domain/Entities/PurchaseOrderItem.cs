using GenSteelPOS.Domain.Common;

namespace GenSteelPOS.Domain.Entities;

public sealed class PurchaseOrderItem : BaseEntity
{
    public int PurchaseOrderId { get; set; }
    public int ProductId { get; set; }
    public decimal Quantity { get; set; }
    public decimal UnitCost { get; set; }
    public decimal LineTotal { get; set; }

    public PurchaseOrder? PurchaseOrder { get; set; }
    public Product? Product { get; set; }
}
