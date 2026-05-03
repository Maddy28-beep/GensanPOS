using GenSteelPOS.Domain.Common;
using GenSteelPOS.Domain.Enums;

namespace GenSteelPOS.Domain.Entities;

public sealed class Payment : BaseEntity
{
    public int SaleId { get; set; }
    public PaymentMethod PaymentMethod { get; set; }
    public decimal Amount { get; set; }
    public string ReferenceNumber { get; set; } = string.Empty;
    public string BankName { get; set; } = string.Empty;
    public string BankBranch { get; set; } = string.Empty;
    public string CheckNumber { get; set; } = string.Empty;
    public DateTime? CheckDate { get; set; }
    public int? DueDays { get; set; }
    public string Details { get; set; } = string.Empty;

    public Sale? Sale { get; set; }
}
