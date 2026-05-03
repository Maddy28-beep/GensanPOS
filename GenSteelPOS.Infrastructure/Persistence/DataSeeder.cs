using GenSteelPOS.Application.Common.Interfaces;
using GenSteelPOS.Domain.Constants;
using GenSteelPOS.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace GenSteelPOS.Infrastructure.Persistence;

public sealed class DataSeeder(
    AppDbContext context,
    IPasswordHasherService passwordHasherService)
{
    public async Task SeedAsync(CancellationToken cancellationToken = default)
    {
        if (!await context.Roles.AnyAsync(cancellationToken))
        {
            await context.Roles.AddRangeAsync(
            [
                new Role { Name = AppRoles.SuperAdmin, Description = "Full system access" },
                new Role { Name = AppRoles.Admin, Description = "Cashier access for POS, sales, inventory view, and reports" }
            ], cancellationToken);
        }

        await context.SaveChangesAsync(cancellationToken);

        var superAdminRole = await context.Roles.SingleAsync(x => x.Name == AppRoles.SuperAdmin, cancellationToken);
        var adminRole = await context.Roles.SingleAsync(x => x.Name == AppRoles.Admin, cancellationToken);
        adminRole.Description = "Cashier access for POS, sales, inventory view, and reports";

        var ownerAccount = await context.Users.SingleOrDefaultAsync(x => x.Username == "owner", cancellationToken);
        if (ownerAccount is null)
        {
            await context.Users.AddAsync(new User
            {
                FullName = "System Owner",
                Username = "owner",
                Email = "owner@gensteel.local",
                PasswordHash = passwordHasherService.HashPassword("Owner123!"),
                RoleId = superAdminRole.Id,
                IsActive = true
            }, cancellationToken);
        }
        else
        {
            ownerAccount.FullName = "System Owner";
            ownerAccount.Email = "owner@gensteel.local";
            ownerAccount.PasswordHash = passwordHasherService.HashPassword("Owner123!");
            ownerAccount.RoleId = superAdminRole.Id;
            ownerAccount.IsActive = true;
        }

        var cashierAccount = await context.Users.SingleOrDefaultAsync(x => x.Username == "cashier", cancellationToken);
        var legacyAdminAccount = await context.Users.SingleOrDefaultAsync(x => x.Username == "admin", cancellationToken);
        var cashierUser = cashierAccount ?? legacyAdminAccount;

        if (cashierUser is null)
        {
            await context.Users.AddAsync(new User
            {
                FullName = "Store Cashier",
                Username = "cashier",
                Email = "cashier@gensteel.local",
                PasswordHash = passwordHasherService.HashPassword("Cashier123!"),
                RoleId = adminRole.Id,
                IsActive = true
            }, cancellationToken);
        }
        else
        {
            cashierUser.FullName = "Store Cashier";
            cashierUser.Username = cashierAccount is null ? "cashier" : cashierUser.Username;
            cashierUser.Email = "cashier@gensteel.local";
            cashierUser.PasswordHash = passwordHasherService.HashPassword("Cashier123!");
            cashierUser.RoleId = adminRole.Id;
            cashierUser.IsActive = true;
        }

        await context.SaveChangesAsync(cancellationToken);
    }
}
