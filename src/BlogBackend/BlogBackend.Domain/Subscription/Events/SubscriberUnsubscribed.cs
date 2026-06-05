namespace BlogBackend.Domain.Subscription.Events;

public record SubscriberUnsubscribed(Guid SubscriberId, string Email);
