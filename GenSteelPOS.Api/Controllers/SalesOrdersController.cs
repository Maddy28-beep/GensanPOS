using GenSteelPOS.Application.DTOs;
using GenSteelPOS.Application.Services;
using GenSteelPOS.Domain.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GenSteelPOS.Api.Controllers;

[ApiController]
[Route("api/sales-orders")]
[Authorize(Roles = AppRoles.SuperAdmin)]
public sealed class SalesOrdersController(ISalesOrderService salesOrderService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<List<SalesOrderDto>>> GetAll(CancellationToken cancellationToken) =>
        Ok(await salesOrderService.GetAllAsync(cancellationToken));

    [HttpGet("{id:int}")]
    public async Task<ActionResult<SalesOrderDto>> GetById(int id, CancellationToken cancellationToken) =>
        Ok(await salesOrderService.GetByIdAsync(id, cancellationToken));

    [HttpPost]
    public async Task<ActionResult<SalesOrderDto>> Create([FromBody] CreateSalesOrderRequest request, CancellationToken cancellationToken) =>
        Ok(await salesOrderService.CreateAsync(request, cancellationToken));

    [HttpPost("{id:int}/cancel")]
    public async Task<ActionResult<SalesOrderDto>> Cancel(int id, [FromBody] UpdateSalesOrderStatusRequest request, CancellationToken cancellationToken) =>
        Ok(await salesOrderService.CancelAsync(id, request, cancellationToken));

    [HttpPost("{id:int}/convert-to-sale")]
    public async Task<ActionResult<SaleDto>> ConvertToSale(int id, [FromBody] ConvertSalesOrderRequest request, CancellationToken cancellationToken) =>
        Ok(await salesOrderService.ConvertToSaleAsync(id, request, cancellationToken));
}
