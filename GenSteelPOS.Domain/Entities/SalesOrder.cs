using GenSteelPOS.Domain.Common;
using GenSteelPOS.Domain.Enums;

namespace GenSteelPOS.Domain.Entities;

public sealed class SalesOrder : BaseEntity
{
    public string OrderNumber { get; set; } = string.Empty;
    public string CustomerName { get; set; } = string.Empty;
    public string CustomerContact { get; set; } = string.Empty;
    public string CustomerAddress { get; set; } = string.Empty;
    public string Remarks { get; set; } = string.Empty;
    public int CreatedByUserId { get; set; }
    public decimal Subtotal { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal TaxAmount { get; set; }
    public decimal TotalAmount { get; set; }
    public SalesOrderStatus Status { get; set; } = SalesOrderStatus.Pending;
    public int? ConvertedSaleId { get; set; }

    public User? CreatedByUser { get; set; }
    public Sale? ConvertedSale { get; set; }
    public ICollection<SalesOrderItem> Items { get; set; } = new List<SalesOrderItem>();
}
