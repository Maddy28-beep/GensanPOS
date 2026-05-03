using GenSteelPOS.Application.Common.Interfaces;
using GenSteelPOS.Application.DTOs;
using GenSteelPOS.Application.Services;

namespace GenSteelPOS.Infrastructure.Services;

public sealed class StockMovementService(IStockMovementRepository stockMovementRepository) : IStockMovementService
{
    public async Task<List<StockMovementDto>> GetAllAsync(CancellationToken cancellationToken = default) =>
        (await stockMovementRepository.GetAllWithDetailsAsync(cancellationToken)).Select(x => x.ToDto()).ToList();
}
