using GenSteelPOS.Application.DTOs;
using GenSteelPOS.Domain.Constants;
using GenSteelPOS.Domain.Entities;
using GenSteelPOS.Domain.Enums;
using System.Text.Json;

namespace GenSteelPOS.Infrastructure.Services;

internal static class MappingExtensions
{
    private static DateTime EnsureUtc(DateTime value) =>
        value.Kind == DateTimeKind.Utc ? value : DateTime.SpecifyKind(value, DateTimeKind.Utc);

    public static UserDto ToDto(this User entity) => new()
    {
        Id = entity.Id,
        FullName = entity.FullName,
        Username = entity.Username,
        Email = entity.Email,
        IsActive = entity.IsActive,
        RoleName = entity.Role?.Name ?? string.Empty
    };

    public static CategoryDto ToDto(this Category entity) => new()
    {
        Id = entity.Id,
        Name = entity.Name,
        Description = entity.Description,
        IsActive = entity.IsActive
    };

    public static ProductUnitDto ToDto(this ProductUnit entity) => new()
    {
        Id = entity.Id,
        Name = entity.Name,
        IsActive = entity.IsActive
    };

    public static ProductDto ToDto(this Product entity) => new()
    {
        Id = entity.Id,
        Sku = entity.Sku,
        Name = entity.Name,
        Description = entity.Description,
        CostPrice = entity.CostPrice,
        Price = entity.Price,
        Unit = entity.Unit,
        IsActive = entity.IsActive,
        CategoryName = entity.Category?.Name ?? string.Empty,
        QuantityOnHand = entity.Quantity,
        ReorderLevel = entity.Inventory?.ReorderLevel ?? 0,
        Location = entity.Inventory?.Location ?? string.Empty
    };

    public static InventoryDto ToDto(this Inventory entity) => new()
    {
        ProductId = entity.ProductId,
        ProductName = entity.Product?.Name ?? string.Empty,
        Sku = entity.Product?.Sku ?? string.Empty,
        CategoryName = entity.Product?.Category?.Name ?? string.Empty,
        QuantityOnHand = entity.Product?.Quantity ?? entity.QuantityOnHand,
        ReorderLevel = entity.ReorderLevel,
        Location = entity.Location,
        IsActiveProduct = entity.Product?.IsActive ?? false,
        StockStatus = (entity.Product?.Quantity ?? entity.QuantityOnHand) <= 0
            ? "OutOfStock"
            : (entity.Product?.Quantity ?? entity.QuantityOnHand) <= InventoryRules.LowStockThreshold
                ? "LowStock"
                : "InStock"
    };

    public static SupplierDto ToDto(this Supplier entity) => new()
    {
        Id = entity.Id,
        Name = entity.Name,
        ContactPerson = entity.ContactPerson,
        ContactNumber = entity.ContactNumber,
        Email = entity.Email,
        Address = entity.Address,
        IsActive = entity.IsActive
    };

