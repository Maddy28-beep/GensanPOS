using System.ComponentModel.DataAnnotations;

namespace GenSteelPOS.Application.DTOs;

public sealed class CreateCategoryRequest
{
    [Required, MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(250)]
    public string Description { get; set; } = string.Empty;
}

public sealed class UpdateCategoryRequest
{
    [Required, MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(250)]
    public string Description { get; set; } = string.Empty;

    public bool IsActive { get; set; } = true;
}

public sealed class CreateProductRequest
{
    [Required, MaxLength(50)]
    public string Sku { get; set; } = string.Empty;

    [Required, MaxLength(150)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(500)]
    public string Description { get; set; } = string.Empty;

    [Range(0.01, 999999999)]
    public decimal Price { get; set; }

    [Range(0, 999999999)]
    public decimal CostPrice { get; set; }

    [Required, MaxLength(20)]
    public string Unit { get; set; } = string.Empty;

    [Range(1, int.MaxValue)]
    public int CategoryId { get; set; }

    [Range(0, 999999999)]
    public decimal InitialQuantity { get; set; }

    [Range(0, 999999999)]
    public decimal ReorderLevel { get; set; }

    [MaxLength(100)]
    public string Location { get; set; } = string.Empty;
}

public sealed class UpdateProductRequest
{
    [Required, MaxLength(150)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(500)]
    public string Description { get; set; } = string.Empty;

    [Range(0.01, 999999999)]
    public decimal Price { get; set; }

    [Range(0, 999999999)]
    public decimal CostPrice { get; set; }

    [Required, MaxLength(20)]
    public string Unit { get; set; } = string.Empty;

    [Range(1, int.MaxValue)]
    public int CategoryId { get; set; }

    public bool IsActive { get; set; }
}

public sealed class ProductDto
{
    public int Id { get; set; }
    public string Sku { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public decimal CostPrice { get; set; }
    public decimal Price { get; set; }
    public string Unit { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public string CategoryName { get; set; } = string.Empty;
    public decimal QuantityOnHand { get; set; }
    public decimal ReorderLevel { get; set; }
    public string Location { get; set; } = string.Empty;
}

public sealed class CategoryDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public bool IsActive { get; set; }
}

public sealed class CreateProductUnitRequest
{
    [Required, MaxLength(20)]
    public string Name { get; set; } = string.Empty;
}

public sealed class ProductUnitDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public bool IsActive { get; set; }
}
