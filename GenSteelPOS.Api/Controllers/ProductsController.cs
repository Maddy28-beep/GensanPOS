using GenSteelPOS.Application.DTOs;
using GenSteelPOS.Application.Services;
using GenSteelPOS.Domain.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GenSteelPOS.Api.Controllers;

[ApiController]
[Route("api/products")]
public sealed class ProductsController(IProductService productService) : ControllerBase
{
    [HttpGet]
    [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.SuperAdmin}")]
    public async Task<ActionResult<List<ProductDto>>> GetAll(CancellationToken cancellationToken) =>
        Ok(await productService.GetAllAsync(cancellationToken));

    [HttpGet("pos")]
    [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.SuperAdmin}")]
    public async Task<ActionResult<List<ProductDto>>> GetActiveForPos(CancellationToken cancellationToken) =>
        Ok(await productService.GetActiveForPosAsync(cancellationToken));

    [HttpPost]
    [Authorize(Roles = AppRoles.SuperAdmin)]
    public async Task<ActionResult<ProductDto>> Create([FromBody] CreateProductRequest request, CancellationToken cancellationToken) =>
        Ok(await productService.CreateAsync(request, cancellationToken));

    [HttpPut("{id:int}")]
    [Authorize(Roles = AppRoles.SuperAdmin)]
    public async Task<ActionResult<ProductDto>> Update(int id, [FromBody] UpdateProductRequest request, CancellationToken cancellationToken) =>
        Ok(await productService.UpdateAsync(id, request, cancellationToken));
}
