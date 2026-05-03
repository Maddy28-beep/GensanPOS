using GenSteelPOS.Application.Common.Interfaces;
using GenSteelPOS.Application.DTOs;
using GenSteelPOS.Application.Services;
using GenSteelPOS.Domain.Entities;

namespace GenSteelPOS.Infrastructure.Services;

public sealed class SupplierService(
    ISupplierRepository supplierRepository,
    IUnitOfWork unitOfWork,
    IAuditLogService auditLogService) : ISupplierService
{
    public async Task<List<SupplierDto>> GetAllAsync(CancellationToken cancellationToken = default) =>
        (await supplierRepository.GetAllAsync(cancellationToken)).Select(x => x.ToDto()).ToList();

    public async Task<SupplierDto> CreateAsync(CreateSupplierRequest request, CancellationToken cancellationToken = default)
    {
        var entity = new Supplier
        {
            Name = request.Name,
            ContactPerson = request.ContactPerson,
            ContactNumber = request.ContactNumber,
            Email = request.Email,
            Address = request.Address,
            IsActive = true
        };

        await supplierRepository.AddAsync(entity, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        await auditLogService.CreateAsync("Create", "Supplier", entity.Id.ToString(), $"Created supplier {entity.Name}.", cancellationToken);
        return entity.ToDto();
    }
}
