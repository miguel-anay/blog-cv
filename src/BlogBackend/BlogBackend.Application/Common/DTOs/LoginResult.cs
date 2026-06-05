namespace BlogBackend.Application.Common.DTOs;

public record LoginResult(string AccessToken, string RefreshToken, string Role);
