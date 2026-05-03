using GenSteelPOS.Application.Common.Exceptions;
using GenSteelPOS.Application.Common.Interfaces;
using GenSteelPOS.Application.DTOs;
using GenSteelPOS.Application.Services;

namespace GenSteelPOS.Infrastructure.Services;

public sealed class AuthService(
    IUserRepository userRepository,
    IPasswordHasherService passwordHasherService,
    IJwtTokenGenerator jwtTokenGenerator,
    IAuditLogService auditLogService) : IAuthService
{
    public async Task<AuthResponse> LoginAsync(LoginRequest request, CancellationToken cancellationToken = default)
    {
        var user = await userRepository.GetByUsernameAsync(request.Username, cancellationToken)
            ?? throw new AppException("Invalid username or password.", 401);

        if (!user.IsActive || !passwordHasherService.VerifyPassword(user.PasswordHash, request.Password))
        {
            throw new AppException("Invalid username or password.", 401);
        }

        var roleName = user.Role?.Name ?? throw new AppException("User role is not configured.", 500);
        var token = jwtTokenGenerator.GenerateToken(user, roleName);
        await auditLogService.CreateAsync("Login", "User", user.Id.ToString(), $"{user.FullName} signed in.", cancellationToken);

        return new AuthResponse
        {
            Token = token,
            ExpiresAtUtc = DateTime.UtcNow.AddHours(2),
            User = user.ToDto()
        };
    }
}
