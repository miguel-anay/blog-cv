using BlogBackend.Domain.Common.Exceptions;

namespace BlogBackend.Domain.Identity.Entities;

public class User
{
    public Guid Id { get; private set; }
    public string Email { get; private set; }
    public string PasswordHash { get; private set; }
    public UserRole Role { get; private set; }
    public string? RefreshTokenHash { get; private set; }
    public DateTime? RefreshTokenExpiry { get; private set; }

    public User(Guid id, string email, string passwordHash, UserRole role)
    {
        if (string.IsNullOrWhiteSpace(passwordHash))
            throw new DomainException("PasswordHash must not be empty.");

        Id = id;
        Email = email;
        PasswordHash = passwordHash;
        Role = role;
    }

    public void SetRefreshToken(string hash, DateTime expiry)
    {
        RefreshTokenHash = hash;
        RefreshTokenExpiry = expiry;
    }

    public void RevokeRefreshToken()
    {
        RefreshTokenHash = null;
        RefreshTokenExpiry = null;
    }
}
