using Mediator;

namespace BlogBackend.Application.Subscription.Queries.ExportSubscribers;

public record ExportSubscribersQuery : IRequest<byte[]>;
