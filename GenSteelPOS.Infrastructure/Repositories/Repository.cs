using System.Linq.Expressions;
using GenSteelPOS.Application.Common.Interfaces;
using GenSteelPOS.Application.DTOs;
using GenSteelPOS.Domain.Common;
using GenSteelPOS.Domain.Constants;
using GenSteelPOS.Domain.Entities;
using GenSteelPOS.Domain.Enums;
using GenSteelPOS.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace GenSteelPOS.Infrastructure.Repositories;

public class Repository<TEntity>(AppDbContext context) : IRepository<TEntity> where TEntity : BaseEntity
{
    protected readonly AppDbContext Context = context;
    protected readonly DbSet<TEntity> DbSet = context.Set<TEntity>();

    public virtual async Task<TEntity?> GetByIdAsync(int id, CancellationToken cancellationToken = default) =>
        await DbSet.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

    public virtual async Task<List<TEntity>> GetAllAsync(CancellationToken cancellationToken = default) =>
        await DbSet.ToListAsync(cancellationToken);

    public virtual async Task<List<TEntity>> FindAsync(Expression<Func<TEntity, bool>> predicate, CancellationToken cancellationToken = default) =>
        await DbSet.Where(predicate).ToListAsync(cancellationToken);

    public virtual async Task AddAsync(TEntity entity, CancellationToken cancellationToken = default) =>
        await DbSet.AddAsync(entity, cancellationToken);

    public virtual void Update(TEntity entity) => DbSet.Update(entity);

    public virtual void Remove(TEntity entity) => DbSet.Remove(entity);
}

public sealed class UserRepository(AppDbContext context) : Repository<User>(context), IUserRepository
{
    public async Task<User?> GetByUsernameAsync(string username, CancellationToken cancellationToken = default) =>
        await Context.Users.Include(x => x.Role).FirstOrDefaultAsync(x => x.Username == username, cancellationToken);

    public override async Task<List<User>> GetAllAsync(CancellationToken cancellationToken = default) =>
        await Context.Users.Include(x => x.Role).OrderBy(x => x.FullName).ToListAsync(cancellationToken);

    public override async Task<User?> GetByIdAsync(int id, CancellationToken cancellationToken = default) =>
        await Context.Users.Include(x => x.Role).FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
}

public sealed class RoleRepository(AppDbContext context) : Repository<Role>(context), IRoleRepository
{
    public async Task<Role?> GetByNameAsync(string roleName, CancellationToken cancellationToken = default) =>
        await Context.Roles.FirstOrDefaultAsync(x => x.Name == roleName, cancellationToken);
}

public sealed class CategoryRepository(AppDbContext context) : Repository<Category>(context), ICategoryRepository
{
    public async Task<bool> ExistsByNameAsync(string name, CancellationToken cancellationToken = default) =>
        await Context.Categories.AnyAsync(x => x.Name == name, cancellationToken);
}

public sealed class ProductRepository(AppDbContext context) : Repository<Product>(context), IProductRepository
{
    public override async Task<List<Product>> GetAllAsync(CancellationToken cancellationToken = default) =>
        await Context.Products.Include(x => x.Category).Include(x => x.Inventory).OrderBy(x => x.Name).ToListAsync(cancellationToken);

    public async Task<Product?> GetWithCategoryAndInventoryAsync(int id, CancellationToken cancellationToken = default) =>
        await Context.Products.Include(x => x.Category).Include(x => x.Inventory).FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

    public async Task<List<Product>> GetActiveForPosAsync(CancellationToken cancellationToken = default) =>
        await Context.Products.Include(x => x.Category).Include(x => x.Inventory).Where(x => x.IsActive).OrderBy(x => x.Name).ToListAsync(cancellationToken);

    public async Task<bool> ExistsBySkuAsync(string sku, CancellationToken cancellationToken = default) =>
        await Context.Products.AnyAsync(x => x.Sku == sku, cancellationToken);
}

