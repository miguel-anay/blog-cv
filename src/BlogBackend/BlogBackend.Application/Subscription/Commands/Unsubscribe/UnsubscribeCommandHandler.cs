using BlogBackend.Domain.Common.Exceptions;
using BlogBackend.Domain.Subscription.Ports;
using Mediator;

namespace BlogBackend.Application.Subscription.Commands.Unsubscribe;

public class UnsubscribeCommandHandler : IRequestHandler<UnsubscribeCommand, Unit>
{
    private readonly ISubscriberRepository _subscriberRepository;

    public UnsubscribeCommandHandler(ISubscriberRepository subscriberRepository)
    {
        _subscriberRepository = subscriberRepository;
    }

    public async ValueTask<Unit> Handle(UnsubscribeCommand request, CancellationToken cancellationToken)
    {
        var subscriber = await _subscriberRepository.GetByEmailAsync(request.Email, cancellationToken)
            ?? throw new NotFoundException("Subscriber", request.Email);

        subscriber.Unsubscribe();
        await _subscriberRepository.UpdateAsync(subscriber, cancellationToken);
        return Unit.Value;
    }
}
