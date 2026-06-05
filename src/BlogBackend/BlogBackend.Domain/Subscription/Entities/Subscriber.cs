using System.Text.RegularExpressions;
using BlogBackend.Domain.Common.Exceptions;
using BlogBackend.Domain.Subscription.ValueObjects;

namespace BlogBackend.Domain.Subscription.Entities;

public class Subscriber
{
    private static readonly Regex EmailPattern = new(
        @"^[^@\s]+@[^@\s]+\.[^@\s]+$",
        RegexOptions.Compiled);

    public Guid Id { get; private set; }
    public string Email { get; private set; }
    public SubscriberStatus Status { get; private set; }
    public Plan Plan { get; private set; }
    public DateTime SubscribedAt { get; private set; }

    public Subscriber(Guid id, string email, SubscriberStatus status, Plan plan, DateTime subscribedAt)
    {
        if (!EmailPattern.IsMatch(email))
            throw new DomainException($"Email '{email}' is not a valid email address.");

        Id = id;
        Email = email;
        Status = status;
        Plan = plan;
        SubscribedAt = subscribedAt;
    }

    public void Unsubscribe()
    {
        Status = SubscriberStatus.Unsubscribed;
    }
}
