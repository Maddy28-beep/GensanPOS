using GenSteelPOS.Application.Common.Exceptions;
using GenSteelPOS.Application.Common.Interfaces;
using GenSteelPOS.Application.DTOs;
using GenSteelPOS.Application.Services;
using GenSteelPOS.Domain.Entities;
using GenSteelPOS.Domain.Enums;

namespace GenSteelPOS.Infrastructure.Services;

public sealed class InventoryService(
    IInventoryRepository inventoryRepository,
    IProductRepository productRepository,
    IStockMovementRepository stockMovementRepository,
    ICurrentUserContext currentUserContext,
    IUnitOfWork unitOfWork,
    IAuditLogService auditLogService) : IInventoryService
{
    public async Task<InventoryListResponseDto> GetAllAsync(InventoryQueryRequest request, CancellationToken cancellationToken = default)
    {
        var normalized = new InventoryQueryRequest
        {
            Page = request.Page < 1 ? 1 : request.Page,
            PageSize = request.PageSize is 10 or 25 or 50 ? request.PageSize : 25,
            Search = request.Search,
            Category = request.Category,
            Status = request.Status,
            Location = request.Location,
            SortBy = string.IsNullOrWhiteSpace(request.SortBy) ? "productName" : request.SortBy,
            SortOrder = string.Equals(request.SortOrder, "desc", StringComparison.OrdinalIgnoreCase) ? "desc" : "asc",
        };

        var (items, totalCount) = await inventoryRepository.SearchAsync(normalized, cancellationToken);
        var summary = await inventoryRepository.GetSummaryAsync(normalized, cancellationToken);
        var categories = await inventoryRepository.GetAvailableCategoriesAsync(cancellationToken);
        var locations = await inventoryRepository.GetAvailableLocationsAsync(cancellationToken);
        var totalPages = totalCount == 0 ? 1 : (int)Math.Ceiling(totalCount / (double)normalized.PageSize);

        return new InventoryListResponseDto
        {
            Items = items.Select(x => x.ToDto()).ToList(),
            TotalCount = totalCount,
            Page = normalized.Page,
            PageSize = normalized.PageSize,
            TotalPages = totalPages,
            Summary = summary,
            AvailableCategories = categories,
            AvailableLocations = locations,
        };
    }

    public async Task<InventoryDto> AdjustStockAsync(StockAdjustmentRequest request, CancellationToken cancellationToken = default)
    {
        if (request.QuantityChange == 0)
        {
            throw new AppException("Quantity change cannot be zero.");
        }

        if (string.IsNullOrWhiteSpace(request.Remarks))
        {
            throw new AppException("Reason is required for inventory adjustments.");
        }

        var product = await productRepository.GetWithCategoryAndInventoryAsync(request.ProductId, cancellationToken)
            ?? throw new AppException("Product not found.", 404);

        var previous = product.Quantity;
        var updated = previous + request.QuantityChange;

        if (updated < 0)
        {
            throw new AppException("Stock adjustment would result in negative stock.");
        }

        product.Quantity = updated;
        product.UpdatedAtUtc = DateTime.UtcNow;
        productRepository.Update(product);

        if (product.Inventory is not null)
        {
            product.Inventory.QuantityOnHand = updated;
            product.Inventory.UpdatedAtUtc = DateTime.UtcNow;
            inventoryRepository.Update(product.Inventory);
        }

        var remarks = string.IsNullOrWhiteSpace(request.Remarks)
            ? "Stock quantity updated."
            : request.Remarks.Trim();

        await stockMovementRepository.AddAsync(new StockMovement
        {
            ProductId = product.Id,
            MovementType = StockMovementType.StockAdjustment,
            QuantityChanged = request.QuantityChange,
            PreviousQuantity = previous,
            NewQuantity = updated,
            ReferenceNo = $"ADJ-{DateTime.UtcNow:yyyyMMddHHmmss}",
            Remarks = remarks,
            PerformedByUserId = currentUserContext.UserId
        }, cancellationToken);

        await unitOfWork.SaveChangesAsync(cancellationToken);

        await auditLogService.CreateAsync(
            "AdjustStock",
            "Product",
            product.Id.ToString(),
            $"Owner adjusted stock for {product.Name}. Reason: {remarks}",
            $"Stock: {previous:N2}",
            $"Stock: {updated:N2}",
            cancellationToken);

        if (product.Inventory is null)
        {
            product.Inventory = new Inventory { ProductId = product.Id, Product = product, QuantityOnHand = product.Quantity };
        }

        return product.Inventory.ToDto();
    }
}
