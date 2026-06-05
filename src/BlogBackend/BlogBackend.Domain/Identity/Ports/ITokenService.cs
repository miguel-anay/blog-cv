using System.Security.Claims;
using BlogBackend.Domain.Identity.Entities;

namespace BlogBackend.Domain.Identity.Ports;

public interface ITokenService
{
    string GenerateAccessToken(User user);
    string GenerateRefreshTokenHash();
    ClaimsPrincipal? ValidateAccessToken(string token);
}
