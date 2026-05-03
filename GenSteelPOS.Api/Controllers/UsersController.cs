using GenSteelPOS.Application.DTOs;
using GenSteelPOS.Application.Services;
using GenSteelPOS.Domain.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GenSteelPOS.Api.Controllers;

[ApiController]
[Authorize(Roles = AppRoles.SuperAdmin)]
[Route("api/users")]
public sealed class UsersController(IUserService userService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<List<UserDto>>> GetAll(CancellationToken cancellationToken) =>
        Ok(await userService.GetAllAsync(cancellationToken));

    [HttpPost]
    public async Task<ActionResult<UserDto>> Create([FromBody] CreateUserRequest request, CancellationToken cancellationToken) =>
        Ok(await userService.CreateAsync(request, cancellationToken));

    [HttpPut("{id:int}")]
    public async Task<ActionResult<UserDto>> Update(int id, [FromBody] UpdateUserRequest request, CancellationToken cancellationToken) =>
        Ok(await userService.UpdateAsync(id, request, cancellationToken));
}
