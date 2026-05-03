using GenSteelPOS.Domain.Common;
using GenSteelPOS.Domain.Enums;

namespace GenSteelPOS.Domain.Entities;

public sealed class StockInRecord : BaseEntity
{
    public string ReferenceNumber { get; set; } = string.Empty;
    public string ContainerNumber { get; set; } = string.Empty;
    public string StockNumber { get; set; } = string.Empty;
    public string ProductReferenceNumber { get; set; } = string.Empty;
    public int SupplierId { get; set; }
    public int ReceivedByUserId { get; set; }
    public int? ReviewedByUserId { get; set; }
    public DateTime ReceivedDateUtc { get; set; } = DateTime.UtcNow;
    public DateTime? ReviewedAtUtc { get; set; }
    public StockInStatus Status { get; set; } = StockInStatus.Pending;
    public string Remarks { get; set; } = string.Empty;
    public string ReviewNotes { get; set; } = string.Empty;

    public Supplier? Supplier { get; set; }
    public User? ReceivedByUser { get; set; }
    public User? ReviewedByUser { get; set; }
    public ICollection<PurchaseOrder> PurchaseOrders { get; set; } = new List<PurchaseOrder>();
    public ICollection<StockInItem> Items { get; set; } = new List<StockInItem>();
}
