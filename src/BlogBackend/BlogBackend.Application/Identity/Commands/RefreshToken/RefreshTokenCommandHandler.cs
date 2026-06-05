using BlogBackend.Application.Common.DTOs;
using BlogBackend.Domain.Common.Exceptions;
using BlogBackend.Domain.Identity.Ports;
using Mediator;

namespace BlogBackend.Application.Identity.Commands.RefreshToken;

public class RefreshTokenCommandHandler : IRequestHandler<RefreshTokenCommand, LoginResult>
{
    private readonly IUserRepository _userRepository;
    private readonly ITokenService _tokenService;

    public RefreshTokenCommandHandler(IUserRepository userRepository, ITokenService tokenService)
    {
        _userRepository = userRepository;
        _tokenService = tokenService;
    }

    public async ValueTask<LoginResult> Handle(RefreshTokenCommand request, CancellationToken cancellationToken)
    {
        var user = await _userRepository.GetByIdAsync(request.UserId, cancellationToken)
            ?? throw new UnauthorizedException("Invalid refresh token.");

        if (user.RefreshTokenHash is null
            || user.RefreshTokenExpiry is null
            || user.RefreshTokenExpiry <= DateTime.UtcNow)
        {
            throw new UnauthorizedException("Refresh token has expired or is invalid.");
        }

        if (!BCrypt.Net.BCrypt.Verify(request.RefreshToken, user.RefreshTokenHash))
            throw new UnauthorizedException("Invalid refresh token.");

        var newAccessToken = _tokenService.GenerateAccessToken(user);
        var newRefreshRaw = _tokenService.GenerateRefreshTokenHash();
        var newRefreshHash = BCrypt.Net.BCrypt.HashPassword(newRefreshRaw);

        user.SetRefreshToken(newRefreshHash, DateTime.UtcNow.AddDays(7));
        await _userRepository.UpdateAsync(user, cancellationToken);

        return new LoginResult(newAccessToken, newRefreshRaw, user.Role.ToString());
    }
}
