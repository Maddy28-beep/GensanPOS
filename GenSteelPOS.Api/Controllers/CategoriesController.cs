using GenSteelPOS.Application.DTOs;
using GenSteelPOS.Application.Services;
using GenSteelPOS.Domain.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GenSteelPOS.Api.Controllers;

[ApiController]
[Route("api/categories")]
public sealed class CategoriesController(IProductService productService) : ControllerBase
{
    [HttpGet]
    [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.SuperAdmin}")]
    public async Task<ActionResult<List<CategoryDto>>> GetAll(CancellationToken cancellationToken) =>
        Ok(await productService.GetCategoriesAsync(cancellationToken));

    [HttpPost]
    [Authorize(Roles = AppRoles.SuperAdmin)]
    public async Task<ActionResult<CategoryDto>> Create([FromBody] CreateCategoryRequest request, CancellationToken cancellationToken) =>
        Ok(await productService.CreateCategoryAsync(request, cancellationToken));

    [HttpPut("{id:int}")]
    [Authorize(Roles = AppRoles.SuperAdmin)]
    public async Task<ActionResult<CategoryDto>> Update(int id, [FromBody] UpdateCategoryRequest request, CancellationToken cancellationToken) =>
        Ok(await productService.UpdateCategoryAsync(id, request, cancellationToken));
}
