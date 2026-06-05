using BlogBackend.Domain.Blog.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BlogBackend.Infrastructure.Persistence.Configurations.Blog;

public class PostConfiguration : IEntityTypeConfiguration<Post>
{
    public void Configure(EntityTypeBuilder<Post> builder)
    {
        builder.ToTable("posts", "blog");

        builder.HasKey(p => p.Id);

        builder.Property(p => p.Id)
            .ValueGeneratedNever();

        builder.Property(p => p.Title)
            .IsRequired()
            .HasMaxLength(500);

        builder.Property(p => p.Slug)
            .IsRequired()
            .HasMaxLength(500);

        builder.HasIndex(p => p.Slug)
            .IsUnique();

        builder.Property(p => p.BodyMarkdown)
            .IsRequired();

        builder.Property(p => p.Status)
            .IsRequired()
            .HasConversion<string>()
            .HasMaxLength(50);

        builder.Property(p => p.AuthorId)
            .IsRequired();

        builder.Property(p => p.CategoryId);

        builder.Property(p => p.PublishedAt);

        var tagsComparer = new ValueComparer<IReadOnlyList<string>>(
            (c1, c2) => c1 != null && c2 != null && c1.SequenceEqual(c2),
            c => c.Aggregate(0, (a, v) => HashCode.Combine(a, v.GetHashCode())),
            c => c.ToList().AsReadOnly());

        builder.Property(p => p.Tags)
            .HasColumnType("jsonb")
            .HasConversion(
                v => System.Text.Json.JsonSerializer.Serialize(v, (System.Text.Json.JsonSerializerOptions?)null),
                v => (IReadOnlyList<string>)(System.Text.Json.JsonSerializer.Deserialize<List<string>>(v, (System.Text.Json.JsonSerializerOptions?)null) ?? new List<string>()))
            .Metadata.SetValueComparer(tagsComparer);
    }
}
