using System.Security.Claims;
using System.Text;
using GenSteelPOS.Api.Infrastructure;
using GenSteelPOS.Application.Common.Interfaces;
using GenSteelPOS.Infrastructure;
using GenSteelPOS.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);
var corsPolicyName = "Frontend";

builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUserContext, CurrentUserContext>();
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddCors(options =>
{
    options.AddPolicy(corsPolicyName, policy =>
    {
        var origins = GetCorsOrigins(builder.Configuration);
        if (origins.Length > 0)
        {
            policy.WithOrigins(origins)
                .AllowAnyHeader()
                .AllowAnyMethod();
        }
        else
        {
            policy.AllowAnyOrigin()
                .AllowAnyHeader()
                .AllowAnyMethod();
        }
    });
});

builder.Services.AddSwaggerGen(options =>
{
    var bearerScheme = new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Enter your JWT token."
    };

    options.AddSecurityDefinition("Bearer", bearerScheme);

    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

var jwtSection = builder.Configuration.GetSection("Jwt");
var jwtKey = jwtSection["Key"] ?? throw new InvalidOperationException("Jwt:Key is missing.");
var jwtIssuer = jwtSection["Issuer"] ?? "GenSteelPOS";
var jwtAudience = jwtSection["Audience"] ?? "GenSteelPOS.Client";

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtIssuer,
            ValidAudience = jwtAudience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            NameClaimType = ClaimTypes.Name,
            RoleClaimType = ClaimTypes.Role
        };
    });

builder.Services.AddAuthorization();

var app = builder.Build();
var swaggerEnabled = app.Environment.IsDevelopment() || builder.Configuration.GetValue("Swagger:Enabled", false);
var httpsRedirectEnabled = builder.Configuration.GetValue("HttpsRedirect:Enabled", false);

app.UseMiddleware<ExceptionHandlingMiddleware>();
app.UseForwardedHeaders(new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto
});

if (swaggerEnabled)
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await dbContext.Database.MigrateAsync();

    var seeder = scope.ServiceProvider.GetRequiredService<DataSeeder>();
    await seeder.SeedAsync();

    await DeleteRecordsOlderThanFiveYearsAsync(dbContext);
}

if (httpsRedirectEnabled)
{
    app.UseHttpsRedirection();
}

app.MapGet("/", () => Results.Ok(new
{
    app = "Gen Steel POS API",
    status = "Running",
    swagger = swaggerEnabled ? "/swagger" : "Disabled"
}));
app.MapGet("/health", () => Results.Ok(new
{
    status = "Healthy",
    environment = app.Environment.EnvironmentName,
    utc = DateTime.UtcNow
}));

app.UseCors(corsPolicyName);
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();

static string[] GetCorsOrigins(IConfiguration configuration)
{
    var fromEnvironment = Environment.GetEnvironmentVariable("CORS_ALLOWED_ORIGINS");
    var configured = !string.IsNullOrWhiteSpace(fromEnvironment)
        ? fromEnvironment
        : configuration["Cors:AllowedOrigins"];

    return string.IsNullOrWhiteSpace(configured)
        ? []
        : configured.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
}

static async Task DeleteRecordsOlderThanFiveYearsAsync(AppDbContext dbContext)
{
    var cutoffUtc = DateTime.UtcNow.AddYears(-5);

    var oldSaleIds = await dbContext.Sales
        .Where(x => x.CreatedAtUtc < cutoffUtc)
        .Select(x => x.Id)
        .ToListAsync();

    if (oldSaleIds.Count > 0)
    {
        var oldReturnIds = await dbContext.Returns
            .Where(x => oldSaleIds.Contains(x.SaleId) || x.CreatedAtUtc < cutoffUtc)
            .Select(x => x.Id)
            .ToListAsync();

        if (oldReturnIds.Count > 0)
        {
            await dbContext.ReturnItems
                .Where(x => oldReturnIds.Contains(x.ReturnRecordId))
                .ExecuteDeleteAsync();
            await dbContext.Returns
                .Where(x => oldReturnIds.Contains(x.Id))
                .ExecuteDeleteAsync();
        }

        await dbContext.SalesOrders
            .Where(x => x.ConvertedSaleId.HasValue && oldSaleIds.Contains(x.ConvertedSaleId.Value))
            .ExecuteUpdateAsync(setters => setters.SetProperty(x => x.ConvertedSaleId, (int?)null));
        await dbContext.SaleActionRequests
            .Where(x => oldSaleIds.Contains(x.SaleId))
            .ExecuteDeleteAsync();
        await dbContext.Payments
            .Where(x => oldSaleIds.Contains(x.SaleId))
            .ExecuteDeleteAsync();
        await dbContext.SaleItems
            .Where(x => oldSaleIds.Contains(x.SaleId))
            .ExecuteDeleteAsync();
        await dbContext.Sales
            .Where(x => oldSaleIds.Contains(x.Id))
            .ExecuteDeleteAsync();
    }

    var oldSalesOrderIds = await dbContext.SalesOrders
        .Where(x => x.CreatedAtUtc < cutoffUtc)
        .Select(x => x.Id)
        .ToListAsync();
    if (oldSalesOrderIds.Count > 0)
    {
        await dbContext.SalesOrderItems
            .Where(x => oldSalesOrderIds.Contains(x.SalesOrderId))
            .ExecuteDeleteAsync();
        await dbContext.SalesOrders
            .Where(x => oldSalesOrderIds.Contains(x.Id))
            .ExecuteDeleteAsync();
    }

    var oldPurchaseOrderIds = await dbContext.PurchaseOrders
        .Where(x => x.CreatedAtUtc < cutoffUtc)
        .Select(x => x.Id)
        .ToListAsync();
    if (oldPurchaseOrderIds.Count > 0)
    {
        await dbContext.PurchaseOrderItems
            .Where(x => oldPurchaseOrderIds.Contains(x.PurchaseOrderId))
            .ExecuteDeleteAsync();
        await dbContext.PurchaseOrders
            .Where(x => oldPurchaseOrderIds.Contains(x.Id))
            .ExecuteDeleteAsync();
    }

    var oldStockInIds = await dbContext.StockInRecords
        .Where(x => x.ReceivedDateUtc < cutoffUtc)
        .Select(x => x.Id)
        .ToListAsync();
    if (oldStockInIds.Count > 0)
    {
        await dbContext.PurchaseOrders
            .Where(x => x.ReceivedStockInRecordId.HasValue && oldStockInIds.Contains(x.ReceivedStockInRecordId.Value))
            .ExecuteUpdateAsync(setters => setters.SetProperty(x => x.ReceivedStockInRecordId, (int?)null));
        await dbContext.StockInItems
            .Where(x => oldStockInIds.Contains(x.StockInRecordId))
            .ExecuteDeleteAsync();
        await dbContext.StockInRecords
            .Where(x => oldStockInIds.Contains(x.Id))
            .ExecuteDeleteAsync();
    }

    await dbContext.StockMovements
        .Where(x => x.CreatedAtUtc < cutoffUtc)
        .ExecuteDeleteAsync();
    await dbContext.InventoryAdjustmentRequests
        .Where(x => x.CreatedAtUtc < cutoffUtc)
        .ExecuteDeleteAsync();
    await dbContext.AuditLogs
        .Where(x => x.CreatedAtUtc < cutoffUtc)
        .ExecuteDeleteAsync();
}
