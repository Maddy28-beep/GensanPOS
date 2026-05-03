using GenSteelPOS.Application.DTOs;
using GenSteelPOS.Application.Services;
using GenSteelPOS.Domain.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GenSteelPOS.Api.Controllers;

[ApiController]
[Route("api/stock-movements")]
[Authorize(Roles = $"{AppRoles.Admin},{AppRoles.SuperAdmin}")]
public sealed class StockMovementsController(IStockMovementService stockMovementService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<List<StockMovementDto>>> GetAll(CancellationToken cancellationToken) =>
        Ok(await stockMovementService.GetAllAsync(cancellationToken));
}
