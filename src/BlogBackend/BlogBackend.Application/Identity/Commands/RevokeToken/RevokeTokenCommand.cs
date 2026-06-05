using Mediator;

namespace BlogBackend.Application.Identity.Commands.RevokeToken;

public record RevokeTokenCommand(Guid UserId) : IRequest<Unit>;
