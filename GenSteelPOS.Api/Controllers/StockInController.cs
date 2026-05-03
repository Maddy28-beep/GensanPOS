using GenSteelPOS.Application.DTOs;
using GenSteelPOS.Application.Services;
using GenSteelPOS.Domain.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GenSteelPOS.Api.Controllers;

[ApiController]
[Route("api/stock-in")]
public sealed class StockInController(IStockInService stockInService) : ControllerBase
{
    [HttpGet]
    [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.SuperAdmin}")]
    public async Task<ActionResult<List<StockInRecordDto>>> GetAll(CancellationToken cancellationToken) =>
        Ok(await stockInService.GetAllAsync(cancellationToken));

    [HttpPost]
    [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.SuperAdmin}")]
    public async Task<ActionResult<StockInRecordDto>> Create([FromBody] CreateStockInRequest request, CancellationToken cancellationToken) =>
        Ok(await stockInService.CreateAsync(request, cancellationToken));

    [HttpPost("{id:int}/approve")]
    [Authorize(Roles = AppRoles.SuperAdmin)]
    public async Task<ActionResult<StockInRecordDto>> Approve(int id, [FromBody] ReviewStockInRequest request, CancellationToken cancellationToken) =>
        Ok(await stockInService.ApproveAsync(id, request, cancellationToken));

    [HttpPost("{id:int}/reject")]
    [Authorize(Roles = AppRoles.SuperAdmin)]
    public async Task<ActionResult<StockInRecordDto>> Reject(int id, [FromBody] ReviewStockInRequest request, CancellationToken cancellationToken) =>
        Ok(await stockInService.RejectAsync(id, request, cancellationToken));
}
