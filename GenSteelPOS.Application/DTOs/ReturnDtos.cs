using System.ComponentModel.DataAnnotations;
using GenSteelPOS.Domain.Enums;

namespace GenSteelPOS.Application.DTOs;

public sealed class CreateReturnRequest
{
    [Range(1, int.MaxValue)]
    public int SaleId { get; set; }

    [MaxLength(250)]
    public string Remarks { get; set; } = string.Empty;

    [MinLength(1)]
    public List<CreateReturnItemRequest> Items { get; set; } = new();
}

public sealed class CreateReturnItemRequest
{
    [Range(1, int.MaxValue)]
    public int SaleItemId { get; set; }

    [Range(0.01, 999999999)]
    public decimal Quantity { get; set; }

    [Required]
    public ReturnItemCondition Condition { get; set; }

    [MaxLength(250)]
    public string Remarks { get; set; } = string.Empty;
}

public sealed class ReturnDto
{
    public int Id { get; set; }
    public string ReturnNumber { get; set; } = string.Empty;
    public int SaleId { get; set; }
    public string SaleNumber { get; set; } = string.Empty;
    public string ProcessedByName { get; set; } = string.Empty;
    public decimal TotalReturnAmount { get; set; }
    public string Remarks { get; set; } = string.Empty;
    public DateTime CreatedAtUtc { get; set; }
    public List<ReturnItemDto> Items { get; set; } = new();
}

public sealed class ReturnItemDto
{
    public int SaleItemId { get; set; }
    public int ProductId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal ReturnAmount { get; set; }
    public string Condition { get; set; } = string.Empty;
    public string Remarks { get; set; } = string.Empty;
}
