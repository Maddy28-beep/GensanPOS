using GenSteelPOS.Domain.Common;

namespace GenSteelPOS.Domain.Entities;

public sealed class StockInItem : BaseEntity
{
    public int StockInRecordId { get; set; }
    public int ProductId { get; set; }
    public decimal Quantity { get; set; }
    public decimal UnitCost { get; set; }

    public StockInRecord? StockInRecord { get; set; }
    public Product? Product { get; set; }
}
