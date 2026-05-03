using System.ComponentModel.DataAnnotations;

namespace GenSteelPOS.Application.DTOs;

public sealed class CreateSupplierRequest
{
    [Required, MaxLength(150)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(100)]
    public string ContactPerson { get; set; } = string.Empty;

    [MaxLength(50)]
    public string ContactNumber { get; set; } = string.Empty;

    [EmailAddress, MaxLength(150)]
    public string Email { get; set; } = string.Empty;

    [MaxLength(250)]
    public string Address { get; set; } = string.Empty;
}

public sealed class SupplierDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string ContactPerson { get; set; } = string.Empty;
    public string ContactNumber { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public bool IsActive { get; set; }
}
