using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;

namespace BlogBackend.Infrastructure.Persistence;

/// <summary>
/// Design-time factory used by EF Core migrations tooling.
/// Reads connection string from environment variable or falls back to a local dev default.
/// </summary>
public class BlogDbContextFactory : IDesignTimeDbContextFactory<BlogDbContext>
{
    public BlogDbContext CreateDbContext(string[] args)
    {
        var connectionString = Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection")
            ?? "Host=localhost;Port=5432;Database=blogbackend;Username=postgres;Password=postgres";

        var optionsBuilder = new DbContextOptionsBuilder<BlogDbContext>();
        optionsBuilder.UseNpgsql(connectionString);

        return new BlogDbContext(optionsBuilder.Options);
    }
}
