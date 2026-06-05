using BlogBackend.Application.Common.DTOs;
using BlogBackend.Domain.Subscription.Entities;
using Mediator;

namespace BlogBackend.Application.Subscription.Queries.GetSubscribers;

public record GetSubscribersQuery(int Page, int PageSize) : IRequest<PagedResult<Subscriber>>;
