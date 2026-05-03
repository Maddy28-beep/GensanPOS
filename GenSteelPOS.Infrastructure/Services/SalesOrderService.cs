using GenSteelPOS.Application.Common.Exceptions;
using GenSteelPOS.Application.Common.Interfaces;
using GenSteelPOS.Application.DTOs;
using GenSteelPOS.Application.Services;
using GenSteelPOS.Domain.Entities;
using GenSteelPOS.Domain.Enums;

namespace GenSteelPOS.Infrastructure.Services;

public sealed class SalesOrderService(
    ISalesOrderRepository salesOrderRepository,
    IProductRepository productRepository,
    IInventoryRepository inventoryRepository,
    ISaleRepository saleRepository,
    IStockMovementRepository stockMovementRepository,
    ICurrentUserContext currentUserContext,
    IUnitOfWork unitOfWork,
    IAuditLogService auditLogService) : ISalesOrderService
{
    public async Task<List<SalesOrderDto>> GetAllAsync(CancellationToken cancellationToken = default) =>
        (await salesOrderRepository.GetAllAsync(cancellationToken)).Select(x => x.ToDto()).ToList();

    public async Task<SalesOrderDto> GetByIdAsync(int id, CancellationToken cancellationToken = default)
    {
        var order = await salesOrderRepository.GetWithDetailsAsync(id, cancellationToken)
            ?? throw new AppException("Sales order not found.", 404);
        return order.ToDto();
    }

    public async Task<SalesOrderDto> CreateAsync(CreateSalesOrderRequest request, CancellationToken cancellationToken = default)
    {
        var userId = currentUserContext.UserId ?? throw new AppException("Current user is not available.", 401);
        var orderNumber = $"SO-{DateTime.UtcNow:yyyyMMddHHmmssfff}";

        var order = new SalesOrder
        {
            OrderNumber = orderNumber,
            CustomerName = request.CustomerName,
            CustomerContact = request.CustomerContact,
            CustomerAddress = request.CustomerAddress,
            Remarks = request.Remarks,
            CreatedByUserId = userId,
            DiscountAmount = request.DiscountAmount,
            TaxAmount = request.TaxAmount,
            Status = SalesOrderStatus.Pending
        };

        decimal subtotal = 0m;

        foreach (var item in request.Items)
        {
            var product = await productRepository.GetWithCategoryAndInventoryAsync(item.ProductId, cancellationToken)
                ?? throw new AppException($"Product {item.ProductId} not found.", 404);

            if (!product.IsActive)
            {
                throw new AppException($"Inactive product '{product.Name}' cannot be added to a sales order.");
            }

            var lineTotal = product.Price * item.Quantity;
            subtotal += lineTotal;

            order.Items.Add(new SalesOrderItem
            {
                ProductId = product.Id,
                Product = product,
                Quantity = item.Quantity,
                UnitPrice = product.Price,
                LineTotal = lineTotal
            });
        }

        order.Subtotal = subtotal;
        order.TotalAmount = subtotal - request.DiscountAmount + request.TaxAmount;

        if (order.TotalAmount < 0)
        {
            throw new AppException("Total amount cannot be negative.");
        }

        await salesOrderRepository.AddAsync(order, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        await auditLogService.CreateAsync(
            "Create",
            "SalesOrder",
            order.Id.ToString(),
            $"Created sales order {order.OrderNumber} for {order.CustomerName}.",
            cancellationToken);

        var created = await salesOrderRepository.GetWithDetailsAsync(order.Id, cancellationToken)
            ?? throw new AppException("Sales order could not be loaded after save.", 500);
        return created.ToDto();
    }

    public async Task<SalesOrderDto> CancelAsync(int id, UpdateSalesOrderStatusRequest request, CancellationToken cancellationToken = default)
    {
        var order = await salesOrderRepository.GetWithDetailsAsync(id, cancellationToken)
            ?? throw new AppException("Sales order not found.", 404);

        if (order.Status != SalesOrderStatus.Pending)
        {
            throw new AppException("Only pending sales orders can be cancelled.");
        }

        order.Status = SalesOrderStatus.Cancelled;
        order.UpdatedAtUtc = DateTime.UtcNow;
        salesOrderRepository.Update(order);

        await unitOfWork.SaveChangesAsync(cancellationToken);
        await auditLogService.CreateAsync(
            "Cancel",
            "SalesOrder",
            order.Id.ToString(),
            request.Reason,
            cancellationToken);

        return order.ToDto();
    }

    public async Task<SaleDto> ConvertToSaleAsync(int id, ConvertSalesOrderRequest request, CancellationToken cancellationToken = default) =>
        await unitOfWork.ExecuteInTransactionAsync(async ct =>
    {
        var userId = currentUserContext.UserId ?? throw new AppException("Current user is not available.", 401);
        var order = await salesOrderRepository.GetWithDetailsAsync(id, ct)
            ?? throw new AppException("Sales order not found.", 404);

        if (order.Status != SalesOrderStatus.Pending)
        {
            throw new AppException("Only pending sales orders can be converted to a sale.");
        }

        var paymentTotal = request.Payments.Sum(x => x.Amount);
        if (paymentTotal < order.TotalAmount)
        {
            throw new AppException("Payment total is less than the sales order total.");
        }

        var saleNumber = $"SALE-{DateTime.UtcNow:yyyyMMddHHmmssfff}";
        var sale = new Sale
        {
            SaleNumber = saleNumber,
            CashierId = userId,
            CustomerName = order.CustomerName,
            CustomerAddress = order.CustomerAddress,
            Remarks = order.Remarks,
            Terms = "Sales Order",
            DiscountAmount = order.DiscountAmount,
            TaxAmount = order.TaxAmount,
            Subtotal = order.Subtotal,
            TotalAmount = order.TotalAmount,
            AmountPaid = paymentTotal,
            ChangeDue = paymentTotal - order.TotalAmount,
            Status = SaleStatus.Completed
        };

        foreach (var item in order.Items)
        {
            var product = await productRepository.GetWithCategoryAndInventoryAsync(item.ProductId, ct)
                ?? throw new AppException($"Product {item.ProductId} not found.", 404);

            if (!product.IsActive)
            {
                throw new AppException($"Inactive product '{product.Name}' cannot be sold.");
            }

            var inventory = product.Inventory ?? await inventoryRepository.GetByProductIdAsync(item.ProductId, ct)
                ?? throw new AppException($"Inventory for product '{product.Name}' not found.", 404);

            if (inventory.QuantityOnHand < item.Quantity)
            {
                throw new AppException($"Insufficient stock for product '{product.Name}'.");
            }

            sale.SaleItems.Add(new SaleItem
            {
                ProductId = item.ProductId,
                Product = product,
                ProductNameSnapshot = product.Name,
                SkuSnapshot = product.Sku,
                Quantity = item.Quantity,
                UnitPrice = item.UnitPrice,
                LineTotal = item.LineTotal
            });

            var previous = inventory.QuantityOnHand;
            var updated = previous - item.Quantity;

            if (updated < 0)
            {
                throw new AppException($"Negative stock is not allowed for product '{product.Name}'.");
            }

            inventory.QuantityOnHand = updated;
            inventory.UpdatedAtUtc = DateTime.UtcNow;
            inventoryRepository.Update(inventory);

            await stockMovementRepository.AddAsync(new StockMovement
            {
                ProductId = product.Id,
                MovementType = StockMovementType.Sale,
                QuantityChanged = -item.Quantity,
                PreviousQuantity = previous,
                NewQuantity = updated,
                ReferenceNo = saleNumber,
                Remarks = $"Converted sales order {order.OrderNumber} to sale {saleNumber}",
                PerformedByUserId = userId
            }, ct);
        }

        foreach (var payment in request.Payments)
        {
            sale.Payments.Add(new Payment
            {
                PaymentMethod = payment.PaymentMethod,
                Amount = payment.Amount,
                ReferenceNumber = payment.ReferenceNumber.Trim(),
                BankName = payment.BankName.Trim(),
                BankBranch = payment.BankBranch.Trim(),
                CheckNumber = payment.CheckNumber.Trim(),
                CheckDate = payment.CheckDate,
                DueDays = payment.DueDays,
                Details = payment.Details.Trim()
            });
        }

        order.Status = SalesOrderStatus.ConvertedToSale;
        order.ConvertedSale = sale;
        order.UpdatedAtUtc = DateTime.UtcNow;
        salesOrderRepository.Update(order);

        await saleRepository.AddAsync(sale, ct);
        await unitOfWork.SaveChangesAsync(ct);

        await auditLogService.CreateAsync(
            "ConvertToSale",
            "SalesOrder",
            order.Id.ToString(),
            $"Converted sales order {order.OrderNumber} into sale {sale.SaleNumber}.",
            ct);

        var createdSale = await saleRepository.GetWithDetailsAsync(sale.Id, ct)
            ?? throw new AppException("Sale could not be loaded after conversion.", 500);

        return createdSale.ToDto();
    }, cancellationToken);
}
