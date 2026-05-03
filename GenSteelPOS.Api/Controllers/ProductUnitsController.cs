using GenSteelPOS.Application.DTOs;
using GenSteelPOS.Application.Services;
using GenSteelPOS.Domain.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GenSteelPOS.Api.Controllers;

[ApiController]
[Route("api/product-units")]
[Authorize(Roles = $"{AppRoles.Admin},{AppRoles.SuperAdmin}")]
public sealed class ProductUnitsController(IProductService productService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<List<ProductUnitDto>>> GetAll(CancellationToken cancellationToken) =>
        Ok(await productService.GetUnitsAsync(cancellationToken));

    [HttpPost]
    [Authorize(Roles = AppRoles.SuperAdmin)]
    public async Task<ActionResult<ProductUnitDto>> Create([FromBody] CreateProductUnitRequest request, CancellationToken cancellationToken) =>
        Ok(await productService.CreateUnitAsync(request, cancellationToken));
}
