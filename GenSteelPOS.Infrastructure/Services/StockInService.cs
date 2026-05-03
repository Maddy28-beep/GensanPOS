using GenSteelPOS.Application.Common.Exceptions;
using GenSteelPOS.Application.Common.Interfaces;
using GenSteelPOS.Application.DTOs;
using GenSteelPOS.Application.Services;
using GenSteelPOS.Domain.Constants;
using GenSteelPOS.Domain.Entities;
using GenSteelPOS.Domain.Enums;

namespace GenSteelPOS.Infrastructure.Services;

public sealed class StockInService(
    ISupplierRepository supplierRepository,
    IProductRepository productRepository,
    IInventoryRepository inventoryRepository,
    IStockInRecordRepository stockInRecordRepository,
    IStockMovementRepository stockMovementRepository,
    ICurrentUserContext currentUserContext,
    IUnitOfWork unitOfWork,
    IAuditLogService auditLogService) : IStockInService
{
    public async Task<List<StockInRecordDto>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        var records = await stockInRecordRepository.GetAllAsync(cancellationToken);
        if (currentUserContext.Role == AppRoles.SuperAdmin)
        {
            return records.Select(x => x.ToDto()).ToList();
        }

        var userId = currentUserContext.UserId ?? throw new AppException("Current user is not available.", 401);
        return records.Where(x => x.ReceivedByUserId == userId).Select(x => x.ToDto()).ToList();
    }

    public async Task<StockInRecordDto> CreateAsync(CreateStockInRequest request, CancellationToken cancellationToken = default) =>
        await unitOfWork.ExecuteInTransactionAsync(async ct =>
    {
        var supplier = await supplierRepository.GetByIdAsync(request.SupplierId, ct)
            ?? throw new AppException("Supplier not found.", 404);
        var userId = currentUserContext.UserId ?? throw new AppException("Current user is not available.", 401);

        if (request.Items.Count == 0)
        {
            throw new AppException("Add at least one delivered product.");
        }

        var referenceNumber = string.IsNullOrWhiteSpace(request.ReferenceNumber)
            ? $"RR-{DateTime.UtcNow:yyyyMMddHHmmss}"
            : request.ReferenceNumber.Trim();

        var stockInRecord = new StockInRecord
        {
            SupplierId = request.SupplierId,
            Supplier = supplier,
            ReceivedByUserId = userId,
            ReferenceNumber = referenceNumber,
            ContainerNumber = request.ContainerNumber.Trim(),
            StockNumber = request.StockNumber.Trim(),
            ProductReferenceNumber = request.ProductReferenceNumber.Trim(),
            ReceivedDateUtc = request.ReceivedDateUtc ?? DateTime.UtcNow,
            Remarks = request.Remarks.Trim(),
            Status = StockInStatus.Pending
        };

        foreach (var item in request.Items)
        {
            var product = await productRepository.GetByIdAsync(item.ProductId, ct)
                ?? throw new AppException($"Product {item.ProductId} not found.", 404);

            stockInRecord.Items.Add(new StockInItem
            {
                ProductId = item.ProductId,
                Product = product,
                Quantity = item.Quantity,
                UnitCost = item.UnitCost
            });
        }

        await stockInRecordRepository.AddAsync(stockInRecord, ct);
        await unitOfWork.SaveChangesAsync(ct);

        await auditLogService.CreateAsync(
            "CreateStockInRequest",
            "StockInRecord",
            stockInRecord.Id.ToString(),
            $"Created receiving request {stockInRecord.ReferenceNumber} from supplier {supplier.Name}. Waiting for owner approval.",
            ct);

        return (await stockInRecordRepository.GetWithDetailsAsync(stockInRecord.Id, ct)
            ?? throw new AppException("Receiving request could not be loaded after save.", 500)).ToDto();
    }, cancellationToken);

    public async Task<StockInRecordDto> ApproveAsync(int id, ReviewStockInRequest request, CancellationToken cancellationToken = default)
    {
        EnsureOwner();

        return await unitOfWork.ExecuteInTransactionAsync(async ct =>
        {
            var record = await stockInRecordRepository.GetWithDetailsAsync(id, ct)
                ?? throw new AppException("Receiving request not found.", 404);

            if (record.Status != StockInStatus.Pending)
            {
                throw new AppException("Only pending receiving requests can be approved.");
            }

            var reviewerId = currentUserContext.UserId ?? throw new AppException("Current user is not available.", 401);

            foreach (var item in record.Items)
            {
                var product = await productRepository.GetWithCategoryAndInventoryAsync(item.ProductId, ct)
                    ?? throw new AppException($"Product {item.ProductId} not found.", 404);
                var inventory = product.Inventory ?? await inventoryRepository.GetByProductIdAsync(item.ProductId, ct)
                    ?? throw new AppException($"Inventory for product {product.Name} not found.", 404);

                var previous = product.Quantity;
                var updated = previous + item.Quantity;

                product.Quantity = updated;
                product.UpdatedAtUtc = DateTime.UtcNow;
                productRepository.Update(product);

                inventory.QuantityOnHand = updated;
                inventory.UpdatedAtUtc = DateTime.UtcNow;
                inventoryRepository.Update(inventory);

                await stockMovementRepository.AddAsync(new StockMovement
                {
                    ProductId = item.ProductId,
                    MovementType = StockMovementType.StockIn,
                    QuantityChanged = item.Quantity,
                    PreviousQuantity = previous,
                    NewQuantity = updated,
                    ReferenceNo = record.ReferenceNumber,
                    Remarks = $"Approved receiving report {record.ReferenceNumber}. {record.Remarks}",
                    PerformedByUserId = reviewerId
                }, ct);
            }

            record.Status = StockInStatus.Approved;
            record.ReviewNotes = request.Notes.Trim();
            record.ReviewedByUserId = reviewerId;
            record.ReviewedAtUtc = DateTime.UtcNow;
            record.UpdatedAtUtc = DateTime.UtcNow;
            stockInRecordRepository.Update(record);

            await unitOfWork.SaveChangesAsync(ct);
            await auditLogService.CreateAsync(
                "ApproveStockInRequest",
                "StockInRecord",
                record.Id.ToString(),
                $"Approved receiving report {record.ReferenceNumber}. Inventory was updated.",
                "Status: Pending; inventory unchanged",
                $"Status: Approved; supplier: {record.Supplier?.Name}; inventory updated",
                ct);

            return (await stockInRecordRepository.GetWithDetailsAsync(id, ct)
                ?? throw new AppException("Receiving request not found after approval.", 404)).ToDto();
        }, cancellationToken);
    }

    public async Task<StockInRecordDto> RejectAsync(int id, ReviewStockInRequest request, CancellationToken cancellationToken = default)
    {
        EnsureOwner();

        var record = await stockInRecordRepository.GetWithDetailsAsync(id, cancellationToken)
            ?? throw new AppException("Receiving request not found.", 404);

        if (record.Status != StockInStatus.Pending)
        {
            throw new AppException("Only pending receiving requests can be rejected.");
        }

        record.Status = StockInStatus.Rejected;
        record.ReviewNotes = request.Notes.Trim();
        record.ReviewedByUserId = currentUserContext.UserId;
        record.ReviewedAtUtc = DateTime.UtcNow;
        record.UpdatedAtUtc = DateTime.UtcNow;
        stockInRecordRepository.Update(record);

        await unitOfWork.SaveChangesAsync(cancellationToken);
        await auditLogService.CreateAsync(
            "RejectStockInRequest",
            "StockInRecord",
            record.Id.ToString(),
            $"Rejected receiving request {record.ReferenceNumber}. Inventory was not changed.",
            cancellationToken);

        return (await stockInRecordRepository.GetWithDetailsAsync(id, cancellationToken)
            ?? throw new AppException("Receiving request not found after rejection.", 404)).ToDto();
    }

    private void EnsureOwner()
    {
        if (currentUserContext.Role != AppRoles.SuperAdmin)
        {
            throw new AppException("Only the owner can approve or reject receiving requests.", 403);
        }
    }
}
