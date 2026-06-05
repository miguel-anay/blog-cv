using Mediator;

namespace BlogBackend.Application.Subscription.Commands.Subscribe;

public record SubscribeCommand(string Email) : IRequest<Unit>;
