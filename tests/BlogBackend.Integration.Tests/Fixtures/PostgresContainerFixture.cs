using BlogBackend.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Testcontainers.PostgreSql;

namespace BlogBackend.Integration.Tests.Fixtures;

[CollectionDefinition("Integration")]
public class IntegrationCollection : ICollectionFixture<PostgresContainerFixture> { }

public class PostgresContainerFixture : IAsyncLifetime
{
    private readonly PostgreSqlContainer _container = new PostgreSqlBuilder("postgres:15-alpine")
        .Build();

    public string ConnectionString => _container.GetConnectionString();

    public async Task InitializeAsync()
    {
        await _container.StartAsync();

        // Run EF Core migrations against the container
        var opts = new DbContextOptionsBuilder<BlogDbContext>()
            .UseNpgsql(ConnectionString)
            .Options;

        await using var ctx = new BlogDbContext(opts);
        await ctx.Database.MigrateAsync();
    }

    public async Task DisposeAsync() => await _container.DisposeAsync();
}
