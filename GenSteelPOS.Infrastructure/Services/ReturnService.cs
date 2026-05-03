using GenSteelPOS.Application.Common.Exceptions;
using GenSteelPOS.Application.Common.Interfaces;
using GenSteelPOS.Application.DTOs;
using GenSteelPOS.Application.Services;
using GenSteelPOS.Domain.Constants;
using GenSteelPOS.Domain.Entities;
using GenSteelPOS.Domain.Enums;

namespace GenSteelPOS.Infrastructure.Services;

public sealed class ReturnService(
    IReturnRepository returnRepository,
    ISaleRepository saleRepository,
    IProductRepository productRepository,
    IUnitOfWork unitOfWork,
    ICurrentUserContext currentUserContext,
    IAuditLogService auditLogService) : IReturnService
{
    public async Task<List<ReturnDto>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        EnsureOwnerAccess();
        return (await returnRepository.GetAllWithDetailsAsync(cancellationToken)).Select(x => x.ToDto()).ToList();
    }

    public async Task<ReturnDto> CreateAsync(CreateReturnRequest request, CancellationToken cancellationToken = default)
    {
        EnsureOwnerAccess();

        var sale = await saleRepository.GetWithDetailsAsync(request.SaleId, cancellationToken)
            ?? throw new AppException("Sale not found.", 404);

        return await CreateReturnInternalAsync(sale, request.Remarks, request.Items, cancellationToken);
    }

    public async Task<ReturnDto> CreateFullRefundAsync(int saleId, string remarks, CancellationToken cancellationToken = default)
    {
        EnsureOwnerAccess();

        var sale = await saleRepository.GetWithDetailsAsync(saleId, cancellationToken)
            ?? throw new AppException("Sale not found.", 404);

        var items = sale.SaleItems
            .Select(item => new
            {
                SaleItemId = item.Id,
                RemainingQuantity = Math.Max(0, item.Quantity - item.ReturnItems.Sum(x => x.Quantity))
            })
            .Where(x => x.RemainingQuantity > 0)
            .Select(x => new CreateReturnItemRequest
            {
                SaleItemId = x.SaleItemId,
                Quantity = x.RemainingQuantity,
                Condition = ReturnItemCondition.Good,
                Remarks = remarks
            })
            .ToList();

        if (items.Count == 0)
        {
            throw new AppException("This sale does not have any remaining refundable quantity.");
        }

        return await CreateReturnInternalAsync(sale, remarks, items, cancellationToken);
    }

    private async Task<ReturnDto> CreateReturnInternalAsync(
        Sale sale,
        string remarks,
        IReadOnlyCollection<CreateReturnItemRequest> requestItems,
        CancellationToken cancellationToken) =>
        await unitOfWork.ExecuteInTransactionAsync(async ct =>
    {
        if (sale.Status is SaleStatus.Cancelled or SaleStatus.Voided)
        {
            throw new AppException("Cancelled or voided sales cannot be returned.");
        }

        var userId = currentUserContext.UserId ?? throw new AppException("Current user is not available.", 401);
        var normalizedRemarks = remarks.Trim();
        var returnRecord = new ReturnRecord
        {
            ReturnNumber = $"GRS-{DateTime.UtcNow:yyyyMMddHHmmssfff}",
            SaleId = sale.Id,
            ProcessedByUserId = userId,
            Remarks = normalizedRemarks
        };

        decimal totalReturnAmount = 0m;

        foreach (var requestItem in requestItems)
        {
            if (requestItem.Condition != ReturnItemCondition.Good)
            {
                throw new AppException("Only good-condition items can be returned. Damaged items are not allowed for return.");
            }

            var saleItem = sale.SaleItems.FirstOrDefault(x => x.Id == requestItem.SaleItemId)
                ?? throw new AppException($"Sale item {requestItem.SaleItemId} was not found on the selected sale.");

            var alreadyReturned = saleItem.ReturnItems.Sum(x => x.Quantity);
            var remainingReturnable = saleItem.Quantity - alreadyReturned;
            if (requestItem.Quantity > remainingReturnable)
            {
                throw new AppException(
                    $"Return quantity for {saleItem.Product?.Name ?? $"sale item {saleItem.Id}"} exceeds the remaining returnable quantity.");
            }

            var returnAmount = saleItem.UnitPrice * requestItem.Quantity;
            totalReturnAmount += returnAmount;

            returnRecord.Items.Add(new ReturnItem
            {
                SaleItemId = saleItem.Id,
                ProductId = saleItem.ProductId,
                Quantity = requestItem.Quantity,
                UnitPrice = saleItem.UnitPrice,
                ReturnAmount = returnAmount,
            Condition = requestItem.Condition,
                Remarks = requestItem.Remarks.Trim()
            });

            if (requestItem.Condition == ReturnItemCondition.Good)
            {
                var product = saleItem.Product
                    ?? throw new AppException($"Product {saleItem.ProductId} not found for return.", 404);
                product.Quantity += requestItem.Quantity;
                product.UpdatedAtUtc = DateTime.UtcNow;
                if (product.Inventory is not null)
                {
                    product.Inventory.QuantityOnHand = product.Quantity;
                    product.Inventory.UpdatedAtUtc = DateTime.UtcNow;
                }
                productRepository.Update(product);
            }
        }

        returnRecord.TotalReturnAmount = totalReturnAmount;
        await returnRepository.AddAsync(returnRecord, ct);

        sale.Status = ResolveSaleStatusAfterReturn(sale, returnRecord);
        sale.UpdatedAtUtc = DateTime.UtcNow;
        saleRepository.Update(sale);

        await unitOfWork.SaveChangesAsync(ct);
        await auditLogService.CreateAsync(
            "CreateReturn",
            "Return",
            returnRecord.Id.ToString(),
            $"Processed GRS {returnRecord.ReturnNumber} against original invoice {sale.SaleNumber}. Amount: {returnRecord.TotalReturnAmount:0.00}.",
            $"Sale status: Completed",
            $"GRS: {returnRecord.ReturnNumber}; Original invoice: {sale.SaleNumber}; Returned amount: {returnRecord.TotalReturnAmount:0.00}; Sale status: {sale.Status}",
            ct);

        var created = await returnRepository.GetWithDetailsAsync(returnRecord.Id, ct)
            ?? throw new AppException("Return could not be loaded after save.", 500);
        return created.ToDto();
    }, cancellationToken);

    private static SaleStatus ResolveSaleStatusAfterReturn(Sale sale, ReturnRecord currentReturn)
    {
        var cumulativeReturned = sale.SaleItems.ToDictionary(x => x.Id, x => x.ReturnItems.Sum(r => r.Quantity));

        foreach (var item in currentReturn.Items)
        {
            cumulativeReturned[item.SaleItemId] = (cumulativeReturned.TryGetValue(item.SaleItemId, out var existing) ? existing : 0m) + item.Quantity;
        }

        var allReturned = sale.SaleItems.All(item => cumulativeReturned.GetValueOrDefault(item.Id) >= item.Quantity);
        if (allReturned)
        {
            return SaleStatus.Refunded;
        }

        var anyReturned = cumulativeReturned.Values.Any(x => x > 0);
        return anyReturned ? SaleStatus.PartiallyRefunded : SaleStatus.Completed;
    }

    private void EnsureOwnerAccess()
    {
        if (currentUserContext.Role != AppRoles.SuperAdmin)
        {
            throw new AppException("Only the owner can approve or finalize returns.", 403);
        }
    }
}
