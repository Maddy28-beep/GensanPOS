using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using GenSteelPOS.Application.Common.Interfaces;
using GenSteelPOS.Domain.Entities;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;

namespace GenSteelPOS.Infrastructure.Security;

public sealed class JwtTokenGenerator(IConfiguration configuration) : IJwtTokenGenerator
{
    public string GenerateToken(User user, string roleName)
    {
        var jwtSection = configuration.GetSection("Jwt");
        var key = jwtSection["Key"] ?? throw new InvalidOperationException("Jwt:Key is missing.");
        var issuer = jwtSection["Issuer"] ?? "GenSteelPOS";
        var audience = jwtSection["Audience"] ?? "GenSteelPOS.Client";
        var expiryMinutes = int.TryParse(jwtSection["ExpiryMinutes"], out var parsedExpiry) ? parsedExpiry : 120;

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(JwtRegisteredClaimNames.UniqueName, user.Username),
            new(ClaimTypes.Name, user.Username),
            new(ClaimTypes.Role, roleName)
        };

        var credentials = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key)),
            SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer,
            audience,
            claims,
            expires: DateTime.UtcNow.AddMinutes(expiryMinutes),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
