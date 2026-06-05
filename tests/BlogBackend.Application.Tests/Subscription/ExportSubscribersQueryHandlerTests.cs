using BlogBackend.Application.Subscription.Queries.ExportSubscribers;
using BlogBackend.Domain.Subscription.Entities;
using BlogBackend.Domain.Subscription.Ports;
using BlogBackend.Domain.Subscription.ValueObjects;
using FluentAssertions;
using NSubstitute;
using System.Text;

namespace BlogBackend.Application.Tests.Subscription;

public class ExportSubscribersQueryHandlerTests
{
    private readonly ISubscriberRepository _subscriberRepository;
    private readonly ExportSubscribersQueryHandler _handler;

    public ExportSubscribersQueryHandlerTests()
    {
        _subscriberRepository = Substitute.For<ISubscriberRepository>();
        _handler = new ExportSubscribersQueryHandler(_subscriberRepository);
    }

    [Fact]
    public async Task Handle_WithSubscribers_ReturnsCsvBytes()
    {
        // Arrange
        var subscribedAt = new DateTime(2024, 1, 15, 10, 0, 0, DateTimeKind.Utc);
        var subscriberId = Guid.NewGuid();
        var subscribers = new List<Subscriber>
        {
            new Subscriber(subscriberId, "user@example.com", SubscriberStatus.Active, Plan.Free, subscribedAt)
        };

        _subscriberRepository.GetAllAsync(1, int.MaxValue, Arg.Any<CancellationToken>())
            .Returns((subscribers.AsReadOnly() as IReadOnlyList<Subscriber>, subscribers.Count));

        var query = new ExportSubscribersQuery();

        // Act
        var bytes = await _handler.Handle(query, CancellationToken.None);

        // Assert
        bytes.Should().NotBeEmpty();
        var csv = Encoding.UTF8.GetString(bytes);
        csv.Should().Contain("Id,Email,Status,Plan,SubscribedAt");
        csv.Should().Contain("user@example.com");
        csv.Should().Contain("Active");
    }
}
