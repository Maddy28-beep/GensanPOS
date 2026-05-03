using GenSteelPOS.Domain.Common;
using GenSteelPOS.Domain.Enums;

namespace GenSteelPOS.Domain.Entities;

public sealed class PurchaseOrder : BaseEntity
{
    public string OrderNumber { get; set; } = string.Empty;
    public int SupplierId { get; set; }
    public int CreatedByUserId { get; set; }
    public string Remarks { get; set; } = string.Empty;
    public decimal TotalEstimatedCost { get; set; }
    public PurchaseOrderStatus Status { get; set; } = PurchaseOrderStatus.Pending;
    public int? ReceivedStockInRecordId { get; set; }

    public Supplier? Supplier { get; set; }
    public User? CreatedByUser { get; set; }
    public StockInRecord? ReceivedStockInRecord { get; set; }
    public ICollection<PurchaseOrderItem> Items { get; set; } = new List<PurchaseOrderItem>();
}
