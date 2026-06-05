using BlogBackend.Application.Common.DTOs;
using BlogBackend.Domain.Subscription.Entities;
using BlogBackend.Domain.Subscription.Ports;
using Mediator;

namespace BlogBackend.Application.Subscription.Queries.GetSubscribers;

public class GetSubscribersQueryHandler : IRequestHandler<GetSubscribersQuery, PagedResult<Subscriber>>
{
    private readonly ISubscriberRepository _subscriberRepository;

    public GetSubscribersQueryHandler(ISubscriberRepository subscriberRepository)
    {
        _subscriberRepository = subscriberRepository;
    }

    public async ValueTask<PagedResult<Subscriber>> Handle(GetSubscribersQuery request, CancellationToken cancellationToken)
    {
        var (items, totalCount) = await _subscriberRepository.GetAllAsync(request.Page, request.PageSize, cancellationToken);
        return new PagedResult<Subscriber>(items, totalCount, request.Page, request.PageSize);
    }
}
