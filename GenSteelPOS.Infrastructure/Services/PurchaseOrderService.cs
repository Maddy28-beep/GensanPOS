using GenSteelPOS.Application.Common.Exceptions;
using GenSteelPOS.Application.Common.Interfaces;
using GenSteelPOS.Application.DTOs;
using GenSteelPOS.Application.Services;
using GenSteelPOS.Domain.Entities;
using GenSteelPOS.Domain.Enums;

namespace GenSteelPOS.Infrastructure.Services;

public sealed class PurchaseOrderService(
    IPurchaseOrderRepository purchaseOrderRepository,
    ISupplierRepository supplierRepository,
    IProductRepository productRepository,
    IInventoryRepository inventoryRepository,
    IStockInRecordRepository stockInRecordRepository,
    IStockMovementRepository stockMovementRepository,
    ICurrentUserContext currentUserContext,
    IUnitOfWork unitOfWork,
    IAuditLogService auditLogService) : IPurchaseOrderService
{
    public async Task<List<PurchaseOrderDto>> GetAllAsync(CancellationToken cancellationToken = default) =>
        (await purchaseOrderRepository.GetAllAsync(cancellationToken)).Select(x => x.ToDto()).ToList();

    public async Task<PurchaseOrderDto> GetByIdAsync(int id, CancellationToken cancellationToken = default)
    {
        var order = await purchaseOrderRepository.GetWithDetailsAsync(id, cancellationToken)
            ?? throw new AppException("Purchase order not found.", 404);
        return order.ToDto();
    }

    public async Task<PurchaseOrderDto> CreateAsync(CreatePurchaseOrderRequest request, CancellationToken cancellationToken = default)
    {
        var supplier = await supplierRepository.GetByIdAsync(request.SupplierId, cancellationToken)
            ?? throw new AppException("Supplier not found.", 404);
        var userId = currentUserContext.UserId ?? throw new AppException("Current user is not available.", 401);

        var order = new PurchaseOrder
        {
            OrderNumber = $"PO-{DateTime.UtcNow:yyyyMMddHHmmssfff}",
            SupplierId = supplier.Id,
            Supplier = supplier,
            CreatedByUserId = userId,
            Remarks = request.Remarks,
            Status = PurchaseOrderStatus.Pending
        };

        foreach (var item in request.Items)
        {
            var product = await productRepository.GetWithCategoryAndInventoryAsync(item.ProductId, cancellationToken)
                ?? throw new AppException($"Product {item.ProductId} not found.", 404);

            var lineTotal = item.Quantity * item.UnitCost;
            order.TotalEstimatedCost += lineTotal;

            order.Items.Add(new PurchaseOrderItem
            {
                ProductId = item.ProductId,
                Product = product,
                Quantity = item.Quantity,
                UnitCost = item.UnitCost,
                LineTotal = lineTotal
            });
        }

        await purchaseOrderRepository.AddAsync(order, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        await auditLogService.CreateAsync(
            "Create",
            "PurchaseOrder",
            order.Id.ToString(),
            $"Created purchase order {order.OrderNumber}.",
            cancellationToken);

        var created = await purchaseOrderRepository.GetWithDetailsAsync(order.Id, cancellationToken)
            ?? throw new AppException("Purchase order could not be loaded after save.", 500);
        return created.ToDto();
    }

    public async Task<PurchaseOrderDto> CancelAsync(int id, UpdatePurchaseOrderStatusRequest request, CancellationToken cancellationToken = default)
    {
        var order = await purchaseOrderRepository.GetWithDetailsAsync(id, cancellationToken)
            ?? throw new AppException("Purchase order not found.", 404);

        if (order.Status != PurchaseOrderStatus.Pending)
        {
            throw new AppException("Only pending purchase orders can be cancelled.");
        }

        order.Status = PurchaseOrderStatus.Cancelled;
        order.UpdatedAtUtc = DateTime.UtcNow;
        purchaseOrderRepository.Update(order);

        await unitOfWork.SaveChangesAsync(cancellationToken);
        await auditLogService.CreateAsync("Cancel", "PurchaseOrder", order.Id.ToString(), request.Reason, cancellationToken);

        return order.ToDto();
    }

    public async Task<StockInRecordDto> ReceiveAsync(int id, ReceivePurchaseOrderRequest request, CancellationToken cancellationToken = default) =>
        await unitOfWork.ExecuteInTransactionAsync(async ct =>
    {
        var order = await purchaseOrderRepository.GetWithDetailsAsync(id, ct)
            ?? throw new AppException("Purchase order not found.", 404);

        if (order.Status != PurchaseOrderStatus.Pending)
        {
            throw new AppException("Only pending purchase orders can be received.");
        }

        var userId = currentUserContext.UserId ?? throw new AppException("Current user is not available.", 401);
        var stockInRecord = new StockInRecord
        {
            SupplierId = order.SupplierId,
            Supplier = order.Supplier,
            ReceivedByUserId = userId,
            ReferenceNumber = $"SIN-{order.OrderNumber}",
            Remarks = string.IsNullOrWhiteSpace(request.Remarks)
                ? $"Received from purchase order {order.OrderNumber}."
                : request.Remarks
        };

        foreach (var item in order.Items)
        {
            var product = await productRepository.GetWithCategoryAndInventoryAsync(item.ProductId, ct)
                ?? throw new AppException($"Product {item.ProductId} not found.", 404);
            var inventory = product.Inventory ?? await inventoryRepository.GetByProductIdAsync(item.ProductId, ct)
                ?? throw new AppException($"Inventory for product {product.Name} not found.", 404);

            var previous = inventory.QuantityOnHand;
            var updated = previous + item.Quantity;

            inventory.QuantityOnHand = updated;
            inventory.UpdatedAtUtc = DateTime.UtcNow;
            inventoryRepository.Update(inventory);

            stockInRecord.Items.Add(new StockInItem
            {
                ProductId = item.ProductId,
                Product = product,
                Quantity = item.Quantity,
                UnitCost = item.UnitCost
            });

            await stockMovementRepository.AddAsync(new StockMovement
            {
                ProductId = item.ProductId,
                MovementType = StockMovementType.StockIn,
                QuantityChanged = item.Quantity,
                PreviousQuantity = previous,
                NewQuantity = updated,
                ReferenceNo = stockInRecord.ReferenceNumber,
                Remarks = stockInRecord.Remarks,
                PerformedByUserId = userId
            }, ct);
        }

        order.Status = PurchaseOrderStatus.Received;
        order.UpdatedAtUtc = DateTime.UtcNow;
        order.ReceivedStockInRecord = stockInRecord;
        purchaseOrderRepository.Update(order);

        await stockInRecordRepository.AddAsync(stockInRecord, ct);
        await unitOfWork.SaveChangesAsync(ct);

        await auditLogService.CreateAsync(
            "ReceivePurchaseOrder",
            "PurchaseOrder",
            order.Id.ToString(),
            $"Received purchase order {order.OrderNumber} into stock-in {stockInRecord.ReferenceNumber}.",
            ct);

        var created = await stockInRecordRepository.GetWithDetailsAsync(stockInRecord.Id, ct)
            ?? throw new AppException("Stock-in record could not be loaded after receive.", 500);
        return created.ToDto();
    }, cancellationToken);
}
