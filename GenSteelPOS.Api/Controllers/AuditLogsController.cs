using GenSteelPOS.Application.DTOs;
using GenSteelPOS.Application.Services;
using GenSteelPOS.Domain.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GenSteelPOS.Api.Controllers;

[ApiController]
[Authorize(Roles = AppRoles.SuperAdmin)]
[Route("api/audit-logs")]
public sealed class AuditLogsController(IAuditLogService auditLogService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<List<AuditLogDto>>> GetAll(CancellationToken cancellationToken) =>
        Ok(await auditLogService.GetAllAsync(cancellationToken));
}
