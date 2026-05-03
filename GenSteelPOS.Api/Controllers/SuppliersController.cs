using GenSteelPOS.Application.DTOs;
using GenSteelPOS.Application.Services;
using GenSteelPOS.Domain.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GenSteelPOS.Api.Controllers;

[ApiController]
[Route("api/suppliers")]
public sealed class SuppliersController(ISupplierService supplierService) : ControllerBase
{
    [HttpGet]
    [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.SuperAdmin}")]
    public async Task<ActionResult<List<SupplierDto>>> GetAll(CancellationToken cancellationToken) =>
        Ok(await supplierService.GetAllAsync(cancellationToken));

    [HttpPost]
    [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.SuperAdmin}")]
    public async Task<ActionResult<SupplierDto>> Create([FromBody] CreateSupplierRequest request, CancellationToken cancellationToken) =>
        Ok(await supplierService.CreateAsync(request, cancellationToken));
}
