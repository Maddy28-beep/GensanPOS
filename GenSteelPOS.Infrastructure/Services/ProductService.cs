using GenSteelPOS.Application.Common.Exceptions;
using GenSteelPOS.Application.Common.Interfaces;
using GenSteelPOS.Application.DTOs;
using GenSteelPOS.Application.Services;
using GenSteelPOS.Domain.Constants;
using GenSteelPOS.Domain.Entities;
using GenSteelPOS.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GenSteelPOS.Infrastructure.Services;

public sealed class ProductService(
    ICategoryRepository categoryRepository,
    IProductRepository productRepository,
    AppDbContext context,
    IInventoryRepository inventoryRepository,
    ICurrentUserContext currentUserContext,
    IUnitOfWork unitOfWork,
    IAuditLogService auditLogService) : IProductService
{
    public async Task<List<CategoryDto>> GetCategoriesAsync(CancellationToken cancellationToken = default) =>
        (await categoryRepository.GetAllAsync(cancellationToken)).Select(x => x.ToDto()).ToList();

    public async Task<List<ProductUnitDto>> GetUnitsAsync(CancellationToken cancellationToken = default)
    {
        var defaultUnits = new[] { "pcs", "sheet", "plate", "pipe", "tube", "bar", "kg", "meter", "roll", "set", "box" };
        var existingUnits = await context.ProductUnits
            .OrderBy(x => x.Name)
            .ToListAsync(cancellationToken);

        if (existingUnits.Count == 0)
        {
            await context.ProductUnits.AddRangeAsync(
                defaultUnits.Select(unit => new ProductUnit { Name = unit }),
                cancellationToken);
            await context.SaveChangesAsync(cancellationToken);
            existingUnits = await context.ProductUnits.OrderBy(x => x.Name).ToListAsync(cancellationToken);
        }

        return existingUnits.Select(x => x.ToDto()).ToList();
    }

    public async Task<ProductUnitDto> CreateUnitAsync(CreateProductUnitRequest request, CancellationToken cancellationToken = default)
    {
        var unitName = request.Name.Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(unitName))
        {
            throw new AppException("Unit name is required.");
        }

        var existing = await context.ProductUnits.FirstOrDefaultAsync(x => x.Name == unitName, cancellationToken);
        if (existing is not null)
        {
            return existing.ToDto();
        }

        var entity = new ProductUnit { Name = unitName };
        await context.ProductUnits.AddAsync(entity, cancellationToken);
        await context.SaveChangesAsync(cancellationToken);

        await auditLogService.CreateAsync("Create", "ProductUnit", entity.Id.ToString(), $"Added product unit {entity.Name}.", cancellationToken);
        return entity.ToDto();
    }

    public async Task<CategoryDto> CreateCategoryAsync(CreateCategoryRequest request, CancellationToken cancellationToken = default)
    {
        if (await categoryRepository.ExistsByNameAsync(request.Name, cancellationToken))
        {
            throw new AppException("Category name already exists.");
        }

        var entity = new Category
        {
            Name = request.Name,
            Description = request.Description
        };

        await categoryRepository.AddAsync(entity, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        await auditLogService.CreateAsync("Create", "Category", entity.Id.ToString(), $"Created category {entity.Name}.", cancellationToken);
        return entity.ToDto();
    }

    public async Task<CategoryDto> UpdateCategoryAsync(int id, UpdateCategoryRequest request, CancellationToken cancellationToken = default)
    {
        var category = await categoryRepository.GetByIdAsync(id, cancellationToken)
            ?? throw new AppException("Category not found.", 404);

        if (!string.Equals(category.Name, request.Name, StringComparison.OrdinalIgnoreCase) &&
            await categoryRepository.ExistsByNameAsync(request.Name, cancellationToken))
        {
            throw new AppException("Category name already exists.");
        }

        var oldValue = $"Name: {category.Name}; Description: {category.Description}; Active: {category.IsActive}";
        category.Name = request.Name.Trim();
        category.Description = request.Description.Trim();
        category.IsActive = request.IsActive;
        category.UpdatedAtUtc = DateTime.UtcNow;

        categoryRepository.Update(category);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        var newValue = $"Name: {category.Name}; Description: {category.Description}; Active: {category.IsActive}";
        await auditLogService.CreateAsync(
            "Update",
            "Category",
            category.Id.ToString(),
            $"Updated category {category.Name}.",
            oldValue,
            newValue,
            cancellationToken);
        return category.ToDto();
    }

    public async Task<List<ProductDto>> GetAllAsync(CancellationToken cancellationToken = default) =>
        (await productRepository.GetAllAsync(cancellationToken)).Select(ToVisibleDto).ToList();

    public async Task<List<ProductDto>> GetActiveForPosAsync(CancellationToken cancellationToken = default) =>
        (await productRepository.GetActiveForPosAsync(cancellationToken)).Select(ToVisibleDto).ToList();

    public async Task<ProductDto> CreateAsync(CreateProductRequest request, CancellationToken cancellationToken = default)
    {
        if (await productRepository.ExistsBySkuAsync(request.Sku, cancellationToken))
        {
            throw new AppException("SKU already exists.");
        }

        var category = await categoryRepository.GetByIdAsync(request.CategoryId, cancellationToken)
            ?? throw new AppException("Category not found.", 404);

        var product = new Product
        {
            Sku = request.Sku,
            Name = request.Name,
            Description = request.Description,
            CostPrice = request.CostPrice,
            Price = request.Price,
            Quantity = request.InitialQuantity,
            Unit = request.Unit,
            CategoryId = request.CategoryId,
            Category = category,
            IsActive = true
        };

        await productRepository.AddAsync(product, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        var inventory = new Inventory
        {
            ProductId = product.Id,
            QuantityOnHand = request.InitialQuantity,
            ReorderLevel = request.ReorderLevel,
            Location = request.Location
        };

        await inventoryRepository.AddAsync(inventory, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        product.Inventory = inventory;
        await auditLogService.CreateAsync(
            "Create",
            "Product",
            product.Id.ToString(),
            $"Created product {product.Name} with SKU {product.Sku}.",
            "-",
            $"Price: {product.Price:N2}; Cost: {product.CostPrice:N2}; Quantity: {product.Quantity:N2}",
            cancellationToken);
        return product.ToDto();
    }

    public async Task<ProductDto> UpdateAsync(int id, UpdateProductRequest request, CancellationToken cancellationToken = default)
    {
        var product = await productRepository.GetWithCategoryAndInventoryAsync(id, cancellationToken)
            ?? throw new AppException("Product not found.", 404);
        var category = await categoryRepository.GetByIdAsync(request.CategoryId, cancellationToken)
            ?? throw new AppException("Category not found.", 404);
        var oldValue = $"Name: {product.Name}; Price: {product.Price:N2}; Cost: {product.CostPrice:N2}; Active: {product.IsActive}";

        product.Name = request.Name;
        product.Description = request.Description;
        product.CostPrice = request.CostPrice;
        product.Price = request.Price;
        product.Unit = request.Unit;
        product.CategoryId = request.CategoryId;
        product.Category = category;
        product.IsActive = request.IsActive;
        product.UpdatedAtUtc = DateTime.UtcNow;

        productRepository.Update(product);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        var newValue = $"Name: {product.Name}; Price: {product.Price:N2}; Cost: {product.CostPrice:N2}; Active: {product.IsActive}";
        var detail = oldValue == newValue
            ? $"Updated product {product.Name}."
            : $"Updated product {product.Name}.";
        await auditLogService.CreateAsync("Update", "Product", product.Id.ToString(), detail, oldValue, newValue, cancellationToken);
        return product.ToDto();
    }

    private ProductDto ToVisibleDto(Product product)
    {
        var dto = product.ToDto();
        if (currentUserContext.Role != AppRoles.SuperAdmin)
        {
            dto.CostPrice = 0;
        }

        return dto;
    }
}
