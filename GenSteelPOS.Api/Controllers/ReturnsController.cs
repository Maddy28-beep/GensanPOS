using GenSteelPOS.Application.DTOs;
using GenSteelPOS.Application.Services;
using GenSteelPOS.Domain.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GenSteelPOS.Api.Controllers;

[ApiController]
[Route("api/returns")]
[Authorize(Roles = AppRoles.SuperAdmin)]
public sealed class ReturnsController(IReturnService returnService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<List<ReturnDto>>> GetAll(CancellationToken cancellationToken) =>
        Ok(await returnService.GetAllAsync(cancellationToken));

    [HttpPost]
    public async Task<ActionResult<ReturnDto>> Create([FromBody] CreateReturnRequest request, CancellationToken cancellationToken) =>
        Ok(await returnService.CreateAsync(request, cancellationToken));
}
