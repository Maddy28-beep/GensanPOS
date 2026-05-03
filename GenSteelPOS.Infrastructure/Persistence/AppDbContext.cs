using GenSteelPOS.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace GenSteelPOS.Infrastructure.Persistence;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<User> Users => Set<User>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<ProductUnit> ProductUnits => Set<ProductUnit>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<Inventory> Inventory => Set<Inventory>();
    public DbSet<InventoryAdjustmentRequest> InventoryAdjustmentRequests => Set<InventoryAdjustmentRequest>();
    public DbSet<StockMovement> StockMovements => Set<StockMovement>();
    public DbSet<Sale> Sales => Set<Sale>();
    public DbSet<SaleActionRequest> SaleActionRequests => Set<SaleActionRequest>();
    public DbSet<ReturnRecord> Returns => Set<ReturnRecord>();
    public DbSet<ReturnItem> ReturnItems => Set<ReturnItem>();
    public DbSet<SaleItem> SaleItems => Set<SaleItem>();
    public DbSet<SalesOrder> SalesOrders => Set<SalesOrder>();
    public DbSet<SalesOrderItem> SalesOrderItems => Set<SalesOrderItem>();
    public DbSet<PurchaseOrder> PurchaseOrders => Set<PurchaseOrder>();
    public DbSet<PurchaseOrderItem> PurchaseOrderItems => Set<PurchaseOrderItem>();
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<Supplier> Suppliers => Set<Supplier>();
    public DbSet<StockInRecord> StockInRecords => Set<StockInRecord>();
    public DbSet<StockInItem> StockInItems => Set<StockInItem>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Role>(entity =>
        {
            entity.HasIndex(x => x.Name).IsUnique();
            entity.Property(x => x.Name).HasMaxLength(50).IsRequired();
        });

        modelBuilder.Entity<User>(entity =>
        {
            entity.HasIndex(x => x.Username).IsUnique();
            entity.HasIndex(x => x.Email).IsUnique();
            entity.Property(x => x.FullName).HasMaxLength(100).IsRequired();
            entity.Property(x => x.Username).HasMaxLength(50).IsRequired();
            entity.Property(x => x.Email).HasMaxLength(150).IsRequired();
            entity.Property(x => x.PasswordHash).HasMaxLength(500).IsRequired();
        });

        modelBuilder.Entity<Category>(entity =>
        {
            entity.HasIndex(x => x.Name).IsUnique();
            entity.Property(x => x.Name).HasMaxLength(100).IsRequired();
            entity.Property(x => x.Description).HasMaxLength(250);
        });

        modelBuilder.Entity<ProductUnit>(entity =>
        {
            entity.HasIndex(x => x.Name).IsUnique();
            entity.Property(x => x.Name).HasMaxLength(20).IsRequired();
        });

        modelBuilder.Entity<Product>(entity =>
        {
            entity.HasIndex(x => x.Sku).IsUnique();
            entity.Property(x => x.Sku).HasMaxLength(50).IsRequired();
            entity.Property(x => x.Name).HasMaxLength(150).IsRequired();
            entity.Property(x => x.Description).HasMaxLength(500);
            entity.Property(x => x.CostPrice).HasPrecision(18, 2);
            entity.Property(x => x.Quantity).HasPrecision(18, 2);
            entity.Property(x => x.Unit).HasMaxLength(20).IsRequired();
            entity.Property(x => x.Price).HasPrecision(18, 2);
        });

        modelBuilder.Entity<Inventory>(entity =>
        {
            entity.HasIndex(x => x.ProductId).IsUnique();
            entity.Property(x => x.QuantityOnHand).HasPrecision(18, 2);
            entity.Property(x => x.ReorderLevel).HasPrecision(18, 2);
            entity.Property(x => x.Location).HasMaxLength(100);
        });

        modelBuilder.Entity<InventoryAdjustmentRequest>(entity =>
        {
            entity.Property(x => x.QuantityChange).HasPrecision(18, 2);
            entity.Property(x => x.PreviousQuantity).HasPrecision(18, 2);
            entity.Property(x => x.RequestedQuantity).HasPrecision(18, 2);
            entity.Property(x => x.Reason).HasMaxLength(500);
            entity.Property(x => x.ReviewNotes).HasMaxLength(500);
            entity
                .HasOne(x => x.RequestedByUser)
                .WithMany()
                .HasForeignKey(x => x.RequestedByUserId)
                .OnDelete(DeleteBehavior.NoAction);
            entity
                .HasOne(x => x.ReviewedByUser)
                .WithMany()
                .HasForeignKey(x => x.ReviewedByUserId)
                .OnDelete(DeleteBehavior.NoAction);
        });

        modelBuilder.Entity<StockMovement>(entity =>
        {
            entity.Property(x => x.QuantityChanged).HasPrecision(18, 2);
            entity.Property(x => x.PreviousQuantity).HasPrecision(18, 2);
            entity.Property(x => x.NewQuantity).HasPrecision(18, 2);
            entity.Property(x => x.ReferenceNo).HasMaxLength(100);
            entity.Property(x => x.Remarks).HasMaxLength(250);
        });

        modelBuilder.Entity<Sale>(entity =>
        {
            entity.HasIndex(x => x.SaleNumber).IsUnique();
            entity.Property(x => x.SaleNumber).HasMaxLength(50).IsRequired();
            entity.Property(x => x.CustomerName).HasMaxLength(150);
            entity.Property(x => x.CustomerAddress).HasMaxLength(250);
            entity.Property(x => x.CustomerTin).HasMaxLength(50);
            entity.Property(x => x.Remarks).HasMaxLength(250);
            entity.Property(x => x.PoNumber).HasMaxLength(100);
            entity.Property(x => x.Terms).HasMaxLength(50);
            entity.Property(x => x.Subtotal).HasPrecision(18, 2);
            entity.Property(x => x.DiscountAmount).HasPrecision(18, 2);
            entity.Property(x => x.TaxAmount).HasPrecision(18, 2);
            entity.Property(x => x.TotalAmount).HasPrecision(18, 2);
            entity.Property(x => x.AmountPaid).HasPrecision(18, 2);
            entity.Property(x => x.ChangeDue).HasPrecision(18, 2);
        });

        modelBuilder.Entity<ReturnRecord>(entity =>
        {
            entity.ToTable("Returns");
            entity.HasIndex(x => x.ReturnNumber).IsUnique();
            entity.Property(x => x.ReturnNumber).HasMaxLength(50).IsRequired();
            entity.Property(x => x.TotalReturnAmount).HasPrecision(18, 2);
            entity.Property(x => x.Remarks).HasMaxLength(250);
            entity
                .HasOne(x => x.ProcessedByUser)
                .WithMany()
                .HasForeignKey(x => x.ProcessedByUserId)
                .OnDelete(DeleteBehavior.NoAction);
        });

        modelBuilder.Entity<ReturnItem>(entity =>
        {
            entity.Property(x => x.Quantity).HasPrecision(18, 2);
            entity.Property(x => x.UnitPrice).HasPrecision(18, 2);
            entity.Property(x => x.ReturnAmount).HasPrecision(18, 2);
            entity.Property(x => x.Remarks).HasMaxLength(250);
            entity
                .HasOne(x => x.SaleItem)
                .WithMany(x => x.ReturnItems)
                .HasForeignKey(x => x.SaleItemId)
                .OnDelete(DeleteBehavior.NoAction);
        });

        modelBuilder.Entity<SaleActionRequest>(entity =>
        {
            entity.Property(x => x.RequestReason).HasMaxLength(500).IsRequired();
            entity.Property(x => x.RequestedReturnItemsJson).HasMaxLength(4000);
            entity.Property(x => x.ReviewNotes).HasMaxLength(500);
            entity
                .HasOne(x => x.RequestedByUser)
                .WithMany()
                .HasForeignKey(x => x.RequestedByUserId)
                .OnDelete(DeleteBehavior.NoAction);
            entity
                .HasOne(x => x.ReviewedByUser)
                .WithMany()
                .HasForeignKey(x => x.ReviewedByUserId)
                .OnDelete(DeleteBehavior.NoAction);
        });

        modelBuilder.Entity<SaleItem>(entity =>
        {
            entity.Property(x => x.ProductNameSnapshot).HasMaxLength(150);
            entity.Property(x => x.SkuSnapshot).HasMaxLength(50);
            entity.Property(x => x.Quantity).HasPrecision(18, 2);
            entity.Property(x => x.UnitPrice).HasPrecision(18, 2);
            entity.Property(x => x.CostPriceSnapshot).HasPrecision(18, 2);
            entity.Property(x => x.LineTotal).HasPrecision(18, 2);
        });

        modelBuilder.Entity<SalesOrder>(entity =>
        {
            entity.HasIndex(x => x.OrderNumber).IsUnique();
            entity.Property(x => x.OrderNumber).HasMaxLength(50).IsRequired();
            entity.Property(x => x.CustomerName).HasMaxLength(150).IsRequired();
            entity.Property(x => x.CustomerContact).HasMaxLength(100);
            entity.Property(x => x.CustomerAddress).HasMaxLength(250);
            entity.Property(x => x.Remarks).HasMaxLength(250);
            entity.Property(x => x.Subtotal).HasPrecision(18, 2);
            entity.Property(x => x.DiscountAmount).HasPrecision(18, 2);
            entity.Property(x => x.TaxAmount).HasPrecision(18, 2);
            entity.Property(x => x.TotalAmount).HasPrecision(18, 2);
        });

        modelBuilder.Entity<SalesOrderItem>(entity =>
        {
            entity.Property(x => x.Quantity).HasPrecision(18, 2);
            entity.Property(x => x.UnitPrice).HasPrecision(18, 2);
            entity.Property(x => x.LineTotal).HasPrecision(18, 2);
        });

        modelBuilder.Entity<PurchaseOrder>(entity =>
        {
            entity.HasIndex(x => x.OrderNumber).IsUnique();
            entity.Property(x => x.OrderNumber).HasMaxLength(50).IsRequired();
            entity.Property(x => x.Remarks).HasMaxLength(250);
            entity.Property(x => x.TotalEstimatedCost).HasPrecision(18, 2);
        });

        modelBuilder.Entity<PurchaseOrderItem>(entity =>
        {
            entity.Property(x => x.Quantity).HasPrecision(18, 2);
            entity.Property(x => x.UnitCost).HasPrecision(18, 2);
            entity.Property(x => x.LineTotal).HasPrecision(18, 2);
        });

        modelBuilder.Entity<Payment>(entity =>
        {
            entity.Property(x => x.Amount).HasPrecision(18, 2);
            entity.Property(x => x.ReferenceNumber).HasMaxLength(100);
            entity.Property(x => x.BankName).HasMaxLength(100);
            entity.Property(x => x.BankBranch).HasMaxLength(100);
            entity.Property(x => x.CheckNumber).HasMaxLength(100);
            entity.Property(x => x.Details).HasMaxLength(250);
        });

        modelBuilder.Entity<Supplier>(entity =>
        {
            entity.Property(x => x.Name).HasMaxLength(150).IsRequired();
            entity.Property(x => x.ContactPerson).HasMaxLength(100);
            entity.Property(x => x.ContactNumber).HasMaxLength(50);
            entity.Property(x => x.Email).HasMaxLength(150);
            entity.Property(x => x.Address).HasMaxLength(250);
        });

        modelBuilder.Entity<StockInRecord>(entity =>
        {
            entity.HasIndex(x => x.ReferenceNumber).IsUnique();
            entity.Property(x => x.ReferenceNumber).HasMaxLength(100).IsRequired();
            entity.Property(x => x.ContainerNumber).HasMaxLength(100);
            entity.Property(x => x.StockNumber).HasMaxLength(100);
            entity.Property(x => x.ProductReferenceNumber).HasMaxLength(100);
            entity.Property(x => x.Remarks).HasMaxLength(250);
            entity.Property(x => x.ReviewNotes).HasMaxLength(250);
            entity
                .HasOne(x => x.ReceivedByUser)
                .WithMany(x => x.StockInRecords)
                .HasForeignKey(x => x.ReceivedByUserId)
                .OnDelete(DeleteBehavior.NoAction);
            entity
                .HasOne(x => x.ReviewedByUser)
                .WithMany()
                .HasForeignKey(x => x.ReviewedByUserId)
                .OnDelete(DeleteBehavior.NoAction);
        });

        modelBuilder.Entity<StockInItem>(entity =>
        {
            entity.Property(x => x.Quantity).HasPrecision(18, 2);
            entity.Property(x => x.UnitCost).HasPrecision(18, 2);
        });

        modelBuilder.Entity<AuditLog>(entity =>
        {
            entity.Property(x => x.Action).HasMaxLength(100).IsRequired();
            entity.Property(x => x.EntityName).HasMaxLength(100).IsRequired();
            entity.Property(x => x.EntityId).HasMaxLength(100).IsRequired();
            entity.Property(x => x.OldValue).HasMaxLength(1000);
            entity.Property(x => x.NewValue).HasMaxLength(1000);
            entity.Property(x => x.Details).HasMaxLength(2000);
            entity.Property(x => x.IpAddress).HasMaxLength(50);
        });
    }
}
