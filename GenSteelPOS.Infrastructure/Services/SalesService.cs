using GenSteelPOS.Application.Common.Exceptions;
using GenSteelPOS.Application.Common.Interfaces;
using GenSteelPOS.Application.DTOs;
using GenSteelPOS.Application.Services;
using GenSteelPOS.Domain.Entities;
using GenSteelPOS.Domain.Enums;

namespace GenSteelPOS.Infrastructure.Services;

public sealed class SalesService(
    ISaleRepository saleRepository,
    IProductRepository productRepository,
    IUnitOfWork unitOfWork,
    ICurrentUserContext currentUserContext,
    IAuditLogService auditLogService,
    IReturnService returnService) : ISalesService
{
    public async Task<List<SaleDto>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        if (currentUserContext.Role is Domain.Constants.AppRoles.SuperAdmin)
        {
            return (await saleRepository.GetAllAsync(cancellationToken)).Select(x => x.ToDto()).ToList();
        }

        var cashierId = currentUserContext.UserId ?? throw new AppException("Current user is not available.", 401);
        var todayUtc = DateTime.UtcNow.Date;
        var tomorrowUtc = todayUtc.AddDays(1).AddTicks(-1);

        return (await saleRepository.GetForCashierOnDateAsync(cashierId, todayUtc, tomorrowUtc, cancellationToken))
            .Select(x => x.ToDto())
            .ToList();
    }

    public async Task<SaleDto> GetByIdAsync(int id, CancellationToken cancellationToken = default)
    {
        Sale? sale;
        if (currentUserContext.Role is Domain.Constants.AppRoles.SuperAdmin)
        {
            sale = await saleRepository.GetWithDetailsAsync(id, cancellationToken);
        }
        else
        {
            var cashierId = currentUserContext.UserId ?? throw new AppException("Current user is not available.", 401);
            var todayUtc = DateTime.UtcNow.Date;
            var tomorrowUtc = todayUtc.AddDays(1).AddTicks(-1);
            sale = await saleRepository.GetForCashierByIdAsync(id, cashierId, todayUtc, tomorrowUtc, cancellationToken);
        }

        if (sale is null)
        {
            throw new AppException("Sale not found.", 404);
        }

        return sale.ToDto();
    }

    public async Task<SaleDto> CancelAsync(int id, UpdateSaleStatusRequest request, CancellationToken cancellationToken = default) =>
        await RestoreStockAndUpdateStatusAsync(id, SaleStatus.Cancelled, request.Reason, cancellationToken);

    public async Task<SaleDto> RefundAsync(int id, UpdateSaleStatusRequest request, CancellationToken cancellationToken = default) =>
        await CreateFullReturnAndReloadSaleAsync(id, request.Reason, cancellationToken);

    public async Task<SaleDto> VoidAsync(int id, UpdateSaleStatusRequest request, CancellationToken cancellationToken = default) =>
        await RestoreStockAndUpdateStatusAsync(id, SaleStatus.Voided, request.Reason, cancellationToken);

    private async Task<SaleDto> CreateFullReturnAndReloadSaleAsync(int id, string reason, CancellationToken cancellationToken)
    {
        _ = await returnService.CreateFullRefundAsync(id, reason, cancellationToken);

        var updatedSale = await saleRepository.GetWithDetailsAsync(id, cancellationToken)
            ?? throw new AppException("Sale not found after return processing.", 404);

        return updatedSale.ToDto();
    }

    private async Task<SaleDto> RestoreStockAndUpdateStatusAsync(int id, SaleStatus targetStatus, string reason, CancellationToken cancellationToken) =>
        await unitOfWork.ExecuteInTransactionAsync(async ct =>
    {
        var sale = await saleRepository.GetWithDetailsAsync(id, ct)
            ?? throw new AppException("Sale not found.", 404);

        if (sale.Status != SaleStatus.Completed)
        {
            throw new AppException("Only completed sales can be updated to this status.");
        }

        var userId = currentUserContext.UserId;

        foreach (var item in sale.SaleItems)
        {
            var product = item.Product ?? await productRepository.GetWithCategoryAndInventoryAsync(item.ProductId, ct)
                ?? throw new AppException($"Product {item.ProductId} not found.", 404);

            var previous = product.Quantity;
            var updated = previous + item.Quantity;

            product.Quantity = updated;
            product.UpdatedAtUtc = DateTime.UtcNow;
            productRepository.Update(product);

            if (product.Inventory is not null)
            {
                product.Inventory.QuantityOnHand = updated;
            }
        }

        var oldStatus = sale.Status;
        sale.Status = targetStatus;
        sale.UpdatedAtUtc = DateTime.UtcNow;
        saleRepository.Update(sale);

        await unitOfWork.SaveChangesAsync(ct);
        await auditLogService.CreateAsync(
            targetStatus.ToString(),
            "Sale",
            sale.Id.ToString(),
            $"{targetStatus} original invoice {sale.SaleNumber}. Stock was restored and the transaction remains visible in sales history and audit logs.",
            $"Status: {oldStatus}; Stock deducted",
            $"Status: {targetStatus}; Original invoice: {sale.SaleNumber}; Stock restored",
            ct);

        var updatedSale = await saleRepository.GetWithDetailsAsync(id, ct)
            ?? throw new AppException("Sale not found after update.", 404);
        return updatedSale.ToDto();
    }, cancellationToken);
}
