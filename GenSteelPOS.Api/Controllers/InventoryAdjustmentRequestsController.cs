using GenSteelPOS.Application.DTOs;
using GenSteelPOS.Application.Services;
using GenSteelPOS.Domain.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GenSteelPOS.Api.Controllers;

[ApiController]
[Route("api/inventory-adjustment-requests")]
[Authorize(Roles = $"{AppRoles.Admin},{AppRoles.SuperAdmin}")]
public sealed class InventoryAdjustmentRequestsController(IInventoryAdjustmentRequestService service) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<List<InventoryAdjustmentRequestDto>>> GetAll(CancellationToken cancellationToken) =>
        Ok(await service.GetAllAsync(cancellationToken));

    [HttpPost]
    [Authorize(Roles = AppRoles.Admin)]
    public async Task<ActionResult<InventoryAdjustmentRequestDto>> Create([FromBody] CreateInventoryAdjustmentRequest request, CancellationToken cancellationToken) =>
        Ok(await service.CreateAsync(request, cancellationToken));

    [HttpPost("{id:int}/approve")]
    [Authorize(Roles = AppRoles.SuperAdmin)]
    public async Task<ActionResult<InventoryAdjustmentRequestDto>> Approve(int id, [FromBody] ReviewInventoryAdjustmentRequest request, CancellationToken cancellationToken) =>
        Ok(await service.ApproveAsync(id, request, cancellationToken));

    [HttpPost("{id:int}/reject")]
    [Authorize(Roles = AppRoles.SuperAdmin)]
    public async Task<ActionResult<InventoryAdjustmentRequestDto>> Reject(int id, [FromBody] ReviewInventoryAdjustmentRequest request, CancellationToken cancellationToken) =>
        Ok(await service.RejectAsync(id, request, cancellationToken));
}
