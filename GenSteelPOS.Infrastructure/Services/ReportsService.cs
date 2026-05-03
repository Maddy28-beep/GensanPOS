using GenSteelPOS.Application.Common.Exceptions;
using GenSteelPOS.Application.Common.Interfaces;
using GenSteelPOS.Application.DTOs;
using GenSteelPOS.Application.Services;
using GenSteelPOS.Domain.Constants;
using GenSteelPOS.Domain.Entities;
using GenSteelPOS.Domain.Enums;
using GenSteelPOS.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace GenSteelPOS.Infrastructure.Services;

public sealed class ReportsService(AppDbContext context, ICurrentUserContext currentUserContext) : IReportsService
{
    public async Task<DashboardReportDto> GetDashboardAsync(CancellationToken cancellationToken = default)
    {
        var today = DateTime.UtcNow.Date;
        var monthStart = new DateTime(today.Year, today.Month, 1);
        var salesQuery = ApplySaleVisibility(context.Sales.AsQueryable());
        var returnsQuery = ApplyReturnVisibility(context.Returns.AsQueryable());
        var grossToday = await salesQuery
            .Where(x => x.Status != SaleStatus.Cancelled && x.Status != SaleStatus.Voided && x.CreatedAtUtc >= today)
            .SumAsync(x => (decimal?)x.TotalAmount, cancellationToken) ?? 0;
        var returnsToday = await returnsQuery
            .Where(x => x.CreatedAtUtc >= today)
            .SumAsync(x => (decimal?)x.TotalReturnAmount, cancellationToken) ?? 0;
        var grossThisMonth = await salesQuery
            .Where(x => x.Status != SaleStatus.Cancelled && x.Status != SaleStatus.Voided && x.CreatedAtUtc >= monthStart)
            .SumAsync(x => (decimal?)x.TotalAmount, cancellationToken) ?? 0;
        var returnsThisMonth = await returnsQuery
            .Where(x => x.CreatedAtUtc >= monthStart)
            .SumAsync(x => (decimal?)x.TotalReturnAmount, cancellationToken) ?? 0;

        return new DashboardReportDto
        {
            TotalSalesToday = grossToday,
            TotalReturnsToday = returnsToday,
            NetSalesToday = grossToday - returnsToday,
            TotalTransactionsToday = await salesQuery.CountAsync(x => x.Status != SaleStatus.Cancelled && x.Status != SaleStatus.Voided && x.CreatedAtUtc >= today, cancellationToken),
            LowStockCount = await context.Products.CountAsync(x => x.IsActive && x.Quantity > 0 && x.Quantity <= InventoryRules.LowStockThreshold, cancellationToken),
            ActiveProductsCount = await context.Products.CountAsync(x => x.IsActive, cancellationToken),
            TotalInventoryValue = currentUserContext.Role == AppRoles.SuperAdmin
                ? await context.Products.SumAsync(x => (decimal?)(x.Quantity * x.CostPrice), cancellationToken) ?? 0
                : 0,
            TotalSalesThisMonth = grossThisMonth,
            TotalReturnsThisMonth = returnsThisMonth,
            NetSalesThisMonth = grossThisMonth - returnsThisMonth
        };
    }

    public async Task<SalesSummaryDto> GetSalesSummaryAsync(DateTime? fromUtc, DateTime? toUtc, CancellationToken cancellationToken = default)
    {
        var query = ApplySaleVisibility(context.Sales)
            .Include(x => x.SaleItems).ThenInclude(x => x.Product)
            .Include(x => x.SaleItems).ThenInclude(x => x.ReturnItems)
            .Where(x => x.Status != SaleStatus.Cancelled && x.Status != SaleStatus.Voided)
            .AsQueryable();
        var returnsQuery = ApplyReturnVisibility(context.Returns)
            .Include(x => x.Items).ThenInclude(x => x.SaleItem).ThenInclude(x => x!.Product)
            .AsQueryable();

        if (fromUtc.HasValue)
        {
            query = query.Where(x => x.CreatedAtUtc >= fromUtc.Value);
            returnsQuery = returnsQuery.Where(x => x.CreatedAtUtc >= fromUtc.Value);
        }

        if (toUtc.HasValue)
        {
            query = query.Where(x => x.CreatedAtUtc <= toUtc.Value);
            returnsQuery = returnsQuery.Where(x => x.CreatedAtUtc <= toUtc.Value);
        }

        var sales = await query.ToListAsync(cancellationToken);
        var grossSales = sales.Sum(x => x.TotalAmount);
        var returns = await returnsQuery.ToListAsync(cancellationToken);
        var returnsAmount = returns.Sum(x => x.TotalReturnAmount);
        var totalTax = sales.Sum(x => x.TaxAmount);
        var netSales = grossSales - returnsAmount;
        var netSalesExcludingTax = netSales - totalTax;
        var costOfGoodsSold = sales.Sum(CalculateOriginalSaleCostOfGoodsSold) - returns.Sum(CalculateReturnCostOfGoodsSold);
        var grossProfit = netSalesExcludingTax - costOfGoodsSold;

        return new SalesSummaryDto
        {
            GrossSales = grossSales,
            ReturnsAmount = returnsAmount,
            NetSales = netSales,
            TotalDiscount = sales.Sum(x => x.DiscountAmount),
            TotalTax = totalTax,
            NetSalesExcludingTax = netSalesExcludingTax,
            CostOfGoodsSold = costOfGoodsSold,
            GrossProfit = grossProfit,
            ProfitMarginPercent = netSalesExcludingTax <= 0 ? 0 : grossProfit / netSalesExcludingTax * 100,
            TransactionCount = sales.Count,
            TotalInventoryValue = await context.Products.SumAsync(x => (decimal?)(x.Quantity * x.CostPrice), cancellationToken) ?? 0
        };
    }

