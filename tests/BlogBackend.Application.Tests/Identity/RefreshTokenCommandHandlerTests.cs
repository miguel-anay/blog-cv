using BlogBackend.Application.Identity.Commands.RefreshToken;
using BlogBackend.Domain.Common.Exceptions;
using BlogBackend.Domain.Identity.Entities;
using BlogBackend.Domain.Identity.Ports;
using FluentAssertions;
using NSubstitute;

namespace BlogBackend.Application.Tests.Identity;

public class RefreshTokenCommandHandlerTests
{
    private readonly IUserRepository _userRepository;
    private readonly ITokenService _tokenService;
    private readonly RefreshTokenCommandHandler _handler;

    public RefreshTokenCommandHandlerTests()
    {
        _userRepository = Substitute.For<IUserRepository>();
        _tokenService = Substitute.For<ITokenService>();
        _handler = new RefreshTokenCommandHandler(_userRepository, _tokenService);
    }

    [Fact]
    public async Task Handle_WhenTokenExpired_ThrowsUnauthorizedException()
    {
        // Arrange
        var rawToken = "some-token";
        var hash = BCrypt.Net.BCrypt.HashPassword(rawToken);
        var user = new User(Guid.NewGuid(), "user@example.com", BCrypt.Net.BCrypt.HashPassword("pass"), UserRole.Admin);
        user.SetRefreshToken(hash, DateTime.UtcNow.AddDays(-1)); // expired

        _userRepository.GetByIdAsync(user.Id, Arg.Any<CancellationToken>())
            .Returns(user);

        var command = new RefreshTokenCommand(user.Id, rawToken);

        // Act
        var act = async () => await _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<UnauthorizedException>();
    }

    [Fact]
    public async Task Handle_WhenTokenValid_ReturnsNewTokenPair()
    {
        // Arrange
        var rawToken = "valid-token";
        var hash = BCrypt.Net.BCrypt.HashPassword(rawToken);
        var user = new User(Guid.NewGuid(), "user@example.com", BCrypt.Net.BCrypt.HashPassword("pass"), UserRole.Admin);
        user.SetRefreshToken(hash, DateTime.UtcNow.AddDays(7)); // valid

        _userRepository.GetByIdAsync(user.Id, Arg.Any<CancellationToken>())
            .Returns(user);

        _tokenService.GenerateAccessToken(user).Returns("new-access-token");
        _tokenService.GenerateRefreshTokenHash().Returns("new-refresh-raw");
        _userRepository.UpdateAsync(Arg.Any<User>(), Arg.Any<CancellationToken>())
            .Returns(Task.CompletedTask);

        var command = new RefreshTokenCommand(user.Id, rawToken);

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.AccessToken.Should().Be("new-access-token");
        result.RefreshToken.Should().Be("new-refresh-raw");
        await _userRepository.Received(1).UpdateAsync(user, Arg.Any<CancellationToken>());
    }
}