    public static SaleDto ToDto(this Sale entity)
    {
        var totalReturnedAmount = entity.Returns.Sum(x => x.TotalReturnAmount);
        var itemDtos = entity.SaleItems.Select(x =>
        {
            var returnedQuantity = x.ReturnItems.Sum(r => r.Quantity);
            var remainingQuantity = Math.Max(0, x.Quantity - returnedQuantity);
            var costPrice = ResolveCostPrice(x);
            var costOfGoodsSold = remainingQuantity * costPrice;
            var lineRevenue = remainingQuantity * x.UnitPrice;

            return new SaleItemDto
            {
                SaleItemId = x.Id,
                ProductId = x.ProductId,
                ProductName = string.IsNullOrWhiteSpace(x.ProductNameSnapshot) ? x.Product?.Name ?? string.Empty : x.ProductNameSnapshot,
                Quantity = x.Quantity,
                UnitPrice = x.UnitPrice,
                CostPrice = costPrice,
                LineTotal = x.LineTotal,
                CostOfGoodsSold = costOfGoodsSold,
                GrossProfit = lineRevenue - costOfGoodsSold,
                ReturnedQuantity = returnedQuantity,
                RemainingReturnableQuantity = remainingQuantity
            };
        }).ToList();
        var costOfGoodsSold = itemDtos.Sum(x => x.CostOfGoodsSold);
        var netSalesExcludingTax = entity.TotalAmount - totalReturnedAmount - entity.TaxAmount;
        var grossProfit = netSalesExcludingTax - costOfGoodsSold;

        return new SaleDto
        {
            Id = entity.Id,
            SaleNumber = entity.SaleNumber,
            CashierName = entity.Cashier?.FullName ?? string.Empty,
            ProcessedByName = entity.Cashier?.FullName ?? string.Empty,
            ProcessedByRole = FormatSalesProcessorRole(entity.Cashier?.Role?.Name),
            CustomerName = entity.CustomerName,
            CustomerAddress = entity.CustomerAddress,
            CustomerTin = entity.CustomerTin,
            Remarks = entity.Remarks,
            PoNumber = entity.PoNumber,
            Terms = entity.Terms,
            Subtotal = entity.Subtotal,
            DiscountAmount = entity.DiscountAmount,
            TaxAmount = entity.TaxAmount,
            TotalAmount = entity.TotalAmount,
            AmountPaid = entity.AmountPaid,
            ChangeDue = entity.ChangeDue,
            CostOfGoodsSold = costOfGoodsSold,
            GrossProfit = grossProfit,
            ProfitMarginPercent = netSalesExcludingTax <= 0 ? 0 : grossProfit / netSalesExcludingTax * 100,
            Status = entity.Status.ToString(),
            CreatedAtUtc = EnsureUtc(entity.CreatedAtUtc),
            TotalReturnedAmount = totalReturnedAmount,
            Items = itemDtos,
            Payments = entity.Payments.Select(x => new PaymentDto
            {
                PaymentMethod = x.PaymentMethod.ToString(),
                Amount = x.Amount,
                ReferenceNumber = x.ReferenceNumber,
                BankName = x.BankName,
                BankBranch = x.BankBranch,
                CheckNumber = x.CheckNumber,
                CheckDate = x.CheckDate,
                DueDays = x.DueDays,
                Details = x.Details
            }).ToList(),
            Returns = entity.Returns.Select(x => x.ToDto()).ToList()
        };
    }

    private static decimal ResolveCostPrice(SaleItem item) =>
        item.CostPriceSnapshot > 0 ? item.CostPriceSnapshot : item.Product?.CostPrice ?? 0m;

    private static string FormatSalesProcessorRole(string? roleName) =>
        roleName == AppRoles.SuperAdmin ? "Owner" : "Cashier";

    public static SalesOrderDto ToDto(this SalesOrder entity) => new()
    {
        Id = entity.Id,
        OrderNumber = entity.OrderNumber,
        CustomerName = entity.CustomerName,
        CustomerContact = entity.CustomerContact,
        CustomerAddress = entity.CustomerAddress,
        Remarks = entity.Remarks,
        CreatedByName = entity.CreatedByUser?.FullName ?? string.Empty,
        Subtotal = entity.Subtotal,
        DiscountAmount = entity.DiscountAmount,
        TaxAmount = entity.TaxAmount,
        TotalAmount = entity.TotalAmount,
        Status = entity.Status.ToString(),
        CreatedAtUtc = EnsureUtc(entity.CreatedAtUtc),
        ConvertedSaleId = entity.ConvertedSaleId,
        ConvertedSaleNumber = entity.ConvertedSale?.SaleNumber ?? string.Empty,
        Items = entity.Items.Select(x => new SalesOrderItemDto
        {
            ProductId = x.ProductId,
            ProductName = x.Product?.Name ?? string.Empty,
            Quantity = x.Quantity,
            UnitPrice = x.UnitPrice,
            LineTotal = x.LineTotal
        }).ToList()
    };

    public static StockInRecordDto ToDto(this StockInRecord entity) => new()
    {
        Id = entity.Id,
        ReferenceNumber = entity.ReferenceNumber,
        ContainerNumber = entity.ContainerNumber,
        StockNumber = entity.StockNumber,
        ProductReferenceNumber = entity.ProductReferenceNumber,
        SupplierName = entity.Supplier?.Name ?? string.Empty,
        ReceivedByName = entity.ReceivedByUser?.FullName ?? string.Empty,
        ReviewedByName = entity.ReviewedByUser?.FullName ?? string.Empty,
        ReceivedDateUtc = EnsureUtc(entity.ReceivedDateUtc),
        ReviewedAtUtc = entity.ReviewedAtUtc.HasValue ? EnsureUtc(entity.ReviewedAtUtc.Value) : null,
        Status = entity.Status.ToString(),
        Remarks = entity.Remarks,
        ReviewNotes = entity.ReviewNotes,
        Items = entity.Items.Select(x => new StockInItemDto
        {
            ProductId = x.ProductId,
            ProductName = x.Product?.Name ?? string.Empty,
            Quantity = x.Quantity,
            UnitCost = x.UnitCost
        }).ToList()
    };

