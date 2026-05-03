using GenSteelPOS.Application.Common.Interfaces;
using GenSteelPOS.Domain.Entities;
using Microsoft.AspNetCore.Identity;

namespace GenSteelPOS.Infrastructure.Security;

public sealed class PasswordHasherService : IPasswordHasherService
{
    private readonly PasswordHasher<User> _passwordHasher = new();

    public string HashPassword(string password) =>
        _passwordHasher.HashPassword(new User(), password);

    public bool VerifyPassword(string hashedPassword, string providedPassword)
    {
        var result = _passwordHasher.VerifyHashedPassword(new User(), hashedPassword, providedPassword);
        return result is PasswordVerificationResult.Success or PasswordVerificationResult.SuccessRehashNeeded;
    }
}
