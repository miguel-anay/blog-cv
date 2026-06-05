using BlogBackend.Domain.Subscription.Entities;
using BlogBackend.Domain.Subscription.ValueObjects;
using FluentAssertions;

namespace BlogBackend.Domain.Tests.Subscription;

public class SubscriberTests
{
    [Fact]
    public void Unsubscribe_WhenCalled_ChangesStatusToUnsubscribed()
    {
        // Arrange
        var subscriber = new Subscriber(
            Guid.NewGuid(),
            "user@example.com",
            SubscriberStatus.Active,
            Plan.Free,
            DateTime.UtcNow);

        // Act
        subscriber.Unsubscribe();

        // Assert
        subscriber.Status.Should().Be(SubscriberStatus.Unsubscribed);
    }
}
