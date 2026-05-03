using GenSteelPOS.Application.DTOs;
using GenSteelPOS.Application.Services;
using GenSteelPOS.Domain.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GenSteelPOS.Api.Controllers;

[ApiController]
[Authorize(Roles = $"{AppRoles.Admin},{AppRoles.SuperAdmin}")]
[Route("api/pos")]
public sealed class PosController(IPosService posService) : ControllerBase
{
    [HttpPost("sales")]
    public async Task<ActionResult<SaleDto>> ProcessSale([FromBody] ProcessSaleRequest request, CancellationToken cancellationToken) =>
        Ok(await posService.ProcessSaleAsync(request, cancellationToken));
}