    public async Task<List<ProductSalesProfitReportRowDto>> GetProductSalesProfitAsync(DateTime? fromUtc, DateTime? toUtc, CancellationToken cancellationToken = default)
    {
        var salesRowsQuery =
            from sale in ApplySaleVisibility(context.Sales)
            join item in context.SaleItems on sale.Id equals item.SaleId
            join product in context.Products on item.ProductId equals product.Id
            where sale.Status != SaleStatus.Cancelled && sale.Status != SaleStatus.Voided
            select new
            {
                sale.CreatedAtUtc,
                product.Id,
                product.Name,
                product.CostPrice,
                item.Quantity,
                item.UnitPrice,
                item.CostPriceSnapshot
            };

        if (fromUtc.HasValue)
        {
            salesRowsQuery = salesRowsQuery.Where(x => x.CreatedAtUtc >= fromUtc.Value);
        }

        if (toUtc.HasValue)
        {
            salesRowsQuery = salesRowsQuery.Where(x => x.CreatedAtUtc <= toUtc.Value);
        }

        var returnRowsQuery =
            from returnRecord in ApplyReturnVisibility(context.Returns)
            join returnItem in context.ReturnItems on returnRecord.Id equals returnItem.ReturnRecordId
            join saleItem in context.SaleItems on returnItem.SaleItemId equals saleItem.Id
            join product in context.Products on returnItem.ProductId equals product.Id
            select new
            {
                returnRecord.CreatedAtUtc,
                product.Id,
                product.Name,
                product.CostPrice,
                returnItem.Quantity,
                returnItem.UnitPrice,
                saleItem.CostPriceSnapshot
            };

        if (fromUtc.HasValue)
        {
            returnRowsQuery = returnRowsQuery.Where(x => x.CreatedAtUtc >= fromUtc.Value);
        }

        if (toUtc.HasValue)
        {
            returnRowsQuery = returnRowsQuery.Where(x => x.CreatedAtUtc <= toUtc.Value);
        }

        var saleRows = await salesRowsQuery.ToListAsync(cancellationToken);
        var returnRows = await returnRowsQuery.ToListAsync(cancellationToken);

        return saleRows
            .Select(x => new
            {
                x.Id,
                x.Name,
                Quantity = x.Quantity,
                Sales = x.Quantity * x.UnitPrice,
                Cost = x.Quantity * (x.CostPriceSnapshot > 0 ? x.CostPriceSnapshot : x.CostPrice)
            })
            .Concat(returnRows.Select(x => new
            {
                x.Id,
                x.Name,
                Quantity = -x.Quantity,
                Sales = -(x.Quantity * x.UnitPrice),
                Cost = -(x.Quantity * (x.CostPriceSnapshot > 0 ? x.CostPriceSnapshot : x.CostPrice))
            }))
            .GroupBy(x => new { x.Id, x.Name })
            .Select(g =>
            {
                var totalSales = g.Sum(x => x.Sales);
                var totalCost = g.Sum(x => x.Cost);
                return new ProductSalesProfitReportRowDto
                {
                    ProductId = g.Key.Id,
                    ProductName = g.Key.Name,
                    TotalQuantitySold = g.Sum(x => x.Quantity),
                    TotalSales = totalSales,
                    TotalCost = totalCost,
                    Profit = totalSales - totalCost
                };
            })
            .Where(x => x.TotalQuantitySold != 0 || x.TotalSales != 0 || x.TotalCost != 0)
            .OrderByDescending(x => x.Profit)
            .ThenBy(x => x.ProductName)
            .ToList();
    }

    public async Task<List<InventoryValueReportRowDto>> GetInventoryValueAsync(CancellationToken cancellationToken = default)
    {
        return await context.Products
            .Include(x => x.Category)
            .OrderBy(x => x.Name)
            .Select(x => new InventoryValueReportRowDto
            {
                ProductId = x.Id,
                ProductName = x.Name,
                CategoryName = x.Category != null ? x.Category.Name : string.Empty,
                CurrentStock = x.Quantity,
                CostPrice = x.CostPrice,
                SellingPrice = x.Price,
                InventoryValue = x.Quantity * x.CostPrice
            })
            .ToListAsync(cancellationToken);
    }

    public async Task<List<SalesTransactionReportRowDto>> GetSalesTransactionsAsync(DateTime? fromUtc, DateTime? toUtc, CancellationToken cancellationToken = default)
    {
        var query = ApplySaleVisibility(context.Sales)
            .Include(x => x.Cashier)
            .Include(x => x.Payments)
            .Include(x => x.Returns)
            .Include(x => x.SaleItems).ThenInclude(x => x.Product)
            .Include(x => x.SaleItems).ThenInclude(x => x.ReturnItems)
            .Where(x => x.Status != SaleStatus.Cancelled && x.Status != SaleStatus.Voided)
            .AsQueryable();

        if (fromUtc.HasValue)
            query = query.Where(x => x.CreatedAtUtc >= fromUtc.Value);

        if (toUtc.HasValue)
            query = query.Where(x => x.CreatedAtUtc <= toUtc.Value);

        var sales = await query
            .OrderByDescending(x => x.CreatedAtUtc)
            .ToListAsync(cancellationToken);

        return sales.Select(sale =>
        {
            var returnsAmount = sale.Returns.Sum(x => x.TotalReturnAmount);
            var costOfGoodsSold = CalculateSaleCostOfGoodsSold(sale);
            var netAmount = sale.TotalAmount - returnsAmount;
            var profit = netAmount - sale.TaxAmount - costOfGoodsSold;

            return new SalesTransactionReportRowDto
            {
                SaleId = sale.Id,
                SaleNumber = sale.SaleNumber,
                CreatedAtUtc = sale.CreatedAtUtc,
                CashierName = sale.Cashier?.FullName ?? "System",
                PaymentMethods = string.Join(", ", sale.Payments.Select(x => FormatPaymentMethod(x.PaymentMethod)).Distinct()),
                TotalAmount = sale.TotalAmount,
                ReturnsAmount = returnsAmount,
                NetAmount = netAmount,
                CostOfGoodsSold = costOfGoodsSold,
                Profit = profit,
                Status = sale.Status.ToString()
            };
        }).ToList();
    }

