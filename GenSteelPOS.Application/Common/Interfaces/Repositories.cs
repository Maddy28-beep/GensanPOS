using GenSteelPOS.Application.DTOs;
using GenSteelPOS.Domain.Entities;
using GenSteelPOS.Domain.Enums;

namespace GenSteelPOS.Application.Common.Interfaces;

public interface IUserRepository : IRepository<User>
{
    Task<User?> GetByUsernameAsync(string username, CancellationToken cancellationToken = default);
}

public interface IRoleRepository : IRepository<Role>
{
    Task<Role?> GetByNameAsync(string roleName, CancellationToken cancellationToken = default);
}

public interface ICategoryRepository : IRepository<Category>
{
    Task<bool> ExistsByNameAsync(string name, CancellationToken cancellationToken = default);
}

public interface IProductRepository : IRepository<Product>
{
    Task<Product?> GetWithCategoryAndInventoryAsync(int id, CancellationToken cancellationToken = default);
    Task<List<Product>> GetActiveForPosAsync(CancellationToken cancellationToken = default);
    Task<bool> ExistsBySkuAsync(string sku, CancellationToken cancellationToken = default);
}

public interface IInventoryRepository : IRepository<Inventory>
{
    Task<Inventory?> GetByProductIdAsync(int productId, CancellationToken cancellationToken = default);
    Task<(List<Inventory> Items, int TotalCount)> SearchAsync(InventoryQueryRequest request, CancellationToken cancellationToken = default);
    Task<InventorySummaryDto> GetSummaryAsync(InventoryQueryRequest request, CancellationToken cancellationToken = default);
    Task<List<string>> GetAvailableCategoriesAsync(CancellationToken cancellationToken = default);
    Task<List<string>> GetAvailableLocationsAsync(CancellationToken cancellationToken = default);
}

public interface ISaleRepository : IRepository<Sale>
{
    Task<Sale?> GetWithDetailsAsync(int id, CancellationToken cancellationToken = default);
    Task<List<Sale>> GetForCashierOnDateAsync(int cashierId, DateTime fromUtc, DateTime toUtc, CancellationToken cancellationToken = default);
    Task<Sale?> GetForCashierByIdAsync(int id, int cashierId, DateTime fromUtc, DateTime toUtc, CancellationToken cancellationToken = default);
}

public interface ISaleActionRequestRepository : IRepository<SaleActionRequest>
{
    Task<List<SaleActionRequest>> GetAllWithDetailsAsync(CancellationToken cancellationToken = default);
    Task<SaleActionRequest?> GetWithDetailsAsync(int id, CancellationToken cancellationToken = default);
    Task<bool> HasPendingRequestAsync(int saleId, SaleActionRequestType requestType, CancellationToken cancellationToken = default);
}

public interface IReturnRepository : IRepository<ReturnRecord>
{
    Task<List<ReturnRecord>> GetAllWithDetailsAsync(CancellationToken cancellationToken = default);
    Task<ReturnRecord?> GetWithDetailsAsync(int id, CancellationToken cancellationToken = default);
    Task<List<ReturnRecord>> GetBySaleIdAsync(int saleId, CancellationToken cancellationToken = default);
}

public interface ISalesOrderRepository : IRepository<SalesOrder>
{
    Task<SalesOrder?> GetWithDetailsAsync(int id, CancellationToken cancellationToken = default);
}

public interface ISupplierRepository : IRepository<Supplier>;

public interface IStockInRecordRepository : IRepository<StockInRecord>
{
    Task<StockInRecord?> GetWithDetailsAsync(int id, CancellationToken cancellationToken = default);
}

public interface IPurchaseOrderRepository : IRepository<PurchaseOrder>
{
    Task<PurchaseOrder?> GetWithDetailsAsync(int id, CancellationToken cancellationToken = default);
}

public interface IStockMovementRepository : IRepository<StockMovement>
{
    Task<List<StockMovement>> GetAllWithDetailsAsync(CancellationToken cancellationToken = default);
}

public interface IAuditLogRepository : IRepository<AuditLog>;
