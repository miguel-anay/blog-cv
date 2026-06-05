using BlogBackend.Domain.Blog.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BlogBackend.Infrastructure.Persistence.Configurations.Blog;

public class AuthorConfiguration : IEntityTypeConfiguration<Author>
{
    public void Configure(EntityTypeBuilder<Author> builder)
    {
        builder.ToTable("authors", "blog");

        builder.HasKey(a => a.Id);

        builder.Property(a => a.Id)
            .ValueGeneratedNever();

        builder.Property(a => a.DisplayName)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(a => a.Email)
            .IsRequired()
            .HasMaxLength(320);

        builder.HasIndex(a => a.Email)
            .IsUnique();
    }
}
