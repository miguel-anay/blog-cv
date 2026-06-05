using BlogBackend.Domain.Blog.Entities;
using BlogBackend.Domain.Blog.Ports;
using BlogBackend.Domain.Subscription.Entities;
using BlogBackend.Domain.Subscription.Ports;
using Mediator;

namespace BlogBackend.Application.Dashboard.Queries.GetDashboardStats;

public class GetDashboardStatsQueryHandler : IRequestHandler<GetDashboardStatsQuery, DashboardStatsDto>
{
    private readonly IPostRepository _postRepository;
    private readonly ISubscriberRepository _subscriberRepository;
    private readonly ICommentRepository _commentRepository;

    public GetDashboardStatsQueryHandler(
        IPostRepository postRepository,
        ISubscriberRepository subscriberRepository,
        ICommentRepository commentRepository)
    {
        _postRepository = postRepository;
        _subscriberRepository = subscriberRepository;
        _commentRepository = commentRepository;
    }

    public async ValueTask<DashboardStatsDto> Handle(GetDashboardStatsQuery request, CancellationToken cancellationToken)
    {
        var (posts, totalPosts) = await _postRepository.GetAllAsync(1, int.MaxValue, cancellationToken);
        var (subscribers, totalSubscribers) = await _subscriberRepository.GetAllAsync(1, int.MaxValue, cancellationToken);
        var pendingComments = await _commentRepository.GetPendingAsync(cancellationToken);
        var totalComments = await _commentRepository.CountAllAsync(cancellationToken);

        var publishedPosts = posts.Count(p => p.Status == PostStatus.Published);
        var activeSubscribers = subscribers.Count(s => s.Status == SubscriberStatus.Active);

        return new DashboardStatsDto(
            TotalPosts: totalPosts,
            PublishedPosts: publishedPosts,
            TotalSubscribers: totalSubscribers,
            ActiveSubscribers: activeSubscribers,
            TotalComments: totalComments,
            PendingComments: pendingComments.Count);
    }
}
