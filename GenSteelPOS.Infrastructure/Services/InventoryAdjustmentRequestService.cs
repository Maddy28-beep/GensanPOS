using GenSteelPOS.Application.Common.Exceptions;
using GenSteelPOS.Application.Common.Interfaces;
using GenSteelPOS.Application.DTOs;
using GenSteelPOS.Application.Services;
using GenSteelPOS.Domain.Constants;
using GenSteelPOS.Domain.Entities;
using GenSteelPOS.Domain.Enums;
using GenSteelPOS.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GenSteelPOS.Infrastructure.Services;

public sealed class InventoryAdjustmentRequestService(
    AppDbContext context,
    ICurrentUserContext currentUserContext,
    IAuditLogService auditLogService) : IInventoryAdjustmentRequestService
{
    public async Task<List<InventoryAdjustmentRequestDto>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        var query = context.InventoryAdjustmentRequests
            .Include(x => x.Product)
            .Include(x => x.RequestedByUser)
            .Include(x => x.ReviewedByUser)
            .OrderByDescending(x => x.CreatedAtUtc)
            .AsQueryable();

        if (currentUserContext.Role != AppRoles.SuperAdmin)
        {
            var userId = currentUserContext.UserId ?? throw new AppException("Current user is not available.", 401);
            query = query.Where(x => x.RequestedByUserId == userId);
        }

        var requests = await query.ToListAsync(cancellationToken);
        return requests.Select(ToDto).ToList();
    }

    public async Task<InventoryAdjustmentRequestDto> CreateAsync(CreateInventoryAdjustmentRequest request, CancellationToken cancellationToken = default)
    {
        var userId = currentUserContext.UserId ?? throw new AppException("Current user is not available.", 401);

        if (currentUserContext.Role == AppRoles.SuperAdmin)
        {
            throw new AppException("Owner can update stock directly from Inventory. Approval requests are for cashier users.");
        }

        if (string.IsNullOrWhiteSpace(request.Reason))
        {
            throw new AppException("Reason is required for inventory adjustment requests.");
        }

        if (request.QuantityChange == 0)
        {
            throw new AppException("Quantity change cannot be zero.");
        }

        if (!Enum.TryParse<InventoryAdjustmentRequestType>(request.RequestType, true, out var requestType))
        {
            throw new AppException("Invalid inventory request type.");
        }

        var product = await context.Products.FirstOrDefaultAsync(x => x.Id == request.ProductId, cancellationToken)
            ?? throw new AppException("Product not found.", 404);

        var requestedQuantity = product.Quantity + request.QuantityChange;
        if (requestedQuantity < 0)
        {
            throw new AppException("Requested adjustment would result in negative stock.");
        }

        var hasPending = await context.InventoryAdjustmentRequests.AnyAsync(
            x => x.ProductId == product.Id && x.Status == SaleActionRequestStatus.Pending,
            cancellationToken);
        if (hasPending)
        {
            throw new AppException("This product already has a pending inventory adjustment request.");
        }

        var entity = new InventoryAdjustmentRequest
        {
            ProductId = product.Id,
            RequestType = requestType,
            QuantityChange = request.QuantityChange,
            PreviousQuantity = product.Quantity,
            RequestedQuantity = requestedQuantity,
            RequestedByUserId = userId,
            Reason = request.Reason.Trim(),
            Status = SaleActionRequestStatus.Pending
        };

        await context.InventoryAdjustmentRequests.AddAsync(entity, cancellationToken);
        await context.SaveChangesAsync(cancellationToken);

        await auditLogService.CreateAsync(
            "CreateInventoryAdjustmentRequest",
            "InventoryAdjustmentRequest",
            entity.Id.ToString(),
            $"{requestType} request for {product.Name}: {request.QuantityChange}.",
            $"Current stock: {entity.PreviousQuantity:N2}",
            $"Requested stock: {entity.RequestedQuantity:N2}",
            cancellationToken);

        return await LoadDtoAsync(entity.Id, cancellationToken);
    }

    public async Task<InventoryAdjustmentRequestDto> ApproveAsync(int id, ReviewInventoryAdjustmentRequest request, CancellationToken cancellationToken = default)
    {
        EnsureOwner();
        var entity = await LoadEntityAsync(id, cancellationToken);

        if (entity.Status != SaleActionRequestStatus.Pending)
        {
            throw new AppException("This inventory request was already reviewed.");
        }

        var product = entity.Product ?? throw new AppException("Product not found.", 404);
        var newQuantity = product.Quantity + entity.QuantityChange;
        if (newQuantity < 0)
        {
            throw new AppException("Approval would result in negative stock.");
        }

        product.Quantity = newQuantity;
        product.UpdatedAtUtc = DateTime.UtcNow;

        if (product.Inventory is not null)
        {
            product.Inventory.QuantityOnHand = newQuantity;
            product.Inventory.UpdatedAtUtc = DateTime.UtcNow;
        }
        else
        {
            await context.Inventory.AddAsync(new Inventory
            {
                ProductId = product.Id,
                QuantityOnHand = newQuantity
            }, cancellationToken);
        }

        await context.StockMovements.AddAsync(new StockMovement
        {
            ProductId = product.Id,
            MovementType = StockMovementType.StockAdjustment,
            QuantityChanged = entity.QuantityChange,
            PreviousQuantity = product.Quantity - entity.QuantityChange,
            NewQuantity = newQuantity,
            ReferenceNo = $"INV-REQ-{entity.Id}",
            Remarks = $"Approved inventory adjustment request. Reason: {entity.Reason}",
            PerformedByUserId = currentUserContext.UserId
        }, cancellationToken);

        entity.Status = SaleActionRequestStatus.Approved;
        entity.ReviewedByUserId = currentUserContext.UserId;
        entity.ReviewedAtUtc = DateTime.UtcNow;
        entity.ReviewNotes = request.Notes.Trim();

        await context.SaveChangesAsync(cancellationToken);
        await auditLogService.CreateAsync(
            "ApproveInventoryAdjustmentRequest",
            "InventoryAdjustmentRequest",
            entity.Id.ToString(),
            $"Approved {entity.RequestType} request for {product.Name}. Stock changed from {entity.PreviousQuantity} to {newQuantity}.",
            $"Stock: {entity.PreviousQuantity:N2}",
            $"Stock: {newQuantity:N2}",
            cancellationToken);

        return await LoadDtoAsync(id, cancellationToken);
    }

    public async Task<InventoryAdjustmentRequestDto> RejectAsync(int id, ReviewInventoryAdjustmentRequest request, CancellationToken cancellationToken = default)
    {
        EnsureOwner();
        var entity = await LoadEntityAsync(id, cancellationToken);

        if (entity.Status != SaleActionRequestStatus.Pending)
        {
            throw new AppException("This inventory request was already reviewed.");
        }

        entity.Status = SaleActionRequestStatus.Rejected;
        entity.ReviewedByUserId = currentUserContext.UserId;
        entity.ReviewedAtUtc = DateTime.UtcNow;
        entity.ReviewNotes = request.Notes.Trim();

        await context.SaveChangesAsync(cancellationToken);
        await auditLogService.CreateAsync(
            "RejectInventoryAdjustmentRequest",
            "InventoryAdjustmentRequest",
            entity.Id.ToString(),
            $"Rejected {entity.RequestType} request for {entity.Product?.Name ?? "product"}.",
            $"Current stock: {entity.PreviousQuantity:N2}",
            "No stock change",
            cancellationToken);

        return await LoadDtoAsync(id, cancellationToken);
    }

    private void EnsureOwner()
    {
        if (currentUserContext.Role != AppRoles.SuperAdmin)
        {
            throw new AppException("Only owner can approve or reject inventory requests.", 403);
        }
    }

    private async Task<InventoryAdjustmentRequest> LoadEntityAsync(int id, CancellationToken cancellationToken) =>
        await context.InventoryAdjustmentRequests
            .Include(x => x.Product).ThenInclude(x => x!.Inventory)
            .Include(x => x.RequestedByUser)
            .Include(x => x.ReviewedByUser)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken)
        ?? throw new AppException("Inventory request not found.", 404);

    private async Task<InventoryAdjustmentRequestDto> LoadDtoAsync(int id, CancellationToken cancellationToken)
    {
        var entity = await context.InventoryAdjustmentRequests
            .Include(x => x.Product)
            .Include(x => x.RequestedByUser)
            .Include(x => x.ReviewedByUser)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken)
            ?? throw new AppException("Inventory request not found.", 404);

        return ToDto(entity);
    }

    private static InventoryAdjustmentRequestDto ToDto(InventoryAdjustmentRequest entity) => new()
    {
        Id = entity.Id,
        ProductId = entity.ProductId,
        ProductName = entity.Product?.Name ?? "Deleted product",
        Sku = entity.Product?.Sku ?? string.Empty,
        RequestType = entity.RequestType.ToString(),
        Status = entity.Status.ToString(),
        QuantityChange = entity.QuantityChange,
        PreviousQuantity = entity.PreviousQuantity,
        RequestedQuantity = entity.RequestedQuantity,
        RequestedByName = entity.RequestedByUser?.FullName ?? "Unknown user",
        Reason = entity.Reason,
        ReviewedByName = entity.ReviewedByUser?.FullName ?? string.Empty,
        ReviewNotes = entity.ReviewNotes,
        CreatedAtUtc = entity.CreatedAtUtc,
        ReviewedAtUtc = entity.ReviewedAtUtc
    };
}
