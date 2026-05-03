using GenSteelPOS.Application.DTOs;

namespace GenSteelPOS.Application.Services;

public interface IAuthService
{
    Task<AuthResponse> LoginAsync(LoginRequest request, CancellationToken cancellationToken = default);
}

public interface IUserService
{
    Task<List<UserDto>> GetAllAsync(CancellationToken cancellationToken = default);
    Task<UserDto> CreateAsync(CreateUserRequest request, CancellationToken cancellationToken = default);
    Task<UserDto> UpdateAsync(int id, UpdateUserRequest request, CancellationToken cancellationToken = default);
}

public interface IProductService
{
    Task<List<CategoryDto>> GetCategoriesAsync(CancellationToken cancellationToken = default);
    Task<CategoryDto> CreateCategoryAsync(CreateCategoryRequest request, CancellationToken cancellationToken = default);
    Task<CategoryDto> UpdateCategoryAsync(int id, UpdateCategoryRequest request, CancellationToken cancellationToken = default);
    Task<List<ProductUnitDto>> GetUnitsAsync(CancellationToken cancellationToken = default);
    Task<ProductUnitDto> CreateUnitAsync(CreateProductUnitRequest request, CancellationToken cancellationToken = default);
    Task<List<ProductDto>> GetAllAsync(CancellationToken cancellationToken = default);
    Task<List<ProductDto>> GetActiveForPosAsync(CancellationToken cancellationToken = default);
    Task<ProductDto> CreateAsync(CreateProductRequest request, CancellationToken cancellationToken = default);
    Task<ProductDto> UpdateAsync(int id, UpdateProductRequest request, CancellationToken cancellationToken = default);
}

public interface IInventoryService
{
    Task<InventoryListResponseDto> GetAllAsync(InventoryQueryRequest request, CancellationToken cancellationToken = default);
    Task<InventoryDto> AdjustStockAsync(StockAdjustmentRequest request, CancellationToken cancellationToken = default);
}

public interface IInventoryAdjustmentRequestService
{
    Task<List<InventoryAdjustmentRequestDto>> GetAllAsync(CancellationToken cancellationToken = default);
    Task<InventoryAdjustmentRequestDto> CreateAsync(CreateInventoryAdjustmentRequest request, CancellationToken cancellationToken = default);
    Task<InventoryAdjustmentRequestDto> ApproveAsync(int id, ReviewInventoryAdjustmentRequest request, CancellationToken cancellationToken = default);
    Task<InventoryAdjustmentRequestDto> RejectAsync(int id, ReviewInventoryAdjustmentRequest request, CancellationToken cancellationToken = default);
}

public interface IStockMovementService
{
    Task<List<StockMovementDto>> GetAllAsync(CancellationToken cancellationToken = default);
}

public interface IPosService
{
    Task<SaleDto> ProcessSaleAsync(ProcessSaleRequest request, CancellationToken cancellationToken = default);
}

public interface ISalesService
{
    Task<List<SaleDto>> GetAllAsync(CancellationToken cancellationToken = default);
    Task<SaleDto> GetByIdAsync(int id, CancellationToken cancellationToken = default);
    Task<SaleDto> CancelAsync(int id, UpdateSaleStatusRequest request, CancellationToken cancellationToken = default);
    Task<SaleDto> RefundAsync(int id, UpdateSaleStatusRequest request, CancellationToken cancellationToken = default);
    Task<SaleDto> VoidAsync(int id, UpdateSaleStatusRequest request, CancellationToken cancellationToken = default);
}

public interface IReturnService
{
    Task<List<ReturnDto>> GetAllAsync(CancellationToken cancellationToken = default);
    Task<ReturnDto> CreateAsync(CreateReturnRequest request, CancellationToken cancellationToken = default);
    Task<ReturnDto> CreateFullRefundAsync(int saleId, string remarks, CancellationToken cancellationToken = default);
}

