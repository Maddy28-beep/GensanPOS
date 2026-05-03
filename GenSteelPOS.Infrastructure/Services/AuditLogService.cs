using GenSteelPOS.Application.Common.Interfaces;
using GenSteelPOS.Application.DTOs;
using GenSteelPOS.Application.Services;
using GenSteelPOS.Domain.Entities;

namespace GenSteelPOS.Infrastructure.Services;

public sealed class AuditLogService(
    IAuditLogRepository auditLogRepository,
    IUnitOfWork unitOfWork,
    ICurrentUserContext currentUserContext) : IAuditLogService
{
    public async Task<List<AuditLogDto>> GetAllAsync(CancellationToken cancellationToken = default) =>
        (await auditLogRepository.GetAllAsync(cancellationToken)).Select(x => x.ToDto()).ToList();

    public async Task CreateAsync(string action, string entityName, string entityId, string details, CancellationToken cancellationToken = default)
    {
        await CreateAsync(action, entityName, entityId, details, string.Empty, string.Empty, cancellationToken);
    }

    public async Task CreateAsync(string action, string entityName, string entityId, string details, string oldValue, string newValue, CancellationToken cancellationToken = default)
    {
        if (!ShouldSave(action, entityName))
        {
            return;
        }

        var cleanDetails = BuildReadableDetails(action, entityName, details);

        await auditLogRepository.AddAsync(new AuditLog
        {
            UserId = currentUserContext.UserId,
            Action = ToReadableAction(action),
            EntityName = entityName,
            EntityId = entityId,
            OldValue = CleanValue(oldValue),
            NewValue = CleanValue(newValue),
            Details = cleanDetails,
            IpAddress = currentUserContext.IpAddress
        }, cancellationToken);

        await unitOfWork.SaveChangesAsync(cancellationToken);
    }

    private static bool ShouldSave(string action, string entityName)
    {
        if (entityName is "Product" or "ProductUnit" or "User" or "Return" or "InventoryAdjustmentRequest" or "StockInRecord")
        {
            return true;
        }

        return action is "Login" or "AdjustStock" or "Cancelled" or "Refunded" or "Voided";
    }

    private static string ToReadableAction(string action) =>
        action switch
        {
            "Create" => "Created",
            "Update" => "Updated",
            "CreateInventoryAdjustmentRequest" => "Requested",
            "ApproveInventoryAdjustmentRequest" => "Approved",
            "RejectInventoryAdjustmentRequest" => "Rejected",
            "CreateStockInRequest" => "Requested Receiving",
            "ApproveStockInRequest" => "Approved Receiving",
            "RejectStockInRequest" => "Rejected Receiving",
            "AdjustStock" => "Adjusted Stock",
            "Cancelled" => "Cancelled Sale",
            "Refunded" => "Refunded Sale",
            "Voided" => "Voided Sale",
            "CreateReturn" => "Processed Return",
            "Login" => "Signed In",
            _ => action
        };

    private static string BuildReadableDetails(string action, string entityName, string details)
    {
        if (!LooksLikeUnclearNote(details))
        {
            return details.Trim();
        }

        var module = entityName switch
        {
            "Product" => "product record",
            "User" => "user account",
            "Sale" => "sale transaction",
            "Return" => "return transaction",
            "InventoryAdjustmentRequest" => "inventory adjustment request",
            _ => "system record"
        };

        return $"{ToReadableAction(action)} {module}.";
    }

    private static string CleanValue(string value) =>
        LooksLikeUnclearNote(value) ? string.Empty : value.Trim();

    private static bool LooksLikeUnclearNote(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return true;
        }

        var trimmed = value.Trim();
        if (trimmed.Length < 4)
        {
            return true;
        }

        var letters = trimmed.Where(char.IsLetter).ToArray();
        return letters.Length > 0 && letters.All(char.IsUpper) && trimmed.Length <= 8;
    }
}
