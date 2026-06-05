using BlogBackend.Domain.Blog.Entities;
using BlogBackend.Domain.Identity.Entities;
using BlogBackend.Domain.Subscription.Entities;
using Microsoft.EntityFrameworkCore;

namespace BlogBackend.Infrastructure.Persistence;

public class BlogDbContext : DbContext
{
    public BlogDbContext(DbContextOptions<BlogDbContext> options) : base(options) { }

    public DbSet<Post> Posts { get; set; } = null!;
    public DbSet<Category> Categories { get; set; } = null!;
    public DbSet<Tag> Tags { get; set; } = null!;
    public DbSet<Author> Authors { get; set; } = null!;
    public DbSet<Comment> Comments { get; set; } = null!;
    public DbSet<Subscriber> Subscribers { get; set; } = null!;
    public DbSet<User> Users { get; set; } = null!;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(BlogDbContext).Assembly);
        base.OnModelCreating(modelBuilder);
    }
}
