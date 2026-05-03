using System.Security.Claims;
using GenSteelPOS.Application.Common.Interfaces;

namespace GenSteelPOS.Api.Infrastructure;

public sealed class CurrentUserContext(IHttpContextAccessor httpContextAccessor) : ICurrentUserContext
{
    public int? UserId =>
        int.TryParse(
            httpContextAccessor.HttpContext?.User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? httpContextAccessor.HttpContext?.User.FindFirstValue("sub"),
            out var userId)
            ? userId
            : null;

    public string Username =>
        httpContextAccessor.HttpContext?.User.Identity?.Name ?? "Anonymous";

    public string Role =>
        httpContextAccessor.HttpContext?.User.FindFirstValue(ClaimTypes.Role) ?? string.Empty;

    public string IpAddress =>
        httpContextAccessor.HttpContext?.Connection.RemoteIpAddress?.ToString() ?? "Unknown";
}
