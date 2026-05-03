using GenSteelPOS.Domain.Common;

namespace GenSteelPOS.Domain.Entities;

public sealed class User : BaseEntity
{
    public string FullName { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public int RoleId { get; set; }

    public Role? Role { get; set; }
    public ICollection<Sale> Sales { get; set; } = new List<Sale>();
    public ICollection<SalesOrder> SalesOrders { get; set; } = new List<SalesOrder>();
    public ICollection<PurchaseOrder> PurchaseOrders { get; set; } = new List<PurchaseOrder>();
    public ICollection<StockInRecord> StockInRecords { get; set; } = new List<StockInRecord>();
    public ICollection<AuditLog> AuditLogs { get; set; } = new List<AuditLog>();
}