    public static PurchaseOrderDto ToDto(this PurchaseOrder entity) => new()
    {
        Id = entity.Id,
        OrderNumber = entity.OrderNumber,
        SupplierName = entity.Supplier?.Name ?? string.Empty,
        CreatedByName = entity.CreatedByUser?.FullName ?? string.Empty,
        Remarks = entity.Remarks,
        TotalEstimatedCost = entity.TotalEstimatedCost,
        Status = entity.Status.ToString(),
        CreatedAtUtc = EnsureUtc(entity.CreatedAtUtc),
        ReceivedStockInRecordId = entity.ReceivedStockInRecordId,
        ReceivedStockInReferenceNumber = entity.ReceivedStockInRecord?.ReferenceNumber ?? string.Empty,
        Items = entity.Items.Select(x => new PurchaseOrderItemDto
        {
            ProductId = x.ProductId,
            ProductName = x.Product?.Name ?? string.Empty,
            Quantity = x.Quantity,
            UnitCost = x.UnitCost,
            LineTotal = x.LineTotal
        }).ToList()
    };

    public static AuditLogDto ToDto(this AuditLog entity) => new()
    {
        Id = entity.Id,
        Action = entity.Action,
        EntityName = entity.EntityName,
        EntityId = entity.EntityId,
        Module = FormatAuditModule(entity.EntityName),
        Record = string.IsNullOrWhiteSpace(entity.EntityId) ? "-" : $"#{entity.EntityId}",
        OldValue = string.IsNullOrWhiteSpace(entity.OldValue) ? "-" : entity.OldValue,
        NewValue = string.IsNullOrWhiteSpace(entity.NewValue) ? "-" : entity.NewValue,
        Details = FormatAuditDetails(entity),
        Username = entity.User?.FullName ?? entity.User?.Username ?? "System",
        Role = entity.User?.Role?.Name ?? "System",
        IpAddress = entity.IpAddress,
        CreatedAtUtc = EnsureUtc(entity.CreatedAtUtc)
    };

    public static StockMovementDto ToDto(this StockMovement entity) => new()
    {
        Id = entity.Id,
        ProductId = entity.ProductId,
        ProductName = entity.Product?.Name ?? string.Empty,
        Sku = entity.Product?.Sku ?? string.Empty,
        MovementType = entity.MovementType.ToString(),
        QuantityChanged = entity.QuantityChanged,
        PreviousQuantity = entity.PreviousQuantity,
        NewQuantity = entity.NewQuantity,
        ReferenceNo = entity.ReferenceNo,
        Remarks = entity.Remarks,
        PerformedByName = entity.PerformedByUser?.FullName ?? "System",
        CreatedAtUtc = EnsureUtc(entity.CreatedAtUtc)
    };

    public static SaleActionRequestDto ToDto(this SaleActionRequest entity) => new()
    {
        Id = entity.Id,
        SaleId = entity.SaleId,
        SaleNumber = entity.Sale?.SaleNumber ?? string.Empty,
        CashierName = entity.Sale?.Cashier?.FullName ?? string.Empty,
        SaleTotalAmount = entity.Sale?.TotalAmount ?? 0,
        SaleStatus = entity.Sale?.Status.ToString() ?? string.Empty,
        RequestType = entity.RequestType.ToString(),
        Status = entity.Status.ToString(),
        RequestReason = entity.RequestReason,
        ReviewNotes = entity.ReviewNotes,
        RequestedByName = entity.RequestedByUser?.FullName ?? string.Empty,
        ReviewedByName = entity.ReviewedByUser?.FullName ?? string.Empty,
        CreatedAtUtc = EnsureUtc(entity.CreatedAtUtc),
        ReviewedAtUtc = entity.ReviewedAtUtc.HasValue ? EnsureUtc(entity.ReviewedAtUtc.Value) : null,
        RequestedReturnItems = MapRequestedReturnItems(entity)
    };

