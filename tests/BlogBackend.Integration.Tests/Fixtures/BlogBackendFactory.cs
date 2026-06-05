using BlogBackend.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace BlogBackend.Integration.Tests.Fixtures;

public class BlogBackendFactory : WebApplicationFactory<Program>
{
    public string ConnectionString { get; set; } = string.Empty;

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        // Inject test configuration — dev JWT keys so TokenService doesn't throw
        builder.ConfigureAppConfiguration((_, config) =>
        {
            config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["JWT__SigningKey"] = "dev-signing-key-change-in-production",
                ["JWT__Issuer"] = "blogbackend",
                ["JWT__Audience"] = "blogbackend-clients",
                ["SMTP__Host"] = "localhost",
                ["SMTP__Port"] = "1025",
                ["SMTP__From"] = "test@example.com"
            });
        });

        builder.ConfigureServices(services =>
        {
            // Remove existing DbContextOptions<BlogDbContext> registration
            var descriptor = services.SingleOrDefault(d =>
                d.ServiceType == typeof(DbContextOptions<BlogDbContext>));
            if (descriptor != null)
                services.Remove(descriptor);

            // Register with the TestContainers connection string
            services.AddDbContext<BlogDbContext>(opts =>
                opts.UseNpgsql(ConnectionString));
        });

        // Development environment enables Swagger (checked in Program.cs)
        builder.UseEnvironment("Development");
    }
}
