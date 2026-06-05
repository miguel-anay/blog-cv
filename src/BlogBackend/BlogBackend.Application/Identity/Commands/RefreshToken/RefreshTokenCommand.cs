using BlogBackend.Application.Common.DTOs;
using Mediator;

namespace BlogBackend.Application.Identity.Commands.RefreshToken;

public record RefreshTokenCommand(Guid UserId, string RefreshToken) : IRequest<LoginResult>;