    public async Task<byte[]> GetSalesPdfAsync(SalesReportPdfRequest request, CancellationToken cancellationToken = default)
    {
        var saleEntities = await BuildSalesReportQuery(request)
            .OrderByDescending(x => x.CreatedAtUtc)
            .ToListAsync(cancellationToken);
        var sales = saleEntities
            .Select(x => new SalesPdfRow(
                x.SaleNumber,
                x.CreatedAtUtc,
                x.Cashier != null ? x.Cashier.FullName : "System",
                string.Join(", ", x.Payments.Select(p => FormatPaymentMethod(p.PaymentMethod)).Distinct()),
                x.TotalAmount,
                x.Status.ToString(),
                x.DiscountAmount,
                x.TaxAmount,
                x.Returns.Sum(r => r.TotalReturnAmount),
                x.SaleItems
                    .OrderBy(i => i.Id)
                    .Select(i => new SalesPdfItemRow(
                        !string.IsNullOrWhiteSpace(i.SkuSnapshot) ? i.SkuSnapshot : i.Product?.Sku ?? string.Empty,
                        !string.IsNullOrWhiteSpace(i.ProductNameSnapshot) ? i.ProductNameSnapshot : i.Product?.Name ?? "Deleted product",
                        i.Quantity,
                        i.UnitPrice,
                        i.LineTotal,
                        ResolveCostPrice(i),
                        CalculateSaleItemCostOfGoodsSold(i),
                        CalculateSaleItemGrossProfit(i)))
                    .ToList()))
            .ToList();

        var grossSales = sales.Sum(x => x.TotalAmount);
        var refunds = sales.Sum(x => x.ReturnsAmount);
        var discounts = sales.Sum(x => x.DiscountAmount);
        var taxes = sales.Sum(x => x.TaxAmount);
        var netSales = grossSales - refunds;
        var totalCostOfGoodsSold = sales.Sum(x => x.Items.Sum(i => i.CostOfGoodsSold));
        var grossProfit = netSales - taxes - totalCostOfGoodsSold;
        var transactionCount = sales.Count;

        return Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Margin(24);
                page.Size(PageSizes.A4.Landscape());
                page.DefaultTextStyle(x => x.FontSize(10));

                page.Header().Column(column =>
                {
                    column.Item().Text("Gen Steel POS").SemiBold().FontSize(18);
                    column.Item().Text("Sales Report").FontSize(14);
                    column.Item().Text(BuildSalesFilterSummary(request)).FontColor(Colors.Grey.Darken1);
                });

                page.Content().Column(column =>
                {
                    column.Spacing(12);
                    column.Item().Row(row =>
                    {
                        row.RelativeItem().Element(CardStyle).Column(card =>
                        {
                            card.Item().Text("Gross Sales").FontColor(Colors.Grey.Darken1);
                            card.Item().Text(FormatCurrency(grossSales)).SemiBold();
                        });
                        row.RelativeItem().Element(CardStyle).Column(card =>
                        {
                            card.Item().Text("Refunds").FontColor(Colors.Grey.Darken1);
                            card.Item().Text(FormatCurrency(refunds)).SemiBold();
                        });
                        row.RelativeItem().Element(CardStyle).Column(card =>
                        {
                            card.Item().Text("Discounts").FontColor(Colors.Grey.Darken1);
                            card.Item().Text(FormatCurrency(discounts)).SemiBold();
                        });
                        row.RelativeItem().Element(CardStyle).Column(card =>
                        {
                            card.Item().Text("Net Sales").FontColor(Colors.Grey.Darken1);
                            card.Item().Text(FormatCurrency(netSales)).SemiBold();
                        });
                        row.RelativeItem().Element(CardStyle).Column(card =>
                        {
                            card.Item().Text("COGS").FontColor(Colors.Grey.Darken1);
                            card.Item().Text(FormatCurrency(totalCostOfGoodsSold)).SemiBold();
                        });
                        row.RelativeItem().Element(CardStyle).Column(card =>
                        {
                            card.Item().Text("Gross Profit").FontColor(Colors.Grey.Darken1);
                            card.Item().Text(FormatCurrency(grossProfit)).SemiBold();
                        });
                        row.RelativeItem().Element(CardStyle).Column(card =>
                        {
                            card.Item().Text("Transactions").FontColor(Colors.Grey.Darken1);
                            card.Item().Text(transactionCount.ToString()).SemiBold();
                        });
                    });

                    column.Item().Text("Detailed Sold Items").SemiBold().FontSize(12);
                    column.Item().Table(table =>
                    {
                        table.ColumnsDefinition(columns =>
                        {
                            columns.RelativeColumn(1.2f);
                            columns.RelativeColumn(1.3f);
                            columns.RelativeColumn(1f);
                            columns.RelativeColumn(2f);
                            columns.RelativeColumn(.7f);
                            columns.RelativeColumn(1f);
                            columns.RelativeColumn(1f);
                            columns.RelativeColumn(1f);
                            columns.RelativeColumn(1f);
                            columns.RelativeColumn(1.2f);
                            columns.RelativeColumn(1f);
                        });

                        table.Header(header =>
                        {
                            HeaderCell(header, "Date");
                            HeaderCell(header, "Sale No.");
                            HeaderCell(header, "Code");
                            HeaderCell(header, "Product");
                            HeaderCell(header, "Qty");
                            HeaderCell(header, "Unit Price");
                            HeaderCell(header, "Line Total");
                            HeaderCell(header, "Cost");
                            HeaderCell(header, "Profit");
                            HeaderCell(header, "Cashier/Owner");
                            HeaderCell(header, "Status");
                        });

                        foreach (var sale in sales)
                        {
                            if (sale.Items.Count == 0)
                            {
                                BodyCell(table, sale.CreatedAtUtc.ToLocalTime().ToString("yyyy-MM-dd HH:mm"));
                                BodyCell(table, sale.SaleNumber);
                                BodyCell(table, string.Empty);
                                BodyCell(table, "No item lines recorded");
                                BodyCell(table, string.Empty);
                                BodyCell(table, string.Empty);
                                BodyCell(table, FormatCurrency(sale.TotalAmount));
                                BodyCell(table, string.Empty);
                                BodyCell(table, string.Empty);
                                BodyCell(table, sale.CashierName);
                                BodyCell(table, sale.Status);
                                continue;
                            }

                            foreach (var item in sale.Items)
                            {
                                BodyCell(table, sale.CreatedAtUtc.ToLocalTime().ToString("yyyy-MM-dd HH:mm"));
                                BodyCell(table, sale.SaleNumber);
                                BodyCell(table, item.ProductCode);
                                BodyCell(table, item.ProductName);
                                BodyCell(table, item.Quantity.ToString("0.##"));
                                BodyCell(table, FormatCurrency(item.UnitPrice));
                                BodyCell(table, FormatCurrency(item.LineTotal));
                                BodyCell(table, FormatCurrency(item.CostOfGoodsSold));
                                BodyCell(table, FormatCurrency(item.GrossProfit));
                                BodyCell(table, sale.CashierName);
                                BodyCell(table, sale.Status);
                            }
                        }
                    });

                    column.Item().Text("Receipt Totals").SemiBold().FontSize(12);
                    column.Item().Table(table =>
                    {
                        table.ColumnsDefinition(columns =>
                        {
                            columns.RelativeColumn(1.5f);
                            columns.RelativeColumn(1.2f);
                            columns.RelativeColumn(1.2f);
                            columns.RelativeColumn(1.1f);
                            columns.RelativeColumn(1f);
                            columns.RelativeColumn(1f);
                        });

                        table.Header(header =>
                        {
                            HeaderCell(header, "Sale No.");
                            HeaderCell(header, "Payment");
                            HeaderCell(header, "Total");
                            HeaderCell(header, "Refunds");
                            HeaderCell(header, "Discount");
                            HeaderCell(header, "Status");
                        });

                        foreach (var sale in sales)
                        {
                            BodyCell(table, sale.SaleNumber);
                            BodyCell(table, sale.PaymentMethod);
                            BodyCell(table, FormatCurrency(sale.TotalAmount));
                            BodyCell(table, FormatCurrency(sale.ReturnsAmount));
                            BodyCell(table, FormatCurrency(sale.DiscountAmount));
                            BodyCell(table, sale.Status);
                        }
                    });
                });

                page.Footer().AlignRight().Text(text =>
                {
                    text.Span("Generated ");
                    text.Span(DateTime.UtcNow.ToLocalTime().ToString("yyyy-MM-dd HH:mm"));
                });
            });
        }).GeneratePdf();
    }

    public async Task<byte[]> GetInventoryPdfAsync(InventoryReportPdfRequest request, CancellationToken cancellationToken = default)
    {
        var inventoryRequest = new InventoryQueryRequest
        {
            Page = 1,
            PageSize = 10000,
            Search = request.Search,
            Category = request.Category,
            Status = request.Status,
            Location = request.Location,
            SortBy = request.SortBy ?? "productName",
            SortOrder = request.SortOrder ?? "asc"
        };

        var inventoryQuery = BuildInventoryReportQuery(inventoryRequest);
        var items = await ApplyInventorySort(inventoryQuery, inventoryRequest.SortBy, inventoryRequest.SortOrder)
            .Select(x => new InventoryPdfRow(
                x.Product != null ? x.Product.Sku : string.Empty,
                x.Product != null ? x.Product.Name : string.Empty,
                x.Product != null && x.Product.Category != null ? x.Product.Category.Name : string.Empty,
                x.Product != null ? x.Product.Unit : string.Empty,
                x.QuantityOnHand,
                x.ReorderLevel,
                x.QuantityOnHand <= 0 ? "Out of Stock" : x.QuantityOnHand <= InventoryRules.LowStockThreshold ? "Low Stock" : "In Stock",
                x.QuantityOnHand * (x.Product != null ? x.Product.CostPrice : 0m)))
            .ToListAsync(cancellationToken);

        var totalProducts = items.Count;
        var lowStockCount = items.Count(x => x.StockStatus == "Low Stock");
        var outOfStockCount = items.Count(x => x.StockStatus == "Out of Stock");
        var totalInventoryValue = items.Sum(x => x.StockValue);

        return Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Margin(24);
                page.Size(PageSizes.A4.Landscape());
                page.DefaultTextStyle(x => x.FontSize(10));

                page.Header().Column(column =>
                {
                    column.Item().Text("Gen Steel POS").SemiBold().FontSize(18);
                    column.Item().Text("Inventory Report").FontSize(14);
                    column.Item().Text(BuildInventoryFilterSummary(request)).FontColor(Colors.Grey.Darken1);
                });

                page.Content().Column(column =>
                {
                    column.Spacing(12);
                    column.Item().Row(row =>
                    {
                        row.RelativeItem().Element(CardStyle).Column(card =>
                        {
                            card.Item().Text("Total Products").FontColor(Colors.Grey.Darken1);
                            card.Item().Text(totalProducts.ToString()).SemiBold();
                        });
                        row.RelativeItem().Element(CardStyle).Column(card =>
                        {
                            card.Item().Text("Low Stock").FontColor(Colors.Grey.Darken1);
                            card.Item().Text(lowStockCount.ToString()).SemiBold();
                        });
                        row.RelativeItem().Element(CardStyle).Column(card =>
                        {
                            card.Item().Text("Out of Stock").FontColor(Colors.Grey.Darken1);
                            card.Item().Text(outOfStockCount.ToString()).SemiBold();
                        });
                        row.RelativeItem().Element(CardStyle).Column(card =>
                        {
                            card.Item().Text("Inventory Value").FontColor(Colors.Grey.Darken1);
                            card.Item().Text(FormatCurrency(totalInventoryValue)).SemiBold();
                        });
                    });

                    column.Item().Table(table =>
                    {
                        table.ColumnsDefinition(columns =>
                        {
                            columns.RelativeColumn(1.1f);
                            columns.RelativeColumn(1.8f);
                            columns.RelativeColumn(1.1f);
                            columns.RelativeColumn(.8f);
                            columns.RelativeColumn(.9f);
                            columns.RelativeColumn(.9f);
                            columns.RelativeColumn(1f);
                            columns.RelativeColumn(1f);
                        });

                        table.Header(header =>
                        {
                            HeaderCell(header, "Product Code");
                            HeaderCell(header, "Product Name");
                            HeaderCell(header, "Category");
                            HeaderCell(header, "Unit");
                            HeaderCell(header, "Quantity");
                            HeaderCell(header, "Reorder");
                            HeaderCell(header, "Stock Status");
                            HeaderCell(header, "Stock Value");
                        });

                        foreach (var item in items)
                        {
                            BodyCell(table, item.ProductCode);
                            BodyCell(table, item.ProductName);
                            BodyCell(table, item.Category);
                            BodyCell(table, item.Unit);
                            BodyCell(table, item.Quantity.ToString("0.##"));
                            BodyCell(table, item.ReorderLevel.ToString("0.##"));
                            BodyCell(table, item.StockStatus);
                            BodyCell(table, FormatCurrency(item.StockValue));
                        }
                    });
                });

                page.Footer().AlignRight().Text(text =>
                {
                    text.Span("Generated ");
                    text.Span(DateTime.UtcNow.ToLocalTime().ToString("yyyy-MM-dd HH:mm"));
                });
            });
        }).GeneratePdf();
    }

    public async Task<byte[]> GetStockMovementsPdfAsync(StockMovementReportPdfRequest request, CancellationToken cancellationToken = default)
    {
        var movements = await BuildStockMovementReportQuery(request)
            .OrderByDescending(x => x.CreatedAtUtc)
            .Select(x => new StockMovementPdfRow(
                x.CreatedAtUtc,
                x.Product != null ? x.Product.Sku : string.Empty,
                x.Product != null ? x.Product.Name : string.Empty,
                x.MovementType.ToString(),
                x.QuantityChanged,
                x.PreviousQuantity,
                x.NewQuantity,
                x.ReferenceNo,
                x.PerformedByUser != null ? x.PerformedByUser.FullName : "System",
                x.Remarks))
            .ToListAsync(cancellationToken);

        var inbound = movements.Where(x => x.QuantityChanged > 0).Sum(x => x.QuantityChanged);
        var outbound = Math.Abs(movements.Where(x => x.QuantityChanged < 0).Sum(x => x.QuantityChanged));
        var adjustmentCount = movements.Count(x => x.MovementType == StockMovementType.StockAdjustment.ToString());

        return Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Margin(24);
                page.Size(PageSizes.A4.Landscape());
                page.DefaultTextStyle(x => x.FontSize(9));

                page.Header().Column(column =>
                {
                    column.Item().Text("Gen Steel POS").SemiBold().FontSize(18);
                    column.Item().Text("Stock Movement Report").FontSize(14);
                    column.Item().Text(BuildStockMovementFilterSummary(request)).FontColor(Colors.Grey.Darken1);
                });

                page.Content().Column(column =>
                {
                    column.Spacing(12);
                    column.Item().Row(row =>
                    {
                        row.RelativeItem().Element(CardStyle).Column(card =>
                        {
                            card.Item().Text("Movements").FontColor(Colors.Grey.Darken1);
                            card.Item().Text(movements.Count.ToString()).SemiBold();
                        });
                        row.RelativeItem().Element(CardStyle).Column(card =>
                        {
                            card.Item().Text("Inbound Qty").FontColor(Colors.Grey.Darken1);
                            card.Item().Text(inbound.ToString("0.##")).SemiBold();
                        });
                        row.RelativeItem().Element(CardStyle).Column(card =>
                        {
                            card.Item().Text("Outbound Qty").FontColor(Colors.Grey.Darken1);
                            card.Item().Text(outbound.ToString("0.##")).SemiBold();
                        });
                        row.RelativeItem().Element(CardStyle).Column(card =>
                        {
                            card.Item().Text("Manual Adjustments").FontColor(Colors.Grey.Darken1);
                            card.Item().Text(adjustmentCount.ToString()).SemiBold();
                        });
                    });

                    column.Item().Table(table =>
                    {
                        table.ColumnsDefinition(columns =>
                        {
                            columns.RelativeColumn(1.2f);
                            columns.RelativeColumn(1f);
                            columns.RelativeColumn(1.7f);
                            columns.RelativeColumn(1.1f);
                            columns.RelativeColumn(.8f);
                            columns.RelativeColumn(.8f);
                            columns.RelativeColumn(.8f);
                            columns.RelativeColumn(1.1f);
                            columns.RelativeColumn(1.1f);
                            columns.RelativeColumn(1.4f);
                        });

                        table.Header(header =>
                        {
                            HeaderCell(header, "Date");
                            HeaderCell(header, "Code");
                            HeaderCell(header, "Product");
                            HeaderCell(header, "Type");
                            HeaderCell(header, "Change");
                            HeaderCell(header, "Before");
                            HeaderCell(header, "After");
                            HeaderCell(header, "Reference");
                            HeaderCell(header, "By");
                            HeaderCell(header, "Remarks");
                        });

                        foreach (var movement in movements)
                        {
                            BodyCell(table, movement.CreatedAtUtc.ToLocalTime().ToString("yyyy-MM-dd HH:mm"));
                            BodyCell(table, movement.ProductCode);
                            BodyCell(table, movement.ProductName);
                            BodyCell(table, movement.MovementType);
                            BodyCell(table, movement.QuantityChanged.ToString("0.##"));
                            BodyCell(table, movement.PreviousQuantity.ToString("0.##"));
                            BodyCell(table, movement.NewQuantity.ToString("0.##"));
                            BodyCell(table, movement.ReferenceNo);
                            BodyCell(table, movement.PerformedByName);
                            BodyCell(table, movement.Remarks);
                        }
                    });
                });

                page.Footer().AlignRight().Text(text =>
                {
                    text.Span("Generated ");
                    text.Span(DateTime.UtcNow.ToLocalTime().ToString("yyyy-MM-dd HH:mm"));
                });
            });
        }).GeneratePdf();
    }

    private IQueryable<Sale> BuildSalesReportQuery(SalesReportPdfRequest request)
    {
        var query = ApplySaleVisibility(context.Sales)
            .Include(x => x.Cashier)
            .Include(x => x.Payments)
            .Include(x => x.Returns)
            .Include(x => x.SaleItems).ThenInclude(x => x.Product).ThenInclude(x => x!.Category)
            .Include(x => x.SaleItems).ThenInclude(x => x.ReturnItems)
            .AsQueryable();

        if (request.FromUtc.HasValue)
            query = query.Where(x => x.CreatedAtUtc >= request.FromUtc.Value);

        if (request.ToUtc.HasValue)
            query = query.Where(x => x.CreatedAtUtc <= request.ToUtc.Value);

        if (!string.IsNullOrWhiteSpace(request.Status))
        {
            var status = ParseEnumFilter<SaleStatus>(request.Status);
            if (status.HasValue)
                query = query.Where(x => x.Status == status.Value);
        }

        if (!string.IsNullOrWhiteSpace(request.Cashier))
        {
            var cashier = request.Cashier.Trim().ToLowerInvariant();
            query = query.Where(x =>
                x.Cashier != null &&
                (x.Cashier.FullName.ToLower().Contains(cashier) || x.Cashier.Username.ToLower().Contains(cashier)));
        }

        if (!string.IsNullOrWhiteSpace(request.PaymentMethod))
        {
            var paymentMethod = ParsePaymentMethodFilter(request.PaymentMethod);
            if (paymentMethod.HasValue)
                query = query.Where(x => x.Payments.Any(p => p.PaymentMethod == paymentMethod.Value));
        }

        if (!string.IsNullOrWhiteSpace(request.Category))
        {
            var category = request.Category.Trim().ToLowerInvariant();
            query = query.Where(x => x.SaleItems.Any(i => i.Product != null && i.Product.Category != null && i.Product.Category.Name.ToLower() == category));
        }

        return query;
    }

    private IQueryable<Sale> ApplySaleVisibility(IQueryable<Sale> query)
    {
        if (currentUserContext.Role == AppRoles.Admin)
        {
            var userId = currentUserContext.UserId
                ?? throw new AppException("Current user is not available.", 401);
            return query.Where(x => x.CashierId == userId);
        }

        return query;
    }

    private IQueryable<ReturnRecord> ApplyReturnVisibility(IQueryable<ReturnRecord> query)
    {
        if (currentUserContext.Role == AppRoles.Admin)
        {
            var userId = currentUserContext.UserId
                ?? throw new AppException("Current user is not available.", 401);
            return query.Where(x => x.Sale != null && x.Sale.CashierId == userId);
        }

        return query;
    }

    private IQueryable<Inventory> BuildInventoryReportQuery(InventoryQueryRequest request)
    {
        var query = context.Inventory
            .Include(x => x.Product).ThenInclude(x => x!.Category)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var search = request.Search.Trim().ToLowerInvariant();
            query = query.Where(x =>
                x.Product != null &&
                (x.Product.Name.ToLower().Contains(search) || x.Product.Sku.ToLower().Contains(search)));
        }

        if (!string.IsNullOrWhiteSpace(request.Category))
        {
            var category = request.Category.Trim().ToLowerInvariant();
            query = query.Where(x => x.Product != null && x.Product.Category != null && x.Product.Category.Name.ToLower() == category);
        }

        if (!string.IsNullOrWhiteSpace(request.Location))
        {
            var location = request.Location.Trim().ToLowerInvariant();
            query = query.Where(x => x.Location.ToLower() == location);
        }

        if (!string.IsNullOrWhiteSpace(request.Status))
        {
            var status = request.Status.Trim().ToLowerInvariant();
            query = status switch
            {
                "instock" => query.Where(x => x.QuantityOnHand > InventoryRules.LowStockThreshold),
                "lowstock" => query.Where(x => x.QuantityOnHand <= InventoryRules.LowStockThreshold),
                "outofstock" => query.Where(x => x.QuantityOnHand <= 0),
                _ => query
            };
        }

        return query;
    }

    private IQueryable<StockMovement> BuildStockMovementReportQuery(StockMovementReportPdfRequest request)
    {
        var query = context.StockMovements
            .Include(x => x.Product)
            .Include(x => x.PerformedByUser)
            .AsQueryable();

        if (request.FromUtc.HasValue)
            query = query.Where(x => x.CreatedAtUtc >= request.FromUtc.Value);

        if (request.ToUtc.HasValue)
            query = query.Where(x => x.CreatedAtUtc <= request.ToUtc.Value);

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var search = request.Search.Trim().ToLowerInvariant();
            query = query.Where(x =>
                x.ReferenceNo.ToLower().Contains(search) ||
                x.Remarks.ToLower().Contains(search) ||
                (x.Product != null &&
                    (x.Product.Name.ToLower().Contains(search) || x.Product.Sku.ToLower().Contains(search))) ||
                (x.PerformedByUser != null &&
                    (x.PerformedByUser.FullName.ToLower().Contains(search) || x.PerformedByUser.Username.ToLower().Contains(search))));
        }

        if (!string.IsNullOrWhiteSpace(request.MovementType))
        {
            var movementType = ParseEnumFilter<StockMovementType>(request.MovementType);
            if (movementType.HasValue)
                query = query.Where(x => x.MovementType == movementType.Value);
        }

        return query;
    }

    private static IQueryable<Inventory> ApplyInventorySort(IQueryable<Inventory> query, string? sortBy, string? sortOrder)
    {
        var descending = string.Equals(sortOrder, "desc", StringComparison.OrdinalIgnoreCase);
        var normalizedSortBy = sortBy?.Trim().ToLowerInvariant() ?? "productname";

        return (normalizedSortBy, descending) switch
        {
            ("quantity", true) => query.OrderByDescending(x => x.QuantityOnHand),
            ("quantity", false) => query.OrderBy(x => x.QuantityOnHand),
            ("category", true) => query.OrderByDescending(x => x.Product!.Category!.Name).ThenBy(x => x.Product!.Name),
            ("category", false) => query.OrderBy(x => x.Product!.Category!.Name).ThenBy(x => x.Product!.Name),
            ("location", true) => query.OrderByDescending(x => x.Location).ThenBy(x => x.Product!.Name),
            ("location", false) => query.OrderBy(x => x.Location).ThenBy(x => x.Product!.Name),
            ("code", true) => query.OrderByDescending(x => x.Product!.Sku),
            ("code", false) => query.OrderBy(x => x.Product!.Sku),
            ("reorderlevel", true) => query.OrderByDescending(x => x.ReorderLevel).ThenBy(x => x.Product!.Name),
            ("reorderlevel", false) => query.OrderBy(x => x.ReorderLevel).ThenBy(x => x.Product!.Name),
            ("productname", true) => query.OrderByDescending(x => x.Product!.Name),
            _ => query.OrderBy(x => x.Product!.Name),
        };
    }

    private static string FormatPaymentMethod(PaymentMethod method) => method switch
    {
        PaymentMethod.Cash => "Cash",
        PaymentMethod.Card => "Card",
        PaymentMethod.Transfer => "Bank Transfer",
        PaymentMethod.Mixed => "Mixed",
        PaymentMethod.GCash => "GCash",
        PaymentMethod.QrPh => "QRPH",
        PaymentMethod.CurrentCheck => "Current Check",
        PaymentMethod.PostDatedCheck => "PDC",
        PaymentMethod.Credit => "Charged / Utang",
        _ => method.ToString()
    };

    private static TEnum? ParseEnumFilter<TEnum>(string value)
        where TEnum : struct, Enum =>
        Enum.TryParse<TEnum>(NormalizeFilterValue(value), true, out var parsed) ? parsed : null;

    private static PaymentMethod? ParsePaymentMethodFilter(string value)
    {
        var normalized = NormalizeFilterValue(value);
        if (normalized is "banktransfer")
            return PaymentMethod.Transfer;
        if (normalized is "qrph")
            return PaymentMethod.QrPh;
        if (normalized is "onlinebank")
            return PaymentMethod.Transfer;
        if (normalized is "currentcheck")
            return PaymentMethod.CurrentCheck;
        if (normalized is "pdc" or "postdatedcheck")
            return PaymentMethod.PostDatedCheck;
        if (normalized is "credit" or "charged" or "utang")
            return PaymentMethod.Credit;

        return Enum.TryParse<PaymentMethod>(normalized, true, out var parsed) ? parsed : null;
    }

    private static string NormalizeFilterValue(string value) =>
        value.Trim()
            .Replace(" ", string.Empty)
            .Replace("-", string.Empty)
            .Replace("_", string.Empty);

    private static decimal ResolveCostPrice(SaleItem item) =>
        item.CostPriceSnapshot > 0 ? item.CostPriceSnapshot : item.Product?.CostPrice ?? 0m;

    private static decimal CalculateSaleItemCostOfGoodsSold(SaleItem item)
    {
        var returnedQuantity = item.ReturnItems.Sum(x => x.Quantity);
        var netQuantity = Math.Max(0, item.Quantity - returnedQuantity);
        return netQuantity * ResolveCostPrice(item);
    }

    private static decimal CalculateSaleItemGrossProfit(SaleItem item)
    {
        var returnedQuantity = item.ReturnItems.Sum(x => x.Quantity);
        var netQuantity = Math.Max(0, item.Quantity - returnedQuantity);
        return netQuantity * item.UnitPrice - CalculateSaleItemCostOfGoodsSold(item);
    }

    private static decimal CalculateSaleCostOfGoodsSold(Sale sale) =>
        sale.SaleItems.Sum(CalculateSaleItemCostOfGoodsSold);

    private static decimal CalculateOriginalSaleCostOfGoodsSold(Sale sale) =>
        sale.SaleItems.Sum(item => item.Quantity * ResolveCostPrice(item));

    private static decimal CalculateReturnCostOfGoodsSold(ReturnRecord returnRecord) =>
        returnRecord.Items.Sum(item =>
            item.Quantity * (item.SaleItem != null ? ResolveCostPrice(item.SaleItem) : item.Product?.CostPrice ?? 0m));

    private static string BuildSalesFilterSummary(SalesReportPdfRequest request)
    {
        var parts = new List<string>();
        if (request.FromUtc.HasValue) parts.Add($"From: {request.FromUtc:yyyy-MM-dd}");
        if (request.ToUtc.HasValue) parts.Add($"To: {request.ToUtc:yyyy-MM-dd}");
        if (!string.IsNullOrWhiteSpace(request.Category)) parts.Add($"Category: {request.Category}");
        if (!string.IsNullOrWhiteSpace(request.Status)) parts.Add($"Status: {request.Status}");
        if (!string.IsNullOrWhiteSpace(request.Cashier)) parts.Add($"Cashier: {request.Cashier}");
        if (!string.IsNullOrWhiteSpace(request.PaymentMethod)) parts.Add($"Payment: {request.PaymentMethod}");
        return parts.Count == 0 ? "All sales records" : string.Join(" | ", parts);
    }

    private static string BuildInventoryFilterSummary(InventoryReportPdfRequest request)
    {
        var parts = new List<string>();
        if (!string.IsNullOrWhiteSpace(request.Search)) parts.Add($"Search: {request.Search}");
        if (!string.IsNullOrWhiteSpace(request.Category)) parts.Add($"Category: {request.Category}");
        if (!string.IsNullOrWhiteSpace(request.Status)) parts.Add($"Status: {request.Status}");
        if (!string.IsNullOrWhiteSpace(request.Location)) parts.Add($"Location: {request.Location}");
        if (!string.IsNullOrWhiteSpace(request.SortBy)) parts.Add($"Sort: {request.SortBy} {request.SortOrder ?? "asc"}");
        return parts.Count == 0 ? "All inventory records" : string.Join(" | ", parts);
    }

    private static string BuildStockMovementFilterSummary(StockMovementReportPdfRequest request)
    {
        var parts = new List<string>();
        if (request.FromUtc.HasValue) parts.Add($"From: {request.FromUtc:yyyy-MM-dd}");
        if (request.ToUtc.HasValue) parts.Add($"To: {request.ToUtc:yyyy-MM-dd}");
        if (!string.IsNullOrWhiteSpace(request.Search)) parts.Add($"Search: {request.Search}");
        if (!string.IsNullOrWhiteSpace(request.MovementType)) parts.Add($"Type: {request.MovementType}");
        return parts.Count == 0 ? "All stock movement records" : string.Join(" | ", parts);
    }

    private static IContainer CardStyle(IContainer container) =>
        container
            .Border(1)
            .BorderColor(Colors.Grey.Lighten2)
            .Padding(10)
            .Background(Colors.White);

    private static void HeaderCell(TableCellDescriptor header, string text) =>
        header.Cell().Element(CellStyle).Background(Colors.Grey.Lighten3).Text(text).SemiBold();

    private static void BodyCell(TableDescriptor table, string text) =>
        table.Cell().Element(CellStyle).Text(text);

    private static IContainer CellStyle(IContainer container) =>
        container.BorderBottom(1).BorderColor(Colors.Grey.Lighten2).PaddingVertical(6).PaddingHorizontal(4);

    private sealed record SalesPdfRow(
        string SaleNumber,
        DateTime CreatedAtUtc,
        string CashierName,
        string PaymentMethod,
        decimal TotalAmount,
        string Status,
        decimal DiscountAmount,
        decimal TaxAmount,
        decimal ReturnsAmount,
        IReadOnlyList<SalesPdfItemRow> Items);

    private sealed record SalesPdfItemRow(
        string ProductCode,
        string ProductName,
        decimal Quantity,
        decimal UnitPrice,
        decimal LineTotal,
        decimal CostPrice,
        decimal CostOfGoodsSold,
        decimal GrossProfit);

    private sealed record InventoryPdfRow(
        string ProductCode,
        string ProductName,
        string Category,
        string Unit,
        decimal Quantity,
        decimal ReorderLevel,
        string StockStatus,
        decimal StockValue);

    private sealed record StockMovementPdfRow(
        DateTime CreatedAtUtc,
        string ProductCode,
        string ProductName,
        string MovementType,
        decimal QuantityChanged,
        decimal PreviousQuantity,
        decimal NewQuantity,
        string ReferenceNo,
        string PerformedByName,
        string Remarks);

    private static string FormatCurrency(decimal amount) => $"PHP {amount:N2}";
}
