using GenSteelPOS.Application.DTOs;
using GenSteelPOS.Application.Services;
using GenSteelPOS.Domain.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GenSteelPOS.Api.Controllers;

[ApiController]
[Route("api/sales")]
public sealed class SalesController(ISalesService salesService) : ControllerBase
{
    [HttpGet]
    [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.SuperAdmin}")]
    public async Task<ActionResult<List<SaleDto>>> GetAll(CancellationToken cancellationToken) =>
        Ok(await salesService.GetAllAsync(cancellationToken));

    [HttpGet("{id:int}")]
    [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.SuperAdmin}")]
    public async Task<ActionResult<SaleDto>> GetById(int id, CancellationToken cancellationToken) =>
        Ok(await salesService.GetByIdAsync(id, cancellationToken));

    [HttpPost("{id:int}/cancel")]
    [Authorize(Roles = AppRoles.SuperAdmin)]
    public async Task<ActionResult<SaleDto>> Cancel(int id, [FromBody] UpdateSaleStatusRequest request, CancellationToken cancellationToken) =>
        Ok(await salesService.CancelAsync(id, request, cancellationToken));

    [HttpPost("{id:int}/refund")]
    [Authorize(Roles = AppRoles.SuperAdmin)]
    public async Task<ActionResult<SaleDto>> Refund(int id, [FromBody] UpdateSaleStatusRequest request, CancellationToken cancellationToken) =>
        Ok(await salesService.RefundAsync(id, request, cancellationToken));

    [HttpPost("{id:int}/void")]
    [Authorize(Roles = AppRoles.SuperAdmin)]
    public async Task<ActionResult<SaleDto>> Void(int id, [FromBody] UpdateSaleStatusRequest request, CancellationToken cancellationToken) =>
        Ok(await salesService.VoidAsync(id, request, cancellationToken));
}
