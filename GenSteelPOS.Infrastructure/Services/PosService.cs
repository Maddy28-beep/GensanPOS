using GenSteelPOS.Application.Common.Exceptions;
using GenSteelPOS.Application.Common.Interfaces;
using GenSteelPOS.Application.DTOs;
using GenSteelPOS.Application.Services;
using GenSteelPOS.Domain.Entities;
using GenSteelPOS.Domain.Enums;

namespace GenSteelPOS.Infrastructure.Services;

public sealed class PosService(
    IProductRepository productRepository,
    ISaleRepository saleRepository,
    ICurrentUserContext currentUserContext,
    IUnitOfWork unitOfWork,
    IAuditLogService auditLogService) : IPosService
{
    public async Task<SaleDto> ProcessSaleAsync(ProcessSaleRequest request, CancellationToken cancellationToken = default) =>
        await unitOfWork.ExecuteInTransactionAsync(async ct =>
    {
        var cashierId = currentUserContext.UserId ?? throw new AppException("Current user is not available.", 401);
        var saleNumber = $"SALE-{DateTime.UtcNow:yyyyMMddHHmmssfff}";

        var sale = new Sale
        {
            SaleNumber = saleNumber,
            CashierId = cashierId,
            CustomerName = request.CustomerName.Trim(),
            CustomerAddress = request.CustomerAddress.Trim(),
            CustomerTin = request.CustomerTin.Trim(),
            Remarks = request.Remarks.Trim(),
            PoNumber = request.PoNumber.Trim(),
            Terms = request.Terms.Trim(),
            DiscountAmount = request.DiscountAmount,
            TaxAmount = request.TaxAmount,
            Status = SaleStatus.Completed
        };

        decimal subtotal = 0;

        foreach (var item in request.Items)
        {
            var product = await productRepository.GetWithCategoryAndInventoryAsync(item.ProductId, ct)
                ?? throw new AppException($"Product {item.ProductId} not found.", 404);

            if (!product.IsActive)
            {
                throw new AppException($"Inactive product '{product.Name}' cannot be sold.");
            }

            if (product.Quantity < item.Quantity)
            {
                throw new AppException($"Insufficient stock for product '{product.Name}'.");
            }

            var lineTotal = RoundMoney(product.Price * item.Quantity);
            subtotal += lineTotal;

            sale.SaleItems.Add(new SaleItem
            {
                ProductId = product.Id,
                Product = product,
                ProductNameSnapshot = product.Name,
                SkuSnapshot = product.Sku,
                Quantity = item.Quantity,
                UnitPrice = product.Price,
                CostPriceSnapshot = product.CostPrice,
                LineTotal = lineTotal
            });

            var previous = product.Quantity;
            var updated = previous - item.Quantity;

            if (updated < 0)
            {
                throw new AppException($"Negative stock is not allowed for product '{product.Name}'.");
            }

            product.Quantity = updated;
            product.UpdatedAtUtc = DateTime.UtcNow;
            if (product.Inventory is not null)
            {
                product.Inventory.QuantityOnHand = updated;
                product.Inventory.UpdatedAtUtc = DateTime.UtcNow;
            }
            productRepository.Update(product);
        }

        sale.Subtotal = RoundMoney(subtotal);
        sale.DiscountAmount = RoundMoney(request.DiscountAmount);
        sale.TaxAmount = RoundMoney(request.TaxAmount);
        sale.TotalAmount = RoundMoney(sale.Subtotal - sale.DiscountAmount + sale.TaxAmount);

        if (sale.TotalAmount < 0)
        {
            throw new AppException("Total amount cannot be negative.");
        }

        var paymentTotal = RoundMoney(request.Payments.Sum(x => x.Amount));
        if (paymentTotal < sale.TotalAmount)
        {
            throw new AppException("Payment total is less than the sale total.");
        }

        sale.AmountPaid = paymentTotal;
        sale.ChangeDue = RoundMoney(paymentTotal - sale.TotalAmount);

        foreach (var payment in request.Payments)
        {
            ValidatePaymentDetails(payment);

            sale.Payments.Add(new Payment
            {
                PaymentMethod = payment.PaymentMethod,
                Amount = RoundMoney(payment.Amount),
                ReferenceNumber = payment.ReferenceNumber.Trim(),
                BankName = payment.BankName.Trim(),
                BankBranch = payment.BankBranch.Trim(),
                CheckNumber = payment.CheckNumber.Trim(),
                CheckDate = payment.CheckDate,
                DueDays = payment.DueDays,
                Details = payment.Details.Trim()
            });
        }

        await saleRepository.AddAsync(sale, ct);
        await unitOfWork.SaveChangesAsync(ct);

        var created = await saleRepository.GetWithDetailsAsync(sale.Id, ct)
            ?? throw new AppException("Sale could not be loaded after save.", 500);

        await auditLogService.CreateAsync("SaleCompleted", "Sale", sale.Id.ToString(), $"Completed POS sale {sale.SaleNumber}.", ct);
        return created.ToDto();
    }, cancellationToken);

    private static void ValidatePaymentDetails(PaymentRequest payment)
    {
        if (payment.PaymentMethod == PaymentMethod.Transfer &&
            string.IsNullOrWhiteSpace(payment.ReferenceNumber) &&
            string.IsNullOrWhiteSpace(payment.BankName))
        {
            throw new AppException("Online bank payment needs a reference number or bank name.");
        }

        if (payment.PaymentMethod is PaymentMethod.CurrentCheck or PaymentMethod.PostDatedCheck)
        {
            if (string.IsNullOrWhiteSpace(payment.BankName))
            {
                throw new AppException("Check payment needs the bank name.");
            }

            if (string.IsNullOrWhiteSpace(payment.CheckNumber))
            {
                throw new AppException("Check payment needs the check number.");
            }
        }

        if (payment.PaymentMethod == PaymentMethod.PostDatedCheck && payment.CheckDate is null)
        {
            throw new AppException("Post-dated check needs the check date.");
        }

        if (payment.PaymentMethod == PaymentMethod.Credit && (!payment.DueDays.HasValue || payment.DueDays <= 0))
        {
            throw new AppException("Charged/utang payment needs the number of days before payment is due.");
        }
    }

    private static decimal RoundMoney(decimal amount) =>
        decimal.Round(amount, 2, MidpointRounding.AwayFromZero);
}