public sealed class InventoryRepository(AppDbContext context) : Repository<Inventory>(context), IInventoryRepository
{
    public override async Task<List<Inventory>> GetAllAsync(CancellationToken cancellationToken = default) =>
        await Context.Inventory
            .Include(x => x.Product).ThenInclude(x => x!.Category)
            .OrderBy(x => x.Product!.Name)
            .ToListAsync(cancellationToken);

    public async Task<Inventory?> GetByProductIdAsync(int productId, CancellationToken cancellationToken = default) =>
        await Context.Inventory
            .Include(x => x.Product).ThenInclude(x => x!.Category)
            .FirstOrDefaultAsync(x => x.ProductId == productId, cancellationToken);

    public async Task<(List<Inventory> Items, int TotalCount)> SearchAsync(InventoryQueryRequest request, CancellationToken cancellationToken = default)
    {
        var query = BuildFilteredQuery(request);
        var totalCount = await query.CountAsync(cancellationToken);

        query = ApplySort(query, request.SortBy, request.SortOrder);

        var items = await query
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .ToListAsync(cancellationToken);

        return (items, totalCount);
    }

    public async Task<InventorySummaryDto> GetSummaryAsync(InventoryQueryRequest request, CancellationToken cancellationToken = default)
    {
        var query = BuildFilteredQuery(request);

        return new InventorySummaryDto
        {
            TotalProducts = await query.CountAsync(cancellationToken),
            InStockCount = await query.CountAsync(x => x.Product != null && x.Product.Quantity > InventoryRules.LowStockThreshold, cancellationToken),
            LowStockCount = await query.CountAsync(x => x.Product != null && x.Product.Quantity > 0 && x.Product.Quantity <= InventoryRules.LowStockThreshold, cancellationToken),
            OutOfStockCount = await query.CountAsync(x => x.Product != null && x.Product.Quantity <= 0, cancellationToken),
        };
    }

    public async Task<List<string>> GetAvailableCategoriesAsync(CancellationToken cancellationToken = default) =>
        await Context.Inventory
            .Include(x => x.Product).ThenInclude(x => x!.Category)
            .Where(x => x.Product != null && x.Product.Category != null)
            .Select(x => x.Product!.Category!.Name)
            .Distinct()
            .OrderBy(x => x)
            .ToListAsync(cancellationToken);

    public async Task<List<string>> GetAvailableLocationsAsync(CancellationToken cancellationToken = default) =>
        await Context.Inventory
            .Where(x => !string.IsNullOrWhiteSpace(x.Location))
            .Select(x => x.Location)
            .Distinct()
            .OrderBy(x => x)
            .ToListAsync(cancellationToken);

    private IQueryable<Inventory> BuildFilteredQuery(InventoryQueryRequest request)
    {
        EnsureInventoryRowsForProducts();

        var query = Context.Inventory
            .Include(x => x.Product).ThenInclude(x => x!.Category)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var search = request.Search.Trim().ToLower();
            query = query.Where(x =>
                (x.Product != null && x.Product.Name.ToLower().Contains(search)) ||
                (x.Product != null && x.Product.Sku.ToLower().Contains(search)));
        }

        if (!string.IsNullOrWhiteSpace(request.Category))
        {
            var category = request.Category.Trim().ToLower();
            query = query.Where(x => x.Product != null && x.Product.Category != null && x.Product.Category.Name.ToLower() == category);
        }

        if (!string.IsNullOrWhiteSpace(request.Location))
        {
            var location = request.Location.Trim().ToLower();
            query = query.Where(x => x.Location.ToLower() == location);
        }

        if (!string.IsNullOrWhiteSpace(request.Status))
        {
            var status = request.Status.Trim().ToLower();
            query = status switch
            {
                "instock" => query.Where(x => x.Product != null && x.Product.Quantity > InventoryRules.LowStockThreshold),
                "lowstock" => query.Where(x => x.Product != null && x.Product.Quantity <= InventoryRules.LowStockThreshold),
                "outofstock" => query.Where(x => x.Product != null && x.Product.Quantity <= 0),
                _ => query
            };
        }

