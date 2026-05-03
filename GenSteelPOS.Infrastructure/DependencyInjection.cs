using GenSteelPOS.Application.Common.Interfaces;
using GenSteelPOS.Application.Services;
using GenSteelPOS.Infrastructure.Persistence;
using GenSteelPOS.Infrastructure.Repositories;
using GenSteelPOS.Infrastructure.Security;
using GenSteelPOS.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using QuestPDF.Infrastructure;

namespace GenSteelPOS.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        QuestPDF.Settings.License = LicenseType.Community;

        var connectionString =
            Environment.GetEnvironmentVariable("DATABASE_URL")
            ?? Environment.GetEnvironmentVariable("POSTGRES_CONNECTION_STRING")
            ?? configuration.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException("A PostgreSQL connection string is required.");

        services.AddDbContext<AppDbContext>(options =>
            options.UseNpgsql(NormalizePostgresConnectionString(connectionString)));

        services.AddScoped<IUnitOfWork, UnitOfWork>();
        services.AddScoped<IUserRepository, UserRepository>();
        services.AddScoped<IRoleRepository, RoleRepository>();
        services.AddScoped<ICategoryRepository, CategoryRepository>();
        services.AddScoped<IProductRepository, ProductRepository>();
        services.AddScoped<IInventoryRepository, InventoryRepository>();
        services.AddScoped<ISaleRepository, SaleRepository>();
        services.AddScoped<ISaleActionRequestRepository, SaleActionRequestRepository>();
        services.AddScoped<IReturnRepository, ReturnRepository>();
        services.AddScoped<ISalesOrderRepository, SalesOrderRepository>();
        services.AddScoped<IPurchaseOrderRepository, PurchaseOrderRepository>();
        services.AddScoped<ISupplierRepository, SupplierRepository>();
        services.AddScoped<IStockInRecordRepository, StockInRecordRepository>();
        services.AddScoped<IStockMovementRepository, StockMovementRepository>();
        services.AddScoped<IAuditLogRepository, AuditLogRepository>();

        services.AddScoped<IPasswordHasherService, PasswordHasherService>();
        services.AddScoped<IJwtTokenGenerator, JwtTokenGenerator>();
        services.AddScoped<DataSeeder>();

        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IUserService, UserService>();
        services.AddScoped<IProductService, ProductService>();
        services.AddScoped<IInventoryService, InventoryService>();
        services.AddScoped<IInventoryAdjustmentRequestService, InventoryAdjustmentRequestService>();
        services.AddScoped<IStockMovementService, StockMovementService>();
        services.AddScoped<IPosService, PosService>();
        services.AddScoped<ISalesService, SalesService>();
        services.AddScoped<IReturnService, ReturnService>();
        services.AddScoped<ISaleActionRequestService, SaleActionRequestService>();
        services.AddScoped<ISalesOrderService, SalesOrderService>();
        services.AddScoped<IPurchaseOrderService, PurchaseOrderService>();
        services.AddScoped<ISupplierService, SupplierService>();
        services.AddScoped<IStockInService, StockInService>();
        services.AddScoped<IReportsService, ReportsService>();
        services.AddScoped<IAuditLogService, AuditLogService>();

        return services;
    }

    private static string NormalizePostgresConnectionString(string connectionString)
    {
        if (!Uri.TryCreate(connectionString, UriKind.Absolute, out var uri) ||
            (uri.Scheme != "postgres" && uri.Scheme != "postgresql"))
        {
            return connectionString;
        }

        var userInfo = uri.UserInfo.Split(':', 2);
        var builder = new NpgsqlConnectionStringBuilder
        {
            Host = uri.Host,
            Port = uri.Port > 0 ? uri.Port : 5432,
            Database = uri.AbsolutePath.TrimStart('/'),
            Username = Uri.UnescapeDataString(userInfo.ElementAtOrDefault(0) ?? string.Empty),
            Password = Uri.UnescapeDataString(userInfo.ElementAtOrDefault(1) ?? string.Empty),
            SslMode = SslMode.Require
        };

        var query = ParseQueryString(uri.Query);
        if (query.TryGetValue("sslmode", out var sslMode) &&
            Enum.TryParse<SslMode>(sslMode, true, out var parsedSslMode))
        {
            builder.SslMode = parsedSslMode;
        }

        return builder.ConnectionString;
    }

    private static Dictionary<string, string> ParseQueryString(string query)
    {
        return query.TrimStart('?')
            .Split('&', StringSplitOptions.RemoveEmptyEntries)
            .Select(part => part.Split('=', 2))
            .Where(parts => parts.Length == 2)
            .ToDictionary(
                parts => Uri.UnescapeDataString(parts[0]).ToLowerInvariant(),
                parts => Uri.UnescapeDataString(parts[1]));
    }
}
