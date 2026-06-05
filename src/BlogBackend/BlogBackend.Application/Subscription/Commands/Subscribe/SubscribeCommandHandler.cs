using BlogBackend.Domain.Common.Exceptions;
using BlogBackend.Domain.Subscription.Entities;
using BlogBackend.Domain.Subscription.Ports;
using BlogBackend.Domain.Subscription.ValueObjects;
using Mediator;

namespace BlogBackend.Application.Subscription.Commands.Subscribe;

public class SubscribeCommandHandler : IRequestHandler<SubscribeCommand, Unit>
{
    private readonly ISubscriberRepository _subscriberRepository;
    private readonly IEmailNotificationPort _emailNotificationPort;

    public SubscribeCommandHandler(
        ISubscriberRepository subscriberRepository,
        IEmailNotificationPort emailNotificationPort)
    {
        _subscriberRepository = subscriberRepository;
        _emailNotificationPort = emailNotificationPort;
    }

    public async ValueTask<Unit> Handle(SubscribeCommand request, CancellationToken cancellationToken)
    {
        var existing = await _subscriberRepository.GetByEmailAsync(request.Email, cancellationToken);
        if (existing is not null && existing.Status == SubscriberStatus.Active)
            throw new ConflictException($"Email '{request.Email}' is already an active subscriber.");

        var subscriber = new Subscriber(
            Guid.NewGuid(),
            request.Email,
            SubscriberStatus.Active,
            Plan.Free,
            DateTime.UtcNow);

        await _subscriberRepository.AddAsync(subscriber, cancellationToken);

        await _emailNotificationPort.SendAsync(
            request.Email,
            "Welcome! Please confirm your subscription",
            "Thank you for subscribing. Please confirm your email to activate your subscription.",
            cancellationToken);

        return Unit.Value;
    }
}