        return query;
    }

    private void EnsureInventoryRowsForProducts()
    {
        var missingInventoryRows = Context.Products
            .Where(product => !Context.Inventory.Any(inventory => inventory.ProductId == product.Id))
            .Select(product => new Inventory
            {
                ProductId = product.Id,
                QuantityOnHand = product.Quantity,
                ReorderLevel = 0,
                Location = string.Empty
            })
            .ToList();

        if (missingInventoryRows.Count == 0)
        {
            return;
        }

        Context.Inventory.AddRange(missingInventoryRows);
        Context.SaveChanges();
    }

    private static IQueryable<Inventory> ApplySort(IQueryable<Inventory> query, string? sortBy, string? sortOrder)
    {
        var descending = string.Equals(sortOrder, "desc", StringComparison.OrdinalIgnoreCase);
        var normalizedSortBy = sortBy?.Trim().ToLowerInvariant() ?? "productname";

        return (normalizedSortBy, descending) switch
        {
            ("quantity", true) => query.OrderByDescending(x => x.Product!.Quantity),
            ("quantity", false) => query.OrderBy(x => x.Product!.Quantity),
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
}

public sealed class SaleRepository(AppDbContext context) : Repository<Sale>(context), ISaleRepository
{
    public override async Task<List<Sale>> GetAllAsync(CancellationToken cancellationToken = default) =>
        await Context.Sales
            .Include(x => x.Cashier).ThenInclude(x => x!.Role)
            .Include(x => x.SaleItems).ThenInclude(x => x.Product).ThenInclude(x => x!.Inventory)
            .Include(x => x.SaleItems).ThenInclude(x => x.ReturnItems)
            .Include(x => x.Payments)
            .Include(x => x.Returns).ThenInclude(x => x.Items)
            .OrderByDescending(x => x.CreatedAtUtc)
            .ToListAsync(cancellationToken);

    public async Task<List<Sale>> GetForCashierOnDateAsync(int cashierId, DateTime fromUtc, DateTime toUtc, CancellationToken cancellationToken = default) =>
        await Context.Sales
            .Include(x => x.Cashier).ThenInclude(x => x!.Role)
            .Include(x => x.SaleItems).ThenInclude(x => x.Product).ThenInclude(x => x!.Inventory)
            .Include(x => x.SaleItems).ThenInclude(x => x.ReturnItems)
            .Include(x => x.Payments)
            .Include(x => x.Returns).ThenInclude(x => x.Items)
            .Where(x => x.CashierId == cashierId && x.CreatedAtUtc >= fromUtc && x.CreatedAtUtc <= toUtc)
            .OrderByDescending(x => x.CreatedAtUtc)
            .ToListAsync(cancellationToken);

    public async Task<Sale?> GetWithDetailsAsync(int id, CancellationToken cancellationToken = default) =>
        await Context.Sales
            .Include(x => x.Cashier).ThenInclude(x => x!.Role)
            .Include(x => x.SaleItems).ThenInclude(x => x.Product).ThenInclude(x => x!.Inventory)
            .Include(x => x.SaleItems).ThenInclude(x => x.ReturnItems)
            .Include(x => x.Payments)
            .Include(x => x.Returns).ThenInclude(x => x.Items).ThenInclude(x => x.Product)
            .Include(x => x.Returns).ThenInclude(x => x.ProcessedByUser)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

    public async Task<Sale?> GetForCashierByIdAsync(int id, int cashierId, DateTime fromUtc, DateTime toUtc, CancellationToken cancellationToken = default) =>
        await Context.Sales
            .Include(x => x.Cashier).ThenInclude(x => x!.Role)
            .Include(x => x.SaleItems).ThenInclude(x => x.Product).ThenInclude(x => x!.Inventory)
            .Include(x => x.SaleItems).ThenInclude(x => x.ReturnItems)
            .Include(x => x.Payments)
            .Include(x => x.Returns).ThenInclude(x => x.Items).ThenInclude(x => x.Product)
            .Include(x => x.Returns).ThenInclude(x => x.ProcessedByUser)
            .FirstOrDefaultAsync(
                x => x.Id == id && x.CashierId == cashierId && x.CreatedAtUtc >= fromUtc && x.CreatedAtUtc <= toUtc,
                cancellationToken);
}

public sealed class ReturnRepository(AppDbContext context) : Repository<ReturnRecord>(context), IReturnRepository
{
    public async Task<List<ReturnRecord>> GetAllWithDetailsAsync(CancellationToken cancellationToken = default) =>
        await Context.Returns
            .Include(x => x.Sale)
            .Include(x => x.ProcessedByUser)
            .Include(x => x.Items).ThenInclude(x => x.Product)
            .OrderByDescending(x => x.CreatedAtUtc)
            .ToListAsync(cancellationToken);

    public async Task<ReturnRecord?> GetWithDetailsAsync(int id, CancellationToken cancellationToken = default) =>
        await Context.Returns
            .Include(x => x.Sale)
            .Include(x => x.ProcessedByUser)
            .Include(x => x.Items).ThenInclude(x => x.Product)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

    public async Task<List<ReturnRecord>> GetBySaleIdAsync(int saleId, CancellationToken cancellationToken = default) =>
        await Context.Returns
            .Include(x => x.Sale)
            .Include(x => x.ProcessedByUser)
            .Include(x => x.Items).ThenInclude(x => x.Product)
            .Where(x => x.SaleId == saleId)
            .OrderByDescending(x => x.CreatedAtUtc)
            .ToListAsync(cancellationToken);
}

public sealed class SaleActionRequestRepository(AppDbContext context) : Repository<SaleActionRequest>(context), ISaleActionRequestRepository
{
    public async Task<List<SaleActionRequest>> GetAllWithDetailsAsync(CancellationToken cancellationToken = default) =>
        await Context.SaleActionRequests
            .Include(x => x.Sale).ThenInclude(x => x!.Cashier).ThenInclude(x => x!.Role)
            .Include(x => x.Sale).ThenInclude(x => x!.SaleItems).ThenInclude(x => x.Product)
            .Include(x => x.Sale).ThenInclude(x => x!.SaleItems).ThenInclude(x => x.ReturnItems)
            .Include(x => x.RequestedByUser)
            .Include(x => x.ReviewedByUser)
            .OrderByDescending(x => x.CreatedAtUtc)
            .ToListAsync(cancellationToken);

    public async Task<SaleActionRequest?> GetWithDetailsAsync(int id, CancellationToken cancellationToken = default) =>
        await Context.SaleActionRequests
            .Include(x => x.Sale).ThenInclude(x => x!.Cashier).ThenInclude(x => x!.Role)
            .Include(x => x.Sale).ThenInclude(x => x!.SaleItems).ThenInclude(x => x.Product)
            .Include(x => x.Sale).ThenInclude(x => x!.SaleItems).ThenInclude(x => x.ReturnItems)
            .Include(x => x.RequestedByUser)
            .Include(x => x.ReviewedByUser)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

    public async Task<bool> HasPendingRequestAsync(int saleId, SaleActionRequestType requestType, CancellationToken cancellationToken = default) =>
        await Context.SaleActionRequests.AnyAsync(
            x => x.SaleId == saleId && x.RequestType == requestType && x.Status == SaleActionRequestStatus.Pending,
            cancellationToken);
}

public sealed class SalesOrderRepository(AppDbContext context) : Repository<SalesOrder>(context), ISalesOrderRepository
{
    public override async Task<List<SalesOrder>> GetAllAsync(CancellationToken cancellationToken = default) =>
        await Context.SalesOrders
            .Include(x => x.CreatedByUser)
            .Include(x => x.ConvertedSale)
            .Include(x => x.Items).ThenInclude(x => x.Product)
            .OrderByDescending(x => x.CreatedAtUtc)
            .ToListAsync(cancellationToken);

    public async Task<SalesOrder?> GetWithDetailsAsync(int id, CancellationToken cancellationToken = default) =>
        await Context.SalesOrders
            .Include(x => x.CreatedByUser)
            .Include(x => x.ConvertedSale)
            .Include(x => x.Items).ThenInclude(x => x.Product)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
}

public sealed class SupplierRepository(AppDbContext context) : Repository<Supplier>(context), ISupplierRepository;

public sealed class StockInRecordRepository(AppDbContext context) : Repository<StockInRecord>(context), IStockInRecordRepository
{
    public override async Task<List<StockInRecord>> GetAllAsync(CancellationToken cancellationToken = default) =>
        await Context.StockInRecords
            .Include(x => x.Supplier)
            .Include(x => x.ReceivedByUser)
            .Include(x => x.ReviewedByUser)
            .Include(x => x.Items).ThenInclude(x => x.Product)
            .OrderByDescending(x => x.ReceivedDateUtc)
            .ToListAsync(cancellationToken);

    public async Task<StockInRecord?> GetWithDetailsAsync(int id, CancellationToken cancellationToken = default) =>
        await Context.StockInRecords
            .Include(x => x.Supplier)
            .Include(x => x.ReceivedByUser)
            .Include(x => x.ReviewedByUser)
            .Include(x => x.Items).ThenInclude(x => x.Product)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
}

public sealed class PurchaseOrderRepository(AppDbContext context) : Repository<PurchaseOrder>(context), IPurchaseOrderRepository
{
    public override async Task<List<PurchaseOrder>> GetAllAsync(CancellationToken cancellationToken = default) =>
        await Context.PurchaseOrders
            .Include(x => x.Supplier)
            .Include(x => x.CreatedByUser)
            .Include(x => x.ReceivedStockInRecord)
            .Include(x => x.Items).ThenInclude(x => x.Product)
            .OrderByDescending(x => x.CreatedAtUtc)
            .ToListAsync(cancellationToken);

    public async Task<PurchaseOrder?> GetWithDetailsAsync(int id, CancellationToken cancellationToken = default) =>
        await Context.PurchaseOrders
            .Include(x => x.Supplier)
            .Include(x => x.CreatedByUser)
            .Include(x => x.ReceivedStockInRecord)
            .Include(x => x.Items).ThenInclude(x => x.Product)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
}

public sealed class StockMovementRepository(AppDbContext context) : Repository<StockMovement>(context), IStockMovementRepository
{
    public async Task<List<StockMovement>> GetAllWithDetailsAsync(CancellationToken cancellationToken = default) =>
        await Context.StockMovements
            .Include(x => x.Product)
            .Include(x => x.PerformedByUser)
            .OrderByDescending(x => x.CreatedAtUtc)
            .ToListAsync(cancellationToken);
}
public sealed class AuditLogRepository(AppDbContext context) : Repository<AuditLog>(context), IAuditLogRepository
{
    public override async Task<List<AuditLog>> GetAllAsync(CancellationToken cancellationToken = default) =>
        await Context.AuditLogs
            .Include(x => x.User).ThenInclude(x => x!.Role)
            .OrderByDescending(x => x.CreatedAtUtc)
            .ToListAsync(cancellationToken);
}

public sealed class UnitOfWork(AppDbContext context) : IUnitOfWork
{
    public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default) => context.SaveChangesAsync(cancellationToken);

    public async Task ExecuteInTransactionAsync(Func<CancellationToken, Task> operation, CancellationToken cancellationToken = default)
    {
        await using var transaction = await context.Database.BeginTransactionAsync(cancellationToken);
        await operation(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
    }

    public async Task<T> ExecuteInTransactionAsync<T>(Func<CancellationToken, Task<T>> operation, CancellationToken cancellationToken = default)
    {
        await using var transaction = await context.Database.BeginTransactionAsync(cancellationToken);
        var result = await operation(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return result;
    }
}
