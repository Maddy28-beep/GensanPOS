using GenSteelPOS.Domain.Common;

namespace GenSteelPOS.Domain.Entities;

public sealed class SaleItem : BaseEntity
{
    public int SaleId { get; set; }
    public int ProductId { get; set; }
    public string ProductNameSnapshot { get; set; } = string.Empty;
    public string SkuSnapshot { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal CostPriceSnapshot { get; set; }
    public decimal LineTotal { get; set; }

    public Sale? Sale { get; set; }
    public Product? Product { get; set; }
    public ICollection<ReturnItem> ReturnItems { get; set; } = new List<ReturnItem>();
}
