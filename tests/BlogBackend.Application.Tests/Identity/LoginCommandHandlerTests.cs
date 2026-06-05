using BlogBackend.Application.Identity.Commands.Login;
using BlogBackend.Domain.Common.Exceptions;
using BlogBackend.Domain.Identity.Entities;
using BlogBackend.Domain.Identity.Ports;
using FluentAssertions;
using NSubstitute;

namespace BlogBackend.Application.Tests.Identity;

public class LoginCommandHandlerTests
{
    private readonly IUserRepository _userRepository;
    private readonly ITokenService _tokenService;
    private readonly LoginCommandHandler _handler;

    public LoginCommandHandlerTests()
    {
        _userRepository = Substitute.For<IUserRepository>();
        _tokenService = Substitute.For<ITokenService>();
        _handler = new LoginCommandHandler(_userRepository, _tokenService);
    }

    [Fact]
    public async Task Handle_WhenUserNotFound_ThrowsUnauthorizedException()
    {
        // Arrange
        _userRepository.GetByEmailAsync(Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns((User?)null);

        var command = new LoginCommand("notfound@example.com", "password");

        // Act
        var act = async () => await _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<UnauthorizedException>();
    }

    [Fact]
    public async Task Handle_WhenPasswordInvalid_ThrowsUnauthorizedException()
    {
        // Arrange
        // BCrypt hash of "correct-password"
        var hash = BCrypt.Net.BCrypt.HashPassword("correct-password");
        var user = new User(Guid.NewGuid(), "user@example.com", hash, UserRole.Admin);

        _userRepository.GetByEmailAsync("user@example.com", Arg.Any<CancellationToken>())
            .Returns(user);

        var command = new LoginCommand("user@example.com", "wrong-password");

        // Act
        var act = async () => await _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<UnauthorizedException>();
    }
}
