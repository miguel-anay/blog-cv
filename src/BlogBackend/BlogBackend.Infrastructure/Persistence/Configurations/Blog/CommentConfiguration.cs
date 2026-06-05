using BlogBackend.Domain.Blog.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BlogBackend.Infrastructure.Persistence.Configurations.Blog;

public class CommentConfiguration : IEntityTypeConfiguration<Comment>
{
    public void Configure(EntityTypeBuilder<Comment> builder)
    {
        builder.ToTable("comments", "blog");

        builder.HasKey(c => c.Id);

        builder.Property(c => c.Id)
            .ValueGeneratedNever();

        builder.Property(c => c.PostId)
            .IsRequired();

        builder.Property(c => c.AuthorEmail)
            .HasMaxLength(320);

        builder.Property(c => c.Body)
            .IsRequired();

        builder.Property(c => c.Status)
            .IsRequired()
            .HasConversion<string>()
            .HasMaxLength(50);
    }
}