    private static List<SaleActionRequestedReturnItemDto> MapRequestedReturnItems(SaleActionRequest entity)
    {
        if (string.IsNullOrWhiteSpace(entity.RequestedReturnItemsJson))
        {
            return new List<SaleActionRequestedReturnItemDto>();
        }

        try
        {
            var items = JsonSerializer.Deserialize<List<SaleActionRequestedReturnItemRequest>>(entity.RequestedReturnItemsJson) ?? new();
            return items.Select(item =>
            {
                var saleItem = entity.Sale?.SaleItems.FirstOrDefault(x => x.Id == item.SaleItemId);
                var remaining = saleItem is null
                    ? item.Quantity
                    : Math.Max(0, saleItem.Quantity - saleItem.ReturnItems.Sum(x => x.Quantity));

                return new SaleActionRequestedReturnItemDto
                {
                    SaleItemId = item.SaleItemId,
                    ProductName = saleItem is null
                        ? $"Sale item {item.SaleItemId}"
                        : string.IsNullOrWhiteSpace(saleItem.ProductNameSnapshot)
                            ? saleItem.Product?.Name ?? string.Empty
                            : saleItem.ProductNameSnapshot,
                    Quantity = item.Quantity,
                    MaxQuantity = remaining,
                    Condition = item.Condition.ToString(),
                    Remarks = item.Remarks
                };
            }).ToList();
        }
        catch (JsonException)
        {
            return new List<SaleActionRequestedReturnItemDto>();
        }
    }

    private static string FormatAuditModule(string entityName) =>
        entityName switch
        {
            "Product" => "Products",
            "ProductUnit" => "Product Units",
            "User" => "Users",
            "Sale" => "Sales",
            "Return" or "ReturnRecord" => "Returns",
            "InventoryAdjustmentRequest" => "Inventory Requests",
            "StockInRecord" => "Receiving",
            "Category" => "Products",
            _ => string.IsNullOrWhiteSpace(entityName) ? "System" : entityName
        };

    private static string FormatAuditDetails(AuditLog entity)
    {
        if (!string.IsNullOrWhiteSpace(entity.Details) && !LooksLikeUnclearNote(entity.Details))
        {
            return entity.Details;
        }

        var module = FormatAuditModule(entity.EntityName);
        var action = FormatAuditAction(entity.Action);
        return $"{action} in {module}.";
    }

    private static string FormatAuditAction(string action) =>
        action switch
        {
            "Create" => "Created record",
            "Update" => "Updated record",
            "CreateInventoryAdjustmentRequest" => "Created inventory adjustment request",
            "ApproveInventoryAdjustmentRequest" => "Approved inventory adjustment request",
            "RejectInventoryAdjustmentRequest" => "Rejected inventory adjustment request",
            "CreateStockInRequest" => "Created receiving request",
            "ApproveStockInRequest" => "Approved receiving request",
            "RejectStockInRequest" => "Rejected receiving request",
            "AdjustStock" => "Updated stock directly",
            "Cancelled" => "Cancelled sale",
            "Refunded" => "Refunded sale",
            "Voided" => "Voided sale",
            "CreateReturn" => "Processed return",
            "Login" => "Signed in",
            _ => action
        };

    private static bool LooksLikeUnclearNote(string value)
    {
        var trimmed = value.Trim();
        if (trimmed.Length < 4)
        {
            return true;
        }

        var letters = trimmed.Where(char.IsLetter).ToArray();
        return letters.Length > 0 && letters.All(char.IsUpper) && trimmed.Length <= 8;
    }

    public static ReturnDto ToDto(this ReturnRecord entity) => new()
    {
        Id = entity.Id,
        ReturnNumber = entity.ReturnNumber,
        SaleId = entity.SaleId,
        SaleNumber = entity.Sale?.SaleNumber ?? string.Empty,
        ProcessedByName = entity.ProcessedByUser?.FullName ?? string.Empty,
        TotalReturnAmount = entity.TotalReturnAmount,
        Remarks = entity.Remarks,
        CreatedAtUtc = EnsureUtc(entity.CreatedAtUtc),
        Items = entity.Items.Select(x => new ReturnItemDto
        {
            SaleItemId = x.SaleItemId,
            ProductId = x.ProductId,
            ProductName = string.IsNullOrWhiteSpace(x.SaleItem?.ProductNameSnapshot) ? x.Product?.Name ?? string.Empty : x.SaleItem.ProductNameSnapshot,
            Quantity = x.Quantity,
            UnitPrice = x.UnitPrice,
            ReturnAmount = x.ReturnAmount,
            Condition = x.Condition.ToString(),
            Remarks = x.Remarks
        }).ToList()
    };
}
