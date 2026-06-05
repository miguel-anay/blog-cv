using System.Net;
using System.Net.Http.Json;
using BlogBackend.Integration.Tests.Fixtures;

namespace BlogBackend.Integration.Tests.Subscription;

[Collection("Integration")]
public class SubscriptionsEndpointTests : IClassFixture<BlogBackendFactory>
{
    private readonly BlogBackendFactory _factory;
    private readonly PostgresContainerFixture _postgres;

    public SubscriptionsEndpointTests(BlogBackendFactory factory, PostgresContainerFixture postgres)
    {
        _postgres = postgres;
        factory.ConnectionString = postgres.ConnectionString;
        _factory = factory;
    }

    [Fact]
    public async Task Subscribe_WithValidEmail_Returns204()
    {
        var client = _factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/v1/subscriptions/subscribe", new
        {
            email = $"subscriber-{Guid.NewGuid():N}@example.com"
        });

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    [Fact]
    public async Task Subscribe_WithDuplicateEmail_Returns409()
    {
        var client = _factory.CreateClient();
        var email = $"duplicate-{Guid.NewGuid():N}@example.com";

        // First subscription succeeds
        var first = await client.PostAsJsonAsync("/api/v1/subscriptions/subscribe", new { email });
        Assert.Equal(HttpStatusCode.NoContent, first.StatusCode);

        // Second subscription with same email → 409 Conflict
        var second = await client.PostAsJsonAsync("/api/v1/subscriptions/subscribe", new { email });
        Assert.Equal(HttpStatusCode.Conflict, second.StatusCode);
    }
}
