using GenSteelPOS.Application.DTOs;
using GenSteelPOS.Application.Services;
using GenSteelPOS.Domain.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GenSteelPOS.Api.Controllers;

[ApiController]
[Route("api/sale-action-requests")]
[Authorize(Roles = $"{AppRoles.Admin},{AppRoles.SuperAdmin}")]
public sealed class SaleActionRequestsController(ISaleActionRequestService saleActionRequestService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<List<SaleActionRequestDto>>> GetAll(CancellationToken cancellationToken) =>
        Ok(await saleActionRequestService.GetAllAsync(cancellationToken));

    [HttpPost]
    public async Task<ActionResult<SaleActionRequestDto>> Create([FromBody] CreateSaleActionRequestRequest request, CancellationToken cancellationToken) =>
        Ok(await saleActionRequestService.CreateAsync(request, cancellationToken));

    [HttpPost("{id:int}/approve")]
    [Authorize(Roles = AppRoles.SuperAdmin)]
    public async Task<ActionResult<SaleActionRequestDto>> Approve(int id, [FromBody] ReviewSaleActionRequestRequest request, CancellationToken cancellationToken) =>
        Ok(await saleActionRequestService.ApproveAsync(id, request, cancellationToken));

    [HttpPost("{id:int}/reject")]
    [Authorize(Roles = AppRoles.SuperAdmin)]
    public async Task<ActionResult<SaleActionRequestDto>> Reject(int id, [FromBody] ReviewSaleActionRequestRequest request, CancellationToken cancellationToken) =>
        Ok(await saleActionRequestService.RejectAsync(id, request, cancellationToken));
}
