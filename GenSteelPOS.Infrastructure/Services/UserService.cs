using GenSteelPOS.Application.Common.Exceptions;
using GenSteelPOS.Application.Common.Interfaces;
using GenSteelPOS.Application.DTOs;
using GenSteelPOS.Application.Services;
using GenSteelPOS.Domain.Constants;
using GenSteelPOS.Domain.Entities;

namespace GenSteelPOS.Infrastructure.Services;

public sealed class UserService(
    IUserRepository userRepository,
    IRoleRepository roleRepository,
    IPasswordHasherService passwordHasherService,
    IUnitOfWork unitOfWork,
    IAuditLogService auditLogService) : IUserService
{
    public async Task<List<UserDto>> GetAllAsync(CancellationToken cancellationToken = default) =>
        (await userRepository.GetAllAsync(cancellationToken)).Select(x => x.ToDto()).ToList();

    public async Task<UserDto> CreateAsync(CreateUserRequest request, CancellationToken cancellationToken = default)
    {
        if (!AppRoles.All.Contains(request.RoleName))
        {
            throw new AppException("Invalid role name.");
        }

        if (await userRepository.GetByUsernameAsync(request.Username, cancellationToken) is not null)
        {
            throw new AppException("Username already exists.");
        }

        var role = await roleRepository.GetByNameAsync(request.RoleName, cancellationToken)
            ?? throw new AppException("Role not found.");

        var entity = new User
        {
            FullName = request.FullName,
            Username = request.Username,
            Email = request.Email,
            PasswordHash = passwordHasherService.HashPassword(request.Password),
            IsActive = true,
            RoleId = role.Id,
            Role = role
        };

        await userRepository.AddAsync(entity, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        await auditLogService.CreateAsync(
            "Create",
            "User",
            entity.Id.ToString(),
            $"Created user account for {entity.FullName}.",
            "-",
            $"Username: {entity.Username}; Role: {role.Name}; Active: {entity.IsActive}",
            cancellationToken);
        return entity.ToDto();
    }

    public async Task<UserDto> UpdateAsync(int id, UpdateUserRequest request, CancellationToken cancellationToken = default)
    {
        var entity = await userRepository.GetByIdAsync(id, cancellationToken)
            ?? throw new AppException("User not found.", 404);
        var role = await roleRepository.GetByNameAsync(request.RoleName, cancellationToken)
            ?? throw new AppException("Role not found.");
        var oldValue = $"Name: {entity.FullName}; Email: {entity.Email}; Active: {entity.IsActive}";

        entity.FullName = request.FullName;
        entity.Email = request.Email;
        entity.IsActive = request.IsActive;
        entity.RoleId = role.Id;
        entity.Role = role;
        entity.UpdatedAtUtc = DateTime.UtcNow;

        userRepository.Update(entity);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        var newValue = $"Name: {entity.FullName}; Email: {entity.Email}; Role: {role.Name}; Active: {entity.IsActive}";
        await auditLogService.CreateAsync("Update", "User", entity.Id.ToString(), $"Updated user account for {entity.FullName}.", oldValue, newValue, cancellationToken);
        return entity.ToDto();
    }
}
