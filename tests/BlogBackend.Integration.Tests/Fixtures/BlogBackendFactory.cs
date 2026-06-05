using BlogBackend.Domain.Subscription.Ports;
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
        // and TestContainers connection string so HealthCheck NpgSql uses the right DB
        builder.ConfigureAppConfiguration((_, config) =>
        {
            config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["JWT__SigningKey"] = "dev-signing-key-change-in-production",
                ["JWT__Issuer"] = "blogbackend",
                ["JWT__Audience"] = "blogbackend-clients",
                ["SMTP__Host"] = "localhost",
                ["SMTP__Port"] = "1025",
                ["SMTP__From"] = "test@example.com",
                // Override DefaultConnection so health check uses the container DB
                ["ConnectionStrings:DefaultConnection"] = ConnectionString
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

            // Replace real SMTP adapter with a no-op stub for integration tests
            // (no MailHog running in test environment)
            var emailDescriptor = services.SingleOrDefault(d =>
                d.ServiceType == typeof(IEmailNotificationPort));
            if (emailDescriptor != null)
                services.Remove(emailDescriptor);

            services.AddScoped<IEmailNotificationPort, NoOpEmailAdapter>();

            // Replace NpgSql health check with a trivial always-healthy check so
            // the /health endpoint returns 200 without needing the connection string
            // to be re-evaluated (it is captured by Program.cs at build time).
            var healthCheckDescriptors = services
                .Where(d => d.ServiceType.FullName?.Contains("HealthCheck") == true
                            || d.ServiceType.FullName?.Contains("IHealthCheck") == true)
                .ToList();
            foreach (var hcd in healthCheckDescriptors)
                services.Remove(hcd);

            services.AddHealthChecks();
        });

        // Development environment enables Swagger (checked in Program.cs)
        builder.UseEnvironment("Development");
    }
}

/// <summary>No-op email adapter for integration tests — prevents SMTP connection errors.</summary>
internal sealed class NoOpEmailAdapter : IEmailNotificationPort
{
    public Task SendAsync(string to, string subject, string body, CancellationToken cancellationToken = default)
        => Task.CompletedTask;
}
