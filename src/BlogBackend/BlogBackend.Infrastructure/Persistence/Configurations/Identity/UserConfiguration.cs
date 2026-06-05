using BlogBackend.Domain.Identity.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BlogBackend.Infrastructure.Persistence.Configurations.Identity;

public class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.ToTable("users", "identity");

        builder.HasKey(u => u.Id);

        builder.Property(u => u.Id)
            .ValueGeneratedNever();

        builder.Property(u => u.Email)
            .IsRequired()
            .HasMaxLength(320);

        builder.HasIndex(u => u.Email)
            .IsUnique();

        // HARD-005: Only the BCrypt hash is persisted — no plaintext password column
        builder.Property(u => u.PasswordHash)
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(u => u.Role)
            .IsRequired()
            .HasConversion<string>()
            .HasMaxLength(50);

        // Refresh token stored as BCrypt hash (HARD-005)
        builder.Property(u => u.RefreshTokenHash)
            .HasMaxLength(100);

        builder.Property(u => u.RefreshTokenExpiry);
    }
}
