using GenSteelPOS.Domain.Common;
using GenSteelPOS.Domain.Enums;

namespace GenSteelPOS.Domain.Entities;

public sealed class ReturnItem : BaseEntity
{
    public int ReturnRecordId { get; set; }
    public int SaleItemId { get; set; }
    public int ProductId { get; set; }
    public decimal Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal ReturnAmount { get; set; }
    public ReturnItemCondition Condition { get; set; } = ReturnItemCondition.Good;
    public string Remarks { get; set; } = string.Empty;

    public ReturnRecord? ReturnRecord { get; set; }
    public SaleItem? SaleItem { get; set; }
    public Product? Product { get; set; }
}
