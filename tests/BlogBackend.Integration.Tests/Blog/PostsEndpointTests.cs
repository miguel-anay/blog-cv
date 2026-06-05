using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text;
using BlogBackend.Integration.Tests.Fixtures;
using Microsoft.IdentityModel.Tokens;

namespace BlogBackend.Integration.Tests.Blog;

[Collection("Integration")]
public class PostsEndpointTests : IClassFixture<BlogBackendFactory>
{
    private readonly BlogBackendFactory _factory;
    private readonly PostgresContainerFixture _postgres;

    public PostsEndpointTests(BlogBackendFactory factory, PostgresContainerFixture postgres)
    {
        _postgres = postgres;
        factory.ConnectionString = postgres.ConnectionString;
        _factory = factory;
    }

    [Fact]
    public async Task GetPosts_ReturnsEmptyList_WhenNoPosts()
    {
        var client = _factory.CreateClient();

        var response = await client.GetAsync("/api/v1/posts");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var body = await response.Content.ReadFromJsonAsync<PostsListResponse>();
        Assert.NotNull(body);
        Assert.True(body.Success);
        Assert.NotNull(body.Data);
    }

    [Fact]
    public async Task CreatePost_WithAdminToken_Returns201()
    {
        var client = _factory.CreateClient();
        var token = GenerateAdminJwt();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var payload = new
        {
            title = "Integration Test Post",
            slug = "integration-test-post",
            bodyMarkdown = "This is the body content of the integration test post.",
            authorId = Guid.NewGuid(),
            categoryId = (Guid?)null,
            tags = new List<string>()
        };

        var response = await client.PostAsJsonAsync("/api/v1/posts", payload);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    [Fact]
    public async Task CreatePost_WithoutToken_Returns401()
    {
        var client = _factory.CreateClient();

        var payload = new
        {
            title = "No Auth Post",
            slug = "no-auth-post",
            bodyMarkdown = "Body content.",
            authorId = Guid.NewGuid(),
            categoryId = (Guid?)null,
            tags = new List<string>()
        };

        var response = await client.PostAsJsonAsync("/api/v1/posts", payload);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Swagger_IsAvailable_InDevelopment()
    {
        var client = _factory.CreateClient();

        var response = await client.GetAsync("/swagger/v1/swagger.json");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private static string GenerateAdminJwt()
    {
        var signingKey = "dev-signing-key-change-in-production";
        var issuer = "blogbackend";
        var audience = "blogbackend-clients";

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(signingKey));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, Guid.NewGuid().ToString()),
            new Claim(JwtRegisteredClaimNames.Email, "admin@test.com"),
            new Claim(ClaimTypes.Role, "Admin"),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        var token = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims: claims,
            expires: DateTime.UtcNow.AddHours(1),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    // ── Response shape helpers ────────────────────────────────────────────────

    private sealed class PostsListResponse
    {
        public bool Success { get; init; }
        public PostsData? Data { get; init; }
    }

    private sealed class PostsData
    {
        public object[]? Items { get; init; }
        public int Total { get; init; }
    }
}
