using BlogBackend.Domain.Identity.Entities;
using FluentAssertions;

namespace BlogBackend.Domain.Tests.Identity;

public class UserTests
{
    [Fact]
    public void SetRefreshToken_WhenCalled_SetsHashAndExpiry()
    {
        // Arrange
        var user = new User(
            Guid.NewGuid(),
            "admin@example.com",
            "hashedpassword123",
            UserRole.Admin);

        var tokenHash = "bcrypt-hashed-refresh-token";
        var expiry = DateTime.UtcNow.AddDays(7);

        // Act
        user.SetRefreshToken(tokenHash, expiry);

        // Assert
        user.RefreshTokenHash.Should().Be(tokenHash);
        user.RefreshTokenExpiry.Should().Be(expiry);
    }
}
