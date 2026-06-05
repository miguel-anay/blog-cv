using BlogBackend.Application.Subscription.Commands.Subscribe;
using BlogBackend.Domain.Common.Exceptions;
using BlogBackend.Domain.Subscription.Entities;
using BlogBackend.Domain.Subscription.Ports;
using BlogBackend.Domain.Subscription.ValueObjects;
using FluentAssertions;
using NSubstitute;

namespace BlogBackend.Application.Tests.Subscription;

public class SubscribeCommandHandlerTests
{
    private readonly ISubscriberRepository _subscriberRepository;
    private readonly IEmailNotificationPort _emailNotificationPort;
    private readonly SubscribeCommandHandler _handler;

    public SubscribeCommandHandlerTests()
    {
        _subscriberRepository = Substitute.For<ISubscriberRepository>();
        _emailNotificationPort = Substitute.For<IEmailNotificationPort>();
        _handler = new SubscribeCommandHandler(_subscriberRepository, _emailNotificationPort);
    }

    [Fact]
    public async Task Handle_WhenEmailAlreadySubscribed_ThrowsConflictException()
    {
        // Arrange
        var email = "existing@example.com";
        var existingSubscriber = new Subscriber(
            Guid.NewGuid(),
            email,
            SubscriberStatus.Active,
            Plan.Free,
            DateTime.UtcNow);

        _subscriberRepository.GetByEmailAsync(email, Arg.Any<CancellationToken>())
            .Returns(existingSubscriber);

        var command = new SubscribeCommand(email);

        // Act
        var act = async () => await _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<ConflictException>();
    }

    [Fact]
    public async Task Handle_WhenNewEmail_CreatesSubscriberAndSendsEmail()
    {
        // Arrange
        var email = "new@example.com";
        _subscriberRepository.GetByEmailAsync(email, Arg.Any<CancellationToken>())
            .Returns((Subscriber?)null);
        _subscriberRepository.AddAsync(Arg.Any<Subscriber>(), Arg.Any<CancellationToken>())
            .Returns(Task.CompletedTask);
        _emailNotificationPort.SendAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(Task.CompletedTask);

        var command = new SubscribeCommand(email);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        await _subscriberRepository.Received(1).AddAsync(Arg.Any<Subscriber>(), Arg.Any<CancellationToken>());
        await _emailNotificationPort.Received(1).SendAsync(email, Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>());
    }
}
