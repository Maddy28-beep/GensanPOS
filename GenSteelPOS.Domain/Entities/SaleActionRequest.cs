using GenSteelPOS.Domain.Common;
using GenSteelPOS.Domain.Enums;

namespace GenSteelPOS.Domain.Entities;

public sealed class SaleActionRequest : BaseEntity
{
    public int SaleId { get; set; }
    public SaleActionRequestType RequestType { get; set; }
    public SaleActionRequestStatus Status { get; set; } = SaleActionRequestStatus.Pending;
    public int RequestedByUserId { get; set; }
    public string RequestReason { get; set; } = string.Empty;
    public string RequestedReturnItemsJson { get; set; } = string.Empty;
    public int? ReviewedByUserId { get; set; }
    public string ReviewNotes { get; set; } = string.Empty;
    public DateTime? ReviewedAtUtc { get; set; }

    public Sale? Sale { get; set; }
    public User? RequestedByUser { get; set; }
    public User? ReviewedByUser { get; set; }
}
