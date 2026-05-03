using GenSteelPOS.Domain.Entities;

namespace GenSteelPOS.Application.Common.Interfaces;

public interface IJwtTokenGenerator
{
    string GenerateToken(User user, string roleName);
}
