using BlogBackend.Application.Common.DTOs;
using BlogBackend.Domain.Common.Exceptions;
using BlogBackend.Domain.Identity.Ports;
using Mediator;

namespace BlogBackend.Application.Identity.Commands.Login;

public class LoginCommandHandler : IRequestHandler<LoginCommand, LoginResult>
{
    private readonly IUserRepository _userRepository;
    private readonly ITokenService _tokenService;

    public LoginCommandHandler(IUserRepository userRepository, ITokenService tokenService)
    {
        _userRepository = userRepository;
        _tokenService = tokenService;
    }

    public async ValueTask<LoginResult> Handle(LoginCommand request, CancellationToken cancellationToken)
    {
        var user = await _userRepository.GetByEmailAsync(request.Email, cancellationToken);
        if (user is null)
            throw new UnauthorizedException("Invalid credentials.");

        if (!BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            throw new UnauthorizedException("Invalid credentials.");

        var accessToken = _tokenService.GenerateAccessToken(user);
        var refreshRaw = _tokenService.GenerateRefreshTokenHash();
        var refreshHash = BCrypt.Net.BCrypt.HashPassword(refreshRaw);

        user.SetRefreshToken(refreshHash, DateTime.UtcNow.AddDays(7));
        await _userRepository.UpdateAsync(user, cancellationToken);

        return new LoginResult(accessToken, refreshRaw, user.Role.ToString());
    }
}
