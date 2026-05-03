using GenSteelPOS.Domain.Common;
using GenSteelPOS.Domain.Enums;

namespace GenSteelPOS.Domain.Entities;

public sealed class Sale : BaseEntity
{
    public string SaleNumber { get; set; } = string.Empty;
    public int CashierId { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public string CustomerAddress { get; set; } = string.Empty;
    public string CustomerTin { get; set; } = string.Empty;
    public string Remarks { get; set; } = string.Empty;
    public string PoNumber { get; set; } = string.Empty;
    public string Terms { get; set; } = string.Empty;
    public decimal Subtotal { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal TaxAmount { get; set; }
    public decimal TotalAmount { get; set; }
    public decimal AmountPaid { get; set; }
    public decimal ChangeDue { get; set; }
    public SaleStatus Status { get; set; } = SaleStatus.Completed;

    public User? Cashier { get; set; }
    public ICollection<SalesOrder> SalesOrders { get; set; } = new List<SalesOrder>();
    public ICollection<SaleItem> SaleItems { get; set; } = new List<SaleItem>();
    public ICollection<Payment> Payments { get; set; } = new List<Payment>();
    public ICollection<SaleActionRequest> ActionRequests { get; set; } = new List<SaleActionRequest>();
    public ICollection<ReturnRecord> Returns { get; set; } = new List<ReturnRecord>();
}
