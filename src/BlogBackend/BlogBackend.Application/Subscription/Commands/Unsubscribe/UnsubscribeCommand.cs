using Mediator;

namespace BlogBackend.Application.Subscription.Commands.Unsubscribe;

public record UnsubscribeCommand(string Email) : IRequest<Unit>;
