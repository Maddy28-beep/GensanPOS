using GenSteelPOS.Domain.Common;

namespace GenSteelPOS.Domain.Entities;

public sealed class ReturnRecord : BaseEntity
{
    public string ReturnNumber { get; set; } = string.Empty;
    public int SaleId { get; set; }
    public int ProcessedByUserId { get; set; }
    public decimal TotalReturnAmount { get; set; }
    public string Remarks { get; set; } = string.Empty;

    public Sale? Sale { get; set; }
    public User? ProcessedByUser { get; set; }
    public ICollection<ReturnItem> Items { get; set; } = new List<ReturnItem>();
}
