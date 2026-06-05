using BlogBackend.Domain.Subscription.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace BlogBackend.Infrastructure.Persistence.Configurations.Subscription;

public class SubscriberConfiguration : IEntityTypeConfiguration<Subscriber>
{
    public void Configure(EntityTypeBuilder<Subscriber> builder)
    {
        builder.ToTable("subscribers", "subscription");

        builder.HasKey(s => s.Id);

        builder.Property(s => s.Id)
            .ValueGeneratedNever();

        builder.Property(s => s.Email)
            .IsRequired()
            .HasMaxLength(320);

        builder.HasIndex(s => s.Email)
            .IsUnique();

        builder.Property(s => s.Status)
            .IsRequired()
            .HasConversion<string>()
            .HasMaxLength(50);

        builder.Property(s => s.Plan)
            .IsRequired()
            .HasConversion<string>()
            .HasMaxLength(50);

        builder.Property(s => s.SubscribedAt)
            .IsRequired();
    }
}
