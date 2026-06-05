using System.Net;
using BlogBackend.Integration.Tests.Fixtures;

namespace BlogBackend.Integration.Tests;

[Collection("Integration")]
public class HealthEndpointTests : IClassFixture<BlogBackendFactory>
{
    private readonly BlogBackendFactory _factory;
    private readonly PostgresContainerFixture _postgres;

    public HealthEndpointTests(BlogBackendFactory factory, PostgresContainerFixture postgres)
    {
        _postgres = postgres;
        factory.ConnectionString = postgres.ConnectionString;
        _factory = factory;
    }

    [Fact]
    public async Task Health_ReturnsHealthy()
    {
        var client = _factory.CreateClient();

        var response = await client.GetAsync("/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
}
