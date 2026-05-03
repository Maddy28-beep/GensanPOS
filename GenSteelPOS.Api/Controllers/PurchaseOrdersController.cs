using GenSteelPOS.Application.DTOs;
using GenSteelPOS.Application.Services;
using GenSteelPOS.Domain.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GenSteelPOS.Api.Controllers;

[ApiController]
[Route("api/purchase-orders")]
[Authorize(Roles = AppRoles.SuperAdmin)]
public sealed class PurchaseOrdersController(IPurchaseOrderService purchaseOrderService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<List<PurchaseOrderDto>>> GetAll(CancellationToken cancellationToken) =>
        Ok(await purchaseOrderService.GetAllAsync(cancellationToken));

    [HttpGet("{id:int}")]
    public async Task<ActionResult<PurchaseOrderDto>> GetById(int id, CancellationToken cancellationToken) =>
        Ok(await purchaseOrderService.GetByIdAsync(id, cancellationToken));

    [HttpPost]
    public async Task<ActionResult<PurchaseOrderDto>> Create([FromBody] CreatePurchaseOrderRequest request, CancellationToken cancellationToken) =>
        Ok(await purchaseOrderService.CreateAsync(request, cancellationToken));

    [HttpPost("{id:int}/cancel")]
    public async Task<ActionResult<PurchaseOrderDto>> Cancel(int id, [FromBody] UpdatePurchaseOrderStatusRequest request, CancellationToken cancellationToken) =>
        Ok(await purchaseOrderService.CancelAsync(id, request, cancellationToken));

    [HttpPost("{id:int}/receive")]
    public async Task<ActionResult<StockInRecordDto>> Receive(int id, [FromBody] ReceivePurchaseOrderRequest request, CancellationToken cancellationToken) =>
        Ok(await purchaseOrderService.ReceiveAsync(id, request, cancellationToken));
}
