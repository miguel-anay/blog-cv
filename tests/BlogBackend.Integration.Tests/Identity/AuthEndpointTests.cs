using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using BlogBackend.Domain.Identity.Entities;
using BlogBackend.Infrastructure.Persistence;
using BlogBackend.Integration.Tests.Fixtures;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace BlogBackend.Integration.Tests.Identity;

[Collection("Integration")]
public class AuthEndpointTests : IClassFixture<BlogBackendFactory>
{
    private readonly BlogBackendFactory _factory;
    private readonly PostgresContainerFixture _postgres;

    public AuthEndpointTests(BlogBackendFactory factory, PostgresContainerFixture postgres)
    {
        _postgres = postgres;
        factory.ConnectionString = postgres.ConnectionString;
        _factory = factory;
    }

    [Fact]
    public async Task Login_WithValidCredentials_ReturnsTokens()
    {
        // Arrange — seed a user directly via DbContext
        const string email = "authtest@example.com";
        const string password = "SuperSecret123!";
        await SeedUserAsync(email, password, UserRole.Admin);

        var client = _factory.CreateClient();

        // Act
        var response = await client.PostAsJsonAsync("/api/v1/auth/login", new
        {
            email,
            password
        });

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var body = await response.Content.ReadFromJsonAsync<LoginResponse>();
        Assert.NotNull(body);
        Assert.True(body.Success);
        Assert.NotNull(body.Data);
        Assert.False(string.IsNullOrEmpty(body.Data.AccessToken));
        Assert.False(string.IsNullOrEmpty(body.Data.RefreshToken));
    }

    [Fact]
    public async Task Login_WithInvalidCredentials_Returns401()
    {
        var client = _factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/v1/auth/login", new
        {
            email = "nobody@example.com",
            password = "WrongPassword!"
        });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Refresh_WithValidToken_ReturnsNewTokens()
    {
        // Arrange — seed user and login to get initial tokens
        const string email = "refreshtest@example.com";
        const string password = "SuperSecret123!";
        await SeedUserAsync(email, password, UserRole.Admin);

        var client = _factory.CreateClient();

        var loginResp = await client.PostAsJsonAsync("/api/v1/auth/login", new { email, password });
        Assert.Equal(HttpStatusCode.OK, loginResp.StatusCode);

        var loginBody = await loginResp.Content.ReadFromJsonAsync<LoginResponse>();
        Assert.NotNull(loginBody?.Data);

        // We need the userId to call refresh. Parse it from the JWT.
        var userId = GetUserIdFromToken(loginBody.Data.AccessToken);

        // Act
        var refreshResp = await client.PostAsJsonAsync("/api/v1/auth/refresh", new
        {
            userId,
            refreshToken = loginBody.Data.RefreshToken
        });

        // Assert
        Assert.Equal(HttpStatusCode.OK, refreshResp.StatusCode);

        var refreshBody = await refreshResp.Content.ReadFromJsonAsync<LoginResponse>();
        Assert.NotNull(refreshBody?.Data);
        Assert.False(string.IsNullOrEmpty(refreshBody.Data.AccessToken));
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private async Task SeedUserAsync(string email, string password, UserRole role)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<BlogDbContext>();

        // Avoid duplicate seed across test runs (xUnit class fixture re-use)
        var existing = await db.Users.FirstOrDefaultAsync(u => u.Email == email);
        if (existing is not null)
            return;

        var hash = BCrypt.Net.BCrypt.HashPassword(password);
        var user = new User(Guid.NewGuid(), email, hash, role);
        db.Users.Add(user);
        await db.SaveChangesAsync();
    }

    private static Guid GetUserIdFromToken(string accessToken)
    {
        // JWT payload is base64url — decode and parse sub claim
        var parts = accessToken.Split('.');
        var payload = parts[1];
        // Pad base64
        int mod = payload.Length % 4;
        var padded = mod == 2 ? payload + "==" : mod == 3 ? payload + "=" : payload;
        var json = System.Text.Encoding.UTF8.GetString(Convert.FromBase64String(padded));
        using var doc = JsonDocument.Parse(json);
        return Guid.Parse(doc.RootElement.GetProperty("sub").GetString()!);
    }

    // ── Response shape helpers ────────────────────────────────────────────────

    private sealed class LoginResponse
    {
        public bool Success { get; init; }
        public LoginData? Data { get; init; }
    }

    private sealed class LoginData
    {
        public string AccessToken { get; init; } = string.Empty;
        public string RefreshToken { get; init; } = string.Empty;
        public string Role { get; init; } = string.Empty;
    }
}