public interface ISaleActionRequestService
{
    Task<List<SaleActionRequestDto>> GetAllAsync(CancellationToken cancellationToken = default);
    Task<SaleActionRequestDto> CreateAsync(CreateSaleActionRequestRequest request, CancellationToken cancellationToken = default);
    Task<SaleActionRequestDto> ApproveAsync(int id, ReviewSaleActionRequestRequest request, CancellationToken cancellationToken = default);
    Task<SaleActionRequestDto> RejectAsync(int id, ReviewSaleActionRequestRequest request, CancellationToken cancellationToken = default);
}

public interface ISalesOrderService
{
    Task<List<SalesOrderDto>> GetAllAsync(CancellationToken cancellationToken = default);
    Task<SalesOrderDto> GetByIdAsync(int id, CancellationToken cancellationToken = default);
    Task<SalesOrderDto> CreateAsync(CreateSalesOrderRequest request, CancellationToken cancellationToken = default);
    Task<SalesOrderDto> CancelAsync(int id, UpdateSalesOrderStatusRequest request, CancellationToken cancellationToken = default);
    Task<SaleDto> ConvertToSaleAsync(int id, ConvertSalesOrderRequest request, CancellationToken cancellationToken = default);
}

public interface ISupplierService
{
    Task<List<SupplierDto>> GetAllAsync(CancellationToken cancellationToken = default);
    Task<SupplierDto> CreateAsync(CreateSupplierRequest request, CancellationToken cancellationToken = default);
}

public interface IStockInService
{
    Task<List<StockInRecordDto>> GetAllAsync(CancellationToken cancellationToken = default);
    Task<StockInRecordDto> CreateAsync(CreateStockInRequest request, CancellationToken cancellationToken = default);
    Task<StockInRecordDto> ApproveAsync(int id, ReviewStockInRequest request, CancellationToken cancellationToken = default);
    Task<StockInRecordDto> RejectAsync(int id, ReviewStockInRequest request, CancellationToken cancellationToken = default);
}

public interface IPurchaseOrderService
{
    Task<List<PurchaseOrderDto>> GetAllAsync(CancellationToken cancellationToken = default);
    Task<PurchaseOrderDto> GetByIdAsync(int id, CancellationToken cancellationToken = default);
    Task<PurchaseOrderDto> CreateAsync(CreatePurchaseOrderRequest request, CancellationToken cancellationToken = default);
    Task<PurchaseOrderDto> CancelAsync(int id, UpdatePurchaseOrderStatusRequest request, CancellationToken cancellationToken = default);
    Task<StockInRecordDto> ReceiveAsync(int id, ReceivePurchaseOrderRequest request, CancellationToken cancellationToken = default);
}

public interface IReportsService
{
    Task<DashboardReportDto> GetDashboardAsync(CancellationToken cancellationToken = default);
    Task<SalesSummaryDto> GetSalesSummaryAsync(DateTime? fromUtc, DateTime? toUtc, CancellationToken cancellationToken = default);
    Task<List<ProductSalesProfitReportRowDto>> GetProductSalesProfitAsync(DateTime? fromUtc, DateTime? toUtc, CancellationToken cancellationToken = default);
    Task<List<SalesTransactionReportRowDto>> GetSalesTransactionsAsync(DateTime? fromUtc, DateTime? toUtc, CancellationToken cancellationToken = default);
    Task<List<InventoryValueReportRowDto>> GetInventoryValueAsync(CancellationToken cancellationToken = default);
    Task<byte[]> GetSalesPdfAsync(SalesReportPdfRequest request, CancellationToken cancellationToken = default);
    Task<byte[]> GetInventoryPdfAsync(InventoryReportPdfRequest request, CancellationToken cancellationToken = default);
    Task<byte[]> GetStockMovementsPdfAsync(StockMovementReportPdfRequest request, CancellationToken cancellationToken = default);
}

public interface IAuditLogService
{
    Task<List<AuditLogDto>> GetAllAsync(CancellationToken cancellationToken = default);
    Task CreateAsync(string action, string entityName, string entityId, string details, CancellationToken cancellationToken = default);
    Task CreateAsync(string action, string entityName, string entityId, string details, string oldValue, string newValue, CancellationToken cancellationToken = default);
}
