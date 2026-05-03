using GenSteelPOS.Application.Common.Exceptions;
using GenSteelPOS.Application.Common.Interfaces;
using GenSteelPOS.Application.DTOs;
using GenSteelPOS.Application.Services;
using GenSteelPOS.Domain.Constants;
using GenSteelPOS.Domain.Entities;
using GenSteelPOS.Domain.Enums;
using System.Text.Json;

namespace GenSteelPOS.Infrastructure.Services;

public sealed class SaleActionRequestService(
    ISaleActionRequestRepository saleActionRequestRepository,
    ISaleRepository saleRepository,
    ISalesService salesService,
    IReturnService returnService,
    ICurrentUserContext currentUserContext,
    IUnitOfWork unitOfWork,
    IAuditLogService auditLogService) : ISaleActionRequestService
{
    public async Task<List<SaleActionRequestDto>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        var requests = await saleActionRequestRepository.GetAllWithDetailsAsync(cancellationToken);

        if (currentUserContext.Role == AppRoles.SuperAdmin)
        {
            return requests.Select(x => x.ToDto()).ToList();
        }

        var userId = currentUserContext.UserId ?? throw new AppException("Current user is not available.", 401);
        return requests.Where(x => x.RequestedByUserId == userId).Select(x => x.ToDto()).ToList();
    }

    public async Task<SaleActionRequestDto> CreateAsync(CreateSaleActionRequestRequest request, CancellationToken cancellationToken = default)
    {
        var userId = currentUserContext.UserId ?? throw new AppException("Current user is not available.", 401);
        var sale = await saleRepository.GetWithDetailsAsync(request.SaleId, cancellationToken)
            ?? throw new AppException("Sale not found.", 404);

        if (sale.Status != SaleStatus.Completed)
        {
            throw new AppException("Only completed sales can have a cancel, refund, or void request.");
        }

        if (currentUserContext.Role != AppRoles.SuperAdmin && sale.CashierId != userId)
        {
            throw new AppException("You can only request actions for your own sale.", 403);
        }

        if (!Enum.TryParse<SaleActionRequestType>(request.RequestType, true, out var requestType))
        {
            throw new AppException("Invalid request type.");
        }

        var hasPending = await saleActionRequestRepository.HasPendingRequestAsync(sale.Id, requestType, cancellationToken);
        if (hasPending)
        {
            throw new AppException("There is already a pending request for this action on the selected sale.");
        }

        var requestedReturnItems = requestType == SaleActionRequestType.Refund
            ? NormalizeRequestedReturnItems(sale, request.RequestedReturnItems)
            : new List<SaleActionRequestedReturnItemRequest>();

        var entity = new SaleActionRequest
        {
            SaleId = sale.Id,
            RequestType = requestType,
            RequestedByUserId = userId,
            RequestReason = request.Reason.Trim(),
            RequestedReturnItemsJson = requestedReturnItems.Count == 0
                ? string.Empty
                : JsonSerializer.Serialize(requestedReturnItems),
            Status = SaleActionRequestStatus.Pending
        };

        await saleActionRequestRepository.AddAsync(entity, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        await auditLogService.CreateAsync(
            "CreateRequest",
            "SaleActionRequest",
            entity.Id.ToString(),
            $"Requested {requestType} for sale {sale.SaleNumber}. Reason: {entity.RequestReason}",
            cancellationToken);

        var created = await saleActionRequestRepository.GetWithDetailsAsync(entity.Id, cancellationToken)
            ?? throw new AppException("Request could not be loaded after save.", 500);
        return created.ToDto();
    }

    public async Task<SaleActionRequestDto> ApproveAsync(int id, ReviewSaleActionRequestRequest request, CancellationToken cancellationToken = default)
    {
        EnsureOwnerAccess();

        var entity = await saleActionRequestRepository.GetWithDetailsAsync(id, cancellationToken)
            ?? throw new AppException("Sale action request not found.", 404);

        if (entity.Status != SaleActionRequestStatus.Pending)
        {
            throw new AppException("Only pending requests can be approved.");
        }

        var reason = string.IsNullOrWhiteSpace(request.Notes)
            ? entity.RequestReason
            : $"{entity.RequestReason} - Owner notes: {request.Notes.Trim()}";

        if (entity.RequestType == SaleActionRequestType.Refund && TryReadRequestedReturnItems(entity, out var requestedReturnItems))
        {
            _ = await returnService.CreateAsync(new CreateReturnRequest
            {
                SaleId = entity.SaleId,
                Remarks = reason,
                Items = requestedReturnItems.Select(x => new CreateReturnItemRequest
                {
                    SaleItemId = x.SaleItemId,
                    Quantity = x.Quantity,
                    Condition = x.Condition,
                    Remarks = x.Remarks
                }).ToList()
            }, cancellationToken);
        }
        else
        {
            _ = entity.RequestType switch
        {
            SaleActionRequestType.Cancel => await salesService.CancelAsync(entity.SaleId, new UpdateSaleStatusRequest { Reason = reason }, cancellationToken),
            SaleActionRequestType.Refund => await salesService.RefundAsync(entity.SaleId, new UpdateSaleStatusRequest { Reason = reason }, cancellationToken),
            SaleActionRequestType.Void => await salesService.VoidAsync(entity.SaleId, new UpdateSaleStatusRequest { Reason = reason }, cancellationToken),
            _ => throw new AppException("Unsupported request type.")
        };
        }

        entity.Status = SaleActionRequestStatus.Approved;
        entity.ReviewNotes = request.Notes.Trim();
        entity.ReviewedByUserId = currentUserContext.UserId;
        entity.ReviewedAtUtc = DateTime.UtcNow;
        entity.UpdatedAtUtc = DateTime.UtcNow;
        saleActionRequestRepository.Update(entity);

        await unitOfWork.SaveChangesAsync(cancellationToken);
        await auditLogService.CreateAsync(
            "ApproveRequest",
            "SaleActionRequest",
            entity.Id.ToString(),
            $"Approved {entity.RequestType} request for sale {entity.Sale?.SaleNumber}.",
            cancellationToken);

        var updated = await saleActionRequestRepository.GetWithDetailsAsync(id, cancellationToken)
            ?? throw new AppException("Sale action request not found after approval.", 404);
        return updated.ToDto();
    }

    public async Task<SaleActionRequestDto> RejectAsync(int id, ReviewSaleActionRequestRequest request, CancellationToken cancellationToken = default)
    {
        EnsureOwnerAccess();

        var entity = await saleActionRequestRepository.GetWithDetailsAsync(id, cancellationToken)
            ?? throw new AppException("Sale action request not found.", 404);

        if (entity.Status != SaleActionRequestStatus.Pending)
        {
            throw new AppException("Only pending requests can be rejected.");
        }

        entity.Status = SaleActionRequestStatus.Rejected;
        entity.ReviewNotes = request.Notes.Trim();
        entity.ReviewedByUserId = currentUserContext.UserId;
        entity.ReviewedAtUtc = DateTime.UtcNow;
        entity.UpdatedAtUtc = DateTime.UtcNow;
        saleActionRequestRepository.Update(entity);

        await unitOfWork.SaveChangesAsync(cancellationToken);
        await auditLogService.CreateAsync(
            "RejectRequest",
            "SaleActionRequest",
            entity.Id.ToString(),
            $"Rejected {entity.RequestType} request for sale {entity.Sale?.SaleNumber}. Notes: {entity.ReviewNotes}",
            cancellationToken);

        var updated = await saleActionRequestRepository.GetWithDetailsAsync(id, cancellationToken)
            ?? throw new AppException("Sale action request not found after rejection.", 404);
        return updated.ToDto();
    }

    private void EnsureOwnerAccess()
    {
        if (currentUserContext.Role != AppRoles.SuperAdmin)
        {
            throw new AppException("Only the owner can review sale action requests.", 403);
        }
    }

    private static List<SaleActionRequestedReturnItemRequest> NormalizeRequestedReturnItems(
        Sale sale,
        IReadOnlyCollection<SaleActionRequestedReturnItemRequest> requestedItems)
    {
        var normalizedItems = requestedItems
            .Where(x => x.Quantity > 0)
            .Select(x => new SaleActionRequestedReturnItemRequest
            {
                SaleItemId = x.SaleItemId,
                Quantity = x.Quantity,
                Condition = x.Condition,
                Remarks = x.Remarks.Trim()
            })
            .ToList();

        foreach (var item in normalizedItems)
        {
            if (!Enum.IsDefined(item.Condition))
            {
                throw new AppException("Invalid return condition.");
            }

            if (item.Condition != ReturnItemCondition.Good)
            {
                throw new AppException("Only good-condition items can be requested for return. Damaged items are not allowed for return.");
            }

            var saleItem = sale.SaleItems.FirstOrDefault(x => x.Id == item.SaleItemId)
                ?? throw new AppException($"Sale item {item.SaleItemId} was not found on the selected sale.");
        }

        foreach (var itemGroup in normalizedItems.GroupBy(x => x.SaleItemId))
        {
            var saleItem = sale.SaleItems.First(x => x.Id == itemGroup.Key);
            var remaining = saleItem.Quantity - saleItem.ReturnItems.Sum(x => x.Quantity);
            var requestedQuantity = itemGroup.Sum(x => x.Quantity);

            if (requestedQuantity > remaining)
            {
                throw new AppException(
                    $"Requested return quantity for {saleItem.ProductNameSnapshot} exceeds the remaining returnable quantity.");
            }
        }

        return normalizedItems;
    }

    private static bool TryReadRequestedReturnItems(
        SaleActionRequest entity,
        out List<SaleActionRequestedReturnItemRequest> requestedReturnItems)
    {
        requestedReturnItems = new List<SaleActionRequestedReturnItemRequest>();

        if (string.IsNullOrWhiteSpace(entity.RequestedReturnItemsJson))
        {
            return false;
        }

        try
        {
            requestedReturnItems =
                JsonSerializer.Deserialize<List<SaleActionRequestedReturnItemRequest>>(entity.RequestedReturnItemsJson) ?? new();
            requestedReturnItems = requestedReturnItems.Where(x => x.Quantity > 0).ToList();
            return requestedReturnItems.Count > 0;
        }
        catch (JsonException)
        {
            throw new AppException("The requested return item details could not be read.");
        }
    }
}
