using GenSteelPOS.Application.DTOs;
using GenSteelPOS.Application.Services;
using GenSteelPOS.Domain.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GenSteelPOS.Api.Controllers;

[ApiController]
[Route("api/inventory")]
public sealed class InventoryController(IInventoryService inventoryService) : ControllerBase
{
    [HttpGet]
    [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.SuperAdmin}")]
    public async Task<ActionResult<InventoryListResponseDto>> GetAll([FromQuery] InventoryQueryRequest request, CancellationToken cancellationToken) =>
        Ok(await inventoryService.GetAllAsync(request, cancellationToken));

    [HttpPost("adjust")]
    [Authorize(Roles = AppRoles.SuperAdmin)]
    public async Task<ActionResult<InventoryDto>> Adjust([FromBody] StockAdjustmentRequest request, CancellationToken cancellationToken) =>
        Ok(await inventoryService.AdjustStockAsync(request, cancellationToken));
}
