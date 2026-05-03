using GenSteelPOS.Domain.Common;

namespace GenSteelPOS.Domain.Entities;

public sealed class Supplier : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string ContactPerson { get; set; } = string.Empty;
    public string ContactNumber { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;

    public ICollection<PurchaseOrder> PurchaseOrders { get; set; } = new List<PurchaseOrder>();
    public ICollection<StockInRecord> StockInRecords { get; set; } = new List<StockInRecord>();
}
