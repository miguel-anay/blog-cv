namespace BlogBackend.Domain.Subscription.Events;

public record SubscriberConfirmed(Guid SubscriberId, string Email);
