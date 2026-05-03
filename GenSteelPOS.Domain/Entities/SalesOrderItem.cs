using GenSteelPOS.Domain.Common;

namespace GenSteelPOS.Domain.Entities;

public sealed class SalesOrderItem : BaseEntity
{
    public int SalesOrderId { get; set; }
    public int ProductId { get; set; }
    public decimal Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal LineTotal { get; set; }

    public SalesOrder? SalesOrder { get; set; }
    public Product? Product { get; set; }
}
