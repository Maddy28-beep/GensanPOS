using GenSteelPOS.Domain.Common;

namespace GenSteelPOS.Domain.Entities;

public sealed class ProductUnit : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
}
