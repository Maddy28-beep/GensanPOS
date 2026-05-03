namespace GenSteelPOS.Application.Common.Interfaces;

public interface ICurrentUserContext
{
    int? UserId { get; }
    string Username { get; }
    string Role { get; }
    string IpAddress { get; }
}
